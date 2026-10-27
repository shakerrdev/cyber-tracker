import { redirect } from '@sveltejs/kit';
import { app } from '#lib/server/app.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const [first] = app().players.ids();
	redirect(307, first ? `/p/${first}` : '/players');
};
