import { ALL_MODES_ID, modeByKey } from '#lib/modes.ts';
import {
	GENERAL_FIELDS,
	GLOBAL_FIELDS,
	MAP_FIELDS,
	WEAPON_FIELDS,
	type Counters,
	type LiveSample,
	type ModeCounters,
	type PlayerInfo,
	type Presence,
	type StatsSnapshot
} from '#lib/types.ts';
import type {
	NumberLike,
	RawGeneral,
	RawMap,
	RawModeStats,
	RawProfile,
	RawServerData,
	RawWeapon
} from './types.ts';

export function num(value: NumberLike): number {
	const n = typeof value === 'string' ? Number(value.replace(/\s+/g, '')) : Number(value ?? 0);
	return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: NumberLike): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = num(value);
	return Number.isFinite(n) ? n : null;
}

function record<T>(value: Record<string, T> | unknown[] | null | undefined): Record<string, T> {
	return value && !Array.isArray(value) && typeof value === 'object' ? value : {};
}

export function avatarHash(url: string | null | undefined): string | null {
	return url?.match(/[0-9a-f]{40}/i)?.[0].toLowerCase() ?? null;
}

const WEAPON_SOURCE: Record<(typeof WEAPON_FIELDS)[number], keyof RawWeapon> = {
	kills: 'kills',
	headshots: 'headshots',
	shots: 'shoots',
	hits: 'hits',
	damage: 'hp',
	hitsHead: 'hits_head',
	hitsNeck: 'hits_neak',
	hitsChest: 'hits_chest',
	hitsStomach: 'hits_belly',
	hitsLeftArm: 'hits_left_arm',
	hitsRightArm: 'hits_right_arm',
	hitsLeftLeg: 'hits_left_leg',
	hitsRightLeg: 'hits_right_leg',
	ttkCount: 'ttk_count',
	ttkSumMs: 'ttk_sum_ms',
	reactionCount: 'reaction_count',
	reactionSumMs: 'reaction_sum_ms',
	ttdCount: 'ttd_count',
	ttdSumMs: 'ttd_sum_ms'
};

const GENERAL_SOURCE: Record<(typeof GENERAL_FIELDS)[number], keyof RawGeneral> = {
	kills: 'kills',
	headshots: 'headshots',
	damage: 'hp',
	playtime: 'playtime',
	roundsCt: 'rounds_ct',
	roundsT: 'rounds_t',
	bombDefused: 'bomb_defused',
	bombPlanted: 'bomb_planted'
};

const MAP_SOURCE: Record<(typeof MAP_FIELDS)[number], keyof RawMap> = {
	kills: 'kills',
	playtime: 'playtime',
	roundsCt: 'rounds_ct',
	roundsT: 'rounds_t',
	bombDefused: 'bomb_defused',
	bombPlanted: 'bomb_planted'
};

function pick<K extends string, R extends object>(
	fields: readonly K[],
	source: Record<K, keyof R>,
	raw: R | undefined
): Counters<K> {
	const out = {} as Counters<K>;
	for (const field of fields) out[field] = num(raw?.[source[field]] as NumberLike);
	return out;
}

function numericRecord(
	value: Record<string, NumberLike> | unknown[] | undefined
): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [k, v] of Object.entries(record(value))) {
		const n = num(v);
		if (n !== 0) out[k] = n;
	}
	return out;
}

export function normalizeMode(raw: RawModeStats | undefined): ModeCounters {
	const weapons: ModeCounters['weapons'] = {};
	for (const [key, weapon] of Object.entries(record<RawWeapon>(raw?.weapons))) {
		weapons[key.replace(/^weapon_/, '')] = pick(WEAPON_FIELDS, WEAPON_SOURCE, weapon);
	}
	const maps: ModeCounters['maps'] = {};
	for (const [key, map] of Object.entries(record<RawMap>(raw?.maps))) {
		maps[key] = pick(MAP_FIELDS, MAP_SOURCE, map);
	}
	return {
		general: pick(GENERAL_FIELDS, GENERAL_SOURCE, raw?.general),
		weapons,
		maps,
		killstreaks: numericRecord(raw?.killstreaks as Record<string, NumberLike> | undefined),
		clutches: numericRecord(raw?.clutches as Record<string, NumberLike> | undefined)
	};
}

export function extractStats(profile: RawProfile, modeIds: readonly number[]): StatsSnapshot {
	const rawModes = profile.statistics?.modes ?? {};
	const global = profile.cybershoke?.global;
	const modes: StatsSnapshot['modes'] = {};
	for (const id of modeIds) {
		const raw = rawModes[String(id)];
		if (raw) modes[String(id)] = normalizeMode(raw);
	}
	const globalCounters = {} as StatsSnapshot['global'];
	for (const field of GLOBAL_FIELDS) {
		globalCounters[field] = num(global?.[field === 'shots' ? 'shoots' : field]);
	}
	return {
		global: globalCounters,
		allModesPlaytime:
			num(rawModes[String(ALL_MODES_ID)]?.general?.playtime) || globalCounters.playtime,
		modes
	};
}

export function extractPlayer(profile: RawProfile): PlayerInfo {
	const { basic } = profile;
	const faceit = basic.connect?.faceit;
	return {
		steamid64: basic.steamid64,
		name: basic.name,
		avatar: basic.avatar,
		avatarHash: avatarHash(basic.avatar),
		country: basic.country ?? null,
		faceitElo: numOrNull(faceit?.elo),
		faceitLevel: numOrNull(faceit?.skill_level),
		globalPlace: numOrNull(profile.cybershoke?.top?.global),
		lastSeen: numOrNull(profile.cybershoke?.global?.lastconnect)
	};
}

export function extractPresence(profile: RawProfile): Presence {
	const server = profile.server;
	if (!server || Array.isArray(server) || Object.keys(server).length === 0)
		return { kind: 'offline' };
	const port = num(server.server_port);
	if (server.server_ip && port > 0) {
		return {
			kind: 'server',
			ip: server.server_ip,
			port,
			num: server.num ?? null,
			map: server.map ?? null,
			modeKey: server.mode ?? null,
			category: server.category ?? null
		};
	}
	return { kind: 'hidden', map: server.map ?? null };
}

export function isTrackedPresence(presence: Presence, trackedIds: readonly number[]): boolean {
	if (presence.kind !== 'server') return false;
	const mode = modeByKey(presence.modeKey);
	return mode !== undefined && trackedIds.includes(mode.id);
}

export interface LiveTarget {
	avatarHash: string | null;
	name: string;
}

export function extractLiveSample(
	data: RawServerData,
	target: LiveTarget,
	fallback: { ip: string; port: number },
	takenAt: number
): LiveSample | null {
	const info = data.serversv2?.['0'] ?? Object.values(data.serversv2 ?? {})[0];
	const players = data.playersv2 ?? [];
	const line =
		(target.avatarHash && players.find((p) => avatarHash(p.avatar) === target.avatarHash)) ||
		players.find((p) => p.name === target.name);
	if (!info || !line || info.id_mode === undefined) return null;
	return {
		takenAt,
		serverId: info.id ?? null,
		serverIp: info.ip ?? fallback.ip,
		serverPort: info.port ?? fallback.port,
		serverNum: info.num ?? null,
		modeId: info.id_mode,
		map: info.map ?? '',
		kills: num(line.kills),
		deaths: num(line.deaths),
		headshots: num(line.headshots),
		seconds: num(line.time),
		points: numOrNull(line.points),
		rank: numOrNull(line.rank),
		ttkMs: numOrNull(line.ttk)
	};
}
