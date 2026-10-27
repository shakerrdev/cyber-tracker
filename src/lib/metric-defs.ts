import { fmt, pct } from './format.ts';
import type { Metrics } from './metrics.ts';

export type MetricKey = 'kpm' | 'kd' | 'hsPct' | 'accuracy' | 'dpm' | 'ttkMs';

export interface MetricDef {
	key: MetricKey;
	label: string;
	short: string;
	higherIsBetter: boolean;
	format: (value: number | null) => string;
	formatDelta: (value: number) => string;
	description: string;
}

function delta(digits: number, percent = false) {
	return (value: number) => {
		const v = percent ? value * 100 : value;
		const s = fmt(Math.abs(v), digits) + (percent ? ' pp' : '');
		return v > 0 ? `+${s}` : v < 0 ? `−${s}` : s;
	};
}

export const METRICS: readonly MetricDef[] = [
	{
		key: 'kpm',
		label: 'Kills per minute',
		short: 'KPM',
		higherIsBetter: true,
		format: (v) => fmt(v, 2),
		formatDelta: delta(2),
		description: 'Kills divided by minutes on the server'
	},
	{
		key: 'kd',
		label: 'K/D',
		short: 'K/D',
		higherIsBetter: true,
		format: (v) => fmt(v, 2),
		formatDelta: delta(2),
		description: 'Kills per death'
	},
	{
		key: 'hsPct',
		label: 'Headshot kills',
		short: 'HS',
		higherIsBetter: true,
		format: (v) => pct(v),
		formatDelta: delta(1, true),
		description: 'Share of kills that were headshots'
	},
	{
		key: 'accuracy',
		label: 'Accuracy',
		short: 'Acc',
		higherIsBetter: true,
		format: (v) => pct(v, 1),
		formatDelta: delta(1, true),
		description: 'Hits per shot fired'
	},
	{
		key: 'dpm',
		label: 'Damage per minute',
		short: 'DPM',
		higherIsBetter: true,
		format: (v) => fmt(v),
		formatDelta: delta(0),
		description: 'Damage dealt per minute on the server'
	},
	{
		key: 'ttkMs',
		label: 'Time to kill',
		short: 'TTK',
		higherIsBetter: false,
		format: (v) => (v === null ? '–' : `${fmt(v)} ms`),
		formatDelta: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))} ms`,
		description: 'Average time from first hit to kill, where Cybershoke measured it'
	}
];

export function metricDef(key: string): MetricDef {
	return METRICS.find((m) => m.key === key) ?? METRICS[0];
}

export function metricValue(m: Metrics, key: MetricKey): number | null {
	return m[key];
}
