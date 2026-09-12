import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
	LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS,
	type LogicalGraphCompositionReportOutcome
} from '../contracts/logical-graph-composition-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_BYTES,
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_EVENTS,
	LOGICAL_GRAPH_COMPOSITION_PROGRESS_TRANSPORT_SCHEMA_VERSION
} from './logical-graph-composition-progress-jsonl.js';
import { runLogicalGraphCompositionCommand } from './run-logical-graph-composition-command.js';
import {
	LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
	LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_SCHEMA_VERSION,
	type LogicalGraphCompositionReportProgressEvent,
	type runLogicalGraphCompositionReport
} from './run-logical-graph-composition-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-logical-graph-composition.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:logical-graph-composition';
const EXPECTED_PACKAGE_COMMAND = 'bun scripts/csaa-logical-graph-composition.ts';
const FULL_REPOSITORY_TIMEOUT_MS = 45 * 60 * 1_000;
const FULL_PROJECT_CONFIG_PATHS = Object.freeze([
	'packages/rph-application/tsconfig.json',
	'packages/rph-assurance/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json',
	'packages/rph-persistence/tsconfig.json',
	'packages/rph-ports/tsconfig.json',
	'packages/rph-projections/tsconfig.json'
] as const);

function acceptedRequest(
	subjectProjectConfigPaths: readonly string[] = [
		'packages/csaa/test-fixtures/project-context-command/tsconfig.json'
	]
): Record<string, unknown> {
	return {
		budgets: LOGICAL_GRAPH_COMPOSITION_REPORT_SAFETY_CEILINGS,
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths
	};
}

function progressEvent(): LogicalGraphCompositionReportProgressEvent {
	return {
		deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE',
		detailCode: 'SYNTHETIC',
		kind: 'REPORT_STAGE',
		nonclaims: LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		phase: 'RESULT',
		protocolRole: 'PRELIMINARY_TYPESCRIPT_LOGICAL_GRAPH_COMPOSITION_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_SCHEMA_VERSION,
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED'
	};
}

function partial(): LogicalGraphCompositionReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			coverage: { closure: 'OPEN', health: 'PARTIAL', layers: 2 },
			evidence: {
				composition: { crossLinks: [{ source: 'synthetic' }] }
			}
		},
		schemaVersion: 'jan-csaa-logical-graph-composition-report/0.1.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic-logical-composition' }
	} as unknown as LogicalGraphCompositionReportOutcome;
}

function unavailable(
	state: 'failed' | 'incompatible' | 'resource-refused'
): LogicalGraphCompositionReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		code: `SYNTHETIC_${state.toUpperCase()}`,
		diagnostics: [],
		facadeNonclaims: [],
		gateEffect: 'NONE',
		operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		predecessorNonclaims: {},
		schemaVersion: 'jan-csaa-logical-graph-composition-report/0.1.0',
		stage: 'RESULT',
		state
	} as unknown as LogicalGraphCompositionReportOutcome;
}

function run(args: readonly string[], input?: string) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		maxBuffer: 128 * 1024 * 1024,
		windowsHide: true
	});
}

function runWithClosedPipe(
	pipe: 'progress' | 'terminal',
	input: string
): Promise<{ readonly remaining: string; readonly status: number | null }> {
	return new Promise((resolve, reject) => {
		const child = spawn('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});
		const retained = pipe === 'progress' ? child.stdout : child.stderr;
		const closed = pipe === 'progress' ? child.stderr : child.stdout;
		let remaining = '';
		retained.setEncoding('utf8');
		retained.on('data', (chunk: string) => {
			remaining += chunk;
		});
		child.on('error', reject);
		child.on('close', (status) => resolve({ remaining, status }));
		closed.destroy();
		child.stdin.end(input);
	});
}

describe('logical-graph-composition command adapter', () => {
	it('awaits one report and separates bounded progress JSONL from one canonical terminal LF', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: LogicalGraphCompositionReportOutcome) => void;
		const deferred = new Promise<LogicalGraphCompositionReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (
			_request: unknown,
			options: Parameters<typeof runLogicalGraphCompositionReport>[1]
		) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runLogicalGraphCompositionReport;
		let settled = false;
		const running = runLogicalGraphCompositionCommand(
			{},
			{
				repositoryRoot: REPOSITORY_ROOT,
				runReport,
				writeProgress: (line) => progress.push(line),
				writeTerminal: (line) => terminal.push(line)
			}
		).then((exitCode) => {
			settled = true;
			return exitCode;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		expect(terminal).toEqual([]);
		const outcome = partial();
		release(outcome);
		expect(await running).toBe(3);
		expect(progress).toHaveLength(1);
		expect(JSON.parse(progress[0]!)).toMatchObject({ detailCode: 'SYNTHETIC' });
		expect(terminal).toEqual([`${canonicalSemanticJson(outcome)}\n`]);
	});

	it.each([
		{ expected: 2 as const, outcome: unavailable('incompatible') },
		{ expected: 3 as const, outcome: unavailable('resource-refused') },
		{ expected: 4 as const, outcome: unavailable('failed') }
	])('preserves the exact report exit mapping: $expected', async ({ expected, outcome }) => {
		const terminal: string[] = [];
		const exitCode = await runLogicalGraphCompositionCommand(
			{},
			{
				repositoryRoot: REPOSITORY_ROOT,
				runReport: (async () => outcome) as typeof runLogicalGraphCompositionReport,
				writeProgress: () => undefined,
				writeTerminal: (line) => terminal.push(line)
			}
		);
		expect(exitCode).toBe(expected);
		expect(terminal).toEqual([`${canonicalSemanticJson(outcome)}\n`]);
	});

	it('contains EPIPE, backpressure, rejection, hostile thenables, and terminal serialization failure', async () => {
		const runReport = (async () => partial()) as typeof runLogicalGraphCompositionReport;
		const options = {
			repositoryRoot: REPOSITORY_ROOT,
			runReport,
			writeProgress: () => undefined
		};

		expect(
			await runLogicalGraphCompositionCommand(
				{},
				{
					...options,
					writeTerminal: () => {
						throw Object.assign(new Error('closed terminal'), { code: 'EPIPE' });
					}
				}
			)
		).toBe(4);
		expect(
			await runLogicalGraphCompositionCommand(
				{},
				{
					...options,
					writeTerminal: () => Promise.reject(new Error('terminal rejection'))
				}
			)
		).toBe(4);
		expect(
			await runLogicalGraphCompositionCommand(
				{},
				{
					...options,
					writeTerminal: () =>
						Object.defineProperty({}, 'then', {
							get() {
								throw new Error('hostile terminal then getter');
							}
						})
				}
			)
		).toBe(4);

		let backpressuredLine = '';
		expect(
			await runLogicalGraphCompositionCommand(
				{},
				{
					...options,
					writeTerminal: (line) => {
						backpressuredLine = line;
						return false;
					}
				}
			)
		).toBe(3);
		expect(backpressuredLine).toBe(`${canonicalSemanticJson(partial())}\n`);

		const cyclic = partial() as unknown as Record<string, unknown>;
		cyclic.cycle = cyclic;
		let terminalWrites = 0;
		expect(
			await runLogicalGraphCompositionCommand(
				{},
				{
					...options,
					runReport: (async () => cyclic) as unknown as typeof runLogicalGraphCompositionReport,
					writeTerminal: () => {
						terminalWrites += 1;
					}
				}
			)
		).toBe(4);
		expect(terminalWrites).toBe(0);
	});

	it('pins the registered package command to the fixed executable', () => {
		const manifest = JSON.parse(readFileSync(`${REPOSITORY_ROOT}/package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect({ command: EXPECTED_PACKAGE_COMMAND, name: PACKAGE_SCRIPT }).toEqual({
			command: 'bun scripts/csaa-logical-graph-composition.ts',
			name: 'csaa:analyze:logical-graph-composition'
		});
		expect(manifest.scripts[PACKAGE_SCRIPT]).toBe(EXPECTED_PACKAGE_COMMAND);
	});

	it.each([
		{ args: [] },
		{ args: ['--unknown'] },
		{ args: ['--request'] },
		{ args: ['--stdin', '--stdin'] },
		{ args: ['--request', 'one.json', '--stdin'] }
	] as const)('rejects invalid request-source arguments: $args', ({ args }) => {
		const result = run(args);
		expect(result.status, result.stderr).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Use exactly one of --stdin or --request <json-file>.'
		});
	});

	it('keeps malformed and admitted-request refusals machine-framed', () => {
		const malformed = run(['--stdin'], '{not json');
		expect(malformed.status).toBe(2);
		expect(malformed.stdout).toBe('');
		expect(JSON.parse(malformed.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});

		const invalid = run(['--stdin'], '{}');
		expect(invalid.status, invalid.stderr).toBe(2);
		expect(invalid.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(invalid.stdout.endsWith('\n')).toBe(true);
		expect(JSON.parse(invalid.stdout)).toMatchObject({
			analysisAuthority: 'NONE',
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		for (const line of invalid.stderr.split('\n').filter(Boolean))
			expect(() => JSON.parse(line)).not.toThrow();
	});

	it(
		'runs the bounded small fixture through the real executable with exact-subject evidence',
		{ timeout: 120_000 },
		() => {
			const result = run(['--stdin'], JSON.stringify(acceptedRequest()));
			expect(result.error).toBeUndefined();
			expect(result.status, result.stderr).toBe(3);
			const terminalLines = result.stdout.split('\n').filter(Boolean);
			expect(terminalLines).toHaveLength(1);
			expect(result.stdout.endsWith('\n')).toBe(true);
			const terminal = JSON.parse(terminalLines[0]!) as Record<string, any>;
			expect(terminal).toMatchObject({
				analysisAuthority: 'NONE',
				authorityTransfer: 'NONE',
				gateEffect: 'NONE',
				operationVersion: LOGICAL_GRAPH_COMPOSITION_REPORT_OPERATION_VERSION,
				outcome: 'partial',
				result: {
					capability: {
						fullJanCsaaCapability009GraphComposition: 'NOT_CLAIMED',
						graphAuthority: 'NONE',
						id: 'JAN-CSAA-CAP-009',
						status: 'PARTIAL'
					},
					coverage: { closure: 'OPEN', health: 'PARTIAL', layers: 2 },
					currentness: { scope: 'SELECTED_CAPTURED_SUBJECT_ONLY' },
					interpretation:
						'SELECTED_VALIDATED_SAME_SUBJECT_PARTIAL_OPEN_TWO_LAYER_REFERENCE_COMPOSITION'
				},
				state: 'partial'
			});
			const evidence = terminal.result.evidence;
			const subjectId = terminal.subject.subjectId;
			const semanticSnapshotId = terminal.result.semanticSnapshotSummary.id;
			expect(evidence.projectContextGraph.sources.length).toBeGreaterThan(0);
			expect(evidence.moduleDependencyGraph.nodes.length).toBeGreaterThan(0);
			expect(evidence.moduleDependencyGraph.edges.length).toBeGreaterThan(0);
			expect(evidence.callGraph.nodes.length).toBeGreaterThan(0);
			expect(evidence.callGraph.edges.length).toBeGreaterThan(0);
			expect(evidence.composition.crossLinks.length).toBeGreaterThan(0);
			expect(
				[
					evidence.projectContextGraph,
					evidence.moduleDependencyGraph,
					evidence.callGraph,
					evidence.composition,
					...evidence.composition.sourceLayers
				].every((entry) => entry.subjectId === subjectId)
			).toBe(true);
			expect(
				[
					evidence.projectContextGraph,
					evidence.moduleDependencyGraph,
					evidence.callGraph,
					evidence.composition,
					...evidence.composition.sourceLayers
				].every((entry) => entry.semanticSnapshotId === semanticSnapshotId)
			).toBe(true);

			const progressLines = result.stderr.split('\n').filter(Boolean);
			expect(progressLines.length).toBeLessThanOrEqual(
				LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_EVENTS
			);
			expect(Buffer.byteLength(result.stderr, 'utf8')).toBeLessThanOrEqual(
				LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_BYTES
			);
			const progress = progressLines.map((line) => JSON.parse(line) as Record<string, unknown>);
			const admittedSchemas = new Set<string>([
				LOGICAL_GRAPH_COMPOSITION_REPORT_PROGRESS_SCHEMA_VERSION,
				LOGICAL_GRAPH_COMPOSITION_PROGRESS_TRANSPORT_SCHEMA_VERSION
			]);
			expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(
				true
			);
			for (const phase of [
				'REQUEST_BIND',
				'PREDECESSOR_PIPELINE',
				'MODULE_DEPENDENCY_GRAPH',
				'CALL_GRAPH',
				'LOGICAL_GRAPH_COMPOSITION',
				'CURRENTNESS',
				'RESULT'
			])
				expect(
					progress
						.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
						.map((event) => event.state)
				).toEqual(['STARTED', 'COMPLETED']);
			expect(result.stdout).not.toContain(REPOSITORY_ROOT);
			expect(result.stderr).not.toContain(REPOSITORY_ROOT);
		}
	);

	it('contains closed progress and terminal pipes without EPIPE leakage', async () => {
		const invalid = '{}';
		const progressClosed = await runWithClosedPipe('progress', invalid);
		expect(progressClosed.status).toBe(2);
		expect(JSON.parse(progressClosed.remaining)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable'
		});

		const terminalClosed = await runWithClosedPipe('terminal', invalid);
		expect(terminalClosed.status).toBe(2);
		expect(terminalClosed.remaining).not.toContain('EPIPE');
		for (const line of terminalClosed.remaining.split('\n').filter(Boolean))
			expect(() => JSON.parse(line)).not.toThrow();
	});

	it('bounds stdin and regular-file request inputs before report execution', () => {
		const exactMiB = run(['--stdin'], ' '.repeat(1024 * 1024));
		expect(exactMiB.status).toBe(2);
		expect(exactMiB.stdout).toBe('');
		expect(JSON.parse(exactMiB.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});
		const overMiB = run(['--stdin'], ' '.repeat(1024 * 1024 + 1));
		expect(overMiB.status).toBe(2);
		expect(overMiB.stdout).toBe('');
		expect(JSON.parse(overMiB.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input exceeds 1 MiB.'
		});

		const root = mkdtempSync(join(tmpdir(), 'csaa-logical-graph-composition-command-'));
		try {
			const requestPath = join(root, 'request.json');
			writeFileSync(requestPath, '{}', 'utf8');
			const fromFile = run(['--request', requestPath]);
			expect(fromFile.status, fromFile.stderr).toBe(2);
			expect(JSON.parse(fromFile.stdout)).toMatchObject({ code: 'REQUEST_SHAPE_INVALID' });

			const malformedPath = join(root, 'malformed.json');
			writeFileSync(malformedPath, '{not json', 'utf8');
			const malformed = run(['--request', malformedPath]);
			expect(malformed.status).toBe(2);
			expect(malformed.stdout).toBe('');
			expect(JSON.parse(malformed.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input is not valid JSON.'
			});

			const exactMiBPath = join(root, 'exact-mib.json');
			writeFileSync(exactMiBPath, Buffer.alloc(1024 * 1024, 0x20));
			const exactMiBFile = run(['--request', exactMiBPath]);
			expect(exactMiBFile.status).toBe(2);
			expect(exactMiBFile.stdout).toBe('');
			expect(JSON.parse(exactMiBFile.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input is not valid JSON.'
			});

			const overMiBPath = join(root, 'over-mib.json');
			writeFileSync(overMiBPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
			const overMiBFile = run(['--request', overMiBPath]);
			expect(overMiBFile.status).toBe(2);
			expect(overMiBFile.stdout).toBe('');
			expect(JSON.parse(overMiBFile.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input exceeds 1 MiB.'
			});

			const directory = run(['--request', root]);
			expect(directory.status).toBe(2);
			expect(directory.stdout).toBe('');
			expect(JSON.parse(directory.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'The request path must identify a regular file.'
			});
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	}, 30_000);

	it.runIf(process.env.CSAA_LOGICAL_GRAPH_COMPOSITION_REPORT_INTEGRATION === '1')(
		'runs all seven production projects with nonempty exact-subject two-layer evidence',
		() => {
			const result = spawnSync('bun', [SCRIPT, '--stdin'], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				input: JSON.stringify(acceptedRequest(FULL_PROJECT_CONFIG_PATHS)),
				maxBuffer: 512 * 1024 * 1024,
				timeout: FULL_REPOSITORY_TIMEOUT_MS,
				windowsHide: true
			});
			expect(result.error).toBeUndefined();
			const terminalLines = result.stdout.split('\n').filter(Boolean);
			expect(terminalLines).toHaveLength(1);
			expect(result.stdout.endsWith('\n')).toBe(true);
			const terminal = JSON.parse(terminalLines[0]!) as Record<string, any>;
			const progressLines = result.stderr.split('\n').filter(Boolean);
			const progress = progressLines.map((line) => JSON.parse(line) as Record<string, any>);
			expect(result.status, terminalLines[0]).toBe(3);
			expect(
				terminal,
				JSON.stringify({
					code: terminal.code ?? null,
					diagnostics: (terminal.diagnostics ?? [])
						.slice(-5)
						.map((diagnostic: Record<string, unknown>) => ({
							code: diagnostic.code ?? null,
							message: diagnostic.message ?? null,
							path: diagnostic.path ?? null,
							source: diagnostic.source ?? null
						})),
					resultProgress: progress.filter((event) => event.phase === 'RESULT')
				})
			).toMatchObject({
				analysisAuthority: 'NONE',
				authorityTransfer: 'NONE',
				gateEffect: 'NONE',
				outcome: 'partial',
				result: {
					coverage: {
						closure: 'OPEN',
						conflicts: 0,
						health: 'PARTIAL',
						layers: 2,
						unmatchedSources: 0
					},
					currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' }
				},
				state: 'partial'
			});
			const evidence = terminal.result.evidence;
			const subjectId = terminal.subject.subjectId;
			const snapshotId = terminal.result.semanticSnapshotSummary.id;
			const sameSubjectEvidence = [
				evidence.projectContextGraph,
				evidence.moduleDependencyGraph,
				evidence.callGraph,
				evidence.composition,
				...evidence.composition.sourceLayers
			];
			expect(sameSubjectEvidence.every((entry) => entry.subjectId === subjectId)).toBe(true);
			expect(sameSubjectEvidence.every((entry) => entry.semanticSnapshotId === snapshotId)).toBe(
				true
			);
			expect(evidence.projectContextGraph.projects.length).toBeGreaterThanOrEqual(7);
			const actualWitness = {
				callCandidateSetCallSites: evidence.callGraph.coverage.candidateSetCallSites,
				callEdges: evidence.callGraph.edges.length,
				callExternalDispatchCallSites: evidence.callGraph.coverage.externalDispatchCallSites,
				callNodes: evidence.callGraph.nodes.length,
				callRepresentedCallSites: evidence.callGraph.coverage.representedCallSites,
				callTargetEdges: evidence.callGraph.coverage.targetEdges,
				callUnresolvedCallSites: evidence.callGraph.coverage.unresolvedCallSites,
				callUnsupportedCallSites: evidence.callGraph.coverage.unsupportedCallSites,
				compositionCoverage: evidence.composition.coverage,
				compositionCrossLinks: evidence.composition.crossLinks.length,
				compositionInheritedLimitations: evidence.composition.inheritedLimitations.length,
				invocations: terminal.result.semanticSnapshotSummary.invocations,
				moduleEdges: evidence.moduleDependencyGraph.edges.length,
				moduleNodes: evidence.moduleDependencyGraph.nodes.length,
				sources: terminal.result.semanticSnapshotSummary.sources
			};
			expect(actualWitness).toEqual({
				callCandidateSetCallSites: 8_847,
				callEdges: 53_820,
				callExternalDispatchCallSites: 11_839,
				callNodes: 52_616,
				callRepresentedCallSites: 26_910,
				callTargetEdges: 26_910,
				callUnresolvedCallSites: 0,
				callUnsupportedCallSites: 6_224,
				compositionCoverage: {
					callEligibleSourceRegions: 2_536,
					callInputEdges: 53_820,
					callInputNodes: 52_616,
					callPopulationReconciles: true,
					chargedInputTraversalSteps: 115_281,
					conflictingSemanticSources: 0,
					crossLinks: 2_536,
					exactSemanticSourceIdCandidates: 2_536,
					linkedSemanticSources: 2_536,
					linkPopulationReconciles: true,
					moduleEligibleSourceNodes: 2_536,
					moduleInputEdges: 1_177,
					moduleInputNodes: 2_596,
					modulePopulationReconciles: true,
					sourceIdentityPopulationReconciles: true,
					unmatchedCallSources: 0,
					unmatchedModuleSources: 0
				},
				compositionCrossLinks: 2_536,
				compositionInheritedLimitations: 27_626,
				invocations: 26_910,
				moduleEdges: 1_177,
				moduleNodes: 2_596,
				sources: 2_536
			});
			expect(evidence.composition.layers).toHaveLength(2);
			expect(evidence.composition.sourceLayers).toHaveLength(2);
			expect(terminal.result.contributingLayers.moduleDependencyGraph.nodes).toBe(
				evidence.moduleDependencyGraph.nodes.length
			);
			expect(terminal.result.contributingLayers.moduleDependencyGraph.edges).toBe(
				evidence.moduleDependencyGraph.edges.length
			);
			expect(terminal.result.contributingLayers.callGraph.nodes).toBe(
				evidence.callGraph.nodes.length
			);
			expect(terminal.result.contributingLayers.callGraph.edges).toBe(
				evidence.callGraph.edges.length
			);

			expect(progressLines.length).toBeLessThanOrEqual(
				LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_EVENTS
			);
			expect(Buffer.byteLength(result.stderr, 'utf8')).toBeLessThanOrEqual(
				LOGICAL_GRAPH_COMPOSITION_PROGRESS_MAX_BYTES
			);
			for (const phase of [
				'REQUEST_BIND',
				'PREDECESSOR_PIPELINE',
				'MODULE_DEPENDENCY_GRAPH',
				'CALL_GRAPH',
				'LOGICAL_GRAPH_COMPOSITION',
				'CURRENTNESS',
				'RESULT'
			])
				expect(
					progress
						.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
						.map((event) => event.state)
				).toEqual(['STARTED', 'COMPLETED']);
			expect(result.stdout).not.toContain(REPOSITORY_ROOT);
			expect(result.stderr).not.toContain(REPOSITORY_ROOT);
		},
		FULL_REPOSITORY_TIMEOUT_MS + 60_000
	);
});
