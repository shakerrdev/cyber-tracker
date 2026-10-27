import { app } from '#lib/server/app.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const { config, players, store } = app();
	return Response.json({
		trackerEnabled: config.trackerEnabled,
		players: players.ids().map((steamid64) => ({
			steamid64,
			name: store.player(steamid64)?.name ?? null,
			...players.status(steamid64)
		}))
	});
};
