// Drives the authoring-plane faithfulness-assessment lifecycle LIVE: record a judge's verdict against a DRAFT PWA,
// prove referential integrity (unknown PWA / unknown prior are rejected), then walk RECORDED -> ESCALATED -> RESOLVED
// and prove the status-precondition guards on each transition.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-14T00:00:00Z';
const actor = { actorId: 'des-1', actorType: 'HUMAN' as const, displayName: 'Designer' };
const judge = {
	actorId: 'agy-1',
	actorType: 'AGENT' as const,
	displayName: 'agy faithfulness judge',
	modelId: 'gemini',
	providerId: 'google'
};
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';
const A1 = 'aasm_01ARZ3NDEKTSV4RRFFQ69G5PA1';
const A2 = 'aasm_01ARZ3NDEKTSV4RRFFQ69G5PA2';

describe('authoring-plane faithfulness-assessment handlers (live)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function d(commandType: string, payload: unknown, id: string, type: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	function createDraftPwa() {
		const r = d(
			'CreatePwa',
			{ pwaId: PWA, name: 'SDLC', description: 'd', domain: 'software', version: '1.0.0' },
			PWA,
			'PROFESSIONAL_WORK_ARCHITECTURE'
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	}

	function recordPayload(id: string, over: Record<string, unknown> = {}) {
		return {
			assessmentId: id,
			pwaId: PWA,
			promptText: 'Draft a software engineering SDLC PWA leveraging V-model, UCD and JTBD.',
			iteration: 1,
			assessor: judge,
			verdict: 'PARTIAL',
			overallScore: 60,
			criteria: [
				{ name: 'v-model', score: 50, rationale: 'right arm collapsed to one validation node' },
				{ name: 'user-centered-design', score: 60 }
			],
			gaps: ['no per-level V&V pairing', 'JTBD not traced to acceptance'],
			recommendation: 'Add per-level V&V pairs and route JTBD into acceptance validation.',
			...over
		};
	}

	const state = (id: string) => store.loadObject(id)?.state as Record<string, unknown> | undefined;

	it('records a faithfulness verdict against a DRAFT PWA (status RECORDED; assessor vendor captured)', () => {
		createDraftPwa();
		const r = d('RecordAuthoringAssessment', recordPayload(A1), A1, 'AUTHORING_ASSESSMENT');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const s = state(A1)!;
		expect(s.status).toBe('RECORDED');
		expect(s.verdict).toBe('PARTIAL');
		expect((s.assessor as { providerId: string }).providerId).toBe('google');
		expect(s.gaps).toHaveLength(2);
	});

	it('rejects an assessment that references an unknown PWA (referential integrity)', () => {
		const r = d('RecordAuthoringAssessment', recordPayload(A1), A1, 'AUTHORING_ASSESSMENT');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
	});

	it('links a second-iteration assessment to its prior (lineage); rejects an unknown prior', () => {
		createDraftPwa();
		d('RecordAuthoringAssessment', recordPayload(A1), A1, 'AUTHORING_ASSESSMENT');
		const ok = d(
			'RecordAuthoringAssessment',
			recordPayload(A2, { iteration: 2, priorAssessmentId: A1, scoreDelta: 15, converging: true }),
			A2,
			'AUTHORING_ASSESSMENT'
		);
		expect(ok.status, JSON.stringify(ok.error)).toBe('ACCEPTED');
		expect(state(A2)!.priorAssessmentId).toBe(A1);
		expect(state(A2)!.converging).toBe(true);

		const bad = d(
			'RecordAuthoringAssessment',
			recordPayload('aasm_missing_prior', { priorAssessmentId: 'aasm_does_not_exist' }),
			'aasm_missing_prior',
			'AUTHORING_ASSESSMENT'
		);
		expect(bad.status).toBe('REJECTED');
		expect(bad.error?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
	});

	it('escalates a RECORDED assessment to the human-in-the-loop, then resolves it', () => {
		createDraftPwa();
		d('RecordAuthoringAssessment', recordPayload(A1), A1, 'AUTHORING_ASSESSMENT');

		const esc = d(
			'EscalateAuthoringAssessment',
			{
				assessmentId: A1,
				reason: 'not-converging',
				context: 'scores flat after auto-refine; 2 gaps recur'
			},
			A1,
			'AUTHORING_ASSESSMENT'
		);
		expect(esc.status, JSON.stringify(esc.error)).toBe('ACCEPTED');
		expect(state(A1)!.status).toBe('ESCALATED');
		expect(state(A1)!.reason).toBe('not-converging');

		const res = d(
			'ResolveAuthoringAssessment',
			{
				assessmentId: A1,
				resolution: 'ACCEPTED_AS_IS',
				resolutionNote: 'good enough for a draft',
				resolvedBy: actor
			},
			A1,
			'AUTHORING_ASSESSMENT'
		);
		expect(res.status, JSON.stringify(res.error)).toBe('ACCEPTED');
		expect(state(A1)!.status).toBe('RESOLVED');
		expect(state(A1)!.resolution).toBe('ACCEPTED_AS_IS');
	});

	it('guards the transitions: cannot escalate a non-RECORDED, cannot resolve a non-ESCALATED', () => {
		createDraftPwa();
		d('RecordAuthoringAssessment', recordPayload(A1), A1, 'AUTHORING_ASSESSMENT');

		// resolve before escalate → rejected
		const early = d(
			'ResolveAuthoringAssessment',
			{ assessmentId: A1, resolution: 'REVISED', resolvedBy: actor },
			A1,
			'AUTHORING_ASSESSMENT'
		);
		expect(early.status).toBe('REJECTED');
		expect(early.error?.code).toBe('RPH_INVARIANT_VIOLATION');

		// escalate twice → the second is rejected (already ESCALATED)
		d(
			'EscalateAuthoringAssessment',
			{ assessmentId: A1, reason: 'r', context: 'c' },
			A1,
			'AUTHORING_ASSESSMENT'
		);
		const again = d(
			'EscalateAuthoringAssessment',
			{ assessmentId: A1, reason: 'r', context: 'c' },
			A1,
			'AUTHORING_ASSESSMENT'
		);
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_INVARIANT_VIOLATION');
	});
});
