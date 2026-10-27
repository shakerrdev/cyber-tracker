import type { Store } from '../db/store.ts';
import { DemoClient } from './client.ts';
import { seedHistory } from './history.ts';

export const DEMO_ID = '76561190000000001';
export const DEMO_DAYS = 60;

export const isDemo = (steamid64: string) => steamid64 === DEMO_ID;

export function createDemo(store: Store, now: number): DemoClient {
	store.purge(DEMO_ID);
	const end = now - 20 * 60;
	const { player } = seedHistory(
		store,
		{ id: DEMO_ID, name: 'Demo player', skill: 0.9, gain: 0.22, playRate: 0.65, seed: 2026 },
		end - DEMO_DAYS * 86_400,
		end
	);
	store.track(DEMO_ID, now);
	return new DemoClient(player);
}
