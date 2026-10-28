<script lang="ts">
	import { scaleLinear } from 'd3-scale';
	import { area, line } from 'd3-shape';
	import { nearestIndex, timeTicks } from '#lib/chart.ts';
	import { fmt, formatClock, mapName } from '#lib/format.ts';
	import { modeLabel } from '#lib/modes.ts';
	import type { CurveSegment } from '#lib/views.ts';

	interface Props {
		segments: CurveSegment[];
		timeZone: string;
		height?: number;
	}

	let { segments, timeZone, height = 260 }: Props = $props();

	const uid = $props.id();
	let width = $state(0);
	let hover = $state<number | null>(null);

	const margin = { top: 16, right: 84, bottom: 28, left: 40 };

	type Flat = { t: number; kills: number; deaths: number; untracked?: boolean; segment: number };
	type Run = { untracked: boolean; points: Flat[] };
	const flat = $derived<Flat[]>(
		segments.flatMap((s, segment) => s.points.map((p) => ({ ...p, segment })))
	);

	const start = $derived(segments[0]?.startedAt ?? 0);
	const end = $derived(segments.at(-1)?.endedAt ?? 1);
	const top = $derived(Math.max(4, ...flat.map((p) => Math.max(p.kills, p.deaths))));

	const x = $derived(
		scaleLinear()
			.domain([start, Math.max(end, start + 60)])
			.range([margin.left, Math.max(margin.left + 10, width - margin.right)])
	);
	const y = $derived(
		scaleLinear()
			.domain([0, top])
			.nice(4)
			.range([height - margin.bottom, margin.top])
	);

	const killLine = $derived(
		line<Flat>()
			.x((p) => x(p.t))
			.y((p) => y(p.kills))
	);
	const deathLine = $derived(
		line<Flat>()
			.x((p) => x(p.t))
			.y((p) => y(p.deaths))
	);
	const band = $derived(
		area<Flat>()
			.x((p) => x(p.t))
			.y0((p) => y(p.deaths))
			.y1((p) => y(p.kills))
	);
	const above = $derived(
		area<Flat>()
			.x((p) => x(p.t))
			.y0(margin.top)
			.y1((p) => y(p.deaths))
	);
	const below = $derived(
		area<Flat>()
			.x((p) => x(p.t))
			.y0((p) => y(p.deaths))
			.y1(height - margin.bottom)
	);

	function toRuns(points: Flat[]): Run[] {
		const runs: Run[] = [];
		for (let i = 1; i < points.length; i++) {
			const untracked = !!points[i].untracked;
			const current = runs.at(-1);
			if (current && current.untracked === untracked) current.points.push(points[i]);
			else runs.push({ untracked, points: [points[i - 1], points[i]] });
		}
		return runs;
	}

	const runs = $derived(segments.flatMap((_, i) => toRuns(flat.filter((p) => p.segment === i))));
	const hasGaps = $derived(runs.some((r) => r.untracked));
	const last = $derived(flat.at(-1));
	const xTicks = $derived(timeTicks(start, end, timeZone, Math.max(3, Math.floor(width / 100))));
	const yTicks = $derived(y.ticks(4));

	const labelGap = 14;
	const killLabelY = $derived(last ? y(last.kills) : 0);
	const deathLabelY = $derived.by(() => {
		if (!last) return 0;
		const raw = y(last.deaths);
		if (Math.abs(raw - killLabelY) >= labelGap) return raw;
		return last.deaths <= last.kills ? killLabelY + labelGap : killLabelY - labelGap;
	});

	const active = $derived(hover === null ? null : flat[hover]);

	function describe(p: Flat | undefined): string {
		return p ? `${formatClock(p.t, timeZone)}: ${p.kills} kills, ${p.deaths} deaths` : '';
	}

	function onMove(event: PointerEvent) {
		const svg = event.currentTarget as SVGSVGElement;
		const px = event.clientX - svg.getBoundingClientRect().left;
		hover = nearestIndex(
			flat.map((p) => x(p.t)),
			px
		);
	}

	function onKey(event: KeyboardEvent) {
		if (!flat.length) return;
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault();
			const step = event.key === 'ArrowRight' ? 1 : -1;
			hover = Math.min(flat.length - 1, Math.max(0, (hover ?? flat.length - 1) + step));
		} else if (event.key === 'Escape') {
			hover = null;
		}
	}
</script>

<figure class="curve" bind:clientWidth={width} style:height="{height}px">
	{#if width > 0 && flat.length > 0}
		<svg
			{width}
			{height}
			role="slider"
			aria-label="Cumulative kills and deaths over the session"
			aria-valuemin={0}
			aria-valuemax={flat.length - 1}
			aria-valuenow={hover ?? flat.length - 1}
			aria-valuetext={describe(active ?? last)}
			tabindex="0"
			onpointermove={onMove}
			onpointerleave={() => (hover = null)}
			onkeydown={onKey}
			onblur={() => (hover = null)}
		>
			<defs>
				<clipPath id="{uid}-above"><path d={above(flat)} /></clipPath>
				<clipPath id="{uid}-below"><path d={below(flat)} /></clipPath>
			</defs>

			{#each yTicks as tick (tick)}
				<line class="grid" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
				<text class="tick" x={margin.left - 8} y={y(tick)} dy="0.32em" text-anchor="end"
					>{tick}</text
				>
			{/each}
			{#each xTicks as tick (tick)}
				<text class="tick" x={x(tick)} y={height - 8} text-anchor="middle"
					>{formatClock(tick, timeZone)}</text
				>
			{/each}

			{#each runs as run, i (i)}
				{#if !run.untracked}
					<path class="lead" d={band(run.points)} clip-path="url(#{uid}-above)" />
					<path class="trail" d={band(run.points)} clip-path="url(#{uid}-below)" />
				{/if}
				<path class="deaths" class:gap={run.untracked} d={deathLine(run.points)} />
				<path class="kills" class:gap={run.untracked} d={killLine(run.points)} />
			{/each}

			{#each segments.slice(1) as segment (segment.startedAt)}
				<line
					class="break"
					x1={x(segment.startedAt)}
					x2={x(segment.startedAt)}
					y1={margin.top}
					y2={height - margin.bottom}
				/>
			{/each}

			{#if last}
				<circle class="end kills-dot" cx={x(last.t)} cy={y(last.kills)} r="4" />
				<circle class="end deaths-dot" cx={x(last.t)} cy={y(last.deaths)} r="4" />
				<text class="end-label" x={x(last.t) + 10} y={killLabelY} dy="0.32em"
					>{last.kills} kills</text
				>
				<text class="end-label" x={x(last.t) + 10} y={deathLabelY} dy="0.32em"
					>{last.deaths} deaths</text
				>
			{/if}

			{#if active}
				<line
					class="crosshair"
					x1={x(active.t)}
					x2={x(active.t)}
					y1={margin.top}
					y2={height - margin.bottom}
				/>
				<circle class="end kills-dot" cx={x(active.t)} cy={y(active.kills)} r="4" />
				<circle class="end deaths-dot" cx={x(active.t)} cy={y(active.deaths)} r="4" />
			{/if}
		</svg>

		{#if active}
			{@const segment = segments[active.segment]}
			<div
				class="tooltip"
				style:left="{Math.min(x(active.t) + 12, width - 190)}px"
				style:top="{margin.top}px"
			>
				<p class="when">{formatClock(active.t, timeZone)}</p>
				<p><span class="key k"></span><strong>{active.kills}</strong> kills</p>
				<p><span class="key d"></span><strong>{active.deaths}</strong> deaths</p>
				<p>
					<strong>{active.deaths > 0 ? fmt(active.kills / active.deaths, 2) : '–'}</strong> K/D
				</p>
				{#if active.untracked}
					<p class="where">Not tracked since the previous point</p>
				{/if}
				<p class="where">
					{modeLabel(segment.modeId)}{segment.serverNum ? ` #${segment.serverNum}` : ''}, {segment.maps
						.map(mapName)
						.join(', ')}
				</p>
			</div>
		{/if}
	{/if}
</figure>
{#if hasGaps}
	<p class="note">
		<span class="key dotted"></span>Dotted: not tracked, straight line between readings
	</p>
{/if}

<style>
	.curve {
		position: relative;
		margin: 0;
		width: 100%;
	}

	svg {
		display: block;
		overflow: visible;
		touch-action: pan-y;
	}

	svg:focus-visible {
		outline-offset: 4px;
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

	.kills,
	.deaths {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.kills {
		stroke: var(--kill);
	}

	.deaths {
		stroke: var(--death);
	}

	.gap {
		stroke-dasharray: 0.5 5;
	}

	.note {
		margin-top: 6px;
		font-size: 0.8125rem;
		color: var(--ink-3);
	}

	.lead {
		fill: var(--kill);
		opacity: 0.14;
	}

	.trail {
		fill: var(--death);
		opacity: 0.12;
	}

	.break {
		stroke: var(--rule);
		stroke-width: 1;
	}

	.end {
		stroke: var(--panel);
		stroke-width: 2;
	}

	.kills-dot {
		fill: var(--kill);
	}

	.deaths-dot {
		fill: var(--death);
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
		pointer-events: none;
		min-width: 150px;
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

	.where {
		color: var(--ink-3);
		margin-top: 4px;
	}

	.key {
		display: inline-block;
		width: 12px;
		height: 2px;
		margin-right: 6px;
		vertical-align: middle;
	}

	.key.k {
		background: var(--kill);
	}

	.key.d {
		background: var(--death);
	}

	.key.dotted {
		background: radial-gradient(circle, var(--ink-3) 1px, transparent 1.5px) 0 50% / 5px 3px
			repeat-x;
		height: 3px;
		width: 16px;
	}
</style>
