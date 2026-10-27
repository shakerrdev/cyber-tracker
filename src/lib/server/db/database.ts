import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS = [
	`
	create table player (
		steamid64 text primary key,
		name text not null,
		avatar text not null,
		avatar_hash text,
		country text,
		faceit_elo integer,
		faceit_level integer,
		global_place integer,
		last_seen integer,
		updated_at integer not null
	);

	create table snapshot (
		id integer primary key,
		steamid64 text not null,
		taken_at integer not null,
		hash text not null,
		stats blob not null
	);
	create index snapshot_player_time on snapshot (steamid64, taken_at);

	create table live_sample (
		id integer primary key,
		steamid64 text not null,
		taken_at integer not null,
		server_id integer,
		server_ip text not null,
		server_port integer not null,
		server_num integer,
		mode_id integer not null,
		map text not null,
		kills integer not null,
		deaths integer not null,
		headshots integer not null,
		seconds integer not null,
		points integer,
		rank integer,
		ttk_ms integer
	);
	create index live_sample_player_time on live_sample (steamid64, taken_at);
	`,
	`
	create table tracked (
		steamid64 text primary key,
		added_at integer not null
	);
	insert into tracked (steamid64, added_at) select steamid64, updated_at from player;
	`
];

export function openDatabase(path: string): DatabaseSync {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseSync(path);
	db.exec('pragma journal_mode = wal; pragma synchronous = normal; pragma busy_timeout = 5000;');
	migrate(db);
	return db;
}

function migrate(db: DatabaseSync) {
	const { user_version: current } = db.prepare('pragma user_version').get() as {
		user_version: number;
	};
	for (let version = current; version < MIGRATIONS.length; version++) {
		db.exec('begin');
		try {
			db.exec(MIGRATIONS[version]);
			db.exec(`pragma user_version = ${version + 1}`);
			db.exec('commit');
		} catch (error) {
			db.exec('rollback');
			throw error;
		}
	}
}
