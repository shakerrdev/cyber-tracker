import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Config {
	initialPlayers: string[];
	dataDir: string;
	baseUrl: string;
	trackerEnabled: boolean;
	profileIntervalSec: number;
	idleProfileIntervalSec: number;
	liveIntervalSec: number;
	sessionGapMin: number;
	timeZone: string;
}

let envLoaded = false;

function loadEnvFile() {
	if (envLoaded) return;
	envLoaded = true;
	if (existsSync('.env')) process.loadEnvFile('.env');
}

function int(name: string, fallback: number, min: number): number {
	const raw = process.env[name];
	if (raw === undefined || raw === '') return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < min) {
		throw new Error(`${name} must be an integer >= ${min}, got "${raw}"`);
	}
	return value;
}

function bool(name: string, fallback: boolean): boolean {
	const raw = process.env[name]?.toLowerCase();
	if (raw === undefined || raw === '') return fallback;
	return !['0', 'false', 'no', 'off'].includes(raw);
}

export function readConfig(): Config {
	loadEnvFile();
	const initialPlayers = (process.env.STEAMID64 ?? '').split(/[\s,]+/).filter(Boolean);
	for (const id of initialPlayers) {
		if (!/^7656\d{13}$/.test(id)) {
			throw new Error(`STEAMID64 must list SteamID64s like 76561198056395137, got "${id}"`);
		}
	}
	return {
		initialPlayers,
		dataDir: resolve(process.env.DATA_DIR || 'data'),
		baseUrl: process.env.CYBERSHOKE_BASE_URL || 'https://cybershoke.net',
		trackerEnabled: bool('TRACKER_ENABLED', true),
		profileIntervalSec: int('PROFILE_INTERVAL_SEC', 60, 15),
		idleProfileIntervalSec: int('IDLE_PROFILE_INTERVAL_SEC', 120, 15),
		liveIntervalSec: int('LIVE_INTERVAL_SEC', 20, 5),
		sessionGapMin: int('SESSION_GAP_MIN', 30, 1),
		timeZone: process.env.TZ || 'Europe/Berlin'
	};
}

let cached: Config | undefined;

export function config(): Config {
	cached ??= readConfig();
	return cached;
}
