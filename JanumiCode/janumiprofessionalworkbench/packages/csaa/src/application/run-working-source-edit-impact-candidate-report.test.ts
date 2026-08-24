import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
});
