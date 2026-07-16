// RecordArtifact — the Artifact exists as a Professional Work Object.
//
// What these tests are FOR: `outputArtifactIds` (DOC-007 §16.1/§16.2) pointed at objects no ratified command
// could create, and ARTIFACT — a member of DOC-002 §4's ratified object union — was a bare envelope with zero
// fields. The consequence was not cosmetic: the execution plane had no legal assurance subject, because
// DOC-004 invariant 2 ("Every assessment identifies its subject semantic version") and DOC-009 §11.7
// (`subject_object_id references professional_work_objects(id)`, `subject_semantic_version integer not null`)
// both require the subject to be a versioned Professional Work Object. An Execution Step is neither.
//
// So the load-bearing assertion here is `semanticVersion` + registry presence, not field round-tripping.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-16T00:00:00Z';
const AGENT = { actorId: 'agent-1', actorType: 'AGENT' as const, displayName: 'Producing Agent' };
const ART = 'art_01ARZ3NDEKTSV4RRFFQ69G5A10';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A20';
const ATTEMPT = 'attempt_01ARZ3NDEKTSV4RRFFQ69G5A30';

/** DOC-009 §18.1's required (`not null`) columns, minus the nullable three. */
const REQUIRED = {
	artifactType: 'DESIGN_DOCUMENT',
	mediaType: 'text/markdown',
	storageProvider: 'workspace-local',
	storageKey: 'artifacts/ab/abc123.md',
	contentHash: 'sha256:abc123',
	securityClassification: 'INTERNAL',
	retentionClass: 'PROJECT_LIFETIME',
	status: 'RECORDED'
};

describe('RecordArtifact — DOC-009 §18.1 transcribed; the Artifact is a versioned Professional Work Object', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function record(payload: unknown, id = ART) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType: 'RecordArtifact',
			commandSchemaVersion: 1,
			targetAggregateType: 'ARTIFACT',
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: AGENT,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	it('records an Artifact carrying a semanticVersion — the thing that makes it a legal assurance subject', () => {
		const r = record({ artifactId: ART, ...REQUIRED });
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');

		const obj = store.loadObject(ART);
		expect(obj, 'the Artifact is in the object registry').toBeDefined();
		// DOC-004 invariant 2 / DOC-009 §11.7 need exactly this. An ExecutionStep has no envelope, so it can
		// never produce this number — which is why the floor cannot subject over a step.
		expect(obj!.semanticVersion).toBe(1);
		expect((obj!.state as { objectType: string }).objectType).toBe('ARTIFACT');
	});

	it('round-trips DOC-009 §18.1 required columns verbatim', () => {
		expect(record({ artifactId: ART, ...REQUIRED }).status).toBe('ACCEPTED');
		const s = store.loadObject(ART)!.state as Record<string, unknown>;
		for (const [field, value] of Object.entries(REQUIRED)) {
			expect(s[field], `DOC-009 §18.1 column ${field}`).toBe(value);
		}
	});

	it('binds the producers DOC-009 §18.1 names — the PWU and the Execution Attempt, never the step', () => {
		const r = record({
			artifactId: ART,
			...REQUIRED,
			byteSize: 2048,
			producingPwuId: PWU,
			producingExecutionAttemptId: ATTEMPT
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const s = store.loadObject(ART)!.state as Record<string, unknown>;
		expect(s.producingPwuId).toBe(PWU);
		// Guide §8.4's "producing Attempt/invocation" binding, carried on the wire by
		// CompleteExecutionStepPayload.executionAttemptId today even though no Attempt object exists yet.
		expect(s.producingExecutionAttemptId).toBe(ATTEMPT);
		expect(s.byteSize).toBe(2048);
		expect(s.provenance).toBeDefined();
		expect((s.provenance as { sourceObjectIds?: string[] }).sourceObjectIds).toEqual([PWU, ATTEMPT]);
	});

	it("omits DOC-009's three nullable columns when absent rather than writing nulls", () => {
		expect(record({ artifactId: ART, ...REQUIRED }).status).toBe('ACCEPTED');
		const s = store.loadObject(ART)!.state as Record<string, unknown>;
		expect('byteSize' in s).toBe(false);
		expect('producingPwuId' in s).toBe(false);
		expect('producingExecutionAttemptId' in s).toBe(false);
	});

	it('rejects a payload missing a DOC-009 `not null` column (contentHash) — schema validation is real', () => {
		// VALIDATION_FAILED, not REJECTED: the command bus validates the payload BEFORE dispatch, so a missing
		// required column never reaches the handler. §18.1 makes content_hash NOT NULL and part of
		// uq_artifact_content, and DOC-002 §31.1 says "Preserve content hashes for evidence and artifacts" — an
		// artifact without one cannot support §18.3 immutability, so failing this early is correct.
		const { contentHash: _dropped, ...withoutHash } = REQUIRED;
		const r = record({ artifactId: ART, ...withoutHash });
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(store.loadObject(ART), 'nothing is persisted on a schema failure').toBeUndefined();
	});

	it('accepts any value for the four open-domain columns — no enum is ratified, so none is enforced', () => {
		// DOC-009 types artifact_type/status/security_classification/retention_class as bare `text not null`.
		// This test exists to LOCK the absence of invented enums: if someone later narrows these to a made-up
		// enum, this fails and sends them to the corpus first.
		const r = record({
			artifactId: ART,
			...REQUIRED,
			artifactType: 'anything-at-all',
			status: 'some-status-nobody-ratified',
			securityClassification: 'x',
			retentionClass: 'y'
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});
});
