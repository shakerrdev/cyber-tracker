import type {
	RawModeStats,
	RawProfile,
	RawServerData,
	RawServerPlayer
} from '../../src/lib/server/cybershoke/types.ts';
import { modeById } from '../../src/lib/modes.ts';

export function rng(seed: number) {
	let a = seed >>> 0;
	const next = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next,
		range: (min: number, max: number) => min + next() * (max - min),
		int: (min: number, max: number) => Math.floor(min + next() * (max - min + 1)),
		pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
		normal: (mean: number, sd: number) => {
			const u = 1 - next();
			const v = next();
			return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
		}
	};
}

type Rng = ReturnType<typeof rng>;

interface WeaponTotals {
	kills: number;
	headshots: number;
	shoots: number;
	hits: number;
	hp: number;
	hits_head: number;
	hits_chest: number;
	hits_belly: number;
	hits_left_arm: number;
	hits_right_arm: number;
	hits_left_leg: number;
	hits_right_leg: number;
	hits_neak: number;
	ttk_count: number;
	ttk_sum_ms: number;
}

interface ModeTotals {
	kills: number;
	headshots: number;
	hp: number;
	playtime: number;
	weapons: Record<string, WeaponTotals>;
	maps: Record<string, { kills: number; playtime: number }>;
	killstreaks: Record<string, number>;
}

interface Live {
	modeId: number;
	ip: string;
	port: number;
	num: number;
	map: string;
	joinedAt: number;
	updatedAt: number;
	kills: number;
	deaths: number;
	headshots: number;
	streak: number;
	ttkMs: number;
	pending: ModeTotals;
	bots: RawServerPlayer[];
}

const WEAPONS = [
	{ key: 'weapon_ak47', share: 0.72, hsBias: 0 },
	{ key: 'weapon_deagle', share: 0.16, hsBias: 0.12 },
	{ key: 'weapon_m4a1', share: 0.12, hsBias: -0.08 }
];
const MAPS = ['de_mirage', 'de_mirage', 'de_mirage', 'de_dust2', 'de_ancient', 'de_inferno'];
const MODE_FACTORS: Record<number, { kpm: number; hs: number; kd: number }> = {
	11: { kpm: 1, hs: 1, kd: 1 },
	15: { kpm: 0.7, hs: 1.6, kd: 0.95 },
	22: { kpm: 0.85, hs: 1.2, kd: 0.9 },
	5: { kpm: 0.6, hs: 0.2, kd: 1.1 },
	29: { kpm: 0.25, hs: 0.85, kd: 0.85 },
	13: { kpm: 0.22, hs: 0.8, kd: 0.8 }
};

export const DEFAULT_AVATAR =
	'https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg';

function emptyMode(): ModeTotals {
	return { kills: 0, headshots: 0, hp: 0, playtime: 0, weapons: {}, maps: {}, killstreaks: {} };
}

function emptyWeapon(): WeaponTotals {
	return {
		kills: 0,
		headshots: 0,
		shoots: 0,
		hits: 0,
		hp: 0,
		hits_head: 0,
		hits_chest: 0,
		hits_belly: 0,
		hits_left_arm: 0,
		hits_right_arm: 0,
		hits_left_leg: 0,
		hits_right_leg: 0,
		hits_neak: 0,
		ttk_count: 0,
		ttk_sum_ms: 0
	};
}

function mergeMode(target: ModeTotals, add: ModeTotals) {
	target.kills += add.kills;
	target.headshots += add.headshots;
	target.hp += add.hp;
	target.playtime += add.playtime;
	for (const [key, w] of Object.entries(add.weapons)) {
		const t = (target.weapons[key] ??= emptyWeapon());
		for (const field of Object.keys(w) as (keyof WeaponTotals)[]) t[field] += w[field];
	}
	for (const [key, m] of Object.entries(add.maps)) {
		const t = (target.maps[key] ??= { kills: 0, playtime: 0 });
		t.kills += m.kills;
		t.playtime += m.playtime;
	}
	for (const [len, count] of Object.entries(add.killstreaks)) {
		target.killstreaks[len] = (target.killstreaks[len] ?? 0) + count;
	}
}

export interface SimPlayerOptions {
	steamid64: string;
	name?: string;
	avatar?: string;
	seed?: number;
	skill?: number;
}

export class SimPlayer {
	readonly steamid64: string;
	readonly name: string;
	readonly avatar: string;
	skill: number;
	private readonly r: Rng;
	private readonly modes = new Map<number, ModeTotals>();
	private readonly points = new Map<number, number>();
	private global = { kills: 0, deaths: 0, shoots: 0, hits: 0, headshots: 0, playtime: 0 };
	private lastconnect = 0;
	private live: Live | null = null;

	constructor(opts: SimPlayerOptions) {
		this.steamid64 = opts.steamid64;
		this.name = opts.name ?? 'demo player';
		this.avatar = opts.avatar ?? DEFAULT_AVATAR;
		this.r = rng(opts.seed ?? 7);
		this.skill = opts.skill ?? 1;
		for (const id of [11, 15, 22, 5, 29, 13]) {
			const m = emptyMode();
			m.playtime = this.r.int(20_000, 400_000);
			m.kills = Math.round(m.playtime * 0.05);
			m.headshots = Math.round(m.kills * 0.6);
			m.hp = m.kills * 115;
			this.modes.set(id, m);
			this.points.set(id, this.r.int(3000, 9000));
			this.global.kills += m.kills;
			this.global.deaths += Math.round(m.kills * 0.85);
			this.global.headshots += m.headshots;
			this.global.playtime += m.playtime;
		}
	}

	get inGame(): Live | null {
		return this.live;
	}

	join(modeId: number, at: number) {
		if (this.live) this.leave(at);
		const r = this.r;
		this.live = {
			modeId,
			ip: `10.0.0.${r.int(2, 250)}`,
			port: 27015 + r.int(0, 40),
			num: r.int(1, 480),
			map: r.pick(MAPS),
			joinedAt: at,
			updatedAt: at,
			kills: 0,
			deaths: 0,
			headshots: 0,
			streak: 0,
			ttkMs: 0,
			pending: emptyMode(),
			bots: Array.from({ length: r.int(8, 14) }, (_, i) => ({
				name: `player_${i + 1}`,
				avatar: `https://avatars.steamstatic.com/${(i + 1).toString(16).padStart(40, 'a')}_full.jpg`,
				country: r.pick(['de', 'pl', 'ua', 'ru', 'se', 'fr']),
				kills: r.int(0, 140),
				deaths: r.int(5, 120),
				headshots: r.int(0, 90),
				time: r.int(30, 2400),
				points: r.int(1000, 25_000),
				rank: r.int(0, 16),
				ttk: r.int(700, 1200)
			}))
		};
		this.lastconnect = at;
	}

	advance(to: number) {
		const live = this.live;
		if (!live || to <= live.updatedAt) {
			if (live) this.lastconnect = to;
			return;
		}
		const dt = to - live.updatedAt;
		const f = MODE_FACTORS[live.modeId] ?? MODE_FACTORS[11];
		const form = this.r.normal(1, 0.08);
		const kpm = 2.9 * this.skill * f.kpm * form;
		const kd = 1.1 * this.skill * f.kd * form;
		const hsRate = Math.min(0.98, 0.6 * f.hs * (0.9 + 0.1 * this.skill));
		const kills = Math.max(
			0,
			Math.round(this.r.normal((kpm * dt) / 60, Math.sqrt((kpm * dt) / 60)))
		);
		const deaths = Math.max(0, Math.round(this.r.normal(kills / kd, Math.sqrt(kills / kd + 0.5))));

		const events = [...Array(kills).fill('k'), ...Array(deaths).fill('d')].sort(
			() => this.r.next() - 0.5
		);
		for (const e of events) {
			if (e === 'k') {
				live.streak++;
			} else {
				if (live.streak >= 2)
					live.pending.killstreaks[live.streak] = (live.pending.killstreaks[live.streak] ?? 0) + 1;
				live.streak = 0;
			}
		}

		let headshots = 0;
		for (let i = 0; i < kills; i++) {
			const weapon = this.weaponFor();
			const w = (live.pending.weapons[weapon.key] ??= emptyWeapon());
			const hs = this.r.next() < Math.min(0.99, hsRate + weapon.hsBias);
			const shots = this.r.int(4, 12);
			const hits = Math.max(1, Math.round(shots * this.r.range(0.18, 0.4) * this.skill));
			const headHits = Math.min(hits, (hs ? 1 : 0) + this.r.int(0, 1));
			w.kills++;
			w.shoots += shots;
			w.hits += hits;
			w.hp += this.r.int(100, 160);
			w.hits_head += headHits;
			w.hits_chest += Math.max(0, hits - headHits - 1);
			w.hits_belly += hits - headHits > 0 ? 1 : 0;
			if (hs) {
				w.headshots++;
				headshots++;
			}
			if (this.r.next() < 0.05) {
				w.ttk_count++;
				w.ttk_sum_ms += this.r.int(650, 1200);
			}
		}
		live.ttkMs = this.r.int(750, 1100);

		live.kills += kills;
		live.deaths += deaths;
		live.headshots += headshots;
		live.pending.kills += kills;
		live.pending.headshots += headshots;
		live.pending.playtime += dt;
		const map = (live.pending.maps[live.map] ??= { kills: 0, playtime: 0 });
		map.kills += kills;
		map.playtime += dt;
		live.updatedAt = to;
		this.lastconnect = to;
	}

	leave(at: number) {
		const live = this.live;
		if (!live) return;
		this.advance(at);
		if (live.streak >= 2)
			live.pending.killstreaks[live.streak] = (live.pending.killstreaks[live.streak] ?? 0) + 1;
		live.pending.hp = Object.values(live.pending.weapons).reduce((s, w) => s + w.hp, 0);
		const mode = this.modes.get(live.modeId) ?? emptyMode();
		mergeMode(mode, live.pending);
		this.modes.set(live.modeId, mode);

		const weaponTotals = Object.values(live.pending.weapons);
		this.global.kills += live.kills;
		this.global.deaths += live.deaths;
		this.global.headshots += live.headshots;
		this.global.playtime += live.pending.playtime;
		this.global.shoots += weaponTotals.reduce((s, w) => s + w.shoots, 0);
		this.global.hits += weaponTotals.reduce((s, w) => s + w.hits, 0);

		const kd = live.deaths > 0 ? live.kills / live.deaths : live.kills;
		const delta = Math.round((kd - 1) * 25 + live.kills * 0.4 - live.deaths * 0.25);
		this.points.set(live.modeId, Math.max(0, (this.points.get(live.modeId) ?? 5000) + delta));
		this.lastconnect = at;
		this.live = null;
	}

	private weaponFor() {
		let roll = this.r.next();
		for (const w of WEAPONS) {
			if ((roll -= w.share) <= 0) return w;
		}
		return WEAPONS[0];
	}

	profile(at: number): RawProfile {
		this.advance(at);
		const modes: Record<string, RawModeStats> = {};
		let all = 0;
		for (const [id, m] of this.modes) {
			all += m.playtime;
			modes[String(id)] = {
				general: { kills: m.kills, headshots: m.headshots, hp: m.hp, playtime: m.playtime },
				weapons: Object.fromEntries(Object.entries(m.weapons).map(([k, w]) => [k, { ...w }])),
				maps: Object.fromEntries(
					Object.entries(m.maps).map(([k, v]) => [k, { kills: v.kills, playtime: v.playtime }])
				),
				killstreaks: { ...m.killstreaks },
				clutches: {}
			};
		}
		modes['0'] = { general: { kills: this.global.kills, playtime: all } };
		const live = this.live;
		return {
			basic: {
				steamid64: this.steamid64,
				name: this.name,
				avatar: this.avatar,
				country: 'de',
				connect: { faceit: { elo: 1800, skill_level: 9 } }
			},
			statistics: { modes },
			server: live
				? {
						players: live.bots.length + 1,
						max_players: 16,
						map: live.map,
						id_games: 2,
						server_ip: live.ip,
						server_port: live.port,
						mode: modeById(live.modeId)?.key ?? 'DM',
						category: '16 SLOTS',
						num: live.num
					}
				: {},
			cybershoke: {
				global: {
					kills: this.global.kills,
					deaths: String(this.global.deaths),
					shoots: this.global.shoots,
					hits: this.global.hits,
					headshots: this.global.headshots,
					playtime: String(all),
					lastconnect: this.lastconnect
				},
				top: { global: 42_000 }
			}
		};
	}

	server(ip: string, port: number, at: number): RawServerData {
		this.advance(at);
		const live = this.live;
		if (!live || live.ip !== ip || live.port !== port) return { serversv2: {}, playersv2: [] };
		const me: RawServerPlayer = {
			name: this.name,
			avatar: this.avatar,
			country: 'de',
			kills: live.kills,
			deaths: live.deaths,
			headshots: live.headshots,
			time: at - live.joinedAt,
			points: this.points.get(live.modeId) ?? null,
			rank: 14,
			ttk: live.ttkMs || null,
			is_alive: true
		};
		return {
			serversv2: {
				'0': {
					id: live.num + 1000,
					ip,
					port,
					num: live.num,
					mode: modeById(live.modeId)?.key,
					id_mode: live.modeId,
					map: live.map,
					players: live.bots.length + 1,
					max_players: 16
				}
			},
			playersv2: [...live.bots, me].sort((a, b) => Number(b.kills) - Number(a.kills))
		};
	}
}
