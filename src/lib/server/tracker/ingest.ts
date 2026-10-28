import { createHash } from 'node:crypto';
import { TRACKED_MODE_IDS } from '#lib/modes.ts';
import type { LiveSample, PlayerInfo, Presence, StatsSnapshot } from '#lib/types.ts';
import {
	extractLiveSample,
	extractPlayer,
	extractPresence,
	extractStats,
	type LiveTarget
} from '../cybershoke/normalize.ts';
import type { RawProfile, RawServerData } from '../cybershoke/types.ts';
import type { Store } from '../db/store.ts';

export interface ProfileIngest {
	player: PlayerInfo;
	presence: Presence;
	snapshotInserted: boolean;
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0
	);
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function hashStats(stats: StatsSnapshot): string {
	return createHash('sha1').update(stableStringify(stats)).digest('hex');
}

export class Ingestor {
	private readonly store: Store;
	private readonly steamid64: string;
	private readonly trackedIds: readonly number[];
	private lastHash: string | null | undefined;
	private lastRawHash: string | null | undefined;

	private readonly keepRaw: boolean;

	constructor(
		store: Store,
		steamid64: string,
		trackedIds: readonly number[] = TRACKED_MODE_IDS,
		keepRaw = true
	) {
		this.keepRaw = keepRaw;
		this.store = store;
		this.steamid64 = steamid64;
		this.trackedIds = trackedIds;
	}

	profile(raw: RawProfile, at: number): ProfileIngest {
		if (raw.basic.steamid64 !== this.steamid64) {
			throw new Error(`profile is for ${raw.basic.steamid64}, expected ${this.steamid64}`);
		}
		if (this.keepRaw) this.keepRawProfile(raw, at);

		const player = extractPlayer(raw);
		this.store.upsertPlayer(player, at);

		const stats = extractStats(raw, this.trackedIds);
		const hash = hashStats(stats);
		if (this.lastHash === undefined) this.lastHash = this.store.latestSnapshotHash(this.steamid64);
		const snapshotInserted = hash !== this.lastHash;
		if (snapshotInserted) {
			this.store.insertSnapshot(this.steamid64, at, hash, stats);
			this.lastHash = hash;
		}

		return { player, presence: extractPresence(raw), snapshotInserted };
	}

	private keepRawProfile(raw: RawProfile, at: number) {
		const body = JSON.stringify(raw);
		const hash = createHash('sha1').update(body).digest('hex');
		this.lastRawHash ??= this.store.latestRawProfileHash(this.steamid64);
		if (hash === this.lastRawHash) return;
		this.store.insertRawProfile(this.steamid64, at, hash, body);
		this.lastRawHash = hash;
	}

	live(
		raw: RawServerData,
		target: LiveTarget,
		address: { ip: string; port: number },
		at: number
	): LiveSample | null {
		if (this.keepRaw)
			this.store.insertRawScoreboard(this.steamid64, at, address, JSON.stringify(raw));
		const sample = extractLiveSample(raw, target, address, at);
		if (sample && this.trackedIds.includes(sample.modeId)) {
			this.store.insertSample(this.steamid64, sample);
			return sample;
		}
		return null;
	}
}
