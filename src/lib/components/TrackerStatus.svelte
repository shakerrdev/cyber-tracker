<script lang="ts">
	import { formatAgo, mapName } from '#lib/format.ts';
	import { modeByKey } from '#lib/modes.ts';
	import type { LiveSample, Presence } from '#lib/types.ts';

	interface Props {
		enabled: boolean;
		state: string;
		presence: Presence | null;
		live: LiveSample | null;
		lastSeen: number | null;
		lastError: { at: number; message: string } | null;
		now: number;
	}

	let { enabled, state, presence, live, lastSeen, lastError, now }: Props = $props();

	const tone = $derived(
		!enabled ? 'idle' : state === 'in_game' ? 'live' : state === 'error' ? 'error' : 'idle'
	);
</script>

<div class="status" data-tone={tone} role="status">
	<span class="light" aria-hidden="true"></span>
	{#if !enabled}
		<span>Tracker paused</span>
	{:else if state === 'in_game' && presence?.kind === 'server'}
		<span>
			Live on {modeByKey(presence.modeKey)?.label ?? presence.modeKey}
			#{presence.num}{presence.map ? `, ${mapName(presence.map)}` : ''}
		</span>
		{#if live}
			<span class="score" aria-label="{live.kills} kills, {live.deaths} deaths">
				<span class="k">{live.kills}</span><span class="sep">–</span><span class="d"
					>{live.deaths}</span
				>
			</span>
		{/if}
	{:else if state === 'hidden'}
		<span>In a game, but the server is hidden in their Cybershoke settings</span>
	{:else if state === 'other_mode' && presence?.kind === 'server'}
		<span>Playing {presence.modeKey}, which isn't tracked</span>
	{:else if state === 'error' && lastError}
		<span>Can't reach Cybershoke, retrying</span>
		<span class="detail" title={lastError.message}>{lastError.message}</span>
	{:else if state === 'starting'}
		<span>Checking Cybershoke…</span>
	{:else}
		<span>Offline{lastSeen ? `, last seen ${formatAgo(lastSeen, now)}` : ''}</span>
	{/if}
</div>

<style>
	.status {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 36px;
		padding: 6px 14px;
		border-radius: 999px;
		background: var(--panel);
		border: 1px solid var(--rule);
		color: var(--ink-2);
		font-size: 0.9375rem;
		max-width: 100%;
	}

	.light {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--dot);
		flex: none;
	}

	[data-tone='live'] {
		color: var(--ink);
	}

	[data-tone='live'] .light {
		background: var(--kill);
		box-shadow: 0 0 0 0 var(--kill);
		animation: pulse 2s ease-out infinite;
	}

	[data-tone='error'] .light {
		background: var(--bad);
	}

	.score {
		font-family: var(--font-condensed);
		font-weight: 600;
		font-size: 1.125rem;
		color: var(--ink);
	}

	.sep {
		margin: 0 3px;
		color: var(--ink-3);
	}

	.detail {
		color: var(--ink-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 22ch;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 color-mix(in srgb, var(--kill) 60%, transparent);
		}
		100% {
			box-shadow: 0 0 0 8px transparent;
		}
	}
</style>
