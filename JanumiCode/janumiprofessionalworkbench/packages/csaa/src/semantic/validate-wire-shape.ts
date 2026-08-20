import { SEMANTIC_BUDGET_KEYS } from '../contracts/semantic.js';
import { isProxy } from 'node:util/types';
import { isUnicodeScalarString } from './canonical.js';

export interface SemanticWireInspectionOptions {
	readonly maxDepth: number;
	readonly maxDiagnostics: number;
	readonly maxRecords: number;
	readonly maxStringCharacters: number;
}

export interface SemanticWireInspectionIssue {
	readonly budget: boolean;
	readonly message: string;
	readonly path: string;
}

const KEYS: Readonly<Record<string, readonly string[]>> = {
	snapshot: [
		'aliases',
		'assignabilityRequests',
		'assignments',
		'astNodes',
		'astTraversalProfile',
		'budgets',
		'canonicalProfile',
		'capabilities',
		'compilerInputs',
		'contextDigest',
		'declarationCandidates',
		'declarations',
		'diagnostics',
		'expectedEmpty',
		'extractionVersion',
		'fullJanCsaa007Conformance',
		'health',
		'id',
		'invocations',
		'limitations',
		'literals',
		'moduleExports',
		'moduleResolutions',
		'operationVersion',
		'overloadSets',
		'populations',
		'programs',
		'projects',
		'provenances',
		'provider',
		'references',
		'requestedCapabilities',
		'schemaVersion',
		'scopes',
		'signatureParameters',
		'signatures',
		'sources',
		'subjectId',
		'symbols',
		'typeParameters',
		'typeRelations',
		'types'
	],
	budgets: SEMANTIC_BUDGET_KEYS,
	provider: ['api', 'id', 'version'],
	capability: ['capability', 'reason', 'state'],
	project: [
		'configPath',
		'contextInputIds',
		'diagnosticIds',
		'frameworkCandidates',
		'health',
		'id',
		'kind',
		'partialityReasons',
		'programId',
		'programRecipe',
		'projectReferences',
		'provenanceId',
		'rootDisposition',
		'rootNames',
		'sourceIds'
	],
	partiality: ['capability', 'code', 'message', 'path'],
	recipe: [
		'compilerOptions',
		'configClosureDigest',
		'configPath',
		'kind',
		'projectReferences',
		'projectResolutionDigest',
		'provider',
		'rootNames'
	],
	'recipe-provider': ['id', 'version'],
	provenance: [
		'capability',
		'epistemic',
		'extractionVersion',
		'id',
		'invalidationDependencies',
		'limitations',
		'parentProvenanceId',
		'projectId',
		'provider',
		'snapshotId',
		'sourceId',
		'subjectId'
	],
	epistemic: [
		'capabilityCoverage',
		'conflict',
		'executionHealth',
		'freshness',
		'inference',
		'rationale',
		'supportBasis',
		'unresolvedRegions'
	],
	'support-basis': ['kind', 'method', 'rationale', 'sourceRefs'],
	invalidation: ['digest', 'kind'],
	limitation: ['capability', 'closureEffect', 'reason', 'region'],
	program: [
		'checkerState',
		'contextDigest',
		'diagnosticFamilies',
		'diagnosticIds',
		'id',
		'projectId',
		'provenanceId',
		'rootSourceIds',
		'sourceIds'
	],
	'diagnostic-family': [
		'coverage',
		'diagnosticIds',
		'family',
		'manifestDigest',
		'occurrenceCount',
		'reason',
		'recordCount',
		'state'
	],
	source: [
		'analysisDisposition',
		'artifactClass',
		'artifactRoles',
		'bytes',
		'contentSha256',
		'declarationFile',
		'diagnosticIds',
		'id',
		'languageVariant',
		'logicalPath',
		'mapping',
		'moduleKind',
		'origin',
		'programId',
		'projectId',
		'provenanceId',
		'rootFile',
		'rootNodeId',
		'scriptKind',
		'scriptKindName',
		'syntaxProvenanceId',
		'textLength'
	],
	mapping: ['reason', 'state'],
	node: [
		'end',
		'fullStart',
		'hasAssignmentInitializer',
		'id',
		'kind',
		'kindName',
		'operatorKind',
		'operatorName',
		'parentId',
		'publicFlags',
		'siblingOrdinal',
		'sourceId',
		'start',
		'structuralRoles',
		'syntacticIdentifierText'
	],
	'declaration-candidate': [
		'ambientSyntax',
		'candidateRole',
		'candidateState',
		'exportCarrierNodeId',
		'exportSyntax',
		'id',
		'localModifiers',
		'nameNodeId',
		'nameState',
		'nodeId',
		'sourceId',
		'syntacticName',
		'syntaxKind',
		'syntaxKindName'
	],
	declaration: [
		'ambient',
		'bindingProvenanceId',
		'candidateId',
		'declaringScopeId',
		'durableId',
		'end',
		'id',
		'kind',
		'kindName',
		'name',
		'nameState',
		'nodeId',
		'scopeLinkState',
		'sourceId',
		'start',
		'structuralProvenanceId',
		'symbolBindingState',
		'symbolId'
	],
	symbol: [
		'declarationIds',
		'fallbackReferenceNodeIds',
		'flagNames',
		'flags',
		'id',
		'identityBasis',
		'mergeState',
		'name',
		'programId',
		'projectId',
		'provenanceId',
		'valueDeclarationId'
	],
	alias: ['aliasSymbolId', 'id', 'provenanceId', 'state', 'targetSymbolId', 'terminalSymbolId'],
	reference: [
		'containingScopeId',
		'id',
		'nodeId',
		'resolutionProvenanceId',
		'resolutionState',
		'resolvedSymbolId',
		'role',
		'scopeLinkState',
		'sourceId',
		'structuralProvenanceId',
		'symbolId'
	],
	scope: [
		'domain',
		'end',
		'id',
		'kind',
		'ownerKind',
		'ownerKindName',
		'ownerNodeId',
		'parentScopeId',
		'programId',
		'projectId',
		'provenanceId',
		'sourceId',
		'start'
	],
	'module-resolution': [
		'id',
		'moduleSymbolId',
		'nodeId',
		'occurrenceKind',
		'provenanceId',
		'resolutionState',
		'sourceId',
		'specifier',
		'specifierState',
		'targetSourceId',
		'typeOnly'
	],
	'module-export': [
		'exportName',
		'id',
		'provenanceId',
		'sourceId',
		'state',
		'symbolId',
		'targetSymbolId'
	],
	'assignability-request': ['requestId', 'requesterRef', 'source', 'target'],
	'type-selector': ['end', 'logicalPath', 'queryMode', 'start', 'syntaxKind'],
	type: [
		'acquisitionAnchors',
		'aliasSymbolId',
		'category',
		'display',
		'displayProfile',
		'displaySha256',
		'fingerprintProfile',
		'fingerprintSha256',
		'flagNames',
		'flags',
		'id',
		'identityBasis',
		'objectFlagNames',
		'objectFlags',
		'programId',
		'projectId',
		'provenanceId',
		'structureState',
		'symbolId',
		'unsupportedStructureKinds'
	],
	'type-parameter': [
		'constraintState',
		'constraintTypeId',
		'declarationId',
		'defaultState',
		'defaultTypeId',
		'id',
		'name',
		'ordinal',
		'owner',
		'parameterTypeId',
		'programId',
		'projectId',
		'provenanceId'
	],
	signature: [
		'declarationId',
		'declarationRole',
		'display',
		'displaySha256',
		'fingerprintProfile',
		'fingerprintSha256',
		'id',
		'identityBasis',
		'owner',
		'parameterIds',
		'programId',
		'projectId',
		'provenanceId',
		'providerOrdinal',
		'returnTypeId',
		'semanticKind',
		'signatureKind',
		'typeParameterIds'
	],
	'signature-parameter': [
		'declarationId',
		'id',
		'name',
		'optional',
		'ordinal',
		'provenanceId',
		'rest',
		'role',
		'signatureId',
		'symbolId',
		'typeId'
	],
	'overload-set': ['callableSymbolId', 'id', 'programId', 'projectId', 'provenanceId'],
	'typed-ref': ['id', 'kind'],
	modifier: ['code', 'name'],
	literal: [
		'lexemeLength',
		'lexemeSha256',
		'nodeId',
		'sourceId',
		'value',
		'valueEncoding',
		'valueLength',
		'valueSha256',
		'valueState',
		'valueType'
	],
	invocation: [
		'argumentNodeIds',
		'calleeNodeId',
		'id',
		'invocationKind',
		'nodeId',
		'optional',
		'sourceId',
		'targetState',
		'templateNodeId'
	],
	assignment: [
		'assignmentKind',
		'nodeId',
		'operatorKind',
		'operatorName',
		'sourceId',
		'targetNodeId',
		'valueNodeId'
	],
	diagnostic: [
		'category',
		'code',
		'end',
		'family',
		'id',
		'locationKind',
		'message',
		'multiplicity',
		'path',
		'projectId',
		'provenanceId',
		'related',
		'sourceId',
		'start'
	],
	'diagnostic-message': [
		'category',
		'code',
		'next',
		'text',
		'textEncoding',
		'textLength',
		'textSha256'
	],
	'diagnostic-related': ['category', 'code', 'end', 'message', 'path', 'start'],
	'compiler-input': ['id', 'logicalPath', 'operation', 'origin', 'result', 'resultDigest'],
	population: [
		'analyzed',
		'contextOnly',
		'discovered',
		'excluded',
		'excludedByPolicy',
		'expectedZero',
		'failed',
		'included',
		'kind',
		'manifests',
		'members',
		'reconciles',
		'unknown',
		'unsupported'
	],
	'population-manifests': [
		'analyzed',
		'contextOnly',
		'discovered',
		'excluded',
		'excludedByPolicy',
		'failed',
		'included',
		'unknown',
		'unsupported'
	],
	'population-members': [
		'analyzed',
		'contextOnly',
		'excluded',
		'excludedByPolicy',
		'failed',
		'unknown',
		'unsupported'
	]
};

const OBJECT_CHILD: Readonly<Record<string, string>> = {
	'snapshot.provider': 'provider',
	'snapshot.budgets': 'budgets',
	'project.programRecipe': 'recipe',
	'recipe.compilerOptions': 'json',
	'recipe.provider': 'recipe-provider',
	'provenance.epistemic': 'epistemic',
	'provenance.provider': 'provider',
	'epistemic.supportBasis': 'support-basis',
	'source.mapping': 'mapping',
	'assignability-request.source': 'type-selector',
	'assignability-request.target': 'type-selector',
	'type-parameter.owner': 'typed-ref',
	'signature.owner': 'typed-ref',
	'type-relation.subject': 'typed-ref',
	'type-relation.genericTarget': 'typed-ref',
	'type-relation.instantiatedTarget': 'typed-ref',
	'type-relation.heritageOccurrence': 'typed-ref',
	'diagnostic.message': 'diagnostic-message',
	'diagnostic-related.message': 'diagnostic-message',
	'population.manifests': 'population-manifests',
	'population.members': 'population-members'
};

const ARRAY_CHILD: Readonly<Record<string, string>> = {
	'snapshot.aliases': 'alias',
	'snapshot.assignabilityRequests': 'assignability-request',
	'snapshot.assignments': 'assignment',
	'snapshot.astNodes': 'node',
	'snapshot.capabilities': 'capability',
	'snapshot.compilerInputs': 'compiler-input',
	'snapshot.declarationCandidates': 'declaration-candidate',
	'snapshot.declarations': 'declaration',
	'snapshot.diagnostics': 'diagnostic',
	'snapshot.invocations': 'invocation',
	'snapshot.limitations': 'limitation',
	'snapshot.literals': 'literal',
	'snapshot.moduleExports': 'module-export',
	'snapshot.moduleResolutions': 'module-resolution',
	'snapshot.overloadSets': 'overload-set',
	'snapshot.populations': 'population',
	'snapshot.programs': 'program',
	'snapshot.projects': 'project',
	'snapshot.provenances': 'provenance',
	'snapshot.references': 'reference',
	'snapshot.requestedCapabilities': 'scalar',
	'snapshot.scopes': 'scope',
	'snapshot.signatureParameters': 'signature-parameter',
	'snapshot.signatures': 'signature',
	'snapshot.sources': 'source',
	'snapshot.symbols': 'symbol',
	'snapshot.typeParameters': 'type-parameter',
	'snapshot.typeRelations': 'type-relation',
	'snapshot.types': 'type',
	'project.contextInputIds': 'scalar',
	'project.diagnosticIds': 'scalar',
	'project.frameworkCandidates': 'scalar',
	'project.partialityReasons': 'partiality',
	'project.projectReferences': 'scalar',
	'project.rootNames': 'scalar',
	'project.sourceIds': 'scalar',
	'recipe.projectReferences': 'scalar',
	'recipe.rootNames': 'scalar',
	'provenance.invalidationDependencies': 'invalidation',
	'provenance.limitations': 'limitation',
	'epistemic.unresolvedRegions': 'scalar',
	'support-basis.sourceRefs': 'scalar',
	'program.diagnosticFamilies': 'diagnostic-family',
	'program.diagnosticIds': 'scalar',
	'program.rootSourceIds': 'scalar',
	'program.sourceIds': 'scalar',
	'diagnostic-family.diagnosticIds': 'scalar',
	'source.artifactRoles': 'scalar',
	'source.diagnosticIds': 'scalar',
	'node.structuralRoles': 'scalar',
	'declaration-candidate.localModifiers': 'modifier',
	'symbol.declarationIds': 'scalar',
	'symbol.fallbackReferenceNodeIds': 'scalar',
	'symbol.flagNames': 'scalar',
	'type.acquisitionAnchors': 'type-acquisition-anchor',
	'type.flagNames': 'scalar',
	'type.objectFlagNames': 'scalar',
	'type.unsupportedStructureKinds': 'scalar',
	'signature.parameterIds': 'scalar',
	'signature.typeParameterIds': 'scalar',
	'type-relation.argumentTypeIds': 'scalar',
	'invocation.argumentNodeIds': 'scalar',
	'diagnostic.related': 'diagnostic-related',
	'diagnostic-message.next': 'diagnostic-message',
	'compiler-input.resultEntries': 'scalar',
	'compiler-input.excludes': 'scalar',
	'compiler-input.extensions': 'scalar',
	'compiler-input.includes': 'scalar',
	'population-members.analyzed': 'scalar',
	'population-members.contextOnly': 'scalar',
	'population-members.excluded': 'scalar',
	'population-members.excludedByPolicy': 'scalar',
	'population-members.failed': 'scalar',
	'population-members.unknown': 'scalar',
	'population-members.unsupported': 'scalar'
};

const PATH_SCALAR_FIELDS = new Set([
	'compiler-input.logicalPath',
	'compiler-input.resolvedLogicalPath',
	'diagnostic.path',
	'diagnostic-related.path',
	'partiality.path',
	'project.configPath',
	'recipe.configPath',
	'source.logicalPath',
	'type-selector.logicalPath'
]);
const PATH_ARRAY_FIELDS = new Set([
	'compiler-input.resultEntries',
	'project.frameworkCandidates',
	'project.projectReferences',
	'project.rootNames',
	'recipe.projectReferences',
	'recipe.rootNames'
]);

const BOOLEAN_FIELDS = new Set([
	'snapshot.expectedEmpty',
	'population.expectedZero',
	'population.reconciles',
	'source.declarationFile',
	'source.rootFile',
	'declaration-candidate.ambientSyntax',
	'declaration.ambient',
	'module-resolution.typeOnly',
	'invocation.optional',
	'node.hasAssignmentInitializer',
	'signature-parameter.optional',
	'signature-parameter.rest'
]);
const NULLABLE_BOOLEAN_FIELDS = new Set(['type-relation.result']);
const NUMBER_FIELDS = new Set([
	'population.analyzed',
	'population.contextOnly',
	'population.discovered',
	'population.excluded',
	'population.excludedByPolicy',
	'population.failed',
	'population.included',
	'population.unknown',
	'population.unsupported',
	'diagnostic-family.occurrenceCount',
	'diagnostic-family.recordCount',
	'diagnostic.multiplicity',
	'diagnostic-message.textLength',
	'source.bytes',
	'source.scriptKind',
	'source.textLength',
	'node.end',
	'node.fullStart',
	'node.kind',
	'node.publicFlags',
	'node.siblingOrdinal',
	'node.start',
	'declaration-candidate.syntaxKind',
	'declaration.end',
	'declaration.kind',
	'declaration.start',
	'symbol.flags',
	'type-selector.end',
	'type-selector.start',
	'type-selector.syntaxKind',
	'type.flags',
	'type-acquisition-anchor.componentOrdinal',
	'type-parameter.ordinal',
	'signature-parameter.ordinal',
	'type-relation.ordinal',
	'modifier.code',
	'literal.lexemeLength',
	'literal.valueLength',
	'assignment.operatorKind',
	'compiler-input.contentBytes',
	'compiler-input.invocationCount',
	'compiler-input.scannedEntries',
	...SEMANTIC_BUDGET_KEYS.map((key) => `budgets.${key}`)
]);
const NULLABLE_NUMBER_FIELDS = new Set([
	'diagnostic.end',
	'diagnostic.start',
	'diagnostic-related.end',
	'diagnostic-related.start',
	'compiler-input.depth',
	'diagnostic-message.code',
	'node.operatorKind',
	'scope.end',
	'scope.ownerKind',
	'scope.start',
	'type.objectFlags',
	'signature.providerOrdinal'
]);
const NULLABLE_STRING_FIELDS = new Set([
	'partiality.path',
	'provenance.parentProvenanceId',
	'provenance.sourceId',
	'support-basis.method',
	'source.rootNodeId',
	'source.syntaxProvenanceId',
	'node.syntacticIdentifierText',
	'node.parentId',
	'node.operatorName',
	'declaration-candidate.exportCarrierNodeId',
	'declaration-candidate.nameNodeId',
	'declaration-candidate.syntacticName',
	'declaration.candidateId',
	'declaration.name',
	'declaration.nodeId',
	'declaration.declaringScopeId',
	'declaration.symbolId',
	'symbol.valueDeclarationId',
	'alias.targetSymbolId',
	'alias.terminalSymbolId',
	'reference.resolvedSymbolId',
	'reference.symbolId',
	'reference.containingScopeId',
	'scope.ownerKindName',
	'scope.ownerNodeId',
	'scope.parentScopeId',
	'scope.sourceId',
	'module-resolution.moduleSymbolId',
	'module-resolution.targetSourceId',
	'module-resolution.specifier',
	'module-export.targetSymbolId',
	'type.aliasSymbolId',
	'type.symbolId',
	'type-parameter.constraintTypeId',
	'type-parameter.declarationId',
	'type-parameter.defaultTypeId',
	'signature.declarationId',
	'signature-parameter.declarationId',
	'signature-parameter.symbolId',
	'type-relation.aliasedTypeId',
	'type-relation.constraintTypeId',
	'type-relation.sourceTypeId',
	'type-relation.targetTypeId',
	'type-relation.typeId',
	'invocation.templateNodeId',
	'assignment.valueNodeId',
	'diagnostic.path',
	'diagnostic.sourceId',
	'diagnostic-related.path'
]);
const NULLABLE_ENUM_FIELDS: Readonly<Record<string, readonly string[]>> = {
	'diagnostic-message.category': ['WARNING', 'ERROR', 'SUGGESTION', 'MESSAGE']
};
const ENUM_FIELDS: Readonly<Record<string, readonly string[]>> = {
	'snapshot.health': ['COMPLETE', 'PARTIAL'],
	'capability.capability': ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'],
	'capability.state': ['SUPPORTED', 'PARTIAL', 'UNSUPPORTED'],
	'project.health': ['COMPLETE', 'PARTIAL'],
	'project.kind': ['PROJECT', 'BUILD', 'SOLUTION'],
	'project.rootDisposition': ['COMPILER_ROOTS', 'INTENTIONAL_EMPTY_SOLUTION', 'INCOMPLETE'],
	'partiality.capability': ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'],
	'recipe.kind': ['PROJECT', 'BUILD', 'SOLUTION'],
	'provenance.capability': ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'],
	'epistemic.capabilityCoverage': [
		'supported',
		'partial',
		'unsupported',
		'excluded',
		'not-analyzed'
	],
	'epistemic.conflict': ['unopposed', 'corroborated', 'conflicting', 'corrected', 'superseded'],
	'epistemic.executionHealth': [
		'succeeded',
		'failed',
		'timed-out',
		'cancelled',
		'resource-exhausted',
		'malformed-output',
		'unavailable',
		'not-run'
	],
	'epistemic.freshness': ['current-for-subject', 'stale', 'invalidated', 'unknown'],
	'epistemic.inference': [
		'direct',
		'derived',
		'candidate',
		'bounded-inference',
		'unknown',
		'not-applicable'
	],
	'support-basis.kind': [
		'direct-extraction',
		'compiler-confirmed',
		'derived',
		'unknown',
		'not-applicable'
	],
	'invalidation.kind': ['SUBJECT', 'PROJECT_RECIPE', 'CONTEXT_INPUT', 'PROVIDER', 'EXTRACTION'],
	'limitation.capability': ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'],
	'limitation.closureEffect': ['NONE', 'DEGRADES_CLOSURE', 'FATAL'],
	'program.checkerState': ['CREATED'],
	'diagnostic-family.family': [
		'CONFIGURATION',
		'OPTIONS',
		'GLOBAL',
		'SYNTACTIC',
		'SEMANTIC',
		'DECLARATION'
	],
	'diagnostic-family.coverage': ['COMPLETE', 'BOUNDED'],
	'diagnostic-family.state': ['RUN', 'NOT_APPLICABLE', 'FAILED'],
	'source.analysisDisposition': ['DEEP_INDEXED', 'CONTEXT_ONLY'],
	'source.artifactClass': [
		'MANIFEST',
		'LOCKFILE',
		'TOOL_CONFIGURATION',
		'PROJECT_CONFIGURATION',
		'GENERATED_CONFIGURATION',
		'PRODUCTION_SOURCE',
		'TEST_SOURCE',
		'GENERATOR_SOURCE',
		'GENERATED_SOURCE',
		'SCRIPT',
		'VERIFICATION',
		'BUILD_OUTPUT',
		'CACHE',
		'EXTERNAL_DEPENDENCY',
		'VENDOR',
		'OTHER',
		'CONTEXT_ONLY'
	],
	'source.origin': [
		'AUTHORED',
		'TEST',
		'VERIFICATION',
		'SCRIPT',
		'GENERATOR',
		'GENERATED',
		'GENERATED_DECLARATION',
		'WORKSPACE_BUILD_DECLARATION',
		'EXTERNAL_DECLARATION',
		'TOOLCHAIN_LIBRARY',
		'CONFIGURATION',
		'UNKNOWN'
	],
	'mapping.state': [
		'EXACT',
		'PARTIAL',
		'AMBIGUOUS',
		'UNAVAILABLE',
		'CONFLICTING',
		'NOT_APPLICABLE'
	],
	'literal.valueState': ['EXACT', 'DIGEST_ONLY'],
	'declaration-candidate.candidateRole': [
		'BINDING',
		'MEMBER',
		'SIGNATURE',
		'IMPORT_ALIAS',
		'EXPORT_BINDING',
		'JSDOC_BINDING'
	],
	'declaration-candidate.candidateState': ['SYNTAX_ONLY'],
	'declaration-candidate.exportSyntax': [
		'NONE',
		'EXPLICIT',
		'DEFAULT',
		'EXPORT_SPECIFIER',
		'EXPORT_ASSIGNMENT',
		'NAMESPACE_EXPORT'
	],
	'declaration-candidate.nameState': ['ATOMIC', 'COMPUTED', 'PATTERN', 'MISSING', 'ANONYMOUS'],
	'declaration.nameState': ['ATOMIC', 'COMPUTED', 'PATTERN', 'MISSING', 'ANONYMOUS'],
	'symbol.identityBasis': ['DECLARATIONS', 'REFERENCE_FALLBACK'],
	'symbol.mergeState': ['SINGLE', 'MERGED', 'DECLARATIONLESS'],
	'alias.state': ['RESOLVED', 'UNRESOLVED', 'CIRCULAR', 'UNSUPPORTED'],
	'reference.resolutionState': ['RESOLVED_DIRECT', 'RESOLVED_ALIAS', 'UNRESOLVED', 'UNSUPPORTED'],
	'reference.role': [
		'DECLARATION_NAME',
		'IMPORT_EXPORT_BINDING',
		'LABEL',
		'MEMBER_NAME',
		'SYMBOL_USE'
	],
	'declaration.scopeLinkState': ['RESOLVED', 'UNSUPPORTED'],
	'declaration.symbolBindingState': ['RESOLVED', 'UNSUPPORTED'],
	'reference.scopeLinkState': ['RESOLVED', 'UNSUPPORTED'],
	'source.moduleKind': ['MODULE', 'SCRIPT'],
	'scope.domain': ['LEXICAL', 'MEMBER', 'TYPE_PARAMETER', 'MIXED'],
	'scope.kind': [
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
	],
	'module-resolution.occurrenceKind': [
		'IMPORT',
		'EXPORT',
		'IMPORT_EQUALS',
		'IMPORT_TYPE',
		'DYNAMIC_IMPORT'
	],
	'module-resolution.specifierState': ['LITERAL', 'NON_LITERAL'],
	'module-resolution.resolutionState': [
		'RESOLVED_SOURCE',
		'RESOLVED_AMBIENT',
		'RESOLVED_EXTERNAL',
		'UNRESOLVED',
		'UNSUPPORTED'
	],
	'module-export.state': ['DIRECT', 'ALIAS', 'REEXPORT', 'UNRESOLVED'],
	'type-selector.queryMode': [
		'TYPE_AT_LOCATION',
		'TYPE_FROM_TYPE_NODE',
		'DECLARED_SYMBOL_TYPE',
		'VALUE_SYMBOL_TYPE_AT_LOCATION'
	],
	'type.category': [
		'INTRINSIC',
		'LITERAL',
		'UNION',
		'INTERSECTION',
		'TYPE_PARAMETER',
		'OBJECT',
		'INDEX',
		'OTHER'
	],
	'type.displayProfile': [
		'typescript-type-to-string-canonical-logical-paths/5.9.3-default/1.0.0'
	],
	'type.fingerprintProfile': ['jan-csaa-ts-type-fingerprint/1.0.0'],
	'type.identityBasis': ['STRUCTURAL', 'DECLARATION_ANCHORED', 'QUERY_ANCHORED'],
	'type.structureState': ['COMPLETE', 'BOUNDED'],
	'type-acquisition-anchor.kind': [
		'NODE',
		'DECLARATION',
		'SYMBOL',
		'TYPE_COMPONENT',
		'SIGNATURE_COMPONENT'
	],
	'type-acquisition-anchor.queryMode': [
		'TYPE_AT_LOCATION',
		'TYPE_FROM_TYPE_NODE',
		'DECLARED_SYMBOL_TYPE',
		'VALUE_SYMBOL_TYPE_AT_LOCATION'
	],
	'type-acquisition-anchor.componentKind': [
		'UNION',
		'INTERSECTION',
		'GENERIC_TARGET',
		'TYPE_ARGUMENT',
		'THIS',
		'PARAMETER',
		'RETURN',
		'TYPE_PARAMETER'
	],
	'type-parameter.constraintState': ['RESOLVED', 'MISSING', 'UNRESOLVED', 'UNSUPPORTED'],
	'type-parameter.defaultState': ['RESOLVED', 'MISSING', 'UNRESOLVED', 'UNSUPPORTED'],
	'signature.declarationRole': [
		'DECLARATION',
		'OVERLOAD_DECLARATION',
		'AMBIENT_OVERLOAD',
		'CALL_SIGNATURE',
		'CONSTRUCT_SIGNATURE',
		'UNKNOWN'
	],
	'signature.fingerprintProfile': ['jan-csaa-ts-signature-fingerprint/1.0.0'],
	'signature.identityBasis': ['DECLARATION_ANCHORED', 'OWNER_ORDINAL'],
	'signature.semanticKind': ['SIGNATURE', 'OVERLOAD_SIGNATURE', 'IMPLEMENTATION_SIGNATURE'],
	'signature.signatureKind': ['CALL', 'CONSTRUCT'],
	'signature-parameter.role': ['THIS', 'PARAMETER'],
	'typed-ref.kind': ['AST_NODE', 'DECLARATION', 'SYMBOL', 'TYPE', 'SIGNATURE'],
	'type-relation.kind': [
		'TYPE_OF',
		'TYPE_ALIAS',
		'UNION_CONSTITUENT',
		'INTERSECTION_CONSTITUENT',
		'GENERIC_INSTANTIATION',
		'PARAMETER_CONSTRAINT',
		'TYPE_EXTENSION',
		'TYPE_IMPLEMENTATION',
		'ASSIGNABILITY',
		'OVERLOAD_MEMBERSHIP'
	],
	'type-relation.state': ['CONFIRMED', 'UNRESOLVED', 'UNSUPPORTED'],
	'type-relation.queryMode': [
		'TYPE_AT_LOCATION',
		'TYPE_FROM_TYPE_NODE',
		'DECLARED_SYMBOL_TYPE',
		'VALUE_SYMBOL_TYPE_AT_LOCATION'
	],
	'type-relation.constraintState': ['RESOLVED', 'MISSING', 'UNRESOLVED', 'UNSUPPORTED'],
	'type-relation.role': [
		'OVERLOAD_DECLARATION',
		'IMPLEMENTATION_SIGNATURE',
		'AMBIENT_OVERLOAD',
		'CALL_SIGNATURE',
		'CONSTRUCT_SIGNATURE'
	],
	'literal.valueEncoding': ['JSON_SCALAR', 'TYPESCRIPT_TEXT', 'UTF16_CODE_UNITS_LE'],
	'literal.valueType': [
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
	],
	'invocation.invocationKind': ['CALL', 'NEW', 'TAGGED_TEMPLATE'],
	'invocation.targetState': ['SYNTAX_ONLY'],
	'assignment.assignmentKind': ['BINARY', 'INITIALIZER', 'PREFIX_UPDATE', 'POSTFIX_UPDATE'],
	'diagnostic.category': ['WARNING', 'ERROR', 'SUGGESTION', 'MESSAGE'],
	'diagnostic-related.category': ['WARNING', 'ERROR', 'SUGGESTION', 'MESSAGE'],
	'diagnostic.family': [
		'CONFIGURATION',
		'OPTIONS',
		'GLOBAL',
		'SYNTACTIC',
		'SEMANTIC',
		'DECLARATION'
	],
	'diagnostic.locationKind': ['NONE', 'PATH', 'SOURCE'],
	'diagnostic-message.textEncoding': ['UNICODE_SCALAR', 'UTF16_CODE_UNITS_HEX'],
	'compiler-input.byteBudgetClass': ['FROZEN_SUBJECT', 'LIVE_COMPILER_CONTEXT'],
	'compiler-input.operation': [
		'READ_FILE',
		'FILE_EXISTS',
		'DIRECTORY_EXISTS',
		'GET_DIRECTORIES',
		'READ_DIRECTORY',
		'REALPATH',
		'CURRENT_DIRECTORY',
		'USE_CASE_SENSITIVE_FILE_NAMES'
	],
	'compiler-input.origin': [
		'AUTHORED',
		'TEST',
		'VERIFICATION',
		'SCRIPT',
		'GENERATOR',
		'GENERATED',
		'GENERATED_DECLARATION',
		'WORKSPACE_BUILD_DECLARATION',
		'EXTERNAL_DECLARATION',
		'TOOLCHAIN_LIBRARY',
		'CONFIGURATION',
		'UNKNOWN'
	],
	'compiler-input.result': [
		'PRESENT',
		'ABSENT',
		'DIRECTORY',
		'NOT_DIRECTORY',
		'RESOLVED',
		'CASE_SENSITIVE',
		'CASE_INSENSITIVE'
	],
	'population.kind': [
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
	]
};

const COMPILER_INPUT_BASE_KEYS = [
	'id',
	'invocationCount',
	'logicalPath',
	'operation',
	'origin',
	'result',
	'resultDigest'
] as const;

function isPresenceResult(result: unknown): boolean {
	return result === 'PRESENT' || result === 'ABSENT';
}

function isDirectoryResult(result: unknown): boolean {
	return result === 'DIRECTORY' || result === 'NOT_DIRECTORY';
}

function isCaseSensitivityResult(result: unknown): boolean {
	return result === 'CASE_SENSITIVE' || result === 'CASE_INSENSITIVE';
}

function compilerInputReadFileKeys(result: unknown): readonly string[] | undefined {
	if (result === 'PRESENT')
		return [...COMPILER_INPUT_BASE_KEYS, 'byteBudgetClass', 'contentBytes', 'contentSha256'];
	if (result === 'ABSENT') return COMPILER_INPUT_BASE_KEYS;
	return undefined;
}

function compilerInputReadDirectoryKeys(result: unknown): readonly string[] | undefined {
	if (!isDirectoryResult(result)) return undefined;
	return [
		...COMPILER_INPUT_BASE_KEYS,
		'depth',
		'excludes',
		'extensions',
		'includes',
		'resultEntries',
		'scannedEntries'
	];
}

function compilerInputRealpathKeys(result: unknown): readonly string[] | undefined {
	if (result === 'ABSENT') return COMPILER_INPUT_BASE_KEYS;
	if (result === 'RESOLVED') return [...COMPILER_INPUT_BASE_KEYS, 'resolvedLogicalPath'];
	return undefined;
}

function compilerInputKeys(
	record: Readonly<Record<string, unknown>>
): readonly string[] | undefined {
	const operation = record.operation;
	const result = record.result;
	switch (operation) {
		case 'READ_FILE':
			return compilerInputReadFileKeys(result);
		case 'FILE_EXISTS':
			return isPresenceResult(result) ? COMPILER_INPUT_BASE_KEYS : undefined;
		case 'DIRECTORY_EXISTS':
			return isDirectoryResult(result) ? COMPILER_INPUT_BASE_KEYS : undefined;
		case 'GET_DIRECTORIES':
			return isDirectoryResult(result)
				? [...COMPILER_INPUT_BASE_KEYS, 'resultEntries', 'scannedEntries']
				: undefined;
		case 'READ_DIRECTORY':
			return compilerInputReadDirectoryKeys(result);
		case 'REALPATH':
			return compilerInputRealpathKeys(result);
		case 'CURRENT_DIRECTORY':
			return result === 'RESOLVED'
				? [...COMPILER_INPUT_BASE_KEYS, 'resolvedLogicalPath']
				: undefined;
		case 'USE_CASE_SENSITIVE_FILE_NAMES':
			return isCaseSensitivityResult(result) ? COMPILER_INPUT_BASE_KEYS : undefined;
		default:
			return undefined;
	}
}

function typeAcquisitionAnchorKeys(
	record: Readonly<Record<string, unknown>>
): readonly string[] | undefined {
	switch (record.kind) {
		case 'NODE':
			return ['kind', 'nodeId', 'queryMode'];
		case 'DECLARATION':
			return ['declarationId', 'kind', 'queryMode'];
		case 'SYMBOL':
			return ['kind', 'queryMode', 'symbolId'];
		case 'TYPE_COMPONENT':
			return ['componentKind', 'componentOrdinal', 'kind', 'parentTypeId'];
		case 'SIGNATURE_COMPONENT':
			return ['componentKind', 'componentOrdinal', 'kind', 'signatureId'];
		default:
			return undefined;
	}
}

const TYPE_RELATION_BASE_KEYS = [
	'id',
	'kind',
	'programId',
	'projectId',
	'provenanceId',
	'state'
] as const;

function typeRelationKeys(
	record: Readonly<Record<string, unknown>>
): readonly string[] | undefined {
	switch (record.kind) {
		case 'TYPE_OF':
			return [...TYPE_RELATION_BASE_KEYS, 'queryMode', 'subject', 'typeId'];
		case 'TYPE_ALIAS':
			return [...TYPE_RELATION_BASE_KEYS, 'aliasDeclarationId', 'aliasedTypeId'];
		case 'UNION_CONSTITUENT':
		case 'INTERSECTION_CONSTITUENT':
			return [...TYPE_RELATION_BASE_KEYS, 'compositeTypeId', 'constituentTypeId', 'ordinal'];
		case 'GENERIC_INSTANTIATION':
			return [...TYPE_RELATION_BASE_KEYS, 'argumentTypeIds', 'genericTarget', 'instantiatedTarget'];
		case 'PARAMETER_CONSTRAINT':
			return [...TYPE_RELATION_BASE_KEYS, 'constraintState', 'constraintTypeId', 'typeParameterId'];
		case 'TYPE_EXTENSION':
		case 'TYPE_IMPLEMENTATION':
			return [...TYPE_RELATION_BASE_KEYS, 'baseTypeId', 'derivedTypeId', 'heritageOccurrence'];
		case 'ASSIGNABILITY':
			return [
				...TYPE_RELATION_BASE_KEYS,
				'checkerContextDigest',
				'requestId',
				'result',
				'sourceTypeId',
				'targetTypeId'
			];
		case 'OVERLOAD_MEMBERSHIP':
			return [...TYPE_RELATION_BASE_KEYS, 'ordinal', 'overloadSetId', 'role', 'signatureId'];
		default:
			return undefined;
	}
}

function looksAbsolute(text: string): boolean {
	return (
		/[a-zA-Z]:[\\/]/u.test(text) ||
		/\\\\[^\\\s]+[\\]/u.test(text) ||
		/(?:^|[\s("'=])\/(?!\/)[^\s]+/u.test(text)
	);
}

function validScalar(field: string, value: unknown): boolean {
	if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean';
	if (NULLABLE_BOOLEAN_FIELDS.has(field)) return value === null || typeof value === 'boolean';
	if (NUMBER_FIELDS.has(field))
		return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
	if (NULLABLE_NUMBER_FIELDS.has(field))
		return (
			value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
		);
	if (NULLABLE_STRING_FIELDS.has(field)) return value === null || typeof value === 'string';
	const nullableAllowed = NULLABLE_ENUM_FIELDS[field];
	if (nullableAllowed !== undefined)
		return value === null || (typeof value === 'string' && nullableAllowed.includes(value));
	const allowed = ENUM_FIELDS[field];
	if (allowed !== undefined) return typeof value === 'string' && allowed.includes(value);
	return typeof value === 'string';
}

function isScalarContext(context: string): boolean {
	return context === 'scalar' || context === 'path-scalar' || context === 'literal-value';
}

function nullableContextInner(context: string): string | undefined {
	if (context.startsWith('list-or-null:')) return `list:${context.slice(13)}`;
	if (context === 'span-or-null') return 'span';
	return undefined;
}

function isJsonScalar(input: unknown): boolean {
	return (
		input === null ||
		typeof input === 'string' ||
		typeof input === 'boolean' ||
		typeof input === 'number'
	);
}

function expectedObjectMessage(context: string): string {
	return context === 'json'
		? 'Expected a JSON-compatible value.'
		: `Expected a closed ${context} object.`;
}

function closedContextKeys(
	context: string,
	record: Readonly<Record<string, unknown>>
): readonly string[] | undefined {
	if (context === 'compiler-input') return compilerInputKeys(record);
	if (context === 'type-acquisition-anchor') return typeAcquisitionAnchorKeys(record);
	if (context === 'type-relation') return typeRelationKeys(record);
	return KEYS[context];
}

function childContextFor(context: string, key: string): string {
	const field = `${context}.${key}`;
	if (context === 'literal' && key === 'value') return 'literal-value';
	const arrayItem = ARRAY_CHILD[field];
	if (arrayItem === 'scalar' && PATH_ARRAY_FIELDS.has(field)) return 'list:path-scalar';
	if (arrayItem !== undefined) return `list:${arrayItem}`;
	return OBJECT_CHILD[field] ?? `field:${field}`;
}

function canonicalStringBytes(text: string): number {
	for (let index = 0; index < text.length; index += 1) {
		const code = text.codePointAt(index)!;
		if (code < 0x20 || code === 0x22 || code === 0x5c || code > 0x7f)
			return Buffer.byteLength(JSON.stringify(text), 'utf8');
	}
	return text.length + 2;
}

declare const SEMANTIC_WIRE_MATERIALIZED: unique symbol;

/**
 * A value this module produced, and therefore one whose closed wire shape has already been
 * established — every required key present, every array field an actual dense array, no proxies,
 * accessors or symbol keys.
 *
 * The brand exists so that precondition is carried by the type rather than by a comment or by a
 * downstream re-check. `validateStaticSemanticSnapshotUnsafe` is unsafe precisely in that it
 * assumes this, and nothing but this function can mint the token that says so.
 */
export type SemanticSnapshotWireValue = Record<string, unknown> & {
	readonly [SEMANTIC_WIRE_MATERIALIZED]: true;
};

export interface SemanticWireMaterializationResult {
	readonly canonicalBytes?: number;
	readonly issues: readonly SemanticWireInspectionIssue[];
	readonly value?: SemanticSnapshotWireValue;
}

export function materializeSemanticSnapshotWire(
	value: unknown,
	options: SemanticWireInspectionOptions
): SemanticWireMaterializationResult {
	const issues: SemanticWireInspectionIssue[] = [];
	const ancestors = new Set<object>();
	const canonicalKeyBytes = new Map<string, number>();
	let canonicalBytes = 0;
	let visited = 0;
	let stringCharacters = 0;

	function issue(budget: boolean, path: string, message: string): void {
		if (issues.length < 1_000) issues.push({ budget, message, path });
	}

	function accountString(text: string, path: string): void {
		stringCharacters += text.length;
		if (stringCharacters > options.maxStringCharacters)
			issue(true, path, `Wire string characters exceed ${options.maxStringCharacters}.`);
		if (!isUnicodeScalarString(text))
			issue(false, path, 'Ordinary semantic wire strings must contain only Unicode scalar values.');
	}

	function accountCanonicalBytes(addition: number, path: string): void {
		if (
			!Number.isSafeInteger(addition) ||
			addition < 0 ||
			!Number.isSafeInteger(canonicalBytes + addition)
		) {
			issue(true, path, 'Canonical semantic wire byte count overflowed.');
			return;
		}
		canonicalBytes += addition;
	}

	function accountCanonicalScalar(input: unknown, path: string): void {
		if (input === null) accountCanonicalBytes(4, path);
		else if (typeof input === 'string') accountCanonicalBytes(canonicalStringBytes(input), path);
		else if (typeof input === 'boolean') accountCanonicalBytes(input ? 4 : 5, path);
		else if (
			typeof input === 'number' &&
			Number.isFinite(input) &&
			(!Number.isInteger(input) || Number.isSafeInteger(input))
		) {
			accountCanonicalBytes(Object.is(input, -0) ? 1 : String(input).length, path);
		}
	}

	function inertRecord(input: object, path: string): Readonly<Record<string, unknown>> | null {
		if (isProxy(input)) {
			issue(false, path, 'Proxy values are not permitted in the semantic wire.');
			return null;
		}
		const prototype = Reflect.getPrototypeOf(input);
		if (prototype !== Object.prototype && prototype !== null) {
			issue(false, path, 'Wire objects must have Object.prototype or null prototype.');
			return null;
		}
		const ownKeys = Reflect.ownKeys(input);
		if (ownKeys.some((key) => typeof key !== 'string')) {
			issue(false, path, 'Wire objects must not contain symbol properties.');
			return null;
		}
		if (ownKeys.length > Math.max(0, options.maxRecords - visited)) {
			issue(
				true,
				path,
				`Object member count ${ownKeys.length} exceeds the remaining wire-value budget ${Math.max(0, options.maxRecords - visited)}.`
			);
			return null;
		}
		for (const key of ownKeys as string[]) {
			const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
				issue(false, `${path}.${key}`, 'Wire fields must be enumerable data properties.');
				return null;
			}
			accountString(key, `${path}.${key}`);
			let keyBytes = canonicalKeyBytes.get(key);
			if (keyBytes === undefined) {
				keyBytes = canonicalStringBytes(key) + 1;
				canonicalKeyBytes.set(key, keyBytes);
			}
			accountCanonicalBytes(keyBytes, `${path}.${key}`);
		}
		accountCanonicalBytes(2 + Math.max(0, ownKeys.length - 1), path);
		return input as Readonly<Record<string, unknown>>;
	}

	function inertArray(input: object, path: string): readonly unknown[] | null {
		if (isProxy(input)) {
			issue(false, path, 'Proxy values are not permitted in the semantic wire.');
			return null;
		}
		if (!Array.isArray(input)) {
			issue(false, path, 'Expected an array.');
			return null;
		}
		const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, 'length');
		const length =
			lengthDescriptor !== undefined && 'value' in lengthDescriptor
				? lengthDescriptor.value
				: undefined;
		if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
			issue(false, path, 'Arrays must have a valid safe length.');
			return null;
		}
		if (path === '$.diagnostics' && length > options.maxDiagnostics) {
			issue(true, path, `Diagnostic count exceeds ${options.maxDiagnostics}.`);
			return null;
		}
		if (length > Math.max(0, options.maxRecords - visited)) {
			issue(
				true,
				path,
				`Array length ${length} exceeds the remaining wire-value budget ${Math.max(0, options.maxRecords - visited)}.`
			);
			return null;
		}
		const ownKeys = Reflect.ownKeys(input);
		if (
			ownKeys.length !== length + 1 ||
			ownKeys.some(
				(key) => typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key))
			)
		) {
			issue(false, path, 'Arrays must be dense and contain only canonical index properties.');
			return null;
		}
		accountCanonicalBytes(2 + Math.max(0, length - 1), path);
		for (let index = 0; index < length; index += 1) {
			const descriptor = Reflect.getOwnPropertyDescriptor(input, String(index));
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
				issue(false, `${path}[${index}]`, 'Array elements must be enumerable data properties.');
				return null;
			}
		}
		return input as readonly unknown[];
	}

	function visitBudgetExceeded(depth: number, path: string): boolean {
		if (visited > options.maxRecords) {
			issue(true, path, `Wire value count exceeds ${options.maxRecords}.`);
			return true;
		}
		if (depth > options.maxDepth) {
			issue(true, path, `Wire depth exceeds ${options.maxDepth}.`);
			return true;
		}
		return false;
	}

	function accountVisitedScalar(input: unknown, path: string): void {
		if (typeof input === 'string') accountString(input, path);
		if (
			typeof input === 'number' &&
			(!Number.isFinite(input) || (Number.isInteger(input) && !Number.isSafeInteger(input)))
		)
			issue(false, path, 'Wire numbers must be finite and integer values must be safe.');
		if (input === null || typeof input !== 'object') accountCanonicalScalar(input, path);
	}

	function checkScalarContext(input: unknown, context: string, path: string): void {
		const valid =
			context === 'literal-value'
				? input === null || ['string', 'boolean'].includes(typeof input)
				: typeof input === 'string';
		if (!valid) issue(false, path, 'Expected a valid scalar.');
		if (context === 'path-scalar' && typeof input === 'string' && looksAbsolute(input))
			issue(false, path, 'Absolute paths are not permitted in semantic path fields.');
	}

	function checkFieldContext(input: unknown, field: string, path: string): void {
		if (!validScalar(field, input)) issue(false, path, `Invalid scalar for ${field}.`);
		if (PATH_SCALAR_FIELDS.has(field) && typeof input === 'string' && looksAbsolute(input))
			issue(false, path, 'Absolute paths are not permitted in semantic path fields.');
	}

	function visitList(input: unknown, itemContext: string, depth: number, path: string): unknown {
		if (input === null || typeof input !== 'object') {
			issue(false, path, 'Expected an array.');
			return null;
		}
		const array = inertArray(input, path);
		if (array === null) return null;
		if (ancestors.has(input)) {
			issue(false, path, 'Cyclic values are not permitted in the semantic wire.');
			return null;
		}
		ancestors.add(input);
		try {
			for (let index = 0; index < array.length; index += 1)
				visit(array[index], itemContext, depth + 1, `${path}[${index}]`);
			return input;
		} finally {
			ancestors.delete(input);
		}
	}

	function visitJsonMembers(
		record: Readonly<Record<string, unknown>>,
		depth: number,
		path: string
	): void {
		for (const [key, child] of Object.entries(record))
			visit(child, 'json', depth + 1, `${path}.${key}`);
	}

	function visitClosedRecord(
		record: Readonly<Record<string, unknown>>,
		context: string,
		depth: number,
		path: string
	): unknown {
		const allowed = closedContextKeys(context, record);
		if (allowed === undefined) {
			issue(false, path, `Invalid closed ${context} discriminator.`);
			return null;
		}
		for (const key of Object.keys(record))
			if (!allowed.includes(key)) issue(false, `${path}.${key}`, `Unknown field ${key}.`);
		for (const key of allowed) {
			if (!Object.hasOwn(record, key)) {
				issue(false, `${path}.${key}`, `Missing required field ${key}.`);
				continue;
			}
			visit(record[key], childContextFor(context, key), depth + 1, `${path}.${key}`);
		}
		return record;
	}

	function visit(input: unknown, context: string, depth: number, path: string): unknown {
		visited += 1;
		if (visitBudgetExceeded(depth, path)) return null;
		accountVisitedScalar(input, path);

		if (isScalarContext(context)) {
			checkScalarContext(input, context, path);
			return input;
		}
		if (context.startsWith('field:')) {
			checkFieldContext(input, context.slice(6), path);
			return input;
		}
		const nullableInner = nullableContextInner(context);
		if (nullableInner !== undefined)
			return input === null ? null : visit(input, nullableInner, depth, path);
		if (context.startsWith('list:')) return visitList(input, context.slice(5), depth, path);
		return visitObject(input, context, depth, path);
	}

	function visitObject(input: unknown, context: string, depth: number, path: string): unknown {
		if (context === 'json' && isJsonScalar(input)) return input;
		if (input === null || typeof input !== 'object') {
			issue(false, path, expectedObjectMessage(context));
			return null;
		}
		if (isProxy(input)) {
			issue(false, path, 'Proxy values are not permitted in the semantic wire.');
			return null;
		}
		if (context === 'json' && Array.isArray(input)) return visit(input, 'list:json', depth, path);
		if (Array.isArray(input)) {
			issue(false, path, `Expected a closed ${context} object.`);
			return null;
		}
		if (ancestors.has(input)) {
			issue(false, path, 'Cyclic values are not permitted in the semantic wire.');
			return null;
		}
		const record = inertRecord(input, path);
		if (record === null) return null;
		ancestors.add(input);
		try {
			if (context === 'json') {
				visitJsonMembers(record, depth, path);
				return input;
			}
			return visitClosedRecord(record, context, depth, path);
		} finally {
			ancestors.delete(input);
		}
	}

	try {
		const materialized = visit(value, 'snapshot', 0, '$');
		// The only mint site for the brand: reached only when this walk produced no issue, which is
		// what makes the assertion below true rather than merely asserted.
		return issues.length === 0
			? { canonicalBytes, issues: [], value: materialized as SemanticSnapshotWireValue }
			: { issues };
	} catch (error) {
		issue(
			false,
			'$',
			error instanceof Error
				? `Semantic wire inspection failed closed: ${error.message}`
				: 'Semantic wire inspection failed closed.'
		);
		return { issues };
	}
}

export function inspectSemanticSnapshotWire(
	value: unknown,
	options: SemanticWireInspectionOptions
): SemanticWireInspectionIssue[] {
	return [...materializeSemanticSnapshotWire(value, options).issues];
}
