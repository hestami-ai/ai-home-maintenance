import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	AGENT_OPERATION_PROTOCOL_VERSION,
	AGENT_OPERATION_VERSIONS,
	validateAgentOperationExchange,
	type AgentOperation,
	type AgentOperationRequest
} from '../agent/agent-operation-protocol.js';
import { INVENTORY_SCHEMA_VERSION, type InventoryDocument } from '../contracts/inventory.js';
import { canonicalJson as canonicalInventoryJson } from '../inventory/canonical.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
	type SemanticSourceQueryReportOutcome
} from '../contracts/semantic-source-query-report.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	type StaticSemanticSnapshot,
	type StaticSemanticSnapshotOutcome
} from '../contracts/semantic.js';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	type StaticModuleImpactCandidateReportOutcome
} from '../contracts/static-module-impact-candidate-report.js';
import type {
	FrozenSubject,
	SubjectFilters,
	SubjectResolutionOutcome
} from '../contracts/subject.js';
import {
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	type WorkingSourceEditImpactCandidateReportOutcome
} from '../contracts/working-source-edit-impact-candidate-report.js';
import {
	JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
	runJpwbHarmonizationNativeProjection
} from '../rules/jpwb-harmonization-native-projection.js';
import {
	DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION,
	DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID
} from '../providers/runtime/import-runtime-trace.js';
import {
	JPWB_HYBRID_STATIC_REQUIRED_PATHS,
	type JpwbHybridStaticPrerequisiteProjection
} from '../providers/runtime/project-hybrid-static-prerequisites.js';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from '../providers/runtime/provider-evidence.test-support.js';
import type { ProviderImportContext } from '../providers/runtime/provider-evidence.js';
import { attachFrozenSubjectBytes } from '../subject/frozen-store.js';
import {
	CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS,
	CodingAgentCliArtifactError,
	InMemoryCodingAgentCliArtifactStore,
	codingAgentCliArtifactDigest,
	codingAgentCliArtifactReference,
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
	CODING_AGENT_CLI_COMPOSITION_NONCLAIMS,
	CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS,
	CODING_AGENT_CLI_COMPOSITION_STATE,
	CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION,
	CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
	CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION,
	CODING_AGENT_CLI_LOCAL_CAPABILITIES,
	CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS,
	CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
	CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION,
	CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
	composeCodingAgentCliHandlers,
	type CodingAgentCliCompositionDependencies,
	type CodingAgentCliExplanationResultArtifact,
	type CodingAgentCliFindingsResultArtifact,
	type CodingAgentCliSnapshotResultArtifact
} from './compose-coding-agent-cli-handlers.js';
import { runCodingAgentCli, type CodingAgentCliRunResult } from './run-coding-agent-cli.js';

const USER_REQUEST_DIGEST = 'a'.repeat(64);
const SUBJECT_ID = 'subject:golden-current-worktree';
const SNAPSHOT_ID = 'SemanticSnapshot:golden-current-worktree';
const POST_SUBJECT_ID = 'subject:golden-post-change-worktree';
const POST_SNAPSHOT_ID = 'SemanticSnapshot:golden-post-change-worktree';
const REQUESTED_AT = '2026-08-25T00:00:00.000Z';
const HYBRID_OBSERVED_AT = '2026-08-25T12:00:01.500Z';

afterEach(cleanupProviderFixtures);

const HYBRID_RISKY_SOURCES = Object.freeze({
	'package.json': '{"name":"provider-fixture","private":true,"workspaces":["packages/*","apps/*"]}',
	'apps/rph-demo/package.json': '{"name":"@fixture/rph-demo","private":true,"version":"0.0.0"}',
	'apps/rph-demo/tsconfig.json': '{"include":["src"]}',
	'packages/demo/src/index.ts': 'export const fixtureAnchor = true;\n',
	'packages/rph-application/package.json':
		'{"name":"@fixture/rph-application","private":true,"version":"0.0.0"}',
	'packages/rph-application/tsconfig.json': '{"include":["src"]}',
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[9]]: `
function newEngine() { return createEngine({}); }
function uiCommand() {
	return { issuedBy: { actorId: 'ui-user', actorType: 'HUMAN' }, payload: true };
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[19]]: `
class CommandBus {
	dispatchStamped(command: any) {
		const prior = this.store.getReceipt(command.idempotencyKey);
		if (prior) return this.answerFromReceipt(prior, command, 'payload-hash');
	}
	answerFromReceipt(prior: any, command: any, payloadHash: string) {
		return { commandId: prior.commandId, producedEventIds: prior.producedEventIds };
	}
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[45]]: `
async function runPwaFloor() {
	const graphExport = { outputs: [] };
	const ctx = { reasoningReview: { content: JSON.stringify({ ...graphExport }) } };
	const plan = await runFloorAndPlanRecording(subject, ctx, registry);
	recordAssuranceRecordingPlan(engine, plan, {});
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[54]]: `
const proposeDecision = (ctx: any, command: any, payload: any) => {
	const p = payload;
	const state = { authority: p.authority };
	return state;
};
function makeDecisionEffective() {
	return (ctx: any, command: any) => {
		const authority = state.authority;
		const authorityHeld = authority?.actorType === 'HUMAN';
		return authorityHeld;
	};
}
`,
	[JPWB_HYBRID_STATIC_REQUIRED_PATHS[55]]: `
async function agyPrint() {
	const args = ['--print', 'prompt'];
	const { stdout } = await execFileAsync(AGY_BIN, args, {
		timeout: 240000,
		maxBuffer: 1024,
		windowsHide: true
	});
	return stdout;
}
`
});

const BOUNDED_SUBJECT_BUDGETS = Object.freeze({
	maxBytes: 500_000,
	maxConfigDepth: 8,
	maxDiagnostics: 1_000,
	maxDurationMs: 10_000,
	maxFiles: 1_000,
	maxProjects: 10
});

const BOUNDED_SEMANTIC_BUDGETS = Object.freeze({
	maxAstDepth: 16,
	maxAstNodes: 1_000,
	maxCompilerFacts: 20_000,
	maxCompilerInputMetadataBytes: 500_000,
	maxCompilerQueries: 20_000,
	maxCompilerQueryInvocations: 50_000,
	maxContextBytes: 500_000,
	maxContextFileBytes: 250_000,
	maxContextFiles: 1_000,
	maxDiagnosticCharacters: 500_000,
	maxDiagnostics: 1_000,
	maxDirectoryEntries: 10_000,
	maxDurationMs: 10_000,
	maxLiteralCharacters: 10_000,
	maxPathCharacters: 4_096,
	maxProjects: 10,
	maxScopes: 10_000,
	maxSnapshotBytes: 500_000,
	maxSources: 1_000
});

const BOUNDED_QUERY_BUDGETS = Object.freeze({
	maxDepth: 8,
	maxEvaluations: 20_000,
	maxFanout: 16,
	maxNodes: 64,
	maxPopulation: 10_000,
	maxTraceNodes: 20_000
});

const BOUNDED_REACHABILITY_BUDGETS = Object.freeze({
	maxDiagnostics: 1_000,
	maxEdges: 20_000,
	maxFrontierRecords: 10_000,
	maxInputRecords: 20_000,
	maxInputStringCharacters: 500_000,
	maxNodes: 20_000,
	maxReachableNodes: 20_000,
	maxTraversalSteps: 50_000,
	maxWitnessEdges: 20_000
});

const BOUNDED_STATIC_IMPACT_BUDGETS = Object.freeze({
	maxCandidateWitnessHops: 20_000,
	maxResultBytes: 500_000,
	reachability: BOUNDED_REACHABILITY_BUDGETS,
	semantic: BOUNDED_SEMANTIC_BUDGETS,
	subject: BOUNDED_SUBJECT_BUDGETS
});

const BOUNDED_WORKING_OBSERVATION_BUDGETS = Object.freeze({
	maxGitMetadataBytes: 500_000,
	maxGitOperationDurationMs: 10_000,
	maxPathCharacters: 4_096,
	maxSourceBytes: 500_000
});

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function hybridDefectEvents() {
	const firstRequestSha256 = sha256('first-request');
	const secondRequestSha256 = sha256('second-request');
	const actorSha256 = sha256('same-actor');
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
				firstRequestSha256,
				idempotencyKeySha256: sha256('idempotency-key'),
				outcome: 'PRIOR_RESULT_RETURNED',
				secondRequestSha256
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
				actorSha256,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: {
				action: 'APPROVED',
				actorSha256,
				resourceId: 'decision-1',
				resourceKind: 'DECISION'
			},
			kind: 'GOVERNANCE_ACTION'
		},
		{
			data: { attemptId: 'attempt-1', fieldsPresent: ['ATTEMPT_ID'], outcome: 'EXITED' },
			kind: 'EXTERNAL_TOOL_ATTEMPT'
		}
	] as const;
}

function hybridRuntimeTrace(context: ProviderImportContext) {
	return {
		artifacts: [
			{ kind: 'TRACE', path: 'verif/runtime.trace.json', sha256: sha256('runtime-trace') }
		],
		coverage: { findingIds: [9, 19, 45, 54, 55], missingFindingIds: [] },
		events: hybridDefectEvents().map((event, sequence) => ({
			...event,
			at: '2026-08-25T12:00:00.500Z',
			sequence
		})),
		runBindingSha256: sha256(canonicalInventoryJson(context.run)),
		schemaVersion: DETERMINISTIC_RUNTIME_TRACE_INPUT_SCHEMA_VERSION
	};
}

async function publish(
	store: CodingAgentCliArtifactStore,
	value: unknown,
	maxBytes = CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
): Promise<string> {
	return (await publishCodingAgentCliJsonArtifact(store, value, maxBytes)).reference;
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
		operation === 'explain' ||
		operation === 'findings' ||
		operation === 'inventory' ||
		operation === 'verify'
	)
		return {
			capabilityId: CODING_AGENT_CLI_LOCAL_CAPABILITIES[operation],
			capabilityVersion: CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS[operation]
		};
	throw new Error('The operation capability fixture is exhaustive.');
}

function requestFor(
	operation: AgentOperation,
	input: CodingAgentCliOperationInput,
	overrides: Partial<AgentOperationRequest> = {}
): AgentOperationRequest {
	const digest = codingAgentCliInputDigest(input);
	if (digest.state !== 'VALID') throw new Error(JSON.stringify(digest));
	return {
		budgets: {
			maxDepth: 256,
			maxEdges: 50_000,
			maxNodes: 20_000,
			maxOutputBytes: 1_000_000,
			maxResults: 5_000,
			timeoutMs: 30_000
		},
		capabilityRequirement: {
			affectedQuestionRefs: [`question:golden:${operation}`],
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
		requestId: `request:golden:${operation}`,
		requestedAt: REQUESTED_AT,
		subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: SUBJECT_ID },
		work: {
			agentId: 'agent:coding-golden',
			authorityEnvelopeRef: 'authority:local-readonly',
			changeContract: { changeContractRef: 'change:csaa-g6', kind: 'REFERENCE' },
			employmentPoint: 'DURING_IMPLEMENTATION',
			userRequestDigest: USER_REQUEST_DIGEST,
			workPackageRef: 'work-package:DWP-006'
		},
		...overrides
	};
}

function argvFor(
	operation: AgentOperation,
	input: CodingAgentCliOperationInput,
	request: AgentOperationRequest = requestFor(operation, input)
): string[] {
	return [
		operation,
		'--request-json',
		JSON.stringify(request),
		'--input-json',
		JSON.stringify(input),
		'--output',
		'json'
	];
}

function inputBase(operation: AgentOperation) {
	return {
		bindingRef: `binding:golden:${operation}`,
		output: 'STDOUT_JSON' as const,
		schemaVersion: CODING_AGENT_CLI_INPUT_VERSION
	};
}

type CompletedCliRun = Extract<CodingAgentCliRunResult, { readonly state: 'COMPLETED' }>;

function completedRun(run: CodingAgentCliRunResult): CompletedCliRun {
	if (run.state !== 'COMPLETED') throw new Error(run.stderr);
	return run;
}

function terminalJson(run: CompletedCliRun) {
	return JSON.parse(run.stdout.trim()) as Record<string, unknown>;
}

async function runComposedFixture(
	operation: AgentOperation,
	input: CodingAgentCliOperationInput,
	store: CodingAgentCliArtifactStore,
	dependencies: CodingAgentCliCompositionDependencies = mockDependencies(),
	requestOverrides: Partial<AgentOperationRequest> = {},
	repositoryRoot = process.cwd()
) {
	const request = requestFor(operation, input, requestOverrides);
	const handlers = composeCodingAgentCliHandlers({
		artifactStore: store,
		dependencies,
		repositoryRoot
	});
	const run = completedRun(
		await runCodingAgentCli(argvFor(operation, input, request), { handlers })
	);
	return { request, run, terminal: terminalJson(run) };
}

function snapshotRequestArtifact(subjectId = '<resolved-subject>') {
	return {
		kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
		schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
		semanticRequest: {
			assignabilityRequests: [],
			budgets: BOUNDED_SEMANTIC_BUDGETS,
			capabilities: ['TS_SYNTAX'],
			expectEmpty: false,
			operationVersion: SEMANTIC_OPERATION_VERSION,
			rootLocator: '<repository-root>',
			schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
			subjectId
		},
		subjectRequest: {
			budgets: BOUNDED_SUBJECT_BUDGETS,
			rootLocator: '<repository-root>'
		}
	};
}

function queryRequestArtifact() {
	return {
		budgets: {
			maxDiagnostics: 1_000,
			maxResultBytes: 500_000,
			maxResultRecords: 1_000,
			query: BOUNDED_QUERY_BUDGETS,
			semantic: BOUNDED_SEMANTIC_BUDGETS,
			subject: BOUNDED_SUBJECT_BUDGETS
		},
		executionId: 'focused-query',
		expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['tsconfig.json']
	};
}

function staticImpactRequestArtifact() {
	return {
		budgets: BOUNDED_STATIC_IMPACT_BUDGETS,
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: { id: 'focused-static-impact' },
		subjectProjectConfigPaths: ['tsconfig.json']
	};
}

function findingsRequestArtifact(snapshotRef: string, hybridRuntimeEvidence: unknown = null) {
	return {
		budgets: {
			maxArtifacts: 1_000,
			maxAstNodes: 1_000,
			maxDurationMs: 10_000,
			maxResultBytes: 500_000,
			maxSourceBytes: 500_000
		},
		executionDisposition: 'NOT_RUN',
		executionId: 'focused-findings',
		hybridRuntimeEvidence,
		hybridStaticObservedAt: REQUESTED_AT,
		kind: 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST',
		operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
		schemaVersion: CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
		snapshotRef
	};
}

function admittedResultReference(terminal: Record<string, unknown>): string {
	const partial = terminal.partial as { admittedResultRefs: string[] };
	return partial.admittedResultRefs[0]!;
}

async function publishMockSnapshot(
	store: CodingAgentCliArtifactStore,
	subjectId: string = SUBJECT_ID,
	snapshotId: string = SNAPSHOT_ID
): Promise<string> {
	const captureRequestRef = await publish(store, {
		kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
		schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
		semanticRequest: {
			assignabilityRequests: [],
			budgets: BOUNDED_SEMANTIC_BUDGETS,
			capabilities: ['TS_SYNTAX'],
			expectEmpty: false,
			operationVersion: SEMANTIC_OPERATION_VERSION,
			rootLocator: '<repository-root>',
			schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
			subjectId
		},
		subjectRequest: {
			budgets: BOUNDED_SUBJECT_BUDGETS,
			rootLocator: '<repository-root>'
		}
	});
	return await publish(store, {
		buildOutcome: 'complete',
		captureRequestRef,
		diagnostics: [],
		schemaVersion: 'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0',
		snapshot: mockSnapshot(subjectId, snapshotId)
	});
}

function expectBudgetRefusal(run: CompletedCliRun, request: AgentOperationRequest): void {
	expect(run.exitCode).toBe(3);
	expect(terminalJson(run)).toMatchObject({
		outcome: 'error',
		refusal: { code: 'CSAA-E-EXECUTION-BUDGET-REFUSED', reasonCode: 'BUDGET_REFUSED' },
		state: 'resource-refused'
	});
	expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
}

function expectInvalidBudgetRefusal(run: CompletedCliRun, request: AgentOperationRequest): void {
	expect(run.exitCode).toBe(2);
	expect(terminalJson(run)).toMatchObject({
		exitCategory: 'INVALID_REQUEST',
		outcome: 'error',
		refusal: { code: 'CSAA-E-REQUEST-INVALID-PARAMETER' }
	});
	expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
}

function mockSnapshot(
	subjectId: string = SUBJECT_ID,
	snapshotId: string = SNAPSHOT_ID
): StaticSemanticSnapshot {
	return {
		budgets: {},
		capabilities: [
			{ capability: 'TS_PROJECT', reason: 'fixture', state: 'SUPPORTED' },
			{ capability: 'TS_SYNTAX', reason: 'fixture', state: 'SUPPORTED' }
		],
		health: 'COMPLETE',
		id: snapshotId,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		subjectId
	} as unknown as StaticSemanticSnapshot;
}

function mockFrozenSubject(
	subjectId: string,
	additionalArtifacts: readonly string[] = [],
	filters: SubjectFilters = Object.freeze({
		exclude: Object.freeze([]),
		include: Object.freeze([])
	})
): FrozenSubject {
	const subject = {
		artifacts: [],
		descriptor: {
			configurationDigest: sha256(`configuration:${subjectId}`),
			fileManifestDigest: sha256(`manifest:${subjectId}`),
			subjectId
		},
		diagnostics: [],
		excludedArtifacts: [],
		generatedContexts: [],
		population: {
			analyzed: 0,
			capturedRecords: 0,
			capturedRecordsReconcile: true,
			discovered: 0,
			discoveredPhysicalFiles: 0,
			excluded: 0,
			excludedPhysicalFiles: 0,
			excludedRecords: 0,
			failed: 0,
			included: 0,
			includedDispositionReconciles: true,
			inventoryOnly: 0,
			knownPhysicalLowerBoundReconciles: true,
			physicalPopulationReconciles: true,
			reconciles: true,
			reconciliationScope: 'EXACT_PHYSICAL_POPULATION'
		},
		projects: [],
		request: {
			filters,
			scope: {
				...(additionalArtifacts.length === 0 ? {} : { additionalArtifacts }),
				kind: 'EXPLICIT_PROJECTS',
				projects: ['tsconfig.json']
			}
		},
		testPopulations: [],
		workspaces: [],
		workingChangeSet: null
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(subject, new Map());
	return subject;
}

function mockDependencies(workflowSequence = false): CodingAgentCliCompositionDependencies {
	const snapshot = mockSnapshot();
	const postSnapshot = mockSnapshot(POST_SUBJECT_ID, POST_SNAPSHOT_ID);
	let snapshotCalls = 0;
	let resolutionCalls = 0;
	const queryOutcome = {
		diagnostics: [],
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		result: {
			currentness: { changedPaths: [], state: 'CURRENT_FOR_CAPTURED_SUBJECT' },
			population: { semanticSnapshotId: SNAPSHOT_ID }
		},
		state: 'partial',
		subject: { subjectId: SUBJECT_ID }
	} as unknown as SemanticSourceQueryReportOutcome;
	const impactOutcome = {
		diagnostics: [],
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		result: {
			currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' },
			invalidationDependencies: { semanticSnapshotId: SNAPSHOT_ID }
		},
		state: 'partial',
		subject: { subjectId: SUBJECT_ID }
	} as unknown as StaticModuleImpactCandidateReportOutcome;
	return {
		buildSnapshot: vi.fn((_request, _options, runtimeOptions): StaticSemanticSnapshotOutcome => {
			void runtimeOptions;
			snapshotCalls += 1;
			return {
				diagnostics: [],
				outcome: 'complete',
				snapshot: workflowSequence && snapshotCalls > 1 ? postSnapshot : snapshot
			};
		}),
		inventory: vi.fn(() => {
			const inventory = {
				schemaVersion: INVENTORY_SCHEMA_VERSION,
				subject: { subjectId: SUBJECT_ID }
			} as unknown as InventoryDocument;
			return {
				differences: [],
				inventory,
				json: canonicalInventoryJson(inventory),
				mode: 'json' as const,
				ok: true,
				subjectId: SUBJECT_ID
			};
		}),
		projectFindings: vi.fn(runJpwbHarmonizationNativeProjection),
		query: vi.fn(async () => queryOutcome),
		resolveSubject: vi.fn((): SubjectResolutionOutcome => {
			resolutionCalls += 1;
			const subjectId = workflowSequence && resolutionCalls > 1 ? POST_SUBJECT_ID : SUBJECT_ID;
			return {
				completeness: 'COMPLETE',
				diagnostics: [],
				outcome: 'resolved',
				subject: mockFrozenSubject(subjectId)
			};
		}),
		staticImpact: vi.fn(() => impactOutcome),
		validateSnapshot: vi.fn(() => ({ issues: [] as const, state: 'VALID' as const })),
		verifySubject: vi.fn(() => ({ changedPaths: [], diagnostics: [], state: 'CURRENT' as const })),
		workingImpact: vi.fn(() => {
			throw new Error('The golden workflow selects the static impact request.');
		})
	};
}

async function runHybridFindingsFixture(
	providerId: string = DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID
): Promise<{
	readonly dependencies: CodingAgentCliCompositionDependencies;
	readonly findingsInput: CodingAgentCliOperationInput;
	readonly findingsRequest: AgentOperationRequest;
	readonly findingsResult: CodingAgentCliFindingsResultArtifact;
	readonly findingsResultRef: string;
	readonly findingsRun: CompletedCliRun;
	readonly repositoryRoot: string;
	readonly snapshotId: string;
	readonly snapshotRef: string;
	readonly store: InMemoryCodingAgentCliArtifactStore;
	readonly subject: FrozenSubject;
	readonly traceRef: string;
}> {
	const fixture = providerFixture(HYBRID_RISKY_SOURCES);
	const store = new InMemoryCodingAgentCliArtifactStore();
	const snapshotId = `SemanticSnapshot:${fixture.subject.descriptor.subjectId}`;
	const snapshotRef = await publishMockSnapshot(
		store,
		fixture.subject.descriptor.subjectId,
		snapshotId
	);
	const runtimeContext = providerContext(fixture.root, fixture.subject, providerId, {
		assessedAt: '2026-08-25T12:00:02.000Z',
		freshnessWindowMs: 60_000
	});
	const traceRef = await publish(store, hybridRuntimeTrace(runtimeContext));
	const findingsProfileRef = await publish(store, {
		budgets: {
			maxArtifacts: 1_000,
			maxAstNodes: 1_000,
			maxDurationMs: 10_000,
			maxResultBytes: 500_000,
			maxSourceBytes: 500_000
		},
		executionDisposition: 'NOT_RUN',
		executionId: 'hybrid-findings-v2-native-not-run',
		hybridRuntimeEvidence: {
			assessedAt: runtimeContext.assessedAt,
			freshnessWindowMs: runtimeContext.freshnessWindowMs,
			kind: 'SUPPLIED_DETERMINISTIC_RUNTIME_TRACE',
			run: runtimeContext.run,
			traceRef
		},
		hybridStaticObservedAt: HYBRID_OBSERVED_AT,
		kind: 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST',
		operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
		schemaVersion: CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
		snapshotRef
	});
	const findingsInput: CodingAgentCliOperationInput = {
		...inputBase('findings'),
		kind: 'FINDINGS',
		ruleProfileRef: findingsProfileRef,
		snapshotRef
	};
	const findingsRequest = requestFor('findings', findingsInput, {
		subjectInput: {
			kind: 'RESOLVED_SUBJECT',
			subjectId: fixture.subject.descriptor.subjectId
		}
	});
	const baseDependencies = mockDependencies();
	const dependencies: CodingAgentCliCompositionDependencies = {
		...baseDependencies,
		resolveSubject: vi.fn(() => ({
			completeness: 'COMPLETE' as const,
			diagnostics: [],
			outcome: 'resolved' as const,
			subject: fixture.subject
		})),
		verifySubject: vi.fn(() => ({
			changedPaths: [],
			diagnostics: [],
			state: 'CURRENT' as const
		}))
	};
	const handlers = composeCodingAgentCliHandlers({
		artifactStore: store,
		dependencies,
		repositoryRoot: fixture.root
	});
	const findingsRun = completedRun(
		await runCodingAgentCli(argvFor('findings', findingsInput, findingsRequest), { handlers })
	);
	const findingsTerminal = terminalJson(findingsRun);
	if (findingsRun.exitCode !== 3 || findingsTerminal.outcome !== 'partial')
		throw new Error(`Hybrid findings fixture failed: ${findingsRun.stdout}${findingsRun.stderr}`);
	const findingsResultRef = admittedResultReference(findingsTerminal);
	const findingsResult = (await readCodingAgentCliJsonArtifact(
		store,
		findingsResultRef,
		1_000_000
	)) as CodingAgentCliFindingsResultArtifact;
	return {
		dependencies,
		findingsInput,
		findingsRequest,
		findingsResult,
		findingsResultRef,
		findingsRun,
		repositoryRoot: fixture.root,
		snapshotId,
		snapshotRef,
		store,
		subject: fixture.subject,
		traceRef
	};
}

describe('coding-agent CLI content-addressed artifact boundary', () => {
	it('publishes canonical JSON and verifies exact bytes on every read', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const value = { alpha: [1, true, null], zeta: 'bounded' };
		const published = await publishCodingAgentCliJsonArtifact(store, value, 10_000);

		expect(published.reference).toBe(
			codingAgentCliArtifactReference('{"alpha":[1,true,null],"zeta":"bounded"}')
		);
		expect(await readCodingAgentCliJsonArtifact(store, published.reference, 10_000)).toEqual(value);
	});

	it('rejects noncanonical, digest-mismatched, and oversized hostile store output', async () => {
		const noncanonicalBytes = new TextEncoder().encode('{ "a": 1 }');
		const noncanonicalStore: CodingAgentCliArtifactStore = {
			read: () => noncanonicalBytes,
			write: () => undefined
		};
		await expect(
			readCodingAgentCliJsonArtifact(
				noncanonicalStore,
				codingAgentCliArtifactReference(noncanonicalBytes),
				100
			)
		).rejects.toMatchObject({ code: 'ARTIFACT_JSON_NONCANONICAL' });

		const exactBytes = new TextEncoder().encode('{"a":1}');
		const mismatchStore: CodingAgentCliArtifactStore = {
			read: () => exactBytes,
			write: () => undefined
		};
		await expect(
			readCodingAgentCliJsonArtifact(mismatchStore, `artifact:sha256:${sha256('{"a":2}')}`, 100)
		).rejects.toMatchObject({ code: 'ARTIFACT_DIGEST_MISMATCH' });
		await expect(
			readCodingAgentCliJsonArtifact(mismatchStore, codingAgentCliArtifactReference(exactBytes), 2)
		).rejects.toMatchObject({ code: 'ARTIFACT_BUDGET_EXCEEDED' });
	});

	it('does not admit a result reference when read-after-write verification fails', async () => {
		const store: CodingAgentCliArtifactStore = {
			read: () => new TextEncoder().encode('{"substituted":true}'),
			write: () => undefined
		};
		await expect(
			publishCodingAgentCliJsonArtifact(store, { admitted: false }, 1_000)
		).rejects.toBeInstanceOf(CodingAgentCliArtifactError);
	});
});

describe('coding-agent CLI findings v2 hybrid evidence boundary', () => {
	it('imports one supplied trace, serializes five source-bound rows, and replays exact hybrid evidence', async () => {
		const fixture = await runHybridFindingsFixture();
		expect(fixture.findingsRun.exitCode).toBe(3);
		expect(
			validateAgentOperationExchange(fixture.findingsRequest, fixture.findingsRun.terminalResponse)
				.state
		).toBe('VALID');
		const staticProjection: JpwbHybridStaticPrerequisiteProjection =
			fixture.findingsResult.hybridEvidence.staticProjection;
		expect(staticProjection).toMatchObject({
			analysisAuthority: 'NONE',
			gateEffect: 'NONE',
			population: {
				conflicting: 0,
				conclusive: 5,
				expected: 5,
				produced: 5,
				reconciles: true,
				unsupported: 0
			},
			subject: { subjectId: fixture.subject.descriptor.subjectId }
		});
		expect(
			staticProjection.rows.map((row) => [
				row.findingId,
				row.prerequisite.state,
				row.requiredPath,
				row.sourceBinding !== null
			])
		).toEqual([
			[9, 'SATISFIED', JPWB_HYBRID_STATIC_REQUIRED_PATHS[9], true],
			[19, 'SATISFIED', JPWB_HYBRID_STATIC_REQUIRED_PATHS[19], true],
			[45, 'SATISFIED', JPWB_HYBRID_STATIC_REQUIRED_PATHS[45], true],
			[54, 'SATISFIED', JPWB_HYBRID_STATIC_REQUIRED_PATHS[54], true],
			[55, 'SATISFIED', JPWB_HYBRID_STATIC_REQUIRED_PATHS[55], true]
		]);
		expect(fixture.findingsResult.hybridEvidence).toMatchObject({
			runtimeTrace: {
				coverage: { state: 'COMPLETE' },
				freshness: { state: 'CURRENT' },
				health: 'HEALTHY',
				usableForCurrentSubject: true
			},
			runtimeTraceRef: fixture.traceRef
		});
		expect(
			fixture.findingsResult.hybridEvidence.runtimeEvaluation?.rows.map((row) => [
				row.findingId,
				row.status
			])
		).toEqual([
			[9, 'DETECTED'],
			[19, 'DETECTED'],
			[45, 'DETECTED'],
			[54, 'DETECTED'],
			[55, 'DETECTED']
		]);

		const explanationProfileRef = await publish(fixture.store, {
			evaluationId: 'hybrid-findings-v2-native-not-run:JAN-CSAA-HARMONIZATION-001',
			findingFingerprint: null,
			findingId: 1,
			kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
			schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
		});
		const explainInput: CodingAgentCliOperationInput = {
			...inputBase('explain'),
			explanationProfileRef,
			kind: 'EXPLAIN',
			resultRef: fixture.findingsResultRef
		};
		const explainRequest = requestFor('explain', explainInput, {
			subjectInput: {
				kind: 'RESOLVED_SUBJECT',
				subjectId: fixture.subject.descriptor.subjectId
			}
		});
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: fixture.store,
			dependencies: fixture.dependencies,
			repositoryRoot: fixture.repositoryRoot
		});
		const explainRun = completedRun(
			await runCodingAgentCli(argvFor('explain', explainInput, explainRequest), { handlers })
		);
		expect(explainRun.exitCode).toBe(3);
		expect(terminalJson(explainRun)).toMatchObject({ outcome: 'partial', state: 'partial' });
		expect(validateAgentOperationExchange(explainRequest, explainRun.terminalResponse).state).toBe(
			'VALID'
		);
		const explanation = (await readCodingAgentCliJsonArtifact(
			fixture.store,
			admittedResultReference(terminalJson(explainRun)),
			1_000_000
		)) as CodingAgentCliExplanationResultArtifact;
		expect(explanation).toMatchObject({
			analysisAuthority: 'NONE',
			gateEffect: 'NONE',
			source: { findingsResultRef: fixture.findingsResultRef }
		});
		expect(fixture.dependencies.projectFindings).toHaveBeenCalledTimes(2);
	});

	it('preserves a provider-identity conflict and evaluates all five hybrid rows as NOT_RUN', async () => {
		const fixture = await runHybridFindingsFixture('not-the-deterministic-runtime-provider');
		expect(fixture.findingsResult.hybridEvidence.runtimeTrace).toMatchObject({
			conflicts: [{ code: 'PROVIDER_IDENTITY_MISMATCH' }],
			health: 'HEALTHY',
			usableForCurrentSubject: false
		});
		expect(
			fixture.findingsResult.hybridEvidence.runtimeEvaluation?.rows.map((row) => [
				row.findingId,
				row.status,
				row.runtimeState.conflict,
				row.runtimeState.conflictCodes.includes('PROVIDER_IDENTITY_MISMATCH')
			])
		).toEqual([
			[9, 'NOT_RUN', true, true],
			[19, 'NOT_RUN', true, true],
			[45, 'NOT_RUN', true, true],
			[54, 'NOT_RUN', true, true],
			[55, 'NOT_RUN', true, true]
		]);
		expect(
			fixture.findingsResult.hybridEvidence.runtimeEvaluation?.rows.some(
				(row) => row.status === 'DETECTED'
			)
		).toBe(false);
	});

	it('refuses explanation replay when stored hybrid trace evidence is tampered', async () => {
		const fixture = await runHybridFindingsFixture();
		const tampered = JSON.parse(canonicalInventoryJson(fixture.findingsResult)) as {
			hybridEvidence: { runtimeTrace: { run: { runId: string } } };
		};
		tampered.hybridEvidence.runtimeTrace.run.runId = 'tampered-provider-run';
		const tamperedFindingsResultRef = await publish(fixture.store, tampered);
		const explanationProfileRef = await publish(fixture.store, {
			evaluationId: 'hybrid-findings-v2-native-not-run:JAN-CSAA-HARMONIZATION-001',
			findingFingerprint: null,
			findingId: 1,
			kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
			schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
		});
		const explainInput: CodingAgentCliOperationInput = {
			...inputBase('explain'),
			explanationProfileRef,
			kind: 'EXPLAIN',
			resultRef: tamperedFindingsResultRef
		};
		const explainRequest = requestFor('explain', explainInput, {
			subjectInput: {
				kind: 'RESOLVED_SUBJECT',
				subjectId: fixture.subject.descriptor.subjectId
			}
		});
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: fixture.store,
			dependencies: fixture.dependencies,
			repositoryRoot: fixture.repositoryRoot
		});
		const explainRun = completedRun(
			await runCodingAgentCli(argvFor('explain', explainInput, explainRequest), { handlers })
		);
		expect(explainRun.exitCode).toBe(2);
		expect(terminalJson(explainRun)).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error',
			refusal: { code: 'CSAA-E-REQUEST-INVALID-PARAMETER' }
		});
		expect(validateAgentOperationExchange(explainRequest, explainRun.terminalResponse).state).toBe(
			'VALID'
		);
	});
});

describe('coding-agent CLI concrete composition', () => {
	it('maps every subject-resolution refusal through an exchange-valid snapshot response', async () => {
		const cases: readonly {
			readonly code: string;
			readonly outcome: Exclude<SubjectResolutionOutcome, { readonly outcome: 'resolved' }>;
			readonly state: string;
		}[] = [
			{
				code: 'CSAA-E-SUBJECT-UNIDENTIFIED',
				outcome: { diagnostics: [], outcome: 'not-found' },
				state: 'failed'
			},
			{
				code: 'CSAA-E-AUTH-UNAUTHORIZED',
				outcome: { diagnostics: [], outcome: 'forbidden' },
				state: 'authorization-refused'
			},
			{
				code: 'CSAA-E-SUBJECT-UNAVAILABLE',
				outcome: { diagnostics: [], outcome: 'unavailable' },
				state: 'failed'
			},
			{
				code: 'CSAA-E-SUBJECT-UNAVAILABLE',
				outcome: { diagnostics: [], outcome: 'ambiguous' },
				state: 'failed'
			},
			{
				code: 'CSAA-E-REQUEST-INVALID-PARAMETER',
				outcome: { diagnostics: [], outcome: 'incompatible' },
				state: 'failed'
			}
		];
		for (const candidate of cases) {
			const store = new InMemoryCodingAgentCliArtifactStore();
			const subjectInputRef = await publish(store, snapshotRequestArtifact());
			const input: CodingAgentCliOperationInput = {
				...inputBase('snapshot'),
				kind: 'SNAPSHOT',
				subjectInputRef
			};
			const dependencies: CodingAgentCliCompositionDependencies = {
				...mockDependencies(),
				resolveSubject: vi.fn(() => candidate.outcome)
			};
			const result = await runComposedFixture('snapshot', input, store, dependencies);
			expect(result.run.exitCode).toBe(2);
			expect(result.terminal).toMatchObject({
				outcome: 'error',
				refusal: { code: candidate.code },
				state: candidate.state
			});
			expect(
				validateAgentOperationExchange(result.request, result.run.terminalResponse).state
			).toBe('VALID');
		}

		const store = new InMemoryCodingAgentCliArtifactStore();
		const subjectInputRef = await publish(store, snapshotRequestArtifact());
		const input: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef
		};
		const locatorDigest = codingAgentCliArtifactDigest(subjectInputRef);
		const locatorResult = await runComposedFixture(
			'snapshot',
			input,
			store,
			{
				...mockDependencies(),
				resolveSubject: vi.fn((): SubjectResolutionOutcome => ({
					diagnostics: [],
					outcome: 'not-found'
				}))
			},
			{
				subjectInput: {
					kind: 'SUBJECT_LOCATOR',
					locatorDigest,
					locatorRef: subjectInputRef,
					resolutionPolicyRef: 'policy:fixture'
				}
			}
		);
		expect(locatorResult.terminal).toMatchObject({
			subjectResolution: { kind: 'NOT_FOUND', locatorDigest }
		});
	});

	it('rejects malformed snapshot artifacts and maps owning-provider outcomes exactly', async () => {
		const record = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
		const malformed: readonly ((candidate: Record<string, unknown>) => void)[] = [
			(candidate) => {
				candidate.kind = 'OTHER';
			},
			(candidate) => {
				candidate.schemaVersion = 'unsupported';
			},
			(candidate) => {
				record(candidate.subjectRequest).rootLocator = '../untrusted';
			},
			(candidate) => {
				record(candidate.semanticRequest).operationVersion = 'unsupported';
			},
			(candidate) => {
				record(candidate.semanticRequest).schemaVersion = 'unsupported';
			},
			(candidate) => {
				record(candidate.semanticRequest).rootLocator = '../untrusted';
			},
			(candidate) => {
				record(candidate.semanticRequest).subjectId = 7;
			},
			(candidate) => {
				record(record(candidate.semanticRequest).budgets).maxAstNodes = 0;
			},
			(candidate) => {
				record(candidate.semanticRequest).capabilities = [];
			},
			(candidate) => {
				record(candidate.semanticRequest).subjectId = 'subject:different';
			},
			(candidate) => {
				candidate.extra = true;
			}
		];
		for (const change of malformed) {
			const store = new InMemoryCodingAgentCliArtifactStore();
			const artifact = structuredClone(snapshotRequestArtifact()) as unknown as Record<
				string,
				unknown
			>;
			change(artifact);
			const subjectInputRef = await publish(store, artifact);
			const input: CodingAgentCliOperationInput = {
				...inputBase('snapshot'),
				kind: 'SNAPSHOT',
				subjectInputRef
			};
			const result = await runComposedFixture('snapshot', input, store);
			expect(result.run.exitCode).toBe(2);
			expect(result.terminal).toMatchObject({
				exitCategory: 'INVALID_REQUEST',
				outcome: 'error',
				refusal: { code: 'CSAA-E-REQUEST-INVALID-PARAMETER' }
			});
		}

		const providerCases: readonly {
			readonly code: string;
			readonly exitCode: 2 | 3 | 5;
			readonly outcome: StaticSemanticSnapshotOutcome;
			readonly state: string;
		}[] = [
			{
				code: 'CSAA-E-CAPABILITY-NOT-ANALYZED',
				exitCode: 3,
				outcome: {
					diagnostics: [],
					outcome: 'unavailable',
					state: 'failed'
				} as unknown as StaticSemanticSnapshotOutcome,
				state: 'failed'
			},
			{
				code: 'CSAA-E-REQUEST-INVALID-PARAMETER',
				exitCode: 2,
				outcome: {
					diagnostics: [],
					outcome: 'incompatible',
					state: 'incompatible'
				} as unknown as StaticSemanticSnapshotOutcome,
				state: 'failed'
			},
			{
				code: 'CSAA-E-INTERNAL-UNEXPECTED',
				exitCode: 5,
				outcome: {
					diagnostics: [],
					outcome: 'complete',
					snapshot: mockSnapshot('subject:different')
				},
				state: 'unknown'
			},
			{
				code: 'CSAA-E-INTERNAL-UNEXPECTED',
				exitCode: 5,
				outcome: {
					diagnostics: [],
					outcome: 'complete',
					snapshot: { ...mockSnapshot(), capabilities: [] }
				} as unknown as StaticSemanticSnapshotOutcome,
				state: 'unknown'
			},
			{
				code: 'CSAA-E-CAPABILITY-UNSUPPORTED',
				exitCode: 3,
				outcome: {
					diagnostics: [],
					outcome: 'complete',
					snapshot: {
						...mockSnapshot(),
						capabilities: [
							{ capability: 'TS_SYNTAX', reason: 'fixture unsupported', state: 'UNSUPPORTED' }
						]
					}
				} as unknown as StaticSemanticSnapshotOutcome,
				state: 'failed'
			}
		];
		for (const candidate of providerCases) {
			const store = new InMemoryCodingAgentCliArtifactStore();
			const subjectInputRef = await publish(store, snapshotRequestArtifact());
			const input: CodingAgentCliOperationInput = {
				...inputBase('snapshot'),
				kind: 'SNAPSHOT',
				subjectInputRef
			};
			const result = await runComposedFixture('snapshot', input, store, {
				...mockDependencies(),
				buildSnapshot: vi.fn(() => candidate.outcome)
			});
			expect(result.run.exitCode).toBe(candidate.exitCode);
			expect(result.terminal).toMatchObject({
				outcome: 'error',
				refusal: { code: candidate.code },
				state: candidate.state
			});
		}

		const store = new InMemoryCodingAgentCliArtifactStore();
		const subjectInputRef = await publish(store, snapshotRequestArtifact());
		const input: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef
		};
		const result = await runComposedFixture('snapshot', input, store, {
			...mockDependencies(),
			buildSnapshot: vi.fn((_request, _options, runtimeOptions) => {
				runtimeOptions?.onProgress?.({ phase: 'fixture', state: 'complete' } as never);
				return {
					diagnostics: [],
					outcome: 'complete',
					snapshot: mockSnapshot()
				} as StaticSemanticSnapshotOutcome;
			})
		});
		expect(result.run.exitCode).toBe(3);
		expect(result.terminal).toMatchObject({ outcome: 'partial' });
	});

	it('runs the complete local golden workflow without false success across all seven commands', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies(true);
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const inventoryRequestRef = await publish(store, {
			kind: 'REPOSITORY_INVENTORY_REQUEST',
			requireJpwbPopulations: false,
			rootLocator: '<repository-root>',
			schemaVersion: CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION
		});
		const inventoryInput: CodingAgentCliOperationInput = {
			...inputBase('inventory'),
			kind: 'INVENTORY',
			subjectInputRef: inventoryRequestRef
		};
		const inventoryRequest = requestFor('inventory', inventoryInput);
		const inventoryRun = completedRun(
			await runCodingAgentCli(argvFor('inventory', inventoryInput, inventoryRequest), {
				handlers
			})
		);
		expect(inventoryRun.exitCode).toBe(3);
		expect(terminalJson(inventoryRun)).toMatchObject({
			currentness: {
				snapshot: { kind: 'NOT_APPLICABLE' },
				status: 'current-for-subject',
				subject: { subjectId: SUBJECT_ID }
			},
			outcome: 'partial'
		});
		expect(
			validateAgentOperationExchange(inventoryRequest, inventoryRun.terminalResponse).state
		).toBe('VALID');
		const snapshotRequestRef = await publish(store, {
			kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
			schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
			semanticRequest: {
				assignabilityRequests: [],
				budgets: BOUNDED_SEMANTIC_BUDGETS,
				capabilities: ['TS_PROJECT', 'TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: '<resolved-subject>'
			},
			subjectRequest: {
				budgets: BOUNDED_SUBJECT_BUDGETS,
				rootLocator: '<repository-root>'
			}
		});
		const snapshotInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const snapshotRequest = requestFor('snapshot', snapshotInput);
		const snapshotRun = completedRun(
			await runCodingAgentCli(argvFor('snapshot', snapshotInput, snapshotRequest), { handlers })
		);
		const snapshotTerminal = terminalJson(snapshotRun);
		expect(snapshotRun.exitCode).toBe(3);
		expect(snapshotTerminal.outcome).toBe('partial');
		expect(snapshotTerminal.currentness).toMatchObject({
			snapshot: { snapshotId: SNAPSHOT_ID },
			status: 'current-for-subject',
			subject: { subjectId: SUBJECT_ID }
		});
		expect(snapshotTerminal.partial).toMatchObject({
			continuation: { kind: 'NONE', reasonCode: 'OPERATION_DOES_NOT_PAGE' }
		});
		expect(snapshotRun.stderr.trim().split('\n').length).toBeGreaterThan(0);
		expect(
			validateAgentOperationExchange(snapshotRequest, snapshotRun.terminalResponse).state
		).toBe('VALID');

		const snapshotRef = admittedResultReference(snapshotTerminal);
		const storedSnapshot = (await readCodingAgentCliJsonArtifact(
			store,
			snapshotRef,
			1_000_000
		)) as CodingAgentCliSnapshotResultArtifact;
		expect(storedSnapshot).toMatchObject({
			buildOutcome: 'complete',
			schemaVersion: 'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0',
			snapshot: { id: SNAPSHOT_ID, subjectId: SUBJECT_ID }
		});

		const queryRequestRef = await publish(store, {
			budgets: {
				maxDiagnostics: 1_000,
				maxResultBytes: 500_000,
				maxResultRecords: 1_000,
				query: BOUNDED_QUERY_BUDGETS,
				semantic: BOUNDED_SEMANTIC_BUDGETS,
				subject: BOUNDED_SUBJECT_BUDGETS
			},
			executionId: 'golden-query-001',
			expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const queryInput: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef: queryRequestRef,
			snapshotRef
		};
		const queryRequest = requestFor('query', queryInput);
		const queryRun = completedRun(
			await runCodingAgentCli(argvFor('query', queryInput, queryRequest), { handlers })
		);
		const queryTerminal = terminalJson(queryRun);
		expect(queryRun.exitCode).toBe(3);
		expect(queryTerminal).toMatchObject({
			outcome: 'partial',
			state: 'partial',
			currentness: { status: 'current-for-subject' }
		});
		expect(validateAgentOperationExchange(queryRequest, queryRun.terminalResponse).state).toBe(
			'VALID'
		);
		const queryResultRef = admittedResultReference(queryTerminal);

		const impactRequestRef = await publish(store, {
			budgets: BOUNDED_STATIC_IMPACT_BUDGETS,
			operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			seed: { id: 'golden-change' },
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const impactInput: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef: impactRequestRef,
			kind: 'IMPACT',
			snapshotRef
		};
		const impactRequest = requestFor('impact', impactInput);
		const impactRun = completedRun(
			await runCodingAgentCli(argvFor('impact', impactInput, impactRequest), { handlers })
		);
		const impactTerminal = terminalJson(impactRun);
		expect(impactRun.exitCode).toBe(3);
		expect(impactTerminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		expect(validateAgentOperationExchange(impactRequest, impactRun.terminalResponse).state).toBe(
			'VALID'
		);
		const impactResultRef = admittedResultReference(impactTerminal);

		const postSnapshotRequestRef = await publish(store, {
			kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
			schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
			semanticRequest: {
				assignabilityRequests: [],
				budgets: BOUNDED_SEMANTIC_BUDGETS,
				capabilities: ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: POST_SUBJECT_ID
			},
			subjectRequest: {
				budgets: BOUNDED_SUBJECT_BUDGETS,
				rootLocator: '<repository-root>'
			}
		});
		const postSnapshotInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			bindingRef: 'binding:golden:snapshot:post-change',
			kind: 'SNAPSHOT',
			subjectInputRef: postSnapshotRequestRef
		};
		const postSnapshotRequest = requestFor('snapshot', postSnapshotInput, {
			requestId: 'request:golden:snapshot:post-change',
			subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: POST_SUBJECT_ID }
		});
		const postSnapshotRun = completedRun(
			await runCodingAgentCli(argvFor('snapshot', postSnapshotInput, postSnapshotRequest), {
				handlers
			})
		);
		expect(postSnapshotRun.exitCode).toBe(3);
		expect(terminalJson(postSnapshotRun)).toMatchObject({
			currentness: {
				snapshot: { snapshotId: POST_SNAPSHOT_ID },
				subject: { subjectId: POST_SUBJECT_ID }
			},
			outcome: 'partial'
		});
		const postSnapshotRef = admittedResultReference(terminalJson(postSnapshotRun));

		const nativeExecutionId = 'golden-post-change-native-projection-not-run';
		const findingsRequestRef = await publish(store, {
			budgets: {
				maxArtifacts: 1_000,
				maxAstNodes: 1_000,
				maxDurationMs: 10_000,
				maxResultBytes: 500_000,
				maxSourceBytes: 500_000
			},
			executionDisposition: 'NOT_RUN',
			executionId: nativeExecutionId,
			hybridRuntimeEvidence: null,
			hybridStaticObservedAt: REQUESTED_AT,
			kind: 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST',
			operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
			schemaVersion: CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
			snapshotRef: postSnapshotRef
		});
		const findingsInput: CodingAgentCliOperationInput = {
			...inputBase('findings'),
			kind: 'FINDINGS',
			ruleProfileRef: findingsRequestRef,
			snapshotRef: postSnapshotRef
		};
		const findingsRequest = requestFor('findings', findingsInput, {
			subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: POST_SUBJECT_ID }
		});
		const findingsRun = completedRun(
			await runCodingAgentCli(argvFor('findings', findingsInput, findingsRequest), { handlers })
		);
		expect(findingsRun.exitCode).toBe(3);
		expect(terminalJson(findingsRun)).toMatchObject({ outcome: 'partial', state: 'partial' });
		expect(
			validateAgentOperationExchange(findingsRequest, findingsRun.terminalResponse).state
		).toBe('VALID');
		const findingsResultRef = admittedResultReference(terminalJson(findingsRun));
		const findingsResult = (await readCodingAgentCliJsonArtifact(
			store,
			findingsResultRef,
			1_000_000
		)) as CodingAgentCliFindingsResultArtifact;
		expect(findingsResult.nativeProjectionOutcome.outcome).toBe('projected');
		if (findingsResult.nativeProjectionOutcome.outcome !== 'projected') {
			throw new Error('Expected the native harmonization projection to complete.');
		}
		expect(
			findingsResult.nativeProjectionOutcome.result.currentRepositoryStatusTotals
		).toMatchObject({ NOT_RUN: 23 });
		expect(findingsResult.nativeProjectionOutcome.result.projections).toHaveLength(23);
		expect(
			findingsResult.nativeProjectionOutcome.result.projections.find(
				(projection) => projection.findingId === 1
			)
		).toMatchObject({
			evaluation: expect.objectContaining({
				result: expect.objectContaining({
					evaluatorExecuted: false,
					finding: null,
					status: 'NOT_RUN'
				})
			}),
			findingId: 1
		});

		const explanationProfileRef = await publish(store, {
			evaluationId: `${nativeExecutionId}:JAN-CSAA-HARMONIZATION-001`,
			findingFingerprint: null,
			findingId: 1,
			kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
			schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
		});
		const explainInput: CodingAgentCliOperationInput = {
			...inputBase('explain'),
			explanationProfileRef,
			kind: 'EXPLAIN',
			resultRef: findingsResultRef
		};
		const explainRequest = requestFor('explain', explainInput, {
			subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: POST_SUBJECT_ID }
		});
		const explainRun = completedRun(
			await runCodingAgentCli(argvFor('explain', explainInput, explainRequest), { handlers })
		);
		expect(explainRun.exitCode).toBe(3);
		expect(terminalJson(explainRun)).toMatchObject({ outcome: 'partial', state: 'partial' });
		const explanationResultRef = admittedResultReference(terminalJson(explainRun));
		const explanationResult = (await readCodingAgentCliJsonArtifact(
			store,
			explanationResultRef,
			1_000_000
		)) as CodingAgentCliExplanationResultArtifact;
		expect(explanationResult).toMatchObject({
			analysisAuthority: 'NONE',
			gateEffect: 'NONE',
			projection: {
				evaluation: { result: { finding: null, status: 'NOT_RUN' } },
				findingId: 1
			},
			source: { findingsResultRef }
		});

		const expectationRef = await publish(store, {
			assertions: [
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
					expected: 'NOT_RUN',
					kind: 'JSON_VALUE_EQUALS',
					path: [
						'nativeProjectionOutcome',
						'result',
						'projections',
						0,
						'evaluation',
						'result',
						'status'
					]
				},
				{
					artifactRef: explanationResultRef,
					expected: findingsResultRef,
					kind: 'JSON_VALUE_EQUALS',
					path: ['source', 'findingsResultRef']
				}
			],
			kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
			schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
			snapshotId: POST_SNAPSHOT_ID,
			subjectId: POST_SUBJECT_ID
		});
		const verifyInput: CodingAgentCliOperationInput = {
			...inputBase('verify'),
			expectationRef,
			kind: 'VERIFY',
			subjectInputRef: postSnapshotRef
		};
		const verifyRequest = requestFor('verify', verifyInput, {
			subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: POST_SUBJECT_ID }
		});
		const verifyRun = completedRun(
			await runCodingAgentCli(argvFor('verify', verifyInput, verifyRequest), { handlers })
		);
		expect(verifyRun.exitCode).toBe(3);
		expect(terminalJson(verifyRun)).toMatchObject({ outcome: 'partial', state: 'partial' });
		expect(validateAgentOperationExchange(verifyRequest, verifyRun.terminalResponse).state).toBe(
			'VALID'
		);
		const verificationResult = (await readCodingAgentCliJsonArtifact(
			store,
			admittedResultReference(terminalJson(verifyRun)),
			1_000_000
		)) as { passed: boolean };
		expect(verificationResult.passed).toBe(true);

		expect(dependencies.inventory).toHaveBeenCalledTimes(2);
		expect(dependencies.inventory).toHaveBeenNthCalledWith(1, {
			mode: 'json',
			repositoryRoot: process.cwd(),
			requireJpwbPopulations: false
		});
		expect(dependencies.inventory).toHaveBeenNthCalledWith(2, {
			mode: 'json',
			repositoryRoot: process.cwd(),
			requireJpwbPopulations: false
		});
		expect(dependencies.resolveSubject).toHaveBeenCalledTimes(5);
		expect(dependencies.buildSnapshot).toHaveBeenCalledTimes(2);
		expect(dependencies.query).toHaveBeenCalledTimes(1);
		expect(dependencies.staticImpact).toHaveBeenCalledTimes(1);
		expect(dependencies.workingImpact).not.toHaveBeenCalled();
		expect(CODING_AGENT_CLI_COMPOSITION_STATE).toBe('IMPLEMENTATION_LOCAL_UNREGISTERED');
		expect(CODING_AGENT_CLI_COMPOSITION_NONCLAIMS.join(' ')).toContain(
			'package-root-exported binary composition'
		);
		expect(CODING_AGENT_CLI_COMPOSITION_NONCLAIMS.join(' ')).toContain(
			'does not execute subject code'
		);
	});

	it('returns FAILED_EXPECTATION with the exact verification artifact when a declared check fails', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const captureRequestRef = await publish(store, {
			kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
			schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
			semanticRequest: {
				assignabilityRequests: [],
				budgets: { maxDurationMs: 1_000, maxSnapshotBytes: 500_000 },
				capabilities: ['TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: SUBJECT_ID
			},
			subjectRequest: {
				budgets: { maxDurationMs: 1_000 },
				rootLocator: '<repository-root>'
			}
		});
		const snapshotRef = await publish(store, {
			buildOutcome: 'complete',
			captureRequestRef,
			diagnostics: [],
			schemaVersion: 'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0',
			snapshot: mockSnapshot()
		});
		const expectationRef = await publish(store, {
			assertions: [
				{
					artifactRef: snapshotRef,
					expected: 'SemanticSnapshot:not-the-captured-snapshot',
					kind: 'JSON_VALUE_EQUALS',
					path: ['snapshot', 'id']
				},
				{
					artifactRef: snapshotRef,
					kind: 'ARTIFACT_DIGEST_EQUALS',
					sha256: codingAgentCliArtifactDigest(snapshotRef)
				}
			],
			kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
			schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
			snapshotId: SNAPSHOT_ID,
			subjectId: SUBJECT_ID
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('verify'),
			expectationRef,
			kind: 'VERIFY',
			subjectInputRef: snapshotRef
		};
		const request = requestFor('verify', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('verify', input, request), { handlers })
		);
		const terminal = terminalJson(run);

		expect(run.exitCode).toBe(4);
		expect(terminal).toMatchObject({
			capability: { conflict: 'conflicting', executionHealth: 'succeeded' },
			currentness: { status: 'current-for-subject' },
			exitCategory: 'FAILED_EXPECTATION',
			outcome: 'error',
			refusal: {
				code: 'CSAA-E-PROVIDER-DISAGREEMENT',
				reasonCode: 'CONFLICT_REQUIRES_ESCALATION'
			}
		});
		const attemptedEvidenceRefs = (terminal.refusal as { attemptedEvidenceRefs: readonly string[] })
			.attemptedEvidenceRefs;
		const verification = (await readCodingAgentCliJsonArtifact(
			store,
			attemptedEvidenceRefs[0]!,
			1_000_000
		)) as { assertions: readonly { passed: boolean }[]; passed: boolean };
		expect(verification).toMatchObject({
			assertions: [{ passed: false }, { passed: true }],
			passed: false
		});
		expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
	});

	it('withholds a snapshot result when the frozen subject changes during snapshot construction', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const baseDependencies = mockDependencies();
		const dependencies: CodingAgentCliCompositionDependencies = {
			...baseDependencies,
			verifySubject: vi.fn(() => ({
				changedPaths: ['src/changed-during-build.ts'],
				diagnostics: [],
				state: 'STALE' as const
			}))
		};
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRequestRef = await publish(store, {
			kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
			schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
			semanticRequest: {
				assignabilityRequests: [],
				budgets: BOUNDED_SEMANTIC_BUDGETS,
				capabilities: ['TS_PROJECT', 'TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: '<resolved-subject>'
			},
			subjectRequest: {
				budgets: BOUNDED_SUBJECT_BUDGETS,
				rootLocator: '<repository-root>'
			}
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const request = requestFor('snapshot', input);
		const write = vi.spyOn(store, 'write');
		const run = completedRun(
			await runCodingAgentCli(argvFor('snapshot', input, request), { handlers })
		);

		expect(run.exitCode).toBe(3);
		expect(terminalJson(run)).toMatchObject({
			currentness: { status: 'stale' },
			outcome: 'error',
			refusal: {
				code: 'CSAA-E-SUBJECT-STALE',
				reasonCode: 'CURRENTNESS_UNSATISFIED'
			},
			state: 'incompatible'
		});
		expect(baseDependencies.buildSnapshot).toHaveBeenCalledTimes(1);
		expect(dependencies.verifySubject).toHaveBeenCalledTimes(1);
		expect(write).not.toHaveBeenCalled();
		expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
	});

	it('fails stale when query recapture does not reproduce the exact snapshot', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const baseDependencies = mockDependencies();
		const dependencies: CodingAgentCliCompositionDependencies = {
			...baseDependencies,
			query: vi.fn(async () => {
				return {
					diagnostics: [],
					outcome: 'partial',
					result: {
						currentness: { changedPaths: [], state: 'CURRENT_FOR_CAPTURED_SUBJECT' },
						population: { semanticSnapshotId: 'SemanticSnapshot:changed' }
					},
					state: 'partial',
					subject: { subjectId: SUBJECT_ID }
				} as unknown as SemanticSourceQueryReportOutcome;
			})
		};
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publish(store, {
			buildOutcome: 'complete',
			captureRequestRef: `artifact:sha256:${'c'.repeat(64)}`,
			diagnostics: [],
			schemaVersion: 'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0',
			snapshot: mockSnapshot()
		});
		const queryRef = await publish(store, {
			budgets: { maxResultBytes: 500_000, maxResultRecords: 1_000 },
			executionId: 'stale-query',
			expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef,
			snapshotRef
		};
		const request = requestFor('query', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('query', input, request), { handlers })
		);

		expect(run.exitCode).toBe(3);
		expect(terminalJson(run)).toMatchObject({
			currentness: { status: 'stale' },
			outcome: 'error',
			refusal: {
				code: 'CSAA-E-SUBJECT-STALE',
				reasonCode: 'CURRENTNESS_UNSATISFIED'
			},
			state: 'incompatible'
		});
		expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
	});

	it('refuses a changed pre-operation subject recapture before invoking the owning query', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const baseDependencies = mockDependencies();
		const dependencies: CodingAgentCliCompositionDependencies = {
			...baseDependencies,
			resolveSubject: vi.fn((): SubjectResolutionOutcome => ({
				completeness: 'COMPLETE',
				diagnostics: [],
				outcome: 'resolved',
				subject: mockFrozenSubject(POST_SUBJECT_ID)
			})),
			validateSnapshot: vi.fn((_value, _options, context) =>
				context.frozenSubject === undefined
					? {
							issues: [
								{
									code: 'FROZEN_EVIDENCE_REQUIRED' as const,
									message: 'The exact frozen subject is required.',
									path: '$validationContext.frozenSubject'
								}
							],
							state: 'INVALID' as const
						}
					: { issues: [] as const, state: 'VALID' as const }
			)
		};
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publishMockSnapshot(store);
		const queryRef = await publish(store, {
			budgets: { maxResultBytes: 500_000, maxResultRecords: 1_000 },
			executionId: 'changed-pre-operation-subject',
			expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef,
			snapshotRef
		};
		const request = requestFor('query', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('query', input, request), { handlers })
		);

		expect(run.exitCode).toBe(3);
		expect(terminalJson(run)).toMatchObject({
			currentness: { status: 'stale' },
			outcome: 'error',
			refusal: {
				code: 'CSAA-E-SUBJECT-STALE',
				reasonCode: 'CURRENTNESS_UNSATISFIED'
			},
			state: 'incompatible'
		});
		expect(dependencies.resolveSubject).toHaveBeenCalledTimes(1);
		expect(baseDependencies.verifySubject).not.toHaveBeenCalled();
		expect(baseDependencies.query).not.toHaveBeenCalled();
		expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
	});

	it('threads the exact recaptured artifact population and filter policy into query and static impact', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const additionalArtifacts = Object.freeze(['package.json', 'verif/retained-evidence.json']);
		const subjectFilters = Object.freeze({
			exclude: Object.freeze(['**/*.generated.ts']),
			include: Object.freeze(['packages/**'])
		});
		const baseDependencies = mockDependencies();
		const dependencies: CodingAgentCliCompositionDependencies = {
			...baseDependencies,
			resolveSubject: vi.fn((): SubjectResolutionOutcome => ({
				completeness: 'COMPLETE',
				diagnostics: [],
				outcome: 'resolved',
				subject: mockFrozenSubject(SUBJECT_ID, additionalArtifacts, subjectFilters)
			})),
			validateSnapshot: vi.fn((_value, _options, context) =>
				context.frozenSubject === undefined
					? {
							issues: [
								{
									code: 'FROZEN_EVIDENCE_REQUIRED' as const,
									message: 'The exact frozen subject is required.',
									path: '$validationContext.frozenSubject'
								}
							],
							state: 'INVALID' as const
						}
					: { issues: [] as const, state: 'VALID' as const }
			)
		};
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publishMockSnapshot(store);
		const queryRef = await publish(store, {
			budgets: { maxResultBytes: 500_000, maxResultRecords: 1_000 },
			executionId: 'additional-artifact-query',
			expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const queryInput: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef,
			snapshotRef
		};
		const queryRequest = requestFor('query', queryInput);
		const queryRun = completedRun(
			await runCodingAgentCli(argvFor('query', queryInput, queryRequest), { handlers })
		);

		expect(queryRun.exitCode).toBe(3);
		expect(dependencies.query).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ additionalArtifacts, subjectFilters })
		);

		const changeSetRef = await publish(store, {
			budgets: BOUNDED_STATIC_IMPACT_BUDGETS,
			operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			seed: { id: 'additional-artifact-impact' },
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const impactInput: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef,
			kind: 'IMPACT',
			snapshotRef
		};
		const impactRequest = requestFor('impact', impactInput);
		const impactRun = completedRun(
			await runCodingAgentCli(argvFor('impact', impactInput, impactRequest), { handlers })
		);

		expect(impactRun.exitCode).toBe(3);
		expect(dependencies.staticImpact).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ additionalArtifacts, subjectFilters })
		);
		expect(dependencies.resolveSubject).toHaveBeenCalledTimes(2);
	});

	it('refuses inner operation budgets that exceed the enclosing agent budget before execution', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publish(store, {
			buildOutcome: 'complete',
			captureRequestRef: `artifact:sha256:${'c'.repeat(64)}`,
			diagnostics: [],
			schemaVersion: 'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0',
			snapshot: mockSnapshot()
		});
		const queryRef = await publish(store, {
			budgets: { maxResultBytes: 500_000, maxResultRecords: 10_000 },
			executionId: 'over-budget-query',
			expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef,
			snapshotRef
		};
		const request = requestFor('query', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('query', input, request), { handlers })
		);

		expect(run.exitCode).toBe(3);
		expect(terminalJson(run)).toMatchObject({
			outcome: 'error',
			refusal: { code: 'CSAA-E-EXECUTION-BUDGET-REFUSED', reasonCode: 'BUDGET_REFUSED' },
			state: 'resource-refused'
		});
		expect(dependencies.query).not.toHaveBeenCalled();
	});

	it.each([
		{
			name: 'snapshot subject byte',
			semanticBudgets: BOUNDED_SEMANTIC_BUDGETS,
			subjectBudgets: { ...BOUNDED_SUBJECT_BUDGETS, maxBytes: 934_465 }
		},
		{
			name: 'snapshot semantic compiler-fact',
			semanticBudgets: { ...BOUNDED_SEMANTIC_BUDGETS, maxCompilerFacts: 50_001 },
			subjectBudgets: BOUNDED_SUBJECT_BUDGETS
		}
	])('refuses the $name budget before subject resolution', async (fixture) => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRequestRef = await publish(store, {
			kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
			schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
			semanticRequest: {
				assignabilityRequests: [],
				budgets: fixture.semanticBudgets,
				capabilities: ['TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: '<resolved-subject>'
			},
			subjectRequest: {
				budgets: fixture.subjectBudgets,
				rootLocator: '<repository-root>'
			}
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const request = requestFor('snapshot', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('snapshot', input, request), { handlers })
		);

		expectBudgetRefusal(run, request);
		expect(dependencies.resolveSubject).not.toHaveBeenCalled();
		expect(dependencies.buildSnapshot).not.toHaveBeenCalled();
	});

	it.each([
		{
			budget: { maxFanout: 50_001 },
			name: 'fanout beyond the enclosing edge budget'
		},
		{
			budget: { maxTraceNodes: 20_001 },
			name: 'trace nodes beyond the enclosing node budget'
		}
	])('refuses nested query $name', async ({ budget }) => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publishMockSnapshot(store);
		const queryRef = await publish(store, {
			budgets: {
				maxDiagnostics: 1_000,
				maxResultBytes: 500_000,
				maxResultRecords: 1_000,
				query: { ...BOUNDED_QUERY_BUDGETS, ...budget },
				semantic: BOUNDED_SEMANTIC_BUDGETS,
				subject: BOUNDED_SUBJECT_BUDGETS
			},
			executionId: 'nested-query-budget-refusal',
			expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef,
			snapshotRef
		};
		const request = requestFor('query', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('query', input, request), { handlers })
		);

		expectBudgetRefusal(run, request);
		expect(dependencies.query).not.toHaveBeenCalled();
	});

	it('refuses nested static-impact traversal beyond the enclosing edge budget', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publishMockSnapshot(store);
		const changeSetRef = await publish(store, {
			budgets: {
				...BOUNDED_STATIC_IMPACT_BUDGETS,
				reachability: { ...BOUNDED_REACHABILITY_BUDGETS, maxTraversalSteps: 50_001 }
			},
			operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			seed: { id: 'nested-static-impact-budget-refusal' },
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef,
			kind: 'IMPACT',
			snapshotRef
		};
		const request = requestFor('impact', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('impact', input, request), { handlers })
		);

		expectBudgetRefusal(run, request);
		expect(dependencies.staticImpact).not.toHaveBeenCalled();
		expect(dependencies.workingImpact).not.toHaveBeenCalled();
	});

	it('refuses nested working-impact observation duration beyond the enclosing timeout', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publishMockSnapshot(store);
		const changeSetRef = await publish(store, {
			budgets: {
				maxResultBytes: 500_000,
				observation: {
					...BOUNDED_WORKING_OBSERVATION_BUDGETS,
					maxGitOperationDurationMs: 30_001
				},
				staticImpact: { ...BOUNDED_STATIC_IMPACT_BUDGETS, maxResultBytes: 400_000 }
			},
			immutableBaseCommitOid: 'c'.repeat(40),
			operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			seed: { id: 'nested-working-impact-budget-refusal' },
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef,
			kind: 'IMPACT',
			snapshotRef
		};
		const request = requestFor('impact', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('impact', input, request), { handlers })
		);

		expectBudgetRefusal(run, request);
		expect(dependencies.workingImpact).not.toHaveBeenCalled();
		expect(dependencies.staticImpact).not.toHaveBeenCalled();
	});

	it('refuses findings source bytes beyond the reserved native artifact budget', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publishMockSnapshot(store);
		const findingsRef = await publish(store, {
			budgets: {
				maxArtifacts: 1_000,
				maxAstNodes: 1_000,
				maxDurationMs: 10_000,
				maxResultBytes: 500_000,
				maxSourceBytes: 901_697
			},
			executionDisposition: 'NOT_RUN',
			executionId: 'nested-findings-budget-refusal',
			hybridRuntimeEvidence: null,
			hybridStaticObservedAt: REQUESTED_AT,
			kind: 'JPWB_HARMONIZATION_NATIVE_FINDINGS_REQUEST',
			operationVersion: JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION,
			schemaVersion: CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
			snapshotRef
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('findings'),
			kind: 'FINDINGS',
			ruleProfileRef: findingsRef,
			snapshotRef
		};
		const request = requestFor('findings', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('findings', input, request), { handlers })
		);

		expectBudgetRefusal(run, request);
		expect(dependencies.projectFindings).not.toHaveBeenCalled();
	});

	it.each([
		{ budget: { maxUnregisteredScalar: 1 }, name: 'unknown scalar leaf' },
		{ budget: { maxUnregisteredArray: [1] }, name: 'unknown array leaf' },
		{ budget: { maxUnregisteredNull: null }, name: 'unknown null leaf' },
		{ budget: { unregisteredRecord: { maxNodes: 1 } }, name: 'unknown nested record' },
		{ budget: { query: [] }, name: 'non-record registered container' }
	])('fails closed for an $name', async ({ budget }) => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRequestRef = await publish(store, {
			kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
			schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
			semanticRequest: {
				assignabilityRequests: [],
				budgets: BOUNDED_SEMANTIC_BUDGETS,
				capabilities: ['TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: '<resolved-subject>'
			},
			subjectRequest: {
				budgets: { ...BOUNDED_SUBJECT_BUDGETS, ...budget },
				rootLocator: '<repository-root>'
			}
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const request = requestFor('snapshot', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('snapshot', input, request), { handlers })
		);

		expectInvalidBudgetRefusal(run, request);
		expect(dependencies.resolveSubject).not.toHaveBeenCalled();
		expect(dependencies.buildSnapshot).not.toHaveBeenCalled();
	});

	it('requires an exact target-record binding before a query operation can execute', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publish(store, {
			buildOutcome: 'complete',
			captureRequestRef: `artifact:sha256:${'c'.repeat(64)}`,
			diagnostics: [],
			schemaVersion: 'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0',
			snapshot: mockSnapshot()
		});
		const queryRef = await publish(store, {
			budgets: { maxResultBytes: 500_000, maxResultRecords: 1_000 },
			executionId: 'wrong-locator-digest',
			expression: { field: 'logicalPath', kind: 'EQUALS', nodeId: 'root', value: 'src/a.ts' },
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef,
			snapshotRef
		};
		const request = requestFor('query', input, {
			subjectInput: {
				kind: 'TARGET_RECORD',
				targetRecordRef: 'artifact:sha256:' + 'b'.repeat(64)
			}
		});
		const run = completedRun(
			await runCodingAgentCli(argvFor('query', input, request), { handlers })
		);

		expect(run.exitCode).toBe(2);
		expect(terminalJson(run)).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error',
			refusal: { code: 'CSAA-E-REQUEST-INVALID-PARAMETER' }
		});
		expect(dependencies.query).not.toHaveBeenCalled();
		expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
	});

	it('rejects an artifact-supplied repository root before subject resolution', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const dependencies = mockDependencies();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRequestRef = await publish(store, {
			kind: 'STATIC_SEMANTIC_SNAPSHOT_REQUEST',
			schemaVersion: CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
			semanticRequest: {
				assignabilityRequests: [],
				budgets: { maxDurationMs: 1_000, maxSnapshotBytes: 100_000 },
				capabilities: ['TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: 'C:/attacker-selected-root',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: '<resolved-subject>'
			},
			subjectRequest: {
				budgets: { maxDurationMs: 1_000 },
				rootLocator: '<repository-root>'
			}
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const request = requestFor('snapshot', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('snapshot', input, request), { handlers })
		);

		expect(run.exitCode).toBe(2);
		expect(terminalJson(run)).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error',
			refusal: { code: 'CSAA-E-REQUEST-INVALID-PARAMETER' }
		});
		expect(dependencies.resolveSubject).not.toHaveBeenCalled();
	});

	it('dispatches the exact working-source impact contract without invoking static impact directly', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const baseDependencies = mockDependencies();
		const workingOutcome = {
			diagnostics: [],
			operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			outcome: 'partial',
			result: {
				currentness: {
					state: 'CURRENT_FOR_VALIDATED_SELECTED_WORKING_SOURCE_EDIT'
				},
				evidence: {
					staticModuleImpactCandidateReport: {
						result: { invalidationDependencies: { semanticSnapshotId: SNAPSHOT_ID } }
					}
				}
			},
			state: 'partial',
			subject: { subjectId: SUBJECT_ID }
		} as unknown as WorkingSourceEditImpactCandidateReportOutcome;
		const dependencies: CodingAgentCliCompositionDependencies = {
			...baseDependencies,
			workingImpact: vi.fn((_request, options) => {
				options.onPredecessorProgress?.({ phase: 'working graph', state: 'complete' } as never);
				return workingOutcome;
			})
		};
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies,
			repositoryRoot: process.cwd()
		});
		const snapshotRef = await publish(store, {
			buildOutcome: 'complete',
			captureRequestRef: `artifact:sha256:${'c'.repeat(64)}`,
			diagnostics: [],
			schemaVersion: 'jan-csaa-coding-agent-static-semantic-snapshot-result/0.1.0',
			snapshot: mockSnapshot()
		});
		const changeSetRef = await publish(store, {
			budgets: {
				maxResultBytes: 500_000,
				observation: BOUNDED_WORKING_OBSERVATION_BUDGETS,
				staticImpact: { ...BOUNDED_STATIC_IMPACT_BUDGETS, maxResultBytes: 400_000 }
			},
			immutableBaseCommitOid: 'c'.repeat(40),
			operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			seed: { id: 'working-edit' },
			subjectProjectConfigPaths: ['tsconfig.json']
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef,
			kind: 'IMPACT',
			snapshotRef
		};
		const request = requestFor('impact', input);
		const run = completedRun(
			await runCodingAgentCli(argvFor('impact', input, request), { handlers })
		);

		expect(run.exitCode).toBe(3);
		expect(terminalJson(run)).toMatchObject({ outcome: 'partial', state: 'partial' });
		expect(dependencies.workingImpact).toHaveBeenCalledTimes(1);
		expect(dependencies.staticImpact).not.toHaveBeenCalled();
		expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
	});

	it('maps every artifact-store read failure through a closed protocol response', async () => {
		const exactBytes = new TextEncoder().encode(canonicalInventoryJson(snapshotRequestArtifact()));
		const oversizedBytes = new Uint8Array(
			CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes + 1
		);
		const cases: readonly {
			readonly expectedCode: string;
			readonly reference: string;
			readonly store: CodingAgentCliArtifactStore;
		}[] = [
			{
				expectedCode: 'CSAA-E-EXECUTION-BUDGET-REFUSED',
				reference: codingAgentCliArtifactReference(oversizedBytes),
				store: { read: () => oversizedBytes, write: () => undefined }
			},
			{
				expectedCode: 'CSAA-E-REQUEST-INVALID-PARAMETER',
				reference: codingAgentCliArtifactReference(exactBytes),
				store: { read: () => null, write: () => undefined }
			},
			{
				expectedCode: 'CSAA-E-CAPABILITY-NOT-ANALYZED',
				reference: codingAgentCliArtifactReference(exactBytes),
				store: {
					read: () => {
						throw new Error('fixture store unavailable');
					},
					write: () => undefined
				}
			},
			{
				expectedCode: 'CSAA-E-REQUEST-INVALID-PARAMETER',
				reference: codingAgentCliArtifactReference('{"different":true}'),
				store: { read: () => exactBytes, write: () => undefined }
			}
		];

		for (const candidate of cases) {
			const input: CodingAgentCliOperationInput = {
				...inputBase('snapshot'),
				kind: 'SNAPSHOT',
				subjectInputRef: candidate.reference
			};
			const result = await runComposedFixture('snapshot', input, candidate.store);
			expect(result.terminal).toMatchObject({
				outcome: 'error',
				refusal: { code: candidate.expectedCode }
			});
			expect(
				validateAgentOperationExchange(result.request, result.run.terminalResponse).state
			).toBe('VALID');
		}
	});

	it('emits bounded query progress and preserves every owning-report refusal state', async () => {
		const unavailableStates = ['resource-refused', 'stale', 'incompatible', 'failed'] as const;
		for (const state of unavailableStates) {
			const store = new InMemoryCodingAgentCliArtifactStore();
			const snapshotRef = await publishMockSnapshot(store);
			const queryRef = await publish(store, queryRequestArtifact());
			const input: CodingAgentCliOperationInput = {
				...inputBase('query'),
				kind: 'QUERY',
				queryRef,
				snapshotRef
			};
			const dependencies: CodingAgentCliCompositionDependencies = {
				...mockDependencies(),
				query: vi.fn(
					async () =>
						({
							diagnostics: [],
							operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
							outcome: 'unavailable',
							state,
							subject: { subjectId: SUBJECT_ID }
						}) as unknown as SemanticSourceQueryReportOutcome
				)
			};
			const result = await runComposedFixture('query', input, store, dependencies);
			expect(result.terminal).toMatchObject({ outcome: 'error' });
			expect(dependencies.query).toHaveBeenCalledTimes(1);
			expect(
				validateAgentOperationExchange(result.request, result.run.terminalResponse).state
			).toBe('VALID');
		}

		const staleStore = new InMemoryCodingAgentCliArtifactStore();
		const staleSnapshotRef = await publishMockSnapshot(staleStore);
		const staleQueryRef = await publish(staleStore, queryRequestArtifact());
		const staleInput: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef: staleQueryRef,
			snapshotRef: staleSnapshotRef
		};
		const staleResult = await runComposedFixture('query', staleInput, staleStore, {
			...mockDependencies(),
			query: vi.fn(
				async () =>
					({
						diagnostics: [],
						operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
						outcome: 'partial',
						result: {
							currentness: {
								changedPaths: ['src/changed.ts'],
								state: 'CURRENT_FOR_CAPTURED_SUBJECT'
							},
							population: { semanticSnapshotId: SNAPSHOT_ID }
						},
						state: 'partial',
						subject: { subjectId: SUBJECT_ID }
					}) as unknown as SemanticSourceQueryReportOutcome
			)
		});
		expect(staleResult.terminal).toMatchObject({
			outcome: 'error',
			refusal: { code: 'CSAA-E-SUBJECT-STALE' },
			state: 'incompatible'
		});

		const progressStore = new InMemoryCodingAgentCliArtifactStore();
		const progressSnapshotRef = await publishMockSnapshot(progressStore);
		const progressQueryRef = await publish(progressStore, queryRequestArtifact());
		const progressInput: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef: progressQueryRef,
			snapshotRef: progressSnapshotRef
		};
		const baseDependencies = mockDependencies();
		const progressDependencies: CodingAgentCliCompositionDependencies = {
			...baseDependencies,
			query: vi.fn(async (request, options) => {
				for (
					let index = 0;
					index < CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxProgressResponses + 2;
					index += 1
				)
					options.onProgress?.({ phase: `phase-${String(index)}`, state: 'complete' } as never);
				return await baseDependencies.query(request, options);
			})
		};
		const progressResult = await runComposedFixture(
			'query',
			progressInput,
			progressStore,
			progressDependencies
		);
		expect(progressResult.terminal).toMatchObject({
			outcome: 'partial',
			warningRefs: expect.arrayContaining(['warning:progress-events-truncated'])
		});
	});

	it('maps impact progress, unsupported contracts, unavailable reports, and stale reports', async () => {
		const progressStore = new InMemoryCodingAgentCliArtifactStore();
		const progressSnapshotRef = await publishMockSnapshot(progressStore);
		const progressImpactRef = await publish(progressStore, staticImpactRequestArtifact());
		const progressInput: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef: progressImpactRef,
			kind: 'IMPACT',
			snapshotRef: progressSnapshotRef
		};
		const baseDependencies = mockDependencies();
		const progressDependencies: CodingAgentCliCompositionDependencies = {
			...baseDependencies,
			staticImpact: vi.fn((request, options) => {
				options.onPredecessorProgress?.({ phase: 'graph expansion', state: 'complete' } as never);
				return baseDependencies.staticImpact(request, options);
			})
		};
		const progressResult = await runComposedFixture(
			'impact',
			progressInput,
			progressStore,
			progressDependencies
		);
		expect(progressResult.terminal).toMatchObject({ outcome: 'partial' });

		const unavailableStore = new InMemoryCodingAgentCliArtifactStore();
		const unavailableSnapshotRef = await publishMockSnapshot(unavailableStore);
		const unavailableImpactRef = await publish(unavailableStore, staticImpactRequestArtifact());
		const unavailableInput: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef: unavailableImpactRef,
			kind: 'IMPACT',
			snapshotRef: unavailableSnapshotRef
		};
		const unavailableResult = await runComposedFixture(
			'impact',
			unavailableInput,
			unavailableStore,
			{
				...mockDependencies(),
				staticImpact: vi.fn(
					() =>
						({
							diagnostics: [],
							operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
							outcome: 'unavailable',
							state: 'failed',
							subject: { subjectId: SUBJECT_ID }
						}) as unknown as StaticModuleImpactCandidateReportOutcome
				)
			}
		);
		expect(unavailableResult.terminal).toMatchObject({ outcome: 'error' });

		const staleStore = new InMemoryCodingAgentCliArtifactStore();
		const staleSnapshotRef = await publishMockSnapshot(staleStore);
		const staleImpactRef = await publish(staleStore, staticImpactRequestArtifact());
		const staleInput: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef: staleImpactRef,
			kind: 'IMPACT',
			snapshotRef: staleSnapshotRef
		};
		const staleResult = await runComposedFixture('impact', staleInput, staleStore, {
			...mockDependencies(),
			staticImpact: vi.fn(
				() =>
					({
						diagnostics: [],
						operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
						outcome: 'partial',
						result: {
							currentness: { state: 'STALE' },
							invalidationDependencies: { semanticSnapshotId: SNAPSHOT_ID }
						},
						state: 'partial',
						subject: { subjectId: SUBJECT_ID }
					}) as unknown as StaticModuleImpactCandidateReportOutcome
			)
		});
		expect(staleResult.terminal).toMatchObject({
			outcome: 'error',
			refusal: { code: 'CSAA-E-SUBJECT-STALE' },
			state: 'incompatible'
		});

		const unsupportedStore = new InMemoryCodingAgentCliArtifactStore();
		const unsupportedSnapshotRef = await publishMockSnapshot(unsupportedStore);
		const unsupportedImpactRef = await publish(unsupportedStore, { schemaVersion: 'unsupported' });
		const unsupportedInput: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef: unsupportedImpactRef,
			kind: 'IMPACT',
			snapshotRef: unsupportedSnapshotRef
		};
		const unsupportedResult = await runComposedFixture(
			'impact',
			unsupportedInput,
			unsupportedStore
		);
		expect(unsupportedResult.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});
	});

	it('rejects malformed findings request and runtime-evidence envelopes before projection', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const snapshotRef = await publishMockSnapshot(store);
		const malformedRequests: readonly {
			readonly change: (candidate: Record<string, unknown>) => void;
		}[] = [
			{ change: (candidate) => void (candidate.kind = 'OTHER') },
			{ change: (candidate) => void (candidate.operationVersion = 'unsupported') },
			{
				change: (candidate) => void (candidate.snapshotRef = `artifact:sha256:${'b'.repeat(64)}`)
			},
			{
				change: (candidate) =>
					void ((candidate.budgets as Record<string, unknown>).maxArtifacts = 0)
			},
			{ change: (candidate) => void (candidate.executionDisposition = 'INVALID') },
			{ change: (candidate) => void (candidate.executionId = 'x'.repeat(2_049)) },
			{
				change: (candidate) => void (candidate.hybridStaticObservedAt = '2026-08-25T00:00:00Z')
			}
		];
		for (const candidate of malformedRequests) {
			const artifact = structuredClone(findingsRequestArtifact(snapshotRef)) as Record<
				string,
				unknown
			>;
			candidate.change(artifact);
			const ruleProfileRef = await publish(store, artifact);
			const input: CodingAgentCliOperationInput = {
				...inputBase('findings'),
				kind: 'FINDINGS',
				ruleProfileRef,
				snapshotRef
			};
			const dependencies = mockDependencies();
			const result = await runComposedFixture('findings', input, store, dependencies);
			expect(result.terminal).toMatchObject({ outcome: 'error' });
			expect(dependencies.projectFindings).not.toHaveBeenCalled();
		}

		const fixture = providerFixture(HYBRID_RISKY_SOURCES);
		const runtimeContext = providerContext(
			fixture.root,
			fixture.subject,
			DETERMINISTIC_RUNTIME_TRACE_PROVIDER_ID
		);
		const traceRef = await publish(store, hybridRuntimeTrace(runtimeContext));
		const runtimeBase = {
			assessedAt: runtimeContext.assessedAt,
			freshnessWindowMs: runtimeContext.freshnessWindowMs,
			kind: 'SUPPLIED_DETERMINISTIC_RUNTIME_TRACE',
			run: runtimeContext.run,
			traceRef
		};
		const malformedRuntime: readonly ((candidate: Record<string, unknown>) => void)[] = [
			(candidate) => void (candidate.kind = 'OTHER'),
			(candidate) => void (candidate.freshnessWindowMs = -1),
			(candidate) => void (candidate.assessedAt = 'not-a-time'),
			(candidate) => void ((candidate.run as Record<string, unknown>).command = []),
			(candidate) => void ((candidate.run as Record<string, unknown>).command = ['']),
			(candidate) =>
				void ((
					(candidate.run as Record<string, unknown>).termination as Record<string, unknown>
				).exitCode = 1.5),
			(candidate) =>
				void ((candidate.run as Record<string, unknown>).termination = {
					kind: 'CRASHED',
					signal: ''
				}),
			(candidate) =>
				void ((candidate.run as Record<string, unknown>).termination = {
					budgetMs: 0,
					kind: 'TIMED_OUT'
				}),
			(candidate) =>
				void ((candidate.run as Record<string, unknown>).termination = { kind: 'OTHER' }),
			(candidate) =>
				void ((
					(candidate.run as Record<string, unknown>).provider as Record<string, unknown>
				).configurationSha256 = 'A'.repeat(64)),
			(candidate) =>
				void ((candidate.run as Record<string, unknown>).endedAt = '2026-08-25T12:00:02.00Z'),
			(candidate) => void ((candidate.run as Record<string, unknown>).outputComplete = 'yes')
		];
		for (const change of malformedRuntime) {
			const runtime = structuredClone(runtimeBase) as Record<string, unknown>;
			change(runtime);
			const ruleProfileRef = await publish(store, findingsRequestArtifact(snapshotRef, runtime));
			const input: CodingAgentCliOperationInput = {
				...inputBase('findings'),
				kind: 'FINDINGS',
				ruleProfileRef,
				snapshotRef
			};
			const dependencies = mockDependencies();
			const result = await runComposedFixture('findings', input, store, dependencies);
			expect(result.terminal).toMatchObject({
				exitCategory: 'INVALID_REQUEST',
				outcome: 'error'
			});
			expect(dependencies.projectFindings).not.toHaveBeenCalled();
		}
	});

	it('maps native findings projection refusal, binding, and final-currentness failures', async () => {
		const runFindings = async (dependencies: CodingAgentCliCompositionDependencies) => {
			const store = new InMemoryCodingAgentCliArtifactStore();
			const snapshotRef = await publishMockSnapshot(store);
			const ruleProfileRef = await publish(store, findingsRequestArtifact(snapshotRef));
			const input: CodingAgentCliOperationInput = {
				...inputBase('findings'),
				kind: 'FINDINGS',
				ruleProfileRef,
				snapshotRef
			};
			return await runComposedFixture('findings', input, store, dependencies);
		};

		for (const state of ['resource-refused', 'failed'] as const) {
			const result = await runFindings({
				...mockDependencies(),
				projectFindings: vi.fn(
					() =>
						({
							diagnostics: [],
							outcome: 'unavailable',
							state
						}) as never
				)
			});
			expect(result.terminal).toMatchObject({ outcome: 'error' });
		}

		const wrongBindingBase = mockDependencies();
		const wrongBinding = await runFindings({
			...wrongBindingBase,
			projectFindings: vi.fn((request) => {
				const outcome = structuredClone(wrongBindingBase.projectFindings(request));
				if (outcome.outcome !== 'projected') throw new Error('Expected fixture projection.');
				return {
					...outcome,
					result: {
						...outcome.result,
						currentness: {
							...outcome.result.currentness,
							frozenSubjectId: 'subject:wrong-binding'
						}
					}
				};
			})
		});
		expect(wrongBinding.terminal).toMatchObject({ outcome: 'error' });

		const staleBase = mockDependencies();
		let verificationCalls = 0;
		const stale = await runFindings({
			...staleBase,
			verifySubject: vi.fn(() => {
				verificationCalls += 1;
				return verificationCalls === 1
					? { changedPaths: [], diagnostics: [], state: 'CURRENT' as const }
					: {
							changedPaths: ['src/changed-during-findings.ts'],
							diagnostics: [],
							state: 'STALE' as const
						};
			})
		});
		expect(stale.terminal).toMatchObject({
			outcome: 'error',
			refusal: { code: 'CSAA-E-SUBJECT-STALE' },
			state: 'incompatible'
		});
	});

	it('rejects stale or internally inconsistent stored findings before explanation replay', async () => {
		const fixture = await runHybridFindingsFixture();
		const explanationProfileRef = await publish(fixture.store, {
			evaluationId: 'hybrid-findings-v2-native-not-run:JAN-CSAA-HARMONIZATION-001',
			findingFingerprint: null,
			findingId: 1,
			kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
			schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
		});
		const record = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
		const mutations: readonly ((candidate: Record<string, unknown>) => void)[] = [
			(candidate) => void (candidate.schemaVersion = 'unsupported'),
			(candidate) => void (record(candidate.currentness).basis = 'UNSUPPORTED'),
			(candidate) => void (record(record(candidate.currentness).beforeProjection).state = 'STALE'),
			(candidate) =>
				void (record(record(candidate.currentness).beforeProjection).changedPaths = [
					'src/changed.ts'
				]),
			(candidate) => void (record(candidate.nativeProjectionOutcome).state = 'failed'),
			(candidate) =>
				void (record(record(candidate.nativeProjectionOutcome).result).projections = []),
			(candidate) =>
				void (record(
					record(record(candidate.nativeProjectionOutcome).result).resultWitness
				).sha256 = 'f'.repeat(64)),
			(candidate) =>
				void (record(record(candidate.hybridEvidence).staticProjection).schemaVersion =
					'unsupported'),
			(candidate) => void (record(candidate.hybridEvidence).runtimeTraceRef = null),
			(candidate) =>
				void (record(record(candidate.hybridEvidence).runtimeTrace).schemaVersion = 'unsupported')
		];
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: fixture.store,
			dependencies: fixture.dependencies,
			repositoryRoot: fixture.repositoryRoot
		});
		for (const change of mutations) {
			const candidate = structuredClone(fixture.findingsResult) as unknown as Record<
				string,
				unknown
			>;
			change(candidate);
			const resultRef = await publish(fixture.store, candidate);
			const input: CodingAgentCliOperationInput = {
				...inputBase('explain'),
				explanationProfileRef,
				kind: 'EXPLAIN',
				resultRef
			};
			const request = requestFor('explain', input, {
				subjectInput: {
					kind: 'RESOLVED_SUBJECT',
					subjectId: fixture.subject.descriptor.subjectId
				}
			});
			const run = completedRun(
				await runCodingAgentCli(argvFor('explain', input, request), { handlers })
			);
			expect(terminalJson(run)).toMatchObject({ outcome: 'error' });
			expect(validateAgentOperationExchange(request, run.terminalResponse).state).toBe('VALID');
		}
	});

	it('fails closed for malformed verification matrices and too many distinct artifacts', async () => {
		const malformed: readonly ((candidate: Record<string, unknown>) => void)[] = [
			(candidate) => void (candidate.kind = 'OTHER'),
			(candidate) => void (candidate.assertions = []),
			(candidate) =>
				void ((candidate.assertions as Record<string, unknown>[])[0]!.sha256 = 'A'.repeat(64)),
			(candidate) =>
				void (candidate.assertions = [
					{
						artifactRef: `artifact:sha256:${'a'.repeat(64)}`,
						expected: true,
						kind: 'JSON_VALUE_EQUALS',
						path: ['__proto__']
					}
				]),
			(candidate) =>
				void (candidate.assertions = [
					{
						artifactRef: `artifact:sha256:${'a'.repeat(64)}`,
						expected: 'x'.repeat(65_537),
						kind: 'JSON_VALUE_EQUALS',
						path: ['value']
					}
				]),
			(candidate) => void ((candidate.assertions as Record<string, unknown>[])[0]!.kind = 'OTHER'),
			(candidate) =>
				void (candidate.assertions = Array.from(
					{
						length:
							CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.maxVerificationDistinctArtifacts + 1
					},
					(_, index) => ({
						artifactRef: `artifact:sha256:${index.toString(16).padStart(64, '0')}`,
						kind: 'ARTIFACT_DIGEST_EQUALS',
						sha256: index.toString(16).padStart(64, '0')
					})
				))
		];
		for (const change of malformed) {
			const store = new InMemoryCodingAgentCliArtifactStore();
			const snapshotRef = await publishMockSnapshot(store);
			const expectation = {
				assertions: [
					{
						artifactRef: snapshotRef,
						kind: 'ARTIFACT_DIGEST_EQUALS',
						sha256: codingAgentCliArtifactDigest(snapshotRef)
					}
				],
				kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
				schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
				snapshotId: SNAPSHOT_ID,
				subjectId: SUBJECT_ID
			} as Record<string, unknown>;
			change(expectation);
			const expectationRef = await publish(store, expectation);
			const input: CodingAgentCliOperationInput = {
				...inputBase('verify'),
				expectationRef,
				kind: 'VERIFY',
				subjectInputRef: snapshotRef
			};
			const result = await runComposedFixture('verify', input, store);
			expect(result.terminal).toMatchObject({ outcome: 'error' });
		}
	});

	it('caches absent verification artifacts and rejects hostile selected JSON populations', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const snapshotRef = await publishMockSnapshot(store);
		const missingRef = `artifact:sha256:${'f'.repeat(64)}`;
		const dataRef = await publish(store, { list: [1], object: { present: true }, scalar: 1 });
		const expectationRef = await publish(store, {
			assertions: [
				{ artifactRef: missingRef, kind: 'ARTIFACT_DIGEST_EQUALS', sha256: '0'.repeat(64) },
				{ artifactRef: missingRef, expected: true, kind: 'JSON_VALUE_EQUALS', path: ['value'] },
				{ artifactRef: dataRef, expected: true, kind: 'JSON_VALUE_EQUALS', path: ['list', 3] },
				{ artifactRef: dataRef, expected: true, kind: 'JSON_VALUE_EQUALS', path: ['scalar', 'x'] },
				{
					artifactRef: dataRef,
					expected: true,
					kind: 'JSON_VALUE_EQUALS',
					path: ['object', 'missing']
				}
			],
			kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
			schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
			snapshotId: SNAPSHOT_ID,
			subjectId: SUBJECT_ID
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('verify'),
			expectationRef,
			kind: 'VERIFY',
			subjectInputRef: snapshotRef
		};
		const result = await runComposedFixture('verify', input, store);
		expect(result.terminal).toMatchObject({ exitCategory: 'FAILED_EXPECTATION', outcome: 'error' });

		const largeArrayRef = await publish(store, {
			items: Array.from({ length: 20_001 }, () => 0)
		});
		const largeExpectationRef = await publish(store, {
			assertions: [
				{
					artifactRef: largeArrayRef,
					expected: 0,
					kind: 'JSON_VALUE_EQUALS',
					path: ['items', 0]
				}
			],
			kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
			schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
			snapshotId: SNAPSHOT_ID,
			subjectId: SUBJECT_ID
		});
		const largeInput: CodingAgentCliOperationInput = {
			...inputBase('verify'),
			expectationRef: largeExpectationRef,
			kind: 'VERIFY',
			subjectInputRef: snapshotRef
		};
		const largeResult = await runComposedFixture('verify', largeInput, store);
		expect(largeResult.terminal).toMatchObject({ outcome: 'error', state: 'resource-refused' });
	});

	it('refuses non-absence artifact corruption while evaluating a verification matrix', async () => {
		const backing = new InMemoryCodingAgentCliArtifactStore();
		const corruptedRef = `artifact:sha256:${'e'.repeat(64)}`;
		const store: CodingAgentCliArtifactStore = {
			read: (reference) =>
				reference === corruptedRef
					? new TextEncoder().encode('{"corrupted":true}')
					: backing.read(reference),
			write: (reference, bytes) => backing.write(reference, bytes)
		};
		const snapshotRef = await publishMockSnapshot(store);
		const expectationRef = await publish(store, {
			assertions: [
				{ artifactRef: corruptedRef, kind: 'ARTIFACT_DIGEST_EQUALS', sha256: 'e'.repeat(64) }
			],
			kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
			schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
			snapshotId: SNAPSHOT_ID,
			subjectId: SUBJECT_ID
		});
		const input: CodingAgentCliOperationInput = {
			...inputBase('verify'),
			expectationRef,
			kind: 'VERIFY',
			subjectInputRef: snapshotRef
		};
		const result = await runComposedFixture('verify', input, store);
		expect(result.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});
	});

	it('rejects owning, local, and snapshot capability drift before reading artifacts', async () => {
		const firstRef = `artifact:sha256:${'a'.repeat(64)}`;
		const secondRef = `artifact:sha256:${'b'.repeat(64)}`;
		const queryCapability = capabilityFor('query');
		const inventoryCapability = capabilityFor('inventory');
		const snapshotCapability = capabilityFor('snapshot');
		const snapshotInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: firstRef
		};
		const probes: readonly {
			readonly input: CodingAgentCliOperationInput;
			readonly operation: AgentOperation;
			readonly requirement: AgentOperationRequest['capabilityRequirement'];
		}[] = [
			{
				input: {
					...inputBase('query'),
					kind: 'QUERY',
					queryRef: firstRef,
					snapshotRef: secondRef
				},
				operation: 'query',
				requirement: {
					affectedQuestionRefs: ['question:fixture:query-capability'],
					capabilityId: queryCapability.capabilityId,
					capabilityVersion: `${queryCapability.capabilityVersion}-unsupported`,
					necessity: 'MANDATORY'
				}
			},
			{
				input: {
					...inputBase('inventory'),
					kind: 'INVENTORY',
					subjectInputRef: firstRef
				},
				operation: 'inventory',
				requirement: {
					affectedQuestionRefs: ['question:fixture:inventory-capability'],
					capabilityId: inventoryCapability.capabilityId,
					capabilityVersion: `${inventoryCapability.capabilityVersion}-unsupported`,
					necessity: 'MANDATORY'
				}
			},
			{
				input: snapshotInput,
				operation: 'snapshot',
				requirement: {
					affectedQuestionRefs: ['question:fixture:snapshot-capability'],
					capabilityId: 'JAN-CSAA-CAP-999',
					capabilityVersion: 'JAN-CSAA-CAP-999@0.1.0',
					necessity: 'MANDATORY'
				}
			},
			{
				input: snapshotInput,
				operation: 'snapshot',
				requirement: {
					affectedQuestionRefs: ['question:fixture:snapshot-version'],
					capabilityId: snapshotCapability.capabilityId,
					capabilityVersion: `${snapshotCapability.capabilityVersion}-unsupported`,
					necessity: 'MANDATORY'
				}
			}
		];
		for (const probe of probes) {
			const result = await runComposedFixture(
				probe.operation,
				probe.input,
				new InMemoryCodingAgentCliArtifactStore(),
				mockDependencies(),
				{ capabilityRequirement: probe.requirement }
			);
			expect(result.terminal).toMatchObject({
				outcome: 'error',
				refusal: { code: 'CSAA-E-CAPABILITY-UNSUPPORTED' }
			});
		}
	});

	it('enforces alternate subject bindings and composition-owned budget boundaries', async () => {
		const snapshotStore = new InMemoryCodingAgentCliArtifactStore();
		const snapshotRequestRef = await publish(snapshotStore, snapshotRequestArtifact());
		const snapshotInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const wrongRef = `artifact:sha256:${'b'.repeat(64)}`;
		const locatorMismatch = await runComposedFixture(
			'snapshot',
			snapshotInput,
			snapshotStore,
			mockDependencies(),
			{
				subjectInput: {
					kind: 'SUBJECT_LOCATOR',
					locatorDigest: codingAgentCliArtifactDigest(wrongRef),
					locatorRef: wrongRef,
					resolutionPolicyRef: 'policy:fixture'
				}
			}
		);
		expect(locatorMismatch.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});

		const lowOutputRequest = requestFor('snapshot', snapshotInput, {
			budgets: {
				...requestFor('snapshot', snapshotInput).budgets,
				maxOutputBytes: CODING_AGENT_CLI_COMPOSITION_SAFETY_CEILINGS.outputEnvelopeReservationBytes
			},
			subjectInput: {
				kind: 'SUBJECT_LOCATOR',
				locatorDigest: codingAgentCliArtifactDigest(snapshotRequestRef),
				locatorRef: snapshotRequestRef,
				resolutionPolicyRef: 'policy:fixture'
			}
		});
		const lowOutputHandler = composeCodingAgentCliHandlers({
			artifactStore: snapshotStore,
			dependencies: mockDependencies(),
			repositoryRoot: process.cwd()
		}).snapshot!;
		const lowOutputResponse = await lowOutputHandler({
			implementationState: 'IMPLEMENTED',
			invocation: {
				command: 'snapshot',
				input: snapshotInput,
				request: lowOutputRequest
			},
			signal: new AbortController().signal
		} as never);
		expect(lowOutputResponse[0]).toMatchObject({ outcome: 'error' });

		let nestedBudgets: Record<string, unknown> = { maxBytes: 1 };
		for (let depth = 0; depth < 34; depth += 1) nestedBudgets = { subject: nestedBudgets };
		const deeplyNestedRequest = structuredClone(snapshotRequestArtifact()) as unknown as Record<
			string,
			unknown
		>;
		(deeplyNestedRequest.subjectRequest as Record<string, unknown>).budgets = nestedBudgets;
		const deeplyNestedRef = await publish(snapshotStore, deeplyNestedRequest);
		const deeplyNestedInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot'),
			kind: 'SNAPSHOT',
			subjectInputRef: deeplyNestedRef
		};
		const deeplyNested = await runComposedFixture('snapshot', deeplyNestedInput, snapshotStore);
		expect(deeplyNested.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});

		const queryStore = new InMemoryCodingAgentCliArtifactStore();
		const snapshotRef = await publishMockSnapshot(queryStore);
		const queryRef = await publish(queryStore, queryRequestArtifact());
		const queryInput: CodingAgentCliOperationInput = {
			...inputBase('query'),
			kind: 'QUERY',
			queryRef,
			snapshotRef
		};
		const exactTarget = {
			kind: 'TARGET_RECORD' as const,
			targetRecordRef: snapshotRef
		};
		const targetResult = await runComposedFixture(
			'query',
			queryInput,
			queryStore,
			mockDependencies(),
			{ subjectInput: exactTarget }
		);
		expect(targetResult.terminal).toMatchObject({ outcome: 'partial' });

		const resolvedMismatch = await runComposedFixture(
			'query',
			queryInput,
			queryStore,
			mockDependencies(),
			{
				subjectInput: { kind: 'RESOLVED_SUBJECT', subjectId: POST_SUBJECT_ID }
			}
		);
		expect(resolvedMismatch.terminal).toMatchObject({
			outcome: 'error',
			refusal: { code: 'CSAA-E-SUBJECT-STALE' }
		});

		const currentnessMismatch = await runComposedFixture(
			'query',
			queryInput,
			queryStore,
			mockDependencies(),
			{
				currentnessRequirement: {
					kind: 'REQUIRE_EXACT_SUBJECT',
					subjectId: POST_SUBJECT_ID
				},
				subjectInput: exactTarget
			}
		);
		expect(currentnessMismatch.terminal).toMatchObject({
			outcome: 'error',
			refusal: { code: 'CSAA-E-SUBJECT-STALE' }
		});

		const unsupportedQuery = structuredClone(queryRequestArtifact()) as Record<string, unknown>;
		unsupportedQuery.operationVersion = 'unsupported';
		const unsupportedQueryRef = await publish(queryStore, unsupportedQuery);
		const unsupportedQueryInput: CodingAgentCliOperationInput = {
			...queryInput,
			queryRef: unsupportedQueryRef
		};
		const unsupportedQueryResult = await runComposedFixture(
			'query',
			unsupportedQueryInput,
			queryStore,
			mockDependencies(),
			{ subjectInput: exactTarget }
		);
		expect(unsupportedQueryResult.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});

		const impactStore = new InMemoryCodingAgentCliArtifactStore();
		const impactSnapshotRef = await publishMockSnapshot(impactStore);
		const impactRequestRef = await publish(impactStore, staticImpactRequestArtifact());
		const impactInput: CodingAgentCliOperationInput = {
			...inputBase('impact'),
			changeSetRef: impactRequestRef,
			kind: 'IMPACT',
			snapshotRef: impactSnapshotRef
		};
		const scopedTarget = {
			kind: 'SCOPED_TARGET' as const,
			scopeRef: 'scope:fixture',
			targetPopulationRefs: [impactSnapshotRef]
		};
		const scopedResult = await runComposedFixture(
			'impact',
			impactInput,
			impactStore,
			mockDependencies(),
			{ subjectInput: scopedTarget }
		);
		expect(scopedResult.terminal).toMatchObject({ outcome: 'partial' });

		const scopedMismatch = await runComposedFixture(
			'impact',
			impactInput,
			impactStore,
			mockDependencies(),
			{
				subjectInput: {
					...scopedTarget,
					targetPopulationRefs: [wrongRef]
				}
			}
		);
		expect(scopedMismatch.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});
	});

	it('rejects malformed stored snapshot-result envelopes before query dispatch', async () => {
		const runCandidate = async (
			change: (candidate: Record<string, unknown>) => void,
			dependencies: CodingAgentCliCompositionDependencies = mockDependencies()
		) => {
			const store = new InMemoryCodingAgentCliArtifactStore();
			const captureRequestRef = await publish(store, snapshotRequestArtifact());
			const artifact: Record<string, unknown> = {
				buildOutcome: 'complete',
				captureRequestRef,
				diagnostics: [],
				schemaVersion: CODING_AGENT_CLI_SNAPSHOT_RESULT_VERSION,
				snapshot: structuredClone(mockSnapshot())
			};
			change(artifact);
			const snapshotRef = await publish(store, artifact);
			const queryRef = await publish(store, queryRequestArtifact());
			const input: CodingAgentCliOperationInput = {
				...inputBase('query'),
				kind: 'QUERY',
				queryRef,
				snapshotRef
			};
			return {
				dependencies,
				result: await runComposedFixture('query', input, store, dependencies)
			};
		};
		const malformed: readonly ((candidate: Record<string, unknown>) => void)[] = [
			(candidate) => void (candidate.schemaVersion = 'unsupported'),
			(candidate) => void (candidate.buildOutcome = 'invalid'),
			(candidate) => void (candidate.captureRequestRef = 'not-an-artifact-reference'),
			(candidate) =>
				void ((candidate.snapshot as Record<string, unknown>).schemaVersion = 'unsupported'),
			(candidate) => void (candidate.diagnostics = {})
		];
		for (const change of malformed) {
			const candidate = await runCandidate(change);
			expect(candidate.result.terminal).toMatchObject({
				exitCategory: 'INVALID_REQUEST',
				outcome: 'error'
			});
			expect(candidate.dependencies.query).not.toHaveBeenCalled();
		}

		const invalidSnapshot = await runCandidate(() => void 0, {
			...mockDependencies(),
			validateSnapshot: vi.fn(
				() =>
					({
						issues: [
							{
								code: 'FIXTURE_INVALID',
								message: 'The snapshot fixture is invalid.',
								path: '$snapshot'
							}
						],
						state: 'INVALID'
					}) as never
			)
		});
		expect(invalidSnapshot.result.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});
		expect(invalidSnapshot.dependencies.query).not.toHaveBeenCalled();
	});

	it('rejects malformed explanation selectors and exact findings-snapshot drift', async () => {
		const fixture = await runHybridFindingsFixture();
		const baseProfile = {
			evaluationId: 'hybrid-findings-v2-native-not-run:JAN-CSAA-HARMONIZATION-001',
			findingFingerprint: null,
			findingId: 1,
			kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
			schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
		};
		const runExplanation = async (
			profile: unknown,
			resultRef: string = fixture.findingsResultRef
		) => {
			const explanationProfileRef = await publish(fixture.store, profile);
			const input: CodingAgentCliOperationInput = {
				...inputBase('explain'),
				explanationProfileRef,
				kind: 'EXPLAIN',
				resultRef
			};
			return await runComposedFixture(
				'explain',
				input,
				fixture.store,
				fixture.dependencies,
				{
					subjectInput: {
						kind: 'RESOLVED_SUBJECT',
						subjectId: fixture.subject.descriptor.subjectId
					}
				},
				fixture.repositoryRoot
			);
		};
		const malformedProfiles: readonly unknown[] = [
			{ ...baseProfile, kind: 'OTHER' },
			{ ...baseProfile, findingFingerprint: 7 },
			{ ...baseProfile, findingFingerprint: 'A'.repeat(64) },
			{ ...baseProfile, findingId: 0 },
			{ ...baseProfile, evaluationId: '' }
		];
		for (const profile of malformedProfiles) {
			const result = await runExplanation(profile);
			expect(result.terminal).toMatchObject({
				exitCategory: 'INVALID_REQUEST',
				outcome: 'error'
			});
		}

		const missingProjection = await runExplanation({
			...baseProfile,
			findingId: 9_999
		});
		expect(missingProjection.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});

		const wrongEvaluation = await runExplanation({
			...baseProfile,
			evaluationId: 'evaluation:wrong'
		});
		expect(wrongEvaluation.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});

		const inconsistentFindings = structuredClone(fixture.findingsResult) as unknown as Record<
			string,
			unknown
		>;
		inconsistentFindings.snapshotId = 'SemanticSnapshot:wrong';
		const inconsistentFindingsRef = await publish(fixture.store, inconsistentFindings);
		const inconsistentBinding = await runExplanation(baseProfile, inconsistentFindingsRef);
		expect(inconsistentBinding.terminal).toMatchObject({
			exitCategory: 'INVALID_REQUEST',
			outcome: 'error'
		});
	});

	it('fails closed when a composed public handler receives a mismatched command', async () => {
		const store = new InMemoryCodingAgentCliArtifactStore();
		const handlers = composeCodingAgentCliHandlers({
			artifactStore: store,
			dependencies: mockDependencies(),
			repositoryRoot: process.cwd()
		});
		const fixtures: readonly {
			readonly handler: AgentOperation;
			readonly input: CodingAgentCliOperationInput;
		}[] = [
			{
				handler: 'explain',
				input: {
					...inputBase('explain'),
					explanationProfileRef: `artifact:sha256:${'a'.repeat(64)}`,
					kind: 'EXPLAIN',
					resultRef: `artifact:sha256:${'b'.repeat(64)}`
				}
			},
			{
				handler: 'query',
				input: {
					...inputBase('query'),
					kind: 'QUERY',
					queryRef: `artifact:sha256:${'a'.repeat(64)}`,
					snapshotRef: `artifact:sha256:${'b'.repeat(64)}`
				}
			},
			{
				handler: 'impact',
				input: {
					...inputBase('impact'),
					changeSetRef: `artifact:sha256:${'a'.repeat(64)}`,
					kind: 'IMPACT',
					snapshotRef: `artifact:sha256:${'b'.repeat(64)}`
				}
			},
			{
				handler: 'findings',
				input: {
					...inputBase('findings'),
					kind: 'FINDINGS',
					ruleProfileRef: `artifact:sha256:${'a'.repeat(64)}`,
					snapshotRef: `artifact:sha256:${'b'.repeat(64)}`
				}
			},
			{
				handler: 'inventory',
				input: {
					...inputBase('inventory'),
					kind: 'INVENTORY',
					subjectInputRef: `artifact:sha256:${'a'.repeat(64)}`
				}
			},
			{
				handler: 'snapshot',
				input: {
					...inputBase('snapshot'),
					kind: 'SNAPSHOT',
					subjectInputRef: `artifact:sha256:${'a'.repeat(64)}`
				}
			},
			{
				handler: 'verify',
				input: {
					...inputBase('verify'),
					expectationRef: `artifact:sha256:${'a'.repeat(64)}`,
					kind: 'VERIFY',
					subjectInputRef: `artifact:sha256:${'b'.repeat(64)}`
				}
			}
		];
		for (const fixture of fixtures) {
			const request = requestFor(fixture.handler, fixture.input);
			const mismatchedCommand = fixture.handler === 'inventory' ? 'query' : 'inventory';
			const response = await handlers[fixture.handler]!({
				implementationState: 'IMPLEMENTED',
				invocation: { command: mismatchedCommand, input: fixture.input, request },
				signal: new AbortController().signal
			} as never);
			expect((response as readonly Record<string, unknown>[])[0]).toMatchObject({
				exitCategory: 'INTERNAL_FAILURE',
				outcome: 'error'
			});
		}
	});

	it('rejects invalid composition roots, options, and artifact stores', () => {
		expect(() => composeCodingAgentCliHandlers(null as never)).toThrow(/options are invalid/u);
		expect(() =>
			composeCodingAgentCliHandlers({
				artifactStore: null as never,
				repositoryRoot: process.cwd()
			})
		).toThrow(/artifact store is invalid/u);
		expect(() =>
			composeCodingAgentCliHandlers({
				artifactStore: { read: () => null } as never,
				repositoryRoot: process.cwd()
			})
		).toThrow(/artifact store is invalid/u);
		expect(() =>
			composeCodingAgentCliHandlers({
				artifactStore: new InMemoryCodingAgentCliArtifactStore(),
				repositoryRoot: 'relative/root'
			})
		).toThrow(/repository root must be absolute/u);
	});
});
