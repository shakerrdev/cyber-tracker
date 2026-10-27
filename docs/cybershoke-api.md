# Cybershoke API notes

Reverse-engineered from the cybershoke.net web app (Oct 2026). Undocumented and subject to change.

Base URL: `https://cybershoke.net`. None of the endpoints below need a login or Cloudflare cookies. Some endpoints answer `429 Too Many Requests` after ~40 requests in quick succession, so polling should stay at a few requests per minute.

## Player profile

```
POST /api/user/data
Content-Type: application/x-www-form-urlencoded

steamid64=76561198056395137
```

Top-level keys: `basic`, `statistics`, `config`, `skinchanger`, `achievements`, `server`, `cybershoke`, `meta`.

### `basic`

- `name`, `name_unique` (`/de/profile/{steamid64}` redirects to `/de/id/{name_unique}`), `country`, `prime`, `bans_list`
- `avatar`: Steam avatar URL. Its hash is the only way to find the player in live server lists.
- `connect.faceit`: `elo`, `skill_level`, `name`
- `friends`: `{steamid64: {name, avatar, lastconnect, country, ...}}`
- `friends_servers_online`: `{steamid64: {name: "DM #102", id_server, mode, id_mode, server: "ip:port", category, avatar, id_games}}`

### `cybershoke`

- `global`: all-mode totals: `kills`, `deaths` (string), `shoots`, `hits`, `headshots`, `assists`, `playtime` (string, seconds), `rank`, `value`, `lastconnect` (unix)
- `top.global`: global place

`lastconnect` advances on every request while the player is online. It is the only counter that moves during play.

### `statistics.modes[id]`

Cumulative counters per mode id (see table below). Mode `0` is the all-mode total and only has `general` and `weapons`.

- `general`: `kills`, `headshots`, `hp` (damage dealt), `playtime` (seconds), `rounds_ct`, `rounds_t`, `bomb_defused`, `bomb_planted`
- `weapons[weapon_*]`: `kills`, `headshots`, `shoots`, `hits`, `hp`, `hits_head`, `hits_neak`, `hits_chest`, `hits_belly`, `hits_left_arm`, `hits_right_arm`, `hits_left_leg`, `hits_right_leg`, `ttk_count`, `ttk_sum_ms`, `ttk_ms`, `reaction_count`, `reaction_sum_ms`, `reaction_ms`, `ttd_count`, `ttd_sum_ms`, `ttd_ms`, `unixtime_lastupdate`
- `maps[map]`: `kills`, `playtime`, `rounds_ct`, `rounds_t`, `bomb_defused`, `bomb_planted`
- `killstreaks`: `{streakLength: count}`
- `clutches`: `{opponents: count}` (round-based modes)

There are no per-mode deaths. Only `cybershoke.global.deaths` exists.

The counters are not updated while the player is on a server. Watching a player on a DM server for two minutes, their live stats moved while every profile counter stayed the same. They are written when the player leaves the server.

### `server`

- Offline: `{}`
- In-game: `{players, max_players, map, id_games, server_ip, server_port, mode, category, num, matches_id_lobby}`
- In-game with the server hidden by the player: `{players, max_players, map, id_games, matches_id_lobby, hide_type: 1}` (no address)

## Mode ids (CS2, `id_games` 2)

| Mode | id | Mode | id |
|---|---|---|---|
| DM | 11 | RETAKE | 29 |
| AIMDM | 1 | RETAKECARDS | 28 |
| AWPDM | 5 | PISTOLRETAKE | 23 |
| HSDM | 15 | EXECUTE | 13 |
| MULTICFGDM | 21 | | |
| PISTOLDM | 22 | | |

Source: `GET /api/api/v2/main/data` → `data.modules.servers.data.modes["2"][MODE].id`.

## Live server

```
POST /api/servers/data
Content-Type: application/json

{"ip": "162.55.2.53", "port": 27034}
```

- `serversv2["0"]`: `id`, `id_mode`, `mode`, `num`, `map`, `players`, `max_players`, `location`, `tick_rate`, `match_start_time`, `match_max_time`
- `playersv2[]`: `name`, `avatar`, `country`, `kills`, `deaths`, `headshots`, `time` (seconds on this server), `points` (mode rank points), `rank` (0–16), `ttk` (ms), `reaction`, `ttd`, `is_alive`, `faceit_level`, `cybershoke_level`

Players carry no SteamID64. The tracked player is matched by avatar hash, with the name as a fallback. `points` did not change during a two-minute live window.

## Server list

`GET /api/api/v2/main/data` (~770 KB) → `data.modules.servers.data.servers["2"][MODE][category][]`: `id`, `ip`, `port`, `num`, `map`, `players`, `maxplayers`, `location`.

## Leaderboard

```
POST /api/api/v2/leaderboard/data
Content-Type: application/json

{"mode": 11, "season": 0, "only_friends": false, "only_pro": false, "id_games": 2, "map": null, "category": null, "sub_type": 0}
```

Top 100 only: `place`, `name`, `steamid64`, `kills`, `kd`, `headshots_procent`, `playtime_str`, `rank`, `points`, all formatted as display strings. A `steamid64` filter only applies to SURF/BHOP/KZ. `POST /api/api/v1/leaderboard/user` (own entry) needs a login.

## Misc

- `GET /api/api/v1/compass`: online PRO players
- Avatar: `https://cloud.cybershoke.net/img/profile/{steamid64}.png`
