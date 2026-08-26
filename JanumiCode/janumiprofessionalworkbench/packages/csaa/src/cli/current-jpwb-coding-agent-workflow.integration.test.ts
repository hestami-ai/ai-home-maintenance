import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	AGENT_OPERATION_PROTOCOL_VERSION,
	AGENT_OPERATION_VERSIONS,
	validateAgentOperationExchange,
	type AgentOperation,
	type AgentOperationRequest
} from '../agent/agent-operation-protocol.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION
} from '../contracts/semantic.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
	type SemanticSourceQueryReportOutcome
} from '../contracts/semantic-source-query-report.js';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION
} from '../contracts/static-module-impact-candidate-report.js';
import type { FrozenSubject, ResolveSubjectRequest } from '../contracts/subject.js';
import { CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS } from '../graph/run-current-dependency-cruiser-differential.js';
import { projectSubjectForInventory } from '../inventory/project-subject-for-inventory.js';
import { JPWB_HYBRID_STATIC_REQUIRED_PATHS } from '../providers/runtime/project-hybrid-static-prerequisites.js';
import type { ProviderRunInput } from '../providers/runtime/provider-evidence.js';
import { HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES } from '../rules/harmonization-first-increment-rules.js';
import { JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION } from '../rules/jpwb-harmonization-native-projection.js';
import { canonicalSemanticJsonWitness } from '../semantic/canonical.js';
import { verifyFrozenSubject } from '../subject/freshness.js';
import { readFrozenSubjectArtifact } from '../subject/frozen-store.js';
import { resolveSubject } from '../subject/resolve-subject.js';
import {
	CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS,
	codingAgentCliArtifactDigest,
	publishCodingAgentCliJsonArtifact,
	readCodingAgentCliJsonArtifact,
	type CodingAgentCliArtifactStore
} from './coding-agent-cli-artifact-store.js';
import {
	CODING_AGENT_CLI_INPUT_CONTRACT_ID,
	CODING_AGENT_CLI_INPUT_VERSION,
	codingAgentCliInputDigest,
	type CodingAgentCliOperationInput
} from './coding-agent-cli-contract.js';
import {
	CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION,
	CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
	CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION,
	CODING_AGENT_CLI_LOCAL_CAPABILITIES,
	CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS,
	CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
	CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
	composeCodingAgentCliHandlers,
	type CodingAgentCliExplanationResultArtifact,
	type CodingAgentCliFindingsResultArtifact,
	type CodingAgentCliSnapshotResultArtifact,
	type CodingAgentCliVerificationResultArtifact
} from './compose-coding-agent-cli-handlers.js';
import { ContentAddressedCodingAgentCliArtifactStore } from './content-addressed-coding-agent-cli-artifact-store.js';
import { runCodingAgentCli, type CodingAgentCliRunResult } from './run-coding-agent-cli.js';

const CURRENT_REPOSITORY_WORKFLOW_ENABLED = process.env.CSAA_CURRENT_REPOSITORY_WORKFLOW === '1';
const currentRepositoryIt = CURRENT_REPOSITORY_WORKFLOW_ENABLED ? it : it.skip;
const REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../../../../', import.meta.url)));
const REQUESTED_AT = '2026-08-25T00:00:00.000Z';
const USER_REQUEST_DIGEST = 'a'.repeat(64);
const SUBJECT_OPERATION_VERSION = 'jan-csaa-current-jpwb-workflow-integration/0.1.0';

const AGENT_BUDGETS = Object.freeze({
	maxDepth: 256,
	maxEdges: 5_000_000,
	maxNodes: 1_000_000,
	maxOutputBytes: 128 * 1024 * 1024,
	maxResults: 250_000,
	timeoutMs: 600_000
});

const SEMANTIC_BUDGETS = Object.freeze({
	maxAstDepth: 256,
	maxAstNodes: 1_000_000,
	maxCompilerFacts: 1_000_000,
	maxCompilerInputMetadataBytes: 16_000_000,
	maxCompilerQueries: 1_000_000,
	maxCompilerQueryInvocations: 5_000_000,
	maxContextBytes: 16_000_000,
	maxContextFileBytes: 16_000_000,
	maxContextFiles: 1_000,
	maxDiagnosticCharacters: 5_000_000,
	maxDiagnostics: 50_000,
	maxDirectoryEntries: 1_000_000,
	maxDurationMs: 300_000,
	maxLiteralCharacters: 10_000,
	maxPathCharacters: 4_096,
	maxProjects: 10,
	maxScopes: 1_000_000,
	maxSnapshotBytes: 96 * 1024 * 1024,
	maxSources: 1_000
});

const NATIVE_BUDGETS = Object.freeze({
	maxArtifacts: 20_000,
	maxAstNodes: 1_000_000,
	maxDurationMs: 120_000,
	maxResultBytes: 512 * 1024,
	maxSourceBytes: 16_000_000
});

const QUERY_BUDGETS = Object.freeze({
	maxDiagnostics: 50_000,
	maxResultBytes: 8_000_000,
	maxResultRecords: 100_000,
	query: {
		maxDepth: 8,
		maxEvaluations: 1_000_000,
		maxFanout: 16,
		maxNodes: 64,
		maxPopulation: 10_000,
		maxTraceNodes: 1_000_000
	},
	semantic: SEMANTIC_BUDGETS,
	subject: {
		maxBytes: 16_000_000,
		maxConfigDepth: 64,
		maxDiagnostics: 50_000,
		maxDurationMs: 180_000,
		maxFiles: 20_000,
		maxProjects: 10
	}
});

const IMPACT_BUDGETS = Object.freeze({
	maxCandidateWitnessHops: 16_384,
	maxResultBytes: 1 * 1024 * 1024,
	reachability: {
		maxDiagnostics: 50_000,
		maxEdges: 1_000_000,
		maxFrontierRecords: 100_000,
		maxInputRecords: 1_000_000,
		maxInputStringCharacters: 16_000_000,
		maxNodes: 100_000,
		maxReachableNodes: 100_000,
		maxTraversalSteps: 2_000_000,
		maxWitnessEdges: 1_000_000
	},
	semantic: SEMANTIC_BUDGETS,
	subject: QUERY_BUDGETS.subject
});

// This one-process smoke deliberately remains a bounded useful-partial subject, not the native
// exemplar-closure corpus. Its widest exact native-rule population measures 371 members and stays
// explicit under the calibrated 512-member ceiling; larger populations still fail closed rather
// than collapsing into a census surrogate. All 23 positive/nearby-negative native profiles are
// exercised separately. These exact additions admit the five hybrid source prerequisites while
// the asserted native UNSUPPORTED total preserves the excluded regions.
const CURRENT_WORKFLOW_EXACT_FILES = Object.freeze([
	...CURRENT_DEPENDENCY_CRUISER_G4_CLOSURE_INPUT_PATHS,
	...Object.values(JPWB_HYBRID_STATIC_REQUIRED_PATHS),
	'packages/rph-assurance/src/floor.ts'
]);

const CURRENT_WORKFLOW_PROJECT_CONFIG_PATH =
	'packages/csaa/command-subjects/current-jpwb-coding-agent/tsconfig.json';

const CURRENT_WORKFLOW_CONTEXT_FILES = Object.freeze([
	'package.json',
	'apps/rph-demo/package.json',
	'packages/csaa/package.json',
	'packages/rph-application/package.json',
	'packages/rph-assurance/package.json',
	'packages/rph-authoring/package.json',
	'packages/rph-contracts/package.json',
	'packages/rph-domain/package.json',
	'packages/rph-engine/package.json',
	'packages/rph-persistence/package.json',
	'packages/rph-ports/package.json',
	'packages/rph-product-realization-pwa/package.json',
	'packages/rph-projections/package.json',
	'packages/typescript-config/package.json'
]);

const EXACT_SLICE_FILTERS = Object.freeze([
	...CURRENT_WORKFLOW_EXACT_FILES,
	...CURRENT_WORKFLOW_CONTEXT_FILES,
	CURRENT_WORKFLOW_PROJECT_CONFIG_PATH
]);

type CompletedCliRun = Extract<CodingAgentCliRunResult, { readonly state: 'COMPLETED' }>;

function sha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function unusableRuntimeControlRun(): ProviderRunInput {
	return Object.freeze({
		command: Object.freeze(['declared-unusable-runtime-control']),
		endedAt: '2026-08-24T23:59:59.000Z',
		environmentSha256: sha256('unobserved-runtime-control-environment'),
		outputComplete: false,
		profile: 'declared-unusable-no-runtime-observation',
		provider: Object.freeze({
			configurationSha256: sha256('unobserved-runtime-control-configuration'),
			dependencyClosureSha256: sha256('unobserved-runtime-control-dependency-closure'),
			executableSha256: sha256('unobserved-runtime-control-executable'),
			id: 'unqualified-negative-control-provider',
			version: '0.0.0'
		}),
		runId: 'declared-unusable-runtime-control-001',
		startedAt: '2026-08-24T23:59:58.000Z',
		subjectId: 'deliberately-mismatched-subject',
		subjectManifestSha256: sha256('deliberately-mismatched-manifest'),
		termination: Object.freeze({ exitCode: 1, kind: 'EXITED' })
	});
}

function unusableRuntimeControlArtifact() {
	return Object.freeze({
		kind: 'DECLARED_UNUSABLE_RUNTIME_CONTROL',
		nonclaim: 'NO_RUNTIME_OBSERVATION_OR_PROVIDER_QUALIFICATION'
	});
}

function exactAdditionalArtifacts(repositorySubject: FrozenSubject): readonly string[] {
	const availablePaths = new Set(repositorySubject.artifacts.map((artifact) => artifact.path));
	const paths = [...new Set([...CURRENT_WORKFLOW_EXACT_FILES, ...CURRENT_WORKFLOW_CONTEXT_FILES])];
	for (const path of paths) expect(availablePaths.has(path), path).toBe(true);
	return Object.freeze(paths);
}

function exactSubjectRequest(repositorySubject: FrozenSubject): ResolveSubjectRequest {
	const additionalArtifacts = exactAdditionalArtifacts(repositorySubject);
	return {
		...repositorySubject.request,
		budgets: {
			maxBytes: 16_000_000,
			maxConfigDepth: 64,
			maxDiagnostics: 50_000,
			maxDurationMs: 300_000,
			maxFiles: 20_000,
			maxProjects: 10
		},
		filters: { exclude: [], include: EXACT_SLICE_FILTERS },
		operationVersion: SUBJECT_OPERATION_VERSION,
		outputs: [],
		rootLocator: REPOSITORY_ROOT,
		scope: {
			additionalArtifacts,
			kind: 'EXPLICIT_PROJECTS',
			projects: [CURRENT_WORKFLOW_PROJECT_CONFIG_PATH]
		}
	};
}

function resolveExactSubject(request: ResolveSubjectRequest): FrozenSubject {
	const outcome = resolveSubject(request);
	expect(outcome.outcome, JSON.stringify(outcome)).toBe('resolved');
	if (outcome.outcome !== 'resolved') throw new Error(JSON.stringify(outcome));
	return outcome.subject;
}

function expectExactFrozenSubjectBytes(before: FrozenSubject, after: FrozenSubject): void {
	expect(after.descriptor).toEqual(before.descriptor);
	expect(after.population).toEqual(before.population);
	expect(after.artifacts).toEqual(before.artifacts);
	for (const artifact of before.artifacts) {
		const beforeBytes = readFrozenSubjectArtifact(before, artifact.path);
		const afterBytes = readFrozenSubjectArtifact(after, artifact.path);
		expect(beforeBytes, `${artifact.path} initial frozen bytes`).toBeDefined();
		expect(afterBytes, `${artifact.path} final frozen bytes`).toBeDefined();
		if (beforeBytes === undefined || afterBytes === undefined)
			throw new Error(`Frozen bytes are unavailable for ${artifact.path}.`);
		expect(sha256(beforeBytes), `${artifact.path} initial content digest`).toBe(artifact.sha256);
		expect(sha256(afterBytes), `${artifact.path} final content digest`).toBe(artifact.sha256);
		expect(
			Buffer.from(afterBytes).equals(Buffer.from(beforeBytes)),
			`${artifact.path} exact bytes`
		).toBe(true);
	}
}

async function publish(store: CodingAgentCliArtifactStore, value: unknown): Promise<string> {
	return (
		await publishCodingAgentCliJsonArtifact(
			store,
			value,
			CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
		)
	).reference;
}

function capabilityFor(operation: AgentOperation): {
	readonly capabilityId: string;
	readonly capabilityVersion: string;
} {
	if (operation === 'snapshot')
		return {
			capabilityId: 'JAN-CSAA-CAP-001',
			capabilityVersion: 'JAN-CSAA-CAP-001@0.1.0'
		};
	if (operation === 'query')
		return {
			capabilityId: 'JAN-CSAA-CAP-029',
			capabilityVersion: 'JAN-CSAA-CAP-029@0.1.0'
		};
	if (operation === 'impact')
		return {
			capabilityId: 'JAN-CSAA-CAP-031',
			capabilityVersion: 'JAN-CSAA-CAP-031@0.1.0'
		};
	if (
		operation === 'inventory' ||
		operation === 'findings' ||
		operation === 'explain' ||
		operation === 'verify'
	)
		return {
			capabilityId: CODING_AGENT_CLI_LOCAL_CAPABILITIES[operation],
			capabilityVersion: CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS[operation]
		};
	throw new Error('The current-repository workflow received an unsupported operation.');
}

function inputBase(operation: AgentOperation, identity: string) {
	return {
		bindingRef: `binding:current-jpwb:${operation}:${identity}`,
		output: 'STDOUT_JSON' as const,
		schemaVersion: CODING_AGENT_CLI_INPUT_VERSION
	};
}

function requestFor(
	operation: AgentOperation,
	identity: string,
	input: CodingAgentCliOperationInput,
	subjectId: string
): AgentOperationRequest {
	const digest = codingAgentCliInputDigest(input);
	if (digest.state !== 'VALID') throw new Error(JSON.stringify(digest));
	return {
		budgets: AGENT_BUDGETS,
		capabilityRequirement: {
			affectedQuestionRefs: [`question:current-jpwb:${operation}:${identity}`],
			...capabilityFor(operation),
			necessity: 'MANDATORY'
		},
		currentnessRequirement: { kind: 'REQUIRE_CURRENT' },
		messageKind: 'request',
		operation,
		operationInput: {
			contractId: CODING_AGENT_CLI_INPUT_CONTRACT_ID,
			contractVersion: CODING_AGENT_CLI_INPUT_VERSION,
			inputDigest: digest.digest,
			inputRef: input.bindingRef
		},
		operationVersion: AGENT_OPERATION_VERSIONS[operation],
		protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
		requestId: `request:current-jpwb:${operation}:${identity}`,
		requestedAt: REQUESTED_AT,
		subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId },
		work: {
			agentId: 'agent:current-jpwb-production-integration',
			authorityEnvelopeRef: 'authority:local-readonly',
			changeContract: {
				changeContractRef: 'change:current-jpwb-readonly-workflow',
				kind: 'REFERENCE'
			},
			employmentPoint: 'BEFORE_COMPLETION',
			userRequestDigest: USER_REQUEST_DIGEST,
			workPackageRef: 'work-package:DWP-007'
		}
	};
}

function completedRun(run: CodingAgentCliRunResult): CompletedCliRun {
	if (run.state !== 'COMPLETED') throw new Error(run.stderr);
	return run;
}

function terminalJson(run: CompletedCliRun): Record<string, unknown> {
	return JSON.parse(run.stdout.trim()) as Record<string, unknown>;
}

function admittedResultReference(terminal: Record<string, unknown>): string {
	return (terminal.partial as { admittedResultRefs: string[] }).admittedResultRefs[0]!;
}

async function invoke(
	handlers: ReturnType<typeof composeCodingAgentCliHandlers>,
	operation: AgentOperation,
	input: CodingAgentCliOperationInput,
	request: AgentOperationRequest
): Promise<Record<string, unknown>> {
	const run = completedRun(
		await runCodingAgentCli(
			[
				operation,
				'--request-json',
				JSON.stringify(request),
				'--input-json',
				JSON.stringify(input),
				'--output',
				'json'
			],
			{ handlers }
		)
	);
	expect(run.exitCode, `${run.stdout}\n${run.stderr}`).toBe(3);
	expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
	const terminal = terminalJson(run);
	expect(terminal, JSON.stringify(terminal)).toMatchObject({
		outcome: 'partial',
		state: 'partial'
	});
	return terminal;
}

describe('current JPWB production coding-agent workflow', () => {
	currentRepositoryIt(
		'executes all seven operations with native findings, source-bound hybrid rows, fail-closed runtime control, and exact-byte verification',
		{ timeout: 600_000 },
		async () => {
			const temporaryRoot = mkdtempSync(join(tmpdir(), 'csaa-current-jpwb-workflow-'));
			try {
				const repositorySubject = projectSubjectForInventory(REPOSITORY_ROOT);
				expect(verifyFrozenSubject(repositorySubject, { rootLocator: REPOSITORY_ROOT })).toEqual({
					changedPaths: [],
					diagnostics: [],
					state: 'CURRENT'
				});
				const subjectRequest = exactSubjectRequest(repositorySubject);
				const initialSubject = resolveExactSubject(subjectRequest);
				const initialArtifactPaths = new Set(
					initialSubject.artifacts.map((artifact) => artifact.path)
				);
				for (const path of CURRENT_WORKFLOW_EXACT_FILES)
					expect(initialArtifactPaths.has(path), `resolved exact artifact ${path}`).toBe(true);
				expect(verifyFrozenSubject(initialSubject, { rootLocator: REPOSITORY_ROOT })).toEqual({
					changedPaths: [],
					diagnostics: [],
					state: 'CURRENT'
				});

				const store = new ContentAddressedCodingAgentCliArtifactStore(
					join(temporaryRoot, 'artifacts')
				);
				const handlers = composeCodingAgentCliHandlers({
					artifactStore: store,
					repositoryRoot: REPOSITORY_ROOT
				});
				const inventoryRequestRef = await publish(store, {
					kind: 'REPOSITORY_INVENTORY_REQUEST',
					requireJpwbPopulations: true,
					rootLocator: '<repository-root>',
					schemaVersion: CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION
				});
				const inventoryInput: CodingAgentCliOperationInput = {
					...inputBase('inventory', 'current'),
					kind: 'INVENTORY',
					subjectInputRef: inventoryRequestRef
				};
				const inventoryTerminal = await invoke(
					handlers,
					'inventory',
					inventoryInput,
					requestFor('inventory', 'current', inventoryInput, repositorySubject.descriptor.subjectId)
				);
				const inventoryResultRef = admittedResultReference(inventoryTerminal);
				expect(
					await readCodingAgentCliJsonArtifact(
						store,
						inventoryResultRef,
						CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
					)
				).toMatchObject({
					capture: { subjectId: repositorySubject.descriptor.subjectId }
				});
				const subjectId = initialSubject.descriptor.subjectId;
				const snapshotRequestRef = await publish(store, {
					kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
					schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
					semanticRequest: {
						assignabilityRequests: [],
						budgets: SEMANTIC_BUDGETS,
						capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
						expectEmpty: false,
						operationVersion: SEMANTIC_OPERATION_VERSION,
						rootLocator: '<repository-root>',
						schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
						subjectId: '<resolved-subject>'
					},
					subjectRequest: { ...subjectRequest, rootLocator: '<repository-root>' }
				});
				const snapshotInput: CodingAgentCliOperationInput = {
					...inputBase('snapshot', 'current'),
					kind: 'SNAPSHOT',
					subjectInputRef: snapshotRequestRef
				};
				const snapshotRequest = requestFor('snapshot', 'current', snapshotInput, subjectId);
				const snapshotTerminal = await invoke(handlers, 'snapshot', snapshotInput, snapshotRequest);
				expect(snapshotTerminal.currentness).toMatchObject({
					status: 'current-for-subject',
					subject: { subjectId }
				});
				const snapshotRef = admittedResultReference(snapshotTerminal);
				const snapshotResult = (await readCodingAgentCliJsonArtifact(
					store,
					snapshotRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
				)) as CodingAgentCliSnapshotResultArtifact;
				expect(snapshotResult).toMatchObject({
					buildOutcome: 'partial',
					captureRequestRef: snapshotRequestRef,
					snapshot: {
						health: 'PARTIAL',
						subjectId
					}
				});
				expect(snapshotResult.diagnostics).toHaveLength(7);
				expect(snapshotResult.diagnostics).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							code: 'CAPABILITY_UNSUPPORTED',
							phase: 'EXTRACT',
							severity: 'WARNING'
						})
					])
				);
				expect(snapshotResult.snapshot.programs).toHaveLength(1);
				expect(snapshotResult.snapshot.sources.length).toBeGreaterThan(0);
				expect(snapshotResult.snapshot.capabilities).toEqual(
					expect.arrayContaining([
						expect.objectContaining({ capability: 'TS_PROJECT', state: 'SUPPORTED' }),
						expect.objectContaining({ capability: 'TS_SYMBOL', state: 'PARTIAL' }),
						expect.objectContaining({ capability: 'TS_SYNTAX', state: 'SUPPORTED' })
					])
				);
				const snapshotId = snapshotResult.snapshot.id;

				const queryRequestRef = await publish(store, {
					budgets: QUERY_BUDGETS,
					executionId: 'current-jpwb-query-001',
					expression: {
						field: 'logicalPath',
						kind: 'EQUALS',
						nodeId: 'root',
						value: 'packages/rph-contracts/src/common.ts'
					},
					operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
					schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: [CURRENT_WORKFLOW_PROJECT_CONFIG_PATH]
				});
				const queryInput: CodingAgentCliOperationInput = {
					...inputBase('query', 'current'),
					kind: 'QUERY',
					queryRef: queryRequestRef,
					snapshotRef
				};
				const queryTerminal = await invoke(
					handlers,
					'query',
					queryInput,
					requestFor('query', 'current', queryInput, subjectId)
				);
				const queryResultRef = admittedResultReference(queryTerminal);
				const queryResult = (await readCodingAgentCliJsonArtifact(
					store,
					queryResultRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
				)) as SemanticSourceQueryReportOutcome;
				expect(queryResult).toMatchObject({
					result: {
						population: { semanticSnapshotId: snapshotId },
						partitions: { supportedMatches: expect.any(Array) }
					}
				});
				if (queryResult.outcome !== 'partial') throw new Error(JSON.stringify(queryResult));
				const querySourcePaths = new Map(
					queryResult.result.evaluations.map((evaluation) => [
						evaluation.source.id,
						evaluation.source.logicalPath
					])
				);
				expect(
					queryResult.result.partitions.supportedMatches.map((id) => querySourcePaths.get(id))
				).toEqual(['packages/rph-contracts/src/common.ts']);

				const impactSeed = initialSubject.artifacts.find(
					(artifact) => artifact.path === 'packages/rph-contracts/src/common.ts'
				);
				expect(impactSeed).toBeDefined();
				if (impactSeed === undefined) throw new Error('The current impact seed is unavailable.');
				const impactRequestRef = await publish(store, {
					budgets: IMPACT_BUDGETS,
					operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
					schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
					seed: {
						basis: 'CALLER_DECLARED_WORKING_CHANGE_SET',
						expectedArtifactSha256: impactSeed.sha256,
						id: 'seed:current-jpwb-rph-contracts-common',
						logicalPath: impactSeed.path,
						operation: 'EDIT',
						projectConfigPath: CURRENT_WORKFLOW_PROJECT_CONFIG_PATH,
						schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
						scope: 'WHOLE_SOURCE',
						workingChangeSetId: 'working-change:current-jpwb-readonly-plan'
					},
					subjectProjectConfigPaths: [CURRENT_WORKFLOW_PROJECT_CONFIG_PATH]
				});
				const impactInput: CodingAgentCliOperationInput = {
					...inputBase('impact', 'current'),
					changeSetRef: impactRequestRef,
					kind: 'IMPACT',
					snapshotRef
				};
				const impactTerminal = await invoke(
					handlers,
					'impact',
					impactInput,
					requestFor('impact', 'current', impactInput, subjectId)
				);
				const impactResultRef = admittedResultReference(impactTerminal);
				expect(
					await readCodingAgentCliJsonArtifact(
						store,
						impactResultRef,
						CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
					)
				).toMatchObject({
					result: { invalidationDependencies: { semanticSnapshotId: snapshotId } }
				});

				const nativeExecutionId = 'current-jpwb-native-projection-001';
				const runtimeControlRun = unusableRuntimeControlRun();
				const runtimeControlRef = await publish(store, unusableRuntimeControlArtifact());
				const findingsRequestRef = await publish(store, {
					budgets: NATIVE_BUDGETS,
					executionDisposition: 'RUN',
					executionId: nativeExecutionId,
					hybridRuntimeEvidence: {
						assessedAt: REQUESTED_AT,
						freshnessWindowMs: 60_000,
						kind: 'SUPPLIED_DETERMINISTIC_RUNTIME_TRACE',
						run: runtimeControlRun,
						traceRef: runtimeControlRef
					},
					hybridStaticObservedAt: REQUESTED_AT,
					kind: 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST',
					operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
					schemaVersion: CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
					snapshotRef
				});
				const findingsInput: CodingAgentCliOperationInput = {
					...inputBase('findings', 'current'),
					kind: 'FINDINGS',
					ruleProfileRef: findingsRequestRef,
					snapshotRef
				};
				const findingsTerminal = await invoke(
					handlers,
					'findings',
					findingsInput,
					requestFor('findings', 'current', findingsInput, subjectId)
				);
				const findingsResultRef = admittedResultReference(findingsTerminal);
				const findingsResult = (await readCodingAgentCliJsonArtifact(
					store,
					findingsResultRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
				)) as CodingAgentCliFindingsResultArtifact;
				expect(findingsResult.currentness).toEqual({
					afterProjection: { changedPaths: [], diagnostics: [], state: 'CURRENT' },
					basis: 'INDEPENDENT_EXACT_FROZEN_SUBJECT_BYTE_RECHECK_BEFORE_AND_AFTER',
					beforeProjection: { changedPaths: [], diagnostics: [], state: 'CURRENT' }
				});
				expect(findingsResult.hybridEvidence.staticProjection.population).toEqual({
					conflicting: 0,
					conclusive: 5,
					expected: 5,
					produced: 5,
					reconciles: true,
					unsupported: 0
				});
				expect(
					findingsResult.hybridEvidence.staticProjection.rows.map((row) => [
						row.findingId,
						row.prerequisite.state
					])
				).toEqual([
					[9, 'NOT_SATISFIED'],
					[19, 'NOT_SATISFIED'],
					[45, 'SATISFIED'],
					[54, 'SATISFIED'],
					[55, 'SATISFIED']
				]);
				expect(findingsResult.hybridEvidence.runtimeTraceRef).toBe(runtimeControlRef);
				expect(findingsResult.hybridEvidence.runtimeTrace).toMatchObject({
					availability: 'PRESENT',
					coverage: { state: 'NONE' },
					freshness: { state: 'UNKNOWN' },
					health: 'FAILED',
					usableForCurrentSubject: false
				});
				expect(findingsResult.hybridEvidence.runtimeTrace?.conflicts.length).toBeGreaterThan(0);
				expect(
					findingsResult.hybridEvidence.runtimeEvaluation?.rows.map((row) => [
						row.findingId,
						row.status
					])
				).toEqual([
					[9, 'NOT_RUN'],
					[19, 'NOT_RUN'],
					[45, 'NOT_RUN'],
					[54, 'NOT_RUN'],
					[55, 'NOT_RUN']
				]);
				expect(findingsResult.nativeProjectionOutcome.outcome).toBe('projected');
				if (findingsResult.nativeProjectionOutcome.outcome !== 'projected')
					throw new Error(JSON.stringify(findingsResult.nativeProjectionOutcome));
				const nativeResult = findingsResult.nativeProjectionOutcome.result;
				expect(nativeResult.currentRepositoryStatusTotals).toEqual({
					DETECTED: 5,
					NOT_APPLICABLE: 0,
					NOT_DETECTED: 0,
					NOT_RUN: 0,
					UNSUPPORTED: 18
				});
				expect(nativeResult.projections).toHaveLength(23);
				expect(nativeResult.projections.map((projection) => projection.findingId)).toEqual(
					HARMONIZATION_FIRST_INCREMENT_RULE_PROFILES.map((profile) => profile.findingId)
				);
				const conclusiveStatuses = new Map<number, string>([
					[11, 'DETECTED'],
					[30, 'DETECTED'],
					[31, 'DETECTED'],
					[40, 'DETECTED'],
					[73, 'DETECTED']
				]);
				for (const projection of nativeResult.projections) {
					expect(projection.evaluation.outcome).toBe('evaluated');
					if (projection.evaluation.outcome !== 'evaluated')
						throw new Error(`Finding ${projection.findingId} was not evaluated.`);
					expect(projection.evaluation.result.status).toBe(
						conclusiveStatuses.get(projection.findingId) ?? 'UNSUPPORTED'
					);
					if (conclusiveStatuses.has(projection.findingId)) {
						expect(projection).toMatchObject({
							population: { closure: 'CLOSED' },
							projectionState: 'CURRENT_CLOSED',
							support: {
								exactPhysicalPopulation: true,
								physicalPopulationBasis: 'EXACT_RULE_ELIGIBLE_PATH_POPULATION'
							}
						});
					}
				}
				const widestProjection = nativeResult.projections.find(
					(projection) => projection.findingId === 31
				);
				expect(widestProjection?.population).toMatchObject({ count: 371 });
				expect(widestProjection?.population.members).toHaveLength(371);
				expect(
					canonicalSemanticJsonWitness(findingsResult.nativeProjectionOutcome).bytes
				).toBeLessThanOrEqual(NATIVE_BUDGETS.maxResultBytes);
				expect(nativeResult).toMatchObject({
					analysisAuthority: 'NONE',
					authorityTransfer: 'NONE',
					capability: {
						detectorExecution: 'PERFORMED_OVER_EXACT_FROZEN_SUBJECT_BYTES',
						gateEffect: 'NONE',
						nativeProjection: 'IMPLEMENTATION_LOCAL_UNREGISTERED_PROVIDER'
					},
					currentness: {
						basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_RECHECKED',
						frozenSubjectId: subjectId,
						state: 'CURRENT'
					},
					executionId: nativeExecutionId
				});

				const selectedProjection = nativeResult.projections.find(
					(projection) => projection.findingId === 11
				);
				expect(selectedProjection).toBeDefined();
				if (
					selectedProjection === undefined ||
					selectedProjection.evaluation.outcome !== 'evaluated'
				)
					throw new Error('Current finding 11 projection is unavailable.');
				expect(selectedProjection.evaluation.result.status).toBe('DETECTED');
				expect(selectedProjection.evaluation.result.finding).not.toBeNull();
				const explanationProfileRef = await publish(store, {
					evaluationId: selectedProjection.evaluation.result.evaluationId,
					findingFingerprint:
						selectedProjection.evaluation.result.finding?.findingFingerprint ?? null,
					findingId: selectedProjection.findingId,
					kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
					schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
				});
				const explainInput: CodingAgentCliOperationInput = {
					...inputBase('explain', 'finding-11'),
					explanationProfileRef,
					kind: 'EXPLAIN',
					resultRef: findingsResultRef
				};
				const explanationTerminal = await invoke(
					handlers,
					'explain',
					explainInput,
					requestFor('explain', 'finding-11', explainInput, subjectId)
				);
				const explanationResultRef = admittedResultReference(explanationTerminal);
				const explanationResult = (await readCodingAgentCliJsonArtifact(
					store,
					explanationResultRef,
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
				)) as CodingAgentCliExplanationResultArtifact;
				expect(explanationResult).toMatchObject({
					analysisAuthority: 'NONE',
					gateEffect: 'NONE',
					nativeProjection: {
						currentRepositoryStatusTotals: nativeResult.currentRepositoryStatusTotals,
						executionId: nativeExecutionId,
						resultWitness: nativeResult.resultWitness
					},
					replayCurrentness: {
						afterProjection: { changedPaths: [], diagnostics: [], state: 'CURRENT' },
						basis: 'INDEPENDENT_EXACT_FROZEN_SUBJECT_BYTE_RECHECK_BEFORE_AND_AFTER',
						beforeProjection: { changedPaths: [], diagnostics: [], state: 'CURRENT' }
					},
					source: {
						findingsResultRef,
						ruleProfileRef: findingsRequestRef,
						snapshotId,
						snapshotRef,
						subjectId
					}
				});
				expect(explanationResult.projection).toEqual(selectedProjection);

				const expectationRef = await publish(store, {
					assertions: [
						{
							artifactRef: inventoryResultRef,
							kind: 'ARTIFACT_DIGEST_EQUALS',
							sha256: codingAgentCliArtifactDigest(inventoryResultRef)
						},
						{
							artifactRef: queryResultRef,
							kind: 'ARTIFACT_DIGEST_EQUALS',
							sha256: codingAgentCliArtifactDigest(queryResultRef)
						},
						{
							artifactRef: impactResultRef,
							kind: 'ARTIFACT_DIGEST_EQUALS',
							sha256: codingAgentCliArtifactDigest(impactResultRef)
						},
						{
							artifactRef: findingsResultRef,
							kind: 'ARTIFACT_DIGEST_EQUALS',
							sha256: codingAgentCliArtifactDigest(findingsResultRef)
						},
						{
							artifactRef: findingsResultRef,
							expected: 5,
							kind: 'JSON_VALUE_EQUALS',
							path: [
								'nativeProjectionOutcome',
								'result',
								'currentRepositoryStatusTotals',
								'DETECTED'
							]
						},
						{
							artifactRef: findingsResultRef,
							expected: 0,
							kind: 'JSON_VALUE_EQUALS',
							path: [
								'nativeProjectionOutcome',
								'result',
								'currentRepositoryStatusTotals',
								'NOT_DETECTED'
							]
						},
						{
							artifactRef: findingsResultRef,
							expected: 18,
							kind: 'JSON_VALUE_EQUALS',
							path: [
								'nativeProjectionOutcome',
								'result',
								'currentRepositoryStatusTotals',
								'UNSUPPORTED'
							]
						},
						{
							artifactRef: findingsResultRef,
							expected: 'NONE',
							kind: 'JSON_VALUE_EQUALS',
							path: ['nativeProjectionOutcome', 'result', 'capability', 'gateEffect']
						},
						{
							artifactRef: findingsResultRef,
							expected: 5,
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'staticProjection', 'population', 'conclusive']
						},
						{
							artifactRef: findingsResultRef,
							expected: 'FAILED',
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'runtimeTrace', 'health']
						},
						{
							artifactRef: findingsResultRef,
							expected: false,
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'runtimeTrace', 'usableForCurrentSubject']
						},
						{
							artifactRef: findingsResultRef,
							expected: 'NOT_RUN',
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'runtimeEvaluation', 'rows', 0, 'status']
						},
						{
							artifactRef: findingsResultRef,
							expected: 'NOT_RUN',
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'runtimeEvaluation', 'rows', 1, 'status']
						},
						{
							artifactRef: findingsResultRef,
							expected: 'NOT_RUN',
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'runtimeEvaluation', 'rows', 2, 'status']
						},
						{
							artifactRef: findingsResultRef,
							expected: 'NOT_RUN',
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'runtimeEvaluation', 'rows', 3, 'status']
						},
						{
							artifactRef: findingsResultRef,
							expected: 'NOT_RUN',
							kind: 'JSON_VALUE_EQUALS',
							path: ['hybridEvidence', 'runtimeEvaluation', 'rows', 4, 'status']
						},
						{
							artifactRef: explanationResultRef,
							kind: 'ARTIFACT_DIGEST_EQUALS',
							sha256: codingAgentCliArtifactDigest(explanationResultRef)
						},
						{
							artifactRef: explanationResultRef,
							expected: findingsResultRef,
							kind: 'JSON_VALUE_EQUALS',
							path: ['source', 'findingsResultRef']
						},
						{
							artifactRef: explanationResultRef,
							expected: 11,
							kind: 'JSON_VALUE_EQUALS',
							path: ['projection', 'findingId']
						},
						{
							artifactRef: explanationResultRef,
							expected: 'DETECTED',
							kind: 'JSON_VALUE_EQUALS',
							path: ['projection', 'evaluation', 'result', 'status']
						},
						{
							artifactRef: explanationResultRef,
							expected: 'NONE',
							kind: 'JSON_VALUE_EQUALS',
							path: ['analysisAuthority']
						},
						{
							artifactRef: explanationResultRef,
							expected: 'NONE',
							kind: 'JSON_VALUE_EQUALS',
							path: ['gateEffect']
						}
					],
					kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
					schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
					snapshotId,
					subjectId
				});
				const verifyInput: CodingAgentCliOperationInput = {
					...inputBase('verify', 'current'),
					expectationRef,
					kind: 'VERIFY',
					subjectInputRef: snapshotRef
				};
				const verificationTerminal = await invoke(
					handlers,
					'verify',
					verifyInput,
					requestFor('verify', 'current', verifyInput, subjectId)
				);
				const verificationResult = (await readCodingAgentCliJsonArtifact(
					store,
					admittedResultReference(verificationTerminal),
					CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
				)) as CodingAgentCliVerificationResultArtifact;
				expect(verificationResult).toMatchObject({
					analysisAuthority: 'NONE',
					gateEffect: 'NONE',
					passed: true,
					snapshotBindingPassed: true,
					snapshotId,
					subjectBindingPassed: true,
					subjectId
				});
				expect(verificationResult.assertions).toHaveLength(22);
				expect(verificationResult.assertions.every((assertion) => assertion.passed)).toBe(true);

				expect(verifyFrozenSubject(initialSubject, { rootLocator: REPOSITORY_ROOT })).toEqual({
					changedPaths: [],
					diagnostics: [],
					state: 'CURRENT'
				});
				expect(verifyFrozenSubject(repositorySubject, { rootLocator: REPOSITORY_ROOT })).toEqual({
					changedPaths: [],
					diagnostics: [],
					state: 'CURRENT'
				});
				const finalSubject = resolveExactSubject(subjectRequest);
				expect(verifyFrozenSubject(finalSubject, { rootLocator: REPOSITORY_ROOT })).toEqual({
					changedPaths: [],
					diagnostics: [],
					state: 'CURRENT'
				});
				expectExactFrozenSubjectBytes(initialSubject, finalSubject);
			} finally {
				rmSync(temporaryRoot, { force: true, recursive: true });
			}
		}
	);
});
