export class PlayerInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PlayerInputError';
	}
}

const STEAMID64 = /^7656\d{13}$/;

export type FetchText = (url: string) => Promise<string>;

const fetchText: FetchText = async (url) => {
	const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.text();
};

export function steamIdFromText(input: string): string | null {
	const text = input.trim();
	if (STEAMID64.test(text)) return text;
	const match = text.match(/(?:\/profiles\/|\/profile\/|steamid64=)(7656\d{13})(?!\d)/);
	return match?.[1] ?? null;
}

export function vanityFromText(input: string): string | null {
	const text = input.trim();
	const url = text.match(/steamcommunity\.com\/id\/([^/?#\s]+)/i);
	if (url) return decodeURIComponent(url[1]);
	if (/^[A-Za-z0-9_-]{2,32}$/.test(text)) return text;
	return null;
}

export async function resolveSteamId(
	input: string,
	getText: FetchText = fetchText
): Promise<string> {
	const direct = steamIdFromText(input);
	if (direct) return direct;

	if (/cybershoke\.net\/\w+\/id\//i.test(input)) {
		throw new PlayerInputError(
			"Cybershoke /id/ links don't contain the SteamID. Paste the player's Steam profile link instead."
		);
	}

	const vanity = vanityFromText(input);
	if (!vanity) {
		throw new PlayerInputError(
			'Paste a SteamID64, a Steam profile link or a Cybershoke profile link.'
		);
	}

	let xml: string;
	try {
		xml = await getText(`https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`);
	} catch (error) {
		throw new PlayerInputError(
			`Couldn't look up the Steam name "${vanity}" (${(error as Error).message}). Paste the SteamID64 instead.`
		);
	}
	const id = xml.match(/<steamID64>(7656\d{13})<\/steamID64>/)?.[1];
	if (!id) throw new PlayerInputError(`No Steam profile is called "${vanity}".`);
	return id;
}
