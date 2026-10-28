<script lang="ts">
	import MetricDelta from './MetricDelta.svelte';
	import { fmt, signed } from '#lib/format.ts';
	import { METRICS, type MetricKey } from '#lib/metric-defs.ts';
	import type { Metrics } from '#lib/metrics.ts';
	import type { SessionRow } from '#lib/views.ts';

	interface Props {
		row: SessionRow;
		baseline?: { count: number; metrics: Metrics } | null;
		compare?: boolean;
	}

	let { row, baseline = null, compare = false }: Props = $props();

	const keys: MetricKey[] = ['kd', 'kpm', 'hsPct', 'accuracy', 'dpm'];
</script>

<div class="summary">
	<div class="score">
		<div class="tally">
			<span class="big">{fmt(row.metrics.kills)}</span>
			<span class="caption"><span class="key k"></span>kills</span>
		</div>
		<div class="tally">
			<span class="big">{fmt(row.metrics.deaths)}</span>
			<span class="caption"><span class="key d"></span>deaths</span>
		</div>
		{#if row.metrics.pointsDelta !== null}
			<div class="tally">
				<span class="mid">{signed(row.metrics.pointsDelta)}</span>
				<span class="caption">rank points</span>
			</div>
		{/if}
	</div>

	<dl class="metrics">
		{#each keys as key (key)}
			{@const def = METRICS.find((m) => m.key === key)!}
			<MetricDelta {def} value={row.metrics[key]} baseline={baseline?.metrics[key] ?? null} />
		{/each}
	</dl>

	{#if compare || row.provisional}
		<p class="note muted">
			{#if compare}
				{#if baseline}
					Compared with the previous {baseline.count === 1
						? 'session'
						: `${baseline.count} sessions`}.
				{:else}
					The first tracked session. Comparisons start with the next one.
				{/if}
			{/if}
			{#if row.provisional}
				Live numbers for now; the full stats arrive after leaving the server.
			{/if}
		</p>
	{/if}
</div>

<style>
	.summary {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 12px 48px;
		align-items: end;
		padding: 20px 0 12px;
	}

	.score {
		display: flex;
		gap: 32px;
		align-items: flex-end;
		grid-row: span 2;
	}

	.tally {
		display: flex;
		flex-direction: column;
	}

	.big {
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: clamp(3.5rem, 8vw, 5.5rem);
		line-height: 0.9;
		letter-spacing: -0.01em;
	}

	.mid {
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: 2.25rem;
		line-height: 1;
	}

	.caption {
		color: var(--ink-2);
		font-size: 0.9375rem;
		margin-top: 6px;
	}

	.key {
		display: inline-block;
		width: 14px;
		height: 3px;
		border-radius: 2px;
		margin-right: 6px;
		vertical-align: middle;
	}

	.key.k {
		background: var(--kill);
	}

	.key.d {
		background: var(--death);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 12px 24px;
		margin: 0;
	}

	.note {
		font-size: 0.875rem;
	}

	@media (max-width: 720px) {
		.summary {
			grid-template-columns: 1fr;
		}

		.score {
			grid-row: auto;
		}
	}
</style>
