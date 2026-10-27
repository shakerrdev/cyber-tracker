import { describe, expect, it, vi } from 'vitest';
import { CybershokeError, type CybershokeClient } from '../cybershoke/client.ts';
import type { RawProfile, RawServerData } from '../cybershoke/types.ts';
import { openDatabase } from '../db/database.ts';
import { Store } from '../db/store.ts';
import { Ingestor } from './ingest.ts';
import { Tracker } from './tracker.ts';
import offline from '../cybershoke/fixtures/profile-offline.json' with { type: 'json' };
import inGame from '../cybershoke/fixtures/profile-in-game.json' with { type: 'json' };

const KENB = '76561198011868904';
const KENB_AVATAR =
	'https://avatars.steamstatic.com/a5f1befcb9aa4e4dc5832123db7bff6f3d358e0a_full.jpg';

function serverWith(kills: number, deaths: number, time: number): RawServerData {
	return {
		serversv2: {
			'0': { id: 4021, ip: '162.55.2.53', port: 27034, num: 102, id_mode: 11, map: 'de_mirage' }
		},
		playersv2: [
			{ name: 'someone', avatar: 'x', kills: 9, deaths: 9, headshots: 1, time: 50 },
			{
				name: 'keNb',
				avatar: KENB_AVATAR,
				kills,
				deaths,
				headshots: 1,
				time,
				points: 54384,
				rank: 16
			}
		]
	};
}

function setup(profile: RawProfile, steamid64: string) {
	const store = new Store(openDatabase(':memory:'));
	let clock = 1_793_139_583;
	const client = {
		profile: vi.fn<CybershokeClient['profile']>().mockResolvedValue(profile),
		server: vi.fn<CybershokeClient['server']>().mockResolvedValue(serverWith(0, 2, 57))
	};
	const tracker = new Tracker({
		client,
		ingestor: new Ingestor(store, steamid64),
		steamid64,
		profileIntervalSec: 60,
		idleProfileIntervalSec: 180,
		liveIntervalSec: 20,
		now: () => clock,
		log: () => {}
	});
	return {
		store,
		client,
		tracker,
		advance: (sec: number) => (clock += sec)
	};
}

describe('Tracker', () => {
	it('stores a baseline snapshot once and idles while offline', async () => {
		const { store, client, tracker, advance } = setup(
			offline as unknown as RawProfile,
			'76561198056395137'
		);

		const wait = await tracker.tick();
		expect(tracker.status.state).toBe('offline');
		expect(wait).toBe(180);
		expect(store.snapshots('76561198056395137')).toHaveLength(1);

		advance(180);
		await tracker.tick();
		expect(client.profile).toHaveBeenCalledTimes(2);
		expect(store.snapshots('76561198056395137')).toHaveLength(1);
		expect(store.player('76561198056395137')?.faceitElo).toBe(1773);
	});

	it('follows the player onto the server and records live samples', async () => {
		const { store, client, tracker, advance } = setup(inGame as unknown as RawProfile, KENB);

		const wait = await tracker.tick();
		expect(tracker.status.state).toBe('in_game');
		expect(client.server).toHaveBeenCalledWith('162.55.2.53', 27034);
		expect(tracker.status.live?.deaths).toBe(2);
		expect(wait).toBe(20);

		client.server.mockResolvedValue(serverWith(4, 11, 147));
		advance(20);
		await tracker.tick();
		expect(client.profile).toHaveBeenCalledTimes(1);

		const samples = store.samples(KENB);
		expect(samples.map((s) => [s.kills, s.deaths, s.seconds])).toEqual([
			[0, 2, 57],
			[4, 11, 147]
		]);
		expect(samples[1]).toMatchObject({ serverNum: 102, modeId: 11, points: 54384 });
	});

	it('rechecks the profile as soon as the player disappears from the server', async () => {
		const { client, tracker, advance } = setup(inGame as unknown as RawProfile, KENB);
		await tracker.tick();

		client.server.mockResolvedValue({ serversv2: serverWith(0, 0, 0).serversv2, playersv2: [] });
		client.profile.mockResolvedValue({ ...(inGame as unknown as RawProfile), server: {} });
		advance(20);
		const wait = await tracker.tick();
		expect(tracker.status.live).toBeNull();

		advance(wait);
		await tracker.tick();
		expect(client.profile).toHaveBeenCalledTimes(2);
		expect(tracker.status.state).toBe('offline');
	});

	it('backs off on rate limiting', async () => {
		const { client, tracker } = setup(inGame as unknown as RawProfile, KENB);
		client.profile.mockRejectedValue(new CybershokeError('HTTP 429', 429, 90));

		const wait = await tracker.tick();

		expect(tracker.status.state).toBe('error');
		expect(tracker.status.lastError?.message).toBe('HTTP 429');
		expect(wait).toBe(90);
	});

	it('refuses a profile for another player', async () => {
		const { tracker } = setup(offline as unknown as RawProfile, KENB);
		await tracker.tick();
		expect(tracker.status.lastError?.message).toContain('expected 76561198011868904');
	});
});
