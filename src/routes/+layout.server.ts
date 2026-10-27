import { app } from '#lib/server/app.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	const { config, store, tracker } = app();
	const { state, presence, live, lastProfileAt, lastError } = tracker.status;
	return {
		timeZone: config.timeZone,
		now: Math.floor(Date.now() / 1000),
		player: store.player(config.steamid64),
		steamid64: config.steamid64,
		tracker: {
			enabled: config.trackerEnabled,
			state,
			presence,
			live,
			lastProfileAt,
			lastError
		}
	};
};
