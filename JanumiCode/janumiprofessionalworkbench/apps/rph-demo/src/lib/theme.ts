import type { Writable } from 'svelte/store';

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'jpwb-color-theme';
export const THEME_CONTEXT = Symbol('jpwb-color-theme');

export const THEME_META_COLORS: Readonly<Record<Theme, string>> = {
	dark: '#131313',
	light: '#f0ecdf'
};

export interface ThemeContext {
	readonly theme: Writable<Theme>;
	setTheme(theme: Theme, persist?: boolean): void;
	toggleTheme(): void;
}

export function parseTheme(value: unknown): Theme | null {
	return value === 'dark' || value === 'light' ? value : null;
}

export function nextTheme(theme: Theme): Theme {
	return theme === 'dark' ? 'light' : 'dark';
}

export function documentTheme(): Theme {
	if (typeof document === 'undefined') return 'dark';
	return parseTheme(document.documentElement.dataset.theme) ?? 'dark';
}

export function applyTheme(theme: Theme): void {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.dataset.theme = theme;
	root.style.colorScheme = theme;
	document
		.querySelector<HTMLMetaElement>('meta[data-jpwb-theme-color]')
		?.setAttribute('content', THEME_META_COLORS[theme]);
}

export function persistTheme(theme: Theme): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// A private or storage-restricted browser can still use the theme for the current page.
	}
}
