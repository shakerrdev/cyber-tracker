<script lang="ts">
	import type { MetricDef } from '#lib/metric-defs.ts';

	interface Props {
		def: MetricDef;
		value: number | null;
		baseline: number | null;
	}

	let { def, value, baseline }: Props = $props();

	const delta = $derived(value !== null && baseline !== null ? value - baseline : null);
	const tone = $derived.by(() => {
		if (delta === null || Math.abs(delta) < 1e-9) return 'flat';
		return delta > 0 === def.higherIsBetter ? 'good' : 'bad';
	});
</script>

<div class="metric">
	<dt title={def.description}>{def.label}</dt>
	<dd>
		<span class="value">{def.format(value)}</span>
		{#if delta !== null}
			<span class="delta" data-tone={tone}>
				<span aria-hidden="true">{delta > 0 ? '▲' : delta < 0 ? '▼' : '='}</span>
				{def.formatDelta(delta)}
			</span>
		{/if}
	</dd>
</div>

<style>
	.metric {
		min-width: 0;
	}

	dt {
		color: var(--ink-3);
		font-size: 0.875rem;
	}

	dd {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}

	.value {
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: 1.75rem;
		line-height: 1.1;
	}

	.delta {
		font-size: 0.875rem;
		color: var(--ink-3);
		white-space: nowrap;
	}

	.delta span {
		font-size: 0.625rem;
		vertical-align: 1px;
	}

	[data-tone='good'] {
		color: var(--good);
	}

	[data-tone='bad'] {
		color: var(--bad);
	}
</style>
