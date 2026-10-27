import { app } from '#lib/server/app.ts';
import { isDemo } from '#lib/server/demo/demo.ts';
import type { PlayerView } from '#lib/views.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const { config, store, players } = app();
	const list: PlayerView[] = players.ids().map((steamid64) => {
		const status = players.status(steamid64);
		return {
			steamid64,
			demo: isDemo(steamid64),
			info: store.player(steamid64),
			status: status && {
				state: status.state,
				presence: status.presence,
				live: status.live,
				lastProfileAt: status.lastProfileAt,
				lastError: status.lastError
			}
		};
	});
	return {
		timeZone: config.timeZone,
		now: Math.floor(Date.now() / 1000),
		trackerEnabled: config.trackerEnabled,
		players: list
	};
};
