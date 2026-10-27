import { describe, expect, it, vi } from 'vitest';
import type { CybershokeClient } from './client.ts';
import type { RawProfile } from './types.ts';
import { createSharedClient } from './shared.ts';

function setup() {
	let clock = 0;
	const starts: number[] = [];
	const inner = {
		profile: vi.fn<CybershokeClient['profile']>(async (id) => {
			starts.push(clock);
			return { basic: { steamid64: id } } as RawProfile;
		}),
		server: vi.fn<CybershokeClient['server']>(async () => {
			starts.push(clock);
			return { playersv2: [] };
		})
	};
	const client = createSharedClient(inner, {
		minIntervalMs: 1000,
		serverCacheMs: 5000,
		now: () => clock,
		sleep: async (ms) => {
			clock += ms;
		}
	});
	return { inner, client, starts, advance: (ms: number) => (clock += ms) };
}

describe('createSharedClient', () => {
	it('spaces requests from all callers', async () => {
		const { client, starts } = setup();

		await Promise.all([client.profile('a'), client.profile('b'), client.profile('c')]);

		expect(starts).toEqual([0, 1000, 2000]);
	});

	it('serves one scoreboard to several players on the same server', async () => {
		const { inner, client, advance } = setup();

		await Promise.all([client.server('1.2.3.4', 27015), client.server('1.2.3.4', 27015)]);
		advance(2000);
		await client.server('1.2.3.4', 27015);
		expect(inner.server).toHaveBeenCalledTimes(1);

		advance(6000);
		await client.server('1.2.3.4', 27015);
		expect(inner.server).toHaveBeenCalledTimes(2);
	});

	it('keeps going after a failed request', async () => {
		const { inner, client } = setup();
		inner.profile.mockRejectedValueOnce(new Error('HTTP 500'));

		await expect(client.profile('a')).rejects.toThrow('HTTP 500');
		await expect(client.profile('b')).resolves.toMatchObject({ basic: { steamid64: 'b' } });
	});
});
