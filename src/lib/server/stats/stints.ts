import type { CurvePoint, LiveSample, Stint } from '#lib/types.ts';

const REJOIN_TOLERANCE_SEC = 5;

interface Builder {
	stint: Stint;
	last: LiveSample;
	offset: { kills: number; deaths: number; headshots: number };
}

function open(sample: LiveSample): Builder {
	const startedAt = sample.takenAt - sample.seconds;
	return {
		stint: {
			modeId: sample.modeId,
			serverIp: sample.serverIp,
			serverPort: sample.serverPort,
			serverNum: sample.serverNum,
			maps: [sample.map],
			startedAt,
			endedAt: sample.takenAt,
			kills: sample.kills,
			deaths: sample.deaths,
			headshots: sample.headshots,
			seconds: sample.seconds,
			pointsStart: sample.points,
			pointsEnd: sample.points,
			rank: sample.rank,
			ttkMs: sample.ttkMs,
			curve: [
				{ t: startedAt, kills: 0, deaths: 0, headshots: 0 },
				{
					t: sample.takenAt,
					kills: sample.kills,
					deaths: sample.deaths,
					headshots: sample.headshots
				}
			]
		},
		last: sample,
		offset: { kills: 0, deaths: 0, headshots: 0 }
	};
}

function continues(b: Builder, s: LiveSample, maxGapSec: number): boolean {
	const elapsed = s.takenAt - b.last.takenAt;
	const stayed = s.seconds - b.last.seconds >= elapsed / 2;
	return (
		s.serverIp === b.last.serverIp &&
		s.serverPort === b.last.serverPort &&
		s.modeId === b.last.modeId &&
		s.seconds + REJOIN_TOLERANCE_SEC >= b.last.seconds &&
		(elapsed <= maxGapSec || stayed)
	);
}

function extend(b: Builder, s: LiveSample) {
	if (s.kills < b.last.kills || s.deaths < b.last.deaths || s.headshots < b.last.headshots) {
		b.offset.kills += b.last.kills;
		b.offset.deaths += b.last.deaths;
		b.offset.headshots += b.last.headshots;
	}
	const st = b.stint;
	st.kills = b.offset.kills + s.kills;
	st.deaths = b.offset.deaths + s.deaths;
	st.headshots = b.offset.headshots + s.headshots;
	st.seconds = s.seconds;
	st.endedAt = s.takenAt;
	if (s.points !== null) st.pointsEnd = s.points;
	st.pointsStart ??= s.points;
	if (s.rank !== null) st.rank = s.rank;
	if (s.ttkMs !== null) st.ttkMs = s.ttkMs;
	if (!st.maps.includes(s.map)) st.maps.push(s.map);
	const point = { t: s.takenAt, kills: st.kills, deaths: st.deaths, headshots: st.headshots };
	const n = st.curve.length;
	if (n >= 2 && sameScore(st.curve[n - 1], point) && sameScore(st.curve[n - 2], point)) {
		st.curve[n - 1] = point;
	} else {
		st.curve.push(point);
	}
	b.last = s;
}

function sameScore(a: CurvePoint, b: CurvePoint): boolean {
	return a.kills === b.kills && a.deaths === b.deaths && a.headshots === b.headshots;
}

export function buildStints(samples: LiveSample[], maxGapSec = 300): Stint[] {
	const sorted = [...samples].sort((a, b) => a.takenAt - b.takenAt);
	const stints: Stint[] = [];
	let current: Builder | null = null;
	for (const sample of sorted) {
		if (current && continues(current, sample, maxGapSec)) {
			extend(current, sample);
		} else {
			if (current) stints.push(current.stint);
			current = open(sample);
		}
	}
	if (current) stints.push(current.stint);
	return stints;
}
