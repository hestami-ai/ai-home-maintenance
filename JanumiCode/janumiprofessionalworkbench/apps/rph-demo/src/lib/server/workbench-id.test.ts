import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadWorkbench(mode: 'production' | 'test') {
	vi.resetModules();
	vi.stubEnv('RPH_DEMO_MODE', mode === 'test' ? 'test' : '');
	return import('./workbench.js');
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe('mintUiId', () => {
	it('mints unique, ordered, structurally valid production ids during a frozen-time burst', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
		const { mintUiId } = await loadWorkbench('production');

		const ids = Array.from({ length: 128 }, () => mintUiId('pwut'));

		expect(new Set(ids).size).toBe(ids.length);
		expect([...ids].sort()).toEqual(ids);
		for (const id of ids) expect(id).toMatch(/^pwut_[0-9A-HJKMNP-TV-Z]{26}$/);
	});

	it('retains the deterministic padded base32 sequence in test mode', async () => {
		const { mintUiId } = await loadWorkbench('test');

		expect(mintUiId('pwut')).toBe('pwut_00000000000000000000000001');
		expect(mintUiId('pwut')).toBe('pwut_00000000000000000000000002');
	});
});
