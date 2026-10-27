import { createServer, type IncomingMessage } from 'node:http';
import { SimPlayer } from './sim/player.ts';

const port = Number(process.env.FAKE_PORT ?? 8787);
const steamid64 = process.env.STEAMID64 ?? '76561198056395137';
const offlineSec = Number(process.env.FAKE_OFFLINE_SEC ?? 90);
const stintSec = Number(process.env.FAKE_STINT_SEC ?? 300);
const modes = (process.env.FAKE_MODES ?? '11,11,11,15,22').split(',').map(Number);

const player = new SimPlayer({ steamid64, name: 'shaker (sim)', seed: Date.now() % 100_000 });
const now = () => Math.floor(Date.now() / 1000);

let phaseEndsAt = now() + 10;
let stintsLeft = 0;

function step() {
	const t = now();
	if (t < phaseEndsAt) return;
	if (player.inGame) {
		player.leave(t);
		console.log(`[sim] left the server`);
		if (stintsLeft > 0) {
			stintsLeft--;
			const mode = modes[Math.floor(Math.random() * modes.length)];
			player.join(mode, t);
			console.log(`[sim] switched to mode ${mode}`);
			phaseEndsAt = t + stintSec;
		} else {
			phaseEndsAt = t + offlineSec;
		}
	} else {
		stintsLeft = Math.floor(Math.random() * 3);
		const mode = modes[Math.floor(Math.random() * modes.length)];
		player.join(mode, t);
		console.log(`[sim] joined mode ${mode} for ${stintSec}s (${stintsLeft} more stints)`);
		phaseEndsAt = t + stintSec;
	}
}

async function body(req: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}

createServer(async (req, res) => {
	step();
	const send = (status: number, data: unknown) => {
		res.writeHead(status, { 'content-type': 'application/json' });
		res.end(JSON.stringify(data));
	};
	try {
		if (req.method === 'POST' && req.url === '/api/user/data') {
			const id = new URLSearchParams(await body(req)).get('steamid64');
			if (id !== steamid64) return send(404, { result: 'error' });
			return send(200, player.profile(now()));
		}
		if (req.method === 'POST' && req.url === '/api/servers/data') {
			const { ip, port: serverPort } = JSON.parse(await body(req)) as { ip: string; port: number };
			return send(200, player.server(ip, serverPort, now()));
		}
		send(404, { result: 'error' });
	} catch (error) {
		send(500, { result: 'error', text: String(error) });
	}
}).listen(port, () => {
	console.log(`[sim] fake cybershoke on http://localhost:${port} for ${steamid64}`);
});
