import { Buffer } from 'node:buffer';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { ProgramRecipe, ProjectSubjectRecord } from '../../contracts/subject.js';
import { TYPESCRIPT_PROVIDER_VERSION, type SemanticBudgets, type SemanticDiagnosticFamily } from '../../contracts/semantic.js';
import { sha256 } from '../../inventory/canonical.js';
import { canonicalSemanticJson } from '../../semantic/canonical.js';
import { programRecipeDigest } from '../../semantic/ids.js';
import type { RawCompilerSourceBinding } from '../../semantic/raw-semantic-model.js';
import { createStaticRawExtractionBudgetLedger, extractStaticRaw, RAW_DIAGNOSTIC_FAMILIES, StaticRawExtractionError, type ExtractStaticRawInput, type StaticRawDiagnosticFamilyInput } from './extract-static-raw.js';

const BUDGETS: SemanticBudgets = {
	maxAstDepth: 128,
	maxAstNodes: 10_000,
	maxCompilerInputMetadataBytes: 1_000_000,
	maxCompilerQueries: 10_000,
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
	maxSources: 1_000
};

const REPOSITORY_ROOT = '/repo';

function absolute(logicalPath: string): string {
	return `${REPOSITORY_ROOT}/${logicalPath}`;
}

function logical(path: string): string {
	const normalized = path.replaceAll('\\', '/');
	if (normalized === REPOSITORY_ROOT) return '.';
	if (!normalized.startsWith(`${REPOSITORY_ROOT}/`)) throw new Error(`outside test repository: ${path}`);
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

function createTestProgram(filesValue: Readonly<Record<string, string>>, rootNames = Object.keys(filesValue), optionOverrides: ts.CompilerOptions = {}): TestProgram {
	const files = new Map(Object.entries(filesValue).map(([path, text]) => [absolute(path), text] as const));
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
		directoryExists: (directoryName) => directoryName === REPOSITORY_ROOT || [...files.keys()].some((path) => path.startsWith(`${directoryName.replaceAll('\\', '/')}/`)),
		fileExists: (fileName) => files.has(fileName.replaceAll('\\', '/')),
		getCanonicalFileName: (fileName) => fileName,
		getCurrentDirectory: () => REPOSITORY_ROOT,
		getDefaultLibFileName: () => absolute('lib.d.ts'),
		getNewLine: () => '\n',
		getSourceFile: (fileName, languageVersion) => {
			const canonical = fileName.replaceAll('\\', '/');
			const text = files.get(canonical);
			return text === undefined ? undefined : ts.createSourceFile(canonical, text, languageVersion, true, scriptKind(canonical));
		},
		readFile: (fileName) => files.get(fileName.replaceAll('\\', '/')),
		realpath: (path) => path.replaceAll('\\', '/'),
		useCaseSensitiveFileNames: () => true,
		writeFile: () => undefined
	};
	return { files: new Map(Object.entries(filesValue)), program: ts.createProgram({ host, options, rootNames: rootNames.map(absolute) }) };
}

function recipe(rootNames: readonly string[]): ProgramRecipe {
	const base = {
		compilerOptions: { module: ts.ModuleKind.ESNext, noLib: true, strict: true, target: ts.ScriptTarget.ES2022 },
		configClosureDigest: '1'.repeat(64),
		configPath: 'tsconfig.json',
		kind: 'PROJECT' as const,
		projectReferences: [],
		provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
		rootNames: [...rootNames]
	};
	return { ...base, projectResolutionDigest: programRecipeDigest(base) };
}

function project(programRecipe: ProgramRecipe, overrides: Partial<ProjectSubjectRecord> = {}): ProjectSubjectRecord {
	return {
		configClosure: [{ path: 'tsconfig.json', requiredBy: [], sha256: '1'.repeat(64) }],
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
		artifact: { disposition: 'ANALYZED', primaryClass: 'PRODUCTION_SOURCE', roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'] },
		byteBudgetClass: 'FROZEN_SUBJECT',
		bytes: Buffer.byteLength(text, 'utf8'),
		contentSha256: sha256(text),
		logicalPath,
		mapping: { reason: 'Exact frozen-subject artifact match.', state: 'EXACT' },
		origin: 'AUTHORED',
		verificationState: 'VERIFIED_COMPILER_INPUT'
	};
}

function diagnosticFamilies(diagnostics: readonly ts.Diagnostic[] = [], family: SemanticDiagnosticFamily = 'SEMANTIC'): readonly StaticRawDiagnosticFamilyInput[] {
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
	const sourceBindings = bindings ?? new Map([...testProgram.files].map(([path, text]) => [path, frozenBinding(path, text)]));
	return {
		budgets: BUDGETS,
		checker: testProgram.program.getTypeChecker(),
		deadlineMs: Date.now() + BUDGETS.maxDurationMs,
		diagnosticFamilies: diagnosticFamilies(),
		program: testProgram.program,
		programRecipe,
		project: project(programRecipe),
		projectKey: programRecipe.configPath,
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
		expect(raw.sources[0]).toMatchObject({ analysisDisposition: 'DEEP_INDEXED', rootFile: true, rootNodeOrdinal: 0 });
		expect(raw.astNodes[0]).toMatchObject({ kind: ts.SyntaxKind.SourceFile, parentNodeOrdinal: null, structuralRoles: ['source-file'] });
		expect(raw.astNodes.some((node) => node.kind === ts.SyntaxKind.JSDocComment)).toBe(true);
		expect(raw.astNodes.filter((node) => node.parentNodeOrdinal !== null).every((node) => node.structuralRoles.includes('generic-child'))).toBe(true);

		const classCandidate = raw.declarationCandidates.find((candidate) => candidate.syntaxKind === ts.SyntaxKind.ClassDeclaration);
		expect(classCandidate).toMatchObject({ ambientSyntax: true, exportSyntax: 'EXPLICIT', nameState: 'ATOMIC', syntacticName: 'Example' });
		expect(classCandidate?.exportCarrierNodeOrdinal).toBe(classCandidate?.nodeOrdinal);
		expect(raw.declarationCandidates.some((candidate) => candidate.nameState === 'COMPUTED' && candidate.candidateRole === 'MEMBER')).toBe(true);
		expect(raw.declarationCandidates.some((candidate) => candidate.nameState === 'PATTERN' && candidate.candidateRole === 'BINDING')).toBe(true);
		expect(raw.declarationCandidates.some((candidate) => candidate.candidateRole === 'JSDOC_BINDING')).toBe(true);
		for (const candidate of raw.declarationCandidates.filter((candidate) => candidate.nameNodeOrdinal !== null)) {
			const nameNode = raw.astNodes.find((node) => node.sourceOrdinal === candidate.sourceOrdinal && node.nodeOrdinal === candidate.nameNodeOrdinal);
			expect(nameNode?.structuralRoles).toContain('declaration-name');
		}

		expect(raw.invocations.map((invocation) => invocation.invocationKind).sort()).toEqual(['CALL', 'NEW', 'TAGGED_TEMPLATE']);
		expect(raw.invocations.find((invocation) => invocation.invocationKind === 'CALL')?.optional).toBe(true);
		for (const invocation of raw.invocations) {
			const children = raw.astNodes.filter((node) => node.parentNodeOrdinal === invocation.nodeOrdinal);
			expect(children.filter((node) => node.structuralRoles.includes('invocation-callee')).map((node) => node.nodeOrdinal)).toEqual([invocation.calleeNodeOrdinal]);
		}

		expect(new Set(raw.assignments.map((assignment) => assignment.assignmentKind))).toEqual(new Set(['INITIALIZER', 'BINARY', 'POSTFIX_UPDATE']));
		for (const assignment of raw.assignments) {
			const target = raw.astNodes.find((node) => node.sourceOrdinal === assignment.sourceOrdinal && node.nodeOrdinal === assignment.targetNodeOrdinal);
			expect(target?.structuralRoles).toContain('assignment-target');
			if (assignment.valueNodeOrdinal !== null) {
				const value = raw.astNodes.find((node) => node.sourceOrdinal === assignment.sourceOrdinal && node.nodeOrdinal === assignment.valueNodeOrdinal);
				expect(value?.structuralRoles).toContain('assignment-value');
			}
		}

		expect(new Set(raw.literals.map((literal) => literal.valueType))).toEqual(new Set([
			'STRING', 'NUMBER', 'BIGINT', 'BOOLEAN', 'NULL', 'REGEXP', 'NO_SUBSTITUTION_TEMPLATE', 'TEMPLATE_HEAD', 'TEMPLATE_MIDDLE', 'TEMPLATE_TAIL'
		]));
		expect(raw.literals.every((literal) => /^[a-f0-9]{64}$/u.test(literal.lexemeSha256) && /^[a-f0-9]{64}$/u.test(literal.valueSha256))).toBe(true);
	});

	it('emits declaration-name only for the bounded declaration-candidate taxonomy', () => {
		const text = 'const binding = object.member;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts']));
		const binding = raw.astNodes.find((node) => node.kind === ts.SyntaxKind.VariableDeclaration);
		const propertyAccess = raw.astNodes.find((node) => node.kind === ts.SyntaxKind.PropertyAccessExpression);
		expect(binding).toBeDefined();
		expect(propertyAccess).toBeDefined();
		expect(raw.astNodes.filter((node) => node.parentNodeOrdinal === binding?.nodeOrdinal)
			.some((node) => node.structuralRoles.includes('declaration-name'))).toBe(true);
		expect(raw.astNodes.filter((node) => node.parentNodeOrdinal === propertyAccess?.nodeOrdinal)
			.some((node) => node.structuralRoles.includes('declaration-name'))).toBe(false);
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
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { diagnosticFamilies: diagnosticFamilies([diagnostic, diagnostic]) }));
		expect(raw.diagnostics).toHaveLength(2);
		expect(raw.diagnostics.map((item) => item.occurrenceOrdinal)).toEqual([0, 1]);
		expect(raw.diagnostics[0]?.message.next.map((message) => message.text)).toEqual(['first', 'second']);
		expect(raw.diagnostics[0]?.related).toHaveLength(2);
		expect(raw.diagnostics[0]?.related[0]).toEqual(raw.diagnostics[0]?.related[1]);
		expect(raw.diagnostics[0]).toMatchObject({ code: 'TS2322', locationKind: 'SOURCE', path: 'src/input.ts', sourceOrdinal: 0 });
		expect(raw.diagnosticFamilies.find((family) => family.family === 'SEMANTIC')?.diagnosticOccurrenceOrdinals).toEqual([0, 1]);
		expect(raw.diagnosticFamilies.map((family) => family.family)).toEqual(RAW_DIAGNOSTIC_FAMILIES);
	});

	it('distinguishes source, path-only, and location-free diagnostics with scalar-safe text encoding', () => {
		const text = 'export {};\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const configFile = ts.createSourceFile(absolute('tsconfig.json'), '{', ts.ScriptTarget.JSON, true, ts.ScriptKind.JSON);
		const pathOnly: ts.Diagnostic = { category: ts.DiagnosticCategory.Error, code: 1003, file: configFile, length: 1, messageText: 'Malformed config.', start: 0 };
		const locationFree: ts.Diagnostic = { category: ts.DiagnosticCategory.Warning, code: 9999, file: undefined, length: undefined, messageText: `non-scalar \ud800`, start: undefined };
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { diagnosticFamilies: diagnosticFamilies([pathOnly, locationFree], 'CONFIGURATION') }));
		expect(raw.diagnostics.find((item) => item.code === 'TS1003')).toMatchObject({ locationKind: 'PATH', path: 'tsconfig.json', sourceOrdinal: null, start: 0, end: 1 });
		expect(raw.diagnostics.find((item) => item.code === 'TS9999')).toMatchObject({ locationKind: 'NONE', path: null, sourceOrdinal: null, start: null, end: null, message: { textEncoding: 'UTF16_CODE_UNITS_HEX' } });
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
		expect(canonicalSemanticJson(first)).not.toMatch(/"(?:projectId|programId|sourceId|nodeId|snapshotId|provenance|timestamp)":/u);

		const pending: unknown[] = [first];
		while (pending.length > 0) {
			const value = pending.pop();
			if (value === null || typeof value !== 'object') continue;
			expect(Object.isFrozen(value)).toBe(true);
			expect(Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value))).toBe(true);
			expect('getSourceFile' in value || 'getTypeAtLocation' in value || 'getChildren' in value).toBe(false);
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
		const testProgram = createTestProgram({ 'src/context.ts': contextText, 'src/root.ts': rootText }, ['src/root.ts']);
		expect(testProgram.program.getSourceFiles().map((source) => logical(source.fileName)).sort()).toEqual(['src/context.ts', 'src/root.ts']);
		const bindings = new Map<string, RawCompilerSourceBinding>([
			['src/root.ts', frozenBinding('src/root.ts', rootText)],
			['src/context.ts', {
				artifact: null,
				byteBudgetClass: 'LIVE_COMPILER_CONTEXT',
				bytes: Buffer.byteLength(contextText),
				contentSha256: sha256(contextText),
				logicalPath: 'src/context.ts',
				mapping: { reason: 'No subject-artifact mapping is available.', state: 'UNAVAILABLE' },
				origin: 'UNKNOWN',
				verificationState: 'VERIFIED_COMPILER_INPUT'
			}]
		]);
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/root.ts'], {}, bindings));
		const context = raw.sources.find((source) => source.logicalPath === 'src/context.ts')!;
		expect(context).toMatchObject({ analysisDisposition: 'CONTEXT_ONLY', artifactClass: 'CONTEXT_ONLY', rootFile: false, rootNodeOrdinal: null });
		expect(raw.astNodes.some((node) => node.sourceOrdinal === context.sourceOrdinal)).toBe(false);
		expect(raw.project.partialityReasons).toContainEqual(expect.objectContaining({ capability: 'TS_PROJECT', code: 'COMPILER_CONTEXT_UNAVAILABLE', path: 'src/context.ts' }));
	});

	it('keeps framework-only partiality independent from TypeScript project completeness', () => {
		const text = 'export const value = 1;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const input = extractionInput(testProgram, ['src/input.ts']);
		const frameworkOnly = extractStaticRaw({
			...input,
			project: project(input.programRecipe, { frameworkCandidates: ['src/View.svelte'], status: 'PARTIAL' })
		});
		expect(frameworkOnly.project.partialityReasons).toContainEqual(expect.objectContaining({ capability: 'TS_SYNTAX', code: 'FRAMEWORK_CANDIDATES_UNSUPPORTED' }));
		expect(frameworkOnly.project.partialityReasons.some((reason) => reason.capability === 'TS_PROJECT')).toBe(false);

		const configurationPartial = extractStaticRaw({
			...input,
			project: project(input.programRecipe, {
				status: 'PARTIAL',
				typescriptDiagnostics: [{ code: 'CONFIG_DIAGNOSTIC', message: 'Configuration is invalid.', path: 'tsconfig.json', phase: 'RESOLVE', severity: 'ERROR' }]
			})
		});
		expect(configurationPartial.project.partialityReasons).toContainEqual(expect.objectContaining({ capability: 'TS_PROJECT', code: 'TYPESCRIPT_PROJECT_PARTIAL' }));
	});

	it('redacts over-limit literal values while retaining exact value and lexeme metadata', () => {
		const text = 'export const value = "a long literal", nonScalar = "\\uD800";\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxLiteralCharacters: 3 } }));
		const literal = raw.literals.find((item) => item.valueType === 'STRING' && item.valueLength === 'a long literal'.length)!;
		expect(literal).toMatchObject({ value: null, valueLength: 'a long literal'.length, valueState: 'DIGEST_ONLY' });
		expect(literal.lexemeLength).toBe('"a long literal"'.length);
		const nonScalar = raw.literals.find((item) => item.valueEncoding === 'UTF16_CODE_UNITS_LE')!;
		expect(nonScalar).toMatchObject({ value: null, valueLength: 1, valueState: 'DIGEST_ONLY', valueType: 'STRING' });
	});

	it('fails closed on node, depth, diagnostic, character, path, deadline, and frozen-source-policy bounds', () => {
		const text = 'export const value = call(1);\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxAstNodes: 1 } })), 'BUDGET_EXCEEDED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxAstDepth: 1 } })), 'BUDGET_EXCEEDED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxPathCharacters: 4 } })), 'BUDGET_EXCEEDED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { deadlineMs: Date.now() - 1 })), 'DEADLINE_EXCEEDED');

		const sourceFile = testProgram.program.getSourceFile(absolute('src/input.ts'))!;
		const diagnostic: ts.Diagnostic = { category: ts.DiagnosticCategory.Error, code: 1000, file: sourceFile, length: 1, messageText: 'too long', start: 0 };
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxDiagnostics: 1 }, diagnosticFamilies: diagnosticFamilies([diagnostic, diagnostic]) })), 'BUDGET_EXCEEDED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxDiagnosticCharacters: 2 }, diagnosticFamilies: diagnosticFamilies([diagnostic]) })), 'BUDGET_EXCEEDED');

		const invalidBinding = { ...frozenBinding('src/input.ts', text), artifact: { disposition: 'INVENTORY_ONLY' as const, primaryClass: 'PRODUCTION_SOURCE' as const, roles: ['COMPILER_CANDIDATE' as const] } };
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], {}, new Map([['src/input.ts', invalidBinding]]))), 'SOURCE_POLICY_MISMATCH');

		const twoSources = createTestProgram({ 'src/a.ts': 'export {};\n', 'src/b.ts': 'export {};\n' });
		expectTypedFailure(() => extractStaticRaw(extractionInput(twoSources, ['src/a.ts', 'src/b.ts'], { budgets: { ...BUDGETS, maxSources: 1 } })), 'BUDGET_EXCEEDED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { budgets: { ...BUDGETS, maxProjects: 0 } })), 'BUDGET_EXCEEDED');
	});

	it('enforces snapshot-wide extraction ceilings through a provider-issued shared ledger', () => {
		const budgets = { ...BUDGETS, maxSources: 1 };
		const ledger = createStaticRawExtractionBudgetLedger(budgets);
		const first = createTestProgram({ 'src/first.ts': 'export {};\n' });
		const second = createTestProgram({ 'src/second.ts': 'export {};\n' });
		extractStaticRaw(extractionInput(first, ['src/first.ts'], { budgetLedger: ledger, budgets }));
		expectTypedFailure(() => extractStaticRaw(extractionInput(second, ['src/second.ts'], { budgetLedger: ledger, budgets })), 'BUDGET_EXCEEDED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(second, ['src/second.ts'], { budgetLedger: ledger, budgets: { ...budgets, maxSources: 2 } })), 'INVALID_INPUT');
	});

	it('requires exact project/recipe identity and all six diagnostic families in registered order', () => {
		const text = 'export {};\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { projectKey: 'other/tsconfig.json' })), 'IDENTITY_MISMATCH');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { diagnosticFamilies: diagnosticFamilies().slice(1) })), 'INVALID_INPUT');
		const failedFamilies = diagnosticFamilies().map((family) => family.family === 'DECLARATION'
			? { ...family, reason: 'Declaration diagnostics threw.', state: 'FAILED' as const }
			: family);
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { diagnosticFamilies: failedFamilies }));
		expect(raw.diagnosticFamilies.at(-1)).toMatchObject({ coverage: 'BOUNDED', family: 'DECLARATION', state: 'FAILED' });
		expect(raw.project.partialityReasons).toContainEqual(expect.objectContaining({ capability: 'TS_PROJECT', code: 'COMPILER_CONTEXT_UNAVAILABLE' }));
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

		expect(new Set(raw.sources.map((source) => source.scriptKind))).toEqual(new Set([
			ts.ScriptKind.Unknown,
			ts.ScriptKind.JS,
			ts.ScriptKind.JSX,
			ts.ScriptKind.JSON,
			ts.ScriptKind.TS,
			ts.ScriptKind.TSX
		]));
		expect(raw.assignments.some((assignment) => assignment.assignmentKind === 'PREFIX_UPDATE')).toBe(true);
		const enumMember = raw.astNodes.find((node) => node.kind === ts.SyntaxKind.EnumMember)!;
		const shorthand = raw.astNodes.find((node) => node.kind === ts.SyntaxKind.ShorthandPropertyAssignment)!;
		expect(raw.assignments.some((assignment) => assignment.assignmentKind === 'INITIALIZER'
			&& raw.astNodes.find((node) => node.nodeOrdinal === assignment.targetNodeOrdinal && node.sourceOrdinal === assignment.sourceOrdinal)?.parentNodeOrdinal === enumMember.nodeOrdinal)).toBe(true);
		expect(raw.assignments.some((assignment) => assignment.assignmentKind === 'INITIALIZER'
			&& raw.astNodes.find((node) => node.nodeOrdinal === assignment.targetNodeOrdinal && node.sourceOrdinal === assignment.sourceOrdinal)?.parentNodeOrdinal === shorthand.nodeOrdinal)).toBe(true);
		expect(new Set(raw.declarationCandidates.map((candidate) => candidate.exportSyntax)).has('EXPORT_ASSIGNMENT')).toBe(true);
		expect(new Set(raw.declarationCandidates.map((candidate) => candidate.exportSyntax)).has('NAMESPACE_EXPORT')).toBe(true);
		expect(new Set(raw.declarationCandidates.map((candidate) => candidate.exportSyntax)).has('DEFAULT')).toBe(true);
		expect(raw.declarationCandidates.some((candidate) => candidate.syntacticName === '"literal-name"')).toBe(true);
	});

	it('maps suggestion diagnostics and converts hostile callback failures to typed extraction refusals', () => {
		const text = 'export const value = 1;\n';
		const testProgram = createTestProgram({ 'src/input.ts': text });
		const suggestion: ts.Diagnostic = { category: ts.DiagnosticCategory.Suggestion, code: 8001, file: undefined, length: undefined, messageText: 'Consider another form.', start: undefined };
		const raw = extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { diagnosticFamilies: diagnosticFamilies([suggestion]) }));
		expect(raw.diagnostics[0]).toMatchObject({ category: 'SUGGESTION', code: 'TS8001' });
		const unknownCategory = { ...suggestion, category: 99 as ts.DiagnosticCategory };
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], { diagnosticFamilies: diagnosticFamilies([unknownCategory]) })), 'DIAGNOSTIC_INVALID');

		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], {
			assertWithinDeadline: () => { throw new Error('clock unavailable'); }
		})), 'DEADLINE_EXCEEDED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], {
			toLogicalPath: () => { throw new Error('mapping unavailable'); }
		})), 'PATH_MAPPING_FAILED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], {
			toLogicalPath: () => '../outside.ts'
		})), 'PATH_MAPPING_FAILED');
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'], {
			resolveCompilerSource: () => { throw new Error('evidence unavailable'); }
		})), 'SOURCE_EVIDENCE_MISSING');

		const originalRoots = testProgram.program.getRootFileNames.bind(testProgram.program);
		Object.defineProperty(testProgram.program, 'getRootFileNames', { configurable: true, value: () => { throw new Error('program failure'); } });
		expectTypedFailure(() => extractStaticRaw(extractionInput(testProgram, ['src/input.ts'])), 'INVALID_INPUT');
		Object.defineProperty(testProgram.program, 'getRootFileNames', { configurable: true, value: originalRoots });

		const malformedLiteralProgram = createTestProgram({ 'src/literal.ts': 'export const value = 1;\n' });
		const sourceFile = malformedLiteralProgram.program.getSourceFile(absolute('src/literal.ts'))!;
		let numericLiteral: ts.NumericLiteral | undefined;
		const visit = (node: ts.Node): void => {
			if (ts.isNumericLiteral(node)) numericLiteral = node;
			else ts.forEachChild(node, visit);
		};
		visit(sourceFile);
		Object.defineProperty(numericLiteral!, 'text', { configurable: true, value: undefined });
		expectTypedFailure(() => extractStaticRaw(extractionInput(malformedLiteralProgram, ['src/literal.ts'])), 'UNSUPPORTED_SYNTAX');
	});
});
