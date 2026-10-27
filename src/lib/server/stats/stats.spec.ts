import { describe, expect, it } from 'vitest';
import { combine, metrics } from '#lib/metrics.ts';
import { WEAPON_FIELDS, type LiveSample, type Snapshot, type StatsSnapshot } from '#lib/types.ts';
import { emptyMode, zero } from './counters.ts';
import { apportion, diffSnapshots } from './deltas.ts';
import { buildSessions } from './sessions.ts';
import { buildStints } from './stints.ts';

interface ModeInput {
	kills: number;
	headshots?: number;
	playtime: number;
	damage?: number;
	shots?: number;
	hits?: number;
}

function snap(
	id: number,
	takenAt: number,
	deaths: number,
	allPlaytime: number,
	modes: Record<number, ModeInput>
): Snapshot {
	const stats: StatsSnapshot = {
		global: { kills: 0, deaths, shots: 0, hits: 0, headshots: 0, playtime: allPlaytime },
		allModesPlaytime: allPlaytime,
		modes: {}
	};
	for (const [modeId, m] of Object.entries(modes)) {
		const mode = emptyMode();
		mode.general = {
			...mode.general,
			kills: m.kills,
			headshots: m.headshots ?? 0,
			playtime: m.playtime,
			damage: m.damage ?? 0
		};
		mode.weapons.ak47 = {
			...zero(WEAPON_FIELDS),
			kills: m.kills,
			shots: m.shots ?? 0,
			hits: m.hits ?? 0
		};
		stats.modes[modeId] = mode;
	}
	return { id, takenAt, stats };
}

function sample(
	takenAt: number,
	kills: number,
	deaths: number,
	seconds: number,
	extra: Partial<LiveSample> = {}
): LiveSample {
	return {
		takenAt,
		serverId: 1,
		serverIp: '1.1.1.1',
		serverPort: 27015,
		serverNum: 7,
		modeId: 11,
		map: 'de_mirage',
		kills,
		deaths,
		headshots: Math.floor(kills / 2),
		seconds,
		points: 1000,
		rank: 10,
		ttkMs: 900,
		...extra
	};
}

describe('apportion', () => {
	it('keeps the total with largest remainders', () => {
		expect(apportion(10, { a: 1, b: 1, c: 1 })).toEqual({ a: 4, b: 3, c: 3 });
		expect(apportion(7, { a: 3, b: 1 })).toEqual({ a: 5, b: 2 });
		expect(apportion(5, { a: 0 })).toEqual({ a: 0 });
	});
});

describe('diffSnapshots', () => {
	it('gives all deaths to the only mode played', () => {
		const delta = diffSnapshots(
			snap(1, 0, 100, 1000, { 11: { kills: 50, playtime: 600 } }),
			snap(2, 4000, 130, 2800, { 11: { kills: 90, headshots: 30, playtime: 2400 } })
		);
		expect(delta.modes['11'].general.kills).toBe(40);
		expect(delta.modes['11'].deaths).toBe(30);
	});

	it('splits deaths by playtime and leaves untracked playtime its share', () => {
		const delta = diffSnapshots(
			snap(1, 0, 0, 0, { 11: { kills: 0, playtime: 0 }, 15: { kills: 0, playtime: 0 } }),
			snap(2, 4000, 40, 4000, {
				11: { kills: 30, playtime: 2000 },
				15: { kills: 10, playtime: 1000 }
			})
		);
		expect(delta.modes['11'].deaths).toBe(20);
		expect(delta.modes['15'].deaths).toBe(10);
	});

	it('ignores modes that did not change', () => {
		const delta = diffSnapshots(
			snap(1, 0, 0, 0, { 11: { kills: 5, playtime: 60 }, 29: { kills: 9, playtime: 99 } }),
			snap(2, 100, 1, 60, { 11: { kills: 6, playtime: 120 }, 29: { kills: 9, playtime: 99 } })
		);
		expect(Object.keys(delta.modes)).toEqual(['11']);
	});
});

describe('buildStints', () => {
	it('splits on server change, gaps and rejoins and survives scoreboard resets', () => {
		const stints = buildStints([
			sample(1000, 2, 1, 100),
			sample(1020, 5, 2, 120),
			sample(1040, 1, 0, 140),
			sample(1060, 3, 1, 160),
			sample(1080, 0, 0, 10),
			sample(1100, 1, 0, 30, { serverPort: 27016 }),
			sample(2000, 4, 4, 930, { serverPort: 27016 }),
			sample(5000, 2, 2, 100, { serverPort: 27016 })
		]);

		expect(stints).toHaveLength(4);
		expect(stints[0]).toMatchObject({
			startedAt: 900,
			endedAt: 1060,
			kills: 8,
			deaths: 3,
			seconds: 160
		});
		expect(stints[0].curve[0]).toEqual({ t: 900, kills: 0, deaths: 0, headshots: 0 });
		expect(stints[1]).toMatchObject({ startedAt: 1070, kills: 0 });
		expect(stints[2]).toMatchObject({
			serverPort: 27016,
			startedAt: 1070,
			endedAt: 2000,
			kills: 4
		});
		expect(stints[3]).toMatchObject({ startedAt: 4900, kills: 2 });
	});

	it('collapses runs of identical scores in the curve', () => {
		const [stint] = buildStints([
			sample(100, 1, 0, 100),
			sample(120, 1, 0, 120),
			sample(140, 1, 0, 140),
			sample(160, 1, 0, 160),
			sample(180, 2, 0, 180)
		]);
		expect(stint.curve.map((p) => [p.t, p.kills])).toEqual([
			[0, 0],
			[100, 1],
			[160, 1],
			[180, 2]
		]);
	});
});

describe('buildSessions', () => {
	const base = snap(1, 0, 100, 10_000, { 11: { kills: 1000, playtime: 50_000 } });

	it('groups activity within the gap and uses profile counters once flushed', () => {
		const snapshots = [
			base,
			snap(2, 100_000, 140, 11_800, {
				11: { kills: 1060, headshots: 30, playtime: 51_800, damage: 6000, shots: 600, hits: 150 }
			}),
			snap(3, 200_000, 150, 12_400, { 11: { kills: 1075, headshots: 37, playtime: 52_400 } })
		];
		const samples = [sample(99_000, 30, 20, 900), sample(99_900, 60, 40, 1800)];

		const sessions = buildSessions(snapshots, samples, { gapSec: 1800, liveActive: false });

		expect(sessions).toHaveLength(2);
		const [first, second] = sessions;
		expect(first.stints).toHaveLength(1);
		expect(first.modes).toHaveLength(1);
		expect(first.modes[0]).toMatchObject({
			modeId: 11,
			kills: 60,
			deaths: 40,
			headshots: 30,
			playtime: 1800,
			provisional: false,
			shots: 600,
			hits: 150
		});
		expect(second.modes[0]).toMatchObject({ kills: 15, deaths: 10, provisional: false });
		expect(second.stints).toHaveLength(0);
	});

	it('adds unflushed live stints as provisional', () => {
		const samples = [sample(500_000, 3, 1, 120), sample(500_060, 7, 2, 180)];

		const [session] = buildSessions([base], samples, { gapSec: 1800, liveActive: true });

		expect(session.inProgress).toBe(true);
		expect(session.modes[0]).toMatchObject({
			kills: 7,
			deaths: 2,
			playtime: 180,
			provisional: true
		});
	});

	it('takes the rank points of the next session as the result', () => {
		const samples = [
			sample(100_000, 1, 0, 60, { points: 1000 }),
			sample(100_020, 2, 0, 80, { points: 1000 }),
			sample(300_000, 1, 0, 60, { points: 1042 })
		];

		const sessions = buildSessions([base], samples, { gapSec: 1800, liveActive: false });

		expect(sessions[0].modes[0]).toMatchObject({
			pointsBefore: 1000,
			pointsAfter: 1042,
			pointsFinal: true
		});
		expect(sessions[1].modes[0]).toMatchObject({
			pointsBefore: 1042,
			pointsAfter: 1042,
			pointsFinal: false
		});
	});
});

describe('metrics', () => {
	it('derives rates from combined totals', () => {
		const sessions = buildSessions(
			[
				snap(1, 0, 0, 0, { 11: { kills: 0, playtime: 0 }, 15: { kills: 0, playtime: 0 } }),
				snap(2, 5000, 50, 3600, {
					11: { kills: 60, headshots: 30, playtime: 2400, damage: 7200, shots: 400, hits: 100 },
					15: { kills: 40, headshots: 40, playtime: 1200, damage: 4000, shots: 200, hits: 60 }
				})
			],
			[],
			{ gapSec: 1800, liveActive: false }
		);
		const m = metrics(combine(sessions[0].modes));
		expect(m.kills).toBe(100);
		expect(m.deaths).toBe(50);
		expect(m.kd).toBe(2);
		expect(m.kpm).toBeCloseTo(100 / 60);
		expect(m.hsPct).toBeCloseTo(0.7);
		expect(m.accuracy).toBeCloseTo(160 / 600);
		expect(m.dpm).toBeCloseTo(11_200 / 60);
		expect(m.pointsDelta).toBeNull();
	});
});
