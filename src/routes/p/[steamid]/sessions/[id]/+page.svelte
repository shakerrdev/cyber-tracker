<script lang="ts">
	import { resolve } from '$app/paths';
	import KillCurve from '#lib/components/KillCurve.svelte';
	import SessionSummary from '#lib/components/SessionSummary.svelte';
	import StreakChart from '#lib/components/StreakChart.svelte';
	import WeaponsTable from '#lib/components/WeaponsTable.svelte';
	import {
		fmt,
		formatClock,
		formatDay,
		formatDuration,
		mapName,
		pct,
		signed
	} from '#lib/format.ts';
	import { modeLabel } from '#lib/modes.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const query = $derived(`?mode=${data.back}`);
	const steamid = $derived(data.player.steamid64);
	const row = $derived(data.row);
</script>

<svelte:head>
	<title>{formatDay(row.startedAt, data.timeZone)} session, cyber-tracker</title>
</svelte:head>

<nav class="crumbs">
	<a href="{resolve('/p/[steamid]', { steamid })}{query}">All sessions</a>
</nav>

<section class="panel">
	<h1>
		{formatDay(row.startedAt, data.timeZone)}, {formatClock(row.startedAt, data.timeZone)} to {formatClock(
			row.endedAt,
			data.timeZone
		)}
	</h1>
	<p class="secondary">
		{formatDuration(row.playtime)} on {row.modeIds.map(modeLabel).join(', ')}{row.inProgress
			? ', still playing'
			: ''}
	</p>
	<SessionSummary {row} />
	{#if data.curve.length > 0}
		<KillCurve segments={data.curve} timeZone={data.timeZone} />
	{/if}
</section>

{#if data.modes.length > 1}
	<section class="block" aria-labelledby="modes-title">
		<h2 id="modes-title">By mode</h2>
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th>Mode</th>
						<th>Time</th>
						<th class="num">Kills</th>
						<th class="num">Deaths</th>
						<th class="num">K/D</th>
						<th class="num">KPM</th>
						<th class="num">HS</th>
						<th class="num">Acc</th>
						<th class="num">Points</th>
					</tr>
				</thead>
				<tbody>
					{#each data.modes as mode (mode.modeId)}
						<tr>
							<td>{modeLabel(mode.modeId)}</td>
							<td class="secondary">{formatDuration(mode.metrics.minutes * 60)}</td>
							<td class="num">{fmt(mode.metrics.kills)}</td>
							<td class="num">{fmt(mode.metrics.deaths)}</td>
							<td class="num">{fmt(mode.metrics.kd, 2)}</td>
							<td class="num">{fmt(mode.metrics.kpm, 2)}</td>
							<td class="num">{pct(mode.metrics.hsPct)}</td>
							<td class="num">{pct(mode.metrics.accuracy, 1)}</td>
							<td class="num">{signed(mode.metrics.pointsDelta)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="muted note">
			Deaths per mode are estimated: Cybershoke only reports total deaths, so they are split by time
			played in each mode.
		</p>
	</section>
{/if}

{#if data.stints.length > 0}
	<section class="block" aria-labelledby="servers-title">
		<h2 id="servers-title">Servers</h2>
		<div class="scroll">
			<table>
				<thead>
					<tr>
						<th>Joined</th>
						<th>Server</th>
						<th>Map</th>
						<th>Time</th>
						<th class="num">Kills</th>
						<th class="num">Deaths</th>
						<th class="num">K/D</th>
						<th class="num">HS</th>
						<th class="num">TTK</th>
						<th class="num">Rank points</th>
					</tr>
				</thead>
				<tbody>
					{#each data.stints as stint (stint.startedAt)}
						<tr>
							<td>{formatClock(stint.startedAt, data.timeZone)}</td>
							<td class="secondary"
								>{modeLabel(stint.modeId)}{stint.serverNum ? ` #${stint.serverNum}` : ''}</td
							>
							<td class="secondary">{stint.maps.map(mapName).join(', ')}</td>
							<td class="secondary">{formatDuration(stint.seconds)}</td>
							<td class="num">{stint.kills}</td>
							<td class="num">{stint.deaths}</td>
							<td class="num">{stint.deaths ? fmt(stint.kills / stint.deaths, 2) : '–'}</td>
							<td class="num">{stint.kills ? pct(stint.headshots / stint.kills) : '–'}</td>
							<td class="num">{stint.ttkMs ? `${stint.ttkMs} ms` : '–'}</td>
							<td class="num">{fmt(stint.pointsStart)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="muted note">
			Live numbers from the server scoreboard, sampled every 20 seconds, so the last few seconds
			before leaving can be missing.
		</p>
	</section>
{/if}

<div class="lower">
	<section class="block" aria-labelledby="weapons-title">
		<h2 id="weapons-title">Weapons</h2>
		{#if data.weapons.length}
			<WeaponsTable rows={data.weapons} />
		{:else}
			<p class="muted">Weapon stats arrive once the player leaves the server.</p>
		{/if}
	</section>
	<section class="block" aria-labelledby="streaks-title">
		<h2 id="streaks-title">Kill streaks</h2>
		<StreakChart streaks={data.killstreaks} />
	</section>
</div>

{#if data.maps.length}
	<section class="block" aria-labelledby="maps-title">
		<h2 id="maps-title">Maps</h2>
		<div class="scroll maps">
			<table>
				<thead>
					<tr>
						<th>Map</th>
						<th>Time</th>
						<th class="num">Kills</th>
						<th class="num">KPM</th>
					</tr>
				</thead>
				<tbody>
					{#each data.maps as map (map.key)}
						<tr>
							<td>{mapName(map.key)}</td>
							<td class="secondary">{formatDuration(map.playtime)}</td>
							<td class="num">{fmt(map.kills)}</td>
							<td class="num">{fmt(map.kpm, 2)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<nav class="pager" aria-label="Other sessions">
	{#if data.earlier}
		<a href="{resolve('/p/[steamid]/sessions/[id]', { steamid, id: data.earlier })}{query}"
			>Earlier session</a
		>
	{/if}
	{#if data.later}
		<a
			class="later"
			href="{resolve('/p/[steamid]/sessions/[id]', { steamid, id: data.later })}{query}"
			>Later session</a
		>
	{/if}
</nav>

<style>
	.crumbs {
		padding: 4px 0 20px;
	}

	.crumbs a {
		color: var(--ink-2);
		text-underline-offset: 3px;
	}

	.panel {
		background: var(--panel);
		border-radius: var(--radius);
		padding: 24px;
	}

	h1 {
		font-size: 2rem;
	}

	.block {
		padding-top: 40px;
	}

	.block > h2 {
		margin-bottom: 12px;
	}

	.scroll {
		overflow-x: auto;
	}

	.maps {
		max-width: 560px;
	}

	.note {
		font-size: 0.875rem;
		margin-top: 10px;
		max-width: 75ch;
	}

	.lower {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
		gap: 0 48px;
	}

	.pager {
		display: flex;
		justify-content: space-between;
		padding-top: 48px;
	}

	.pager a {
		font-weight: 500;
		text-underline-offset: 3px;
	}

	.later {
		margin-left: auto;
	}

	@media (max-width: 860px) {
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
