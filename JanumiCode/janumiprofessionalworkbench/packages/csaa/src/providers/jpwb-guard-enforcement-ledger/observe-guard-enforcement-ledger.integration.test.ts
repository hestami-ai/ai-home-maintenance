import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER,
	GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT,
	GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE,
	GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION,
	GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT,
	GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY,
	type GuardEnforcementLedgerBudgets
} from '../../contracts/guard-enforcement-ledger.js';
import { SUBJECT_POLICY_VERSION, SUBJECT_REQUEST_SCHEMA_VERSION } from '../../contracts/subject.js';
import { resolveSubject } from '../../subject/resolve-subject.js';
import { buildGuardEnforcementLedgerArtifactSet } from './artifact-set.js';
import {
	type GuardEnforcementLedgerProgressEvent,
	observeGuardEnforcementLedger
} from './observe-guard-enforcement-ledger.js';
import { validateGuardEnforcementLedgerObservation } from './validate-guard-enforcement-ledger.js';

const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

// These are integration-test acceptance and cancellation budgets, not JPWB
// product ceilings. This test builds no semantic snapshot or graph.
const OBSERVER_BUDGETS: GuardEnforcementLedgerBudgets = {
	maxArtifacts: 10_000,
	maxAuditEntries: 10_000,
	maxDiagnostics: 100,
	maxExecutorDurationMs: 120_000,
	maxExternalModuleBytes: 128 * 1024 * 1024,
	maxExternalModuleFiles: 10_000,
	maxGuardedArrows: 10_000,
	maxGuardTexts: 10_000,
	maxLedgerRows: 10_000,
	maxMaterializedBytes: 128 * 1024 * 1024,
	maxOutputStringCharacters: 20_000_000,
	maxRawArrayEntries: 100_000,
	maxRawJsonDepth: 20,
	maxStderrBytes: 1024 * 1024,
	maxStdoutBytes: 64 * 1024 * 1024
};

const EXPECTED_PROGRESS: readonly (readonly [string, string])[] = [
	['REQUEST_AND_ARTIFACT_BIND', 'STARTED'],
	['REQUEST_AND_ARTIFACT_BIND', 'COMPLETED'],
	['EXECUTOR_ENVIRONMENT_CAPTURE', 'STARTED'],
	['EXECUTOR_ENVIRONMENT_CAPTURE', 'COMPLETED'],
	['CAPSULE_MATERIALIZATION', 'STARTED'],
	['CAPSULE_MATERIALIZATION', 'COMPLETED'],
	['RETAINED_VERIFIER_EXECUTION', 'STARTED'],
	['RETAINED_VERIFIER_EXECUTION', 'COMPLETED'],
	['POST_EXECUTION_INTEGRITY_RECHECK', 'STARTED'],
	['POST_EXECUTION_INTEGRITY_RECHECK', 'COMPLETED'],
	['RETAINED_VERIFIER_RESULT_ACCEPTANCE', 'STARTED'],
	['RETAINED_VERIFIER_RESULT_ACCEPTANCE', 'COMPLETED'],
	['WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE', 'STARTED'],
	['WORKER_OUTPUT_PARSE_AND_RUNTIME_RECONCILE', 'COMPLETED'],
	['OBSERVATION_NORMALIZATION', 'STARTED'],
	['OBSERVATION_NORMALIZATION', 'COMPLETED'],
	['CAPSULE_CLEANUP', 'STARTED'],
	['CAPSULE_CLEANUP', 'COMPLETED']
];

describe('JPWB retained guard-enforcement ledger real-subject integration', () => {
	it('reproduces the current retained classifications across isolated capsules', async () => {
		const resolution = resolveSubject({
			budgets: {
				maxBytes: 2 * 1024 * 1024 * 1024,
				maxConfigDepth: 64,
				maxDiagnostics: 100_000,
				maxDurationMs: 300_000,
				maxFiles: 100_000,
				maxProjects: 200
			},
			expectEmpty: false,
			filters: { exclude: [], include: [] },
			operationVersion: 'jan-csaa-guard-enforcement-ledger-integration/1.0.0',
			outputs: [],
			policyVersion: SUBJECT_POLICY_VERSION,
			rootLocator: ROOT,
			schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
			scope: { kind: 'REPOSITORY' },
			subjectKind: 'WORKTREE'
		});
		expect(resolution.outcome, JSON.stringify(resolution)).toBe('resolved');
		if (resolution.outcome !== 'resolved') throw new Error(JSON.stringify(resolution));
		const { subject } = resolution;
		const artifactSetOutcome = buildGuardEnforcementLedgerArtifactSet(
			{
				budgets: {
					maxArtifacts: OBSERVER_BUDGETS.maxArtifacts,
					maxDiagnostics: OBSERVER_BUDGETS.maxDiagnostics,
					maxTotalBytes: OBSERVER_BUDGETS.maxMaterializedBytes
				},
				operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
				schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
				subjectId: subject.descriptor.subjectId
			},
			{ subject }
		);
		expect(artifactSetOutcome.outcome, JSON.stringify(artifactSetOutcome)).toBe('complete');
		if (artifactSetOutcome.outcome !== 'complete')
			throw new Error(JSON.stringify(artifactSetOutcome));

		const request = {
			artifactSetId: artifactSetOutcome.artifactSet.id,
			budgets: OBSERVER_BUDGETS,
			operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
			schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
			subjectId: subject.descriptor.subjectId
		};
		const invalidArtifactSet = structuredClone(artifactSetOutcome.artifactSet) as unknown as {
			contentDigest: string;
		};
		invalidArtifactSet.contentDigest = '0'.repeat(64);
		expect(
			await observeGuardEnforcementLedger(request, {
				artifactSet: invalidArtifactSet as never,
				subject
			})
		).toMatchObject({
			diagnostics: [{ code: 'ARTIFACT_SET_INVALID', phase: 'BIND' }],
			outcome: 'unavailable'
		});
		expect(
			await observeGuardEnforcementLedger(
				{ ...request, subjectId: 'different-subject' },
				{ artifactSet: artifactSetOutcome.artifactSet, subject }
			)
		).toMatchObject({
			diagnostics: [{ code: 'SUBJECT_ID_MISMATCH', phase: 'BIND' }],
			outcome: 'unavailable'
		});
		expect(
			await observeGuardEnforcementLedger(
				{ ...request, artifactSetId: 'different-artifact-set' as never },
				{ artifactSet: artifactSetOutcome.artifactSet, subject }
			)
		).toMatchObject({
			diagnostics: [{ code: 'ARTIFACT_SET_IDENTITY_MISMATCH', phase: 'BIND' }],
			outcome: 'unavailable'
		});
		expect(
			await observeGuardEnforcementLedger(
				{
					...request,
					budgets: { ...OBSERVER_BUDGETS, maxExternalModuleBytes: 1 }
				},
				{ artifactSet: artifactSetOutcome.artifactSet, subject }
			)
		).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXHAUSTED', phase: 'BIND' }],
			outcome: 'unavailable'
		});
		expect(
			await observeGuardEnforcementLedger(
				{
					...request,
					budgets: { ...OBSERVER_BUDGETS, maxMaterializedBytes: 1 }
				},
				{ artifactSet: artifactSetOutcome.artifactSet, subject }
			)
		).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXHAUSTED', phase: 'BIND' }],
			outcome: 'unavailable'
		});
		const progress: GuardEnforcementLedgerProgressEvent[] = [];
		const first = await observeGuardEnforcementLedger(
			request,
			{ artifactSet: artifactSetOutcome.artifactSet, subject },
			{ onProgress: (event) => progress.push(event) }
		);
		// A hostile telemetry sink is deliberately unable to affect evidence or
		// outcome. This second capsule simultaneously checks determinism.
		const second = await observeGuardEnforcementLedger(
			request,
			{ artifactSet: artifactSetOutcome.artifactSet, subject },
			{
				onProgress: () => {
					throw new Error('telemetry sink must remain out of band');
				}
			}
		);
		expect(first.outcome, JSON.stringify(first)).toBe('complete');
		expect(second.outcome, JSON.stringify(second)).toBe('complete');
		if (first.outcome === 'unavailable' || second.outcome === 'unavailable') return;

		expect(second.observation).toEqual(first.observation);
		expect(validateGuardEnforcementLedgerObservation(first.observation, subject)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(first.observation.coverage).toEqual({
			arrowOccurrences: 146,
			classifiedGuardTexts: 82,
			distinctGuardTexts: 82,
			enforcedAnchorBroken: 0,
			enforcedWithoutSite: 0,
			ledgerRows: 82,
			reconciles: true,
			staleLedgerRows: 0,
			unclassifiedGuardTexts: 0
		});
		expect(first.observation.rawEvidence.audit).toEqual({
			arrowCount: 146,
			counts: [
				// The merge flips "Replacement intent identified" from ARROW_UNREACHABLE to ENFORCED, with a real
				// site at packages/rph-application/src/handlers/intent.ts:421 and a real anchor. A legitimate
				// baseline move, not a weakening: the enforcedWithoutSite / enforcedAnchorBroken assertions below
				// are deliberately untouched, so a row that claimed ENFORCED without a resolvable site would
				// still redden this test.
				{ count: 21, disposition: 'ARROW_UNREACHABLE' },
				{ count: 15, disposition: 'ENFORCED' },
				{ count: 2, disposition: 'REDUNDANT_WITH_MACHINE' },
				{ count: 44, disposition: 'UNENFORCED' }
			],
			enforcedAnchorBroken: [],
			enforcedWithoutSite: [],
			stale: [],
			textCount: 82,
			unclassified: []
		});
		expect(first.observation).toMatchObject({
			authorityTransfer: GUARD_ENFORCEMENT_LEDGER_AUTHORITY_TRANSFER,
			baselineChange: GUARD_ENFORCEMENT_LEDGER_BASELINE_CHANGE,
			gateEffect: GUARD_ENFORCEMENT_LEDGER_GATE_EFFECT,
			health: 'PARTIAL',
			integrationStrategy: GUARD_ENFORCEMENT_LEDGER_INTEGRATION_STRATEGY,
			oracleChange: GUARD_ENFORCEMENT_LEDGER_ORACLE_CHANGE,
			replacementEquivalence: GUARD_ENFORCEMENT_LEDGER_REPLACEMENT_EQUIVALENCE,
			retainedTestExecution: GUARD_ENFORCEMENT_LEDGER_RETAINED_TEST_EXECUTION,
			runtimeEnforcement: GUARD_ENFORCEMENT_LEDGER_RUNTIME_ENFORCEMENT,
			verifierAuthority: GUARD_ENFORCEMENT_LEDGER_VERIFIER_AUTHORITY
		});
		expect(first.observation.limitations.map((limitation) => limitation.code)).toEqual([
			'CLASSIFICATION_IS_RETAINED_REVIEW_JUDGMENT',
			'CONTROL_FLOW_NOT_ANALYZED',
			'EFFECTS_EVENTS_PERSISTENCE_NOT_ANALYZED',
			'IN_MEMORY_OBJECT_WIDTH_NOT_BOUNDED',
			'POST_EXECUTION_ACCEPTANCE_BOUNDS',
			'RETAINED_SUBJECT_INITIALIZERS_MAY_EXECUTE',
			'RETAINED_TEST_NOT_EXECUTED_BY_CSAA',
			'RUNTIME_ENFORCEMENT_NOT_CLAIMED',
			'STRUCTURAL_VALIDATION_NOT_EXECUTOR_REPLAY'
		]);
		expect(progress.map((event) => [event.phase, event.state])).toEqual(EXPECTED_PROGRESS);
		expect(
			progress.find(
				(event) => event.phase === 'OBSERVATION_NORMALIZATION' && event.state === 'COMPLETED'
			)?.details.validationState
		).toBe('VALID');
		expect(
			progress
				.filter((event) => event.state !== 'STARTED')
				.every((event) => typeof event.durationMs === 'number' && event.durationMs >= 0)
		).toBe(true);
		expect(JSON.stringify(progress)).not.toMatch(/capsuleRoot|packageRoot|resolvedPath/u);
		const observationJson = JSON.stringify(first.observation);
		expect(observationJson).not.toContain(ROOT);
		expect(observationJson).not.toContain(process.execPath);
		expect(first.observation.executor.externalModules.map((module) => module.name)).toEqual([
			'typescript',
			'ulid',
			'zod'
		]);
	}, 360_000);
});
