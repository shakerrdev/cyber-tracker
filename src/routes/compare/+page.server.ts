import { filterLabel, filterModeIds, filterSlug, parseModeFilter } from '#lib/modes.ts';
import { app } from '#lib/server/app.ts';
import { compareStats } from '#lib/server/stats/compare.ts';
import { parseRange, RANGES } from '#lib/views.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const { players, stats, store } = app();
	const filter = parseModeFilter(url.searchParams.get('mode'));
	const range = parseRange(url.searchParams.get('range'));
	const modeIds = filterModeIds(filter);
	const days = RANGES.find((r) => r.value === range)?.days ?? null;
	const since = days === null ? 0 : Math.floor(Date.now() / 1000) - days * 86_400;

	const tracked = players.ids();
	const requested = url.searchParams.getAll('p').filter((id) => tracked.includes(id));
	const selected = requested.length ? requested : tracked;

	return {
		filter: {
			slug: filterSlug(filter),
			label: filterLabel(filter),
			single: filter.kind === 'mode'
		},
		range,
		selected,
		entries: selected.map((steamid64) => ({
			steamid64,
			color: tracked.indexOf(steamid64),
			stats: compareStats(
				stats.sessions(steamid64, players.isLive(steamid64)),
				store.latestSnapshot(steamid64),
				modeIds,
				since
			)
		}))
	};
};
