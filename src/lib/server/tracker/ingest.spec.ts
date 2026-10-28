import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.ts';
import { Store } from '../db/store.ts';
import type { RawProfile, RawServerData } from '../cybershoke/types.ts';
import offline from '../cybershoke/fixtures/profile-offline.json' with { type: 'json' };
import serverDm from '../cybershoke/fixtures/server-dm.json' with { type: 'json' };
import { Ingestor } from './ingest.ts';

const profile = offline as unknown as RawProfile;
const id = profile.basic.steamid64;

describe('raw capture', () => {
	it('keeps every distinct raw profile once', () => {
		const store = new Store(openDatabase(':memory:'));
		const ingestor = new Ingestor(store, id);
		ingestor.profile(profile, 100);
		ingestor.profile(profile, 160);
		const changed = structuredClone(profile);
		changed.basic.name = 'renamed';
		ingestor.profile(changed, 220);
		const raws = store.rawProfiles(id);
		expect(raws.map((r) => r.takenAt)).toEqual([100, 220]);
		expect(raws[0].body).toEqual(profile);
		expect(new Ingestor(store, id).profile(changed, 280)).toBeTruthy();
		expect(store.rawProfiles(id)).toHaveLength(2);
	});

	it('keeps every scoreboard read', () => {
		const store = new Store(openDatabase(':memory:'));
		const raw = serverDm as unknown as RawServerData;
		new Ingestor(store, id).live(
			raw,
			{ avatarHash: null, name: 'nobody' },
			{ ip: '1.2.3.4', port: 27015 },
			100
		);
		expect(store.rawScoreboards(id)).toEqual([{ takenAt: 100, body: raw }]);
	});

	it('can skip raw capture', () => {
		const store = new Store(openDatabase(':memory:'));
		new Ingestor(store, id, undefined, false).profile(profile, 100);
		expect(store.rawProfiles(id)).toEqual([]);
		expect(store.snapshots(id)).toHaveLength(1);
	});
});
