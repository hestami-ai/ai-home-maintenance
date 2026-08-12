import { describe, expect, it } from 'vitest';

import {
	DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
	DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
	DEPENDENCY_CRUISER_PROVIDER_ID,
	DEPENDENCY_CRUISER_PROVIDER_VERSION,
	DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
	type DependencyCruiserInvocationBinding,
	type DependencyCruiserObservation
} from '../../contracts/dependency-cruiser.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import {
	dependencyCruiserObservationContentDigest,
	normalizeDependencyCruiserOutput,
	validateDependencyCruiserObservation
} from './normalize-output.js';

type MutableRecord = Record<string, unknown>;

function dependency(
	module: string,
	resolved: string,
	types: readonly string[],
	overrides: MutableRecord = {}
): MutableRecord {
	return {
		circular: false,
		coreModule: false,
		couldNotResolve: false,
		dependencyTypes: types,
		dynamic: false,
		exoticallyRequired: false,
		followable: true,
		module,
		moduleSystem: 'es6',
		resolved,
		valid: true,
		...overrides
	};
}

function validRaw(): MutableRecord {
	return {
		modules: [
			{
				dependencies: [
					dependency('./b.js', 'src/b.ts', ['import', 'local'], { typeOnly: false }),
					dependency('node:fs', 'fs', ['core', 'import'], {
						coreModule: true,
						followable: false,
						protocol: 'node:'
					}),
					dependency('pkg', 'node_modules/pkg/index.js', ['import', 'npm'], {
						followable: false
					}),
					dependency('missing-pkg', 'missing-pkg', ['import', 'unknown'], {
						couldNotResolve: true,
						followable: false
					})
				],
				dependents: [],
				source: 'src/a.ts',
				valid: true
			},
			{
				dependencies: [],
				dependents: ['src/a.ts'],
				source: 'src/b.ts',
				valid: true
			},
			{
				coreModule: true,
				couldNotResolve: false,
				dependencies: [],
				dependencyTypes: ['core', 'import'],
				dependents: ['src/a.ts'],
				followable: false,
				source: 'fs',
				valid: true
			},
			{
				couldNotResolve: false,
				dependencies: [],
				dependencyTypes: ['import', 'npm'],
				dependents: ['src/a.ts'],
				followable: false,
				source: 'node_modules/pkg/index.js',
				valid: true
			},
			{
				couldNotResolve: true,
				dependencies: [],
				dependencyTypes: ['import', 'unknown'],
				dependents: ['src/a.ts'],
				followable: false,
				source: 'missing-pkg',
				valid: true
			}
		],
		summary: {
			error: 0,
			ignore: 0,
			info: 0,
			optionsUsed: { args: 'src', baseDir: 'C:\\bound-only-by-digest', outputType: 'json' },
			totalCruised: 5,
			totalDependenciesCruised: 4,
			violations: [],
			warn: 0
		}
	};
}

function evidenceRichRaw(): MutableRecord {
	const raw = validRaw();
	const modules = raw.modules as MutableRecord[];
	const localModule = modules[0]!;
	Object.assign(localModule, {
		checksum: 'module-checksum',
		instability: 0.25,
		license: 'MIT',
		matchesDoNotFollow: true,
		rules: [
			{ name: 'module-z', severity: 'warn' },
			{ name: 'module-a', severity: 'info' }
		],
		valid: false
	});
	const localDependency = (localModule.dependencies as MutableRecord[])[0]!;
	Object.assign(localDependency, {
		circular: true,
		cycle: [{ dependencyTypes: ['local', 'import'], name: 'src/b.ts' }],
		exoticRequire: 'custom-loader',
		instability: 0.5,
		license: 'MIT',
		matchesDoNotFollow: true,
		mimeType: 'text/typescript',
		preCompilationOnly: true,
		rules: [{ name: 'no-local-dependency', severity: 'error' }],
		valid: false
	});
	const summary = raw.summary as MutableRecord;
	summary.ruleSetUsed = { allowedSeverity: 'warn' };
	summary.violations = [
		{
			comment: 'bounded fixture',
			cycle: [{ dependencyTypes: ['local'], name: 'src/b.ts' }],
			from: 'src/a.ts',
			metrics: { from: { instability: 0.5 }, to: { instability: 0.25 } },
			rule: { name: 'no-local-dependency', severity: 'warn' },
			to: 'src/b.ts',
			type: 'dependency',
			via: [{ dependencyTypes: ['import', 'local'], name: 'src/b.ts' }]
		}
	];
	summary.warn = 1;
	return raw;
}

function binding(rawText: string): DependencyCruiserInvocationBinding {
	const parsed = JSON.parse(rawText) as {
		summary?: { optionsUsed?: { baseDir?: unknown } };
	};
	const providerBaseDir = parsed.summary?.optionsUsed?.baseDir;
	const providerBaseDirText = typeof providerBaseDir === 'string' ? providerBaseDir : null;
	const subjectRootText = providerBaseDirText ?? 'C:\\bound-subject-root';
	return {
		argvGrammarVersion: DEPENDENCY_CRUISER_ARGV_GRAMMAR_VERSION,
		baseDir: '.',
		budgets: {
			maxCommandArgs: 100,
			maxDependencies: 100,
			maxDependents: 100,
			maxIssues: 100,
			maxJsonDepth: 20,
			maxInputPaths: 100,
			maxModules: 100,
			maxPathLength: 1_000,
			maxRawBytes: 1_000_000,
			maxRules: 100,
			maxStringLength: 10_000,
			maxSummaryViolations: 100,
			maxTotalStringCharacters: 1_000_000
		},
		command: {
			args: ['src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
			exitStatus: 0,
			finishedAt: '2026-08-11T12:00:01-04:00',
			startedAt: '2026-08-11T12:00:00-04:00'
		},
		config: { path: '.dependency-cruiser.cjs', sha256: '1'.repeat(64) },
		inputPaths: ['src'],
		provider: {
			id: DEPENDENCY_CRUISER_PROVIDER_ID,
			version: DEPENDENCY_CRUISER_PROVIDER_VERSION
		},
		providerReportedBaseDir:
			providerBaseDirText !== null
				? {
						bytes: Buffer.byteLength(providerBaseDirText, 'utf8'),
						representation:
							providerBaseDirText.startsWith('/') ||
							providerBaseDirText.startsWith('\\\\') ||
							/^[A-Za-z]:[\\/]/u.test(providerBaseDirText)
								? 'ABSOLUTE'
								: 'CANONICAL_RELATIVE',
						sha256: sha256(providerBaseDirText),
						state: 'PRESENT'
					}
				: { state: 'ABSENT' },
		raw: { bytes: Buffer.byteLength(rawText, 'utf8'), sha256: sha256(rawText) },
		rawSchemaId: DEPENDENCY_CRUISER_RAW_SCHEMA_ID,
		schemaVersion: DEPENDENCY_CRUISER_INVOCATION_SCHEMA_VERSION,
		subjectRoot: {
			bytes: Buffer.byteLength(subjectRootText, 'utf8'),
			sha256: sha256(subjectRootText)
		},
		subjectId: '2'.repeat(64)
	};
}

function normalize(raw: MutableRecord = validRaw()): DependencyCruiserObservation {
	const rawText = JSON.stringify(raw);
	const outcome = normalizeDependencyCruiserOutput(rawText, binding(rawText));
	expect(outcome.outcome, JSON.stringify(outcome.diagnostics)).toBe('complete');
	if (outcome.outcome !== 'complete') throw new Error('Expected complete observation.');
	return outcome.observation;
}

function clone<T>(value: T): T {
	return JSON.parse(canonicalSemanticJson(value)) as T;
}

function expectNormalizationDiagnostic(
	raw: MutableRecord,
	code: string,
	path?: string,
	mutateBinding?: (value: DependencyCruiserInvocationBinding) => void
): void {
	const rawText = JSON.stringify(raw);
	const invocation = binding(rawText);
	mutateBinding?.(invocation);
	const outcome = normalizeDependencyCruiserOutput(rawText, invocation);
	expect(outcome).toMatchObject({ diagnostics: [{ code }], outcome: 'unavailable' });
	if (path !== undefined) expect(outcome.diagnostics[0]?.path).toBe(path);
}

describe('dependency-cruiser output normalization', () => {
	it('normalizes local, core, external, and unresolved aggregated observations', () => {
		const observation = normalize();

		expect(observation.health).toBe('PARTIAL');
		expect(observation.limitations.map((entry) => entry.code)).toEqual([
			'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY'
		]);
		expect(observation.modules.map((module) => module.sourcePath)).toEqual([
			'src/a.ts',
			'src/b.ts'
		]);
		expect(observation.dependencies).toHaveLength(4);
		expect(observation.dependencies.map((item) => item.target.kind).sort()).toEqual([
			'CORE_MODULE',
			'EXTERNAL_MODULE',
			'RESOLVED_LOCAL_PATH',
			'UNRESOLVED'
		]);
		expect(
			observation.dependencies.find((item) => item.target.kind === 'RESOLVED_LOCAL_PATH')
		).toMatchObject({
			dependencyTypes: ['import', 'local'],
			preCompilationOnly: 'UNSPECIFIED',
			typeOnly: false
		});
		expect(observation.nonLocalModules).toHaveLength(3);
		expect(observation.reverseLinks).toHaveLength(4);
		expect(validateDependencyCruiserObservation(observation)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('normalizes native rules and optional dependency-cruiser evidence without semantic overclaim', () => {
		const observation = normalize(evidenceRichRaw());
		const localModule = observation.modules.find((module) => module.sourcePath === 'src/a.ts');
		const localDependency = observation.dependencies.find(
			(item) => item.target.kind === 'RESOLVED_LOCAL_PATH'
		);

		expect(localModule).toMatchObject({
			matchesDoNotFollow: true,
			rules: [
				{ ruleId: 'module-a', severity: 'info' },
				{ ruleId: 'module-z', severity: 'warn' }
			],
			valid: false
		});
		expect(localDependency).toMatchObject({
			circular: true,
			exoticRequire: 'custom-loader',
			instability: 0.5,
			matchesDoNotFollow: true,
			mimeType: 'text/typescript',
			preCompilationOnly: true,
			rules: [{ ruleId: 'no-local-dependency', severity: 'error' }],
			valid: false
		});
		expect(observation.limitations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED',
					fields: ['checksum', 'instability', 'license']
				}),
				expect.objectContaining({
					code: 'DEPENDENCY_OPTIONAL_FIELDS_NOT_INTERPRETED',
					fields: ['cycle', 'license']
				}),
				expect.objectContaining({
					code: 'SUMMARY_VIOLATIONS_DIGEST_ONLY',
					fields: ['summary.violations']
				})
			])
		);
		expect(observation.summary).toMatchObject({
			rulesDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
			violationsCount: 1,
			warn: 1
		});
		expect(validateDependencyCruiserObservation(observation)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('is deterministic for the same exact provider bytes and invocation', () => {
		const first = normalize();
		const second = normalize();

		expect(canonicalSemanticJson(second)).toBe(canonicalSemanticJson(first));
		expect(second.contentDigest).toBe(dependencyCruiserObservationContentDigest(second));
	});

	it('accepts absent dependents as an explicit non-witness', () => {
		const raw = validRaw();
		for (const module of raw.modules as MutableRecord[]) delete module.dependents;
		const observation = normalize(raw);

		expect(observation.modules.every((module) => module.dependentsWitness === 'ABSENT')).toBe(true);
		expect(
			observation.nonLocalModules.every((module) => module.dependentsWitness === 'ABSENT')
		).toBe(true);
	});

	it('preserves legitimate provider rows that share a target but have distinct provider identities', () => {
		const raw = validRaw();
		const dependencies = (raw.modules as MutableRecord[])[0]!.dependencies as MutableRecord[];
		dependencies.push(
			dependency('./b.ts', 'src/b.ts', ['import', 'local', 'type-only'], { typeOnly: true })
		);
		(raw.summary as MutableRecord).totalDependenciesCruised = 5;
		const observation = normalize(raw);
		const sharedTarget = observation.dependencies.filter(
			(item) => item.target.kind === 'RESOLVED_LOCAL_PATH' && item.target.path === 'src/b.ts'
		);

		expect(sharedTarget).toHaveLength(2);
		expect(new Set(sharedTarget.map((item) => item.id)).size).toBe(2);
		expect(sharedTarget.map((item) => item.typeOnlyPartition).sort()).toEqual([
			'TYPE_ONLY',
			'VALUE_OR_MIXED'
		]);
		expect(
			observation.reverseLinks.find(
				(link) => link.target.kind === 'RESOLVED_LOCAL_PATH' && link.target.path === 'src/b.ts'
			)?.dependencyIds
		).toHaveLength(2);
	});

	it('preserves an absent optional provider ignore count as unknown rather than inventing zero', () => {
		const raw = validRaw();
		delete (raw.summary as MutableRecord).ignore;

		expect(normalize(raw).summary.ignore).toBeNull();
	});

	it('verifies an exact canonical relative provider base while retaining unresolved option semantics', () => {
		const raw = validRaw();
		((raw.summary as MutableRecord).optionsUsed as MutableRecord).baseDir = '.';
		const observation = normalize(raw);

		expect(observation.limitations.map((entry) => entry.code)).toEqual([
			'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY'
		]);
		expect(observation.health).toBe('PARTIAL');
	});

	it('projects a proven non-root canonical provider base into repository-relative paths', () => {
		const raw = validRaw();
		((raw.summary as MutableRecord).optionsUsed as MutableRecord).baseDir = 'packages/demo';
		const rawText = JSON.stringify(raw);
		const invocation = binding(rawText);
		(invocation as unknown as MutableRecord).baseDir = 'packages/demo';
		const outcome = normalizeDependencyCruiserOutput(rawText, invocation);

		expect(outcome.outcome).toBe('complete');
		if (outcome.outcome !== 'complete') throw new Error(JSON.stringify(outcome));
		expect(outcome.observation.modules.map((module) => module.sourcePath)).toEqual([
			'packages/demo/src/a.ts',
			'packages/demo/src/b.ts'
		]);
		expect(
			outcome.observation.dependencies.find((item) => item.target.kind === 'RESOLVED_LOCAL_PATH')
				?.target
		).toEqual({ kind: 'RESOLVED_LOCAL_PATH', path: 'packages/demo/src/b.ts' });
		expect(validateDependencyCruiserObservation(outcome.observation).state).toBe('VALID');
	});

	it('fails unavailable before path projection when provider base mappings are unproven', () => {
		const absent = validRaw();
		delete ((absent.summary as MutableRecord).optionsUsed as MutableRecord).baseDir;
		let rawText = JSON.stringify(absent);
		expect(normalizeDependencyCruiserOutput(rawText, binding(rawText))).toMatchObject({
			diagnostics: [{ code: 'PROVIDER_BASE_DIR_MAPPING_UNPROVEN' }],
			outcome: 'unavailable'
		});

		const unequal = validRaw();
		((unequal.summary as MutableRecord).optionsUsed as MutableRecord).baseDir = 'provider-root';
		rawText = JSON.stringify(unequal);
		expect(normalizeDependencyCruiserOutput(rawText, binding(rawText))).toMatchObject({
			diagnostics: [{ code: 'PROVIDER_BASE_DIR_MAPPING_UNPROVEN' }],
			outcome: 'unavailable'
		});

		const absolute = validRaw();
		rawText = JSON.stringify(absolute);
		const wrongSubjectRoot = binding(rawText);
		(wrongSubjectRoot.subjectRoot as unknown as MutableRecord).sha256 = 'f'.repeat(64);
		expect(normalizeDependencyCruiserOutput(rawText, wrongSubjectRoot)).toMatchObject({
			diagnostics: [{ code: 'PROVIDER_BASE_DIR_MAPPING_UNPROVEN' }],
			outcome: 'unavailable'
		});
	});

	it('fails closed when provider base-directory text disagrees with its digest binding', () => {
		const rawText = JSON.stringify(validRaw());
		const invocation = binding(rawText);
		if (invocation.providerReportedBaseDir.state !== 'PRESENT')
			throw new Error('Expected a present provider base-directory binding.');
		(invocation.providerReportedBaseDir as unknown as MutableRecord).sha256 = '0'.repeat(64);

		expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
			diagnostics: [{ code: 'PROVIDER_BASE_DIR_MISMATCH' }],
			outcome: 'unavailable'
		});
	});

	it('rejects provider base absence, representation, and control-text mismatches', () => {
		const absent = validRaw();
		delete ((absent.summary as MutableRecord).optionsUsed as MutableRecord).baseDir;
		expectNormalizationDiagnostic(
			absent,
			'PROVIDER_BASE_DIR_MISMATCH',
			'$raw.summary.optionsUsed.baseDir',
			(invocation) => {
				(invocation as unknown as MutableRecord).providerReportedBaseDir = {
					bytes: 1,
					representation: 'CANONICAL_RELATIVE',
					sha256: sha256('.'),
					state: 'PRESENT'
				};
			}
		);

		expectNormalizationDiagnostic(
			validRaw(),
			'PROVIDER_BASE_DIR_MISMATCH',
			'$raw.summary.optionsUsed.baseDir',
			(invocation) => {
				if (invocation.providerReportedBaseDir.state !== 'PRESENT')
					throw new Error('Expected a present provider base-directory binding.');
				(invocation.providerReportedBaseDir as unknown as MutableRecord).representation =
					'CANONICAL_RELATIVE';
			}
		);

		const controlText = validRaw();
		((controlText.summary as MutableRecord).optionsUsed as MutableRecord).baseDir =
			'provider\nroot';
		expectNormalizationDiagnostic(
			controlText,
			'RAW_SHAPE_INVALID',
			'$raw.summary.optionsUsed.baseDir'
		);
	});

	it('retains known optional root fields only by digest and declared limitations', () => {
		const raw = validRaw();
		raw.folders = [];
		raw.revisionData = { SHA1: 'abc', changes: [] };
		const observation = normalize(raw);

		expect(observation.health).toBe('PARTIAL');
		expect(observation.limitations.map((entry) => entry.code)).toEqual([
			'FOLDERS_NOT_INTERPRETED',
			'PROVIDER_RESOLUTION_OPTIONS_DIGEST_ONLY',
			'REVISION_DATA_NOT_INTERPRETED'
		]);
	});

	it('fails closed on duplicate modules and normalized dependency keys', () => {
		const duplicateModule = validRaw();
		(duplicateModule.modules as MutableRecord[]).push(
			clone((duplicateModule.modules as MutableRecord[])[0]!)
		);
		let text = JSON.stringify(duplicateModule);
		let outcome = normalizeDependencyCruiserOutput(text, binding(text));
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'DUPLICATE_MODULE' }],
			outcome: 'unavailable'
		});

		const duplicateDependency = validRaw();
		const dependencies = (duplicateDependency.modules as MutableRecord[])[0]!
			.dependencies as MutableRecord[];
		dependencies.push(clone(dependencies[0]!));
		(duplicateDependency.summary as MutableRecord).totalDependenciesCruised = 5;
		text = JSON.stringify(duplicateDependency);
		outcome = normalizeDependencyCruiserOutput(text, binding(text));
		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'DUPLICATE_DEPENDENCY' }],
			outcome: 'unavailable'
		});
	});

	it('rejects schema-valid provider rows whose normalized semantics contradict', () => {
		const cases: Array<{
			code: string;
			mutate: (raw: MutableRecord) => void;
			path: string;
		}> = [
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					const first = ((raw.modules as MutableRecord[])[0]!.dependencies as MutableRecord[])[0]!;
					(first.dependencyTypes as string[]).push('import');
				},
				path: '$raw.modules[0].dependencies[0].dependencyTypes[2]'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					const first = ((raw.modules as MutableRecord[])[0]!.dependencies as MutableRecord[])[0]!;
					first.rules = [
						{ name: 'duplicate-rule', severity: 'warn' },
						{ name: 'duplicate-rule', severity: 'warn' }
					];
					first.valid = false;
				},
				path: '$raw.modules[0].dependencies[0].rules'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					const first = ((raw.modules as MutableRecord[])[0]!.dependencies as MutableRecord[])[0]!;
					first.rules = [{ name: 'reported-violation', severity: 'error' }];
				},
				path: '$raw.modules[0].dependencies[0].valid'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					const first = ((raw.modules as MutableRecord[])[0]!.dependencies as MutableRecord[])[0]!;
					first.rules = [{ name: '', severity: 'warn' }];
					first.valid = false;
				},
				path: '$raw.modules[0].dependencies[0].rules[0].name'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					Object.assign((raw.modules as MutableRecord[])[4]!, { coreModule: true });
				},
				path: '$raw.modules[4]'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					const unresolved = (
						(raw.modules as MutableRecord[])[0]!.dependencies as MutableRecord[]
					)[3]!;
					unresolved.coreModule = true;
				},
				path: '$raw.modules[0].dependencies[3]'
			},
			{
				code: 'NONLOCAL_SOURCE_HAS_DEPENDENCIES',
				mutate: (raw) => {
					(raw.modules as MutableRecord[])[2]!.dependencies = [
						dependency('./b.js', 'src/b.ts', ['import', 'local'])
					];
				},
				path: '$raw.modules'
			},
			{
				code: 'DEPENDENTS_MISMATCH',
				mutate: (raw) => {
					(raw.modules as MutableRecord[])[1]!.dependents = ['fs'];
				},
				path: '$raw.modules[1].dependents[0]'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					(raw.summary as MutableRecord).totalCruised = 4;
				},
				path: '$raw.summary.totalCruised'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					(raw.summary as MutableRecord).totalDependenciesCruised = 3;
				},
				path: '$raw.summary.totalDependenciesCruised'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					(raw.summary as MutableRecord).violations = [
						{
							from: 'src/a.ts',
							rule: { name: 'warn-rule', severity: 'warn' },
							to: 'src/b.ts'
						}
					];
				},
				path: '$raw.summary.warn'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					(raw.summary as MutableRecord).ignore = 1;
				},
				path: '$raw.summary.ignore'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					(raw.summary as MutableRecord).ignore = -1;
				},
				path: '$raw.summary.ignore'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					(raw.summary as MutableRecord).totalDependenciesCruised = -1;
				},
				path: '$raw.summary.totalDependenciesCruised'
			},
			{
				code: 'RAW_SHAPE_INVALID',
				mutate: (raw) => {
					(raw.summary as MutableRecord).error = -1;
				},
				path: '$raw.summary.error'
			}
		];

		for (const testCase of cases) {
			const raw = validRaw();
			testCase.mutate(raw);
			expectNormalizationDiagnostic(raw, testCase.code, testCase.path);
		}
	});

	it('fails closed when the optional dependents witness disagrees', () => {
		const raw = validRaw();
		((raw.modules as MutableRecord[])[1]!.dependents as string[]).length = 0;
		const text = JSON.stringify(raw);

		expect(normalizeDependencyCruiserOutput(text, binding(text))).toMatchObject({
			diagnostics: [{ code: 'DEPENDENTS_MISMATCH' }],
			outcome: 'unavailable'
		});
	});

	it('rejects unsafe local paths before observation admission', () => {
		const raw = validRaw();
		(raw.modules as MutableRecord[])[0]!.source = 'C:\\private\\a.ts';
		const text = JSON.stringify(raw);

		expect(normalizeDependencyCruiserOutput(text, binding(text))).toMatchObject({
			diagnostics: [{ code: 'UNSAFE_PATH' }],
			outcome: 'unavailable'
		});
	});

	it('rejects malformed booleans and unknown dependency enums', () => {
		const raw = validRaw();
		const firstDependency = (
			(raw.modules as MutableRecord[])[0]!.dependencies as MutableRecord[]
		)[0]!;
		firstDependency.circular = 'false';
		firstDependency.moduleSystem = 'esm';
		const text = JSON.stringify(raw);

		expect(normalizeDependencyCruiserOutput(text, binding(text))).toMatchObject({
			diagnostics: [{ code: 'RAW_SHAPE_INVALID' }],
			outcome: 'unavailable'
		});
	});

	it('enforces the exact provider wire schema before digesting uninterpreted fields', () => {
		const raw = validRaw();
		((raw.summary as MutableRecord).optionsUsed as MutableRecord).unexpectedSecret =
			'should-not-appear-in-diagnostics';
		const text = JSON.stringify(raw);
		const outcome = normalizeDependencyCruiserOutput(text, binding(text));

		expect(outcome).toMatchObject({
			diagnostics: [{ code: 'RAW_SHAPE_INVALID' }],
			outcome: 'unavailable'
		});
		expect(JSON.stringify(outcome)).not.toContain('should-not-appear-in-diagnostics');
	});

	it('enforces byte, population, string, and path budgets from the binding', () => {
		const rawText = JSON.stringify(validRaw());
		const cases: Array<(value: DependencyCruiserInvocationBinding) => void> = [
			(value) => ((value.budgets as unknown as MutableRecord).maxRawBytes = 1),
			(value) => ((value.budgets as unknown as MutableRecord).maxModules = 1),
			(value) => ((value.budgets as unknown as MutableRecord).maxStringLength = 3),
			(value) => ((value.budgets as unknown as MutableRecord).maxPathLength = 3)
		];
		for (const mutate of cases) {
			const invocation = clone(binding(rawText));
			mutate(invocation);
			expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
				diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
				outcome: 'unavailable'
			});
		}
	});

	it('enforces dependency, dependent, native-rule, and violation population budgets', () => {
		expectNormalizationDiagnostic(
			validRaw(),
			'BUDGET_EXCEEDED',
			'$raw.modules[*].dependencies',
			(invocation) => {
				(invocation.budgets as unknown as MutableRecord).maxDependencies = 1;
			}
		);
		expectNormalizationDiagnostic(
			validRaw(),
			'BUDGET_EXCEEDED',
			'$raw.modules[2].dependents',
			(invocation) => {
				(invocation.budgets as unknown as MutableRecord).maxDependents = 1;
			}
		);
		expectNormalizationDiagnostic(
			evidenceRichRaw(),
			'BUDGET_EXCEEDED',
			'$raw.modules[0].rules',
			(invocation) => {
				(invocation.budgets as unknown as MutableRecord).maxRules = 1;
			}
		);

		const tooManyViolations = evidenceRichRaw();
		const violations = (tooManyViolations.summary as MutableRecord).violations as MutableRecord[];
		violations.push(clone(violations[0]!));
		expectNormalizationDiagnostic(
			tooManyViolations,
			'BUDGET_EXCEEDED',
			'$raw.summary.violations',
			(invocation) => {
				(invocation.budgets as unknown as MutableRecord).maxSummaryViolations = 1;
			}
		);
	});

	it('binds the exact raw byte count and digest before parsing', () => {
		const rawText = JSON.stringify(validRaw());
		const invocation = binding(rawText);
		(invocation.raw as MutableRecord).sha256 = '0'.repeat(64);

		expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
			diagnostics: [{ code: 'IDENTITY_MISMATCH' }],
			outcome: 'unavailable'
		});
	});

	it('reports invalid but exactly bound provider JSON without attempting normalization', () => {
		const rawText = '{"modules":';
		const invocation = binding(JSON.stringify(validRaw()));
		(invocation.raw as unknown as MutableRecord).bytes = Buffer.byteLength(rawText, 'utf8');
		(invocation.raw as unknown as MutableRecord).sha256 = sha256(rawText);

		expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
			diagnostics: [{ code: 'JSON_PARSE_FAILED', path: '$rawText' }],
			outcome: 'unavailable'
		});

		const nonScalarText = '\ud800';
		const nonScalarInvocation = binding(JSON.stringify(validRaw()));
		(nonScalarInvocation.raw as unknown as MutableRecord).bytes = Buffer.byteLength(
			nonScalarText,
			'utf8'
		);
		(nonScalarInvocation.raw as unknown as MutableRecord).sha256 = sha256(nonScalarText);
		expect(normalizeDependencyCruiserOutput(nonScalarText, nonScalarInvocation)).toMatchObject({
			diagnostics: [{ code: 'RAW_SHAPE_INVALID', path: '$rawText' }],
			outcome: 'unavailable'
		});
	});

	it('rejects malformed invocation bindings at the exact public boundary', () => {
		const rawText = JSON.stringify(validRaw());
		expect(
			normalizeDependencyCruiserOutput(
				rawText,
				new Date() as unknown as DependencyCruiserInvocationBinding
			)
		).toMatchObject({
			diagnostics: [{ code: 'INVOCATION_INVALID', path: '$binding' }],
			outcome: 'unavailable'
		});

		const cases: Array<{
			mutate: (value: DependencyCruiserInvocationBinding) => void;
			path: string;
		}> = [
			{
				mutate: (value) => ((value as unknown as MutableRecord).unexpected = true),
				path: '$binding'
			},
			{
				mutate: (value) => ((value.provider as unknown as MutableRecord).id = 'another-provider'),
				path: '$binding'
			},
			{
				mutate: (value) => ((value as unknown as MutableRecord).providerReportedBaseDir = null),
				path: '$binding.providerReportedBaseDir'
			},
			{
				mutate: (value) => {
					if (value.providerReportedBaseDir.state !== 'PRESENT')
						throw new Error('Expected a present provider base-directory binding.');
					(value.providerReportedBaseDir as unknown as MutableRecord).bytes = -1;
				},
				path: '$binding.providerReportedBaseDir'
			},
			{
				mutate: (value) => ((value.subjectRoot as unknown as MutableRecord).bytes = -1),
				path: '$binding.subjectRoot'
			},
			{
				mutate: (value) => ((value as unknown as MutableRecord).budgets = null),
				path: '$binding.budgets'
			},
			{
				mutate: (value) => ((value.budgets as unknown as MutableRecord).maxModules = 0),
				path: '$binding.budgets'
			},
			{
				mutate: (value) => ((value.budgets as unknown as MutableRecord).maxIssues = 100_001),
				path: '$binding.budgets.maxIssues'
			},
			{
				mutate: (value) => ((value as unknown as MutableRecord).baseDir = 42),
				path: '$binding.baseDir'
			},
			{
				mutate: (value) => (value.inputPaths as unknown as unknown[]).splice(0),
				path: '$binding.inputPaths'
			},
			{
				mutate: (value) => (value.inputPaths as unknown as unknown[]).splice(0, 1, 42),
				path: '$binding.inputPaths[0]'
			},
			{
				mutate: (value) => (value.inputPaths as unknown as string[]).splice(0, 1, 'src', 'src'),
				path: '$binding.inputPaths'
			},
			{
				mutate: (value) => ((value.config as unknown as MutableRecord).sha256 = 'bad'),
				path: '$binding.config'
			},
			{
				mutate: (value) =>
					((value.command as unknown as MutableRecord).finishedAt = '2026-08-11T11:59:59-04:00'),
				path: '$binding.command'
			},
			{
				mutate: (value) => ((value.raw as unknown as MutableRecord).bytes = -1),
				path: '$binding.raw'
			}
		];

		for (const testCase of cases) {
			const invocation = clone(binding(rawText));
			testCase.mutate(invocation);
			expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
				diagnostics: [{ code: 'INVOCATION_INVALID', path: testCase.path }],
				outcome: 'unavailable'
			});
		}
	});

	it('rejects drive-qualified and escaping invocation base directories', () => {
		const rawText = JSON.stringify(validRaw());
		for (const unsafeBaseDir of ['C:relative', '../escape']) {
			const invocation = clone(binding(rawText));
			(invocation as unknown as MutableRecord).baseDir = unsafeBaseDir;
			expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
				diagnostics: [{ code: 'UNSAFE_PATH', path: '$binding.baseDir' }],
				outcome: 'unavailable'
			});
		}
	});

	it('admits only the closed versioned argv grammar with bound paths and the JSON reporter', () => {
		const rawText = JSON.stringify(validRaw());
		const invocation = binding(rawText);

		expect(invocation.command.args).toEqual([
			'src',
			'--config',
			'.dependency-cruiser.cjs',
			'--output-type',
			'json'
		]);
		expect(normalizeDependencyCruiserOutput(rawText, invocation).outcome).toBe('complete');

		const invalidArgv = [
			[],
			['src', '--output-type', 'json'],
			['src', 'src', '--config', '.dependency-cruiser.cjs', '--output-type', 'json'],
			['src', '--config', '.dependency-cruiser.cjs', '--output-type', 'text'],
			['--config', '.dependency-cruiser.cjs', 'src', '--output-type', 'json']
		];
		for (const args of invalidArgv) {
			const malformed = clone(binding(rawText));
			(malformed.command.args as unknown as string[]).splice(
				0,
				malformed.command.args.length,
				...args
			);
			expect(normalizeDependencyCruiserOutput(rawText, malformed)).toMatchObject({
				diagnostics: [{ code: 'INVOCATION_INVALID' }],
				outcome: 'unavailable'
			});
		}
	});

	it('bounds command argument and input-path populations and aggregate characters', () => {
		const rawText = JSON.stringify(validRaw());
		const tooManyArguments = clone(binding(rawText));
		(tooManyArguments.budgets as unknown as MutableRecord).maxCommandArgs = 1;
		expect(normalizeDependencyCruiserOutput(rawText, tooManyArguments)).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});

		const tooManyInputs = clone(binding(rawText));
		(tooManyInputs.budgets as unknown as MutableRecord).maxInputPaths = 1;
		(tooManyInputs.inputPaths as unknown as string[]).splice(0, 1, 'other', 'src');
		expect(normalizeDependencyCruiserOutput(rawText, tooManyInputs)).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});

		const tooManyCharacters = clone(binding(rawText));
		(tooManyCharacters.budgets as unknown as MutableRecord).maxTotalStringCharacters = 10;
		expect(normalizeDependencyCruiserOutput(rawText, tooManyCharacters)).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});

		const longInput = clone(binding(rawText));
		(longInput.budgets as unknown as MutableRecord).maxStringLength = 4;
		(longInput.inputPaths as unknown as string[]).splice(0, 1, 'long-input');
		expect(normalizeDependencyCruiserOutput(rawText, longInput)).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});

		const aggregateInputs = clone(binding(rawText));
		(aggregateInputs.budgets as unknown as MutableRecord).maxTotalStringCharacters = 8;
		(aggregateInputs.inputPaths as unknown as string[]).splice(0, 1, 'alpha', 'beta');
		expect(normalizeDependencyCruiserOutput(rawText, aggregateInputs)).toMatchObject({
			diagnostics: [{ code: 'BUDGET_EXCEEDED' }],
			outcome: 'unavailable'
		});
	});

	it('rejects absolute, UNC, control, non-scalar, and unbound secret-bearing command values', () => {
		const rawText = JSON.stringify(validRaw());
		const hostileArguments = [
			'/tmp/private.json',
			'C:\\Users\\private\\config.cjs',
			'C:private-config.cjs',
			'\\\\server\\share\\config.cjs',
			'--config\nsecret',
			'--sk-live-secret',
			'\ud800',
			'sk-live-not-a-logical-argument'
		];
		for (const argument of hostileArguments) {
			const invocation = clone(binding(rawText));
			(invocation.command.args as unknown as string[]).push(argument);
			expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
				diagnostics: [{ code: 'INVOCATION_INVALID' }],
				outcome: 'unavailable'
			});
		}
	});

	it('rejects control-bearing logical input paths before persisting the binding', () => {
		const rawText = JSON.stringify(validRaw());
		const invocation = clone(binding(rawText));
		(invocation.inputPaths as unknown as string[]).splice(0, 1, 'src\nprivate');

		expect(normalizeDependencyCruiserOutput(rawText, invocation)).toMatchObject({
			diagnostics: [{ code: 'UNSAFE_PATH' }],
			outcome: 'unavailable'
		});
	});

	it('rejects forged identities, content, and reverse reconciliation with bounded diagnostics', () => {
		const forgedIdentity = clone(normalize());
		(forgedIdentity as unknown as MutableRecord).id = 'depcruise-observation-forged';
		expect(validateDependencyCruiserObservation(forgedIdentity, { maxIssues: 1 })).toMatchObject({
			issues: [{ code: 'IDENTITY_MISMATCH' }],
			state: 'BUDGET_EXHAUSTED'
		});

		const forgedReverse = clone(normalize());
		(forgedReverse.reverseLinks as unknown as unknown[]).pop();
		expect(validateDependencyCruiserObservation(forgedReverse)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({ code: 'RECONCILIATION_MISMATCH' })
			]),
			state: 'INVALID'
		});

		const forgedDigest = clone(normalize());
		(forgedDigest as unknown as MutableRecord).contentDigest = '0'.repeat(64);
		expect(validateDependencyCruiserObservation(forgedDigest)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({ code: 'CONTENT_DIGEST_MISMATCH' })
			]),
			state: 'INVALID'
		});
	});

	it('validates canonical rule, dependency-type, target, invocation, and option boundaries', () => {
		const baseline = normalize(evidenceRichRaw());
		expect(validateDependencyCruiserObservation(baseline, { maxIssues: 0 })).toMatchObject({
			issues: [{ code: 'INVALID_VALUE', path: '$validationOptions.maxIssues' }],
			state: 'INVALID'
		});

		const noncanonicalRules = clone(baseline);
		const moduleWithRules = noncanonicalRules.modules.find((module) => module.rules.length > 1)!;
		(moduleWithRules.rules as unknown as unknown[]).reverse();
		expect(validateDependencyCruiserObservation(noncanonicalRules)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'NONCANONICAL_ORDER' })]),
			state: 'INVALID'
		});

		const malformedRules = clone(baseline);
		(
			malformedRules.modules.find((module) => module.rules.length > 0) as unknown as MutableRecord
		).rules = null;
		expect(validateDependencyCruiserObservation(malformedRules)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })]),
			state: 'INVALID'
		});

		const invalidRule = clone(baseline);
		const rule = invalidRule.modules.find((module) => module.rules.length > 0)!.rules[0]!;
		(rule as unknown as MutableRecord).severity = 'fatal';
		expect(validateDependencyCruiserObservation(invalidRule)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })]),
			state: 'INVALID'
		});

		const noncanonicalTypes = clone(baseline);
		(noncanonicalTypes.dependencies[0]!.dependencyTypes as unknown as unknown[]).reverse();
		expect(validateDependencyCruiserObservation(noncanonicalTypes)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'NONCANONICAL_ORDER' })]),
			state: 'INVALID'
		});

		const invalidInvocation = clone(baseline);
		(invalidInvocation.invocation.budgets as unknown as MutableRecord).maxIssues = 0;
		expect(validateDependencyCruiserObservation(invalidInvocation)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ path: '$.invocation' })]),
			state: 'INVALID'
		});

		const invalidTarget = clone(baseline);
		(invalidTarget.dependencies[0] as unknown as MutableRecord).target = { kind: 'UNKNOWN' };
		expect(validateDependencyCruiserObservation(invalidTarget)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })]),
			state: 'INVALID'
		});

		const missingTopLevelField = clone(baseline) as unknown as MutableRecord;
		delete missingTopLevelField.schemaVersion;
		expect(validateDependencyCruiserObservation(missingTopLevelField)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })]),
			state: 'INVALID'
		});

		const escapingPath = clone(baseline);
		(escapingPath.modules[0] as unknown as MutableRecord).sourcePath = '../escape';
		expect(validateDependencyCruiserObservation(escapingPath)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })]),
			state: 'INVALID'
		});

		const nondiscriminatedTarget = clone(baseline);
		(nondiscriminatedTarget.dependencies[0] as unknown as MutableRecord).target = null;
		expect(validateDependencyCruiserObservation(nondiscriminatedTarget)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })]),
			state: 'INVALID'
		});

		const incompleteRule = clone(baseline);
		const incomplete = incompleteRule.modules.find((module) => module.rules.length > 0)!.rules[0]!;
		delete (incomplete as unknown as MutableRecord).severity;
		expect(validateDependencyCruiserObservation(incompleteRule)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })]),
			state: 'INVALID'
		});

		const unknownDependencyType = clone(baseline);
		(unknownDependencyType.dependencies[0] as unknown as MutableRecord).dependencyTypes = [
			'not-a-dependency-type'
		];
		expect(validateDependencyCruiserObservation(unknownDependencyType)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })]),
			state: 'INVALID'
		});

		const incompleteInvocation = clone(baseline);
		delete (incompleteInvocation.invocation as unknown as MutableRecord).raw;
		expect(validateDependencyCruiserObservation(incompleteInvocation)).toMatchObject({
			issues: expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })]),
			state: 'INVALID'
		});
	});

	it('rejects forged observation identities, populations, ordering, summaries, and limitations', () => {
		const baseline = normalize();
		const evidenceBaseline = normalize(evidenceRichRaw());
		const cases: Array<{
			baseline?: 'evidence';
			code: string;
			mutate: (value: MutableRecord) => void;
			path: string;
		}> = [
			{
				code: 'UNSUPPORTED_SCHEMA_VERSION',
				mutate: (value) => (value.schemaVersion = 'dependency-cruiser-observation@999'),
				path: '$'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => (value.fullJanCsaa007Conformance = true),
				path: '$.fullJanCsaa007Conformance'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => (value.subjectId = 'not-a-digest'),
				path: '$.subjectId'
			},
			{
				code: 'IDENTITY_MISMATCH',
				mutate: (value) => (value.invocationDigest = '0'.repeat(64)),
				path: '$.invocationDigest'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => (value.invocationDigest = 'not-a-digest'),
				path: '$.invocationDigest'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => (value.modules = null),
				path: '$.modules'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => {
					((value.modules as MutableRecord[])[0] as MutableRecord).followable = null;
				},
				path: '$.modules[0]'
			},
			{
				code: 'POPULATION_MISMATCH',
				mutate: (value) => {
					const modules = value.modules as MutableRecord[];
					modules.push(clone(modules[0]!));
				},
				path: '$.modules[2]'
			},
			{
				code: 'NONCANONICAL_ORDER',
				mutate: (value) => (value.modules as unknown[]).reverse(),
				path: '$.modules'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => (value.nonLocalModules = null),
				path: '$.nonLocalModules'
			},
			{
				code: 'POPULATION_MISMATCH',
				mutate: (value) => {
					const modules = value.nonLocalModules as MutableRecord[];
					modules.push(clone(modules[0]!));
				},
				path: '$.nonLocalModules[3]'
			},
			{
				code: 'IDENTITY_MISMATCH',
				mutate: (value) => {
					((value.nonLocalModules as MutableRecord[])[0] as MutableRecord).id = 'forged';
				},
				path: '$.nonLocalModules[0].id'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => {
					((value.nonLocalModules as MutableRecord[])[0] as MutableRecord).providerSource = '';
				},
				path: '$.nonLocalModules[0]'
			},
			{
				code: 'NONCANONICAL_ORDER',
				mutate: (value) => (value.nonLocalModules as unknown[]).reverse(),
				path: '$.nonLocalModules'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => (value.dependencies = null),
				path: '$.dependencies'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => {
					((value.dependencies as MutableRecord[])[0] as MutableRecord).valid = false;
				},
				path: '$.dependencies[0]'
			},
			{
				code: 'RECONCILIATION_MISMATCH',
				mutate: (value) => {
					((value.dependencies as MutableRecord[])[0] as MutableRecord).typeOnlyPartition =
						'TYPE_ONLY';
				},
				path: '$.dependencies[0].typeOnlyPartition'
			},
			{
				code: 'POPULATION_MISMATCH',
				mutate: (value) => {
					const dependencies = value.dependencies as MutableRecord[];
					dependencies.push(clone(dependencies[0]!));
				},
				path: '$.dependencies[4]'
			},
			{
				code: 'IDENTITY_MISMATCH',
				mutate: (value) => {
					((value.dependencies as MutableRecord[])[0] as MutableRecord).id = 'forged';
				},
				path: '$.dependencies[0].id'
			},
			{
				code: 'NONCANONICAL_ORDER',
				mutate: (value) => (value.dependencies as unknown[]).reverse(),
				path: '$.dependencies'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ((value.summary as MutableRecord).dependencyCount = -1),
				path: '$.summary.dependencyCount'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ((value.summary as MutableRecord).ignore = -1),
				path: '$.summary.ignore'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ((value.summary as MutableRecord).providerTotalDependenciesCruised = -1),
				path: '$.summary.providerTotalDependenciesCruised'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => ((value.summary as MutableRecord).optionsDigest = 'not-a-digest'),
				path: '$.summary.optionsDigest'
			},
			{
				baseline: 'evidence',
				code: 'INVALID_VALUE',
				mutate: (value) => ((value.summary as MutableRecord).rulesDigest = 'not-a-digest'),
				path: '$.summary.rulesDigest'
			},
			{
				code: 'INVALID_SHAPE',
				mutate: (value) => (value.limitations = null),
				path: '$.limitations'
			},
			{
				code: 'POPULATION_MISMATCH',
				mutate: (value) => {
					const limitations = value.limitations as MutableRecord[];
					limitations.push(clone(limitations[0]!));
				},
				path: '$.limitations[1].code'
			},
			{
				baseline: 'evidence',
				code: 'NONCANONICAL_ORDER',
				mutate: (value) => (value.limitations as unknown[]).reverse(),
				path: '$.limitations'
			},
			{
				code: 'RECONCILIATION_MISMATCH',
				mutate: (value) => {
					const invocation = value.invocation as MutableRecord;
					const reported = invocation.providerReportedBaseDir as MutableRecord;
					reported.bytes = 0;
					reported.sha256 = '0'.repeat(64);
				},
				path: '$.invocation'
			},
			{
				code: 'RECONCILIATION_MISMATCH',
				mutate: (value) => (value.health = 'COMPLETE'),
				path: '$.health'
			},
			{
				code: 'INVALID_VALUE',
				mutate: (value) => (value.contentDigest = 'not-a-digest'),
				path: '$.contentDigest'
			}
		];

		for (const testCase of cases) {
			const forged = clone(testCase.baseline === 'evidence' ? evidenceBaseline : baseline);
			testCase.mutate(forged as unknown as MutableRecord);
			expect(validateDependencyCruiserObservation(forged)).toMatchObject({
				issues: expect.arrayContaining([
					expect.objectContaining({ code: testCase.code, path: testCase.path })
				]),
				state: 'INVALID'
			});
		}
	});

	it('is total over hostile population members, primitives, cycles, and duplicate invalid values', () => {
		const baseline = normalize();
		const mutations: Array<(value: MutableRecord) => void> = [
			(value) => (value.modules = [null, null]),
			(value) => (value.modules = [0, 'module']),
			(value) => (value.dependencies = [null, 1, null]),
			(value) => (value.nonLocalModules = [null, false, null]),
			(value) => (value.reverseLinks = [null, 0, null]),
			(value) => (value.limitations = [null, null]),
			(value) => {
				const cycle: unknown[] = [];
				cycle.push(cycle);
				value.reverseLinks = cycle;
			}
		];
		for (const mutate of mutations) {
			const hostile = clone(baseline) as unknown as MutableRecord;
			mutate(hostile);
			expect(() => validateDependencyCruiserObservation(hostile)).not.toThrow();
			expect(validateDependencyCruiserObservation(hostile).state).not.toBe('VALID');
		}
		expect(validateDependencyCruiserObservation(null).state).toBe('INVALID');

		const hostileProxy = new Proxy(
			{},
			{
				ownKeys: () => {
					throw new Error('hostile key enumeration');
				}
			}
		);
		expect(validateDependencyCruiserObservation(hostileProxy)).toMatchObject({
			issues: [{ code: 'INVALID_SHAPE', path: '$' }],
			state: 'INVALID'
		});
	});

	it('rejects oversized observations in preflight before identity sorting or canonicalization', () => {
		const baseline = normalize();
		const cases: Array<{
			mutate: (
				value: MutableRecord,
				budgets: DependencyCruiserInvocationBinding['budgets']
			) => void;
			path: string;
		}> = [
			{
				mutate: (value, budgets) => {
					value.modules = new Array(budgets.maxModules + 1).fill(null);
				},
				path: '$.modules'
			},
			{
				mutate: (value, budgets) => {
					value.dependencies = new Array(budgets.maxDependencies + 1).fill(null);
				},
				path: '$.dependencies'
			},
			{
				mutate: (value, budgets) => {
					value.reverseLinks = new Array(budgets.maxDependencies + 1).fill(null);
				},
				path: '$.reverseLinks'
			},
			{
				mutate: (value) => {
					value.limitations = new Array(7).fill(null);
				},
				path: '$.limitations'
			},
			{
				mutate: (value) => {
					const module = (value.modules as MutableRecord[])[0]!;
					module.dependencyTypes = new Array(100).fill('import');
				},
				path: '$.modules[*].dependencyTypes'
			},
			{
				mutate: (value, budgets) => {
					const module = (value.modules as MutableRecord[])[0]!;
					module.dependencyIds = new Array(budgets.maxDependencies + 1).fill('dependency-id');
				},
				path: '$.modules[*].dependencyIds'
			},
			{
				mutate: (value, budgets) => {
					const module = (value.modules as MutableRecord[])[0]!;
					module.dependentSourcePaths = new Array(budgets.maxDependents + 1).fill('src/a.ts');
				},
				path: '$.modules[*].dependentSourcePaths'
			},
			{
				mutate: (value, budgets) => {
					const module = (value.modules as MutableRecord[])[0]!;
					module.rules = new Array(budgets.maxRules + 1).fill(null);
				},
				path: '$.modules[*].rules'
			},
			{
				mutate: (value) => {
					const dependency = (value.dependencies as MutableRecord[])[0]!;
					dependency.dependencyTypes = new Array(100).fill('import');
				},
				path: '$.dependencies[*].dependencyTypes'
			},
			{
				mutate: (value, budgets) => {
					const dependency = (value.dependencies as MutableRecord[])[0]!;
					dependency.rules = new Array(budgets.maxRules + 1).fill(null);
				},
				path: '$.dependencies[*].rules'
			},
			{
				mutate: (value, budgets) => {
					const reverse = (value.reverseLinks as MutableRecord[])[0]!;
					reverse.dependencyIds = new Array(budgets.maxDependencies + 1).fill('dependency-id');
				},
				path: '$.reverseLinks[*].dependencyIds'
			},
			{
				mutate: (value, budgets) => {
					const reverse = (value.reverseLinks as MutableRecord[])[0]!;
					reverse.sourcePaths = new Array(budgets.maxDependents + 1).fill('src/a.ts');
				},
				path: '$.reverseLinks[*].sourcePaths'
			},
			{
				mutate: (value) => {
					const limitation = (value.limitations as MutableRecord[])[0]!;
					limitation.fields = new Array(65).fill('field');
				},
				path: '$.limitations[*].fields'
			},
			{
				mutate: (value, budgets) => {
					const limitation = (value.limitations as MutableRecord[])[0]!;
					limitation.reason = 'x'.repeat(budgets.maxStringLength + 1);
				},
				path: '$.limitations[0].reason'
			}
		];

		for (const testCase of cases) {
			const hostile = clone(baseline) as unknown as MutableRecord;
			testCase.mutate(hostile, baseline.invocation.budgets);

			expect(() => validateDependencyCruiserObservation(hostile)).not.toThrow();
			expect(validateDependencyCruiserObservation(hostile)).toMatchObject({
				issues: [{ code: 'POPULATION_MISMATCH', path: testCase.path }],
				state: 'INVALID'
			});
		}
	});

	it('bounds diagnostics for repeated hostile members without throwing', () => {
		const hostile = clone(normalize()) as unknown as MutableRecord;
		hostile.modules = [null, null, null, null];

		expect(() => validateDependencyCruiserObservation(hostile, { maxIssues: 1 })).not.toThrow();
		expect(validateDependencyCruiserObservation(hostile, { maxIssues: 1 })).toMatchObject({
			issues: [{ code: 'INVALID_SHAPE' }],
			state: 'BUDGET_EXHAUSTED'
		});
	});
});
