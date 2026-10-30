import type { LiveSample, ModeCounters, ModeTotals, Session, Snapshot, Stint } from '#lib/types.ts';
import { addMode, emptyMode, sumWeapons } from './counters.ts';
import { snapshotDeltas, type SnapshotDelta } from './deltas.ts';
import { buildStints } from './stints.ts';

export interface SessionOptions {
	gapSec: number;
	liveActive: boolean;
}

interface Activity {
	start: number;
	end: number;
	delta?: SnapshotDelta;
	stint?: Stint;
}

interface Group {
	start: number;
	end: number;
	deltas: SnapshotDelta[];
	stints: Stint[];
}

interface LiveExtra {
	kills: number;
	deaths: number;
	headshots: number;
	seconds: number;
}

function deltaActivity(delta: SnapshotDelta): Activity {
	const playtime = Object.values(delta.modes).reduce((s, m) => s + m.general.playtime, 0);
	return { start: Math.max(delta.from, delta.to - playtime), end: delta.to, delta };
}

function group(activities: Activity[], gapSec: number): Group[] {
	const groups: Group[] = [];
	for (const a of [...activities].sort((x, y) => x.start - y.start || x.end - y.end)) {
		let target = groups[groups.length - 1];
		if (!target || a.start > target.end + gapSec) {
			target = { start: a.start, end: a.end, deltas: [], stints: [] };
			groups.push(target);
		}
		target.start = Math.min(target.start, a.start);
		target.end = Math.max(target.end, a.end);
		if (a.delta) target.deltas.push(a.delta);
		if (a.stint) target.stints.push(a.stint);
	}
	return groups;
}

function isFlushed(stint: Stint, deltas: SnapshotDelta[]): boolean {
	return deltas.some((d) => d.modes[stint.modeId] !== undefined && d.to >= stint.endedAt);
}

function totals(
	modeId: number,
	counters: ModeCounters,
	deaths: number,
	extra: LiveExtra | undefined,
	points: { before: number | null; after: number | null; final: boolean }
): ModeTotals {
	const w = sumWeapons(counters.weapons);
	const g = counters.general;
	return {
		modeId,
		kills: g.kills + (extra?.kills ?? 0),
		deaths: deaths + (extra?.deaths ?? 0),
		headshots: g.headshots + (extra?.headshots ?? 0),
		damage: g.damage,
		playtime: g.playtime + (extra?.seconds ?? 0),
		shots: w.shots,
		hits: w.hits,
		hitsHead: w.hitsHead,
		ttkCount: w.ttkCount,
		ttkSumMs: w.ttkSumMs,
		roundsCt: g.roundsCt,
		roundsT: g.roundsT,
		bombDefused: g.bombDefused,
		bombPlanted: g.bombPlanted,
		weapons: counters.weapons,
		maps: counters.maps,
		killstreaks: counters.killstreaks,
		clutches: counters.clutches,
		provisional: extra !== undefined,
		pointsBefore: points.before,
		pointsAfter: points.after,
		pointsFinal: points.final
	};
}

function pointsFor(groups: Group[], index: number, modeId: number) {
	const inSession = groups[index].stints.filter((s) => s.modeId === modeId);
	if (inSession.length === 0) return { before: null, after: null, final: false };
	const before = inSession.find((s) => s.pointsStart !== null)?.pointsStart ?? null;
	let after: number | null = null;
	for (const later of groups.slice(index + 1)) {
		after =
			later.stints.find((s) => s.modeId === modeId && s.pointsStart !== null)?.pointsStart ?? null;
		if (after !== null) break;
	}
	const final = after !== null;
	after ??= inSession.findLast((s) => s.pointsEnd !== null)?.pointsEnd ?? null;
	return { before, after, final };
}

export function buildSessions(
	snapshots: Snapshot[],
	samples: LiveSample[],
	{ gapSec, liveActive }: SessionOptions
): Session[] {
	const deltas = snapshotDeltas(snapshots);
	const stints = buildStints(samples);
	const groups = group(
		[
			...deltas.map(deltaActivity),
			...stints.map((stint) => ({ start: stint.startedAt, end: stint.endedAt, stint }))
		],
		gapSec
	);

	return groups.map((g, index) => {
		const counters = new Map<number, { counters: ModeCounters; deaths: number }>();
		for (const delta of g.deltas) {
			for (const [id, mode] of Object.entries(delta.modes)) {
				const entry = counters.get(Number(id)) ?? { counters: emptyMode(), deaths: 0 };
				entry.counters = addMode(entry.counters, mode);
				entry.deaths += mode.deaths;
				counters.set(Number(id), entry);
			}
		}

		const liveDeaths = new Map<number, number>();
		const extras = new Map<number, LiveExtra>();
		for (const stint of g.stints) {
			if (isFlushed(stint, g.deltas)) {
				liveDeaths.set(stint.modeId, (liveDeaths.get(stint.modeId) ?? 0) + stint.deaths);
				continue;
			}
			const extra = extras.get(stint.modeId) ?? { kills: 0, deaths: 0, headshots: 0, seconds: 0 };
			extra.kills += stint.kills;
			extra.deaths += stint.deaths;
			extra.headshots += stint.headshots;
			extra.seconds += stint.seconds;
			extras.set(stint.modeId, extra);
		}

		const modeIds = new Set([...counters.keys(), ...extras.keys()]);
		const modes = [...modeIds]
			.map((id) =>
				totals(
					id,
					counters.get(id)?.counters ?? emptyMode(),
					liveDeaths.get(id) ?? counters.get(id)?.deaths ?? 0,
					extras.get(id),
					pointsFor(groups, index, id)
				)
			)
			.sort((a, b) => b.playtime - a.playtime);

		return {
			id: String(g.start),
			startedAt: g.start,
			endedAt: g.end,
			inProgress: liveActive && index === groups.length - 1,
			modes,
			stints: g.stints.sort((a, b) => a.startedAt - b.startedAt)
		};
	});
}
