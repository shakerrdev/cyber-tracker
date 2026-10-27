import { combine, metrics } from '#lib/metrics.ts';
import type { Session, Snapshot } from '#lib/types.ts';
import type { AllTimeStats, CompareStats } from '#lib/views.ts';
import { sumWeapons } from './counters.ts';
import { relevantSessions, trend } from './views.ts';

export function allTime(snapshot: Snapshot | null, modeIds: number[]): AllTimeStats | null {
	if (!snapshot) return null;
	const modes = modeIds
		.map((id) => snapshot.stats.modes[String(id)])
		.filter((m) => m !== undefined);
	let kills = 0;
	let headshots = 0;
	let damage = 0;
	let playtime = 0;
	let shots = 0;
	let hits = 0;
	let hitsHead = 0;
	for (const mode of modes) {
		const w = sumWeapons(mode.weapons);
		kills += mode.general.kills;
		headshots += mode.general.headshots;
		damage += mode.general.damage;
		playtime += mode.general.playtime;
		shots += w.shots;
		hits += w.hits;
		hitsHead += w.hitsHead;
	}
	const minutes = playtime / 60;
	const { global } = snapshot.stats;
	return {
		asOf: snapshot.takenAt,
		kills,
		playtime,
		kpm: minutes >= 1 ? kills / minutes : null,
		hsPct: kills > 0 ? headshots / kills : null,
		accuracy: shots > 0 ? hits / shots : null,
		headHitPct: hits > 0 ? hitsHead / hits : null,
		dpm: minutes >= 1 && damage > 0 ? damage / minutes : null,
		kdAllModes: global.deaths > 0 ? global.kills / global.deaths : null
	};
}

function currentPoints(sessions: Session[], modeId: number): number | null {
	for (const session of [...sessions].reverse()) {
		const stint = session.stints.findLast((s) => s.modeId === modeId && s.pointsEnd !== null);
		if (stint) return stint.pointsEnd;
	}
	return null;
}

export function compareStats(
	allSessions: Session[],
	snapshot: Snapshot | null,
	modeIds: number[],
	since: number
): CompareStats {
	const sessions = relevantSessions(allSessions, modeIds);
	const inRange = sessions.filter((s) => s.endedAt >= since);
	const totals = combine(inRange.flatMap((s) => s.modes.filter((m) => modeIds.includes(m.modeId))));
	return {
		sessions: inRange.length,
		tracked: metrics(totals),
		allTime: allTime(snapshot, modeIds),
		points: modeIds.length === 1 ? currentPoints(sessions, modeIds[0]) : null,
		trend: trend(sessions, modeIds)
			.filter((p) => p.t >= since)
			.map((p) => ({ id: p.id, t: p.t, average: p.average }))
	};
}
