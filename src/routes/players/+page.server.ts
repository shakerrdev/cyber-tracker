import { fail, redirect } from '@sveltejs/kit';
import { app } from '#lib/server/app.ts';
import { PlayerInputError } from '#lib/server/players/resolve.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	add: async ({ request }) => {
		const input = String((await request.formData()).get('player') ?? '').trim();
		if (!input) return fail(400, { input, error: 'Paste a SteamID64 or a profile link.' });
		try {
			const id = await app().players.add(input);
			redirect(303, `/p/${id}`);
		} catch (error) {
			if (error instanceof PlayerInputError) return fail(400, { input, error: error.message });
			throw error;
		}
	},
	demo: async () => {
		redirect(303, `/p/${app().players.addDemo()}`);
	},
	remove: async ({ request }) => {
		const id = String((await request.formData()).get('steamid64') ?? '');
		app().players.remove(id);
		return { removed: id };
	}
};
