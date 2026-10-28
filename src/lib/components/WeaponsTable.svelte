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
				<th class="num">HS</th>
				<th class="num">Acc</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.key)}
				<tr>
					<td class="weapon">
						{weaponName(row.key)}
						<span class="track" title="{pct(row.share)} of kills"
							><span class="fill" style:width="{row.share * 100}%"></span></span
						>
					</td>
					<td class="num">{fmt(row.kills)}</td>
					<td class="num">{pct(row.hsPct)}</td>
					<td class="num">{pct(row.accuracy, 1)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		position: relative;
		overflow-x: auto;
	}

	.weapon {
		width: 100%;
		padding-bottom: 8px;
	}

	.track {
		display: block;
		height: 3px;
		margin-top: 4px;
		max-width: 180px;
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
