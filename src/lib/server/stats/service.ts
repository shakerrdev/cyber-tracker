import type { Session } from '#lib/types.ts';
import type { Store } from '../db/store.ts';
import { buildSessions } from './sessions.ts';

export class StatsService {
	private readonly store: Store;
	private readonly steamid64: string;
	private readonly gapSec: number;
	private cache: { version: number; liveActive: boolean; sessions: Session[] } | null = null;

	constructor(store: Store, steamid64: string, gapSec: number) {
		this.store = store;
		this.steamid64 = steamid64;
		this.gapSec = gapSec;
	}

	sessions(liveActive: boolean): Session[] {
		const version = this.store.version;
		if (this.cache?.version === version && this.cache.liveActive === liveActive) {
			return this.cache.sessions;
		}
		const sessions = buildSessions(
			this.store.snapshots(this.steamid64),
			this.store.samples(this.steamid64),
			{ gapSec: this.gapSec, liveActive }
		);
		this.cache = { version, liveActive, sessions };
		return sessions;
	}
}
