import { error } from '@sveltejs/kit';
import { combine, metrics } from '#lib/metrics.ts';
import { filterSlug, parseModeFilter } from '#lib/modes.ts';
import { app } from '#lib/server/app.ts';
import { curveFor, mapRows, sessionRow, weaponRows } from '#lib/server/stats/views.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const { stats, players } = app();
	const sessions = stats.sessions(params.steamid, players.isLive(params.steamid));
	const index = sessions.findIndex((s) => s.id === params.id);
	if (index < 0)
		error(404, 'This session no longer exists. Sessions are regrouped as new data arrives.');

	const session = sessions[index];
	const modeIds = session.modes.map((m) => m.modeId);
	const totals = combine(session.modes);

	return {
		back: filterSlug(parseModeFilter(url.searchParams.get('mode'))),
		row: sessionRow(session, modeIds),
		modes: session.modes.map((m) => ({
			modeId: m.modeId,
			provisional: m.provisional,
			metrics: metrics(combine([m]))
		})),
		stints: session.stints.map((s) => ({
			modeId: s.modeId,
			serverNum: s.serverNum,
			maps: s.maps,
			startedAt: s.startedAt,
			seconds: s.seconds,
			kills: s.kills,
			deaths: s.deaths,
			headshots: s.headshots,
			ttkMs: s.ttkMs,
			pointsStart: s.pointsStart,
			pointsEnd: s.pointsEnd
		})),
		curve: curveFor(session, modeIds),
		weapons: weaponRows(totals),
		maps: mapRows(totals),
		killstreaks: Object.entries(totals.killstreaks)
			.map(([length, count]) => ({ length: Number(length), count }))
			.sort((a, b) => a.length - b.length),
		earlier: sessions[index - 1]?.id ?? null,
		later: sessions[index + 1]?.id ?? null
	};
};
