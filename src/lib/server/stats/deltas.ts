import type { ModeCounters, Snapshot } from '#lib/types.ts';
import { diffMode } from './counters.ts';

export interface ModeDelta extends ModeCounters {
	deaths: number;
}

export interface SnapshotDelta {
	from: number;
	to: number;
	modes: Record<string, ModeDelta>;
	globalDeaths: number;
	allModesPlaytime: number;
}

function played(mode: ModeCounters): boolean {
	return mode.general.playtime > 0 || mode.general.kills > 0;
}

export function apportion(total: number, weights: Record<string, number>): Record<string, number> {
	const keys = Object.keys(weights);
	const sum = keys.reduce((s, k) => s + weights[k], 0);
	const out: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
	if (total <= 0 || sum <= 0) return out;
	const exact = keys.map((k) => ({ k, v: (total * weights[k]) / sum }));
	let assigned = 0;
	for (const { k, v } of exact) {
		out[k] = Math.floor(v);
		assigned += out[k];
	}
	exact
		.sort((a, b) => (b.v % 1) - (a.v % 1))
		.slice(0, total - assigned)
		.forEach(({ k }) => out[k]++);
	return out;
}

export function diffSnapshots(prev: Snapshot, next: Snapshot): SnapshotDelta {
	const modes: Record<string, ModeCounters> = {};
	for (const [id, counters] of Object.entries(next.stats.modes)) {
		const d = diffMode(prev.stats.modes[id], counters);
		if (played(d)) modes[id] = d;
	}

	const globalDeaths = Math.max(0, next.stats.global.deaths - prev.stats.global.deaths);
	const allModesPlaytime = Math.max(0, next.stats.allModesPlaytime - prev.stats.allModesPlaytime);
	const trackedPlaytime = Object.values(modes).reduce((s, m) => s + m.general.playtime, 0);
	const untrackedPlaytime = Math.max(0, allModesPlaytime - trackedPlaytime);

	const weights: Record<string, number> = {};
	for (const [id, m] of Object.entries(modes)) weights[id] = m.general.playtime;
	if (trackedPlaytime === 0) {
		for (const [id, m] of Object.entries(modes)) weights[id] = m.general.kills;
	} else if (untrackedPlaytime > 0) {
		weights.untracked = untrackedPlaytime;
	}
	const deaths = apportion(globalDeaths, weights);

	return {
		from: prev.takenAt,
		to: next.takenAt,
		modes: Object.fromEntries(
			Object.entries(modes).map(([id, m]) => [id, { ...m, deaths: deaths[id] ?? 0 }])
		),
		globalDeaths,
		allModesPlaytime
	};
}

export function snapshotDeltas(snapshots: Snapshot[]): SnapshotDelta[] {
	const out: SnapshotDelta[] = [];
	for (let i = 1; i < snapshots.length; i++) {
		const delta = diffSnapshots(snapshots[i - 1], snapshots[i]);
		if (Object.keys(delta.modes).length > 0) out.push(delta);
	}
	return out;
}
