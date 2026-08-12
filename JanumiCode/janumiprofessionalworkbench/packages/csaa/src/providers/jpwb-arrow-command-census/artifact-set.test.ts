import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusArtifactBinding,
	type BuildArrowCommandCensusArtifactSetRequest
} from '../../contracts/arrow-command-census.js';
import type {
	CapturedArtifactRecord,
	ExcludedArtifactRecord,
	FrozenSubject
} from '../../contracts/subject.js';
import { sha256 } from '../../inventory/canonical.js';
import { classifyArtifact } from '../../subject/artifacts.js';
import { attachFrozenSubjectBytes } from '../../subject/frozen-store.js';
import { canonicalPathKey } from '../../subject/paths.js';
import {
	arrowCommandCensusArtifactSetContentDigest,
	arrowCommandCensusArtifactSetDigest,
	arrowCommandCensusArtifactSetId
} from './arrow-command-census-content.js';
import {
	buildArrowCommandCensusArtifactSet,
	selectArrowCommandCensusArtifactSet,
	validateArrowCommandCensusArtifactSet
} from './artifact-set.js';

const SUBJECT_ID = 'subject:arrow-command-census-fixture';
const encoder = new TextEncoder();

const REQUIRED_SOURCES = new Map<string, string>([
	['verif/arrow-command-census.ts', 'export const census = () => ({ total: 0 });\n'],
	[
		'verif/arrow-command-census.baseline.json',
		'{"dead":[],"orphans":[],"total":0,"unanalysed":[],"uncovered":[]}\n'
	],
	['verif/arrow-census-coverage.test.ts', "export const authorityCoverageTest = 'retained';\n"],
	['verif/arrow-command-census.test.ts', "export const authorityOracleTest = 'retained';\n"],
	['packages/rph-domain/package.json', '{"name":"@janumipwb/rph-domain"}\n'],
	['packages/rph-contracts/package.json', '{"name":"@janumipwb/rph-contracts"}\n'],
	['packages/rph-domain/src/index.ts', "export * from './transitions.data.js';\n"],
	[
		'packages/rph-domain/src/machine-exclusions.ts',
		'export const isExcludedMachine = () => false;\n'
	],
	[
		'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
		'export const PWU_LIFECYCLE_COMMAND_SPECS = {};\n'
	],
	['packages/rph-domain/src/step-command-spec.ts', 'export const STEP_COMMAND_SPECS = {};\n'],
	[
		'packages/rph-domain/src/transitions.data.ts',
		'// GENERATED FILE — do not edit by hand.\nexport const STATE_MACHINES = {};\n'
	],
	['packages/rph-contracts/src/index.ts', "export * from './enums.js';\n"],
	[
		'packages/rph-application/src/handlers/execution.ts',
		"export const handler = { machine: 'Execution', fromStates: ['A'], targetStates: ['B'] };\n"
	]
]);

const IGNORED_SOURCES = new Map<string, string>([
	['packages/rph-application/src/handlers/kit.ts', 'export const advanceStatus = () => {};\n'],
	['packages/rph-application/src/handlers/execution.test.ts', 'export const testOnly = true;\n'],
	['packages/rph-application/src/handlers/__tests__/fixture.ts', 'export const fixture = true;\n'],
	['packages/rph-domain/src/example.test.ts', 'export const testOnly = true;\n'],
	['packages/rph-domain/src/gen/generate.ts', 'export const generate = true;\n'],
	['packages/rph-contracts/src/example.spec.ts', 'export const testOnly = true;\n'],
	['packages/rph-contracts/src/gen/generate.ts', 'export const generate = true;\n'],
	['packages/csaa/src/index.ts', 'export {};\n']
]);

interface SubjectOptions {
	readonly add?: ReadonlyMap<string, string>;
	readonly duplicatePath?: string;
	readonly excludePaths?: readonly string[];
	readonly mutate?: (artifact: CapturedArtifactRecord) => CapturedArtifactRecord;
	readonly omitBytes?: readonly string[];
	readonly omitPaths?: readonly string[];
	readonly subjectId?: string;
}

function artifact(path: string, source: string): CapturedArtifactRecord {
	const bytes = encoder.encode(source);
	const classification = classifyArtifact(path, source);
	return {
		bytes: bytes.byteLength,
		canonicalPathKey: canonicalPathKey(path),
		disposition: classification.disposition,
		path,
		primaryClass: classification.primaryClass,
		reason: classification.reason,
		roles: classification.roles,
		sha256: sha256(bytes)
	};
}

function frozenSubject(options: SubjectOptions = {}): FrozenSubject {
	const omit = new Set(options.omitPaths ?? []);
	const excluded = new Set(options.excludePaths ?? []);
	const all = new Map([...REQUIRED_SOURCES, ...IGNORED_SOURCES, ...(options.add ?? [])]);
	const rows: CapturedArtifactRecord[] = [];
	const bytes = new Map<string, Uint8Array>();
	const excludedArtifacts: ExcludedArtifactRecord[] = [];
	for (const [path, source] of all) {
		if (omit.has(path)) continue;
		const row = artifact(path, source);
		if (excluded.has(path)) {
			excludedArtifacts.push({
				canonicalPathKey: row.canonicalPathKey,
				disposition: 'EXCLUDED',
				path,
				physicalFileCount: 1,
				policyId: 'fixture-exclusion',
				primaryClass: row.primaryClass,
				reason: 'Fixture exclusion.',
				roles: row.roles
			});
			continue;
		}
		rows.push(options.mutate?.(row) ?? row);
		if (!(options.omitBytes ?? []).includes(path)) bytes.set(path, encoder.encode(source));
	}
	if (options.duplicatePath !== undefined) {
		const duplicate = rows.find((row) => row.path === options.duplicatePath);
		if (duplicate !== undefined) rows.push({ ...duplicate });
	}
	rows.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
	const subject = {
		artifacts: rows,
		descriptor: { subjectId: options.subjectId ?? SUBJECT_ID },
		diagnostics: [],
		excludedArtifacts,
		generatedContexts: [],
		population: {
			analyzed: rows.filter((row) => row.disposition === 'ANALYZED').length,
			discovered: rows.length + excludedArtifacts.length,
			excluded: excludedArtifacts.length,
			failed: 0,
			included: rows.length,
			inventoryOnly: rows.filter((row) => row.disposition === 'INVENTORY_ONLY').length,
			reconciles: true
		},
		projects: [],
		request: {},
		workspaces: []
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(subject, bytes);
	return subject;
}

function request(subject = frozenSubject()): BuildArrowCommandCensusArtifactSetRequest {
	const totalBytes = subject.artifacts.reduce((total, row) => total + row.bytes, 0);
	return {
		budgets: {
			maxArtifacts: subject.artifacts.length + 1,
			maxDiagnostics: 100,
			maxTotalBytes: totalBytes + 1
		},
		operationVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_OPERATION_VERSION,
		schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_REQUEST_SCHEMA_VERSION,
		subjectId: subject.descriptor.subjectId
	};
}

function complete(subject = frozenSubject()) {
	const outcome = buildArrowCommandCensusArtifactSet(request(subject), { subject });
	expect(outcome.outcome).toBe('complete');
	if (outcome.outcome !== 'complete') throw new Error(outcome.diagnostics[0]?.message);
	return outcome.artifactSet;
}

function repairIdentities(value: ReturnType<typeof complete>): void {
	const mutable = value as unknown as Record<string, any>;
	mutable.artifactSetDigest = arrowCommandCensusArtifactSetDigest(mutable.artifacts);
	mutable.id = arrowCommandCensusArtifactSetId({
		artifactSetDigest: mutable.artifactSetDigest,
		method: mutable.method,
		schemaVersion: mutable.schemaVersion,
		subjectId: mutable.subjectId
	});
	mutable.contentDigest = arrowCommandCensusArtifactSetContentDigest(mutable as never);
}

describe('JPWB retained arrow-command census artifact set', () => {
	it('binds the exact executed, parsed, compared, and authority-only populations deterministically', () => {
		const subject = frozenSubject({
			add: new Map([
				['package.json', '{"private":true}\n'],
				['bun.lock', '[install]\n']
			])
		});
		const first = complete(subject);
		const second = selectArrowCommandCensusArtifactSet(request(subject), { subject });
		expect(second).toEqual({ artifactSet: first, diagnostics: [], outcome: 'complete' });
		expect(first.artifacts.map((item) => item.path)).toEqual(
			[...first.artifacts.map((item) => item.path)].sort()
		);
		expect(first.coverage).toEqual({
			artifacts: 15,
			baselineArtifacts: 1,
			commandDeclarationArtifacts: 2,
			contractSchemaArtifacts: 1,
			environmentIdentityArtifacts: 2,
			executorSourceArtifacts: 1,
			executorTestArtifacts: 2,
			handlerSourceArtifacts: 1,
			packageManifestArtifacts: 2,
			packageSourceArtifacts: 6,
			reconciles: true,
			stateMachineDeclarationArtifacts: 2
		});
		expect(
			first.artifacts.find((item) => item.path === 'verif/arrow-command-census.ts')?.uses
		).toEqual(['EXECUTOR_SOURCE']);
		expect(
			first.artifacts.find(
				(item) => item.path === 'packages/rph-application/src/handlers/execution.ts'
			)?.uses
		).toEqual(['HANDLER_SOURCE']);
		expect(
			first.artifacts.find((item) => item.path === 'verif/arrow-command-census.baseline.json')?.uses
		).toEqual(['BASELINE']);
		expect(first.artifacts.filter((item) => item.uses.includes('EXECUTOR_TEST'))).toHaveLength(2);
		expect(first.artifactSetDigest).toBe(arrowCommandCensusArtifactSetDigest(first.artifacts));
		expect(first.contentDigest).toBe(arrowCommandCensusArtifactSetContentDigest(first));
		expect(validateArrowCommandCensusArtifactSet(first, subject)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('derives new eligible sources from the frozen manifest while rejecting test, kit, generator, and unrelated populations', () => {
		const added = new Map<string, string>([
			['packages/rph-application/src/handlers/new-family.ts', 'export const handler = true;\n'],
			[
				'packages/rph-application/src/handlers/new-family.spec.ts',
				'export const testOnly = true;\n'
			],
			['packages/rph-domain/src/nested/new-domain.ts', 'export const domain = true;\n'],
			['packages/rph-domain/src/nested/new-domain.test.ts', 'export const testOnly = true;\n'],
			['packages/rph-domain/src/gen/new-generator.ts', 'export const generator = true;\n'],
			['packages/rph-contracts/src/nested/new-contract.ts', 'export const contract = true;\n'],
			['packages/rph-contracts/src/gen/new-generator.ts', 'export const generator = true;\n']
		]);
		const artifactSet = complete(frozenSubject({ add: added }));
		const paths = new Set(artifactSet.artifacts.map((item) => item.path));
		expect(paths.has('packages/rph-application/src/handlers/new-family.ts')).toBe(true);
		expect(paths.has('packages/rph-domain/src/nested/new-domain.ts')).toBe(true);
		expect(paths.has('packages/rph-contracts/src/nested/new-contract.ts')).toBe(true);
		for (const path of [
			'packages/rph-application/src/handlers/kit.ts',
			'packages/rph-application/src/handlers/execution.test.ts',
			'packages/rph-application/src/handlers/new-family.spec.ts',
			'packages/rph-domain/src/nested/new-domain.test.ts',
			'packages/rph-domain/src/gen/new-generator.ts',
			'packages/rph-contracts/src/gen/new-generator.ts',
			'packages/csaa/src/index.ts'
		])
			expect(paths.has(path), path).toBe(false);
	});

	it.each([...REQUIRED_SOURCES.keys()].filter((path) => !path.includes('/handlers/')))(
		'fails closed when required artifact %s is absent',
		(path) => {
			const subject = frozenSubject({ omitPaths: [path] });
			const outcome = buildArrowCommandCensusArtifactSet(request(subject), { subject });
			expect(outcome.outcome).toBe('unavailable');
			expect(outcome.diagnostics).toContainEqual(
				expect.objectContaining({ code: 'REQUIRED_ARTIFACT_MISSING', path })
			);
		}
	);

	it('fails closed for excluded eligible sources, empty required populations, and duplicate selected rows', () => {
		const excludedPath = 'packages/rph-application/src/handlers/execution.ts';
		const excludedSubject = frozenSubject({ excludePaths: [excludedPath] });
		const excluded = buildArrowCommandCensusArtifactSet(request(excludedSubject), {
			subject: excludedSubject
		});
		expect(excluded.outcome).toBe('unavailable');
		expect(excluded.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'POPULATION_RECONCILIATION_FAILED', path: excludedPath }),
				expect.objectContaining({ code: 'UNSUPPORTED_REPOSITORY_LAYOUT' })
			])
		);

		const duplicateSubject = frozenSubject({ duplicatePath: 'packages/rph-domain/src/index.ts' });
		const duplicate = buildArrowCommandCensusArtifactSet(request(duplicateSubject), {
			subject: duplicateSubject
		});
		expect(duplicate.outcome).toBe('unavailable');
		expect(duplicate.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'AMBIGUOUS_REQUIRED_ARTIFACT' })
		);
	});

	it('treats excluded root environment identity as optional rather than an adapter blocker', () => {
		const subject = frozenSubject({
			add: new Map([['package.json', '{"private":true}\n']]),
			excludePaths: ['package.json']
		});
		const artifactSet = complete(subject);
		expect(artifactSet.coverage.environmentIdentityArtifacts).toBe(0);
	});

	it.each([
		['bytes', (row: CapturedArtifactRecord) => ({ ...row, bytes: row.bytes + 1 })],
		['digest', (row: CapturedArtifactRecord) => ({ ...row, sha256: '0'.repeat(64) })],
		['canonical key', (row: CapturedArtifactRecord) => ({ ...row, canonicalPathKey: 'wrong' })],
		['class', (row: CapturedArtifactRecord) => ({ ...row, primaryClass: 'OTHER' as const })],
		['reason', (row: CapturedArtifactRecord) => ({ ...row, reason: 'forged' })],
		['roles', (row: CapturedArtifactRecord) => ({ ...row, roles: [] })],
		[
			'disposition',
			(row: CapturedArtifactRecord) => ({ ...row, disposition: 'INVENTORY_ONLY' as const })
		]
	] as const)('rejects a selected manifest row with wrong %s', (_name, mutate) => {
		const target = 'packages/rph-domain/src/index.ts';
		const subject = frozenSubject({ mutate: (row) => (row.path === target ? mutate(row) : row) });
		const outcome = buildArrowCommandCensusArtifactSet(request(subject), { subject });
		expect(outcome.outcome).toBe('unavailable');
		expect(outcome.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'ARTIFACT_IDENTITY_INVALID', path: target })
		);
	});

	it('rejects missing frozen bytes, mismatched subjects, unavailable capabilities, and caller budget exhaustion', () => {
		const target = 'packages/rph-domain/src/index.ts';
		const missingBytes = frozenSubject({ omitBytes: [target] });
		expect(
			buildArrowCommandCensusArtifactSet(request(missingBytes), { subject: missingBytes })
		).toEqual(
			expect.objectContaining({
				diagnostics: expect.arrayContaining([
					expect.objectContaining({ code: 'ARTIFACT_IDENTITY_INVALID', path: target })
				]),
				outcome: 'unavailable'
			})
		);

		const subject = frozenSubject();
		expect(
			buildArrowCommandCensusArtifactSet({ ...request(subject), subjectId: 'wrong' }, { subject })
		).toEqual(
			expect.objectContaining({
				diagnostics: [expect.objectContaining({ code: 'SUBJECT_ID_MISMATCH' })],
				outcome: 'unavailable'
			})
		);
		expect(
			buildArrowCommandCensusArtifactSet(request(subject), {
				subject: { ...subject } as FrozenSubject
			})
		).toEqual(
			expect.objectContaining({
				diagnostics: [expect.objectContaining({ code: 'SUBJECT_CAPABILITY_UNAVAILABLE' })],
				outcome: 'unavailable'
			})
		);
		for (const budgets of [
			{ ...request(subject).budgets, maxArtifacts: 1 },
			{ ...request(subject).budgets, maxTotalBytes: 1 }
		]) {
			const outcome = buildArrowCommandCensusArtifactSet(
				{ ...request(subject), budgets },
				{ subject }
			);
			expect(outcome.outcome).toBe('unavailable');
			expect(outcome.diagnostics).toContainEqual(
				expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })
			);
		}
	});

	it('rejects malformed requests without interpreting their fields', () => {
		const subject = frozenSubject();
		for (const malformed of [
			null,
			{},
			{ ...request(subject), extra: true },
			{ ...request(subject), schemaVersion: 'wrong' },
			{ ...request(subject), operationVersion: 'wrong' },
			{ ...request(subject), subjectId: '' },
			{ ...request(subject), budgets: {} },
			{ ...request(subject), budgets: { ...request(subject).budgets, maxArtifacts: 0 } },
			{ ...request(subject), budgets: { ...request(subject).budgets, maxDiagnostics: 0 } },
			{ ...request(subject), budgets: { ...request(subject).budgets, maxTotalBytes: 0 } }
		]) {
			const outcome = buildArrowCommandCensusArtifactSet(malformed as never, { subject });
			expect(outcome.outcome).toBe('unavailable');
			expect(outcome.diagnostics[0]?.code).toBe('REQUEST_INVALID');
		}
		const reportingBound = buildArrowCommandCensusArtifactSet(
			{
				...request(subject),
				budgets: { ...request(subject).budgets, maxDiagnostics: 1 }
			},
			{
				subject: frozenSubject({
					omitPaths: ['verif/arrow-command-census.ts', 'verif/arrow-command-census.test.ts']
				})
			}
		);
		expect(reportingBound.diagnostics).toEqual([
			expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })
		]);
	});

	it('independently rejects missing, extra, duplicate, reordered, misclassified, and forged populations', () => {
		const subject = frozenSubject();
		const valid = complete(subject);
		const mutations: Array<(value: Record<string, any>) => void> = [
			(value) => value.artifacts.pop(),
			(value) => value.artifacts.push(structuredClone(value.artifacts[0])),
			(value) => value.artifacts.reverse(),
			(value) => value.artifacts[0].uses.push('HANDLER_SOURCE'),
			(value) => (value.artifacts[0].bytes += 1),
			(value) => (value.coverage.artifacts += 1),
			(value) => (value.artifactSetDigest = '0'.repeat(64)),
			(value) => (value.id = 'forged'),
			(value) => (value.contentDigest = '0'.repeat(64)),
			(value) => (value.subjectId = 'wrong'),
			(value) => (value.schemaVersion = 'wrong'),
			(value) => (value.method = 'wrong')
		];
		for (const mutate of mutations) {
			const candidate = structuredClone(valid) as unknown as Record<string, any>;
			mutate(candidate);
			expect(validateArrowCommandCensusArtifactSet(candidate, subject).state).not.toBe('VALID');
		}

		const kit = subject.artifacts.find(
			(row) => row.path === 'packages/rph-application/src/handlers/kit.ts'
		)!;
		const extra = structuredClone(valid) as unknown as Record<string, any>;
		extra.artifacts.push({ ...kit, roles: [...kit.roles], uses: ['HANDLER_SOURCE'] });
		extra.artifacts.sort(
			(left: ArrowCommandCensusArtifactBinding, right: ArrowCommandCensusArtifactBinding) =>
				left.path < right.path ? -1 : left.path > right.path ? 1 : 0
		);
		repairIdentities(extra as ReturnType<typeof complete>);
		expect(validateArrowCommandCensusArtifactSet(extra, subject).state).toBe('INVALID');
	});

	it('rejects hostile wire containers and keeps maxIssues a reporting-only budget', () => {
		const subject = frozenSubject();
		const valid = complete(subject);
		for (const hostile of [
			new Proxy(valid, {}),
			Object.assign(Object.create({ inherited: true }), structuredClone(valid)),
			{ ...valid, extra: true }
		])
			expect(validateArrowCommandCensusArtifactSet(hostile, subject).state).toBe('INVALID');
		const sparse = structuredClone(valid) as unknown as Record<string, any>;
		delete sparse.artifacts[0];
		expect(validateArrowCommandCensusArtifactSet(sparse, subject).state).toBe('INVALID');

		const many = structuredClone(valid) as unknown as Record<string, any>;
		many.subjectId = 'wrong';
		many.schemaVersion = 'wrong';
		many.method = 'wrong';
		expect(validateArrowCommandCensusArtifactSet(many, subject, { maxIssues: 1 })).toEqual(
			expect.objectContaining({ issues: [expect.any(Object)], state: 'BUDGET_EXHAUSTED' })
		);
		expect(validateArrowCommandCensusArtifactSet(valid, subject, { maxIssues: 0 })).toEqual(
			expect.objectContaining({ state: 'INVALID' })
		);
		expect(validateArrowCommandCensusArtifactSet(valid, subject, { extra: true } as never)).toEqual(
			expect.objectContaining({ state: 'INVALID' })
		);
		expect(validateArrowCommandCensusArtifactSet(valid, { ...subject } as FrozenSubject)).toEqual(
			expect.objectContaining({ issues: [expect.objectContaining({ path: '$subject' })] })
		);

		const shapeCases: Array<(value: Record<string, any>) => void> = [
			(value) => (value.artifacts[0].extra = true),
			(value) => (value.artifacts[0].bytes = -1),
			(value) => (value.coverage = null),
			(value) => (value.coverage.artifacts = -1),
			(value) => (value.artifactSetDigest = 'not-a-digest'),
			(value) => (value.id = '')
		];
		for (const mutate of shapeCases) {
			const malformed = structuredClone(valid) as unknown as Record<string, any>;
			mutate(malformed);
			expect(validateArrowCommandCensusArtifactSet(malformed).state).toBe('INVALID');
		}

		const hostile = new Proxy(valid, {
			getPrototypeOf() {
				throw new Error('hostile');
			}
		});
		expect(validateArrowCommandCensusArtifactSet(hostile).state).toBe('INVALID');

		const missingSubject = frozenSubject({ omitPaths: ['verif/arrow-command-census.ts'] });
		expect(validateArrowCommandCensusArtifactSet(valid, missingSubject).state).toBe('INVALID');
	});

	it('fails closed on hostile selected rows and canonical path collisions', () => {
		const hostileRow = new Proxy(
			artifact('packages/rph-domain/src/index.ts', 'export const domain = true;\n'),
			{
				get(_target, key, receiver) {
					if (key === 'bytes') throw new Error('hostile');
					return Reflect.get(_target, key, receiver);
				}
			}
		);
		const hostileSubject = frozenSubject({
			mutate: (row) => (row.path === 'packages/rph-domain/src/index.ts' ? hostileRow : row)
		});
		expect(buildArrowCommandCensusArtifactSet(request(), { subject: hostileSubject })).toEqual(
			expect.objectContaining({ outcome: 'unavailable' })
		);

		const collisionSubject = frozenSubject({
			add: new Map([
				['packages/rph-application/src/handlers/Execution.ts', 'export const handler = true;\n']
			])
		});
		const collision = buildArrowCommandCensusArtifactSet(request(collisionSubject), {
			subject: collisionSubject
		});
		expect(collision.outcome).toBe('unavailable');
		expect(collision.diagnostics).toContainEqual(
			expect.objectContaining({ code: 'AMBIGUOUS_REQUIRED_ARTIFACT' })
		);

		const hostilePopulation = frozenSubject();
		const hostilePopulationRequest = request(hostilePopulation);
		Object.defineProperty(hostilePopulation, 'artifacts', {
			enumerable: true,
			get() {
				throw new Error('hostile population');
			}
		});
		expect(
			buildArrowCommandCensusArtifactSet(hostilePopulationRequest, { subject: hostilePopulation })
		).toEqual(expect.objectContaining({ outcome: 'unavailable' }));

		const hostileValidationSubject = frozenSubject();
		Object.defineProperty(hostileValidationSubject, 'descriptor', {
			enumerable: true,
			get() {
				throw new Error('hostile descriptor');
			}
		});
		expect(validateArrowCommandCensusArtifactSet(complete(), hostileValidationSubject)).toEqual(
			expect.objectContaining({
				issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })],
				state: 'INVALID'
			})
		);
	});

	it('binds the current repository population without a hand-maintained source-file list', () => {
		const root = fileURLToPath(new URL('../../../../../', import.meta.url));
		const entries = new Map<string, string>();
		const addFile = (path: string) => entries.set(path, readFileSync(join(root, path), 'utf8'));
		for (const path of [
			'verif/arrow-command-census.ts',
			'verif/arrow-command-census.baseline.json',
			'verif/arrow-census-coverage.test.ts',
			'verif/arrow-command-census.test.ts',
			'packages/rph-domain/package.json',
			'packages/rph-contracts/package.json'
		])
			addFile(path);
		const walk = (directory: string): void => {
			for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
				const absolute = join(root, directory, entry.name);
				const path = relative(root, absolute).replaceAll('\\', '/');
				if (entry.isDirectory()) walk(path);
				else if (entry.isFile() && entry.name.endsWith('.ts')) addFile(path);
			}
		};
		walk('packages/rph-domain/src');
		walk('packages/rph-contracts/src');
		walk('packages/rph-application/src/handlers');
		for (const path of [
			'package.json',
			'bun.lock',
			'package-lock.json',
			'pnpm-lock.yaml',
			'yarn.lock'
		])
			if (existsSync(join(root, path))) addFile(path);
		const subject = frozenSubject({ add: entries });
		const artifactSet = complete(subject);
		expect(artifactSet.coverage.executorSourceArtifacts).toBe(1);
		expect(artifactSet.coverage.executorTestArtifacts).toBe(2);
		expect(artifactSet.coverage.baselineArtifacts).toBe(1);
		expect(artifactSet.coverage.handlerSourceArtifacts).toBeGreaterThan(0);
		expect(artifactSet.coverage.packageSourceArtifacts).toBeGreaterThan(0);
		expect(validateArrowCommandCensusArtifactSet(artifactSet, subject).state).toBe('VALID');
		expect(dirname(join(root, 'package.json'))).toBe(root.replace(/[\\/]$/u, ''));
	});
});
