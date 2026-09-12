import { afterEach, describe, expect, it } from 'vitest';
import { canonicalJson, sha256 } from '../../inventory/canonical.js';
import {
	evaluateHybridRuntimeRows,
	type HybridStaticPrerequisite
} from './evaluate-hybrid-runtime.js';
import {
	DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION,
	DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID,
	EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS,
	importDeterministicRuntimeTrace
} from './import-runtime-trace.js';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from './provider-evidence.test-support.js';
import type { ProviderImportContext } from './provider-evidence.js';

afterEach(cleanupProviderFixtures);

const A = sha256('a');
const B = sha256('b');
const ACTOR = sha256('actor');

function defectEvents() {
	return [
		{
			data: {
				authenticated: false,
				endpointId: 'workbench-command',
				identitySource: 'FABRICATED',
				outcome: 'ACCEPTED',
				principalKind: 'HUMAN'
			},
			kind: 'AUTHENTICATION_DECISION'
		},
		{
			data: {
				firstRequestSha256: A,
				idempotencyKeySha256: sha256('key'),
				outcome: 'PRIOR_RESULT_RETURNED',
				secondRequestSha256: B
			},
			kind: 'IDEMPOTENCY_REPLAY'
		},
		{
			data: { material: true, outputId: 'output-a', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { material: true, outputId: 'output-b', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { outputId: null, scope: 'TURN', turnId: 'turn-1' },
			kind: 'ASSESSMENT_RECORDED'
		},
		{
			data: {
				action: 'PROPOSED',
				actorSha256: ACTOR,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: {
				action: 'APPROVED',
				actorSha256: ACTOR,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: { attemptId: 'attempt-1', fieldsPresent: ['ATTEMPT_ID'], outcome: 'EXITED' },
			kind: 'EXTERNAL_TOOL_ATTEMPT'
		}
	];
}

function negativeEvents() {
	return [
		{
			data: {
				authenticated: false,
				endpointId: 'workbench-command',
				identitySource: 'NONE',
				outcome: 'REJECTED',
				principalKind: 'UNKNOWN'
			},
			kind: 'AUTHENTICATION_DECISION'
		},
		{
			data: {
				firstRequestSha256: A,
				idempotencyKeySha256: sha256('key'),
				outcome: 'CONFLICT_REJECTED',
				secondRequestSha256: B
			},
			kind: 'IDEMPOTENCY_REPLAY'
		},
		{
			data: { material: true, outputId: 'output-a', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { material: true, outputId: 'output-b', turnId: 'turn-1' },
			kind: 'AUTHORING_TRANSFORMATION'
		},
		{
			data: { outputId: 'output-a', scope: 'OUTPUT', turnId: 'turn-1' },
			kind: 'ASSESSMENT_RECORDED'
		},
		{
			data: { outputId: 'output-b', scope: 'OUTPUT', turnId: 'turn-1' },
			kind: 'ASSESSMENT_RECORDED'
		},
		{
			data: {
				action: 'PROPOSED',
				actorSha256: ACTOR,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: {
				action: 'APPROVED',
				actorSha256: sha256('different-actor'),
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: {
				attemptId: 'attempt-1',
				fieldsPresent: [...EXTERNAL_TOOL_ATTEMPT_REQUIRED_FIELDS],
				outcome: 'EXITED'
			},
			kind: 'EXTERNAL_TOOL_ATTEMPT'
		}
	];
}

function trace(
	context: ProviderImportContext,
	events: readonly { readonly data: unknown; readonly kind: string }[] = defectEvents()
) {
	return {
		artifacts: [{ kind: 'TRACE', path: 'verif/runtime.trace.json', sha256: sha256('trace') }],
		coverage: { findingIds: [9, 19, 45, 54, 55], missingFindingIds: [] as number[] },
		events: events.map((event, sequence) => ({
			...event,
			at: '2026-08-25T12:00:00.500Z',
			sequence
		})),
		runBindingSha256: sha256(canonicalJson(context.run)),
		schemaVersion: DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION
	};
}

function prerequisites(subjectId: string): HybridStaticPrerequisite[] {
	return [
		[9, 'TAINT'],
		[19, 'DFG'],
		[45, 'DFG'],
		[54, 'TAINT'],
		[55, 'TAINT']
	].map(
		([findingId, capability]) =>
			({
				capability,
				evidenceIds: [`static-${String(findingId)}`],
				findingId,
				freshness: 'CURRENT',
				observedAt: '2026-08-25T12:00:01.500Z',
				providerId: 'native-static',
				state: 'SATISFIED',
				subjectId
			}) as HybridStaticPrerequisite
	);
}

describe('supplied deterministic runtime traces and hybrid rows', () => {
	it('imports supplied evidence without execution and detects all five hybrid runtime predicates', () => {
		const fixture = providerFixture();
		const context = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID
		);
		const imported = importDeterministicRuntimeTrace(JSON.stringify(trace(context)), context);
		expect(imported).toMatchObject({
			coverage: { state: 'COMPLETE' },
			freshness: { state: 'CURRENT' },
			health: 'HEALTHY',
			usableForCurrentSubject: true
		});
		const evaluation = evaluateHybridRuntimeRows({
			assessedAt: '2026-08-25T12:00:02.000Z',
			staticPrerequisites: prerequisites(fixture.subject.descriptor.subjectId),
			trace: imported
		});
		expect(evaluation.rows.map((row) => [row.findingId, row.status])).toEqual([
			[9, 'DETECTED'],
			[19, 'DETECTED'],
			[45, 'DETECTED'],
			[54, 'DETECTED'],
			[55, 'DETECTED']
		]);
		expect(evaluation).toMatchObject({ analysisAuthority: 'NONE', gateEffect: 'NONE' });
	});

	it('discriminates all five nearby runtime negative controls', () => {
		const fixture = providerFixture();
		const context = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID
		);
		const imported = importDeterministicRuntimeTrace(
			JSON.stringify(trace(context, negativeEvents())),
			context
		);
		const evaluation = evaluateHybridRuntimeRows({
			assessedAt: '2026-08-25T12:00:02.000Z',
			staticPrerequisites: prerequisites(fixture.subject.descriptor.subjectId),
			trace: imported
		});
		expect(evaluation.rows.every((row) => row.status === 'NOT_DETECTED')).toBe(true);
	});

	it('keeps partial, stale, failed, and mismatched traces non-conclusive', () => {
		const fixture = providerFixture();
		const context = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID
		);
		const partialRaw = trace(context);
		partialRaw.coverage.findingIds = [9, 19, 45, 54];
		partialRaw.coverage.missingFindingIds = [55];
		const partial = importDeterministicRuntimeTrace(JSON.stringify(partialRaw), context);
		expect(partial).toMatchObject({ health: 'PARTIAL', usableForCurrentSubject: false });
		const partialEvaluation = evaluateHybridRuntimeRows({
			assessedAt: '2026-08-25T12:00:02.000Z',
			staticPrerequisites: prerequisites(fixture.subject.descriptor.subjectId),
			trace: partial
		});
		expect(partialEvaluation.rows.map((row) => row.status)).toEqual([
			'DETECTED',
			'DETECTED',
			'DETECTED',
			'DETECTED',
			'NOT_RUN'
		]);

		const staleContext = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID,
			{ assessedAt: '2026-08-26T12:00:02.000Z', freshnessWindowMs: 60_000 }
		);
		const stale = importDeterministicRuntimeTrace(
			JSON.stringify(trace(staleContext)),
			staleContext
		);
		expect(stale).toMatchObject({ freshness: { state: 'STALE' }, usableForCurrentSubject: false });

		const failedContext = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID,
			{ termination: { exitCode: 2, kind: 'EXITED' } }
		);
		expect(
			importDeterministicRuntimeTrace(JSON.stringify(trace(failedContext)), failedContext)
		).toMatchObject({
			health: 'FAILED',
			observations: []
		});
		const crashedContext = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID,
			{ termination: { kind: 'CRASHED', signal: 'SIGABRT' } }
		);
		expect(
			importDeterministicRuntimeTrace(JSON.stringify(trace(crashedContext)), crashedContext).health
		).toBe('CRASHED');
		const timedOutContext = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID,
			{ termination: { budgetMs: 1_000, kind: 'TIMED_OUT' } }
		);
		expect(
			importDeterministicRuntimeTrace(JSON.stringify(trace(timedOutContext)), timedOutContext)
				.health
		).toBe('TIMED_OUT');

		const mismatched = trace(context);
		mismatched.runBindingSha256 = sha256('different run');
		expect(importDeterministicRuntimeTrace(JSON.stringify(mismatched), context).health).toBe(
			'MALFORMED'
		);
		const vacuous = trace(context, []);
		expect(importDeterministicRuntimeTrace(JSON.stringify(vacuous), context).health).toBe(
			'MALFORMED'
		);
		const malicious = trace(context);
		malicious.artifacts[0]!.path = '../outside.trace';
		expect(importDeterministicRuntimeTrace(JSON.stringify(malicious), context).health).toBe(
			'MALFORMED'
		);
	});

	it('rejects malformed runtime coverage, event, artifact, and ordering boundaries', () => {
		const fixture = providerFixture();
		const context = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID
		);
		type MutableRecord = Record<string, unknown>;
		const record = (value: unknown): MutableRecord => value as MutableRecord;
		const array = (value: unknown): unknown[] => value as unknown[];
		const event = (value: MutableRecord, index: number): MutableRecord =>
			record(array(value.events)[index]);
		const eventData = (value: MutableRecord, index: number): MutableRecord =>
			record(event(value, index).data);
		const malformedCases: readonly [string, (value: MutableRecord) => void][] = [
			[
				'unsupported finding ID',
				(value) => {
					record(value.coverage).findingIds = [9, 19, 45, 54, 999];
				}
			],
			[
				'duplicate finding ID',
				(value) => {
					record(value.coverage).findingIds = [9, 19, 45, 54, 54];
				}
			],
			[
				'noncanonical finding order',
				(value) => {
					record(value.coverage).findingIds = [19, 9, 45, 54, 55];
				}
			],
			['invalid event timestamp', (value) => (event(value, 0).at = 'not-a-date')],
			['noncanonical event timestamp', (value) => (event(value, 0).at = '2026-08-25T12:00:00.50Z')],
			[
				'event timestamp outside the run',
				(value) => (event(value, 0).at = '2026-08-25T12:00:02.000Z')
			],
			['invalid digest', (value) => (eventData(value, 1).firstRequestSha256 = 'not-a-digest')],
			['unsupported enum', (value) => (eventData(value, 0).identitySource = 'IMAGINARY')],
			[
				'nonboolean authentication marker',
				(value) => (eventData(value, 0).authenticated = 'false')
			],
			['nonboolean authoring marker', (value) => (eventData(value, 2).material = 'true')],
			[
				'duplicate tool fields',
				(value) => {
					eventData(value, 7).fieldsPresent = ['ATTEMPT_ID', 'ATTEMPT_ID'];
				}
			],
			['unsupported event kind', (value) => (event(value, 0).kind = 'UNKNOWN_EVENT')],
			['unsupported schema', (value) => (value.schemaVersion = 'runtime-trace/0')],
			[
				'overlapping covered and missing findings',
				(value) => {
					record(value.coverage).missingFindingIds = [9];
				}
			],
			[
				'incomplete finding population',
				(value) => {
					record(value.coverage).findingIds = [9, 19, 45, 54];
				}
			],
			[
				'duplicate artifact path',
				(value) => {
					const artifacts = array(value.artifacts);
					artifacts.push(structuredClone(artifacts[0]));
				}
			],
			['noncontiguous event sequence', (value) => (event(value, 0).sequence = 1)],
			[
				'nonmonotonic event timestamp',
				(value) => {
					event(value, 0).at = '2026-08-25T12:00:00.900Z';
					event(value, 1).at = '2026-08-25T12:00:00.100Z';
				}
			]
		];

		for (const [label, mutate] of malformedCases) {
			const value = structuredClone(trace(context)) as unknown as MutableRecord;
			mutate(value);
			expect(importDeterministicRuntimeTrace(JSON.stringify(value), context), label).toMatchObject({
				health: 'MALFORMED',
				usableForCurrentSubject: false
			});
		}
	});
});
