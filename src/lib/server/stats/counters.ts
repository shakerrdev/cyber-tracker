import {
	GENERAL_FIELDS,
	MAP_FIELDS,
	WEAPON_FIELDS,
	type Counters,
	type ModeCounters
} from '#lib/types.ts';

export function zero<K extends string>(fields: readonly K[]): Counters<K> {
	const out = {} as Counters<K>;
	for (const f of fields) out[f] = 0;
	return out;
}

export function diff<K extends string>(
	fields: readonly K[],
	prev: Counters<K> | undefined,
	next: Counters<K>
): Counters<K> {
	const out = {} as Counters<K>;
	for (const f of fields) out[f] = Math.max(0, (next[f] ?? 0) - (prev?.[f] ?? 0));
	return out;
}

export function add<K extends string>(
	fields: readonly K[],
	a: Counters<K>,
	b: Counters<K>
): Counters<K> {
	const out = {} as Counters<K>;
	for (const f of fields) out[f] = (a[f] ?? 0) + (b[f] ?? 0);
	return out;
}

export function isZero(counters: Record<string, number>): boolean {
	return Object.values(counters).every((v) => v === 0);
}

function diffMap<K extends string>(
	fields: readonly K[],
	prev: Record<string, Counters<K>> | undefined,
	next: Record<string, Counters<K>>
): Record<string, Counters<K>> {
	const out: Record<string, Counters<K>> = {};
	for (const [key, value] of Object.entries(next)) {
		const d = diff(fields, prev?.[key], value);
		if (!isZero(d)) out[key] = d;
	}
	return out;
}

function addMap<K extends string>(
	fields: readonly K[],
	a: Record<string, Counters<K>>,
	b: Record<string, Counters<K>>
): Record<string, Counters<K>> {
	const out = { ...a };
	for (const [key, value] of Object.entries(b))
		out[key] = add(fields, out[key] ?? zero(fields), value);
	return out;
}

function diffNumbers(prev: Record<string, number> | undefined, next: Record<string, number>) {
	const out: Record<string, number> = {};
	for (const [key, value] of Object.entries(next)) {
		const d = value - (prev?.[key] ?? 0);
		if (d > 0) out[key] = d;
	}
	return out;
}

function addNumbers(a: Record<string, number>, b: Record<string, number>) {
	const out = { ...a };
	for (const [key, value] of Object.entries(b)) out[key] = (out[key] ?? 0) + value;
	return out;
}

export function emptyMode(): ModeCounters {
	return { general: zero(GENERAL_FIELDS), weapons: {}, maps: {}, killstreaks: {}, clutches: {} };
}

export function diffMode(prev: ModeCounters | undefined, next: ModeCounters): ModeCounters {
	return {
		general: diff(GENERAL_FIELDS, prev?.general, next.general),
		weapons: diffMap(WEAPON_FIELDS, prev?.weapons, next.weapons),
		maps: diffMap(MAP_FIELDS, prev?.maps, next.maps),
		killstreaks: diffNumbers(prev?.killstreaks, next.killstreaks),
		clutches: diffNumbers(prev?.clutches, next.clutches)
	};
}

export function addMode(a: ModeCounters, b: ModeCounters): ModeCounters {
	return {
		general: add(GENERAL_FIELDS, a.general, b.general),
		weapons: addMap(WEAPON_FIELDS, a.weapons, b.weapons),
		maps: addMap(MAP_FIELDS, a.maps, b.maps),
		killstreaks: addNumbers(a.killstreaks, b.killstreaks),
		clutches: addNumbers(a.clutches, b.clutches)
	};
}

export function sumWeapons(weapons: Record<string, Counters<(typeof WEAPON_FIELDS)[number]>>) {
	return Object.values(weapons).reduce((acc, w) => add(WEAPON_FIELDS, acc, w), zero(WEAPON_FIELDS));
}
