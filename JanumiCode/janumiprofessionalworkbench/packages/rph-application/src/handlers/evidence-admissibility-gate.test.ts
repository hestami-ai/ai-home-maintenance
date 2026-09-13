// Drives the REAL AdmitEvidence command through engine.dispatch and asks the question the existing suite never
// asks: does the CALL SITE enforce admissibility, or is the kernel merely correct beside it?
//
// Guide "### 8.11 Evidence admissibility" (line 1025), operative line 1027, byte-exact:
//   "Evidence is admissible only when identity is stable, provenance and content/reference are available, scope and
//   limitations are explicit, relevance and freshness are adequate, and it is not invalidated."
//
// "only when" is a gate on the ADMISSION transition. `packages/rph-assurance/src/assurance-rules.ts:99`
// `evidenceAdmissibility(...)` implements all 8 conditions and is unit-proven at `assurance-rules.test.ts:85` — but
// it has NO production caller. `admitEvidence` (`assurance.ts:222`) is a bare PROPOSED -> ADMISSIBLE status advance
// that reads nothing off the Evidence it is admitting, and the floor's boundary hardcodes `evidenceExists: true` /
// `evidenceInvalidated: false` (`packages/rph-assurance/src/floor.ts:322-323`). So no path can ever refuse Evidence.
//
// The fixture is SCHEMA-VALID on purpose: ProposeEvidencePayloadSchema types scope as z.string(), so '' satisfies
// the contract and reaches the handler carrying an unstated scope. The proposal is asserted ACCEPTED before the
// admission is attempted, so the red below is the real defect — a command that succeeded when §8.11 requires
// refusal — and not a payload-shape or fixture error.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { evidenceAdmissibility } from '@janumipwb/rph-assurance';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const human = { actorId: 'gov-1', actorType: 'HUMAN' as const, displayName: 'Governor' };
const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FD1';

describe('AdmitEvidence enforces §8.11 admissibility at the call site (live)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
	});

	function dispatch(commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'EVIDENCE',
			targetAggregateId: EV,
			issuedAt: TS,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	function statusOf(id: string, field = 'status'): string {
		return (store.loadObject(id)?.state as Record<string, string>)[field] ?? '';
	}

	// Evidence with no stated scope — the §8.11:1027 condition "scope and limitations are explicit" is absent.
	// Everything else is well-formed so the ONLY thing that can refuse this Evidence is an admissibility evaluation.
	const INADMISSIBLE = {
		evidenceId: EV,
		evidenceType: 'TEST_RESULT',
		contentReference: { uri: 'file://fixture-artifact' },
		producedBy: human,
		supportsClaimIds: [],
		contradictsClaimIds: [],
		scope: '',
		limitations: [],
		capturedAt: TS
	};

	function proposeInadmissible() {
		const r = dispatch('ProposeEvidence', INADMISSIBLE);
		// Guards the red: if the proposal itself were refused the admission gate would never be exercised and a
		// "rejected" result below would prove nothing.
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(EV)).toBe('PROPOSED');
	}

	it('the kernel already knows this Evidence is inadmissible — nothing in the pipeline asks it', () => {
		const verdict = evidenceAdmissibility(
			{ id: EV, provenance: human, contentReference: { uri: 'file://fixture-artifact' }, scope: '', limitations: [] },
			{}
		);
		expect(verdict.admissible).toBe(false);
		expect(verdict.failed).toContain('SCOPE_STATED');
	});

	it('refuses to admit Evidence whose scope is not stated (§8.11:1027)', () => {
		proposeInadmissible();

		const r = dispatch('AdmitEvidence', {
			admissibilityAssessmentId: 'a',
			admittedScope: 'architecture',
			admittedClaimIds: []
		});

		// The admitted scope is asserted by the CALLER, not read off the Evidence — the handler must not take the
		// caller's word for a condition §8.11 makes a property of the Evidence itself.
		expect(r.status).not.toBe('ACCEPTED');
	});

	it('leaves inadmissible Evidence in PROPOSED — admission is not a bare status advance (§8.11:1027)', () => {
		proposeInadmissible();

		// ASSERTED, not merely implied by the status below. See REG-F-015.
		const r = dispatch('AdmitEvidence', {
			admissibilityAssessmentId: 'a',
			admittedScope: 'architecture',
			admittedClaimIds: []
		});
		expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');

		// ADMISSIBLE here is the durable lie: the object now carries a status that §8.11 says it cannot hold, and
		// every downstream consumer (Claims, Assessments, Baseline readiness) reads that status as settled.
		expect(statusOf(EV)).toBe('PROPOSED');
	});

	// ──────────────────────────────────────────────────────────────────────────────────────────────────────────
	// JAN-PFA — the refusal's PRECISION, which everything above leaves unasserted.
	//
	// The three tests above prove the admission gate REFUSES. None of them reads WHAT IT SAYS, and this message is
	// load-bearing twice over:
	//   · PER-9, "a reason a reader cannot act on is the silent omission": a caller handed back one of TWO absent
	//     conditions will repair that one, re-dispatch, and be refused again for a condition the refusal never
	//     mentioned — the §8.11 gate becoming a guessing game rather than a reason.
	//   · the enforcement register discriminates TWO rules refused by THIS ONE guard purely by the condition NAME
	//     carried in this message: `RPH-EVD-003`'s refusalMarker is 'is inadmissible (§8.11) — failed
	//     CONTENT_AVAILABLE' (enforcement-register.ts:979) and `RPH-EVD-007`'s is the SCOPE_STATED twin (:1106),
	//     whose own comment records why the name is part of the marker — "a marker that stopped at 'failed' would
	//     let one arrangement green this row while the rule it actually exercised was a different one".
	//
	// ⭐ THIS CLOSES THE JAN-PFA INVENTORY MUTATION for `admitEvidence`:
	//       `verdict.failed.join(', ')`  ->  `verdict.failed[0] ?? ''`
	// It SURVIVED the entire repository, and it survives both register rows BY CONSTRUCTION: each of those
	// arrangements fails exactly ONE condition, so `join(', ')` and `failed[0]` produce byte-identical messages
	// there. Only an arrangement that fails TWO can tell them apart, and the repo had none — which is why the
	// assertion is written first and the mutant re-declared against it afterwards.
	describe('the refusal enumerates EVERY §8.11 condition the Evidence failed (JAN-PFA precision)', () => {
		const EV_TWO_FAILURES = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FD2';
		const EV_SCOPE_ONLY = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FD3';
		const EV_ADMISSIBLE = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FD4';

		// INADMISSIBLE's shape with its two §8.11 defects repaired, so the ONLY difference between a refused
		// arrangement below and the admitted control is the condition(s) the arrangement deliberately removes.
		const WELL_FORMED = {
			...INADMISSIBLE,
			contentReference: { uri: 'file://fixture-artifact' },
			scope: 'unit tests for module X'
		};

		function propose(evidenceId: string, over: Record<string, unknown> = {}) {
			const r = dispatch(
				'ProposeEvidence',
				{ ...WELL_FORMED, evidenceId, ...over },
				{ targetAggregateId: evidenceId }
			);
			// Same guard as `proposeInadmissible` above: a refused proposal would never reach the admission gate,
			// so a REJECTED admission below would prove nothing about admissibility.
			expect(r.status, `propose ${evidenceId}: ${r.error?.message}`).toBe('ACCEPTED');
			expect(statusOf(evidenceId)).toBe('PROPOSED');
		}

		function admit(evidenceId: string) {
			return dispatch(
				'AdmitEvidence',
				{
					admissibilityAssessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5F01',
					admittedScope: 'unit tests for module X',
					admittedClaimIds: []
				},
				{ targetAggregateId: evidenceId }
			);
		}

		it('two absent conditions are both named — a caller repairing only the first is not refused in silence', () => {
			// THE ARRANGEMENT THE REPO HAS NEVER HAD: contentReference {} (CONTENT_AVAILABLE) and scope ''
			// (SCOPE_STATED) absent at once. Both are schema-valid — ArtifactReferenceSchema is
			// `z.record(z.string(), z.unknown())` and `scope` is `z.string()` — so this is a reachable state a real
			// ProposeEvidence can create, not a hand-written store write.
			propose(EV_TWO_FAILURES, { contentReference: {}, scope: '' });

			// The arrangement's own precondition, ASSERTED rather than assumed: if the kernel found only one
			// failure here, the enumeration claim below would be vacuously true and this test would be theatre.
			const verdict = evidenceAdmissibility({
				id: EV_TWO_FAILURES,
				provenance: human,
				producedBy: human,
				contentReference: {},
				scope: '',
				limitations: [],
				status: 'PROPOSED'
			});
			expect(verdict.failed, 'the fixture must fail exactly these two §8.11 conditions').toEqual([
				'CONTENT_AVAILABLE',
				'SCOPE_STATED'
			]);

			const r = admit(EV_TWO_FAILURES);
			expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');
			expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');

			// ⭐ THE ASSERTION THAT CLOSES THE GAP, stated as the promise ("every condition the rule found wanting
			// is named in the reason the caller is given") rather than as the formatting that delivers it. Derived
			// from the verdict, not hand-listed, so a further §8.11 condition cannot be added and silently dropped.
			const message = r.error?.message ?? '';
			for (const condition of verdict.failed) {
				expect(message, `the refusal must name the failed condition ${condition}`).toContain(
					condition
				);
			}
			// Pinned literally as well, so a kernel change that emptied `verdict.failed` could not turn the loop
			// above into a no-op that still reports success.
			expect(
				message,
				'CONTENT_AVAILABLE is the first failure and has always been reported'
			).toContain('CONTENT_AVAILABLE');
			expect(
				message,
				'SCOPE_STATED is the SECOND failure — the one a refusal stopping at the first loses'
			).toContain('SCOPE_STATED');
		});

		it('CONTROL — the enumeration is the verdict, not a constant: one absent condition names exactly one', () => {
			propose(EV_SCOPE_ONLY, { scope: '' });

			const r = admit(EV_SCOPE_ONLY);
			expect(r.status, JSON.stringify(r.error)).toBe('REJECTED');

			// RPH-EVD-007's refusalMarker, verbatim from enforcement-register.ts:1106. It only reads this way while
			// SCOPE_STATED is the SOLE failure, which is what makes this row and RPH-EVD-003's distinguishable.
			expect(r.error?.message).toContain('is inadmissible (§8.11) — failed SCOPE_STATED');

			// ⛔ WITHOUT THIS LINE the test above is satisfied by a refusal that recites all eight condition names
			// unconditionally — an "enumeration" carrying no information, which is the very defect one level up.
			// CONTENT_AVAILABLE is MET by this Evidence, so naming it would be a false reason.
			expect(
				r.error?.message,
				'a condition this Evidence SATISFIED must not be reported as failed'
			).not.toContain('CONTENT_AVAILABLE');
		});

		it('CONTROL — well-formed Evidence is still ADMITTED: the gate refuses the inadmissible, not everything', () => {
			propose(EV_ADMISSIBLE);

			const r = admit(EV_ADMISSIBLE);
			expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
			// Without this control a guard that refused every Evidence — with a message naming every condition —
			// would satisfy the precision assertion above while destroying the command.
			expect(statusOf(EV_ADMISSIBLE)).toBe('ADMISSIBLE');
		});
	});
});
