import { Buffer } from 'node:buffer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import type {
	CompilerInputObservation,
	SemanticAstStructuralRole,
	SemanticCapability,
	SemanticDiagnosticFamily,
	SemanticDiagnosticMessage,
	SemanticDiagnosticRecord,
	SemanticFactProvenanceRecord,
	SemanticPopulationKind,
	SemanticProvenanceId,
	SemanticProviderIdentity,
	SemanticSnapshotId,
	SemanticSourceId,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import { SUBJECT_POLICY_VERSION, SUBJECT_SCHEMA_VERSION } from '../contracts/subject.js';
import { SNAPSHOT_ARRAY_FIELDS } from './validate-wire-shape.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	SEMANTIC_AST_TRAVERSAL_PROFILE,
	SEMANTIC_CANONICAL_PROFILE,
	SEMANTIC_EXTRACTION_VERSION,
	SEMANTIC_OPERATION_VERSION,
	SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	SEMANTIC_TYPE_DISPLAY_PROFILE,
	SEMANTIC_TYPE_FINGERPRINT_PROFILE,
	TYPESCRIPT_PROVIDER_VERSION
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import { canonicalSemanticJson, encodeSemanticDiagnosticText } from './canonical.js';
import {
	compilerInputClosureDigest,
	compilerInputResultDigest,
	programRecipeDigest,
	semanticAliasId,
	semanticContextInputId,
	semanticDeclarationCandidateId,
	semanticDeclarationId,
	semanticDurableDeclarationId,
	semanticDiagnosticId,
	semanticInvocationSiteId,
	semanticModuleExportId,
	semanticModuleResolutionId,
	semanticNodeId,
	semanticOverloadSetId,
	semanticProgramId,
	semanticProjectId,
	semanticProvenanceId,
	semanticReferenceId,
	semanticScopeId,
	semanticSignatureId,
	semanticSignatureParameterId,
	semanticSnapshotId,
	semanticSourceId,
	semanticSymbolId,
	semanticTypeId,
	semanticTypeParameterId,
	semanticTypeRelationId
} from './ids.js';
import { semanticPopulation, type SemanticPopulationMembers } from './population.js';
import { semanticScopeBoundaryDescriptor } from './scope-taxonomy.js';
import { createStaticSemanticOperationBudgetSession } from './static-semantic-operation-budget-session.js';
import {
	AST_STRUCTURAL_ROLES,
	literalLexemeDigest,
	literalValueDigest
} from './syntax-projection.js';
import {
	takeStaticSemanticValidationBudgetEvidence,
	validateStaticSemanticSnapshot,
	validateStaticSemanticSnapshotWithBudgetEvidence,
	type StaticSemanticValidationBudgetEvidence,
	type StaticSemanticValidationBudgetEvidenceErrorCode,
	type SemanticValidationContext,
	type SemanticValidationOptions
} from './validate-snapshot.js';

const PROVIDER: SemanticProviderIdentity = {
	api: 'PUBLIC_COMPILER_API',
	id: 'typescript',
	version: TYPESCRIPT_PROVIDER_VERSION
};
const SUBJECT_ID = '1'.repeat(64);
const CONTENT_DIGEST = sha256('');
const BASE_FROZEN_READ = readFileObservation('src/index.ts', 'PRESENT', '', 'FROZEN_SUBJECT');
const CONTEXT_DIGEST = compilerInputClosureDigest([BASE_FROZEN_READ]);
const BUDGETS = {
	maxAstDepth: 100,
	maxAstNodes: 100,
	maxCompilerInputMetadataBytes: 100_000,
	maxCompilerQueries: 100,
	maxCompilerFacts: 100,
	maxCompilerQueryInvocations: 100,
	maxContextBytes: 1_000,
	maxContextFileBytes: 1_000,
	maxContextFiles: 100,
	maxDiagnosticCharacters: 100_000,
	maxDiagnostics: 100,
	maxDirectoryEntries: 100,
	maxDurationMs: 1_000,
	maxLiteralCharacters: 100,
	maxPathCharacters: 1_000,
	maxProjects: 10,
	maxSnapshotBytes: 1_000_000,
	maxScopes: 100,
	maxSources: 100
} as const;

afterEach(() => {
	vi.restoreAllMocks();
});

function members(
	analyzed: readonly string[] = [],
	contextOnly: readonly string[] = [],
	unsupported: readonly string[] = [],
	unknown: readonly string[] = []
): SemanticPopulationMembers {
	return {
		analyzed,
		contextOnly,
		excluded: [],
		excludedByPolicy: [],
		failed: [],
		unknown,
		unsupported
	};
}

function provenance(
	snapshotId: SemanticSnapshotId,
	projectId: ReturnType<typeof semanticProjectId>,
	capability: 'TS_PROJECT' | 'TS_SYMBOL' | 'TS_SYNTAX' | 'TS_TYPE',
	recipeDigest: string,
	sourceId: SemanticSourceId | null = null,
	parentProvenanceId: SemanticProvenanceId | null = null,
	contextDigest = CONTEXT_DIGEST,
	contextInputIds: readonly string[] = [BASE_FROZEN_READ.id],
	factBasis: 'COMPILER' | 'SCOPE_DERIVED' = 'COMPILER'
): SemanticFactProvenanceRecord {
	const programId = semanticProgramId({ contextDigest, projectId });
	const scopeDerived = capability === 'TS_SYMBOL' && factBasis === 'SCOPE_DERIVED';
	const method = scopeDerived
		? 'typescript-public-ast-binding-rules'
		: capability === 'TS_PROJECT'
			? 'typescript-public-program-and-diagnostics'
			: capability === 'TS_SYMBOL'
				? 'typescript-public-type-checker-binding'
				: capability === 'TS_TYPE'
					? 'typescript-public-type-checker-types-and-signatures'
					: 'typescript-public-normalized-ast';
	const preimage: Omit<SemanticFactProvenanceRecord, 'id'> = {
		capability,
		epistemic: {
			capabilityCoverage: 'supported',
			conflict: 'unopposed',
			executionHealth: 'succeeded',
			freshness: 'current-for-subject',
			inference: scopeDerived ? 'derived' : 'direct',
			rationale: 'Fixture fact is completely extracted.',
			supportBasis: {
				kind: scopeDerived
					? 'derived'
					: capability === 'TS_SYNTAX'
						? 'direct-extraction'
						: 'compiler-confirmed',
				method,
				rationale: 'Fixture extraction.',
				sourceRefs:
					sourceId === null
						? [SUBJECT_ID, snapshotId, projectId, programId, ...contextInputIds].sort()
						: [parentProvenanceId!, sourceId].sort()
			},
			unresolvedRegions: []
		},
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		invalidationDependencies: [
			{ digest: contextDigest, kind: 'CONTEXT_INPUT' },
			{ digest: sha256(canonicalSemanticJson(SEMANTIC_EXTRACTION_VERSION)), kind: 'EXTRACTION' },
			{ digest: recipeDigest, kind: 'PROJECT_RECIPE' },
			{ digest: sha256(canonicalSemanticJson(PROVIDER)), kind: 'PROVIDER' },
			{ digest: SUBJECT_ID, kind: 'SUBJECT' }
		],
		limitations: [],
		parentProvenanceId,
		projectId,
		provider: PROVIDER,
		snapshotId,
		sourceId,
		subjectId: SUBJECT_ID
	};
	return { ...preimage, id: semanticProvenanceId(preimage) };
}

function reidentifyProvenance(record: SemanticFactProvenanceRecord): SemanticFactProvenanceRecord {
	const { id: _id, ...preimage } = record;
	return { ...preimage, id: semanticProvenanceId(preimage) };
}

function reviseProvenance(
	snapshot: StaticSemanticSnapshot,
	provenanceId: SemanticProvenanceId,
	revise: (record: SemanticFactProvenanceRecord) => SemanticFactProvenanceRecord
): StaticSemanticSnapshot {
	const original = snapshot.provenances.find((record) => record.id === provenanceId)!;
	const revised = reidentifyProvenance(revise(original));
	const ids = new Map<SemanticProvenanceId, SemanticProvenanceId>([[original.id, revised.id]]);
	const records = snapshot.provenances
		.map((record) => (record.id === original.id ? revised : record))
		.map((record) => {
			if (record.parentProvenanceId !== original.id) return record;
			const child = reidentifyProvenance({
				...record,
				epistemic: {
					...record.epistemic,
					supportBasis: {
						...record.epistemic.supportBasis,
						sourceRefs: [revised.id, record.sourceId!].sort()
					}
				},
				parentProvenanceId: revised.id
			});
			ids.set(record.id, child.id);
			return child;
		})
		.sort((left, right) => (left.id < right.id ? -1 : 1));
	const replaceId = (id: SemanticProvenanceId): SemanticProvenanceId => ids.get(id) ?? id;
	return {
		...snapshot,
		aliases: snapshot.aliases.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		})),
		declarations: snapshot.declarations.map((record) => ({
			...record,
			bindingProvenanceId: replaceId(record.bindingProvenanceId),
			structuralProvenanceId: replaceId(record.structuralProvenanceId)
		})),
		diagnostics: snapshot.diagnostics.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		})),
		moduleExports: snapshot.moduleExports.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		})),
		moduleResolutions: snapshot.moduleResolutions.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		})),
		populations: snapshot.populations.map((population) =>
			population.kind === 'PROVENANCE'
				? semanticPopulation('PROVENANCE', members(records.map((record) => record.id)))
				: population
		),
		programs: snapshot.programs.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		})),
		projects: snapshot.projects.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		})),
		provenances: records,
		references: snapshot.references.map((record) => ({
			...record,
			resolutionProvenanceId: replaceId(record.resolutionProvenanceId),
			structuralProvenanceId: replaceId(record.structuralProvenanceId)
		})),
		scopes: snapshot.scopes.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		})),
		sources: snapshot.sources.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId),
			syntaxProvenanceId:
				record.syntaxProvenanceId === null ? null : replaceId(record.syntaxProvenanceId)
		})),
		symbols: snapshot.symbols.map((record) => ({
			...record,
			provenanceId: replaceId(record.provenanceId)
		}))
	};
}

const SYNTAX_ONLY_INVOCATION_TARGET = {
	implementationDeclarationId: null,
	implementationNodeId: null,
	resolutionProvenanceId: null,
	resolutionReason: 'TYPE_CAPABILITY_NOT_REQUESTED',
	resolvedSignatureId: null,
	targetState: 'SYNTAX_ONLY'
} as const;

function fixture(
	logicalPath = 'src/index.ts',
	contents = '',
	compilerOptions: Readonly<Record<string, unknown>> = { module: 199, strict: true },
	requestedCapabilities: readonly SemanticCapability[] = ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX']
): StaticSemanticSnapshot {
	const contentDigest = sha256(contents);
	const frozenRead =
		logicalPath === 'src/index.ts' && contents === ''
			? BASE_FROZEN_READ
			: readFileObservation(logicalPath, 'PRESENT', contents, 'FROZEN_SUBJECT');
	const contextDigest = compilerInputClosureDigest([frozenRead]);
	const recipeBase = {
		compilerOptions,
		configClosureDigest: '2'.repeat(64),
		configPath: 'tsconfig.json',
		kind: 'PROJECT' as const,
		projectReferences: [],
		provider: { id: 'typescript' as const, version: TYPESCRIPT_PROVIDER_VERSION },
		rootNames: [logicalPath]
	};
	const recipe = { ...recipeBase, projectResolutionDigest: programRecipeDigest(recipeBase) };
	const parsedSource = ts.createSourceFile(logicalPath, contents, ts.ScriptTarget.Latest, true);
	const moduleKind = ts.isExternalModule(parsedSource) ? ('MODULE' as const) : ('SCRIPT' as const);
	const sourceScopeKind =
		moduleKind === 'MODULE' ? ('SOURCE_MODULE' as const) : ('SOURCE_SCRIPT' as const);
	const sourceScopeDomain = moduleKind === 'MODULE' ? ('MIXED' as const) : ('LEXICAL' as const);
	const id = semanticSnapshotId({
		assignabilityRequests: [],
		astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
		budgets: BUDGETS,
		canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
		contextDigest,
		expectedEmpty: false,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		operationVersion: SEMANTIC_OPERATION_VERSION,
		projectRecipeDigests: [recipe.projectResolutionDigest],
		provider: PROVIDER,
		requestedCapabilities,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		subjectId: SUBJECT_ID
	});
	const projectId = semanticProjectId({
		configPath: recipe.configPath,
		projectResolutionDigest: recipe.projectResolutionDigest,
		snapshotId: id
	});
	const programId = semanticProgramId({ contextDigest, projectId });
	const sourceId = semanticSourceId({
		contentSha256: contentDigest,
		logicalPath,
		moduleKind,
		programId
	});
	const nodeId = semanticNodeId({
		end: contents.length,
		fullStart: 0,
		kind: 308,
		parentId: null,
		siblingOrdinal: 0,
		sourceId,
		start: 0,
		structuralRoles: ['source-file']
	});
	const projectProvenance = provenance(
		id,
		projectId,
		'TS_PROJECT',
		recipe.projectResolutionDigest,
		null,
		null,
		contextDigest,
		[frozenRead.id]
	);
	const sourceProjectProvenance = provenance(
		id,
		projectId,
		'TS_PROJECT',
		recipe.projectResolutionDigest,
		sourceId,
		projectProvenance.id,
		contextDigest,
		[frozenRead.id]
	);
	const syntaxProvenance = provenance(
		id,
		projectId,
		'TS_SYNTAX',
		recipe.projectResolutionDigest,
		null,
		null,
		contextDigest,
		[frozenRead.id]
	);
	const sourceSyntaxProvenance = provenance(
		id,
		projectId,
		'TS_SYNTAX',
		recipe.projectResolutionDigest,
		sourceId,
		syntaxProvenance.id,
		contextDigest,
		[frozenRead.id]
	);
	const projectScopeProvenance = provenance(
		id,
		projectId,
		'TS_SYMBOL',
		recipe.projectResolutionDigest,
		null,
		null,
		contextDigest,
		[frozenRead.id],
		'SCOPE_DERIVED'
	);
	const sourceScopeProvenance = provenance(
		id,
		projectId,
		'TS_SYMBOL',
		recipe.projectResolutionDigest,
		sourceId,
		projectScopeProvenance.id,
		contextDigest,
		[frozenRead.id],
		'SCOPE_DERIVED'
	);
	const globalScopeId = semanticScopeId({
		domain: 'LEXICAL',
		end: null,
		kind: 'PROGRAM_GLOBAL',
		ownerKind: null,
		programId,
		sourceId: null,
		start: null
	});
	const sourceScopeId = semanticScopeId({
		domain: sourceScopeDomain,
		end: contents.length,
		kind: sourceScopeKind,
		ownerKind: ts.SyntaxKind.SourceFile,
		programId,
		sourceId,
		start: 0
	});
	const scopes: StaticSemanticSnapshot['scopes'] = [
		{
			domain: 'LEXICAL' as const,
			end: null,
			id: globalScopeId,
			kind: 'PROGRAM_GLOBAL' as const,
			ownerKind: null,
			ownerKindName: null,
			ownerNodeId: null,
			parentScopeId: null,
			programId,
			projectId,
			provenanceId: projectScopeProvenance.id,
			sourceId: null,
			start: null
		},
		{
			domain: sourceScopeDomain,
			end: contents.length,
			id: sourceScopeId,
			kind: sourceScopeKind,
			ownerKind: ts.SyntaxKind.SourceFile,
			ownerKindName: 'SourceFile',
			ownerNodeId: nodeId,
			parentScopeId: globalScopeId,
			programId,
			projectId,
			provenanceId: sourceScopeProvenance.id,
			sourceId,
			start: 0
		}
	].sort((left, right) => (left.id < right.id ? -1 : 1));
	const provenances = [
		projectProvenance,
		projectScopeProvenance,
		sourceProjectProvenance,
		sourceScopeProvenance,
		syntaxProvenance,
		sourceSyntaxProvenance
	].sort((left, right) => (left.id < right.id ? -1 : 1));
	const populationOrder: readonly SemanticPopulationKind[] = [
		'PROJECT',
		'PROGRAM',
		'SOURCE',
		'SCOPE',
		'AST_NODE',
		'DECLARATION_CANDIDATE',
		'DECLARATION',
		'SYMBOL',
		'ALIAS',
		'REFERENCE',
		'MODULE_RESOLUTION',
		'MODULE_EXPORT',
		'TYPE',
		'TYPE_PARAMETER',
		'SIGNATURE',
		'SIGNATURE_PARAMETER',
		'OVERLOAD_SET',
		'TYPE_RELATION',
		'LITERAL',
		'INVOCATION_SITE',
		'ASSIGNMENT',
		'DIAGNOSTIC',
		'PROVENANCE',
		'FRAMEWORK_CANDIDATE',
		'CONTEXT_INPUT'
	];
	const analyzedByKind: Readonly<Record<SemanticPopulationKind, readonly string[]>> = {
		PROJECT: [projectId],
		PROGRAM: [programId],
		SOURCE: [sourceId],
		SCOPE: scopes.map((scope) => scope.id),
		AST_NODE: [nodeId],
		DECLARATION_CANDIDATE: [],
		DECLARATION: [],
		SYMBOL: [],
		ALIAS: [],
		REFERENCE: [],
		MODULE_RESOLUTION: [],
		MODULE_EXPORT: [],
		TYPE: [],
		TYPE_PARAMETER: [],
		SIGNATURE: [],
		SIGNATURE_PARAMETER: [],
		OVERLOAD_SET: [],
		TYPE_RELATION: [],
		LITERAL: [],
		INVOCATION_SITE: [],
		ASSIGNMENT: [],
		DIAGNOSTIC: [],
		PROVENANCE: provenances.map((record) => record.id),
		FRAMEWORK_CANDIDATE: [],
		CONTEXT_INPUT: []
	};

	return {
		aliases: [],
		assignabilityRequests: [],
		assignments: [],
		astNodes: [
			{
				end: contents.length,
				publicFlags: 0,
				fullStart: 0,
				hasAssignmentInitializer: false,
				id: nodeId,
				kind: 308,
				kindName: 'SourceFile',
				operatorKind: null,
				operatorName: null,
				parentId: null,
				siblingOrdinal: 0,
				sourceId,
				start: 0,
				structuralRoles: ['source-file'],
				syntacticIdentifierText: null
			}
		],
		astTraversalProfile: SEMANTIC_AST_TRAVERSAL_PROFILE,
		budgets: BUDGETS,
		canonicalProfile: SEMANTIC_CANONICAL_PROFILE,
		capabilities: [
			{ capability: 'TS_PROJECT', reason: 'Implemented by Slice 3B.', state: 'SUPPORTED' },
			{ capability: 'TS_SYMBOL', reason: 'Implemented by Slice 3B.', state: 'SUPPORTED' },
			{ capability: 'TS_SYNTAX', reason: 'Implemented by Slice 3B.', state: 'SUPPORTED' },
			{
				capability: 'TS_TYPE',
				reason: requestedCapabilities.includes('TS_TYPE')
					? 'Implemented by the TS_TYPE fixture increment.'
					: 'Not implemented in Slice 3B.',
				state: requestedCapabilities.includes('TS_TYPE') ? 'SUPPORTED' : 'UNSUPPORTED'
			}
		],
		compilerInputs: [frozenRead],
		contextDigest,
		declarationCandidates: [],
		declarations: [],
		diagnostics: [],
		expectedEmpty: false,
		extractionVersion: SEMANTIC_EXTRACTION_VERSION,
		fullJanCsaa007Conformance: FULL_JAN_CSAA_007_CONFORMANCE,
		health: 'COMPLETE',
		id,
		invocations: [],
		limitations: [],
		literals: [],
		moduleExports: [],
		moduleResolutions: [],
		overloadSets: [],
		operationVersion: SEMANTIC_OPERATION_VERSION,
		populations: populationOrder.map((kind) =>
			kind === 'CONTEXT_INPUT'
				? semanticPopulation(kind, members([], [frozenRead.id]))
				: semanticPopulation(kind, members(analyzedByKind[kind]), analyzedByKind[kind].length === 0)
		),
		programs: [
			{
				checkerState: 'CREATED',
				contextDigest,
				diagnosticFamilies: (
					[
						'CONFIGURATION',
						'OPTIONS',
						'GLOBAL',
						'SYNTACTIC',
						'SEMANTIC',
						'DECLARATION'
					] as readonly SemanticDiagnosticFamily[]
				).map((family) => ({
					coverage: 'COMPLETE',
					diagnosticIds: [],
					family,
					manifestDigest: sha256(canonicalSemanticJson([])),
					occurrenceCount: 0,
					reason: 'Family ran and returned zero diagnostics.',
					recordCount: 0,
					state: 'RUN'
				})),
				diagnosticIds: [],
				id: programId,
				projectId,
				provenanceId: projectProvenance.id,
				rootSourceIds: [sourceId],
				sourceIds: [sourceId]
			}
		],
		projects: [
			{
				configPath: recipe.configPath,
				contextInputIds: [frozenRead.id],
				diagnosticIds: [],
				frameworkCandidates: [],
				health: 'COMPLETE',
				id: projectId,
				kind: 'PROJECT',
				partialityReasons: [],
				programId,
				programRecipe: recipe,
				projectReferences: [],
				provenanceId: projectProvenance.id,
				rootDisposition: 'COMPILER_ROOTS',
				rootNames: [logicalPath],
				sourceIds: [sourceId]
			}
		],
		provenances,
		provider: PROVIDER,
		references: [],
		requestedCapabilities,
		schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
		scopes,
		signatureParameters: [],
		signatures: [],
		sources: [
			{
				analysisDisposition: 'DEEP_INDEXED',
				artifactClass: 'PRODUCTION_SOURCE',
				artifactRoles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'],
				bytes: contents.length,
				contentSha256: contentDigest,
				declarationFile: false,
				diagnosticIds: [],
				id: sourceId,
				languageVariant: 'Standard',
				logicalPath,
				mapping: {
					reason: 'Authored TypeScript is already in source coordinates.',
					state: 'NOT_APPLICABLE'
				},
				moduleKind,
				origin: 'AUTHORED',
				programId,
				projectId,
				provenanceId: sourceProjectProvenance.id,
				rootFile: true,
				rootNodeId: nodeId,
				scriptKind: 3,
				scriptKindName: 'TS',
				syntaxProvenanceId: sourceSyntaxProvenance.id,
				textLength: contents.length,
				transformation: null
			}
		],
		symbols: [],
		subjectId: SUBJECT_ID,
		typeParameters: [],
		typeRelations: [],
		types: []
	};
}

function withAstNode(
	snapshot: StaticSemanticSnapshot,
	overrides: Partial<StaticSemanticSnapshot['astNodes'][number]> &
		Pick<StaticSemanticSnapshot['astNodes'][number], 'kind' | 'kindName'>,
	root = false
): StaticSemanticSnapshot {
	const source = snapshot.sources[0]!;
	const rootNode = snapshot.astNodes.find((node) => node.id === source.rootNodeId)!;
	const parentId = root ? null : rootNode.id;
	const start = overrides.start ?? 0;
	const fullStart = overrides.fullStart ?? start;
	const end = overrides.end ?? start;
	const structuralRoles: SemanticAstStructuralRole[] = [
		...new Set(
			root
				? [AST_STRUCTURAL_ROLES.sourceFile]
				: [AST_STRUCTURAL_ROLES.genericChild, ...(overrides.structuralRoles ?? [])]
		)
	].sort();
	const siblingOrdinal = root
		? 1
		: snapshot.astNodes.filter((node) => node.parentId === rootNode.id).length;
	const id = semanticNodeId({
		end,
		fullStart,
		kind: overrides.kind,
		parentId,
		siblingOrdinal,
		sourceId: source.id,
		start,
		structuralRoles
	});
	const node = {
		...rootNode,
		end,
		fullStart,
		hasAssignmentInitializer: false,
		id,
		operatorKind: null,
		operatorName: null,
		parentId,
		siblingOrdinal,
		start,
		syntacticIdentifierText:
			overrides.kind === ts.SyntaxKind.Identifier
				? 'value'
				: overrides.kind === ts.SyntaxKind.PrivateIdentifier
					? '#value'
					: null,
		...overrides,
		structuralRoles
	};
	const astNodes = [...snapshot.astNodes, node].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const nodeIds = astNodes.map((record) => record.id);
	return {
		...snapshot,
		astNodes,
		populations: snapshot.populations.map((population) =>
			population.kind === 'AST_NODE' ? semanticPopulation('AST_NODE', members(nodeIds)) : population
		)
	};
}

function withAstChild(
	snapshot: StaticSemanticSnapshot,
	parentId: StaticSemanticSnapshot['astNodes'][number]['id'],
	overrides: Partial<StaticSemanticSnapshot['astNodes'][number]> &
		Pick<StaticSemanticSnapshot['astNodes'][number], 'kind' | 'kindName'>,
	structuralRoleOrRoles:
		| SemanticAstStructuralRole
		| readonly SemanticAstStructuralRole[] = AST_STRUCTURAL_ROLES.genericChild,
	siblingOrdinal = 0
): StaticSemanticSnapshot {
	const parent = snapshot.astNodes.find((node) => node.id === parentId)!;
	const start = overrides.start ?? parent.start;
	const fullStart = overrides.fullStart ?? start;
	const end = overrides.end ?? parent.end;
	const structuralRoles: SemanticAstStructuralRole[] = [
		...new Set([
			AST_STRUCTURAL_ROLES.genericChild,
			...(typeof structuralRoleOrRoles === 'string'
				? [structuralRoleOrRoles]
				: structuralRoleOrRoles)
		])
	].sort();
	const id = semanticNodeId({
		end,
		fullStart,
		kind: overrides.kind,
		parentId,
		siblingOrdinal,
		sourceId: parent.sourceId,
		start,
		structuralRoles
	});
	const child = {
		...parent,
		hasAssignmentInitializer: false,
		id,
		...overrides,
		end,
		fullStart,
		kind: overrides.kind,
		kindName: overrides.kindName,
		operatorKind: null,
		operatorName: null,
		parentId,
		siblingOrdinal,
		structuralRoles,
		start,
		syntacticIdentifierText:
			overrides.syntacticIdentifierText ??
			(overrides.kind === ts.SyntaxKind.Identifier
				? 'value'
				: overrides.kind === ts.SyntaxKind.PrivateIdentifier
					? '#value'
					: null)
	};
	const astNodes = [...snapshot.astNodes, child].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	return {
		...snapshot,
		astNodes,
		populations: snapshot.populations.map((population) =>
			population.kind === 'AST_NODE'
				? semanticPopulation('AST_NODE', members(astNodes.map((node) => node.id)))
				: population
		)
	};
}

function withScopeForNode(
	snapshot: StaticSemanticSnapshot,
	nodeId: StaticSemanticSnapshot['astNodes'][number]['id']
): StaticSemanticSnapshot {
	const node = snapshot.astNodes.find((candidate) => candidate.id === nodeId)!;
	const source = snapshot.sources.find((candidate) => candidate.id === node.sourceId)!;
	const descriptor = semanticScopeBoundaryDescriptor(node.kind, source.moduleKind);
	if (descriptor === null) throw new Error('Test helper requires a supported scope boundary.');
	let parentNode =
		node.parentId === null
			? undefined
			: snapshot.astNodes.find((entry) => entry.id === node.parentId);
	let parentScope: StaticSemanticSnapshot['scopes'][number] | undefined;
	while (parentNode !== undefined) {
		parentScope = snapshot.scopes.find((scope) => scope.ownerNodeId === parentNode!.id);
		if (parentScope !== undefined) break;
		parentNode =
			parentNode.parentId === null
				? undefined
				: snapshot.astNodes.find((entry) => entry.id === parentNode!.parentId);
	}
	parentScope ??= snapshot.scopes.find(
		(scope) => scope.kind === 'PROGRAM_GLOBAL' && scope.programId === source.programId
	);
	const id = semanticScopeId({
		domain: descriptor.domain,
		end: node.end,
		kind: descriptor.kind,
		ownerKind: node.kind,
		programId: source.programId,
		sourceId: source.id,
		start: node.start
	});
	const scope: StaticSemanticSnapshot['scopes'][number] = {
		domain: descriptor.domain,
		end: node.end,
		id,
		kind: descriptor.kind,
		ownerKind: node.kind,
		ownerKindName: node.kindName,
		ownerNodeId: node.id,
		parentScopeId: parentScope!.id,
		programId: source.programId,
		projectId: source.projectId,
		provenanceId: snapshot.provenances.find(
			(record) =>
				record.capability === 'TS_SYMBOL' &&
				record.sourceId === source.id &&
				record.epistemic.inference === 'derived'
		)!.id,
		sourceId: source.id,
		start: node.start
	};
	const scopes = [...snapshot.scopes, scope].sort((left, right) => (left.id < right.id ? -1 : 1));
	return {
		...snapshot,
		populations: snapshot.populations.map((population) =>
			population.kind === 'SCOPE'
				? semanticPopulation('SCOPE', members(scopes.map((entry) => entry.id)))
				: population
		),
		scopes
	};
}

function withSymbolFacts(
	requestedCapabilities: readonly SemanticCapability[] = ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX']
): StaticSemanticSnapshot {
	let snapshot = fixture(
		'src/index.ts',
		' '.repeat(64),
		{ module: 199, strict: true },
		requestedCapabilities
	);
	snapshot = withAstNode(snapshot, {
		end: 10,
		kind: ts.SyntaxKind.VariableDeclaration,
		kindName: 'VariableDeclaration',
		start: 0
	});
	const declarationNode = snapshot.astNodes.find(
		(node) => node.kind === ts.SyntaxKind.VariableDeclaration
	)!;
	snapshot = withAstChild(
		snapshot,
		declarationNode.id,
		{
			end: 5,
			kind: ts.SyntaxKind.Identifier,
			kindName: 'Identifier',
			start: 0,
			syntacticIdentifierText: 'value'
		},
		AST_STRUCTURAL_ROLES.declarationName
	);
	snapshot = withAstNode(snapshot, {
		end: 17,
		kind: ts.SyntaxKind.Identifier,
		kindName: 'Identifier',
		start: 12,
		syntacticIdentifierText: 'value'
	});
	snapshot = withAstNode(snapshot, {
		end: 36,
		kind: ts.SyntaxKind.ImportDeclaration,
		kindName: 'ImportDeclaration',
		start: 18
	});

	const source = snapshot.sources[0]!;
	const nameNode = snapshot.astNodes.find(
		(node) =>
			node.parentId === declarationNode.id &&
			node.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName)
	)!;
	const referenceNode = snapshot.astNodes.find(
		(node) =>
			node.kind === ts.SyntaxKind.Identifier &&
			node.parentId === source.rootNodeId &&
			node.start === 12
	)!;
	const moduleNode = snapshot.astNodes.find(
		(node) => node.kind === ts.SyntaxKind.ImportDeclaration
	)!;
	const sourceScopeProvenance = snapshot.provenances.find(
		(record) => record.capability === 'TS_SYMBOL' && record.sourceId === source.id
	)!;
	const projectSymbolProvenance = provenance(
		snapshot.id,
		source.projectId,
		'TS_SYMBOL',
		snapshot.projects[0]!.programRecipe.projectResolutionDigest,
		null,
		null,
		snapshot.contextDigest,
		snapshot.projects[0]!.contextInputIds
	);
	const sourceSymbolProvenance = provenance(
		snapshot.id,
		source.projectId,
		'TS_SYMBOL',
		snapshot.projects[0]!.programRecipe.projectResolutionDigest,
		source.id,
		projectSymbolProvenance.id,
		snapshot.contextDigest,
		snapshot.projects[0]!.contextInputIds
	);
	const sourceScope = snapshot.scopes.find(
		(scope) =>
			scope.sourceId === source.id &&
			(scope.kind === 'SOURCE_SCRIPT' || scope.kind === 'SOURCE_MODULE')
	)!;
	const globalScope = snapshot.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')!;

	const candidate = {
		ambientSyntax: false,
		candidateRole: 'BINDING' as const,
		candidateState: 'SYNTAX_ONLY' as const,
		exportCarrierNodeId: null,
		exportSyntax: 'NONE' as const,
		id: semanticDeclarationCandidateId({
			candidateRole: 'BINDING',
			nodeId: declarationNode.id,
			syntaxKind: declarationNode.kind
		}),
		localModifiers: [],
		nameNodeId: nameNode.id,
		nameState: 'ATOMIC' as const,
		nodeId: declarationNode.id,
		sourceId: source.id,
		syntacticName: 'value',
		syntaxKind: declarationNode.kind,
		syntaxKindName: declarationNode.kindName
	};
	const declarationId = semanticDeclarationId({
		end: declarationNode.end,
		kind: declarationNode.kind,
		nodeId: declarationNode.id,
		sourceId: source.id,
		start: declarationNode.start
	});
	const targetSymbolId = semanticSymbolId({
		declarationIds: [declarationId],
		fallbackReferenceNodeIds: [],
		flags: ts.SymbolFlags.BlockScopedVariable,
		identityBasis: 'DECLARATIONS',
		name: 'value',
		programId: source.programId,
		projectId: source.projectId
	});
	const aliasSymbolId = semanticSymbolId({
		declarationIds: [],
		fallbackReferenceNodeIds: [referenceNode.id],
		flags: ts.SymbolFlags.Alias,
		identityBasis: 'REFERENCE_FALLBACK',
		name: 'renamed',
		programId: source.programId,
		projectId: source.projectId
	});
	const declaration = {
		ambient: false,
		bindingProvenanceId: sourceSymbolProvenance.id,
		candidateId: candidate.id,
		declaringScopeId: globalScope.id,
		durableId: semanticDurableDeclarationId({
			ambient: false,
			contentSha256: source.contentSha256,
			declarationFile: source.declarationFile,
			end: declarationNode.end,
			kind: declarationNode.kind,
			languageVariant: source.languageVariant,
			logicalPath: source.logicalPath,
			name: 'value',
			nameState: 'ATOMIC',
			scriptKind: source.scriptKind,
			start: declarationNode.start,
			typescriptVersion: TYPESCRIPT_PROVIDER_VERSION
		}),
		end: declarationNode.end,
		id: declarationId,
		kind: declarationNode.kind,
		kindName: declarationNode.kindName,
		name: 'value',
		nameState: 'ATOMIC' as const,
		nodeId: declarationNode.id,
		scopeLinkState: 'RESOLVED' as const,
		sourceId: source.id,
		start: declarationNode.start,
		structuralProvenanceId: sourceScopeProvenance.id,
		symbolBindingState: 'RESOLVED' as const,
		symbolId: targetSymbolId
	};
	const symbols = [
		{
			declarationIds: [declarationId],
			fallbackReferenceNodeIds: [],
			flags: ts.SymbolFlags.BlockScopedVariable,
			flagNames: ['BlockScopedVariable'],
			id: targetSymbolId,
			identityBasis: 'DECLARATIONS' as const,
			mergeState: 'SINGLE' as const,
			name: 'value',
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: projectSymbolProvenance.id,
			valueDeclarationId: declarationId
		},
		{
			declarationIds: [],
			fallbackReferenceNodeIds: [referenceNode.id],
			flags: ts.SymbolFlags.Alias,
			flagNames: ['Alias'],
			id: aliasSymbolId,
			identityBasis: 'REFERENCE_FALLBACK' as const,
			mergeState: 'DECLARATIONLESS' as const,
			name: 'renamed',
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: projectSymbolProvenance.id,
			valueDeclarationId: null
		}
	].sort((left, right) => (left.id < right.id ? -1 : 1));
	const aliasPreimage = {
		aliasSymbolId,
		state: 'RESOLVED' as const,
		targetSymbolId,
		terminalSymbolId: targetSymbolId
	};
	const alias = {
		...aliasPreimage,
		id: semanticAliasId(aliasPreimage),
		provenanceId: projectSymbolProvenance.id
	};
	const referencePreimage = {
		nodeId: referenceNode.id,
		resolvedSymbolId: targetSymbolId,
		resolutionState: 'RESOLVED_ALIAS' as const,
		role: 'SYMBOL_USE' as const,
		symbolId: aliasSymbolId
	};
	const reference = {
		...referencePreimage,
		containingScopeId: sourceScope.id,
		id: semanticReferenceId(referencePreimage),
		resolutionProvenanceId: sourceSymbolProvenance.id,
		scopeLinkState: 'RESOLVED' as const,
		sourceId: source.id,
		structuralProvenanceId: sourceScopeProvenance.id
	};
	const moduleResolutionPreimage = {
		moduleSymbolId: targetSymbolId,
		nodeId: moduleNode.id,
		occurrenceKind: 'IMPORT' as const,
		resolutionState: 'RESOLVED_SOURCE' as const,
		specifier: './value.js',
		specifierState: 'LITERAL' as const,
		targetSourceId: source.id,
		typeOnly: false
	};
	const moduleResolution = {
		...moduleResolutionPreimage,
		id: semanticModuleResolutionId(moduleResolutionPreimage),
		provenanceId: sourceSymbolProvenance.id,
		sourceId: source.id
	};
	const moduleExportPreimage = {
		exportName: 'renamed',
		sourceId: source.id,
		state: 'ALIAS' as const,
		symbolId: aliasSymbolId,
		targetSymbolId
	};
	const moduleExport = {
		...moduleExportPreimage,
		id: semanticModuleExportId(moduleExportPreimage),
		provenanceId: sourceSymbolProvenance.id
	};
	const provenances = [
		...snapshot.provenances,
		projectSymbolProvenance,
		sourceSymbolProvenance
	].sort((left, right) => (left.id < right.id ? -1 : 1));
	const populations: Readonly<Record<SemanticPopulationKind, readonly string[]>> = {
		ALIAS: [alias.id],
		ASSIGNMENT: [],
		AST_NODE: snapshot.astNodes.map((record) => record.id),
		CONTEXT_INPUT: [],
		DECLARATION: [declaration.id],
		DECLARATION_CANDIDATE: [candidate.id],
		DIAGNOSTIC: [],
		FRAMEWORK_CANDIDATE: [],
		INVOCATION_SITE: [],
		LITERAL: [],
		MODULE_EXPORT: [moduleExport.id],
		MODULE_RESOLUTION: [moduleResolution.id],
		OVERLOAD_SET: [],
		PROGRAM: snapshot.programs.map((record) => record.id),
		PROJECT: snapshot.projects.map((record) => record.id),
		PROVENANCE: provenances.map((record) => record.id),
		REFERENCE: [reference.id],
		SOURCE: snapshot.sources.map((record) => record.id),
		SCOPE: snapshot.scopes.map((record) => record.id),
		SIGNATURE: [],
		SIGNATURE_PARAMETER: [],
		SYMBOL: symbols.map((record) => record.id),
		TYPE: [],
		TYPE_PARAMETER: [],
		TYPE_RELATION: []
	};

	return {
		...snapshot,
		aliases: [alias],
		declarationCandidates: [candidate],
		declarations: [declaration],
		moduleExports: [moduleExport],
		moduleResolutions: [moduleResolution],
		populations: snapshot.populations.map((population) =>
			population.kind === 'CONTEXT_INPUT'
				? population
				: semanticPopulation(population.kind, members(populations[population.kind]))
		),
		provenances,
		references: [reference],
		symbols
	};
}

function withCallAndConstructOverloadFacts(): StaticSemanticSnapshot {
	const snapshot = withSymbolFacts(['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']);
	const source = snapshot.sources[0]!;
	const project = snapshot.projects[0]!;
	const declaration = snapshot.declarations[0]!;
	const callableSymbol = snapshot.symbols.find((symbol) => symbol.id === declaration.symbolId)!;
	const globalScope = snapshot.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')!;
	const bindingProvenance = snapshot.provenances.find(
		(record) =>
			record.capability === 'TS_SYMBOL' &&
			record.sourceId === source.id &&
			record.epistemic.inference === 'direct'
	)!;
	const structuralProvenance = snapshot.provenances.find(
		(record) =>
			record.capability === 'TS_SYMBOL' &&
			record.sourceId === source.id &&
			record.epistemic.inference === 'derived'
	)!;
	const typeProvenance = provenance(
		snapshot.id,
		project.id,
		'TS_TYPE',
		project.programRecipe.projectResolutionDigest,
		null,
		null,
		snapshot.contextDigest,
		project.contextInputIds
	);
	const addedDeclarationSpecs = [
		{
			end: 47,
			kind: ts.SyntaxKind.CallSignature,
			kindName: 'CallSignature',
			symbolName: '__call_signature',
			start: 40
		},
		{
			end: 57,
			kind: ts.SyntaxKind.ConstructSignature,
			kindName: 'ConstructSignature',
			symbolName: '__construct_signature',
			start: 49
		}
	] as const;
	const addedDeclarationIds = addedDeclarationSpecs.map((spec) =>
		semanticDeclarationId({
			end: spec.end,
			kind: spec.kind,
			nodeId: null,
			sourceId: source.id,
			start: spec.start
		})
	);
	const addedSymbolIds = addedDeclarationSpecs.map((spec, index) =>
		semanticSymbolId({
			declarationIds: [addedDeclarationIds[index]!],
			fallbackReferenceNodeIds: [],
			flags: ts.SymbolFlags.Signature,
			identityBasis: 'DECLARATIONS',
			name: spec.symbolName,
			programId: source.programId,
			projectId: source.projectId
		})
	);
	const addedDeclarations: StaticSemanticSnapshot['declarations'] = addedDeclarationSpecs.map(
		(spec, index) => ({
			ambient: false,
			bindingProvenanceId: bindingProvenance.id,
			candidateId: null,
			declaringScopeId: globalScope.id,
			durableId: semanticDurableDeclarationId({
				ambient: false,
				contentSha256: source.contentSha256,
				declarationFile: source.declarationFile,
				end: spec.end,
				kind: spec.kind,
				languageVariant: source.languageVariant,
				logicalPath: source.logicalPath,
				name: null,
				nameState: 'ANONYMOUS',
				scriptKind: source.scriptKind,
				start: spec.start,
				typescriptVersion: TYPESCRIPT_PROVIDER_VERSION
			}),
			end: spec.end,
			id: addedDeclarationIds[index]!,
			kind: spec.kind,
			kindName: spec.kindName,
			name: null,
			nameState: 'ANONYMOUS',
			nodeId: null,
			scopeLinkState: 'RESOLVED',
			sourceId: source.id,
			start: spec.start,
			structuralProvenanceId: structuralProvenance.id,
			symbolBindingState: 'RESOLVED',
			symbolId: addedSymbolIds[index]!
		})
	);
	const addedSymbols: StaticSemanticSnapshot['symbols'] = addedDeclarationSpecs.map(
		(spec, index) => ({
			declarationIds: [addedDeclarationIds[index]!],
			fallbackReferenceNodeIds: [],
			flagNames: ['Signature'],
			flags: ts.SymbolFlags.Signature,
			id: addedSymbolIds[index]!,
			identityBasis: 'DECLARATIONS',
			mergeState: 'SINGLE',
			name: spec.symbolName,
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: bindingProvenance.parentProvenanceId!,
			valueDeclarationId: null
		})
	);
	const signatureInputs = [
		{
			declaration,
			declarationRole: 'CALL_SIGNATURE' as const,
			ownerKind: 'TYPE' as const,
			signatureKind: 'CALL' as const
		},
		{
			declaration: addedDeclarations[0]!,
			declarationRole: 'CALL_SIGNATURE' as const,
			ownerKind: 'TYPE' as const,
			signatureKind: 'CALL' as const
		},
		{
			declaration,
			declarationRole: 'CONSTRUCT_SIGNATURE' as const,
			ownerKind: 'SYMBOL' as const,
			signatureKind: 'CONSTRUCT' as const
		},
		{
			declaration: addedDeclarations[1]!,
			declarationRole: 'CONSTRUCT_SIGNATURE' as const,
			ownerKind: 'TYPE' as const,
			signatureKind: 'CONSTRUCT' as const
		}
	].map((input) => ({
		...input,
		id: semanticSignatureId({
			declarationId: input.declaration.id,
			identityBasis: 'DECLARATION_ANCHORED',
			programId: source.programId,
			semanticKind: 'OVERLOAD_SIGNATURE',
			signatureKind: input.signatureKind
		})
	}));
	const fingerprintSha256 = sha256('fixture-return-type-fingerprint');
	const typeId = semanticTypeId({
		fingerprintProfile: SEMANTIC_TYPE_FINGERPRINT_PROFILE,
		fingerprintSha256,
		identityBasis: 'DECLARATION_ANCHORED',
		programId: source.programId
	});
	const acquisitionAnchors = signatureInputs
		.map((input) => ({
			componentKind: 'RETURN' as const,
			componentOrdinal: 0,
			kind: 'SIGNATURE_COMPONENT' as const,
			signatureId: input.id
		}))
		.sort((left, right) => (canonicalSemanticJson(left) < canonicalSemanticJson(right) ? -1 : 1));
	const type: StaticSemanticSnapshot['types'][number] = {
		acquisitionAnchors,
		aliasSymbolId: null,
		category: 'INTRINSIC',
		display: 'string',
		displayProfile: SEMANTIC_TYPE_DISPLAY_PROFILE,
		displaySha256: sha256('string'),
		fingerprintProfile: SEMANTIC_TYPE_FINGERPRINT_PROFILE,
		fingerprintSha256,
		flagNames: ['String'],
		flags: ts.TypeFlags.String,
		id: typeId,
		identityBasis: 'DECLARATION_ANCHORED',
		objectFlagNames: [],
		objectFlags: null,
		programId: source.programId,
		projectId: source.projectId,
		provenanceId: typeProvenance.id,
		structureState: 'COMPLETE',
		symbolId: callableSymbol.id,
		unsupportedStructureKinds: []
	};
	const signatures: StaticSemanticSnapshot['signatures'] = signatureInputs
		.map((input) => {
			const display = input.signatureKind === 'CALL' ? '(): string' : 'new (): string';
			return {
				declarationId: input.declaration.id,
				declarationRole: input.declarationRole,
				display,
				displaySha256: sha256(display),
				fingerprintProfile: SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE,
				fingerprintSha256: sha256(`fixture-${input.signatureKind}-${input.declaration.id}`),
				id: input.id,
				identityBasis: 'DECLARATION_ANCHORED' as const,
				owner:
					input.ownerKind === 'SYMBOL'
						? { id: callableSymbol.id, kind: 'SYMBOL' as const }
						: { id: typeId, kind: 'TYPE' as const },
				parameterIds: [],
				programId: source.programId,
				projectId: source.projectId,
				provenanceId: typeProvenance.id,
				providerOrdinal: null,
				returnTypeId: typeId,
				semanticKind: 'OVERLOAD_SIGNATURE' as const,
				signatureKind: input.signatureKind,
				typeParameterIds: []
			};
		})
		.sort((left, right) => (left.id < right.id ? -1 : 1));
	const overloadSetId = semanticOverloadSetId({
		callableSymbolId: callableSymbol.id,
		programId: source.programId
	});
	const overloadSet: StaticSemanticSnapshot['overloadSets'][number] = {
		callableSymbolId: callableSymbol.id,
		id: overloadSetId,
		programId: source.programId,
		projectId: source.projectId,
		provenanceId: typeProvenance.id
	};
	const typeRelations = signatureInputs
		.map((input, ordinal): StaticSemanticSnapshot['typeRelations'][number] => {
			const preimage = {
				kind: 'OVERLOAD_MEMBERSHIP' as const,
				ordinal,
				overloadSetId,
				programId: source.programId,
				projectId: source.projectId,
				role: input.declarationRole,
				signatureId: input.id,
				state: 'CONFIRMED' as const
			};
			return {
				...preimage,
				id: semanticTypeRelationId(preimage),
				provenanceId: typeProvenance.id
			};
		})
		.sort((left, right) => (left.id < right.id ? -1 : 1));
	const provenances = [...snapshot.provenances, typeProvenance].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const declarations = [...snapshot.declarations, ...addedDeclarations].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const symbols = [...snapshot.symbols, ...addedSymbols].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const populations = snapshot.populations.map((population) => {
		switch (population.kind) {
			case 'DECLARATION':
				return semanticPopulation('DECLARATION', members(declarations.map((record) => record.id)));
			case 'SYMBOL':
				return semanticPopulation('SYMBOL', members(symbols.map((record) => record.id)));
			case 'TYPE':
				return semanticPopulation('TYPE', members([type.id]));
			case 'SIGNATURE':
				return semanticPopulation('SIGNATURE', members(signatures.map((record) => record.id)));
			case 'OVERLOAD_SET':
				return semanticPopulation('OVERLOAD_SET', members([overloadSet.id]));
			case 'TYPE_RELATION':
				return semanticPopulation(
					'TYPE_RELATION',
					members(typeRelations.map((record) => record.id))
				);
			case 'PROVENANCE':
				return semanticPopulation('PROVENANCE', members(provenances.map((record) => record.id)));
			default:
				return population;
		}
	});
	return {
		...snapshot,
		declarations,
		overloadSets: [overloadSet],
		populations,
		provenances,
		signatures,
		symbols,
		typeRelations,
		types: [type]
	};
}

function withDeclarationOwnedPairTypeParameters(): StaticSemanticSnapshot {
	const snapshot = withCallAndConstructOverloadFacts();
	const source = snapshot.sources[0]!;
	const globalScope = snapshot.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')!;
	const bindingProvenance = snapshot.provenances.find(
		(record) =>
			record.capability === 'TS_SYMBOL' &&
			record.sourceId === source.id &&
			record.epistemic.inference === 'direct'
	)!;
	const structuralProvenance = snapshot.provenances.find(
		(record) =>
			record.capability === 'TS_SYMBOL' &&
			record.sourceId === source.id &&
			record.epistemic.inference === 'derived'
	)!;
	const typeProvenance = snapshot.provenances.find(
		(record) => record.capability === 'TS_TYPE' && record.sourceId === null
	)!;
	const specs = [
		{
			end: 60,
			flags: ts.SymbolFlags.TypeAlias,
			flagNames: ['TypeAlias'],
			kind: ts.SyntaxKind.TypeAliasDeclaration,
			kindName: 'TypeAliasDeclaration',
			name: 'Pair',
			start: 20
		},
		{
			end: 30,
			flags: ts.SymbolFlags.TypeParameter,
			flagNames: ['TypeParameter'],
			kind: ts.SyntaxKind.TypeParameter,
			kindName: 'TypeParameter',
			name: 'T',
			start: 25
		},
		{
			end: 40,
			flags: ts.SymbolFlags.TypeParameter,
			flagNames: ['TypeParameter'],
			kind: ts.SyntaxKind.TypeParameter,
			kindName: 'TypeParameter',
			name: 'U',
			start: 35
		}
	] as const;
	const declarationIds = new Map(
		specs.map((spec) => [
			spec.name,
			semanticDeclarationId({
				end: spec.end,
				kind: spec.kind,
				nodeId: null,
				sourceId: source.id,
				start: spec.start
			})
		])
	);
	const symbolIds = new Map(
		specs.map((spec) => {
			const declarationId = declarationIds.get(spec.name)!;
			return [
				spec.name,
				semanticSymbolId({
					declarationIds: [declarationId],
					fallbackReferenceNodeIds: [],
					flags: spec.flags,
					identityBasis: 'DECLARATIONS',
					name: spec.name,
					programId: source.programId,
					projectId: source.projectId
				})
			] as const;
		})
	);
	const addedDeclarations: StaticSemanticSnapshot['declarations'] = specs.map((spec) => {
		const declarationId = declarationIds.get(spec.name)!;
		return {
			ambient: false,
			bindingProvenanceId: bindingProvenance.id,
			candidateId: null,
			declaringScopeId: globalScope.id,
			durableId: semanticDurableDeclarationId({
				ambient: false,
				contentSha256: source.contentSha256,
				declarationFile: source.declarationFile,
				end: spec.end,
				kind: spec.kind,
				languageVariant: source.languageVariant,
				logicalPath: source.logicalPath,
				name: spec.name,
				nameState: 'ATOMIC',
				scriptKind: source.scriptKind,
				start: spec.start,
				typescriptVersion: TYPESCRIPT_PROVIDER_VERSION
			}),
			end: spec.end,
			id: declarationId,
			kind: spec.kind,
			kindName: spec.kindName,
			name: spec.name,
			nameState: 'ATOMIC',
			nodeId: null,
			scopeLinkState: 'RESOLVED',
			sourceId: source.id,
			start: spec.start,
			structuralProvenanceId: structuralProvenance.id,
			symbolBindingState: 'RESOLVED',
			symbolId: symbolIds.get(spec.name)!
		};
	});
	const addedSymbols: StaticSemanticSnapshot['symbols'] = specs.map((spec) => {
		const declarationId = declarationIds.get(spec.name)!;
		return {
			declarationIds: [declarationId],
			fallbackReferenceNodeIds: [],
			flagNames: [...spec.flagNames],
			flags: spec.flags,
			id: symbolIds.get(spec.name)!,
			identityBasis: 'DECLARATIONS',
			mergeState: 'SINGLE',
			name: spec.name,
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: bindingProvenance.parentProvenanceId!,
			valueDeclarationId: null
		};
	});
	const owner = { id: declarationIds.get('Pair')!, kind: 'DECLARATION' as const };
	const parameterSpecs = specs.filter((spec) => spec.name !== 'Pair');
	const parameterTypes: StaticSemanticSnapshot['types'] = parameterSpecs.map((spec) => {
		const fingerprintSha256 = sha256(`fixture-type-parameter-${spec.name}`);
		const id = semanticTypeId({
			fingerprintProfile: SEMANTIC_TYPE_FINGERPRINT_PROFILE,
			fingerprintSha256,
			identityBasis: 'DECLARATION_ANCHORED',
			programId: source.programId
		});
		return {
			acquisitionAnchors: [
				{
					declarationId: declarationIds.get(spec.name)!,
					kind: 'DECLARATION',
					queryMode: 'DECLARED_SYMBOL_TYPE'
				}
			],
			aliasSymbolId: null,
			category: 'TYPE_PARAMETER',
			display: spec.name,
			displayProfile: SEMANTIC_TYPE_DISPLAY_PROFILE,
			displaySha256: sha256(spec.name),
			fingerprintProfile: SEMANTIC_TYPE_FINGERPRINT_PROFILE,
			fingerprintSha256,
			flagNames: ['IncludesMissingType', 'TypeParameter'],
			flags: ts.TypeFlags.TypeParameter,
			id,
			identityBasis: 'DECLARATION_ANCHORED',
			objectFlagNames: [],
			objectFlags: null,
			programId: source.programId,
			projectId: source.projectId,
			provenanceId: typeProvenance.id,
			structureState: 'COMPLETE',
			symbolId: symbolIds.get(spec.name)!,
			unsupportedStructureKinds: []
		};
	});
	const typeParameters: StaticSemanticSnapshot['typeParameters'] = parameterSpecs
		.map((spec, ordinal) => {
			const declarationId = declarationIds.get(spec.name)!;
			const parameterTypeId = parameterTypes.find((type) => type.display === spec.name)!.id;
			return {
				constraintState: 'MISSING' as const,
				constraintTypeId: null,
				declarationId,
				defaultState: 'MISSING' as const,
				defaultTypeId: null,
				id: semanticTypeParameterId({ declarationId, ordinal, owner }),
				name: spec.name,
				ordinal,
				owner,
				parameterTypeId,
				programId: source.programId,
				projectId: source.projectId,
				provenanceId: typeProvenance.id
			};
		})
		.sort((left, right) => (left.id < right.id ? -1 : 1));
	const constraintRelations: StaticSemanticSnapshot['typeRelations'] = typeParameters.map(
		(parameter) => {
			const preimage = {
				constraintState: 'MISSING' as const,
				constraintTypeId: null,
				kind: 'PARAMETER_CONSTRAINT' as const,
				programId: source.programId,
				projectId: source.projectId,
				state: 'CONFIRMED' as const,
				typeParameterId: parameter.id
			};
			return {
				...preimage,
				id: semanticTypeRelationId(preimage),
				provenanceId: typeProvenance.id
			};
		}
	);
	const declarations = [...snapshot.declarations, ...addedDeclarations].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const symbols = [...snapshot.symbols, ...addedSymbols].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const types = [...snapshot.types, ...parameterTypes].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const relations = [...snapshot.typeRelations, ...constraintRelations].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	return {
		...snapshot,
		declarations,
		populations: snapshot.populations.map((population) => {
			switch (population.kind) {
				case 'DECLARATION':
					return semanticPopulation(
						'DECLARATION',
						members(declarations.map((record) => record.id))
					);
				case 'SYMBOL':
					return semanticPopulation('SYMBOL', members(symbols.map((record) => record.id)));
				case 'TYPE':
					return semanticPopulation('TYPE', members(types.map((record) => record.id)));
				case 'TYPE_PARAMETER':
					return semanticPopulation(
						'TYPE_PARAMETER',
						members(typeParameters.map((record) => record.id))
					);
				case 'TYPE_RELATION':
					return semanticPopulation('TYPE_RELATION', members(relations.map((record) => record.id)));
				default:
					return population;
			}
		}),
		symbols,
		typeParameters,
		typeRelations: relations,
		types
	};
}

function withContextSource(
	snapshot: StaticSemanticSnapshot,
	logicalPath: string,
	contents = ''
): StaticSemanticSnapshot {
	const source = snapshot.sources[0]!;
	const contentSha256 = sha256(contents);
	const parsedSource = ts.createSourceFile(logicalPath, contents, ts.ScriptTarget.Latest, true);
	const moduleKind = ts.isExternalModule(parsedSource) ? ('MODULE' as const) : ('SCRIPT' as const);
	const sourceScopeKind =
		moduleKind === 'MODULE' ? ('SOURCE_MODULE' as const) : ('SOURCE_SCRIPT' as const);
	const sourceScopeDomain = moduleKind === 'MODULE' ? ('MIXED' as const) : ('LEXICAL' as const);
	const id = semanticSourceId({
		contentSha256,
		logicalPath,
		moduleKind,
		programId: source.programId
	});
	const sourceProvenance = snapshot.provenances.find(
		(record) => record.id === source.provenanceId
	)!;
	const contextProvenance = reidentifyProvenance({
		...sourceProvenance,
		epistemic: {
			...sourceProvenance.epistemic,
			supportBasis: {
				...sourceProvenance.epistemic.supportBasis,
				sourceRefs: [sourceProvenance.parentProvenanceId!, id].sort()
			}
		},
		sourceId: id
	});
	const projectSymbolProvenance = snapshot.provenances.find(
		(record) => record.capability === 'TS_SYMBOL' && record.sourceId === null
	)!;
	const contextScopeProvenance = provenance(
		snapshot.id,
		source.projectId,
		'TS_SYMBOL',
		snapshot.projects[0]!.programRecipe.projectResolutionDigest,
		id,
		projectSymbolProvenance.id,
		snapshot.contextDigest,
		snapshot.projects[0]!.contextInputIds,
		'SCOPE_DERIVED'
	);
	const contextSource = {
		...source,
		analysisDisposition: 'CONTEXT_ONLY' as const,
		artifactClass: 'CONTEXT_ONLY' as const,
		bytes: contents.length,
		contentSha256,
		declarationFile: true,
		diagnosticIds: [],
		id,
		logicalPath,
		moduleKind,
		provenanceId: contextProvenance.id,
		rootFile: false,
		rootNodeId: null,
		syntaxProvenanceId: null,
		textLength: contents.length
	};
	const sources = [...snapshot.sources, contextSource].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const sourceIds = sources.map((record) => record.id).sort();
	const globalScope = snapshot.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')!;
	const contextScopeId = semanticScopeId({
		domain: sourceScopeDomain,
		end: contents.length,
		kind: sourceScopeKind,
		ownerKind: ts.SyntaxKind.SourceFile,
		programId: source.programId,
		sourceId: id,
		start: 0
	});
	const contextScope: StaticSemanticSnapshot['scopes'][number] = {
		domain: sourceScopeDomain,
		end: contents.length,
		id: contextScopeId,
		kind: sourceScopeKind,
		ownerKind: ts.SyntaxKind.SourceFile,
		ownerKindName: 'SourceFile',
		ownerNodeId: null,
		parentScopeId: globalScope.id,
		programId: source.programId,
		projectId: source.projectId,
		provenanceId: contextScopeProvenance.id,
		sourceId: id,
		start: 0
	};
	const scopes = [...snapshot.scopes, contextScope].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const provenances = [...snapshot.provenances, contextProvenance, contextScopeProvenance].sort(
		(left, right) => (left.id < right.id ? -1 : 1)
	);
	return {
		...snapshot,
		populations: snapshot.populations.map((population) =>
			population.kind === 'PROVENANCE'
				? semanticPopulation('PROVENANCE', members(provenances.map((record) => record.id)))
				: population.kind === 'SCOPE'
					? semanticPopulation(
							'SCOPE',
							members(
								scopes.filter((record) => record.sourceId !== id).map((record) => record.id),
								[contextScope.id]
							)
						)
					: population.kind === 'SOURCE'
						? semanticPopulation(
								'SOURCE',
								members(
									sources
										.filter((record) => record.analysisDisposition === 'DEEP_INDEXED')
										.map((record) => record.id)
										.sort(),
									sources
										.filter((record) => record.analysisDisposition === 'CONTEXT_ONLY')
										.map((record) => record.id)
										.sort()
								)
							)
						: population
		),
		programs: snapshot.programs.map((program) => ({ ...program, sourceIds })),
		projects: snapshot.projects.map((project) => ({ ...project, sourceIds })),
		provenances,
		scopes,
		sources
	};
}

function readFileObservation(
	logicalPath: string,
	result: 'ABSENT' | 'PRESENT',
	contents = '',
	byteBudgetClass: 'FROZEN_SUBJECT' | 'LIVE_COMPILER_CONTEXT' = 'LIVE_COMPILER_CONTEXT',
	invocationCount = 1
): CompilerInputObservation {
	if (result === 'PRESENT') {
		const observed = {
			byteBudgetClass,
			contentBytes: contents.length,
			contentSha256: sha256(contents),
			invocationCount,
			logicalPath,
			operation: 'READ_FILE' as const,
			origin: 'AUTHORED' as const,
			result
		};
		const resultDigest = compilerInputResultDigest(observed);
		return {
			...observed,
			id: semanticContextInputId({ ...observed, resultDigest, subjectId: SUBJECT_ID }),
			resultDigest
		};
	}
	const observed = {
		invocationCount,
		logicalPath,
		operation: 'READ_FILE' as const,
		origin: 'AUTHORED' as const,
		result
	};
	const resultDigest = compilerInputResultDigest(observed);
	return {
		...observed,
		id: semanticContextInputId({ ...observed, resultDigest, subjectId: SUBJECT_ID }),
		resultDigest
	};
}

function subjectProject(
	project: StaticSemanticSnapshot['projects'][number],
	status: 'COMPLETE' | 'PARTIAL' = 'COMPLETE'
): NonNullable<SemanticValidationContext['frozenSubject']>['projects'][number] {
	return {
		configClosure: [],
		configPath: project.configPath,
		effectiveCompilerOptions: project.programRecipe.compilerOptions,
		fileNames: project.rootNames,
		frameworkCandidates: project.frameworkCandidates,
		kind: project.kind,
		programRecipe: project.programRecipe,
		projectReferences: project.projectReferences,
		rawCompilerOptions: project.programRecipe.compilerOptions,
		rawExclude: null,
		rawExtends: null,
		rawFiles: null,
		rawInclude: null,
		rootDisposition: project.rootDisposition,
		status,
		typescriptDiagnostics: []
	};
}

const FROZEN_CONTEXT: SemanticValidationContext = {
	frozenSubject: {
		artifacts: [
			{
				bytes: 0,
				canonicalPathKey: 'src/index.ts',
				disposition: 'ANALYZED',
				path: 'src/index.ts',
				primaryClass: 'PRODUCTION_SOURCE',
				reason: 'Fixture source.',
				roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'],
				sha256: CONTENT_DIGEST
			}
		],
		descriptor: {
			configurationDigest: '2'.repeat(64),
			dirtyState: 'UNKNOWN',
			excludedClasses: [],
			exclusionPolicyIds: [],
			fileManifestDigest: '3'.repeat(64),
			operationVersion: 'fixture/1',
			parentRevision: null,
			perimeter: [],
			policyVersion: SUBJECT_POLICY_VERSION,
			repositoryRoot: '.',
			revision: null,
			schemaVersion: SUBJECT_SCHEMA_VERSION,
			subjectId: SUBJECT_ID,
			subjectKind: 'WORKTREE'
		},
		projects: [subjectProject(fixture().projects[0]!)],
		workspaces: []
	}
};

function contextForSnapshot(
	snapshot: StaticSemanticSnapshot,
	artifactPath = snapshot.sources[0]!.logicalPath,
	workspaces: NonNullable<SemanticValidationContext['frozenSubject']>['workspaces'] = []
): SemanticValidationContext {
	const source = snapshot.sources[0]!;
	return {
		frozenSubject: {
			artifacts: [
				{
					bytes: source.bytes,
					canonicalPathKey: artifactPath,
					disposition: 'ANALYZED',
					path: artifactPath,
					primaryClass: 'PRODUCTION_SOURCE',
					reason: 'Fixture source.',
					roles: ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'PRODUCTION'],
					sha256: source.contentSha256
				}
			],
			descriptor: FROZEN_CONTEXT.frozenSubject!.descriptor,
			projects: snapshot.projects.map((project) => subjectProject(project)),
			workspaces
		}
	};
}

function validateSnapshot(
	value: unknown,
	overrides: Partial<SemanticValidationOptions> = {},
	context: SemanticValidationContext = FROZEN_CONTEXT
) {
	return validateStaticSemanticSnapshot(value, overrides, context);
}

function expectValidationEvidenceCode(
	action: () => unknown,
	code: StaticSemanticValidationBudgetEvidenceErrorCode
): void {
	let thrown: unknown;
	try {
		action();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toMatchObject({ code });
}

function diagnosticMessage(
	text: string,
	next: readonly SemanticDiagnosticMessage[] = [],
	category: SemanticDiagnosticMessage['category'] = null,
	code: number | null = null
): SemanticDiagnosticMessage {
	return { category, code, next, ...encodeSemanticDiagnosticText(text) };
}

function directoryObservation(
	logicalPath: string,
	operation: 'DIRECTORY_EXISTS' | 'GET_DIRECTORIES' | 'READ_DIRECTORY',
	result: 'DIRECTORY' | 'NOT_DIRECTORY',
	resultEntries: readonly string[] = [],
	scannedEntries = result === 'NOT_DIRECTORY' ? 0 : resultEntries.length,
	invocationCount = 1
): CompilerInputObservation {
	const common = { invocationCount, logicalPath, operation, origin: 'AUTHORED' as const, result };
	const observed =
		operation === 'READ_DIRECTORY'
			? {
					...common,
					depth: null,
					excludes: [],
					extensions: ['.ts'],
					includes: ['**/*'],
					operation,
					resultEntries,
					scannedEntries
				}
			: operation === 'GET_DIRECTORIES'
				? { ...common, operation, resultEntries, scannedEntries }
				: common;
	const resultDigest = compilerInputResultDigest(observed);
	return {
		...observed,
		id: semanticContextInputId({ ...observed, resultDigest, subjectId: SUBJECT_ID }),
		resultDigest
	} as CompilerInputObservation;
}

function realpathObservation(
	logicalPath: string,
	result: 'ABSENT' | 'RESOLVED',
	resolvedLogicalPath?: string
): CompilerInputObservation {
	const observed =
		result === 'ABSENT'
			? {
					invocationCount: 1,
					logicalPath,
					operation: 'REALPATH' as const,
					origin: 'AUTHORED' as const,
					result
				}
			: {
					invocationCount: 1,
					logicalPath,
					operation: 'REALPATH' as const,
					origin: 'AUTHORED' as const,
					resolvedLogicalPath: resolvedLogicalPath ?? logicalPath,
					result
				};
	const resultDigest = compilerInputResultDigest(observed);
	return {
		...observed,
		id: semanticContextInputId({ ...observed, resultDigest, subjectId: SUBJECT_ID }),
		resultDigest
	};
}

function withSourceDiagnostics(
	snapshot: StaticSemanticSnapshot,
	codes: readonly string[],
	includeSourceManifest: boolean
): StaticSemanticSnapshot {
	const project = snapshot.projects[0]!;
	const source = snapshot.sources[0]!;
	const diagnostics = codes
		.map((code) => {
			const message = diagnosticMessage(`TypeScript ${code}`);
			const diagnosticBase = {
				category: 'ERROR' as const,
				code: `TS${code}`,
				end: 0,
				family: 'SEMANTIC' as const,
				locationKind: 'SOURCE' as const,
				message,
				path: source.logicalPath,
				projectId: project.id,
				related: [],
				sourceId: source.id,
				start: 0
			};
			return {
				...diagnosticBase,
				id: semanticDiagnosticId(diagnosticBase),
				multiplicity: 1,
				provenanceId: source.provenanceId
			};
		})
		.sort((left, right) => (left.id < right.id ? -1 : 1));
	const diagnosticIds = diagnostics.map((diagnostic) => diagnostic.id);
	return {
		...snapshot,
		diagnostics,
		populations: snapshot.populations.map((population) =>
			population.kind === 'DIAGNOSTIC'
				? semanticPopulation('DIAGNOSTIC', members(diagnosticIds))
				: population
		),
		programs: snapshot.programs.map((program) => ({
			...program,
			diagnosticFamilies: program.diagnosticFamilies.map((family) =>
				family.family === 'SEMANTIC'
					? {
							...family,
							diagnosticIds,
							manifestDigest: sha256(
								canonicalSemanticJson(
									diagnostics.map(({ id, multiplicity }) => ({ id, multiplicity }))
								)
							),
							occurrenceCount: diagnostics.reduce(
								(total, diagnostic) => total + diagnostic.multiplicity,
								0
							),
							recordCount: diagnosticIds.length
						}
					: family
			),
			diagnosticIds
		})),
		projects: snapshot.projects.map((record) => ({ ...record, diagnosticIds })),
		sources: snapshot.sources.map((record) =>
			record.id === source.id
				? { ...record, diagnosticIds: includeSourceManifest ? diagnosticIds : [] }
				: record
		)
	};
}

function replaceDiagnostics(
	snapshot: StaticSemanticSnapshot,
	diagnosticsInput: readonly SemanticDiagnosticRecord[]
): StaticSemanticSnapshot {
	const diagnostics = [...diagnosticsInput].sort((left, right) => (left.id < right.id ? -1 : 1));
	const diagnosticIds = diagnostics.map((diagnostic) => diagnostic.id);
	return {
		...snapshot,
		diagnostics,
		populations: snapshot.populations.map((population) =>
			population.kind === 'DIAGNOSTIC'
				? semanticPopulation('DIAGNOSTIC', members(diagnosticIds))
				: population
		),
		programs: snapshot.programs.map((program) => ({
			...program,
			diagnosticFamilies: program.diagnosticFamilies.map((coverage) => {
				const records = diagnostics.filter(
					(diagnostic) =>
						diagnostic.projectId === program.projectId && diagnostic.family === coverage.family
				);
				return {
					...coverage,
					diagnosticIds: records.map((diagnostic) => diagnostic.id).sort(),
					manifestDigest: sha256(
						canonicalSemanticJson(records.map(({ id, multiplicity }) => ({ id, multiplicity })))
					),
					occurrenceCount: records.reduce(
						(total, diagnostic) => total + diagnostic.multiplicity,
						0
					),
					recordCount: records.length
				};
			}),
			diagnosticIds
		})),
		projects: snapshot.projects.map((project) => ({
			...project,
			diagnosticIds: diagnostics
				.filter((diagnostic) => diagnostic.projectId === project.id)
				.map((diagnostic) => diagnostic.id)
				.sort()
		})),
		sources: snapshot.sources.map((source) => ({
			...source,
			diagnosticIds: diagnostics
				.filter((diagnostic) => diagnostic.sourceId === source.id)
				.map((diagnostic) => diagnostic.id)
				.sort()
		}))
	};
}

describe('bounded semantic snapshot validation', () => {
	it('accepts a closed non-vacuous Slice 3B project and rejects unknown schema majors', () => {
		const snapshot = fixture();
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(
			validateSnapshot({ ...snapshot, schemaVersion: 'jan-csaa-semantic-snapshot/9.0.0' })
		).toMatchObject({ state: 'INVALID', issues: [{ code: 'UNSUPPORTED_SCHEMA_VERSION' }] });
	});

	it('accepts call and construct overload roles while rejecting kind and callable-owner drift', () => {
		const snapshot = withCallAndConstructOverloadFacts();
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});
		const callSignatures = snapshot.signatures.filter(
			(signature) => signature.declarationRole === 'CALL_SIGNATURE'
		);
		const constructSignatures = snapshot.signatures.filter(
			(signature) => signature.declarationRole === 'CONSTRUCT_SIGNATURE'
		);
		expect(callSignatures).toHaveLength(2);
		expect(constructSignatures).toHaveLength(2);
		expect(new Set(callSignatures.map((signature) => signature.declarationId)).size).toBe(2);
		expect(new Set(constructSignatures.map((signature) => signature.declarationId)).size).toBe(2);
		const callSignature = callSignatures[0]!;
		const kindDrift = validateSnapshot(
			{
				...snapshot,
				signatures: snapshot.signatures.map((signature) =>
					signature.id === callSignature.id
						? { ...signature, declarationRole: 'CONSTRUCT_SIGNATURE' as const }
						: signature
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(kindDrift.state).toBe('INVALID');
		expect(kindDrift.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);
		const unrelatedSymbol = snapshot.symbols.find(
			(symbol) => symbol.id !== snapshot.overloadSets[0]!.callableSymbolId
		)!;
		const ownerDrift = validateSnapshot(
			{
				...snapshot,
				signatures: snapshot.signatures.map((signature) =>
					signature.id === callSignature.id
						? { ...signature, owner: { id: unrelatedSymbol.id, kind: 'SYMBOL' as const } }
						: signature
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(ownerDrift.state).toBe('INVALID');
		expect(ownerDrift.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);

		const kindCardinalityDrift = validateSnapshot(
			{
				...snapshot,
				signatures: snapshot.signatures.map((signature) =>
					signature.id === callSignatures[1]!.id
						? { ...signature, signatureKind: 'CONSTRUCT' as const }
						: signature
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(kindCardinalityDrift.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message: `Overload set ${snapshot.overloadSets[0]!.id} Signature kind CALL must have at least two memberships.`
				})
			])
		);

		const duplicateDeclaration = validateSnapshot(
			{
				...snapshot,
				signatures: snapshot.signatures.map((signature) =>
					signature.id === callSignatures[1]!.id
						? { ...signature, declarationId: callSignatures[0]!.declarationId }
						: signature
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(duplicateDeclaration.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DUPLICATE_ID',
					message: `Overload set ${snapshot.overloadSets[0]!.id} Signature kind CALL must use distinct declaration identities.`
				})
			])
		);

		const missingDeclaration = validateSnapshot(
			{
				...snapshot,
				signatures: snapshot.signatures.map((signature) =>
					signature.id === callSignatures[1]!.id ? { ...signature, declarationId: null } : signature
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(missingDeclaration.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('must retain a non-null Signature declaration')
				})
			])
		);
	});

	it('accepts Pair<T, U> declaration ownership and rejects identity, source, and containment drift', () => {
		const snapshot = withDeclarationOwnedPairTypeParameters();
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});
		const owner = snapshot.declarations.find((declaration) => declaration.name === 'Pair')!;
		const parameters = snapshot.typeParameters
			.filter(
				(parameter) => parameter.owner.kind === 'DECLARATION' && parameter.owner.id === owner.id
			)
			.sort((left, right) => left.ordinal - right.ordinal);
		expect(parameters.map((parameter) => parameter.ordinal)).toEqual([0, 1]);
		for (const parameter of parameters) {
			expect(parameter.declarationId).not.toBeNull();
			expect(parameter.declarationId).not.toBe(owner.id);
			const declaration = snapshot.declarations.find(
				(candidate) => candidate.id === parameter.declarationId
			)!;
			expect(declaration.sourceId).toBe(owner.sourceId);
			expect(declaration.start).toBeGreaterThanOrEqual(owner.start);
			expect(declaration.end).toBeLessThanOrEqual(owner.end);
		}

		const first = parameters[0]!;
		const sameDeclaration = validateSnapshot(
			{
				...snapshot,
				typeParameters: snapshot.typeParameters.map((parameter) =>
					parameter.id === first.id ? { ...parameter, declarationId: owner.id } : parameter
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(sameDeclaration.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message:
						'Type-parameter declaration must be distinct from its enclosing generic declaration owner.'
				})
			])
		);

		const parameterDeclaration = snapshot.declarations.find(
			(declaration) => declaration.id === first.declarationId
		)!;
		const sourceDrift = validateSnapshot(
			{
				...snapshot,
				declarations: snapshot.declarations.map((declaration) =>
					declaration.id === parameterDeclaration.id
						? {
								...declaration,
								sourceId: `semantic:source-${'f'.repeat(64)}` as typeof declaration.sourceId
							}
						: declaration
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(sourceDrift.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'CROSS_PROJECT_REFERENCE',
					message:
						'Type-parameter declaration and its generic declaration owner must belong to the same source.'
				})
			])
		);

		const containmentDrift = validateSnapshot(
			{
				...snapshot,
				declarations: snapshot.declarations.map((declaration) =>
					declaration.id === parameterDeclaration.id
						? { ...declaration, start: owner.start - 1 }
						: declaration
				)
			},
			{},
			contextForSnapshot(snapshot)
		);
		expect(containmentDrift.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message:
						'Type-parameter declaration span must be contained by its enclosing generic declaration owner.'
				})
			])
		);
	});

	it('issues opaque single-use VALIDATE evidence bound to exact snapshot bytes and budgets', () => {
		const snapshot = fixture();
		const session = createStaticSemanticOperationBudgetSession(snapshot.budgets, 100, () => 100);
		const binding = session.providerBinding();
		const budgetsDigest = sha256(canonicalSemanticJson(snapshot.budgets));
		const issued = validateStaticSemanticSnapshotWithBudgetEvidence(
			snapshot,
			binding,
			{},
			contextForSnapshot(snapshot)
		);
		expect(issued.validation).toEqual({ issues: [], state: 'VALID' });
		expect(issued.evidence).not.toBeNull();
		if (issued.evidence === null) throw new Error('Expected validation budget evidence.');
		expect(Object.getPrototypeOf(issued.evidence)).toBeNull();
		expect(Object.keys(issued.evidence)).toEqual([]);
		expect(Object.isFrozen(issued.evidence)).toBe(true);

		const canonical = canonicalSemanticJson(snapshot);
		const view = takeStaticSemanticValidationBudgetEvidence(
			issued.evidence,
			binding,
			snapshot,
			budgetsDigest
		);
		expect(view).toEqual({
			budgetsDigest,
			canonicalSnapshotBytes: Buffer.byteLength(canonical, 'utf8'),
			phase: 'VALIDATE',
			snapshotSha256: sha256(canonical)
		});
		expect(Object.isFrozen(view)).toBe(true);
		expectValidationEvidenceCode(
			() =>
				takeStaticSemanticValidationBudgetEvidence(
					issued.evidence!,
					binding,
					snapshot,
					budgetsDigest
				),
			'EVIDENCE_REUSED'
		);
	});

	it('rejects fake, cloned, substituted, altered, and mismatched VALIDATE evidence inputs', () => {
		const snapshot = fixture();
		const session = createStaticSemanticOperationBudgetSession(snapshot.budgets, 100, () => 100);
		const binding = session.providerBinding();
		const wrongBinding = createStaticSemanticOperationBudgetSession(
			snapshot.budgets,
			100,
			() => 100
		).providerBinding();
		const budgetsDigest = sha256(canonicalSemanticJson(snapshot.budgets));
		const issued = validateStaticSemanticSnapshotWithBudgetEvidence(
			snapshot,
			binding,
			{},
			contextForSnapshot(snapshot)
		);
		if (issued.evidence === null) throw new Error('Expected validation budget evidence.');
		const evidence = issued.evidence;

		for (const fake of [
			Object.freeze(Object.create(null)) as StaticSemanticValidationBudgetEvidence,
			Object.freeze({ ...evidence }) as StaticSemanticValidationBudgetEvidence
		])
			expectValidationEvidenceCode(
				() => takeStaticSemanticValidationBudgetEvidence(fake, binding, snapshot, budgetsDigest),
				'INVALID_EVIDENCE'
			);
		expectValidationEvidenceCode(
			() =>
				takeStaticSemanticValidationBudgetEvidence(evidence, wrongBinding, snapshot, budgetsDigest),
			'BINDING_MISMATCH'
		);
		expectValidationEvidenceCode(
			() =>
				takeStaticSemanticValidationBudgetEvidence(
					evidence,
					binding,
					{ ...snapshot },
					budgetsDigest
				),
			'SNAPSHOT_MISMATCH'
		);
		expectValidationEvidenceCode(
			() => takeStaticSemanticValidationBudgetEvidence(evidence, binding, snapshot, '0'.repeat(64)),
			'BUDGET_MISMATCH'
		);
		expectValidationEvidenceCode(
			() =>
				validateStaticSemanticSnapshotWithBudgetEvidence(
					snapshot,
					null as never,
					{},
					contextForSnapshot(snapshot)
				),
			'INVALID_BINDING'
		);
		expect(() =>
			takeStaticSemanticValidationBudgetEvidence(evidence, binding, snapshot, budgetsDigest)
		).not.toThrow();

		const altered = fixture();
		const alteredBinding = createStaticSemanticOperationBudgetSession(
			altered.budgets,
			100,
			() => 100
		).providerBinding();
		const alteredIssued = validateStaticSemanticSnapshotWithBudgetEvidence(
			altered,
			alteredBinding,
			{},
			contextForSnapshot(altered)
		);
		if (alteredIssued.evidence === null) throw new Error('Expected validation budget evidence.');
		(altered as { health: 'COMPLETE' | 'PARTIAL' }).health = 'PARTIAL';
		expectValidationEvidenceCode(
			() =>
				takeStaticSemanticValidationBudgetEvidence(
					alteredIssued.evidence!,
					alteredBinding,
					altered,
					sha256(canonicalSemanticJson(altered.budgets))
				),
			'SNAPSHOT_MISMATCH'
		);
	});

	it('withholds VALIDATE evidence for invalid and validation-budget-exhausted snapshots', () => {
		const snapshot = fixture();
		const binding = createStaticSemanticOperationBudgetSession(
			snapshot.budgets,
			100,
			() => 100
		).providerBinding();
		const invalid = validateStaticSemanticSnapshotWithBudgetEvidence(
			{ ...snapshot, health: 'PARTIAL' },
			binding,
			{},
			contextForSnapshot(snapshot)
		);
		expect(invalid.validation.state).toBe('INVALID');
		expect(invalid.evidence).toBeNull();
		const exhausted = validateStaticSemanticSnapshotWithBudgetEvidence(
			snapshot,
			binding,
			{ maxRecords: 1 },
			contextForSnapshot(snapshot)
		);
		expect(exhausted.validation.state).toBe('BUDGET_EXHAUSTED');
		expect(exhausted.evidence).toBeNull();
	});

	it('uses the Program count as the exact TS_SYMBOL boundary predicate', () => {
		const snapshot = fixture();
		const limitation = {
			capability: 'TS_SYMBOL' as const,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason:
				'TypeScript symbol extraction and resolution are Program-scoped; cross-Program symbol identity and binding reconciliation is not implemented for this multi-project snapshot.',
			region: 'typescript-program-boundaries'
		};
		const program = snapshot.programs[0]!;
		const syntheticMultiProgram = {
			...snapshot,
			programs: [program, { ...program, id: `semantic:program-${'f'.repeat(64)}` }].sort(
				(left, right) => (left.id < right.id ? -1 : 1)
			)
		};
		expect(validateSnapshot(syntheticMultiProgram).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'Multi-Program snapshots require the exact canonical TS_SYMBOL Program-boundary limitation once.',
					path: '$.limitations'
				})
			])
		);
		expect(validateSnapshot({ ...snapshot, limitations: [limitation] }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'The TS_SYMBOL Program-boundary limitation is forbidden unless the snapshot contains multiple Programs.',
					path: '$.limitations'
				})
			])
		);
		const symbolProvenanceIndex = snapshot.provenances.findIndex(
			(provenance) => provenance.capability === 'TS_SYMBOL'
		);
		expect(
			validateSnapshot({
				...snapshot,
				provenances: snapshot.provenances.map((provenance, index) =>
					index === symbolProvenanceIndex
						? { ...provenance, limitations: [limitation] }
						: provenance
				)
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'The TS_SYMBOL Program-boundary provenance limitation is forbidden outside TS_SYMBOL provenance in a multi-Program snapshot.',
					path: `$.provenances[${symbolProvenanceIndex}].limitations`
				})
			])
		);
	});

	it('rejects missing and extra maxCompilerFacts wire fields and accepts the exact fact ceiling', () => {
		const snapshot = fixture();
		const missingCompilerFacts = Object.fromEntries(
			Object.entries(snapshot.budgets).filter(([key]) => key !== 'maxCompilerFacts')
		);
		expect(validateSnapshot({ ...snapshot, budgets: missingCompilerFacts }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_SHAPE',
					path: '$.budgets.maxCompilerFacts'
				})
			])
		);
		expect(
			validateSnapshot({
				...snapshot,
				budgets: { ...snapshot.budgets, unexpectedCompilerBudget: 1 }
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_SHAPE',
					path: '$.budgets.unexpectedCompilerBudget'
				})
			])
		);

		const compilerFacts = withSymbolFacts();
		const factCount =
			compilerFacts.aliases.length +
			compilerFacts.declarations.length +
			compilerFacts.moduleExports.length +
			compilerFacts.moduleResolutions.length +
			compilerFacts.references.length +
			compilerFacts.symbols.length;
		expect(factCount).toBeGreaterThan(1);
		expect(
			validateSnapshot({
				...compilerFacts,
				budgets: { ...compilerFacts.budgets, maxCompilerFacts: factCount }
			}).issues
		).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.budgets.maxCompilerFacts' })])
		);
		expect(
			validateSnapshot({
				...compilerFacts,
				budgets: { ...compilerFacts.budgets, maxCompilerFacts: factCount - 1 }
			}).issues
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.budgets.maxCompilerFacts' })])
		);
	});

	it('rejects lexical-scope topology, provenance, budget, and fact-link mutations', () => {
		const snapshot = fixture();
		const sourceScope = snapshot.scopes.find((scope) => scope.sourceId !== null)!;
		const globalScope = snapshot.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')!;
		const sourceScopeIndex = snapshot.scopes.findIndex((scope) => scope.id === sourceScope.id);
		const scopeMutation = (
			revise: (
				scope: StaticSemanticSnapshot['scopes'][number]
			) => StaticSemanticSnapshot['scopes'][number]
		): StaticSemanticSnapshot => ({
			...snapshot,
			scopes: snapshot.scopes.map((scope) => (scope.id === sourceScope.id ? revise(scope) : scope))
		});

		for (const [mutated, path] of [
			[
				scopeMutation((scope) => ({ ...scope, parentScopeId: scope.id })),
				`$.scopes[${sourceScopeIndex}].parentScopeId`
			],
			[
				scopeMutation((scope) => ({ ...scope, ownerNodeId: null })),
				`$.scopes[${sourceScopeIndex}].ownerNodeId`
			],
			[
				scopeMutation((scope) => ({ ...scope, provenanceId: globalScope.provenanceId })),
				`$.scopes[${sourceScopeIndex}].provenanceId`
			]
		] as const)
			expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated)).issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ path })])
			);

		expect(
			validateSnapshot({ ...snapshot, budgets: { ...snapshot.budgets, maxScopes: 1 } }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.budgets.maxScopes' })
			])
		);

		const symbolSnapshot = withSymbolFacts();
		const declarationLinkMutation = {
			...symbolSnapshot,
			declarations: symbolSnapshot.declarations.map((declaration) => ({
				...declaration,
				declaringScopeId: null
			}))
		};
		expect(
			validateSnapshot(declarationLinkMutation, {}, contextForSnapshot(declarationLinkMutation))
				.issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: '$.declarations[0].declaringScopeId'
				})
			])
		);
		const referenceLinkMutation = {
			...symbolSnapshot,
			references: symbolSnapshot.references.map((reference) => ({
				...reference,
				containingScopeId: null
			}))
		};
		expect(
			validateSnapshot(referenceLinkMutation, {}, contextForSnapshot(referenceLinkMutation)).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: '$.references[0].containingScopeId'
				})
			])
		);
	});

	it('recomputes scope taxonomy, totality, nearest parents, and supported fact containment', () => {
		let functionOnly = withAstNode(fixture('src/index.ts', ' '.repeat(64)), {
			end: 64,
			kind: ts.SyntaxKind.Block,
			kindName: 'Block',
			start: 0
		});
		const functionNode = functionOnly.astNodes.find((node) => node.kind === ts.SyntaxKind.Block)!;
		functionOnly = withScopeForNode(functionOnly, functionNode.id);
		expect(validateSnapshot(functionOnly, {}, contextForSnapshot(functionOnly))).toEqual({
			issues: [],
			state: 'VALID'
		});
		const functionScope = functionOnly.scopes.find(
			(scope) => scope.ownerNodeId === functionNode.id
		)!;
		const replaceScopes = (
			snapshot: StaticSemanticSnapshot,
			scopes: StaticSemanticSnapshot['scopes']
		): StaticSemanticSnapshot => ({
			...snapshot,
			populations: snapshot.populations.map((population) =>
				population.kind === 'SCOPE'
					? semanticPopulation('SCOPE', members(scopes.map((scope) => scope.id)))
					: population
			),
			scopes: [...scopes].sort((left, right) => (left.id < right.id ? -1 : 1))
		});

		const relabeledScope = {
			...functionScope,
			domain: 'MIXED' as const,
			id: semanticScopeId({
				domain: 'MIXED',
				end: functionScope.end,
				kind: functionScope.kind,
				ownerKind: functionScope.ownerKind,
				programId: functionScope.programId,
				sourceId: functionScope.sourceId,
				start: functionScope.start
			})
		};
		const relabeled = replaceScopes(
			functionOnly,
			functionOnly.scopes.map((scope) => (scope.id === functionScope.id ? relabeledScope : scope))
		);
		expect(validateSnapshot(relabeled).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: expect.stringContaining('.kind') })
			])
		);
		const duplicateOwner = replaceScopes(functionOnly, [...functionOnly.scopes, relabeledScope]);
		expect(validateSnapshot(duplicateOwner).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.scopes' })])
		);

		const omitted = replaceScopes(
			functionOnly,
			functionOnly.scopes.filter((scope) => scope.id !== functionScope.id)
		);
		expect(validateSnapshot(omitted).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'POPULATION_MISMATCH', path: '$.scopes' })
			])
		);

		let nested = withAstChild(
			functionOnly,
			functionNode.id,
			{ end: 48, kind: ts.SyntaxKind.Block, kindName: 'Block', start: 8 },
			AST_STRUCTURAL_ROLES.genericChild
		);
		const blockNode = nested.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.Block && node.parentId === functionNode.id
		)!;
		nested = withScopeForNode(nested, blockNode.id);
		expect(validateSnapshot(nested, {}, contextForSnapshot(nested))).toEqual({
			issues: [],
			state: 'VALID'
		});
		const blockScope = nested.scopes.find((scope) => scope.ownerNodeId === blockNode.id)!;
		const sourceScope = nested.scopes.find(
			(scope) => scope.kind === 'SOURCE_SCRIPT' || scope.kind === 'SOURCE_MODULE'
		)!;
		const ancestorSkipping = replaceScopes(
			nested,
			nested.scopes.map((scope) =>
				scope.id === blockScope.id ? { ...scope, parentScopeId: sourceScope.id } : scope
			)
		);
		expect(validateSnapshot(ancestorSkipping).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: expect.stringContaining('.parentScopeId')
				})
			])
		);

		const symbolSnapshot = withSymbolFacts();
		const globalScope = symbolSnapshot.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')!;
		const movedReference = {
			...symbolSnapshot,
			references: symbolSnapshot.references.map((reference) => ({
				...reference,
				containingScopeId: globalScope.id
			}))
		};
		expect(validateSnapshot(movedReference).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: '$.references[0].containingScopeId'
				})
			])
		);
	});

	it('binds deep and context source-root scopes to the persisted module role', () => {
		const deepModule = fixture('src/index.ts', 'export {};\n');
		expect(deepModule.sources[0]).toMatchObject({ moduleKind: 'MODULE' });
		expect(
			deepModule.scopes.find((scope) => scope.sourceId === deepModule.sources[0]!.id)
		).toMatchObject({ domain: 'MIXED', kind: 'SOURCE_MODULE' });
		expect(validateSnapshot(deepModule, {}, contextForSnapshot(deepModule))).toEqual({
			issues: [],
			state: 'VALID'
		});

		const withContextModule = withContextSource(
			deepModule,
			'context/module.d.ts',
			'export interface Context {}\n'
		);
		const contextSource = withContextModule.sources.find(
			(source) => source.logicalPath === 'context/module.d.ts'
		)!;
		expect(contextSource).toMatchObject({
			analysisDisposition: 'CONTEXT_ONLY',
			moduleKind: 'MODULE'
		});
		expect(
			withContextModule.scopes.find((scope) => scope.sourceId === contextSource.id)
		).toMatchObject({ domain: 'MIXED', kind: 'SOURCE_MODULE' });
	});

	it('accepts a closed Slice 3B symbol graph, including an unresolved alias reference that retains its known symbol', () => {
		const snapshot = withSymbolFacts();
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});

		const currentAlias = snapshot.aliases[0]!;
		const aliasPreimage = {
			aliasSymbolId: currentAlias.aliasSymbolId,
			state: 'UNRESOLVED' as const,
			targetSymbolId: null,
			terminalSymbolId: null
		};
		const unresolvedAlias = {
			...currentAlias,
			...aliasPreimage,
			id: semanticAliasId(aliasPreimage)
		};
		const currentReference = snapshot.references[0]!;
		const referencePreimage = {
			nodeId: currentReference.nodeId,
			resolvedSymbolId: null,
			resolutionState: 'UNRESOLVED' as const,
			role: currentReference.role,
			symbolId: currentReference.symbolId
		};
		const unresolvedReference = {
			...currentReference,
			...referencePreimage,
			id: semanticReferenceId(referencePreimage)
		};
		const limitation = {
			capability: 'TS_SYMBOL' as const,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason: 'One alias and reference are explicitly unresolved.',
			region: snapshot.projects[0]!.configPath
		};
		let partial: StaticSemanticSnapshot = {
			...snapshot,
			aliases: [unresolvedAlias],
			capabilities: snapshot.capabilities.map((capability) =>
				capability.capability === 'TS_SYMBOL'
					? { ...capability, state: 'PARTIAL' as const }
					: capability
			),
			health: 'PARTIAL' as const,
			populations: snapshot.populations.map((population) =>
				population.kind === 'ALIAS'
					? semanticPopulation('ALIAS', members([unresolvedAlias.id], [], [], [unresolvedAlias.id]))
					: population.kind === 'REFERENCE'
						? semanticPopulation(
								'REFERENCE',
								members([unresolvedReference.id], [], [], [unresolvedReference.id])
							)
						: population
			),
			references: [unresolvedReference]
		};
		const makePartial = (record: SemanticFactProvenanceRecord): SemanticFactProvenanceRecord => ({
			...record,
			epistemic: {
				...record.epistemic,
				capabilityCoverage: 'partial',
				unresolvedRegions: [limitation.region]
			},
			limitations: [limitation]
		});
		partial = reviseProvenance(partial, partial.aliases[0]!.provenanceId, makePartial);
		partial = reviseProvenance(partial, partial.moduleResolutions[0]!.provenanceId, makePartial);
		partial = reviseProvenance(partial, partial.references[0]!.resolutionProvenanceId, makePartial);
		expect(validateSnapshot(partial, {}, contextForSnapshot(partial))).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(unresolvedReference.symbolId).not.toBeNull();
	});

	it('keeps structural and checker provenance separate and rejects dishonest nullable binding states', () => {
		const snapshot = withSymbolFacts();
		const context = contextForSnapshot(snapshot);
		const declaration = snapshot.declarations[0]!;
		const reference = snapshot.references[0]!;
		const declarationIndex = snapshot.declarations.indexOf(declaration);
		const referenceIndex = snapshot.references.indexOf(reference);
		const mutations: readonly {
			readonly expected: { readonly message: string; readonly path: string };
			readonly snapshot: StaticSemanticSnapshot;
		}[] = [
			{
				expected: {
					message: 'Pure TypeChecker facts require direct compiler-confirmed provenance.',
					path: `$.declarations[${declarationIndex}].bindingProvenanceId`
				},
				snapshot: {
					...snapshot,
					declarations: snapshot.declarations.map((record) =>
						record === declaration
							? { ...record, bindingProvenanceId: record.structuralProvenanceId }
							: record
					)
				}
			},
			{
				expected: {
					message:
						'Scope and binding-placement facts require explicit derived public-AST binding-rule provenance.',
					path: `$.declarations[${declarationIndex}].structuralProvenanceId`
				},
				snapshot: {
					...snapshot,
					declarations: snapshot.declarations.map((record) =>
						record === declaration
							? { ...record, structuralProvenanceId: record.bindingProvenanceId }
							: record
					)
				}
			},
			{
				expected: {
					message: 'Pure TypeChecker facts require direct compiler-confirmed provenance.',
					path: `$.references[${referenceIndex}].resolutionProvenanceId`
				},
				snapshot: {
					...snapshot,
					references: snapshot.references.map((record) =>
						record === reference
							? { ...record, resolutionProvenanceId: record.structuralProvenanceId }
							: record
					)
				}
			},
			{
				expected: {
					message:
						'Scope and binding-placement facts require explicit derived public-AST binding-rule provenance.',
					path: `$.references[${referenceIndex}].structuralProvenanceId`
				},
				snapshot: {
					...snapshot,
					references: snapshot.references.map((record) =>
						record === reference
							? { ...record, structuralProvenanceId: record.resolutionProvenanceId }
							: record
					)
				}
			},
			{
				expected: {
					message:
						'Declaration symbol-binding state must agree exactly with nullable symbol identity.',
					path: `$.declarations[${declarationIndex}].symbolBindingState`
				},
				snapshot: {
					...snapshot,
					declarations: snapshot.declarations.map((record) =>
						record === declaration
							? { ...record, symbolBindingState: 'UNSUPPORTED' as const }
							: record
					)
				}
			},
			{
				expected: {
					message: 'Reference resolution state and symbol identities disagree.',
					path: `$.references[${referenceIndex}].resolutionState`
				},
				snapshot: {
					...snapshot,
					references: snapshot.references.map((record) =>
						record === reference ? { ...record, resolutionState: 'UNSUPPORTED' as const } : record
					)
				}
			}
		];

		for (const mutation of mutations)
			expect(validateSnapshot(mutation.snapshot, {}, context).issues).toContainEqual(
				expect.objectContaining(mutation.expected)
			);
	});

	it('rejects corrupt Slice 3B symbol identities, cross-references, ordering, and uniqueness', () => {
		const snapshot = withSymbolFacts();
		const context = contextForSnapshot(snapshot);
		const forgedDeclarationId =
			`semantic:declaration-${'f'.repeat(64)}` as (typeof snapshot.declarations)[number]['id'];
		expect(
			validateSnapshot(
				{
					...snapshot,
					declarations: [{ ...snapshot.declarations[0]!, id: forgedDeclarationId }],
					populations: snapshot.populations.map((population) =>
						population.kind === 'DECLARATION'
							? semanticPopulation('DECLARATION', members([forgedDeclarationId]))
							: population
					)
				},
				{},
				context
			).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'IDENTITY_MISMATCH',
					path: '$.declarations[0].id'
				})
			])
		);

		const currentExport = snapshot.moduleExports[0]!;
		const missingSymbolId = `semantic:symbol-${'e'.repeat(64)}` as NonNullable<
			typeof currentExport.targetSymbolId
		>;
		const exportPreimage = {
			exportName: currentExport.exportName,
			sourceId: currentExport.sourceId,
			state: currentExport.state,
			symbolId: currentExport.symbolId,
			targetSymbolId: missingSymbolId
		};
		const danglingExport = {
			...currentExport,
			...exportPreimage,
			id: semanticModuleExportId(exportPreimage)
		};
		expect(
			validateSnapshot(
				{
					...snapshot,
					moduleExports: [danglingExport],
					populations: snapshot.populations.map((population) =>
						population.kind === 'MODULE_EXPORT'
							? semanticPopulation('MODULE_EXPORT', members([danglingExport.id]))
							: population
					)
				},
				{},
				context
			).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					path: '$.moduleExports[0].targetSymbolId'
				})
			])
		);

		expect(
			validateSnapshot({ ...snapshot, symbols: [...snapshot.symbols].reverse() }, {}, context)
				.issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'NONCANONICAL_ORDER', path: '$.symbols' })
			])
		);
		expect(
			validateSnapshot(
				{ ...snapshot, aliases: [snapshot.aliases[0]!, snapshot.aliases[0]!] },
				{},
				context
			).issues
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.aliases' })])
		);
	});

	it('enforces content-addressed provenance references and their exact one-level transitive closure', () => {
		const snapshot = fixture();
		for (const record of snapshot.provenances) {
			const { id, ...preimage } = record;
			expect(semanticProvenanceId(preimage)).toBe(id);
		}
		expect(fixture().provenances).toEqual(snapshot.provenances);

		const danglingId = `analysis:provenance-${'f'.repeat(64)}` as SemanticProvenanceId;
		const danglingFact = {
			...snapshot,
			sources: snapshot.sources.map((source) => ({ ...source, syntaxProvenanceId: danglingId }))
		};
		expect(validateSnapshot(danglingFact).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					path: '$.sources[0].syntaxProvenanceId'
				})
			])
		);

		const sourceSyntax = snapshot.provenances.find(
			(record) => record.capability === 'TS_SYNTAX' && record.sourceId !== null
		)!;
		const staleContent = {
			...snapshot,
			provenances: snapshot.provenances.map((record) =>
				record.id === sourceSyntax.id
					? {
							...record,
							epistemic: {
								...record.epistemic,
								rationale: 'Content changed without re-identification.'
							}
						}
					: record
			)
		};
		expect(validateSnapshot(staleContent).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'IDENTITY_MISMATCH',
					path: expect.stringMatching(/^\$\.provenances\[\d+\]\.id$/u)
				})
			])
		);

		const withoutParentRecords = snapshot.provenances.filter(
			(record) => record.id !== sourceSyntax.parentProvenanceId
		);
		const withoutParent = {
			...snapshot,
			populations: snapshot.populations.map((population) =>
				population.kind === 'PROVENANCE'
					? semanticPopulation(
							'PROVENANCE',
							members(withoutParentRecords.map((record) => record.id))
						)
					: population
			),
			provenances: withoutParentRecords
		};
		expect(validateSnapshot(withoutParent).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'CROSS_PROJECT_REFERENCE',
					path: expect.stringMatching(/^\$\.provenances\[\d+\]\.parentProvenanceId$/u)
				})
			])
		);

		const projectSyntax = snapshot.provenances.find(
			(record) => record.capability === 'TS_SYNTAX' && record.sourceId === null
		)!;
		const orphan = reidentifyProvenance({
			...projectSyntax,
			epistemic: {
				...projectSyntax.epistemic,
				rationale: 'Valid but unreferenced provenance is forbidden.'
			}
		});
		const orphanRecords = [...snapshot.provenances, orphan].sort((left, right) =>
			left.id < right.id ? -1 : 1
		);
		const withOrphan = {
			...snapshot,
			populations: snapshot.populations.map((population) =>
				population.kind === 'PROVENANCE'
					? semanticPopulation('PROVENANCE', members(orphanRecords.map((record) => record.id)))
					: population
			),
			provenances: orphanRecords
		};
		expect(validateSnapshot(withOrphan).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: expect.stringContaining('transitive closure'),
					path: '$.provenances'
				})
			])
		);
	});

	it('requires source-scoped syntax provenance and rejects syntax facts that cross sources', () => {
		const snapshot = fixture();
		const source = snapshot.sources[0]!;
		expect(
			validateSnapshot({
				...snapshot,
				sources: [{ ...source, syntaxProvenanceId: null }]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					path: '$.sources[0].syntaxProvenanceId'
				})
			])
		);

		const projectSyntaxProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_SYNTAX' && record.sourceId === null
		)!;
		expect(
			validateSnapshot({
				...snapshot,
				sources: [{ ...source, syntaxProvenanceId: projectSyntaxProvenance.id }]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'CROSS_PROJECT_REFERENCE',
					path: '$.sources[0].syntaxProvenanceId'
				})
			])
		);

		const withContext = withContextSource(snapshot, 'context/other.d.ts');
		const contextSourceIndex = withContext.sources.findIndex(
			(candidate) => candidate.analysisDisposition === 'CONTEXT_ONLY'
		);
		const contextSource = withContext.sources[contextSourceIndex]!;
		expect(
			validateSnapshot({
				...withContext,
				sources: withContext.sources.map((candidate) =>
					candidate.id === contextSource.id
						? { ...candidate, syntaxProvenanceId: source.syntaxProvenanceId }
						: candidate
				)
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: `$.sources[${contextSourceIndex}].syntaxProvenanceId`
				})
			])
		);

		const ast = withAstNode(snapshot, {
			kind: ts.SyntaxKind.StringLiteral,
			kindName: 'StringLiteral'
		});
		const literalNode = ast.astNodes.find((node) => node.kind === ts.SyntaxKind.StringLiteral)!;
		const astWithContext = withContextSource(ast, 'context/other.d.ts');
		const otherSource = astWithContext.sources.find(
			(candidate) => candidate.analysisDisposition === 'CONTEXT_ONLY'
		)!;
		const crossingLiteral = {
			lexemeLength: 0,
			lexemeSha256: literalLexemeDigest(''),
			nodeId: literalNode.id,
			sourceId: otherSource.id,
			value: '',
			valueEncoding: 'JSON_SCALAR' as const,
			valueLength: 0,
			valueSha256: literalValueDigest('JSON_SCALAR', 'STRING', ''),
			valueState: 'EXACT' as const,
			valueType: 'STRING' as const
		};
		const crossingSnapshot: StaticSemanticSnapshot = {
			...astWithContext,
			literals: [crossingLiteral],
			populations: astWithContext.populations.map((population) =>
				population.kind === 'LITERAL'
					? semanticPopulation('LITERAL', members([crossingLiteral.nodeId]))
					: population
			)
		};
		expect(validateSnapshot(crossingSnapshot).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'CROSS_PROJECT_REFERENCE', path: '$.literals[0].nodeId' })
			])
		);
	});

	it('binds the literal operation, traversal profile, and expected-empty decision into the snapshot identity', () => {
		const snapshot = fixture();
		expect(SEMANTIC_SNAPSHOT_SCHEMA_VERSION).toBe('jan-csaa-semantic-snapshot/8.0.0');
		for (const probe of [
			{ ...snapshot, astTraversalProfile: 'typescript-private-traversal/1' },
			{ ...snapshot, operationVersion: 'jan-csaa-build-static-semantic-snapshot/0.9.0' }
		])
			expect(validateSnapshot(probe).issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
			);
		expect(validateSnapshot({ ...snapshot, expectedEmpty: true }).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'IDENTITY_MISMATCH', path: '$.id' })])
		);
	});

	it('detects identity, population, path, unsupported-capability, and validation-budget defects', () => {
		const snapshot = fixture();
		expect(
			validateSnapshot({ ...snapshot, id: `static:ts-snapshot-${'0'.repeat(64)}` }).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'IDENTITY_MISMATCH' })]));
		expect(
			validateSnapshot({
				...snapshot,
				populations: snapshot.populations.map((population) =>
					population.kind === 'AST_NODE' ? { ...population, discovered: 0 } : population
				)
			}).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })]));
		expect(
			validateSnapshot({
				...snapshot,
				sources: snapshot.sources.map((source) => ({ ...source, logicalPath: 'C:\\escape.ts' }))
			}).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ABSOLUTE_PATH' })]));
		expect(
			validateSnapshot({
				...snapshot,
				capabilities: snapshot.capabilities.map((capability) =>
					capability.capability === 'TS_TYPE'
						? { ...capability, state: 'SUPPORTED' as const }
						: capability
				)
			}).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CONFORMANCE_OVERCLAIM' })]));
		expect(validateSnapshot(snapshot, { maxRecords: 1 })).toMatchObject({
			state: 'BUDGET_EXHAUSTED'
		});
	});

	it('never throws for missing, null, wrong-type, wrong-enum, or unknown nested wire members', () => {
		const snapshot = fixture();
		const probes: unknown[] = [
			{
				schemaVersion: SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
				assignments: [],
				astNodes: [],
				capabilities: [],
				compilerInputs: [],
				declarationCandidates: [],
				diagnostics: [],
				invocations: [],
				limitations: [],
				literals: [],
				populations: [],
				programs: [],
				projects: [],
				provenances: [],
				requestedCapabilities: [],
				sources: []
			},
			{ ...snapshot, provider: null },
			{ ...snapshot, projects: [null] },
			{ ...snapshot, calls: [] },
			{ ...snapshot, expectedEmpty: 'yes' },
			{ ...snapshot, health: 'BANANA' },
			{
				...snapshot,
				sources: snapshot.sources.map((source) => ({
					...source,
					unexpected: { absolutePath: 'C:\\escape.ts' }
				}))
			},
			{
				...snapshot,
				sources: snapshot.sources.map((source) => ({ ...source, origin: 'INVENTED' }))
			}
		];
		for (const probe of probes) {
			expect(() => validateSnapshot(probe)).not.toThrow();
			expect(validateSnapshot(probe).state).toBe('INVALID');
		}
	});

	it('bounds deep/open compiler-option input before canonicalization and counts diagnostic input', () => {
		const snapshot = fixture();
		let nested: unknown = 'leaf';
		for (let depth = 0; depth < 32; depth += 1) nested = { nested };
		const deep = {
			...snapshot,
			projects: snapshot.projects.map((project) => ({
				...project,
				programRecipe: { ...project.programRecipe, compilerOptions: { nested } }
			}))
		};
		expect(validateSnapshot(deep, { maxDepth: 8 })).toMatchObject({ state: 'BUDGET_EXHAUSTED' });
		expect(
			validateSnapshot({ ...snapshot, diagnostics: [null, null] }, { maxDiagnostics: 1 })
		).toMatchObject({ state: 'BUDGET_EXHAUSTED' });
	});

	it('independently rechecks recipes, context closure, population witnesses, families, and health', () => {
		const snapshot = fixture();
		const mutatedRecipe = {
			...snapshot,
			projects: snapshot.projects.map((project) => ({
				...project,
				programRecipe: {
					...project.programRecipe,
					compilerOptions: { ...project.programRecipe.compilerOptions, strict: false }
				}
			}))
		};
		expect(validateSnapshot(mutatedRecipe).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'IDENTITY_MISMATCH' })])
		);
		expect(validateSnapshot({ ...snapshot, contextDigest: '0'.repeat(64) }).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'IDENTITY_MISMATCH' })])
		);
		const forgedPopulation = {
			...snapshot,
			populations: snapshot.populations.map((population) =>
				population.kind === 'AST_NODE'
					? { ...population, members: { ...population.members, analyzed: [] } }
					: population
			)
		};
		expect(validateSnapshot(forgedPopulation).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })])
		);
		const missingFamily = {
			...snapshot,
			programs: snapshot.programs.map((program) => ({
				...program,
				diagnosticFamilies: program.diagnosticFamilies.slice(1)
			}))
		};
		expect(validateSnapshot(missingFamily).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);
		expect(validateSnapshot({ ...snapshot, health: 'PARTIAL' }).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);
	});

	it('rejects duplicate vocabularies, unsupported requests, context ASTs, unsafe numbers, and unregistered path options', () => {
		const snapshot = fixture();
		expect(
			validateSnapshot({
				...snapshot,
				capabilities: [...snapshot.capabilities, snapshot.capabilities[0]]
			}).state
		).toBe('INVALID');
		expect(
			validateSnapshot({
				...snapshot,
				populations: [...snapshot.populations, snapshot.populations[0]]
			}).state
		).toBe('INVALID');
		expect(
			validateSnapshot({
				...snapshot,
				requestedCapabilities: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']
			}).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CONFORMANCE_OVERCLAIM' })]));
		const contextAst = {
			...snapshot,
			sources: snapshot.sources.map((source) => ({
				...source,
				analysisDisposition: 'CONTEXT_ONLY',
				artifactClass: 'CONTEXT_ONLY'
			}))
		};
		expect(validateSnapshot(contextAst).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);
		expect(
			validateSnapshot({
				...snapshot,
				sources: snapshot.sources.map((source) => ({
					...source,
					bytes: Number.MAX_SAFE_INTEGER + 1
				}))
			}).state
		).toBe('INVALID');
		const compilerOptions = (value: unknown) => ({
			...snapshot,
			projects: snapshot.projects.map((project) => ({
				...project,
				programRecipe: {
					...project.programRecipe,
					compilerOptions: value as Readonly<Record<string, unknown>>
				}
			}))
		});
		expect(validateSnapshot(compilerOptions({ rootDir: 'C:\\escape' })).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);
		expect(validateSnapshot(compilerOptions({ mysteryPath: 'relative' })).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);
	});

	it('derives syntax projection closure and root reachability from the retained AST', () => {
		const snapshot = fixture();
		for (const mutated of [
			withAstNode(snapshot, { kind: ts.SyntaxKind.CallExpression, kindName: 'CallExpression' }),
			withAstNode(snapshot, {
				kind: ts.SyntaxKind.VariableDeclaration,
				kindName: 'VariableDeclaration'
			}),
			withAstNode(snapshot, { kind: ts.SyntaxKind.StringLiteral, kindName: 'StringLiteral' }),
			withAstNode(snapshot, {
				kind: ts.SyntaxKind.BinaryExpression,
				kindName: 'BinaryExpression',
				operatorKind: ts.SyntaxKind.EqualsToken,
				operatorName: 'EqualsToken'
			})
		]) {
			expect(validateSnapshot(mutated).issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'POPULATION_MISMATCH' })])
			);
		}
		expect(
			validateSnapshot(
				withAstNode(snapshot, { kind: ts.SyntaxKind.SourceFile, kindName: 'SourceFile' }, true)
			).issues
			// This mutation adds a SECOND parentId===null root, which trips TWO DANGLING_REFERENCE
			// emitters. Matching the code alone therefore stays green when either one stops firing.
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Every AST node must reach its declared source root.'
				})
			])
		);
	});

	it('requires one contiguous absolute child ordinal independent of structural role', () => {
		const parentSnapshot = withAstNode(fixture(), {
			kind: ts.SyntaxKind.CallExpression,
			kindName: 'CallExpression'
		});
		const parent = parentSnapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.CallExpression
		)!;
		const withCallee = withAstChild(
			parentSnapshot,
			parent.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationCallee,
			0
		);
		const duplicateOrdinal = withAstChild(
			withCallee,
			parent.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationArgument,
			0
		);
		expect(validateSnapshot(duplicateOrdinal).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DUPLICATE_ID',
					message: expect.stringContaining('Absolute sibling ordinal')
				})
			])
		);
		const gapOrdinal = withAstChild(
			withCallee,
			parent.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationArgument,
			2
		);
		expect(validateSnapshot(gapOrdinal).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('named AST traversal profile')
				})
			])
		);
	});

	it('rejects honest-degradation, applicability, path, recipe, and validator-option escape hatches', () => {
		const snapshot = fixture();
		const unknownFreshness = reviseProvenance(
			snapshot,
			snapshot.projects[0]!.provenanceId,
			(record) => ({
				...record,
				epistemic: { ...record.epistemic, freshness: 'unknown' }
			})
		);
		expect(validateSnapshot(unknownFreshness).state).toBe('INVALID');
		const notApplicable = {
			...snapshot,
			programs: snapshot.programs.map((program) => ({
				...program,
				diagnosticFamilies: program.diagnosticFamilies.map((family) => ({
					...family,
					reason: '',
					state: 'NOT_APPLICABLE'
				}))
			}))
		};
		expect(validateSnapshot(notApplicable).state).toBe('INVALID');
		const incomplete = {
			...snapshot,
			projects: snapshot.projects.map((project) => ({ ...project, rootDisposition: 'INCOMPLETE' }))
		};
		expect(validateSnapshot(incomplete).state).toBe('INVALID');
		expect(
			validateSnapshot({
				...snapshot,
				capabilities: snapshot.capabilities.map((capability) =>
					capability.capability === 'TS_PROJECT'
						? { ...capability, reason: 'compiler at C:\\secret\\typescript.js' }
						: capability
				)
			})
		).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({
				...snapshot,
				projects: snapshot.projects.map((project) => ({
					...project,
					frameworkCandidates: ['../escape.svelte']
				}))
			}).state
		).toBe('INVALID');
		expect(
			validateSnapshot({
				...snapshot,
				projects: snapshot.projects.map((project) => ({
					...project,
					programRecipe: { ...project.programRecipe, configClosureDigest: 'not-a-digest' }
				}))
			}).state
		).toBe('INVALID');
		expect(validateSnapshot(snapshot, { maxIssues: 0 })).toMatchObject({ state: 'INVALID' });
		expect(validateSnapshot(snapshot, { maxDepth: Number.NaN })).toMatchObject({
			state: 'INVALID'
		});
	});

	it('closes every compiler-input operation and result discriminator combination', () => {
		const snapshot = fixture();
		const base = {
			id: `analysis:context-input-${'3'.repeat(64)}`,
			invocationCount: 1,
			logicalPath: 'src/index.ts',
			origin: 'AUTHORED',
			resultDigest: '4'.repeat(64)
		};
		const malformed: readonly unknown[] = [
			{ ...base, operation: 'READ_FILE', result: 'PRESENT' },
			{
				...base,
				contentBytes: 0,
				contentSha256: CONTENT_DIGEST,
				operation: 'READ_FILE',
				result: 'ABSENT'
			},
			{ ...base, operation: 'FILE_EXISTS', result: 'DIRECTORY' },
			{ ...base, operation: 'READ_DIRECTORY', result: 'DIRECTORY', resultEntries: [] }
		];
		for (const observation of malformed) {
			const result = validateSnapshot({ ...snapshot, compilerInputs: [observation] });
			expect(result.state).toBe('INVALID');
			expect(result.issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })])
			);
		}
	});

	it('represents a negative REALPATH observation without fabricating an identity mapping', () => {
		const snapshot = fixture();
		const absent = realpathObservation('missing/module.ts', 'ABSENT');
		const acceptedShape = validateSnapshot({ ...snapshot, compilerInputs: [absent] });
		expect(acceptedShape.issues).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_SHAPE', path: '$.compilerInputs[0]' })
			])
		);
		const fabricated = { ...absent, resolvedLogicalPath: absent.logicalPath };
		expect(validateSnapshot({ ...snapshot, compilerInputs: [fabricated] }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_SHAPE',
					path: '$.compilerInputs[0].resolvedLogicalPath'
				})
			])
		);
		const contradictory = [absent, readFileObservation(absent.logicalPath, 'PRESENT')].sort(
			(left, right) => (left.id < right.id ? -1 : 1)
		);
		expect(validateSnapshot({ ...snapshot, compilerInputs: contradictory }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('path kind')
				})
			])
		);
		const redactedDirectoryRealpath = [
			realpathObservation('node_modules/example', 'ABSENT'),
			directoryObservation('node_modules/example', 'DIRECTORY_EXISTS', 'DIRECTORY')
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		expect(
			validateSnapshot({ ...snapshot, compilerInputs: redactedDirectoryRealpath }).issues
		).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('path kind')
				})
			])
		);
	});

	it('reconciles exact and digest-only literal states against type, length, digest, and budget', () => {
		const astSnapshot = withAstNode(fixture(), {
			kind: ts.SyntaxKind.StringLiteral,
			kindName: 'StringLiteral'
		});
		const literalNode = astSnapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.StringLiteral
		)!;
		const literal = {
			lexemeLength: 0,
			lexemeSha256: literalLexemeDigest(''),
			nodeId: literalNode.id,
			sourceId: literalNode.sourceId,
			value: '',
			valueEncoding: 'JSON_SCALAR' as const,
			valueLength: 0,
			valueSha256: literalValueDigest('JSON_SCALAR', 'STRING', ''),
			valueState: 'EXACT' as const,
			valueType: 'STRING' as const
		};
		const snapshot: StaticSemanticSnapshot = {
			...astSnapshot,
			literals: [literal],
			populations: astSnapshot.populations.map((population) =>
				population.kind === 'LITERAL'
					? semanticPopulation('LITERAL', members([literalNode.id]))
					: population
			)
		};
		expect(validateSnapshot(snapshot)).toEqual({ issues: [], state: 'VALID' });
		for (const malformed of [
			{ ...literal, lexemeLength: 1 },
			{ ...literal, lexemeSha256: 'not-a-digest' },
			{ ...literal, valueLength: 1 },
			{ ...literal, valueSha256: '5'.repeat(64) },
			{ ...literal, value: null, valueType: 'STRING' },
			{
				...literal,
				value: 'Infinity',
				valueEncoding: 'JSON_SCALAR',
				valueLength: 8,
				valueSha256: literalValueDigest('JSON_SCALAR', 'NUMBER', 'Infinity'),
				valueType: 'NUMBER'
			},
			{
				...literal,
				value: null,
				valueState: 'DIGEST_ONLY',
				valueLength: snapshot.budgets.maxLiteralCharacters
			}
		]) {
			expect(validateSnapshot({ ...snapshot, literals: [malformed] }).issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
			);
		}
	});

	it('enforces every observable extraction budget including actual AST depth', () => {
		const astCount = withAstNode(fixture(), {
			kind: ts.SyntaxKind.Identifier,
			kindName: 'Identifier'
		});
		const parent = astCount.astNodes.find((node) => node.kind === ts.SyntaxKind.Identifier)!;
		const astDepth = withAstChild(astCount, parent.id, {
			kind: ts.SyntaxKind.EndOfFileToken,
			kindName: 'EndOfFileToken'
		});
		const sourceCount = withContextSource(fixture(), 'node_modules/example/index.d.ts');
		const diagnosticCount = withSourceDiagnostics(fixture(), ['1000', '1001'], true);
		const contextFiles = [
			readFileObservation('context/a.d.ts', 'PRESENT'),
			readFileObservation('context/b.d.ts', 'PRESENT')
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		const contextBytes = [readFileObservation('context/large.d.ts', 'PRESENT', 'xx')];
		const compilerQueries = [
			readFileObservation('context/a.d.ts', 'ABSENT'),
			readFileObservation('context/b.d.ts', 'ABSENT')
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		const compilerQueryInvocations = [
			readFileObservation('context/repeated.d.ts', 'ABSENT', '', 'LIVE_COMPILER_CONTEXT', 2)
		];
		const directoryEntries = [
			directoryObservation('context', 'GET_DIRECTORIES', 'DIRECTORY', ['context/a', 'context/b'])
		];
		const projectCount = {
			...fixture(),
			projects: [fixture().projects[0]!, fixture().projects[0]!]
		};
		const probes: readonly [unknown, string][] = [
			[{ ...astCount, budgets: { ...astCount.budgets, maxAstNodes: 1 } }, '$.budgets.maxAstNodes'],
			[{ ...astDepth, budgets: { ...astDepth.budgets, maxAstDepth: 1 } }, '$.budgets.maxAstDepth'],
			[
				{ ...sourceCount, budgets: { ...sourceCount.budgets, maxSources: 1 } },
				'$.budgets.maxSources'
			],
			[
				{ ...diagnosticCount, budgets: { ...diagnosticCount.budgets, maxDiagnostics: 1 } },
				'$.budgets.maxDiagnostics'
			],
			[
				{ ...diagnosticCount, budgets: { ...diagnosticCount.budgets, maxDiagnosticCharacters: 1 } },
				'$.budgets.maxDiagnosticCharacters'
			],
			[
				{ ...fixture(), budgets: { ...fixture().budgets, maxSnapshotBytes: 1 } },
				'$.budgets.maxSnapshotBytes'
			],
			[
				{
					...fixture(),
					compilerInputs: contextFiles,
					budgets: { ...fixture().budgets, maxContextFiles: 1 }
				},
				'$.budgets.maxContextFiles'
			],
			[
				{
					...fixture(),
					compilerInputs: contextBytes,
					budgets: { ...fixture().budgets, maxContextBytes: 1 }
				},
				'$.budgets.maxContextBytes'
			],
			[
				{
					...fixture(),
					compilerInputs: contextBytes,
					budgets: { ...fixture().budgets, maxContextFileBytes: 1 }
				},
				'$.compilerInputs[0].contentBytes'
			],
			[
				{
					...fixture(),
					compilerInputs: compilerQueries,
					budgets: { ...fixture().budgets, maxCompilerQueries: 1 }
				},
				'$.budgets.maxCompilerQueries'
			],
			[
				{
					...fixture(),
					compilerInputs: compilerQueryInvocations,
					budgets: { ...fixture().budgets, maxCompilerQueryInvocations: 1 }
				},
				'$.budgets.maxCompilerQueryInvocations'
			],
			[
				{
					...fixture(),
					compilerInputs: directoryEntries,
					budgets: { ...fixture().budgets, maxDirectoryEntries: 1 }
				},
				'$.budgets.maxDirectoryEntries'
			],
			[
				{
					...fixture(),
					compilerInputs: [readFileObservation('context/a.d.ts', 'ABSENT')],
					budgets: { ...fixture().budgets, maxCompilerInputMetadataBytes: 1 }
				},
				'$.budgets.maxCompilerInputMetadataBytes'
			],
			[
				{
					...fixture(),
					budgets: { ...fixture().budgets, maxPathCharacters: 5 },
					sources: fixture().sources.map((source) => ({
						...source,
						logicalPath: 'src/long-name.ts'
					}))
				},
				'$.sources[0].logicalPath'
			],
			[
				{ ...projectCount, budgets: { ...projectCount.budgets, maxProjects: 1 } },
				'$.budgets.maxProjects'
			]
		];
		for (const [probe, path] of probes)
			expect(validateSnapshot(probe).issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE', path })])
			);
	});

	it('charges live compiler context but not already-frozen subject bytes to context budgets', () => {
		const snapshot = fixture();
		const frozen = readFileObservation(
			'src/shared.ts',
			'PRESENT',
			'x'.repeat(100),
			'FROZEN_SUBJECT'
		);
		const live = readFileObservation(
			'src/shared.ts',
			'PRESENT',
			'x'.repeat(100),
			'LIVE_COMPILER_CONTEXT'
		);
		expect(frozen.id).not.toBe(live.id);
		const budgets = { ...snapshot.budgets, maxContextBytes: 1, maxContextFileBytes: 1 };
		const frozenResult = validateSnapshot({ ...snapshot, budgets, compilerInputs: [frozen] });
		expect(frozenResult.issues).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.budgets.maxContextBytes' })])
		);
		expect(frozenResult.issues).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: '$.compilerInputs[0].contentBytes' })
			])
		);
		const liveResult = validateSnapshot({ ...snapshot, budgets, compilerInputs: [live] });
		expect(liveResult.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.budgets.maxContextBytes' }),
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.compilerInputs[0].contentBytes' })
			])
		);
	});

	it('binds compiler-query multiplicity and records the full scanned directory effort', () => {
		const snapshot = fixture();
		const once = readFileObservation('context/repeated.d.ts', 'ABSENT');
		const twice = readFileObservation(
			'context/repeated.d.ts',
			'ABSENT',
			'',
			'LIVE_COMPILER_CONTEXT',
			2
		);
		expect(twice.id).not.toBe(once.id);
		expect(twice.resultDigest).not.toBe(once.resultDigest);
		const retainedMultiplicity = validateSnapshot({ ...snapshot, compilerInputs: [twice] });
		expect(retainedMultiplicity.issues).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ message: expect.stringContaining('exactly one deterministic') })
			])
		);
		expect(
			validateSnapshot({ ...snapshot, compilerInputs: [{ ...once, invocationCount: 2 }] }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'IDENTITY_MISMATCH',
					path: '$.compilerInputs[0].resultDigest'
				}),
				expect.objectContaining({ code: 'IDENTITY_MISMATCH', path: '$.compilerInputs[0].id' })
			])
		);
		expect(
			validateSnapshot({ ...snapshot, compilerInputs: [{ ...once, invocationCount: 0 }] }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: '$.compilerInputs[0].invocationCount'
				})
			])
		);

		const underreported = directoryObservation(
			'context/underreported',
			'READ_DIRECTORY',
			'DIRECTORY',
			['context/a.ts', 'context/b.ts'],
			1
		);
		expect(validateSnapshot({ ...snapshot, compilerInputs: [underreported] }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: '$.compilerInputs[0].scannedEntries'
				})
			])
		);
		const missing = directoryObservation(
			'context/missing',
			'GET_DIRECTORIES',
			'NOT_DIRECTORY',
			[],
			1
		);
		expect(validateSnapshot({ ...snapshot, compilerInputs: [missing] }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: '$.compilerInputs[0].scannedEntries'
				})
			])
		);
		const malformed = {
			...directoryObservation('context/malformed', 'GET_DIRECTORIES', 'DIRECTORY'),
			scannedEntries: -1
		};
		expect(validateSnapshot({ ...snapshot, compilerInputs: [malformed] })).toMatchObject({
			state: 'INVALID',
			issues: [
				expect.objectContaining({
					code: 'INVALID_SHAPE',
					path: '$.compilerInputs[0].scannedEntries'
				})
			]
		});

		const aggregate = [
			directoryObservation('context/one', 'GET_DIRECTORIES', 'DIRECTORY', ['context/one/a'], 2),
			directoryObservation('context/two', 'GET_DIRECTORIES', 'DIRECTORY', ['context/two/a'], 2)
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		expect(
			validateSnapshot({
				...snapshot,
				budgets: { ...snapshot.budgets, maxDirectoryEntries: 3 },
				compilerInputs: aggregate
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.budgets.maxDirectoryEntries' })
			])
		);
	});

	it('derives TypeScript names and declaration-candidate identity from retained public enum codes', () => {
		const snapshot = fixture();
		expect(
			validateSnapshot({
				...snapshot,
				astNodes: snapshot.astNodes.map((node) => ({ ...node, kindName: 'BogusNode' }))
			}).issues
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.astNodes[0].kindName' })])
		);
		expect(
			validateSnapshot({
				...snapshot,
				sources: snapshot.sources.map((source) => ({ ...source, scriptKindName: 'JS' }))
			}).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })]));
		const declarationParentAst = withAstNode(snapshot, {
			kind: ts.SyntaxKind.VariableDeclaration,
			kindName: 'VariableDeclaration'
		});
		const declarationParent = declarationParentAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclaration
		)!;
		const declarationAst = withAstChild(
			declarationParentAst,
			declarationParent.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.declarationName
		);
		const declarationNode = declarationAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclaration
		)!;
		const nameNode = declarationAst.astNodes.find((node) => node.parentId === declarationNode.id)!;
		const declarationCandidate = {
			ambientSyntax: false,
			candidateRole: 'BINDING' as const,
			candidateState: 'SYNTAX_ONLY' as const,
			exportCarrierNodeId: null,
			exportSyntax: 'NONE' as const,
			id: semanticDeclarationCandidateId({
				candidateRole: 'BINDING',
				nodeId: declarationNode.id,
				syntaxKind: declarationNode.kind
			}),
			localModifiers: [],
			nameNodeId: nameNode.id,
			nameState: 'ATOMIC' as const,
			nodeId: declarationNode.id,
			sourceId: declarationNode.sourceId,
			syntacticName: 'value',
			syntaxKind: declarationNode.kind,
			syntaxKindName: declarationNode.kindName
		};
		const declarationSnapshot: StaticSemanticSnapshot = {
			...declarationAst,
			declarationCandidates: [declarationCandidate],
			populations: declarationAst.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation('DECLARATION_CANDIDATE', members([declarationCandidate.id]))
					: population
			)
		};
		expect(validateSnapshot(declarationSnapshot)).toEqual({ issues: [], state: 'VALID' });
		const wrongKind = ts.SyntaxKind.FunctionDeclaration;
		expect(
			validateSnapshot({
				...declarationSnapshot,
				declarationCandidates: [
					{
						...declarationCandidate,
						id: semanticDeclarationCandidateId({
							candidateRole: declarationCandidate.candidateRole,
							nodeId: declarationCandidate.nodeId,
							syntaxKind: wrongKind
						}),
						syntaxKind: wrongKind,
						syntaxKindName: 'FunctionDeclaration'
					}
				]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.declarationCandidates[0]' })
			])
		);
	});

	it('rejects unsafe, negative, unknown, or non-public AST numeric values', () => {
		const snapshot = fixture();
		for (const probe of [
			{ ...snapshot, astNodes: snapshot.astNodes.map((node) => ({ ...node, kind: -1 })) },
			{ ...snapshot, astNodes: snapshot.astNodes.map((node) => ({ ...node, operatorKind: -1 })) },
			{
				...snapshot,
				astNodes: snapshot.astNodes.map((node) => ({
					...node,
					siblingOrdinal: Number.MAX_SAFE_INTEGER + 1
				}))
			}
		])
			expect(validateSnapshot(probe).state).toBe('INVALID');
		expect(
			validateSnapshot({
				...snapshot,
				astNodes: snapshot.astNodes.map((node) => ({
					...node,
					kind: 999_999,
					kindName: 'InventedKind'
				}))
			}).issues
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.astNodes[0].kindName' })])
		);
		expect(
			validateSnapshot({
				...snapshot,
				astNodes: snapshot.astNodes.map((node) => ({ ...node, publicFlags: 4_194_304 }))
			}).issues
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.astNodes[0].publicFlags' })])
		);
	});

	it('allows one const binding child to carry declaration-name and assignment-target roles', () => {
		const declarationAst = withAstNode(fixture(), {
			hasAssignmentInitializer: true,
			kind: ts.SyntaxKind.VariableDeclaration,
			kindName: 'VariableDeclaration'
		});
		const declarationNode = declarationAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclaration
		)!;
		const withName = withAstChild(
			declarationAst,
			declarationNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			[AST_STRUCTURAL_ROLES.assignmentTarget, AST_STRUCTURAL_ROLES.declarationName],
			0
		);
		const completeAst = withAstChild(
			withName,
			declarationNode.id,
			{ kind: ts.SyntaxKind.NumericLiteral, kindName: 'NumericLiteral' },
			AST_STRUCTURAL_ROLES.assignmentValue,
			1
		);
		const nameNode = completeAst.astNodes.find(
			(node) =>
				node.parentId === declarationNode.id &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName)
		)!;
		const valueNode = completeAst.astNodes.find(
			(node) =>
				node.parentId === declarationNode.id &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue)
		)!;
		const candidate = {
			ambientSyntax: false,
			candidateRole: 'BINDING' as const,
			candidateState: 'SYNTAX_ONLY' as const,
			exportCarrierNodeId: null,
			exportSyntax: 'NONE' as const,
			id: semanticDeclarationCandidateId({
				candidateRole: 'BINDING',
				nodeId: declarationNode.id,
				syntaxKind: declarationNode.kind
			}),
			localModifiers: [],
			nameNodeId: nameNode.id,
			nameState: 'ATOMIC' as const,
			nodeId: declarationNode.id,
			sourceId: declarationNode.sourceId,
			syntacticName: 'value',
			syntaxKind: declarationNode.kind,
			syntaxKindName: declarationNode.kindName
		};
		const literal = {
			lexemeLength: 0,
			lexemeSha256: literalLexemeDigest(''),
			nodeId: valueNode.id,
			sourceId: valueNode.sourceId,
			value: '1',
			valueEncoding: 'TYPESCRIPT_TEXT' as const,
			valueLength: 1,
			valueSha256: literalValueDigest('TYPESCRIPT_TEXT', 'NUMBER', '1'),
			valueState: 'EXACT' as const,
			valueType: 'NUMBER' as const
		};
		const assignment = {
			assignmentKind: 'INITIALIZER' as const,
			nodeId: declarationNode.id,
			operatorKind: ts.SyntaxKind.EqualsToken,
			operatorName: 'EqualsToken',
			sourceId: declarationNode.sourceId,
			targetNodeId: nameNode.id,
			valueNodeId: valueNode.id
		};
		const snapshot: StaticSemanticSnapshot = {
			...completeAst,
			assignments: [assignment],
			declarationCandidates: [candidate],
			literals: [literal],
			populations: completeAst.populations.map((population) =>
				population.kind === 'ASSIGNMENT'
					? semanticPopulation('ASSIGNMENT', members([assignment.nodeId]))
					: population.kind === 'DECLARATION_CANDIDATE'
						? semanticPopulation('DECLARATION_CANDIDATE', members([candidate.id]))
						: population.kind === 'LITERAL'
							? semanticPopulation('LITERAL', members([literal.nodeId]))
							: population
			)
		};
		expect(nameNode.structuralRoles).toEqual([
			AST_STRUCTURAL_ROLES.assignmentTarget,
			AST_STRUCTURAL_ROLES.declarationName,
			AST_STRUCTURAL_ROLES.genericChild
		]);
		expect(validateSnapshot(snapshot)).toEqual({ issues: [], state: 'VALID' });
		for (const structuralRoles of [
			[AST_STRUCTURAL_ROLES.declarationName, AST_STRUCTURAL_ROLES.assignmentTarget],
			[
				AST_STRUCTURAL_ROLES.assignmentTarget,
				AST_STRUCTURAL_ROLES.assignmentTarget,
				AST_STRUCTURAL_ROLES.declarationName
			],
			[]
		]) {
			const malformed = {
				...snapshot,
				astNodes: snapshot.astNodes.map((node) =>
					node.id === nameNode.id ? { ...node, structuralRoles } : node
				)
			};
			expect(validateSnapshot(malformed).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: 'NONCANONICAL_ORDER',
						path: expect.stringContaining('structuralRoles')
					})
				])
			);
		}
	});

	it('binds export syntax to the exact local or enclosing declaration carrier', () => {
		function exportedVariableAst(
			nameKind: number,
			nameKindName: string
		): {
			readonly ast: StaticSemanticSnapshot;
			readonly declaration: StaticSemanticSnapshot['astNodes'][number];
			readonly name: StaticSemanticSnapshot['astNodes'][number];
			readonly statement: StaticSemanticSnapshot['astNodes'][number];
		} {
			const statementAst = withAstNode(fixture(), {
				kind: ts.SyntaxKind.VariableStatement,
				kindName: 'VariableStatement'
			});
			const statement = statementAst.astNodes.find(
				(node) => node.kind === ts.SyntaxKind.VariableStatement
			)!;
			const withExport = withAstChild(
				statementAst,
				statement.id,
				{ kind: ts.SyntaxKind.ExportKeyword, kindName: 'ExportKeyword' },
				AST_STRUCTURAL_ROLES.genericChild,
				0
			);
			const withList = withAstChild(
				withExport,
				statement.id,
				{ kind: ts.SyntaxKind.VariableDeclarationList, kindName: 'VariableDeclarationList' },
				AST_STRUCTURAL_ROLES.genericChild,
				1
			);
			const list = withList.astNodes.find(
				(node) => node.kind === ts.SyntaxKind.VariableDeclarationList
			)!;
			const withDeclaration = withAstChild(
				withList,
				list.id,
				{ kind: ts.SyntaxKind.VariableDeclaration, kindName: 'VariableDeclaration' },
				AST_STRUCTURAL_ROLES.genericChild,
				0
			);
			const declaration = withDeclaration.astNodes.find(
				(node) => node.kind === ts.SyntaxKind.VariableDeclaration
			)!;
			const ast = withAstChild(
				withDeclaration,
				declaration.id,
				{ kind: nameKind, kindName: nameKindName },
				AST_STRUCTURAL_ROLES.declarationName,
				0
			);
			return {
				ast,
				declaration,
				name: ast.astNodes.find((node) => node.parentId === declaration.id)!,
				statement
			};
		}

		function candidate(
			node: StaticSemanticSnapshot['astNodes'][number],
			nameNode: StaticSemanticSnapshot['astNodes'][number],
			candidateRole: 'BINDING' | 'MEMBER',
			nameState: 'ATOMIC' | 'PATTERN',
			syntacticName: string | null,
			exportCarrierNodeId: StaticSemanticSnapshot['astNodes'][number]['id'] | null,
			exportSyntax: 'EXPLICIT' | 'NONE'
		): StaticSemanticSnapshot['declarationCandidates'][number] {
			return {
				ambientSyntax: false,
				candidateRole,
				candidateState: 'SYNTAX_ONLY',
				exportCarrierNodeId,
				exportSyntax,
				id: semanticDeclarationCandidateId({
					candidateRole,
					nodeId: node.id,
					syntaxKind: node.kind
				}),
				localModifiers: [],
				nameNodeId: nameNode.id,
				nameState,
				nodeId: node.id,
				sourceId: node.sourceId,
				syntacticName,
				syntaxKind: node.kind,
				syntaxKindName: node.kindName
			};
		}

		const scalar = exportedVariableAst(ts.SyntaxKind.Identifier, 'Identifier');
		const scalarCandidate = candidate(
			scalar.declaration,
			scalar.name,
			'BINDING',
			'ATOMIC',
			'value',
			scalar.statement.id,
			'EXPLICIT'
		);
		const scalarSnapshot: StaticSemanticSnapshot = {
			...scalar.ast,
			declarationCandidates: [scalarCandidate],
			populations: scalar.ast.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation('DECLARATION_CANDIDATE', members([scalarCandidate.id]))
					: population
			)
		};
		expect(validateSnapshot(scalarSnapshot)).toEqual({ issues: [], state: 'VALID' });

		const destructured = exportedVariableAst(
			ts.SyntaxKind.ObjectBindingPattern,
			'ObjectBindingPattern'
		);
		const withBinding = withAstChild(
			destructured.ast,
			destructured.name.id,
			{ kind: ts.SyntaxKind.BindingElement, kindName: 'BindingElement' },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const binding = withBinding.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.BindingElement
		)!;
		const destructuredAst = withAstChild(
			withBinding,
			binding.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.declarationName,
			0
		);
		const bindingName = destructuredAst.astNodes.find((node) => node.parentId === binding.id)!;
		const destructuredCandidates = [
			candidate(
				destructured.declaration,
				destructured.name,
				'BINDING',
				'PATTERN',
				null,
				destructured.statement.id,
				'EXPLICIT'
			),
			candidate(
				binding,
				bindingName,
				'BINDING',
				'ATOMIC',
				'value',
				destructured.statement.id,
				'EXPLICIT'
			)
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		const destructuredSnapshot: StaticSemanticSnapshot = {
			...destructuredAst,
			declarationCandidates: destructuredCandidates,
			populations: destructuredAst.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation(
							'DECLARATION_CANDIDATE',
							members(destructuredCandidates.map((record) => record.id))
						)
					: population
			)
		};
		expect(validateSnapshot(destructuredSnapshot)).toEqual({ issues: [], state: 'VALID' });

		const withObject = withAstChild(
			scalarSnapshot,
			scalar.declaration.id,
			{ kind: ts.SyntaxKind.ObjectLiteralExpression, kindName: 'ObjectLiteralExpression' },
			AST_STRUCTURAL_ROLES.genericChild,
			1
		);
		const objectNode = withObject.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.ObjectLiteralExpression
		)!;
		const withProperty = withAstChild(
			withObject,
			objectNode.id,
			{ kind: ts.SyntaxKind.PropertyAssignment, kindName: 'PropertyAssignment' },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const property = withProperty.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.PropertyAssignment
		)!;
		const nestedAst = withAstChild(
			withProperty,
			property.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.declarationName,
			0
		);
		const propertyName = nestedAst.astNodes.find((node) => node.parentId === property.id)!;
		const scopedNestedAst = withScopeForNode(nestedAst, objectNode.id);
		const nestedCandidates = [
			scalarCandidate,
			candidate(property, propertyName, 'MEMBER', 'ATOMIC', 'value', null, 'NONE')
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		const nestedSnapshot: StaticSemanticSnapshot = {
			...scopedNestedAst,
			declarationCandidates: nestedCandidates,
			populations: scopedNestedAst.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation(
							'DECLARATION_CANDIDATE',
							members(nestedCandidates.map((record) => record.id))
						)
					: population
			)
		};
		expect(validateSnapshot(nestedSnapshot)).toEqual({ issues: [], state: 'VALID' });
	});

	it('derives ambient syntax exactly for declaration files, declare carriers, and ordinary sources', () => {
		function ordinaryVariable(ambientSyntax: boolean): StaticSemanticSnapshot {
			const parentAst = withAstNode(fixture(), {
				kind: ts.SyntaxKind.VariableDeclaration,
				kindName: 'VariableDeclaration'
			});
			const declaration = parentAst.astNodes.find(
				(node) => node.kind === ts.SyntaxKind.VariableDeclaration
			)!;
			const ast = withAstChild(
				parentAst,
				declaration.id,
				{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
				AST_STRUCTURAL_ROLES.declarationName
			);
			const name = ast.astNodes.find((node) => node.parentId === declaration.id)!;
			const candidate: StaticSemanticSnapshot['declarationCandidates'][number] = {
				ambientSyntax,
				candidateRole: 'BINDING' as const,
				candidateState: 'SYNTAX_ONLY' as const,
				exportCarrierNodeId: null,
				exportSyntax: 'NONE' as const,
				id: semanticDeclarationCandidateId({
					candidateRole: 'BINDING',
					nodeId: declaration.id,
					syntaxKind: declaration.kind
				}),
				localModifiers: [],
				nameNodeId: name.id,
				nameState: 'ATOMIC' as const,
				nodeId: declaration.id,
				sourceId: declaration.sourceId,
				syntacticName: 'value',
				syntaxKind: declaration.kind,
				syntaxKindName: declaration.kindName
			};
			return {
				...ast,
				declarationCandidates: [candidate],
				populations: ast.populations.map((population) =>
					population.kind === 'DECLARATION_CANDIDATE'
						? semanticPopulation('DECLARATION_CANDIDATE', members([candidate.id]))
						: population
				)
			};
		}

		const ordinary = ordinaryVariable(false);
		expect(validateSnapshot(ordinary)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({
				...ordinary,
				declarationCandidates: ordinary.declarationCandidates.map((candidate) => ({
					...candidate,
					ambientSyntax: true
				}))
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: '$.declarationCandidates[0].ambientSyntax' })
			])
		);
		const declarationFile = {
			...ordinaryVariable(true),
			sources: ordinaryVariable(true).sources.map((source) => ({
				...source,
				declarationFile: true
			}))
		};
		expect(validateSnapshot(declarationFile)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({
				...declarationFile,
				declarationCandidates: declarationFile.declarationCandidates.map((candidate) => ({
					...candidate,
					ambientSyntax: false
				}))
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: '$.declarationCandidates[0].ambientSyntax' })
			])
		);

		const moduleAst = withAstNode(fixture(), {
			kind: ts.SyntaxKind.ModuleDeclaration,
			kindName: 'ModuleDeclaration'
		});
		const moduleNode = moduleAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.ModuleDeclaration
		)!;
		const withDeclare = withAstChild(
			moduleAst,
			moduleNode.id,
			{ kind: ts.SyntaxKind.DeclareKeyword, kindName: 'DeclareKeyword' },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const withModuleName = withAstChild(
			withDeclare,
			moduleNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.declarationName,
			1
		);
		const withModuleBlock = withAstChild(
			withModuleName,
			moduleNode.id,
			{ kind: ts.SyntaxKind.ModuleBlock, kindName: 'ModuleBlock' },
			AST_STRUCTURAL_ROLES.genericChild,
			2
		);
		const moduleName = withModuleBlock.astNodes.find(
			(node) => node.parentId === moduleNode.id && node.kind === ts.SyntaxKind.Identifier
		)!;
		const moduleBlock = withModuleBlock.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.ModuleBlock
		)!;
		const withStatement = withAstChild(
			withModuleBlock,
			moduleBlock.id,
			{ kind: ts.SyntaxKind.VariableStatement, kindName: 'VariableStatement' },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const statement = withStatement.astNodes.find((node) => node.parentId === moduleBlock.id)!;
		const withList = withAstChild(
			withStatement,
			statement.id,
			{ kind: ts.SyntaxKind.VariableDeclarationList, kindName: 'VariableDeclarationList' },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const list = withList.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclarationList
		)!;
		const withDeclaration = withAstChild(
			withList,
			list.id,
			{ kind: ts.SyntaxKind.VariableDeclaration, kindName: 'VariableDeclaration' },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const declaration = withDeclaration.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclaration
		)!;
		const completeAst = withAstChild(
			withDeclaration,
			declaration.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.declarationName,
			0
		);
		const declarationName = completeAst.astNodes.find((node) => node.parentId === declaration.id)!;
		const scopedCompleteAst = withScopeForNode(completeAst, moduleNode.id);
		const candidates: StaticSemanticSnapshot['declarationCandidates'][number][] = [
			{
				ambientSyntax: true,
				candidateRole: 'BINDING' as const,
				candidateState: 'SYNTAX_ONLY' as const,
				exportCarrierNodeId: null,
				exportSyntax: 'NONE' as const,
				id: semanticDeclarationCandidateId({
					candidateRole: 'BINDING',
					nodeId: moduleNode.id,
					syntaxKind: moduleNode.kind
				}),
				localModifiers: [{ code: ts.SyntaxKind.DeclareKeyword, name: 'DeclareKeyword' }],
				nameNodeId: moduleName.id,
				nameState: 'ATOMIC' as const,
				nodeId: moduleNode.id,
				sourceId: moduleNode.sourceId,
				syntacticName: 'value',
				syntaxKind: moduleNode.kind,
				syntaxKindName: moduleNode.kindName
			},
			{
				ambientSyntax: true,
				candidateRole: 'BINDING' as const,
				candidateState: 'SYNTAX_ONLY' as const,
				exportCarrierNodeId: null,
				exportSyntax: 'NONE' as const,
				id: semanticDeclarationCandidateId({
					candidateRole: 'BINDING',
					nodeId: declaration.id,
					syntaxKind: declaration.kind
				}),
				localModifiers: [],
				nameNodeId: declarationName.id,
				nameState: 'ATOMIC' as const,
				nodeId: declaration.id,
				sourceId: declaration.sourceId,
				syntacticName: 'value',
				syntaxKind: declaration.kind,
				syntaxKindName: declaration.kindName
			}
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		const ambientModule: StaticSemanticSnapshot = {
			...scopedCompleteAst,
			declarationCandidates: candidates,
			populations: scopedCompleteAst.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation(
							'DECLARATION_CANDIDATE',
							members(candidates.map((candidate) => candidate.id))
						)
					: population
			)
		};
		expect(validateSnapshot(ambientModule)).toEqual({ issues: [], state: 'VALID' });
	});

	it('binds invocation and assignment projections to exact retained structural children', () => {
		const callParentSnapshot = withAstNode(fixture(), {
			kind: ts.SyntaxKind.CallExpression,
			kindName: 'CallExpression'
		});
		const callNode = callParentSnapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.CallExpression
		)!;
		const callAst = withAstChild(
			callParentSnapshot,
			callNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationCallee
		);
		const expressionNode = callAst.astNodes.find((node) => node.parentId === callNode.id)!;
		const call = {
			...SYNTAX_ONLY_INVOCATION_TARGET,
			argumentNodeIds: [],
			calleeNodeId: expressionNode.id,
			id: semanticInvocationSiteId({ invocationKind: 'CALL', nodeId: callNode.id }),
			invocationKind: 'CALL' as const,
			nodeId: callNode.id,
			optional: false,
			sourceId: callNode.sourceId,
			templateNodeId: null
		};
		const callSnapshot: StaticSemanticSnapshot = {
			...callAst,
			invocations: [call],
			populations: callAst.populations.map((population) =>
				population.kind === 'INVOCATION_SITE'
					? semanticPopulation('INVOCATION_SITE', members([call.id]))
					: population
			)
		};
		expect(validateSnapshot(callSnapshot)).toEqual({ issues: [], state: 'VALID' });
		const withFirstArgument = withAstChild(
			callAst,
			callNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationArgument,
			1
		);
		const withArguments = withAstChild(
			withFirstArgument,
			callNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationArgument,
			2
		);
		const argumentIds = withArguments.astNodes
			.filter(
				(node) =>
					node.parentId === callNode.id &&
					node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationArgument)
			)
			.sort((left, right) => left.siblingOrdinal - right.siblingOrdinal)
			.map((node) => node.id);
		const callWithArguments = { ...call, argumentNodeIds: argumentIds };
		const argumentSnapshot: StaticSemanticSnapshot = {
			...withArguments,
			invocations: [callWithArguments],
			populations: withArguments.populations.map((population) =>
				population.kind === 'INVOCATION_SITE'
					? semanticPopulation('INVOCATION_SITE', members([call.id]))
					: population
			)
		};
		expect(validateSnapshot(argumentSnapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({ ...callSnapshot, invocations: [{ ...call, optional: true }] }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.invocations[0]' })
			])
		);
		const optionalAst: StaticSemanticSnapshot = {
			...callSnapshot,
			astNodes: callSnapshot.astNodes.map((node) =>
				node.id === callNode.id ? { ...node, publicFlags: ts.NodeFlags.OptionalChain } : node
			)
		};
		const optionalSnapshot: StaticSemanticSnapshot = {
			...optionalAst,
			invocations: [{ ...call, optional: true }]
		};
		expect(validateSnapshot(optionalSnapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(validateSnapshot({ ...optionalSnapshot, invocations: [call] }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.invocations[0]' })
			])
		);
		expect(
			validateSnapshot({
				...callSnapshot,
				invocations: [
					{ ...call, calleeNodeId: callAst.astNodes.find((node) => node.parentId === null)!.id }
				]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.invocations[0]' })
			])
		);

		const danglingTarget: StaticSemanticSnapshot['invocations'][number] = {
			...call,
			implementationDeclarationId: `semantic:declaration-${'f'.repeat(64)}` as never,
			implementationNodeId: `semantic:node-${'f'.repeat(64)}` as never,
			resolutionReason: 'IMPLEMENTATION_IDENTIFIED',
			resolvedSignatureId: `semantic:signature-${'f'.repeat(64)}` as never,
			targetState: 'IMPLEMENTATION_IDENTIFIED'
		};
		expect(validateSnapshot({ ...callSnapshot, invocations: [danglingTarget] }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: '$.invocations[0].resolvedSignatureId' }),
				expect.objectContaining({ path: '$.invocations[0].implementationDeclarationId' }),
				expect.objectContaining({ path: '$.invocations[0].implementationNodeId' }),
				expect.objectContaining({ path: '$.invocations[0].resolutionReason' }),
				expect.objectContaining({ path: '$.invocations[0].resolutionProvenanceId' })
			])
		);

		expect(
			validateSnapshot({
				...callSnapshot,
				invocations: [
					{
						...call,
						resolutionReason: 'IMPLEMENTATION_UNAVAILABLE',
						targetState: 'SIGNATURE_RESOLVED'
					}
				]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'Invocation target state, reason, Signature, and implementation evidence are incoherent.',
					path: '$.invocations[0]'
				})
			])
		);

		const assignmentParentSnapshot = withAstNode(fixture(), {
			kind: ts.SyntaxKind.BinaryExpression,
			kindName: 'BinaryExpression',
			operatorKind: ts.SyntaxKind.EqualsToken,
			operatorName: 'EqualsToken'
		});
		const assignmentNode = assignmentParentSnapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.BinaryExpression
		)!;
		const withTarget = withAstChild(
			assignmentParentSnapshot,
			assignmentNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.assignmentTarget
		);
		const assignmentAst = withAstChild(
			withTarget,
			assignmentNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.assignmentValue,
			1
		);
		const targetNode = assignmentAst.astNodes.find(
			(node) =>
				node.parentId === assignmentNode.id &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentTarget)
		)!;
		const valueNode = assignmentAst.astNodes.find(
			(node) =>
				node.parentId === assignmentNode.id &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue)
		)!;
		const assignment = {
			assignmentKind: 'BINARY' as const,
			nodeId: assignmentNode.id,
			operatorKind: ts.SyntaxKind.EqualsToken,
			operatorName: 'EqualsToken',
			sourceId: assignmentNode.sourceId,
			targetNodeId: targetNode.id,
			valueNodeId: valueNode.id
		};
		const assignmentSnapshot: StaticSemanticSnapshot = {
			...assignmentAst,
			assignments: [assignment],
			populations: assignmentAst.populations.map((population) =>
				population.kind === 'ASSIGNMENT'
					? semanticPopulation('ASSIGNMENT', members([assignment.nodeId]))
					: population
			)
		};
		expect(validateSnapshot(assignmentSnapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({
				...assignmentSnapshot,
				assignments: [{ ...assignment, valueNodeId: null }]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.assignments[0]' })
			])
		);
		expect(
			validateSnapshot({
				...assignmentSnapshot,
				assignments: [{ ...assignment, valueNodeId: targetNode.id }]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.assignments[0]' })
			])
		);
	});

	it('distinguishes call, new, and tagged-template invocation variants', () => {
		const newParentSnapshot = withAstNode(fixture(), {
			kind: ts.SyntaxKind.NewExpression,
			kindName: 'NewExpression'
		});
		const newNode = newParentSnapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.NewExpression
		)!;
		const newAst = withAstChild(
			newParentSnapshot,
			newNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationCallee
		);
		const constructorNode = newAst.astNodes.find((node) => node.parentId === newNode.id)!;
		const newInvocation = {
			...SYNTAX_ONLY_INVOCATION_TARGET,
			argumentNodeIds: [],
			calleeNodeId: constructorNode.id,
			id: semanticInvocationSiteId({ invocationKind: 'NEW', nodeId: newNode.id }),
			invocationKind: 'NEW' as const,
			nodeId: newNode.id,
			optional: false as const,
			sourceId: newNode.sourceId,
			templateNodeId: null
		};
		const newSnapshot: StaticSemanticSnapshot = {
			...newAst,
			invocations: [newInvocation],
			populations: newAst.populations.map((population) =>
				population.kind === 'INVOCATION_SITE'
					? semanticPopulation('INVOCATION_SITE', members([newInvocation.id]))
					: population
			)
		};
		expect(validateSnapshot(newSnapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({ ...newSnapshot, invocations: [{ ...newInvocation, optional: true }] })
				.issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.invocations[0]' })
			])
		);

		const taggedParentSnapshot = withAstNode(fixture(), {
			kind: ts.SyntaxKind.TaggedTemplateExpression,
			kindName: 'TaggedTemplateExpression'
		});
		const taggedNode = taggedParentSnapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.TaggedTemplateExpression
		)!;
		const withTag = withAstChild(
			taggedParentSnapshot,
			taggedNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationCallee,
			0
		);
		const taggedAst = withAstChild(
			withTag,
			taggedNode.id,
			{ kind: ts.SyntaxKind.TemplateExpression, kindName: 'TemplateExpression' },
			AST_STRUCTURAL_ROLES.invocationTemplate,
			1
		);
		const tagNode = taggedAst.astNodes.find(
			(node) =>
				node.parentId === taggedNode.id &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationCallee)
		)!;
		const templateNode = taggedAst.astNodes.find(
			(node) =>
				node.parentId === taggedNode.id &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationTemplate)
		)!;
		const taggedInvocation = {
			...SYNTAX_ONLY_INVOCATION_TARGET,
			argumentNodeIds: [] as const,
			calleeNodeId: tagNode.id,
			id: semanticInvocationSiteId({ invocationKind: 'TAGGED_TEMPLATE', nodeId: taggedNode.id }),
			invocationKind: 'TAGGED_TEMPLATE' as const,
			nodeId: taggedNode.id,
			optional: false as const,
			sourceId: taggedNode.sourceId,
			templateNodeId: templateNode.id
		};
		const taggedSnapshot: StaticSemanticSnapshot = {
			...taggedAst,
			invocations: [taggedInvocation],
			populations: taggedAst.populations.map((population) =>
				population.kind === 'INVOCATION_SITE'
					? semanticPopulation('INVOCATION_SITE', members([taggedInvocation.id]))
					: population
			)
		};
		expect(validateSnapshot(taggedSnapshot)).toEqual({ issues: [], state: 'VALID' });
	});

	it('orders invocation records by invocation identity without imposing node-identity order', () => {
		let withCallAndNew: StaticSemanticSnapshot | undefined;
		for (let attempt = 0; attempt < 128 && withCallAndNew === undefined; attempt += 1) {
			const withCall = withAstNode(fixture(`src/index-${attempt}.ts`), {
				kind: ts.SyntaxKind.CallExpression,
				kindName: 'CallExpression'
			});
			const candidate = withAstNode(withCall, {
				kind: ts.SyntaxKind.NewExpression,
				kindName: 'NewExpression',
				structuralRoles: [AST_STRUCTURAL_ROLES.genericChild]
			});
			const candidateCall = candidate.astNodes.find(
				(node) => node.kind === ts.SyntaxKind.CallExpression
			)!;
			const candidateNew = candidate.astNodes.find(
				(node) => node.kind === ts.SyntaxKind.NewExpression
			)!;
			const byInvocationId = [
				{
					id: semanticInvocationSiteId({ invocationKind: 'CALL', nodeId: candidateCall.id }),
					nodeId: candidateCall.id
				},
				{
					id: semanticInvocationSiteId({ invocationKind: 'NEW', nodeId: candidateNew.id }),
					nodeId: candidateNew.id
				}
			].sort((left, right) => (left.id < right.id ? -1 : 1));
			if (byInvocationId[0]!.nodeId > byInvocationId[1]!.nodeId) withCallAndNew = candidate;
		}
		expect(withCallAndNew).toBeDefined();
		const mixedAst = withCallAndNew!;
		const callNode = mixedAst.astNodes.find((node) => node.kind === ts.SyntaxKind.CallExpression)!;
		const newNode = mixedAst.astNodes.find((node) => node.kind === ts.SyntaxKind.NewExpression)!;
		const withCallCallee = withAstChild(
			mixedAst,
			callNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationCallee
		);
		const completeAst = withAstChild(
			withCallCallee,
			newNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationCallee
		);
		const callCallee = completeAst.astNodes.find((node) => node.parentId === callNode.id)!;
		const newCallee = completeAst.astNodes.find((node) => node.parentId === newNode.id)!;
		const invocations = [
			{
				...SYNTAX_ONLY_INVOCATION_TARGET,
				argumentNodeIds: [],
				calleeNodeId: callCallee.id,
				id: semanticInvocationSiteId({ invocationKind: 'CALL', nodeId: callNode.id }),
				invocationKind: 'CALL' as const,
				nodeId: callNode.id,
				optional: false,
				sourceId: callNode.sourceId,
				templateNodeId: null
			},
			{
				...SYNTAX_ONLY_INVOCATION_TARGET,
				argumentNodeIds: [],
				calleeNodeId: newCallee.id,
				id: semanticInvocationSiteId({ invocationKind: 'NEW', nodeId: newNode.id }),
				invocationKind: 'NEW' as const,
				nodeId: newNode.id,
				optional: false as const,
				sourceId: newNode.sourceId,
				templateNodeId: null
			}
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		const snapshot: StaticSemanticSnapshot = {
			...completeAst,
			invocations,
			populations: completeAst.populations.map((population) =>
				population.kind === 'INVOCATION_SITE'
					? semanticPopulation(
							'INVOCATION_SITE',
							members(invocations.map((invocation) => invocation.id))
						)
					: population
			)
		};
		const nodeIdsInRecordOrder = invocations.map((invocation) => invocation.nodeId);
		expect(
			nodeIdsInRecordOrder.every(
				(nodeId, index) => index === 0 || nodeIdsInRecordOrder[index - 1]! < nodeId
			)
		).toBe(false);
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('rejects conflicting compiler queries and unbound or duplicate Program source paths', () => {
		const present = readFileObservation('context/shared.d.ts', 'PRESENT');
		const absent = readFileObservation('context/shared.d.ts', 'ABSENT');
		const compilerInputs = [present, absent].sort((left, right) => (left.id < right.id ? -1 : 1));
		expect(validateSnapshot({ ...fixture(), compilerInputs }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('exactly one deterministic')
				})
			])
		);
		const conflictingDirectories = [
			directoryObservation('context', 'GET_DIRECTORIES', 'DIRECTORY'),
			directoryObservation('context', 'READ_DIRECTORY', 'NOT_DIRECTORY')
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		expect(
			validateSnapshot({ ...fixture(), compilerInputs: conflictingDirectories }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('path kind')
				})
			])
		);
		const fileAndDirectory = [
			readFileObservation('context/collision', 'PRESENT'),
			directoryObservation('context/collision', 'DIRECTORY_EXISTS', 'DIRECTORY')
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		expect(validateSnapshot({ ...fixture(), compilerInputs: fileAndDirectory }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('path kind')
				})
			])
		);
		expect(validateSnapshot(withContextSource(fixture(), 'context/unbound.d.ts')).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'IDENTITY_MISMATCH',
					message: expect.stringContaining('PRESENT READ_FILE')
				})
			])
		);
		expect(validateSnapshot(withContextSource(fixture(), 'src/index.ts', 'x')).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.sources' })])
		);
		expect(
			validateSnapshot({ ...fixture(), projects: [fixture().projects[0]!, fixture().projects[0]!] })
				.issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.projects' })
			])
		);
	});

	it('closes diagnostic manifests, capability rollups, and structured limitation effects', () => {
		const missingSourceManifest = withSourceDiagnostics(fixture(), ['2000'], false);
		expect(validateSnapshot(missingSourceManifest).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: expect.stringContaining('exactly cover')
				})
			])
		);
		const snapshot = fixture();
		const partialSyntax = {
			...reviseProvenance(snapshot, snapshot.sources[0]!.syntaxProvenanceId!, (record) => ({
				...record,
				epistemic: { ...record.epistemic, capabilityCoverage: 'partial', freshness: 'unknown' }
			})),
			health: 'PARTIAL' as const
		};
		expect(validateSnapshot(partialSyntax).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.capabilities' })
			])
		);
		const nonDegrading = {
			capability: 'TS_PROJECT' as const,
			closureEffect: 'NONE' as const,
			reason: 'Full JAN-CSAA-007 conformance is outside Slice 3B.',
			region: 'full-conformance'
		};
		expect(validateSnapshot({ ...snapshot, limitations: [nonDegrading] })).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(validateSnapshot({ ...snapshot, limitations: ['known gap'] }).state).toBe('INVALID');
		const degrading = {
			...nonDegrading,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason: 'A bounded region could not be extracted.',
			region: 'bounded-region'
		};
		const fatal = {
			...nonDegrading,
			closureEffect: 'FATAL' as const,
			reason: 'Extraction cannot produce a trustworthy snapshot.',
			region: 'fatal-region'
		};
		expect(validateSnapshot({ ...snapshot, limitations: [fatal] }).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.limitations[0].closureEffect' })])
		);
		expect(validateSnapshot({ ...snapshot, limitations: [degrading] }).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE', path: '$.health' })])
		);
		expect(
			validateSnapshot({
				...snapshot,
				capabilities: snapshot.capabilities.map((capability) =>
					capability.capability === 'TS_PROJECT'
						? { ...capability, state: 'PARTIAL' as const }
						: capability
				),
				health: 'PARTIAL',
				limitations: [degrading]
			})
		).toEqual({ issues: [], state: 'VALID' });
	});

	it('reconciles diagnostic records, occurrences, full-payload identity, and bounded coverage', () => {
		const base = withSourceDiagnostics(fixture(), ['2000'], true);
		const diagnostic = { ...base.diagnostics[0]!, multiplicity: 3 };
		const diagnostics = [diagnostic];
		const multiplicitySnapshot: StaticSemanticSnapshot = {
			...base,
			diagnostics,
			programs: base.programs.map((program) => ({
				...program,
				diagnosticFamilies: program.diagnosticFamilies.map((family) =>
					family.family === 'SEMANTIC'
						? {
								...family,
								manifestDigest: sha256(
									canonicalSemanticJson(
										diagnostics.map(({ id, multiplicity }) => ({ id, multiplicity }))
									)
								),
								occurrenceCount: 3
							}
						: family
				)
			}))
		};
		expect(validateSnapshot(multiplicitySnapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({
				...multiplicitySnapshot,
				budgets: { ...multiplicitySnapshot.budgets, maxDiagnostics: 2 }
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.budgets.maxDiagnostics' })
			])
		);
		expect(
			validateSnapshot({
				...multiplicitySnapshot,
				budgets: {
					...multiplicitySnapshot.budgets,
					maxDiagnosticCharacters: diagnostic.message.text.length * 2
				}
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: '$.budgets.maxDiagnosticCharacters'
				})
			])
		);
		expect(
			validateSnapshot({ ...base, diagnostics: [{ ...base.diagnostics[0]!, multiplicity: 0 }] })
				.issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.diagnostics[0].multiplicity' })
			])
		);
		expect(
			validateSnapshot({ ...base, diagnostics: [{ ...base.diagnostics[0]!, category: 'WARNING' }] })
				.issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'IDENTITY_MISMATCH', path: '$.diagnostics[0].id' })
			])
		);

		const boundedWithoutRollup = {
			...fixture(),
			programs: fixture().programs.map((program) => ({
				...program,
				diagnosticFamilies: program.diagnosticFamilies.map((family) =>
					family.family === 'CONFIGURATION' ? { ...family, coverage: 'BOUNDED' } : family
				)
			}))
		};
		expect(validateSnapshot(boundedWithoutRollup).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: expect.stringContaining('project partiality')
				})
			])
		);
		const boundedBase: StaticSemanticSnapshot = {
			...(boundedWithoutRollup as StaticSemanticSnapshot),
			capabilities: boundedWithoutRollup.capabilities.map((capability) =>
				capability.capability === 'TS_PROJECT'
					? { ...capability, state: 'PARTIAL' as const }
					: capability
			),
			health: 'PARTIAL',
			projects: boundedWithoutRollup.projects.map((project) => ({
				...project,
				health: 'PARTIAL' as const,
				partialityReasons: [
					{
						capability: 'TS_PROJECT' as const,
						code: 'SEMANTIC_VALIDATION_FAILED' as const,
						message: 'Configuration diagnostics were captured with bounded coverage.',
						path: project.configPath
					}
				]
			}))
		};
		const bounded = reviseProvenance(
			boundedBase,
			boundedBase.projects[0]!.provenanceId,
			(record) => ({
				...record,
				epistemic: { ...record.epistemic, capabilityCoverage: 'partial' as const }
			})
		);
		expect(validateSnapshot(bounded)).toEqual({ issues: [], state: 'VALID' });
	});

	it('rejects Proxies and accessors without executing traps or getters and fails closed on ordinary non-scalar strings', () => {
		const snapshot = fixture();
		let traps = 0;
		const hostile = new Proxy(snapshot, {
			get: () => {
				traps += 1;
				return undefined;
			},
			getOwnPropertyDescriptor: () => {
				traps += 1;
				return undefined;
			},
			getPrototypeOf: () => {
				traps += 1;
				return Object.prototype;
			},
			ownKeys: () => {
				traps += 1;
				return [];
			}
		});
		expect(validateStaticSemanticSnapshot(hostile, {}, FROZEN_CONTEXT)).toMatchObject({
			state: 'INVALID',
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })]
		});
		expect(traps).toBe(0);

		let nestedTraps = 0;
		const provider = new Proxy(snapshot.provider, {
			get: () => {
				nestedTraps += 1;
				return undefined;
			},
			getOwnPropertyDescriptor: () => {
				nestedTraps += 1;
				return undefined;
			},
			getPrototypeOf: () => {
				nestedTraps += 1;
				return Object.prototype;
			},
			ownKeys: () => {
				nestedTraps += 1;
				return [];
			}
		});
		expect(validateSnapshot({ ...snapshot, provider })).toMatchObject({
			state: 'INVALID',
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })]
		});
		expect(nestedTraps).toBe(0);

		let getterCalls = 0;
		const accessor = { ...snapshot };
		Object.defineProperty(accessor, 'provider', {
			enumerable: true,
			get: () => {
				getterCalls += 1;
				return snapshot.provider;
			}
		});
		const accessorResult = validateSnapshot(accessor);
		expect(accessorResult.state).toBe('INVALID');
		expect(accessorResult.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })])
		);
		expect(getterCalls).toBe(0);
		expect(() => validateSnapshot({ ...snapshot, health: '\ud800' })).not.toThrow();
		const surrogateResult = validateSnapshot({ ...snapshot, health: '\ud800' });
		expect(surrogateResult.state).toBe('INVALID');
		expect(surrogateResult.issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SHAPE' })])
		);
	});

	it('materializes validation-option overrides from closed enumerable data descriptors without executing hostile code', () => {
		const snapshot = fixture();
		const validateOptions = (options: unknown) =>
			validateStaticSemanticSnapshot(
				snapshot,
				options as Partial<SemanticValidationOptions>,
				FROZEN_CONTEXT
			);
		expect(validateOptions({ maxIssues: 500, maxReferenceChecks: 10_000 })).toEqual({
			issues: [],
			state: 'VALID'
		});

		const benignProxy = new Proxy({ maxIssues: 500 }, {});
		expect(() => validateOptions(benignProxy)).not.toThrow();
		expect(validateOptions(benignProxy)).toMatchObject({
			state: 'INVALID',
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE', path: '$validationOptions' })]
		});

		let proxyTraps = 0;
		const throwingProxy = new Proxy(
			{},
			{
				get: () => {
					proxyTraps += 1;
					throw new Error('get trap');
				},
				getOwnPropertyDescriptor: () => {
					proxyTraps += 1;
					throw new Error('descriptor trap');
				},
				getPrototypeOf: () => {
					proxyTraps += 1;
					throw new Error('prototype trap');
				},
				ownKeys: () => {
					proxyTraps += 1;
					throw new Error('ownKeys trap');
				}
			}
		);
		expect(() => validateOptions(throwingProxy)).not.toThrow();
		expect(validateOptions(throwingProxy)).toMatchObject({
			state: 'INVALID',
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE' })]
		});
		expect(proxyTraps).toBe(0);

		let getterCalls = 0;
		const accessorOptions = {};
		Object.defineProperty(accessorOptions, 'maxIssues', {
			enumerable: true,
			get: () => {
				getterCalls += 1;
				throw new Error('option getter');
			}
		});
		expect(() => validateOptions(accessorOptions)).not.toThrow();
		expect(validateOptions(accessorOptions)).toMatchObject({
			state: 'INVALID',
			issues: [
				expect.objectContaining({ code: 'INVALID_SHAPE', path: '$validationOptions.maxIssues' })
			]
		});
		expect(getterCalls).toBe(0);

		const hiddenOptions = {};
		Object.defineProperty(hiddenOptions, 'maxIssues', { enumerable: false, value: 500 });
		expect(validateOptions(hiddenOptions)).toMatchObject({
			state: 'INVALID',
			issues: [
				expect.objectContaining({ code: 'INVALID_SHAPE', path: '$validationOptions.maxIssues' })
			]
		});
		expect(validateOptions({ [Symbol('maxIssues')]: 500 })).toMatchObject({
			state: 'INVALID',
			issues: [expect.objectContaining({ code: 'INVALID_SHAPE', path: '$validationOptions' })]
		});
		expect(validateOptions({ maxIssuez: 500 })).toMatchObject({
			state: 'INVALID',
			issues: [
				expect.objectContaining({ code: 'INVALID_SHAPE', path: '$validationOptions.maxIssuez' })
			]
		});
	});

	it('requires exact FrozenSubject artifacts and projects, including workspace-alias source binding', () => {
		const snapshot = fixture();
		expect(validateStaticSemanticSnapshot(snapshot).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'FROZEN_EVIDENCE_REQUIRED' })])
		);
		const wrongArtifact: SemanticValidationContext = {
			frozenSubject: {
				...FROZEN_CONTEXT.frozenSubject!,
				artifacts: FROZEN_CONTEXT.frozenSubject!.artifacts.map((artifact) => ({
					...artifact,
					sha256: 'f'.repeat(64)
				}))
			}
		};
		expect(validateSnapshot(snapshot, {}, wrongArtifact).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'FROZEN_EVIDENCE_REQUIRED' })])
		);

		const forgedRecipe = fixture('src/index.ts', '', { module: 199, strict: false });
		expect(validateSnapshot(forgedRecipe).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'FROZEN_EVIDENCE_REQUIRED', path: '$.projects' })
			])
		);
		expect(validateSnapshot({ ...snapshot, projects: [] }).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'FROZEN_EVIDENCE_REQUIRED', path: '$.projects' })
			])
		);
		expect(
			validateSnapshot({ ...snapshot, projects: [...snapshot.projects, snapshot.projects[0]!] })
				.issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'FROZEN_EVIDENCE_REQUIRED', path: '$.projects' })
			])
		);

		const aliasPath = 'node_modules/@scope/example/src/index.ts';
		const artifactPath = 'packages/example/src/index.ts';
		const aliasSnapshot = fixture(aliasPath);
		const aliasContext = contextForSnapshot(aliasSnapshot, artifactPath, [
			{
				exports: [],
				kind: 'PACKAGE',
				manifestPath: 'packages/example/package.json',
				name: '@scope/example',
				path: 'packages/example',
				private: false,
				provenance: ['packages/example/package.json'],
				workspacePatterns: ['packages/*']
			}
		]);
		expect(validateSnapshot(aliasSnapshot, {}, aliasContext)).toEqual({
			issues: [],
			state: 'VALID'
		});

		const incompleteProject = {
			...snapshot.projects[0]!,
			health: 'PARTIAL' as const,
			partialityReasons: [
				{
					capability: 'TS_PROJECT' as const,
					code: 'TYPESCRIPT_PROJECT_PARTIAL' as const,
					message: 'Frozen project resolution is incomplete.',
					path: snapshot.projects[0]!.configPath
				}
			],
			rootDisposition: 'INCOMPLETE' as const
		};
		const incompleteBaseSnapshot: StaticSemanticSnapshot = {
			...snapshot,
			capabilities: snapshot.capabilities.map((capability) =>
				capability.capability === 'TS_PROJECT'
					? { ...capability, state: 'PARTIAL' as const }
					: capability
			),
			health: 'PARTIAL',
			projects: [incompleteProject]
		};
		const incompleteSnapshot = reviseProvenance(
			incompleteBaseSnapshot,
			incompleteProject.provenanceId,
			(record) => ({
				...record,
				epistemic: { ...record.epistemic, capabilityCoverage: 'partial' as const }
			})
		);
		const revisedIncompleteProject = incompleteSnapshot.projects[0]!;
		const incompleteBaseContext = contextForSnapshot(incompleteSnapshot);
		const incompleteContext: SemanticValidationContext = {
			frozenSubject: {
				...incompleteBaseContext.frozenSubject!,
				projects: [subjectProject(revisedIncompleteProject, 'PARTIAL')]
			}
		};
		expect(validateSnapshot(incompleteSnapshot, {}, incompleteContext)).toEqual({
			issues: [],
			state: 'VALID'
		});
	});

	it('represents cooked lone-surrogate string and template literals without admitting them to canonical JSON', () => {
		for (const [kind, kindName, valueType, cooked] of [
			[ts.SyntaxKind.StringLiteral, 'StringLiteral', 'STRING', '\ud800'],
			[
				ts.SyntaxKind.NoSubstitutionTemplateLiteral,
				'NoSubstitutionTemplateLiteral',
				'NO_SUBSTITUTION_TEMPLATE',
				'\udc00'
			],
			[ts.SyntaxKind.TemplateHead, 'TemplateHead', 'TEMPLATE_HEAD', '\ud800'],
			[ts.SyntaxKind.TemplateTail, 'TemplateTail', 'TEMPLATE_TAIL', '\udc00']
		] as const) {
			const ast = withAstNode(fixture(), { kind, kindName });
			const node = ast.astNodes.find((candidate) => candidate.kind === kind)!;
			const literal = {
				lexemeLength: 0,
				lexemeSha256: literalLexemeDigest(''),
				nodeId: node.id,
				sourceId: node.sourceId,
				value: null,
				valueEncoding: 'UTF16_CODE_UNITS_LE' as const,
				valueLength: 1,
				valueSha256: literalValueDigest('UTF16_CODE_UNITS_LE', valueType, cooked),
				valueState: 'DIGEST_ONLY' as const,
				valueType
			};
			const snapshot: StaticSemanticSnapshot = {
				...ast,
				literals: [literal],
				populations: ast.populations.map((population) =>
					population.kind === 'LITERAL'
						? semanticPopulation('LITERAL', members([node.id]))
						: population
				)
			};
			expect(validateSnapshot(snapshot)).toEqual({ issues: [], state: 'VALID' });
		}
	});

	it('binds literal declaration names to scalar-safe source lexemes and preserves recovered missing names', () => {
		const sourceLexeme = '"\\uD800"';
		const contents = `const o = {${sourceLexeme}: 1};`;
		const start = contents.indexOf(sourceLexeme);
		const parentAst = withAstNode(fixture('src/index.ts', contents), {
			end: start + sourceLexeme.length,
			kind: ts.SyntaxKind.PropertyAssignment,
			kindName: 'PropertyAssignment',
			start
		});
		const parent = parentAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.PropertyAssignment
		)!;
		const namedAst = withAstChild(
			parentAst,
			parent.id,
			{
				end: start + sourceLexeme.length,
				kind: ts.SyntaxKind.StringLiteral,
				kindName: 'StringLiteral',
				start
			},
			AST_STRUCTURAL_ROLES.declarationName
		);
		const name = namedAst.astNodes.find((node) => node.parentId === parent.id)!;
		const literal = {
			lexemeLength: sourceLexeme.length,
			lexemeSha256: literalLexemeDigest(sourceLexeme),
			nodeId: name.id,
			sourceId: name.sourceId,
			value: null,
			valueEncoding: 'UTF16_CODE_UNITS_LE' as const,
			valueLength: 1,
			valueSha256: literalValueDigest('UTF16_CODE_UNITS_LE', 'STRING', '\ud800'),
			valueState: 'DIGEST_ONLY' as const,
			valueType: 'STRING' as const
		};
		const candidate = {
			ambientSyntax: false,
			candidateRole: 'MEMBER' as const,
			candidateState: 'SYNTAX_ONLY' as const,
			exportCarrierNodeId: null,
			exportSyntax: 'NONE' as const,
			id: semanticDeclarationCandidateId({
				candidateRole: 'MEMBER',
				nodeId: parent.id,
				syntaxKind: parent.kind
			}),
			localModifiers: [],
			nameNodeId: name.id,
			nameState: 'ATOMIC' as const,
			nodeId: parent.id,
			sourceId: parent.sourceId,
			syntacticName: sourceLexeme,
			syntaxKind: parent.kind,
			syntaxKindName: parent.kindName
		};
		const namedSnapshot: StaticSemanticSnapshot = {
			...namedAst,
			declarationCandidates: [candidate],
			literals: [literal],
			populations: namedAst.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation('DECLARATION_CANDIDATE', members([candidate.id]))
					: population.kind === 'LITERAL'
						? semanticPopulation('LITERAL', members([literal.nodeId]))
						: population
			)
		};
		expect(validateSnapshot(namedSnapshot, {}, contextForSnapshot(namedSnapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});

		const declarationAst = withAstNode(fixture(), {
			kind: ts.SyntaxKind.VariableDeclaration,
			kindName: 'VariableDeclaration'
		});
		const declaration = declarationAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclaration
		)!;
		const missingAst = withAstChild(
			declarationAst,
			declaration.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier', syntacticIdentifierText: '' },
			AST_STRUCTURAL_ROLES.declarationName
		);
		const missingName = missingAst.astNodes.find((node) => node.parentId === declaration.id)!;
		const missingCandidate = {
			...candidate,
			candidateRole: 'BINDING' as const,
			id: semanticDeclarationCandidateId({
				candidateRole: 'BINDING',
				nodeId: declaration.id,
				syntaxKind: declaration.kind
			}),
			nameNodeId: missingName.id,
			nameState: 'MISSING' as const,
			nodeId: declaration.id,
			sourceId: declaration.sourceId,
			syntacticName: null,
			syntaxKind: declaration.kind,
			syntaxKindName: declaration.kindName
		};
		const missingSnapshot: StaticSemanticSnapshot = {
			...missingAst,
			declarationCandidates: [missingCandidate],
			populations: missingAst.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation('DECLARATION_CANDIDATE', members([missingCandidate.id]))
					: population
			)
		};
		expect(validateSnapshot(missingSnapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({
				...missingSnapshot,
				declarationCandidates: [
					{ ...missingCandidate, nameState: 'ATOMIC', syntacticName: 'forged' }
				]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: '$.declarationCandidates[0].nameState' })
			])
		);
	});

	it('deduplicates repeated modifier syntax while retaining the compiler diagnostic', () => {
		const parentAst = withAstNode(fixture(), {
			kind: ts.SyntaxKind.PropertyDeclaration,
			kindName: 'PropertyDeclaration'
		});
		const parent = parentAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.PropertyDeclaration
		)!;
		const first = withAstChild(
			parentAst,
			parent.id,
			{ kind: ts.SyntaxKind.PublicKeyword, kindName: 'PublicKeyword' },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const second = withAstChild(
			first,
			parent.id,
			{ kind: ts.SyntaxKind.PublicKeyword, kindName: 'PublicKeyword' },
			AST_STRUCTURAL_ROLES.genericChild,
			1
		);
		const named = withAstChild(
			second,
			parent.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.declarationName,
			2
		);
		const name = named.astNodes.find(
			(node) => node.parentId === parent.id && node.kind === ts.SyntaxKind.Identifier
		)!;
		const candidate = {
			ambientSyntax: false,
			candidateRole: 'MEMBER' as const,
			candidateState: 'SYNTAX_ONLY' as const,
			exportCarrierNodeId: null,
			exportSyntax: 'NONE' as const,
			id: semanticDeclarationCandidateId({
				candidateRole: 'MEMBER',
				nodeId: parent.id,
				syntaxKind: parent.kind
			}),
			localModifiers: [{ code: ts.SyntaxKind.PublicKeyword, name: 'PublicKeyword' }],
			nameNodeId: name.id,
			nameState: 'ATOMIC' as const,
			nodeId: parent.id,
			sourceId: parent.sourceId,
			syntacticName: 'value',
			syntaxKind: parent.kind,
			syntaxKindName: parent.kindName
		};
		const snapshot = withSourceDiagnostics(
			{
				...named,
				declarationCandidates: [candidate],
				populations: named.populations.map((population) =>
					population.kind === 'DECLARATION_CANDIDATE'
						? semanticPopulation('DECLARATION_CANDIDATE', members([candidate.id]))
						: population
				)
			},
			['1030'],
			true
		);
		expect(validateSnapshot(snapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(snapshot.declarationCandidates[0]!.localModifiers).toHaveLength(1);

		const withReadonly = withAstChild(
			second,
			parent.id,
			{ kind: ts.SyntaxKind.ReadonlyKeyword, kindName: 'ReadonlyKeyword' },
			AST_STRUCTURAL_ROLES.genericChild,
			2
		);
		const withDistinctName = withAstChild(
			withReadonly,
			parent.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.declarationName,
			3
		);
		const distinctName = withDistinctName.astNodes.find(
			(node) => node.parentId === parent.id && node.kind === ts.SyntaxKind.Identifier
		)!;
		const modifiers = [
			{ code: ts.SyntaxKind.PublicKeyword, name: 'PublicKeyword' },
			{ code: ts.SyntaxKind.ReadonlyKeyword, name: 'ReadonlyKeyword' }
		].sort((left, right) => (`${left.code}:${left.name}` < `${right.code}:${right.name}` ? -1 : 1));
		const distinctCandidate = {
			...candidate,
			localModifiers: modifiers,
			nameNodeId: distinctName.id
		};
		const distinctSnapshot: StaticSemanticSnapshot = {
			...withDistinctName,
			declarationCandidates: [distinctCandidate],
			populations: withDistinctName.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation('DECLARATION_CANDIDATE', members([distinctCandidate.id]))
					: population
			)
		};
		expect(validateSnapshot(distinctSnapshot)).toEqual({ issues: [], state: 'VALID' });
	});

	it('preserves non-scalar and path-bearing diagnostic text, PATH locations, and duplicate related information', () => {
		const base = withSourceDiagnostics(fixture(), ['2322'], true);
		const original = base.diagnostics[0]!;
		const nonScalarMessage = diagnosticMessage('\ud800');
		const nonScalarIdentity = {
			category: original.category,
			code: original.code,
			end: original.end,
			family: original.family,
			locationKind: original.locationKind,
			message: nonScalarMessage,
			path: original.path,
			projectId: original.projectId,
			related: original.related,
			sourceId: original.sourceId,
			start: original.start
		};
		const nonScalar = replaceDiagnostics(base, [
			{ ...original, ...nonScalarIdentity, id: semanticDiagnosticId(nonScalarIdentity) }
		]);
		expect(nonScalarMessage).toMatchObject({
			text: 'd800',
			textEncoding: 'UTF16_CODE_UNITS_HEX',
			textLength: 1
		});
		expect(validateSnapshot(nonScalar)).toEqual({ issues: [], state: 'VALID' });
		const tightBudget = validateSnapshot({
			...nonScalar,
			budgets: { ...nonScalar.budgets, maxDiagnosticCharacters: 1 }
		});
		expect(tightBudget.issues).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: '$.budgets.maxDiagnosticCharacters' })
			])
		);

		const pathText = diagnosticMessage(
			'Source reported C:\\repo\\x.ts but retained a logical path.'
		);
		const pathTextIdentity = { ...nonScalarIdentity, message: pathText };
		const withPathText = replaceDiagnostics(base, [
			{ ...original, ...pathTextIdentity, id: semanticDiagnosticId(pathTextIdentity) }
		]);
		expect(validateSnapshot(withPathText)).toEqual({ issues: [], state: 'VALID' });

		const project = base.projects[0]!;
		const configMessage = diagnosticMessage('Unknown compiler option.');
		const configIdentity = {
			category: 'ERROR' as const,
			code: 'TS5023',
			end: 5,
			family: 'CONFIGURATION' as const,
			locationKind: 'PATH' as const,
			message: configMessage,
			path: project.configPath,
			projectId: project.id,
			related: [],
			sourceId: null,
			start: 0
		};
		const configDiagnostic: SemanticDiagnosticRecord = {
			...configIdentity,
			id: semanticDiagnosticId(configIdentity),
			multiplicity: 1,
			provenanceId: project.provenanceId
		};
		const configSnapshot = replaceDiagnostics(fixture(), [configDiagnostic]);
		expect(validateSnapshot(configSnapshot)).toEqual({ issues: [], state: 'VALID' });

		const related = {
			category: 'MESSAGE' as const,
			code: 'TS100',
			end: null,
			message: diagnosticMessage('same related information'),
			path: null,
			start: null
		};
		const duplicateRelatedIdentity = {
			...nonScalarIdentity,
			message: original.message,
			related: [related, related]
		};
		const duplicateRelated = replaceDiagnostics(base, [
			{
				...original,
				...duplicateRelatedIdentity,
				id: semanticDiagnosticId(duplicateRelatedIdentity)
			}
		]);
		expect(validateSnapshot(duplicateRelated)).toEqual({ issues: [], state: 'VALID' });
		expect(
			validateSnapshot({
				...duplicateRelated,
				diagnostics: duplicateRelated.diagnostics.map((diagnostic) => ({
					...diagnostic,
					code: '2322'
				}))
			}).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ path: '$.diagnostics[0].code' })]));
	});

	it('keeps unsupported framework syntax independent from TS_PROJECT capability', () => {
		const snapshot = fixture();
		const frameworkMember = `${snapshot.projects[0]!.id}\0apps/demo/App.svelte`;
		const project = {
			...snapshot.projects[0]!,
			frameworkCandidates: ['apps/demo/App.svelte'],
			health: 'PARTIAL' as const,
			partialityReasons: [
				{
					capability: 'TS_SYNTAX' as const,
					code: 'FRAMEWORK_CANDIDATES_UNSUPPORTED' as const,
					message: 'Framework syntax is outside Slice 3B.',
					path: 'apps/demo/App.svelte'
				}
			]
		};
		const frameworkMembers: SemanticPopulationMembers = {
			analyzed: [frameworkMember],
			contextOnly: [],
			excluded: [],
			excludedByPolicy: [],
			failed: [],
			unknown: [],
			unsupported: [frameworkMember]
		};
		const frameworkSnapshot: StaticSemanticSnapshot = {
			...snapshot,
			capabilities: snapshot.capabilities.map((capability) =>
				capability.capability === 'TS_SYNTAX'
					? { ...capability, state: 'PARTIAL' as const }
					: capability
			),
			health: 'PARTIAL',
			populations: snapshot.populations.map((population) =>
				population.kind === 'FRAMEWORK_CANDIDATE'
					? semanticPopulation('FRAMEWORK_CANDIDATE', frameworkMembers)
					: population
			),
			projects: [project]
		};
		const context = contextForSnapshot(frameworkSnapshot);
		const frameworkPartialContext: SemanticValidationContext = {
			frozenSubject: {
				...context.frozenSubject!,
				projects: context.frozenSubject!.projects.map((authoritative) => ({
					...authoritative,
					status: 'PARTIAL' as const
				}))
			}
		};
		expect(
			frameworkSnapshot.capabilities.find((capability) => capability.capability === 'TS_PROJECT')!
				.state
		).toBe('SUPPORTED');
		expect(
			frameworkSnapshot.provenances.find((record) => record.id === project.provenanceId)!.epistemic
				.capabilityCoverage
		).toBe('supported');
		expect(validateSnapshot(frameworkSnapshot, {}, context)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(validateSnapshot(frameworkSnapshot, {}, frameworkPartialContext)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(
			validateSnapshot(
				{
					...frameworkSnapshot,
					capabilities: frameworkSnapshot.capabilities.map((capability) =>
						capability.capability === 'TS_SYNTAX'
							? { ...capability, state: 'SUPPORTED' as const }
							: capability
					)
				},
				{},
				context
			).issues
		).toEqual(expect.arrayContaining([expect.objectContaining({ path: '$.capabilities' })]));
	});

	it('enforces the closed structural-role algebra', () => {
		const ast = withAstNode(fixture(), { kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' });
		const child = ast.astNodes.find((node) => node.kind === ts.SyntaxKind.Identifier)!;
		for (const roles of [
			['bogus-role'],
			[AST_STRUCTURAL_ROLES.invocationCallee],
			[
				AST_STRUCTURAL_ROLES.genericChild,
				AST_STRUCTURAL_ROLES.invocationArgument,
				AST_STRUCTURAL_ROLES.invocationCallee
			],
			[
				AST_STRUCTURAL_ROLES.assignmentTarget,
				AST_STRUCTURAL_ROLES.assignmentValue,
				AST_STRUCTURAL_ROLES.genericChild
			]
		]) {
			const malformed = {
				...ast,
				astNodes: ast.astNodes.map((node) =>
					node.id === child.id ? { ...node, structuralRoles: [...roles].sort() } : node
				)
			};
			expect(validateSnapshot(malformed).issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: 'INVALID_VALUE',
						path: expect.stringContaining('structuralRoles')
					})
				])
			);
		}
		const root = ast.astNodes.find((node) => node.parentId === null)!;
		const rootAndChild = {
			...ast,
			astNodes: ast.astNodes.map((node) =>
				node.id === root.id
					? {
							...node,
							structuralRoles: [AST_STRUCTURAL_ROLES.genericChild, AST_STRUCTURAL_ROLES.sourceFile]
						}
					: node
			)
		};
		expect(validateSnapshot(rootAndChild).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: expect.stringContaining('structuralRoles')
				})
			])
		);
	});

	it('rejects absolute compiler-option keys and bounds sparse arrays before expansion', () => {
		const snapshot = fixture();
		const absoluteKey = {
			...snapshot,
			projects: snapshot.projects.map((project) => ({
				...project,
				programRecipe: {
					...project.programRecipe,
					compilerOptions: { paths: { 'C:\\secret\\*': ['src/*'] } }
				}
			}))
		};
		expect(validateSnapshot(absoluteKey).issues).toEqual(
			expect.arrayContaining([expect.objectContaining({ code: 'INVALID_VALUE' })])
		);
		const hugeSparse: unknown[] = [];
		hugeSparse.length = 1_000_000;
		expect(
			validateSnapshot({ ...snapshot, astNodes: hugeSparse }, { maxRecords: 100 })
		).toMatchObject({ state: 'BUDGET_EXHAUSTED' });
		const smallSparse = Array<unknown>(2);
		expect(validateSnapshot({ ...snapshot, astNodes: smallSparse })).toMatchObject({
			state: 'INVALID'
		});
	});

	it('closes remaining bounded validator failure paths with discriminating mutations', () => {
		const snapshot = fixture();
		const budgetResult = validateSnapshot(
			{
				...snapshot,
				canonicalProfile: 'wrong-profile',
				extractionVersion: 'wrong-version'
			},
			{ maxIssues: 1 }
		);
		expect(budgetResult).toMatchObject({
			state: 'BUDGET_EXHAUSTED',
			issues: [expect.objectContaining({ path: '$.canonicalProfile' })]
		});

		for (const options of [null, [], new Date(0)]) {
			expect(
				validateStaticSemanticSnapshot(snapshot, options as never, FROZEN_CONTEXT)
			).toMatchObject({
				state: 'INVALID',
				issues: [expect.objectContaining({ path: '$validationOptions' })]
			});
		}

		const unsupportedImplemented = {
			...snapshot,
			capabilities: snapshot.capabilities.map((entry) =>
				entry.capability === 'TS_PROJECT' ? { ...entry, state: 'UNSUPPORTED' as const } : entry
			)
		};
		expect(validateSnapshot(unsupportedImplemented).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'INVALID_VALUE', path: '$.capabilities' })
			])
		);

		const recipeProviderMismatch = {
			...snapshot,
			projects: snapshot.projects.map((project) => ({
				...project,
				programRecipe: {
					...project.programRecipe,
					provider: { ...project.programRecipe.provider, version: '5.9.2' }
				}
			}))
		};
		expect(validateSnapshot(recipeProviderMismatch).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'IDENTITY_MISMATCH', path: '$.projects[0].programRecipe' })
			])
		);

		const diagnosticBase = withSourceDiagnostics(snapshot, ['2000'], true);
		const diagnostic = diagnosticBase.diagnostics[0]!;
		const diagnosticProbes = [
			{ ...diagnostic, message: { ...diagnostic.message, text: 'changed' } },
			{
				...diagnostic,
				message: {
					...diagnostic.message,
					text: '0061',
					textEncoding: 'UTF16_CODE_UNITS_HEX' as const,
					textLength: 1
				}
			},
			{ ...diagnostic, locationKind: 'SOURCE' as const, path: null, sourceId: null },
			{ ...diagnostic, multiplicity: Number.MAX_SAFE_INTEGER }
		];
		for (const changedDiagnostic of diagnosticProbes) {
			const result = validateSnapshot({ ...diagnosticBase, diagnostics: [changedDiagnostic] });
			expect(result.state).toBe('INVALID');
			expect(result.issues.length).toBeGreaterThan(0);
		}

		const projectProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_PROJECT' && record.sourceId === null
		)!;
		const epistemicallyInvalid = {
			...snapshot,
			provenances: snapshot.provenances.map((record) =>
				record.id === projectProvenance.id
					? {
							...record,
							epistemic: {
								...record.epistemic,
								capabilityCoverage: 'unsupported' as const,
								conflict: 'conflicting' as const,
								executionHealth: 'failed' as const,
								freshness: 'stale' as const,
								inference: 'candidate' as const,
								rationale: '',
								supportBasis: {
									...record.epistemic.supportBasis,
									kind: 'unknown' as const,
									method: null,
									rationale: '',
									sourceRefs: []
								}
							}
						}
					: record
			)
		};
		expect(validateSnapshot(epistemicallyInvalid).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					path: expect.stringContaining('.epistemic')
				})
			])
		);

		const limitation = {
			capability: 'TS_PROJECT' as const,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason: 'Bounded project evidence.',
			region: 'project-region'
		};
		const limitedProvenance = {
			...snapshot,
			provenances: snapshot.provenances.map((record) =>
				record.id === projectProvenance.id ? { ...record, limitations: [limitation] } : record
			)
		};
		expect(validateSnapshot(limitedProvenance).state).toBe('INVALID');

		const ast = withAstNode(snapshot, { kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' });
		const root = ast.astNodes.find((node) => node.parentId === null)!;
		const child = ast.astNodes.find((node) => node.kind === ts.SyntaxKind.Identifier)!;
		const cyclic = {
			...ast,
			astNodes: ast.astNodes.map((node) =>
				node.id === root.id ? { ...node, parentId: child.id } : node
			)
		};
		expect(validateSnapshot(cyclic).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: expect.stringContaining('cycle')
				})
			])
		);

		const danglingChain = {
			...ast,
			astNodes: ast.astNodes.map((node) =>
				node.id === child.id ? { ...node, parentId: `semantic:node-${'f'.repeat(64)}` } : node
			)
		};
		expect(validateSnapshot(danglingChain).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					path: expect.stringContaining('.parentId')
				})
			])
		);

		const partialContext = contextForSnapshot(snapshot);
		const authoritativeProject = partialContext.frozenSubject!.projects[0]!;
		const contextWithPartialDiagnostic: SemanticValidationContext = {
			frozenSubject: {
				...partialContext.frozenSubject!,
				projects: [
					{
						...authoritativeProject,
						typescriptDiagnostics: [
							{
								code: 'TYPESCRIPT_PROJECT_PARTIAL',
								message: 'Compiler project is partial.',
								path: authoritativeProject.configPath,
								phase: 'RESOLVE',
								severity: 'WARNING'
							}
						]
					}
				]
			}
		};
		expect(validateSnapshot(snapshot, {}, contextWithPartialDiagnostic).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'FROZEN_EVIDENCE_REQUIRED', path: '$.projects' })
			])
		);
	});

	it('rejects every remaining reachable manifest, provenance, diagnostic, and compiler-input inconsistency', () => {
		const snapshot = fixture();
		const assertInvalidAt = (
			value: unknown,
			path: unknown,
			context: SemanticValidationContext = FROZEN_CONTEXT
		): void => {
			const result = validateSnapshot(value, {}, context);
			expect(result.state).toBe('INVALID');
			expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
		};

		assertInvalidAt(
			{ ...snapshot, fullJanCsaa007Conformance: true },
			'$.fullJanCsaa007Conformance'
		);
		assertInvalidAt(
			{ ...snapshot, provider: { ...snapshot.provider, api: 'PRIVATE_COMPILER_API' } },
			'$.provider'
		);
		assertInvalidAt({ ...snapshot, subjectId: 'BAD' }, '$.subjectId');
		assertInvalidAt({ ...snapshot, budgets: { ...snapshot.budgets, maxSources: 0 } }, '$.budgets');
		const firstLimitation = {
			capability: 'TS_PROJECT' as const,
			closureEffect: 'NONE' as const,
			reason: 'z reason',
			region: 'z-region'
		};
		const secondLimitation = {
			capability: 'TS_PROJECT' as const,
			closureEffect: 'NONE' as const,
			reason: 'a reason',
			region: 'a-region'
		};
		assertInvalidAt(
			{ ...snapshot, limitations: [firstLimitation, secondLimitation] },
			'$.limitations'
		);
		assertInvalidAt(
			{ ...snapshot, limitations: [{ ...firstLimitation, reason: '' }] },
			'$.limitations[0]'
		);
		assertInvalidAt(
			{
				...snapshot,
				limitations: [
					{ ...firstLimitation, capability: 'TS_TYPE', closureEffect: 'DEGRADES_CLOSURE' }
				]
			},
			'$.limitations[0]'
		);
		assertInvalidAt(
			{ ...snapshot, requestedCapabilities: ['TS_SYNTAX', 'TS_PROJECT'] },
			'$.requestedCapabilities'
		);
		assertInvalidAt(
			{
				...snapshot,
				capabilities: snapshot.capabilities.map((entry) =>
					entry.capability === 'TS_PROJECT' ? { ...entry, reason: '' } : entry
				)
			},
			'$.capabilities'
		);
		assertInvalidAt(
			{
				...snapshot,
				projects: snapshot.projects.map((project) => ({ ...project, id: 'semantic:wrong-project' }))
			},
			'$.projects[0].id'
		);
		assertInvalidAt(
			{ ...snapshot, programs: [snapshot.programs[0]!, snapshot.programs[0]!] },
			'$.programs'
		);

		assertInvalidAt(snapshot, '$validationContext.frozenSubject.descriptor.subjectId', {
			frozenSubject: {
				...FROZEN_CONTEXT.frozenSubject!,
				descriptor: { ...FROZEN_CONTEXT.frozenSubject!.descriptor, subjectId: 'f'.repeat(64) }
			}
		});
		const twoWorkspaceContext: SemanticValidationContext = {
			frozenSubject: {
				...FROZEN_CONTEXT.frozenSubject!,
				workspaces: [
					{
						exports: [],
						kind: 'PACKAGE',
						manifestPath: 'packages/long/package.json',
						name: '@fixture/long',
						path: 'packages/long',
						private: true,
						provenance: [],
						workspacePatterns: ['packages/*']
					},
					{
						exports: [],
						kind: 'PACKAGE',
						manifestPath: 'packages/x/package.json',
						name: 'x',
						path: 'packages/x',
						private: true,
						provenance: [],
						workspacePatterns: ['packages/*']
					}
				]
			}
		};
		expect(validateSnapshot(snapshot, {}, twoWorkspaceContext).state).toBe('VALID');

		const diagnosticSnapshot = withSourceDiagnostics(snapshot, ['2322'], true);
		const diagnostic = diagnosticSnapshot.diagnostics[0]!;
		for (const [changed, path] of [
			[
				{ ...diagnostic, message: { ...diagnostic.message, text: '', textLength: 0 } },
				'$.diagnostics[0].message'
			],
			[
				{ ...diagnostic, message: { ...diagnostic.message, category: 'ERROR', code: null } },
				'$.diagnostics[0].message'
			],
			[
				{ ...diagnostic, message: { ...diagnostic.message, textSha256: 'bad' } },
				'$.diagnostics[0].message.textSha256'
			],
			[
				{ ...diagnostic, message: { ...diagnostic.message, next: [diagnosticMessage('nested')] } },
				'$.diagnostics[0].id'
			],
			[{ ...diagnostic, projectId: 'semantic:project-missing' }, '$.diagnostics[0].projectId'],
			[{ ...diagnostic, start: 2, end: 1 }, '$.diagnostics[0]']
		] as const)
			assertInvalidAt({ ...diagnosticSnapshot, diagnostics: [changed] }, path);

		const projectProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_PROJECT' && record.sourceId === null
		)!;
		const sourceProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_PROJECT' && record.sourceId !== null
		)!;
		const mutateProvenance = (
			targetId: string,
			mutate: (record: SemanticFactProvenanceRecord) => SemanticFactProvenanceRecord
		) => ({
			...snapshot,
			provenances: snapshot.provenances.map((record) =>
				record.id === targetId ? mutate(record) : record
			)
		});
		assertInvalidAt(
			mutateProvenance(projectProvenance.id, (record) => ({
				...record,
				provider: { ...record.provider, version: '5.9.2' } as unknown as typeof record.provider
			})),
			expect.stringMatching(/^\$\.provenances\[\d+\]\.provider$/u)
		);
		assertInvalidAt(
			mutateProvenance(projectProvenance.id, (record) => ({
				...record,
				invalidationDependencies: record.invalidationDependencies.slice(1)
			})),
			expect.stringMatching(
				/^\$\.provenances\[\d+\]\.invalidationDependencies$/u
			) as unknown as string
		);
		assertInvalidAt(
			mutateProvenance(projectProvenance.id, (record) => ({
				...record,
				parentProvenanceId: sourceProvenance.id
			})),
			expect.stringMatching(/^\$\.provenances\[\d+\]\.parentProvenanceId$/u) as unknown as string
		);
		assertInvalidAt(
			mutateProvenance(sourceProvenance.id, (record) => ({
				...record,
				sourceId: `semantic:source-${'f'.repeat(64)}` as typeof record.sourceId
			})),
			expect.stringMatching(/^\$\.provenances\[\d+\]\.sourceId$/u)
		);

		const project = snapshot.projects[0]!;
		assertInvalidAt(
			{ ...snapshot, projects: [{ ...project, projectReferences: ['missing/tsconfig.json'] }] },
			'$.projects[0].projectReferences'
		);
		assertInvalidAt(
			{
				...snapshot,
				projects: [{ ...project, rootNames: [...project.rootNames, ...project.rootNames] }]
			},
			'$.projects[0]'
		);
		assertInvalidAt(
			{
				...snapshot,
				projects: [{ ...project, kind: 'PROJECT', rootDisposition: 'INTENTIONAL_EMPTY_SOLUTION' }]
			},
			'$.projects[0].rootDisposition'
		);
		assertInvalidAt(
			{
				...snapshot,
				projects: [
					{
						...project,
						partialityReasons: [
							{
								capability: 'TS_PROJECT',
								code: 'TYPESCRIPT_PROJECT_PARTIAL',
								message: 'partial',
								path: project.configPath
							}
						]
					}
				]
			},
			'$.projects[0].partialityReasons'
		);
		assertInvalidAt(
			{ ...snapshot, projects: [{ ...project, programId: `semantic:program-${'f'.repeat(64)}` }] },
			'$.projects[0].programId'
		);

		const program = snapshot.programs[0]!;
		assertInvalidAt(
			{ ...snapshot, programs: [{ ...program, projectId: `semantic:project-${'f'.repeat(64)}` }] },
			'$.programs[0].id'
		);
		assertInvalidAt(
			{ ...snapshot, programs: [{ ...program, sourceIds: [] }] },
			'$.programs[0].sourceIds'
		);
		assertInvalidAt(
			{ ...snapshot, programs: [{ ...program, rootSourceIds: [] }] },
			'$.programs[0].rootSourceIds'
		);

		const present = snapshot.compilerInputs[0]!;
		assertInvalidAt(
			{ ...snapshot, compilerInputs: [{ ...present, resultDigest: 'bad' }] },
			'$.compilerInputs[0].resultDigest'
		);
		assertInvalidAt(
			{ ...snapshot, compilerInputs: [{ ...present, contentSha256: 'bad' }] },
			'$.compilerInputs[0]'
		);
		const directory = directoryObservation(
			'src',
			'READ_DIRECTORY',
			'DIRECTORY',
			['src/index.ts'],
			1
		);
		assertInvalidAt(
			{ ...snapshot, compilerInputs: [{ ...directory, resultEntries: ['z.ts', 'a.ts'] }] },
			'$.compilerInputs[0].resultEntries'
		);
		assertInvalidAt(
			{ ...snapshot, compilerInputs: [{ ...directory, excludes: ['z', 'a'] }] },
			'$.compilerInputs[0]'
		);
		assertInvalidAt(
			{
				...snapshot,
				compilerInputs: [
					{ ...directory, includes: ['x'.repeat(snapshot.budgets.maxPathCharacters + 1)] }
				]
			},
			'$.compilerInputs[0]'
		);

		const compilerObservation = (payload: Record<string, unknown>): CompilerInputObservation => {
			const resultDigest = compilerInputResultDigest(payload as never);
			return {
				...payload,
				id: semanticContextInputId({ ...payload, resultDigest, subjectId: SUBJECT_ID } as never),
				resultDigest
			} as unknown as CompilerInputObservation;
		};
		const currentDirectory = compilerObservation({
			invocationCount: 1,
			logicalPath: 'src',
			operation: 'CURRENT_DIRECTORY',
			origin: 'CONFIGURATION',
			resolvedLogicalPath: 'src',
			result: 'RESOLVED'
		});
		assertInvalidAt({ ...snapshot, compilerInputs: [currentDirectory] }, '$.compilerInputs[0]');
		const caseSensitivity = compilerObservation({
			invocationCount: 1,
			logicalPath: 'src',
			operation: 'USE_CASE_SENSITIVE_FILE_NAMES',
			origin: 'CONFIGURATION',
			result: 'CASE_INSENSITIVE'
		});
		assertInvalidAt(
			{ ...snapshot, compilerInputs: [caseSensitivity] },
			'$.compilerInputs[0].logicalPath'
		);
	});

	it('fails closed when option, wire, or semantic inspection throws', () => {
		const snapshot = fixture();
		const actualByteLength = Buffer.byteLength.bind(Buffer);

		const ownKeys = vi.spyOn(Reflect, 'ownKeys').mockImplementationOnce(() => {
			throw new Error('option keys unavailable');
		});
		const optionResult = validateStaticSemanticSnapshot(
			snapshot,
			{ maxIssues: 10 },
			FROZEN_CONTEXT
		);
		ownKeys.mockRestore();
		expect(optionResult).toEqual({
			issues: [
				{
					code: 'INVALID_SHAPE',
					message: 'Semantic validation option inspection failed closed: option keys unavailable',
					path: '$validationOptions'
				}
			],
			state: 'INVALID'
		});

		const wireBytes = vi.spyOn(Buffer, 'byteLength').mockImplementationOnce(() => {
			throw new Error('wire bytes unavailable');
		});
		const wireResult = validateSnapshot({
			...snapshot,
			capabilities: snapshot.capabilities.map((capability) =>
				capability.capability === 'TS_PROJECT'
					? { ...capability, reason: 'Unicode \u00e9vidence.' }
					: capability
			)
		});
		wireBytes.mockRestore();
		expect(wireResult).toEqual({
			issues: [
				{
					code: 'INVALID_SHAPE',
					message: 'Semantic wire inspection failed closed: wire bytes unavailable',
					path: '$'
				}
			],
			state: 'INVALID'
		});

		const compilerInputJson = canonicalSemanticJson(snapshot.compilerInputs);
		vi.spyOn(Buffer, 'byteLength').mockImplementation((value, encoding) => {
			if (value === compilerInputJson) throw new Error('semantic bytes unavailable');
			return actualByteLength(value, encoding);
		});
		expect(validateSnapshot(snapshot)).toEqual({
			issues: [
				{
					code: 'INVALID_SHAPE',
					message: 'Malformed semantic snapshot: semantic bytes unavailable',
					path: '$'
				}
			],
			state: 'INVALID'
		});
	});

	it('rejects reachable provenance, recipe, project, Program, and source inconsistencies', () => {
		const snapshot = fixture();
		const expectIssue = (value: unknown, path: string | RegExp, message?: string): void => {
			const result = validateSnapshot(value);
			expect(result.state).toBe('INVALID');
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						...(message === undefined ? {} : { message }),
						path: typeof path === 'string' ? path : expect.stringMatching(path)
					})
				])
			);
		};
		const absentProvenanceId = snapshot.provenances[0]!.id.replace(
			/[0-9a-f]{64}$/u,
			'f'.repeat(64)
		) as SemanticProvenanceId;
		expectIssue(
			{
				...snapshot,
				projects: snapshot.projects.map((project) => ({
					...project,
					provenanceId: absentProvenanceId
				}))
			},
			'$.projects[0].provenanceId',
			'Fact references absent provenance.'
		);

		const projectProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_PROJECT' && record.sourceId === null
		)!;
		const limitationZ = {
			capability: 'TS_PROJECT' as const,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason: 'Z limitation.',
			region: 'z-region'
		};
		const limitationA = {
			capability: 'TS_PROJECT' as const,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason: 'A limitation.',
			region: 'a-region'
		};
		expectIssue(
			{
				...snapshot,
				provenances: snapshot.provenances.map((record) =>
					record.id === projectProvenance.id
						? { ...record, limitations: [limitationZ, limitationA] }
						: record
				)
			},
			/^\$\.provenances\[\d+\]\.limitations$/u,
			'Provenance limitations must be a canonical set.'
		);
		expectIssue(
			{
				...snapshot,
				provenances: snapshot.provenances.map((record) =>
					record.id === projectProvenance.id
						? {
								...record,
								limitations: [
									{ capability: 'TS_SYNTAX', closureEffect: 'FATAL', reason: '', region: '' }
								]
							}
						: record
				)
			},
			/^\$\.provenances\[\d+\]\.limitations\[0\]$/u,
			'Provenance limitation must name the capability and non-empty region and reason.'
		);
		expectIssue(
			{
				...snapshot,
				provenances: snapshot.provenances.map((record) =>
					record.id === projectProvenance.id
						? {
								...record,
								limitations: [
									{
										capability: 'TS_PROJECT',
										closureEffect: 'FATAL',
										reason: 'Fatal.',
										region: 'project'
									}
								]
							}
						: record
				)
			},
			/^\$\.provenances\[\d+\]\.limitations\[0\]\.closureEffect$/u,
			'Fatal provenance must not be emitted.'
		);

		const project = snapshot.projects[0]!;
		expectIssue(
			{
				...snapshot,
				projects: [
					{
						...project,
						programRecipe: { ...project.programRecipe, rootNames: ['z.ts', 'a.ts'] }
					}
				]
			},
			'$.projects[0].programRecipe',
			'ProgramRecipe roots and references must be canonical sets.'
		);
		expectIssue(
			{
				...snapshot,
				projects: [
					{
						...project,
						partialityReasons: [
							{
								capability: 'TS_SYNTAX',
								code: 'FRAMEWORK_CANDIDATES_UNSUPPORTED',
								message: 'Z syntax limitation.',
								path: null
							},
							{
								capability: 'TS_PROJECT',
								code: 'COMPILER_CONTEXT_UNAVAILABLE',
								message: '',
								path: null
							}
						]
					}
				]
			},
			'$.projects[0].partialityReasons',
			'Project partiality reasons must be a canonical set.'
		);
		expectIssue(
			{
				...snapshot,
				projects: [
					{
						...project,
						partialityReasons: [
							{
								capability: 'TS_TYPE',
								code: 'CAPABILITY_UNSUPPORTED',
								message: '',
								path: null
							}
						]
					}
				]
			},
			'$.projects[0].partialityReasons[0]',
			'Partiality reason must name a requested capability and a non-empty message.'
		);

		const program = snapshot.programs[0]!;
		expectIssue(
			{
				...snapshot,
				programs: [{ ...program, sourceIds: [...program.sourceIds, ...program.sourceIds] }]
			},
			'$.programs[0]',
			'Program manifests must be canonical sets.'
		);
		const source = snapshot.sources[0]!;
		expectIssue(
			{
				...snapshot,
				sources: [
					{
						...source,
						artifactRoles: [...source.artifactRoles].reverse(),
						contentSha256: 'not-a-digest',
						mapping: { reason: 'Mapping is incomplete.', state: 'PARTIAL' }
					}
				]
			},
			'$.sources[0]',
			'Source byte and digest metadata is invalid.'
		);
		expectIssue(
			{
				...snapshot,
				sources: [{ ...source, artifactRoles: [...source.artifactRoles].reverse() }]
			},
			'$.sources[0]',
			'Source roles and diagnostic manifests must be closed canonical sets.'
		);
		expectIssue(
			{
				...snapshot,
				sources: [{ ...source, mapping: { reason: 'Mapping is incomplete.', state: 'PARTIAL' } }]
			},
			'$.sources[0].provenanceId',
			'Unknown or lossy source mapping requires partial TS_PROJECT provenance with its matching closure-degrading limitation and unresolved region.'
		);
	});

	it('accepts a compiler source bound to an exact workspace-package root alias', () => {
		const aliasPath = 'node_modules/@scope/example';
		const artifactPath = 'packages/example';
		const snapshot = fixture(aliasPath);
		const context = contextForSnapshot(snapshot, artifactPath, [
			{
				exports: [],
				kind: 'PACKAGE',
				manifestPath: 'packages/example/package.json',
				name: '@scope/example',
				path: artifactPath,
				private: false,
				provenance: ['packages/example/package.json'],
				workspacePatterns: ['packages/*']
			}
		]);
		expect(validateSnapshot(snapshot, {}, context)).toEqual({ issues: [], state: 'VALID' });
	});

	it('rejects reachable AST and declaration-candidate semantic inconsistencies', () => {
		const ast = withAstNode(fixture('src/index.ts', 'x'), {
			end: 1,
			kind: ts.SyntaxKind.Identifier,
			kindName: 'Identifier'
		});
		const child = ast.astNodes.find((node) => node.kind === ts.SyntaxKind.Identifier)!;
		const root = ast.astNodes.find((node) => node.parentId === null)!;
		const expectAstIssue = (value: unknown, message: string, code = 'INVALID_VALUE'): void => {
			expect(validateSnapshot(value, {}, contextForSnapshot(ast)).issues).toEqual(
				expect.arrayContaining([expect.objectContaining({ code, message })])
			);
		};
		expectAstIssue(
			{
				...ast,
				astNodes: ast.astNodes.map((node) =>
					node.id === child.id ? { ...node, fullStart: 1, start: 0 } : node
				)
			},
			'Node UTF-16 span is invalid.'
		);
		expectAstIssue(
			{
				...ast,
				astNodes: ast.astNodes.map((node) =>
					node.id === child.id ? { ...node, syntacticIdentifierText: null } : node
				)
			},
			'Syntactic identifier text, including a recovered empty text, must be present exactly for Identifier and PrivateIdentifier nodes.'
		);
		expectAstIssue(
			{
				...ast,
				astNodes: ast.astNodes.map((node) =>
					node.id === child.id ? { ...node, operatorName: 'EqualsToken' } : node
				)
			},
			'AST operator code and name must be present together and agree with the public TypeScript enum.'
		);
		expectAstIssue(
			{
				...ast,
				astNodes: ast.astNodes.map((node) =>
					node.id === child.id ? { ...node, hasAssignmentInitializer: true } : node
				)
			},
			'Only the exact TypeScript syntax kinds with assignment initializers may assert one.'
		);
		expectAstIssue(
			{
				...ast,
				astNodes: ast.astNodes.map((node) =>
					node.id === child.id
						? { ...node, operatorKind: ts.SyntaxKind.EqualsToken, operatorName: 'EqualsToken' }
						: node
				)
			},
			'Only retained operator-bearing expression nodes may carry an operator.'
		);
		expectAstIssue(
			{
				...ast,
				astNodes: ast.astNodes.map((node) => (node.id === root.id ? { ...node, end: 0 } : node))
			},
			'Parent is from another source or does not contain the child.',
			'CROSS_PROJECT_REFERENCE'
		);

		const binaryAst = withAstNode(fixture(), {
			kind: ts.SyntaxKind.BinaryExpression,
			kindName: 'BinaryExpression',
			operatorKind: ts.SyntaxKind.EqualsToken,
			operatorName: 'EqualsToken'
		});
		const binary = binaryAst.astNodes.find((node) => node.kind === ts.SyntaxKind.BinaryExpression)!;
		expect(
			validateSnapshot({
				...binaryAst,
				astNodes: binaryAst.astNodes.map((node) =>
					node.id === binary.id ? { ...node, operatorKind: null, operatorName: null } : node
				)
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message:
						'Retained operator-bearing expression nodes require their public SyntaxKind operator.'
				})
			])
		);
		const misplacedName = withAstNode(fixture(), {
			kind: ts.SyntaxKind.Identifier,
			kindName: 'Identifier',
			structuralRoles: [AST_STRUCTURAL_ROLES.declarationName]
		});
		expect(validateSnapshot(misplacedName).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'Declaration-name roles require a declaration-candidate parent.'
				})
			])
		);

		const declarationAst = withAstNode(fixture(), {
			kind: ts.SyntaxKind.VariableDeclaration,
			kindName: 'VariableDeclaration'
		});
		const declaration = declarationAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclaration
		)!;
		const namedAst = withAstChild(
			declarationAst,
			declaration.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier', syntacticIdentifierText: 'value' },
			AST_STRUCTURAL_ROLES.declarationName
		);
		const name = namedAst.astNodes.find((node) => node.parentId === declaration.id)!;
		const candidate = {
			ambientSyntax: false,
			candidateRole: 'BINDING' as const,
			candidateState: 'SYNTAX_ONLY' as const,
			exportCarrierNodeId: null,
			exportSyntax: 'NONE' as const,
			id: semanticDeclarationCandidateId({
				candidateRole: 'BINDING',
				nodeId: declaration.id,
				syntaxKind: declaration.kind
			}),
			localModifiers: [],
			nameNodeId: name.id,
			nameState: 'ATOMIC' as const,
			nodeId: declaration.id,
			sourceId: declaration.sourceId,
			syntacticName: 'value',
			syntaxKind: declaration.kind,
			syntaxKindName: declaration.kindName
		};
		const candidateSnapshot: StaticSemanticSnapshot = {
			...namedAst,
			declarationCandidates: [candidate],
			populations: namedAst.populations.map((population) =>
				population.kind === 'DECLARATION_CANDIDATE'
					? semanticPopulation('DECLARATION_CANDIDATE', members([candidate.id]))
					: population
			)
		};
		expect(validateSnapshot(candidateSnapshot)).toEqual({ issues: [], state: 'VALID' });
		const absentNodeId = semanticNodeId({
			end: 0,
			fullStart: 0,
			kind: ts.SyntaxKind.VariableDeclaration,
			parentId: candidateSnapshot.astNodes.find((node) => node.parentId === null)!.id,
			siblingOrdinal: 99,
			sourceId: declaration.sourceId,
			start: 0,
			structuralRoles: [AST_STRUCTURAL_ROLES.genericChild]
		});
		const candidateProbes = [
			{
				candidate: { ...candidate, nodeId: absentNodeId },
				message: 'Declaration-candidate node belongs elsewhere or is absent.'
			},
			{
				candidate: {
					...candidate,
					id: candidate.id.replace(/[0-9a-f]{64}$/u, 'f'.repeat(64)) as typeof candidate.id
				},
				message: 'Declaration-candidate identity mismatch.'
			},
			{
				candidate: { ...candidate, nameState: 'ANONYMOUS' as const },
				message: 'Candidate name state must agree with its retained name node.'
			},
			{
				candidate: { ...candidate, syntacticName: '' },
				message: 'Only atomic candidate names carry non-empty syntactic text.'
			},
			{
				candidate: {
					...candidate,
					localModifiers: [
						{ code: ts.SyntaxKind.ExportKeyword, name: 'ExportKeyword' },
						{ code: ts.SyntaxKind.AsyncKeyword, name: 'AsyncKeyword' }
					]
				},
				message: 'Declaration-candidate local modifiers must be a canonical set.'
			},
			{
				candidate: {
					...candidate,
					localModifiers: [{ code: ts.SyntaxKind.ExportKeyword, name: 'DefaultKeyword' }]
				},
				message: 'Local modifier code and name must agree with the public TypeScript enum.'
			},
			{
				candidate: {
					...candidate,
					exportCarrierNodeId: declaration.id,
					exportSyntax: 'EXPLICIT' as const
				},
				message:
					'Export syntax and carrier must distinguish node-local syntax from the exact enclosing variable-statement carrier.'
			}
		];
		for (const probe of candidateProbes) {
			expect(
				validateSnapshot({ ...candidateSnapshot, declarationCandidates: [probe.candidate] }).issues
			).toEqual(expect.arrayContaining([expect.objectContaining({ message: probe.message })]));
		}
	});

	it('rejects reachable related-diagnostic and syntax-population inconsistencies', () => {
		const snapshot = fixture();
		const diagnosticSnapshot = withSourceDiagnostics(snapshot, ['2322'], true);
		const diagnostic = diagnosticSnapshot.diagnostics[0]!;
		const relatedA = {
			category: 'MESSAGE' as const,
			code: 'TS100',
			end: null,
			message: diagnosticMessage('A related diagnostic.'),
			path: null,
			start: null
		};
		const relatedZ = {
			category: 'MESSAGE' as const,
			code: 'TS900',
			end: null,
			message: diagnosticMessage('Z related diagnostic.'),
			path: null,
			start: null
		};
		const relatedProbes = [
			{
				diagnostic: { ...diagnostic, related: [{ ...relatedA, code: 'BAD' }] },
				message:
					'Related diagnostic code must be exactly TS followed by a positive decimal TypeScript code.'
			},
			{
				diagnostic: { ...diagnostic, related: [{ ...relatedA, end: 0, start: 0 }] },
				message: 'A related diagnostic span requires a logical path.'
			},
			{
				diagnostic: {
					...diagnostic,
					related: [{ ...relatedA, end: 0, path: 'src/index.ts', start: 1 }]
				},
				message: 'Related diagnostic span is invalid or outside its project source.'
			},
			{
				diagnostic: { ...diagnostic, related: [relatedZ, relatedA] },
				message:
					'Related diagnostic payloads must form a canonical sorted multiset; duplicates are retained.'
			}
		];
		for (const probe of relatedProbes) {
			expect(
				validateSnapshot({ ...diagnosticSnapshot, diagnostics: [probe.diagnostic] }).issues
			).toEqual(expect.arrayContaining([expect.objectContaining({ message: probe.message })]));
		}

		const root = snapshot.astNodes[0]!;
		const absentLiteralNodeId = semanticNodeId({
			end: 0,
			fullStart: 0,
			kind: ts.SyntaxKind.StringLiteral,
			parentId: root.id,
			siblingOrdinal: 99,
			sourceId: root.sourceId,
			start: 0,
			structuralRoles: [AST_STRUCTURAL_ROLES.genericChild]
		});
		const absentLiteral = {
			lexemeLength: 0,
			lexemeSha256: literalLexemeDigest(''),
			nodeId: absentLiteralNodeId,
			sourceId: root.sourceId,
			value: null,
			valueEncoding: 'UTF16_CODE_UNITS_LE' as const,
			valueLength: 0,
			valueSha256: literalValueDigest('UTF16_CODE_UNITS_LE', 'STRING', '\ud800'),
			valueState: 'DIGEST_ONLY' as const,
			valueType: 'STRING' as const
		};
		const absentLiteralResult = validateSnapshot({ ...snapshot, literals: [absentLiteral] });
		expect(absentLiteralResult.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Referenced node is absent.'
				}),
				expect.objectContaining({
					message:
						'UTF-16-code-unit literals must redact a non-scalar cooked string and retain its original code-unit length and digest.'
				})
			])
		);

		const callAst = withAstNode(snapshot, {
			kind: ts.SyntaxKind.CallExpression,
			kindName: 'CallExpression'
		});
		const callNode = callAst.astNodes.find((node) => node.kind === ts.SyntaxKind.CallExpression)!;
		const withCallee = withAstChild(
			callAst,
			callNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.invocationCallee
		);
		const callee = withCallee.astNodes.find((node) => node.parentId === callNode.id)!;
		const call = {
			...SYNTAX_ONLY_INVOCATION_TARGET,
			argumentNodeIds: [],
			calleeNodeId: callee.id,
			id: semanticInvocationSiteId({ invocationKind: 'CALL', nodeId: callNode.id }),
			invocationKind: 'CALL' as const,
			nodeId: callNode.id,
			optional: false,
			sourceId: callNode.sourceId,
			templateNodeId: null
		};
		const callSnapshot: StaticSemanticSnapshot = {
			...withCallee,
			invocations: [call],
			populations: withCallee.populations.map((population) =>
				population.kind === 'INVOCATION_SITE'
					? semanticPopulation('INVOCATION_SITE', members([call.id]))
					: population
			)
		};
		expect(
			validateSnapshot({
				...callSnapshot,
				invocations: [
					{ ...call, id: semanticInvocationSiteId({ invocationKind: 'NEW', nodeId: call.nodeId }) }
				]
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'IDENTITY_MISMATCH', path: '$.invocations[0].id' })
			])
		);
		const duplicateNodeInvocations = [
			call,
			{
				...call,
				id: semanticInvocationSiteId({ invocationKind: 'NEW', nodeId: call.nodeId }),
				invocationKind: 'NEW' as const
			}
		].sort((left, right) => (left.id < right.id ? -1 : 1));
		expect(
			validateSnapshot({ ...callSnapshot, invocations: duplicateNodeInvocations }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'DUPLICATE_ID', path: '$.invocations' })
			])
		);

		const assignmentAst = withAstNode(snapshot, {
			kind: ts.SyntaxKind.BinaryExpression,
			kindName: 'BinaryExpression',
			operatorKind: ts.SyntaxKind.EqualsToken,
			operatorName: 'EqualsToken'
		});
		const assignmentNode = assignmentAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.BinaryExpression
		)!;
		const withTarget = withAstChild(
			assignmentAst,
			assignmentNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.assignmentTarget,
			0
		);
		const target = withTarget.astNodes.find((node) => node.parentId === assignmentNode.id)!;
		const withValue = withAstChild(
			withTarget,
			assignmentNode.id,
			{ kind: ts.SyntaxKind.Identifier, kindName: 'Identifier' },
			AST_STRUCTURAL_ROLES.assignmentValue,
			1
		);
		const value = withValue.astNodes.find(
			(node) => node.parentId === assignmentNode.id && node.id !== target.id
		)!;
		const assignment = {
			assignmentKind: 'BINARY' as const,
			nodeId: assignmentNode.id,
			operatorKind: ts.SyntaxKind.EqualsToken,
			operatorName: 'EqualsToken',
			sourceId: assignmentNode.sourceId,
			targetNodeId: target.id,
			valueNodeId: value.id
		};
		const assignmentSnapshot: StaticSemanticSnapshot = {
			...withValue,
			assignments: [assignment],
			populations: withValue.populations.map((population) =>
				population.kind === 'ASSIGNMENT'
					? semanticPopulation('ASSIGNMENT', members([assignment.nodeId]))
					: population
			)
		};
		expect(
			validateSnapshot({
				...assignmentSnapshot,
				assignments: [{ ...assignment, assignmentKind: 'PREFIX_UPDATE' }]
			}).issues
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ path: '$.assignments[0].assignmentKind' })])
		);
		expect(
			validateSnapshot({ ...assignmentSnapshot, assignments: [assignment, assignment] }).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'NONCANONICAL_ORDER',
					message: 'Node-backed syntax projections must be unique canonical sets.'
				})
			])
		);

		const noncanonicalPopulation = {
			...snapshot,
			populations: snapshot.populations.map((population) =>
				population.kind === 'AST_NODE'
					? { ...population, members: { ...population.members, analyzed: [root.id, root.id] } }
					: population
			)
		};
		expect(validateSnapshot(noncanonicalPopulation).issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: 'NONCANONICAL_ORDER',
					path: expect.stringContaining('.members.analyzed')
				})
			])
		);
		expect(
			validateSnapshot({
				...snapshot,
				populations: snapshot.populations.filter((population) => population.kind !== 'LITERAL')
			}).issues
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: 'POPULATION_MISMATCH', path: '$.populations' })
			])
		);
	});

	it('rejects independently corrupted scope, declaration, symbol, alias, reference, and module graphs', () => {
		type Scope = StaticSemanticSnapshot['scopes'][number];
		type Declaration = StaticSemanticSnapshot['declarations'][number];
		type SymbolRecord = StaticSemanticSnapshot['symbols'][number];
		type Alias = StaticSemanticSnapshot['aliases'][number];
		type Reference = StaticSemanticSnapshot['references'][number];
		type ModuleResolution = StaticSemanticSnapshot['moduleResolutions'][number];
		type ModuleExport = StaticSemanticSnapshot['moduleExports'][number];

		const absent = (family: string): never => `semantic:${family}-${'f'.repeat(64)}` as never;
		const replaceScope = (
			snapshot: StaticSemanticSnapshot,
			select: (scope: Scope) => boolean,
			patch: Partial<Scope>
		): StaticSemanticSnapshot => ({
			...snapshot,
			scopes: snapshot.scopes.map((scope) => (select(scope) ? { ...scope, ...patch } : scope))
		});
		const replaceDeclaration = (
			snapshot: StaticSemanticSnapshot,
			patch: Partial<Declaration>
		): StaticSemanticSnapshot => ({
			...snapshot,
			declarations: [{ ...snapshot.declarations[0]!, ...patch }]
		});
		const replaceSymbol = (
			snapshot: StaticSemanticSnapshot,
			select: (symbol: SymbolRecord) => boolean,
			patch: Partial<SymbolRecord>
		): StaticSemanticSnapshot => ({
			...snapshot,
			symbols: snapshot.symbols.map((symbol) => (select(symbol) ? { ...symbol, ...patch } : symbol))
		});
		const replaceAlias = (
			snapshot: StaticSemanticSnapshot,
			patch: Partial<Alias>
		): StaticSemanticSnapshot => ({
			...snapshot,
			aliases: [{ ...snapshot.aliases[0]!, ...patch }]
		});
		const replaceReference = (
			snapshot: StaticSemanticSnapshot,
			patch: Partial<Reference>
		): StaticSemanticSnapshot => ({
			...snapshot,
			references: [{ ...snapshot.references[0]!, ...patch }]
		});
		const replaceResolution = (
			snapshot: StaticSemanticSnapshot,
			patch: Partial<ModuleResolution>
		): StaticSemanticSnapshot => ({
			...snapshot,
			moduleResolutions: [{ ...snapshot.moduleResolutions[0]!, ...patch }]
		});
		const replaceExport = (
			snapshot: StaticSemanticSnapshot,
			patch: Partial<ModuleExport>
		): StaticSemanticSnapshot => ({
			...snapshot,
			moduleExports: [{ ...snapshot.moduleExports[0]!, ...patch }]
		});
		const reparentNode = (
			snapshot: StaticSemanticSnapshot,
			nodeId: StaticSemanticSnapshot['astNodes'][number]['id'],
			parentId: StaticSemanticSnapshot['astNodes'][number]['parentId']
		): StaticSemanticSnapshot => ({
			...snapshot,
			astNodes: snapshot.astNodes.map((node) => (node.id === nodeId ? { ...node, parentId } : node))
		});
		const expectIssue = (
			label: string,
			snapshot: StaticSemanticSnapshot,
			message: string,
			overrides: Partial<SemanticValidationOptions> = {}
		): void => {
			const result = validateSnapshot(snapshot, overrides, contextForSnapshot(snapshot));
			expect(result.state, label).not.toBe('VALID');
			expect(
				result.issues.some((issue) => issue.message === message),
				`${label}: ${result.issues.map((issue) => issue.message).join(' | ')}`
			).toBe(true);
		};

		const scoped = fixture('src/index.ts', ' '.repeat(64));
		const globalScope = scoped.scopes.find((scope) => scope.kind === 'PROGRAM_GLOBAL')!;
		const sourceScope = scoped.scopes.find((scope) => scope.sourceId !== null)!;
		for (const probe of [
			{
				label: 'scope identity',
				message: 'Scope identity mismatch.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					id: absent('scope')
				})
			},
			{
				label: 'global domain',
				message: 'Program-global scope must use the LEXICAL domain.',
				snapshot: replaceScope(scoped, (scope) => scope.id === globalScope.id, {
					domain: 'MIXED'
				})
			},
			{
				label: 'global invented span',
				message: 'Program-global scope must not invent a source, parent, owner, or span.',
				snapshot: replaceScope(scoped, (scope) => scope.id === globalScope.id, { start: 0 })
			},
			{
				label: 'missing scope source',
				message: 'Lexical scope source is absent.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					sourceId: absent('source')
				})
			},
			{
				label: 'cross-project scope source and parent',
				message: 'Lexical scope source belongs to another project or Program.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					projectId: absent('project')
				})
			},
			{
				label: 'scope span',
				message: 'Lexical-scope UTF-16 span is invalid.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					start: 65
				})
			},
			{
				label: 'scope owner kind name',
				message: 'Scope owner kind code and name must agree with the public TypeScript enum.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					ownerKindName: 'Identifier'
				})
			},
			{
				label: 'source file with non-root scope kind',
				message: 'Only a source-root scope may be owned by a SourceFile.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					kind: 'FUNCTION'
				})
			},
			{
				label: 'source-root extent',
				message:
					'Source-root scope must reproduce the source module role and terminal source extent.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, { end: 63 })
			},
			{
				label: 'missing scope parent',
				message: 'Lexical scope parent is absent.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					parentScopeId: absent('scope')
				})
			},
			{
				label: 'cross-project scope parent',
				message: 'Lexical scope parent belongs to another project or Program.',
				snapshot: replaceScope(scoped, (scope) => scope.id === sourceScope.id, {
					projectId: absent('project')
				})
			},
			{
				label: 'missing source-root scope',
				message: 'Every Program source requires exactly one source-root lexical scope.',
				snapshot: {
					...scoped,
					scopes: scoped.scopes.filter((scope) => scope.id !== sourceScope.id)
				}
			}
		])
			expectIssue(probe.label, probe.snapshot, probe.message);

		const rich = withSymbolFacts();
		const declaration = rich.declarations[0]!;
		const candidate = rich.declarationCandidates[0]!;
		const targetSymbol = rich.symbols.find((symbol) => symbol.identityBasis === 'DECLARATIONS')!;
		const aliasSymbol = rich.symbols.find(
			(symbol) => symbol.identityBasis === 'REFERENCE_FALLBACK'
		)!;
		const reference = rich.references[0]!;
		const resolution = rich.moduleResolutions[0]!;
		const moduleExport = rich.moduleExports[0]!;
		const richSourceScope = rich.scopes.find((scope) => scope.sourceId !== null)!;
		const crossSource = withContextSource(rich, 'context/other.d.ts', ' ');
		const contextScope = crossSource.scopes.find(
			(scope) => scope.sourceId !== null && scope.sourceId !== rich.sources[0]!.id
		)!;
		const contextSource = crossSource.sources.find((source) => source.id !== rich.sources[0]!.id)!;
		const nestedAcrossSources = replaceScope(
			crossSource,
			(scope) => scope.id === richSourceScope.id,
			{ parentScopeId: contextScope.id }
		);
		const nestedAcrossSourcesResult = validateSnapshot(
			nestedAcrossSources,
			{},
			contextForSnapshot(nestedAcrossSources)
		);
		expect(nestedAcrossSourcesResult.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'Nested lexical scope and parent must share a source.'
				}),
				expect.objectContaining({
					message: 'Nested lexical-scope span must be contained by its parent.'
				})
			])
		);

		for (const probe of [
			{
				label: 'invalid durable declaration identity',
				message: 'Invalid durable declaration identity.',
				snapshot: replaceDeclaration(rich, { durableId: 'invalid' as never })
			},
			{
				label: 'missing declaration source',
				message: 'Declaration source is absent.',
				snapshot: replaceDeclaration(rich, { sourceId: absent('source') })
			},
			{
				label: 'missing declaration scope',
				message: 'Referenced lexical scope is absent.',
				snapshot: replaceDeclaration(rich, { declaringScopeId: absent('scope') })
			},
			{
				label: 'declaration scope from another source',
				message: 'Referenced lexical scope is outside the fact source and Program.',
				snapshot: replaceDeclaration(crossSource, { declaringScopeId: contextScope.id })
			},
			{
				label: 'declaration span',
				message: 'Declaration UTF-16 span is invalid.',
				snapshot: replaceDeclaration(rich, { end: 10, start: 11 })
			},
			{
				label: 'declaration kind name',
				message: 'Declaration kind code and name must agree with the public TypeScript enum.',
				snapshot: replaceDeclaration(rich, { kindName: 'Identifier' })
			},
			{
				label: 'empty atomic declaration name',
				message: 'Only an atomic declaration name may carry non-empty text.',
				snapshot: replaceDeclaration(rich, { name: '' })
			},
			{
				label: 'missing declaration node',
				message: 'Declaration node is absent.',
				snapshot: replaceDeclaration(rich, { nodeId: absent('node') })
			},
			{
				label: 'mismatched declaration node',
				message: 'Declaration node must reproduce the same source, kind, and span.',
				snapshot: replaceDeclaration(rich, { nodeId: reference.nodeId })
			},
			{
				label: 'missing declaration candidate',
				message: 'Declaration candidate is absent.',
				snapshot: replaceDeclaration(rich, { candidateId: absent('decl-candidate') })
			},
			{
				label: 'mismatched declaration candidate',
				message: 'Declaration candidate must bind the same source, node, and name state.',
				snapshot: {
					...rich,
					declarationCandidates: [
						{
							...candidate,
							nameNodeId: null,
							nameState: 'ANONYMOUS' as const,
							syntacticName: null
						}
					]
				}
			},
			{
				label: 'declaration ambient state',
				message: 'Declaration ambient state must reproduce its source and syntax candidate.',
				snapshot: replaceDeclaration(rich, { ambient: true })
			},
			{
				label: 'durable declaration digest',
				message: 'Durable declaration identity mismatch.',
				snapshot: replaceDeclaration(rich, { durableId: absent('declaration-durable') })
			},
			{
				label: 'atomic literal candidate without literal evidence',
				message:
					'Atomic literal names must retain the exact scalar-safe source lexeme bound by the literal lexeme digest.',
				snapshot: {
					...rich,
					astNodes: rich.astNodes.map((node) =>
						node.id === candidate.nameNodeId ? { ...node, syntacticIdentifierText: null } : node
					)
				}
			}
		])
			expectIssue(probe.label, probe.snapshot, probe.message);

		const foreignProject = { ...rich.projects[0]!, id: absent('project') };
		const mismatchedSymbolOwnership = replaceSymbol(
			{
				...rich,
				projects: [...rich.projects, foreignProject].sort((left, right) =>
					left.id < right.id ? -1 : 1
				)
			},
			(symbol) => symbol.id === targetSymbol.id,
			{ projectId: foreignProject.id }
		);
		expectIssue(
			'symbol Program/project disagreement',
			mismatchedSymbolOwnership,
			'Symbol project and Program disagree.'
		);

		const fallbackCrossProject = {
			...crossSource,
			astNodes: crossSource.astNodes.map((node) =>
				node.id === reference.nodeId ? { ...node, sourceId: contextSource.id } : node
			),
			sources: crossSource.sources.map((source) =>
				source.id === contextSource.id ? { ...source, projectId: absent('project') } : source
			)
		};
		expectIssue(
			'fallback reference node outside project',
			fallbackCrossProject,
			'Symbol fallback reference node belongs to another project.'
		);

		for (const probe of [
			{
				label: 'symbol outside the source project',
				message: 'Referenced symbol belongs to another project.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === targetSymbol.id, {
					projectId: absent('project')
				})
			},
			{
				label: 'symbol missing project',
				message: 'Symbol project or Program is absent.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === targetSymbol.id, {
					projectId: absent('project')
				})
			},
			{
				label: 'empty symbol name',
				message: 'Symbol name and public flag mask must be valid.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === targetSymbol.id, { name: '' })
			},
			{
				label: 'noncanonical symbol sets',
				message: 'Symbol declaration, fallback-reference, and flag-name sets must be canonical.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === aliasSymbol.id, {
					flagNames: ['Alias', 'Alias']
				})
			},
			{
				label: 'symbol identity basis',
				message: 'Symbol identity basis must agree with its declaration or fallback-reference set.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === aliasSymbol.id, {
					identityBasis: 'DECLARATIONS'
				})
			},
			{
				label: 'symbol merge state',
				message: 'Symbol merge state must be derived from its declarations.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === targetSymbol.id, {
					mergeState: 'MERGED'
				})
			},
			{
				label: 'missing fallback node',
				message: 'Symbol fallback reference node is absent.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === aliasSymbol.id, {
					fallbackReferenceNodeIds: [absent('node')]
				})
			},
			{
				label: 'foreign value declaration',
				message: 'Value declaration must belong to the symbol declaration set.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === targetSymbol.id, {
					valueDeclarationId: absent('declaration')
				})
			},
			{
				label: 'symbol digest',
				message: 'Symbol identity mismatch.',
				snapshot: replaceSymbol(rich, (symbol) => symbol.id === targetSymbol.id, {
					id: absent('symbol')
				})
			},
			{
				label: 'missing alias symbol',
				message: 'Alias symbol is absent.',
				snapshot: replaceAlias(rich, { aliasSymbolId: absent('symbol') })
			},
			{
				label: 'non-alias owner',
				message: 'Alias record must bind a TypeScript alias symbol.',
				snapshot: replaceAlias(rich, { aliasSymbolId: targetSymbol.id })
			},
			{
				label: 'alias state',
				message: 'Alias state and target identities disagree.',
				snapshot: replaceAlias(rich, { state: 'UNRESOLVED' })
			},
			{
				label: 'alias digest',
				message: 'Alias identity mismatch.',
				snapshot: replaceAlias(rich, { id: absent('alias') })
			}
		])
			expectIssue(probe.label, probe.snapshot, probe.message);

		for (const probe of [
			{
				label: 'missing reference source',
				message: 'Reference source is absent.',
				snapshot: replaceReference(rich, { sourceId: absent('source') })
			},
			{
				label: 'missing reference scope',
				message: 'Referenced lexical scope is absent.',
				snapshot: replaceReference(rich, { containingScopeId: absent('scope') })
			},
			{
				label: 'reference scope from another source',
				message: 'Referenced lexical scope is outside the fact source and Program.',
				snapshot: replaceReference(crossSource, { containingScopeId: contextScope.id })
			},
			{
				label: 'declaration-name role on an ordinary reference',
				message: 'Declaration-name reference must bind a retained declaration-name node.',
				snapshot: replaceReference(rich, { role: 'DECLARATION_NAME' })
			}
		])
			expectIssue(probe.label, probe.snapshot, probe.message);

		const crossProjectTarget = {
			...crossSource,
			sources: crossSource.sources.map((source) =>
				source.id === contextSource.id ? { ...source, projectId: absent('project') } : source
			)
		};
		for (const probe of [
			{
				label: 'missing literal specifier',
				message: 'Literal module occurrence requires its exact specifier text.',
				snapshot: replaceResolution(rich, { specifier: null })
			},
			{
				label: 'invented nonliteral specifier',
				message: 'Nonliteral module occurrence cannot invent a specifier text.',
				snapshot: replaceResolution(rich, { specifierState: 'NON_LITERAL' })
			},
			{
				label: 'nonliteral static import',
				message: 'Nonliteral module occurrences must be unsupported dynamic imports.',
				snapshot: replaceResolution(rich, { specifierState: 'NON_LITERAL' })
			},
			{
				label: 'runtime import type',
				message: 'ImportType module occurrences must be type-only.',
				snapshot: replaceResolution(rich, {
					occurrenceKind: 'IMPORT_TYPE',
					typeOnly: false
				})
			},
			{
				label: 'type-only dynamic import',
				message: 'Dynamic imports are runtime module occurrences.',
				snapshot: replaceResolution(rich, {
					occurrenceKind: 'DYNAMIC_IMPORT',
					typeOnly: true
				})
			},
			{
				label: 'missing module source',
				message: 'Module occurrence source is absent.',
				snapshot: replaceResolution(rich, { sourceId: absent('source') })
			},
			{
				label: 'missing module target',
				message: 'Resolved module source is absent.',
				snapshot: replaceResolution(rich, { targetSourceId: absent('source') })
			},
			{
				label: 'module target outside project',
				message: 'Resolved module source belongs to another project context.',
				snapshot: replaceResolution(crossProjectTarget, {
					targetSourceId: contextSource.id
				})
			},
			{
				label: 'module resolution state',
				message: 'Module-resolution state and resolved targets disagree.',
				snapshot: replaceResolution(rich, { resolutionState: 'UNRESOLVED' })
			},
			{
				label: 'module resolution digest',
				message: 'Module-resolution identity mismatch.',
				snapshot: replaceResolution(rich, { id: absent('module-resolution') })
			}
		])
			expectIssue(probe.label, probe.snapshot, probe.message);

		for (const probe of [
			{
				label: 'missing module-export source',
				message: 'Module-export source is absent.',
				snapshot: replaceExport(rich, { sourceId: absent('source') })
			},
			{
				label: 'empty export name',
				message: 'Module-export name must be non-empty.',
				snapshot: replaceExport(rich, { exportName: '' })
			},
			{
				label: 'duplicate source export name',
				message: 'A source may expose at most one binding per export name.',
				snapshot: { ...rich, moduleExports: [moduleExport, moduleExport] }
			},
			{
				label: 'module export target',
				message: 'Module-export state and target symbol disagree.',
				snapshot: replaceExport(rich, { state: 'DIRECT' })
			},
			{
				label: 'module export digest',
				message: 'Module-export identity mismatch.',
				snapshot: replaceExport(rich, { id: absent('module-export') })
			}
		])
			expectIssue(probe.label, probe.snapshot, probe.message);

		const noSyntaxRequest = {
			...rich,
			requestedCapabilities: [
				'TS_PROJECT',
				'TS_SYMBOL'
			] as StaticSemanticSnapshot['requestedCapabilities']
		};
		expectIssue(
			'unknown requested capability',
			{
				...rich,
				requestedCapabilities: [...rich.requestedCapabilities, 'TS_CFG'] as never
			},
			'Unknown capability TS_CFG.'
		);
		expectIssue(
			'syntax facts without capability',
			noSyntaxRequest,
			'TS_SYNTAX records cannot be emitted when syntax was not requested.'
		);
		let conditional = withAstNode(scoped, {
			end: 20,
			kind: ts.SyntaxKind.ConditionalType,
			kindName: 'ConditionalType',
			start: 0
		});
		const conditionalNode = conditional.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.ConditionalType
		)!;
		conditional = withAstChild(conditional, conditionalNode.id, {
			end: 10,
			kind: ts.SyntaxKind.InferType,
			kindName: 'InferType',
			start: 0
		});
		expect(validateSnapshot(conditional, {}, contextForSnapshot(conditional))).toEqual({
			issues: [],
			state: 'VALID'
		});

		const detachedReference = reparentNode(rich, reference.nodeId, absent('node'));
		expectIssue('detached reference ancestry', detachedReference, 'Parent node is absent.');

		let globalVariable = withAstNode(rich, {
			end: 10,
			kind: ts.SyntaxKind.VariableDeclarationList,
			kindName: 'VariableDeclarationList',
			start: 0
		});
		const globalVariableList = globalVariable.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclarationList
		)!;
		globalVariable = reparentNode(globalVariable, declaration.nodeId!, globalVariableList.id);
		const globalVariableResult = validateSnapshot(
			globalVariable,
			{},
			contextForSnapshot(globalVariable)
		);
		expect(globalVariableResult.state).toBe('INVALID');

		let functionVariable = withAstNode(rich, {
			end: 20,
			kind: ts.SyntaxKind.FunctionDeclaration,
			kindName: 'FunctionDeclaration',
			start: 0
		});
		const functionNode = functionVariable.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.FunctionDeclaration
		)!;
		functionVariable = withScopeForNode(functionVariable, functionNode.id);
		functionVariable = withAstChild(functionVariable, functionNode.id, {
			end: 10,
			kind: ts.SyntaxKind.VariableDeclarationList,
			kindName: 'VariableDeclarationList',
			start: 0
		});
		const functionVariableList = functionVariable.astNodes.find(
			(node) =>
				node.kind === ts.SyntaxKind.VariableDeclarationList && node.parentId === functionNode.id
		)!;
		functionVariable = reparentNode(functionVariable, declaration.nodeId!, functionVariableList.id);
		expectIssue(
			'function variable environment',
			functionVariable,
			'Scope link must reproduce the independently recomputed supported binding boundary.'
		);

		let detachedVariable = withAstNode(rich, {
			end: 10,
			kind: ts.SyntaxKind.VariableDeclarationList,
			kindName: 'VariableDeclarationList',
			start: 0
		});
		const detachedVariableList = detachedVariable.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.VariableDeclarationList
		)!;
		detachedVariable = reparentNode(detachedVariable, detachedVariableList.id, absent('node'));
		detachedVariable = reparentNode(detachedVariable, declaration.nodeId!, detachedVariableList.id);
		expectIssue('detached variable environment', detachedVariable, 'Parent node is absent.');

		let evalAst = withAstNode(scoped, {
			end: 20,
			kind: ts.SyntaxKind.CallExpression,
			kindName: 'CallExpression',
			start: 0
		});
		const call = evalAst.astNodes.find((node) => node.kind === ts.SyntaxKind.CallExpression)!;
		evalAst = withAstChild(
			evalAst,
			call.id,
			{
				end: 10,
				kind: ts.SyntaxKind.TypeAssertionExpression,
				kindName: 'TypeAssertionExpression',
				start: 0
			},
			AST_STRUCTURAL_ROLES.invocationCallee
		);
		const assertion = evalAst.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.TypeAssertionExpression
		)!;
		evalAst = withAstChild(evalAst, assertion.id, {
			end: 4,
			kind: ts.SyntaxKind.Identifier,
			kindName: 'Identifier',
			start: 0,
			syntacticIdentifierText: 'eval'
		});
		const evalResult = validateSnapshot(evalAst, {}, contextForSnapshot(evalAst));
		expect(evalResult.state).toBe('INVALID');
		expect(evalResult.issues.length).toBeGreaterThan(0);

		const unsupportedResolutionPreimage = {
			moduleSymbolId: null,
			nodeId: resolution.nodeId,
			occurrenceKind: resolution.occurrenceKind,
			resolutionState: 'UNSUPPORTED' as const,
			specifier: resolution.specifier,
			specifierState: resolution.specifierState,
			targetSourceId: null,
			typeOnly: resolution.typeOnly
		};
		const unsupportedResolution = {
			...resolution,
			...unsupportedResolutionPreimage,
			id: semanticModuleResolutionId(unsupportedResolutionPreimage)
		};
		const unsupportedResult = validateSnapshot(
			{ ...rich, moduleResolutions: [unsupportedResolution] },
			{},
			contextForSnapshot(rich)
		);
		expect(unsupportedResult.state).toBe('INVALID');
		expect(unsupportedResult.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					message: 'Population emission manifests do not match serialized records.'
				})
			])
		);
	});

	it('fails closed across validation preflight, type-request, and type-provenance boundaries', () => {
		const base = fixture();
		const rich = withCallAndConstructOverloadFacts();
		const expectMessage = (snapshot: StaticSemanticSnapshot, message: string): void => {
			const result = validateSnapshot(snapshot, {}, contextForSnapshot(snapshot));
			expect(result.state).toBe('INVALID');
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ message: expect.stringContaining(message) })
				])
			);
		};

		expect(validateSnapshot(base, { maxReferenceChecks: 1 })).toMatchObject({
			state: 'BUDGET_EXHAUSTED'
		});
		expectMessage(
			{ ...base, fullJanCsaa007Conformance: 'CLAIMED' as never },
			'Slice 3B must not claim full JAN-CSAA-007 conformance.'
		);

		const typeBoundaryLimitation = {
			capability: 'TS_TYPE' as const,
			closureEffect: 'DEGRADES_CLOSURE' as const,
			reason:
				'TypeScript type and Signature identities are Program-scoped; cross-Program type equivalence and checker-judgment reconciliation are intentionally not asserted for this multi-project snapshot.',
			region: 'typescript-program-boundaries'
		};
		const program = rich.programs[0]!;
		const multiProgram = {
			...rich,
			programs: [program, { ...program, id: `semantic:program-${'e'.repeat(64)}` as never }].sort(
				(left, right) => (left.id < right.id ? -1 : 1)
			)
		};
		expectMessage(
			multiProgram,
			'Multi-Program TS_TYPE snapshots require the exact canonical TS_TYPE Program-boundary limitation once.'
		);
		expectMessage(
			multiProgram,
			'Every TS_TYPE provenance in a multi-Program snapshot requires the exact canonical Program-boundary limitation once.'
		);
		expectMessage(
			{ ...rich, limitations: [typeBoundaryLimitation] },
			'The TS_TYPE Program-boundary limitation is forbidden unless TS_TYPE is requested for multiple Programs.'
		);
		const typeProvenance = rich.provenances.find(
			(record) => record.capability === 'TS_TYPE' && record.sourceId === null
		)!;
		expectMessage(
			{
				...rich,
				provenances: rich.provenances.map((record) =>
					record.id === typeProvenance.id
						? { ...record, limitations: [typeBoundaryLimitation] }
						: record
				)
			},
			'The TS_TYPE Program-boundary provenance limitation is forbidden outside TS_TYPE provenance in a multi-Program snapshot.'
		);

		const source = rich.sources[0]!;
		const root = rich.astNodes.find((node) => node.id === source.rootNodeId)!;
		const selector = {
			end: root.end,
			logicalPath: source.logicalPath,
			queryMode: 'TYPE_AT_LOCATION' as const,
			start: root.start,
			syntaxKind: root.kind
		};
		const request = {
			requestId: 'request-a',
			requesterRef: 'validator-test',
			source: selector,
			target: selector
		};
		expectMessage(
			{ ...base, assignabilityRequests: [request] },
			'Assignability requests require the TS_TYPE capability.'
		);
		expectMessage(
			{ ...rich, assignabilityRequests: [request, request] },
			'Assignability requests must have unique identities and be canonically ordered by request identity.'
		);
		expectMessage(
			{
				...rich,
				assignabilityRequests: [
					{
						...request,
						requestId: '',
						requesterRef: ''
					}
				]
			},
			'Assignability request identity and requester reference must be non-empty Unicode-scalar strings.'
		);
		expectMessage(
			{
				...rich,
				assignabilityRequests: [
					{
						...request,
						source: { ...selector, syntaxKind: 999_999 },
						target: { ...selector, syntaxKind: 999_999 }
					}
				]
			},
			'Type selector must use a canonical logical path, valid UTF-16 span, public SyntaxKind, and closed query mode.'
		);
		expectMessage(
			{
				...rich,
				requestedCapabilities: [
					'TS_PROJECT',
					'TS_SYMBOL',
					'TS_SYNTAX'
				] as StaticSemanticSnapshot['requestedCapabilities']
			},
			'TS_TYPE requests and records cannot be emitted when type analysis was not requested.'
		);

		const invalidTypeProvenance = {
			...rich,
			provenances: rich.provenances.map((record) =>
				record.id === typeProvenance.id
					? {
							...record,
							epistemic: {
								...record.epistemic,
								inference: 'derived' as const,
								supportBasis: {
									...record.epistemic.supportBasis,
									kind: 'derived' as const,
									method: 'typescript-public-ast-binding-rules'
								}
							}
						}
					: record
			)
		};
		expectMessage(
			invalidTypeProvenance,
			'Type and signature facts require direct compiler-confirmed public TypeChecker provenance.'
		);
	});

	it('rejects malformed type, type-parameter, Signature, and parameter closure', () => {
		const rich = withCallAndConstructOverloadFacts();
		const pair = withDeclarationOwnedPairTypeParameters();
		const expectMessage = (snapshot: StaticSemanticSnapshot, message: string): void => {
			const result = validateSnapshot(snapshot, {}, contextForSnapshot(snapshot));
			expect(result.state).toBe('INVALID');
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ message: expect.stringContaining(message) })
				])
			);
		};
		const replaceType = (
			snapshot: StaticSemanticSnapshot,
			changes: Partial<StaticSemanticSnapshot['types'][number]>
		): StaticSemanticSnapshot => ({
			...snapshot,
			types: snapshot.types.map((record, index) =>
				index === 0 ? { ...record, ...changes } : record
			)
		});
		const replaceSignature = (
			snapshot: StaticSemanticSnapshot,
			changes: Partial<StaticSemanticSnapshot['signatures'][number]>
		): StaticSemanticSnapshot => ({
			...snapshot,
			signatures: snapshot.signatures.map((record, index) =>
				index === 0 ? { ...record, ...changes } : record
			)
		});
		const publicFlagNames = (flags: number, values: object): string[] => {
			const names = new Set<string>();
			for (const [name, value] of Object.entries(values))
				if (
					typeof value === 'number' &&
					value > 0 &&
					(value & (value - 1)) === 0 &&
					(flags & value) !== 0
				)
					names.add(name);
			return [...names].sort();
		};

		const otherType = replaceType(rich, {
			category: 'OTHER',
			flagNames: [],
			flags: 0,
			objectFlagNames: [],
			objectFlags: null,
			structureState: 'COMPLETE',
			unsupportedStructureKinds: []
		});
		expect(validateSnapshot(otherType, {}, contextForSnapshot(otherType))).toEqual({
			issues: [],
			state: 'VALID'
		});

		const mappedType = replaceType(rich, {
			category: 'OBJECT',
			flagNames: publicFlagNames(ts.TypeFlags.Object, ts.TypeFlags),
			flags: ts.TypeFlags.Object,
			objectFlagNames: publicFlagNames(ts.ObjectFlags.Mapped, ts.ObjectFlags),
			objectFlags: ts.ObjectFlags.Mapped,
			structureState: 'BOUNDED',
			unsupportedStructureKinds: ['MAPPED']
		});
		expectMessage(mappedType, 'Population emission manifests do not match serialized records.');
		expectMessage(
			replaceType(rich, { display: '' }),
			'Type display and fingerprint must use the frozen profiles, scalar representation, and exact SHA-256 digests.'
		);
		expectMessage(
			replaceType(rich, { flagNames: [] }),
			'Type flags, category, object flags, unsupported structures, and structure state are incoherent.'
		);
		expectMessage(
			replaceType(rich, { acquisitionAnchors: [] }),
			'Type acquisition anchors must be a non-empty canonical set.'
		);
		expectMessage(
			replaceType(rich, { identityBasis: 'STRUCTURAL' }),
			'Type identity basis does not match its declaration and acquisition evidence.'
		);
		expectMessage(
			replaceType(rich, { id: `semantic:type-${'f'.repeat(64)}` as never }),
			'Type identity mismatch.'
		);
		expectMessage(
			replaceType(rich, { symbolId: `semantic:symbol-${'f'.repeat(64)}` as never }),
			'Referenced symbol is absent.'
		);
		expectMessage(
			replaceType(rich, { projectId: `semantic:project-${'f'.repeat(64)}` as never }),
			'Record Program and project must exist and be the same mutually bound compiler context.'
		);

		const firstParameter = pair.typeParameters[0]!;
		const secondParameter = pair.typeParameters[1]!;
		const firstSignature = rich.signatures[0]!;
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) =>
					parameter.id === firstParameter.id ? { ...parameter, name: '' } : parameter
				)
			},
			'Type parameter name and non-negative owner ordinal are invalid.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) =>
					parameter.id === secondParameter.id
						? { ...parameter, ordinal: firstParameter.ordinal }
						: parameter
				)
			},
			'A type-parameter owner may contain at most one parameter at each ordinal.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) =>
					parameter.id === firstParameter.id ? { ...parameter, declarationId: null } : parameter
				)
			},
			'Declaration-owned type parameter must identify its distinct TypeParameterDeclaration.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) =>
					parameter.id === firstParameter.id
						? {
								...parameter,
								owner: { id: firstSignature.id, kind: 'SIGNATURE' as const }
							}
						: parameter
				)
			},
			'Signature type parameter must retain its exact Signature-component acquisition anchor.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) =>
					parameter.id === firstParameter.id
						? { ...parameter, owner: { id: pair.types[0]!.id, kind: 'TYPE' as const } }
						: parameter
				)
			},
			'Type-parameter identity mismatch.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) => ({
					...parameter,
					owner: { id: firstSignature.id, kind: 'SIGNATURE' as const }
				}))
			},
			'Signature type-parameter membership must be complete, unique, and ordered by ordinal.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) =>
					parameter.id === firstParameter.id
						? {
								...parameter,
								constraintState: 'RESOLVED' as const,
								constraintTypeId: pair.types[0]!.id
							}
						: parameter
				)
			},
			'Resolved constraint or default type must retain its exact type-component acquisition anchor.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) =>
					parameter.id === firstParameter.id
						? { ...parameter, constraintTypeId: pair.types[0]!.id }
						: parameter
				)
			},
			'Only RESOLVED type-parameter state may carry a resolved type identity.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) => ({
					...parameter,
					ordinal: parameter.ordinal + 1
				}))
			},
			'Type-parameter owner '
		);

		expectMessage(
			replaceSignature(rich, { display: '' }),
			'Signature display and fingerprint must use the frozen profile, scalar representation, and exact SHA-256 digests.'
		);
		expectMessage(
			replaceSignature(rich, { returnTypeId: `semantic:type-${'f'.repeat(64)}` as never }),
			'Referenced type is absent.'
		);
		expectMessage(
			replaceSignature(rich, {
				parameterIds: [`semantic:signature-parameter-${'f'.repeat(64)}` as never]
			}),
			'Signature references an absent parameter.'
		);
		expectMessage(
			replaceSignature(rich, {
				typeParameterIds: [`semantic:type-parameter-${'f'.repeat(64)}` as never]
			}),
			'Referenced type parameter is absent.'
		);
		const mismatchedDeclarationOwner = rich.signatures.find((signature) => {
			if (signature.declarationId === null) return false;
			const declaration = rich.declarations.find(
				(candidate) => candidate.id === signature.declarationId
			);
			return declaration?.symbolId !== rich.overloadSets[0]!.callableSymbolId;
		})!;
		const declarationOwnedSignature = {
			...rich,
			signatures: rich.signatures.map((signature) =>
				signature.id === mismatchedDeclarationOwner.id
					? {
							...signature,
							owner: {
								id: mismatchedDeclarationOwner.declarationId!,
								kind: 'DECLARATION' as const
							}
						}
					: signature
			)
		};
		expectMessage(
			declarationOwnedSignature,
			'Overload membership role and callable owner are incoherent with its Signature.'
		);

		const signature = rich.signatures[0]!;
		const type = rich.types[0]!;
		const provenanceId = rich.provenances.find(
			(record) => record.capability === 'TS_TYPE' && record.sourceId === null
		)!.id;
		const malformedParameter: StaticSemanticSnapshot['signatureParameters'][number] = {
			declarationId: null,
			id: semanticSignatureParameterId({ ordinal: 1, role: 'THIS', signatureId: signature.id }),
			name: '',
			optional: true,
			ordinal: 1,
			provenanceId,
			rest: true,
			role: 'THIS',
			signatureId: signature.id,
			symbolId: null,
			typeId: type.id
		};
		const malformedParameterSnapshot = {
			...rich,
			signatureParameters: [malformedParameter]
		};
		expectMessage(
			malformedParameterSnapshot,
			'Signature parameter name, ordinal, or THIS-parameter modifiers are incoherent.'
		);
		expectMessage(malformedParameterSnapshot, 'THIS parameter ordinal must be zero.');
		expectMessage(
			malformedParameterSnapshot,
			'Signature parameter type must retain its exact Signature-component acquisition anchor.'
		);
		expectMessage(
			{ ...rich, signatureParameters: [malformedParameter, malformedParameter] },
			'A Signature may contain at most one parameter per role and ordinal.'
		);
		expectMessage(
			{
				...rich,
				signatureParameters: [
					{ ...malformedParameter, id: `semantic:signature-parameter-${'f'.repeat(64)}` as never }
				]
			},
			'Signature-parameter identity mismatch.'
		);
		const missingSignatureParameter = {
			...malformedParameter,
			id: semanticSignatureParameterId({
				ordinal: 0,
				role: 'PARAMETER',
				signatureId: `semantic:signature-${'f'.repeat(64)}` as never
			}),
			name: 'missing',
			optional: false,
			ordinal: 0,
			rest: false,
			role: 'PARAMETER' as const,
			signatureId: `semantic:signature-${'f'.repeat(64)}` as never
		};
		expectMessage(
			{ ...rich, signatureParameters: [missingSignatureParameter] },
			'Signature parameter references an absent Signature.'
		);
		expectMessage(
			{
				...rich,
				overloadSets: rich.overloadSets.map((record) => ({
					...record,
					id: `semantic:overload-set-${'f'.repeat(64)}` as never
				}))
			},
			'Overload-set identity mismatch.'
		);
	});

	it('rejects every type-relation discriminator and its aggregate closure failures', () => {
		const rich = withCallAndConstructOverloadFacts();
		const pair = withDeclarationOwnedPairTypeParameters();
		const source = rich.sources[0]!;
		const root = rich.astNodes.find((node) => node.id === source.rootNodeId)!;
		const declaration = rich.declarations[0]!;
		const type = rich.types[0]!;
		const signature = rich.signatures[0]!;
		const typeProvenanceId = rich.provenances.find(
			(record) => record.capability === 'TS_TYPE' && record.sourceId === null
		)!.id;
		const expectMessage = (snapshot: StaticSemanticSnapshot, message: string): void => {
			const result = validateSnapshot(snapshot, {}, contextForSnapshot(snapshot));
			expect(result.state).toBe('INVALID');
			expect(result.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ message: expect.stringContaining(message) })
				])
			);
		};
		const withRelation = (
			snapshot: StaticSemanticSnapshot,
			preimage: Parameters<typeof semanticTypeRelationId>[0]
		): StaticSemanticSnapshot => {
			const relation = {
				...preimage,
				id: semanticTypeRelationId(preimage),
				provenanceId: typeProvenanceId
			} as StaticSemanticSnapshot['typeRelations'][number];
			return {
				...snapshot,
				typeRelations: [...snapshot.typeRelations, relation].sort((left, right) =>
					left.id < right.id ? -1 : 1
				)
			};
		};
		const common = {
			programId: source.programId,
			projectId: source.projectId
		};

		const typeOf = withRelation(rich, {
			...common,
			kind: 'TYPE_OF',
			queryMode: 'TYPE_AT_LOCATION',
			state: 'UNRESOLVED',
			subject: { id: root.id, kind: 'AST_NODE' },
			typeId: type.id
		});
		expectMessage(typeOf, 'TYPE_OF state and resolved type identity disagree.');
		expectMessage(
			typeOf,
			'Confirmed TYPE_OF result must be retained as a matching type acquisition anchor.'
		);
		expectMessage(
			withRelation(rich, {
				...common,
				kind: 'TYPE_OF',
				queryMode: 'TYPE_AT_LOCATION',
				state: 'UNRESOLVED',
				subject: { id: `semantic:node-${'f'.repeat(64)}` as never, kind: 'AST_NODE' },
				typeId: null
			}),
			'Referenced AST node is absent.'
		);

		const typeAlias = withRelation(rich, {
			...common,
			aliasDeclarationId: declaration.id,
			aliasedTypeId: type.id,
			kind: 'TYPE_ALIAS',
			state: 'UNRESOLVED'
		});
		expectMessage(typeAlias, 'TYPE_ALIAS state and resolved type identity disagree.');
		expectMessage(
			withRelation(rich, {
				...common,
				aliasDeclarationId: `semantic:declaration-${'f'.repeat(64)}` as never,
				aliasedTypeId: null,
				kind: 'TYPE_ALIAS',
				state: 'UNRESOLVED'
			}),
			'Referenced declaration is absent.'
		);

		const constituent = withRelation(rich, {
			...common,
			compositeTypeId: type.id,
			constituentTypeId: type.id,
			kind: 'UNION_CONSTITUENT',
			ordinal: 0,
			state: 'UNRESOLVED'
		});
		expectMessage(
			constituent,
			'Constituent relations must be confirmed with a non-negative ordinal.'
		);
		expectMessage(
			constituent,
			'Constituent relation kind does not match the composite type category.'
		);
		expectMessage(
			constituent,
			'Constituent relation must be mirrored by its exact type-component acquisition anchor.'
		);
		expectMessage(constituent, 'Composite UNION_CONSTITUENT');

		const generic = withRelation(rich, {
			...common,
			argumentTypeIds: [type.id],
			genericTarget: { id: type.id, kind: 'TYPE' },
			instantiatedTarget: { id: type.id, kind: 'TYPE' },
			kind: 'GENERIC_INSTANTIATION',
			state: 'UNRESOLVED'
		});
		expectMessage(generic, 'Generic-instantiation relations must be confirmed.');
		expectMessage(
			generic,
			'Generic target must retain its exact acquisition anchor from the instantiated type.'
		);
		expectMessage(
			generic,
			'Generic argument order must be mirrored by exact type-component acquisition anchors.'
		);
		expectMessage(
			withRelation(rich, {
				...common,
				argumentTypeIds: [],
				genericTarget: { id: `semantic:signature-${'f'.repeat(64)}` as never, kind: 'SIGNATURE' },
				instantiatedTarget: { id: signature.id, kind: 'SIGNATURE' },
				kind: 'GENERIC_INSTANTIATION',
				state: 'CONFIRMED'
			}),
			'Referenced Signature is absent.'
		);

		const constraint = pair.typeRelations.find(
			(relation) => relation.kind === 'PARAMETER_CONSTRAINT'
		)!;
		expectMessage(
			{
				...pair,
				typeRelations: pair.typeRelations.map((relation) =>
					relation.id === constraint.id ? { ...relation, state: 'UNRESOLVED' as const } : relation
				)
			},
			'Constraint relation must exactly mirror its type-parameter constraint and epistemic state.'
		);
		const missingConstraint = {
			...pair,
			typeRelations: pair.typeRelations.filter((relation) => relation.id !== constraint.id)
		};
		expectMessage(missingConstraint, 'must have exactly one matching constraint relation.');

		const heritageNode = withRelation(rich, {
			...common,
			baseTypeId: type.id,
			derivedTypeId: type.id,
			heritageOccurrence: { id: root.id, kind: 'AST_NODE' },
			kind: 'TYPE_EXTENSION',
			state: 'UNRESOLVED'
		});
		expectMessage(heritageNode, 'Heritage type relations must be confirmed.');
		const heritageDeclaration = withRelation(rich, {
			...common,
			baseTypeId: type.id,
			derivedTypeId: type.id,
			heritageOccurrence: { id: declaration.id, kind: 'DECLARATION' },
			kind: 'TYPE_IMPLEMENTATION',
			state: 'CONFIRMED'
		});
		expectMessage(
			heritageDeclaration,
			'Population emission manifests do not match serialized records.'
		);

		const missingRequest = withRelation(rich, {
			...common,
			checkerContextDigest: rich.contextDigest,
			kind: 'ASSIGNABILITY',
			requestId: 'missing-request',
			result: null,
			sourceTypeId: null,
			state: 'CONFIRMED',
			targetTypeId: null
		});
		expectMessage(
			missingRequest,
			'Assignability relation must bind a requested judgment and its exact Program checker context.'
		);
		expectMessage(
			missingRequest,
			'Assignability state, endpoint resolution, and Boolean judgment are incoherent.'
		);

		const selector = {
			end: root.end,
			logicalPath: source.logicalPath,
			queryMode: 'TYPE_AT_LOCATION' as const,
			start: root.start,
			syntaxKind: root.kind
		};
		const request = {
			requestId: 'assignability-a',
			requesterRef: 'validator-test',
			source: selector,
			target: selector
		};
		const requested = { ...rich, assignabilityRequests: [request] };
		expectMessage(requested, 'must have exactly one judgment per requested Program.');
		expectMessage(
			requested,
			'Assignability relations must equal the exact requested Program-by-request judgment matrix.'
		);
		const assigned = withRelation(requested, {
			...common,
			checkerContextDigest: rich.contextDigest,
			kind: 'ASSIGNABILITY',
			requestId: request.requestId,
			result: true,
			sourceTypeId: type.id,
			state: 'CONFIRMED',
			targetTypeId: type.id
		});
		expectMessage(
			assigned,
			'Resolved assignability endpoint must match its exact requested node and type acquisition anchor in the same Program.'
		);

		const membership = rich.typeRelations.find(
			(relation) => relation.kind === 'OVERLOAD_MEMBERSHIP'
		)!;
		const unsupportedMembership = {
			...rich,
			typeRelations: rich.typeRelations.map((relation) =>
				relation.id === membership.id ? { ...relation, state: 'UNSUPPORTED' as const } : relation
			)
		};
		expectMessage(
			unsupportedMembership,
			'Overload membership must be confirmed with a non-negative ordinal.'
		);
		expectMessage(
			{
				...rich,
				typeRelations: rich.typeRelations.map((relation) =>
					relation.id === membership.id && relation.kind === 'OVERLOAD_MEMBERSHIP'
						? { ...relation, overloadSetId: `semantic:overload-set-${'f'.repeat(64)}` as never }
						: relation
				)
			},
			'Overload membership set is absent or belongs to another Program.'
		);

		const withoutMembership = {
			...rich,
			typeRelations: rich.typeRelations.filter((relation) => relation.id !== membership.id)
		};
		expectMessage(withoutMembership, 'must belong to exactly one overload set.');
		expectMessage(withoutMembership, 'Signature kind');
		const duplicateMembershipPreimage = {
			kind: 'OVERLOAD_MEMBERSHIP' as const,
			ordinal: 99,
			overloadSetId:
				membership.kind === 'OVERLOAD_MEMBERSHIP'
					? membership.overloadSetId
					: rich.overloadSets[0]!.id,
			programId: source.programId,
			projectId: source.projectId,
			role:
				membership.kind === 'OVERLOAD_MEMBERSHIP' ? membership.role : ('CALL_SIGNATURE' as const),
			signatureId:
				membership.kind === 'OVERLOAD_MEMBERSHIP' ? membership.signatureId : signature.id,
			state: 'CONFIRMED' as const
		};
		const duplicatedMembership = withRelation(rich, duplicateMembershipPreimage);
		expectMessage(duplicatedMembership, 'may not be duplicated across overload memberships.');
		expectMessage(
			{
				...rich,
				signatures: rich.signatures.map((record) =>
					record.id === membership.signatureId
						? { ...record, semanticKind: 'SIGNATURE' as const }
						: record
				)
			},
			'Non-overload Signature'
		);

		const unionType = {
			...rich,
			types: rich.types.map((record, index) =>
				index === 0
					? {
							...record,
							category: 'UNION' as const,
							flagNames: ['Union'],
							flags: ts.TypeFlags.Union
						}
					: record
			)
		};
		expectMessage(unionType, 'lacks its constituent relation closure.');

		const noncontiguousParameter = {
			declarationId: null,
			id: semanticSignatureParameterId({
				ordinal: 1,
				role: 'PARAMETER',
				signatureId: signature.id
			}),
			name: 'value',
			optional: false,
			ordinal: 1,
			provenanceId: typeProvenanceId,
			rest: false,
			role: 'PARAMETER' as const,
			signatureId: signature.id,
			symbolId: null,
			typeId: type.id
		};
		expectMessage(
			{ ...rich, signatureParameters: [noncontiguousParameter] },
			'ordinary parameter ordinals must be contiguous from zero.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter) => ({
					...parameter,
					ordinal: parameter.ordinal + 1
				}))
			},
			'ordinals must be contiguous from zero.'
		);
		expectMessage(
			{
				...pair,
				typeParameters: pair.typeParameters.map((parameter, index) =>
					index === 0
						? {
								...parameter,
								constraintState: 'UNSUPPORTED' as const
							}
						: parameter
				)
			},
			'Population emission manifests do not match serialized records.'
		);
		expectMessage(
			{
				...rich,
				typeRelations: rich.typeRelations.map((relation, index) =>
					index === 0
						? { ...relation, id: `semantic:type-relation-${'f'.repeat(64)}` as never }
						: relation
				)
			},
			'Type-relation identity mismatch.'
		);
	});

	// --- Per-validator refusal assertions -------------------------------------------------
	// A no-op probe stubbed each (): void function in validate-snapshot.ts and re-ran all 1315
	// csaa tests; 31 validators could be gutted with nothing going red. The cause is that
	// INVALID_VALUE is emitted by 116 distinct functions and DANGLING_REFERENCE by 50, while the
	// assertions matched on the code alone — so another emitter always satisfied them. Each test
	// below names the MESSAGE, which is the only per-validator discriminator.
	it('names the Signature identity-derivation refusal when the identity basis contradicts the recorded provider ordinal', () => {
		const rich = withCallAndConstructOverloadFacts();
		const context = contextForSnapshot(rich);
		expect(validateSnapshot(rich, {}, context)).toEqual({ issues: [], state: 'VALID' });
		const target = rich.signatures[0]!;
		expect(target.identityBasis).toBe('DECLARATION_ANCHORED');
		expect(target.providerOrdinal).toBeNull();
		const mutated = {
			...rich,
			signatures: rich.signatures.map((signature) =>
				signature.id === target.id
					? { ...signature, identityBasis: 'OWNER_ORDINAL' as const }
					: signature
			)
		};
		expect(validateSnapshot(mutated, {}, context)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'IDENTITY_MISMATCH',
					message: 'Signature identity mismatch.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the compiler-input closure refusal when a project stops claiming an observed compiler input', () => {
		const snapshot = fixture();
		expect(validateSnapshot(snapshot)).toEqual({ issues: [], state: 'VALID' });
		expect(snapshot.compilerInputs).toHaveLength(1);
		const mutated = {
			...snapshot,
			projects: snapshot.projects.map((project) => ({ ...project, contextInputIds: [] }))
		};
		expect(validateSnapshot(mutated)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Compiler-input closure must equal the exact union claimed by projects.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a reference whose recorded identity does not match its resolution preimage', () => {
		const snapshot = withSymbolFacts();
		const reference = snapshot.references[0]!;
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			references: [{ ...reference, id: `semantic:reference-${'f'.repeat(64)}` as never }]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'IDENTITY_MISMATCH',
					message: 'Reference identity mismatch.',
					path: '$.references[0].id'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the program whose declared project does not resolve', () => {
		const snapshot = fixture();
		const program = snapshot.programs[0]!;
		expect(
			validateSnapshot({
				...snapshot,
				programs: [{ ...program, projectId: `semantic:project-${'f'.repeat(64)}` }]
			})
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Program project is absent.',
					path: '$.programs[0].projectId'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the program its own project does not bind back', () => {
		const snapshot = fixture();
		const project = snapshot.projects[0]!;
		expect(
			validateSnapshot({
				...snapshot,
				projects: [{ ...project, programId: `semantic:program-${'f'.repeat(64)}` }]
			})
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'CROSS_PROJECT_REFERENCE',
					message: 'Program is not the program bound by its project.',
					path: '$.programs[0].id'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the program whose root sources stop reproducing the ProgramRecipe roots', () => {
		const snapshot = fixture();
		const program = snapshot.programs[0]!;
		expect(
			validateSnapshot({ ...snapshot, programs: [{ ...program, rootSourceIds: [] }] })
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Program root sources do not reproduce ProgramRecipe roots.',
					path: '$.programs[0].rootSourceIds'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the deep-indexed source that declares no SourceFile root node', () => {
		const snapshot = fixture();
		const source = snapshot.sources[0]!;
		expect(
			validateSnapshot({ ...snapshot, sources: [{ ...source, rootNodeId: null }] })
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message:
						'Deep-indexed source requires exactly one declared SourceFile root node at absolute ordinal zero.',
					path: '$.sources[0].rootNodeId'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the refusal for a scope whose project is absent', () => {
		const snapshot = fixture('src/index.ts', ' '.repeat(64));
		const sourceScope = snapshot.scopes.find((scope) => scope.sourceId !== null)!;
		const absentProject = {
			...snapshot,
			scopes: snapshot.scopes.map((scope) =>
				scope.id === sourceScope.id
					? { ...scope, projectId: `semantic:project-${'f'.repeat(64)}` as never }
					: scope
			)
		};
		expect(validateSnapshot(absentProject, {}, contextForSnapshot(absentProject))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Scope project or Program is absent.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the refusal when scope project and Program ownership disagree', () => {
		const snapshot = fixture();
		const disagreeingOwnership = {
			...snapshot,
			projects: snapshot.projects.map((project) => ({
				...project,
				programId: `semantic:program-${'f'.repeat(64)}` as never
			}))
		};
		expect(
			validateSnapshot(disagreeingOwnership, {}, contextForSnapshot(disagreeingOwnership))
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'CROSS_PROJECT_REFERENCE',
					message: 'Scope project and Program ownership disagree.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the refusal when a Program has no Program-global scope', () => {
		const snapshot = fixture();
		const withoutGlobalScope = {
			...snapshot,
			scopes: snapshot.scopes.filter((scope) => scope.kind !== 'PROGRAM_GLOBAL')
		};
		expect(
			validateSnapshot(withoutGlobalScope, {}, contextForSnapshot(withoutGlobalScope))
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'POPULATION_MISMATCH',
					message: 'Every Program requires exactly one Program-global scope.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a scope parent relation that closes a cycle', () => {
		const snapshot = fixture('src/index.ts', ' '.repeat(64));
		const sourceScope = snapshot.scopes.find((scope) => scope.sourceId !== null)!;
		const cyclic: StaticSemanticSnapshot = {
			...snapshot,
			scopes: snapshot.scopes.map((scope) =>
				scope.id === sourceScope.id ? { ...scope, parentScopeId: sourceScope.id } : scope
			)
		};
		expect(validateSnapshot(cyclic, {}, contextForSnapshot(cyclic))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'Scope parent relation contains a cycle.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a scope whose parent chain never reaches the Program-global scope', () => {
		const snapshot = fixture('src/index.ts', ' '.repeat(64));
		const sourceScope = snapshot.scopes.find((scope) => scope.sourceId !== null)!;
		const absentScopeId = `semantic:scope-${'f'.repeat(64)}` as never;
		const orphaned: StaticSemanticSnapshot = {
			...snapshot,
			scopes: snapshot.scopes.map((scope) =>
				scope.id === sourceScope.id ? { ...scope, parentScopeId: absentScopeId } : scope
			)
		};
		expect(validateSnapshot(orphaned, {}, contextForSnapshot(orphaned))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Every scope must reach the one Program-global scope in its Program.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a declaration candidate whose name node is not its declaration-name child', () => {
		const snapshot = withSymbolFacts();
		const candidate = snapshot.declarationCandidates[0]!;
		const foreignName = snapshot.astNodes.find(
			(node) =>
				node.kind === ts.SyntaxKind.Identifier &&
				node.id !== candidate.nameNodeId &&
				node.parentId === snapshot.sources[0]!.rootNodeId
		)!;
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			declarationCandidates: [{ ...candidate, nameNodeId: foreignName.id }]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message:
						'Candidate name must be the retained declaration-name child of the candidate node.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a parameter-property declaration-name reference that claims checker resolution', () => {
		const base = withSymbolFacts();
		const source = base.sources[0]!;
		let snapshot = withAstNode(base, {
			end: 60,
			kind: ts.SyntaxKind.Constructor,
			kindName: 'Constructor',
			start: 38
		});
		const constructorNode = snapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.Constructor
		)!;
		snapshot = withAstChild(
			snapshot,
			constructorNode.id,
			{ end: 58, kind: ts.SyntaxKind.Parameter, kindName: 'Parameter', start: 44 },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const parameterNode = snapshot.astNodes.find((node) => node.kind === ts.SyntaxKind.Parameter)!;
		snapshot = withAstChild(
			snapshot,
			parameterNode.id,
			{ end: 51, kind: ts.SyntaxKind.PrivateKeyword, kindName: 'PrivateKeyword', start: 44 },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		snapshot = withAstChild(
			snapshot,
			parameterNode.id,
			{
				end: 58,
				kind: ts.SyntaxKind.Identifier,
				kindName: 'Identifier',
				start: 52,
				syntacticIdentifierText: 'held'
			},
			AST_STRUCTURAL_ROLES.declarationName,
			1
		);
		const parameterNameNode = snapshot.astNodes.find(
			(node) =>
				node.parentId === parameterNode.id &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName)
		)!;
		const parameterCandidate = {
			...base.declarationCandidates[0]!,
			id: semanticDeclarationCandidateId({
				candidateRole: 'BINDING',
				nodeId: parameterNode.id,
				syntaxKind: parameterNode.kind
			}),
			nameNodeId: parameterNameNode.id,
			nodeId: parameterNode.id,
			syntacticName: 'held',
			syntaxKind: parameterNode.kind,
			syntaxKindName: parameterNode.kindName
		};
		const parameterDeclaration = {
			...base.declarations[0]!,
			candidateId: parameterCandidate.id,
			end: parameterNode.end,
			id: semanticDeclarationId({
				end: parameterNode.end,
				kind: parameterNode.kind,
				nodeId: parameterNode.id,
				sourceId: source.id,
				start: parameterNode.start
			}),
			kind: parameterNode.kind,
			kindName: parameterNode.kindName,
			name: 'held',
			nodeId: parameterNode.id,
			start: parameterNode.start
		};
		const parameterReferencePreimage = {
			nodeId: parameterNameNode.id,
			resolvedSymbolId: null,
			resolutionState: 'UNRESOLVED' as const,
			role: 'DECLARATION_NAME' as const,
			symbolId: null
		};
		const parameterReference = {
			...base.references[0]!,
			...parameterReferencePreimage,
			id: semanticReferenceId(parameterReferencePreimage)
		};
		const byId = (left: { id: string }, right: { id: string }): number =>
			left.id < right.id ? -1 : 1;
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			declarationCandidates: [...snapshot.declarationCandidates, parameterCandidate].sort(byId),
			declarations: [...snapshot.declarations, parameterDeclaration].sort(byId),
			references: [...snapshot.references, parameterReference].sort(byId)
		};
		const result = validateSnapshot(mutated, {}, contextForSnapshot(mutated));
		expect(result).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'CONFORMANCE_OVERCLAIM',
					message:
						'Parameter-property declaration-name references must preserve unsupported checker-symbol resolution.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a requested-capability set that is not the TS_TYPE prerequisite closure', () => {
		expect(
			validateSnapshot({ ...fixture(), requestedCapabilities: ['TS_PROJECT', 'TS_SYNTAX'] })
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message:
						'TS_TYPE may be requested only atop the required TS_PROJECT, TS_SYMBOL, and TS_SYNTAX prerequisite closure.',
					path: '$.requestedCapabilities'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects two Programs owned by the same project', () => {
		const snapshot = fixture();
		expect(
			validateSnapshot({ ...snapshot, programs: [snapshot.programs[0]!, snapshot.programs[0]!] })
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DUPLICATE_ID',
					message: 'Each project may own exactly one Program.',
					path: '$.programs'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects scalar diagnostic text whose recorded length disagrees with its text', () => {
		const snapshot = withSourceDiagnostics(fixture(), ['2322'], true);
		const diagnostic = snapshot.diagnostics[0]!;
		expect(
			validateSnapshot({
				...snapshot,
				diagnostics: [
					{
						...diagnostic,
						message: { ...diagnostic.message, textLength: diagnostic.message.textLength + 1 }
					}
				]
			})
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'Scalar diagnostic text encoding, length, or digest is incoherent.',
					path: '$.diagnostics[0].message'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a UTF-16 diagnostic message whose declared length contradicts its code units', () => {
		const base = withSourceDiagnostics(fixture(), ['2322'], true);
		const original = base.diagnostics[0]!;
		const nonScalarMessage = diagnosticMessage('\ud800');
		const incoherentMessage = { ...nonScalarMessage, textLength: nonScalarMessage.textLength + 1 };
		const identity = {
			category: original.category,
			code: original.code,
			end: original.end,
			family: original.family,
			locationKind: original.locationKind,
			message: incoherentMessage,
			path: original.path,
			projectId: original.projectId,
			related: original.related,
			sourceId: original.sourceId,
			start: original.start
		};
		const mutated = replaceDiagnostics(base, [
			{ ...original, ...identity, id: semanticDiagnosticId(identity) }
		]);
		expect(validateSnapshot(mutated)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'UTF-16 diagnostic text encoding, length, or digest is incoherent.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a project provenance that declares a parent provenance', () => {
		const snapshot = fixture();
		const projectProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_PROJECT' && record.sourceId === null
		)!;
		const syntaxProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_SYNTAX' && record.sourceId === null
		)!;
		const mutated = reviseProvenance(snapshot, projectProvenance.id, (record) => ({
			...record,
			parentProvenanceId: syntaxProvenance.id
		}));
		expect(validateSnapshot(mutated)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'Project provenance must not have a parent.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a project provenance whose support basis omits a bound reference', () => {
		const snapshot = fixture();
		const projectProvenance = snapshot.provenances.find(
			(record) => record.capability === 'TS_PROJECT' && record.sourceId === null
		)!;
		const mutated = reviseProvenance(snapshot, projectProvenance.id, (record) => ({
			...record,
			epistemic: {
				...record.epistemic,
				supportBasis: {
					...record.epistemic.supportBasis,
					sourceRefs: record.epistemic.supportBasis.sourceRefs.slice(1)
				}
			}
		}));
		expect(validateSnapshot(mutated)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message:
						'Project provenance support must bind exactly the subject, snapshot, project, Program, and attributed compiler inputs.'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a project whose identity no longer binds its config path and resolution digest', () => {
		const snapshot = fixture();
		const project = snapshot.projects[0]!;
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			projects: [
				{
					...project,
					programRecipe: {
						...project.programRecipe,
						projectResolutionDigest: sha256('divergent project resolution')
					}
				}
			]
		};
		expect(validateSnapshot(mutated)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'IDENTITY_MISMATCH',
					message: 'Project identity mismatch.'
				})
			]),
			state: 'INVALID'
		});
	});

	// --- Per-validator refusal assertions -------------------------------------------------
	// A no-op probe stubbed each (): void function in the validator and re-ran the whole csaa
	// project; these validators could be gutted with every test still green. The cause is that a
	// single issue CODE is emitted by many functions while the assertions matched the code alone,
	// so another emitter always satisfied them. Each test below names the MESSAGE, which is the
	// only per-validator discriminator.
	it('rejects a type acquisition anchor whose Signature-component reference is absent', () => {
		const rich = withCallAndConstructOverloadFacts();
		const type = rich.types[0]!;
		const absentSignatureId = rich.signatures[0]!.id.replace(
			/[0-9a-f]{64}$/u,
			'f'.repeat(64)
		) as (typeof rich.signatures)[number]['id'];
		const mutated: StaticSemanticSnapshot = {
			...rich,
			types: [
				{
					...type,
					acquisitionAnchors: type.acquisitionAnchors.map((anchor, anchorIndex) =>
						anchorIndex === 0 && anchor.kind === 'SIGNATURE_COMPONENT'
							? { ...anchor, signatureId: absentSignatureId }
							: anchor
					)
				}
			]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Referenced Signature is absent.',
					path: '$.types[0].acquisitionAnchors[0].signatureId'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a type relation whose provenance reference is absent from the snapshot', () => {
		const rich = withCallAndConstructOverloadFacts();
		const absentProvenanceId = rich.provenances[0]!.id.replace(
			/[0-9a-f]{64}$/u,
			'f'.repeat(64)
		) as SemanticProvenanceId;
		const mutated: StaticSemanticSnapshot = {
			...rich,
			typeRelations: rich.typeRelations.map((relation, index) =>
				index === 0 ? { ...relation, provenanceId: absentProvenanceId } : relation
			)
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Fact references absent provenance.',
					path: '$.typeRelations[0].provenanceId'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the refusal for a source whose identity is not a semantic source identity', () => {
		const snapshot = fixture();
		const source = snapshot.sources[0]!;
		const foreignSourceId: StaticSemanticSnapshot = {
			...snapshot,
			sources: [{ ...source, id: `semantic:scope-${'f'.repeat(64)}` as never }]
		};
		expect(
			validateSnapshot(foreignSourceId, {}, contextForSnapshot(foreignSourceId))
		).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'Invalid source identity.',
					path: '$.sources[0].id'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a declaration whose identity is not a semantic declaration identity', () => {
		const snapshot = withSymbolFacts();
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			declarations: [{ ...snapshot.declarations[0]!, id: 'invalid' as never }]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'Invalid declaration identity.',
					path: '$.declarations[0].id'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a reference whose identity is not a semantic reference identity', () => {
		const snapshot = withSymbolFacts();
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			references: [{ ...snapshot.references[0]!, id: 'invalid' as never }]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message: 'Invalid reference identity.',
					path: '$.references[0].id'
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects an unreferenced provenance record whose epistemic rationale is empty', () => {
		const snapshot = fixture();
		const base = snapshot.provenances.find(
			(record) => record.capability === 'TS_SYNTAX' && record.sourceId === null
		)!;
		const orphan = reidentifyProvenance({
			...base,
			epistemic: { ...base.epistemic, rationale: '' }
		});
		const provenances = [...snapshot.provenances, orphan].sort((left, right) =>
			left.id < right.id ? -1 : 1
		);
		const orphanIndex = provenances.findIndex((record) => record.id === orphan.id);
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			populations: snapshot.populations.map((population) =>
				population.kind === 'PROVENANCE'
					? semanticPopulation('PROVENANCE', members(provenances.map((record) => record.id)))
					: population
			),
			provenances
		};
		expect(validateSnapshot(mutated)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message:
						'Epistemic support, rationale, and unresolved regions must be explicit non-empty canonical evidence.',
					path: `$.provenances[${orphanIndex}].epistemic`
				})
			]),
			state: 'INVALID'
		});
	});

	it('rejects a project config path that is not a canonical logical path', () => {
		const snapshot = fixture();
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			projects: [{ ...snapshot.projects[0]!, configPath: './tsconfig.json' }]
		};
		expect(validateSnapshot(mutated)).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'ABSOLUTE_PATH',
					message: 'Serialized paths must be canonical logical paths.',
					path: '$.projects[0].configPath'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the reference inside a conditional type carrying an infer binder that claims a resolved scope link', () => {
		const base = withSymbolFacts();
		expect(validateSnapshot(base, {}, contextForSnapshot(base))).toEqual({
			issues: [],
			state: 'VALID'
		});
		let snapshot = withAstNode(base, {
			end: 60,
			kind: ts.SyntaxKind.ConditionalType,
			kindName: 'ConditionalType',
			start: 38
		});
		const conditionalNode = snapshot.astNodes.find(
			(node) => node.kind === ts.SyntaxKind.ConditionalType
		)!;
		snapshot = withAstChild(
			snapshot,
			conditionalNode.id,
			{ end: 50, kind: ts.SyntaxKind.InferType, kindName: 'InferType', start: 44 },
			AST_STRUCTURAL_ROLES.genericChild,
			0
		);
		const conditionalReferencePreimage = {
			nodeId: conditionalNode.id,
			resolvedSymbolId: null,
			resolutionState: 'UNRESOLVED' as const,
			role: 'SYMBOL_USE' as const,
			symbolId: null
		};
		const conditionalReference = {
			...base.references[0]!,
			...conditionalReferencePreimage,
			id: semanticReferenceId(conditionalReferencePreimage)
		};
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			references: [...snapshot.references, conditionalReference].sort((left, right) =>
				left.id < right.id ? -1 : 1
			)
		};
		const index = mutated.references.findIndex((entry) => entry.id === conditionalReference.id);
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'INVALID_VALUE',
					message:
						'Scope link must reproduce the independently recomputed supported binding boundary.',
					path: `$.references[${index}].containingScopeId`
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the symbol whose declaration manifest stops matching the declarations that claim it', () => {
		const snapshot = withSymbolFacts();
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});
		const declaration = snapshot.declarations[0]!;
		const claimant = snapshot.symbols.find((symbol) => symbol.id === declaration.symbolId)!;
		const other = snapshot.symbols.find((symbol) => symbol.id !== claimant.id)!;
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			declarations: [{ ...declaration, symbolId: other.id }]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: `Symbol ${claimant.id} declaration manifest is incomplete.`,
					path: '$.symbols'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the reference whose bound AST node is absent from the snapshot', () => {
		const snapshot = withSymbolFacts();
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});
		const reference = snapshot.references[0]!;
		const preimage = {
			nodeId: `semantic:node-${'f'.repeat(64)}` as never,
			resolvedSymbolId: reference.resolvedSymbolId,
			resolutionState: reference.resolutionState,
			role: reference.role,
			symbolId: reference.symbolId
		};
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			references: [{ ...reference, ...preimage, id: semanticReferenceId(preimage) }]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Referenced node is absent.',
					path: '$.references[0].nodeId'
				})
			]),
			state: 'INVALID'
		});
	});

	it('names the module resolution whose bound AST node is absent from the snapshot', () => {
		const snapshot = withSymbolFacts();
		expect(validateSnapshot(snapshot, {}, contextForSnapshot(snapshot))).toEqual({
			issues: [],
			state: 'VALID'
		});
		const resolution = snapshot.moduleResolutions[0]!;
		const preimage = {
			moduleSymbolId: resolution.moduleSymbolId,
			nodeId: `semantic:node-${'f'.repeat(64)}` as never,
			occurrenceKind: resolution.occurrenceKind,
			resolutionState: resolution.resolutionState,
			specifier: resolution.specifier,
			specifierState: resolution.specifierState,
			targetSourceId: resolution.targetSourceId,
			typeOnly: resolution.typeOnly
		};
		const mutated: StaticSemanticSnapshot = {
			...snapshot,
			moduleResolutions: [{ ...resolution, ...preimage, id: semanticModuleResolutionId(preimage) }]
		};
		expect(validateSnapshot(mutated, {}, contextForSnapshot(mutated))).toMatchObject({
			issues: expect.arrayContaining([
				expect.objectContaining({
					code: 'DANGLING_REFERENCE',
					message: 'Referenced node is absent.',
					path: '$.moduleResolutions[0].nodeId'
				})
			]),
			state: 'INVALID'
		});
	});

	// The PUBLIC observable the deleted checkInvalidShape guard used to guarantee: a caller of
	// validateStaticSemanticSnapshot sees INVALID_SHAPE / 'Expected an array.' at the field's own
	// path. The wire enforces it, but the wire's own issue carries no CODE — that is applied by the
	// mapping in this module — so pinning it at the wire alone would leave the triple callers
	// actually depend on unasserted.
	it('reports every non-array snapshot field to callers as INVALID_SHAPE at its own path', () => {
		expect(SNAPSHOT_ARRAY_FIELDS.length).toBeGreaterThan(0);
		for (const field of SNAPSHOT_ARRAY_FIELDS) {
			expect(validateSnapshot({ ...fixture(), [field]: 0 }), field).toMatchObject({
				issues: expect.arrayContaining([
					expect.objectContaining({
						code: 'INVALID_SHAPE',
						message: 'Expected an array.',
						path: `$.${field}`
					})
				]),
				state: 'INVALID'
			});
		}
	});

	it('derives every remaining public TypeScript type category and bounded structure flag', () => {
		const base = withCallAndConstructOverloadFacts();
		for (const flags of [
			ts.TypeFlags.Index,
			ts.TypeFlags.Conditional,
			ts.TypeFlags.IndexedAccess,
			ts.TypeFlags.Substitution,
			ts.TypeFlags.TemplateLiteral,
			ts.TypeFlags.StringMapping
		]) {
			const malformed: StaticSemanticSnapshot = {
				...base,
				types: base.types.map((type, index) => (index === 0 ? { ...type, flags } : type))
			};
			expect(validateSnapshot(malformed, {}, contextForSnapshot(malformed)).state).toBe('INVALID');
		}
	});
});
