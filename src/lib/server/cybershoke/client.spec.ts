import { describe, expect, it, vi } from 'vitest';
import { createClient, CybershokeError } from './client.ts';
import offline from './fixtures/profile-offline.json' with { type: 'json' };

function mockFetch(response: Response) {
	return vi.fn<typeof fetch>().mockResolvedValue(response);
}

describe('createClient', () => {
	it('posts the steamid64 as a form body', async () => {
		const fetchMock = mockFetch(Response.json(offline));
		const client = createClient({ baseUrl: 'https://cybershoke.net/', fetch: fetchMock });

		const profile = await client.profile('76561198056395137');

		expect(profile.basic.name).toBe('shaker');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://cybershoke.net/api/user/data');
		expect(init?.body).toBe('steamid64=76561198056395137');
		expect((init?.headers as Record<string, string>)['content-type']).toBe(
			'application/x-www-form-urlencoded'
		);
	});

	it('posts the server address as json', async () => {
		const fetchMock = mockFetch(Response.json({ serversv2: {}, playersv2: [] }));
		const client = createClient({ baseUrl: 'http://localhost:8787', fetch: fetchMock });

		await client.server('162.55.2.53', 27034);

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('http://localhost:8787/api/servers/data');
		expect(JSON.parse(String(init?.body))).toEqual({ ip: '162.55.2.53', port: 27034 });
	});

	it('reports rate limiting with retry-after', async () => {
		const client = createClient({
			baseUrl: 'https://cybershoke.net',
			fetch: mockFetch(new Response('slow down', { status: 429, headers: { 'retry-after': '30' } }))
		});

		const error = await client.profile('1').catch((e: unknown) => e);

		expect(error).toBeInstanceOf(CybershokeError);
		expect((error as CybershokeError).rateLimited).toBe(true);
		expect((error as CybershokeError).retryAfterSec).toBe(30);
	});

	it('rejects responses without a profile', async () => {
		const client = createClient({
			baseUrl: 'https://cybershoke.net',
			fetch: mockFetch(Response.json({}))
		});

		await expect(client.profile('1')).rejects.toThrow('unexpected response');
	});

	it('wraps network failures', async () => {
		const client = createClient({
			baseUrl: 'https://cybershoke.net',
			fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('ECONNRESET'))
		});

		await expect(client.server('1.2.3.4', 1)).rejects.toThrow('/api/servers/data: ECONNRESET');
	});
});
