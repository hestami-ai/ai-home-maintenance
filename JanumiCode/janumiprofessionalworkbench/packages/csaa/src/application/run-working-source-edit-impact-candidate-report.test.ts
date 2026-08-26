import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const facadeBoundaryControl = vi.hoisted(() => ({
	capture: null as unknown,
	execution: null as unknown,
	mode: null as string | null,
	verifyCalls: 0
}));

vi.mock('../impact/observe-working-source-edit.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../impact/observe-working-source-edit.js')>();
	return {
		...actual,
		observeWorkingSourceEdit: (...args: Parameters<typeof actual.observeWorkingSourceEdit>) => {
			if (facadeBoundaryControl.mode === 'OBSERVATION_THROW')
				throw new Error('synthetic observation failure');
			if (facadeBoundaryControl.mode !== null && facadeBoundaryControl.capture !== null)
				return facadeBoundaryControl.capture as ReturnType<typeof actual.observeWorkingSourceEdit>;
			const capture = actual.observeWorkingSourceEdit(...args);
			facadeBoundaryControl.capture = capture;
			return capture;
		},
		verifyWorkingSourceEditObservation: (
			...args: Parameters<typeof actual.verifyWorkingSourceEditObservation>
		) => {
			if (facadeBoundaryControl.mode === null)
				return actual.verifyWorkingSourceEditObservation(...args);
			facadeBoundaryControl.verifyCalls += 1;
			if (
				facadeBoundaryControl.mode === 'VERIFY_FIRST_THROW' &&
				facadeBoundaryControl.verifyCalls === 1
			)
				throw new Error('synthetic first verification failure');
			if (
				facadeBoundaryControl.mode === 'VERIFY_SECOND_THROW' &&
				facadeBoundaryControl.verifyCalls === 2
			)
				throw new Error('synthetic second verification failure');
			const capture = facadeBoundaryControl.capture as ReturnType<
				typeof actual.observeWorkingSourceEdit
			>;
			if (
				(facadeBoundaryControl.mode === 'VERIFY_FIRST_DIFFERENT' &&
					facadeBoundaryControl.verifyCalls === 1) ||
				(facadeBoundaryControl.mode === 'VERIFY_SECOND_DIFFERENT' &&
					facadeBoundaryControl.verifyCalls === 2)
			) {
				const currentBytes = Uint8Array.from(capture.currentBytes);
				currentBytes[0] = (currentBytes[0] ?? 0) ^ 0xff;
				return { ...capture, currentBytes };
			}
			return capture;
		},
		bindWorkingSourceEditObservation: (
			...args: Parameters<typeof actual.bindWorkingSourceEditObservation>
		) => {
			if (facadeBoundaryControl.mode === 'BIND_TYPED')
				throw new actual.WorkingSourceEditObservationError(
					'SYNTHETIC_BINDING_FAILURE',
					'CURRENTNESS',
					'stale',
					'Synthetic typed binding failure.',
					args[1].path
				);
			if (facadeBoundaryControl.mode === 'BIND_GENERIC')
				throw new Error('synthetic generic binding failure');
			const observation = actual.bindWorkingSourceEditObservation(...args);
			return facadeBoundaryControl.mode === 'BIND_DIGEST'
				? { ...observation, evidenceSha256: 'f'.repeat(64) }
				: observation;
		}
	};
});

vi.mock('./run-static-module-impact-candidate-report.js', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('./run-static-module-impact-candidate-report.js')>();
	return {
		...actual,
		runStaticModuleImpactCandidateReportWithCapturedSubject: (
			...args: Parameters<typeof actual.runStaticModuleImpactCandidateReportWithCapturedSubject>
		) => {
			if (facadeBoundaryControl.mode === 'STATIC_THROW')
				throw new Error('synthetic predecessor runner failure');
			if (facadeBoundaryControl.mode === null || facadeBoundaryControl.execution === null) {
				const execution = actual.runStaticModuleImpactCandidateReportWithCapturedSubject(...args);
				facadeBoundaryControl.execution = execution;
				return execution;
			}
			const execution = facadeBoundaryControl.execution as ReturnType<
				typeof actual.runStaticModuleImpactCandidateReportWithCapturedSubject
			>;
			if (execution.outcome.outcome !== 'partial') return execution;
			switch (facadeBoundaryControl.mode) {
				case 'HANDOFF_NULL':
					return { ...execution, repositoryRoot: null } as unknown as typeof execution;
				case 'RESULT_BYTES_MISMATCH':
					return {
						...execution,
						resultBytes: (execution.resultBytes ?? 0) + 1
					} as typeof execution;
				case 'REQUEST_MISMATCH':
					return {
						...execution,
						outcome: {
							...execution.outcome,
							request: {
								...execution.outcome.request,
								seed: {
									...execution.outcome.request.seed,
									id: `${execution.outcome.request.seed.id.slice(0, -1)}x`
								}
							}
						}
					} as typeof execution;
				case 'SEED_MISMATCH':
					return {
						...execution,
						outcome: {
							...execution.outcome,
							result: {
								...execution.outcome.result,
								seed: {
									...execution.outcome.result.seed,
									seedId: `${execution.outcome.result.seed.seedId.slice(0, -1)}x`
								}
							}
						}
					} as typeof execution;
				default:
					return execution;
			}
		}
	};
});

vi.mock('../subject/frozen-store.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../subject/frozen-store.js')>();
	return {
		...actual,
		readFrozenSubjectArtifact: (...args: Parameters<typeof actual.readFrozenSubjectArtifact>) => {
			if (facadeBoundaryControl.mode === 'READ_FROZEN_THROW')
				throw new Error('synthetic frozen-store failure');
			if (facadeBoundaryControl.mode === 'FROZEN_BYTES_MISSING') return undefined;
			const bytes = actual.readFrozenSubjectArtifact(...args);
			if (bytes === undefined) return bytes;
			if (facadeBoundaryControl.mode === 'FROZEN_BYTES_SHORT')
				return bytes.subarray(0, Math.max(0, bytes.byteLength - 1));
			if (facadeBoundaryControl.mode === 'FROZEN_BYTES_CHANGED') {
				const changed = Uint8Array.from(bytes);
				changed[0] = (changed[0] ?? 0) ^ 0xff;
				return changed;
			}
			return bytes;
		}
	};
});

vi.mock('../subject/freshness.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../subject/freshness.js')>();
	return {
		...actual,
		verifyFrozenSubject: (...args: Parameters<typeof actual.verifyFrozenSubject>) => {
			if (facadeBoundaryControl.mode === 'FRESHNESS_THROW')
				throw new Error('synthetic freshness failure');
			if (facadeBoundaryControl.mode === 'FRESHNESS_STALE')
				return {
					changedPaths: ['packages/demo/src/leaf.ts'],
					diagnostics: [],
					state: 'STALE'
				} as ReturnType<typeof actual.verifyFrozenSubject>;
			if (facadeBoundaryControl.mode === 'FRESHNESS_UNAVAILABLE')
				return { changedPaths: [], diagnostics: [], state: 'UNAVAILABLE' } as ReturnType<
					typeof actual.verifyFrozenSubject
				>;
			return actual.verifyFrozenSubject(...args);
		}
	};
});

vi.mock('../semantic/canonical.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../semantic/canonical.js')>();
	return {
		...actual,
		canonicalSemanticJsonWitness: (value: unknown) => {
			const candidate =
				value !== null && typeof value === 'object'
					? (value as { readonly outcome?: unknown; readonly result?: unknown })
					: null;
			const result =
				candidate?.result !== null && typeof candidate?.result === 'object'
					? (candidate.result as Record<string, unknown>)
					: null;
			const seed =
				result?.seed !== null && typeof result?.seed === 'object'
					? (result.seed as Record<string, unknown>)
					: null;
			const capability =
				result?.capability !== null && typeof result?.capability === 'object'
					? (result.capability as Record<string, unknown>)
					: null;
			const isPredecessor = candidate?.outcome === 'partial' && seed !== null && 'artifact' in seed;
			const isFacade =
				candidate?.outcome === 'partial' &&
				capability?.id === 'IMPLEMENTATION_LOCAL_WORKING_SOURCE_EDIT_IMPACT_CANDIDATES';
			if (facadeBoundaryControl.mode === 'CANONICAL_HANDOFF_THROW' && isPredecessor)
				throw new Error('synthetic predecessor identity serialization failure');
			if (facadeBoundaryControl.mode === 'RESULT_SERIALIZATION_THROW' && isFacade)
				throw new Error('synthetic result serialization failure');
			const witness = actual.canonicalSemanticJsonWitness(value);
			return facadeBoundaryControl.mode === 'RESULT_OVERSIZE' && isFacade
				? { ...witness, bytes: Number.MAX_SAFE_INTEGER }
				: witness;
		}
	};
});
import {
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
	type WorkingSourceEditImpactCandidateReportRequest
} from '../contracts/working-source-edit-impact-candidate-report.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	runWorkingSourceEditImpactCandidateReport,
	workingSourceEditImpactCandidateReportExitCode
} from './run-working-source-edit-impact-candidate-report.js';

const temporaryRoots: string[] = [];
const LEAF = 'export const leaf = 1;\n';
const EDITED_LEAF = 'export const leaf = 2;\n';
const MIDDLE = "import { leaf } from './leaf.js';\nexport const middle = leaf + 1;\n";
const ENTRY = "import { middle } from './middle.js';\nexport const entry = middle + 1;\n";
const EDITED_ENTRY = `${ENTRY}export const changed = true;\n`;

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function json(root: string, path: string, value: unknown): void {
	write(root, path, `${JSON.stringify(value, null, 2)}\n`);
}

function git(root: string, args: readonly string[]): string {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_'))
	);
	const result = spawnSync('git', args, {
		cwd: root,
		encoding: 'utf8',
		env: {
			...env,
			GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
			GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
			GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
			GIT_CONFIG_NOSYSTEM: '1',
			LANG: 'C',
			LC_ALL: 'C'
		},
		maxBuffer: 1024 * 1024,
		shell: false,
		timeout: 10_000,
		windowsHide: true
	});
	if (result.status !== 0) throw new Error(`Fixture Git command failed: ${args[0] ?? '<missing>'}`);
	return result.stdout.trim();
}

function fixture(): { readonly head: string; readonly root: string } {
	const root = mkdtempSync(join(tmpdir(), 'csaa-working-edit-impact-'));
	temporaryRoots.push(root);
	json(root, 'package.json', {
		name: 'working-edit-impact-fixture',
		private: true,
		workspaces: ['packages/*']
	});
	json(root, 'packages/demo/package.json', {
		name: '@fixture/working-edit-impact',
		private: true,
		version: '0.0.0'
	});
	json(root, 'packages/demo/tsconfig.json', {
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
	write(root, 'packages/demo/src/leaf.ts', LEAF);
	write(root, 'packages/demo/src/middle.ts', MIDDLE);
	write(root, 'packages/demo/src/entry.ts', ENTRY);
	write(root, 'bun.lock', 'fixture lock\n');
	git(root, ['init', '--quiet', '--initial-branch=main']);
	git(root, ['config', 'core.autocrlf', 'false']);
	git(root, ['config', 'core.safecrlf', 'false']);
	git(root, [
		'add',
		'--',
		'package.json',
		'bun.lock',
		'packages/demo/package.json',
		'packages/demo/tsconfig.json',
		'packages/demo/src/entry.ts',
		'packages/demo/src/leaf.ts',
		'packages/demo/src/middle.ts'
	]);
	git(root, [
		'-c',
		'user.name=CSAA Fixture',
		'-c',
		'user.email=csaa-fixture@example.invalid',
		'-c',
		'commit.gpgSign=false',
		'commit',
		'--quiet',
		'--no-verify',
		'--message=baseline'
	]);
	return { head: git(root, ['rev-parse', '--verify', 'HEAD^{commit}']), root };
}

function request(
	head: string,
	logicalPath = 'packages/demo/src/leaf.ts'
): WorkingSourceEditImpactCandidateReportRequest {
	return {
		budgets: {
			maxResultBytes: 32 * 1024 * 1024,
			observation: {
				maxGitMetadataBytes: 1024 * 1024,
				maxGitOperationDurationMs: 30_000,
				maxPathCharacters: 4_096,
				maxSourceBytes: 8 * 1024 * 1024
			},
			staticImpact: {
				maxCandidateWitnessHops: 16_000,
				maxResultBytes: 16 * 1024 * 1024,
				reachability: {
					maxDiagnostics: 1_000,
					maxEdges: 10_000,
					maxFrontierRecords: 10_000,
					maxInputRecords: 1_000_000,
					maxInputStringCharacters: 10_000_000,
					maxNodes: 10_000,
					maxReachableNodes: 10_000,
					maxTraversalSteps: 20_000,
					maxWitnessEdges: 10_000
				},
				semantic: {
					maxAstDepth: 256,
					maxAstNodes: 100_000,
					maxCompilerFacts: 100_000,
					maxCompilerInputMetadataBytes: 16 * 1024 * 1024,
					maxCompilerQueries: 100_000,
					maxCompilerQueryInvocations: 1_000_000,
					maxContextBytes: 32 * 1024 * 1024,
					maxContextFileBytes: 8 * 1024 * 1024,
					maxContextFiles: 10_000,
					maxDiagnosticCharacters: 1_000_000,
					maxDiagnostics: 10_000,
					maxDirectoryEntries: 1_000_000,
					maxDurationMs: 60_000,
					maxLiteralCharacters: 10_000,
					maxPathCharacters: 2_000,
					maxProjects: 10,
					maxScopes: 100_000,
					maxSnapshotBytes: 64 * 1024 * 1024,
					maxSources: 10_000
				},
				subject: {
					maxBytes: 32 * 1024 * 1024,
					maxConfigDepth: 32,
					maxDiagnostics: 1_000,
					maxDurationMs: 30_000,
					maxFiles: 10_000,
					maxProjects: 10
				}
			}
		},
		immutableBaseCommitOid: head,
		operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: {
			id: 'seed:observed-edit',
			logicalPath,
			operation: 'EDIT',
			projectConfigPath: 'packages/demo/tsconfig.json',
			schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE'
		},
		subjectProjectConfigPaths: ['packages/demo/tsconfig.json']
	};
}

beforeEach(() => {
	facadeBoundaryControl.capture = null;
	facadeBoundaryControl.execution = null;
	facadeBoundaryControl.mode = null;
	facadeBoundaryControl.verifyCalls = 0;
});

afterEach(() => {
	for (const root of temporaryRoots.splice(0))
		rmSync(root, { force: true, maxRetries: 3, recursive: true, retryDelay: 50 });
});

describe('runWorkingSourceEditImpactCandidateReport', () => {
	it('binds deterministic raw edit evidence to the captured source and possible importers', () => {
		const { head, root } = fixture();
		write(root, 'packages/demo/src/leaf.ts', EDITED_LEAF);
		const first = runWorkingSourceEditImpactCandidateReport(request(head), {
			repositoryRoot: root
		});
		const second = runWorkingSourceEditImpactCandidateReport(request(head), {
			repositoryRoot: root
		});
		expect(first.outcome).toBe('partial');
		expect(canonicalSemanticJson(second)).toBe(canonicalSemanticJson(first));
		if (first.outcome !== 'partial') throw new Error(JSON.stringify(first));
		expect(first.result.currentness).toMatchObject({
			finalFacadeVerification: 'RECHECKED_AFTER_COMPOSITION_AND_RESULT_SIZE_ACCOUNTING',
			state: 'CURRENT_FOR_VALIDATED_SELECTED_WORKING_SOURCE_EDIT'
		});
		const edit = first.result.evidence.workingSourceEdit;
		expect(edit.git).toMatchObject({
			headOid: head,
			indexBlobOid: edit.git.treeBlobOid,
			indexStage: 0,
			requestedBaseCommitOid: head
		});
		expect(edit.source.before.sha256).toBe(sha256(LEAF));
		expect(edit.source.after).toMatchObject({
			artifact: { path: 'packages/demo/src/leaf.ts', sha256: sha256(EDITED_LEAF) },
			binding: 'RAW_CURRENT_BYTES_MATCH_FROZEN_SUBJECT_ARTIFACT',
			sha256: sha256(EDITED_LEAF)
		});
		const predecessor = first.result.evidence.staticModuleImpactCandidateReport;
		expect(predecessor.result.seed.workingChangeSet).toEqual({
			basis: 'CALLER_DECLARED_NOT_INDEPENDENTLY_VALIDATED',
			id: edit.evidenceSha256
		});
		expect(predecessor.result.candidates).toHaveLength(2);
		expect(
			predecessor.result.candidates.every(
				(candidate) => candidate.impactEpistemicState === 'POSSIBLE'
			)
		).toBe(true);
		expect(workingSourceEditImpactCandidateReportExitCode(first)).toBe(3);
	}, 30_000);

	it('keeps a zero-importer observation distinct from a non-impact conclusion', () => {
		const { head, root } = fixture();
		write(root, 'packages/demo/src/entry.ts', EDITED_ENTRY);
		const outcome = runWorkingSourceEditImpactCandidateReport(
			request(head, 'packages/demo/src/entry.ts'),
			{ repositoryRoot: root }
		);
		expect(outcome).toMatchObject({
			outcome: 'partial',
			result: {
				conclusion:
					'VALIDATED_WORKING_SOURCE_EDIT_WITH_NO_STATIC_MODULE_IMPORTER_CANDIDATES_WITHIN_SELECTED_GRAPH',
				globalImpactClosure: 'OPEN',
				uncertainty: { staticImpactCandidates: 'POSSIBLE_ONLY' }
			}
		});
		if (outcome.outcome === 'partial')
			expect(outcome.result.evidence.staticModuleImpactCandidateReport.result.candidates).toEqual(
				[]
			);
	});

	it('binds nested-root logical paths independently from Git top-level repository paths', () => {
		const { root } = fixture();
		json(root, 'nested/package.json', {
			name: 'working-edit-impact-nested-fixture',
			private: true,
			workspaces: ['packages/*']
		});
		json(root, 'nested/packages/demo/package.json', {
			name: '@fixture/working-edit-impact-nested',
			private: true,
			version: '0.0.0'
		});
		json(root, 'nested/packages/demo/tsconfig.json', {
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
		write(root, 'nested/packages/demo/src/leaf.ts', LEAF);
		write(root, 'nested/packages/demo/src/middle.ts', MIDDLE);
		write(root, 'nested/packages/demo/src/entry.ts', ENTRY);
		git(root, [
			'add',
			'--',
			'nested/package.json',
			'nested/packages/demo/package.json',
			'nested/packages/demo/tsconfig.json',
			'nested/packages/demo/src/entry.ts',
			'nested/packages/demo/src/leaf.ts',
			'nested/packages/demo/src/middle.ts'
		]);
		git(root, [
			'-c',
			'user.name=CSAA Fixture',
			'-c',
			'user.email=csaa-fixture@example.invalid',
			'-c',
			'commit.gpgSign=false',
			'commit',
			'--quiet',
			'--no-verify',
			'--message=nested baseline'
		]);
		const head = git(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
		write(root, 'nested/packages/demo/src/leaf.ts', EDITED_LEAF);
		const baseRequest = request(head);
		const outcome = runWorkingSourceEditImpactCandidateReport(baseRequest, {
			repositoryRoot: join(root, 'nested')
		});
		if (outcome.outcome !== 'partial') throw new Error(JSON.stringify(outcome));
		expect(outcome).toMatchObject({
			outcome: 'partial',
			result: {
				evidence: {
					workingSourceEdit: {
						source: {
							after: { artifact: { path: 'packages/demo/src/leaf.ts' } },
							logicalPath: 'packages/demo/src/leaf.ts',
							repositoryPath: 'nested/packages/demo/src/leaf.ts'
						}
					}
				}
			}
		});
	}, 30_000);

	it('refuses a moved base, a staged intermediate, and an impossible predecessor result budget', () => {
		const moved = fixture();
		write(moved.root, 'packages/demo/src/leaf.ts', EDITED_LEAF);
		const wrongBase = runWorkingSourceEditImpactCandidateReport(
			request('0'.repeat(moved.head.length)),
			{ repositoryRoot: moved.root }
		);
		expect(wrongBase).toMatchObject({ outcome: 'unavailable', state: 'stale' });

		const staged = fixture();
		write(staged.root, 'packages/demo/src/leaf.ts', EDITED_LEAF);
		git(staged.root, ['add', '--', 'packages/demo/src/leaf.ts']);
		const stagedOutcome = runWorkingSourceEditImpactCandidateReport(request(staged.head), {
			repositoryRoot: staged.root
		});
		expect(stagedOutcome).toMatchObject({ outcome: 'unavailable', state: 'incompatible' });

		const budgeted = fixture();
		const baseRequest = request(budgeted.head);
		const impossible = runWorkingSourceEditImpactCandidateReport(
			{
				...baseRequest,
				budgets: {
					...baseRequest.budgets,
					maxResultBytes: 1024,
					staticImpact: { ...baseRequest.budgets.staticImpact, maxResultBytes: 1024 }
				}
			},
			{ repositoryRoot: budgeted.root }
		);
		expect(impossible).toMatchObject({
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'resource-refused'
		});
	});

	it('compacts an admitted oversized terminal envelope within maxResultBytes', () => {
		const { head, root } = fixture();
		write(root, 'packages/demo/src/leaf.ts', EDITED_LEAF);
		const baseRequest = request(head);
		const subjectProjectConfigPaths = Array.from({ length: 200 }, (_, index) => {
			const suffix = `-${index.toString().padStart(3, '0')}.json`;
			return `${'p'.repeat(4_096 - suffix.length)}${suffix}`;
		});
		const maxResultBytes = 64 * 1024 + 1;
		const admittedRequest: WorkingSourceEditImpactCandidateReportRequest = {
			...baseRequest,
			budgets: {
				...baseRequest.budgets,
				maxResultBytes,
				staticImpact: {
					...baseRequest.budgets.staticImpact,
					maxResultBytes: 1,
					semantic: {
						...baseRequest.budgets.staticImpact.semantic,
						maxPathCharacters: 4_096,
						maxProjects: 200
					},
					subject: { ...baseRequest.budgets.staticImpact.subject, maxProjects: 200 }
				}
			},
			seed: {
				...baseRequest.seed,
				projectConfigPath: subjectProjectConfigPaths[0]!
			},
			subjectProjectConfigPaths
		};
		const outcome = runWorkingSourceEditImpactCandidateReport(admittedRequest, {
			repositoryRoot: root
		});
		expect(outcome).toMatchObject({
			code: 'TERMINAL_RESULT_BUDGET_EXCEEDED',
			outcome: 'unavailable',
			stage: 'RESULT',
			state: 'resource-refused'
		});
		expect('request' in outcome).toBe(false);
		expect('observation' in outcome).toBe(false);
		expect('subject' in outcome).toBe(false);
		expect(
			new TextEncoder().encode(`${canonicalSemanticJson(outcome)}\n`).byteLength
		).toBeLessThanOrEqual(maxResultBytes);
	});

	it('does not invoke hostile request accessors', () => {
		let getterHits = 0;
		const seed: Record<string, unknown> = {
			id: 'seed:hostile',
			logicalPath: 'packages/demo/src/leaf.ts',
			operation: 'EDIT',
			projectConfigPath: 'packages/demo/tsconfig.json',
			schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE'
		};
		Object.defineProperty(seed, 'id', {
			enumerable: true,
			get() {
				getterHits += 1;
				return 'hostile';
			}
		});
		const { head } = fixture();
		const outcome = runWorkingSourceEditImpactCandidateReport(
			{ ...request(head), seed },
			{ repositoryRoot: 'not-inspected' }
		);
		expect(getterHits).toBe(0);
		expect(outcome).toMatchObject({ outcome: 'unavailable', stage: 'REQUEST' });
	});

	it('fails closed across exact facade handoff, serialization, and currentness boundaries', () => {
		const { head, root } = fixture();
		write(root, 'packages/demo/src/leaf.ts', EDITED_LEAF);
		const admittedRequest = request(head);
		const baseline = runWorkingSourceEditImpactCandidateReport(admittedRequest, {
			repositoryRoot: root
		});
		expect(baseline.outcome).toBe('partial');
		expect(facadeBoundaryControl.capture).not.toBeNull();
		expect(facadeBoundaryControl.execution).not.toBeNull();

		const runMode = (mode: string) => {
			facadeBoundaryControl.mode = mode;
			facadeBoundaryControl.verifyCalls = 0;
			return runWorkingSourceEditImpactCandidateReport(admittedRequest, { repositoryRoot: root });
		};
		const cases: readonly [string, Readonly<Record<string, unknown>>][] = [
			[
				'OBSERVATION_THROW',
				{
					code: 'WORKING_SOURCE_EDIT_OBSERVATION_FAILED',
					stage: 'GIT_PROVIDER',
					state: 'failed'
				}
			],
			[
				'CANONICAL_HANDOFF_THROW',
				{ code: 'HANDOFF_IDENTITY_SERIALIZATION_FAILED', stage: 'PREDECESSOR_REPORT' }
			],
			[
				'HANDOFF_NULL',
				{ code: 'PREDECESSOR_EXACT_HANDOFF_UNAVAILABLE', stage: 'PREDECESSOR_REPORT' }
			],
			[
				'RESULT_BYTES_MISMATCH',
				{ code: 'PREDECESSOR_RESULT_SIZE_HANDOFF_MISMATCH', stage: 'PREDECESSOR_REPORT' }
			],
			[
				'REQUEST_MISMATCH',
				{ code: 'PREDECESSOR_REQUEST_OR_SUBJECT_HANDOFF_MISMATCH', stage: 'PREDECESSOR_REPORT' }
			],
			['SEED_MISMATCH', { code: 'SEED_SUBJECT_IDENTITY_MISMATCH', stage: 'SUBJECT' }],
			[
				'FROZEN_BYTES_MISSING',
				{ code: 'FROZEN_SUBJECT_ARTIFACT_BYTES_UNAVAILABLE', stage: 'SUBJECT' }
			],
			[
				'FROZEN_BYTES_SHORT',
				{
					code: 'OBSERVED_SOURCE_AND_FROZEN_SUBJECT_BYTES_DIFFER',
					stage: 'SUBJECT',
					state: 'stale'
				}
			],
			[
				'FROZEN_BYTES_CHANGED',
				{
					code: 'OBSERVED_SOURCE_AND_FROZEN_SUBJECT_BYTES_DIFFER',
					stage: 'SUBJECT',
					state: 'stale'
				}
			],
			['BIND_TYPED', { code: 'SYNTHETIC_BINDING_FAILURE', stage: 'SUBJECT', state: 'stale' }],
			['BIND_GENERIC', { code: 'FROZEN_SUBJECT_BINDING_FAILED', stage: 'SUBJECT' }],
			[
				'BIND_DIGEST',
				{ code: 'OBSERVATION_DIGEST_CHANGED_DURING_SUBJECT_BINDING', stage: 'SUBJECT' }
			],
			[
				'READ_FROZEN_THROW',
				{ code: 'PREDECESSOR_HANDOFF_RECONCILIATION_FAILED', stage: 'PREDECESSOR_REPORT' }
			],
			['RESULT_SERIALIZATION_THROW', { code: 'RESULT_SERIALIZATION_FAILED', stage: 'RESULT' }],
			[
				'RESULT_OVERSIZE',
				{ code: 'RESULT_BUDGET_EXCEEDED', stage: 'RESULT', state: 'resource-refused' }
			],
			[
				'VERIFY_FIRST_DIFFERENT',
				{
					code: 'WORKING_SOURCE_EDIT_OBSERVATION_STALE',
					stage: 'CURRENTNESS',
					state: 'stale'
				}
			],
			[
				'VERIFY_FIRST_THROW',
				{
					code: 'WORKING_SOURCE_EDIT_OBSERVATION_FAILED',
					stage: 'GIT_PROVIDER',
					state: 'failed'
				}
			],
			[
				'FRESHNESS_THROW',
				{
					code: 'FROZEN_SUBJECT_CURRENTNESS_UNAVAILABLE',
					stage: 'CURRENTNESS',
					state: 'failed'
				}
			],
			['FRESHNESS_STALE', { code: 'FROZEN_SUBJECT_STALE', stage: 'CURRENTNESS', state: 'stale' }],
			[
				'FRESHNESS_UNAVAILABLE',
				{
					code: 'FROZEN_SUBJECT_CURRENTNESS_UNAVAILABLE',
					stage: 'CURRENTNESS',
					state: 'failed'
				}
			],
			[
				'VERIFY_SECOND_DIFFERENT',
				{
					code: 'WORKING_SOURCE_EDIT_OBSERVATION_STALE',
					stage: 'CURRENTNESS',
					state: 'stale'
				}
			],
			[
				'VERIFY_SECOND_THROW',
				{
					code: 'WORKING_SOURCE_EDIT_OBSERVATION_FAILED',
					stage: 'GIT_PROVIDER',
					state: 'failed'
				}
			],
			['STATIC_THROW', { code: 'INTERNAL_FAILURE', stage: 'RESULT', state: 'failed' }]
		];
		for (const [mode, expected] of cases)
			expect(runMode(mode), mode).toMatchObject({ outcome: 'unavailable', ...expected });
	}, 60_000);

	it('rejects malformed request and runner-option structures before observing Git', () => {
		const head = 'a'.repeat(40);
		const freshRequest = (): Record<string, unknown> =>
			structuredClone(request(head)) as unknown as Record<string, unknown>;
		const record = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
		const mutate = (change: (candidate: Record<string, unknown>) => void): unknown => {
			const candidate = freshRequest();
			change(candidate);
			return candidate;
		};
		const nonenumerableRequest = freshRequest();
		Object.defineProperty(nonenumerableRequest, 'schemaVersion', {
			enumerable: false,
			value: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION
		});
		const sparseProjects = new Array<string>(1);
		const expandedProjects = ['packages/demo/tsconfig.json'];
		Object.defineProperty(expandedProjects, 'extra', { enumerable: true, value: true });
		const nonenumerableProjects = ['packages/demo/tsconfig.json'];
		Object.defineProperty(nonenumerableProjects, '0', {
			enumerable: false,
			value: 'packages/demo/tsconfig.json'
		});
		const requestCases: readonly {
			readonly code: string;
			readonly name: string;
			readonly value: unknown;
		}[] = [
			{ code: 'REQUEST_SHAPE_INVALID', name: 'null request', value: null },
			{ code: 'REQUEST_SHAPE_INVALID', name: 'array request', value: [] },
			{ code: 'REQUEST_SHAPE_INVALID', name: 'non-data request', value: new Date() },
			{
				code: 'REQUEST_SHAPE_INVALID',
				name: 'open request shape',
				value: mutate((candidate) => {
					candidate.unexpected = true;
				})
			},
			{
				code: 'REQUEST_SHAPE_INVALID',
				name: 'non-enumerable request field',
				value: nonenumerableRequest
			},
			{
				code: 'REQUEST_SCHEMA_INCOMPATIBLE',
				name: 'request schema drift',
				value: mutate((candidate) => {
					candidate.schemaVersion = 'unsupported';
				})
			},
			{
				code: 'REQUEST_OPERATION_INCOMPATIBLE',
				name: 'operation drift',
				value: mutate((candidate) => {
					candidate.operationVersion = 'unsupported';
				})
			},
			{
				code: 'REQUEST_BASE_COMMIT_OID_INVALID',
				name: 'abbreviated object identity',
				value: mutate((candidate) => {
					candidate.immutableBaseCommitOid = 'ABC123';
				})
			},
			{
				code: 'REQUEST_BUDGET_INVALID',
				name: 'non-positive budget',
				value: mutate((candidate) => {
					record(candidate.budgets).maxResultBytes = 0;
				})
			},
			{
				code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				name: 'budget above the absolute ceiling',
				value: mutate((candidate) => {
					record(candidate.budgets).maxResultBytes = 64 * 1024 * 1024 + 1;
				})
			},
			{
				code: 'REQUEST_SHAPE_INVALID',
				name: 'malformed nested budget tree',
				value: mutate((candidate) => {
					record(candidate.budgets).staticImpact = null;
				})
			},
			{
				code: 'REQUEST_OUTER_RESULT_RESERVATION_UNAVAILABLE',
				name: 'missing outer result reservation',
				value: mutate((candidate) => {
					const budgets = record(candidate.budgets);
					budgets.maxResultBytes = 64 * 1024;
					record(budgets.staticImpact).maxResultBytes = 1;
				})
			},
			{
				code: 'REQUEST_SHAPE_INVALID',
				name: 'malformed seed shape',
				value: mutate((candidate) => {
					candidate.seed = null;
				})
			},
			{
				code: 'REQUEST_SEED_SCHEMA_INCOMPATIBLE',
				name: 'seed schema drift',
				value: mutate((candidate) => {
					record(candidate.seed).schemaVersion = 'unsupported';
				})
			},
			{
				code: 'REQUEST_SEED_INVALID',
				name: 'seed operation drift',
				value: mutate((candidate) => {
					record(candidate.seed).operation = 'DELETE';
				})
			},
			{
				code: 'REQUEST_SEED_INVALID',
				name: 'seed scope drift',
				value: mutate((candidate) => {
					record(candidate.seed).scope = 'RANGE';
				})
			},
			{
				code: 'REQUEST_SEED_INVALID',
				name: 'empty caller identity',
				value: mutate((candidate) => {
					record(candidate.seed).id = '';
				})
			},
			{
				code: 'REQUEST_PATH_INVALID',
				name: 'empty source path',
				value: mutate((candidate) => {
					record(candidate.seed).logicalPath = '';
				})
			},
			{
				code: 'REQUEST_PATH_BUDGET_EXCEEDED',
				name: 'over-budget source path',
				value: mutate((candidate) => {
					record(candidate.seed).logicalPath = 'x'.repeat(2_001);
				})
			},
			{
				code: 'REQUEST_PATH_INVALID',
				name: 'NUL source path',
				value: mutate((candidate) => {
					record(candidate.seed).logicalPath = 'src/\0bad.ts';
				})
			},
			{
				code: 'REQUEST_PATH_INVALID',
				name: 'noncanonical source path',
				value: mutate((candidate) => {
					record(candidate.seed).logicalPath = '../escape.ts';
				})
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				name: 'non-array project closure',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = null;
				})
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				name: 'empty project closure',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = [];
				})
			},
			{
				code: 'REQUEST_PROJECTS_BUDGET_EXCEEDED',
				name: 'over-budget project closure',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = Array.from(
						{ length: 11 },
						(_, index) => `packages/project-${index}/tsconfig.json`
					);
				})
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				name: 'sparse project closure',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = sparseProjects;
				})
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				name: 'expanded project closure',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = expandedProjects;
				})
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				name: 'non-enumerable project entry',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = nonenumerableProjects;
				})
			},
			{
				code: 'REQUEST_PROJECTS_INVALID',
				name: 'duplicate project closure',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = [
						'packages/demo/tsconfig.json',
						'packages/demo/tsconfig.json'
					];
				})
			},
			{
				code: 'REQUEST_SEED_PROJECT_OUTSIDE_SUBJECT',
				name: 'seed project outside the selected subject',
				value: mutate((candidate) => {
					candidate.subjectProjectConfigPaths = ['packages/other/tsconfig.json'];
				})
			}
		];
		for (const candidate of requestCases) {
			const outcome = runWorkingSourceEditImpactCandidateReport(candidate.value, {
				repositoryRoot: 'not-inspected'
			});
			expect(outcome, candidate.name).toMatchObject({
				code: candidate.code,
				outcome: 'unavailable',
				stage: 'REQUEST'
			});
		}

		const nonenumerableRoot = {};
		Object.defineProperty(nonenumerableRoot, 'repositoryRoot', {
			enumerable: false,
			value: 'not-inspected'
		});
		const accessorRoot = {};
		Object.defineProperty(accessorRoot, 'repositoryRoot', {
			enumerable: true,
			get: () => 'not-inspected'
		});
		const nonenumerableArtifacts = { repositoryRoot: 'not-inspected' };
		Object.defineProperty(nonenumerableArtifacts, 'additionalArtifacts', {
			enumerable: false,
			value: []
		});
		const accessorProgress = { repositoryRoot: 'not-inspected' };
		Object.defineProperty(accessorProgress, 'onPredecessorProgress', {
			enumerable: true,
			get: () => undefined
		});
		const nonenumerableFilters = { repositoryRoot: 'not-inspected' };
		Object.defineProperty(nonenumerableFilters, 'subjectFilters', {
			enumerable: false,
			value: {}
		});
		const optionCases: readonly {
			readonly code: string;
			readonly name: string;
			readonly value: unknown;
		}[] = [
			{ code: 'OPTIONS_SHAPE_INVALID', name: 'null options', value: null },
			{ code: 'OPTIONS_SHAPE_INVALID', name: 'array options', value: [] },
			{ code: 'OPTIONS_SHAPE_INVALID', name: 'non-data options', value: new Date() },
			{ code: 'OPTIONS_SHAPE_INVALID', name: 'missing root option', value: {} },
			{
				code: 'OPTIONS_SHAPE_INVALID',
				name: 'unexpected option',
				value: { repositoryRoot: 'not-inspected', unexpected: true }
			},
			{ code: 'OPTIONS_ROOT_INVALID', name: 'empty root option', value: { repositoryRoot: '' } },
			{ code: 'OPTIONS_ROOT_INVALID', name: 'non-enumerable root', value: nonenumerableRoot },
			{ code: 'OPTIONS_ROOT_INVALID', name: 'accessor root', value: accessorRoot },
			{
				code: 'OPTIONS_ADDITIONAL_ARTIFACTS_INVALID',
				name: 'non-enumerable additional artifacts',
				value: nonenumerableArtifacts
			},
			{
				code: 'OPTIONS_PROGRESS_INVALID',
				name: 'non-function progress callback',
				value: { onPredecessorProgress: 1, repositoryRoot: 'not-inspected' }
			},
			{
				code: 'OPTIONS_PROGRESS_INVALID',
				name: 'proxied progress callback',
				value: {
					onPredecessorProgress: new Proxy(() => undefined, {}),
					repositoryRoot: 'not-inspected'
				}
			},
			{
				code: 'OPTIONS_PROGRESS_INVALID',
				name: 'accessor progress callback',
				value: accessorProgress
			},
			{
				code: 'OPTIONS_SUBJECT_FILTERS_INVALID',
				name: 'non-enumerable subject filters',
				value: nonenumerableFilters
			}
		];
		for (const candidate of optionCases) {
			const outcome = runWorkingSourceEditImpactCandidateReport(
				request(head),
				candidate.value as Parameters<typeof runWorkingSourceEditImpactCandidateReport>[1]
			);
			expect(outcome, candidate.name).toMatchObject({
				code: candidate.code,
				outcome: 'unavailable',
				stage: 'REQUEST'
			});
		}

		const inaccessibleRequest = freshRequest();
		const inaccessibleOptions = { repositoryRoot: 'not-inspected' };
		const originalOwnKeys = Reflect.ownKeys;
		let rejectedTarget: object = inaccessibleRequest;
		const ownKeysSpy = vi.spyOn(Reflect, 'ownKeys').mockImplementation((target) => {
			if (target === rejectedTarget) throw new Error('synthetic inspection failure');
			return originalOwnKeys(target);
		});
		let requestInspectionFailure;
		let optionsInspectionFailure;
		try {
			requestInspectionFailure = runWorkingSourceEditImpactCandidateReport(inaccessibleRequest, {
				repositoryRoot: 'not-inspected'
			});
			rejectedTarget = inaccessibleOptions;
			optionsInspectionFailure = runWorkingSourceEditImpactCandidateReport(
				request(head),
				inaccessibleOptions
			);
		} finally {
			ownKeysSpy.mockRestore();
		}
		expect(requestInspectionFailure).toMatchObject({
			code: 'REQUEST_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST'
		});
		expect(optionsInspectionFailure).toMatchObject({
			code: 'OPTIONS_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST'
		});
		expect(workingSourceEditImpactCandidateReportExitCode(requestInspectionFailure)).toBe(2);
		expect(workingSourceEditImpactCandidateReportExitCode(optionsInspectionFailure)).toBe(4);
	});
});
