import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import {
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
	SEMANTIC_TYPE_DISPLAY_PROFILE,
	SEMANTIC_TYPE_FINGERPRINT_PROFILE,
	TYPESCRIPT_PROVIDER_VERSION,
	type BuildStaticSemanticSnapshotRequest,
	type CompilerInputObservation,
	type SemanticBudgets,
	type SemanticFactProvenanceRecord,
	type SemanticPopulationKind,
	type StaticSemanticSnapshot
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
	semanticContextInputId,
	semanticDurableDeclarationId
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
	maxCompilerFacts: 10_000,
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
	maxScopes: 100_000,
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

function projectRecipe(configPath: string, logicalPath: string): ProgramRecipe {
	const initial = recipe();
	const base = {
		compilerOptions: initial.compilerOptions,
		configClosureDigest: sha256(`config-closure:${configPath}`),
		configPath,
		kind: initial.kind,
		projectReferences: [],
		provider: initial.provider,
		rootNames: [logicalPath]
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
		assignabilityRequests: [],
		budgets: { ...BUDGETS, ...overrides },
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'],
		expectEmpty: false,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		rootLocator: 'C:/normalizer-fixture',
		schemaVersion: SEMANTIC_REQUEST_SCHEMA_VERSION,
		subjectId: SUBJECT_ID
	};
}

function subject(programRecipe = recipe()): FrozenSubject {
	const logicalPath = programRecipe.rootNames[0]!;
	return {
		artifacts: [
			{
				bytes: Buffer.byteLength(CONTENT),
				canonicalPathKey: logicalPath,
				disposition: 'ANALYZED',
				path: logicalPath,
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

function observation(logicalPath = 'src/index.ts'): CompilerInputObservation {
	const result = {
		byteBudgetClass: 'FROZEN_SUBJECT' as const,
		contentBytes: Buffer.byteLength(CONTENT),
		contentSha256: CONTENT_SHA,
		invocationCount: 1,
		logicalPath,
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
	const logicalPath = programRecipe.rootNames[0]!;
	return {
		aliases: [],
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
		declarations: [],
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
		moduleExports: [],
		moduleResolutions: [],
		overloadSets: [],
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
		references: [],
		scopes: [
			{
				domain: 'LEXICAL',
				end: null,
				kind: 'PROGRAM_GLOBAL',
				ownerKind: null,
				ownerKindName: null,
				ownerNodeOrdinal: null,
				parentScopeOrdinal: null,
				scopeOrdinal: 0,
				sourceOrdinal: null,
				start: null
			},
			{
				domain: 'LEXICAL',
				end: CONTENT.length,
				kind: 'SOURCE_SCRIPT',
				ownerKind: ts.SyntaxKind.SourceFile,
				ownerKindName: 'SourceFile',
				ownerNodeOrdinal: 0,
				parentScopeOrdinal: 0,
				scopeOrdinal: 1,
				sourceOrdinal: 0,
				start: 0
			}
		],
		sources: [
			{
				analysisDisposition: 'DEEP_INDEXED',
				artifactClass: 'PRODUCTION_SOURCE',
				artifactRoles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'],
				bytes: Buffer.byteLength(CONTENT),
				contentSha256: CONTENT_SHA,
				declarationFile: false,
				languageVariant: 'Standard',
				logicalPath,
				mapping: {
					reason: 'Authored TypeScript is already in source coordinates.',
					state: 'NOT_APPLICABLE'
				},
				moduleKind: 'SCRIPT',
				origin: 'AUTHORED',
				rootFile: true,
				rootNodeOrdinal: 0,
				scriptKind: ts.ScriptKind.TS,
				scriptKindName: 'TS',
				sourceOrdinal: 0,
				textLength: CONTENT.length
			}
		],
		signatureParameters: [],
		signatures: [],
		symbols: [],
		typeParameters: [],
		typeRelations: [],
		types: []
	};
}

function bindingRaw(): RawStaticSemanticProjectExtraction {
	const base = raw();
	return {
		...base,
		astNodes: [
			base.astNodes[0]!,
			childNode(1, ts.SyntaxKind.VariableDeclaration, {
				structuralRoles: ['generic-child']
			}),
			childNode(2, ts.SyntaxKind.Identifier, {
				structuralRoles: ['generic-child'],
				syntacticIdentifierText: 'value'
			})
		],
		declarations: [
			{
				ambient: false,
				candidateNodeOrdinal: null,
				declarationOrdinal: 0,
				declaringScopeOrdinal: 1,
				end: 2,
				kind: ts.SyntaxKind.VariableDeclaration,
				kindName: 'VariableDeclaration',
				name: 'value',
				nameState: 'ATOMIC',
				nodeOrdinal: 1,
				scopeLinkState: 'RESOLVED',
				sourceOrdinal: 0,
				start: 1,
				symbolBindingState: 'RESOLVED',
				symbolOrdinal: 0
			}
		],
		references: [
			{
				containingScopeOrdinal: 1,
				nodeOrdinal: 2,
				resolvedSymbolOrdinal: 0,
				resolutionState: 'RESOLVED_DIRECT',
				role: 'SYMBOL_USE',
				scopeLinkState: 'RESOLVED',
				sourceOrdinal: 0,
				symbolOrdinal: 0
			}
		],
		symbols: [
			{
				declarationOrdinals: [0],
				fallbackReferenceNodes: [],
				flags: ts.SymbolFlags.BlockScopedVariable,
				flagNames: ['BlockScopedVariable'],
				name: 'value',
				symbolOrdinal: 0,
				valueDeclarationOrdinal: 0
			}
		]
	};
}

function rawDiagnostic(
	message: RawSemanticDiagnosticMessage = diagnosticMessage('fixture diagnostic'),
	related: RawStaticSemanticProjectExtraction['diagnostics'][number]['related'] = []
): RawStaticSemanticProjectExtraction['diagnostics'][number] {
	return {
		category: 'ERROR',
		code: 'TS1000',
		end: null,
		family: 'SEMANTIC',
		locationKind: 'NONE',
		message,
		occurrenceOrdinal: 0,
		path: null,
		related,
		sourceOrdinal: null,
		start: null
	};
}

function withDiagnostic(
	project: RawStaticSemanticProjectExtraction,
	occurrence = rawDiagnostic(),
	covered = true
): RawStaticSemanticProjectExtraction {
	return {
		...project,
		diagnosticFamilies: project.diagnosticFamilies.map((family) =>
			family.family === occurrence.family
				? { ...family, diagnosticOccurrenceOrdinals: covered ? [occurrence.occurrenceOrdinal] : [] }
				: family
		),
		diagnostics: [occurrence]
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

function multiProjectNormalizationInput(): NormalizeStaticSemanticSnapshotInput {
	const recipes = [
		projectRecipe('packages/a/tsconfig.json', 'packages/a/src/index.ts'),
		projectRecipe('packages/b/tsconfig.json', 'packages/b/src/index.ts')
	] as const;
	const projects = recipes.map((programRecipe) => raw(programRecipe));
	const observations = recipes.map((programRecipe) => observation(programRecipe.rootNames[0]!));
	const firstSubject = subject(recipes[0]);
	const secondSubject = subject(recipes[1]);
	return {
		capture: {
			closureDigest: compilerInputClosureDigest(observations),
			observations,
			projectAttributions: projects.map((project, index) => ({
				contextInputIds: [observations[index]!.id],
				materializedRecipeDigest: sha256(`materialized-recipe:${project.project.configPath}`),
				projectKey: project.project.configPath,
				projectResolutionDigest: project.project.programRecipe.projectResolutionDigest,
				queryInvocations: [
					{
						invocationCount: 1,
						query: { logicalPath: observations[index]!.logicalPath, operation: 'READ_FILE' }
					}
				]
			}))
		},
		projects,
		request: request(),
		subject: {
			...firstSubject,
			artifacts: [...firstSubject.artifacts, ...secondSubject.artifacts],
			population: {
				...firstSubject.population,
				analyzed: 2,
				discovered: 2,
				included: 2
			},
			projects: [...firstSubject.projects, ...secondSubject.projects]
		}
	};
}

function normalize(rawProject = raw(), semanticRequest = request()) {
	return normalizeStaticSemanticSnapshot(normalizationInput(rawProject, semanticRequest));
}

const TYPE_ASSIGNABILITY_REQUEST: BuildStaticSemanticSnapshotRequest['assignabilityRequests'][number] =
	{
		requestId: 'normalizer-type-assignability',
		requesterRef: 'normalize-semantic-snapshot.test',
		source: {
			end: 3,
			logicalPath: 'src/index.ts',
			queryMode: 'TYPE_AT_LOCATION',
			start: 2,
			syntaxKind: ts.SyntaxKind.Identifier
		},
		target: {
			end: 3,
			logicalPath: 'src/index.ts',
			queryMode: 'TYPE_AT_LOCATION',
			start: 2,
			syntaxKind: ts.SyntaxKind.Identifier
		}
	};

function typeRequest(
	assignabilityRequests: BuildStaticSemanticSnapshotRequest['assignabilityRequests'] = [
		TYPE_ASSIGNABILITY_REQUEST
	]
): BuildStaticSemanticSnapshotRequest {
	return {
		...request(),
		assignabilityRequests,
		capabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']
	};
}

function typeRaw(): RawStaticSemanticProjectExtraction {
	const base = bindingRaw();
	const type = (
		typeOrdinal: number,
		display: string,
		category: RawStaticSemanticProjectExtraction['types'][number]['category'],
		acquisitionAnchors: RawStaticSemanticProjectExtraction['types'][number]['acquisitionAnchors']
	): RawStaticSemanticProjectExtraction['types'][number] => ({
		acquisitionAnchors,
		aliasSymbolOrdinal: null,
		category,
		display,
		displayProfile: SEMANTIC_TYPE_DISPLAY_PROFILE,
		displaySha256: sha256(display),
		fingerprintProfile: SEMANTIC_TYPE_FINGERPRINT_PROFILE,
		fingerprintSha256: sha256(`normalizer-type-fingerprint:${typeOrdinal}`),
		flagNames:
			category === 'OBJECT'
				? ['Object']
				: category === 'INTRINSIC'
					? ['Number']
					: ['IncludesMissingType', 'TypeParameter'],
		flags:
			category === 'OBJECT'
				? ts.TypeFlags.Object
				: category === 'INTRINSIC'
					? ts.TypeFlags.Number
					: ts.TypeFlags.TypeParameter,
		identityBasis: acquisitionAnchors.some((anchor) => anchor.kind === 'DECLARATION')
			? 'DECLARATION_ANCHORED'
			: acquisitionAnchors.some((anchor) => anchor.kind === 'NODE' || anchor.kind === 'SYMBOL')
				? 'QUERY_ANCHORED'
				: 'STRUCTURAL',
		objectFlagNames: [],
		objectFlags: category === 'OBJECT' ? 0 : null,
		structureState: 'COMPLETE',
		symbolOrdinal: null,
		typeOrdinal,
		unsupportedStructureKinds: []
	});
	const signature = (
		signatureOrdinal: number,
		display: string,
		overrides: Partial<RawStaticSemanticProjectExtraction['signatures'][number]>
	): RawStaticSemanticProjectExtraction['signatures'][number] => ({
		declarationOrdinal: 0,
		declarationRole: 'DECLARATION',
		display,
		displaySha256: sha256(display),
		fingerprintProfile: SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
		fingerprintSha256: sha256(`normalizer-signature-fingerprint:${signatureOrdinal}`),
		identityBasis: 'DECLARATION_ANCHORED',
		owner: { declarationOrdinal: 0, kind: 'DECLARATION' },
		parameterOrdinals: [],
		providerOrdinal: null,
		returnTypeOrdinal: 1,
		semanticKind: 'SIGNATURE',
		signatureKind: 'CALL',
		signatureOrdinal,
		typeParameterOrdinals: [],
		...overrides
	});
	const contextDigest = compilerInputClosureDigest([observation()]);

	return {
		...base,
		astNodes: [
			base.astNodes[0]!,
			{
				...base.astNodes[1]!,
				end: 3,
				siblingOrdinal: 0
			},
			{
				...base.astNodes[2]!,
				parentNodeOrdinal: 1,
				siblingOrdinal: 0,
				structuralRoles: ['declaration-name', 'generic-child']
			}
		],
		declarationCandidates: [
			{
				ambientSyntax: false,
				candidateRole: 'BINDING',
				exportCarrierNodeOrdinal: null,
				exportSyntax: 'NONE',
				localModifiers: [],
				nameNodeOrdinal: 2,
				nameState: 'ATOMIC',
				nodeOrdinal: 1,
				sourceOrdinal: 0,
				syntacticName: 'value',
				syntaxKind: ts.SyntaxKind.VariableDeclaration,
				syntaxKindName: 'VariableDeclaration'
			}
		],
		declarations: [
			{
				...base.declarations[0]!,
				candidateNodeOrdinal: 1,
				declaringScopeOrdinal: 0,
				end: 3
			}
		],
		overloadSets: [],
		references: [],
		signatures: [
			signature(0, '<T>(): number', { typeParameterOrdinals: [0] }),
			signature(1, '(): number', {
				identityBasis: 'OWNER_ORDINAL',
				owner: { kind: 'TYPE', typeOrdinal: 0 },
				providerOrdinal: 0
			})
		],
		typeParameters: [
			{
				constraintState: 'UNSUPPORTED',
				constraintTypeOrdinal: null,
				declarationOrdinal: null,
				defaultState: 'MISSING',
				defaultTypeOrdinal: null,
				name: 'T',
				ordinal: 0,
				owner: { kind: 'SIGNATURE', signatureOrdinal: 0 },
				parameterTypeOrdinal: 2,
				typeParameterOrdinal: 0
			},
			{
				constraintState: 'MISSING',
				constraintTypeOrdinal: null,
				declarationOrdinal: null,
				defaultState: 'UNRESOLVED',
				defaultTypeOrdinal: null,
				name: 'U',
				ordinal: 0,
				owner: { kind: 'TYPE', typeOrdinal: 0 },
				parameterTypeOrdinal: 4,
				typeParameterOrdinal: 1
			}
		],
		typeRelations: [
			{
				kind: 'TYPE_OF',
				queryMode: 'TYPE_AT_LOCATION',
				relationOrdinal: 0,
				state: 'CONFIRMED',
				subject: { kind: 'AST_NODE', nodeOrdinal: 2, sourceOrdinal: 0 },
				typeOrdinal: 0
			},
			{
				kind: 'TYPE_OF',
				queryMode: 'TYPE_AT_LOCATION',
				relationOrdinal: 1,
				state: 'CONFIRMED',
				subject: { declarationOrdinal: 0, kind: 'DECLARATION' },
				typeOrdinal: 3
			},
			{
				kind: 'TYPE_OF',
				queryMode: 'DECLARED_SYMBOL_TYPE',
				relationOrdinal: 2,
				state: 'CONFIRMED',
				subject: { kind: 'SYMBOL', symbolOrdinal: 0 },
				typeOrdinal: 4
			},
			{
				argumentTypeOrdinals: [0],
				genericTarget: { kind: 'SIGNATURE', signatureOrdinal: 0 },
				instantiatedTarget: { kind: 'SIGNATURE', signatureOrdinal: 1 },
				kind: 'GENERIC_INSTANTIATION',
				relationOrdinal: 3,
				state: 'CONFIRMED'
			},
			{
				baseTypeOrdinal: 0,
				derivedTypeOrdinal: 3,
				heritageOccurrence: { kind: 'AST_NODE', nodeOrdinal: 2, sourceOrdinal: 0 },
				kind: 'TYPE_EXTENSION',
				relationOrdinal: 4,
				state: 'CONFIRMED'
			},
			{
				baseTypeOrdinal: 0,
				derivedTypeOrdinal: 3,
				heritageOccurrence: { declarationOrdinal: 0, kind: 'DECLARATION' },
				kind: 'TYPE_IMPLEMENTATION',
				relationOrdinal: 5,
				state: 'CONFIRMED'
			},
			{
				constraintState: 'UNSUPPORTED',
				constraintTypeOrdinal: null,
				kind: 'PARAMETER_CONSTRAINT',
				relationOrdinal: 6,
				state: 'UNSUPPORTED',
				typeParameterOrdinal: 0
			},
			{
				constraintState: 'MISSING',
				constraintTypeOrdinal: null,
				kind: 'PARAMETER_CONSTRAINT',
				relationOrdinal: 7,
				state: 'CONFIRMED',
				typeParameterOrdinal: 1
			},
			{
				checkerContextDigest: contextDigest,
				kind: 'ASSIGNABILITY',
				relationOrdinal: 8,
				requestId: TYPE_ASSIGNABILITY_REQUEST.requestId,
				result: true,
				sourceTypeOrdinal: 0,
				state: 'CONFIRMED',
				targetTypeOrdinal: 0
			}
		],
		types: [
			type(0, 'Box', 'OBJECT', [
				{ kind: 'NODE', nodeOrdinal: 2, queryMode: 'TYPE_AT_LOCATION', sourceOrdinal: 0 }
			]),
			type(
				1,
				'number',
				'INTRINSIC',
				[0, 1].map((signatureOrdinal) => ({
					componentKind: 'RETURN' as const,
					componentOrdinal: 0,
					kind: 'SIGNATURE_COMPONENT' as const,
					signatureOrdinal
				}))
			),
			type(2, 'T', 'TYPE_PARAMETER', [
				{
					componentKind: 'TYPE_PARAMETER',
					componentOrdinal: 0,
					kind: 'SIGNATURE_COMPONENT',
					signatureOrdinal: 0
				}
			]),
			type(3, 'Derived', 'OBJECT', [
				{ declarationOrdinal: 0, kind: 'DECLARATION', queryMode: 'TYPE_AT_LOCATION' }
			]),
			type(4, 'U', 'TYPE_PARAMETER', [
				{ kind: 'SYMBOL', queryMode: 'DECLARED_SYMBOL_TYPE', symbolOrdinal: 0 }
			])
		]
	};
}

function overloadTypeRaw(): RawStaticSemanticProjectExtraction {
	const base = typeRaw();
	const overloadSignatures: RawStaticSemanticProjectExtraction['signatures'] = [0, 1].map(
		(providerOrdinal) => {
			const signatureOrdinal = providerOrdinal + base.signatures.length;
			const display = `(value: Box): number /* overload ${providerOrdinal} */`;
			return {
				...base.signatures[0]!,
				declarationRole: 'OVERLOAD_DECLARATION',
				display,
				displaySha256: sha256(display),
				fingerprintSha256: sha256(`normalizer-overload-signature:${providerOrdinal}`),
				identityBasis: 'OWNER_ORDINAL',
				owner: { kind: 'SYMBOL', symbolOrdinal: 0 },
				providerOrdinal,
				semanticKind: 'OVERLOAD_SIGNATURE',
				signatureOrdinal,
				typeParameterOrdinals: []
			};
		}
	);
	const membershipRelations: RawStaticSemanticProjectExtraction['typeRelations'] =
		overloadSignatures.map((signature, ordinal) => ({
			kind: 'OVERLOAD_MEMBERSHIP',
			ordinal,
			overloadSetOrdinal: 0,
			relationOrdinal: base.typeRelations.length + ordinal,
			role: 'OVERLOAD_DECLARATION',
			signatureOrdinal: signature.signatureOrdinal,
			state: 'CONFIRMED'
		}));

	return {
		...base,
		overloadSets: [{ callableSymbolOrdinal: 0, overloadSetOrdinal: 0 }],
		signatures: [...base.signatures, ...overloadSignatures],
		typeRelations: [...base.typeRelations, ...membershipRelations],
		types: base.types.map((type) =>
			type.typeOrdinal === 1
				? {
						...type,
						acquisitionAnchors: [
							...type.acquisitionAnchors,
							...overloadSignatures.map((signature) => ({
								componentKind: 'RETURN' as const,
								componentOrdinal: 0,
								kind: 'SIGNATURE_COMPONENT' as const,
								signatureOrdinal: signature.signatureOrdinal
							}))
						]
					}
				: type
		)
	};
}

function normalizeTypes(rawProject = typeRaw(), semanticRequest = typeRequest()) {
	return normalize(rawProject, semanticRequest);
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
		expect(snapshot.provenances).toHaveLength(6);
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

	it('normalizes validator-clean TS_TYPE ownership, heritage, overload, and acquisition structures', () => {
		const snapshot = normalizeTypes();

		expect(validateStaticSemanticSnapshot(snapshot, {}, { frozenSubject: subject() })).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(snapshot.signatures.map((signature) => signature.owner.kind)).toEqual(
			expect.arrayContaining(['DECLARATION', 'TYPE'])
		);
		expect(snapshot.typeParameters.map((parameter) => parameter.owner.kind)).toEqual(
			expect.arrayContaining(['SIGNATURE', 'TYPE'])
		);
		expect(snapshot.typeRelations.map((relation) => relation.kind)).toEqual(
			expect.arrayContaining([
				'ASSIGNABILITY',
				'GENERIC_INSTANTIATION',
				'PARAMETER_CONSTRAINT',
				'TYPE_EXTENSION',
				'TYPE_IMPLEMENTATION',
				'TYPE_OF'
			])
		);
		const overloadSnapshot = normalizeTypes(overloadTypeRaw());
		expect(overloadSnapshot.signatures.map((signature) => signature.owner.kind)).toContain(
			'SYMBOL'
		);
		expect(overloadSnapshot.typeRelations.map((relation) => relation.kind)).toContain(
			'OVERLOAD_MEMBERSHIP'
		);
		const unsupportedTypeParameters = snapshot.populations.find(
			(population) => population.kind === 'TYPE_PARAMETER'
		)?.members.unsupported;
		expect(unsupportedTypeParameters).toContain(
			snapshot.typeParameters.find((parameter) => parameter.name === 'T')?.id
		);
	});

	it('fails closed on malformed TS_TYPE request and collection boundaries', () => {
		const nonArrayRequest = normalizationInput();
		for (const [input, message] of [
			[
				{
					...nonArrayRequest,
					request: { ...nonArrayRequest.request, assignabilityRequests: null as never }
				},
				'Semantic assignability requests must be an array.'
			],
			[
				normalizationInput(raw(), {
					...request(),
					assignabilityRequests: [TYPE_ASSIGNABILITY_REQUEST]
				}),
				'Assignability requests require TS_TYPE.'
			],
			[
				normalizationInput({ ...raw(), types: null as never }),
				'Raw project tsconfig.json lacks the types TS_TYPE collection.'
			],
			[
				normalizationInput({ ...raw(), types: typeRaw().types }),
				'Raw project tsconfig.json emitted TS_TYPE facts when not requested.'
			],
			[
				normalizationInput({
					...raw(),
					project: {
						...raw().project,
						partialityReasons: [
							{
								capability: 'TS_TYPE',
								code: 'CAPABILITY_UNSUPPORTED',
								message: 'fixture type limitation',
								path: null
							}
						]
					}
				}),
				'Raw project tsconfig.json emitted TS_TYPE partiality when not requested.'
			]
		] as const) {
			expect(() => normalizeStaticSemanticSnapshot(input)).toThrowError(
				expect.objectContaining<Partial<SemanticNormalizationError>>({ message })
			);
		}
	});

	it('fails closed on incoherent TS_TYPE scalar, owner, and membership facts', () => {
		const rejects = (project: RawStaticSemanticProjectExtraction, message: string): void => {
			expect(() => normalizeTypes(project)).toThrowError(
				expect.objectContaining<Partial<SemanticNormalizationError>>({ message })
			);
		};
		const mutateType = (
			mutate: (
				type: RawStaticSemanticProjectExtraction['types'][number]
			) => RawStaticSemanticProjectExtraction['types'][number]
		): RawStaticSemanticProjectExtraction => {
			const base = typeRaw();
			return {
				...base,
				types: base.types.map((type, index) => (index === 0 ? mutate(type) : type))
			};
		};
		for (const [project, message] of [
			[
				mutateType((type) => ({ ...type, displayProfile: 'unsupported' as never })),
				'Type 0 has an unsupported display profile.'
			],
			[
				mutateType((type) => ({ ...type, fingerprintProfile: 'unsupported' as never })),
				'Type 0 has an unsupported fingerprint profile.'
			],
			[
				mutateType((type) => ({ ...type, displaySha256: sha256('wrong-display') })),
				'Type 0 display digest is incoherent.'
			],
			[mutateType((type) => ({ ...type, flags: -1 })), 'Type 0 flags are invalid.'],
			[mutateType((type) => ({ ...type, objectFlags: -1 })), 'Type 0 object flags are invalid.'],
			[
				mutateType((type) => ({
					...type,
					structureState: 'BOUNDED',
					unsupportedStructureKinds: []
				})),
				'Type 0 structure state is incoherent.'
			],
			[
				mutateType((type) => ({ ...type, acquisitionAnchors: [] })),
				'Type 0 lacks an acquisition anchor.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						signatures: base.signatures.map((signature, index) =>
							index === 0 ? { ...signature, fingerprintProfile: 'unsupported' as never } : signature
						)
					};
				})(),
				'Signature 0 has an unsupported fingerprint profile.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						signatures: base.signatures.map((signature, index) =>
							index === 0 ? { ...signature, displaySha256: sha256('wrong-display') } : signature
						)
					};
				})(),
				'Signature 0 display digest is incoherent.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						signatures: base.signatures.map((signature, index) =>
							index === 0 ? { ...signature, declarationOrdinal: null } : signature
						)
					};
				})(),
				'Signature 0 identity basis is incoherent.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						signatures: base.signatures.map((signature, index) =>
							index === 1 ? { ...signature, providerOrdinal: null } : signature
						)
					};
				})(),
				'Signature 1 lacks a valid provider ordinal.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						signatures: base.signatures.map((signature, index) =>
							index === 0
								? { ...signature, declarationRole: 'CALL_SIGNATURE', signatureKind: 'CONSTRUCT' }
								: signature
						)
					};
				})(),
				'Signature 0 kind and declaration role differ.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						typeParameters: base.typeParameters.map((parameter, index) =>
							index === 0 ? { ...parameter, ordinal: -1 } : parameter
						)
					};
				})(),
				'Type parameter 0 has an invalid owner ordinal.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						typeParameters: base.typeParameters.map((parameter, index) =>
							index === 0 ? { ...parameter, constraintState: 'RESOLVED' } : parameter
						)
					};
				})(),
				'Type parameter 0 constraint state is incoherent.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						typeParameters: base.typeParameters.map((parameter, index) =>
							index === 0 ? { ...parameter, defaultState: 'RESOLVED' } : parameter
						)
					};
				})(),
				'Type parameter 0 default state is incoherent.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						signatures: base.signatures.map((signature, index) =>
							index === 0 ? { ...signature, typeParameterOrdinals: [1] } : signature
						)
					};
				})(),
				'Signature 0 type-parameter membership is incoherent.'
			]
		] as const) {
			try {
				rejects(project as RawStaticSemanticProjectExtraction, message);
			} catch (error) {
				throw new Error(`TS_TYPE rejection case did not fail as expected: ${message}`, {
					cause: error
				});
			}
		}
	});

	it('fails closed on incoherent TS_TYPE relations and acquisition witnesses', () => {
		const rejects = (
			project: RawStaticSemanticProjectExtraction,
			message: string,
			semanticRequest = typeRequest()
		): void => {
			try {
				normalizeTypes(project, semanticRequest);
			} catch (error) {
				expect(error).toBeInstanceOf(SemanticNormalizationError);
				expect((error as SemanticNormalizationError).message).toContain(message);
				return;
			}
			throw new Error(`Expected TS_TYPE normalization failure containing: ${message}`);
		};
		const mutateRelation = (
			relationOrdinal: number,
			mutate: (
				relation: RawStaticSemanticProjectExtraction['typeRelations'][number]
			) => RawStaticSemanticProjectExtraction['typeRelations'][number],
			project = typeRaw()
		): RawStaticSemanticProjectExtraction => ({
			...project,
			typeRelations: project.typeRelations.map((relation) =>
				relation.relationOrdinal === relationOrdinal ? mutate(relation) : relation
			)
		});
		const appendRelation = (
			relation: object,
			project = typeRaw()
		): RawStaticSemanticProjectExtraction => ({
			...project,
			typeRelations: [
				...project.typeRelations,
				{
					...relation,
					relationOrdinal: project.typeRelations.length
				} as RawStaticSemanticProjectExtraction['typeRelations'][number]
			]
		});

		for (const [project, message] of [
			[
				mutateRelation(0, (relation) => ({ ...relation, state: 'UNSUPPORTED' })),
				'Type-of relation 0 state is incoherent.'
			],
			[
				appendRelation({
					aliasDeclarationOrdinal: 0,
					aliasedTypeOrdinal: null,
					kind: 'TYPE_ALIAS',
					state: 'CONFIRMED'
				}),
				'Type-alias relation 9 state is incoherent.'
			],
			[
				appendRelation({
					compositeTypeOrdinal: 0,
					constituentTypeOrdinal: 1,
					kind: 'UNION_CONSTITUENT',
					ordinal: 0,
					state: 'UNSUPPORTED'
				}),
				'Constituent relation 9 must be confirmed.'
			],
			[
				appendRelation({
					compositeTypeOrdinal: 0,
					constituentTypeOrdinal: 1,
					kind: 'UNION_CONSTITUENT',
					ordinal: -1,
					state: 'CONFIRMED'
				}),
				'Constituent relation 9 has an invalid ordinal.'
			],
			[
				appendRelation({
					compositeTypeOrdinal: 0,
					constituentTypeOrdinal: 1,
					kind: 'UNION_CONSTITUENT',
					ordinal: 0,
					state: 'CONFIRMED'
				}),
				'Constituent relation 9 composite kind is incoherent.'
			],
			[
				mutateRelation(3, (relation) => ({ ...relation, state: 'UNSUPPORTED' })),
				'Generic relation 3 must be confirmed.'
			],
			[
				mutateRelation(6, (relation) =>
					relation.kind === 'PARAMETER_CONSTRAINT'
						? { ...relation, constraintState: 'MISSING' }
						: relation
				),
				'Constraint relation 6 does not mirror its type parameter.'
			],
			[
				mutateRelation(4, (relation) => ({ ...relation, state: 'UNSUPPORTED' })),
				'Heritage relation 4 must be confirmed.'
			],
			[
				mutateRelation(8, (relation) =>
					relation.kind === 'ASSIGNABILITY'
						? { ...relation, checkerContextDigest: sha256('wrong-context') }
						: relation
				),
				'Assignability relation 8 checker context is incoherent.'
			],
			[
				mutateRelation(8, (relation) =>
					relation.kind === 'ASSIGNABILITY'
						? { ...relation, requestId: 'unrequested-assignability' }
						: relation
				),
				'Assignability relation 8 has no matching request.'
			],
			[
				mutateRelation(8, (relation) =>
					relation.kind === 'ASSIGNABILITY' ? { ...relation, result: null } : relation
				),
				'Assignability relation 8 state is incoherent.'
			],
			[
				(() => {
					const base = typeRaw();
					return { ...base, typeRelations: base.typeRelations.slice(0, -1) };
				})(),
				'Project tsconfig.json does not reconcile assignability requests.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						typeRelations: [
							...base.typeRelations,
							{ ...base.typeRelations[0]!, relationOrdinal: base.typeRelations.length }
						]
					};
				})(),
				'Project tsconfig.json contains duplicate type-relation identity'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						types: base.types.map((type, index) =>
							index === 0
								? {
										...type,
										acquisitionAnchors: [
											{
												componentKind: 'UNION',
												componentOrdinal: -1,
												kind: 'TYPE_COMPONENT',
												parentTypeOrdinal: 0
											}
										]
									}
								: type
						)
					};
				})(),
				'Type component anchor has an invalid ordinal.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						types: base.types.map((type, index) =>
							index === 2
								? {
										...type,
										acquisitionAnchors: [
											{
												componentKind: 'TYPE_PARAMETER',
												componentOrdinal: -1,
												kind: 'SIGNATURE_COMPONENT',
												signatureOrdinal: 0
											}
										]
									}
								: type
						)
					};
				})(),
				'Signature component anchor has an invalid ordinal.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						types: base.types.map((type, index) =>
							index === 1
								? {
										...type,
										acquisitionAnchors: type.acquisitionAnchors.map((anchor, anchorIndex) =>
											anchorIndex === 0 && anchor.kind === 'SIGNATURE_COMPONENT'
												? { ...anchor, componentOrdinal: 1 }
												: anchor
										)
									}
								: type
						)
					};
				})(),
				'A Signature return acquisition anchor must use ordinal zero.'
			],
			[
				(() => {
					const base = typeRaw();
					return {
						...base,
						types: base.types.map((type, index) =>
							index === 0
								? {
										...type,
										acquisitionAnchors: type.acquisitionAnchors.map((anchor) =>
											anchor.kind === 'NODE' ? { ...anchor, nodeOrdinal: 1 } : anchor
										)
									}
								: type
						)
					};
				})(),
				'without a matching fact.'
			]
		] as const) {
			try {
				rejects(project as RawStaticSemanticProjectExtraction, message);
			} catch (error) {
				throw new Error(`TS_TYPE relation rejection case failed: ${message}`, { cause: error });
			}
		}

		const overloadState = overloadTypeRaw();
		const firstMembershipOrdinal = typeRaw().typeRelations.length;
		rejects(
			mutateRelation(
				firstMembershipOrdinal,
				(relation) => ({ ...relation, state: 'UNSUPPORTED' }),
				overloadState
			),
			`Overload membership ${firstMembershipOrdinal} must be confirmed.`
		);
		rejects(
			mutateRelation(
				firstMembershipOrdinal,
				(relation) =>
					relation.kind === 'OVERLOAD_MEMBERSHIP' ? { ...relation, ordinal: -1 } : relation,
				overloadState
			),
			`Overload membership ${firstMembershipOrdinal} has an invalid ordinal.`
		);
		rejects(
			{
				...overloadState,
				typeRelations: overloadState.typeRelations.filter(
					(relation) => relation.kind !== 'OVERLOAD_MEMBERSHIP'
				)
			},
			'Overload set 0 has no membership relations.'
		);
		rejects(
			mutateRelation(
				firstMembershipOrdinal + 1,
				(relation) =>
					relation.kind === 'OVERLOAD_MEMBERSHIP' ? { ...relation, ordinal: 2 } : relation,
				overloadState
			),
			'Overload set 0 membership ordinals are not contiguous.'
		);
	});

	it('declares the exact Program-scoped TS_SYMBOL boundary for otherwise complete multi-Program snapshots', () => {
		const input = multiProjectNormalizationInput();
		const snapshot = normalizeStaticSemanticSnapshot(input);
		const limitation = {
			capability: 'TS_SYMBOL' as const,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason:
				'TypeScript symbol extraction and resolution are Program-scoped; cross-Program symbol identity and binding reconciliation is not implemented for this multi-project snapshot.',
			region: 'typescript-program-boundaries'
		};

		expect(snapshot.programs).toHaveLength(2);
		expect(snapshot.projects).toHaveLength(2);
		expect(snapshot.projects).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ health: 'COMPLETE', partialityReasons: [] }),
				expect.objectContaining({ health: 'COMPLETE', partialityReasons: [] })
			])
		);
		expect(snapshot.capabilities).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ capability: 'TS_PROJECT', state: 'SUPPORTED' }),
				expect.objectContaining({ capability: 'TS_SYMBOL', state: 'PARTIAL' }),
				expect.objectContaining({ capability: 'TS_SYNTAX', state: 'SUPPORTED' }),
				expect.objectContaining({ capability: 'TS_TYPE', state: 'UNSUPPORTED' })
			])
		);
		expect(snapshot.health).toBe('PARTIAL');
		expect(snapshot.limitations).toEqual([limitation]);
		const symbolProvenances = snapshot.provenances.filter(
			(provenance) => provenance.capability === 'TS_SYMBOL'
		);
		expect(symbolProvenances.length).toBeGreaterThan(0);
		for (const provenance of symbolProvenances) {
			expect(provenance.limitations).toContainEqual(limitation);
			expect(provenance.epistemic.capabilityCoverage).toBe('partial');
			expect(provenance.epistemic.unresolvedRegions).toContain('typescript-program-boundaries');
		}
		for (const population of snapshot.populations.filter((candidate) =>
			[
				'ALIAS',
				'DECLARATION',
				'MODULE_EXPORT',
				'MODULE_RESOLUTION',
				'REFERENCE',
				'SCOPE',
				'SYMBOL'
			].includes(candidate.kind)
		))
			expect(population).toMatchObject({ failed: 0, unknown: 0, unsupported: 0 });
		expect(validateStaticSemanticSnapshot(snapshot, {}, { frozenSubject: input.subject })).toEqual({
			issues: [],
			state: 'VALID'
		});

		for (const limitations of [
			snapshot.limitations.filter((candidate) => candidate.region !== limitation.region),
			[{ ...limitation, capability: 'TS_PROJECT' as const }],
			[{ ...limitation, closureEffect: 'NONE' as const }],
			[{ ...limitation, region: 'wrong-program-boundary' }],
			[{ ...limitation, reason: 'Incorrect Program-boundary claim.' }],
			[
				limitation,
				{ ...limitation, closureEffect: 'NONE' as const, reason: 'Extra boundary claim.' }
			].sort((left, right) =>
				`${left.capability}\0${left.closureEffect}\0${left.region}\0${left.reason}`.localeCompare(
					`${right.capability}\0${right.closureEffect}\0${right.region}\0${right.reason}`
				)
			)
		])
			expect(
				validateStaticSemanticSnapshot(
					{ ...snapshot, limitations },
					{},
					{ frozenSubject: input.subject }
				).issues
			).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						message:
							'Multi-Program snapshots require the exact canonical TS_SYMBOL Program-boundary limitation once.',
						path: '$.limitations'
					})
				])
			);

		const omittedProvenanceIndex = snapshot.provenances.findIndex(
			(provenance) => provenance.capability === 'TS_SYMBOL'
		);
		const omittedProvenance = {
			...snapshot,
			provenances: snapshot.provenances.map((provenance, index) =>
				index === omittedProvenanceIndex
					? {
							...provenance,
							limitations: provenance.limitations.filter(
								(candidate) => candidate.region !== limitation.region
							)
						}
					: provenance
			)
		};
		expect(
			validateStaticSemanticSnapshot(omittedProvenance, {}, { frozenSubject: input.subject }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'Every TS_SYMBOL provenance in a multi-Program snapshot requires the exact canonical Program-boundary limitation once.',
					path: `$.provenances[${omittedProvenanceIndex}].limitations`
				})
			])
		);
		const projectProvenanceIndex = snapshot.provenances.findIndex(
			(provenance) => provenance.capability === 'TS_PROJECT'
		);
		expect(
			validateStaticSemanticSnapshot(
				{
					...snapshot,
					provenances: snapshot.provenances.map((provenance, index) =>
						index === projectProvenanceIndex
							? { ...provenance, limitations: [limitation] }
							: provenance
					)
				},
				{},
				{ frozenSubject: input.subject }
			).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'The TS_SYMBOL Program-boundary provenance limitation is forbidden outside TS_SYMBOL provenance in a multi-Program snapshot.',
					path: `$.provenances[${projectProvenanceIndex}].limitations`
				})
			])
		);

		const singleProgram = normalize();
		expect(
			validateStaticSemanticSnapshot(
				{ ...singleProgram, limitations: [limitation] },
				{},
				{ frozenSubject: subject() }
			).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'The TS_SYMBOL Program-boundary limitation is forbidden unless the snapshot contains multiple Programs.',
					path: '$.limitations'
				})
			])
		);
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
			TS_SYMBOL: 'SUPPORTED',
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

	it('closes lossy source provenance over matching limitations and rejects dishonest source mutations', () => {
		const base = raw();
		const mappingReason = 'Generated coordinates could not be mapped exactly.';
		const snapshot = normalize({
			...base,
			project: {
				...base.project,
				partialityReasons: [
					{
						capability: 'TS_PROJECT',
						code: 'CONTEXT_FRESHNESS_UNKNOWN',
						message: mappingReason,
						path: 'src/index.ts'
					}
				]
			},
			sources: [
				{
					...base.sources[0]!,
					mapping: { reason: mappingReason, state: 'PARTIAL' },
					origin: 'AUTHORED'
				}
			]
		});
		expect(validateStaticSemanticSnapshot(snapshot, {}, { frozenSubject: subject() })).toEqual({
			issues: [],
			state: 'VALID'
		});
		const source = snapshot.sources[0]!;
		const sourceProvenance = snapshot.provenances.find(
			(record) => record.id === source.provenanceId
		)!;
		const parent = snapshot.provenances.find(
			(record) => record.id === sourceProvenance.parentProvenanceId
		)!;
		expect(sourceProvenance).toMatchObject({
			epistemic: {
				capabilityCoverage: 'partial',
				unresolvedRegions: ['src/index.ts']
			},
			limitations: [
				{
					capability: 'TS_PROJECT',
					closureEffect: 'DEGRADES_CLOSURE',
					reason: mappingReason,
					region: 'src/index.ts'
				}
			]
		});
		expect(parent.limitations).toEqual(sourceProvenance.limitations);
		expect(parent.epistemic.unresolvedRegions).toEqual(
			sourceProvenance.epistemic.unresolvedRegions
		);

		const mutateSourceProvenance = (
			mutate: (record: SemanticFactProvenanceRecord) => SemanticFactProvenanceRecord
		): StaticSemanticSnapshot => ({
			...snapshot,
			provenances: snapshot.provenances.map((record) =>
				record.id === source.provenanceId ? mutate(record) : record
			)
		});
		const expectedMessage =
			'Unknown or lossy source mapping requires partial TS_PROJECT provenance with its matching closure-degrading limitation and unresolved region.';
		for (const mutation of [
			mutateSourceProvenance((record) => ({
				...record,
				epistemic: { ...record.epistemic, capabilityCoverage: 'supported' }
			})),
			mutateSourceProvenance((record) => ({
				...record,
				epistemic: { ...record.epistemic, unresolvedRegions: [] },
				limitations: []
			}))
		])
			expect(
				validateStaticSemanticSnapshot(mutation, {}, { frozenSubject: subject() }).issues
			).toContainEqual(
				expect.objectContaining({
					message: expectedMessage,
					path: '$.sources[0].provenanceId'
				})
			);
		expect(
			validateStaticSemanticSnapshot(
				mutateSourceProvenance((record) => ({
					...record,
					epistemic: { ...record.epistemic, unresolvedRegions: [] },
					limitations: []
				})),
				{},
				{ frozenSubject: subject() }
			).issues
		).toContainEqual(
			expect.objectContaining({
				message:
					'Source provenance must monotonically preserve every parent limitation and unresolved region.'
			})
		);
	});

	it('normalizes syntax, bindings, modules, literals, all invocation variants, assignments, and nested recipe values', () => {
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
			childNode(16, ts.SyntaxKind.Identifier),
			childNode(17, ts.SyntaxKind.ImportDeclaration),
			childNode(18, ts.SyntaxKind.ImportSpecifier),
			childNode(19, ts.SyntaxKind.Identifier, {
				end: CONTENT.length,
				fullStart: CONTENT.length,
				start: CONTENT.length,
				syntacticIdentifierText: 'base'
			})
		];
		const rawWithFacts: RawStaticSemanticProjectExtraction = {
			...base,
			aliases: [
				{
					aliasSymbolOrdinal: 1,
					state: 'RESOLVED',
					targetSymbolOrdinal: 2,
					terminalSymbolOrdinal: 2
				}
			],
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
			declarations: [
				{
					ambient: false,
					candidateNodeOrdinal: 1,
					declarationOrdinal: 0,
					declaringScopeOrdinal: 1,
					end: 2,
					kind: ts.SyntaxKind.FunctionDeclaration,
					kindName: 'FunctionDeclaration',
					name: 'run',
					nameState: 'ATOMIC',
					nodeOrdinal: 1,
					sourceOrdinal: 0,
					scopeLinkState: 'RESOLVED',
					start: 1,
					symbolBindingState: 'RESOLVED',
					symbolOrdinal: 0
				},
				{
					ambient: false,
					candidateNodeOrdinal: null,
					declarationOrdinal: 1,
					declaringScopeOrdinal: 1,
					end: CONTENT.length,
					kind: ts.SyntaxKind.ImportSpecifier,
					kindName: 'ImportSpecifier',
					name: 'base',
					nameState: 'ATOMIC',
					nodeOrdinal: 18,
					sourceOrdinal: 0,
					scopeLinkState: 'RESOLVED',
					start: CONTENT.length - 1,
					symbolBindingState: 'RESOLVED',
					symbolOrdinal: 1
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
			],
			moduleExports: [
				{
					exportName: 'run',
					sourceOrdinal: 0,
					state: 'DIRECT',
					symbolOrdinal: 0,
					targetSymbolOrdinal: null
				}
			],
			moduleResolutions: [
				{
					moduleSymbolOrdinal: 2,
					nodeOrdinal: 17,
					occurrenceKind: 'IMPORT',
					resolutionState: 'RESOLVED_SOURCE',
					sourceOrdinal: 0,
					specifier: './index.js',
					specifierState: 'LITERAL',
					targetSourceOrdinal: 0,
					typeOnly: false
				}
			],
			references: [
				{
					containingScopeOrdinal: 1,
					nodeOrdinal: 2,
					resolvedSymbolOrdinal: 0,
					resolutionState: 'RESOLVED_DIRECT',
					role: 'DECLARATION_NAME',
					sourceOrdinal: 0,
					scopeLinkState: 'RESOLVED',
					symbolOrdinal: 0
				},
				{
					containingScopeOrdinal: 1,
					nodeOrdinal: 19,
					resolvedSymbolOrdinal: 2,
					resolutionState: 'RESOLVED_ALIAS',
					role: 'IMPORT_EXPORT_BINDING',
					sourceOrdinal: 0,
					scopeLinkState: 'RESOLVED',
					symbolOrdinal: 1
				}
			],
			symbols: [
				{
					declarationOrdinals: [0],
					fallbackReferenceNodes: [],
					flags: ts.SymbolFlags.Function,
					flagNames: ['Function'],
					name: 'run',
					symbolOrdinal: 0,
					valueDeclarationOrdinal: 0
				},
				{
					declarationOrdinals: [1],
					fallbackReferenceNodes: [],
					flags: ts.SymbolFlags.Alias,
					flagNames: ['Alias'],
					name: 'base',
					symbolOrdinal: 1,
					valueDeclarationOrdinal: 1
				},
				{
					declarationOrdinals: [],
					fallbackReferenceNodes: [{ nodeOrdinal: 17, sourceOrdinal: 0 }],
					flags: ts.SymbolFlags.ValueModule,
					flagNames: ['ValueModule'],
					name: '"src/index"',
					symbolOrdinal: 2,
					valueDeclarationOrdinal: null
				}
			]
		};
		const compilerFactCount =
			rawWithFacts.aliases.length +
			rawWithFacts.declarations.length +
			rawWithFacts.moduleExports.length +
			rawWithFacts.moduleResolutions.length +
			rawWithFacts.references.length +
			rawWithFacts.symbols.length;
		expect(compilerFactCount).toBeGreaterThan(1);
		expect(() =>
			normalize(rawWithFacts, request({ maxCompilerFacts: compilerFactCount }))
		).not.toThrow();
		expect(() =>
			normalize(rawWithFacts, request({ maxCompilerFacts: compilerFactCount - 1 }))
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({ code: 'BUDGET_EXCEEDED' })
		);
		const snapshot = normalize(rawWithFacts);
		const reorderedSnapshot = normalize({
			...rawWithFacts,
			declarations: [...rawWithFacts.declarations].reverse()
		});
		const largerBudgetSnapshot = normalize(
			rawWithFacts,
			request({ maxAstNodes: BUDGETS.maxAstNodes + 1 })
		);
		const unsupportedSnapshot = normalize({
			...rawWithFacts,
			declarations: rawWithFacts.declarations.map((record, index) =>
				index === 0
					? {
							...record,
							declaringScopeOrdinal: null,
							scopeLinkState: 'UNSUPPORTED' as const
						}
					: record
			),
			references: rawWithFacts.references.map((record, index) =>
				index === 0
					? {
							...record,
							containingScopeOrdinal: null,
							scopeLinkState: 'UNSUPPORTED' as const
						}
					: record
			)
		});
		const degradedRaw = (
			aliasState: 'UNRESOLVED' | 'CIRCULAR' | 'UNSUPPORTED',
			resolutionState: 'UNRESOLVED' | 'UNSUPPORTED',
			exportUnresolved: boolean
		): RawStaticSemanticProjectExtraction => ({
			...rawWithFacts,
			aliases: [
				{
					...rawWithFacts.aliases[0]!,
					state: aliasState,
					targetSymbolOrdinal: aliasState === 'CIRCULAR' ? 2 : null,
					terminalSymbolOrdinal: null
				}
			],
			moduleExports: rawWithFacts.moduleExports.map((record) =>
				exportUnresolved
					? { ...record, state: 'UNRESOLVED' as const, targetSymbolOrdinal: null }
					: record
			),
			moduleResolutions: rawWithFacts.moduleResolutions.map((record) => ({
				...record,
				moduleSymbolOrdinal: null,
				resolutionState,
				targetSourceOrdinal: null
			})),
			references: rawWithFacts.references.map((record, index) =>
				index === 1 ? { ...record, resolvedSymbolOrdinal: null, resolutionState } : record
			)
		});
		const unresolvedSnapshot = normalize(degradedRaw('UNRESOLVED', 'UNRESOLVED', true));
		const circularSnapshot = normalize(degradedRaw('CIRCULAR', 'UNRESOLVED', true));
		const unsupportedResolutionSnapshot = normalize(
			degradedRaw('UNSUPPORTED', 'UNSUPPORTED', false)
		);
		const nodeIds = new Map(snapshot.astNodes.map((node) => [node.start, node.id]));
		const projectOptions = snapshot.projects[0]!.programRecipe.compilerOptions;
		const durableProjection = (candidate: typeof snapshot) =>
			candidate.declarations
				.map(({ durableId, name }) => ({ durableId, name }))
				.sort((left, right) => (left.name ?? '').localeCompare(right.name ?? ''));
		const declarationPopulation = unsupportedSnapshot.populations.find(
			(population) => population.kind === 'DECLARATION'
		)!;
		const referencePopulation = unsupportedSnapshot.populations.find(
			(population) => population.kind === 'REFERENCE'
		)!;
		expect(declarationPopulation.members.analyzed).toEqual(
			unsupportedSnapshot.declarations.map((record) => record.id).sort()
		);
		expect(declarationPopulation.members.unsupported).toEqual(
			unsupportedSnapshot.declarations
				.filter((record) => record.scopeLinkState === 'UNSUPPORTED')
				.map((record) => record.id)
				.sort()
		);
		expect(referencePopulation.members.analyzed).toEqual(
			unsupportedSnapshot.references.map((record) => record.id).sort()
		);
		expect(referencePopulation.members.unsupported).toEqual(
			unsupportedSnapshot.references
				.filter((record) => record.scopeLinkState === 'UNSUPPORTED')
				.map((record) => record.id)
				.sort()
		);
		expect(declarationPopulation.reconciles).toBe(true);
		expect(referencePopulation.reconciles).toBe(true);

		const population = (candidate: StaticSemanticSnapshot, kind: SemanticPopulationKind) =>
			candidate.populations.find((record) => record.kind === kind)!;
		const unresolvedReference = unresolvedSnapshot.references.find(
			(record) => record.resolutionState === 'UNRESOLVED'
		)!;
		for (const [kind, analyzed, unknown] of [
			['ALIAS', unresolvedSnapshot.aliases, unresolvedSnapshot.aliases],
			['REFERENCE', unresolvedSnapshot.references, [unresolvedReference]],
			[
				'MODULE_RESOLUTION',
				unresolvedSnapshot.moduleResolutions,
				unresolvedSnapshot.moduleResolutions
			],
			['MODULE_EXPORT', unresolvedSnapshot.moduleExports, unresolvedSnapshot.moduleExports]
		] as const) {
			const record = population(unresolvedSnapshot, kind);
			expect(record.members.analyzed).toEqual(analyzed.map((fact) => fact.id).sort());
			expect(record.members.unknown).toEqual(unknown.map((fact) => fact.id).sort());
			expect(record.members.unsupported).toEqual([]);
			expect(record.reconciles).toBe(true);
		}
		expect(population(circularSnapshot, 'ALIAS').members.unknown).toEqual(
			circularSnapshot.aliases.map((record) => record.id).sort()
		);
		const unsupportedReference = unsupportedResolutionSnapshot.references.find(
			(record) => record.resolutionState === 'UNSUPPORTED'
		)!;
		for (const [kind, analyzed, unsupported] of [
			['ALIAS', unsupportedResolutionSnapshot.aliases, unsupportedResolutionSnapshot.aliases],
			['REFERENCE', unsupportedResolutionSnapshot.references, [unsupportedReference]],
			[
				'MODULE_RESOLUTION',
				unsupportedResolutionSnapshot.moduleResolutions,
				unsupportedResolutionSnapshot.moduleResolutions
			]
		] as const) {
			const record = population(unsupportedResolutionSnapshot, kind);
			expect(record.members.analyzed).toEqual(analyzed.map((fact) => fact.id).sort());
			expect(record.members.unsupported).toEqual(unsupported.map((fact) => fact.id).sort());
			expect(record.members.unknown).toEqual([]);
			expect(record.reconciles).toBe(true);
		}

		const degradedFacts = [
			{
				collection: 'aliases',
				provenanceId: unresolvedSnapshot.aliases[0]!.provenanceId
			},
			{
				collection: 'references',
				provenanceId: unresolvedReference.resolutionProvenanceId
			},
			{
				collection: 'moduleResolutions',
				provenanceId: unresolvedSnapshot.moduleResolutions[0]!.provenanceId
			},
			{
				collection: 'moduleExports',
				provenanceId: unresolvedSnapshot.moduleExports[0]!.provenanceId
			}
		] as const;
		for (const { provenanceId } of degradedFacts) {
			const factProvenance = unresolvedSnapshot.provenances.find(
				(record) => record.id === provenanceId
			)!;
			expect(factProvenance.epistemic.capabilityCoverage).toBe('partial');
			expect(
				factProvenance.limitations.some(
					(limitation) =>
						limitation.capability === 'TS_SYMBOL' &&
						limitation.closureEffect === 'DEGRADES_CLOSURE' &&
						factProvenance.epistemic.unresolvedRegions.includes(limitation.region)
				)
			).toBe(true);
			if (factProvenance.sourceId !== null) {
				const parent = unresolvedSnapshot.provenances.find(
					(record) => record.id === factProvenance.parentProvenanceId
				)!;
				expect(parent.limitations).toEqual(factProvenance.limitations);
				expect(parent.epistemic.unresolvedRegions).toEqual(
					factProvenance.epistemic.unresolvedRegions
				);
			}
		}

		expect(
			unsupportedSnapshot.capabilities.find((entry) => entry.capability === 'TS_SYMBOL')?.state
		).toBe('PARTIAL');
		for (const provenanceId of [
			...unsupportedSnapshot.scopes.map((fact) => fact.provenanceId),
			...unsupportedSnapshot.declarations.map((fact) => fact.structuralProvenanceId),
			...unsupportedSnapshot.references.map((fact) => fact.structuralProvenanceId)
		]) {
			const factProvenance = unsupportedSnapshot.provenances.find(
				(record) => record.id === provenanceId
			)!;
			expect(factProvenance.epistemic).toMatchObject({
				inference: 'derived',
				supportBasis: {
					kind: 'derived',
					method: 'typescript-public-ast-binding-rules'
				}
			});
		}

		for (const declaration of snapshot.declarations) {
			const source = snapshot.sources.find((candidate) => candidate.id === declaration.sourceId)!;
			expect(declaration.durableId).toBe(
				semanticDurableDeclarationId({
					ambient: declaration.ambient,
					contentSha256: source.contentSha256,
					declarationFile: source.declarationFile,
					end: declaration.end,
					kind: declaration.kind,
					languageVariant: source.languageVariant,
					logicalPath: source.logicalPath,
					name: declaration.name,
					nameState: declaration.nameState,
					scriptKind: source.scriptKind,
					start: declaration.start,
					typescriptVersion: TYPESCRIPT_PROVIDER_VERSION
				})
			);
		}
		expect(durableProjection(reorderedSnapshot)).toEqual(durableProjection(snapshot));
		expect(durableProjection(largerBudgetSnapshot)).toEqual(durableProjection(snapshot));
		expect(largerBudgetSnapshot.id).not.toBe(snapshot.id);
		expect(largerBudgetSnapshot.declarations.map(({ id }) => id).sort()).not.toEqual(
			snapshot.declarations.map(({ id }) => id).sort()
		);

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
		const runDeclaration = snapshot.declarations.find((declaration) => declaration.name === 'run');
		const importedDeclaration = snapshot.declarations.find(
			(declaration) => declaration.name === 'base'
		);
		const alias = snapshot.aliases[0];
		expect(runDeclaration).toMatchObject({
			ambient: false,
			candidateId: snapshot.declarationCandidates[0]?.id,
			nodeId: nodeIds.get(1),
			nameState: 'ATOMIC'
		});
		expect(importedDeclaration).toMatchObject({ candidateId: null, nodeId: nodeIds.get(18) });
		expect(snapshot.symbols.map((symbol) => symbol.mergeState).sort()).toEqual([
			'DECLARATIONLESS',
			'SINGLE',
			'SINGLE'
		]);
		expect(alias).toMatchObject({
			state: 'RESOLVED',
			targetSymbolId: alias?.terminalSymbolId
		});
		expect(
			snapshot.references.find((reference) => reference.role === 'IMPORT_EXPORT_BINDING')
		).toMatchObject({
			resolutionState: 'RESOLVED_ALIAS',
			resolvedSymbolId: alias?.terminalSymbolId,
			symbolId: alias?.aliasSymbolId
		});
		expect(snapshot.moduleResolutions[0]).toMatchObject({
			moduleSymbolId: alias?.terminalSymbolId,
			occurrenceKind: 'IMPORT',
			resolutionState: 'RESOLVED_SOURCE',
			specifier: './index.js',
			specifierState: 'LITERAL',
			targetSourceId: snapshot.sources[0]?.id,
			typeOnly: false
		});
		expect(snapshot.moduleExports[0]).toMatchObject({
			exportName: 'run',
			state: 'DIRECT',
			symbolId: runDeclaration?.symbolId,
			targetSymbolId: null
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
		expect(
			Object.fromEntries(
				snapshot.populations
					.filter((population) =>
						[
							'DECLARATION',
							'SYMBOL',
							'ALIAS',
							'REFERENCE',
							'MODULE_RESOLUTION',
							'MODULE_EXPORT'
						].includes(population.kind)
					)
					.map((population) => [population.kind, population.analyzed])
			)
		).toEqual({
			ALIAS: 1,
			DECLARATION: 2,
			MODULE_EXPORT: 1,
			MODULE_RESOLUTION: 1,
			REFERENCE: 2,
			SYMBOL: 3
		});
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

	it('rejects mismatched request, capture, project, path, and aggregate population boundaries', () => {
		const baseInput = normalizationInput();
		for (const [input, message, code] of [
			[
				{
					...baseInput,
					request: { ...baseInput.request, subjectId: sha256('different-subject') }
				},
				'Semantic request and FrozenSubject identities differ.',
				'INVALID_RAW_MODEL'
			],
			[
				{
					...baseInput,
					request: { ...baseInput.request, capabilities: ['TS_PROJECT'] as never }
				},
				'DWP-003 TS_SYMBOL normalization requires exactly TS_PROJECT, TS_SYMBOL, and TS_SYNTAX.',
				'INVALID_RAW_MODEL'
			],
			[
				{ ...baseInput, projects: [] },
				'Raw project population does not reproduce the frozen project population.',
				'INVALID_RAW_MODEL'
			],
			[
				{
					...baseInput,
					capture: { ...baseInput.capture, closureDigest: sha256('wrong-closure') }
				},
				'Verified compiler capture closure digest is incoherent.',
				'INVALID_RAW_MODEL'
			]
		] as const) {
			expect(() =>
				normalizeStaticSemanticSnapshot(input as NormalizeStaticSemanticSnapshotInput)
			).toThrowError(
				expect.objectContaining<Partial<SemanticNormalizationError>>({ code, message })
			);
		}

		expect(() => normalize(raw(), request({ maxPathCharacters: 5 }))).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'BUDGET_EXCEEDED',
				message: 'Source path src/index.ts exceeds the path budget.'
			})
		);

		for (const [budgets, message] of [
			[
				{ maxProjects: 1 },
				'Raw project population does not reproduce the frozen project population.'
			],
			[{ maxSources: 1 }, 'Raw sources exceed the snapshot source budget.'],
			[{ maxAstNodes: 1 }, 'Raw AST nodes exceed the snapshot node budget.'],
			[{ maxScopes: 2 }, 'Raw scopes exceed the snapshot scope budget.']
		] as const) {
			const multi = multiProjectNormalizationInput();
			expect(() =>
				normalizeStaticSemanticSnapshot({
					...multi,
					request: request(budgets)
				})
			).toThrowError(
				expect.objectContaining<Partial<SemanticNormalizationError>>({
					code: 'BUDGET_EXCEEDED',
					message
				})
			);
		}
	});

	it('rejects invalid and overflowed diagnostic counts and dishonest family coverage', () => {
		const invalidMessage = {
			...diagnosticMessage('invalid'),
			textLength: 0
		};
		expect(() => normalize(withDiagnostic(raw(), rawDiagnostic(invalidMessage)))).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				message: 'Raw diagnostic character count is invalid or overflowed.'
			})
		);

		const hugeMessage = {
			...diagnosticMessage('huge'),
			textLength: Number.MAX_SAFE_INTEGER
		};
		const related = [
			{
				category: 'ERROR' as const,
				code: 'TS1001',
				end: null,
				message: diagnosticMessage('related'),
				path: null,
				start: null
			}
		];
		expect(() =>
			normalize(withDiagnostic(raw(), rawDiagnostic(hugeMessage, related)))
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				message: 'Raw diagnostic character count overflowed.'
			})
		);

		const uncovered = withDiagnostic(raw(), rawDiagnostic(), false);
		expect(() => normalize(uncovered)).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				message: 'Diagnostic family SEMANTIC does not cover its emitted records.'
			})
		);

		const multi = multiProjectNormalizationInput();
		const projects = multi.projects.map((project) => withDiagnostic(project));
		expect(() =>
			normalizeStaticSemanticSnapshot({
				...multi,
				projects,
				request: request({ maxDiagnostics: 1 })
			})
		).toThrowError(
			expect.objectContaining<Partial<SemanticNormalizationError>>({
				code: 'BUDGET_EXCEEDED',
				message: 'Raw diagnostics exceed the snapshot diagnostic budget.'
			})
		);
	});

	it('rejects duplicate syntax and incoherent scope, declaration, symbol, and reference facts', () => {
		const base = bindingRaw();
		expect(() => normalize(base)).not.toThrow();
		const declaration = base.declarations[0]!;
		const symbol = base.symbols[0]!;
		const reference = base.references[0]!;
		const fallback = { nodeOrdinal: 2, sourceOrdinal: 0 };
		const candidate = {
			ambientSyntax: false,
			candidateRole: 'BINDING' as const,
			exportCarrierNodeOrdinal: null,
			exportSyntax: 'NONE' as const,
			localModifiers: [],
			nameNodeOrdinal: 2,
			nameState: 'ATOMIC' as const,
			nodeOrdinal: 1,
			sourceOrdinal: 0,
			syntacticName: 'value',
			syntaxKind: ts.SyntaxKind.VariableDeclaration,
			syntaxKindName: 'VariableDeclaration'
		};
		const rejects = (project: RawStaticSemanticProjectExtraction, message: string): void => {
			try {
				normalize(project);
			} catch (error) {
				expect(error).toBeInstanceOf(SemanticNormalizationError);
				expect((error as SemanticNormalizationError).message).toContain(message);
				return;
			}
			throw new Error(`Expected normalization failure containing: ${message}`);
		};

		rejects(
			{ ...base, declarationCandidates: [candidate, candidate] },
			'Declaration-candidate node 1 is not unique within its source.'
		);
		rejects(
			{
				...base,
				scopes: [...base.scopes, { ...base.scopes[1]!, scopeOrdinal: 2 }]
			},
			`Project tsconfig.json contains duplicate scope identity`
		);
		rejects(
			{
				...base,
				declarations: [{ ...declaration, scopeLinkState: 'UNSUPPORTED' }]
			},
			'Declaration 0 scope-link state is incoherent.'
		);
		rejects(
			{
				...base,
				declarations: [{ ...declaration, symbolBindingState: 'UNSUPPORTED' }]
			},
			'Declaration 0 symbol-binding state is incoherent.'
		);
		rejects(
			{ ...base, declarations: [{ ...declaration, start: -1 }] },
			'Declaration 0 has an invalid source span.'
		);
		rejects(
			{
				...base,
				declarations: [declaration, { ...declaration, declarationOrdinal: 1 }]
			},
			'Project tsconfig.json contains duplicate declaration identity'
		);

		const fallbackSymbol = {
			declarationOrdinals: [],
			fallbackReferenceNodes: [fallback],
			flags: ts.SymbolFlags.Variable,
			flagNames: ['Variable'],
			name: 'fallback',
			symbolOrdinal: 1,
			valueDeclarationOrdinal: null
		};
		rejects(
			{
				...base,
				declarations: [{ ...declaration, symbolOrdinal: 1 }],
				symbols: [symbol, fallbackSymbol]
			},
			'Declaration 0 is attributed to a different symbol ordinal.'
		);
		rejects(
			{
				...raw(),
				symbols: [
					{
						declarationOrdinals: [],
						fallbackReferenceNodes: [],
						flags: ts.SymbolFlags.Variable,
						flagNames: ['Variable'],
						name: 'empty',
						symbolOrdinal: 0,
						valueDeclarationOrdinal: null
					}
				]
			},
			'Symbol 0 has neither declarations nor a stable reference fallback.'
		);
		rejects(
			{
				...base,
				symbols: [{ ...symbol, fallbackReferenceNodes: [fallback] }]
			},
			'Symbol 0 mixes declaration and fallback identity bases.'
		);
		const duplicateSymbol = {
			...fallbackSymbol,
			fallbackReferenceNodes: [{ nodeOrdinal: 0, sourceOrdinal: 0 }],
			name: 'same',
			symbolOrdinal: 0
		};
		rejects(
			{
				...raw(),
				symbols: [duplicateSymbol, { ...duplicateSymbol, symbolOrdinal: 1 }]
			},
			'Project tsconfig.json contains duplicate symbol identity'
		);
		rejects(
			{
				...base,
				symbols: [
					{
						...symbol,
						declarationOrdinals: [],
						fallbackReferenceNodes: [fallback],
						valueDeclarationOrdinal: null
					}
				]
			},
			'Symbol 0 does not include declaration 0.'
		);

		const secondDeclaration = {
			...declaration,
			declarationOrdinal: 1,
			end: 3,
			kind: ts.SyntaxKind.Identifier,
			kindName: 'Identifier',
			name: 'other',
			nodeOrdinal: 2,
			start: 2,
			symbolOrdinal: 1
		};
		const secondSymbol = {
			...symbol,
			declarationOrdinals: [1],
			name: 'other',
			symbolOrdinal: 1,
			valueDeclarationOrdinal: 1
		};
		rejects(
			{
				...base,
				declarations: [declaration, secondDeclaration],
				symbols: [{ ...symbol, valueDeclarationOrdinal: 1 }, secondSymbol]
			},
			'Symbol 0 value declaration is not one of its declarations.'
		);
		rejects(
			{
				...base,
				references: [{ ...reference, scopeLinkState: 'UNSUPPORTED' }]
			},
			'Reference node 2 scope-link state is incoherent.'
		);
	});

	it('partitions context-only sources and scopes into their explicit population members', () => {
		const base = raw();
		const contextSource = {
			...base.sources[0]!,
			analysisDisposition: 'CONTEXT_ONLY' as const,
			artifactClass: 'CONTEXT_ONLY' as const,
			artifactRoles: [],
			bytes: 0,
			contentSha256: sha256(''),
			declarationFile: true,
			logicalPath: 'lib/context.d.ts',
			moduleKind: 'MODULE' as const,
			origin: 'TOOLCHAIN_LIBRARY' as const,
			rootFile: false,
			rootNodeOrdinal: null,
			sourceOrdinal: 1,
			textLength: 0
		};
		const contextScope = {
			...base.scopes[1]!,
			domain: 'MIXED' as const,
			end: 0,
			kind: 'SOURCE_MODULE' as const,
			ownerNodeOrdinal: null,
			scopeOrdinal: 2,
			sourceOrdinal: 1,
			start: 0
		};
		const snapshot = normalize({
			...base,
			scopes: [...base.scopes, contextScope],
			sources: [...base.sources, contextSource]
		});
		expect(
			snapshot.populations.find((population) => population.kind === 'SOURCE')?.members.contextOnly
		).toHaveLength(1);
		expect(
			snapshot.populations.find((population) => population.kind === 'SCOPE')?.members.contextOnly
		).toHaveLength(1);
	});
});
