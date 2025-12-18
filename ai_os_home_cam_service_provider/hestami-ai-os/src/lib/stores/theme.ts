import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'hestami-theme';

function getInitialTheme(): Theme {
	if (browser) {
		// Check our primary key first
		const stored = localStorage.getItem(THEME_KEY);
		if (stored === 'light' || stored === 'dark') {
			return stored;
		}
		// Check legacy darkMode key for compatibility with app.html script
		const darkMode = localStorage.getItem('darkMode');
		if (darkMode === 'true') {
			return 'dark';
		}
		if (darkMode === 'false') {
			return 'light';
		}
		// Check data-mode attribute (set by app.html script)
		const dataMode = document.documentElement.getAttribute('data-mode');
		if (dataMode === 'dark' || dataMode === 'light') {
			return dataMode;
		}
		// Check system preference
		if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
	}
	return 'light';
}

function applyTheme(value: Theme) {
	if (browser) {
		localStorage.setItem(THEME_KEY, value);
		// Also save as 'darkMode' for compatibility with app.html script
		localStorage.setItem('darkMode', (value === 'dark').toString());
		// Update classes
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add(value);
		// Update data-mode attribute for Skeleton/Tailwind dark variant
		document.documentElement.setAttribute('data-mode', value);
	}
}

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>(getInitialTheme());

	return {
		subscribe,
		set: (value: Theme) => {
			applyTheme(value);
			set(value);
		},
		toggle: () => {
			update((current) => {
				const next = current === 'light' ? 'dark' : 'light';
				applyTheme(next);
				return next;
			});
		},
		init: () => {
			if (browser) {
				const theme = getInitialTheme();
				applyTheme(theme);
				set(theme);
			}
		}
	};
}

export const theme = createThemeStore();
