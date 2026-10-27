import { CybershokeError, type CybershokeClient } from '../cybershoke/client.ts';
import type { Store } from '../db/store.ts';
import { Ingestor } from '../tracker/ingest.ts';
import { Tracker, type TrackerStatus } from '../tracker/tracker.ts';
import { PlayerInputError, resolveSteamId, type FetchText } from './resolve.ts';

export interface PlayerManagerOptions {
	store: Store;
	client: CybershokeClient;
	enabled: boolean;
	profileIntervalSec: number;
	idleProfileIntervalSec: number;
	liveIntervalSec: number;
	now?: () => number;
	getText?: FetchText;
}

export class PlayerManager {
	private readonly opts: PlayerManagerOptions;
	private readonly trackers = new Map<string, Tracker>();
	private readonly now: () => number;

	constructor(opts: PlayerManagerOptions) {
		this.opts = opts;
		this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
	}

	start(initialPlayers: string[]) {
		if (this.opts.store.tracked().length === 0) {
			for (const id of initialPlayers) this.opts.store.track(id, this.now());
		}
		for (const id of this.opts.store.tracked()) this.startTracker(id);
	}

	stop() {
		for (const tracker of this.trackers.values()) tracker.stop();
	}

	ids(): string[] {
		return this.opts.store.tracked();
	}

	status(steamid64: string): TrackerStatus | null {
		return this.trackers.get(steamid64)?.status ?? null;
	}

	isLive(steamid64: string): boolean {
		return this.status(steamid64)?.state === 'in_game';
	}

	async add(input: string): Promise<string> {
		const id = await resolveSteamId(input, this.opts.getText);
		if (this.ids().includes(id)) throw new PlayerInputError('That player is already tracked.');

		let raw;
		try {
			raw = await this.opts.client.profile(id);
		} catch (error) {
			if (error instanceof CybershokeError && error.status === 404) {
				throw new PlayerInputError(
					`Cybershoke has no profile for ${id}. Has this player played there?`
				);
			}
			throw new PlayerInputError(`Couldn't reach Cybershoke: ${(error as Error).message}`);
		}
		new Ingestor(this.opts.store, id).profile(raw, this.now());
		this.opts.store.track(id, this.now());
		this.startTracker(id);
		return id;
	}

	remove(steamid64: string) {
		this.opts.store.untrack(steamid64);
		this.trackers.get(steamid64)?.stop();
		this.trackers.delete(steamid64);
	}

	private startTracker(id: string) {
		if (this.trackers.has(id)) return;
		const tracker = new Tracker({
			client: this.opts.client,
			ingestor: new Ingestor(this.opts.store, id),
			steamid64: id,
			profileIntervalSec: this.opts.profileIntervalSec,
			idleProfileIntervalSec: this.opts.idleProfileIntervalSec,
			liveIntervalSec: this.opts.liveIntervalSec,
			log: (message) => console.log(`[tracker ${id}] ${message}`)
		});
		this.trackers.set(id, tracker);
		if (this.opts.enabled) tracker.start();
	}
}
