import { combine, metrics, weaponMetrics, type Totals } from '#lib/metrics.ts';
import type { ModeTotals, Session } from '#lib/types.ts';
import type { CurveSegment, MapRow, SessionRow, TrendPoint, WeaponRow } from '#lib/views.ts';

export const MIN_PLAYTIME_SEC = 180;
export const AVERAGE_WINDOW = 10;

export function totalsFor(session: Session, modeIds: number[]): Totals {
	return combine(session.modes.filter((m) => modeIds.includes(m.modeId)));
}

export function sessionRow(session: Session, modeIds: number[]): SessionRow {
	const modes: ModeTotals[] = session.modes.filter((m) => modeIds.includes(m.modeId));
	const totals = combine(modes);
	return {
		id: session.id,
		startedAt: session.startedAt,
		endedAt: session.endedAt,
		inProgress: session.inProgress,
		provisional: totals.provisional,
		modeIds: modes.map((m) => m.modeId),
		playtime: totals.playtime,
		metrics: metrics(totals)
	};
}

export function relevantSessions(sessions: Session[], modeIds: number[]): Session[] {
	return sessions.filter((s) =>
		s.modes.some((m) => modeIds.includes(m.modeId) && (m.playtime > 0 || m.kills > 0))
	);
}

export function curveFor(session: Session, modeIds: number[]): CurveSegment[] {
	let kills = 0;
	let deaths = 0;
	return session.stints
		.filter((s) => modeIds.includes(s.modeId))
		.map((stint) => {
			const segment: CurveSegment = {
				startedAt: stint.startedAt,
				endedAt: stint.endedAt,
				modeId: stint.modeId,
				serverNum: stint.serverNum,
				maps: stint.maps,
				points: stint.curve.map((p) => ({
					t: p.t,
					kills: kills + p.kills,
					deaths: deaths + p.deaths,
					...(p.untracked && { untracked: true })
				}))
			};
			kills += stint.kills;
			deaths += stint.deaths;
			return segment;
		});
}

export function trend(sessions: Session[], modeIds: number[]): TrendPoint[] {
	const eligible = sessions.filter((s) => totalsFor(s, modeIds).playtime >= MIN_PLAYTIME_SEC);
	const singleMode = modeIds.length === 1 ? modeIds[0] : null;
	return eligible.map((session, i) => {
		const window = eligible.slice(Math.max(0, i - AVERAGE_WINDOW + 1), i + 1);
		const mode =
			singleMode === null ? undefined : session.modes.find((m) => m.modeId === singleMode);
		return {
			id: session.id,
			t: session.startedAt,
			metrics: metrics(totalsFor(session, modeIds)),
			average: metrics(
				combine(window.flatMap((s) => s.modes.filter((m) => modeIds.includes(m.modeId))))
			),
			points: mode?.pointsAfter ?? null
		};
	});
}

export function baseline(sessions: Session[], before: Session, modeIds: number[]) {
	const index = sessions.findIndex((s) => s.id === before.id);
	const previous = sessions
		.slice(0, index)
		.filter((s) => totalsFor(s, modeIds).playtime >= MIN_PLAYTIME_SEC)
		.slice(-AVERAGE_WINDOW);
	if (previous.length === 0) return null;
	return {
		count: previous.length,
		metrics: metrics(
			combine(previous.flatMap((s) => s.modes.filter((m) => modeIds.includes(m.modeId))))
		)
	};
}

export function weaponRows(totals: Totals): WeaponRow[] {
	const all = Object.values(totals.weapons).reduce((s, w) => s + w.kills, 0);
	return Object.entries(totals.weapons)
		.filter(([, w]) => w.kills > 0 || w.shots > 0)
		.map(([key, w]) => {
			const m = weaponMetrics(w);
			return {
				key,
				kills: w.kills,
				share: all > 0 ? w.kills / all : 0,
				hsPct: m.hsPct,
				accuracy: m.accuracy,
				headHitPct: m.headHitPct,
				damagePerKill: m.damagePerKill
			};
		})
		.sort((a, b) => b.kills - a.kills);
}

export function mapRows(totals: Totals): MapRow[] {
	return Object.entries(totals.maps)
		.map(([key, m]) => ({
			key,
			kills: m.kills,
			playtime: m.playtime,
			kpm: m.playtime >= 60 ? m.kills / (m.playtime / 60) : null
		}))
		.sort((a, b) => b.playtime - a.playtime);
}
