import { join } from 'node:path';
import { config, type Config } from './config.ts';
import { createClient } from './cybershoke/client.ts';
import { openDatabase } from './db/database.ts';
import { Store } from './db/store.ts';
import { StatsService } from './stats/service.ts';
import { Ingestor } from './tracker/ingest.ts';
import { Tracker } from './tracker/tracker.ts';

export interface App {
	config: Config;
	store: Store;
	tracker: Tracker;
	stats: StatsService;
}

const key = Symbol.for('cyber-tracker.app');
const holder = globalThis as typeof globalThis & { [key]?: App };

export function app(): App {
	const existing = holder[key];
	if (existing) return existing;

	const cfg = config();
	const store = new Store(openDatabase(join(cfg.dataDir, 'cyber-tracker.db')));
	const tracker = new Tracker({
		client: createClient({ baseUrl: cfg.baseUrl }),
		ingestor: new Ingestor(store, cfg.steamid64),
		steamid64: cfg.steamid64,
		profileIntervalSec: cfg.profileIntervalSec,
		idleProfileIntervalSec: cfg.idleProfileIntervalSec,
		liveIntervalSec: cfg.liveIntervalSec
	});

	const stats = new StatsService(store, cfg.steamid64, cfg.sessionGapMin * 60);
	const instance: App = { config: cfg, store, tracker, stats };
	holder[key] = instance;

	if (cfg.trackerEnabled) tracker.start();
	process.once('sveltekit:shutdown', () => {
		tracker.stop();
		store.db.close();
	});

	return instance;
}
