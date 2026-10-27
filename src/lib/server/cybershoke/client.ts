import type { RawProfile, RawServerData } from './types.ts';

export class CybershokeError extends Error {
	readonly status: number | null;
	readonly retryAfterSec: number | null;

	constructor(message: string, status: number | null = null, retryAfterSec: number | null = null) {
		super(message);
		this.name = 'CybershokeError';
		this.status = status;
		this.retryAfterSec = retryAfterSec;
	}

	get rateLimited(): boolean {
		return this.status === 429;
	}
}

export interface ClientOptions {
	baseUrl: string;
	timeoutMs?: number;
	fetch?: typeof fetch;
}

export interface CybershokeClient {
	profile(steamid64: string): Promise<RawProfile>;
	server(ip: string, port: number): Promise<RawServerData>;
}

function describeFetchError(error: unknown): string {
	const err = error as Error & { cause?: { code?: string; message?: string } };
	const detail = err.cause?.code ?? err.cause?.message;
	return detail ? `${err.message} (${detail})` : err.message;
}

const USER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36';

export function createClient({
	baseUrl,
	timeoutMs = 15_000,
	fetch: doFetch = fetch
}: ClientOptions): CybershokeClient {
	const origin = baseUrl.replace(/\/+$/, '');

	async function post<T>(path: string, body: string, contentType: string): Promise<T> {
		let response: Response;
		try {
			response = await doFetch(origin + path, {
				method: 'POST',
				body,
				headers: {
					'content-type': contentType,
					accept: 'application/json, text/plain, */*',
					'user-agent': USER_AGENT,
					origin,
					referer: origin + '/'
				},
				signal: AbortSignal.timeout(timeoutMs)
			});
		} catch (error) {
			throw new CybershokeError(`${path}: ${describeFetchError(error)}`);
		}

		if (!response.ok) {
			const retryAfter = Number(response.headers.get('retry-after'));
			throw new CybershokeError(
				`${path}: HTTP ${response.status}`,
				response.status,
				Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
			);
		}

		try {
			return (await response.json()) as T;
		} catch {
			throw new CybershokeError(`${path}: response is not JSON`, response.status);
		}
	}

	return {
		async profile(steamid64) {
			const profile = await post<RawProfile>(
				'/api/user/data',
				new URLSearchParams({ steamid64 }).toString(),
				'application/x-www-form-urlencoded'
			);
			if (!profile?.basic?.steamid64)
				throw new CybershokeError('/api/user/data: unexpected response');
			return profile;
		},
		server(ip, port) {
			return post<RawServerData>(
				'/api/servers/data',
				JSON.stringify({ ip, port }),
				'application/json'
			);
		}
	};
}
