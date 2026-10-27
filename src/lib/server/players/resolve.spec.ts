import { describe, expect, it, vi } from 'vitest';
import { resolveSteamId } from './resolve.ts';

const ME = '76561198056395137';

describe('resolveSteamId', () => {
	it('accepts ids and links that contain the id', async () => {
		const getText = vi.fn();
		for (const input of [
			ME,
			` ${ME} `,
			`https://steamcommunity.com/profiles/${ME}/`,
			`https://cybershoke.net/de/profile/${ME}`,
			`https://cloud.cybershoke.net/img/profile/${ME}.png`
		]) {
			await expect(resolveSteamId(input, getText)).resolves.toBe(ME);
		}
		expect(getText).not.toHaveBeenCalled();
	});

	it('looks up Steam custom URLs and bare names', async () => {
		const getText = vi.fn(async () => `<profile><steamID64>${ME}</steamID64></profile>`);

		await expect(
			resolveSteamId('https://steamcommunity.com/id/cantremovethis/', getText)
		).resolves.toBe(ME);
		await expect(resolveSteamId('cantremovethis', getText)).resolves.toBe(ME);
		expect(getText).toHaveBeenCalledWith('https://steamcommunity.com/id/cantremovethis/?xml=1');
	});

	it('explains what went wrong', async () => {
		const missing = vi.fn(
			async () => '<response><error>The specified profile could not be found.</error></response>'
		);
		await expect(resolveSteamId('nobody_here', missing)).rejects.toThrow(
			'No Steam profile is called "nobody_here"'
		);
		await expect(resolveSteamId('https://cybershoke.net/de/id/shaker', missing)).rejects.toThrow(
			"Cybershoke /id/ links don't contain the SteamID"
		);
		await expect(resolveSteamId('what is this?', missing)).rejects.toThrow('Paste a SteamID64');
		await expect(
			resolveSteamId('someone', vi.fn().mockRejectedValue(new Error('HTTP 503')))
		).rejects.toThrow('(HTTP 503)');
	});
});
