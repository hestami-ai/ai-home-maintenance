import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
	AGENT_OPERATION_PROTOCOL_VERSION,
	AGENT_OPERATION_VERSIONS,
	validateAgentOperationExchange,
	type AgentOperation,
	type AgentOperationRequest,
	type AgentOperationResponse
} from '../agent/agent-operation-protocol.js';
import { PROJECT_CONTEXT_REPORT_OPERATION_VERSION } from '../contracts/project-context-report.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION
} from '../contracts/semantic-source-query-report.js';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION
} from '../contracts/semantic.js';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION
} from '../contracts/static-module-impact-candidate-report.js';
import { SUBJECT_POLICY_VERSION, SUBJECT_REQUEST_SCHEMA_VERSION } from '../contracts/subject.js';
import { JPWB_HARMONIZATION_NATIVE_PROJECTION_OPERATION_VERSION } from '../rules/jpwb-harmonization-native-projection.js';
import { codingAgentCliArtifactDigest } from './coding-agent-cli-artifact-store.js';
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
	CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION
} from './compose-coding-agent-cli-handlers.js';
import {
	CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION,
	CODING_AGENT_PROCESS_INVOCATION_VERSION
} from './run-coding-agent-process.js';

const temporaryRoots: string[] = [];
const REQUESTED_AT = '2026-08-25T00:00:00.000Z';
const USER_REQUEST_DIGEST = 'a'.repeat(64);
const LEAF_SOURCE = 'export const leaf = 1;\n';
const POST_CHANGE_LEAF_SOURCE = 'export const leaf = 2;\n';

const SUBJECT_BUDGETS = Object.freeze({
	maxBytes: 2_000_000,
	maxConfigDepth: 16,
	maxDiagnostics: 1_000,
	maxDurationMs: 60_000,
	maxFiles: 1_000,
	maxProjects: 10
});

const SEMANTIC_BUDGETS = Object.freeze({
	maxAstDepth: 128,
	maxAstNodes: 100_000,
	maxCompilerFacts: 100_000,
	maxCompilerInputMetadataBytes: 2_000_000,
	maxCompilerQueries: 100_000,
	maxCompilerQueryInvocations: 500_000,
	maxContextBytes: 2_000_000,
	maxContextFileBytes: 1_000_000,
	maxContextFiles: 1_000,
	maxDiagnosticCharacters: 100_000,
	maxDiagnostics: 1_000,
	maxDirectoryEntries: 10_000,
	maxDurationMs: 60_000,
	maxLiteralCharacters: 10_000,
	maxPathCharacters: 2_000,
	maxProjects: 10,
	maxScopes: 100_000,
	maxSnapshotBytes: 4_000_000,
	maxSources: 1_000
});

const AGENT_BUDGETS = Object.freeze({
	maxDepth: 256,
	maxEdges: 1_000_000,
	maxNodes: 200_000,
	maxOutputBytes: 16_000_000,
	maxResults: 200_000,
	timeoutMs: 120_000
});

interface SpawnedProcessResult {
	readonly exitCode: number;
	readonly pid: number;
	readonly stderr: string;
	readonly stdout: string;
}

interface SpawnHarness {
	readonly processHostPath: string;
	readonly repositoryRoot: string;
	readonly spawnedPids: number[];
	readonly storeRoot: string;
}

interface ProcessHostOverrides {
	readonly repositoryRoot?: string;
	readonly storeRoot?: string;
}

function write(root: string, logicalPath: string, contents: string): void {
	const absolutePath = join(root, ...logicalPath.split('/'));
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, contents, 'utf8');
}

function writeJson(root: string, logicalPath: string, value: unknown): void {
	write(root, logicalPath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function subjectFixture(root: string): void {
	writeJson(root, 'package.json', {
		name: 'csaa-spawned-process-host-golden',
		private: true,
		workspaces: ['packages/*']
	});
	write(root, 'bun.lock', 'fixture lock\n');
	writeJson(root, 'packages/demo/package.json', {
		name: '@fixture/csaa-spawned-process-host-golden',
		private: true,
		version: '0.0.0'
	});
	writeJson(root, 'packages/demo/tsconfig.json', {
		compilerOptions: {
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			noEmit: true,
			noLib: true,
			strict: true,
			target: 'ES2022'
		},
		files: ['src/entry.ts', 'src/leaf.ts', 'src/middle.ts']
	});
	write(root, 'packages/demo/src/leaf.ts', LEAF_SOURCE);
	write(
		root,
		'packages/demo/src/middle.ts',
		"import { leaf } from './leaf.js';\nexport const middle = leaf + 1;\n"
	);
	write(
		root,
		'packages/demo/src/entry.ts',
		"import { middle } from './middle.js';\nexport const entry = middle + 1;\n"
	);
}

function captureFileBytes(root: string): ReadonlyMap<string, Buffer> {
	const captured = new Map<string, Buffer>();
	const visit = (absoluteDirectory: string, relativeDirectory: string): void => {
		for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true }).sort(
			(left, right) => left.name.localeCompare(right.name)
		)) {
			const logicalPath =
				relativeDirectory.length === 0 ? entry.name : `${relativeDirectory}/${entry.name}`;
			const absolutePath = join(absoluteDirectory, entry.name);
			if (entry.isDirectory()) visit(absolutePath, logicalPath);
			else if (entry.isFile()) captured.set(logicalPath, readFileSync(absolutePath));
			else throw new Error(`The fixture contains an unsupported filesystem entry: ${logicalPath}`);
		}
	};
	visit(root, '');
	return captured;
}

function expectExactFileBytes(
	before: ReadonlyMap<string, Buffer>,
	after: ReadonlyMap<string, Buffer>
): void {
	expect([...after.keys()]).toEqual([...before.keys()]);
	for (const [logicalPath, expectedBytes] of before) {
		expect(after.get(logicalPath)?.equals(expectedBytes), logicalPath).toBe(true);
	}
}

function processHostProxy(processHostPath: string): string {
	const productionHostUrl = pathToFileURL(
		join(dirname(fileURLToPath(import.meta.url)), 'run-coding-agent-process-host.ts')
	).href;
	writeFileSync(
		processHostPath,
		`import { runCodingAgentProcessHost } from ${JSON.stringify(productionHostUrl)};\n\n` +
			`process.exitCode = await runCodingAgentProcessHost({\n` +
			`\trepositoryRoot: process.env.CSAA_SPAWN_HOST_REPOSITORY_ROOT ?? '',\n` +
			`\tstoreRoot: process.env.CSAA_SPAWN_HOST_STORE_ROOT ?? ''\n` +
			`});\n`,
		'utf8'
	);
	return processHostPath;
}

async function spawnProcessHost(
	harness: SpawnHarness,
	args: readonly string[],
	stdin?: string,
	overrides: ProcessHostOverrides = {}
): Promise<SpawnedProcessResult> {
	return await new Promise<SpawnedProcessResult>((resolve, reject) => {
		const child = spawn(
			process.platform === 'win32' ? 'bun.exe' : 'bun',
			[harness.processHostPath, ...args],
			{
				cwd: harness.repositoryRoot,
				env: {
					...process.env,
					CSAA_SPAWN_HOST_REPOSITORY_ROOT: overrides.repositoryRoot ?? harness.repositoryRoot,
					CSAA_SPAWN_HOST_STORE_ROOT: overrides.storeRoot ?? harness.storeRoot
				},
				stdio: ['pipe', 'pipe', 'pipe'],
				windowsHide: true
			}
		);
		const pid = child.pid;
		if (pid === undefined) {
			reject(new Error('Bun did not assign a process identifier.'));
			return;
		}
		harness.spawnedPids.push(pid);
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk: string) => {
			stderr += chunk;
		});
		const timeout = setTimeout(() => {
			child.kill();
			reject(new Error(`Spawned production process host timed out: ${args.join(' ')}`));
		}, 120_000);
		child.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once('close', (exitCode) => {
			clearTimeout(timeout);
			if (exitCode === null) {
				reject(
					new Error(`Spawned production process host ended without an exit code: ${args.join(' ')}`)
				);
				return;
			}
			resolve({ exitCode, pid, stderr, stdout });
		});
		child.stdin.end(stdin);
	});
}

function jsonLines(value: string): Record<string, unknown>[] {
	return value
		.trim()
		.split('\n')
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

function singleStdoutJson(result: SpawnedProcessResult): Record<string, unknown> {
	expect(result.stdout.endsWith('\n')).toBe(true);
	const lines = jsonLines(result.stdout);
	expect(lines).toHaveLength(1);
	return lines[0]!;
}

function exactSubjectLocator(reference: string): AgentOperationRequest['subjectInput'] {
	return {
		kind: 'SUBJECT_LOCATOR',
		locatorDigest: codingAgentCliArtifactDigest(reference),
		locatorRef: reference,
		resolutionPolicyRef: 'policy:exact-content-addressed-input'
	};
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
	throw new Error('The spawned process-host capability fixture is exhaustive.');
}

function inputBase(operation: AgentOperation, identity: string) {
	return {
		bindingRef: `binding:spawned-process-host:${operation}:${identity}`,
		output: 'STDOUT_JSON' as const,
		schemaVersion: CODING_AGENT_CLI_INPUT_VERSION
	};
}

function requestFor(
	operation: AgentOperation,
	identity: string,
	input: CodingAgentCliOperationInput,
	subjectInput: AgentOperationRequest['subjectInput'],
	overrides: Partial<AgentOperationRequest> = {}
): AgentOperationRequest {
	const digest = codingAgentCliInputDigest(input);
	if (digest.state !== 'VALID') throw new Error(JSON.stringify(digest));
	return {
		budgets: AGENT_BUDGETS,
		capabilityRequirement: {
			affectedQuestionRefs: [`question:spawned-process-host:${operation}:${identity}`],
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
		requestId: `request:spawned-process-host:${operation}:${identity}`,
		requestedAt: REQUESTED_AT,
		subjectInput,
		work: {
			agentId: 'agent:spawned-process-host-golden',
			authorityEnvelopeRef: 'authority:local-readonly',
			changeContract: { changeContractRef: 'change:csaa-g6', kind: 'REFERENCE' },
			employmentPoint: 'DURING_IMPLEMENTATION',
			userRequestDigest: USER_REQUEST_DIGEST,
			workPackageRef: 'work-package:DWP-006'
		},
		...overrides
	};
}

async function putArtifact(harness: SpawnHarness, value: unknown): Promise<string> {
	const result = await spawnProcessHost(
		harness,
		['artifact', 'put', '--stdin'],
		JSON.stringify(value)
	);
	expect(result.exitCode).toBe(0);
	expect(result.stderr).toBe('');
	const output = singleStdoutJson(result);
	expect(output).toMatchObject({ messageKind: 'artifact-published' });
	return (output.artifact as { reference: string }).reference;
}

async function getArtifact(harness: SpawnHarness, reference: string): Promise<unknown> {
	const result = await spawnProcessHost(harness, ['artifact', 'get', '--reference', reference]);
	expect(result.exitCode).toBe(0);
	expect(result.stderr).toBe('');
	return singleStdoutJson(result);
}

async function invoke(
	harness: SpawnHarness,
	operation: AgentOperation,
	request: AgentOperationRequest,
	input: CodingAgentCliOperationInput,
	expectedExitCode: 2 | 3 | 4
): Promise<{ readonly result: SpawnedProcessResult; readonly terminal: Record<string, unknown> }> {
	const result = await spawnProcessHost(
		harness,
		['invoke', '--stdin'],
		JSON.stringify({
			command: operation,
			input,
			output: 'json',
			request,
			schemaVersion: CODING_AGENT_PROCESS_INVOCATION_VERSION
		})
	);
	expect(result.exitCode, JSON.stringify({ stderr: result.stderr, stdout: result.stdout })).toBe(
		expectedExitCode
	);
	const terminal = singleStdoutJson(result);
	expect(
		validateAgentOperationExchange(request, terminal as unknown as AgentOperationResponse).state
	).toBe('VALID');
	for (const progress of jsonLines(result.stderr)) {
		expect(progress.messageKind).toBe('response');
		expect(
			validateAgentOperationExchange(request, progress as unknown as AgentOperationResponse).state
		).toBe('VALID');
	}
	expect(result.stdout).not.toContain(harness.repositoryRoot);
	expect(result.stderr).not.toContain(harness.repositoryRoot);
	return { result, terminal };
}

function admittedResultReference(terminal: Record<string, unknown>): string {
	return (terminal.partial as { admittedResultRefs: string[] }).admittedResultRefs[0]!;
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('spawned production coding-agent process-host golden (not the fixed-root launcher)', () => {
	it('completes a pre-change, planned-impact, post-change, finding-review, and verification workflow across independent Bun processes', async () => {
		const temporaryRoot = mkdtempSync(join(tmpdir(), 'csaa-spawned-process-host-golden-'));
		temporaryRoots.push(temporaryRoot);
		const repositoryRoot = join(temporaryRoot, 'subject');
		const storeRoot = join(temporaryRoot, '.csaa', 'coding-agent-artifacts');
		mkdirSync(repositoryRoot, { recursive: true });
		subjectFixture(repositoryRoot);
		const before = captureFileBytes(repositoryRoot);
		const harness: SpawnHarness = {
			processHostPath: processHostProxy(join(temporaryRoot, 'production-process-host-proxy.ts')),
			repositoryRoot,
			spawnedPids: [],
			storeRoot
		};

		const transported = {
			contract: 'spawned-production-process-host-transport',
			sequence: [1, true, null, 'persistent']
		};
		const transportedRef = await putArtifact(harness, transported);
		expect(await getArtifact(harness, transportedRef)).toEqual(transported);

		const inventoryRequestRef = await putArtifact(harness, {
			kind: 'REPOSITORY_INVENTORY_REQUEST',
			requireJpwbPopulations: false,
			rootLocator: '<repository-root>',
			schemaVersion: CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION
		});
		const inventoryInput: CodingAgentCliOperationInput = {
			...inputBase('inventory', 'golden'),
			kind: 'INVENTORY',
			subjectInputRef: inventoryRequestRef
		};
		const inventoryRequest = requestFor(
			'inventory',
			'golden',
			inventoryInput,
			exactSubjectLocator(inventoryRequestRef)
		);
		const inventoryRun = await invoke(harness, 'inventory', inventoryRequest, inventoryInput, 3);
		expect(inventoryRun.terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		expect(jsonLines(inventoryRun.result.stderr).length).toBeGreaterThan(0);
		const inventoryResultRef = admittedResultReference(inventoryRun.terminal);
		const inventoryResult = (await getArtifact(harness, inventoryResultRef)) as {
			capture: { subjectId: string };
		};
		expect(inventoryResult.capture.subjectId).toMatch(/^[0-9a-f]{64}$/u);

		const snapshotRequestRef = await putArtifact(harness, {
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
			subjectRequest: {
				budgets: SUBJECT_BUDGETS,
				expectEmpty: false,
				filters: { exclude: [], include: [] },
				operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
				outputs: [],
				policyVersion: SUBJECT_POLICY_VERSION,
				rootLocator: '<repository-root>',
				schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
				scope: { kind: 'EXPLICIT_PROJECTS', projects: ['packages/demo/tsconfig.json'] },
				subjectKind: 'WORKTREE'
			}
		});
		const snapshotInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot', 'golden'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const snapshotRequest = requestFor(
			'snapshot',
			'golden',
			snapshotInput,
			exactSubjectLocator(snapshotRequestRef)
		);
		const snapshotRun = await invoke(harness, 'snapshot', snapshotRequest, snapshotInput, 3);
		expect(snapshotRun.terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		const snapshotRef = admittedResultReference(snapshotRun.terminal);
		const snapshotResult = (await getArtifact(harness, snapshotRef)) as {
			snapshot: { id: string; subjectId: string };
		};
		const { id: snapshotId, subjectId } = snapshotResult.snapshot;
		expect(snapshotId).toMatch(/^static:ts-snapshot-[0-9a-f]{64}$/u);
		expect(subjectId).toMatch(/^[0-9a-f]{64}$/u);
		const resolvedSubjectInput = { kind: 'RESOLVED_SUBJECT' as const, subjectId };

		const queryRequestRef = await putArtifact(harness, {
			budgets: {
				maxDiagnostics: 1_000,
				maxResultBytes: 4_000_000,
				maxResultRecords: 5_000,
				query: {
					maxDepth: 8,
					maxEvaluations: 10_000,
					maxFanout: 16,
					maxNodes: 64,
					maxPopulation: 1_000,
					maxTraceNodes: 10_000
				},
				semantic: SEMANTIC_BUDGETS,
				subject: SUBJECT_BUDGETS
			},
			executionId: 'spawned-process-host-query-001',
			expression: {
				field: 'logicalPath',
				kind: 'EQUALS',
				nodeId: 'root',
				value: 'packages/demo/src/leaf.ts'
			},
			operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
			schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
			subjectProjectConfigPaths: ['packages/demo/tsconfig.json']
		});
		const queryInput: CodingAgentCliOperationInput = {
			...inputBase('query', 'golden'),
			kind: 'QUERY',
			queryRef: queryRequestRef,
			snapshotRef
		};
		const queryRequest = requestFor('query', 'golden', queryInput, resolvedSubjectInput);
		const queryRun = await invoke(harness, 'query', queryRequest, queryInput, 3);
		expect(queryRun.terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		const queryResultRef = admittedResultReference(queryRun.terminal);
		const queryResult = (await getArtifact(harness, queryResultRef)) as {
			result: { population: { semanticSnapshotId: string } };
		};
		expect(queryResult.result.population.semanticSnapshotId).toBe(snapshotId);

		const impactRequestRef = await putArtifact(harness, {
			budgets: {
				maxCandidateWitnessHops: 10_000,
				maxResultBytes: 4_000_000,
				reachability: {
					maxDiagnostics: 1_000,
					maxEdges: 10_000,
					maxFrontierRecords: 10_000,
					maxInputRecords: 10_000,
					maxInputStringCharacters: 1_000_000,
					maxNodes: 10_000,
					maxReachableNodes: 10_000,
					maxTraversalSteps: 20_000,
					maxWitnessEdges: 10_000
				},
				semantic: SEMANTIC_BUDGETS,
				subject: SUBJECT_BUDGETS
			},
			operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
			seed: {
				basis: 'CALLER_DECLARED_WORKING_CHANGE_SET',
				expectedArtifactSha256: sha256(LEAF_SOURCE),
				id: 'seed:spawned-process-host-leaf-edit',
				logicalPath: 'packages/demo/src/leaf.ts',
				operation: 'EDIT',
				projectConfigPath: 'packages/demo/tsconfig.json',
				schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
				scope: 'WHOLE_SOURCE',
				workingChangeSetId: 'working-change:spawned-process-host-fixture'
			},
			subjectProjectConfigPaths: ['packages/demo/tsconfig.json']
		});
		const impactInput: CodingAgentCliOperationInput = {
			...inputBase('impact', 'golden'),
			changeSetRef: impactRequestRef,
			kind: 'IMPACT',
			snapshotRef
		};
		const impactRequest = requestFor('impact', 'golden', impactInput, resolvedSubjectInput);
		const impactRun = await invoke(harness, 'impact', impactRequest, impactInput, 3);
		expect(impactRun.terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		const impactResultRef = admittedResultReference(impactRun.terminal);
		const impactResult = (await getArtifact(harness, impactResultRef)) as {
			result: { invalidationDependencies: { semanticSnapshotId: string } };
		};
		expect(impactResult.result.invalidationDependencies.semanticSnapshotId).toBe(snapshotId);

		write(repositoryRoot, 'packages/demo/src/leaf.ts', POST_CHANGE_LEAF_SOURCE);
		const afterPlannedChange = captureFileBytes(repositoryRoot);
		expect([...afterPlannedChange.keys()]).toEqual([...before.keys()]);
		for (const [logicalPath, initialBytes] of before)
			if (logicalPath === 'packages/demo/src/leaf.ts')
				expect(afterPlannedChange.get(logicalPath)?.equals(initialBytes)).toBe(false);
			else
				expect(afterPlannedChange.get(logicalPath)?.equals(initialBytes), logicalPath).toBe(true);

		const actuallyStaleInput: CodingAgentCliOperationInput = {
			...inputBase('query', 'pre-change-snapshot-after-edit'),
			kind: 'QUERY',
			queryRef: queryRequestRef,
			snapshotRef
		};
		const actuallyStaleRun = await invoke(
			harness,
			'query',
			requestFor(
				'query',
				'pre-change-snapshot-after-edit',
				actuallyStaleInput,
				resolvedSubjectInput
			),
			actuallyStaleInput,
			3
		);
		expect(actuallyStaleRun.terminal).toMatchObject({
			currentness: { status: 'stale' },
			refusal: { code: 'CSAA-E-SUBJECT-STALE' }
		});

		const postSnapshotInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot', 'post-change'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const postSnapshotRun = await invoke(
			harness,
			'snapshot',
			requestFor(
				'snapshot',
				'post-change',
				postSnapshotInput,
				exactSubjectLocator(snapshotRequestRef)
			),
			postSnapshotInput,
			3
		);
		const postSnapshotRef = admittedResultReference(postSnapshotRun.terminal);
		const postSnapshotResult = (await getArtifact(harness, postSnapshotRef)) as {
			snapshot: { id: string; subjectId: string };
		};
		const { id: postSnapshotId, subjectId: postSubjectId } = postSnapshotResult.snapshot;
		expect(postSnapshotId).not.toBe(snapshotId);
		expect(postSubjectId).not.toBe(subjectId);
		const postResolvedSubjectInput = {
			kind: 'RESOLVED_SUBJECT' as const,
			subjectId: postSubjectId
		};

		const nativeExecutionId = 'spawned-process-host-native-projection-not-run';
		const findingsRequestRef = await putArtifact(harness, {
			budgets: {
				maxArtifacts: 1_000,
				maxAstNodes: 100_000,
				maxDurationMs: 60_000,
				maxResultBytes: 8_000_000,
				maxSourceBytes: 2_000_000
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
			...inputBase('findings', 'golden'),
			kind: 'FINDINGS',
			ruleProfileRef: findingsRequestRef,
			snapshotRef: postSnapshotRef
		};
		const findingsRequest = requestFor(
			'findings',
			'golden',
			findingsInput,
			postResolvedSubjectInput
		);
		const findingsRun = await invoke(harness, 'findings', findingsRequest, findingsInput, 3);
		expect(findingsRun.terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		const findingsResultRef = admittedResultReference(findingsRun.terminal);
		const findingsResult = (await getArtifact(harness, findingsResultRef)) as {
			nativeProjectionOutcome: {
				outcome: string;
				result: {
					currentRepositoryStatusTotals: { NOT_RUN: number };
					projections: Array<{
						evaluation: {
							result: {
								evaluationId: string;
								finding: null | { findingFingerprint: string };
								status: string;
							};
						};
						findingId: number;
					}>;
				};
			};
		};
		expect(findingsResult.nativeProjectionOutcome.outcome).toBe('projected');
		expect(
			findingsResult.nativeProjectionOutcome.result.currentRepositoryStatusTotals.NOT_RUN
		).toBe(23);
		expect(findingsResult.nativeProjectionOutcome.result.projections).toHaveLength(23);
		const selectedProjection = findingsResult.nativeProjectionOutcome.result.projections[0]!;

		const explanationProfileRef = await putArtifact(harness, {
			evaluationId: selectedProjection.evaluation.result.evaluationId,
			findingFingerprint: selectedProjection.evaluation.result.finding?.findingFingerprint ?? null,
			findingId: selectedProjection.findingId,
			kind: 'EXACT_FINDING_EXPLANATION_PROFILE',
			schemaVersion: CODING_AGENT_CLI_EXPLANATION_PROFILE_VERSION
		});
		const explainInput: CodingAgentCliOperationInput = {
			...inputBase('explain', 'golden'),
			explanationProfileRef,
			kind: 'EXPLAIN',
			resultRef: findingsResultRef
		};
		const explainRequest = requestFor('explain', 'golden', explainInput, postResolvedSubjectInput);
		const explainRun = await invoke(harness, 'explain', explainRequest, explainInput, 3);
		expect(explainRun.terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		const explanationResultRef = admittedResultReference(explainRun.terminal);
		const explanationResult = (await getArtifact(harness, explanationResultRef)) as {
			source: { findingsResultRef: string };
		};
		expect(explanationResult.source.findingsResultRef).toBe(findingsResultRef);

		const expectationRef = await putArtifact(harness, {
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
			snapshotId: postSnapshotId,
			subjectId: postSubjectId
		});
		const verifyInput: CodingAgentCliOperationInput = {
			...inputBase('verify', 'passing'),
			expectationRef,
			kind: 'VERIFY',
			subjectInputRef: postSnapshotRef
		};
		const verifyRequest = requestFor('verify', 'passing', verifyInput, postResolvedSubjectInput);
		const verifyRun = await invoke(harness, 'verify', verifyRequest, verifyInput, 3);
		expect(verifyRun.terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
		const verificationResult = (await getArtifact(
			harness,
			admittedResultReference(verifyRun.terminal)
		)) as { passed: boolean };
		expect(verificationResult.passed).toBe(true);

		const failingExpectationRef = await putArtifact(harness, {
			assertions: [
				{
					artifactRef: postSnapshotRef,
					expected: 'semantic-snapshot:deliberately-wrong',
					kind: 'JSON_VALUE_EQUALS',
					path: ['snapshot', 'id']
				}
			],
			kind: 'ARTIFACT_WORKFLOW_EXPECTATION',
			schemaVersion: CODING_AGENT_CLI_VERIFICATION_EXPECTATION_VERSION,
			snapshotId: postSnapshotId,
			subjectId: postSubjectId
		});
		const failingVerifyInput: CodingAgentCliOperationInput = {
			...inputBase('verify', 'failing'),
			expectationRef: failingExpectationRef,
			kind: 'VERIFY',
			subjectInputRef: postSnapshotRef
		};
		const failingVerifyRequest = requestFor(
			'verify',
			'failing',
			failingVerifyInput,
			postResolvedSubjectInput
		);
		const failingVerifyRun = await invoke(
			harness,
			'verify',
			failingVerifyRequest,
			failingVerifyInput,
			4
		);
		expect(failingVerifyRun.terminal).toMatchObject({
			exitCategory: 'FAILED_EXPECTATION',
			outcome: 'error',
			refusal: { code: 'CSAA-E-PROVIDER-DISAGREEMENT' }
		});
		const attemptedEvidenceRef = (
			failingVerifyRun.terminal.refusal as { attemptedEvidenceRefs: string[] }
		).attemptedEvidenceRefs[0]!;
		expect(await getArtifact(harness, attemptedEvidenceRef)).toMatchObject({ passed: false });

		const staleInput: CodingAgentCliOperationInput = {
			...inputBase('query', 'stale-refusal'),
			kind: 'QUERY',
			queryRef: queryRequestRef,
			snapshotRef
		};
		const staleRequest = requestFor('query', 'stale-refusal', staleInput, {
			kind: 'RESOLVED_SUBJECT',
			subjectId: 'subject:caller-declared-stale-binding'
		});
		const staleRun = await invoke(harness, 'query', staleRequest, staleInput, 3);
		expect(staleRun.terminal).toMatchObject({
			currentness: { status: 'stale' },
			refusal: { code: 'CSAA-E-SUBJECT-STALE' }
		});

		const budgetInput: CodingAgentCliOperationInput = {
			...inputBase('query', 'budget-refusal'),
			kind: 'QUERY',
			queryRef: queryRequestRef,
			snapshotRef
		};
		const budgetRequest = requestFor('query', 'budget-refusal', budgetInput, resolvedSubjectInput, {
			budgets: { ...AGENT_BUDGETS, maxResults: 1 }
		});
		const budgetRun = await invoke(harness, 'query', budgetRequest, budgetInput, 3);
		expect(budgetRun.terminal).toMatchObject({
			refusal: {
				code: 'CSAA-E-EXECUTION-BUDGET-REFUSED',
				reasonCode: 'BUDGET_REFUSED'
			},
			state: 'resource-refused'
		});

		const unsupportedInput: CodingAgentCliOperationInput = {
			...inputBase('snapshot', 'unsupported-refusal'),
			kind: 'SNAPSHOT',
			subjectInputRef: snapshotRequestRef
		};
		const unsupportedRequest = requestFor(
			'snapshot',
			'unsupported-refusal',
			unsupportedInput,
			resolvedSubjectInput,
			{
				capabilityRequirement: {
					affectedQuestionRefs: ['question:spawned-process-host:unsupported'],
					capabilityId: 'JAN-CSAA-CAP-004',
					capabilityVersion: 'JAN-CSAA-CAP-004@0.1.0',
					necessity: 'MANDATORY'
				}
			}
		);
		const unsupportedRun = await invoke(
			harness,
			'snapshot',
			unsupportedRequest,
			unsupportedInput,
			3
		);
		expect(unsupportedRun.terminal).toMatchObject({
			refusal: {
				code: 'CSAA-E-CAPABILITY-UNSUPPORTED',
				reasonCode: 'UNIMPLEMENTED_CAPABILITY'
			}
		});

		const invalidInvocation = await spawnProcessHost(harness, ['invoke', '--stdin'], '{}');
		expect(invalidInvocation.exitCode).toBe(2);
		expect(invalidInvocation.stdout).toBe('');
		expect(jsonLines(invalidInvocation.stderr)).toEqual([
			expect.objectContaining({
				code: 'INVOCATION_ENVELOPE_INVALID',
				messageKind: 'coding-agent-process-diagnostic',
				schemaVersion: CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION
			})
		]);

		const internalFailure = await spawnProcessHost(
			harness,
			['artifact', 'get', '--reference', transportedRef],
			undefined,
			{ storeRoot: 'relative-host-misconfiguration' }
		);
		expect(internalFailure.exitCode).toBe(5);
		expect(internalFailure.stdout).toBe('');
		expect(jsonLines(internalFailure.stderr)).toEqual([
			expect.objectContaining({
				code: 'INTERNAL_FAILURE',
				messageKind: 'coding-agent-process-diagnostic',
				schemaVersion: CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION
			})
		]);

		expect(await getArtifact(harness, transportedRef)).toEqual(transported);
		expect(
			harness.spawnedPids.every(
				(pid) => Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid
			)
		).toBe(true);
		expect(harness.spawnedPids.length).toBeGreaterThan(20);
		expectExactFileBytes(afterPlannedChange, captureFileBytes(repositoryRoot));
	}, 240_000);
});
