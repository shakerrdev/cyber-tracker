<script lang="ts">
	import { FILTER_OPTIONS } from '#lib/modes.ts';
	import { RANGES, type Range } from '#lib/views.ts';

	interface Props {
		mode: string;
		range: Range;
		base: string;
		extra?: string;
	}

	let { mode, range, base, extra = '' }: Props = $props();

	const href = (m: string, r: Range) => `${base}?mode=${m}&range=${r}${extra}`;
	const groups = [
		{ label: 'Deathmatch', options: FILTER_OPTIONS.filter((o) => o.group === 'dm') },
		{ label: 'Retake and Execute', options: FILTER_OPTIONS.filter((o) => o.group !== 'dm') }
	];
</script>

<nav class="filters" aria-label="Filters">
	{#each groups as group (group.label)}
		<ul aria-label={group.label}>
			{#each group.options as option (option.slug)}
				<li>
					<a
						href={href(option.slug, range)}
						aria-current={option.slug === mode ? 'page' : undefined}
						data-sveltekit-reset="false">{option.label}</a
					>
				</li>
			{/each}
		</ul>
	{/each}
	<ul class="range" aria-label="Time range">
		{#each RANGES as r (r.value)}
			<li>
				<a
					href={href(mode, r.value)}
					aria-current={r.value === range ? 'page' : undefined}
					aria-label={r.label}
					data-sveltekit-reset="false">{r.short}</a
				>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 14px;
		align-items: center;
		padding: 4px 0 24px;
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.range {
		margin-left: auto;
	}

	a {
		display: block;
		padding: 5px 10px;
		border-radius: 999px;
		color: var(--ink-2);
		text-decoration: none;
		font-size: 0.9375rem;
		white-space: nowrap;
	}

	a:hover {
		color: var(--ink);
		background: var(--panel);
	}

	a[aria-current='page'] {
		color: var(--ink);
		background: var(--panel-raised);
		box-shadow: inset 0 0 0 1px var(--rule);
		font-weight: 500;
	}

	@media (max-width: 760px) {
		.range {
			margin-left: 0;
		}
	}
</style>
