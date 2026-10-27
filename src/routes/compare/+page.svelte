<script lang="ts">
	import { resolve } from '$app/paths';
	import CompareChart from '#lib/components/CompareChart.svelte';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import { fmt, formatDuration, pct, signed } from '#lib/format.ts';
	import { METRICS, type MetricKey } from '#lib/metric-defs.ts';
	import { RANGES, type CompareStats } from '#lib/views.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = resolve('/compare');
	const nameOf = (id: string) => data.players.find((p) => p.steamid64 === id)?.info?.name ?? id;
	const avatarOf = (id: string) => data.players.find((p) => p.steamid64 === id)?.info?.avatar;
	const color = (i: number) => `var(--series-${(i % 8) + 1})`;

	const playersQuery = (ids: string[]) => ids.map((id) => `&p=${id}`).join('');
	const toggleHref = (id: string) => {
		const next = data.selected.includes(id)
			? data.selected.filter((s) => s !== id)
			: [...data.selected, id];
		return `${base}?mode=${data.filter.slug}&range=${data.range}${playersQuery(next.length ? next : [id])}`;
	};
	const rangeLabel = $derived(RANGES.find((r) => r.value === data.range)!.label.toLowerCase());

	interface Row {
		label: string;
		value: (s: CompareStats) => number | null;
		format: (v: number | null) => string;
		higherIsBetter?: boolean;
	}

	const trackedRows: Row[] = [
		{ label: 'Sessions', value: (s) => s.sessions, format: (v) => fmt(v) },
		{
			label: 'Time on the server',
			value: (s) => s.tracked.minutes * 60,
			format: (v) => (v ? formatDuration(v) : '–')
		},
		{ label: 'Kills', value: (s) => s.tracked.kills, format: (v) => fmt(v) },
		{ label: 'K/D', value: (s) => s.tracked.kd, format: (v) => fmt(v, 2), higherIsBetter: true },
		{
			label: 'Kills per minute',
			value: (s) => s.tracked.kpm,
			format: (v) => fmt(v, 2),
			higherIsBetter: true
		},
		{
			label: 'Headshot kills',
			value: (s) => s.tracked.hsPct,
			format: (v) => pct(v),
			higherIsBetter: true
		},
		{
			label: 'Accuracy',
			value: (s) => s.tracked.accuracy,
			format: (v) => pct(v, 1),
			higherIsBetter: true
		},
		{
			label: 'Head hits',
			value: (s) => s.tracked.headHitPct,
			format: (v) => pct(v, 1),
			higherIsBetter: true
		},
		{
			label: 'Damage per minute',
			value: (s) => s.tracked.dpm,
			format: (v) => fmt(v),
			higherIsBetter: true
		},
		{
			label: 'Time to kill',
			value: (s) => s.tracked.ttkMs,
			format: (v) => (v === null ? '–' : `${fmt(v)} ms`),
			higherIsBetter: false
		},
		{
			label: 'Rank points gained',
			value: (s) => s.tracked.pointsDelta,
			format: (v) => signed(v),
			higherIsBetter: true
		}
	];

	const allTimeRows: Row[] = [
		{
			label: 'Time played',
			value: (s) => s.allTime?.playtime ?? null,
			format: (v) => (v ? formatDuration(v) : '–')
		},
		{ label: 'Kills', value: (s) => s.allTime?.kills ?? null, format: (v) => fmt(v) },
		{
			label: 'Kills per minute',
			value: (s) => s.allTime?.kpm ?? null,
			format: (v) => fmt(v, 2),
			higherIsBetter: true
		},
		{
			label: 'Headshot kills',
			value: (s) => s.allTime?.hsPct ?? null,
			format: (v) => pct(v),
			higherIsBetter: true
		},
		{
			label: 'Accuracy',
			value: (s) => s.allTime?.accuracy ?? null,
			format: (v) => pct(v, 1),
			higherIsBetter: true
		},
		{
			label: 'Head hits',
			value: (s) => s.allTime?.headHitPct ?? null,
			format: (v) => pct(v, 1),
			higherIsBetter: true
		},
		{
			label: 'Damage per minute',
			value: (s) => s.allTime?.dpm ?? null,
			format: (v) => fmt(v),
			higherIsBetter: true
		},
		{
			label: 'K/D in every mode',
			value: (s) => s.allTime?.kdAllModes ?? null,
			format: (v) => fmt(v, 2),
			higherIsBetter: true
		}
	];

	function best(row: Row): number | null {
		if (row.higherIsBetter === undefined) return null;
		const values = data.entries
			.map((e) => row.value(e.stats))
			.filter((v): v is number => v !== null);
		if (values.length < 2) return null;
		const top = row.higherIsBetter ? Math.max(...values) : Math.min(...values);
		const winners = values.filter((v) => row.format(v) === row.format(top));
		return winners.length === values.length ? null : top;
	}

	const isBest = (row: Row, top: number | null, v: number | null) =>
		top !== null && v !== null && row.format(v) === row.format(top);

	let trendKey = $state<MetricKey>('kpm');
	const trendMetric = $derived(METRICS.find((m) => m.key === trendKey)!);
	const series = $derived(
		data.entries.map((e) => ({
			key: e.steamid64,
			name: nameOf(e.steamid64),
			color: e.color,
			points: e.stats.trend
				.map((p) => ({ t: p.t, value: p.average[trendKey] }))
				.filter((p): p is { t: number; value: number } => p.value !== null)
		}))
	);
</script>

<svelte:head>
	<title>Compare, cyber-tracker</title>
</svelte:head>

<h1>Compare</h1>

<nav class="pick" aria-label="Players to compare">
	{#each data.players as player, i (player.steamid64)}
		{@const on = data.selected.includes(player.steamid64)}
		<a
			href={toggleHref(player.steamid64)}
			class:on
			data-sveltekit-reset="false"
			title={on ? 'Leave out of the comparison' : 'Add to the comparison'}
		>
			<span class="key" style:background={on ? color(i) : 'transparent'}></span>
			{player.info?.name ?? player.steamid64}
			{#if on}<span class="visually-hidden">(in the comparison)</span>{/if}
		</a>
	{/each}
</nav>

<FilterBar mode={data.filter.slug} range={data.range} {base} extra={playersQuery(data.selected)} />

<section class="block" aria-labelledby="table-title">
	<h2 id="table-title">{data.filter.label}</h2>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th><span class="visually-hidden">Stat</span></th>
					{#each data.entries as entry (entry.steamid64)}
						<th class="num player">
							<span class="head">
								{#if avatarOf(entry.steamid64)}
									<img src={avatarOf(entry.steamid64)} alt="" width="22" height="22" />
								{/if}
								<a href={resolve('/p/[steamid]', { steamid: entry.steamid64 })}
									>{nameOf(entry.steamid64)}</a
								>
								<span class="key" style:background={color(entry.color)}></span>
							</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				<tr class="group">
					<th colspan={data.entries.length + 1}>Tracked sessions, {rangeLabel}</th>
				</tr>
				{#each trackedRows as row (row.label)}
					{@const top = best(row)}
					<tr>
						<th scope="row">{row.label}</th>
						{#each data.entries as entry (entry.steamid64)}
							{@const v = row.value(entry.stats)}
							<td class="num" class:best={isBest(row, top, v)}>
								{row.format(v)}{#if isBest(row, top, v)}<span class="visually-hidden">
										(best)</span
									>{/if}
							</td>
						{/each}
					</tr>
				{/each}
				{#if data.filter.single}
					<tr>
						<th scope="row">Rank points now</th>
						{#each data.entries as entry (entry.steamid64)}
							<td class="num">{fmt(entry.stats.points)}</td>
						{/each}
					</tr>
				{/if}
				<tr class="group">
					<th colspan={data.entries.length + 1}>All time on Cybershoke</th>
				</tr>
				{#each allTimeRows as row (row.label)}
					{@const top = best(row)}
					<tr>
						<th scope="row">{row.label}</th>
						{#each data.entries as entry (entry.steamid64)}
							{@const v = row.value(entry.stats)}
							<td class="num" class:best={isBest(row, top, v)}>
								{row.format(v)}{#if isBest(row, top, v)}<span class="visually-hidden">
										(best)</span
									>{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="muted note">
		Best values are highlighted. All-time numbers come from each player's Cybershoke profile, so
		they include play from before tracking started. Cybershoke only counts deaths across all modes,
		which is why the all-time K/D isn't per mode.
	</p>
</section>

<section class="block" aria-labelledby="trend-title">
	<div class="block-head">
		<div>
			<h2 id="trend-title">Progress</h2>
			<p class="muted">10-session average of each player's {data.filter.label} sessions.</p>
		</div>
		<div class="switch" role="tablist" aria-label="Stat">
			{#each METRICS.filter((m) => m.key !== 'ttkMs') as m (m.key)}
				<button role="tab" aria-selected={trendKey === m.key} onclick={() => (trendKey = m.key)}
					>{m.short}</button
				>
			{/each}
		</div>
	</div>
	<CompareChart {series} metric={trendMetric} timeZone={data.timeZone} />
</section>

<style>
	h1 {
		font-size: 2rem;
		margin-bottom: 12px;
	}

	.pick {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}

	.pick a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px;
		border-radius: 999px;
		border: 1px solid var(--rule);
		color: var(--ink-3);
		text-decoration: none;
	}

	.pick a.on {
		color: var(--ink);
		background: var(--panel-raised);
		font-weight: 500;
	}

	.pick a:not(.on) .key {
		box-shadow: inset 0 0 0 1px var(--ink-3);
	}

	.key {
		display: inline-block;
		width: 14px;
		height: 3px;
		border-radius: 2px;
	}

	.block {
		padding-top: 24px;
	}

	.block > h2 {
		margin-bottom: 12px;
	}

	.block-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}

	.scroll {
		position: relative;
		overflow-x: auto;
	}

	table {
		max-width: 900px;
	}

	th.player {
		vertical-align: bottom;
	}

	.head {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		color: var(--ink);
		font-weight: 500;
	}

	.head img {
		border-radius: 50%;
	}

	.head a {
		text-decoration: none;
	}

	tbody th {
		color: var(--ink-2);
		font-weight: 400;
		font-size: 0.9375rem;
		border-bottom: 1px solid var(--grid);
		padding: 8px 12px 8px 0;
	}

	td {
		padding: 8px 12px 8px 0;
	}

	.group th {
		color: var(--ink);
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: 1.125rem;
		padding-top: 20px;
		border-bottom: 1px solid var(--rule);
	}

	td.best {
		font-weight: 600;
		color: var(--ink);
		background: var(--panel);
	}

	.note {
		font-size: 0.875rem;
		margin-top: 10px;
		max-width: 75ch;
	}

	.switch {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--panel);
	}

	.switch button {
		font: inherit;
		font-size: 0.875rem;
		color: var(--ink-2);
		background: none;
		border: 0;
		border-radius: 999px;
		padding: 5px 12px;
		cursor: pointer;
	}

	.switch button[aria-selected='true'] {
		color: var(--ink);
		background: var(--panel-raised);
		box-shadow: inset 0 0 0 1px var(--rule);
		font-weight: 500;
	}
</style>
