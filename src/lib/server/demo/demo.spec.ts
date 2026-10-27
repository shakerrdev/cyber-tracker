import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.ts';
import { Store } from '../db/store.ts';
import { DemoClient } from './client.ts';
import { createDemo, DEMO_ID } from './demo.ts';
import { SimPlayer } from './sim.ts';

describe('DemoClient', () => {
	it('joins after the first delay, rotates stints and goes offline', async () => {
		let t = 1_000_000;
		const player = new SimPlayer({ steamid64: DEMO_ID, seed: 1 });
		const client = new DemoClient(
			player,
			{ firstJoinSec: 10, stintSec: 100, offlineSec: 50, modes: [11, 15] },
			() => t
		);
		expect((await client.profile(DEMO_ID)).server).toEqual({});
		t += 10;
		await client.profile(DEMO_ID);
		expect(player.inGame?.modeId).toBe(11);
		t += 100;
		await client.profile(DEMO_ID);
		expect(player.inGame?.modeId).toBe(15);
		t += 100;
		await client.profile(DEMO_ID);
		expect(player.inGame).toBeNull();
	});

	it('only knows the demo player', async () => {
		const client = new DemoClient(new SimPlayer({ steamid64: DEMO_ID }));
		await expect(client.profile('76561198056395137')).rejects.toMatchObject({ status: 404 });
	});
});

describe('createDemo', () => {
	it('seeds history and replaces it on the next call', () => {
		const store = new Store(openDatabase(':memory:'));
		const now = 1_790_000_000;
		createDemo(store, now);
		const first = store.snapshots(DEMO_ID).length;
		expect(first).toBeGreaterThan(50);
		expect(store.tracked()).toEqual([DEMO_ID]);
		createDemo(store, now);
		expect(store.snapshots(DEMO_ID).length).toBe(first);
		store.purge(DEMO_ID);
		expect(store.tracked()).toEqual([]);
		expect(store.snapshots(DEMO_ID)).toEqual([]);
	});
});
