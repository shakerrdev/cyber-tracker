import type { ModeTotals, WeaponCounters } from './types.ts';

export type Totals = Omit<ModeTotals, 'modeId' | 'pointsBefore' | 'pointsAfter'> & {
	pointsDelta: number | null;
};

export interface Metrics {
	kills: number;
	deaths: number;
	minutes: number;
	kd: number | null;
	kpm: number | null;
	hsPct: number | null;
	accuracy: number | null;
	headHitPct: number | null;
	dpm: number | null;
	ttkMs: number | null;
	pointsDelta: number | null;
	pointsFinal: boolean;
}

function ratio(a: number, b: number): number | null {
	return b > 0 ? a / b : null;
}

function mergeRecords<T extends Record<string, number>>(
	a: Record<string, T>,
	b: Record<string, T>
): Record<string, T> {
	const out: Record<string, T> = { ...a };
	for (const [key, value] of Object.entries(b)) {
		const existing = out[key];
		if (!existing) {
			out[key] = value;
			continue;
		}
		const merged = { ...existing } as Record<string, number>;
		for (const [field, n] of Object.entries(value)) merged[field] = (merged[field] ?? 0) + n;
		out[key] = merged as T;
	}
	return out;
}

function mergeNumbers(a: Record<string, number>, b: Record<string, number>) {
	const out = { ...a };
	for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
	return out;
}

export function combine(modes: ModeTotals[]): Totals {
	const base: Totals = {
		kills: 0,
		deaths: 0,
		headshots: 0,
		damage: 0,
		playtime: 0,
		shots: 0,
		hits: 0,
		hitsHead: 0,
		ttkCount: 0,
		ttkSumMs: 0,
		roundsCt: 0,
		roundsT: 0,
		bombDefused: 0,
		bombPlanted: 0,
		weapons: {},
		maps: {},
		killstreaks: {},
		clutches: {},
		provisional: false,
		pointsDelta: null,
		pointsFinal: true
	};
	return modes.reduce<Totals>((acc, m) => {
		const delta =
			m.pointsFinal && m.pointsBefore !== null && m.pointsAfter !== null
				? m.pointsAfter - m.pointsBefore
				: null;
		return {
			kills: acc.kills + m.kills,
			deaths: acc.deaths + m.deaths,
			headshots: acc.headshots + m.headshots,
			damage: acc.damage + m.damage,
			playtime: acc.playtime + m.playtime,
			shots: acc.shots + m.shots,
			hits: acc.hits + m.hits,
			hitsHead: acc.hitsHead + m.hitsHead,
			ttkCount: acc.ttkCount + m.ttkCount,
			ttkSumMs: acc.ttkSumMs + m.ttkSumMs,
			roundsCt: acc.roundsCt + m.roundsCt,
			roundsT: acc.roundsT + m.roundsT,
			bombDefused: acc.bombDefused + m.bombDefused,
			bombPlanted: acc.bombPlanted + m.bombPlanted,
			weapons: mergeRecords(acc.weapons, m.weapons),
			maps: mergeRecords(acc.maps, m.maps),
			killstreaks: mergeNumbers(acc.killstreaks, m.killstreaks),
			clutches: mergeNumbers(acc.clutches, m.clutches),
			provisional: acc.provisional || m.provisional,
			pointsDelta: delta === null ? acc.pointsDelta : (acc.pointsDelta ?? 0) + delta,
			pointsFinal: delta === null ? acc.pointsFinal : acc.pointsFinal && m.pointsFinal
		};
	}, base);
}

export function metrics(t: Totals): Metrics {
	const minutes = t.playtime / 60;
	return {
		kills: t.kills,
		deaths: t.deaths,
		minutes,
		kd: ratio(t.kills, t.deaths),
		kpm: minutes >= 1 ? t.kills / minutes : null,
		hsPct: ratio(t.headshots, t.kills),
		accuracy: ratio(t.hits, t.shots),
		headHitPct: ratio(t.hitsHead, t.hits),
		dpm: minutes >= 1 && t.damage > 0 ? t.damage / minutes : null,
		ttkMs: ratio(t.ttkSumMs, t.ttkCount),
		pointsDelta: t.pointsDelta,
		pointsFinal: t.pointsFinal
	};
}

export function weaponMetrics(w: WeaponCounters) {
	return {
		kills: w.kills,
		hsPct: ratio(w.headshots, w.kills),
		accuracy: ratio(w.hits, w.shots),
		headHitPct: ratio(w.hitsHead, w.hits),
		damagePerKill: ratio(w.damage, w.kills),
		ttkMs: ratio(w.ttkSumMs, w.ttkCount)
	};
}

export function longestStreak(killstreaks: Record<string, number>): number | null {
	const lengths = Object.entries(killstreaks)
		.filter(([, count]) => count > 0)
		.map(([len]) => Number(len));
	return lengths.length ? Math.max(...lengths) : null;
}
