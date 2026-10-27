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
	const anyStarting = $derived(
		data.players.some((p) => !p.status || p.status.state === 'starting')
	);
	const path = $derived(page.url.pathname);
	const compact = $derived(data.players.length > 4);

	$effect(() => {
		const interval = setInterval(
			() => {
				if (document.visibilityState === 'visible') refreshAll();
			},
			anyStarting ? 3_000 : anyLive ? 15_000 : 60_000
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
	<nav class="players" aria-label="Players">
		<ul>
			{#each data.players as player (player.steamid64)}
				{@const href = resolve('/p/[steamid]', { steamid: player.steamid64 })}
				{@const current = path.startsWith(`/p/${player.steamid64}`)}
				{@const name = player.info?.name ?? player.steamid64}
				{@const live = player.status?.state === 'in_game'}
				<li>
					<a
						{href}
						class:icon={compact && !current && player.info}
						aria-current={current ? 'page' : undefined}
						title={live ? `${name}, in game now` : name}
					>
						{#if player.info}
							<span class="avatar">
								<img src={player.info.avatar} alt="" width="24" height="24" />
								{#if live}<span class="live"></span>{/if}
							</span>
						{/if}
						<span class="name">{name}</span>
						{#if live}<span class="visually-hidden">, in game</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	<nav class="tools" aria-label="Pages">
		<ul>
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
		gap: 12px 20px;
		padding-top: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--rule);
		margin-bottom: 20px;
	}

	.brand {
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: 1.25rem;
		color: var(--ink-2);
		white-space: nowrap;
	}

	.players {
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
		mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent);
	}

	ul {
		display: flex;
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 2px;
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

	a.icon {
		padding-right: 4px;
	}

	a.icon .name {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
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

	.avatar {
		position: relative;
		display: flex;
		flex: none;
	}

	img {
		border-radius: 50%;
	}

	.live {
		position: absolute;
		right: -2px;
		bottom: -2px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--kill);
		box-shadow: 0 0 0 2px var(--page);
	}

	main {
		padding-bottom: 64px;
	}

	@media (max-width: 640px) {
		:global(:root) {
			--gutter: 16px;
		}

		.brand {
			display: none;
		}
	}
</style>
