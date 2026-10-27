import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from '../src/lib/server/config.ts';
import { openDatabase } from '../src/lib/server/db/database.ts';
import { Store } from '../src/lib/server/db/store.ts';
import { seedHistory } from '../src/lib/server/demo/history.ts';

const cfg = readConfig();
const days = Number(process.env.SEED_DAYS ?? 60);
const path = join(cfg.dataDir, 'cyber-tracker.db');
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });

const store = new Store(openDatabase(path));
const end = Math.floor(Date.now() / 1000) - 3600;
const begin = end - days * 86_400;

const roster = [
	{
		id: cfg.initialPlayers[0] ?? '76561198056395137',
		name: 'shaker (demo)',
		skill: 0.88,
		gain: 0.24,
		playRate: 0.7
	},
	{ id: '76561198000000001', name: 'delg (demo)', skill: 1.02, gain: 0.04, playRate: 0.5 },
	{ id: '76561198000000002', name: 'nimm2 (demo)', skill: 0.8, gain: 0.12, playRate: 0.35 }
];

for (const [index, member] of roster.entries()) {
	store.track(member.id, begin + index);
	const { sessions } = seedHistory(store, { ...member, seed: 42 + index }, begin, end);
	console.log(
		`${member.name}: ${sessions} sessions (${store.snapshots(member.id).length} snapshots, ${store.samples(member.id).length} samples)`
	);
}
console.log(`seeded ${roster.length} players over ${days} days into ${path}`);
