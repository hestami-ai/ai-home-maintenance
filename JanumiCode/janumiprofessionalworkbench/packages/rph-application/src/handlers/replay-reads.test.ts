// ── WHAT A REPLAY READS BY ID — ONE DEFINITION EACH (`JAN-CRITREAD` `DD-3`, `REG-D-070` §5.1 pins 3 and 4) ─────────────
//
// An authoring turn must pin exactly what its replay reads: the policies each command NEWLY references against its
// own prior state, and the validator a recorded review names. The handlers read them through these functions, and so
// does the turn, so the two cannot drift apart. Each case isolates one term of each definition.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import { newlyReferencedAssurancePolicyIds, validatorNamedBy } from '../index.js';

const required = (...ids: string[]) => ({ requiredAssurancePolicyIds: ids });
const attested = (...ids: string[]) => ({ boundaryContract: { attestedAssurancePolicyIds: ids } });
const flat = (
	next: Record<string, unknown> | undefined,
	prior: Record<string, unknown> | undefined
) =>
	newlyReferencedAssurancePolicyIds(next, prior).map(({ field, policyIds }) => [
		field,
		[...policyIds]
	]);

describe('newlyReferencedAssurancePolicyIds — what a write newly references', () => {
	it('R-1 — a birth newly references everything it declares, in each field, in order', () => {
		expect(flat({ ...required('a', 'b'), ...attested('c') }, undefined)).toEqual([
			['requiredAssurancePolicyIds', ['a', 'b']],
			['attestedAssurancePolicyIds', ['c']]
		]);
	});

	it('R-2 — a retained declaration is NOT newly referenced; an added one is', () => {
		expect(flat(required('a', 'b'), required('a'))).toEqual([
			['requiredAssurancePolicyIds', ['b']],
			['attestedAssurancePolicyIds', []]
		]);
	});

	it('R-3 — the attested field is read through the boundary contract, and retained there too', () => {
		expect(flat(attested('c', 'd'), attested('c'))).toEqual([
			['requiredAssurancePolicyIds', []],
			['attestedAssurancePolicyIds', ['d']]
		]);
	});

	it('R-4 — "newly" is against THIS write’s prior state: a policy removed and re-added is newly referenced again', () => {
		const base = required('a');
		const removed = required();
		expect(flat(removed, base), 'the removal references nothing new').toEqual([
			['requiredAssurancePolicyIds', []],
			['attestedAssurancePolicyIds', []]
		]);
		expect(flat(base, removed), 'the re-add newly references it').toEqual([
			['requiredAssurancePolicyIds', ['a']],
			['attestedAssurancePolicyIds', []]
		]);
	});
});

describe('validatorNamedBy — the validator a result names', () => {
	const withPayload = (payload: unknown) => ({ payload }) as DomainCommand;

	it('V-1 — the id a validatorResult names, and nothing when none is named or it is not a string', () => {
		expect(validatorNamedBy(withPayload({ validatorResult: { validatorId: 'val_1' } }))).toBe(
			'val_1'
		);
		expect(validatorNamedBy(withPayload({ validatorResult: {} }))).toBeUndefined();
		expect(validatorNamedBy(withPayload({ validatorResult: { validatorId: 7 } }))).toBeUndefined();
		expect(validatorNamedBy(withPayload(undefined))).toBeUndefined();
	});
});
