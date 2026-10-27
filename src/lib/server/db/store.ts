import type { DatabaseSync } from 'node:sqlite';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { LiveSample, PlayerInfo, Snapshot, StatsSnapshot } from '#lib/types.ts';

interface PlayerRow {
	steamid64: string;
	name: string;
	avatar: string;
	avatar_hash: string | null;
	country: string | null;
	faceit_elo: number | null;
	faceit_level: number | null;
	global_place: number | null;
	last_seen: number | null;
}

interface SnapshotRow {
	id: number;
	taken_at: number;
	stats: Uint8Array;
}

interface SampleRow {
	taken_at: number;
	server_id: number | null;
	server_ip: string;
	server_port: number;
	server_num: number | null;
	mode_id: number;
	map: string;
	kills: number;
	deaths: number;
	headshots: number;
	seconds: number;
	points: number | null;
	rank: number | null;
	ttk_ms: number | null;
}

export class Store {
	readonly db: DatabaseSync;
	private revision = 0;

	constructor(db: DatabaseSync) {
		this.db = db;
	}

	get version(): number {
		return this.revision;
	}

	upsertPlayer(player: PlayerInfo, updatedAt: number) {
		this.db
			.prepare(
				`insert into player (steamid64, name, avatar, avatar_hash, country, faceit_elo, faceit_level, global_place, last_seen, updated_at)
				 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				 on conflict (steamid64) do update set
					name = excluded.name, avatar = excluded.avatar, avatar_hash = excluded.avatar_hash,
					country = excluded.country, faceit_elo = excluded.faceit_elo, faceit_level = excluded.faceit_level,
					global_place = excluded.global_place, last_seen = excluded.last_seen, updated_at = excluded.updated_at`
			)
			.run(
				player.steamid64,
				player.name,
				player.avatar,
				player.avatarHash,
				player.country,
				player.faceitElo,
				player.faceitLevel,
				player.globalPlace,
				player.lastSeen,
				updatedAt
			);
	}

	player(steamid64: string): PlayerInfo | null {
		const row = this.db.prepare('select * from player where steamid64 = ?').get(steamid64) as
			PlayerRow | undefined;
		if (!row) return null;
		return {
			steamid64: row.steamid64,
			name: row.name,
			avatar: row.avatar,
			avatarHash: row.avatar_hash,
			country: row.country,
			faceitElo: row.faceit_elo,
			faceitLevel: row.faceit_level,
			globalPlace: row.global_place,
			lastSeen: row.last_seen
		};
	}

	tracked(): string[] {
		const rows = this.db
			.prepare('select steamid64 from tracked order by added_at, steamid64')
			.all() as unknown as { steamid64: string }[];
		return rows.map((r) => r.steamid64);
	}

	track(steamid64: string, at: number): boolean {
		const result = this.db
			.prepare('insert into tracked (steamid64, added_at) values (?, ?) on conflict do nothing')
			.run(steamid64, at);
		return Number(result.changes) > 0;
	}

	untrack(steamid64: string): boolean {
		const result = this.db.prepare('delete from tracked where steamid64 = ?').run(steamid64);
		return Number(result.changes) > 0;
	}

	purge(steamid64: string) {
		for (const table of ['tracked', 'live_sample', 'snapshot', 'player']) {
			this.db.prepare(`delete from ${table} where steamid64 = ?`).run(steamid64);
		}
		this.revision++;
	}

	latestSnapshot(steamid64: string): Snapshot | null {
		const row = this.db
			.prepare(
				'select id, taken_at, stats from snapshot where steamid64 = ? order by taken_at desc, id desc limit 1'
			)
			.get(steamid64) as SnapshotRow | undefined;
		if (!row) return null;
		return {
			id: row.id,
			takenAt: row.taken_at,
			stats: JSON.parse(gunzipSync(row.stats).toString('utf8')) as StatsSnapshot
		};
	}

	latestSnapshotHash(steamid64: string): string | null {
		const row = this.db
			.prepare(
				'select hash from snapshot where steamid64 = ? order by taken_at desc, id desc limit 1'
			)
			.get(steamid64) as { hash: string } | undefined;
		return row?.hash ?? null;
	}

	insertSnapshot(steamid64: string, takenAt: number, hash: string, stats: StatsSnapshot) {
		this.db
			.prepare('insert into snapshot (steamid64, taken_at, hash, stats) values (?, ?, ?, ?)')
			.run(steamid64, takenAt, hash, gzipSync(JSON.stringify(stats)));
		this.revision++;
	}

	snapshots(steamid64: string): Snapshot[] {
		const rows = this.db
			.prepare('select id, taken_at, stats from snapshot where steamid64 = ? order by taken_at, id')
			.all(steamid64) as unknown as SnapshotRow[];
		return rows.map((row) => ({
			id: row.id,
			takenAt: row.taken_at,
			stats: JSON.parse(gunzipSync(row.stats).toString('utf8')) as StatsSnapshot
		}));
	}

	insertSample(steamid64: string, s: LiveSample) {
		this.db
			.prepare(
				`insert into live_sample (steamid64, taken_at, server_id, server_ip, server_port, server_num, mode_id, map, kills, deaths, headshots, seconds, points, rank, ttk_ms)
				 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				steamid64,
				s.takenAt,
				s.serverId,
				s.serverIp,
				s.serverPort,
				s.serverNum,
				s.modeId,
				s.map,
				s.kills,
				s.deaths,
				s.headshots,
				s.seconds,
				s.points,
				s.rank,
				s.ttkMs
			);
		this.revision++;
	}

	samples(steamid64: string, since = 0): LiveSample[] {
		const rows = this.db
			.prepare(
				'select * from live_sample where steamid64 = ? and taken_at >= ? order by taken_at, id'
			)
			.all(steamid64, since) as unknown as SampleRow[];
		return rows.map((r) => ({
			takenAt: r.taken_at,
			serverId: r.server_id,
			serverIp: r.server_ip,
			serverPort: r.server_port,
			serverNum: r.server_num,
			modeId: r.mode_id,
			map: r.map,
			kills: r.kills,
			deaths: r.deaths,
			headshots: r.headshots,
			seconds: r.seconds,
			points: r.points,
			rank: r.rank,
			ttkMs: r.ttk_ms
		}));
	}
}
