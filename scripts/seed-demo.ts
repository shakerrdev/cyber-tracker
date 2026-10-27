import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig } from '../src/lib/server/config.ts';
import { avatarHash } from '../src/lib/server/cybershoke/normalize.ts';
import { openDatabase } from '../src/lib/server/db/database.ts';
import { Store } from '../src/lib/server/db/store.ts';
import { Ingestor } from '../src/lib/server/tracker/ingest.ts';
import { rng, SimPlayer } from './sim/player.ts';

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
	const ingestor = new Ingestor(store, member.id);
	const player = new SimPlayer({
		steamid64: member.id,
		name: member.name,
		seed: 42 + index,
		skill: member.skill
	});
	const target = { avatarHash: avatarHash(player.avatar), name: player.name };
	const r = rng(1337 + index);
	let t = begin;
	let sessions = 0;

	store.track(member.id, begin + index);
	ingestor.profile(player.profile(t), t);

	const playStint = (modeId: number, minutes: number) => {
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
	};

	while (t < end) {
		const dayStart = t;
		if (r.next() < member.playRate) {
			const sessionCount = r.next() < 0.25 ? 2 : 1;
			t = dayStart + r.int(16, 20) * 3600 + r.int(0, 3599);
			for (let s = 0; s < sessionCount && t < end; s++) {
				player.skill =
					member.skill + (member.gain * (t - begin)) / (end - begin) + r.normal(0, 0.04);
				const stints = r.int(1, 4);
				for (let i = 0; i < stints && t < end; i++) {
					playStint(r.next() < 0.75 ? 11 : r.pick([15, 22, 5, 29]), r.int(12, 45));
					t += r.int(30, 240);
				}
				sessions++;
				t += r.int(2, 4) * 3600;
			}
		}
		t = Math.max(t, dayStart + 86_400);
	}

	console.log(
		`${member.name}: ${sessions} sessions (${store.snapshots(member.id).length} snapshots, ${store.samples(member.id).length} samples)`
	);
}
console.log(`seeded ${roster.length} players over ${days} days into ${path}`);
