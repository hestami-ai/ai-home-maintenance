// JAN-CAPBIND WP-1 — `grantedWithinRequest`, the §22.1 containment kernel, tested directly.
//
// The command-layer battery (`capbind-n4-grant-containment.test.ts`) is what proves the rule is ENFORCED — a pure
// predicate test is not enforcement, which is this repo's F-28. This file proves the predicate is CORRECT, and it
// exists because RW-6 shipped an extracted decision whose own cells were only ever reached through two callers that
// each exercised a subset — the coverage ratchet caught a cell neither could reach.
import { describe, expect, it } from 'vitest';
import { grantedWithinRequest } from './execution.js';

describe('grantedWithinRequest — §22.1 containment', () => {
	it('permits an EXACT match', () => {
		expect(grantedWithinRequest({ requested: ['file-system'], granted: ['file-system'] }).ok).toBe(
			true
		);
	});

	it('permits a NARROWER grant — RPH-EXE-004’s ratified example', () => {
		// "requests file-system and network access but only file-system is granted". Refusing this would strand
		// every least-privilege authorization and contradict the rule it claims to enforce.
		expect(
			grantedWithinRequest({ requested: ['file-system', 'network'], granted: ['file-system'] }).ok
		).toBe(true);
	});

	it('permits the EMPTY grant, and the empty-vs-empty case', () => {
		expect(grantedWithinRequest({ requested: ['file-system'], granted: [] }).ok).toBe(true);
		expect(grantedWithinRequest({ requested: [], granted: [] }).ok).toBe(true);
	});

	it('REFUSES any capability that was not requested, and names it', () => {
		const v = grantedWithinRequest({
			requested: ['file-system'],
			granted: ['file-system', 'network']
		});
		expect(v.ok).toBe(false);
		expect(v.errorCode).toBe('RPH_CAPABILITY_NOT_REQUESTED');
		expect(v.reason).toContain('network');
	});

	it('REFUSES a grant against an empty request — the sharpest form of the defect', () => {
		expect(grantedWithinRequest({ requested: [], granted: ['network'] }).ok).toBe(false);
	});

	it('names EVERY excess capability, not merely the first', () => {
		const v = grantedWithinRequest({ requested: [], granted: ['network', 'network'] });
		expect(v.reason).toContain('network');
		expect(v.reason).toContain('network');
	});

	it('IS NOT SYMMETRIC — swapping the operands changes the verdict', () => {
		// THE REASON THE PARAMETERS ARE NAMED. With `scope` deliberately unauthored, CapabilityRequest and
		// CapabilityGrant are structurally identical, so a positional signature could have its operands transposed
		// silently — inverting the rule into "requested is within granted", which permits exactly the privilege
		// expansion §22.1 forbids while still refusing something and therefore still looking like a working guard.
		const wide = ['file-system', 'network'];
		const narrow = ['file-system'];
		expect(grantedWithinRequest({ requested: wide, granted: narrow }).ok).toBe(true);
		expect(grantedWithinRequest({ requested: narrow, granted: wide }).ok).toBe(false);
	});

	it('treats duplicates as the set membership they are', () => {
		expect(
			grantedWithinRequest({ requested: ['file-system'], granted: ['file-system', 'file-system'] })
				.ok
		).toBe(true);
	});
});
