import { app } from '#lib/server/app.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const { config, tracker } = app();
	return Response.json({
		steamid64: config.steamid64,
		trackerEnabled: config.trackerEnabled,
		...tracker.status
	});
};
