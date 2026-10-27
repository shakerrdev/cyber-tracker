export type Counters<K extends string> = Record<K, number>;

export const WEAPON_FIELDS = [
	'kills',
	'headshots',
	'shots',
	'hits',
	'damage',
	'hitsHead',
	'hitsNeck',
	'hitsChest',
	'hitsStomach',
	'hitsLeftArm',
	'hitsRightArm',
	'hitsLeftLeg',
	'hitsRightLeg',
	'ttkCount',
	'ttkSumMs',
	'reactionCount',
	'reactionSumMs',
	'ttdCount',
	'ttdSumMs'
] as const;
export type WeaponCounters = Counters<(typeof WEAPON_FIELDS)[number]>;

export const GENERAL_FIELDS = [
	'kills',
	'headshots',
	'damage',
	'playtime',
	'roundsCt',
	'roundsT',
	'bombDefused',
	'bombPlanted'
] as const;
export type GeneralCounters = Counters<(typeof GENERAL_FIELDS)[number]>;

export const MAP_FIELDS = [
	'kills',
	'playtime',
	'roundsCt',
	'roundsT',
	'bombDefused',
	'bombPlanted'
] as const;
export type MapCounters = Counters<(typeof MAP_FIELDS)[number]>;

export const GLOBAL_FIELDS = ['kills', 'deaths', 'shots', 'hits', 'headshots', 'playtime'] as const;
export type GlobalCounters = Counters<(typeof GLOBAL_FIELDS)[number]>;

export interface ModeCounters {
	general: GeneralCounters;
	weapons: Record<string, WeaponCounters>;
	maps: Record<string, MapCounters>;
	killstreaks: Record<string, number>;
	clutches: Record<string, number>;
}

export interface StatsSnapshot {
	global: GlobalCounters;
	allModesPlaytime: number;
	modes: Record<string, ModeCounters>;
}

export interface PlayerInfo {
	steamid64: string;
	name: string;
	avatar: string;
	avatarHash: string | null;
	country: string | null;
	faceitElo: number | null;
	faceitLevel: number | null;
	globalPlace: number | null;
	lastSeen: number | null;
}

export type Presence =
	| { kind: 'offline' }
	| { kind: 'hidden'; map: string | null }
	| {
			kind: 'server';
			ip: string;
			port: number;
			num: number | null;
			map: string | null;
			modeKey: string | null;
			category: string | null;
	  };

export interface LiveSample {
	takenAt: number;
	serverId: number | null;
	serverIp: string;
	serverPort: number;
	serverNum: number | null;
	modeId: number;
	map: string;
	kills: number;
	deaths: number;
	headshots: number;
	seconds: number;
	points: number | null;
	rank: number | null;
	ttkMs: number | null;
}

export interface Snapshot {
	id: number;
	takenAt: number;
	stats: StatsSnapshot;
}
