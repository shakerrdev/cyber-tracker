import { combine, metrics } from '#lib/metrics.ts';
import { filterLabel, filterModeIds, filterSlug, parseModeFilter } from '#lib/modes.ts';
import { app } from '#lib/server/app.ts';
import {
	baseline,
	curveFor,
	relevantSessions,
	sessionRow,
	trend,
	weaponRows
} from '#lib/server/stats/views.ts';
import { parseRange, RANGES } from '#lib/views.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const filter = parseModeFilter(url.searchParams.get('mode'));
	const range = parseRange(url.searchParams.get('range'));
	const modeIds = filterModeIds(filter);
	const { stats, players } = app();

	const now = Math.floor(Date.now() / 1000);
	const days = RANGES.find((r) => r.value === range)?.days ?? null;
	const since = days === null ? 0 : now - days * 86_400;

	const sessions = relevantSessions(
		stats.sessions(params.steamid, players.isLive(params.steamid)),
		modeIds
	);
	const inRange = sessions.filter((s) => s.endedAt >= since);
	const latest = sessions.at(-1) ?? null;
	const rangeTotals = combine(
		inRange.flatMap((s) => s.modes.filter((m) => modeIds.includes(m.modeId)))
	);

	return {
		filter: {
			slug: filterSlug(filter),
			label: filterLabel(filter),
			single: filter.kind === 'mode'
		},
		range,
		hero: latest
			? {
					row: sessionRow(latest, modeIds),
					curve: curveFor(latest, modeIds),
					baseline: baseline(sessions, latest, modeIds)
				}
			: null,
		trend: trend(sessions, modeIds).filter((p) => p.t >= since),
		sessions: inRange.map((s) => sessionRow(s, modeIds)).reverse(),
		totals: metrics(rangeTotals),
		weapons: weaponRows(rangeTotals).slice(0, 8),
		hasAnySession: sessions.length > 0
	};
};
