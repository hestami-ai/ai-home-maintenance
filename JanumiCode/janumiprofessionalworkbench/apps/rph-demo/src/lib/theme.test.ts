import { describe, expect, it } from 'vitest';
import { nextTheme, parseTheme, THEME_META_COLORS, THEME_STORAGE_KEY } from './theme.js';

describe('color theme contract', () => {
	it('accepts only the two explicit color modes', () => {
		expect(parseTheme('dark')).toBe('dark');
		expect(parseTheme('light')).toBe('light');
		expect(parseTheme('system')).toBeNull();
		expect(parseTheme('')).toBeNull();
		expect(parseTheme(null)).toBeNull();
	});

	it('toggles deterministically', () => {
		expect(nextTheme('dark')).toBe('light');
		expect(nextTheme('light')).toBe('dark');
	});

	it('keeps stable storage and browser-chrome values', () => {
		expect(THEME_STORAGE_KEY).toBe('jpwb-color-theme');
		expect(THEME_META_COLORS).toEqual({ dark: '#131313', light: '#f0ecdf' });
	});
});
