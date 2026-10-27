<script lang="ts">
	import { fmt, pct, weaponName } from '#lib/format.ts';
	import type { WeaponRow } from '#lib/views.ts';

	interface Props {
		rows: WeaponRow[];
	}

	let { rows }: Props = $props();
</script>

<div class="scroll">
	<table>
		<thead>
			<tr>
				<th>Weapon</th>
				<th class="num">Kills</th>
				<th class="share-head"><span class="visually-hidden">Share of kills</span></th>
				<th class="num">HS</th>
				<th class="num">Acc</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr>
					<td>{weaponName(row.key)}</td>
					<td class="num">{fmt(row.kills)}</td>
					<td class="share" title="{pct(row.share)} of kills">
						<span class="track"><span class="fill" style:width="{row.share * 100}%"></span></span>
					</td>
					<td class="num">{pct(row.hsPct)}</td>
					<td class="num">{pct(row.accuracy, 1)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
	}

	.share-head,
	.share {
		width: 30%;
		min-width: 64px;
	}

	.track {
		display: block;
		height: 6px;
		border-radius: 3px;
		background: var(--grid);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		border-radius: 3px;
		background: var(--kill);
	}
</style>
