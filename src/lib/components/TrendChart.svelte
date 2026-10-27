<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { line } from 'd3-shape';
	import { resolve } from '$app/paths';
	import { nearestIndex, timeTicks } from '#lib/chart.ts';
	import { formatDateTime, formatShortDate, fmt } from '#lib/format.ts';
	import type { MetricDef } from '#lib/metric-defs.ts';
	import type { TrendPoint } from '#lib/views.ts';

	interface Props {
		points: TrendPoint[];
		metric: MetricDef | 'points';
		timeZone: string;
		modeQuery: string;
		height?: number;
	}

	let { points, metric, timeZone, modeQuery, height = 280 }: Props = $props();

	let width = $state(0);
	let hover = $state<number | null>(null);
	const margin = { top: 16, right: 16, bottom: 28, left: 48 };

	const isPoints = $derived(metric === 'points');
	const format = (v: number | null) =>
		metric === 'points' ? fmt(v) : (metric as MetricDef).format(v);

	type Row = { id: string; t: number; value: number; average: number | null };
	const rows = $derived<Row[]>(
		points
			.map((p) => {
				const value = metric === 'points' ? p.points : p.metrics[metric.key];
				const average = metric === 'points' ? null : p.average[metric.key];
				return { id: p.id, t: p.t, value: value as number, average };
			})
			.filter((r) => r.value !== null && Number.isFinite(r.value))
	);

	const domain = $derived.by(() => {
		const values = rows.flatMap((r) => (r.average === null ? [r.value] : [r.value, r.average]));
		if (values.length === 0) return [0, 1];
		const min = Math.min(...values);
		const max = Math.max(...values);
		const pad = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
		return [Math.max(0, min - pad), max + pad];
	});

	const start = $derived(rows[0]?.t ?? 0);
	const end = $derived(rows.at(-1)?.t ?? 1);
	const span = $derived(Math.max(end - start, 86_400));
	const x = $derived(
		scaleLinear()
			.domain([start - span * 0.03, start + span * 1.03])
			.range([margin.left, Math.max(margin.left + 10, width - margin.right)])
	);
	const y = $derived(
		scaleLinear()
			.domain(domain)
			.nice(4)
			.range([height - margin.bottom, margin.top])
	);

	const averagePath = $derived(
		line<Row>()
			.defined((r) => r.average !== null)
			.x((r) => x(r.t))
			.y((r) => y(r.average ?? 0))(rows)
	);
	const valuePath = $derived(
		line<Row>()
			.x((r) => x(r.t))
			.y((r) => y(r.value))(rows)
	);

	const xTicks = $derived(
		timeTicks(x.domain()[0], x.domain()[1], timeZone, Math.max(2, Math.floor(width / 110)))
	);
	const yTicks = $derived(y.ticks(4));
	const active = $derived(hover === null ? null : rows[hover]);
	const latest = $derived(rows.at(-1));

	function onMove(event: PointerEvent) {
		const box = event.currentTarget as HTMLElement;
		hover = nearestIndex(
			rows.map((r) => x(r.t)),
			event.clientX - box.getBoundingClientRect().left
		);
	}

	const sessionHref = (id: string) => `${resolve('/sessions/[id]', { id })}${modeQuery}`;
</script>

<figure class="trend" bind:clientWidth={width} style:height="{height}px">
	{#if rows.length === 0}
		<p class="empty">No sessions with this stat in the selected range.</p>
	{:else if width > 0}
		<div role="presentation" onpointermove={onMove} onpointerleave={() => (hover = null)}>
			<svg
				{width}
				{height}
				role="group"
				aria-label="{isPoints ? 'Rank points' : (metric as MetricDef).label} per session"
			>
				{#each yTicks as tick (tick)}
					<line class="grid" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
					<text class="tick" x={margin.left - 8} y={y(tick)} dy="0.32em" text-anchor="end"
						>{format(tick)}</text
					>
				{/each}
				{#each xTicks as tick (tick)}
					<text class="tick" x={x(tick)} y={height - 8} text-anchor="middle"
						>{formatShortDate(tick, timeZone)}</text
					>
				{/each}

				{#if isPoints}
					<path class="average" d={valuePath} />
				{:else}
					<path class="average" d={averagePath} />
				{/if}

				{#each rows as row, i (row.id)}
					<a
						href={sessionHref(row.id)}
						aria-label="Session on {formatDateTime(row.t, timeZone)}: {format(row.value)}"
						onfocus={() => (hover = i)}
						onblur={() => (hover = null)}
					>
						<circle class="hit" cx={x(row.t)} cy={y(row.value)} r="12" />
						<circle
							class="dot"
							class:latest={row === latest}
							class:hovered={i === hover}
							cx={x(row.t)}
							cy={y(row.value)}
							r="4"
						/>
					</a>
				{/each}

				{#if active}
					<line
						class="crosshair"
						x1={x(active.t)}
						x2={x(active.t)}
						y1={margin.top}
						y2={height - margin.bottom}
					/>
				{/if}
			</svg>
		</div>

		{#if active}
			<div
				class="tooltip"
				style:left="{Math.min(Math.max(0, x(active.t) - 80), width - 180)}px"
				style:top="0px"
			>
				<p class="when">{formatDateTime(active.t, timeZone)}</p>
				<p><strong>{format(active.value)}</strong> this session</p>
				{#if active.average !== null}
					<p>
						<span class="key"></span><strong>{format(active.average)}</strong> 10-session average
					</p>
				{/if}
			</div>
		{/if}
	{/if}
</figure>

<style>
	.trend {
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
		color: var(--ink-3);
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

	.average {
		fill: none;
		stroke: var(--kill);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.hit {
		fill: transparent;
	}

	.dot {
		fill: var(--dot);
		stroke: var(--panel);
		stroke-width: 2;
	}

	.dot.latest {
		fill: var(--ink);
	}

	.dot.hovered {
		fill: var(--ink);
		r: 5;
	}

	.crosshair {
		stroke: var(--ink-3);
		stroke-width: 1;
		pointer-events: none;
	}

	.tooltip {
		position: absolute;
		pointer-events: none;
		min-width: 160px;
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--panel-raised);
		border: 1px solid var(--rule);
		font-size: 0.875rem;
		line-height: 1.45;
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

	.key {
		display: inline-block;
		width: 12px;
		height: 2px;
		margin-right: 6px;
		vertical-align: middle;
		background: var(--kill);
	}
</style>
