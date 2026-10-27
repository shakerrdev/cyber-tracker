<script lang="ts">
	interface Props {
		streaks: { length: number; count: number }[];
	}

	let { streaks }: Props = $props();

	const max = $derived(Math.max(1, ...streaks.map((s) => s.count)));
	const longest = $derived(streaks.at(-1)?.length ?? null);
</script>

{#if streaks.length === 0}
	<p class="muted">No multi-kill streaks recorded.</p>
{:else}
	<p class="secondary lead">
		Longest streak: <strong>{longest}</strong> kills without dying.
	</p>
	<div class="chart" role="list" aria-label="Kill streaks by length">
		{#each streaks as streak (streak.length)}
			<div class="col" role="listitem" title="{streak.count} streaks of {streak.length} kills">
				<div class="plot">
					<span class="count">{streak.count}</span>
					<span class="bar" style:height="{Math.max(3, (streak.count / max) * 100)}%"></span>
				</div>
				<span class="len">{streak.length}</span>
			</div>
		{/each}
	</div>
	<p class="muted axis">Streak length in kills</p>
{/if}

<style>
	.lead {
		margin-bottom: 12px;
	}

	strong {
		color: var(--ink);
		font-weight: 600;
	}

	.chart {
		display: flex;
		gap: 2px;
	}

	.col {
		flex: 1 1 0;
		max-width: 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.plot {
		width: 100%;
		height: 120px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		border-bottom: 1px solid var(--rule);
	}

	.bar {
		width: 100%;
		background: var(--kill);
		border-radius: 4px 4px 0 0;
	}

	.count,
	.len {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
	}

	.count {
		color: var(--ink-2);
		margin-bottom: 2px;
	}

	.len {
		color: var(--ink-3);
		margin-top: 4px;
	}

	.axis {
		font-size: 0.8125rem;
		margin-top: 2px;
	}
</style>
