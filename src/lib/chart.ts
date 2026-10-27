const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

export function tzOffsetSec(t: number, timeZone: string): number {
	let f = offsetFormatters.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		offsetFormatters.set(timeZone, f);
	}
	const parts = f.formatToParts(t * 1000);
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	const asUtc =
		Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) /
		1000;
	return asUtc - t;
}

const STEPS = [
	60, 300, 600, 900, 1800, 3600, 7200, 10_800, 21_600, 43_200, 86_400, 172_800, 604_800, 1_209_600,
	2_592_000
];

export function timeTicks(start: number, end: number, timeZone: string, target = 6): number[] {
	if (end <= start) return [start];
	const step = STEPS.find((s) => (end - start) / s <= target) ?? STEPS[STEPS.length - 1];
	const offset = tzOffsetSec(start, timeZone);
	const ticks: number[] = [];
	for (let t = Math.ceil((start + offset) / step) * step - offset; t <= end; t += step) {
		ticks.push(t);
	}
	return ticks;
}

export function nearestIndex(values: number[], target: number): number {
	let best = 0;
	let bestDistance = Infinity;
	for (let i = 0; i < values.length; i++) {
		const d = Math.abs(values[i] - target);
		if (d < bestDistance) {
			best = i;
			bestDistance = d;
		}
	}
	return best;
}
