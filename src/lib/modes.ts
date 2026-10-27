export type ModeGroup = 'dm' | 'retake' | 'execute';

export interface Mode {
	id: number;
	key: string;
	slug: string;
	label: string;
	group: ModeGroup;
}

export const ALL_MODES_ID = 0;

export const MODES: readonly Mode[] = [
	{ id: 11, key: 'DM', slug: 'dm', label: 'DM', group: 'dm' },
	{ id: 22, key: 'PISTOLDM', slug: 'pistoldm', label: 'Pistol DM', group: 'dm' },
	{ id: 15, key: 'HSDM', slug: 'hsdm', label: 'HS DM', group: 'dm' },
	{ id: 5, key: 'AWPDM', slug: 'awpdm', label: 'AWP DM', group: 'dm' },
	{ id: 1, key: 'AIMDM', slug: 'aimdm', label: 'Aim DM', group: 'dm' },
	{ id: 21, key: 'MULTICFGDM', slug: 'multicfgdm', label: 'MultiCFG DM', group: 'dm' },
	{ id: 29, key: 'RETAKE', slug: 'retake', label: 'Retake', group: 'retake' },
	{ id: 28, key: 'RETAKECARDS', slug: 'retakecards', label: 'Retake Cards', group: 'retake' },
	{ id: 23, key: 'PISTOLRETAKE', slug: 'pistolretake', label: 'Pistol Retake', group: 'retake' },
	{ id: 13, key: 'EXECUTE', slug: 'execute', label: 'Execute', group: 'execute' }
];

export const GROUP_LABELS: Record<ModeGroup, string> = {
	dm: 'All DM',
	retake: 'All Retake',
	execute: 'Execute'
};

export const TRACKED_MODE_IDS: readonly number[] = MODES.map((m) => m.id);

const byId = new Map(MODES.map((m) => [m.id, m]));
const byKey = new Map(MODES.map((m) => [m.key, m]));
const bySlug = new Map(MODES.map((m) => [m.slug, m]));

export function modeById(id: number): Mode | undefined {
	return byId.get(id);
}

export function modeByKey(key: string | null | undefined): Mode | undefined {
	if (!key) return undefined;
	return byKey.get(key.replace(/[\s_-]+/g, '').toUpperCase());
}

export function modeBySlug(slug: string): Mode | undefined {
	return bySlug.get(slug);
}

export function modeLabel(id: number): string {
	return byId.get(id)?.label ?? `Mode ${id}`;
}

export type ModeFilter = { kind: 'group'; group: ModeGroup } | { kind: 'mode'; mode: Mode };

const GROUP_SLUGS: Record<string, ModeGroup> = { 'all-dm': 'dm', 'all-retake': 'retake' };

export function parseModeFilter(value: string | null | undefined): ModeFilter {
	if (value && GROUP_SLUGS[value]) return { kind: 'group', group: GROUP_SLUGS[value] };
	const mode = value ? bySlug.get(value) : undefined;
	if (mode) return { kind: 'mode', mode };
	return { kind: 'group', group: 'dm' };
}

export function filterSlug(filter: ModeFilter): string {
	return filter.kind === 'group' ? `all-${filter.group}` : filter.mode.slug;
}

export const FILTER_OPTIONS: readonly { slug: string; label: string; group: ModeGroup }[] = [
	{ slug: 'all-dm', label: GROUP_LABELS.dm, group: 'dm' },
	...MODES.filter((m) => m.group === 'dm').map((m) => ({
		slug: m.slug,
		label: m.label,
		group: m.group
	})),
	{ slug: 'all-retake', label: GROUP_LABELS.retake, group: 'retake' },
	...MODES.filter((m) => m.group !== 'dm').map((m) => ({
		slug: m.slug,
		label: m.label,
		group: m.group
	}))
];

export function filterLabel(filter: ModeFilter): string {
	return filter.kind === 'group' ? GROUP_LABELS[filter.group] : filter.mode.label;
}

export function filterModeIds(filter: ModeFilter): number[] {
	if (filter.kind === 'mode') return [filter.mode.id];
	return MODES.filter((m) => m.group === filter.group).map((m) => m.id);
}
