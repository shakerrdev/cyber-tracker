# cyber-tracker

Tracks the CS2 performance of you and a few friends on [Cybershoke](https://cybershoke.net/de/cs2) across sessions and over time. Deathmatch first (DM, Pistol DM, HS DM, AWP DM, Aim DM, MultiCFG DM); Retake, Retake Cards, Pistol Retake and Execute are recorded too.

It runs as a small always-on service: it watches each player's Cybershoke profile, follows them onto the server while they play, and shows every session and the long-term progress on a dashboard per player. The compare page puts players side by side.

## Players

Add and remove players on the Players page with a SteamID64, a Steam profile link (`steamcommunity.com/id/…` or `/profiles/…`) or a Cybershoke profile link. Stopping tracking keeps the player's history; adding them again picks it back up.

`STEAMID64` only seeds the list on the very first start (one ID or several, comma-separated). After that the Players page is the source of truth.

All players share one Cybershoke client that spaces requests 1.5 seconds apart and reuses a server's scoreboard for players on the same server, so a handful of players stays well below Cybershoke's rate limit.

## Compare

Pick players, a mode and a time range. The table shows the tracked sessions in that range (K/D, kills per minute, headshots, accuracy, damage, time to kill, rank points) next to the all-time numbers from each profile, with the best value per row in bold. The chart below draws each player's 10-session average for the stat you choose.

## How it works

Cybershoke has no public API. The tracker uses the two endpoints the website itself uses (details in [docs/cybershoke-api.md](docs/cybershoke-api.md)):

- **The profile** (`/api/user/data`) has cumulative counters per mode: kills, headshots, damage, time played, per weapon (shots, hits, hit groups) and per map, plus kill streaks. These counters only change when the player leaves a server. The tracker checks the profile every minute (every 3 minutes after half an hour of inactivity) and stores a snapshot whenever something changed. The difference between two snapshots is what you played in between.
- **The live scoreboard** (`/api/servers/data`) of the server the player is on. While the profile shows a tracked mode, the tracker reads that server's scoreboard every 20 seconds: kills, deaths, headshots, time on the server and rank points.

From that it builds:

- **Stints**: one continuous stay on one server, from the live samples.
- **Sessions**: stints and profile changes less than 30 minutes apart.
- **Session stats**: the profile difference once it's in (exact), or the live scoreboard while the player is still on the server (marked as live).

Cybershoke only reports deaths as an all-mode total. When someone played more than one mode between two profile checks, the deaths are split by time played in each mode.

## Running it on the NAS

The image is built by GitHub Actions and published to `ghcr.io/shakerrdev/cyber-tracker` for amd64 and arm64.

1. Make the image public once: GHCR packages start private even for a public repo. Go to github.com/users/shakerrdev/packages/container/cyber-tracker/settings and choose Change visibility. Otherwise log in on the NAS with a token that has `read:packages`: `docker login ghcr.io -u shakerrdev`.
2. On UGOS: Docker, Project, Create, paste [docker-compose.yml](docker-compose.yml), set `STEAMID64` to your SteamID64 (add friends later in the app), Deploy. Anywhere else: `docker compose up -d` next to the file.
3. Open `https://obelix:3010` (or whatever your NAS is called).

To update, pull the new image and redeploy the project. To build it yourself instead: `docker build -t ghcr.io/shakerrdev/cyber-tracker:latest .` before deploying.

### HTTPS

The app serves HTTPS on its port and redirects plain `http://` requests there (`/api/status` stays reachable over HTTP for the healthcheck). Certificates are signed for every local name you open it by (`obelix`, `nas.local`, `localhost`, plus the addresses in `TLS_HOSTS`).

By default it signs them with cs-demo-cloud's certificate authority, which your devices already trust: the compose file mounts `../cs-demo-cloud/data/tls` read-only at `/ca`. If cs-demo-cloud's project folder isn't next to this one, set `CA_PATH` to its `data/tls` folder. Without a usable CA there, the app creates its own in `/data/tls` and logs that browsers will warn until that one is installed. The log's first lines say which CA is in use.

With a real certificate, set `TLS_CERT` and `TLS_KEY` instead. `HTTPS=off` serves plain HTTP.

The database lives in the `data` volume (`/data/cyber-tracker.db`, SQLite). Back up that volume to keep your history.

It must run somewhere that can reach cybershoke.net, such as the home network. Each player should keep their server visible in their Cybershoke privacy settings; with a hidden server the tracker still records sessions from the profile, but without live scoreboard data such as rank points and the kill curve.

### Settings

| Variable                    | Default                  | Meaning                                          |
| --------------------------- | ------------------------ | ------------------------------------------------ |
| `STEAMID64`                 | empty                    | Players to track on first start, comma-separated |
| `TZ`                        | `Europe/Berlin`          | Time zone for dates on the dashboard             |
| `DATA_DIR`                  | `/data` in the image     | Where the SQLite database goes                   |
| `PORT`                      | `3010` in compose        | Port on the NAS                                  |
| `TLS_CA_DIR`                | `/ca` in compose         | Folder with an existing `ca.crt` and `ca.key`    |
| `TLS_HOSTS`                 | empty                    | IPs or extra names for the certificate           |
| `TLS_CERT`/`TLS_KEY`        | empty                    | Your own certificate instead                     |
| `HTTPS`                     | `on`                     | `off` serves plain HTTP                          |
| `PROFILE_INTERVAL_SEC`      | `60`                     | Profile check interval while active              |
| `IDLE_PROFILE_INTERVAL_SEC` | `180`                    | Profile check interval after 30 minutes offline  |
| `LIVE_INTERVAL_SEC`         | `20`                     | Scoreboard check interval while in game          |
| `SESSION_GAP_MIN`           | `30`                     | A break this long starts a new session           |
| `TRACKER_ENABLED`           | `true`                   | Set to `false` to only serve the dashboard       |
| `CYBERSHOKE_BASE_URL`       | `https://cybershoke.net` | Point at the fake server for development         |

`GET /api/status` returns what the tracker is currently doing.

## Development

Requires Node 22.17 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

The sandbox and CI can't reach cybershoke.net, so there are two stand-ins:

- `npm run seed:demo` fills `DATA_DIR` with 60 days of simulated sessions for three players (set `DATA_DIR=data-demo` and `TRACKER_ENABLED=false` to browse them).
- `npm run sim` starts a fake Cybershoke on port 8787 with a simulated player for every ID in `STEAMID64` who joins DM servers, plays and leaves. Run the app with `CYBERSHOKE_BASE_URL=http://localhost:8787` to watch live tracking work.

```sh
npm test         # unit tests
npm run check    # type check
npm run build    # production build in build/
npm start        # run the production build
```
