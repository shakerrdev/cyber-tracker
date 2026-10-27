const LOCALE = 'en-GB';

const formatters = new Map<string, Intl.DateTimeFormat>();

function dtf(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const key = timeZone + JSON.stringify(options);
	let f = formatters.get(key);
	if (!f) {
		f = new Intl.DateTimeFormat(LOCALE, { timeZone, ...options });
		formatters.set(key, f);
	}
	return f;
}

export function formatDay(t: number, timeZone: string): string {
	return dtf(timeZone, { weekday: 'short', day: 'numeric', month: 'short' }).format(t * 1000);
}

export function formatShortDate(t: number, timeZone: string): string {
	return dtf(timeZone, { day: 'numeric', month: 'short' }).format(t * 1000);
}

export function formatClock(t: number, timeZone: string): string {
	return dtf(timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t * 1000);
}

export function formatDateTime(t: number, timeZone: string): string {
	return `${formatDay(t, timeZone)}, ${formatClock(t, timeZone)}`;
}

export function formatDuration(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatAgo(t: number, now: number): string {
	const diff = Math.max(0, now - t);
	if (diff < 90) return 'just now';
	if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
	if (diff < 86_400) return `${Math.round(diff / 3600)} h ago`;
	const days = Math.round(diff / 86_400);
	return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function fmt(value: number | null | undefined, digits = 0): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '–';
	return value.toLocaleString(LOCALE, {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
}

export function pct(value: number | null | undefined, digits = 0): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '–';
	return `${fmt(value * 100, digits)}%`;
}

export function signed(value: number | null | undefined, digits = 0): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return '–';
	const s = fmt(Math.abs(value), digits);
	if (s === fmt(0, digits)) return s;
	return value > 0 ? `+${s}` : `−${s}`;
}

const WEAPON_NAMES: Record<string, string> = {
	ak47: 'AK-47',
	m4a1: 'M4A4',
	m4a1_silencer: 'M4A1-S',
	awp: 'AWP',
	ssg08: 'SSG 08',
	deagle: 'Desert Eagle',
	revolver: 'R8 Revolver',
	usp_silencer: 'USP-S',
	hkp2000: 'P2000',
	glock: 'Glock-18',
	p250: 'P250',
	tec9: 'Tec-9',
	fiveseven: 'Five-SeveN',
	cz75a: 'CZ75-Auto',
	elite: 'Dual Berettas',
	galilar: 'Galil AR',
	famas: 'FAMAS',
	aug: 'AUG',
	sg556: 'SG 553',
	scar20: 'SCAR-20',
	g3sg1: 'G3SG1',
	mp9: 'MP9',
	mac10: 'MAC-10',
	mp7: 'MP7',
	mp5sd: 'MP5-SD',
	ump45: 'UMP-45',
	p90: 'P90',
	bizon: 'PP-Bizon',
	nova: 'Nova',
	xm1014: 'XM1014',
	mag7: 'MAG-7',
	sawedoff: 'Sawed-Off',
	negev: 'Negev',
	m249: 'M249',
	knife: 'Knife',
	taser: 'Zeus x27',
	hegrenade: 'HE grenade',
	inferno: 'Fire',
	molotov: 'Molotov',
	incgrenade: 'Incendiary'
};

export function weaponName(key: string): string {
	return WEAPON_NAMES[key] ?? key.replace(/_/g, ' ');
}

export function mapName(key: string): string {
	const fps = key.endsWith('_fps');
	const base = key
		.replace(/_fps$/, '')
		.replace(/^(de|cs|am|aim|awp|dm)_/, '')
		.replace(/_/g, ' ');
	const name = base.charAt(0).toUpperCase() + base.slice(1);
	return fps ? `${name} (FPS)` : name;
}
