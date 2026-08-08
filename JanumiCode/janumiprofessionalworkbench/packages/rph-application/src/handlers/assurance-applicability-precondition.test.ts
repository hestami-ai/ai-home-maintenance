// DOC-004 §5.1 APPLICABILITY, ENFORCED — REG-F-029 closed.
//
// ── WHY THIS FILE IS THE POINT ───────────────────────────────────────────────────────────────────────────────
// The §5.1 determination was built on 2026-08-05 and WITHDRAWN THREE TIMES before it could land. Each run found
// a real and different defect; twice my account of the blocker was itself wrong (a schema limitation that did not
// exist; then a proposed fix that held for two of eight cases). The kernel sat DEFERRED in the dead-kernel census
// with a reason nobody was checking.
//
// It is now wired. Which means the whole suite passing proves nothing on its own: an enforced check that never
// fires and an unenforced one are indistinguishable from a green run. This file is the predicted red — it asserts
// the refusal HAPPENS, names the outcome that causes it, and asserts the two outcomes that must NOT cause it.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPolicy } from './__tests__/floor-fixtures.js';

const TS = '2026-08-05T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5N10';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5N11';

describe('RequestAssuranceAssessment enforces §5.1 applicability (REG-F-029)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_ASSESSMENT',
			targetAggregateId: `asm_${n}`,
			issuedAt: TS,
			correlationId: 'corr-applicability',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		});
	};

	/** Request an assessment of the ARCHITECTURE-kind PWU under `policyId`. */
	const request = (policyId: string, assessmentId: string) =>
		dispatch(
			'RequestAssuranceAssessment',
			{
				assessmentId,
				assurancePolicyId: policyId,
				policyVersion: '1.0.0',
				subjectObjectIds: [PWU],
				subjectSemanticVersions: { [PWU]: 1 },
				claimIds: []
			},
			{ targetAggregateId: assessmentId }
		);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `evt_${++seq}` }).as(TEST_CRED.human);
		dispatch(
			'CaptureIntent',
			{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
			{ targetAggregateId: INTENT, targetAggregateType: 'INTENT' }
		);
		dispatch(
			'ProposePwu',
			{
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE_DEFINITION',
				title: 'T',
				description: 'd',
				intentId: INTENT,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'LOW',
					uncertainty: 'LOW',
					irreversibility: 'LOW',
					securitySensitivity: 'NONE',
					regulatoryExposure: 'NONE'
				}
			},
			{ targetAggregateId: PWU, targetAggregateType: 'PROFESSIONAL_WORK_UNIT' }
		);
	});

	it('REFUSES an assessment under a policy scoped to a DIFFERENT PWU kind — the case REG-F-029 was', () => {
		// Exactly the shape the canonical drive had: the policy names PROFESSIONAL_WORK_UNIT, so an objectType-only
		// reading admits it, and its KIND scope excludes this subject.
		seedPolicy(engine, 'pol_other_kind', {
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				pwuKindConditions: ['INTEGRATED_PRODUCT_VALIDATION']
			}
		});
		const r = request('pol_other_kind', 'asm_01ARZ3NDEKTSV4RRFFQ69G5N20');
		expect(r.status, 'a policy scoped away from this kind must not assess it').not.toBe('ACCEPTED');
		expect(JSON.stringify(r.error)).toContain('NOT_APPLICABLE');
		expect(
			store.loadObject('asm_01ARZ3NDEKTSV4RRFFQ69G5N20'),
			'a refused request must leave no assessment behind — a rejected command commits nothing'
		).toBeUndefined();
	});

	it('CONTROL: the SAME request succeeds when the policy names this kind — the refusal is about scope', () => {
		// Without this the refusal above could come from anything: a missing policy, a bad payload, an unrelated
		// guard. Same subject, same shape, one field different.
		seedPolicy(engine, 'pol_this_kind', {
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				pwuKindConditions: ['ARCHITECTURE_DEFINITION']
			}
		});
		const r = request('pol_this_kind', 'asm_01ARZ3NDEKTSV4RRFFQ69G5N21');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(store.loadObject('asm_01ARZ3NDEKTSV4RRFFQ69G5N21')).toBeDefined();
	});

	it('CONTROL: an UNRESTRICTED policy still assesses anything — absent scope is not an empty scope', () => {
		// `pwuKindConditions` absent means the policy does not restrict by kind, NOT that it restricts to none.
		// Reading it the other way would have made every policy that declares no kind scope useless.
		seedPolicy(engine, 'pol_unrestricted', {
			applicability: { objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'] }
		});
		expect(request('pol_unrestricted', 'asm_01ARZ3NDEKTSV4RRFFQ69G5N22').status).toBe('ACCEPTED');
	});

	it('PERMITS an expression that is not in the grammar — undecidable is not a refusal', () => {
		// The contestable judgement, asserted rather than buried. NOTE THE CORRECTED REASON (2026-08-05): this used
		// to say §5.1's `expression` is "a type the corpus names and defines nowhere". The corpus DOES define it —
		// DOC-007 §18's eight-op grammar, unified with `PolicyExpression` by ratified item C-9 — and the handler
		// now injects the evaluator. What stays permitted is an expression OUTSIDE that grammar: it cannot be
		// evaluated, and refusing on a condition nobody can evaluate would block real work.
		seedPolicy(engine, 'pol_opaque', {
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				expression: { some: 'condition outside the ratified grammar' }
			}
		});
		expect(request('pol_opaque', 'asm_01ARZ3NDEKTSV4RRFFQ69G5N23').status).toBe('ACCEPTED');
	});

	it('a RATIFIED §18 expression now DECIDES at the handler — it refuses when the condition does not hold', () => {
		// The capability the kernel had been declining to use. `EQUALS` is one of DOC-007 §18's eight ops, and
		// `evaluateApplicability` has implemented it since before the kernel was written; the kernel returned
		// REQUIRES_HUMAN_DETERMINATION anyway, on the false ground that the corpus defined no grammar. This is the
		// predicted red for the fix: an expression scoping the policy to a kind this subject is not.
		seedPolicy(engine, 'pol_expr_excludes', {
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				expression: { op: 'EQUALS', path: '$.pwuKind', value: 'INTEGRATED_PRODUCT_VALIDATION' }
			}
		});
		const r = request('pol_expr_excludes', 'asm_01ARZ3NDEKTSV4RRFFQ69G5N25');
		expect(
			r.status,
			'an expression that does not hold must refuse, not come back undecidable'
		).not.toBe('ACCEPTED');
		expect(JSON.stringify(r.error)).toContain('NOT_APPLICABLE');
	});

	it('CONTROL: the same expression ADMITS when it holds — the refusal is the expression, not its presence', () => {
		seedPolicy(engine, 'pol_expr_admits', {
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				expression: { op: 'EQUALS', path: '$.pwuKind', value: 'ARCHITECTURE_DEFINITION' }
			}
		});
		const r = request('pol_expr_admits', 'asm_01ARZ3NDEKTSV4RRFFQ69G5N26');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});

	it('DECLINES TO DECIDE about a subject that does not resolve — absence is not a decided negative', () => {
		// The mistake made at this exact call site once: `String(subj?.objectType ?? '')` turned an unloadable
		// subject into the empty string, which matched no condition and was reported NOT_APPLICABLE — a decided
		// negative manufactured from having no information, at the call site of the kernel built to prevent it.
		seedPolicy(engine, 'pol_kind_scoped', {
			applicability: {
				objectTypeConditions: ['PROFESSIONAL_WORK_UNIT'],
				pwuKindConditions: ['INTEGRATED_PRODUCT_VALIDATION']
			}
		});
		const r = dispatch(
			'RequestAssuranceAssessment',
			{
				assessmentId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5N24',
				assurancePolicyId: 'pol_kind_scoped',
				policyVersion: '1.0.0',
				subjectObjectIds: ['pwu_01ARZ3NDEKTSV4RRFFQ69G5N99'],
				subjectSemanticVersions: { pwu_01ARZ3NDEKTSV4RRFFQ69G5N99: 1 },
				claimIds: []
			},
			{ targetAggregateId: 'asm_01ARZ3NDEKTSV4RRFFQ69G5N24' }
		);
		// Whatever happens to it, it must NOT be refused for being INAPPLICABLE — that would be a scope verdict
		// derived from a subject nobody could read.
		expect(JSON.stringify(r.error ?? {})).not.toContain('NOT_APPLICABLE');
	});
});
