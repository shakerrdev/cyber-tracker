import type { Session } from '#lib/types.ts';
import type { Store } from '../db/store.ts';
import { buildSessions } from './sessions.ts';

export class StatsService {
	private readonly store: Store;
	private readonly gapSec: number;
	private readonly cache = new Map<
		string,
		{ version: number; liveActive: boolean; sessions: Session[] }
	>();

	constructor(store: Store, gapSec: number) {
		this.store = store;
		this.gapSec = gapSec;
	}

	sessions(steamid64: string, liveActive: boolean): Session[] {
		const version = this.store.version;
		const cached = this.cache.get(steamid64);
		if (cached?.version === version && cached.liveActive === liveActive) return cached.sessions;
		const sessions = buildSessions(this.store.snapshots(steamid64), this.store.samples(steamid64), {
			gapSec: this.gapSec,
			liveActive
		});
		this.cache.set(steamid64, { version, liveActive, sessions });
		return sessions;
	}
}
