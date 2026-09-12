import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	AGENT_OPERATION_PROTOCOL_VERSION,
	AGENT_OPERATION_VERSIONS,
	CODING_AGENT_CLI_INPUT_CONTRACT_ID,
	CODING_AGENT_CLI_INPUT_VERSION,
	CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION,
	CODING_AGENT_CLI_LOCAL_CAPABILITIES,
	CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS,
	CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION,
	CODING_AGENT_PROCESS_INVOCATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	buildArrowCommandCensusArtifactSet,
	buildGuardEnforcementLedgerArtifactSet,
	codingAgentCliArtifactDigest,
	codingAgentCliInputDigest,
	observeArrowCommandCensus,
	observeGuardEnforcementLedger,
	resolveSubject,
	validateAgentOperationExchange,
	validateArrowCommandCensusObservation,
	validateGuardEnforcementLedgerObservation,
	type AgentOperationRequest,
	type AgentOperationResponse,
	type ArrowCommandCensusBudgets,
	type CodingAgentCliOperationInput,
	type GuardEnforcementLedgerBudgets
} from '@janumipwb/csaa';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const RUNS_EMITTED_PACKAGE = process.env.RPH_TEST_RESOLVE === 'dist';
const EMITTED_CODING_AGENT_BINARY = join(
	REPOSITORY_ROOT,
	'packages',
	'csaa',
	'dist',
	'cli',
	'csaa-coding-agent-bin.js'
);
const EMITTED_REQUESTED_AT = '2026-08-25T00:00:00.000Z';

function singleJsonLine(value: string): Record<string, unknown> {
	const lines = value
		.trim()
		.split('\n')
		.filter((line) => line.length > 0);
	expect(lines).toHaveLength(1);
	return JSON.parse(lines[0]!) as Record<string, unknown>;
}

interface EmittedBinaryFixture {
	readonly binaryPath: string;
	readonly repositoryRoot: string;
}

async function createEmittedBinaryFixture(): Promise<EmittedBinaryFixture> {
	const repositoryRoot = await mkdtemp(join(REPOSITORY_ROOT, '.csaa-emitted-binary-fixture-'));
	await cp(
		join(REPOSITORY_ROOT, 'packages', 'csaa', 'dist'),
		join(repositoryRoot, 'packages', 'csaa', 'dist'),
		{ recursive: true }
	);
	await mkdir(join(repositoryRoot, 'packages', 'demo', 'src'), { recursive: true });
	await writeFile(
		join(repositoryRoot, 'package.json'),
		`${JSON.stringify(
			{
				name: 'csaa-emitted-binary-fixture',
				private: true,
				type: 'module',
				workspaces: ['packages/*']
			},
			null,
			2
		)}\n`,
		'utf8'
	);
	await writeFile(join(repositoryRoot, 'bun.lock'), 'emitted binary fixture lock\n', 'utf8');
	await writeFile(
		join(repositoryRoot, 'packages', 'csaa', 'package.json'),
		`${JSON.stringify(
			{ name: '@janumipwb/csaa', private: true, type: 'module', version: '0.0.0' },
			null,
			2
		)}\n`,
		'utf8'
	);
	await writeFile(
		join(repositoryRoot, 'packages', 'demo', 'package.json'),
		`${JSON.stringify(
			{ name: '@fixture/emitted-binary-demo', private: true, version: '0.0.0' },
			null,
			2
		)}\n`,
		'utf8'
	);
	await writeFile(
		join(repositoryRoot, 'packages', 'demo', 'tsconfig.json'),
		`${JSON.stringify(
			{
				compilerOptions: {
					module: 'NodeNext',
					moduleResolution: 'NodeNext',
					noEmit: true,
					noLib: true,
					strict: true,
					target: 'ES2022'
				},
				files: ['src/entry.ts', 'src/leaf.ts']
			},
			null,
			2
		)}\n`,
		'utf8'
	);
	await writeFile(
		join(repositoryRoot, 'packages', 'demo', 'src', 'leaf.ts'),
		'export const leaf = 1;\n',
		'utf8'
	);
	await writeFile(
		join(repositoryRoot, 'packages', 'demo', 'src', 'entry.ts'),
		"import { leaf } from './leaf.js';\nexport const entry = leaf + 1;\n",
		'utf8'
	);
	return {
		binaryPath: join(repositoryRoot, 'packages', 'csaa', 'dist', 'cli', 'csaa-coding-agent-bin.js'),
		repositoryRoot
	};
}

async function runEmittedCodingAgentBinary(
	args: readonly string[] = ['unsupported-command'],
	fixture: EmittedBinaryFixture = {
		binaryPath: EMITTED_CODING_AGENT_BINARY,
		repositoryRoot: REPOSITORY_ROOT
	},
	stdin?: string
): Promise<{
	readonly exitCode: number;
	readonly stderr: string;
	readonly stdout: string;
}> {
	return await new Promise((resolve, reject) => {
		const child = spawn(
			process.platform === 'win32' ? 'bun.exe' : 'bun',
			[fixture.binaryPath, ...args],
			{ cwd: fixture.repositoryRoot, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
		);
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
			reject(new Error('The emitted coding-agent binary smoke timed out.'));
		}, 30_000);
		child.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once('close', (exitCode) => {
			clearTimeout(timeout);
			if (exitCode === null) reject(new Error('The emitted coding-agent binary had no exit code.'));
			else resolve({ exitCode, stderr, stdout });
		});
		child.stdin.end(stdin);
	});
}

async function emittedBinaryPut(fixture: EmittedBinaryFixture, value: unknown): Promise<string> {
	const result = await runEmittedCodingAgentBinary(
		['artifact', 'put', '--stdin'],
		fixture,
		JSON.stringify(value)
	);
	expect(result.exitCode, result.stderr).toBe(0);
	expect(result.stderr).toBe('');
	const published = singleJsonLine(result.stdout);
	expect(published).toMatchObject({ messageKind: 'artifact-published' });
	return (published.artifact as { readonly reference: string }).reference;
}

async function emittedBinaryGet(
	fixture: EmittedBinaryFixture,
	reference: string
): Promise<unknown> {
	const result = await runEmittedCodingAgentBinary(
		['artifact', 'get', '--reference', reference],
		fixture
	);
	expect(result.exitCode, result.stderr).toBe(0);
	expect(result.stderr).toBe('');
	return singleJsonLine(result.stdout);
}

const ARROW_BUDGETS: ArrowCommandCensusBudgets = {
	maxArtifacts: 10_000,
	maxBirthStates: 10_000,
	maxDeclaredArrowOccurrences: 10_000,
	maxDeclaredSites: 10_000,
	maxDiagnostics: 100,
	maxExecutorDurationMs: 180_000,
	maxExternalModuleBytes: 128 * 1024 * 1024,
	maxExternalModuleFiles: 10_000,
	maxMachines: 1_000,
	maxMapStates: 100_000,
	maxMaterializedBytes: 128 * 1024 * 1024,
	maxOutputStringCharacters: 20_000_000,
	maxRawArrayEntries: 100_000,
	maxRawJsonDepth: 20,
	maxStderrBytes: 1024 * 1024,
	maxStdoutBytes: 64 * 1024 * 1024
};

const GUARD_BUDGETS: GuardEnforcementLedgerBudgets = {
	maxArtifacts: 10_000,
	maxAuditEntries: 10_000,
	maxDiagnostics: 100,
	maxExecutorDurationMs: 180_000,
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

describe('emitted CSAA retained-verifier workers', () => {
	it.runIf(RUNS_EMITTED_PACKAGE)(
		'executes the fixed-root emitted coding-agent package binary',
		async () => {
			const result = await runEmittedCodingAgentBinary();
			expect(result.exitCode).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toMatchObject({
				code: 'ARGUMENTS_INVALID',
				messageKind: 'coding-agent-process-diagnostic',
				schemaVersion: CODING_AGENT_PROCESS_DIAGNOSTIC_VERSION,
				severity: 'ERROR'
			});
		},
		30_000
	);

	it.runIf(RUNS_EMITTED_PACKAGE)(
		'persists exact artifacts and executes a representative inventory through the emitted binary',
		async () => {
			const fixture = await createEmittedBinaryFixture();
			try {
				const transported = {
					contract: 'emitted-content-addressed-transport',
					sequence: [1, true, null, 'exact']
				};
				const transportedRef = await emittedBinaryPut(fixture, transported);
				expect(await emittedBinaryGet(fixture, transportedRef)).toEqual(transported);

				const inventoryRequestRef = await emittedBinaryPut(fixture, {
					kind: 'REPOSITORY_INVENTORY_REQUEST',
					requireJpwbPopulations: false,
					rootLocator: '<repository-root>',
					schemaVersion: CODING_AGENT_CLI_INVENTORY_REQUEST_VERSION
				});
				const input: CodingAgentCliOperationInput = {
					bindingRef: 'binding:emitted:inventory:representative',
					kind: 'INVENTORY',
					output: 'STDOUT_JSON',
					schemaVersion: CODING_AGENT_CLI_INPUT_VERSION,
					subjectInputRef: inventoryRequestRef
				};
				const inputDigest = codingAgentCliInputDigest(input);
				expect(inputDigest.state).toBe('VALID');
				if (inputDigest.state !== 'VALID') throw new Error(JSON.stringify(inputDigest));
				const request: AgentOperationRequest = {
					budgets: {
						maxDepth: 256,
						maxEdges: 1_000_000,
						maxNodes: 200_000,
						maxOutputBytes: 16_000_000,
						maxResults: 200_000,
						timeoutMs: 120_000
					},
					capabilityRequirement: {
						affectedQuestionRefs: ['question:emitted:inventory:representative'],
						capabilityId: CODING_AGENT_CLI_LOCAL_CAPABILITIES.inventory,
						capabilityVersion: CODING_AGENT_CLI_LOCAL_CAPABILITY_VERSIONS.inventory,
						necessity: 'MANDATORY'
					},
					currentnessRequirement: { kind: 'REQUIRE_CURRENT' },
					messageKind: 'request',
					operation: 'inventory',
					operationInput: {
						contractId: CODING_AGENT_CLI_INPUT_CONTRACT_ID,
						contractVersion: CODING_AGENT_CLI_INPUT_VERSION,
						inputDigest: inputDigest.digest,
						inputRef: input.bindingRef
					},
					operationVersion: AGENT_OPERATION_VERSIONS.inventory,
					protocolVersion: AGENT_OPERATION_PROTOCOL_VERSION,
					requestId: 'request:emitted:inventory:representative',
					requestedAt: EMITTED_REQUESTED_AT,
					subjectInput: {
						kind: 'SUBJECT_LOCATOR',
						locatorDigest: codingAgentCliArtifactDigest(inventoryRequestRef),
						locatorRef: inventoryRequestRef,
						resolutionPolicyRef: 'policy:exact-content-addressed-input'
					},
					work: {
						agentId: 'agent:emitted-package-smoke',
						authorityEnvelopeRef: 'authority:local-readonly',
						changeContract: { changeContractRef: 'change:csaa-g6', kind: 'REFERENCE' },
						employmentPoint: 'DURING_IMPLEMENTATION',
						userRequestDigest: 'a'.repeat(64),
						workPackageRef: 'work-package:DWP-006'
					}
				};
				const invoked = await runEmittedCodingAgentBinary(
					['invoke', '--stdin'],
					fixture,
					JSON.stringify({
						command: 'inventory',
						input,
						output: 'json',
						request,
						schemaVersion: CODING_AGENT_PROCESS_INVOCATION_VERSION
					})
				);
				expect(invoked.exitCode, JSON.stringify(invoked)).toBe(3);
				const terminal = singleJsonLine(invoked.stdout);
				expect(terminal).toMatchObject({ outcome: 'partial', state: 'partial' });
				expect(
					validateAgentOperationExchange(request, terminal as unknown as AgentOperationResponse)
						.state
				).toBe('VALID');
				const resultRef = (terminal.partial as { readonly admittedResultRefs: string[] })
					.admittedResultRefs[0]!;
				const inventoryResult = (await emittedBinaryGet(fixture, resultRef)) as {
					capture: { subjectId: string };
				};
				expect(inventoryResult.capture.subjectId).toMatch(/^[0-9a-f]{64}$/u);
				expect(invoked.stdout).not.toContain(fixture.repositoryRoot);
				expect(invoked.stderr).not.toContain(fixture.repositoryRoot);
			} finally {
				await rm(fixture.repositoryRoot, { force: true, recursive: true });
			}
		},
		180_000
	);

	it.runIf(RUNS_EMITTED_PACKAGE)(
		'executes both worker-backed providers through the emitted package root',
		async () => {
			const resolution = resolveSubject({
				budgets: {
					maxBytes: 512 * 1024 * 1024,
					maxConfigDepth: 64,
					maxDiagnostics: 100_000,
					maxDurationMs: 300_000,
					maxFiles: 100_000,
					maxProjects: 1_000
				},
				expectEmpty: false,
				filters: { exclude: [], include: [] },
				operationVersion: 'jan-csaa-emitted-worker-smoke/1.0.0',
				outputs: [],
				policyVersion: SUBJECT_POLICY_VERSION,
				rootLocator: REPOSITORY_ROOT,
				schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
				scope: { kind: 'REPOSITORY' },
				subjectKind: 'WORKTREE'
			});
			expect(resolution.outcome).toBe('resolved');
			if (resolution.outcome !== 'resolved') throw new Error(JSON.stringify(resolution));
			const { subject } = resolution;

			const arrowSet = buildArrowCommandCensusArtifactSet(
				{
					budgets: {
						maxArtifacts: ARROW_BUDGETS.maxArtifacts,
						maxDiagnostics: ARROW_BUDGETS.maxDiagnostics,
						maxTotalBytes: ARROW_BUDGETS.maxMaterializedBytes
					},
					operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
					subjectId: subject.descriptor.subjectId
				},
				{ subject }
			);
			expect(arrowSet.outcome, JSON.stringify(arrowSet)).toBe('complete');
			if (arrowSet.outcome !== 'complete') throw new Error(JSON.stringify(arrowSet));
			const arrow = await observeArrowCommandCensus(
				{
					artifactSetId: arrowSet.artifactSet.id,
					budgets: ARROW_BUDGETS,
					operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
					schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
					subjectId: subject.descriptor.subjectId
				},
				{ artifactSet: arrowSet.artifactSet, subject }
			);
			expect(arrow.outcome, JSON.stringify(arrow)).toBe('complete');
			if (arrow.outcome === 'complete')
				expect(validateArrowCommandCensusObservation(arrow.observation, subject)).toEqual({
					issues: [],
					state: 'VALID'
				});

			const guardSet = buildGuardEnforcementLedgerArtifactSet(
				{
					budgets: {
						maxArtifacts: GUARD_BUDGETS.maxArtifacts,
						maxDiagnostics: GUARD_BUDGETS.maxDiagnostics,
						maxTotalBytes: GUARD_BUDGETS.maxMaterializedBytes
					},
					operationVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_OPERATION_VERSION,
					schemaVersion: GUARD_ENFORCEMENT_LEDGER_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
					subjectId: subject.descriptor.subjectId
				},
				{ subject }
			);
			expect(guardSet.outcome, JSON.stringify(guardSet)).toBe('complete');
			if (guardSet.outcome !== 'complete') throw new Error(JSON.stringify(guardSet));
			const guard = await observeGuardEnforcementLedger(
				{
					artifactSetId: guardSet.artifactSet.id,
					budgets: GUARD_BUDGETS,
					operationVersion: GUARD_ENFORCEMENT_LEDGER_OPERATION_VERSION,
					schemaVersion: GUARD_ENFORCEMENT_LEDGER_REQUEST_SCHEMA_VERSION,
					subjectId: subject.descriptor.subjectId
				},
				{ artifactSet: guardSet.artifactSet, subject }
			);
			expect(guard.outcome, JSON.stringify(guard)).not.toBe('unavailable');
			if (guard.outcome !== 'unavailable')
				expect(validateGuardEnforcementLedgerObservation(guard.observation, subject)).toEqual({
					issues: [],
					state: 'VALID'
				});
		},
		600_000
	);
});
