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
import { ProfessionalWorkArchitectureSchema } from '@janumipwb/rph-contracts';
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
// ── JAN-PFA: the DRAFT-only edit window, asserted over the WHOLE machine ─────────────────────────────────────────
// The third test above pins the refusal at exactly ONE non-DRAFT status (PUBLISHED), which is the shape that let a
// batch of mutants live: a guard narrowed to refuse only PUBLISHED — `publicationStatus !== 'DRAFT' && … !==
// 'VALIDATED'`, say — passes it untouched, and every downstream reader of the "frozen after creation" promise
// (RPH-CON-009's pwaVersion stamp, §10.1 L1379's version-bound records) is then reading a version that a
// professional CAN still move. The promise editPwa's own docblock states is universal — "A PUBLISHED version is
// immutable (§11), so this rejects unless publicationStatus is DRAFT" — so it is asserted universally here, over
// the ratified enum rather than a hand-written list, and each failure names the offending status.
const NON_DRAFT_STATUSES = [...ProfessionalWorkArchitectureSchema.shape.publicationStatus.options]
	.filter((s) => s !== 'DRAFT')
	.sort();

/** An EditPwa that is never a no-op: each attempt asks for a DIFFERENT version, so a refusal can only ever be the
 *  lifecycle guard (the no-op precondition runs after it) and an acceptance is a real, observable write. */
function attemptVersionEdit(d: ReturnType<typeof harness>['d'], n: number) {
	return d('EditPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { pwaId: PWA, version: `9.0.${n}` });
}

describe('EditPwa is DRAFT-only across the whole publication machine', () => {
	it('REFUSES the version edit in EVERY non-DRAFT status, and ADMITS it in DRAFT', () => {
		const { d, stateOf } = harness();

		expect(
			d('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
				pwaId: PWA,
				name: 'Version Binding PWA',
				description: 'walks the publication machine with an EditPwa at every stop',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		expect(
			d('DefinePwuType', TYPE_EARLY, 'PWU_TYPE', {
				pwuTypeId: TYPE_EARLY,
				pwaId: PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'Root',
				purpose: 'root type so the PWA can be validated and published',
				isRoot: true
			}).status
		).toBe('ACCEPTED');

		// ⭐ THE CONTROL, AND IT RUNS FIRST. A guard that refused EditPwa unconditionally would satisfy every
		// refusal below while protecting nothing and forbidding the one thing authoring exists for. So: while
		// DRAFT the edit is ADMITTED and the version genuinely moves.
		const admitted = attemptVersionEdit(d, 0);
		expect(admitted.status, JSON.stringify(admitted.error)).toBe('ACCEPTED');
		expect(stateOf(PWA).publicationStatus).toBe('DRAFT');
		expect(stateOf(PWA).version, 'the DRAFT edit did not actually write').toBe('9.0.0');

		// From here the version is FROZEN — that is the claim, and it is checked after every single hop.
		const FROZEN = '9.0.0';
		const visited: string[] = [];
		const hop = (commandType: string, payload: unknown, reached: string, n: number): void => {
			const moved = d(commandType, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', payload);
			expect(moved.status, `${commandType} ${JSON.stringify(moved.error)}`).toBe('ACCEPTED');
			expect(stateOf(PWA).publicationStatus, `${commandType} did not reach ${reached}`).toBe(
				reached
			);
			visited.push(reached);

			const refused = attemptVersionEdit(d, n);
			expect(refused.status, `EditPwa was ADMITTED while ${reached}`).toBe('REJECTED');
			expect(refused.error?.code, `EditPwa refused while ${reached} with the wrong code`).toBe(
				'RPH_INVARIANT_VIOLATION'
			);
			expect(
				refused.error?.message,
				`the refusal while ${reached} does not cite the DRAFT-only rule`
			).toContain('DRAFT');
			expect(stateOf(PWA).version, `EditPwa moved \`version\` while ${reached}`).toBe(FROZEN);
		};

		hop('SubmitPwaForReview', {}, 'UNDER_REVIEW', 1);
		hop('ValidatePwa', {}, 'VALIDATED', 2);
		hop('PublishPwa', { rootPwuTypeId: TYPE_EARLY }, 'PUBLISHED', 3);
		hop('DeprecatePwa', {}, 'DEPRECATED', 4);
		hop('RetirePwa', {}, 'RETIRED', 5);
		hop('DeletePwa', { pwaId: PWA }, 'DISCARDED', 6);

		// ⭐ UNIVERSALITY, DERIVED NOT ENUMERATED. The walk must have stood in EVERY non-DRAFT member of
		// PWA.publicationStatus; a guard narrowed to any one of them has nowhere unvisited to hide, and a status
		// added to the ratified enum reddens this line instead of silently escaping the promise.
		expect([...visited].sort(), 'a non-DRAFT status was never stood in').toEqual(
			NON_DRAFT_STATUSES
		);
	});
});
