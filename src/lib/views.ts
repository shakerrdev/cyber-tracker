import type { Metrics } from './metrics.ts';

export type Range = '30d' | '90d' | 'all';

export const RANGES: readonly {
	value: Range;
	label: string;
	short: string;
	days: number | null;
}[] = [
	{ value: '30d', label: '30 days', short: '30d', days: 30 },
	{ value: '90d', label: '90 days', short: '90d', days: 90 },
	{ value: 'all', label: 'All time', short: 'All', days: null }
];

export function parseRange(value: string | null): Range {
	return RANGES.some((r) => r.value === value) ? (value as Range) : '90d';
}

export interface SessionRow {
	id: string;
	startedAt: number;
	endedAt: number;
	inProgress: boolean;
	provisional: boolean;
	modeIds: number[];
	playtime: number;
	metrics: Metrics;
}

export interface CurveSegment {
	startedAt: number;
	endedAt: number;
	modeId: number;
	serverNum: number | null;
	maps: string[];
	points: { t: number; kills: number; deaths: number }[];
}

export interface TrendPoint {
	id: string;
	t: number;
	metrics: Metrics;
	average: Metrics;
	points: number | null;
}

export interface WeaponRow {
	key: string;
	kills: number;
	share: number;
	hsPct: number | null;
	accuracy: number | null;
	headHitPct: number | null;
	damagePerKill: number | null;
}

export interface MapRow {
	key: string;
	kills: number;
	playtime: number;
	kpm: number | null;
}
