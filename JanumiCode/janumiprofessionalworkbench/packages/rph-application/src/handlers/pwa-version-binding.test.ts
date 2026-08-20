// RPH-CON-009's VERSION limb: is it a control that can fail? — REG-F-199.
//
// WHY THIS FILE EXISTS. A delta investigation into the ratified §34.5 query roster concluded that its most
// material engine finding was this: because `editPwa` refuses outside DRAFT and the PWA publication machine has
// no arrow back to DRAFT, one `pwaId` can hold exactly one `version` string for its whole life — and therefore
// the RPH-CON-009 check at `pwu.ts:159-170` (`pwuType.pwaVersion === undertaking.pwaVersion`) compares two
// operands "derived from the same immutable field on the same aggregate" and CANNOT FAIL.
//
// The claim is refutable by driving it, so it was driven rather than argued, and IT IS FALSE. The two operands
// are not one field read twice: they are two SNAPSHOTS of `pwa.version`, taken at different times —
// `definePwuType` stamps `pwaVersion: pwa.version` onto the type (pwa-authoring.ts:456), and
// `createUndertaking` binds `p.pwaVersion` after gating it against `pwa.version` (pwa-authoring.ts:1055). Both
// snapshots happen while the PWA is DRAFT-or-later, and `editPwa` can move `version` BETWEEN them. The window
// is real and dispatchable, and this suite walks through it.
//
// WHAT THAT LEAVES STANDING, because the investigation's other limb survives: a PWA still cannot hold two
// versions AT ONCE, so `PwaVersionReference`'s one-pwaId-many-versions addressing genuinely has no
// representation. The correction is to the "cannot fail" claim, not to the successor-version gap.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-08-20T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5FAV';
const TYPE_EARLY = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5FAW';
const UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69G5FAX';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FAY';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5FAZ';

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({
		authenticate: testAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `e${++seq}`
	}).as(TEST_CRED.human);
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'con009',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	return { d, stateOf };
}

/** Author a PWA at `version`, define one root type on it, then optionally EDIT the version before publishing. */
function driveToPublished(
	d: ReturnType<typeof harness>['d'],
	initialVersion: string,
	editedVersion?: string
): void {
	const created = d('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
		pwaId: PWA,
		name: 'Version Binding PWA',
		description: 'drives the RPH-CON-009 version window',
		domain: 'software',
		version: initialVersion
	});
	expect(created.status, JSON.stringify(created.error)).toBe('ACCEPTED');

	// The type is stamped with whatever `pwa.version` is RIGHT NOW (pwa-authoring.ts:456).
	expect(
		d('DefinePwuType', TYPE_EARLY, 'PWU_TYPE', {
			pwuTypeId: TYPE_EARLY,
			pwaId: PWA,
			pwuKind: 'PRODUCT_REALIZATION',
			name: 'Root',
			purpose: 'root type defined before any version edit',
			isRoot: true
		}).status
	).toBe('ACCEPTED');

	if (editedVersion !== undefined) {
		// THE WINDOW. Still DRAFT, so this is accepted — and every type already defined keeps the OLD stamp.
		expect(
			d('EditPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { pwaId: PWA, version: editedVersion })
				.status
		).toBe('ACCEPTED');
	}

	for (const step of ['SubmitPwaForReview', 'ValidatePwa']) {
		const r = d(step, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {});
		expect(r.status, step + ' ' + JSON.stringify(r.error)).toBe('ACCEPTED');
	}
	// PublishPwa names the root explicitly (seed-workbench.ts:400-402).
	const published = d('PublishPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
		rootPwuTypeId: TYPE_EARLY
	});
	expect(published.status, JSON.stringify(published.error)).toBe('ACCEPTED');
}

function createUndertaking(d: ReturnType<typeof harness>['d'], pwaVersion: string) {
	return d('CreateUndertaking', UNDERTAKING, 'UNDERTAKING', {
		undertakingId: UNDERTAKING,
		name: 'Version Binding Undertaking',
		description: 'binds the published PWA version',
		pwaId: PWA,
		pwaVersion,
		instantiationProfile: 'Standard Product Realization',
		objective: 'observe the CON-009 version limb',
		intendedOutputProduct: 'a verdict'
	});
}

function captureIntent(d: ReturnType<typeof harness>['d']): void {
	// ProposePwu requires an existing Intent (PWU-002); nothing here depends on its lifecycle state.
	const r = d('CaptureIntent', INTENT, 'INTENT', {
		intentId: INTENT,
		originatingExpression: 'observe the CON-009 version limb',
		ontologyId: 'product-realization-pwa',
		ontologyVersion: '1.3.0'
	});
	expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
}

function proposePwu(d: ReturnType<typeof harness>['d']) {
	return d('ProposePwu', PWU, 'PROFESSIONAL_WORK_UNIT', {
		pwuId: PWU,
		pwuKind: 'PRODUCT_REALIZATION',
		title: 'Root work',
		description: 'proposed from a type that may carry a stale pwaVersion',
		undertakingId: UNDERTAKING,
		isLocalExtension: false,
		pwuTypeId: TYPE_EARLY,
		intentId: INTENT,
		boundaries: { inScope: ['x'], outOfScope: ['y'], permittedChanges: [], prohibitedChanges: [] },
		obligationIds: [],
		constraintIds: [],
		assumptionIds: [],
		expectedOutputs: [],
		assurancePolicyIds: [],
		riskProfile: {
			consequence: 'LOW',
			uncertainty: 'LOW',
			irreversibility: 'LOW',
			securitySensitivity: 'LOW',
			regulatoryExposure: 'LOW'
		}
	});
}

describe('RPH-CON-009 version limb (driven, not argued)', () => {
	it('REFUSES a type stamped before an in-DRAFT version edit — the control CAN fail', () => {
		const { d, stateOf } = harness();
		driveToPublished(d, '1.0.0', '2.0.0');

		// The two snapshots have genuinely diverged: this is the fact the "cannot fail" claim denied.
		expect(stateOf(TYPE_EARLY).pwaVersion).toBe('1.0.0');
		expect(stateOf(PWA).version).toBe('2.0.0');

		expect(createUndertaking(d, '2.0.0').status).toBe('ACCEPTED');
		expect(stateOf(UNDERTAKING).pwaVersion).toBe('2.0.0');

		captureIntent(d);
		const rejected = proposePwu(d);
		expect(rejected.status).toBe('REJECTED');
		expect(rejected.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(rejected.error?.message).toContain('RPH-CON-009');
	});

	it('ACCEPTS the same proposal when no version edit intervened — so the refusal discriminates', () => {
		// THE CONTROL FOR THE CONTROL. A guard that refused every ProposePwu would satisfy the test above
		// while protecting nothing; the ONLY difference here is the absent EditPwa.
		const { d, stateOf } = harness();
		driveToPublished(d, '1.0.0');
		expect(stateOf(TYPE_EARLY).pwaVersion).toBe('1.0.0');
		expect(createUndertaking(d, '1.0.0').status).toBe('ACCEPTED');
		captureIntent(d);
		const ok = proposePwu(d);
		expect(ok.status, JSON.stringify(ok.error)).toBe('ACCEPTED');
	});

	it('records the surviving half: a PWA cannot hold two versions at once', () => {
		// `editPwa` is the ONLY writer of `version` after creation and it refuses outside DRAFT, and the
		// publication machine has no arrow back to DRAFT — so once PUBLISHED, the version string is frozen for
		// that pwaId forever. A "successor version" therefore has no representation on the same aggregate,
		// which is what PwaVersionReference (Contract Package §7.2) addresses by.
		const { d, stateOf } = harness();
		driveToPublished(d, '1.0.0');
		const refused = d('EditPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA,
			version: '2.0.0'
		});
		expect(refused.status).not.toBe('ACCEPTED');
		expect(refused.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(refused.error?.message).toContain('DRAFT');
		expect(stateOf(PWA).version).toBe('1.0.0');
	});
});
