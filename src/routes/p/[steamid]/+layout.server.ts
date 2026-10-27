import { error } from '@sveltejs/kit';
import { app } from '#lib/server/app.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent }) => {
	const { players } = await parent();
	const player = players.find((p) => p.steamid64 === params.steamid);
	if (!player) error(404, 'This player isn’t tracked. Add them on the Players page.');
	const live = app().players.isLive(params.steamid);
	return { player: { ...player, live } };
};
