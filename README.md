# cyber-tracker

Tracks one player's CS2 performance on [Cybershoke](https://cybershoke.net/de/cs2) across sessions and over time. Deathmatch first (DM, Pistol DM, HS DM, AWP DM, Aim DM, MultiCFG DM); Retake, Retake Cards, Pistol Retake and Execute are recorded too.

It runs as a small always-on service: it watches your Cybershoke profile, follows you onto the server while you play, and shows each session and your long-term progress on a dashboard.

## How it works

Cybershoke has no public API. The tracker uses the two endpoints the website itself uses (details in [docs/cybershoke-api.md](docs/cybershoke-api.md)):

- **Your profile** (`/api/user/data`) has cumulative counters per mode: kills, headshots, damage, time played, per weapon (shots, hits, hit groups) and per map, plus kill streaks. These counters only change when you leave a server. The tracker checks the profile every minute (every 3 minutes after half an hour of inactivity) and stores a snapshot whenever something changed. The difference between two snapshots is what you played in between.
- **The live scoreboard** (`/api/servers/data`) of the server you're on. While the profile says you're in a tracked mode, the tracker reads that server's scoreboard every 20 seconds: kills, deaths, headshots, time on the server and rank points.

From that it builds:

- **Stints**: one continuous stay on one server, from the live samples.
- **Sessions**: stints and profile changes less than 30 minutes apart.
- **Session stats**: the profile difference once it's in (exact), or the live scoreboard while you're still playing (marked as live).

Cybershoke only reports deaths as an all-mode total. When you played more than one mode between two profile checks, the deaths are split by time played in each mode.

## Running it on the NAS

The image is built by GitHub Actions and published to `ghcr.io/shakerrdev/cyber-tracker` for amd64 and arm64.

1. Copy [docker-compose.yml](docker-compose.yml) to the NAS and set `STEAMID64`.
2. Start it with `docker compose up -d` (or create a project from the file in the NAS's Docker app).
3. Open `http://<nas-ip>:3000`.

If the repository is private, the image is too. Log in once with a GitHub token that has `read:packages`: `docker login ghcr.io -u shakerrdev`. Alternatively, build it on the NAS from a clone with `docker compose up -d --build`.

The database lives in the `data` volume (`/data/cyber-tracker.db`, SQLite). Back up that volume to keep your history.

It must run somewhere that can reach cybershoke.net, such as the home network. Keep your server visible in your Cybershoke privacy settings; with a hidden server the tracker still records sessions from your profile, but without live scoreboard data such as rank points and the kill curve.

### Settings

| Variable                    | Default                  | Meaning                                         |
| --------------------------- | ------------------------ | ----------------------------------------------- |
| `STEAMID64`                 | required                 | The player to track                             |
| `TZ`                        | `Europe/Berlin`          | Time zone for dates on the dashboard            |
| `DATA_DIR`                  | `/data` in the image     | Where the SQLite database goes                  |
| `PORT`                      | `3000`                   | HTTP port                                       |
| `PROFILE_INTERVAL_SEC`      | `60`                     | Profile check interval while active             |
| `IDLE_PROFILE_INTERVAL_SEC` | `180`                    | Profile check interval after 30 minutes offline |
| `LIVE_INTERVAL_SEC`         | `20`                     | Scoreboard check interval while in game         |
| `SESSION_GAP_MIN`           | `30`                     | A break this long starts a new session          |
| `TRACKER_ENABLED`           | `true`                   | Set to `false` to only serve the dashboard      |
| `CYBERSHOKE_BASE_URL`       | `https://cybershoke.net` | Point at the fake server for development        |

`GET /api/status` returns what the tracker is currently doing.

## Development

Requires Node 22.17 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

The sandbox and CI can't reach cybershoke.net, so there are two stand-ins:

- `npm run seed:demo` fills `DATA_DIR` with 60 days of simulated sessions (set `DATA_DIR=data-demo` and `TRACKER_ENABLED=false` to browse them).
- `npm run sim` starts a fake Cybershoke on port 8787 with a simulated player who joins DM servers, plays and leaves. Run the app with `CYBERSHOKE_BASE_URL=http://localhost:8787` to watch live tracking work.

```sh
npm test         # unit tests
npm run check    # type check
npm run build    # production build in build/
npm start        # run the production build
```
