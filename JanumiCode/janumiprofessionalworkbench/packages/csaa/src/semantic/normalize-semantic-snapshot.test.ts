import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type CompilerInputObservation,
	type SemanticBudgets
} from '../contracts/semantic.js';
import {
	SUBJECT_POLICY_VERSION,
	SUBJECT_REQUEST_SCHEMA_VERSION,
	SUBJECT_SCHEMA_VERSION,
	type FrozenSubject,
	type ProgramRecipe
} from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, encodeSemanticDiagnosticText } from './canonical.js';
import {
	compilerInputClosureDigest,
	compilerInputResultDigest,
	programRecipeDigest,
	semanticContextInputId
} from './ids.js';
import {
	normalizeStaticSemanticSnapshot,
	SemanticNormalizationError,
	type NormalizeStaticSemanticSnapshotInput
} from './normalize-semantic-snapshot.js';
import type {
	RawSemanticAstNode,
	RawSemanticDiagnosticMessage,
	RawStaticSemanticProjectExtraction
} from './raw-semantic-model.js';
import { validateStaticSemanticSnapshot } from './validate-snapshot.js';
import { materializeSemanticSnapshotWire } from './validate-wire-shape.js';

const BUDGETS: SemanticBudgets = {
	maxAstDepth: 64,
	maxAstNodes: 10_000,
	maxCompilerInputMetadataBytes: 1_000_000,
	maxCompilerQueries: 10_000,
	maxCompilerQueryInvocations: 100_000,
	maxContextBytes: 10_000_000,
	maxContextFileBytes: 2_000_000,
	maxContextFiles: 10_000,
	maxDiagnosticCharacters: 1_000_000,
	maxDiagnostics: 10_000,
	maxDirectoryEntries: 100_000,
	maxDurationMs: 60_000,
	maxLiteralCharacters: 10_000,
	maxPathCharacters: 1_000,
	maxProjects: 100,
	maxSnapshotBytes: 10_000_000,
	maxSources: 10_000
};

const SUBJECT_ID = sha256('normalizer-subject');
const CONTENT = 'const answer = 42;\n';
const CONTENT_SHA = sha256(CONTENT);

function recipe(compilerOptions: Readonly<Record<string, unknown>> = {}): ProgramRecipe {
	const base = {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			noEmit: true,
			noLib: true,
			strict: true,
			target: ts.ScriptTarget.ES2022,
			...compilerOptions
		},
		configClosureDigest: sha256('config-closure'),
		configPath: 'tsconfig.json',
		kind: 'PROJECT' as const,
		projectReferences: [],
		provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
		rootNames: ['src/index.ts']
	};
	return { ...base, projectResolutionDigest: programRecipeDigest(base) };
}

function diagnosticMessage(
	text: string,
	next: readonly RawSemanticDiagnosticMessage[] = [],
	category: RawSemanticDiagnosticMessage['category'] = null,
	code: number | null = null
): RawSemanticDiagnosticMessage {
	return { category, code, next, ...encodeSemanticDiagnosticText(text) };
}

function childNode(
	nodeOrdinal: number,
	kind: ts.SyntaxKind,
	overrides: Partial<RawSemanticAstNode> = {}
): RawSemanticAstNode {
	return {
		end: nodeOrdinal + 1,
		fullStart: nodeOrdinal,
		hasAssignmentInitializer: false,
		kind,
		kindName: String(ts.SyntaxKind[kind]),
		nodeOrdinal,
		operatorKind: null,
		operatorName: null,
		parentNodeOrdinal: 0,
		publicFlags: 0,
		siblingOrdinal: nodeOrdinal,
		sourceOrdinal: 0,
		start: nodeOrdinal,
		structuralRoles: ['generic-child'],
		syntacticIdentifierText: kind === ts.SyntaxKind.Identifier ? `node${nodeOrdinal}` : null,
		...overrides
	};
}

function request(overrides: Partial<SemanticBudgets> = {}): BuildStaticSemanticSnapshotRequest {
	return {
		budgets: { ...BUDGETS, ...overrides },
		capabilities: ['TS_PROJECT', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: 'C:/normalizer-fixture',
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: SUBJECT_ID
	};
}

function subject(programRecipe = recipe()): FrozenSubject {
	return {
		artifacts: [
			{
				bytes: Buffer.byteLength(CONTENT),
				canonicalPathKey: 'src/index.ts',
				disposition: 'ANALYZED',
				path: 'src/index.ts',
				primaryClass: 'PRODUCTION_SOURCE',
				reason: 'fixture source',
				roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'],
				sha256: CONTENT_SHA
			}
		],
		descriptor: {
			configurationDigest: sha256('configuration'),
			dirtyState: 'UNKNOWN',
			excludedClasses: [],
			exclusionPolicyIds: [],
			fileManifestDigest: sha256('manifest'),
			operationVersion: 'fixture-subject-operation',
			parentRevision: null,
			perimeter: ['.'],
			policyVersion: SUBJECT_POLICY_VERSION,
			repositoryRoot: '.',
			revision: null,
			schemaVersion: SUBJECT_SCHEMA_VERSION,
			subjectId: SUBJECT_ID,
			subjectKind: 'WORKTREE'
		},
		diagnostics: [],
		excludedArtifacts: [],
		generatedContexts: [],
		population: {
			analyzed: 1,
			discovered: 1,
			excluded: 0,
			failed: 0,
			included: 1,
			inventoryOnly: 0,
			reconciles: true
		},
		projects: [
			{
				configClosure: [],
				configPath: programRecipe.configPath,
				effectiveCompilerOptions: programRecipe.compilerOptions,
				fileNames: programRecipe.rootNames,
				frameworkCandidates: [],
				kind: programRecipe.kind,
				programRecipe,
				projectReferences: [],
				rawCompilerOptions: {},
				rawExclude: null,
				rawExtends: null,
				rawFiles: null,
				rawInclude: null,
				rootDisposition: 'COMPILER_ROOTS',
				status: 'COMPLETE',
				typescriptDiagnostics: []
			}
		],
		request: {
			budgets: {
				maxBytes: 1_000_000,
				maxConfigDepth: 16,
				maxDiagnostics: 1_000,
				maxDurationMs: 60_000,
				maxFiles: 1_000,
				maxProjects: 100
			},
			filters: { exclude: [], include: ['**'] },
			operationVersion: 'fixture-subject-operation',
			outputs: [],
			policyVersion: SUBJECT_POLICY_VERSION,
			rootLocator: '<runtime>',
			schemaVersion: SUBJECT_REQUEST_SCHEMA_VERSION,
			scope: { kind: 'REPOSITORY' },
			subjectKind: 'WORKTREE'
		},
		workspaces: []
	};
}

function observation(): CompilerInputObservation {
	const result = {
		byteBudgetClass: 'FROZEN_SUBJECT' as const,
		contentBytes: Buffer.byteLength(CONTENT),
		contentSha256: CONTENT_SHA,
		invocationCount: 1,
		logicalPath: 'src/index.ts',
		operation: 'READ_FILE' as const,
		origin: 'AUTHORED' as const,
		result: 'PRESENT' as const
	};
	const resultDigest = compilerInputResultDigest(result);
	return {
		...result,
		id: semanticContextInputId({ ...result, resultDigest, subjectId: SUBJECT_ID }),
		resultDigest
	};
}

function raw(programRecipe = recipe()): RawStaticSemanticProjectExtraction {
	return {
		assignments: [],
		astNodes: [
			{
				end: CONTENT.length,
				fullStart: 0,
				hasAssignmentInitializer: false,
				kind: ts.SyntaxKind.SourceFile,
				kindName: 'SourceFile',
				nodeOrdinal: 0,
				operatorKind: null,
				operatorName: null,
				parentNodeOrdinal: null,
				publicFlags: 0,
				siblingOrdinal: 0,
				sourceOrdinal: 0,
				start: 0,
				structuralRoles: ['source-file'],
				syntacticIdentifierText: null
			}
		],
		declarationCandidates: [],
		diagnosticFamilies: (
			['CONFIGURATION', 'OPTIONS', 'GLOBAL', 'SYNTACTIC', 'SEMANTIC', 'DECLARATION'] as const
		).map((family) => ({
			coverage: 'COMPLETE' as const,
			diagnosticOccurrenceOrdinals: [],
			family,
			reason: 'Family ran and returned zero diagnostics.',
			state: 'RUN' as const
		})),
		diagnostics: [],
		evidenceState: 'VERIFIED_COMPILER_INPUT',
		invocations: [],
		literals: [],
		project: {
			configPath: programRecipe.configPath,
			frameworkCandidates: [],
			kind: programRecipe.kind,
			partialityReasons: [],
			programRecipe:
				programRecipe as RawStaticSemanticProjectExtraction['project']['programRecipe'],
			projectReferences: [],
			rootDisposition: 'COMPILER_ROOTS',
			rootNames: programRecipe.rootNames
		},
		sources: [
			{
				analysisDisposition: 'DEEP_INDEXED',
				artifactClass: 'PRODUCTION_SOURCE',
				artifactRoles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'],
				bytes: Buffer.byteLength(CONTENT),
				contentSha256: CONTENT_SHA,
				declarationFile: false,
				languageVariant: 'Standard',
				logicalPath: 'src/index.ts',
				mapping: {
					reason: 'Authored TypeScript is already in source coordinates.',
					state: 'NOT_APPLICABLE'
				},
				origin: 'AUTHORED',
				rootFile: true,
				rootNodeOrdinal: 0,
				scriptKind: ts.ScriptKind.TS,
				scriptKindName: 'TS',
				sourceOrdinal: 0,
				textLength: CONTENT.length
			}
		]
	};
}

function normalizationInput(
	rawProject = raw(),
	semanticRequest = request()
): NormalizeStaticSemanticSnapshotInput {
	const input = observation();
	return {
		capture: {
			closureDigest: compilerInputClosureDigest([input]),
			observations: [input],
			projectAttributions: [
				{
					contextInputIds: [input.id],
					materializedRecipeDigest: sha256('materialized-recipe'),
					projectKey: rawProject.project.configPath,
					projectResolutionDigest: rawProject.project.programRecipe.projectResolutionDigest,
					queryInvocations: [
						{
							invocationCount: 1,
							query: { logicalPath: input.logicalPath, operation: 'READ_FILE' }
						}
					]
				}
			]
		},
		projects: [rawProject],
		request: semanticRequest,
		subject: subject(rawProject.project.programRecipe as ProgramRecipe)
	};
}

function normalize(rawProject = raw(), semanticRequest = request()) {
	return normalizeStaticSemanticSnapshot(normalizationInput(rawProject, semanticRequest));
}

describe('semantic snapshot normalization', () => {
	it('assigns canonical identities, provenance, populations, and a validator-clean closed snapshot', () => {
		const snapshot = normalize();
		expect(validateStaticSemanticSnapshot(snapshot, {}, { frozenSubject: subject() })).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(snapshot.health).toBe('COMPLETE');
		expect(snapshot.projects).toHaveLength(1);
		expect(snapshot.astNodes).toHaveLength(1);
		expect(snapshot.provenances).toHaveLength(4);
		expect(snapshot.programs[0]?.provenanceId).toBe(snapshot.projects[0]?.provenanceId);
		expect(snapshot.sources[0]?.provenanceId).not.toBe(snapshot.projects[0]?.provenanceId);
		expect(
			snapshot.provenances.find((record) => record.id === snapshot.sources[0]?.provenanceId)
				?.parentProvenanceId
		).toBe(snapshot.projects[0]?.provenanceId);
		expect(snapshot.sources[0]?.syntaxProvenanceId).not.toBeNull();
		expect(
			snapshot.provenances.find((record) => record.id === snapshot.sources[0]?.syntaxProvenanceId)
				?.sourceId
		).toBe(snapshot.astNodes[0]?.sourceId);
		const canonical = canonicalSemanticJson(snapshot);
		expect(canonical).not.toContain('C:/normalizer-fixture');
		expect(
			materializeSemanticSnapshotWire(snapshot, {
				maxDepth: 1_000,
				maxDiagnostics: 10_000,
				maxRecords: 1_000_000,
				maxStringCharacters: 1_000_000
			})
		).toMatchObject({ canonicalBytes: Buffer.byteLength(canonical, 'utf8'), issues: [] });
	});

	it('collapses equal diagnostic occurrences without making occurrence order semantic', () => {
		const base = raw();
		const encoded = encodeSemanticDiagnosticText('Type mismatch.');
		const occurrence = (occurrenceOrdinal: number) => ({
			category: 'ERROR' as const,
			code: 'TS2322',
			end: 1,
			family: 'SEMANTIC' as const,
			locationKind: 'SOURCE' as const,
			message: { category: null, code: null, next: [], ...encoded },
			occurrenceOrdinal,
			path: 'src/index.ts',
			related: [],
			sourceOrdinal: 0,
			start: 0
		});
		const diagnosticFamilies = base.diagnosticFamilies.map((family) =>
			family.family === 'SEMANTIC'
				? {
						...family,
						diagnosticOccurrenceOrdinals: [0, 1],
						reason: 'Family ran and returned two occurrences.'
					}
				: family
		);
		const forward = normalize({
			...base,
			diagnosticFamilies,
			diagnostics: [occurrence(0), occurrence(1)]
		});
		const reverse = normalize({
			...base,
			diagnosticFamilies,
			diagnostics: [occurrence(1), occurrence(0)]
		});
		expect(forward.diagnostics).toHaveLength(1);
		expect(forward.diagnostics[0]?.multiplicity).toBe(2);
		expect(canonicalSemanticJson(reverse)).toBe(canonicalSemanticJson(forward));
		expect(validateStaticSemanticSnapshot(forward, {}, { frozenSubject: subject() })).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('sorts diagnostic records and related information while preserving recursive message chains', () => {
		const base = raw();
		const leafMessage = diagnosticMessage('Leaf detail.', [], 'MESSAGE', 7002);
		const branchMessage = diagnosticMessage('Branch detail.', [leafMessage], 'ERROR', 7001);
		const rootMessage = diagnosticMessage('Root diagnostic.', [branchMessage]);
		const earlyRelated = {
			category: 'MESSAGE' as const,
			code: 'TS1000',
			end: null,
			message: diagnosticMessage('Earlier related detail.'),
			path: 'src/a.ts',
			start: null
		};
		const lateRelated = {
			category: 'MESSAGE' as const,
			code: 'TS9000',
			end: null,
			message: diagnosticMessage('Later related detail.'),
			path: 'src/z.ts',
			start: null
		};
		const sourceDiagnostic = {
			category: 'ERROR' as const,
			code: 'TS5000',
			end: 1,
			family: 'SEMANTIC' as const,
			locationKind: 'SOURCE' as const,
			message: rootMessage,
			occurrenceOrdinal: 0,
			path: 'src/index.ts',
			related: [lateRelated, earlyRelated],
			sourceOrdinal: 0,
			start: 0
		} satisfies RawStaticSemanticProjectExtraction['diagnostics'][number];
		const pathDiagnostic = {
			category: 'WARNING' as const,
			code: 'TS4000',
			end: null,
			family: 'SEMANTIC' as const,
			locationKind: 'PATH' as const,
			message: diagnosticMessage('Configuration warning.'),
			occurrenceOrdinal: 1,
			path: 'tsconfig.json',
			related: [],
			sourceOrdinal: null,
			start: null
		} satisfies RawStaticSemanticProjectExtraction['diagnostics'][number];
		const diagnosticFamilies = base.diagnosticFamilies.map((family) =>
			family.family === 'SEMANTIC'
				? {
						...family,
						diagnosticOccurrenceOrdinals: [1, 0],
						reason: 'Family returned two distinct diagnostics.'
					}
				: family
		);
		const enriched = {
			...base,
			diagnosticFamilies,
			diagnostics: [pathDiagnostic, sourceDiagnostic]
		};
		const totalCharacters =
			rootMessage.textLength +
			branchMessage.textLength +
			leafMessage.textLength +
			earlyRelated.message.textLength +
			lateRelated.message.textLength +
			pathDiagnostic.message.textLength;
		const snapshot = normalize(enriched, request({ maxDiagnosticCharacters: totalCharacters }));
		const normalized = snapshot.diagnostics.find(
			(diagnostic) => diagnostic.code === sourceDiagnostic.code
		);

		expect(snapshot.diagnostics.map((diagnostic) => diagnostic.id)).toEqual(
			[...snapshot.diagnostics.map((diagnostic) => diagnostic.id)].sort()
		);
		expect(normalized?.message).toEqual(rootMessage);
		expect(normalized?.message).not.toBe(rootMessage);
		expect(normalized?.message.next[0]).not.toBe(branchMessage);
		expect(normalized?.message.next[0]?.next[0]).toEqual(leafMessage);
		expect(normalized?.related.map((related) => related.code)).toEqual(['TS1000', 'TS9000']);
		expect(snapshot.sources[0]?.diagnosticIds).toEqual(
			normalized === undefined ? [] : [normalized.id]
		);
		expect(
			snapshot.programs[0]?.diagnosticFamilies.find((family) => family.family === 'SEMANTIC')
		).toMatchObject({
			diagnosticIds: snapshot.diagnostics.map((diagnostic) => diagnostic.id),
			occurrenceCount: 2,
			recordCount: 2
		});
		expect(() =>
			normalize(enriched, request({ maxDiagnosticCharacters: totalCharacters - 1 }))
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'BUDGET_EXCEEDED',
				message: 'Raw diagnostic characters exceed the snapshot diagnostic-character budget.'
			})
		);
	});

	it('rolls project partiality and lossy source mapping into sorted capability-specific provenance', () => {
		const base = raw();
		const partialityReasons = [
			{
				capability: 'TS_SYNTAX' as const,
				code: 'FRAMEWORK_CANDIDATES_UNSUPPORTED' as const,
				message: 'Framework syntax is outside this slice.',
				path: null
			},
			{
				capability: 'TS_PROJECT' as const,
				code: 'CONTEXT_FRESHNESS_UNKNOWN' as const,
				message: 'Source mapping is incomplete.',
				path: 'src/index.ts'
			},
			{
				capability: 'TS_PROJECT' as const,
				code: 'COMPILER_CONTEXT_UNAVAILABLE' as const,
				message: 'Configuration lookup was bounded.',
				path: null
			}
		];
		const diagnosticFamilies = base.diagnosticFamilies.map((family) =>
			family.family === 'DECLARATION'
				? {
						...family,
						coverage: 'BOUNDED' as const,
						reason: 'Declaration diagnostics failed visibly.',
						state: 'FAILED' as const
					}
				: family
		);
		const snapshot = normalize({
			...base,
			diagnosticFamilies,
			project: {
				...base.project,
				frameworkCandidates: ['svelte', 'astro', 'svelte'],
				partialityReasons,
				projectReferences: ['z/tsconfig.json', 'a/tsconfig.json', 'z/tsconfig.json'],
				rootNames: ['src/z.ts', 'src/index.ts', 'src/z.ts']
			},
			sources: [
				{
					...base.sources[0]!,
					artifactRoles: ['PRODUCTION', 'ANALYSIS_INPUT', 'PRODUCTION'],
					mapping: { reason: 'Source mapping is incomplete.', state: 'PARTIAL' },
					origin: 'UNKNOWN'
				}
			]
		});
		const project = snapshot.projects[0]!;
		const source = snapshot.sources[0]!;
		const projectProvenance = snapshot.provenances.find(
			(record) => record.id === project.provenanceId
		)!;
		const sourceProvenance = snapshot.provenances.find(
			(record) => record.id === source.provenanceId
		)!;
		const syntaxProvenance = snapshot.provenances.find(
			(record) => record.id === source.syntaxProvenanceId
		)!;

		expect(snapshot.health).toBe('PARTIAL');
		expect(project.health).toBe('PARTIAL');
		expect(project.frameworkCandidates).toEqual(['astro', 'svelte']);
		expect(project.projectReferences).toEqual(['a/tsconfig.json', 'z/tsconfig.json']);
		expect(project.rootNames).toEqual(['src/index.ts', 'src/z.ts']);
		expect(project.partialityReasons.map(({ capability, code }) => [capability, code])).toEqual([
			['TS_PROJECT', 'COMPILER_CONTEXT_UNAVAILABLE'],
			['TS_PROJECT', 'CONTEXT_FRESHNESS_UNKNOWN'],
			['TS_SYNTAX', 'FRAMEWORK_CANDIDATES_UNSUPPORTED']
		]);
		expect(
			Object.fromEntries(snapshot.capabilities.map(({ capability, state }) => [capability, state]))
		).toEqual({
			TS_PROJECT: 'PARTIAL',
			TS_SYMBOL: 'UNSUPPORTED',
			TS_SYNTAX: 'PARTIAL',
			TS_TYPE: 'UNSUPPORTED'
		});
		expect(source.artifactRoles).toEqual(['ANALYSIS_INPUT', 'PRODUCTION']);
		expect(projectProvenance.limitations).toEqual([
			{
				capability: 'TS_PROJECT',
				closureEffect: 'DEGRADES_CLOSURE',
				reason: 'Source mapping is incomplete.',
				region: 'src/index.ts'
			},
			{
				capability: 'TS_PROJECT',
				closureEffect: 'DEGRADES_CLOSURE',
				reason: 'Configuration lookup was bounded.',
				region: 'tsconfig.json'
			}
		]);
		expect(sourceProvenance.limitations).toEqual(projectProvenance.limitations);
		expect(sourceProvenance.epistemic).toMatchObject({
			capabilityCoverage: 'partial',
			unresolvedRegions: ['src/index.ts', 'tsconfig.json']
		});
		expect(syntaxProvenance.limitations).toEqual([
			{
				capability: 'TS_SYNTAX',
				closureEffect: 'DEGRADES_CLOSURE',
				reason: 'Framework syntax is outside this slice.',
				region: 'tsconfig.json'
			}
		]);
		expect(snapshot.limitations).toEqual([
			...projectProvenance.limitations,
			...syntaxProvenance.limitations
		]);
	});

	it('normalizes declarations, literals, all invocation variants, assignments, and nested recipe values', () => {
		const nestedRecipe = recipe({
			paths: { '@fixture/*': ['src/*', 'generated/*'] },
			plugins: [{ name: 'fixture-plugin' }]
		});
		const base = raw(nestedRecipe);
		const modifiers = [
			{ code: ts.SyntaxKind.ExportKeyword, name: 'ExportKeyword' },
			{ code: ts.SyntaxKind.AsyncKeyword, name: 'AsyncKeyword' },
			{ code: ts.SyntaxKind.DefaultKeyword, name: 'DefaultKeyword' },
			{ code: ts.SyntaxKind.DeclareKeyword, name: 'DeclareKeyword' }
		];
		const astNodes = [
			base.astNodes[0]!,
			childNode(1, ts.SyntaxKind.FunctionDeclaration),
			childNode(2, ts.SyntaxKind.Identifier, { syntacticIdentifierText: 'run' }),
			childNode(3, ts.SyntaxKind.CallExpression),
			childNode(4, ts.SyntaxKind.Identifier),
			childNode(5, ts.SyntaxKind.StringLiteral, {
				structuralRoles: ['invocation-argument', 'generic-child', 'generic-child']
			}),
			childNode(6, ts.SyntaxKind.NewExpression),
			childNode(7, ts.SyntaxKind.Identifier),
			childNode(8, ts.SyntaxKind.NumericLiteral),
			childNode(9, ts.SyntaxKind.TaggedTemplateExpression),
			childNode(10, ts.SyntaxKind.Identifier),
			childNode(11, ts.SyntaxKind.NoSubstitutionTemplateLiteral),
			childNode(12, ts.SyntaxKind.BinaryExpression, {
				operatorKind: ts.SyntaxKind.EqualsToken,
				operatorName: 'FirstAssignment'
			}),
			childNode(13, ts.SyntaxKind.Identifier),
			childNode(14, ts.SyntaxKind.TrueKeyword),
			childNode(15, ts.SyntaxKind.PostfixUnaryExpression, {
				operatorKind: ts.SyntaxKind.PlusPlusToken,
				operatorName: 'PlusPlusToken'
			}),
			childNode(16, ts.SyntaxKind.Identifier)
		];
		const snapshot = normalize({
			...base,
			assignments: [
				{
					assignmentKind: 'POSTFIX_UPDATE',
					nodeOrdinal: 15,
					operatorKind: ts.SyntaxKind.PlusPlusToken,
					operatorName: 'PlusPlusToken',
					sourceOrdinal: 0,
					targetNodeOrdinal: 16,
					valueNodeOrdinal: null
				},
				{
					assignmentKind: 'BINARY',
					nodeOrdinal: 12,
					operatorKind: ts.SyntaxKind.EqualsToken,
					operatorName: 'FirstAssignment',
					sourceOrdinal: 0,
					targetNodeOrdinal: 13,
					valueNodeOrdinal: 14
				}
			],
			astNodes,
			declarationCandidates: [
				{
					ambientSyntax: true,
					candidateRole: 'BINDING',
					exportCarrierNodeOrdinal: 0,
					exportSyntax: 'EXPLICIT',
					localModifiers: modifiers,
					nameNodeOrdinal: 2,
					nameState: 'ATOMIC',
					nodeOrdinal: 1,
					sourceOrdinal: 0,
					syntacticName: 'run',
					syntaxKind: ts.SyntaxKind.FunctionDeclaration,
					syntaxKindName: 'FunctionDeclaration'
				}
			],
			invocations: [
				{
					argumentNodeOrdinals: [11],
					calleeNodeOrdinal: 10,
					invocationKind: 'TAGGED_TEMPLATE',
					nodeOrdinal: 9,
					optional: true,
					sourceOrdinal: 0,
					templateNodeOrdinal: 11
				},
				{
					argumentNodeOrdinals: [8],
					calleeNodeOrdinal: 7,
					invocationKind: 'NEW',
					nodeOrdinal: 6,
					optional: true,
					sourceOrdinal: 0,
					templateNodeOrdinal: null
				},
				{
					argumentNodeOrdinals: [5],
					calleeNodeOrdinal: 4,
					invocationKind: 'CALL',
					nodeOrdinal: 3,
					optional: true,
					sourceOrdinal: 0,
					templateNodeOrdinal: null
				}
			],
			literals: [
				{
					lexemeLength: 1,
					lexemeSha256: sha256('true'),
					nodeOrdinal: 14,
					sourceOrdinal: 0,
					value: true,
					valueEncoding: 'JSON_SCALAR',
					valueLength: 4,
					valueSha256: sha256('true-value'),
					valueState: 'EXACT',
					valueType: 'BOOLEAN'
				},
				{
					lexemeLength: 1,
					lexemeSha256: sha256('template'),
					nodeOrdinal: 11,
					sourceOrdinal: 0,
					value: null,
					valueEncoding: 'UTF16_CODE_UNITS_LE',
					valueLength: 3,
					valueSha256: sha256('template-value'),
					valueState: 'DIGEST_ONLY',
					valueType: 'NO_SUBSTITUTION_TEMPLATE'
				},
				{
					lexemeLength: 1,
					lexemeSha256: sha256('number'),
					nodeOrdinal: 8,
					sourceOrdinal: 0,
					value: '42',
					valueEncoding: 'TYPESCRIPT_TEXT',
					valueLength: 2,
					valueSha256: sha256('number-value'),
					valueState: 'EXACT',
					valueType: 'NUMBER'
				},
				{
					lexemeLength: 1,
					lexemeSha256: sha256('string'),
					nodeOrdinal: 5,
					sourceOrdinal: 0,
					value: 'x',
					valueEncoding: 'JSON_SCALAR',
					valueLength: 1,
					valueSha256: sha256('string-value'),
					valueState: 'EXACT',
					valueType: 'STRING'
				}
			]
		});
		const nodeIds = new Map(snapshot.astNodes.map((node) => [node.start, node.id]));
		const projectOptions = snapshot.projects[0]!.programRecipe.compilerOptions;

		expect(nodeIds).toHaveLength(astNodes.length);
		expect(snapshot.astNodes.find((node) => node.start === 5)?.structuralRoles).toEqual([
			'generic-child',
			'invocation-argument'
		]);
		expect(snapshot.declarationCandidates[0]).toMatchObject({
			exportCarrierNodeId: nodeIds.get(0),
			localModifiers: [
				{ code: ts.SyntaxKind.AsyncKeyword, name: 'AsyncKeyword' },
				{ code: ts.SyntaxKind.DeclareKeyword, name: 'DeclareKeyword' },
				{ code: ts.SyntaxKind.DefaultKeyword, name: 'DefaultKeyword' },
				{ code: ts.SyntaxKind.ExportKeyword, name: 'ExportKeyword' }
			],
			nameNodeId: nodeIds.get(2),
			nodeId: nodeIds.get(1)
		});
		expect(
			snapshot.invocations.find((invocation) => invocation.invocationKind === 'CALL')
		).toMatchObject({
			argumentNodeIds: [nodeIds.get(5)],
			calleeNodeId: nodeIds.get(4),
			nodeId: nodeIds.get(3),
			optional: true,
			templateNodeId: null
		});
		expect(
			snapshot.invocations.find((invocation) => invocation.invocationKind === 'NEW')
		).toMatchObject({
			argumentNodeIds: [nodeIds.get(8)],
			calleeNodeId: nodeIds.get(7),
			nodeId: nodeIds.get(6),
			optional: false,
			templateNodeId: null
		});
		expect(
			snapshot.invocations.find((invocation) => invocation.invocationKind === 'TAGGED_TEMPLATE')
		).toMatchObject({
			argumentNodeIds: [],
			calleeNodeId: nodeIds.get(10),
			nodeId: nodeIds.get(9),
			optional: false,
			templateNodeId: nodeIds.get(11)
		});
		expect(
			snapshot.assignments.find((assignment) => assignment.assignmentKind === 'BINARY')
		).toMatchObject({
			nodeId: nodeIds.get(12),
			targetNodeId: nodeIds.get(13),
			valueNodeId: nodeIds.get(14)
		});
		expect(
			snapshot.assignments.find((assignment) => assignment.assignmentKind === 'POSTFIX_UPDATE')
		).toMatchObject({
			nodeId: nodeIds.get(15),
			targetNodeId: nodeIds.get(16),
			valueNodeId: null
		});
		expect(
			snapshot.literals.map(({ valueState, valueType }) => [valueState, valueType]).sort()
		).toEqual([
			['DIGEST_ONLY', 'NO_SUBSTITUTION_TEMPLATE'],
			['EXACT', 'BOOLEAN'],
			['EXACT', 'NUMBER'],
			['EXACT', 'STRING']
		]);
		expect(snapshot.populations.find((population) => population.kind === 'LITERAL')?.analyzed).toBe(
			4
		);
		expect(
			snapshot.populations.find((population) => population.kind === 'INVOCATION_SITE')?.analyzed
		).toBe(3);
		expect(
			snapshot.populations.find((population) => population.kind === 'ASSIGNMENT')?.analyzed
		).toBe(2);
		expect(projectOptions).toEqual(nestedRecipe.compilerOptions);
		expect(projectOptions).not.toBe(nestedRecipe.compilerOptions);
		expect(projectOptions.paths).not.toBe(nestedRecipe.compilerOptions.paths);
		expect(projectOptions.plugins).not.toBe(nestedRecipe.compilerOptions.plugins);
	});

	it('fails closed for recipe, attribution, context-input, and tagged-template inconsistencies', () => {
		const recipeInput = normalizationInput();
		expect(() =>
			normalizeStaticSemanticSnapshot({
				...recipeInput,
				subject: subject(recipe({ strict: false }))
			})
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'INVALID_RAW_MODEL',
				message: 'Project tsconfig.json does not reproduce its authoritative recipe.'
			})
		);

		const attributionInput = normalizationInput();
		expect(() =>
			normalizeStaticSemanticSnapshot({
				...attributionInput,
				capture: {
					...attributionInput.capture,
					projectAttributions: attributionInput.capture.projectAttributions.map((attribution) => ({
						...attribution,
						projectResolutionDigest: sha256('mismatched-attribution')
					}))
				}
			})
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'INVALID_RAW_MODEL',
				message: 'Project tsconfig.json does not reproduce its authoritative recipe.'
			})
		);

		const missingAttributionInput = normalizationInput();
		expect(() =>
			normalizeStaticSemanticSnapshot({
				...missingAttributionInput,
				capture: { ...missingAttributionInput.capture, projectAttributions: [] }
			})
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'INVALID_RAW_MODEL',
				message: 'Raw, frozen, and compiler-attributed project populations differ.'
			})
		);

		const contextInput = normalizationInput();
		const absentContextInputId =
			`semantic-context-input:${sha256('absent-context-input')}` as CompilerInputObservation['id'];
		expect(() =>
			normalizeStaticSemanticSnapshot({
				...contextInput,
				capture: {
					...contextInput.capture,
					projectAttributions: contextInput.capture.projectAttributions.map((attribution) => ({
						...attribution,
						contextInputIds: [absentContextInputId]
					}))
				}
			})
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'INVALID_RAW_MODEL',
				message: 'Project tsconfig.json references an absent compiler input.'
			})
		);

		const taggedBase = raw();
		expect(() =>
			normalize({
				...taggedBase,
				astNodes: [
					...taggedBase.astNodes,
					childNode(1, ts.SyntaxKind.TaggedTemplateExpression),
					childNode(2, ts.SyntaxKind.Identifier)
				],
				invocations: [
					{
						argumentNodeOrdinals: [],
						calleeNodeOrdinal: 2,
						invocationKind: 'TAGGED_TEMPLATE',
						nodeOrdinal: 1,
						optional: false,
						sourceOrdinal: 0,
						templateNodeOrdinal: null
					}
				]
			})
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'INVALID_RAW_MODEL',
				message: 'Tagged template lacks its template node.'
			})
		);
	});

	it('fails closed before emitting a snapshot when raw populations exceed producing budgets', () => {
		const base = raw();
		const extra = {
			...base.sources[0]!,
			analysisDisposition: 'CONTEXT_ONLY' as const,
			artifactClass: 'CONTEXT_ONLY' as const,
			artifactRoles: [],
			logicalPath: 'lib/context.d.ts',
			rootFile: false,
			rootNodeOrdinal: null,
			sourceOrdinal: 1
		};
		expect(() =>
			normalize({ ...base, sources: [...base.sources, extra] }, request({ maxSources: 1 }))
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({ code: 'BUDGET_EXCEEDED' })
		);
	});

	it('rejects provisional capture projections at the normalization boundary', () => {
		expect(() => normalize({ ...raw(), evidenceState: 'CAPTURED_COMPILER_INPUT' })).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({ code: 'INVALID_RAW_MODEL' })
		);
	});
});
