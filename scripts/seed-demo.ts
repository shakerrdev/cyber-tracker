import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from '../src/lib/server/config.ts';
import { openDatabase } from '../src/lib/server/db/database.ts';
import { Store } from '../src/lib/server/db/store.ts';
import { Ingestor } from '../src/lib/server/tracker/ingest.ts';
import { avatarHash } from '../src/lib/server/cybershoke/normalize.ts';
import { rng, SimPlayer } from './sim/player.ts';

const cfg = readConfig();
const days = Number(process.env.SEED_DAYS ?? 60);
const path = join(cfg.dataDir, 'cyber-tracker.db');
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });

const store = new Store(openDatabase(path));
const ingestor = new Ingestor(store, cfg.steamid64);
const player = new SimPlayer({
	steamid64: cfg.steamid64,
	name: 'shaker (demo)',
	seed: 42,
	skill: 0.88
});
const target = { avatarHash: avatarHash(player.avatar), name: player.name };
const r = rng(1337);

const end = Math.floor(Date.now() / 1000) - 3600;
let t = end - days * 86_400;
let sessions = 0;

ingestor.profile(player.profile(t), t);

function playStint(modeId: number, minutes: number) {
	player.join(modeId, t);
	const stop = t + minutes * 60;
	let nextProfile = t + 60;
	while (t < stop) {
		const live = player.inGame;
		if (live) ingestor.live(player.server(live.ip, live.port, t), target, live, t);
		t += 20;
		if (t >= nextProfile) {
			ingestor.profile(player.profile(t), t);
			nextProfile += 60;
		}
	}
	player.leave(t);
	t += r.int(15, 60);
	ingestor.profile(player.profile(t), t);
}

while (t < end) {
	const dayStart = t;
	const playToday = r.next() < 0.7;
	if (playToday) {
		const sessionCount = r.next() < 0.25 ? 2 : 1;
		t = dayStart + r.int(16, 20) * 3600 + r.int(0, 3599);
		for (let s = 0; s < sessionCount && t < end; s++) {
			player.skill =
				0.88 + (0.24 * (t - (end - days * 86_400))) / (days * 86_400) + r.normal(0, 0.04);
			const stints = r.int(1, 4);
			for (let i = 0; i < stints && t < end; i++) {
				const modeId = r.next() < 0.75 ? 11 : r.pick([15, 22, 5, 29]);
				playStint(modeId, r.int(12, 45));
				t += r.int(30, 240);
			}
			sessions++;
			t += r.int(2, 4) * 3600;
		}
	}
	t = Math.max(t, dayStart + 86_400);
}

const snapshots = store.snapshots(cfg.steamid64).length;
const samples = store.samples(cfg.steamid64).length;
console.log(
	`seeded ${sessions} sessions over ${days} days into ${path} (${snapshots} snapshots, ${samples} samples)`
);
