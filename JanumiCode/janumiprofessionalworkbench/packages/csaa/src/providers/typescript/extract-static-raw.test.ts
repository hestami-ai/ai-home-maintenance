import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { ProgramRecipe, ProjectSubjectRecord } from '../../contracts/subject.js';
import {
	TYPESCRIPT_PROVIDER_VERSION,
	type SemanticBudgets,
	type SemanticDiagnosticFamily
} from '../../contracts/semantic.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import { programRecipeDigest } from '../../semantic/ids.js';
import type { RawCompilerSourceBinding } from '../../semantic/raw-semantic-model.js';
import { createStaticSemanticOperationBudgetSession } from '../../semantic/static-semantic-operation-budget-session.js';
import {
	createStaticRawExtractionBudgetLedger,
	extractStaticRaw,
	finalizeStaticRawExtractionBudgetLedger,
	RAW_DIAGNOSTIC_FAMILIES,
	StaticRawExtractionError,
	takeStaticRawExtractionBudgetEvidence,
	type ExtractStaticRawInput,
	type StaticRawDiagnosticFamilyInput
} from './extract-static-raw.js';

const BUDGETS: SemanticBudgets = {
	maxAstDepth: 128,
	maxAstNodes: 10_000,
	maxCompilerInputMetadataBytes: 1_000_000,
	maxCompilerQueries: 10_000,
	maxCompilerFacts: 10_000,
	maxCompilerQueryInvocations: 100_000,
	maxContextBytes: 1_000_000,
	maxContextFileBytes: 1_000_000,
	maxContextFiles: 1_000,
	maxDiagnosticCharacters: 100_000,
	maxDiagnostics: 1_000,
	maxDirectoryEntries: 10_000,
	maxDurationMs: 10_000,
	maxLiteralCharacters: 1_000,
	maxPathCharacters: 1_000,
	maxProjects: 10,
	maxSnapshotBytes: 10_000_000,
	maxScopes: 10_000,
	maxSources: 1_000
};

const REPOSITORY_ROOT = '/repo';

function absolute(logicalPath: string): string {
	return `${REPOSITORY_ROOT}/${logicalPath}`;
}

function logical(path: string): string {
	const normalized = path.replaceAll('\\', '/');
	if (normalized === REPOSITORY_ROOT) return '.';
	if (!normalized.startsWith(`${REPOSITORY_ROOT}/`))
		throw new Error(`outside test repository: ${path}`);
	return normalized.slice(REPOSITORY_ROOT.length + 1);
}

function scriptKind(path: string): ts.ScriptKind {
	if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
	if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
	if (path.endsWith('.json')) return ts.ScriptKind.JSON;
	if (/\.(?:js|mjs|cjs)$/u.test(path)) return ts.ScriptKind.JS;
	return ts.ScriptKind.TS;
}

interface TestProgram {
	readonly files: ReadonlyMap<string, string>;
	readonly program: ts.Program;
}

function createTestProgram(
	filesValue: Readonly<Record<string, string>>,
	rootNames = Object.keys(filesValue),
	optionOverrides: ts.CompilerOptions = {}
): TestProgram {
	const files = new Map(
		Object.entries(filesValue).map(([path, text]) => [absolute(path), text] as const)
	);
	const options: ts.CompilerOptions = {
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Node10,
		noLib: true,
		noResolve: false,
		strict: true,
		target: ts.ScriptTarget.ES2022,
		...optionOverrides
	};
	const host: ts.CompilerHost = {
		directoryExists: (directoryName) =>
			directoryName === REPOSITORY_ROOT ||
			[...files.keys()].some((path) => path.startsWith(`${directoryName.replaceAll('\\', '/')}/`)),
		fileExists: (fileName) => files.has(fileName.replaceAll('\\', '/')),
		getCanonicalFileName: (fileName) => fileName,
		getCurrentDirectory: () => REPOSITORY_ROOT,
		getDefaultLibFileName: () => absolute('lib.d.ts'),
		getNewLine: () => '\n',
		getSourceFile: (fileName, languageVersion) => {
			const canonical = fileName.replaceAll('\\', '/');
			const text = files.get(canonical);
			return text === undefined
				? undefined
				: ts.createSourceFile(canonical, text, languageVersion, true, scriptKind(canonical));
		},
		readFile: (fileName) => files.get(fileName.replaceAll('\\', '/')),
		realpath: (path) => path.replaceAll('\\', '/'),
		useCaseSensitiveFileNames: () => true,
		writeFile: () => undefined
	};
	return {
		files: new Map(Object.entries(filesValue)),
		program: ts.createProgram({ host, options, rootNames: rootNames.map(absolute) })
	};
}

function recipe(rootNames: readonly string[], configPath = 'tsconfig.json'): ProgramRecipe {
	const base = {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			noLib: true,
			strict: true,
			target: ts.ScriptTarget.ES2022
		},
		configClosureDigest: '1'.repeat(64),
		configPath,
		kind: 'PROJECT' as const,
		projectReferences: [],
		provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
		rootNames: [...rootNames]
	};
	return { ...base, projectResolutionDigest: programRecipeDigest(base) };
}

function project(
	programRecipe: ProgramRecipe,
	overrides: Partial<ProjectSubjectRecord> = {}
): ProjectSubjectRecord {
	return {
		configClosure: [{ path: programRecipe.configPath, requiredBy: [], sha256: '1'.repeat(64) }],
		configPath: programRecipe.configPath,
		effectiveCompilerOptions: programRecipe.compilerOptions,
		fileNames: [...programRecipe.rootNames],
		frameworkCandidates: [],
		kind: programRecipe.kind,
		projectReferences: [...programRecipe.projectReferences],
		programRecipe,
		rawCompilerOptions: {},
		rawExclude: null,
		rawExtends: null,
		rawFiles: [...programRecipe.rootNames],
		rawInclude: null,
		rootDisposition: programRecipe.rootNames.length === 0 ? 'INCOMPLETE' : 'COMPILER_ROOTS',
		status: 'COMPLETE',
		typescriptDiagnostics: [],
		...overrides
	};
}

function frozenBinding(logicalPath: string, text: string): RawCompilerSourceBinding {
	return {
		artifact: {
			disposition: 'ANALYZED',
			primaryClass: 'PRODUCTION_SOURCE',
			roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION']
		},
		byteBudgetClass: 'FROZEN_SUBJECT',
		bytes: Buffer.byteLength(text, 'utf8'),
		contentSha256: sha256(text),
		logicalPath,
		mapping: { reason: 'Exact frozen-subject artifact match.', state: 'EXACT' },
		origin: 'AUTHORED',
		verificationState: 'VERIFIED_COMPILER_INPUT'
	};
}

function diagnosticFamilies(
	diagnostics: readonly ts.Diagnostic[] = [],
	family: SemanticDiagnosticFamily = 'SEMANTIC'
): readonly StaticRawDiagnosticFamilyInput[] {
	return RAW_DIAGNOSTIC_FAMILIES.map((candidate) => ({
		diagnostics: candidate === family ? diagnostics : [],
		family: candidate,
		reason: `${candidate} diagnostics completed.`,
		state: 'RUN'
	}));
}

function extractionInput(
	testProgram: TestProgram,
	rootNames: readonly string[],
	overrides: Partial<ExtractStaticRawInput> = {},
	bindings?: ReadonlyMap<string, RawCompilerSourceBinding>
): ExtractStaticRawInput {
	const programRecipe = recipe(rootNames);
	const sourceBindings =
		bindings ??
		new Map([...testProgram.files].map(([path, text]) => [path, frozenBinding(path, text)]));
	return {
		budgets: BUDGETS,
		checker: testProgram.program.getTypeChecker(),
		deadlineMs: Date.now() + BUDGETS.maxDurationMs,
		diagnosticFamilies: diagnosticFamilies(),
		program: testProgram.program,
		programRecipe,
		project: project(programRecipe),
		projectKey: programRecipe.configPath,
		resolveCheckerContextDigest: () => 'c'.repeat(64),
		resolveCompilerSource: (path) => sourceBindings.get(path),
		toLogicalPath: logical,
		...overrides
	};
}

function expectTypedFailure(action: () => unknown, code: StaticRawExtractionError['code']): void {
	try {
		action();
		throw new Error('Expected raw extraction to fail.');
	} catch (error) {
		expect(error).toBeInstanceOf(StaticRawExtractionError);
		expect((error as StaticRawExtractionError).code).toBe(code);
	}
}

describe('identity-free TypeScript raw extraction', () => {
	it('traverses ordinary AST plus unique JSDoc and projects exact roles, declarations, invocations, assignments, and literals', () => {
		const text = `
/** @typedef {object} Thing */
export declare class Example {
  static ["computed"] = 1;
  method(value = 2) {
    value += 3;
    value++;
    fn?.(value, \`head\${value}tail\`);
    new Example();
    tag\`a\${value}mid\${value}z\`;
  }
}
export const { item: renamed = "text" } = { item: "text" };
const values = [4n, true, false, null, /a+/u, \`plain\`];
`;
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts']));

		expect(raw.sources).toHaveLength(1);
		expect(raw.sources[0]).toMatchObject({
			analysisDisposition: 'DEEP_INDEXED',
			rootFile: true,
			rootNodeOrdinal: 0
		});
		expect(raw.astNodes[0]).toMatchObject({
			kind: ts.SyntaxKind.SourceFile,
			parentNodeOrdinal: null,
			structuralRoles: ['source-file']
		});
		expect(raw.astNodes.some((node) => node.kind === ts.SyntaxKind.JSDocComment)).toBe(true);
		expect(
			raw.astNodes
				.filter((node) => node.parentNodeOrdinal !== null)
				.every((node) => node.structuralRoles.includes('generic-child'))
		).toBe(true);

		const classCandidate = raw.declarationCandidates.find(
			(candidate) => candidate.syntaxKind === ts.SyntaxKind.ClassDeclaration
		);
		expect(classCandidate).toMatchObject({
			ambientSyntax: true,
			exportSyntax: 'EXPLICIT',
			nameState: 'ATOMIC',
			syntacticName: 'Example'
		});
		expect(classCandidate?.exportCarrierNodeOrdinal).toBe(classCandidate?.nodeOrdinal);
		expect(
			raw.declarationCandidates.some(
				(candidate) => candidate.nameState === 'COMPUTED' && candidate.candidateRole === 'MEMBER'
			)
		).toBe(true);
		expect(
			raw.declarationCandidates.some(
				(candidate) => candidate.nameState === 'PATTERN' && candidate.candidateRole === 'BINDING'
			)
		).toBe(true);
		expect(
			raw.declarationCandidates.some((candidate) => candidate.candidateRole === 'JSDOC_BINDING')
		).toBe(true);
		for (const candidate of raw.declarationCandidates.filter(
			(candidate) => candidate.nameNodeOrdinal !== null
		)) {
			const nameNode = raw.astNodes.find(
				(node) =>
					node.sourceOrdinal === candidate.sourceOrdinal &&
					node.nodeOrdinal === candidate.nameNodeOrdinal
			);
			expect(nameNode?.structuralRoles).toContain('declaration-name');
		}

		expect(raw.invocations.map((invocation) => invocation.invocationKind).sort()).toEqual([
			'CALL',
			'NEW',
			'TAGGED_TEMPLATE'
		]);
		expect(
			raw.invocations.find((invocation) => invocation.invocationKind === 'CALL')?.optional
		).toBe(true);
		for (const invocation of raw.invocations) {
			const children = raw.astNodes.filter(
				(node) => node.parentNodeOrdinal === invocation.nodeOrdinal
			);
			expect(
				children
					.filter((node) => node.structuralRoles.includes('invocation-callee'))
					.map((node) => node.nodeOrdinal)
			).toEqual([invocation.calleeNodeOrdinal]);
		}

		expect(new Set(raw.assignments.map((assignment) => assignment.assignmentKind))).toEqual(
			new Set(['INITIALIZER', 'BINARY', 'POSTFIX_UPDATE'])
		);
		for (const assignment of raw.assignments) {
			const target = raw.astNodes.find(
				(node) =>
					node.sourceOrdinal === assignment.sourceOrdinal &&
					node.nodeOrdinal === assignment.targetNodeOrdinal
			);
			expect(target?.structuralRoles).toContain('assignment-target');
			if (assignment.valueNodeOrdinal !== null) {
				const value = raw.astNodes.find(
					(node) =>
						node.sourceOrdinal === assignment.sourceOrdinal &&
						node.nodeOrdinal === assignment.valueNodeOrdinal
				);
				expect(value?.structuralRoles).toContain('assignment-value');
			}
		}

		expect(new Set(raw.literals.map((literal) => literal.valueType))).toEqual(
			new Set([
				'STRING',
				'NUMBER',
				'BIGINT',
				'BOOLEAN',
				'NULL',
				'REGEXP',
				'NO_SUBSTITUTION_TEMPLATE',
				'TEMPLATE_HEAD',
				'TEMPLATE_MIDDLE',
				'TEMPLATE_TAIL'
			])
		);
		expect(
			raw.literals.every(
				(literal) =>
					/^[a-f0-9]{64}$/u.test(literal.lexemeSha256) &&
					/^[a-f0-9]{64}$/u.test(literal.valueSha256)
			)
		).toBe(true);
	});

	it('emits declaration-name only for the bounded declaration-candidate taxonomy', () => {
		const text = 'const binding = object.member;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts']));
		const binding = raw.astNodes.find((node) => node.kind === ts.SyntaxKind.VariableDeclaration);
		const propertyAccess = raw.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.PropertyAccessExpression
		);
		expect(binding).toBeDefined();
		expect(propertyAccess).toBeDefined();
		expect(
			raw.astNodes
				.filter((node) => node.parentNodeOrdinal === binding?.nodeOrdinal)
				.some((node) => node.structuralRoles.includes('declaration-name'))
		).toBe(true);
		expect(
			raw.astNodes
				.filter((node) => node.parentNodeOrdinal === propertyAccess?.nodeOrdinal)
				.some((node) => node.structuralRoles.includes('declaration-name'))
		).toBe(false);
	});

	it('preserves diagnostic occurrences, message-chain order, related duplicates, and canonical occurrence order', () => {
		const text = 'const value: string = 1;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const sourceFile = testProgram.program.getSourceFile(absolute('src/input.ts'))!;
		const related: ts.DiagnosticRelatedInformation = {
			category: ts.DiagnosticCategory.Message,
			code: 6500,
			file: sourceFile,
			length: 5,
			messageText: 'related',
			start: 6
		};
		const diagnostic: ts.Diagnostic = {
			category: ts.DiagnosticCategory.Error,
			code: 2322,
			file: sourceFile,
			length: 5,
			messageText: {
				category: ts.DiagnosticCategory.Error,
				code: 2322,
				messageText: 'root',
				next: [
					{ category: ts.DiagnosticCategory.Message, code: 1001, messageText: 'first' },
					{ category: ts.DiagnosticCategory.Warning, code: 1002, messageText: 'second' }
				]
			},
			relatedInformation: [related, related],
			start: 6
		};
		const raw = extractStaticRaw(
			extractionInput(testProgram, ['src/input.ts'], {
				diagnosticFamilies: diagnosticFamilies([diagnostic, diagnostic])
			})
		);
		expect(raw.diagnostics).toHaveLength(2);
		expect(raw.diagnostics.map((item) => item.occurrenceOrdinal)).toEqual([0, 1]);
		expect(raw.diagnostics[0]?.message.next.map((message) => message.text)).toEqual([
			'first',
			'second'
		]);
		expect(raw.diagnostics[0]?.related).toHaveLength(2);
		expect(raw.diagnostics[0]?.related[0]).toEqual(raw.diagnostics[0]?.related[1]);
		expect(raw.diagnostics[0]).toMatchObject({
			code: 'TS2322',
			locationKind: 'SOURCE',
			path: 'src/input.ts',
			sourceOrdinal: 0
		});
		expect(
			raw.diagnosticFamilies.find((family) => family.family === 'SEMANTIC')
				?.diagnosticOccurrenceOrdinals
		).toEqual([0, 1]);
		expect(raw.diagnosticFamilies.map((family) => family.family)).toEqual(RAW_DIAGNOSTIC_FAMILIES);
	});

	it('retains malformed-source parser recovery while degrading syntax and symbol closure', () => {
		const text = 'export const broken = ;\nexport const after = 1;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const syntacticDiagnostics = testProgram.program.getSyntacticDiagnostics();
		expect(syntacticDiagnostics).toEqual([
			expect.objectContaining({ category: ts.DiagnosticCategory.Error })
		]);

		const raw = extractStaticRaw(
			extractionInput(testProgram, ['src/input.ts'], {
				diagnosticFamilies: diagnosticFamilies(syntacticDiagnostics, 'SYNTACTIC')
			})
		);

		expect(raw.diagnostics).toContainEqual(
			expect.objectContaining({
				category: 'ERROR',
				family: 'SYNTACTIC',
				path: 'src/input.ts'
			})
		);
		expect(raw.diagnosticFamilies.find((family) => family.family === 'SYNTACTIC')).toMatchObject({
			coverage: 'COMPLETE',
			state: 'RUN'
		});
		expect(raw.project.partialityReasons).toEqual([
			{
				capability: 'TS_SYMBOL',
				code: 'TYPESCRIPT_PROJECT_PARTIAL',
				message:
					'TypeScript parser recovery was required after retained SYNTACTIC ERROR diagnostics for src/input.ts; TS_SYMBOL closure is partial.',
				path: 'src/input.ts'
			},
			{
				capability: 'TS_SYNTAX',
				code: 'TYPESCRIPT_PROJECT_PARTIAL',
				message:
					'TypeScript parser recovery was required after retained SYNTACTIC ERROR diagnostics for src/input.ts; TS_SYNTAX closure is partial.',
				path: 'src/input.ts'
			}
		]);
		expect(raw.astNodes).toContainEqual(
			expect.objectContaining({ kind: ts.SyntaxKind.Identifier, syntacticIdentifierText: 'after' })
		);
	});

	it('distinguishes source, path-only, and location-free diagnostics with scalar-safe text encoding', () => {
		const text = 'export {};\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const configFile = ts.createSourceFile(
			absolute('tsconfig.json'),
			'{',
			ts.ScriptTarget.JSON,
			true,
			ts.ScriptKind.JSON
		);
		const pathOnly: ts.Diagnostic = {
			category: ts.DiagnosticCategory.Error,
			code: 1003,
			file: configFile,
			length: 1,
			messageText: 'Malformed config.',
			start: 0
		};
		const locationFree: ts.Diagnostic = {
			category: ts.DiagnosticCategory.Warning,
			code: 9999,
			file: undefined,
			length: undefined,
			messageText: `non-scalar \ud800`,
			start: undefined
		};
		const raw = extractStaticRaw(
			extractionInput(testProgram, ['src/input.ts'], {
				diagnosticFamilies: diagnosticFamilies([pathOnly, locationFree], 'CONFIGURATION')
			})
		);
		expect(raw.diagnostics.find((item) => item.code === 'TS1003')).toMatchObject({
			locationKind: 'PATH',
			path: 'tsconfig.json',
			sourceOrdinal: null,
			start: 0,
			end: 1
		});
		expect(raw.diagnostics.find((item) => item.code === 'TS9999')).toMatchObject({
			locationKind: 'NONE',
			path: null,
			sourceOrdinal: null,
			start: null,
			end: null,
			message: { textEncoding: 'UTF16_CODE_UNITS_HEX' }
		});
		expect(canonicalSemanticJson(raw)).not.toContain(REPOSITORY_ROOT);
	});

	it('is deterministic, deeply frozen, identity-free, and does not retain TypeScript objects or absolute paths', () => {
		const text = '/** docs */\nexport const answer = call(42);\n';
		const firstProgram = createTestProgram({ 'src/input.ts': text });
		const secondProgram = createTestProgram({ 'src/input.ts': text });
		const first = extractStaticRaw(extractionInput(firstProgram, ['src/input.ts']));
		const second = extractStaticRaw(extractionInput(secondProgram, ['src/input.ts']));
		expect(canonicalSemanticJson(first)).toBe(canonicalSemanticJson(second));
		expect(canonicalSemanticJson(first)).not.toContain(REPOSITORY_ROOT);
		expect(canonicalSemanticJson(first)).not.toMatch(
			/"(?:projectId|programId|sourceId|nodeId|snapshotId|provenance|timestamp)":/u
		);

		const pending: unknown[] = [first];
		while (pending.length > 0) {
			const value = pending.pop();
			if (value === null || typeof value !== 'object') continue;
			expect(Object.isFrozen(value)).toBe(true);
			expect(
				Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value))
			).toBe(true);
			expect(
				'getSourceFile' in value || 'getTypeAtLocation' in value || 'getChildren' in value
			).toBe(false);
			pending.push(...Object.values(value));
		}
	});

	it('canonicalizes source order independently of Program root and input-map order', () => {
		const filesA = { 'src/z.ts': 'export const z = 1;\n', 'src/a.ts': 'export const a = 2;\n' };
		const filesB = { 'src/a.ts': filesA['src/a.ts'], 'src/z.ts': filesA['src/z.ts'] };
		const firstProgram = createTestProgram(filesA, ['src/z.ts', 'src/a.ts']);
		const secondProgram = createTestProgram(filesB, ['src/a.ts', 'src/z.ts']);
		const roots = ['src/a.ts', 'src/z.ts'];
		const first = extractStaticRaw(extractionInput(firstProgram, roots));
		const second = extractStaticRaw(extractionInput(secondProgram, roots));
		expect(first.sources.map((source) => source.logicalPath)).toEqual(roots);
		expect(canonicalSemanticJson(first)).toBe(canonicalSemanticJson(second));
	});

	it('represents verified live compiler context without AST and makes mapping loss explicit', () => {
		const rootText = "import { context } from './context';\nexport { context };\n";
		const contextText = 'export const context = 1;\n';
		const testProgram = createTestProgram(
			{ 'src/context.ts': contextText, 'src/root.ts': rootText },
			['src/root.ts']
		);
		expect(
			testProgram.program
				.getSourceFiles()
				.map((source) => logical(source.fileName))
				.sort()
		).toEqual(['src/context.ts', 'src/root.ts']);
		const bindings = new Map<string, RawCompilerSourceBinding>([
			['src/root.ts', frozenBinding('src/root.ts', rootText)],
			[
				'src/context.ts',
				{
					artifact: null,
					byteBudgetClass: 'LIVE_COMPILER_CONTEXT',
					bytes: Buffer.byteLength(contextText),
					contentSha256: sha256(contextText),
					logicalPath: 'src/context.ts',
					mapping: { reason: 'No subject-artifact mapping is available.', state: 'UNAVAILABLE' },
					origin: 'UNKNOWN',
					verificationState: 'VERIFIED_COMPILER_INPUT'
				}
			]
		]);
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/root.ts'], {}, bindings));
		const context = raw.sources.find((source) => source.logicalPath === 'src/context.ts')!;
		const root = raw.sources.find((source) => source.logicalPath === 'src/root.ts')!;
		expect(context).toMatchObject({
			analysisDisposition: 'CONTEXT_ONLY',
			artifactClass: 'CONTEXT_ONLY',
			moduleKind: 'MODULE',
			rootFile: false,
			rootNodeOrdinal: null
		});
		expect(root.moduleKind).toBe('MODULE');
		for (const source of [root, context])
			expect(
				raw.scopes.find(
					(scope) =>
						scope.sourceOrdinal === source.sourceOrdinal &&
						scope.ownerKind === ts.SyntaxKind.SourceFile
				)
			).toMatchObject({ domain: 'MIXED', kind: 'SOURCE_MODULE' });
		expect(raw.astNodes.some((node) => node.sourceOrdinal === context.sourceOrdinal)).toBe(false);
		expect(raw.project.partialityReasons).toContainEqual(
			expect.objectContaining({
				capability: 'TS_PROJECT',
				code: 'COMPILER_CONTEXT_UNAVAILABLE',
				path: 'src/context.ts'
			})
		);
	});

	it('keeps framework-only partiality independent from TypeScript project completeness', () => {
		const text = 'export const value = 1;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const input = extractionInput(testProgram, ['src/input.ts']);
		const frameworkOnly = extractStaticRaw({
			...input,
			project: project(input.programRecipe, {
				frameworkCandidates: ['src/View.svelte'],
				status: 'PARTIAL'
			})
		});
		expect(frameworkOnly.project.partialityReasons).toContainEqual(
			expect.objectContaining({ capability: 'TS_SYNTAX', code: 'FRAMEWORK_CANDIDATES_UNSUPPORTED' })
		);
		expect(
			frameworkOnly.project.partialityReasons.some((reason) => reason.capability === 'TS_PROJECT')
		).toBe(false);

		const configurationPartial = extractStaticRaw({
			...input,
			project: project(input.programRecipe, {
				status: 'PARTIAL',
				typescriptDiagnostics: [
					{
						code: 'CONFIG_DIAGNOSTIC',
						message: 'Configuration is invalid.',
						path: 'tsconfig.json',
						phase: 'RESOLVE',
						severity: 'ERROR'
					}
				]
			})
		});
		expect(configurationPartial.project.partialityReasons).toContainEqual(
			expect.objectContaining({ capability: 'TS_PROJECT', code: 'TYPESCRIPT_PROJECT_PARTIAL' })
		);
	});

	it('redacts over-limit literal values while retaining exact value and lexeme metadata', () => {
		const text = 'export const value = "a long literal", nonScalar = "\\uD800";\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const raw = extractStaticRaw(
			extractionInput(testProgram, ['src/input.ts'], {
				budgets: { ...BUDGETS, maxLiteralCharacters: 3 }
			})
		);
		const literal = raw.literals.find(
			(item) => item.valueType === 'STRING' && item.valueLength === 'a long literal'.length
		)!;
		expect(literal).toMatchObject({
			value: null,
			valueLength: 'a long literal'.length,
			valueState: 'DIGEST_ONLY'
		});
		expect(literal.lexemeLength).toBe('"a long literal"'.length);
		const nonScalar = raw.literals.find((item) => item.valueEncoding === 'UTF16_CODE_UNITS_LE')!;
		expect(nonScalar).toMatchObject({
			value: null,
			valueLength: 1,
			valueState: 'DIGEST_ONLY',
			valueType: 'STRING'
		});
	});

	it('fails closed on node, depth, diagnostic, character, path, deadline, and frozen-source-policy bounds', () => {
		const text = 'export const value = call(1);\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						budgets: { ...BUDGETS, maxAstNodes: 1 }
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						budgets: { ...BUDGETS, maxAstDepth: 1 }
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						budgets: { ...BUDGETS, maxPathCharacters: 4 }
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], { deadlineMs: Date.now() - 1 })
				),
			'DEADLINE_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						assertWithinDeadline: () => undefined,
						clock: () => 101,
						deadlineMs: 100
					})
				),
			'DEADLINE_EXCEEDED'
		);

		const sourceFile = testProgram.program.getSourceFile(absolute('src/input.ts'))!;
		const diagnostic: ts.Diagnostic = {
			category: ts.DiagnosticCategory.Error,
			code: 1000,
			file: sourceFile,
			length: 1,
			messageText: 'too long',
			start: 0
		};
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						budgets: { ...BUDGETS, maxDiagnostics: 1 },
						diagnosticFamilies: diagnosticFamilies([diagnostic, diagnostic])
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						budgets: { ...BUDGETS, maxDiagnosticCharacters: 2 },
						diagnosticFamilies: diagnosticFamilies([diagnostic])
					})
				),
			'BUDGET_EXCEEDED'
		);

		const invalidBinding = {
			...frozenBinding('src/input.ts', text),
			artifact: {
				disposition: 'INVENTORY_ONLY' as const,
				primaryClass: 'PRODUCTION_SOURCE' as const,
				roles: ['COMPILER_CANDIDATE' as const]
			}
		};
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(
						testProgram,
						['src/input.ts'],
						{},
						new Map([['src/input.ts', invalidBinding]])
					)
				),
			'SOURCE_POLICY_MISMATCH'
		);

		const twoSources = createTestProgram({
			'src/a.ts': 'export {};\n',
			'src/b.ts': 'export {};\n'
		});
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(twoSources, ['src/a.ts', 'src/b.ts'], {
						budgets: { ...BUDGETS, maxSources: 1 }
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxScopes: 1 } })
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						budgets: { ...BUDGETS, maxProjects: 0 }
					})
				),
			'BUDGET_EXCEEDED'
		);
	});

	it('enforces snapshot-wide extraction ceilings through a provider-issued shared ledger', () => {
		const budgets = { ...BUDGETS, maxSources: 1 };
		const session = createStaticSemanticOperationBudgetSession(budgets, Date.now());
		const ledger = createStaticRawExtractionBudgetLedger(
			budgets,
			'EXTRACT',
			session.providerBinding()
		);
		const first = createTestProgram({ 'src/first.ts': 'export {};\n' });
		const second = createTestProgram({ 'src/second.ts': 'export {};\n' });
		const secondRecipe = recipe(['src/second.ts'], 'second/tsconfig.json');
		extractStaticRaw(extractionInput(first, ['src/first.ts'], { budgetLedger: ledger, budgets }));
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(second, ['src/second.ts'], {
						budgetLedger: ledger,
						budgets,
						programRecipe: secondRecipe,
						project: project(secondRecipe),
						projectKey: secondRecipe.configPath
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(second, ['src/second.ts'], {
						budgetLedger: ledger,
						budgets: { ...budgets, maxSources: 2 }
					})
				),
			'INVALID_INPUT'
		);
	});

	it('finalizes exact phase-bound provider evidence and rejects forged or reused capabilities', () => {
		const testProgram = createTestProgram({
			'src/evidence.ts': 'export const answer = 42;\nconsole.log(answer);\n'
		});
		const session = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		const binding = session.providerBinding();
		const ledger = createStaticRawExtractionBudgetLedger(BUDGETS, 'CAPTURE', binding);
		const raw = extractStaticRaw(
			extractionInput(testProgram, ['src/evidence.ts'], { budgetLedger: ledger })
		);
		const evidence = finalizeStaticRawExtractionBudgetLedger(ledger);
		const view = takeStaticRawExtractionBudgetEvidence(
			evidence,
			binding,
			'CAPTURE',
			sha256(canonicalSemanticJson(BUDGETS))
		);
		const compilerFacts =
			raw.aliases.length +
			raw.declarations.length +
			raw.moduleExports.length +
			raw.moduleResolutions.length +
			raw.references.length +
			raw.symbols.length;

		expect(view).toEqual({
			budgetsDigest: sha256(canonicalSemanticJson(BUDGETS)),
			phase: 'CAPTURE',
			projects: [
				expect.objectContaining({
					astNodes: raw.astNodes.length,
					compilerFacts,
					diagnosticCharacters: 0,
					diagnostics: raw.diagnostics.length,
					projectKey: 'tsconfig.json',
					scopes: raw.scopes.length,
					sourceMembers: [
						canonicalSemanticJson({ logicalPath: 'src/evidence.ts', projectKey: 'tsconfig.json' })
					]
				})
			]
		});
		expect(view.projects[0]!.compilerQueries.length).toBeGreaterThan(0);
		expect(
			view.projects[0]!.compilerQueries.every(
				(query) => query.invocationCount >= 1 && query.queryKey.length > 0
			)
		).toBe(true);
		expect(Object.isFrozen(view)).toBe(true);
		expect(Object.isFrozen(view.projects)).toBe(true);
		expect(Object.isFrozen(view.projects[0]!.compilerQueries)).toBe(true);

		expectTypedFailure(() => finalizeStaticRawExtractionBudgetLedger(ledger), 'INVALID_INPUT');
		expectTypedFailure(
			() =>
				takeStaticRawExtractionBudgetEvidence(
					structuredClone(evidence),
					binding,
					'CAPTURE',
					sha256(canonicalSemanticJson(BUDGETS))
				),
			'INVALID_INPUT'
		);
		expectTypedFailure(
			() =>
				takeStaticRawExtractionBudgetEvidence(
					evidence,
					binding,
					'CAPTURE',
					sha256(canonicalSemanticJson(BUDGETS))
				),
			'INVALID_INPUT'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/evidence.ts'], { budgetLedger: ledger })
				),
			'INVALID_INPUT'
		);
	});

	it('requires exact project/recipe identity and all six diagnostic families in registered order', () => {
		const text = 'export {};\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], { projectKey: 'other/tsconfig.json' })
				),
			'IDENTITY_MISMATCH'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						diagnosticFamilies: diagnosticFamilies().slice(1)
					})
				),
			'INVALID_INPUT'
		);
		const failedFamilies = diagnosticFamilies().map((family) =>
			family.family === 'DECLARATION'
				? { ...family, reason: 'Declaration diagnostics threw.', state: 'FAILED' as const }
				: family
		);
		const raw = extractStaticRaw(
			extractionInput(testProgram, ['src/input.ts'], { diagnosticFamilies: failedFamilies })
		);
		expect(raw.diagnosticFamilies.at(-1)).toMatchObject({
			coverage: 'BOUNDED',
			family: 'DECLARATION',
			state: 'FAILED'
		});
		expect(raw.project.partialityReasons).toContainEqual(
			expect.objectContaining({ capability: 'TS_PROJECT', code: 'COMPILER_CONTEXT_UNAVAILABLE' })
		);
	});

	it('projects every supported script kind and the remaining public assignment and export forms', () => {
		const syntax = [
			'enum Choice { First = 1 }',
			'let counter = 0;',
			'++counter;',
			'let fallback = 1;',
			'({ fallback = 2 } = { fallback: 3 });',
			'interface Named { "literal-name": string; }',
			'export default class DefaultClass {}',
			'export default function defaultFunction() {}',
			'export default const carrierDefault = 1;',
			'export = counter;',
			''
		].join('\n');
		const files = {
			'src/input.ts': syntax,
			'src/view.tsx': 'export const view = <div />;\n',
			'src/view.jsx': 'export const jsx = <span />;\n',
			'src/module.js': 'export const js = 1;\n',
			'src/data.json': '{"value":1}\n',
			'src/extension.custom': 'export const custom = true;\n',
			'types/api.d.ts': 'export as namespace API;\nexport declare const api: true;\n'
		};
		const roots = Object.keys(files).sort();
		const testProgram = createTestProgram(files, roots, {
			allowJs: true,
			allowNonTsExtensions: true,
			jsx: ts.JsxEmit.Preserve,
			resolveJsonModule: true
		});
		const raw = extractStaticRaw(extractionInput(testProgram, roots));

		expect(new Set(raw.sources.map((source) => source.scriptKind))).toEqual(
			new Set([
				ts.ScriptKind.Unknown,
				ts.ScriptKind.JS,
				ts.ScriptKind.JSX,
				ts.ScriptKind.JSON,
				ts.ScriptKind.TS,
				ts.ScriptKind.TSX
			])
		);
		expect(
			raw.assignments.some((assignment) => assignment.assignmentKind === 'PREFIX_UPDATE')
		).toBe(true);
		const enumMember = raw.astNodes.find((node) => node.kind === ts.SyntaxKind.EnumMember)!;
		const shorthand = raw.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.ShorthandPropertyAssignment
		)!;
		expect(
			raw.assignments.some(
				(assignment) =>
					assignment.assignmentKind === 'INITIALIZER' &&
					raw.astNodes.find(
						(node) =>
							node.nodeOrdinal === assignment.targetNodeOrdinal &&
							node.sourceOrdinal === assignment.sourceOrdinal
					)?.parentNodeOrdinal === enumMember.nodeOrdinal
			)
		).toBe(true);
		expect(
			raw.assignments.some(
				(assignment) =>
					assignment.assignmentKind === 'INITIALIZER' &&
					raw.astNodes.find(
						(node) =>
							node.nodeOrdinal === assignment.targetNodeOrdinal &&
							node.sourceOrdinal === assignment.sourceOrdinal
					)?.parentNodeOrdinal === shorthand.nodeOrdinal
			)
		).toBe(true);
		expect(
			new Set(raw.declarationCandidates.map((candidate) => candidate.exportSyntax)).has(
				'EXPORT_ASSIGNMENT'
			)
		).toBe(true);
		expect(
			new Set(raw.declarationCandidates.map((candidate) => candidate.exportSyntax)).has(
				'NAMESPACE_EXPORT'
			)
		).toBe(true);
		expect(
			new Set(raw.declarationCandidates.map((candidate) => candidate.exportSyntax)).has('DEFAULT')
		).toBe(true);
		expect(
			raw.declarationCandidates.some((candidate) => candidate.syntacticName === '"literal-name"')
		).toBe(true);
	});

	it('maps suggestion diagnostics and converts hostile callback failures to typed extraction refusals', () => {
		const text = 'export const value = 1;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const suggestion: ts.Diagnostic = {
			category: ts.DiagnosticCategory.Suggestion,
			code: 8001,
			file: undefined,
			length: undefined,
			messageText: 'Consider another form.',
			start: undefined
		};
		const raw = extractStaticRaw(
			extractionInput(testProgram, ['src/input.ts'], {
				diagnosticFamilies: diagnosticFamilies([suggestion])
			})
		);
		expect(raw.diagnostics[0]).toMatchObject({ category: 'SUGGESTION', code: 'TS8001' });
		const unknownCategory = { ...suggestion, category: 99 as ts.DiagnosticCategory };
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						diagnosticFamilies: diagnosticFamilies([unknownCategory])
					})
				),
			'DIAGNOSTIC_INVALID'
		);

		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						assertWithinDeadline: () => {
							throw new Error('clock unavailable');
						}
					})
				),
			'DEADLINE_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						toLogicalPath: () => {
							throw new Error('mapping unavailable');
						}
					})
				),
			'PATH_MAPPING_FAILED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						toLogicalPath: () => '../outside.ts'
					})
				),
			'PATH_MAPPING_FAILED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input.ts'], {
						resolveCompilerSource: () => {
							throw new Error('evidence unavailable');
						}
					})
				),
			'SOURCE_EVIDENCE_MISSING'
		);

		const originalRoots = testProgram.program.getRootFileNames.bind(testProgram.program);
		Object.defineProperty(testProgram.program, 'getRootFileNames', {
			configurable: true,
			value: () => {
				throw new Error('program failure');
			}
		});
		expectTypedFailure(
			() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'])),
			'INVALID_INPUT'
		);
		Object.defineProperty(testProgram.program, 'getRootFileNames', {
			configurable: true,
			value: originalRoots
		});

		const malformedLiteralProgram = createTestProgram({
			'src/literal.ts': 'export const value = 1;\n'
		});
		const sourceFile = malformedLiteralProgram.program.getSourceFile(absolute('src/literal.ts'))!;
		let numericLiteral: ts.NumericLiteral | undefined;
		const visit = (node: ts.Node): void => {
			if (ts.isNumericLiteral(node)) numericLiteral = node;
			else ts.forEachChild(node, visit);
		};
		visit(sourceFile);
		Object.defineProperty(numericLiteral!, 'text', { configurable: true, value: undefined });
		expectTypedFailure(
			() => extractStaticRaw(extractionInput(malformedLiteralProgram, ['src/literal.ts'])),
			'UNSUPPORTED_SYNTAX'
		);
	});

	it('extracts local and chained import/export aliases with terminal checker resolution', () => {
		const files = {
			'src/a.ts': 'export const original = 1;\n',
			'src/b.ts':
				"import { original as first } from './a';\nexport { first as second };\nexport const observed = first;\n",
			'src/c.ts': "import { second as third } from './b';\nexport const result = third;\n"
		};
		const testProgram = createTestProgram(files);
		const raw = extractStaticRaw(extractionInput(testProgram, Object.keys(files).sort()));
		const symbolsByOrdinal = new Map(
			raw.symbols.map((symbol) => [symbol.symbolOrdinal, symbol] as const)
		);
		const aliasesByName = new Map(
			raw.aliases.map(
				(alias) => [symbolsByOrdinal.get(alias.aliasSymbolOrdinal)!.name, alias] as const
			)
		);

		expect([...aliasesByName.keys()].sort()).toEqual(
			expect.arrayContaining(['first', 'second', 'third'])
		);
		for (const name of ['first', 'second', 'third']) {
			const alias = aliasesByName.get(name)!;
			expect(alias.state).toBe('RESOLVED');
			expect(symbolsByOrdinal.get(alias.terminalSymbolOrdinal!)?.name).toBe('original');
		}
		expect(
			raw.references.some(
				(reference) =>
					reference.role === 'IMPORT_EXPORT_BINDING' &&
					reference.resolutionState === 'RESOLVED_ALIAS'
			)
		).toBe(true);
		expect(
			raw.moduleResolutions
				.filter((resolution) => resolution.occurrenceKind === 'IMPORT')
				.every((resolution) => resolution.resolutionState === 'RESOLVED_SOURCE')
		).toBe(true);
	});

	it('preserves direct, default, named, and star re-exports as distinct export facts', () => {
		const files = {
			'src/a.ts':
				'export default function primary() {}\nexport const alpha = 1;\nexport const beta = 2;\n',
			'src/b.ts':
				"export { default } from './a';\nexport { alpha as named } from './a';\nexport * from './a';\nexport const local = 3;\n"
		};
		const testProgram = createTestProgram(files);
		const raw = extractStaticRaw(extractionInput(testProgram, Object.keys(files).sort()));
		const bOrdinal = raw.sources.find((source) => source.logicalPath === 'src/b.ts')!.sourceOrdinal;
		const exports = raw.moduleExports.filter((entry) => entry.sourceOrdinal === bOrdinal);

		expect(exports.map((entry) => entry.exportName)).toEqual([
			'alpha',
			'beta',
			'default',
			'local',
			'named'
		]);
		expect(exports.find((entry) => entry.exportName === 'local')?.state).toBe('DIRECT');
		for (const name of ['alpha', 'beta', 'default', 'named'])
			expect(exports.find((entry) => entry.exportName === name)?.state).toBe('REEXPORT');
		expect(
			raw.moduleResolutions.filter(
				(entry) => entry.sourceOrdinal === bOrdinal && entry.occurrenceKind === 'EXPORT'
			)
		).toHaveLength(3);
		expect(
			raw.moduleResolutions
				.filter((entry) => entry.sourceOrdinal === bOrdinal)
				.every((entry) => entry.resolutionState === 'RESOLVED_SOURCE')
		).toBe(true);
	});

	it('retains merged declarations and separates shadowed same-spelling symbols', () => {
		const text = `
interface Merge { first: string }
interface Merge { second: number }
namespace Merge { export const third = true }
const value = 1;
function nested() { const value = 2; return value; }
void value;
export { Merge, value, nested };
`;
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts']));
		const merged = raw.symbols.find(
			(symbol) => symbol.name === 'Merge' && symbol.declarationOrdinals.length === 3
		);
		const values = raw.symbols.filter(
			(symbol) =>
				symbol.name === 'value' &&
				symbol.declarationOrdinals.length === 1 &&
				(symbol.flags & ts.SymbolFlags.Alias) === 0
		);

		expect(merged).toBeDefined();
		expect(
			merged!.declarationOrdinals.map((ordinal) => raw.declarations[ordinal]!.kindName).sort()
		).toEqual(['InterfaceDeclaration', 'InterfaceDeclaration', 'ModuleDeclaration']);
		expect(values).toHaveLength(2);
		expect(
			new Set(values.map((symbol) => raw.declarations[symbol.declarationOrdinals[0]!]!.start)).size
		).toBe(2);
		const valueUses = raw.references.filter(
			(reference) =>
				reference.role === 'SYMBOL_USE' &&
				reference.symbolOrdinal !== null &&
				values.some((symbol) => symbol.symbolOrdinal === reference.symbolOrdinal)
		);
		expect(new Set(valueUses.map((reference) => reference.symbolOrdinal))).toEqual(
			new Set(values.map((symbol) => symbol.symbolOrdinal))
		);
	});

	it('projects closed public-AST lexical-scope topology and distinguishes shadowed declarations', () => {
		const moduleText = `
export function outer<T>(argument: T) {
  let shadow = argument;
  { let shadow = 1; void shadow; }
  for (let index = 0; index < 1; index++) { void index; }
  try { throw new Error(); } catch (error) { void error; }
  class Inner { method<U>(value: U) { return value; } }
  const object = { method() { return shadow; } };
	  const record = { value: shadow };
  type Local<K extends string> = { [P in K]: P extends string ? P : never };
  return shadow;
}
export namespace Space { export const value = 1; }
export enum State { Ready }
`;
		const scriptText = 'var scriptValue = 1;\n';
		const testProgram = createTestProgram({
			'src/module.ts': moduleText,
			'src/script.ts': scriptText
		});
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/module.ts', 'src/script.ts']));
		const scopesByOrdinal = new Map(
			raw.scopes.map((scope) => [scope.scopeOrdinal, scope] as const)
		);
		const expectedKinds = [
			'PROGRAM_GLOBAL',
			'SOURCE_SCRIPT',
			'SOURCE_MODULE',
			'FUNCTION',
			'BLOCK',
			'LOOP',
			'CATCH',
			'CLASS',
			'NAMESPACE',
			'TYPE',
			'ENUM',
			'OBJECT'
		] as const;
		const actualKinds = new Set(raw.scopes.map((scope) => scope.kind));
		for (const kind of expectedKinds) expect(actualKinds.has(kind)).toBe(true);
		expect(raw.sources.map((source) => [source.logicalPath, source.moduleKind] as const)).toEqual([
			['src/module.ts', 'MODULE'],
			['src/script.ts', 'SCRIPT']
		]);
		expect(raw.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')?.domain).toBe('LEXICAL');
		expect(raw.scopes.find((scope) => scope.ownerKind === ts.SyntaxKind.MappedType)?.domain).toBe(
			'TYPE_PARAMETER'
		);

		const globalScopes = raw.scopes.filter((scope) => scope.kind === 'PROGRAM_GLOBAL');
		expect(globalScopes).toHaveLength(1);
		expect(globalScopes[0]).toMatchObject({
			end: null,
			ownerKind: null,
			parentScopeOrdinal: null,
			sourceOrdinal: null,
			start: null
		});
		for (const scope of raw.scopes.filter((candidate) => candidate.kind !== 'PROGRAM_GLOBAL')) {
			const parent = scopesByOrdinal.get(scope.parentScopeOrdinal!);
			expect(parent).toBeDefined();
			expect(scope.sourceOrdinal).not.toBeNull();
			if (scope.kind === 'SOURCE_SCRIPT' || scope.kind === 'SOURCE_MODULE')
				expect(parent?.kind).toBe('PROGRAM_GLOBAL');
			else expect(parent?.sourceOrdinal).toBe(scope.sourceOrdinal);
		}

		const objectInitializerUse = raw.astNodes.find(
			(node) =>
				node.kind === ts.SyntaxKind.Identifier && node.start === moduleText.indexOf('shadow };')
		)!;
		const objectInitializerReference = raw.references.find(
			(reference) =>
				reference.sourceOrdinal === objectInitializerUse.sourceOrdinal &&
				reference.nodeOrdinal === objectInitializerUse.nodeOrdinal
		)!;
		expect(scopesByOrdinal.get(objectInitializerReference.containingScopeOrdinal!)).toMatchObject({
			domain: 'LEXICAL',
			kind: 'BLOCK'
		});
		const objectPropertyDeclaration = raw.declarations.find(
			(declaration) =>
				declaration.kind === ts.SyntaxKind.PropertyAssignment && declaration.name === 'value'
		)!;
		expect(scopesByOrdinal.get(objectPropertyDeclaration.declaringScopeOrdinal!)).toMatchObject({
			domain: 'MEMBER',
			kind: 'OBJECT'
		});
		const mappedReferenceNode = raw.astNodes.find(
			(node) =>
				node.kind === ts.SyntaxKind.Identifier && node.start === moduleText.indexOf('P extends')
		)!;
		const mappedReference = raw.references.find(
			(reference) =>
				reference.sourceOrdinal === mappedReferenceNode.sourceOrdinal &&
				reference.nodeOrdinal === mappedReferenceNode.nodeOrdinal
		)!;
		expect(scopesByOrdinal.get(mappedReference.containingScopeOrdinal!)).toMatchObject({
			domain: 'TYPE_PARAMETER',
			kind: 'TYPE'
		});

		const shadowDeclarations = raw.declarations.filter(
			(declaration) => declaration.name === 'shadow'
		);
		expect(shadowDeclarations).toHaveLength(2);
		expect(
			new Set(shadowDeclarations.map((declaration) => declaration.declaringScopeOrdinal)).size
		).toBe(2);
		expect(
			raw.declarations.every(
				(declaration) =>
					declaration.scopeLinkState === 'RESOLVED' && declaration.declaringScopeOrdinal !== null
			)
		).toBe(true);
		expect(
			raw.references.every(
				(reference) =>
					reference.scopeLinkState === 'RESOLVED' && reference.containingScopeOrdinal !== null
			)
		).toBe(true);
	});

	it('keeps var declarations inside the class-static-block variable environment', () => {
		const text = 'class Box { static { var local = 1; void local; } }\n';
		const testProgram = createTestProgram({ 'src/static-block.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/static-block.ts']));
		const declaration = raw.declarations.find(
			(record) => record.kind === ts.SyntaxKind.VariableDeclaration && record.name === 'local'
		)!;
		const staticBlockScope = raw.scopes.find(
			(scope) => scope.ownerKind === ts.SyntaxKind.ClassStaticBlockDeclaration
		)!;
		const useNode = raw.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.Identifier && node.start === text.lastIndexOf('local')
		)!;
		const use = raw.references.find(
			(reference) =>
				reference.sourceOrdinal === useNode.sourceOrdinal &&
				reference.nodeOrdinal === useNode.nodeOrdinal
		)!;
		const useScope = raw.scopes.find((scope) => scope.scopeOrdinal === use.containingScopeOrdinal)!;

		expect(staticBlockScope).toMatchObject({ domain: 'LEXICAL', kind: 'BLOCK' });
		expect(declaration).toMatchObject({
			declaringScopeOrdinal: staticBlockScope.scopeOrdinal,
			scopeLinkState: 'RESOLVED'
		});
		expect(use).toMatchObject({ scopeLinkState: 'RESOLVED' });
		expect(useScope).toMatchObject({
			kind: 'BLOCK',
			parentScopeOrdinal: staticBlockScope.scopeOrdinal
		});
	});

	it('treats transparent TypeScript wrappers around eval as direct while preserving optional-call indirection', () => {
		const text = `
declare const eval: any;
declare const markerBare: any;
declare const markerParen: any;
declare const markerNonNull: any;
declare const markerAs: any;
declare const markerAssertion: any;
declare const markerSatisfies: any;
declare const markerOptional: any;
function bare() { eval(""); void markerBare; }
function paren() { (eval)(""); void markerParen; }
function nonNull() { eval!(""); void markerNonNull; }
function asExpression() { (eval as any)(""); void markerAs; }
function assertion() { (<any>eval)(""); void markerAssertion; }
function satisfiesExpression() { (eval satisfies any)(""); void markerSatisfies; }
function optionalCall() { eval?.(""); void markerOptional; }
`;
		const testProgram = createTestProgram({ 'src/eval-wrappers.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/eval-wrappers.ts']));
		const referenceAt = (start: number) => {
			const node = raw.astNodes.find(
				(candidate) => candidate.kind === ts.SyntaxKind.Identifier && candidate.start === start
			)!;
			return raw.references.find(
				(reference) =>
					reference.sourceOrdinal === node.sourceOrdinal &&
					reference.nodeOrdinal === node.nodeOrdinal
			)!;
		};

		for (const marker of [
			'markerBare',
			'markerParen',
			'markerNonNull',
			'markerAs',
			'markerAssertion',
			'markerSatisfies'
		])
			expect(referenceAt(text.lastIndexOf(marker))).toMatchObject({
				containingScopeOrdinal: null,
				scopeLinkState: 'UNSUPPORTED'
			});
		expect(referenceAt(text.lastIndexOf('markerOptional'))).toMatchObject({
			scopeLinkState: 'RESOLVED'
		});
	});

	it('preserves AST-derived type scopes when transient union-property symbols make binding identity unsupported', () => {
		const text = `
interface Left { value: string }
interface Right { value: number }
declare const subject: Left | Right;
void subject.value;
`;
		const testProgram = createTestProgram({ 'src/union-property.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/union-property.ts']));
		const declarations = raw.declarations.filter(
			(record) => record.kind === ts.SyntaxKind.PropertySignature && record.name === 'value'
		);
		const scopesByOrdinal = new Map(raw.scopes.map((scope) => [scope.scopeOrdinal, scope]));

		expect(declarations).toHaveLength(2);
		for (const declaration of declarations) {
			expect(declaration).toMatchObject({
				scopeLinkState: 'RESOLVED',
				symbolBindingState: 'UNSUPPORTED',
				symbolOrdinal: null
			});
			expect(declaration.declaringScopeOrdinal).not.toBeNull();
			expect(scopesByOrdinal.get(declaration.declaringScopeOrdinal!)).toMatchObject({
				kind: 'TYPE',
				ownerKind: ts.SyntaxKind.InterfaceDeclaration
			});
		}
		expect(raw.project.partialityReasons).toContainEqual(
			expect.objectContaining({ capability: 'TS_SYMBOL', code: 'CAPABILITY_UNSUPPORTED' })
		);
	});

	it('does not collapse a parameter property into one fabricated checker symbol', () => {
		const text = `
class Example {
  constructor(public value: number) {
    void value;
    void this.value;
  }
}
`;
		const testProgram = createTestProgram({ 'src/parameter-property.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/parameter-property.ts']));
		const declaration = raw.declarations.find(
			(record) => record.kind === ts.SyntaxKind.Parameter && record.name === 'value'
		)!;
		const valueReferences = raw.astNodes
			.filter(
				(node) => node.kind === ts.SyntaxKind.Identifier && node.syntacticIdentifierText === 'value'
			)
			.map((node) =>
				raw.references.find(
					(reference) =>
						reference.sourceOrdinal === node.sourceOrdinal &&
						reference.nodeOrdinal === node.nodeOrdinal
				)
			)
			.filter((reference) => reference !== undefined);

		expect(declaration).toMatchObject({
			declaringScopeOrdinal: null,
			scopeLinkState: 'UNSUPPORTED',
			symbolBindingState: 'UNSUPPORTED',
			symbolOrdinal: null
		});
		expect(raw.symbols.some((symbol) => symbol.name === 'value')).toBe(false);
		expect(valueReferences.length).toBeGreaterThanOrEqual(3);
		for (const reference of valueReferences)
			expect(reference).toMatchObject({
				resolutionState: 'UNSUPPORTED',
				resolvedSymbolOrdinal: null,
				symbolOrdinal: null
			});
		expect(raw.project.partialityReasons).toContainEqual(
			expect.objectContaining({
				capability: 'TS_SYMBOL',
				code: 'CAPABILITY_UNSUPPORTED',
				path: 'src/parameter-property.ts'
			})
		);
	});

	it('places block functions only when strictness is established and keeps direct body declarations in the function environment', () => {
		const strictText = '"use strict"; { function strictBlock() {} void strictBlock; }\n';
		const escapedText = '"use\\x20strict"; { function escapedBlock() {} void escapedBlock; }\n';
		const sloppyText =
			'{ function sloppyBlock() {} void sloppyBlock; }\nfunction outer() { function bodyLocal() {} void bodyLocal; }\n';
		const files = {
			'src/escaped.ts': escapedText,
			'src/sloppy.ts': sloppyText,
			'src/strict.ts': strictText
		};
		const roots = Object.keys(files).sort();
		const testProgram = createTestProgram(files, roots, {
			alwaysStrict: false,
			strict: false
		});
		const raw = extractStaticRaw(extractionInput(testProgram, roots));
		const strictBlock = raw.declarations.find((record) => record.name === 'strictBlock')!;
		const escapedBlock = raw.declarations.find((record) => record.name === 'escapedBlock')!;
		const sloppyBlock = raw.declarations.find((record) => record.name === 'sloppyBlock')!;
		const bodyLocal = raw.declarations.find((record) => record.name === 'bodyLocal')!;
		const scopesByOrdinal = new Map(raw.scopes.map((scope) => [scope.scopeOrdinal, scope]));

		expect(scopesByOrdinal.get(strictBlock.declaringScopeOrdinal!)).toMatchObject({
			kind: 'BLOCK'
		});
		expect(strictBlock).toMatchObject({
			scopeLinkState: 'RESOLVED',
			symbolBindingState: 'RESOLVED'
		});
		expect(sloppyBlock).toMatchObject({
			declaringScopeOrdinal: null,
			scopeLinkState: 'UNSUPPORTED',
			symbolBindingState: 'RESOLVED'
		});
		expect(escapedBlock).toMatchObject({
			declaringScopeOrdinal: null,
			scopeLinkState: 'UNSUPPORTED',
			symbolBindingState: 'RESOLVED'
		});
		expect(scopesByOrdinal.get(bodyLocal.declaringScopeOrdinal!)).toMatchObject({
			kind: 'FUNCTION'
		});
		expect(raw.project.partialityReasons).toContainEqual(
			expect.objectContaining({ capability: 'TS_SYMBOL', path: 'src/sloppy.ts' })
		);
		expect(raw.project.partialityReasons).toContainEqual(
			expect.objectContaining({ capability: 'TS_SYMBOL', path: 'src/escaped.ts' })
		);
	});

	it('honors an explicit alwaysStrict false override while retaining the strict fallback when it is omitted', () => {
		const text = '{ function blockLocal() {} void blockLocal; }\n';
		const explicitOverride = createTestProgram({ 'src/option.ts': text }, ['src/option.ts'], {
			alwaysStrict: false,
			strict: true
		});
		const inheritedStrict = createTestProgram({ 'src/option.ts': text }, ['src/option.ts'], {
			strict: true
		});
		const explicitRaw = extractStaticRaw(extractionInput(explicitOverride, ['src/option.ts']));
		const inheritedRaw = extractStaticRaw(extractionInput(inheritedStrict, ['src/option.ts']));
		const explicitDeclaration = explicitRaw.declarations.find(
			(record) => record.name === 'blockLocal'
		)!;
		const inheritedDeclaration = inheritedRaw.declarations.find(
			(record) => record.name === 'blockLocal'
		)!;
		const inheritedScope = inheritedRaw.scopes.find(
			(scope) => scope.scopeOrdinal === inheritedDeclaration.declaringScopeOrdinal
		);

		expect(explicitDeclaration).toMatchObject({
			declaringScopeOrdinal: null,
			scopeLinkState: 'UNSUPPORTED'
		});
		expect(inheritedDeclaration).toMatchObject({ scopeLinkState: 'RESOLVED' });
		expect(inheritedScope).toMatchObject({ kind: 'BLOCK' });
	});

	it('does not fabricate a conditional-type scope and marks infer-region scope links unsupported', () => {
		const text =
			'type Unwrap<T> = T extends readonly (infer U)[] ? U : T;\nexport type Result = Unwrap<string[]>;\n';
		const testProgram = createTestProgram({ 'src/infer.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/infer.ts']));
		const inferUseNode = raw.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.Identifier && node.start === text.indexOf('? U') + 2
		)!;
		const inferUse = raw.references.find(
			(reference) =>
				reference.sourceOrdinal === inferUseNode.sourceOrdinal &&
				reference.nodeOrdinal === inferUseNode.nodeOrdinal
		)!;
		const inferDeclaration = raw.declarations.find(
			(declaration) => declaration.name === 'U' && declaration.kind === ts.SyntaxKind.TypeParameter
		)!;

		expect(raw.scopes.some((scope) => scope.ownerKind === ts.SyntaxKind.ConditionalType)).toBe(
			false
		);
		expect(inferUse).toMatchObject({
			containingScopeOrdinal: null,
			scopeLinkState: 'UNSUPPORTED'
		});
		expect(inferDeclaration).toMatchObject({
			declaringScopeOrdinal: null,
			scopeLinkState: 'UNSUPPORTED'
		});
	});

	it('marks references affected by with and syntactic direct eval unsupported', () => {
		const text = `
declare const target: any;
declare const withOnly: any;
declare const evalBefore: any;
declare const evalAfter: any;
declare const nestedOnly: any;
with (target) { void withOnly; }
function risky() {
  void evalBefore;
  eval("var introduced = 1");
  void evalAfter;
  function nested() { return nestedOnly; }
  return evalBefore;
}
`;
		const testProgram = createTestProgram({ 'src/dynamic.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/dynamic.ts']));
		const referenceAt = (start: number) => {
			const node = raw.astNodes.find(
				(candidate) => candidate.kind === ts.SyntaxKind.Identifier && candidate.start === start
			)!;
			return raw.references.find(
				(reference) =>
					reference.sourceOrdinal === node.sourceOrdinal &&
					reference.nodeOrdinal === node.nodeOrdinal
			)!;
		};
		const unsupported = [
			referenceAt(text.lastIndexOf('withOnly')),
			referenceAt(text.indexOf('evalBefore;')),
			referenceAt(text.indexOf('eval("')),
			referenceAt(text.indexOf('evalAfter;')),
			referenceAt(text.lastIndexOf('evalBefore'))
		];
		for (const reference of unsupported)
			expect(reference).toMatchObject({
				containingScopeOrdinal: null,
				scopeLinkState: 'UNSUPPORTED'
			});
		expect(referenceAt(text.lastIndexOf('nestedOnly'))).toMatchObject({
			scopeLinkState: 'RESOLVED'
		});
	});

	it('removes TypeScript process-local suffixes from unique-symbol names', () => {
		const text = `
declare const brand: unique symbol;
export interface Branded { readonly [brand]: true }
export { brand };
`;
		const testProgram = createTestProgram({ 'src/brand.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/brand.ts']));
		const generatedNames = raw.symbols
			.map((symbol) => symbol.name)
			.filter((name) => name.startsWith('__@brand'));
		const declarationKeys = raw.declarations.map((declaration) =>
			canonicalSemanticJson({
				end: declaration.end,
				kind: declaration.kind,
				nodeOrdinal: declaration.nodeOrdinal,
				sourceOrdinal: declaration.sourceOrdinal,
				start: declaration.start
			})
		);

		expect(generatedNames).toContain('__@brand');
		expect(generatedNames.every((name) => !/@[0-9]+$/u.test(name))).toBe(true);
		expect(new Set(declarationKeys).size).toBe(declarationKeys.length);
	});

	it('records path-mapped and unresolved module occurrences without inventing a target', () => {
		const files = {
			'src/lib/value.ts': 'export const value = 1;\n',
			'src/main.ts':
				"import { value } from '@lib/value';\nimport { absent } from '@lib/missing';\nexport { value, absent };\n"
		};
		const testProgram = createTestProgram(files, Object.keys(files), {
			baseUrl: REPOSITORY_ROOT,
			paths: { '@lib/*': ['src/lib/*'] }
		});
		const raw = extractStaticRaw(extractionInput(testProgram, Object.keys(files).sort()));
		const resolved = raw.moduleResolutions.find((entry) => entry.specifier === '@lib/value');
		const unresolved = raw.moduleResolutions.find((entry) => entry.specifier === '@lib/missing');

		expect(resolved).toMatchObject({
			occurrenceKind: 'IMPORT',
			resolutionState: 'RESOLVED_SOURCE'
		});
		expect(raw.sources[resolved!.targetSourceOrdinal!]?.logicalPath).toBe('src/lib/value.ts');
		expect(unresolved).toMatchObject({
			moduleSymbolOrdinal: null,
			occurrenceKind: 'IMPORT',
			resolutionState: 'UNRESOLVED',
			targetSourceOrdinal: null
		});
		expect(raw.references.some((reference) => reference.resolutionState === 'UNRESOLVED')).toBe(
			true
		);
	});

	it('anchors context-only declarations without serializing context AST nodes', () => {
		const rootText =
			"import { context as local } from './context';\nexport const answer = local;\n";
		const contextText =
			'export interface ContextShape { value: string }\nexport const context: ContextShape = { value: "ok" };\n';
		const testProgram = createTestProgram(
			{ 'src/context.ts': contextText, 'src/root.ts': rootText },
			['src/root.ts']
		);
		const bindings = new Map<string, RawCompilerSourceBinding>([
			['src/root.ts', frozenBinding('src/root.ts', rootText)],
			[
				'src/context.ts',
				{
					artifact: null,
					byteBudgetClass: 'LIVE_COMPILER_CONTEXT',
					bytes: Buffer.byteLength(contextText),
					contentSha256: sha256(contextText),
					logicalPath: 'src/context.ts',
					mapping: { reason: 'Exact live context.', state: 'EXACT' },
					origin: 'GENERATED_DECLARATION',
					verificationState: 'VERIFIED_COMPILER_INPUT'
				}
			]
		]);
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/root.ts'], {}, bindings));
		const contextOrdinal = raw.sources.find(
			(source) => source.logicalPath === 'src/context.ts'
		)!.sourceOrdinal;
		const contextSymbol = raw.symbols.find((symbol) => symbol.name === 'context');

		expect(contextSymbol).toBeDefined();
		expect(contextSymbol!.declarationOrdinals.map((ordinal) => raw.declarations[ordinal]!)).toEqual(
			[
				expect.objectContaining({
					candidateNodeOrdinal: null,
					nodeOrdinal: null,
					sourceOrdinal: contextOrdinal
				})
			]
		);
		expect(raw.astNodes.some((node) => node.sourceOrdinal === contextOrdinal)).toBe(false);
	});

	it('marks type-only module syntax, retains literal dynamic imports, and exposes nonliteral dynamic imports without invented targets', () => {
		const files = {
			'src/types.ts': 'export interface Shape { value: string }\n',
			'src/runtime.ts': 'export const runtime = 1;\n',
			'src/input.ts': `
import type { Shape } from './types';
import type RuntimeModule = require('./runtime');
export type { Shape as PublicShape } from './types';
export { runtime } from './runtime';
type ImportedShape = import('./types').Shape;
const literalLoad = import('./runtime');
const requested = './runtime';
const computedLoad = import(requested);
const key = 'value';
const record = { value: 'ok' };
void record[key];
void record['value'];
void literalLoad;
void computedLoad;
void (null as unknown as RuntimeModule);
`
		};
		const testProgram = createTestProgram(files);
		const raw = extractStaticRaw(extractionInput(testProgram, Object.keys(files).sort()));
		const inputOrdinal = raw.sources.find(
			(source) => source.logicalPath === 'src/input.ts'
		)!.sourceOrdinal;
		const occurrences = raw.moduleResolutions.filter(
			(resolution) => resolution.sourceOrdinal === inputOrdinal
		);

		expect(
			occurrences
				.filter((entry) => entry.occurrenceKind === 'IMPORT')
				.map((entry) => entry.typeOnly)
		).toEqual([true]);
		expect(
			occurrences
				.filter((entry) => entry.occurrenceKind === 'IMPORT_EQUALS')
				.map((entry) => entry.typeOnly)
		).toEqual([true]);
		expect(
			occurrences
				.filter((entry) => entry.occurrenceKind === 'EXPORT')
				.map((entry) => entry.typeOnly)
				.sort()
		).toEqual([false, true]);
		expect(occurrences.filter((entry) => entry.occurrenceKind === 'IMPORT_TYPE')).toEqual([
			expect.objectContaining({ specifier: './types', specifierState: 'LITERAL', typeOnly: true })
		]);
		const dynamic = occurrences.filter((entry) => entry.occurrenceKind === 'DYNAMIC_IMPORT');
		expect(dynamic).toHaveLength(2);
		expect(dynamic).toContainEqual(
			expect.objectContaining({
				resolutionState: 'RESOLVED_SOURCE',
				specifier: './runtime',
				specifierState: 'LITERAL',
				typeOnly: false
			})
		);
		expect(dynamic).toContainEqual(
			expect.objectContaining({
				moduleSymbolOrdinal: null,
				resolutionState: 'UNSUPPORTED',
				specifier: null,
				specifierState: 'NON_LITERAL',
				targetSourceOrdinal: null,
				typeOnly: false
			})
		);

		const elementAccess = raw.astNodes.find(
			(node) =>
				node.sourceOrdinal === inputOrdinal &&
				node.kind === ts.SyntaxKind.ElementAccessExpression &&
				raw.astNodes.some(
					(child) =>
						child.sourceOrdinal === inputOrdinal &&
						child.parentNodeOrdinal === node.nodeOrdinal &&
						child.syntacticIdentifierText === 'key'
				)
		)!;
		const keyNode = raw.astNodes.find(
			(node) =>
				node.sourceOrdinal === inputOrdinal &&
				node.parentNodeOrdinal === elementAccess.nodeOrdinal &&
				node.syntacticIdentifierText === 'key'
		)!;
		expect(
			raw.references.find(
				(reference) =>
					reference.sourceOrdinal === inputOrdinal && reference.nodeOrdinal === keyNode.nodeOrdinal
			)?.role
		).toBe('SYMBOL_USE');
	});

	it('keeps checker facts deterministic and enforces independent exact fact and query budgets', () => {
		const filesA = {
			'src/z.ts': "export { alpha as omega } from './a';\n",
			'src/a.ts': 'export const alpha = 1;\n'
		};
		const filesB = { 'src/a.ts': filesA['src/a.ts'], 'src/z.ts': filesA['src/z.ts'] };
		const firstProgram = createTestProgram(filesA, ['src/z.ts', 'src/a.ts']);
		const secondProgram = createTestProgram(filesB, ['src/a.ts', 'src/z.ts']);
		const roots = ['src/a.ts', 'src/z.ts'];
		const first = extractStaticRaw(extractionInput(firstProgram, roots));
		const second = extractStaticRaw(extractionInput(secondProgram, roots));
		for (const key of [
			'aliases',
			'declarations',
			'moduleExports',
			'moduleResolutions',
			'references',
			'symbols'
		] as const) {
			expect(canonicalSemanticJson(first[key])).toBe(canonicalSemanticJson(second[key]));
		}
		const compilerFactCount =
			first.aliases.length +
			first.declarations.length +
			first.moduleExports.length +
			first.moduleResolutions.length +
			first.references.length +
			first.symbols.length;
		expect(compilerFactCount).toBeGreaterThan(1);
		expect(() =>
			extractStaticRaw(
				extractionInput(firstProgram, roots, {
					budgets: { ...BUDGETS, maxCompilerFacts: compilerFactCount }
				})
			)
		).not.toThrow();
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(firstProgram, roots, {
						budgets: { ...BUDGETS, maxCompilerFacts: compilerFactCount - 1 }
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(firstProgram, roots, {
						budgets: { ...BUDGETS, maxCompilerQueryInvocations: 1 }
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(firstProgram, roots, {
						budgets: { ...BUDGETS, maxCompilerQueries: 1 }
					})
				),
			'BUDGET_EXCEEDED'
		);
	});

	it('extracts deterministic Program-local TS_TYPE facts and only requested assignability judgments', () => {
		const model = [
			'export interface Named { name: string }',
			'export interface Tagged { tag: string }',
			'export type Choice = Named | Tagged;',
			'export type Both = Named & Tagged;',
			'export interface Box<T extends Named> { value: T }',
			'export function project(value: Named): string;',
			'export function project(value: Tagged): number;',
			'export function project(value: Named | Tagged): string | number {',
			"  return 'name' in value ? value.name : 1;",
			'}',
			''
		].join('\n');
		const use = [
			"import type { Both, Box, Named } from './model';",
			'export type Used = Box<Both>;',
			'export type Target = Named;',
			''
		].join('\n');
		const roots = ['src/model.ts', 'src/use.ts'];
		const emptyProgram = createTestProgram({ 'src/model.ts': model, 'src/use.ts': use }, roots);
		const assignabilitySpy = vi.spyOn(emptyProgram.program.getTypeChecker(), 'isTypeAssignableTo');
		extractStaticRaw(
			extractionInput(emptyProgram, roots, { assignabilityRequests: [], includeTypes: true })
		);
		expect(assignabilitySpy).not.toHaveBeenCalled();
		assignabilitySpy.mockRestore();

		const bothStart = use.indexOf('Both>');
		const namedStart = use.lastIndexOf('Named;');
		const assignabilityRequests = [
			{
				requestId: 'both-to-named',
				requesterRef: 'test:both-to-named',
				source: {
					end: bothStart + 'Both'.length,
					logicalPath: 'src/use.ts',
					queryMode: 'TYPE_AT_LOCATION' as const,
					start: bothStart,
					syntaxKind: ts.SyntaxKind.Identifier
				},
				target: {
					end: namedStart + 'Named'.length,
					logicalPath: 'src/use.ts',
					queryMode: 'TYPE_AT_LOCATION' as const,
					start: namedStart,
					syntaxKind: ts.SyntaxKind.Identifier
				}
			}
		];
		const firstProgram = createTestProgram({ 'src/model.ts': model, 'src/use.ts': use }, [
			'src/model.ts',
			'src/use.ts'
		]);
		const secondProgram = createTestProgram({ 'src/use.ts': use, 'src/model.ts': model }, [
			'src/use.ts',
			'src/model.ts'
		]);
		const first = extractStaticRaw(
			extractionInput(firstProgram, roots, { assignabilityRequests, includeTypes: true })
		);
		const second = extractStaticRaw(
			extractionInput(secondProgram, roots, { assignabilityRequests, includeTypes: true })
		);
		for (const key of [
			'overloadSets',
			'signatureParameters',
			'signatures',
			'typeParameters',
			'typeRelations',
			'types'
		] as const)
			expect(canonicalSemanticJson(second[key]), key).toBe(canonicalSemanticJson(first[key]));
		const relationKinds = new Set(first.typeRelations.map((relation) => relation.kind));
		for (const kind of [
			'UNION_CONSTITUENT',
			'INTERSECTION_CONSTITUENT',
			'GENERIC_INSTANTIATION',
			'PARAMETER_CONSTRAINT',
			'OVERLOAD_MEMBERSHIP',
			'ASSIGNABILITY'
		] as const)
			expect(relationKinds.has(kind), kind).toBe(true);
		expect(
			first.typeRelations.find(
				(relation) => relation.kind === 'ASSIGNABILITY' && relation.requestId === 'both-to-named'
			)
		).toMatchObject({ result: true, state: 'CONFIRMED' });

		const compilerFactCount =
			first.aliases.length +
			first.declarations.length +
			first.moduleExports.length +
			first.moduleResolutions.length +
			first.overloadSets.length +
			first.references.length +
			first.signatureParameters.length +
			first.signatures.length +
			first.symbols.length +
			first.typeParameters.length +
			first.typeRelations.length +
			first.types.length;
		expect(compilerFactCount).toBeGreaterThan(1);
		expect(() =>
			extractStaticRaw(
				extractionInput(createTestProgram({ 'src/model.ts': model, 'src/use.ts': use }), roots, {
					assignabilityRequests,
					budgets: { ...BUDGETS, maxCompilerFacts: compilerFactCount },
					includeTypes: true
				})
			)
		).not.toThrow();
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(createTestProgram({ 'src/model.ts': model, 'src/use.ts': use }), roots, {
						assignabilityRequests,
						budgets: { ...BUDGETS, maxCompilerFacts: compilerFactCount - 1 },
						includeTypes: true
					})
				),
			'BUDGET_EXCEEDED'
		);
	});

	it('keeps instantiated generic call and construct views distinct without inventing overloads', () => {
		const model = [
			'export interface GenericCall<T> { (value: T): T }',
			'export type StringCall = GenericCall<string>;',
			'export interface GenericConstruct<T> { new (value: T): { value: T } }',
			'export type StringConstruct = GenericConstruct<string>;',
			''
		].join('\n');
		const roots = ['src/model.ts'];
		const raw = extractStaticRaw(
			extractionInput(createTestProgram({ 'src/model.ts': model }, roots), roots, {
				includeTypes: true
			})
		);

		for (const role of ['CALL_SIGNATURE', 'CONSTRUCT_SIGNATURE'] as const) {
			const signatures = raw.signatures.filter((signature) => signature.declarationRole === role);
			expect(signatures.length, role).toBeGreaterThanOrEqual(2);
			expect(new Set(signatures.map((signature) => signature.declarationOrdinal)).size, role).toBe(
				1
			);
			expect(new Set(signatures.map((signature) => signature.identityBasis)), role).toEqual(
				new Set(['DECLARATION_ANCHORED', 'OWNER_ORDINAL'])
			);
			expect(
				signatures.filter((signature) => signature.identityBasis === 'DECLARATION_ANCHORED'),
				role
			).toHaveLength(1);
			const instantiated = signatures.filter(
				(signature) => signature.identityBasis === 'OWNER_ORDINAL'
			);
			expect(instantiated.length, role).toBeGreaterThanOrEqual(1);
			expect(
				instantiated.every(
					(signature) => signature.owner.kind === 'TYPE' && signature.providerOrdinal !== null
				),
				role
			).toBe(true);
			expect(new Set(signatures.map((signature) => signature.fingerprintSha256)).size, role).toBe(
				signatures.length
			);
			expect(
				signatures.every((signature) => signature.semanticKind === 'SIGNATURE'),
				role
			).toBe(true);
		}
		expect(raw.overloadSets).toHaveLength(0);
		expect(
			raw.typeRelations.filter((relation) => relation.kind === 'OVERLOAD_MEMBERSHIP')
		).toHaveLength(0);
	});

	it('loads bounds only for represented type parameters, not synthetic polymorphic-this types', () => {
		const model = [
			'export interface Fluent { chain(): this }',
			'export interface Box<T extends Fluent = Fluent> { value: T }',
			'export interface Factory { <U extends Fluent = Fluent>(value: U): U }',
			'export declare const fluent: Fluent;',
			''
		].join('\n');
		const roots = ['src/model.ts'];
		const raw = extractStaticRaw(
			extractionInput(createTestProgram({ 'src/model.ts': model }, roots), roots, {
				includeTypes: true
			})
		);
		const representedTypeOrdinals = new Set(
			raw.typeParameters.map((parameter) => parameter.parameterTypeOrdinal)
		);
		const unrepresentedCompilerTypeOrdinals = new Set(
			raw.types
				.filter(
					(type) =>
						(type.flags & ts.TypeFlags.TypeParameter) !== 0 &&
						!representedTypeOrdinals.has(type.typeOrdinal)
				)
				.map((type) => type.typeOrdinal)
		);
		expect(unrepresentedCompilerTypeOrdinals.size).toBeGreaterThanOrEqual(1);
		const unrepresentedBoundAnchors = raw.types.flatMap((type) =>
			type.acquisitionAnchors.filter(
				(anchor) =>
					anchor.kind === 'TYPE_COMPONENT' &&
					['GENERIC_TARGET', 'TYPE_ARGUMENT'].includes(anchor.componentKind) &&
					unrepresentedCompilerTypeOrdinals.has(anchor.parentTypeOrdinal)
			)
		);
		expect(unrepresentedBoundAnchors).toEqual([]);
		expect(raw.typeParameters.find((parameter) => parameter.name === 'T')).toMatchObject({
			constraintState: 'RESOLVED',
			defaultState: 'RESOLVED'
		});
		expect(raw.typeParameters.find((parameter) => parameter.name === 'U')).toMatchObject({
			constraintState: 'RESOLVED',
			defaultState: 'RESOLVED',
			owner: { kind: 'SIGNATURE' }
		});
	});

	it('retains heritage and signature evidence while bounding unsupported compiler type structures', () => {
		const model = [
			'export interface Base<T> { value: T }',
			'export interface Derived extends Base<string> {',
			'  invoke(this: Derived, value?: string, ...rest: boolean[]): void;',
			'}',
			'export class Impl implements Base<number> { value = 1; }',
			'export interface Callable {',
			'  (this: Derived, value: string): number;',
			'  (value: number): string;',
			'  new (value: string): Derived;',
			'  new (value: number): Impl;',
			'}',
			'export declare function ambient(value: string): number;',
			'export declare function ambient(value: number): string;',
			'export type Literal = "literal";',
			'export type Conditional<T> = T extends string ? "yes" : 0;',
			'export type Indexed<T extends { value: unknown }> = T["value"];',
			'export type IndexTarget<T> = keyof T;',
			'export type Template<T extends string> = `prefix-${T}`;',
			'export type Uppercase<S extends string> = intrinsic;',
			'export type StringMapped<T extends string> = Uppercase<T>;',
			'export type Mapped<T> = { [K in keyof T]: T[K] };',
			''
		].join('\n');
		const roots = ['src/type-structures.ts'];
		const raw = extractStaticRaw(
			extractionInput(createTestProgram({ 'src/type-structures.ts': model }, roots), roots, {
				includeTypes: true
			})
		);

		const heritage = raw.typeRelations.filter(
			(
				relation
			): relation is Extract<
				(typeof raw.typeRelations)[number],
				{ kind: 'TYPE_EXTENSION' | 'TYPE_IMPLEMENTATION' }
			> => relation.kind === 'TYPE_EXTENSION' || relation.kind === 'TYPE_IMPLEMENTATION'
		);
		expect(new Set(heritage.map((relation) => relation.kind))).toEqual(
			new Set(['TYPE_EXTENSION', 'TYPE_IMPLEMENTATION'])
		);
		expect(
			heritage.every(
				(relation) =>
					relation.state === 'CONFIRMED' && relation.heritageOccurrence.kind === 'AST_NODE'
			)
		).toBe(true);

		const boundedKinds = new Set(
			raw.types
				.filter((type) => type.structureState === 'BOUNDED')
				.flatMap((type) => type.unsupportedStructureKinds)
		);
		for (const kind of [
			'CONDITIONAL',
			'INDEXED_ACCESS',
			'INDEX_TARGET',
			'MAPPED',
			'STRING_MAPPING',
			'TEMPLATE_LITERAL'
		])
			expect(boundedKinds.has(kind), kind).toBe(true);
		expect(
			raw.types
				.filter((type) => type.structureState === 'COMPLETE')
				.every((type) => type.unsupportedStructureKinds.length === 0)
		).toBe(true);
		expect(raw.types.some((type) => type.category === 'LITERAL')).toBe(true);
		expect(raw.types.some((type) => type.category === 'INDEX')).toBe(true);

		expect(raw.signatureParameters).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'this', optional: false, rest: false, role: 'THIS' }),
				expect.objectContaining({ name: 'value', optional: true, role: 'PARAMETER' }),
				expect.objectContaining({ name: 'rest', rest: true, role: 'PARAMETER' })
			])
		);
		const declarationRoles = new Set(raw.signatures.map((signature) => signature.declarationRole));
		for (const role of ['AMBIENT_OVERLOAD', 'CALL_SIGNATURE', 'CONSTRUCT_SIGNATURE'] as const)
			expect(declarationRoles.has(role), role).toBe(true);
		const membershipRoles = new Set(
			raw.typeRelations.flatMap((relation) =>
				relation.kind === 'OVERLOAD_MEMBERSHIP' ? [relation.role] : []
			)
		);
		for (const role of ['AMBIENT_OVERLOAD', 'CALL_SIGNATURE', 'CONSTRUCT_SIGNATURE'] as const)
			expect(membershipRoles.has(role), role).toBe(true);
	});

	it('honors every assignability selector mode and retains unresolved boundaries without invented judgments', () => {
		const model = [
			'export interface Named { name: string }',
			'export type Alias = Named;',
			'export const named: Named = { name: "value" };',
			'export const other: Named = named;',
			'export const answer = 42;',
			''
		].join('\n');
		const logicalPath = 'src/selector-modes.ts';
		const roots = [logicalPath];
		const namedDeclarationStart = model.indexOf('Named');
		const aliasTypeStart = model.indexOf('Named', namedDeclarationStart + 'Named'.length);
		const namedValueStart = model.indexOf('named:');
		const otherValueStart = model.indexOf('other:');
		const literalStart = model.indexOf('42');
		const selector = <
			Mode extends
				| 'DECLARED_SYMBOL_TYPE'
				| 'TYPE_AT_LOCATION'
				| 'TYPE_FROM_TYPE_NODE'
				| 'VALUE_SYMBOL_TYPE_AT_LOCATION'
		>(
			start: number,
			text: string,
			syntaxKind: ts.SyntaxKind,
			queryMode: Mode
		) => ({
			end: start + text.length,
			logicalPath,
			queryMode,
			start,
			syntaxKind
		});
		const declaredNamed = selector(
			namedDeclarationStart,
			'Named',
			ts.SyntaxKind.Identifier,
			'DECLARED_SYMBOL_TYPE'
		);
		const aliasType = selector(
			aliasTypeStart,
			'Named',
			ts.SyntaxKind.TypeReference,
			'TYPE_FROM_TYPE_NODE'
		);
		const namedValue = selector(
			namedValueStart,
			'named',
			ts.SyntaxKind.Identifier,
			'VALUE_SYMBOL_TYPE_AT_LOCATION'
		);
		const otherValue = selector(
			otherValueStart,
			'other',
			ts.SyntaxKind.Identifier,
			'VALUE_SYMBOL_TYPE_AT_LOCATION'
		);
		const declaredModeOnLiteral = selector(
			literalStart,
			'42',
			ts.SyntaxKind.NumericLiteral,
			'DECLARED_SYMBOL_TYPE'
		);
		const typeNodeModeOnIdentifier = {
			...declaredNamed,
			queryMode: 'TYPE_FROM_TYPE_NODE' as const
		};
		const assignabilityRequests = [
			{
				requestId: 'declared-to-type-node',
				requesterRef: 'test:declared-to-type-node',
				source: declaredNamed,
				target: aliasType
			},
			{
				requestId: 'value-to-value',
				requesterRef: 'test:value-to-value',
				source: namedValue,
				target: otherValue
			},
			{
				requestId: 'type-node-mode-on-identifier',
				requesterRef: 'test:type-node-mode-on-identifier',
				source: typeNodeModeOnIdentifier,
				target: aliasType
			},
			{
				requestId: 'declared-mode-on-literal',
				requesterRef: 'test:declared-mode-on-literal',
				source: declaredModeOnLiteral,
				target: aliasType
			}
		];
		const raw = extractStaticRaw(
			extractionInput(createTestProgram({ [logicalPath]: model }, roots), roots, {
				assignabilityRequests,
				includeTypes: true
			})
		);
		const assignability = new Map(
			raw.typeRelations.flatMap((relation) =>
				relation.kind === 'ASSIGNABILITY' ? [[relation.requestId, relation] as const] : []
			)
		);
		expect(assignability.get('declared-to-type-node')).toMatchObject({
			checkerContextDigest: 'c'.repeat(64),
			result: true,
			state: 'CONFIRMED',
			sourceTypeOrdinal: expect.any(Number),
			targetTypeOrdinal: expect.any(Number)
		});
		expect(assignability.get('value-to-value')).toMatchObject({
			result: true,
			state: 'CONFIRMED',
			sourceTypeOrdinal: expect.any(Number),
			targetTypeOrdinal: expect.any(Number)
		});
		for (const requestId of ['type-node-mode-on-identifier', 'declared-mode-on-literal'])
			expect(assignability.get(requestId)).toMatchObject({
				result: null,
				sourceTypeOrdinal: null,
				state: 'UNRESOLVED',
				targetTypeOrdinal: expect.any(Number)
			});
		const queryModes = new Set(
			raw.typeRelations.flatMap((relation) =>
				relation.kind === 'TYPE_OF' ? [relation.queryMode] : []
			)
		);
		for (const mode of [
			'DECLARED_SYMBOL_TYPE',
			'TYPE_AT_LOCATION',
			'TYPE_FROM_TYPE_NODE',
			'VALUE_SYMBOL_TYPE_AT_LOCATION'
		] as const)
			expect(queryModes.has(mode), mode).toBe(true);

		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(createTestProgram({ [logicalPath]: model }, roots), roots, {
						assignabilityRequests: [assignabilityRequests[0]!],
						includeTypes: true,
						resolveCheckerContextDigest: () => 'not-a-digest'
					})
				),
			'INVALID_INPUT'
		);

		const failingProgram = createTestProgram({ [logicalPath]: model }, roots);
		const typeQuery = vi
			.spyOn(failingProgram.program.getTypeChecker(), 'getTypeFromTypeNode')
			.mockImplementation(() => {
				throw new Error('type query unavailable');
			});
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(failingProgram, roots, {
						assignabilityRequests: [assignabilityRequests[0]!],
						includeTypes: true
					})
				),
			'INVALID_INPUT'
		);
		typeQuery.mockRestore();
	});

	it('keeps the extraction-ledger capability protocol phase-, binding-, and issuer-exact', () => {
		const operation = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		const binding = operation.providerBinding();
		expectTypedFailure(
			() => createStaticRawExtractionBudgetLedger(BUDGETS, 'VALIDATE' as never, binding),
			'INVALID_INPUT'
		);
		expectTypedFailure(
			() => createStaticRawExtractionBudgetLedger(BUDGETS, 'EXTRACT', null as never),
			'INVALID_INPUT'
		);
		expectTypedFailure(
			() => finalizeStaticRawExtractionBudgetLedger(Object.freeze({}) as never),
			'INVALID_INPUT'
		);

		const testProgram = createTestProgram({ 'src/protocol.ts': 'export const value = 1;\n' });
		const ledger = createStaticRawExtractionBudgetLedger(BUDGETS, 'CAPTURE', binding);
		extractStaticRaw(extractionInput(testProgram, ['src/protocol.ts'], { budgetLedger: ledger }));
		const evidence = finalizeStaticRawExtractionBudgetLedger(ledger);
		expectTypedFailure(
			() =>
				takeStaticRawExtractionBudgetEvidence(
					evidence,
					Object.freeze(Object.create(null)) as never,
					'CAPTURE',
					sha256(canonicalSemanticJson(BUDGETS))
				),
			'INVALID_INPUT'
		);
	});

	it('rejects malformed diagnostic protocol values without weakening valid source coordinates', () => {
		const text = 'export const value = 1;\n';
		const testProgram = createTestProgram({ 'src/diagnostic-protocol.ts': text });
		const sourceFile = testProgram.program.getSourceFile(absolute('src/diagnostic-protocol.ts'))!;
		const base: ts.Diagnostic = {
			category: ts.DiagnosticCategory.Error,
			code: 9001,
			file: sourceFile,
			length: 1,
			messageText: 'failure',
			start: 0
		};
		const rejectDiagnostic = (diagnostic: ts.Diagnostic): void =>
			expectTypedFailure(
				() =>
					extractStaticRaw(
						extractionInput(testProgram, ['src/diagnostic-protocol.ts'], {
							diagnosticFamilies: diagnosticFamilies([diagnostic])
						})
					),
				'DIAGNOSTIC_INVALID'
			);

		rejectDiagnostic({ ...base, messageText: '' });
		rejectDiagnostic({
			...base,
			messageText: {
				category: ts.DiagnosticCategory.Error,
				code: 0,
				messageText: 'invalid chain'
			}
		});
		rejectDiagnostic({ ...base, length: undefined });
		rejectDiagnostic({ ...base, length: 2, start: text.length - 1 });
		rejectDiagnostic({ ...base, code: 0 });
		rejectDiagnostic({
			...base,
			relatedInformation: [
				{
					category: ts.DiagnosticCategory.Message,
					code: 0,
					file: sourceFile,
					length: 1,
					messageText: 'invalid related diagnostic',
					start: 0
				}
			]
		});

		const failedWithFacts = diagnosticFamilies().map((family) =>
			family.family === 'SYNTACTIC'
				? { ...family, diagnostics: [base], state: 'FAILED' as const }
				: family
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/diagnostic-protocol.ts'], {
						diagnosticFamilies: failedWithFacts
					})
				),
			'INVALID_INPUT'
		);
		const emptyReason = diagnosticFamilies().map((family, index) =>
			index === 0 ? { ...family, reason: '' } : family
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/diagnostic-protocol.ts'], {
						diagnosticFamilies: emptyReason
					})
				),
			'INVALID_INPUT'
		);
	});

	it('fails closed on malformed checker, recipe roots, mapped source identity, and evidence metadata', () => {
		const text = 'export const value = 1;\n';
		const testProgram = createTestProgram({ 'src/input-contract.ts': text });
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input-contract.ts'], { checker: {} as ts.TypeChecker })
				),
			'INVALID_INPUT'
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input-contract.ts'], {
						deadlineMs: Date.now() + 10_000.25
					})
				),
			'INVALID_INPUT'
		);

		const wrongRoots = recipe(['src/other.ts']);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/input-contract.ts'], {
						programRecipe: wrongRoots,
						project: project(wrongRoots)
					})
				),
			'IDENTITY_MISMATCH'
		);

		const collidingProgram = createTestProgram({
			'src/a.ts': 'export const a = 1;\n',
			'src/b.ts': 'export const b = 2;\n'
		});
		const singleMappedRoot = recipe(['src/collision.ts']);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(collidingProgram, ['src/a.ts', 'src/b.ts'], {
						programRecipe: singleMappedRoot,
						project: project(singleMappedRoot),
						resolveCompilerSource: () => frozenBinding('src/collision.ts', text),
						toLogicalPath: () => 'src/collision.ts'
					})
				),
			'PATH_MAPPING_FAILED'
		);

		const malformedEvidence = {
			...frozenBinding('src/input-contract.ts', text),
			contentSha256: 'not-a-digest'
		};
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(
						testProgram,
						['src/input-contract.ts'],
						{},
						new Map([['src/input-contract.ts', malformedEvidence]])
					)
				),
			'SOURCE_EVIDENCE_MISSING'
		);
	});

	it('rejects impossible AST identity, span, and declaration-name projections', () => {
		const mutateAndReject = (
			text: string,
			select: (sourceFile: ts.SourceFile) => ts.Node,
			mutate: (node: ts.Node, sourceFile: ts.SourceFile) => void,
			code: StaticRawExtractionError['code']
		): void => {
			const testProgram = createTestProgram({ 'src/mutated.ts': text });
			const sourceFile = testProgram.program.getSourceFile(absolute('src/mutated.ts'))!;
			mutate(select(sourceFile), sourceFile);
			expectTypedFailure(
				() => extractStaticRaw(extractionInput(testProgram, ['src/mutated.ts'])),
				code
			);
		};
		const firstVariableName = (sourceFile: ts.SourceFile): ts.Identifier =>
			(sourceFile.statements[0] as ts.VariableStatement).declarationList.declarations[0]!
				.name as ts.Identifier;

		mutateAndReject(
			'const value = 1;\n',
			firstVariableName,
			(node) => Object.defineProperty(node, 'kind', { configurable: true, value: 999_999 }),
			'UNSUPPORTED_SYNTAX'
		);
		mutateAndReject(
			'const value = 1;\n',
			firstVariableName,
			(node, sourceFile) =>
				Object.defineProperty(node, 'end', {
					configurable: true,
					value: sourceFile.text.length + 1
				}),
			'UNSUPPORTED_SYNTAX'
		);
		mutateAndReject(
			"class Example { '' = 1; }\n",
			(sourceFile) => (sourceFile.statements[0] as ts.ClassDeclaration).members[0]!.name!,
			(node, sourceFile) =>
				Object.defineProperty(node, 'end', {
					configurable: true,
					value: node.getStart(sourceFile)
				}),
			'UNSUPPORTED_SYNTAX'
		);
		mutateAndReject(
			'const value = 1;\n',
			firstVariableName,
			(node) => Object.defineProperty(node, 'text', { configurable: true, value: '\ud800' }),
			'UNSUPPORTED_SYNTAX'
		);
		mutateAndReject(
			'const value = 1;\n',
			(sourceFile) => sourceFile,
			(node) => {
				const sourceFile = node as ts.SourceFile;
				const statement = sourceFile.statements[0]!;
				Object.defineProperty(sourceFile, 'statements', {
					configurable: true,
					value: ts.factory.createNodeArray([statement, statement])
				});
			},
			'AST_PARENT_CONFLICT'
		);
	});

	it('exercises module strictness, function-expression scopes, ambient modules, and unresolved aliases', () => {
		const strictText = `
export {};
{ function moduleBlock() {} }
function outer() {
  "use strict";
  { function functionBlock() {} }
}
const callable = function namedFunction() { return namedFunction; };
const constructable = class NamedClass {};
`;
		const strictProgram = createTestProgram({ 'src/strictness.ts': strictText }, undefined, {
			alwaysStrict: false,
			strict: false
		});
		const strictRaw = extractStaticRaw(extractionInput(strictProgram, ['src/strictness.ts']));
		const strictScopeByOrdinal = new Map(
			strictRaw.scopes.map((scope) => [scope.scopeOrdinal, scope] as const)
		);
		for (const name of ['moduleBlock', 'functionBlock'])
			expect(strictRaw.declarations.find((declaration) => declaration.name === name)).toMatchObject(
				{
					scopeLinkState: 'RESOLVED'
				}
			);
		for (const [name, kind] of [
			['namedFunction', 'FUNCTION'],
			['NamedClass', 'CLASS']
		] as const) {
			const declaration = strictRaw.declarations.find((candidate) => candidate.name === name)!;
			expect(strictScopeByOrdinal.get(declaration.declaringScopeOrdinal!)).toMatchObject({ kind });
		}

		const nonDirective = createTestProgram(
			{ 'src/non-directive.ts': '"not strict"; { function blockLocal() {} }\n' },
			undefined,
			{ alwaysStrict: false, strict: false }
		);
		const nonDirectiveRaw = extractStaticRaw(
			extractionInput(nonDirective, ['src/non-directive.ts'])
		);
		expect(
			nonDirectiveRaw.declarations.find((record) => record.name === 'blockLocal')
		).toMatchObject({
			scopeLinkState: 'UNSUPPORTED'
		});

		const ambientFiles = {
			'src/ambient.d.ts': 'declare module "pkg" { export const value: number; }\n',
			'src/main.ts': 'import { value as local } from "pkg"; export { local };\n'
		};
		const ambientProgram = createTestProgram(ambientFiles, Object.keys(ambientFiles).sort());
		const ambientRaw = extractStaticRaw(
			extractionInput(ambientProgram, Object.keys(ambientFiles).sort())
		);
		expect(
			ambientRaw.moduleResolutions.find((resolution) => resolution.specifier === 'pkg')
		).toMatchObject({ resolutionState: 'RESOLVED_AMBIENT', targetSourceOrdinal: null });

		const unresolvedFiles = {
			'src/base.ts': 'export const present = 1;\n',
			'src/use.ts': 'import { missing } from "./base"; void missing;\n'
		};
		const unresolvedProgram = createTestProgram(
			unresolvedFiles,
			Object.keys(unresolvedFiles).sort()
		);
		const unresolvedRaw = extractStaticRaw(
			extractionInput(unresolvedProgram, Object.keys(unresolvedFiles).sort())
		);
		expect(unresolvedRaw.aliases.some((alias) => alias.state === 'UNRESOLVED')).toBe(true);
	});

	it('poisons incomplete shared ledgers and rejects duplicate project extraction', () => {
		const testProgram = createTestProgram({ 'src/ledger.ts': 'export const value = 1;\n' });
		const constrained = { ...BUDGETS, maxAstNodes: 1 };
		const constrainedSession = createStaticSemanticOperationBudgetSession(constrained, Date.now());
		const incompleteLedger = createStaticRawExtractionBudgetLedger(
			constrained,
			'EXTRACT',
			constrainedSession.providerBinding()
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/ledger.ts'], {
						budgetLedger: incompleteLedger,
						budgets: constrained
					})
				),
			'BUDGET_EXCEEDED'
		);
		expectTypedFailure(
			() => finalizeStaticRawExtractionBudgetLedger(incompleteLedger),
			'INVALID_INPUT'
		);

		const operation = createStaticSemanticOperationBudgetSession(BUDGETS, Date.now());
		const duplicateLedger = createStaticRawExtractionBudgetLedger(
			BUDGETS,
			'EXTRACT',
			operation.providerBinding()
		);
		extractStaticRaw(
			extractionInput(testProgram, ['src/ledger.ts'], { budgetLedger: duplicateLedger })
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(testProgram, ['src/ledger.ts'], { budgetLedger: duplicateLedger })
				),
			'INVALID_INPUT'
		);
	});

	it('fails closed on produced-path, project-path, evidence-class, and declaration-name contradictions', () => {
		const longContext = 'src/a-very-long-imported-context.ts';
		const contextProgram = createTestProgram(
			{
				[longContext]: 'export const context = 1;\n',
				'src/root.ts': `import { context } from "./a-very-long-imported-context"; void context;\n`
			},
			['src/root.ts']
		);
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(contextProgram, ['src/root.ts'], {
						budgets: { ...BUDGETS, maxPathCharacters: 20 }
					})
				),
			'BUDGET_EXCEEDED'
		);

		const rootProgram = createTestProgram({ 'src/root.ts': 'export const root = 1;\n' });
		const rootRecipe = recipe(['src/root.ts']);
		for (const [frameworkCandidate, maxPathCharacters, code] of [
			['../outside', BUDGETS.maxPathCharacters, 'INVALID_INPUT'],
			['framework/' + 'x'.repeat(40), 20, 'BUDGET_EXCEEDED']
		] as const)
			expectTypedFailure(
				() =>
					extractStaticRaw(
						extractionInput(rootProgram, ['src/root.ts'], {
							budgets: { ...BUDGETS, maxPathCharacters },
							programRecipe: rootRecipe,
							project: project(rootRecipe, { frameworkCandidates: [frameworkCandidate] })
						})
					),
				code
			);

		expectTypedFailure(
			() => extractStaticRaw(extractionInput(rootProgram, ['src/root.ts'], {}, new Map())),
			'SOURCE_EVIDENCE_MISSING'
		);

		const liveRoot: RawCompilerSourceBinding = {
			...frozenBinding('src/root.ts', 'export const root = 1;\n'),
			artifact: null,
			byteBudgetClass: 'LIVE_COMPILER_CONTEXT',
			origin: 'GENERATED'
		};
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(rootProgram, ['src/root.ts'], {}, new Map([['src/root.ts', liveRoot]]))
				),
			'SOURCE_POLICY_MISMATCH'
		);

		const importedText = 'export declare const imported: true;\n';
		const importedProgram = createTestProgram(
			{
				'src/context.d.ts': importedText,
				'src/root.ts': 'import { imported } from "./context"; void imported;\n'
			},
			['src/root.ts']
		);
		const contradictoryContext: RawCompilerSourceBinding = {
			...frozenBinding('src/context.d.ts', importedText),
			byteBudgetClass: 'LIVE_COMPILER_CONTEXT',
			origin: 'GENERATED'
		};
		expectTypedFailure(
			() =>
				extractStaticRaw(
					extractionInput(
						importedProgram,
						['src/root.ts'],
						{},
						new Map([
							['src/context.d.ts', contradictoryContext],
							[
								'src/root.ts',
								frozenBinding(
									'src/root.ts',
									'import { imported } from "./context"; void imported;\n'
								)
							]
						])
					)
				),
			'SOURCE_POLICY_MISMATCH'
		);

		const malformedNameProgram = createTestProgram({ 'src/name.ts': 'const value = 1;\n' });
		const malformedNameSource = malformedNameProgram.program.getSourceFile(
			absolute('src/name.ts')
		)!;
		const malformedName = (malformedNameSource.statements[0] as ts.VariableStatement)
			.declarationList.declarations[0]!.name;
		Object.defineProperty(malformedName, 'kind', {
			configurable: true,
			value: ts.SyntaxKind.ThisKeyword
		});
		expectTypedFailure(
			() => extractStaticRaw(extractionInput(malformedNameProgram, ['src/name.ts'])),
			'UNSUPPORTED_SYNTAX'
		);
	});

	it('classifies function-prologue strictness and checker-reported unknown and circular aliases', () => {
		const strictProgram = createTestProgram(
			{
				'src/function-strict.ts': 'function outer() { "use strict"; { function local() {} } }\n'
			},
			undefined,
			{ alwaysStrict: false, strict: false }
		);
		const strictRaw = extractStaticRaw(extractionInput(strictProgram, ['src/function-strict.ts']));
		expect(
			strictRaw.declarations.find((declaration) => declaration.name === 'local')
		).toMatchObject({
			scopeLinkState: 'RESOLVED'
		});

		const aliasFiles = {
			'src/base.ts': 'export const value = 1;\n',
			'src/use.ts': 'import { value as local } from "./base"; void local;\n'
		};
		const unknownProgram = createTestProgram(aliasFiles, Object.keys(aliasFiles).sort());
		const unknownChecker = unknownProgram.program.getTypeChecker();
		const unknownProxy = new Proxy(unknownChecker, {
			get(target, property) {
				if (property === 'isUnknownSymbol') return () => true;
				const value = Reflect.get(target, property, target) as unknown;
				return typeof value === 'function' ? value.bind(target) : value;
			}
		});
		const unknownRaw = extractStaticRaw(
			extractionInput(unknownProgram, Object.keys(aliasFiles).sort(), { checker: unknownProxy })
		);
		expect(unknownRaw.aliases.some((alias) => alias.state === 'UNRESOLVED')).toBe(true);

		const circularProgram = createTestProgram(aliasFiles, Object.keys(aliasFiles).sort());
		const circularChecker = circularProgram.program.getTypeChecker();
		const circularProxy = new Proxy(circularChecker, {
			get(target, property) {
				if (property === 'getImmediateAliasedSymbol') return (symbol: ts.Symbol) => symbol;
				if (property === 'isUnknownSymbol') return () => false;
				const value = Reflect.get(target, property, target) as unknown;
				return typeof value === 'function' ? value.bind(target) : value;
			}
		});
		const circularRaw = extractStaticRaw(
			extractionInput(circularProgram, Object.keys(aliasFiles).sort(), { checker: circularProxy })
		);
		expect(circularRaw.aliases.some((alias) => alias.state === 'CIRCULAR')).toBe(true);
		const circularReferences = circularRaw.references.filter(
			(reference) => reference.resolutionState === 'UNSUPPORTED'
		);
		expect(circularReferences.length).toBeGreaterThan(0);
		for (const reference of circularReferences)
			expect(reference).toMatchObject({
				resolvedSymbolOrdinal: null,
				symbolOrdinal: null
			});
	});

	it('fails closed when TypeScript exposes an atomic declaration name that is not Unicode scalar text', () => {
		const unpairedSurrogate = String.fromCharCode(0xd800);
		const text = 'export interface Unsafe { "member": number; }\n';
		const testProgram = createTestProgram({ 'src/non-scalar-name.ts': text });
		const sourceFile = testProgram.program.getSourceFile(absolute('src/non-scalar-name.ts'))!;
		const declaration = sourceFile.statements[0] as ts.InterfaceDeclaration;
		const name = declaration.members[0]!.name as ts.StringLiteral;
		Object.defineProperty(name, 'text', { configurable: true, value: unpairedSurrogate });

		expectTypedFailure(
			() => extractStaticRaw(extractionInput(testProgram, ['src/non-scalar-name.ts'])),
			'INVALID_INPUT'
		);
	});
});
