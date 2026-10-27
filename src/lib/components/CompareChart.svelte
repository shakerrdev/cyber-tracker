<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { line } from 'd3-shape';
	import { nearestIndex, timeTicks } from '#lib/chart.ts';
	import { formatDateTime, formatShortDate } from '#lib/format.ts';
	import type { MetricDef } from '#lib/metric-defs.ts';

	export interface Series {
		key: string;
		name: string;
		color: number;
		points: { t: number; value: number }[];
	}

	interface Props {
		series: Series[];
		metric: MetricDef;
		timeZone: string;
		height?: number;
	}

	let { series, metric, timeZone, height = 300 }: Props = $props();

	let width = $state(0);
	let hoverT = $state<number | null>(null);
	const margin = { top: 16, right: 120, bottom: 28, left: 48 };

	const drawn = $derived(series.filter((s) => s.points.length > 0));
	const times = $derived(
		[...new Set(drawn.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b)
	);
	const values = $derived(drawn.flatMap((s) => s.points.map((p) => p.value)));

	const start = $derived(times[0] ?? 0);
	const end = $derived(times.at(-1) ?? 1);
	const span = $derived(Math.max(end - start, 86_400));
	const x = $derived(
		scaleLinear()
			.domain([start - span * 0.02, start + span * 1.02])
			.range([margin.left, Math.max(margin.left + 10, width - margin.right)])
	);
	const y = $derived.by(() => {
		const min = Math.min(...values);
		const max = Math.max(...values);
		const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
		return scaleLinear()
			.domain([Math.max(0, min - pad), max + pad])
			.nice(4)
			.range([height - margin.bottom, margin.top]);
	});

	const path = $derived(
		line<{ t: number; value: number }>()
			.x((p) => x(p.t))
			.y((p) => y(p.value))
	);

	const ends = $derived.by(() => {
		const gap = 15;
		const placed = drawn
			.map((s) => ({ s, last: s.points.at(-1)!, y: y(s.points.at(-1)!.value) }))
			.sort((a, b) => a.y - b.y);
		for (let i = 1; i < placed.length; i++) {
			if (placed[i].y - placed[i - 1].y < gap) placed[i].y = placed[i - 1].y + gap;
		}
		return placed;
	});

	const at = (s: Series, t: number) => s.points.findLast((p) => p.t <= t) ?? null;
	const readout = $derived(
		hoverT === null
			? []
			: drawn
					.map((s) => ({ s, point: at(s, hoverT!) }))
					.filter((r) => r.point !== null)
					.sort((a, b) => b.point!.value - a.point!.value)
	);

	function onMove(event: PointerEvent) {
		const box = event.currentTarget as HTMLElement;
		const i = nearestIndex(
			times.map((t) => x(t)),
			event.clientX - box.getBoundingClientRect().left
		);
		hoverT = times[i] ?? null;
	}

	const color = (i: number) => `var(--series-${(i % 8) + 1})`;
</script>

<ul class="legend" aria-label="Players">
	{#each series as s (s.key)}
		<li><span class="key" style:background={color(s.color)}></span>{s.name}</li>
	{/each}
</ul>

<figure class="chart" bind:clientWidth={width} style:height="{height}px">
	{#if drawn.length === 0}
		<p class="muted empty">Nobody has enough sessions with this stat in the selected range yet.</p>
	{:else if width > 0}
		<div role="presentation" onpointermove={onMove} onpointerleave={() => (hoverT = null)}>
			<svg {width} {height} role="img" aria-label="{metric.label}, 10-session average per player">
				{#each y.ticks(4) as tick (tick)}
					<line class="grid" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
					<text class="tick" x={margin.left - 8} y={y(tick)} dy="0.32em" text-anchor="end"
						>{metric.format(tick)}</text
					>
				{/each}
				{#each timeTicks(x.domain()[0], x.domain()[1], timeZone, Math.max(2, Math.floor(width / 110))) as tick (tick)}
					<text class="tick" x={x(tick)} y={height - 8} text-anchor="middle"
						>{formatShortDate(tick, timeZone)}</text
					>
				{/each}

				{#each drawn as s (s.key)}
					<path class="line" d={path(s.points)} style:stroke={color(s.color)} />
				{/each}

				{#each ends as { s, last, y: labelY } (s.key)}
					<circle class="dot" cx={x(last.t)} cy={y(last.value)} r="4" style:fill={color(s.color)} />
					<text class="end-label" x={x(last.t) + 10} y={labelY} dy="0.32em"
						>{s.name} {metric.format(last.value)}</text
					>
				{/each}

				{#if hoverT !== null}
					<line
						class="crosshair"
						x1={x(hoverT)}
						x2={x(hoverT)}
						y1={margin.top}
						y2={height - margin.bottom}
					/>
					{#each readout as { s, point } (s.key)}
						<circle
							class="dot"
							cx={x(point!.t)}
							cy={y(point!.value)}
							r="4"
							style:fill={color(s.color)}
						/>
					{/each}
				{/if}
			</svg>
		</div>

		{#if hoverT !== null && readout.length}
			<div class="tooltip" style:left="{Math.min(Math.max(0, x(hoverT) + 12), width - 200)}px">
				<p class="when">{formatDateTime(hoverT, timeZone)}</p>
				{#each readout as { s, point } (s.key)}
					<p>
						<span class="line-key" style:background={color(s.color)}></span>
						<strong>{metric.format(point!.value)}</strong>
						{s.name}
					</p>
				{/each}
			</div>
		{/if}
	{/if}
</figure>

<style>
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		list-style: none;
		margin: 0 0 8px;
		padding: 0;
		color: var(--ink-2);
		font-size: 0.875rem;
	}

	.key {
		display: inline-block;
		width: 14px;
		height: 3px;
		border-radius: 2px;
		margin-right: 6px;
		vertical-align: middle;
	}

	.chart {
		position: relative;
		margin: 0;
		width: 100%;
	}

	svg {
		display: block;
		overflow: visible;
		touch-action: pan-y;
	}

	.empty {
		padding-top: 48px;
	}

	.grid {
		stroke: var(--grid);
		stroke-width: 1;
	}

	.tick {
		fill: var(--ink-3);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.line {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.dot {
		stroke: var(--page);
		stroke-width: 2;
	}

	.end-label {
		fill: var(--ink-2);
		font-size: 13px;
	}

	.crosshair {
		stroke: var(--ink-3);
		stroke-width: 1;
	}

	.tooltip {
		position: absolute;
		top: 0;
		pointer-events: none;
		min-width: 170px;
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--panel-raised);
		border: 1px solid var(--rule);
		font-size: 0.875rem;
		line-height: 1.5;
		color: var(--ink-2);
	}

	.tooltip strong {
		color: var(--ink);
		font-weight: 600;
		margin-right: 4px;
	}

	.when {
		color: var(--ink-3);
	}

	.line-key {
		display: inline-block;
		width: 12px;
		height: 2px;
		margin-right: 6px;
		vertical-align: middle;
	}
</style>
