<script lang="ts">
	import TrackerStatus from '#lib/components/TrackerStatus.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const player = $derived(data.player);
	const info = $derived(player.info);
</script>

<svelte:head>
	<title>{info?.name ?? player.steamid64}, cyber-tracker</title>
</svelte:head>

<div class="who">
	<div class="id">
		{#if info}
			<img src={info.avatar} alt="" width="44" height="44" />
		{/if}
		<div>
			<h1>{info?.name ?? player.steamid64}</h1>
			{#if player.demo}
				<p class="muted">Simulated player, regenerated on every restart</p>
			{:else if info?.faceitLevel}
				<p class="muted">FACEIT {info.faceitLevel}, {info.faceitElo} Elo</p>
			{/if}
		</div>
	</div>
	<TrackerStatus
		enabled={data.trackerEnabled || player.demo}
		state={player.status?.state ?? 'starting'}
		presence={player.status?.presence ?? null}
		live={player.status?.live ?? null}
		lastSeen={info?.lastSeen ?? null}
		lastError={player.status?.lastError ?? null}
		now={data.now}
	/>
</div>

{@render children()}

<style>
	.who {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px 16px;
		flex-wrap: wrap;
		padding-bottom: 16px;
	}

	.id {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	img {
		border-radius: 4px;
		flex: none;
	}

	h1 {
		font-size: 1.75rem;
		line-height: 1;
	}

	.muted {
		font-size: 0.9375rem;
	}
</style>
