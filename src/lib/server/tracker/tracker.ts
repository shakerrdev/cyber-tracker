import { modeByKey } from '#lib/modes.ts';
import type { LiveSample, PlayerInfo, Presence } from '#lib/types.ts';
import { CybershokeError, type CybershokeClient } from '../cybershoke/client.ts';
import type { Ingestor } from './ingest.ts';

export type TrackerState = 'starting' | 'offline' | 'hidden' | 'other_mode' | 'in_game' | 'error';

export interface TrackerStatus {
	state: TrackerState;
	presence: Presence | null;
	live: LiveSample | null;
	lastProfileAt: number | null;
	lastLiveAt: number | null;
	lastError: { at: number; message: string } | null;
}

export interface TrackerOptions {
	client: CybershokeClient;
	ingestor: Ingestor;
	steamid64: string;
	profileIntervalSec: number;
	idleProfileIntervalSec: number;
	liveIntervalSec: number;
	now?: () => number;
	log?: (message: string) => void;
	onData?: () => void;
}

const RECENTLY_ACTIVE_SEC = 30 * 60;
const MAX_BACKOFF_SEC = 300;

export class Tracker {
	readonly status: TrackerStatus = {
		state: 'starting',
		presence: null,
		live: null,
		lastProfileAt: null,
		lastLiveAt: null,
		lastError: null
	};

	private readonly opts: TrackerOptions;
	private readonly now: () => number;
	private readonly log: (message: string) => void;
	private player: PlayerInfo | null = null;
	private liveAddress: { ip: string; port: number } | null = null;
	private nextProfileAt = 0;
	private nextLiveAt = 0;
	private failures = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;

	constructor(opts: TrackerOptions) {
		this.opts = opts;
		this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
		this.log = opts.log ?? ((message) => console.log(`[tracker] ${message}`));
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.log(`watching ${this.opts.steamid64}`);
		this.schedule(0);
	}

	stop() {
		this.running = false;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	async tick(): Promise<number> {
		const t = this.now();
		try {
			if (t >= this.nextProfileAt) await this.pollProfile(t);
			if (this.liveAddress && this.now() >= this.nextLiveAt) await this.pollLive(this.now());
			this.failures = 0;
		} catch (error) {
			this.handleError(error, t);
		}
		const next = this.liveAddress
			? Math.min(this.nextProfileAt, this.nextLiveAt)
			: this.nextProfileAt;
		return Math.max(1, next - this.now());
	}

	private schedule(delaySec: number) {
		if (!this.running) return;
		this.timer = setTimeout(async () => {
			const wait = await this.tick();
			this.schedule(wait);
		}, delaySec * 1000);
	}

	private async pollProfile(t: number) {
		const raw = await this.opts.client.profile(this.opts.steamid64);
		const { player, presence, snapshotInserted } = this.opts.ingestor.profile(raw, t);
		this.player = player;
		this.status.presence = presence;
		this.status.lastProfileAt = t;
		this.status.lastError = null;
		if (snapshotInserted) {
			this.log('stats changed, snapshot stored');
			this.opts.onData?.();
		}

		const tracked = presence.kind === 'server' && modeByKey(presence.modeKey) !== undefined;
		if (presence.kind === 'server' && tracked) {
			const changed =
				!this.liveAddress ||
				this.liveAddress.ip !== presence.ip ||
				this.liveAddress.port !== presence.port;
			if (changed) {
				this.log(
					`in game on ${presence.modeKey} #${presence.num ?? '?'} (${presence.ip}:${presence.port})`
				);
				this.liveAddress = { ip: presence.ip, port: presence.port };
				this.nextLiveAt = t;
			}
			this.status.state = 'in_game';
		} else {
			if (this.liveAddress) this.log('left the server');
			this.liveAddress = null;
			this.status.live = null;
			this.status.state =
				presence.kind === 'hidden'
					? 'hidden'
					: presence.kind === 'server'
						? 'other_mode'
						: 'offline';
		}

		const active =
			presence.kind !== 'offline' ||
			(player.lastSeen !== null && t - player.lastSeen < RECENTLY_ACTIVE_SEC);
		this.nextProfileAt =
			t + (active ? this.opts.profileIntervalSec : this.opts.idleProfileIntervalSec);
	}

	private async pollLive(t: number) {
		const address = this.liveAddress;
		if (!address || !this.player) return;
		const raw = await this.opts.client.server(address.ip, address.port);
		const sample = this.opts.ingestor.live(
			raw,
			{ avatarHash: this.player.avatarHash, name: this.player.name },
			address,
			t
		);
		this.status.lastLiveAt = t;
		if (sample) {
			this.status.live = sample;
			this.nextLiveAt = t + this.opts.liveIntervalSec;
			this.opts.onData?.();
			return;
		}
		this.log('not found on the server anymore, rechecking profile');
		this.liveAddress = null;
		this.status.live = null;
		this.nextProfileAt = t;
	}

	private handleError(error: unknown, t: number) {
		this.failures++;
		const message = error instanceof Error ? error.message : String(error);
		let wait: number;
		if (error instanceof CybershokeError && error.rateLimited) {
			wait = error.retryAfterSec ?? 120;
		} else {
			wait = Math.min(MAX_BACKOFF_SEC, 15 * 2 ** (this.failures - 1));
		}
		this.status.state = 'error';
		this.status.lastError = { at: t, message };
		this.nextProfileAt = Math.max(this.nextProfileAt, t + wait);
		this.nextLiveAt = Math.max(this.nextLiveAt, t + wait);
		this.log(`${message}; retrying in ${wait}s`);
	}
}
