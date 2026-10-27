<script lang="ts">
	import { resolve } from '$app/paths';
	import FilterBar from '#lib/components/FilterBar.svelte';
	import KillCurve from '#lib/components/KillCurve.svelte';
	import SessionSummary from '#lib/components/SessionSummary.svelte';
	import SessionsTable from '#lib/components/SessionsTable.svelte';
	import TrendChart from '#lib/components/TrendChart.svelte';
	import WeaponsTable from '#lib/components/WeaponsTable.svelte';
	import { fmt, formatClock, formatDay, formatDuration } from '#lib/format.ts';
	import { METRICS, type MetricKey } from '#lib/metric-defs.ts';
	import { modeLabel } from '#lib/modes.ts';
	import { RANGES } from '#lib/views.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tz = $derived(data.timeZone);
	const modeQuery = $derived(`?mode=${data.filter.slug}`);
	const steamid = $derived(data.player.steamid64);
	const hero = $derived(data.hero);

	let trendKey = $state<MetricKey | 'points'>('kpm');
	const trendOptions = $derived([
		...METRICS.filter((m) => m.key !== 'ttkMs').map((m) => ({ key: m.key, label: m.short })),
		...(data.filter.single ? [{ key: 'points' as const, label: 'Rank points' }] : [])
	]);
	$effect(() => {
		if (trendKey === 'points' && !data.filter.single) trendKey = 'kpm';
	});
	const trendMetric = $derived(
		trendKey === 'points' ? 'points' : METRICS.find((m) => m.key === trendKey)!
	);
	const rangeLabel = $derived(RANGES.find((r) => r.value === data.range)!.label.toLowerCase());

	const SESSION_PREVIEW = 12;
	let showAllSessions = $state(false);
	const visibleSessions = $derived(
		showAllSessions ? data.sessions : data.sessions.slice(0, SESSION_PREVIEW)
	);
</script>

<FilterBar mode={data.filter.slug} range={data.range} base={resolve('/p/[steamid]', { steamid })} />

{#if !hero}
	<section class="panel empty">
		<h2>No {data.filter.label} sessions yet</h2>
		<p class="secondary">
			The tracker checks this Cybershoke profile every minute. A round of {data.filter.label} shows up
			here once the player leaves the server, and live while they're still on it.
		</p>
	</section>
{:else}
	<section class="panel hero" aria-labelledby="hero-title">
		<div class="hero-head">
			<div>
				<h2 id="hero-title">{hero.row.inProgress ? 'Playing now' : 'Latest session'}</h2>
				<p class="secondary">
					{formatDay(hero.row.startedAt, tz)}, {formatClock(hero.row.startedAt, tz)} to {formatClock(
						hero.row.endedAt,
						tz
					)}, {formatDuration(hero.row.playtime)} on {hero.row.modeIds.map(modeLabel).join(', ')}
				</p>
			</div>
			<a
				class="more"
				href="{resolve('/p/[steamid]/sessions/[id]', { steamid, id: hero.row.id })}{modeQuery}"
				>Session details</a
			>
		</div>

		<SessionSummary row={hero.row} baseline={hero.baseline} compare />

		{#if hero.curve.length > 0}
			<KillCurve segments={hero.curve} timeZone={tz} />
			<p class="curve-note muted">
				Running totals from the live scoreboard. The shaded band shows how far kills were ahead of
				deaths, or behind them.
			</p>
		{:else}
			<p class="no-curve muted">
				No live samples for this session, so there's no kill curve. The totals come from the
				profile.
			</p>
		{/if}
	</section>

	<section class="block" aria-labelledby="trend-title">
		<div class="block-head">
			<div>
				<h2 id="trend-title">Progress</h2>
				<p class="muted">
					Each dot is a session of {data.filter.label}{trendKey === 'points'
						? ''
						: ', the line the 10-session average'}.
				</p>
			</div>
			<div class="switch" role="tablist" aria-label="Stat">
				{#each trendOptions as option (option.key)}
					<button
						role="tab"
						aria-selected={trendKey === option.key}
						onclick={() => (trendKey = option.key)}>{option.label}</button
					>
				{/each}
			</div>
		</div>
		<TrendChart points={data.trend} metric={trendMetric} timeZone={tz} {modeQuery} {steamid} />
	</section>

	<p class="summary secondary">
		{data.range === 'all' ? 'Since tracking started' : `In the last ${rangeLabel}`}: {data.sessions
			.length}
		{data.sessions.length === 1 ? 'session' : 'sessions'}, {formatDuration(
			data.totals.minutes * 60
		)} on the server, {fmt(data.totals.kills)} kills at a K/D of {fmt(data.totals.kd, 2)}.
	</p>

	<div class="lower">
		<section class="block" aria-labelledby="sessions-title">
			<h2 id="sessions-title">Sessions</h2>
			{#if data.sessions.length}
				<SessionsTable
					rows={visibleSessions}
					timeZone={tz}
					{modeQuery}
					{steamid}
					showModes={!data.filter.single}
				/>
				{#if data.sessions.length > SESSION_PREVIEW}
					<button class="more-rows" onclick={() => (showAllSessions = !showAllSessions)}>
						{showAllSessions ? 'Show fewer sessions' : `Show all ${data.sessions.length} sessions`}
					</button>
				{/if}
			{:else}
				<p class="muted">No sessions in this range.</p>
			{/if}
		</section>
		<section class="block" aria-labelledby="weapons-title">
			<h2 id="weapons-title">Weapons</h2>
			{#if data.weapons.length}
				<WeaponsTable rows={data.weapons} />
			{:else}
				<p class="muted">Weapon stats arrive with the first finished session.</p>
			{/if}
		</section>
	</div>
{/if}

<style>
	.panel {
		background: var(--panel);
		border-radius: var(--radius);
		padding: 24px;
	}

	.empty {
		max-width: 70ch;
	}

	.empty h2 {
		margin-bottom: 8px;
	}

	.hero-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		flex-wrap: wrap;
	}

	.more {
		font-weight: 500;
		text-underline-offset: 3px;
	}

	.no-curve {
		padding: 24px 0 8px;
	}

	.curve-note {
		font-size: 0.8125rem;
		margin-top: 8px;
	}

	.more-rows {
		margin-top: 12px;
		font: inherit;
		font-weight: 500;
		color: var(--ink);
		background: var(--panel);
		border: 1px solid var(--rule);
		border-radius: 999px;
		padding: 6px 14px;
		cursor: pointer;
	}

	.more-rows:hover {
		background: var(--panel-raised);
	}

	.block {
		padding-top: 40px;
	}

	.block-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 16px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.block > h2 {
		margin-bottom: 12px;
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

	.summary {
		padding-top: 40px;
		max-width: 75ch;
	}

	.lower {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: 0 48px;
	}

	.lower .block {
		padding-top: 24px;
	}

	@media (max-width: 960px) {
		.lower {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 720px) {
		.panel {
			padding: 16px;
		}
	}
</style>
