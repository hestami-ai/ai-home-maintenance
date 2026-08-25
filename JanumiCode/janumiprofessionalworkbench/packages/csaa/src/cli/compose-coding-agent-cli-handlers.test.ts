import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

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
import type { FrozenSubject, SubjectResolutionOutcome } from '../contracts/subject.js';
import {
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	type WorkingSourceEditImpactCandidateReportOutcome
} from '../contracts/working-source-edit-impact-candidate-report.js';
import {
	createHarmonizationFirstIncrementFixtureRequest,
	evaluateHarmonizationFirstIncrementRule
} from '../rules/harmonization-first-increment-rules.js';
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
	CODING_AGENT_CLI_COMPOSITION_STATE,
	CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION,
	CODING_AGENT_CLI_FINDINGS_REQUEST_VERSION,
	CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION,
	CODING_AGENT_CLI_LOCAL_CAPABILITIES,
	CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS,
	CODING_AGENT_CLI_SNAPSHOT_REQUEST_VERSION,
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

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
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

function admittedResultReference(terminal: Record<string, unknown>): string {
	const partial = terminal.partial as { admittedResultRefs: string[] };
	return partial.admittedResultRefs[0]!;
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
		evaluateFinding: evaluateHarmonizationFirstIncrementRule,
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
		query: vi.fn(async () => queryOutcome),
		resolveSubject: vi.fn((): SubjectResolutionOutcome => {
			resolutionCalls += 1;
			const subjectId = workflowSequence && resolutionCalls > 1 ? POST_SUBJECT_ID : SUBJECT_ID;
			return {
				completeness: 'COMPLETE',
				diagnostics: [],
				outcome: 'resolved',
				subject: { descriptor: { subjectId } } as unknown as FrozenSubject
			};
		}),
		staticImpact: vi.fn(() => impactOutcome),
		validateSnapshot: vi.fn(() => ({ issues: [] as const, state: 'VALID' as const })),
		workingImpact: vi.fn(() => {
			throw new Error('The golden workflow selects the static impact request.');
		})
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

describe('coding-agent CLI concrete composition', () => {
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
				budgets: {
					maxAstDepth: 16,
					maxAstNodes: 1_000,
					maxCompilerFacts: 2_000,
					maxCompilerQueries: 2_000,
					maxCompilerQueryInvocations: 2_000,
					maxDurationMs: 10_000,
					maxProjects: 10,
					maxSnapshotBytes: 500_000,
					maxSources: 1_000
				},
				capabilities: ['TS_PROJECT', 'TS_SYNTAX'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: '<resolved-subject>'
			},
			subjectRequest: {
				budgets: {
					maxConfigDepth: 8,
					maxDurationMs: 10_000,
					maxFiles: 1_000,
					maxProjects: 10
				},
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
			budgets: { maxResultBytes: 500_000, maxResultRecords: 1_000 },
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
			budgets: { maxCandidateWitnessHops: 1_000, maxResultBytes: 500_000 },
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
				budgets: {
					maxAstDepth: 16,
					maxAstNodes: 1_000,
					maxCompilerFacts: 2_000,
					maxCompilerQueries: 2_000,
					maxCompilerQueryInvocations: 2_000,
					maxDurationMs: 10_000,
					maxProjects: 10,
					maxSnapshotBytes: 500_000,
					maxSources: 1_000
				},
				capabilities: ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL'],
				expectEmpty: false,
				operationVersion: SEMANTIC_OPERATION_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
				subjectId: POST_SUBJECT_ID
			},
			subjectRequest: {
				budgets: {
					maxConfigDepth: 8,
					maxDurationMs: 10_000,
					maxFiles: 1_000,
					maxProjects: 10
				},
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

		const disabledObservation = createHarmonizationFirstIncrementFixtureRequest(
			'JAN-CSAA-HARMONIZATION-001',
			'DISABLED'
		);
		const evaluationRequest = {
			...disabledObservation,
			currentness: {
				...disabledObservation.currentness,
				frozenSubjectId: POST_SUBJECT_ID,
				invalidationDependencyIds: [postSnapshotRef]
			},
			evaluationId: 'golden-post-change-native-projection-not-run'
		};
		const findingsRequestRef = await publish(store, {
			evaluationRequest,
			kind: 'HARMONIZATION_FIRST_INCREMENT_FINDINGS_REQUEST',
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
		expect(findingsResult.evaluationOutcome).toMatchObject({
			outcome: 'evaluated',
			result: { evaluatorExecuted: false, finding: null, status: 'NOT_RUN' }
		});

		const explanationProfileRef = await publish(store, {
			evaluationId: evaluationRequest.evaluationId,
			findingFingerprint: null,
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
			evaluation: { finding: null, status: 'NOT_RUN' },
			gateEffect: 'NONE',
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
					path: ['evaluationOutcome', 'result', 'status']
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
			'not package-root registered'
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
		expect(verification).toMatchObject({ assertions: [{ passed: false }], passed: false });
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
			workingImpact: vi.fn(() => workingOutcome)
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
				observation: { maxGitOperationDurationMs: 1_000 },
				staticImpact: { maxCandidateWitnessHops: 1_000, maxResultBytes: 400_000 }
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
});
