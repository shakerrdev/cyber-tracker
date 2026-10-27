import type { CybershokeClient } from './client.ts';
import type { RawServerData } from './types.ts';

export interface SharedClientOptions {
	minIntervalMs?: number;
	serverCacheMs?: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}

export function createSharedClient(
	inner: CybershokeClient,
	{
		minIntervalMs = 1500,
		serverCacheMs = 5000,
		now = () => Date.now(),
		sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
	}: SharedClientOptions = {}
): CybershokeClient {
	let queue: Promise<unknown> = Promise.resolve();
	let lastStart = -Infinity;
	const servers = new Map<string, { at: number; result: Promise<RawServerData> }>();

	function schedule<T>(task: () => Promise<T>): Promise<T> {
		const run = queue.then(async () => {
			const wait = lastStart + minIntervalMs - now();
			if (wait > 0) await sleep(wait);
			lastStart = now();
			return task();
		});
		queue = run.catch(() => undefined);
		return run;
	}

	return {
		profile: (steamid64) => schedule(() => inner.profile(steamid64)),
		server(ip, port) {
			const key = `${ip}:${port}`;
			const cached = servers.get(key);
			if (cached && now() - cached.at < serverCacheMs) return cached.result;
			const result = schedule(() => inner.server(ip, port));
			servers.set(key, { at: now(), result });
			result.catch(() => servers.delete(key));
			for (const [k, v] of servers) if (now() - v.at >= serverCacheMs) servers.delete(k);
			return result;
		}
	};
}
