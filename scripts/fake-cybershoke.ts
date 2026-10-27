import { createServer, type IncomingMessage } from 'node:http';
import { DEFAULT_AVATAR, SimPlayer } from '../src/lib/server/demo/sim.ts';

const port = Number(process.env.FAKE_PORT ?? 8787);
const ids = (process.env.STEAMID64 ?? '76561198056395137').split(/[\s,]+/).filter(Boolean);
const offlineSec = Number(process.env.FAKE_OFFLINE_SEC ?? 90);
const stintSec = Number(process.env.FAKE_STINT_SEC ?? 300);
const modes = (process.env.FAKE_MODES ?? '11,11,11,15,22').split(',').map(Number);

const now = () => Math.floor(Date.now() / 1000);
const pick = () => modes[Math.floor(Math.random() * modes.length)];

class Sim {
	player: SimPlayer;
	phaseEndsAt: number;
	stintsLeft = 0;

	constructor(steamid64: string, index: number) {
		this.player = new SimPlayer({
			steamid64,
			name: index === 0 ? 'shaker (sim)' : `friend ${index} (sim)`,
			avatar:
				index === 0
					? DEFAULT_AVATAR
					: DEFAULT_AVATAR.replace('fef49e', `${index}`.padStart(6, '0')),
			seed: (Date.now() + index * 7919) % 100_000
		});
		this.phaseEndsAt = now() + 10 + index * 20;
	}

	step() {
		const t = now();
		if (t < this.phaseEndsAt) return;
		const tag = `[sim ${this.player.name}]`;
		if (this.player.inGame) {
			this.player.leave(t);
			console.log(`${tag} left the server`);
			if (this.stintsLeft > 0) {
				this.stintsLeft--;
				const mode = pick();
				this.player.join(mode, t);
				console.log(`${tag} switched to mode ${mode}`);
				this.phaseEndsAt = t + stintSec;
			} else {
				this.phaseEndsAt = t + offlineSec;
			}
		} else {
			this.stintsLeft = Math.floor(Math.random() * 3);
			const mode = pick();
			this.player.join(mode, t);
			console.log(`${tag} joined mode ${mode} for ${stintSec}s (${this.stintsLeft} more stints)`);
			this.phaseEndsAt = t + stintSec;
		}
	}
}

const sims = new Map(ids.map((id, i) => [id, new Sim(id, i)]));

async function body(req: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

createServer(async (req, res) => {
	for (const sim of sims.values()) sim.step();
	const send = (status: number, data: unknown) => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify(data));
	};
	try {
		if (req.method === 'POST' && req.url === '/api/user/data') {
			const id = new URLSearchParams(await body(req)).get('steamid64') ?? '';
			const sim = sims.get(id);
			if (!sim) return send(404, { result: 'error' });
			return send(200, sim.player.profile(now()));
		}
		if (req.method === 'POST' && req.url === '/api/servers/data') {
			const { ip, port: serverPort } = JSON.parse(await body(req)) as { ip: string; port: number };
			for (const sim of sims.values()) {
				const data = sim.player.server(ip, serverPort, now());
				if (data.playersv2?.length) return send(200, data);
			}
			return send(200, { serversv2: {}, playersv2: [] });
		}
		send(404, { result: 'error' });
	} catch (error) {
		send(500, { result: 'error', text: String(error) });
	}
}).listen(port, () => {
	console.log(`[sim] fake cybershoke on http://localhost:${port} for ${ids.join(', ')}`);
});
