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
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const anyLive = $derived(data.players.some((p) => p.status?.state === 'in_game'));
	const path = $derived(page.url.pathname);

	$effect(() => {
		const interval = setInterval(
			() => {
				if (document.visibilityState === 'visible') refreshAll();
			},
			anyLive ? 15_000 : 60_000
		);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>cyber-tracker</title>
</svelte:head>

<header>
	<span class="brand">cyber-tracker</span>
	<nav aria-label="Players">
		<ul>
			{#each data.players as player (player.steamid64)}
				{@const href = resolve('/p/[steamid]', { steamid: player.steamid64 })}
				<li>
					<a {href} aria-current={path.startsWith(`/p/${player.steamid64}`) ? 'page' : undefined}>
						{#if player.info}
							<img src={player.info.avatar} alt="" width="22" height="22" />
						{/if}
						<span>{player.info?.name ?? player.steamid64}</span>
						{#if player.status?.state === 'in_game'}
							<span class="live" title="In game now"><span class="visually-hidden">live</span></span
							>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
		<ul class="tools">
			{#if data.players.length > 1}
				<li>
					<a
						href={resolve('/compare')}
						aria-current={path.startsWith('/compare') ? 'page' : undefined}>Compare</a
					>
				</li>
			{/if}
			<li>
				<a
					href={resolve('/players')}
					aria-current={path.startsWith('/players') ? 'page' : undefined}>Players</a
				>
			</li>
		</ul>
	</nav>
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
		gap: 12px 24px;
		flex-wrap: wrap;
		padding-top: 14px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--rule);
		margin-bottom: 20px;
	}

	.brand {
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: 1.25rem;
		color: var(--ink-2);
	}

	nav {
		display: flex;
		flex: 1 1 340px;
		gap: 8px 16px;
		flex-wrap: wrap;
		align-items: center;
		min-width: 0;
	}

	ul {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tools {
		margin-left: auto;
	}

	a {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 12px 4px 4px;
		border-radius: 999px;
		color: var(--ink-2);
		text-decoration: none;
		white-space: nowrap;
	}

	.tools a {
		padding-left: 12px;
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

	img {
		border-radius: 50%;
	}

	.live {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--kill);
	}

	main {
		padding-bottom: 64px;
	}

	@media (max-width: 640px) {
		:global(:root) {
			--gutter: 16px;
		}

		.tools {
			margin-left: 0;
		}
	}
</style>
