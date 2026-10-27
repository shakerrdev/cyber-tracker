export type NumberLike = number | string | null | undefined;

export interface RawWeapon {
	kills?: NumberLike;
	headshots?: NumberLike;
	shoots?: NumberLike;
	hits?: NumberLike;
	hp?: NumberLike;
	hits_head?: NumberLike;
	hits_neak?: NumberLike;
	hits_chest?: NumberLike;
	hits_belly?: NumberLike;
	hits_left_arm?: NumberLike;
	hits_right_arm?: NumberLike;
	hits_left_leg?: NumberLike;
	hits_right_leg?: NumberLike;
	ttk_count?: NumberLike;
	ttk_sum_ms?: NumberLike;
	reaction_count?: NumberLike;
	reaction_sum_ms?: NumberLike;
	ttd_count?: NumberLike;
	ttd_sum_ms?: NumberLike;
}

export interface RawGeneral {
	kills?: NumberLike;
	headshots?: NumberLike;
	hp?: NumberLike;
	playtime?: NumberLike;
	rounds_ct?: NumberLike;
	rounds_t?: NumberLike;
	bomb_defused?: NumberLike;
	bomb_planted?: NumberLike;
}

export interface RawMap {
	kills?: NumberLike;
	playtime?: NumberLike;
	rounds_ct?: NumberLike;
	rounds_t?: NumberLike;
	bomb_defused?: NumberLike;
	bomb_planted?: NumberLike;
}

export interface RawModeStats {
	general?: RawGeneral;
	weapons?: Record<string, RawWeapon> | unknown[];
	maps?: Record<string, RawMap> | unknown[];
	killstreaks?: Record<string, NumberLike> | unknown[];
	clutches?: Record<string, NumberLike> | unknown[];
}

export interface RawProfileServer {
	players?: number;
	max_players?: number;
	map?: string;
	id_games?: number;
	server_ip?: string;
	server_port?: number | string;
	mode?: string;
	category?: string;
	num?: number;
	matches_id_lobby?: unknown;
	hide_type?: number;
}

export interface RawProfile {
	basic: {
		steamid64: string;
		name: string;
		name_unique?: string | null;
		avatar: string;
		country?: string | null;
		connect?: { faceit?: { elo?: NumberLike; skill_level?: NumberLike; name?: string } };
	};
	statistics?: { modes?: Record<string, RawModeStats> };
	server?: RawProfileServer | unknown[] | null;
	cybershoke?: {
		global?: {
			kills?: NumberLike;
			deaths?: NumberLike;
			shoots?: NumberLike;
			hits?: NumberLike;
			headshots?: NumberLike;
			playtime?: NumberLike;
			lastconnect?: NumberLike;
		};
		top?: { global?: NumberLike };
	};
}

export interface RawServerInfo {
	id?: number;
	ip?: string;
	port?: number;
	num?: number;
	mode?: string;
	id_mode?: number;
	map?: string;
	players?: number;
	max_players?: number;
	location?: string;
	match_start_time?: number;
	match_max_time?: number;
}

export interface RawServerPlayer {
	name: string;
	avatar: string;
	country?: string | null;
	kills: NumberLike;
	deaths: NumberLike;
	headshots: NumberLike;
	time: NumberLike;
	points?: NumberLike;
	rank?: NumberLike;
	ttk?: NumberLike;
	is_alive?: boolean;
}

export interface RawServerData {
	serversv2?: Record<string, RawServerInfo>;
	playersv2?: RawServerPlayer[];
}
