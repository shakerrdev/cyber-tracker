<script lang="ts">
	import '@fontsource/barlow/400.css';
	import '@fontsource/barlow/500.css';
	import '@fontsource/barlow/600.css';
	import '@fontsource/barlow-condensed/500.css';
	import '@fontsource/barlow-condensed/600.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import TrackerStatus from '#lib/components/TrackerStatus.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const inGame = $derived(data.tracker.state === 'in_game');

	$effect(() => {
		const interval = setInterval(
			() => {
				if (document.visibilityState === 'visible') refreshAll();
			},
			inGame ? 15_000 : 60_000
		);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>cyber-tracker</title>
</svelte:head>

<header>
	<a class="who" href={resolve('/')}>
		{#if data.player}
			<img src={data.player.avatar} alt="" width="40" height="40" />
			<span class="name">{data.player.name}</span>
			{#if data.player.faceitLevel}
				<span class="faceit">FACEIT {data.player.faceitLevel}, {data.player.faceitElo} Elo</span>
			{/if}
		{:else}
			<span class="name">cyber-tracker</span>
		{/if}
	</a>
	<TrackerStatus
		enabled={data.tracker.enabled}
		state={data.tracker.state}
		presence={data.tracker.presence}
		live={data.tracker.live}
		lastSeen={data.player?.lastSeen ?? null}
		lastError={data.tracker.lastError}
		now={data.now}
	/>
</header>

<main>
	{@render children()}
</main>

<style>
	header,
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 var(--gutter);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding-top: 20px;
		padding-bottom: 20px;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		min-width: 0;
	}

	img {
		border-radius: 4px;
		flex: none;
	}

	.name {
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: 1.5rem;
		line-height: 1;
	}

	.faceit {
		color: var(--ink-3);
		font-size: 0.9375rem;
	}

	main {
		padding-bottom: 64px;
	}

	@media (max-width: 640px) {
		:global(:root) {
			--gutter: 16px;
		}

		.faceit {
			display: none;
		}
	}
</style>
