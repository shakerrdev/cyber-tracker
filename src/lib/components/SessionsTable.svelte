<script lang="ts">
	import { resolve } from '$app/paths';
	import { fmt, formatClock, formatDay, formatDuration, pct, signed } from '#lib/format.ts';
	import { modeLabel } from '#lib/modes.ts';
	import type { SessionRow } from '#lib/views.ts';

	interface Props {
		rows: SessionRow[];
		timeZone: string;
		modeQuery: string;
		steamid: string;
		showModes: boolean;
	}

	let { rows, timeZone, modeQuery, showModes, steamid }: Props = $props();
</script>

<div class="scroll">
	<table>
		<thead>
			<tr>
				<th>Session</th>
				<th>Length</th>
				{#if showModes}<th>Modes</th>{/if}
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
			{#each rows as row (row.id)}
				<tr>
					<td>
						<a href="{resolve('/p/[steamid]/sessions/[id]', { steamid, id: row.id })}{modeQuery}">
							{formatDay(row.startedAt, timeZone)}
							<span class="muted">{formatClock(row.startedAt, timeZone)}</span>
						</a>
						{#if row.inProgress}<span class="live">live</span>{/if}
					</td>
					<td class="secondary">{formatDuration(row.playtime)}</td>
					{#if showModes}
						<td class="secondary">{row.modeIds.map(modeLabel).join(', ')}</td>
					{/if}
					<td class="num">{fmt(row.metrics.kills)}</td>
					<td class="num">{fmt(row.metrics.deaths)}</td>
					<td class="num">{fmt(row.metrics.kd, 2)}</td>
					<td class="num">{fmt(row.metrics.kpm, 2)}</td>
					<td class="num">{pct(row.metrics.hsPct)}</td>
					<td class="num">{pct(row.metrics.accuracy, 1)}</td>
					<td class="num">{signed(row.metrics.pointsDelta)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
	}

	td a {
		text-decoration: none;
		font-weight: 500;
	}

	td a:hover {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.live {
		margin-left: 8px;
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 0.8125rem;
		background: var(--kill-wash);
		color: var(--ink);
	}
</style>
