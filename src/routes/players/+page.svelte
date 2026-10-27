<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { formatAgo, mapName } from '#lib/format.ts';
	import { modeByKey } from '#lib/modes.ts';
	import type { PlayerView } from '#lib/views.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let adding = $state(false);
	let confirming = $state<string | null>(null);
	let seeding = $state(false);
	const hasDemo = $derived(data.players.some((p) => p.demo));

	function statusText(player: PlayerView): string {
		const s = player.status;
		if (!data.trackerEnabled && !player.demo) return 'Tracker paused';
		if (!s || s.state === 'starting') return 'Checking Cybershoke…';
		if (s.state === 'in_game' && s.presence?.kind === 'server') {
			const mode = modeByKey(s.presence.modeKey)?.label ?? s.presence.modeKey;
			return `Live on ${mode} #${s.presence.num}${s.presence.map ? `, ${mapName(s.presence.map)}` : ''}`;
		}
		if (s.state === 'hidden') return 'In a game, server hidden';
		if (s.state === 'other_mode' && s.presence?.kind === 'server')
			return `Playing ${s.presence.modeKey}`;
		if (s.state === 'error')
			return `Can't reach Cybershoke: ${s.lastError?.message ?? 'unknown error'}`;
		const seen = player.info?.lastSeen;
		return seen ? `Offline, last seen ${formatAgo(seen, data.now)}` : 'Offline';
	}
</script>

<svelte:head>
	<title>Players, cyber-tracker</title>
</svelte:head>

<h1>Players</h1>
<p class="secondary intro">
	Everyone here is checked every minute or so. Their sessions show up on their page once they play
	DM, Retake or Execute on Cybershoke.
</p>

<form
	method="POST"
	action="?/add"
	class="add"
	use:enhance={() => {
		adding = true;
		return async ({ update }) => {
			await update({ reset: false });
			adding = false;
		};
	}}
>
	<label for="player">Add a player</label>
	<div class="row">
		<input
			id="player"
			name="player"
			autocomplete="off"
			spellcheck="false"
			placeholder="SteamID64, Steam profile link or Cybershoke profile link"
			value={form && 'input' in form ? form.input : ''}
			aria-invalid={form && 'error' in form ? 'true' : undefined}
			aria-describedby="player-help"
			required
		/>
		<button type="submit" disabled={adding}>{adding ? 'Adding…' : 'Add player'}</button>
	</div>
	{#if form && 'error' in form}
		<p class="error" id="player-help" role="alert">{form.error}</p>
	{:else}
		<p class="muted" id="player-help">
			For example steamcommunity.com/id/cantremovethis or cybershoke.net/de/profile/7656119…
		</p>
	{/if}
</form>

{#if !hasDemo}
	<form
		method="POST"
		action="?/demo"
		class="demo"
		use:enhance={() => {
			seeding = true;
			return async ({ update }) => {
				await update();
				seeding = false;
			};
		}}
	>
		<div>
			<p class="demo-title">Try it with a demo player</p>
			<p class="muted">
				Adds a simulated player with 60 days of history who keeps playing DM, HS DM, Pistol DM and
				Retake right now, so the live view, compare page and session pages all have data.
			</p>
		</div>
		<button type="submit" disabled={seeding}>{seeding ? 'Generating…' : 'Add demo player'}</button>
	</form>
{/if}

{#if data.players.length === 0}
	<p class="muted empty">Nobody is tracked yet. Add yourself first.</p>
{:else}
	<ul class="list">
		{#each data.players as player (player.steamid64)}
			<li>
				{#if player.info}
					<img src={player.info.avatar} alt="" width="40" height="40" />
				{:else}
					<span class="avatar-gap"></span>
				{/if}
				<div class="who">
					<a href={resolve('/p/[steamid]', { steamid: player.steamid64 })}
						>{player.info?.name ?? player.steamid64}</a
					>
					<span class="muted status" class:live={player.status?.state === 'in_game'}
						>{statusText(player)}</span
					>
				</div>
				<form
					method="POST"
					action="?/remove"
					use:enhance={() =>
						async ({ update }) => {
							confirming = null;
							await update();
						}}
				>
					<input type="hidden" name="steamid64" value={player.steamid64} />
					{#if confirming === player.steamid64}
						<span class="secondary confirm"
							>{player.demo ? 'Its simulated history is deleted.' : 'Their history is kept.'}</span
						>
						<button type="submit" class="danger">Stop tracking</button>
						<button type="button" class="quiet" onclick={() => (confirming = null)}>Cancel</button>
					{:else}
						<button type="button" class="quiet" onclick={() => (confirming = player.steamid64)}
							>Stop tracking</button
						>
					{/if}
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	h1 {
		font-size: 2rem;
		margin-bottom: 6px;
	}

	.intro {
		max-width: 65ch;
		margin-bottom: 24px;
	}

	.add {
		max-width: 720px;
		background: var(--panel);
		border-radius: var(--radius);
		padding: 20px;
		margin-bottom: 32px;
	}

	label {
		display: block;
		font-weight: 500;
		margin-bottom: 8px;
	}

	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	input {
		flex: 1 1 320px;
		min-width: 0;
		font: inherit;
		color: var(--ink);
		background: var(--page);
		border: 1px solid var(--rule);
		border-radius: var(--radius);
		padding: 9px 12px;
	}

	input[aria-invalid='true'] {
		border-color: var(--bad);
	}

	button {
		font: inherit;
		font-weight: 500;
		border-radius: var(--radius);
		padding: 9px 16px;
		cursor: pointer;
		border: 1px solid var(--rule);
		background: var(--panel-raised);
		color: var(--ink);
	}

	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	button.quiet {
		background: none;
		border-color: transparent;
		color: var(--ink-2);
		padding: 6px 10px;
	}

	button.quiet:hover {
		color: var(--ink);
		background: var(--panel);
	}

	button.danger {
		padding: 6px 12px;
		border-color: var(--bad);
		color: var(--bad);
		background: none;
	}

	.add p {
		font-size: 0.875rem;
		margin-top: 8px;
	}

	.error {
		color: var(--bad);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-width: 720px;
	}

	.list li {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 0;
		border-bottom: 1px solid var(--grid);
		flex-wrap: wrap;
	}

	img,
	.avatar-gap {
		width: 40px;
		height: 40px;
		border-radius: 4px;
		flex: none;
	}

	.who {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.who a {
		font-weight: 500;
		text-underline-offset: 3px;
	}

	.status {
		font-size: 0.875rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status.live {
		color: var(--ink);
	}

	.list form {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.confirm {
		font-size: 0.875rem;
	}

	.demo {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px 20px;
		flex-wrap: wrap;
		max-width: 720px;
		border: 1px dashed var(--rule);
		border-radius: var(--radius);
		padding: 16px 20px;
		margin: -12px 0 32px;
	}

	.demo div {
		flex: 1 1 320px;
	}

	.demo-title {
		font-weight: 500;
	}

	.demo .muted {
		font-size: 0.875rem;
	}

	.empty {
		padding-top: 8px;
	}
</style>
