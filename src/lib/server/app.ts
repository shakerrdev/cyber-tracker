import { join } from 'node:path';
import { config, type Config } from './config.ts';
import { createClient } from './cybershoke/client.ts';
import { createSharedClient } from './cybershoke/shared.ts';
import { openDatabase } from './db/database.ts';
import { Store } from './db/store.ts';
import { PlayerManager } from './players/manager.ts';
import { StatsService } from './stats/service.ts';

export interface App {
	config: Config;
	store: Store;
	players: PlayerManager;
	stats: StatsService;
}

const key = Symbol.for('cyber-tracker.app');
const holder = globalThis as typeof globalThis & { [key]?: App };

export function app(): App {
	const existing = holder[key];
	if (existing) return existing;

	const cfg = config();
	const store = new Store(openDatabase(join(cfg.dataDir, 'cyber-tracker.db')));
	const players = new PlayerManager({
		store,
		client: createSharedClient(createClient({ baseUrl: cfg.baseUrl })),
		enabled: cfg.trackerEnabled,
		profileIntervalSec: cfg.profileIntervalSec,
		idleProfileIntervalSec: cfg.idleProfileIntervalSec,
		liveIntervalSec: cfg.liveIntervalSec
	});
	const stats = new StatsService(store, cfg.sessionGapMin * 60);
	const instance: App = { config: cfg, store, players, stats };
	holder[key] = instance;

	players.start(cfg.initialPlayers);
	process.once('sveltekit:shutdown', () => {
		players.stop();
		store.db.close();
	});

	return instance;
}
