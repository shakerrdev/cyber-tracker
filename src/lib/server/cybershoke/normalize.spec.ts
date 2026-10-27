import { describe, expect, it } from 'vitest';
import { TRACKED_MODE_IDS } from '#lib/modes.ts';
import {
	avatarHash,
	extractLiveSample,
	extractPlayer,
	extractPresence,
	extractStats,
	isTrackedPresence
} from './normalize.ts';
import type { RawProfile, RawServerData } from './types.ts';
import offline from './fixtures/profile-offline.json' with { type: 'json' };
import inGame from './fixtures/profile-in-game.json' with { type: 'json' };
import hidden from './fixtures/profile-hidden.json' with { type: 'json' };
import serverDm from './fixtures/server-dm.json' with { type: 'json' };

const offlineProfile = offline as unknown as RawProfile;
const inGameProfile = inGame as unknown as RawProfile;
const hiddenProfile = hidden as unknown as RawProfile;
const server = serverDm as unknown as RawServerData;

describe('extractStats', () => {
	const stats = extractStats(offlineProfile, TRACKED_MODE_IDS);

	it('keeps only tracked modes', () => {
		expect(Object.keys(stats.modes).sort()).toEqual(['11', '15', '29']);
	});

	it('maps general counters and parses string numbers', () => {
		expect(stats.modes['11'].general).toEqual({
			kills: 44430,
			headshots: 29231,
			damage: 5961524,
			playtime: 481805,
			roundsCt: 7,
			roundsT: 27,
			bombDefused: 0,
			bombPlanted: 0
		});
		expect(stats.global).toEqual({
			kills: 61726,
			deaths: 54890,
			shots: 632647,
			hits: 161980,
			headshots: 42343,
			playtime: 896129
		});
		expect(stats.allModesPlaytime).toBe(896129);
	});

	it('strips the weapon prefix and renames hitgroups', () => {
		const ak = stats.modes['11'].weapons.ak47;
		expect(ak.shots).toBe(368798);
		expect(ak.hitsNeck).toBe(594);
		expect(ak.hitsStomach).toBe(11711);
		expect(ak.ttkSumMs).toBe(102818);
		expect(Object.keys(stats.modes['11'].weapons)).toEqual(['ak47', 'deagle']);
	});

	it('handles empty arrays and drops zero clutch buckets', () => {
		expect(stats.modes['29'].weapons).toEqual({});
		expect(stats.modes['29'].clutches).toEqual({ '2': 112, '3': 18, '4': 2 });
		expect(stats.modes['11'].killstreaks['31']).toBe(2);
	});

	it('falls back to global playtime without mode 0', () => {
		expect(extractStats(inGameProfile, TRACKED_MODE_IDS).allModesPlaytime).toBe(756979);
	});
});

describe('extractPlayer', () => {
	it('reads identity, faceit and last seen', () => {
		expect(extractPlayer(offlineProfile)).toEqual({
			steamid64: '76561198056395137',
			name: 'shaker',
			avatar: 'https://avatars.steamstatic.com/f902ed188cadb9e5f8e9dd1b591f7c6421065484_full.jpg',
			avatarHash: 'f902ed188cadb9e5f8e9dd1b591f7c6421065484',
			country: 'de',
			faceitElo: 1773,
			faceitLevel: 9,
			globalPlace: 69534,
			lastSeen: 1793135349
		});
	});
});

describe('extractPresence', () => {
	it('is offline for an empty server object', () => {
		expect(extractPresence(offlineProfile)).toEqual({ kind: 'offline' });
	});

	it('returns the server address while in game', () => {
		const presence = extractPresence(inGameProfile);
		expect(presence).toEqual({
			kind: 'server',
			ip: '162.55.2.53',
			port: 27034,
			num: 102,
			map: 'de_mirage',
			modeKey: 'DM',
			category: '16 SLOTS'
		});
		expect(isTrackedPresence(presence, TRACKED_MODE_IDS)).toBe(true);
		expect(isTrackedPresence(presence, [29])).toBe(false);
	});

	it('detects a hidden server', () => {
		expect(extractPresence(hiddenProfile)).toEqual({ kind: 'hidden', map: 'duels_nuke_1x1' });
	});
});

describe('extractLiveSample', () => {
	const fallback = { ip: '51.68.170.196', port: 28024 };

	it('finds the player by avatar hash', () => {
		const sample = extractLiveSample(
			server,
			{ avatarHash: 'b284d5767324e835e8f40737143441acdabb0cbe', name: 'renamed' },
			fallback,
			1000
		);
		expect(sample).toEqual({
			takenAt: 1000,
			serverId: 8928,
			serverIp: '51.68.170.196',
			serverPort: 28024,
			serverNum: 373,
			modeId: 11,
			map: 'de_mirage',
			kills: 63,
			deaths: 28,
			headshots: 51,
			seconds: 607,
			points: 8240,
			rank: 14,
			ttkMs: 894
		});
	});

	it('falls back to the name and keeps null ttk', () => {
		const sample = extractLiveSample(
			server,
			{ avatarHash: null, name: '[RAGE] Zensy' },
			fallback,
			1
		);
		expect(sample?.kills).toBe(0);
		expect(sample?.ttkMs).toBeNull();
	});

	it('uses the name to pick between players with the same avatar', () => {
		const twins = {
			...server,
			playersv2: [
				{ ...server.playersv2![1], name: 'friend', kills: 1 },
				{ ...server.playersv2![1], name: 'me', kills: 2 }
			]
		};
		const target = { avatarHash: 'b284d5767324e835e8f40737143441acdabb0cbe', name: 'me' };
		expect(extractLiveSample(twins, target, fallback, 1)?.kills).toBe(2);
		expect(extractLiveSample(twins, { ...target, name: 'renamed' }, fallback, 1)).toBeNull();
	});

	it('returns null when the player is not on the server', () => {
		expect(
			extractLiveSample(server, { avatarHash: 'f'.repeat(40), name: 'nobody' }, fallback, 1)
		).toBeNull();
	});
});

describe('avatarHash', () => {
	it('extracts the 40 hex chars', () => {
		expect(
			avatarHash(
				'https://avatars.steamstatic.com/A5F1befcb9aa4e4dc5832123db7bff6f3d358e0a_full.jpg'
			)
		).toBe('a5f1befcb9aa4e4dc5832123db7bff6f3d358e0a');
		expect(avatarHash('https://example.com/x.png')).toBeNull();
	});
});
