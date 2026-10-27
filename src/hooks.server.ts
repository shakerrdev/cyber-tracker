import { building } from '$app/env';
import type { ServerInit } from '@sveltejs/kit/hooks';
import { app } from '#lib/server/app.ts';

export const init: ServerInit = () => {
	if (!building) app();
};
