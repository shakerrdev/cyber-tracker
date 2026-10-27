import { describe, expect, it } from 'vitest';
import { TRACKED_MODE_IDS } from '#lib/modes.ts';
import { extractStats } from '../cybershoke/normalize.ts';
import type { RawProfile } from '../cybershoke/types.ts';
import offline from '../cybershoke/fixtures/profile-offline.json' with { type: 'json' };
import { allTime, compareStats } from './compare.ts';

const stats = extractStats(offline as unknown as RawProfile, TRACKED_MODE_IDS);
const snapshot = { id: 1, takenAt: 1_700_000_000, stats };

describe('allTime', () => {
	it('is null without a snapshot', () => {
		expect(allTime(null, [11])).toBeNull();
	});

	it('sums the selected modes', () => {
		const dm = allTime(snapshot, [11])!;
		const both = allTime(snapshot, [11, 15])!;
		expect(dm.kills).toBe(stats.modes['11'].general.kills);
		expect(both.kills).toBe(stats.modes['11'].general.kills + stats.modes['15'].general.kills);
		expect(both.playtime).toBe(
			stats.modes['11'].general.playtime + stats.modes['15'].general.playtime
		);
		expect(dm.kpm).toBeCloseTo(dm.kills / (dm.playtime / 60));
	});

	it('uses deaths from every mode for K/D', () => {
		const dm = allTime(snapshot, [11])!;
		expect(dm.kdAllModes).toBeCloseTo(stats.global.kills / stats.global.deaths);
	});

	it('ignores modes the player never played', () => {
		expect(allTime(snapshot, [5])!.kills).toBe(0);
		expect(allTime(snapshot, [5])!.kpm).toBeNull();
	});
});

describe('compareStats', () => {
	it('handles a player without sessions', () => {
		const result = compareStats([], snapshot, [11], 0);
		expect(result.sessions).toBe(0);
		expect(result.trend).toEqual([]);
		expect(result.points).toBeNull();
		expect(result.allTime?.kills).toBe(stats.modes['11'].general.kills);
	});
});
