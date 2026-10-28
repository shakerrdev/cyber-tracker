import { avatarHash } from '../cybershoke/normalize.ts';
import type { Store } from '../db/store.ts';
import { Ingestor } from '../tracker/ingest.ts';
import { rng, SimPlayer } from './sim.ts';

export interface DemoMember {
	id: string;
	name: string;
	skill: number;
	gain: number;
	playRate: number;
	seed: number;
	avatar?: string;
}

export interface SeededHistory {
	player: SimPlayer;
	sessions: number;
}

export function seedHistory(
	store: Store,
	member: DemoMember,
	begin: number,
	end: number
): SeededHistory {
	const ingestor = new Ingestor(store, member.id, undefined, false);
	const player = new SimPlayer({
		steamid64: member.id,
		name: member.name,
		avatar: member.avatar,
		seed: member.seed,
		skill: member.skill
	});
	const target = { avatarHash: avatarHash(player.avatar), name: player.name };
	const r = rng(member.seed + 1295);
	let t = begin;
	let sessions = 0;

	ingestor.profile(player.profile(t), t);

	const playStint = (modeId: number, minutes: number) => {
		player.join(modeId, t);
		const stop = Math.min(t + minutes * 60, end);
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
	player.skill = member.skill + member.gain;
	return { player, sessions };
}
