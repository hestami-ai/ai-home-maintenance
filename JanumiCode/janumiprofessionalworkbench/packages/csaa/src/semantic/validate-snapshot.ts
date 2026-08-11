import { Buffer } from 'node:buffer';
import { isProxy } from 'node:util/types';
import ts from 'typescript';
import type {
	CompilerInputObservation,
	SemanticFactProvenanceRecord,
	SemanticLimitation,
	SemanticPopulationKind,
	SemanticSignatureOwner,
	SemanticTypeOrSignatureRef,
	SemanticTypeParameterOwner,
	SemanticTypeSubjectRef,
	StaticSemanticSnapshot
} from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import {
	FULL_JAN_CSAA_007_CONFORMANCE,
	SEMANTIC_AST_TRAVERSAL_PROFILE,
	SEMANTIC_BUDGET_KEYS,
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
import {
	canonicalSemanticJson,
	canonicalSemanticJsonWitness,
	hasLoneUtf16CodeUnit,
	isUnicodeScalarString,
	parseUtf16CodeUnitsHex,
	semanticUtf16CodeUnitsDigest
} from './canonical.js';
import {
	hasSemanticIdPrefix,
	semanticAliasId,
	semanticContextInputId,
	semanticDeclarationId,
	semanticDeclarationCandidateId,
	semanticDurableDeclarationId,
	semanticDiagnosticId,
	semanticInvocationSiteId,
	semanticModuleExportId,
	semanticModuleResolutionId,
	compilerInputClosureDigest,
	compilerInputResultDigest,
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
import { ProgramRecipePolicyError, validateProgramRecipePolicy } from './program-recipe-policy.js';
import { semanticPopulation } from './population.js';
import type { StaticSemanticOperationBudgetProviderBinding } from './operation-budget-provider-binding.js';
import {
	isValidationOrdinaryReferenceScope as isOrdinaryReferenceScope,
	validationProgramGlobalScopeDescriptor as programGlobalScopeDescriptor,
	validationScopeBoundaryDescriptor as semanticScopeBoundaryDescriptor,
	validationSourceScopeKind as semanticSourceScopeKind
} from './scope-validation-oracle.js';
import {
	AST_STRUCTURAL_ROLES,
	PUBLIC_NODE_FLAG_MASK,
	SEMANTIC_AST_STRUCTURAL_ROLES,
	canHaveAssignmentInitializer,
	declarationCandidateMatchesNode,
	exactLiteralValueType,
	isTypeScriptModifierKind,
	isSemanticLiteralKind,
	isUtf16CodeUnitLiteralKind,
	literalValueMatchesNodeKind,
	literalValueDigest,
	literalValueLength,
	semanticAssignmentKind,
	semanticDeclarationCandidateRole,
	semanticDeclarationNameState,
	semanticInvocationKind,
	semanticLiteralDescriptor,
	typescriptSyntaxKindName
} from './syntax-projection.js';
import { materializeSemanticSnapshotWire } from './validate-wire-shape.js';

export type SemanticValidationIssueCode =
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'INVALID_SHAPE'
	| 'INVALID_VALUE'
	| 'NONCANONICAL_ORDER'
	| 'DUPLICATE_ID'
	| 'IDENTITY_MISMATCH'
	| 'DANGLING_REFERENCE'
	| 'CROSS_PROJECT_REFERENCE'
	| 'POPULATION_MISMATCH'
	| 'ABSOLUTE_PATH'
	| 'CONFORMANCE_OVERCLAIM'
	| 'FROZEN_EVIDENCE_REQUIRED'
	| 'VALIDATION_BUDGET_EXHAUSTED';

export interface SemanticValidationIssue {
	readonly code: SemanticValidationIssueCode;
	readonly message: string;
	readonly path: string;
}

export interface SemanticValidationOptions {
	readonly maxDepth: number;
	readonly maxDiagnostics: number;
	readonly maxIssues: number;
	readonly maxRecords: number;
	readonly maxReferenceChecks: number;
	readonly maxStringCharacters: number;
}

export interface SemanticValidationContext {
	readonly frozenSubject?: Pick<
		FrozenSubject,
		'artifacts' | 'descriptor' | 'projects' | 'workspaces'
	>;
}

export type SemanticValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly SemanticValidationIssue[];
			readonly state: 'INVALID' | 'BUDGET_EXHAUSTED';
	  };

declare const staticSemanticValidationBudgetEvidenceBrand: unique symbol;
export type StaticSemanticValidationBudgetEvidence = Readonly<{
	[staticSemanticValidationBudgetEvidenceBrand]: true;
}>;

export interface StaticSemanticValidationBudgetEvidenceView {
	readonly budgetsDigest: string;
	readonly canonicalSnapshotBytes: number;
	readonly phase: 'VALIDATE';
	readonly snapshotSha256: string;
}

export type StaticSemanticValidationBudgetEvidenceResult =
	| {
			readonly evidence: StaticSemanticValidationBudgetEvidence;
			readonly validation: Extract<SemanticValidationResult, { readonly state: 'VALID' }>;
	  }
	| {
			readonly evidence: null;
			readonly validation: Exclude<SemanticValidationResult, { readonly state: 'VALID' }>;
	  };

export type StaticSemanticValidationBudgetEvidenceErrorCode =
	| 'BINDING_MISMATCH'
	| 'BUDGET_MISMATCH'
	| 'EVIDENCE_REUSED'
	| 'INVALID_BINDING'
	| 'INVALID_EVIDENCE'
	| 'SNAPSHOT_MISMATCH';

export class StaticSemanticValidationBudgetEvidenceError extends Error {
	constructor(
		readonly code: StaticSemanticValidationBudgetEvidenceErrorCode,
		message: string
	) {
		super(message);
		this.name = 'StaticSemanticValidationBudgetEvidenceError';
	}
}

interface StaticSemanticValidationBudgetEvidenceState {
	readonly binding: StaticSemanticOperationBudgetProviderBinding;
	consumed: boolean;
	readonly snapshot: StaticSemanticSnapshot;
	readonly view: StaticSemanticValidationBudgetEvidenceView;
}

const staticSemanticValidationBudgetEvidenceStates = new WeakMap<
	object,
	StaticSemanticValidationBudgetEvidenceState
>();

const DEFAULT_OPTIONS: SemanticValidationOptions = {
	maxDepth: 128,
	maxDiagnostics: 100_000,
	maxIssues: 1_000,
	maxRecords: 5_000_000,
	maxReferenceChecks: 20_000_000,
	maxStringCharacters: 100_000_000
};
const VALIDATION_OPTION_KEYS = [
	'maxDepth',
	'maxDiagnostics',
	'maxIssues',
	'maxRecords',
	'maxReferenceChecks',
	'maxStringCharacters'
] as const satisfies readonly (keyof SemanticValidationOptions)[];
const VALIDATION_OPTION_KEY_SET = new Set<string>(VALIDATION_OPTION_KEYS);
const SHA256 = /^[a-f0-9]{64}$/u;
const USE_STRICT_LEXEME_LENGTH = '"use strict"'.length;
const USE_STRICT_LEXEME_DIGESTS = [sha256('"use strict"'), sha256("'use strict'")] as const;
const CAPABILITIES = ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'] as const;
const POPULATIONS: readonly SemanticPopulationKind[] = [
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
const DIAGNOSTIC_FAMILIES = [
	'CONFIGURATION',
	'OPTIONS',
	'GLOBAL',
	'SYNTACTIC',
	'SEMANTIC',
	'DECLARATION'
] as const;
const ARTIFACT_ROLES = [
	'ANALYSIS_INPUT',
	'COMPILER_CANDIDATE',
	'CONFIGURATION',
	'EXPORT_DECLARATION',
	'FRAMEWORK_CANDIDATE',
	'GENERATED',
	'GENERATOR',
	'MANIFEST',
	'PRODUCTION',
	'SCRIPT',
	'TEST',
	'VERIFICATION'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLogicalPath(value: string): boolean {
	if (value === '.') return true;
	return (
		value.length > 0 &&
		!value.startsWith('/') &&
		!value.startsWith('\\') &&
		!/^[a-zA-Z]:/u.test(value) &&
		!value.includes('\\') &&
		value.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
	);
}

function sortedUnique(values: readonly string[]): string[] {
	return [...new Set(values)].sort();
}

function diagnosticManifestDigest(
	records: readonly StaticSemanticSnapshot['diagnostics'][number][]
): string {
	return sha256(
		canonicalSemanticJson(
			[...records]
				.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
				.map(({ id, multiplicity }) => ({ id, multiplicity }))
		)
	);
}

function diagnosticMessageCharacterCount(
	root: StaticSemanticSnapshot['diagnostics'][number]['message']
): number {
	let characters = 0;
	const stack = [root];
	while (stack.length > 0) {
		const message = stack.pop()!;
		characters += message.textLength;
		for (const next of message.next) stack.push(next);
	}
	return characters;
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
	const normalizedLeft = sortedUnique(left);
	const normalizedRight = sortedUnique(right);
	return (
		normalizedLeft.length === normalizedRight.length &&
		normalizedLeft.every((value, index) => value === normalizedRight[index])
	);
}

function checkCanonicalOrder(values: readonly string[]): boolean {
	return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

function isCanonicalSet(values: readonly string[]): boolean {
	return new Set(values).size === values.length && checkCanonicalOrder(values);
}

function isCanonicalMultiset(values: readonly string[]): boolean {
	return values.every((value, index) => index === 0 || values[index - 1]! <= value);
}

function limitationKey(limitation: SemanticLimitation): string {
	return `${limitation.capability}\0${limitation.closureEffect}\0${limitation.region}\0${limitation.reason}`;
}

const MULTI_PROGRAM_TS_SYMBOL_LIMITATION: SemanticLimitation = Object.freeze({
	capability: 'TS_SYMBOL',
	closureEffect: 'DEGRADES_CLOSURE',
	reason:
		'TypeScript symbol extraction and resolution are Program-scoped; cross-Program symbol identity and binding reconciliation is not implemented for this multi-project snapshot.',
	region: 'typescript-program-boundaries'
});

const MULTI_PROGRAM_TS_TYPE_LIMITATION: SemanticLimitation = Object.freeze({
	capability: 'TS_TYPE',
	closureEffect: 'DEGRADES_CLOSURE',
	reason:
		'TypeScript type and Signature identities are Program-scoped; cross-Program type equivalence and checker-judgment reconciliation are intentionally not asserted for this multi-project snapshot.',
	region: 'typescript-program-boundaries'
});

function isMultiProgramTsSymbolLimitation(limitation: SemanticLimitation): boolean {
	return limitationKey(limitation) === limitationKey(MULTI_PROGRAM_TS_SYMBOL_LIMITATION);
}

function isMultiProgramTsTypeLimitation(limitation: SemanticLimitation): boolean {
	return limitationKey(limitation) === limitationKey(MULTI_PROGRAM_TS_TYPE_LIMITATION);
}

function compilerInputQueryKey(observation: CompilerInputObservation): string {
	const parameters =
		observation.operation === 'READ_DIRECTORY'
			? {
					depth: observation.depth,
					excludes: observation.excludes,
					extensions: observation.extensions,
					includes: observation.includes
				}
			: {};
	return canonicalSemanticJson({
		logicalPath: observation.logicalPath,
		operation: observation.operation,
		parameters
	});
}

function populationCapability(
	kind: SemanticPopulationKind
): 'TS_PROJECT' | 'TS_SYMBOL' | 'TS_SYNTAX' | 'TS_TYPE' {
	if (
		[
			'TYPE',
			'TYPE_PARAMETER',
			'SIGNATURE',
			'SIGNATURE_PARAMETER',
			'OVERLOAD_SET',
			'TYPE_RELATION'
		].includes(kind)
	)
		return 'TS_TYPE';
	if (
		[
			'SCOPE',
			'DECLARATION',
			'SYMBOL',
			'ALIAS',
			'REFERENCE',
			'MODULE_RESOLUTION',
			'MODULE_EXPORT'
		].includes(kind)
	)
		return 'TS_SYMBOL';
	return [
		'AST_NODE',
		'DECLARATION_CANDIDATE',
		'LITERAL',
		'INVOCATION_SITE',
		'ASSIGNMENT',
		'FRAMEWORK_CANDIDATE'
	].includes(kind)
		? 'TS_SYNTAX'
		: 'TS_PROJECT';
}

function appendGrouped<Key, Value>(groups: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = groups.get(key);
	if (values === undefined) groups.set(key, [value]);
	else values.push(value);
}

function indexBy<Value>(
	values: readonly Value[],
	keyOf: (value: Value) => string
): Map<string, Value> {
	const result = new Map<string, Value>();
	for (const value of values) result.set(keyOf(value), value);
	return result;
}

function validateStaticSemanticSnapshotUnsafe(
	value: unknown,
	canonicalBytes: number,
	overrides: Partial<SemanticValidationOptions> = {},
	context: SemanticValidationContext = {}
): SemanticValidationResult {
	const options = { ...DEFAULT_OPTIONS, ...overrides };
	const issues: SemanticValidationIssue[] = [];
	let budgetExhausted = false;
	let referenceChecks = 0;

	function issue(code: SemanticValidationIssueCode, path: string, message: string): void {
		if (issues.length >= options.maxIssues) {
			budgetExhausted = true;
			return;
		}
		issues.push({ code, message, path });
	}

	function referenceCheck(): boolean {
		referenceChecks += 1;
		if (referenceChecks <= options.maxReferenceChecks) return true;
		budgetExhausted = true;
		return false;
	}

	if (!isRecord(value))
		return {
			issues: [{ code: 'INVALID_SHAPE', message: 'Snapshot must be a plain object.', path: '$' }],
			state: 'INVALID'
		};
	if (value.schemaVersion !== SEMANTIC_SNAPSHOT_SCHEMA_VERSION) {
		return {
			issues: [
				{
					code: 'UNSUPPORTED_SCHEMA_VERSION',
					message: `Unsupported semantic snapshot schema: ${String(value.schemaVersion)}.`,
					path: '$.schemaVersion'
				}
			],
			state: 'INVALID'
		};
	}

	const arrayNames = [
		'aliases',
		'assignabilityRequests',
		'assignments',
		'astNodes',
		'capabilities',
		'compilerInputs',
		'declarationCandidates',
		'declarations',
		'diagnostics',
		'invocations',
		'limitations',
		'literals',
		'moduleExports',
		'moduleResolutions',
		'overloadSets',
		'populations',
		'programs',
		'projects',
		'provenances',
		'references',
		'requestedCapabilities',
		'scopes',
		'signatureParameters',
		'signatures',
		'sources',
		'symbols',
		'typeParameters',
		'typeRelations',
		'types'
	] as const;
	for (const name of arrayNames) {
		if (!Array.isArray(value[name])) issue('INVALID_SHAPE', `$.${name}`, 'Expected an array.');
	}
	if (issues.length > 0) return { issues, state: 'INVALID' };

	const snapshot = value as unknown as StaticSemanticSnapshot;
	const recordCount =
		snapshot.aliases.length +
		snapshot.assignabilityRequests.length +
		snapshot.assignments.length +
		snapshot.astNodes.length +
		snapshot.invocations.length +
		snapshot.compilerInputs.length +
		snapshot.declarationCandidates.length +
		snapshot.declarations.length +
		snapshot.diagnostics.length +
		snapshot.literals.length +
		snapshot.moduleExports.length +
		snapshot.moduleResolutions.length +
		snapshot.overloadSets.length +
		snapshot.populations.length +
		snapshot.programs.length +
		snapshot.projects.length +
		snapshot.provenances.length +
		snapshot.references.length +
		snapshot.scopes.length +
		snapshot.signatureParameters.length +
		snapshot.signatures.length +
		snapshot.sources.length +
		snapshot.symbols.length +
		snapshot.typeParameters.length +
		snapshot.typeRelations.length +
		snapshot.types.length;
	if (recordCount > options.maxRecords) {
		return {
			issues: [
				{
					code: 'VALIDATION_BUDGET_EXHAUSTED',
					message: `Record count ${recordCount} exceeds validator limit ${options.maxRecords}.`,
					path: '$'
				}
			],
			state: 'BUDGET_EXHAUSTED'
		};
	}
	const referencePopulation =
		snapshot.projects.reduce(
			(count, record) =>
				count +
				record.sourceIds.length +
				record.diagnosticIds.length +
				record.contextInputIds.length +
				record.projectReferences.length +
				record.rootNames.length +
				1,
			0
		) +
		snapshot.programs.reduce(
			(count, record) =>
				count +
				record.sourceIds.length +
				record.rootSourceIds.length +
				record.diagnosticIds.length +
				record.diagnosticFamilies.reduce(
					(familyCount, family) => familyCount + family.diagnosticIds.length,
					0
				) +
				1,
			0
		) +
		snapshot.sources.reduce(
			(count, record) => count + record.diagnosticIds.length + (record.rootNodeId === null ? 1 : 2),
			0
		) +
		snapshot.scopes.reduce(
			(count, record) =>
				count +
				3 +
				(record.sourceId === null ? 0 : 1) +
				(record.ownerNodeId === null ? 0 : 1) +
				(record.parentScopeId === null ? 0 : 1),
			0
		) +
		snapshot.astNodes.reduce((count, record) => count + (record.parentId === null ? 1 : 2), 0) +
		snapshot.declarationCandidates.reduce(
			(count, record) =>
				count +
				3 +
				(record.nameNodeId === null ? 0 : 1) +
				(record.exportCarrierNodeId === null ? 0 : 1),
			0
		) +
		snapshot.declarations.reduce(
			(count, record) =>
				count +
				3 +
				(record.candidateId === null ? 0 : 1) +
				(record.nodeId === null ? 0 : 1) +
				(record.declaringScopeId === null ? 0 : 1),
			0
		) +
		snapshot.symbols.reduce(
			(count, record) =>
				count +
				record.declarationIds.length +
				record.fallbackReferenceNodeIds.length +
				3 +
				(record.valueDeclarationId === null ? 0 : 1),
			0
		) +
		snapshot.aliases.reduce(
			(count, record) =>
				count +
				2 +
				(record.targetSymbolId === null ? 0 : 1) +
				(record.terminalSymbolId === null ? 0 : 1),
			0
		) +
		snapshot.references.reduce(
			(count, record) =>
				count +
				3 +
				(record.symbolId === null ? 0 : 1) +
				(record.resolvedSymbolId === null ? 0 : 1) +
				(record.containingScopeId === null ? 0 : 1),
			0
		) +
		snapshot.moduleResolutions.reduce(
			(count, record) =>
				count +
				3 +
				(record.moduleSymbolId === null ? 0 : 1) +
				(record.targetSourceId === null ? 0 : 1),
			0
		) +
		snapshot.moduleExports.reduce(
			(count, record) => count + 3 + (record.targetSymbolId === null ? 0 : 1),
			0
		) +
		snapshot.diagnostics.reduce(
			(count, record) => count + record.related.length + (record.sourceId === null ? 2 : 3),
			0
		) +
		snapshot.literals.reduce((count) => count + 2, 0) +
		snapshot.invocations.reduce(
			(count, record) =>
				count + record.argumentNodeIds.length + (record.templateNodeId === null ? 4 : 5),
			0
		) +
		snapshot.assignments.reduce(
			(count, record) => count + (record.valueNodeId === null ? 3 : 4),
			0
		) +
		snapshot.provenances.reduce(
			(count, record) =>
				count +
				record.invalidationDependencies.length +
				record.epistemic.supportBasis.sourceRefs.length +
				(record.parentProvenanceId === null ? 0 : 1) +
				(record.sourceId === null ? 0 : 1),
			0
		) +
		snapshot.compilerInputs.reduce(
			(count, record) => count + ('resultEntries' in record ? record.resultEntries.length : 0),
			0
		) +
		snapshot.populations.reduce(
			(count, record) =>
				count +
				Object.values(record.members).reduce(
					(memberCount, members) => memberCount + members.length,
					0
				),
			0
		) +
		snapshot.assignabilityRequests.length * 2 +
		snapshot.types.reduce(
			(count, record) =>
				count +
				record.acquisitionAnchors.length +
				4 +
				(record.aliasSymbolId === null ? 0 : 1) +
				(record.symbolId === null ? 0 : 1),
			0
		) +
		snapshot.typeParameters.length * 7 +
		snapshot.signatures.reduce(
			(count, record) => count + record.parameterIds.length + record.typeParameterIds.length + 6,
			0
		) +
		snapshot.signatureParameters.length * 5 +
		snapshot.overloadSets.length * 4 +
		snapshot.typeRelations.reduce(
			(count, record) =>
				count + ('argumentTypeIds' in record ? record.argumentTypeIds.length : 0) + 6,
			0
		) +
		snapshot.astNodes.length;
	if (referencePopulation > options.maxReferenceChecks)
		return {
			issues: [
				{
					code: 'VALIDATION_BUDGET_EXHAUSTED',
					message: `Reference count ${referencePopulation} exceeds validator limit ${options.maxReferenceChecks}.`,
					path: '$'
				}
			],
			state: 'BUDGET_EXHAUSTED'
		};

	if (snapshot.canonicalProfile !== SEMANTIC_CANONICAL_PROFILE)
		issue('INVALID_VALUE', '$.canonicalProfile', 'Unexpected semantic canonical profile.');
	if (snapshot.astTraversalProfile !== SEMANTIC_AST_TRAVERSAL_PROFILE)
		issue('INVALID_VALUE', '$.astTraversalProfile', 'Unexpected AST traversal profile.');
	if (snapshot.extractionVersion !== SEMANTIC_EXTRACTION_VERSION)
		issue('INVALID_VALUE', '$.extractionVersion', 'Unexpected extraction version.');
	if (snapshot.operationVersion !== SEMANTIC_OPERATION_VERSION)
		issue('INVALID_VALUE', '$.operationVersion', 'Unexpected semantic operation version.');
	if (snapshot.fullJanCsaa007Conformance !== FULL_JAN_CSAA_007_CONFORMANCE)
		issue(
			'CONFORMANCE_OVERCLAIM',
			'$.fullJanCsaa007Conformance',
			'Slice 3B must not claim full JAN-CSAA-007 conformance.'
		);
	if (
		snapshot.provider.id !== 'typescript' ||
		snapshot.provider.version !== TYPESCRIPT_PROVIDER_VERSION ||
		snapshot.provider.api !== 'PUBLIC_COMPILER_API'
	) {
		issue(
			'INVALID_VALUE',
			'$.provider',
			'Snapshot must bind the public TypeScript 5.9.3 Compiler API.'
		);
	}
	if (!SHA256.test(snapshot.subjectId))
		issue('INVALID_VALUE', '$.subjectId', 'Subject identity must be lowercase SHA-256.');
	if (
		!SEMANTIC_BUDGET_KEYS.every(
			(key) => Number.isSafeInteger(snapshot.budgets[key]) && snapshot.budgets[key] > 0
		)
	)
		issue(
			'INVALID_VALUE',
			'$.budgets',
			'Snapshot extraction budgets must be positive safe integers.'
		);
	if (canonicalBytes > snapshot.budgets.maxSnapshotBytes)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxSnapshotBytes',
			'Canonical snapshot UTF-8 bytes exceed the producing extraction budget.'
		);
	if (snapshot.projects.length > snapshot.budgets.maxProjects)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxProjects',
			'Retained project count exceeds the producing extraction budget.'
		);
	if (snapshot.sources.length > snapshot.budgets.maxSources)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxSources',
			'Retained source count exceeds the producing extraction budget.'
		);
	if (snapshot.scopes.length > snapshot.budgets.maxScopes)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxScopes',
			'Retained lexical-scope count exceeds the producing extraction budget.'
		);
	if (snapshot.astNodes.length > snapshot.budgets.maxAstNodes)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxAstNodes',
			'Retained AST-node count exceeds the producing extraction budget.'
		);
	const diagnosticOccurrences = snapshot.diagnostics.reduce(
		(total, diagnostic) => total + diagnostic.multiplicity,
		0
	);
	if (
		!Number.isSafeInteger(diagnosticOccurrences) ||
		diagnosticOccurrences > snapshot.budgets.maxDiagnostics
	)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxDiagnostics',
			'Retained diagnostic occurrence count exceeds the producing extraction budget.'
		);
	let diagnosticCharacters = 0;
	let diagnosticCharactersOverflow = false;
	for (const diagnostic of snapshot.diagnostics) {
		const perOccurrence =
			diagnosticMessageCharacterCount(diagnostic.message) +
			diagnostic.related.reduce(
				(total, related) => total + diagnosticMessageCharacterCount(related.message),
				0
			);
		const contribution = perOccurrence * diagnostic.multiplicity;
		if (
			!Number.isSafeInteger(perOccurrence) ||
			!Number.isSafeInteger(contribution) ||
			!Number.isSafeInteger(diagnosticCharacters + contribution)
		) {
			diagnosticCharactersOverflow = true;
			break;
		}
		diagnosticCharacters += contribution;
	}
	if (
		diagnosticCharactersOverflow ||
		diagnosticCharacters > snapshot.budgets.maxDiagnosticCharacters
	)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxDiagnosticCharacters',
			'Retained diagnostic-message characters exceed the producing extraction budget.'
		);
	if (snapshot.compilerInputs.length > snapshot.budgets.maxCompilerQueries)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxCompilerQueries',
			'Captured compiler query count exceeds the producing extraction budget.'
		);
	const compilerFactCount =
		snapshot.aliases.length +
		snapshot.declarations.length +
		snapshot.moduleExports.length +
		snapshot.moduleResolutions.length +
		snapshot.references.length +
		snapshot.symbols.length +
		snapshot.overloadSets.length +
		snapshot.signatureParameters.length +
		snapshot.signatures.length +
		snapshot.typeParameters.length +
		snapshot.typeRelations.length +
		snapshot.types.length;
	if (compilerFactCount > snapshot.budgets.maxCompilerFacts)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxCompilerFacts',
			'Retained compiler fact count exceeds the producing compiler-fact budget.'
		);
	const compilerQueryInvocations = snapshot.compilerInputs.reduce(
		(total, observation) => total + observation.invocationCount,
		0
	);
	if (
		!Number.isSafeInteger(compilerQueryInvocations) ||
		compilerQueryInvocations > snapshot.budgets.maxCompilerQueryInvocations
	)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxCompilerQueryInvocations',
			'Captured compiler query invocation count exceeds the producing extraction budget.'
		);
	const liveContextReadsByPath = new Map<
		string,
		Extract<CompilerInputObservation, { operation: 'READ_FILE'; result: 'PRESENT' }>
	>();
	for (const observation of snapshot.compilerInputs)
		if (
			observation.operation === 'READ_FILE' &&
			observation.result === 'PRESENT' &&
			observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT' &&
			!liveContextReadsByPath.has(observation.logicalPath)
		)
			liveContextReadsByPath.set(observation.logicalPath, observation);
	if (liveContextReadsByPath.size > snapshot.budgets.maxContextFiles)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxContextFiles',
			'Captured live compiler-context file count exceeds the producing extraction budget.'
		);
	const contextBytes = [...liveContextReadsByPath.values()].reduce(
		(total, observation) => total + observation.contentBytes,
		0
	);
	if (!Number.isSafeInteger(contextBytes) || contextBytes > snapshot.budgets.maxContextBytes)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxContextBytes',
			'Captured compiler-context bytes exceed the producing extraction budget.'
		);
	for (const [index, observation] of snapshot.compilerInputs.entries()) {
		if (
			observation.operation === 'READ_FILE' &&
			observation.result === 'PRESENT' &&
			observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT' &&
			observation.contentBytes > snapshot.budgets.maxContextFileBytes
		)
			issue(
				'INVALID_VALUE',
				`$.compilerInputs[${index}].contentBytes`,
				'Captured live compiler-context file exceeds the per-file producing extraction budget.'
			);
	}
	const directoryEntryCount = snapshot.compilerInputs.reduce(
		(total, observation) =>
			total + ('scannedEntries' in observation ? observation.scannedEntries : 0),
		0
	);
	if (
		!Number.isSafeInteger(directoryEntryCount) ||
		directoryEntryCount > snapshot.budgets.maxDirectoryEntries
	)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxDirectoryEntries',
			'Captured directory entries exceed the total producing extraction budget.'
		);
	const compilerInputMetadataBytes = Buffer.byteLength(
		canonicalSemanticJson(snapshot.compilerInputs),
		'utf8'
	);
	if (compilerInputMetadataBytes > snapshot.budgets.maxCompilerInputMetadataBytes)
		issue(
			'INVALID_VALUE',
			'$.budgets.maxCompilerInputMetadataBytes',
			'Captured compiler-input metadata exceeds the producing extraction budget.'
		);
	if (
		!SHA256.test(snapshot.contextDigest) ||
		snapshot.contextDigest !== compilerInputClosureDigest(snapshot.compilerInputs)
	)
		issue(
			'IDENTITY_MISMATCH',
			'$.contextDigest',
			'Context digest must bind the exact compiler-input observation closure.'
		);
	if (!isCanonicalSet(snapshot.limitations.map(limitationKey)))
		issue('NONCANONICAL_ORDER', '$.limitations', 'Snapshot limitations must be a canonical set.');
	for (const [index, limitation] of snapshot.limitations.entries()) {
		if (limitation.reason.length === 0 || limitation.region.length === 0)
			issue(
				'INVALID_VALUE',
				`$.limitations[${index}]`,
				'Structured limitation reason and region must be non-empty.'
			);
		if (limitation.closureEffect === 'FATAL')
			issue(
				'INVALID_VALUE',
				`$.limitations[${index}].closureEffect`,
				'A snapshot containing a fatal closure failure must not be emitted.'
			);
	}
	const multiProgram = snapshot.programs.length > 1;
	const typeRequested = snapshot.requestedCapabilities.includes('TS_TYPE');
	const programBoundaryLimitations = snapshot.limitations.filter(
		(limitation) =>
			limitation.capability === 'TS_SYMBOL' &&
			limitation.region === MULTI_PROGRAM_TS_SYMBOL_LIMITATION.region
	);
	if (
		multiProgram &&
		(programBoundaryLimitations.length !== 1 ||
			!isMultiProgramTsSymbolLimitation(programBoundaryLimitations[0]!))
	)
		issue(
			'INVALID_VALUE',
			'$.limitations',
			'Multi-Program snapshots require the exact canonical TS_SYMBOL Program-boundary limitation once.'
		);
	if (!multiProgram && programBoundaryLimitations.length > 0)
		issue(
			'INVALID_VALUE',
			'$.limitations',
			'The TS_SYMBOL Program-boundary limitation is forbidden unless the snapshot contains multiple Programs.'
		);
	const typeProgramBoundaryLimitations = snapshot.limitations.filter(
		(limitation) =>
			limitation.capability === 'TS_TYPE' &&
			limitation.region === MULTI_PROGRAM_TS_TYPE_LIMITATION.region
	);
	if (
		multiProgram &&
		typeRequested &&
		(typeProgramBoundaryLimitations.length !== 1 ||
			!isMultiProgramTsTypeLimitation(typeProgramBoundaryLimitations[0]!))
	)
		issue(
			'INVALID_VALUE',
			'$.limitations',
			'Multi-Program TS_TYPE snapshots require the exact canonical TS_TYPE Program-boundary limitation once.'
		);
	if ((!multiProgram || !typeRequested) && typeProgramBoundaryLimitations.length > 0)
		issue(
			'INVALID_VALUE',
			'$.limitations',
			'The TS_TYPE Program-boundary limitation is forbidden unless TS_TYPE is requested for multiple Programs.'
		);

	const requested = [...snapshot.requestedCapabilities];
	if (!isCanonicalSet(requested))
		issue(
			'NONCANONICAL_ORDER',
			'$.requestedCapabilities',
			'Requested capabilities must be unique and canonically ordered.'
		);
	for (const capability of requested)
		if (!CAPABILITIES.includes(capability))
			issue(
				'INVALID_VALUE',
				'$.requestedCapabilities',
				`Unknown capability ${String(capability)}.`
			);
	const expectedRequestedCapabilities = typeRequested
		? ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE']
		: ['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'];
	if (!sameMembers(requested, expectedRequestedCapabilities))
		issue(
			'INVALID_VALUE',
			'$.requestedCapabilities',
			'TS_TYPE may be requested only atop the required TS_PROJECT, TS_SYMBOL, and TS_SYNTAX prerequisite closure.'
		);
	const assignabilityRequestIds = snapshot.assignabilityRequests.map(
		(request) => request.requestId
	);
	if (
		new Set(assignabilityRequestIds).size !== assignabilityRequestIds.length ||
		!checkCanonicalOrder(assignabilityRequestIds)
	)
		issue(
			'NONCANONICAL_ORDER',
			'$.assignabilityRequests',
			'Assignability requests must have unique identities and be canonically ordered by request identity.'
		);
	if (!typeRequested && snapshot.assignabilityRequests.length > 0)
		issue(
			'CONFORMANCE_OVERCLAIM',
			'$.assignabilityRequests',
			'Assignability requests require the TS_TYPE capability.'
		);
	const typeQueryModes = new Set([
		'TYPE_AT_LOCATION',
		'TYPE_FROM_TYPE_NODE',
		'DECLARED_SYMBOL_TYPE',
		'VALUE_SYMBOL_TYPE_AT_LOCATION'
	]);
	for (const [requestIndex, request] of snapshot.assignabilityRequests.entries()) {
		const requestPath = `$.assignabilityRequests[${requestIndex}]`;
		if (
			request.requestId.length === 0 ||
			request.requesterRef.length === 0 ||
			!isUnicodeScalarString(request.requestId) ||
			!isUnicodeScalarString(request.requesterRef)
		)
			issue(
				'INVALID_VALUE',
				requestPath,
				'Assignability request identity and requester reference must be non-empty Unicode-scalar strings.'
			);
		for (const selectorName of ['source', 'target'] as const) {
			const selector = request[selectorName];
			const selectorPath = `${requestPath}.${selectorName}`;
			path(selector.logicalPath, `${selectorPath}.logicalPath`);
			if (
				!Number.isSafeInteger(selector.start) ||
				!Number.isSafeInteger(selector.end) ||
				selector.start < 0 ||
				selector.end < selector.start ||
				!Number.isSafeInteger(selector.syntaxKind) ||
				typescriptSyntaxKindName(selector.syntaxKind) === null ||
				!typeQueryModes.has(selector.queryMode)
			)
				issue(
					'INVALID_VALUE',
					selectorPath,
					'Type selector must use a canonical logical path, valid UTF-16 span, public SyntaxKind, and closed query mode.'
				);
		}
	}
	for (const [index, limitation] of snapshot.limitations.entries())
		if (limitation.closureEffect !== 'NONE' && !requested.includes(limitation.capability))
			issue(
				'INVALID_VALUE',
				`$.limitations[${index}]`,
				'A closure-degrading limitation must name a requested capability.'
			);
	const capabilityNames = snapshot.capabilities.map((entry) => entry.capability);
	if (
		!sameMembers(capabilityNames, CAPABILITIES) ||
		new Set(capabilityNames).size !== CAPABILITIES.length ||
		!isCanonicalSet(capabilityNames)
	)
		issue(
			'INVALID_VALUE',
			'$.capabilities',
			'Capability records must cover all four semantic capability values exactly once in canonical order.'
		);
	for (const entry of snapshot.capabilities) {
		if (entry.reason.length === 0)
			issue(
				'INVALID_VALUE',
				'$.capabilities',
				`${entry.capability} requires a non-empty support reason.`
			);
		if (
			entry.capability === 'TS_TYPE' &&
			(typeRequested ? entry.state === 'UNSUPPORTED' : entry.state !== 'UNSUPPORTED')
		)
			issue(
				'CONFORMANCE_OVERCLAIM',
				'$.capabilities',
				typeRequested
					? 'Requested TS_TYPE capability must be SUPPORTED or PARTIAL.'
					: 'Unrequested TS_TYPE capability must remain UNSUPPORTED.'
			);
		if (
			(entry.capability === 'TS_PROJECT' ||
				entry.capability === 'TS_SYMBOL' ||
				entry.capability === 'TS_SYNTAX') &&
			entry.state === 'UNSUPPORTED'
		) {
			issue(
				'INVALID_VALUE',
				'$.capabilities',
				`${entry.capability} is part of the implemented Slice 3B surface.`
			);
		}
	}

	const snapshotIdentity = semanticSnapshotId({
		assignabilityRequests: snapshot.assignabilityRequests,
		astTraversalProfile: snapshot.astTraversalProfile,
		budgets: snapshot.budgets,
		canonicalProfile: snapshot.canonicalProfile,
		contextDigest: snapshot.contextDigest,
		expectedEmpty: snapshot.expectedEmpty,
		extractionVersion: snapshot.extractionVersion,
		operationVersion: snapshot.operationVersion,
		projectRecipeDigests: snapshot.projects
			.map((project) => project.programRecipe.projectResolutionDigest)
			.sort(),
		provider: snapshot.provider,
		requestedCapabilities: snapshot.requestedCapabilities,
		schemaVersion: snapshot.schemaVersion,
		subjectId: snapshot.subjectId
	});
	if (
		!hasSemanticIdPrefix(snapshot.id, 'static', 'ts-snapshot') ||
		snapshot.id !== snapshotIdentity
	)
		issue(
			'IDENTITY_MISMATCH',
			'$.id',
			'Snapshot identity does not match its semantic input projection.'
		);

	function idsAt(
		records: readonly unknown[],
		path: string,
		prefix: string,
		family: string
	): string[] {
		const ids: string[] = [];
		for (let index = 0; index < records.length; index += 1) {
			const record = records[index];
			if (!isRecord(record) || typeof record.id !== 'string') {
				issue('INVALID_SHAPE', `${path}[${index}].id`, 'Record requires an id.');
				continue;
			}
			ids.push(record.id);
			if (!hasSemanticIdPrefix(record.id, prefix, family))
				issue('INVALID_VALUE', `${path}[${index}].id`, `Invalid ${family} identity.`);
		}
		if (new Set(ids).size !== ids.length)
			issue('DUPLICATE_ID', path, 'Record identities must be unique.');
		if (!checkCanonicalOrder(ids))
			issue('NONCANONICAL_ORDER', path, 'Records must be ordered by identity.');
		return ids;
	}

	const projectIds = idsAt(snapshot.projects, '$.projects', 'semantic', 'project');
	const programIds = idsAt(snapshot.programs, '$.programs', 'semantic', 'program');
	idsAt(snapshot.sources, '$.sources', 'semantic', 'source');
	idsAt(snapshot.scopes, '$.scopes', 'semantic', 'scope');
	const nodeIds = idsAt(snapshot.astNodes, '$.astNodes', 'semantic', 'node');
	const declarationCandidateIds = idsAt(
		snapshot.declarationCandidates,
		'$.declarationCandidates',
		'semantic',
		'decl-candidate'
	);
	idsAt(snapshot.declarations, '$.declarations', 'semantic', 'declaration');
	const symbolIds = idsAt(snapshot.symbols, '$.symbols', 'semantic', 'symbol');
	const aliasIds = idsAt(snapshot.aliases, '$.aliases', 'semantic', 'alias');
	idsAt(snapshot.references, '$.references', 'semantic', 'reference');
	const moduleResolutionIds = idsAt(
		snapshot.moduleResolutions,
		'$.moduleResolutions',
		'semantic',
		'module-resolution'
	);
	const moduleExportIds = idsAt(
		snapshot.moduleExports,
		'$.moduleExports',
		'semantic',
		'module-export'
	);
	const typeIds = idsAt(snapshot.types, '$.types', 'semantic', 'type');
	const typeParameterIds = idsAt(
		snapshot.typeParameters,
		'$.typeParameters',
		'semantic',
		'type-parameter'
	);
	const signatureIds = idsAt(snapshot.signatures, '$.signatures', 'semantic', 'signature');
	const signatureParameterIds = idsAt(
		snapshot.signatureParameters,
		'$.signatureParameters',
		'semantic',
		'signature-parameter'
	);
	const overloadSetIds = idsAt(snapshot.overloadSets, '$.overloadSets', 'semantic', 'overload-set');
	const typeRelationIds = idsAt(
		snapshot.typeRelations,
		'$.typeRelations',
		'semantic',
		'type-relation'
	);
	const invocationIds = idsAt(snapshot.invocations, '$.invocations', 'semantic', 'invocation');
	const diagnosticIds = idsAt(snapshot.diagnostics, '$.diagnostics', 'diagnostic', 'typescript');
	const provenanceIds = idsAt(snapshot.provenances, '$.provenances', 'analysis', 'provenance');
	const contextIds = idsAt(
		snapshot.compilerInputs,
		'$.compilerInputs',
		'analysis',
		'context-input'
	);
	if (
		!snapshot.requestedCapabilities.includes('TS_SYNTAX') &&
		snapshot.astNodes.length +
			snapshot.declarationCandidates.length +
			snapshot.literals.length +
			snapshot.invocations.length +
			snapshot.assignments.length >
			0
	)
		issue(
			'CONFORMANCE_OVERCLAIM',
			'$',
			'TS_SYNTAX records cannot be emitted when syntax was not requested.'
		);
	if (
		!snapshot.requestedCapabilities.includes('TS_SYMBOL') &&
		snapshot.scopes.length +
			snapshot.declarations.length +
			snapshot.symbols.length +
			snapshot.aliases.length +
			snapshot.references.length +
			snapshot.moduleResolutions.length +
			snapshot.moduleExports.length >
			0
	)
		issue(
			'CONFORMANCE_OVERCLAIM',
			'$',
			'TS_SYMBOL records cannot be emitted when symbol analysis was not requested.'
		);
	if (
		!typeRequested &&
		snapshot.assignabilityRequests.length +
			snapshot.overloadSets.length +
			snapshot.signatureParameters.length +
			snapshot.signatures.length +
			snapshot.typeParameters.length +
			snapshot.typeRelations.length +
			snapshot.types.length >
			0
	)
		issue(
			'CONFORMANCE_OVERCLAIM',
			'$',
			'TS_TYPE requests and records cannot be emitted when type analysis was not requested.'
		);
	const projectById = indexBy(snapshot.projects, (record) => record.id);
	const projectByConfigPath = indexBy(snapshot.projects, (record) => record.configPath);
	const programById = indexBy(snapshot.programs, (record) => record.id);
	const sourceById = indexBy(snapshot.sources, (record) => record.id);
	const scopeById = indexBy(snapshot.scopes, (record) => record.id);
	const nodeById = indexBy(snapshot.astNodes, (record) => record.id);
	const literalByNodeId = indexBy(snapshot.literals, (record) => record.nodeId);
	const declarationCandidateById = indexBy(snapshot.declarationCandidates, (record) => record.id);
	const declarationById = indexBy(snapshot.declarations, (record) => record.id);
	const symbolById = indexBy(snapshot.symbols, (record) => record.id);
	const aliasBySymbolId = indexBy(snapshot.aliases, (record) => record.aliasSymbolId);
	const typeById = indexBy(snapshot.types, (record) => record.id);
	const typeParameterById = indexBy(snapshot.typeParameters, (record) => record.id);
	const signatureById = indexBy(snapshot.signatures, (record) => record.id);
	const signatureParameterById = indexBy(snapshot.signatureParameters, (record) => record.id);
	const overloadSetById = indexBy(snapshot.overloadSets, (record) => record.id);
	const diagnosticById = indexBy(snapshot.diagnostics, (record) => record.id);
	const provenanceById = indexBy<SemanticFactProvenanceRecord>(
		snapshot.provenances,
		(record) => record.id
	);
	const provenanceIndexById = new Map(
		snapshot.provenances.map((record, index) => [record.id, index])
	);
	const contextById = indexBy(snapshot.compilerInputs, (record) => record.id);
	const sourcesByProject = new Map<string, StaticSemanticSnapshot['sources'][number][]>();
	const sourcesByProgram = new Map<string, StaticSemanticSnapshot['sources'][number][]>();
	const nodesBySource = new Map<string, StaticSemanticSnapshot['astNodes'][number][]>();
	const childrenByParent = new Map<string, StaticSemanticSnapshot['astNodes'][number][]>();
	const diagnosticsByProject = new Map<string, StaticSemanticSnapshot['diagnostics'][number][]>();
	const diagnosticsBySource = new Map<string, StaticSemanticSnapshot['diagnostics'][number][]>();
	const diagnosticsByProjectFamily = new Map<
		string,
		StaticSemanticSnapshot['diagnostics'][number][]
	>();
	const sourceByProjectPath = new Map<string, StaticSemanticSnapshot['sources'][number]>();
	const presentReadsByProjectPath = new Map<
		string,
		Extract<CompilerInputObservation, { operation: 'READ_FILE'; result: 'PRESENT' }>[]
	>();
	const supportRefsByProject = new Map<string, ReadonlySet<string>>();

	function programProjectReference(
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const program = programById.get(programId as never);
		const project = projectById.get(projectId as never);
		if (
			program === undefined ||
			project === undefined ||
			program.projectId !== projectId ||
			project.programId !== programId
		) {
			issue(
				'CROSS_PROJECT_REFERENCE',
				jsonPath,
				'Record Program and project must exist and be the same mutually bound compiler context.'
			);
			return false;
		}
		return true;
	}

	function sourceProgramReference(
		sourceId: string,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const source = sourceById.get(sourceId as never);
		if (source === undefined || source.programId !== programId || source.projectId !== projectId) {
			issue(
				'CROSS_PROJECT_REFERENCE',
				jsonPath,
				'Referenced source is absent or belongs to a different Program or project.'
			);
			return false;
		}
		return true;
	}

	function nodeProgramReference(
		nodeId: string,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const node = nodeById.get(nodeId as never);
		if (
			node === undefined ||
			!sourceProgramReference(node.sourceId, programId, projectId, jsonPath)
		) {
			if (node === undefined)
				issue('DANGLING_REFERENCE', jsonPath, 'Referenced AST node is absent.');
			return false;
		}
		return true;
	}

	function declarationProgramReference(
		declarationId: string,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const declaration = declarationById.get(declarationId as never);
		if (
			declaration === undefined ||
			!sourceProgramReference(declaration.sourceId, programId, projectId, jsonPath)
		) {
			if (declaration === undefined)
				issue('DANGLING_REFERENCE', jsonPath, 'Referenced declaration is absent.');
			return false;
		}
		return true;
	}

	function symbolProgramReference(
		symbolId: string,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const symbol = symbolById.get(symbolId as never);
		if (symbol === undefined || symbol.programId !== programId || symbol.projectId !== projectId) {
			issue(
				symbol === undefined ? 'DANGLING_REFERENCE' : 'CROSS_PROJECT_REFERENCE',
				jsonPath,
				symbol === undefined
					? 'Referenced symbol is absent.'
					: 'Referenced symbol belongs to a different Program or project.'
			);
			return false;
		}
		return true;
	}
	const frozenReads = snapshot.compilerInputs.filter(
		(
			observation
		): observation is Extract<
			CompilerInputObservation,
			{ operation: 'READ_FILE'; result: 'PRESENT' }
		> =>
			observation.operation === 'READ_FILE' &&
			observation.result === 'PRESENT' &&
			observation.byteBudgetClass === 'FROZEN_SUBJECT'
	);
	const frozenSubject = context.frozenSubject;
	const caseObservation = snapshot.compilerInputs.find(
		(observation) => observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES'
	);
	const caseSensitive = caseObservation?.result !== 'CASE_INSENSITIVE';
	const frozenPathKey = (logicalPath: string): string =>
		caseSensitive ? logicalPath : logicalPath.toLowerCase();
	const workspaceAliases = (frozenSubject?.workspaces ?? [])
		.map((workspace) => ({
			aliasPath: `node_modules/${workspace.name}`,
			targetPath: workspace.path
		}))
		.sort(
			(left, right) =>
				right.aliasPath.length - left.aliasPath.length ||
				(left.aliasPath < right.aliasPath ? -1 : 1)
		);
	function frozenArtifactPath(logicalPath: string): string {
		for (const alias of workspaceAliases) {
			const candidate = frozenPathKey(logicalPath);
			const aliasKey = frozenPathKey(alias.aliasPath);
			if (candidate === aliasKey) return alias.targetPath;
			if (candidate.startsWith(`${aliasKey}/`))
				return `${alias.targetPath}/${logicalPath.slice(alias.aliasPath.length + 1)}`;
		}
		return logicalPath;
	}
	if (frozenReads.length > 0 && frozenSubject === undefined)
		issue(
			'FROZEN_EVIDENCE_REQUIRED',
			'$validationContext.frozenSubject',
			'FROZEN_SUBJECT observations require the exact FrozenSubject artifact witness.'
		);
	if (frozenSubject !== undefined && frozenSubject.descriptor.subjectId !== snapshot.subjectId)
		issue(
			'FROZEN_EVIDENCE_REQUIRED',
			'$validationContext.frozenSubject.descriptor.subjectId',
			'FrozenSubject witness does not bind the semantic snapshot subject.'
		);
	if (frozenSubject !== undefined && frozenSubject.descriptor.subjectId === snapshot.subjectId) {
		for (const observation of frozenReads) {
			const artifactPath = frozenArtifactPath(observation.logicalPath);
			const matchingArtifacts = frozenSubject.artifacts.filter(
				(artifact) => artifact.canonicalPathKey === frozenPathKey(artifactPath)
			);
			const artifact = matchingArtifacts.length === 1 ? matchingArtifacts[0] : undefined;
			if (
				artifact === undefined ||
				(caseSensitive && artifact.path !== artifactPath) ||
				artifact.bytes !== observation.contentBytes ||
				artifact.sha256 !== observation.contentSha256
			) {
				issue(
					'FROZEN_EVIDENCE_REQUIRED',
					'$validationContext.frozenSubject.artifacts',
					`Frozen observation ${observation.logicalPath} does not match exactly one subject artifact by path, bytes, and digest.`
				);
			}
		}
	}
	for (const source of snapshot.sources) {
		appendGrouped(sourcesByProject, source.projectId, source);
		appendGrouped(sourcesByProgram, source.programId, source);
		const projectPathKey = `${source.projectId}\0${source.logicalPath}`;
		if (!sourceByProjectPath.has(projectPathKey)) sourceByProjectPath.set(projectPathKey, source);
	}
	for (const node of snapshot.astNodes) {
		appendGrouped(nodesBySource, node.sourceId, node);
		if (node.parentId !== null) appendGrouped(childrenByParent, node.parentId, node);
	}
	for (const diagnostic of snapshot.diagnostics) {
		appendGrouped(diagnosticsByProject, diagnostic.projectId, diagnostic);
		appendGrouped(
			diagnosticsByProjectFamily,
			`${diagnostic.projectId}\0${diagnostic.family}`,
			diagnostic
		);
		if (diagnostic.sourceId !== null)
			appendGrouped(diagnosticsBySource, diagnostic.sourceId, diagnostic);
	}
	for (const project of snapshot.projects) {
		const projectProgram = programById.get(project.programId);
		supportRefsByProject.set(
			project.id,
			new Set(
				[
					snapshot.subjectId,
					snapshot.id,
					project.id,
					projectProgram?.id,
					...project.contextInputIds
				].filter((item): item is string => item !== undefined)
			)
		);
		for (const contextInputId of project.contextInputIds) {
			const observation = contextById.get(contextInputId);
			if (observation?.operation === 'READ_FILE' && observation.result === 'PRESENT')
				appendGrouped(
					presentReadsByProjectPath,
					`${project.id}\0${observation.logicalPath}`,
					observation
				);
		}
	}
	if (projectByConfigPath.size !== snapshot.projects.length)
		issue('DUPLICATE_ID', '$.projects', 'Project configuration paths must be unique.');
	if (frozenSubject !== undefined && frozenSubject.descriptor.subjectId === snapshot.subjectId) {
		const authoritativePaths = frozenSubject.projects.map((project) => project.configPath);
		if (
			new Set(authoritativePaths).size !== authoritativePaths.length ||
			snapshot.projects.length !== authoritativePaths.length ||
			!sameMembers(
				snapshot.projects.map((project) => project.configPath),
				authoritativePaths
			)
		)
			issue(
				'FROZEN_EVIDENCE_REQUIRED',
				'$.projects',
				'Snapshot projects must equal the complete FrozenSubject project population; INCOMPLETE projects remain present and partial.'
			);
		for (const authoritative of frozenSubject.projects) {
			const project = projectByConfigPath.get(authoritative.configPath);
			if (project === undefined) continue;
			if (
				canonicalSemanticJson(project.programRecipe) !==
					canonicalSemanticJson(authoritative.programRecipe) ||
				project.configPath !== authoritative.configPath ||
				project.kind !== authoritative.kind ||
				project.rootDisposition !== authoritative.rootDisposition ||
				!sameMembers(project.rootNames, authoritative.programRecipe.rootNames) ||
				!sameMembers(project.projectReferences, authoritative.projectReferences) ||
				!sameMembers(project.frameworkCandidates, authoritative.frameworkCandidates)
			) {
				issue(
					'FROZEN_EVIDENCE_REQUIRED',
					'$.projects',
					`Project ${authoritative.configPath} does not reproduce its authoritative FrozenSubject recipe and discovery mirrors.`
				);
			}
			const authoritativeProjectEvidencePartial =
				authoritative.rootDisposition === 'INCOMPLETE' ||
				authoritative.typescriptDiagnostics.some(
					(entry) => entry.severity === 'ERROR' || entry.code === 'TYPESCRIPT_PROJECT_PARTIAL'
				);
			if (
				authoritativeProjectEvidencePartial &&
				(project.health !== 'PARTIAL' ||
					!project.partialityReasons.some(
						(reason) =>
							reason.capability === 'TS_PROJECT' && reason.code === 'TYPESCRIPT_PROJECT_PARTIAL'
					))
			)
				issue(
					'FROZEN_EVIDENCE_REQUIRED',
					'$.projects',
					`Incomplete or configuration-partial frozen project ${authoritative.configPath} must remain explicitly TS_PROJECT partial.`
				);
		}
	}
	if (
		new Set(snapshot.programs.map((program) => program.projectId)).size !== snapshot.programs.length
	)
		issue('DUPLICATE_ID', '$.programs', 'Each project may own exactly one Program.');
	const sourceProgramPaths = snapshot.sources.map(
		(source) => `${source.programId}\0${source.logicalPath}`
	);
	if (new Set(sourceProgramPaths).size !== sourceProgramPaths.length)
		issue(
			'DUPLICATE_ID',
			'$.sources',
			'A Program may contain at most one source record per logical path.'
		);

	function path(valueToCheck: string | null, jsonPath: string): void {
		if (valueToCheck !== null && !isLogicalPath(valueToCheck))
			issue('ABSOLUTE_PATH', jsonPath, 'Serialized paths must be canonical logical paths.');
		else if (valueToCheck !== null && valueToCheck.length > snapshot.budgets.maxPathCharacters)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Serialized path exceeds the producing path-character budget.'
			);
	}

	function diagnosticMessage(
		root: StaticSemanticSnapshot['diagnostics'][number]['message'],
		jsonPath: string
	): void {
		const stack = [{ message: root, path: jsonPath }];
		while (stack.length > 0) {
			const current = stack.pop()!;
			if (current.message.textLength === 0)
				issue('INVALID_VALUE', current.path, 'Diagnostic message text must not be empty.');
			if ((current.message.category === null) !== (current.message.code === null))
				issue(
					'INVALID_VALUE',
					current.path,
					'Diagnostic message category and code must be present or absent together.'
				);
			if (!SHA256.test(current.message.textSha256))
				issue(
					'INVALID_VALUE',
					`${current.path}.textSha256`,
					'Diagnostic message digest must be lowercase SHA-256.'
				);
			if (current.message.textEncoding === 'UNICODE_SCALAR') {
				if (
					!isUnicodeScalarString(current.message.text) ||
					current.message.textLength !== current.message.text.length ||
					current.message.textSha256 !==
						semanticUtf16CodeUnitsDigest(
							'JAN-CSAA-DIAGNOSTIC-TEXT',
							['UNICODE_SCALAR'],
							current.message.text
						)
				)
					issue(
						'INVALID_VALUE',
						current.path,
						'Scalar diagnostic text encoding, length, or digest is incoherent.'
					);
			} else {
				const units = parseUtf16CodeUnitsHex(current.message.text);
				if (
					units === null ||
					!hasLoneUtf16CodeUnit(units) ||
					current.message.textLength !== units.length ||
					current.message.textSha256 !==
						semanticUtf16CodeUnitsDigest(
							'JAN-CSAA-DIAGNOSTIC-TEXT',
							['UTF16_CODE_UNITS_HEX'],
							units
						)
				)
					issue(
						'INVALID_VALUE',
						current.path,
						'UTF-16 diagnostic text encoding, length, or digest is incoherent.'
					);
			}
			for (let index = current.message.next.length - 1; index >= 0; index -= 1)
				stack.push({
					message: current.message.next[index]!,
					path: `${current.path}.next[${index}]`
				});
		}
	}

	const validatedProvenanceIds = new Set<string>();
	const referencedProvenanceIds = new Set<string>();
	function validateProvenanceRecord(record: SemanticFactProvenanceRecord, jsonPath: string): void {
		if (validatedProvenanceIds.has(record.id)) return;
		validatedProvenanceIds.add(record.id);
		const { id: _id, ...preimage } = record;
		if (semanticProvenanceId(preimage) !== record.id)
			issue(
				'IDENTITY_MISMATCH',
				`${jsonPath}.id`,
				'Provenance identity does not bind its exact canonical content.'
			);
		if (record.snapshotId !== snapshot.id || record.subjectId !== snapshot.subjectId)
			issue(
				'CROSS_PROJECT_REFERENCE',
				jsonPath,
				'Provenance does not bind the containing snapshot and subject.'
			);
		if (!snapshot.requestedCapabilities.includes(record.capability))
			issue(
				'CONFORMANCE_OVERCLAIM',
				`${jsonPath}.capability`,
				`Provenance capability ${record.capability} was not requested.`
			);
		if (record.extractionVersion !== snapshot.extractionVersion)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.extractionVersion`,
				'Provenance extraction version is inconsistent.'
			);
		if (
			record.provider.id !== snapshot.provider.id ||
			record.provider.version !== snapshot.provider.version ||
			record.provider.api !== snapshot.provider.api
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.provider`,
				'Provenance provider does not match snapshot provider.'
			);
		const epistemic = record.epistemic;
		if (
			!isRecord(epistemic) ||
			!Array.isArray(record.invalidationDependencies) ||
			!Array.isArray(record.limitations)
		)
			issue(
				'INVALID_SHAPE',
				jsonPath,
				'Provenance requires epistemic, invalidation, and limitation state.'
			);
		if (
			!['supported', 'partial'].includes(epistemic.capabilityCoverage) ||
			epistemic.executionHealth !== 'succeeded' ||
			!['current-for-subject', 'unknown'].includes(epistemic.freshness) ||
			!['unopposed', 'corroborated'].includes(epistemic.conflict) ||
			!['direct', 'derived'].includes(epistemic.inference)
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.epistemic`,
				'Slice 3B provenance requires explicit successful bounded epistemic state.'
			);
		if (
			!['direct-extraction', 'compiler-confirmed', 'derived'].includes(
				epistemic.supportBasis.kind
			) ||
			epistemic.supportBasis.sourceRefs.length === 0 ||
			epistemic.supportBasis.method === null ||
			epistemic.supportBasis.method.length === 0 ||
			epistemic.rationale.length === 0 ||
			epistemic.supportBasis.rationale.length === 0 ||
			!isCanonicalSet(epistemic.supportBasis.sourceRefs) ||
			!isCanonicalSet(epistemic.unresolvedRegions)
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.epistemic`,
				'Epistemic support, rationale, and unresolved regions must be explicit non-empty canonical evidence.'
			);
		const degradingLimitation = record.limitations.some(
			(limitation) => limitation.closureEffect !== 'NONE'
		);
		if (
			(epistemic.freshness === 'unknown' ||
				epistemic.unresolvedRegions.length > 0 ||
				degradingLimitation) &&
			epistemic.capabilityCoverage !== 'partial'
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.epistemic.capabilityCoverage`,
				'Unknown freshness, unresolved regions, or closure-degrading limitations require partial capability coverage.'
			);
		if (!isCanonicalSet(record.limitations.map(limitationKey)))
			issue(
				'NONCANONICAL_ORDER',
				`${jsonPath}.limitations`,
				'Provenance limitations must be a canonical set.'
			);
		for (const [limitationIndex, limitation] of record.limitations.entries()) {
			if (
				limitation.capability !== record.capability ||
				limitation.reason.length === 0 ||
				limitation.region.length === 0
			)
				issue(
					'INVALID_VALUE',
					`${jsonPath}.limitations[${limitationIndex}]`,
					'Provenance limitation must name the capability and non-empty region and reason.'
				);
			if (limitation.closureEffect === 'FATAL')
				issue(
					'INVALID_VALUE',
					`${jsonPath}.limitations[${limitationIndex}].closureEffect`,
					'Fatal provenance must not be emitted.'
				);
		}
		const provenanceProgramBoundaryLimitations = record.limitations.filter(
			(limitation) =>
				limitation.capability === 'TS_SYMBOL' &&
				limitation.region === MULTI_PROGRAM_TS_SYMBOL_LIMITATION.region
		);
		if (
			multiProgram &&
			record.capability === 'TS_SYMBOL' &&
			(provenanceProgramBoundaryLimitations.length !== 1 ||
				!isMultiProgramTsSymbolLimitation(provenanceProgramBoundaryLimitations[0]!))
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.limitations`,
				'Every TS_SYMBOL provenance in a multi-Program snapshot requires the exact canonical Program-boundary limitation once.'
			);
		if (
			(!multiProgram || record.capability !== 'TS_SYMBOL') &&
			provenanceProgramBoundaryLimitations.length > 0
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.limitations`,
				'The TS_SYMBOL Program-boundary provenance limitation is forbidden outside TS_SYMBOL provenance in a multi-Program snapshot.'
			);
		const provenanceTypeProgramBoundaryLimitations = record.limitations.filter(
			(limitation) =>
				limitation.capability === 'TS_TYPE' &&
				limitation.region === MULTI_PROGRAM_TS_TYPE_LIMITATION.region
		);
		if (
			multiProgram &&
			record.capability === 'TS_TYPE' &&
			(provenanceTypeProgramBoundaryLimitations.length !== 1 ||
				!isMultiProgramTsTypeLimitation(provenanceTypeProgramBoundaryLimitations[0]!))
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.limitations`,
				'Every TS_TYPE provenance in a multi-Program snapshot requires the exact canonical Program-boundary limitation once.'
			);
		if (
			(!multiProgram || record.capability !== 'TS_TYPE') &&
			provenanceTypeProgramBoundaryLimitations.length > 0
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.limitations`,
				'The TS_TYPE Program-boundary provenance limitation is forbidden outside TS_TYPE provenance in a multi-Program snapshot.'
			);
		const project = projectById.get(record.projectId);
		const program = project === undefined ? undefined : programById.get(project.programId);
		if (project === undefined || program === undefined)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`${jsonPath}.projectId`,
				'Provenance project or Program is absent.'
			);
		const expectedDependencies = new Map([
			['SUBJECT', snapshot.subjectId],
			['PROJECT_RECIPE', project?.programRecipe.projectResolutionDigest ?? ''],
			['CONTEXT_INPUT', program?.contextDigest ?? ''],
			['PROVIDER', sha256(canonicalSemanticJson(snapshot.provider))],
			['EXTRACTION', sha256(canonicalSemanticJson(snapshot.extractionVersion))]
		]);
		const dependencyKinds = record.invalidationDependencies.map((dependency) => dependency.kind);
		if (
			!isCanonicalSet(dependencyKinds) ||
			!sameMembers(dependencyKinds, [...expectedDependencies.keys()])
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.invalidationDependencies`,
				'Provenance invalidation dependencies must cover the five exact Slice 3B inputs.'
			);
		for (const dependency of record.invalidationDependencies)
			if (
				!SHA256.test(dependency.digest) ||
				dependency.digest !== expectedDependencies.get(dependency.kind)
			)
				issue(
					'IDENTITY_MISMATCH',
					`${jsonPath}.invalidationDependencies`,
					`Invalidation dependency ${dependency.kind} does not bind the actual input.`
				);
		if (record.sourceId === null) {
			if (record.parentProvenanceId !== null)
				issue(
					'INVALID_VALUE',
					`${jsonPath}.parentProvenanceId`,
					'Project provenance must not have a parent.'
				);
			const expectedSupportRefs = supportRefsByProject.get(record.projectId);
			if (
				expectedSupportRefs === undefined ||
				!sameMembers(epistemic.supportBasis.sourceRefs, [...expectedSupportRefs])
			)
				issue(
					'DANGLING_REFERENCE',
					`${jsonPath}.epistemic.supportBasis.sourceRefs`,
					'Project provenance support must bind exactly the subject, snapshot, project, Program, and attributed compiler inputs.'
				);
		} else {
			const source = sourceById.get(record.sourceId);
			if (source === undefined || source.projectId !== record.projectId)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`${jsonPath}.sourceId`,
					'Source provenance must bind a source in the same project.'
				);
			const parent =
				record.parentProvenanceId === null
					? undefined
					: provenanceById.get(record.parentProvenanceId);
			if (
				parent === undefined ||
				parent.sourceId !== null ||
				parent.parentProvenanceId !== null ||
				parent.projectId !== record.projectId ||
				parent.capability !== record.capability
			)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`${jsonPath}.parentProvenanceId`,
					'Source provenance must have exactly one same-project, same-capability project-provenance parent.'
				);
			else {
				referencedProvenanceIds.add(parent.id);
				validateProvenanceRecord(
					parent,
					`$.provenances[${provenanceIndexById.get(parent.id) ?? -1}]`
				);
				const childLimitationKeys = new Set(record.limitations.map(limitationKey));
				const childUnresolvedRegions = new Set(record.epistemic.unresolvedRegions);
				if (
					parent.limitations.some(
						(limitation) => !childLimitationKeys.has(limitationKey(limitation))
					) ||
					parent.epistemic.unresolvedRegions.some((region) => !childUnresolvedRegions.has(region))
				)
					issue(
						'INVALID_VALUE',
						`${jsonPath}.parentProvenanceId`,
						'Source provenance must monotonically preserve every parent limitation and unresolved region.'
					);
			}
			if (
				!sameMembers(epistemic.supportBasis.sourceRefs, [
					record.parentProvenanceId ?? '',
					record.sourceId
				])
			)
				issue(
					'INVALID_VALUE',
					`${jsonPath}.epistemic.supportBasis.sourceRefs`,
					'Source provenance support must bind exactly its parent provenance and source.'
				);
		}
	}

	function provenance(
		provenanceId: string,
		projectId: string,
		capability: 'TS_PROJECT' | 'TS_SYMBOL' | 'TS_SYNTAX' | 'TS_TYPE',
		jsonPath: string,
		sourceId?: string
	): SemanticFactProvenanceRecord | undefined {
		referencedProvenanceIds.add(provenanceId);
		const record = provenanceById.get(provenanceId);
		if (record === undefined) {
			issue('DANGLING_REFERENCE', jsonPath, 'Fact references absent provenance.');
			return undefined;
		}
		validateProvenanceRecord(record, `$.provenances[${provenanceIndexById.get(record.id) ?? -1}]`);
		if (record.projectId !== projectId || record.capability !== capability)
			issue(
				'CROSS_PROJECT_REFERENCE',
				jsonPath,
				'Fact provenance does not bind its project and capability.'
			);
		if ((sourceId ?? null) !== record.sourceId)
			issue(
				'CROSS_PROJECT_REFERENCE',
				jsonPath,
				'Fact provenance does not bind its exact source context.'
			);
		return record;
	}

	function scopeDerivedProvenance(
		provenanceId: string,
		projectId: string,
		jsonPath: string,
		sourceId?: string
	): void {
		const record = provenance(provenanceId, projectId, 'TS_SYMBOL', jsonPath, sourceId);
		if (
			record !== undefined &&
			(record.epistemic.inference !== 'derived' ||
				record.epistemic.supportBasis.kind !== 'derived' ||
				record.epistemic.supportBasis.method !== 'typescript-public-ast-binding-rules')
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Scope and binding-placement facts require explicit derived public-AST binding-rule provenance.'
			);
	}

	function compilerSymbolProvenance(
		provenanceId: string,
		projectId: string,
		jsonPath: string,
		sourceId?: string
	): void {
		const record = provenance(provenanceId, projectId, 'TS_SYMBOL', jsonPath, sourceId);
		if (
			record !== undefined &&
			(record.epistemic.inference !== 'direct' ||
				record.epistemic.supportBasis.kind !== 'compiler-confirmed' ||
				record.epistemic.supportBasis.method !== 'typescript-public-type-checker-binding')
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Pure TypeChecker facts require direct compiler-confirmed provenance.'
			);
	}

	function compilerTypeProvenance(
		provenanceId: string,
		projectId: string,
		jsonPath: string,
		sourceId?: string
	): void {
		const record = provenance(provenanceId, projectId, 'TS_TYPE', jsonPath, sourceId);
		if (
			record !== undefined &&
			(record.epistemic.inference !== 'direct' ||
				record.epistemic.supportBasis.kind !== 'compiler-confirmed' ||
				record.epistemic.supportBasis.method !==
					'typescript-public-type-checker-types-and-signatures')
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Type and signature facts require direct compiler-confirmed public TypeChecker provenance.'
			);
	}

	function degradedSymbolProvenance(
		provenanceId: string,
		projectId: string,
		jsonPath: string,
		sourceId?: string
	): void {
		const record = provenance(provenanceId, projectId, 'TS_SYMBOL', jsonPath, sourceId);
		if (
			record !== undefined &&
			(record.epistemic.capabilityCoverage !== 'partial' ||
				!record.limitations.some(
					(limitation) =>
						limitation.capability === 'TS_SYMBOL' &&
						limitation.closureEffect === 'DEGRADES_CLOSURE' &&
						record.epistemic.unresolvedRegions.includes(limitation.region)
				))
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Degraded symbol facts require partial TS_SYMBOL provenance with a closure-degrading limitation bound to an unresolved region.'
			);
	}
	for (const [index, record] of snapshot.provenances.entries())
		validateProvenanceRecord(record, `$.provenances[${index}]`);

	for (const [index, project] of snapshot.projects.entries()) {
		path(project.configPath, `$.projects[${index}].configPath`);
		for (const rootName of project.rootNames) path(rootName, `$.projects[${index}].rootNames`);
		for (const reference of project.projectReferences)
			path(reference, `$.projects[${index}].projectReferences`);
		for (const [candidateIndex, candidate] of project.frameworkCandidates.entries())
			path(candidate, `$.projects[${index}].frameworkCandidates[${candidateIndex}]`);
		for (const [reasonIndex, reason] of project.partialityReasons.entries())
			path(reason.path, `$.projects[${index}].partialityReasons[${reasonIndex}].path`);
		for (const rootName of project.programRecipe.rootNames)
			path(rootName, `$.projects[${index}].programRecipe.rootNames`);
		for (const reference of project.programRecipe.projectReferences)
			path(reference, `$.projects[${index}].programRecipe.projectReferences`);
		path(project.programRecipe.configPath, `$.projects[${index}].programRecipe.configPath`);
		try {
			validateProgramRecipePolicy(project.programRecipe, snapshot.budgets.maxPathCharacters);
		} catch (error) {
			issue(
				error instanceof ProgramRecipePolicyError && error.message.includes('digest')
					? 'IDENTITY_MISMATCH'
					: 'INVALID_VALUE',
				`$.projects[${index}].programRecipe`,
				error instanceof Error
					? error.message
					: 'ProgramRecipe violates the shared materialization policy.'
			);
		}
		if (
			project.configPath !== project.programRecipe.configPath ||
			project.kind !== project.programRecipe.kind ||
			!sameMembers(project.rootNames, project.programRecipe.rootNames) ||
			!sameMembers(project.projectReferences, project.programRecipe.projectReferences) ||
			project.programRecipe.provider.id !== snapshot.provider.id ||
			project.programRecipe.provider.version !== snapshot.provider.version
		)
			issue(
				'IDENTITY_MISMATCH',
				`$.projects[${index}].programRecipe`,
				'Project mirrors do not reproduce the exact ProgramRecipe.'
			);
		for (const values of [
			project.rootNames,
			project.projectReferences,
			project.sourceIds,
			project.diagnosticIds,
			project.contextInputIds,
			project.frameworkCandidates
		]) {
			if (!isCanonicalSet(values))
				issue(
					'NONCANONICAL_ORDER',
					`$.projects[${index}]`,
					'Project manifests must be canonical sets.'
				);
		}
		if (
			!isCanonicalSet(project.programRecipe.rootNames) ||
			!isCanonicalSet(project.programRecipe.projectReferences)
		)
			issue(
				'NONCANONICAL_ORDER',
				`$.projects[${index}].programRecipe`,
				'ProgramRecipe roots and references must be canonical sets.'
			);
		for (const reference of project.projectReferences)
			if (!projectByConfigPath.has(reference))
				issue(
					'DANGLING_REFERENCE',
					`$.projects[${index}].projectReferences`,
					`Referenced project ${reference} is absent from the all-project closure.`
				);
		if (
			project.rootDisposition === 'INTENTIONAL_EMPTY_SOLUTION'
				? project.kind !== 'SOLUTION' || project.rootNames.length !== 0
				: project.rootDisposition === 'COMPILER_ROOTS' && project.rootNames.length === 0
		)
			issue(
				'INVALID_VALUE',
				`$.projects[${index}].rootDisposition`,
				'Project root disposition is incoherent with kind and roots.'
			);
		if (project.rootDisposition === 'INCOMPLETE' && project.health !== 'PARTIAL')
			issue(
				'INVALID_VALUE',
				`$.projects[${index}].health`,
				'Incomplete project roots require partial health.'
			);
		if (
			project.health === 'PARTIAL'
				? project.partialityReasons.length === 0
				: project.partialityReasons.length > 0
		)
			issue(
				'INVALID_VALUE',
				`$.projects[${index}].partialityReasons`,
				'Project health and partiality reasons disagree.'
			);
		const projectCapabilityPartial = project.partialityReasons.some(
			(reason) => reason.capability === 'TS_PROJECT'
		);
		const projectProvenance = provenance(
			project.provenanceId,
			project.id,
			'TS_PROJECT',
			`$.projects[${index}].provenanceId`
		);
		if (
			projectProvenance !== undefined &&
			projectCapabilityPartial !== (projectProvenance.epistemic.capabilityCoverage === 'partial')
		)
			issue(
				'INVALID_VALUE',
				`$.projects[${index}].provenanceId`,
				'Project-fact coverage must agree with TS_PROJECT-specific partiality without inheriting syntax-only losses.'
			);
		if (
			!isCanonicalSet(
				project.partialityReasons.map(
					(reason) =>
						`${reason.capability}\0${reason.code}\0${reason.path ?? ''}\0${reason.message}`
				)
			)
		)
			issue(
				'NONCANONICAL_ORDER',
				`$.projects[${index}].partialityReasons`,
				'Project partiality reasons must be a canonical set.'
			);
		for (const [reasonIndex, reason] of project.partialityReasons.entries())
			if (
				reason.message.length === 0 ||
				!snapshot.requestedCapabilities.includes(reason.capability)
			)
				issue(
					'INVALID_VALUE',
					`$.projects[${index}].partialityReasons[${reasonIndex}]`,
					'Partiality reason must name a requested capability and a non-empty message.'
				);
		if (project.frameworkCandidates.length > 0 && project.health !== 'PARTIAL')
			issue(
				'INVALID_VALUE',
				`$.projects[${index}].health`,
				'Framework candidates require explicit project partiality.'
			);
		if (
			project.frameworkCandidates.length > 0 &&
			!project.partialityReasons.some(
				(reason) =>
					reason.capability === 'TS_SYNTAX' && reason.code === 'FRAMEWORK_CANDIDATES_UNSUPPORTED'
			)
		)
			issue(
				'INVALID_VALUE',
				`$.projects[${index}].partialityReasons`,
				'Unsupported framework candidates must explicitly degrade TS_SYNTAX with FRAMEWORK_CANDIDATES_UNSUPPORTED.'
			);
		const parserRecoveryPaths = sortedUnique(
			(diagnosticsByProject.get(project.id) ?? [])
				.filter(
					(diagnostic) => diagnostic.family === 'SYNTACTIC' && diagnostic.category === 'ERROR'
				)
				.map((diagnostic) => diagnostic.path ?? project.configPath)
		);
		for (const recoveryPath of parserRecoveryPaths)
			for (const capability of ['TS_SYMBOL', 'TS_SYNTAX'] as const)
				if (
					!project.partialityReasons.some(
						(reason) =>
							reason.capability === capability &&
							reason.code === 'TYPESCRIPT_PROJECT_PARTIAL' &&
							(reason.path ?? project.configPath) === recoveryPath &&
							/parser recovery/iu.test(reason.message)
					)
				)
					issue(
						'INVALID_VALUE',
						`$.projects[${index}].partialityReasons`,
						`Retained SYNTACTIC ERROR diagnostics at ${recoveryPath} require an explicit ${capability} TYPESCRIPT_PROJECT_PARTIAL parser-recovery reason.`
					);
		const expected = semanticProjectId({
			configPath: project.configPath,
			projectResolutionDigest: project.programRecipe.projectResolutionDigest,
			snapshotId: snapshot.id
		});
		if (project.id !== expected)
			issue('IDENTITY_MISMATCH', `$.projects[${index}].id`, 'Project identity mismatch.');
		const ownedProgram = programById.get(project.programId);
		if (ownedProgram === undefined)
			issue('DANGLING_REFERENCE', `$.projects[${index}].programId`, 'Project program is absent.');
		else if (ownedProgram.projectId !== project.id)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`$.projects[${index}].programId`,
				'Project points to a Program owned by another project.'
			);
		if (
			!sameMembers(
				project.sourceIds,
				(sourcesByProject.get(project.id) ?? []).map((source) => source.id)
			)
		)
			issue(
				'DANGLING_REFERENCE',
				`$.projects[${index}].sourceIds`,
				'Project source manifest is incomplete.'
			);
		if (
			!sameMembers(
				project.diagnosticIds,
				(diagnosticsByProject.get(project.id) ?? []).map((diagnostic) => diagnostic.id)
			)
		)
			issue(
				'DANGLING_REFERENCE',
				`$.projects[${index}].diagnosticIds`,
				'Project diagnostic manifest is incomplete.'
			);
		for (const contextId of project.contextInputIds)
			if (!contextById.has(contextId))
				issue(
					'DANGLING_REFERENCE',
					`$.projects[${index}].contextInputIds`,
					'Project context input is absent.'
				);
	}

	for (const [index, program] of snapshot.programs.entries()) {
		const project = projectById.get(program.projectId);
		if (!project)
			issue('DANGLING_REFERENCE', `$.programs[${index}].projectId`, 'Program project is absent.');
		else if (project.programId !== program.id)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`$.programs[${index}].id`,
				'Program is not the program bound by its project.'
			);
		const expected = semanticProgramId({
			contextDigest: program.contextDigest,
			projectId: program.projectId
		});
		if (program.id !== expected)
			issue('IDENTITY_MISMATCH', `$.programs[${index}].id`, 'Program identity mismatch.');
		const programSources = sourcesByProgram.get(program.id) ?? [];
		const ownedSources = programSources.map((source) => source.id);
		if (!sameMembers(program.sourceIds, ownedSources))
			issue(
				'DANGLING_REFERENCE',
				`$.programs[${index}].sourceIds`,
				'Program source manifest is incomplete.'
			);
		const ownedRoots = programSources
			.filter((source) => source.rootFile)
			.map((source) => source.id);
		if (!sameMembers(program.rootSourceIds, ownedRoots))
			issue(
				'DANGLING_REFERENCE',
				`$.programs[${index}].rootSourceIds`,
				'Program root-source manifest is incomplete.'
			);
		if (
			!isCanonicalSet(program.sourceIds) ||
			!isCanonicalSet(program.rootSourceIds) ||
			!isCanonicalSet(program.diagnosticIds)
		)
			issue(
				'NONCANONICAL_ORDER',
				`$.programs[${index}]`,
				'Program manifests must be canonical sets.'
			);
		const projectInputs =
			project?.contextInputIds
				.map((id) => contextById.get(id))
				.filter((input) => input !== undefined) ?? [];
		if (program.contextDigest !== compilerInputClosureDigest(projectInputs))
			issue(
				'IDENTITY_MISMATCH',
				`$.programs[${index}].contextDigest`,
				'Program context digest does not bind its exact project compiler observations.'
			);
		if (
			!sameMembers(
				program.diagnosticIds,
				(diagnosticsByProject.get(program.projectId) ?? []).map((diagnostic) => diagnostic.id)
			)
		)
			issue(
				'DANGLING_REFERENCE',
				`$.programs[${index}].diagnosticIds`,
				'Program diagnostic manifest is incomplete.'
			);
		if (
			program.diagnosticFamilies.length !== DIAGNOSTIC_FAMILIES.length ||
			!program.diagnosticFamilies.every(
				(coverage, familyIndex) => coverage.family === DIAGNOSTIC_FAMILIES[familyIndex]
			)
		)
			issue(
				'INVALID_VALUE',
				`$.programs[${index}].diagnosticFamilies`,
				'Program must report all six diagnostic families in registered order.'
			);
		for (const coverage of program.diagnosticFamilies) {
			const familyRecords =
				diagnosticsByProjectFamily.get(`${program.projectId}\0${coverage.family}`) ?? [];
			const familyIds = familyRecords.map((diagnostic) => diagnostic.id).sort();
			const occurrenceCount = familyRecords.reduce(
				(total, diagnostic) => total + diagnostic.multiplicity,
				0
			);
			if (
				!isCanonicalSet(coverage.diagnosticIds) ||
				coverage.recordCount !== coverage.diagnosticIds.length ||
				coverage.recordCount !== familyRecords.length ||
				coverage.occurrenceCount !== occurrenceCount ||
				coverage.manifestDigest !== diagnosticManifestDigest(familyRecords) ||
				!sameMembers(coverage.diagnosticIds, familyIds)
			)
				issue(
					'POPULATION_MISMATCH',
					`$.programs[${index}].diagnosticFamilies`,
					`${coverage.family} diagnostic coverage does not match emitted diagnostic records and occurrences.`
				);
			if (
				coverage.state === 'NOT_APPLICABLE' ||
				coverage.reason.length === 0 ||
				(coverage.state === 'FAILED' && project?.health !== 'PARTIAL')
			)
				issue(
					'INVALID_VALUE',
					`$.programs[${index}].diagnosticFamilies`,
					'Every Slice 3B diagnostic family must run or fail visibly with a reason.'
				);
			if (coverage.coverage === 'COMPLETE' && coverage.state !== 'RUN')
				issue(
					'INVALID_VALUE',
					`$.programs[${index}].diagnosticFamilies`,
					'Complete diagnostic coverage requires a successful run.'
				);
			if (coverage.coverage === 'BOUNDED' && project?.health !== 'PARTIAL')
				issue(
					'INVALID_VALUE',
					`$.programs[${index}].diagnosticFamilies`,
					'Bounded diagnostic coverage must roll up to explicit project partiality.'
				);
		}
		const rootSourceSet = new Set(program.rootSourceIds);
		const rootPaths = programSources
			.filter((source) => rootSourceSet.has(source.id))
			.map((source) => source.logicalPath)
			.sort();
		if (project !== undefined && !sameMembers(rootPaths, project.rootNames))
			issue(
				'DANGLING_REFERENCE',
				`$.programs[${index}].rootSourceIds`,
				'Program root sources do not reproduce ProgramRecipe roots.'
			);
		provenance(
			program.provenanceId,
			program.projectId,
			'TS_PROJECT',
			`$.programs[${index}].provenanceId`
		);
	}

	for (const [index, source] of snapshot.sources.entries()) {
		path(source.logicalPath, `$.sources[${index}].logicalPath`);
		if (!projectById.has(source.projectId) || !programById.has(source.programId))
			issue('DANGLING_REFERENCE', `$.sources[${index}]`, 'Source project or program is absent.');
		if (programById.get(source.programId)?.projectId !== source.projectId)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`$.sources[${index}].programId`,
				'Source program belongs to another project.'
			);
		const expected = semanticSourceId({
			contentSha256: source.contentSha256,
			logicalPath: source.logicalPath,
			moduleKind: source.moduleKind,
			programId: source.programId
		});
		if (source.id !== expected)
			issue('IDENTITY_MISMATCH', `$.sources[${index}].id`, 'Source identity mismatch.');
		if (
			!SHA256.test(source.contentSha256) ||
			!Number.isSafeInteger(source.bytes) ||
			!Number.isSafeInteger(source.textLength) ||
			source.bytes < 0 ||
			source.textLength < 0
		)
			issue('INVALID_VALUE', `$.sources[${index}]`, 'Source byte and digest metadata is invalid.');
		const expectedScriptKindName = ts.ScriptKind[source.scriptKind];
		const expectedLanguageVariant =
			source.scriptKind === ts.ScriptKind.TSX || source.scriptKind === ts.ScriptKind.JSX
				? 'JSX'
				: 'Standard';
		if (
			typeof expectedScriptKindName !== 'string' ||
			source.scriptKindName !== expectedScriptKindName ||
			source.languageVariant !== expectedLanguageVariant
		)
			issue(
				'INVALID_VALUE',
				`$.sources[${index}]`,
				'Source script-kind code, name, and language variant must agree with the public TypeScript enum.'
			);
		if (
			!isCanonicalSet(source.artifactRoles) ||
			!source.artifactRoles.every((role) => ARTIFACT_ROLES.includes(role)) ||
			!isCanonicalSet(source.diagnosticIds)
		)
			issue(
				'NONCANONICAL_ORDER',
				`$.sources[${index}]`,
				'Source roles and diagnostic manifests must be closed canonical sets.'
			);
		const matchingReads =
			presentReadsByProjectPath.get(`${source.projectId}\0${source.logicalPath}`) ?? [];
		const expectedByteBudgetClass =
			source.analysisDisposition === 'DEEP_INDEXED' ? 'FROZEN_SUBJECT' : 'LIVE_COMPILER_CONTEXT';
		if (
			matchingReads.length !== 1 ||
			matchingReads[0]!.byteBudgetClass !== expectedByteBudgetClass ||
			matchingReads[0]!.contentSha256 !== source.contentSha256 ||
			matchingReads[0]!.contentBytes !== source.bytes ||
			matchingReads[0]!.origin !== source.origin
		) {
			issue(
				'IDENTITY_MISMATCH',
				`$.sources[${index}]`,
				`Every Program source must match exactly one project-attributed ${expectedByteBudgetClass} PRESENT READ_FILE observation by path, bytes, digest, and origin.`
			);
		}
		if (source.analysisDisposition === 'DEEP_INDEXED') {
			const rootNode = source.rootNodeId === null ? undefined : nodeById.get(source.rootNodeId);
			if (
				source.artifactClass === 'CONTEXT_ONLY' ||
				!rootNode ||
				rootNode.sourceId !== source.id ||
				rootNode.parentId !== null ||
				rootNode.kind !== ts.SyntaxKind.SourceFile ||
				rootNode.structuralRoles.length !== 1 ||
				rootNode.structuralRoles[0] !== AST_STRUCTURAL_ROLES.sourceFile
			)
				issue(
					'DANGLING_REFERENCE',
					`$.sources[${index}].rootNodeId`,
					'Deep-indexed source requires one subject-owned SourceFile root AST node.'
				);
		} else if (
			source.artifactClass !== 'CONTEXT_ONLY' ||
			source.rootNodeId !== null ||
			(nodesBySource.get(source.id)?.length ?? 0) > 0 ||
			source.rootFile
		) {
			issue(
				'INVALID_VALUE',
				`$.sources[${index}].analysisDisposition`,
				'Context-only sources must be represented without AST indexing or compiler-root standing.'
			);
		}
		const sourceProvenance = provenance(
			source.provenanceId,
			source.projectId,
			'TS_PROJECT',
			`$.sources[${index}].provenanceId`,
			source.id
		);
		if (
			source.origin === 'UNKNOWN' ||
			!['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)
		) {
			const hasMappingLimitation = sourceProvenance?.limitations.some(
				(limitation) =>
					limitation.capability === 'TS_PROJECT' &&
					limitation.closureEffect === 'DEGRADES_CLOSURE' &&
					limitation.reason === source.mapping.reason &&
					limitation.region === source.logicalPath &&
					sourceProvenance.epistemic.unresolvedRegions.includes(limitation.region)
			);
			if (
				sourceProvenance?.epistemic.capabilityCoverage !== 'partial' ||
				hasMappingLimitation !== true
			)
				issue(
					'INVALID_VALUE',
					`$.sources[${index}].provenanceId`,
					'Unknown or lossy source mapping requires partial TS_PROJECT provenance with its matching closure-degrading limitation and unresolved region.'
				);
		}
		if (source.analysisDisposition === 'DEEP_INDEXED') {
			if (source.syntaxProvenanceId === null)
				issue(
					'DANGLING_REFERENCE',
					`$.sources[${index}].syntaxProvenanceId`,
					'Deep-indexed source requires its exact TS_SYNTAX provenance binding.'
				);
			else
				provenance(
					source.syntaxProvenanceId,
					source.projectId,
					'TS_SYNTAX',
					`$.sources[${index}].syntaxProvenanceId`,
					source.id
				);
		} else if (source.syntaxProvenanceId !== null)
			issue(
				'INVALID_VALUE',
				`$.sources[${index}].syntaxProvenanceId`,
				'Context-only source must not claim TS_SYNTAX provenance.'
			);
		if (
			!sameMembers(
				source.diagnosticIds,
				(diagnosticsBySource.get(source.id) ?? []).map((diagnostic) => diagnostic.id)
			)
		)
			issue(
				'DANGLING_REFERENCE',
				`$.sources[${index}].diagnosticIds`,
				'Source diagnostic manifest must exactly cover every source-bound diagnostic.'
			);
		for (const diagnosticId of source.diagnosticIds)
			if (diagnosticById.get(diagnosticId)?.sourceId !== source.id)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`$.sources[${index}].diagnosticIds`,
					'Source diagnostic belongs elsewhere.'
				);
	}

	const siblingKeys = new Set<string>();
	for (const [index, node] of snapshot.astNodes.entries()) {
		const source = sourceById.get(node.sourceId);
		if (!source || source.analysisDisposition !== 'DEEP_INDEXED')
			issue(
				'CROSS_PROJECT_REFERENCE',
				`$.astNodes[${index}].sourceId`,
				'Node source is absent or context-only.'
			);
		if (
			!Number.isSafeInteger(node.fullStart) ||
			!Number.isSafeInteger(node.start) ||
			!Number.isSafeInteger(node.end) ||
			node.fullStart < 0 ||
			node.fullStart > node.start ||
			node.start > node.end ||
			(source && node.end > source.textLength)
		)
			issue('INVALID_VALUE', `$.astNodes[${index}]`, 'Node UTF-16 span is invalid.');
		if (node.structuralRoles.length === 0 || !isCanonicalSet(node.structuralRoles))
			issue(
				'NONCANONICAL_ORDER',
				`$.astNodes[${index}].structuralRoles`,
				'AST structural roles must be a non-empty canonical set.'
			);
		if (!node.structuralRoles.every((role) => SEMANTIC_AST_STRUCTURAL_ROLES.includes(role)))
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}].structuralRoles`,
				'AST structural roles must belong to the closed semantic role vocabulary.'
			);
		if (node.parentId === null) {
			if (
				node.structuralRoles.length !== 1 ||
				node.structuralRoles[0] !== AST_STRUCTURAL_ROLES.sourceFile
			)
				issue(
					'INVALID_VALUE',
					`$.astNodes[${index}].structuralRoles`,
					'A source root must carry exactly the source-file role.'
				);
		} else {
			if (
				!node.structuralRoles.includes(AST_STRUCTURAL_ROLES.genericChild) ||
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.sourceFile)
			)
				issue(
					'INVALID_VALUE',
					`$.astNodes[${index}].structuralRoles`,
					'Every retained child must carry generic-child and must not carry source-file.'
				);
			const invocationRoleCount = [
				AST_STRUCTURAL_ROLES.invocationCallee,
				AST_STRUCTURAL_ROLES.invocationArgument,
				AST_STRUCTURAL_ROLES.invocationTemplate
			].filter((role) => node.structuralRoles.includes(role)).length;
			if (invocationRoleCount > 1)
				issue(
					'INVALID_VALUE',
					`$.astNodes[${index}].structuralRoles`,
					'A child cannot simultaneously occupy multiple invocation roles.'
				);
			if (
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentTarget) &&
				node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue)
			)
				issue(
					'INVALID_VALUE',
					`$.astNodes[${index}].structuralRoles`,
					'A child cannot simultaneously be an assignment target and value.'
				);
		}
		const expected = semanticNodeId({
			end: node.end,
			fullStart: node.fullStart,
			kind: node.kind,
			parentId: node.parentId,
			siblingOrdinal: node.siblingOrdinal,
			sourceId: node.sourceId,
			start: node.start,
			structuralRoles: node.structuralRoles
		});
		if (node.id !== expected)
			issue('IDENTITY_MISMATCH', `$.astNodes[${index}].id`, 'Node identity mismatch.');
		if (typescriptSyntaxKindName(node.kind) !== node.kindName)
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}].kindName`,
				'AST kind code and name must agree with the public TypeScript enum.'
			);
		if (
			node.publicFlags > PUBLIC_NODE_FLAG_MASK ||
			(node.publicFlags & ~PUBLIC_NODE_FLAG_MASK) !== 0
		)
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}].publicFlags`,
				'AST public flags must be a valid bit set from the public TypeScript NodeFlags surface.'
			);
		const identifierKind =
			node.kind === ts.SyntaxKind.Identifier || node.kind === ts.SyntaxKind.PrivateIdentifier;
		if (
			identifierKind ? node.syntacticIdentifierText === null : node.syntacticIdentifierText !== null
		)
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}].syntacticIdentifierText`,
				'Syntactic identifier text, including a recovered empty text, must be present exactly for Identifier and PrivateIdentifier nodes.'
			);
		if (
			(node.operatorKind === null) !== (node.operatorName === null) ||
			(node.operatorKind !== null &&
				typescriptSyntaxKindName(node.operatorKind) !== node.operatorName)
		)
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}]`,
				'AST operator code and name must be present together and agree with the public TypeScript enum.'
			);
		if (node.hasAssignmentInitializer && !canHaveAssignmentInitializer(node.kind))
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}].hasAssignmentInitializer`,
				'Only the exact TypeScript syntax kinds with assignment initializers may assert one.'
			);
		if (
			node.operatorKind !== null &&
			![
				ts.SyntaxKind.BinaryExpression,
				ts.SyntaxKind.PrefixUnaryExpression,
				ts.SyntaxKind.PostfixUnaryExpression
			].includes(node.kind)
		)
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}].operatorKind`,
				'Only retained operator-bearing expression nodes may carry an operator.'
			);
		if (
			[
				ts.SyntaxKind.BinaryExpression,
				ts.SyntaxKind.PrefixUnaryExpression,
				ts.SyntaxKind.PostfixUnaryExpression
			].includes(node.kind) &&
			node.operatorKind === null
		)
			issue(
				'INVALID_VALUE',
				`$.astNodes[${index}].operatorKind`,
				'Retained operator-bearing expression nodes require their public SyntaxKind operator.'
			);
		if (node.parentId !== null) {
			const parent = nodeById.get(node.parentId);
			if (!parent)
				issue('DANGLING_REFERENCE', `$.astNodes[${index}].parentId`, 'Parent node is absent.');
			else if (
				parent.sourceId !== node.sourceId ||
				parent.fullStart > node.fullStart ||
				parent.end < node.end
			)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`$.astNodes[${index}].parentId`,
					'Parent is from another source or does not contain the child.'
				);
			else {
				const invocationRoles: readonly string[] = [
					AST_STRUCTURAL_ROLES.invocationCallee,
					AST_STRUCTURAL_ROLES.invocationArgument,
					AST_STRUCTURAL_ROLES.invocationTemplate
				];
				if (
					node.structuralRoles.some((role) => invocationRoles.includes(role)) &&
					semanticInvocationKind(parent.kind) === null
				)
					issue(
						'INVALID_VALUE',
						`$.astNodes[${index}].structuralRoles`,
						'Invocation structural roles require an invocation parent.'
					);
				if (
					node.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName) &&
					semanticDeclarationCandidateRole(parent.kind) === null
				)
					issue(
						'INVALID_VALUE',
						`$.astNodes[${index}].structuralRoles`,
						'Declaration-name roles require a declaration-candidate parent.'
					);
				if (
					(node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentTarget) ||
						node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue)) &&
					semanticAssignmentKind(parent) === null
				)
					issue(
						'INVALID_VALUE',
						`$.astNodes[${index}].structuralRoles`,
						'Assignment structural roles require an assignment-bearing parent.'
					);
			}
		}
		const siblingKey = `${node.sourceId}\0${node.parentId ?? '<root>'}\0${node.siblingOrdinal}`;
		if (siblingKeys.has(siblingKey))
			issue(
				'DUPLICATE_ID',
				`$.astNodes[${index}]`,
				'Absolute sibling ordinal must be unique within a parent regardless of structural role.'
			);
		siblingKeys.add(siblingKey);
	}
	for (const [parentId, children] of childrenByParent) {
		const ordinals = children
			.map((node) => node.siblingOrdinal)
			.sort((left, right) => left - right);
		if (!ordinals.every((ordinal, index) => ordinal === index))
			issue(
				'INVALID_VALUE',
				`$.astNodes.${parentId}`,
				'Retained children must use the contiguous absolute order produced by the named AST traversal profile.'
			);
	}
	for (const [sourceIndex, source] of snapshot.sources.entries()) {
		if (source.analysisDisposition !== 'DEEP_INDEXED') continue;
		const sourceNodes = nodesBySource.get(source.id) ?? [];
		const roots = sourceNodes.filter((node) => node.parentId === null);
		if (
			source.rootNodeId === null ||
			roots.length !== 1 ||
			roots[0]?.id !== source.rootNodeId ||
			roots[0]?.kind !== ts.SyntaxKind.SourceFile ||
			roots[0]?.siblingOrdinal !== 0
		)
			issue(
				'DANGLING_REFERENCE',
				`$.sources[${sourceIndex}].rootNodeId`,
				'Deep-indexed source requires exactly one declared SourceFile root node at absolute ordinal zero.'
			);
		const depthById = new Map<string, number>();
		const terminalById = new Map<string, string | null>();
		for (const node of sourceNodes) {
			if (depthById.has(node.id)) continue;
			const chain: StaticSemanticSnapshot['astNodes'][number][] = [];
			const chainPositions = new Map<string, number>();
			let cursor = node;
			let baseDepth = -1;
			let terminal: string | null = null;
			let validChain = true;
			while (true) {
				if (!referenceCheck()) {
					validChain = false;
					break;
				}
				const knownDepth = depthById.get(cursor.id);
				if (knownDepth !== undefined) {
					baseDepth = knownDepth;
					terminal = terminalById.get(cursor.id) ?? null;
					break;
				}
				if (chainPositions.has(cursor.id)) {
					issue(
						'DANGLING_REFERENCE',
						`$.astNodes.${node.id}`,
						'AST parent relation contains a cycle.'
					);
					validChain = false;
					break;
				}
				chainPositions.set(cursor.id, chain.length);
				chain.push(cursor);
				if (cursor.parentId === null) {
					terminal = cursor.id;
					break;
				}
				const parent = nodeById.get(cursor.parentId);
				if (parent === undefined || parent.sourceId !== source.id) {
					validChain = false;
					break;
				}
				cursor = parent;
			}
			if (!validChain) {
				for (const member of chain) {
					depthById.set(member.id, -1);
					terminalById.set(member.id, null);
				}
				continue;
			}
			let depth = baseDepth;
			for (let chainIndex = chain.length - 1; chainIndex >= 0; chainIndex -= 1) {
				const member = chain[chainIndex]!;
				depth += 1;
				depthById.set(member.id, depth);
				terminalById.set(member.id, terminal);
				if (depth > snapshot.budgets.maxAstDepth)
					issue(
						'INVALID_VALUE',
						'$.budgets.maxAstDepth',
						`AST node ${member.id} exceeds the producing depth budget.`
					);
			}
			if (terminal !== source.rootNodeId)
				issue(
					'DANGLING_REFERENCE',
					`$.astNodes.${node.id}`,
					'Every AST node must reach its declared source root.'
				);
		}
	}

	const globalScopesByProgram = new Map<string, StaticSemanticSnapshot['scopes'][number][]>();
	const sourceRootScopesBySource = new Map<string, StaticSemanticSnapshot['scopes'][number][]>();
	const scopesByOwnerNode = new Map<string, StaticSemanticSnapshot['scopes'][number][]>();
	for (const [index, scope] of snapshot.scopes.entries()) {
		const jsonPath = `$.scopes[${index}]`;
		const project = projectById.get(scope.projectId);
		const program = programById.get(scope.programId);
		if (project === undefined || program === undefined)
			issue('DANGLING_REFERENCE', jsonPath, 'Scope project or Program is absent.');
		else if (project.programId !== scope.programId || program.projectId !== scope.projectId)
			issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Scope project and Program ownership disagree.');

		const expectedId = semanticScopeId({
			domain: scope.domain,
			end: scope.end,
			kind: scope.kind,
			ownerKind: scope.ownerKind,
			programId: scope.programId,
			sourceId: scope.sourceId,
			start: scope.start
		});
		if (scope.id !== expectedId)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Scope identity mismatch.');

		if (scope.kind === 'PROGRAM_GLOBAL') {
			appendGrouped(globalScopesByProgram, scope.programId, scope);
			if (scope.domain !== programGlobalScopeDescriptor().domain)
				issue(
					'INVALID_VALUE',
					`${jsonPath}.domain`,
					'Program-global scope must use the LEXICAL domain.'
				);
			if (
				scope.sourceId !== null ||
				scope.parentScopeId !== null ||
				scope.ownerNodeId !== null ||
				scope.ownerKind !== null ||
				scope.ownerKindName !== null ||
				scope.start !== null ||
				scope.end !== null
			)
				issue(
					'INVALID_VALUE',
					jsonPath,
					'Program-global scope must not invent a source, parent, owner, or span.'
				);
			scopeDerivedProvenance(scope.provenanceId, scope.projectId, `${jsonPath}.provenanceId`);
			continue;
		}

		const source = scope.sourceId === null ? undefined : sourceById.get(scope.sourceId);
		if (source === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.sourceId`, 'Lexical scope source is absent.');
		else if (source.projectId !== scope.projectId || source.programId !== scope.programId)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`${jsonPath}.sourceId`,
				'Lexical scope source belongs to another project or Program.'
			);
		if (
			scope.start === null ||
			scope.end === null ||
			!Number.isSafeInteger(scope.start) ||
			!Number.isSafeInteger(scope.end) ||
			scope.start < 0 ||
			scope.start > scope.end ||
			(source !== undefined && scope.end > source.textLength)
		)
			issue('INVALID_VALUE', jsonPath, 'Lexical-scope UTF-16 span is invalid.');
		if (
			scope.ownerKind === null ||
			scope.ownerKindName === null ||
			typescriptSyntaxKindName(scope.ownerKind) !== scope.ownerKindName
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.ownerKindName`,
				'Scope owner kind code and name must agree with the public TypeScript enum.'
			);
		if (scope.ownerNodeId !== null) appendGrouped(scopesByOwnerNode, scope.ownerNodeId, scope);
		const expectedDescriptor =
			scope.ownerKind === null || source === undefined
				? null
				: semanticScopeBoundaryDescriptor(scope.ownerKind, source.moduleKind);
		if (
			expectedDescriptor === null ||
			expectedDescriptor.kind !== scope.kind ||
			expectedDescriptor.domain !== scope.domain
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.kind`,
				'Scope kind and domain must exactly match the supported owner-syntax taxonomy.'
			);
		if (
			(scope.kind === 'SOURCE_SCRIPT' || scope.kind === 'SOURCE_MODULE') !==
			(scope.ownerKind === ts.SyntaxKind.SourceFile)
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.kind`,
				'Only a source-root scope may be owned by a SourceFile.'
			);
		if (scope.kind === 'SOURCE_SCRIPT' || scope.kind === 'SOURCE_MODULE') {
			if (scope.sourceId !== null) appendGrouped(sourceRootScopesBySource, scope.sourceId, scope);
			if (
				source !== undefined &&
				(scope.kind !== semanticSourceScopeKind(source.moduleKind) ||
					scope.end !== source.textLength)
			)
				issue(
					'INVALID_VALUE',
					jsonPath,
					'Source-root scope must reproduce the source module role and terminal source extent.'
				);
		}

		const ownerNode = scope.ownerNodeId === null ? undefined : nodeById.get(scope.ownerNodeId);
		if (source?.analysisDisposition === 'DEEP_INDEXED' && ownerNode === undefined)
			issue(
				'DANGLING_REFERENCE',
				`${jsonPath}.ownerNodeId`,
				'Deep-indexed lexical scope requires its retained public AST owner node.'
			);
		if (source?.analysisDisposition === 'CONTEXT_ONLY' && scope.ownerNodeId !== null)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.ownerNodeId`,
				'Context-only lexical scope must not claim an AST owner node.'
			);
		if (
			ownerNode !== undefined &&
			(ownerNode.sourceId !== scope.sourceId ||
				ownerNode.kind !== scope.ownerKind ||
				ownerNode.kindName !== scope.ownerKindName ||
				ownerNode.start !== scope.start ||
				ownerNode.end !== scope.end)
		)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`${jsonPath}.ownerNodeId`,
				'Scope owner node must reproduce the same source, kind, and span.'
			);

		const parent = scope.parentScopeId === null ? undefined : scopeById.get(scope.parentScopeId);
		if (parent === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.parentScopeId`, 'Lexical scope parent is absent.');
		else {
			if (parent.projectId !== scope.projectId || parent.programId !== scope.programId)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`${jsonPath}.parentScopeId`,
					'Lexical scope parent belongs to another project or Program.'
				);
			const isSourceRoot = scope.kind === 'SOURCE_SCRIPT' || scope.kind === 'SOURCE_MODULE';
			if (isSourceRoot ? parent.kind !== 'PROGRAM_GLOBAL' : parent.kind === 'PROGRAM_GLOBAL')
				issue(
					'INVALID_VALUE',
					`${jsonPath}.parentScopeId`,
					'Source roots alone are direct children of the Program-global scope.'
				);
			if (parent.kind !== 'PROGRAM_GLOBAL') {
				if (parent.sourceId !== scope.sourceId)
					issue(
						'CROSS_PROJECT_REFERENCE',
						`${jsonPath}.parentScopeId`,
						'Nested lexical scope and parent must share a source.'
					);
				if (
					parent.start !== null &&
					parent.end !== null &&
					scope.start !== null &&
					scope.end !== null &&
					(parent.start > scope.start || parent.end < scope.end)
				)
					issue(
						'INVALID_VALUE',
						`${jsonPath}.parentScopeId`,
						'Nested lexical-scope span must be contained by its parent.'
					);
			}
		}
		if (source !== undefined)
			scopeDerivedProvenance(
				scope.provenanceId,
				scope.projectId,
				`${jsonPath}.provenanceId`,
				source.id
			);
	}

	for (const [index, program] of snapshot.programs.entries())
		if ((globalScopesByProgram.get(program.id)?.length ?? 0) !== 1)
			issue(
				'POPULATION_MISMATCH',
				`$.programs[${index}].id`,
				'Every Program requires exactly one Program-global scope.'
			);
	for (const [index, source] of snapshot.sources.entries())
		if ((sourceRootScopesBySource.get(source.id)?.length ?? 0) !== 1)
			issue(
				'POPULATION_MISMATCH',
				`$.sources[${index}].id`,
				'Every Program source requires exactly one source-root lexical scope.'
			);

	for (const [ownerNodeId, ownedScopes] of scopesByOwnerNode)
		if (ownedScopes.length !== 1)
			issue(
				'DUPLICATE_ID',
				'$.scopes',
				`Retained scope owner ${ownerNodeId} must own exactly one semantic scope.`
			);

	for (const source of snapshot.sources) {
		if (source.analysisDisposition !== 'DEEP_INDEXED') continue;
		for (const node of nodesBySource.get(source.id) ?? []) {
			const descriptor = semanticScopeBoundaryDescriptor(node.kind, source.moduleKind);
			const ownedScopes = scopesByOwnerNode.get(node.id) ?? [];
			if (descriptor !== null && ownedScopes.length !== 1)
				issue(
					'POPULATION_MISMATCH',
					'$.scopes',
					`Supported retained boundary ${node.id} requires exactly one semantic scope.`
				);
		}
	}

	for (const [index, scope] of snapshot.scopes.entries()) {
		if (scope.ownerNodeId === null) continue;
		const owner = nodeById.get(scope.ownerNodeId);
		if (owner === undefined) continue;
		let expectedParent: StaticSemanticSnapshot['scopes'][number] | undefined;
		if (owner.parentId === null) {
			expectedParent = (globalScopesByProgram.get(scope.programId) ?? [])[0];
		} else {
			let cursor = nodeById.get(owner.parentId);
			while (cursor !== undefined) {
				const source = sourceById.get(cursor.sourceId);
				if (
					source !== undefined &&
					semanticScopeBoundaryDescriptor(cursor.kind, source.moduleKind) !== null
				) {
					expectedParent = (scopesByOwnerNode.get(cursor.id) ?? [])[0];
					break;
				}
				cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
			}
		}
		if (expectedParent === undefined || scope.parentScopeId !== expectedParent.id)
			issue(
				'INVALID_VALUE',
				`$.scopes[${index}].parentScopeId`,
				'Scope parent must be the exact nearest supported retained boundary scope.'
			);
	}

	for (const [index, scope] of snapshot.scopes.entries()) {
		const seen = new Set<string>();
		let cursor: StaticSemanticSnapshot['scopes'][number] | undefined = scope;
		let terminal: StaticSemanticSnapshot['scopes'][number] | undefined;
		while (cursor !== undefined) {
			if (!referenceCheck()) break;
			if (seen.has(cursor.id)) {
				issue(
					'INVALID_VALUE',
					`$.scopes[${index}].parentScopeId`,
					'Scope parent relation contains a cycle.'
				);
				terminal = undefined;
				break;
			}
			seen.add(cursor.id);
			if (cursor.parentScopeId === null) {
				terminal = cursor;
				break;
			}
			cursor = scopeById.get(cursor.parentScopeId);
		}
		if (terminal?.kind !== 'PROGRAM_GLOBAL' || terminal.programId !== scope.programId)
			issue(
				'DANGLING_REFERENCE',
				`$.scopes[${index}].parentScopeId`,
				'Every scope must reach the one Program-global scope in its Program.'
			);
	}

	function enclosingVariableStatement(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['astNodes'][number] | undefined {
		let declaration = node;
		if (node.kind === ts.SyntaxKind.BindingElement) {
			let cursor = node.parentId === null ? undefined : nodeById.get(node.parentId);
			while (
				cursor !== undefined &&
				[
					ts.SyntaxKind.ArrayBindingPattern,
					ts.SyntaxKind.BindingElement,
					ts.SyntaxKind.ObjectBindingPattern
				].includes(cursor.kind)
			)
				cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
			if (cursor?.kind !== ts.SyntaxKind.VariableDeclaration) return undefined;
			declaration = cursor;
		} else if (node.kind !== ts.SyntaxKind.VariableDeclaration) {
			return undefined;
		}
		const declarationList =
			declaration.parentId === null ? undefined : nodeById.get(declaration.parentId);
		if (declarationList?.kind !== ts.SyntaxKind.VariableDeclarationList) return undefined;
		const statement =
			declarationList.parentId === null ? undefined : nodeById.get(declarationList.parentId);
		return statement?.kind === ts.SyntaxKind.VariableStatement ? statement : undefined;
	}

	function hasDeclareModifierCarrier(node: StaticSemanticSnapshot['astNodes'][number]): boolean {
		const seen = new Set<string>();
		let cursor: StaticSemanticSnapshot['astNodes'][number] | undefined = node;
		while (cursor !== undefined && !seen.has(cursor.id)) {
			seen.add(cursor.id);
			if (
				(childrenByParent.get(cursor.id) ?? []).some(
					(child) => child.kind === ts.SyntaxKind.DeclareKeyword
				)
			)
				return true;
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return false;
	}

	function ownedScope(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['scopes'][number] | undefined {
		return (scopesByOwnerNode.get(node.id) ?? [])[0];
	}

	function nearestRetainedScope(
		node: StaticSemanticSnapshot['astNodes'][number] | undefined,
		ordinaryReference: boolean
	): StaticSemanticSnapshot['scopes'][number] | undefined {
		let cursor = node;
		while (cursor !== undefined) {
			const source = sourceById.get(cursor.sourceId);
			const descriptor =
				source === undefined
					? null
					: semanticScopeBoundaryDescriptor(cursor.kind, source.moduleKind);
			if (
				descriptor !== null &&
				(!ordinaryReference || isOrdinaryReferenceScope(descriptor.domain))
			)
				return ownedScope(cursor);
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return undefined;
	}

	function nodeInsideConditionalInfer(
		node: StaticSemanticSnapshot['astNodes'][number],
		conditionalWithInfer: ReadonlySet<string>
	): boolean {
		let cursor: StaticSemanticSnapshot['astNodes'][number] | undefined = node;
		while (cursor !== undefined) {
			if (conditionalWithInfer.has(cursor.id)) return true;
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return false;
	}

	const conditionalWithInfer = new Set<string>();
	for (const inferNode of snapshot.astNodes.filter(
		(node) => node.kind === ts.SyntaxKind.InferType
	)) {
		let cursor = inferNode.parentId === null ? undefined : nodeById.get(inferNode.parentId);
		while (cursor !== undefined) {
			if (cursor.kind === ts.SyntaxKind.ConditionalType) conditionalWithInfer.add(cursor.id);
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
	}

	function variableEnvironmentNode(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['astNodes'][number] | undefined {
		let cursor: StaticSemanticSnapshot['astNodes'][number] | undefined = node;
		while (cursor !== undefined) {
			const source = sourceById.get(cursor.sourceId);
			const descriptor =
				source === undefined
					? null
					: semanticScopeBoundaryDescriptor(cursor.kind, source.moduleKind);
			if (
				descriptor?.kind === 'FUNCTION' ||
				descriptor?.kind === 'SOURCE_MODULE' ||
				descriptor?.kind === 'SOURCE_SCRIPT'
			)
				return cursor;
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return undefined;
	}

	function orderedChildren(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['astNodes'][number][] {
		return [...(childrenByParent.get(node.id) ?? [])].sort(
			(left, right) => left.siblingOrdinal - right.siblingOrdinal
		);
	}

	function transparentEvalCalleeNode(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['astNodes'][number] {
		const seen = new Set<string>();
		let cursor = node;
		while (!seen.has(cursor.id)) {
			seen.add(cursor.id);
			const children = orderedChildren(cursor);
			let expression: StaticSemanticSnapshot['astNodes'][number] | undefined;
			switch (cursor.kind) {
				case ts.SyntaxKind.ParenthesizedExpression:
				case ts.SyntaxKind.NonNullExpression:
					expression = children[0];
					break;
				case ts.SyntaxKind.AsExpression:
				case ts.SyntaxKind.SatisfiesExpression:
					expression = children[0];
					break;
				case ts.SyntaxKind.TypeAssertionExpression:
					expression = children.at(-1);
					break;
				default:
					return cursor;
			}
			if (expression === undefined) return cursor;
			cursor = expression;
		}
		return cursor;
	}

	const directEvalEnvironments = new Set<string>();
	for (const call of snapshot.astNodes.filter(
		(node) => node.kind === ts.SyntaxKind.CallExpression
	)) {
		if ((call.publicFlags & ts.NodeFlags.OptionalChain) !== 0) continue;
		const callee = (childrenByParent.get(call.id) ?? []).find((child) =>
			child.structuralRoles.includes('invocation-callee')
		);
		const unwrapped = callee === undefined ? undefined : transparentEvalCalleeNode(callee);
		if (
			unwrapped?.kind === ts.SyntaxKind.Identifier &&
			unwrapped.syntacticIdentifierText === 'eval'
		) {
			const environment = variableEnvironmentNode(call);
			if (environment !== undefined) directEvalEnvironments.add(environment.id);
		}
	}

	function referenceRequiresUnsupportedScopeLink(
		node: StaticSemanticSnapshot['astNodes'][number]
	): boolean {
		if (nodeInsideConditionalInfer(node, conditionalWithInfer)) return true;
		let cursor: StaticSemanticSnapshot['astNodes'][number] | undefined = node;
		while (cursor !== undefined) {
			if (cursor.kind === ts.SyntaxKind.WithStatement) return true;
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		const environment = variableEnvironmentNode(node);
		return environment !== undefined && directEvalEnvironments.has(environment.id);
	}

	function enclosingVariableDeclarationList(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['astNodes'][number] | undefined {
		let cursor: StaticSemanticSnapshot['astNodes'][number] | undefined = node;
		while (cursor !== undefined) {
			if (cursor.kind === ts.SyntaxKind.VariableDeclarationList) return cursor;
			const source = sourceById.get(cursor.sourceId);
			const descriptor =
				source === undefined
					? null
					: semanticScopeBoundaryDescriptor(cursor.kind, source.moduleKind);
			if (
				cursor !== node &&
				(descriptor?.kind === 'FUNCTION' ||
					descriptor?.kind === 'SOURCE_MODULE' ||
					descriptor?.kind === 'SOURCE_SCRIPT')
			)
				return undefined;
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return undefined;
	}

	function nearestDeclarationVariableEnvironment(
		node: StaticSemanticSnapshot['astNodes'][number] | undefined
	): StaticSemanticSnapshot['scopes'][number] | undefined {
		let cursor = node;
		while (cursor !== undefined) {
			if (cursor.kind === ts.SyntaxKind.ClassStaticBlockDeclaration) return ownedScope(cursor);
			const source = sourceById.get(cursor.sourceId);
			const descriptor =
				source === undefined
					? null
					: semanticScopeBoundaryDescriptor(cursor.kind, source.moduleKind);
			if (
				descriptor?.kind === 'FUNCTION' ||
				descriptor?.kind === 'NAMESPACE' ||
				descriptor?.kind === 'SOURCE_MODULE'
			)
				return ownedScope(cursor);
			if (descriptor?.kind === 'SOURCE_SCRIPT')
				return (globalScopesByProgram.get(source!.programId) ?? [])[0];
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return undefined;
	}

	const parameterPropertyModifierKinds = new Set<number>([
		ts.SyntaxKind.PrivateKeyword,
		ts.SyntaxKind.ProtectedKeyword,
		ts.SyntaxKind.PublicKeyword,
		ts.SyntaxKind.ReadonlyKeyword
	]);

	function isValidationParameterProperty(
		node: StaticSemanticSnapshot['astNodes'][number]
	): boolean {
		if (node.kind !== ts.SyntaxKind.Parameter || node.parentId === null) return false;
		const parent = nodeById.get(node.parentId);
		return (
			parent?.kind === ts.SyntaxKind.Constructor &&
			orderedChildren(node).some((child) => parameterPropertyModifierKinds.has(child.kind))
		);
	}

	function functionBodyNode(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['astNodes'][number] | undefined {
		const source = sourceById.get(node.sourceId);
		if (
			source === undefined ||
			semanticScopeBoundaryDescriptor(node.kind, source.moduleKind)?.kind !== 'FUNCTION'
		)
			return undefined;
		return orderedChildren(node).find((child) => child.kind === ts.SyntaxKind.Block);
	}

	function hasValidationUseStrictPrologue(
		container: StaticSemanticSnapshot['astNodes'][number]
	): boolean {
		const statementsOwner =
			container.kind === ts.SyntaxKind.SourceFile ? container : functionBodyNode(container);
		if (statementsOwner === undefined) return false;
		for (const statement of orderedChildren(statementsOwner)) {
			if (statement.kind !== ts.SyntaxKind.ExpressionStatement) return false;
			const expression = orderedChildren(statement)[0];
			if (expression?.kind !== ts.SyntaxKind.StringLiteral) return false;
			const literal = literalByNodeId.get(expression.id);
			if (
				literal?.valueState === 'EXACT' &&
				literal.valueType === 'STRING' &&
				literal.value === 'use strict' &&
				literal.lexemeLength === USE_STRICT_LEXEME_LENGTH &&
				USE_STRICT_LEXEME_DIGESTS.some((digest) => digest === literal.lexemeSha256)
			)
				return true;
		}
		return false;
	}

	function isValidationDefinitelyStrict(node: StaticSemanticSnapshot['astNodes'][number]): boolean {
		const source = sourceById.get(node.sourceId);
		const project = source === undefined ? undefined : projectById.get(source.projectId);
		const compilerOptions = project?.programRecipe.compilerOptions;
		if (
			compilerOptions?.alwaysStrict === true ||
			(compilerOptions?.alwaysStrict !== false && compilerOptions?.strict === true) ||
			source?.moduleKind === 'MODULE'
		)
			return true;
		let cursor = node.parentId === null ? undefined : nodeById.get(node.parentId);
		while (cursor !== undefined) {
			if (
				cursor.kind === ts.SyntaxKind.ClassDeclaration ||
				cursor.kind === ts.SyntaxKind.ClassExpression
			)
				return true;
			if (
				(cursor.kind === ts.SyntaxKind.SourceFile || functionBodyNode(cursor) !== undefined) &&
				hasValidationUseStrictPrologue(cursor)
			)
				return true;
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return false;
	}

	function isDirectFunctionBody(
		node: StaticSemanticSnapshot['astNodes'][number]
	): StaticSemanticSnapshot['astNodes'][number] | undefined {
		if (node.kind !== ts.SyntaxKind.Block || node.parentId === null) return undefined;
		const parent = nodeById.get(node.parentId);
		return parent !== undefined && functionBodyNode(parent)?.id === node.id ? parent : undefined;
	}

	function expectedDeclarationScopeLink(node: StaticSemanticSnapshot['astNodes'][number]): {
		readonly scope: StaticSemanticSnapshot['scopes'][number] | undefined;
		readonly state: 'RESOLVED' | 'UNSUPPORTED';
	} {
		if (
			isValidationParameterProperty(node) ||
			nodeInsideConditionalInfer(node, conditionalWithInfer)
		)
			return { scope: undefined, state: 'UNSUPPORTED' };
		if (
			node.kind === ts.SyntaxKind.SourceFile ||
			node.kind === ts.SyntaxKind.FunctionExpression ||
			node.kind === ts.SyntaxKind.ClassExpression
		)
			return { scope: ownedScope(node), state: 'RESOLVED' };
		if (node.kind === ts.SyntaxKind.FunctionDeclaration && node.parentId !== null) {
			const parent = nodeById.get(node.parentId);
			if (parent !== undefined) {
				const functionOwner = isDirectFunctionBody(parent);
				if (functionOwner !== undefined)
					return { scope: ownedScope(functionOwner), state: 'RESOLVED' };
				if (
					parent.kind !== ts.SyntaxKind.SourceFile &&
					parent.kind !== ts.SyntaxKind.ModuleBlock &&
					!isValidationDefinitelyStrict(node)
				)
					return { scope: undefined, state: 'UNSUPPORTED' };
			}
		}
		const declarationList = enclosingVariableDeclarationList(node);
		if (
			declarationList !== undefined &&
			(declarationList.publicFlags & ts.NodeFlags.BlockScoped) === 0
		)
			return {
				scope: nearestDeclarationVariableEnvironment(
					node.parentId === null ? undefined : nodeById.get(node.parentId)
				),
				state: 'RESOLVED'
			};
		let scope = nearestRetainedScope(
			node.parentId === null ? undefined : nodeById.get(node.parentId),
			false
		);
		if (scope?.kind === 'SOURCE_SCRIPT')
			scope = (globalScopesByProgram.get(scope.programId) ?? [])[0];
		return { scope, state: 'RESOLVED' };
	}

	function validateRecomputedScopeLink(
		actualScopeId: string | null,
		actualState: 'RESOLVED' | 'UNSUPPORTED',
		expected: {
			readonly scope: StaticSemanticSnapshot['scopes'][number] | undefined;
			readonly state: 'RESOLVED' | 'UNSUPPORTED';
		},
		jsonPath: string
	): void {
		if (
			actualState !== expected.state ||
			(expected.state === 'UNSUPPORTED'
				? actualScopeId !== null
				: expected.scope !== undefined && actualScopeId !== expected.scope.id)
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Scope link must reproduce the independently recomputed supported binding boundary.'
			);
	}

	for (const [index, candidate] of snapshot.declarationCandidates.entries()) {
		const node = nodeById.get(candidate.nodeId);
		if (!node || node.sourceId !== candidate.sourceId)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`$.declarationCandidates[${index}].nodeId`,
				'Declaration-candidate node belongs elsewhere or is absent.'
			);
		if (candidate.nameNodeId !== null)
			nodeReference(
				candidate.nameNodeId,
				candidate.sourceId,
				`$.declarationCandidates[${index}].nameNodeId`
			);
		const nameNode = candidate.nameNodeId === null ? undefined : nodeById.get(candidate.nameNodeId);
		if (
			nameNode !== undefined &&
			(nameNode.parentId !== candidate.nodeId ||
				!nameNode.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName))
		)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}].nameNodeId`,
				'Candidate name must be the retained declaration-name child of the candidate node.'
			);
		const expectedNameState =
			nameNode === undefined
				? 'ANONYMOUS'
				: semanticDeclarationNameState(nameNode.kind, nameNode.syntacticIdentifierText);
		if (expectedNameState === null || candidate.nameState !== expectedNameState)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}].nameState`,
				'Declaration name state must be derived exactly from the retained name-node SyntaxKind.'
			);
		if (
			node !== undefined &&
			(!declarationCandidateMatchesNode(node.kind, candidate.candidateRole, candidate.nameState) ||
				candidate.syntaxKind !== node.kind ||
				candidate.syntaxKindName !== node.kindName ||
				typescriptSyntaxKindName(candidate.syntaxKind) !== candidate.syntaxKindName)
		)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}]`,
				'Declaration-candidate syntax identity and bounded taxonomy must reproduce its retained AST node.'
			);
		const expected = semanticDeclarationCandidateId({
			candidateRole: candidate.candidateRole,
			nodeId: candidate.nodeId,
			syntaxKind: candidate.syntaxKind
		});
		if (candidate.id !== expected)
			issue(
				'IDENTITY_MISMATCH',
				`$.declarationCandidates[${index}].id`,
				'Declaration-candidate identity mismatch.'
			);
		if (
			candidate.nameState === 'ANONYMOUS'
				? candidate.nameNodeId !== null || candidate.syntacticName !== null
				: candidate.nameNodeId === null
		)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}]`,
				'Candidate name state must agree with its retained name node.'
			);
		if (
			candidate.nameState === 'ATOMIC'
				? candidate.syntacticName === null || candidate.syntacticName.length === 0
				: candidate.syntacticName !== null
		)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}].syntacticName`,
				'Only atomic candidate names carry non-empty syntactic text.'
			);
		if (
			candidate.nameState === 'ATOMIC' &&
			nameNode?.syntacticIdentifierText != null &&
			candidate.syntacticName !== nameNode.syntacticIdentifierText
		)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}].syntacticName`,
				'Atomic identifier names must reproduce their retained identifier text.'
			);
		if (
			candidate.nameState === 'ATOMIC' &&
			nameNode !== undefined &&
			nameNode.syntacticIdentifierText === null
		) {
			const nameLiteral = literalByNodeId.get(nameNode.id);
			if (
				candidate.syntacticName === null ||
				nameLiteral === undefined ||
				nameLiteral.lexemeLength !== candidate.syntacticName.length ||
				nameLiteral.lexemeSha256 !== sha256(candidate.syntacticName)
			)
				issue(
					'INVALID_VALUE',
					`$.declarationCandidates[${index}].syntacticName`,
					'Atomic literal names must retain the exact scalar-safe source lexeme bound by the literal lexeme digest.'
				);
		}
		if (candidate.exportCarrierNodeId !== null)
			nodeReference(
				candidate.exportCarrierNodeId,
				candidate.sourceId,
				`$.declarationCandidates[${index}].exportCarrierNodeId`
			);
		const localModifierChildren = (childrenByParent.get(candidate.nodeId) ?? []).filter((child) =>
			isTypeScriptModifierKind(child.kind)
		);
		const expectedLocalModifiers = [
			...new Map(
				localModifierChildren.map((child) => [
					`${child.kind}:${child.kindName}`,
					{ code: child.kind, name: child.kindName }
				])
			).values()
		].sort((left, right) => (`${left.code}:${left.name}` < `${right.code}:${right.name}` ? -1 : 1));
		const modifierNames = new Set(candidate.localModifiers.map((modifier) => modifier.name));
		const expectedAmbientSyntax =
			sourceById.get(candidate.sourceId)?.declarationFile === true ||
			(node !== undefined && hasDeclareModifierCarrier(node));
		if (candidate.ambientSyntax !== expectedAmbientSyntax)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}].ambientSyntax`,
				'Ambient syntax must exactly reproduce declaration-file or explicit/inherited declare-modifier context.'
			);
		if (
			!isCanonicalSet(
				candidate.localModifiers.map((modifier) => `${modifier.code}:${modifier.name}`)
			)
		)
			issue(
				'NONCANONICAL_ORDER',
				`$.declarationCandidates[${index}].localModifiers`,
				'Declaration-candidate local modifiers must be a canonical set.'
			);
		for (const [modifierIndex, modifier] of candidate.localModifiers.entries())
			if (typescriptSyntaxKindName(modifier.code) !== modifier.name)
				issue(
					'INVALID_VALUE',
					`$.declarationCandidates[${index}].localModifiers[${modifierIndex}]`,
					'Local modifier code and name must agree with the public TypeScript enum.'
				);
		if (
			canonicalSemanticJson(candidate.localModifiers) !==
			canonicalSemanticJson(expectedLocalModifiers)
		)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}].localModifiers`,
				'Local modifiers must reproduce the deduplicated set of direct modifier children from the named AST traversal profile.'
			);
		const variableCarrier = node === undefined ? undefined : enclosingVariableStatement(node);
		const carrierModifierNames = new Set(
			(variableCarrier === undefined ? [] : (childrenByParent.get(variableCarrier.id) ?? []))
				.filter((child) => isTypeScriptModifierKind(child.kind))
				.map((child) => child.kindName)
		);
		const expectedExport =
			candidate.syntaxKind === ts.SyntaxKind.ExportSpecifier
				? { carrierId: candidate.nodeId, syntax: 'EXPORT_SPECIFIER' as const }
				: candidate.syntaxKind === ts.SyntaxKind.ExportAssignment
					? { carrierId: candidate.nodeId, syntax: 'EXPORT_ASSIGNMENT' as const }
					: candidate.syntaxKind === ts.SyntaxKind.NamespaceExport ||
						  candidate.syntaxKind === ts.SyntaxKind.NamespaceExportDeclaration
						? { carrierId: candidate.nodeId, syntax: 'NAMESPACE_EXPORT' as const }
						: modifierNames.has('DefaultKeyword')
							? { carrierId: candidate.nodeId, syntax: 'DEFAULT' as const }
							: modifierNames.has('ExportKeyword')
								? { carrierId: candidate.nodeId, syntax: 'EXPLICIT' as const }
								: carrierModifierNames.has('DefaultKeyword')
									? { carrierId: variableCarrier!.id, syntax: 'DEFAULT' as const }
									: carrierModifierNames.has('ExportKeyword')
										? { carrierId: variableCarrier!.id, syntax: 'EXPLICIT' as const }
										: { carrierId: null, syntax: 'NONE' as const };
		if (
			candidate.exportSyntax !== expectedExport.syntax ||
			candidate.exportCarrierNodeId !== expectedExport.carrierId
		)
			issue(
				'INVALID_VALUE',
				`$.declarationCandidates[${index}].exportSyntax`,
				'Export syntax and carrier must distinguish node-local syntax from the exact enclosing variable-statement carrier.'
			);
	}

	function symbolReference(
		symbolId: string,
		projectId: string,
		jsonPath: string
	): StaticSemanticSnapshot['symbols'][number] | undefined {
		if (!referenceCheck()) return undefined;
		const symbol = symbolById.get(symbolId as never);
		if (symbol === undefined) issue('DANGLING_REFERENCE', jsonPath, 'Referenced symbol is absent.');
		else if (symbol.projectId !== projectId)
			issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Referenced symbol belongs to another project.');
		return symbol;
	}

	function sourceScopeReference(
		scopeId: string | null,
		state: 'RESOLVED' | 'UNSUPPORTED',
		source: StaticSemanticSnapshot['sources'][number] | undefined,
		jsonPath: string
	): StaticSemanticSnapshot['scopes'][number] | undefined {
		if ((state === 'RESOLVED') !== (scopeId !== null)) {
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Scope-link state must be RESOLVED exactly when a scope identity is present.'
			);
			return undefined;
		}
		if (scopeId === null) return undefined;
		if (!referenceCheck()) return undefined;
		const scope = scopeById.get(scopeId as never);
		if (scope === undefined) {
			issue('DANGLING_REFERENCE', jsonPath, 'Referenced lexical scope is absent.');
			return undefined;
		}
		if (
			source === undefined ||
			scope.projectId !== source.projectId ||
			scope.programId !== source.programId ||
			(scope.kind !== 'PROGRAM_GLOBAL' && scope.sourceId !== source.id)
		)
			issue(
				'CROSS_PROJECT_REFERENCE',
				jsonPath,
				'Referenced lexical scope is outside the fact source and Program.'
			);
		return scope;
	}

	for (const [index, declaration] of snapshot.declarations.entries()) {
		const jsonPath = `$.declarations[${index}]`;
		const source = sourceById.get(declaration.sourceId);
		if (!hasSemanticIdPrefix(declaration.durableId, 'semantic', 'declaration-durable'))
			issue('INVALID_VALUE', `${jsonPath}.durableId`, 'Invalid durable declaration identity.');
		if (source === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.sourceId`, 'Declaration source is absent.');
		sourceScopeReference(
			declaration.declaringScopeId,
			declaration.scopeLinkState,
			source,
			`${jsonPath}.declaringScopeId`
		);
		if ((declaration.symbolBindingState === 'RESOLVED') !== (declaration.symbolId !== null))
			issue(
				'INVALID_VALUE',
				`${jsonPath}.symbolBindingState`,
				'Declaration symbol-binding state must agree exactly with nullable symbol identity.'
			);
		if (
			!Number.isSafeInteger(declaration.start) ||
			!Number.isSafeInteger(declaration.end) ||
			declaration.start < 0 ||
			declaration.start > declaration.end ||
			(source !== undefined && declaration.end > source.textLength)
		)
			issue('INVALID_VALUE', jsonPath, 'Declaration UTF-16 span is invalid.');
		if (typescriptSyntaxKindName(declaration.kind) !== declaration.kindName)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.kindName`,
				'Declaration kind code and name must agree with the public TypeScript enum.'
			);
		const expectedNamePresent = declaration.nameState === 'ATOMIC';
		if (
			expectedNamePresent
				? declaration.name === null || declaration.name.length === 0
				: declaration.name !== null
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.name`,
				'Only an atomic declaration name may carry non-empty text.'
			);
		const node = declaration.nodeId === null ? undefined : nodeById.get(declaration.nodeId);
		if (declaration.nodeId !== null && node === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.nodeId`, 'Declaration node is absent.');
		else if (
			node !== undefined &&
			(node.sourceId !== declaration.sourceId ||
				node.kind !== declaration.kind ||
				node.kindName !== declaration.kindName ||
				node.start !== declaration.start ||
				node.end !== declaration.end)
		)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`${jsonPath}.nodeId`,
				'Declaration node must reproduce the same source, kind, and span.'
			);
		if (source?.analysisDisposition === 'DEEP_INDEXED' && node !== undefined)
			validateRecomputedScopeLink(
				declaration.declaringScopeId,
				declaration.scopeLinkState,
				expectedDeclarationScopeLink(node),
				`${jsonPath}.declaringScopeId`
			);
		if (
			source?.analysisDisposition === 'DEEP_INDEXED' &&
			node !== undefined &&
			isValidationParameterProperty(node) &&
			(declaration.symbolBindingState !== 'UNSUPPORTED' || declaration.symbolId !== null)
		)
			issue(
				'CONFORMANCE_OVERCLAIM',
				`${jsonPath}.symbolBindingState`,
				'Parameter-property declarations must expose the incompatible checker-symbol binding as unsupported.'
			);
		const candidate =
			declaration.candidateId === null
				? undefined
				: declarationCandidateById.get(declaration.candidateId);
		if (declaration.candidateId !== null && candidate === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.candidateId`, 'Declaration candidate is absent.');
		else if (
			candidate !== undefined &&
			(candidate.sourceId !== declaration.sourceId ||
				candidate.nodeId !== declaration.nodeId ||
				candidate.nameState !== declaration.nameState)
		)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`${jsonPath}.candidateId`,
				'Declaration candidate must bind the same source, node, and name state.'
			);
		if (
			candidate !== undefined &&
			declaration.ambient !== (source?.declarationFile === true || candidate.ambientSyntax)
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.ambient`,
				'Declaration ambient state must reproduce its source and syntax candidate.'
			);
		const expected = semanticDeclarationId({
			end: declaration.end,
			kind: declaration.kind,
			nodeId: declaration.nodeId,
			sourceId: declaration.sourceId,
			start: declaration.start
		});
		if (declaration.id !== expected)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Declaration identity mismatch.');
		if (source !== undefined) {
			try {
				const expectedDurableId = semanticDurableDeclarationId({
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
				});
				if (declaration.durableId !== expectedDurableId)
					issue(
						'IDENTITY_MISMATCH',
						`${jsonPath}.durableId`,
						'Durable declaration identity mismatch.'
					);
			} catch {
				issue(
					'INVALID_VALUE',
					`${jsonPath}.durableId`,
					'Durable declaration identity preimage is incoherent.'
				);
			}
			if (declaration.symbolId !== null)
				symbolReference(declaration.symbolId, source.projectId, `${jsonPath}.symbolId`);
			compilerSymbolProvenance(
				declaration.bindingProvenanceId,
				source.projectId,
				`${jsonPath}.bindingProvenanceId`,
				declaration.sourceId
			);
			scopeDerivedProvenance(
				declaration.structuralProvenanceId,
				source.projectId,
				`${jsonPath}.structuralProvenanceId`,
				declaration.sourceId
			);
			if (declaration.symbolBindingState === 'UNSUPPORTED')
				degradedSymbolProvenance(
					declaration.bindingProvenanceId,
					source.projectId,
					`${jsonPath}.bindingProvenanceId`,
					declaration.sourceId
				);
			if (declaration.scopeLinkState === 'UNSUPPORTED')
				degradedSymbolProvenance(
					declaration.structuralProvenanceId,
					source.projectId,
					`${jsonPath}.structuralProvenanceId`,
					declaration.sourceId
				);
		}
	}

	for (const [index, symbol] of snapshot.symbols.entries()) {
		const jsonPath = `$.symbols[${index}]`;
		const project = projectById.get(symbol.projectId);
		const program = programById.get(symbol.programId);
		if (project === undefined || program === undefined)
			issue('DANGLING_REFERENCE', jsonPath, 'Symbol project or Program is absent.');
		else if (program.projectId !== symbol.projectId || project.programId !== symbol.programId)
			issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Symbol project and Program disagree.');
		if (symbol.name.length === 0 || !Number.isSafeInteger(symbol.flags) || symbol.flags < 0)
			issue('INVALID_VALUE', jsonPath, 'Symbol name and public flag mask must be valid.');
		if (
			!isCanonicalSet(symbol.declarationIds) ||
			!isCanonicalSet(symbol.fallbackReferenceNodeIds) ||
			!isCanonicalSet(symbol.flagNames) ||
			symbol.flagNames.some((name) => name.length === 0)
		)
			issue(
				'NONCANONICAL_ORDER',
				jsonPath,
				'Symbol declaration, fallback-reference, and flag-name sets must be canonical.'
			);
		const usesDeclarations = symbol.identityBasis === 'DECLARATIONS';
		if (
			usesDeclarations
				? symbol.declarationIds.length === 0 || symbol.fallbackReferenceNodeIds.length !== 0
				: symbol.declarationIds.length !== 0 || symbol.fallbackReferenceNodeIds.length === 0
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.identityBasis`,
				'Symbol identity basis must agree with its declaration or fallback-reference set.'
			);
		const expectedMergeState =
			symbol.declarationIds.length === 0
				? 'DECLARATIONLESS'
				: symbol.declarationIds.length === 1
					? 'SINGLE'
					: 'MERGED';
		if (symbol.mergeState !== expectedMergeState)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.mergeState`,
				'Symbol merge state must be derived from its declarations.'
			);
		for (const declarationId of symbol.declarationIds) {
			if (!referenceCheck()) break;
			const declaration = declarationById.get(declarationId as never);
			const declarationSource =
				declaration === undefined ? undefined : sourceById.get(declaration.sourceId);
			if (declaration === undefined)
				issue('DANGLING_REFERENCE', `${jsonPath}.declarationIds`, 'Symbol declaration is absent.');
			else if (
				declaration.symbolBindingState !== 'RESOLVED' ||
				declaration.symbolId !== symbol.id ||
				declarationSource?.projectId !== symbol.projectId
			)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`${jsonPath}.declarationIds`,
					'Symbol declaration does not point back from the same project.'
				);
		}
		for (const nodeId of symbol.fallbackReferenceNodeIds) {
			if (!referenceCheck()) break;
			const node = nodeById.get(nodeId as never);
			const nodeSource = node === undefined ? undefined : sourceById.get(node.sourceId);
			if (node === undefined)
				issue(
					'DANGLING_REFERENCE',
					`${jsonPath}.fallbackReferenceNodeIds`,
					'Symbol fallback reference node is absent.'
				);
			else if (nodeSource?.projectId !== symbol.projectId)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`${jsonPath}.fallbackReferenceNodeIds`,
					'Symbol fallback reference node belongs to another project.'
				);
		}
		if (
			symbol.valueDeclarationId !== null &&
			!symbol.declarationIds.includes(symbol.valueDeclarationId)
		)
			issue(
				'DANGLING_REFERENCE',
				`${jsonPath}.valueDeclarationId`,
				'Value declaration must belong to the symbol declaration set.'
			);
		try {
			const expected = semanticSymbolId({
				declarationIds: symbol.declarationIds,
				fallbackReferenceNodeIds: symbol.fallbackReferenceNodeIds,
				flags: symbol.flags,
				identityBasis: symbol.identityBasis,
				name: symbol.name,
				programId: symbol.programId,
				projectId: symbol.projectId
			});
			if (symbol.id !== expected)
				issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Symbol identity mismatch.');
		} catch {
			issue(
				'INVALID_VALUE',
				`${jsonPath}.identityBasis`,
				'Symbol identity preimage is incoherent.'
			);
		}
		compilerSymbolProvenance(symbol.provenanceId, symbol.projectId, `${jsonPath}.provenanceId`);
	}
	for (const symbol of snapshot.symbols) {
		const ownedDeclarations = snapshot.declarations
			.filter((declaration) => declaration.symbolId === symbol.id)
			.map((declaration) => declaration.id);
		if (!sameMembers(symbol.declarationIds, ownedDeclarations))
			issue(
				'DANGLING_REFERENCE',
				'$.symbols',
				`Symbol ${symbol.id} declaration manifest is incomplete.`
			);
	}

	if (aliasBySymbolId.size !== snapshot.aliases.length)
		issue('DUPLICATE_ID', '$.aliases', 'Each alias symbol may have at most one alias record.');
	for (const [index, alias] of snapshot.aliases.entries()) {
		const jsonPath = `$.aliases[${index}]`;
		const aliasSymbol = symbolById.get(alias.aliasSymbolId);
		if (aliasSymbol === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.aliasSymbolId`, 'Alias symbol is absent.');
		else if ((aliasSymbol.flags & ts.SymbolFlags.Alias) === 0)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.aliasSymbolId`,
				'Alias record must bind a TypeScript alias symbol.'
			);
		const projectId = aliasSymbol?.projectId;
		if (projectId !== undefined) {
			if (alias.targetSymbolId !== null)
				symbolReference(alias.targetSymbolId, projectId, `${jsonPath}.targetSymbolId`);
			if (alias.terminalSymbolId !== null)
				symbolReference(alias.terminalSymbolId, projectId, `${jsonPath}.terminalSymbolId`);
			compilerSymbolProvenance(alias.provenanceId, projectId, `${jsonPath}.provenanceId`);
			if (alias.state !== 'RESOLVED')
				degradedSymbolProvenance(alias.provenanceId, projectId, `${jsonPath}.provenanceId`);
		}
		if (
			alias.state === 'RESOLVED'
				? alias.targetSymbolId === null || alias.terminalSymbolId === null
				: alias.state === 'CIRCULAR'
					? alias.terminalSymbolId !== null
					: alias.targetSymbolId !== null || alias.terminalSymbolId !== null
		)
			issue('INVALID_VALUE', `${jsonPath}.state`, 'Alias state and target identities disagree.');
		const expected = semanticAliasId({
			aliasSymbolId: alias.aliasSymbolId,
			state: alias.state,
			targetSymbolId: alias.targetSymbolId,
			terminalSymbolId: alias.terminalSymbolId
		});
		if (alias.id !== expected)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Alias identity mismatch.');
	}

	const declarationCandidateByNameNodeId = new Map(
		snapshot.declarationCandidates.flatMap((candidate) =>
			candidate.nameNodeId === null ? [] : [[candidate.nameNodeId, candidate] as const]
		)
	);
	const declarationByCandidateId = new Map(
		snapshot.declarations.flatMap((declaration) =>
			declaration.candidateId === null ? [] : [[declaration.candidateId, declaration] as const]
		)
	);
	for (const [index, reference] of snapshot.references.entries()) {
		const jsonPath = `$.references[${index}]`;
		nodeReference(reference.nodeId, reference.sourceId, `${jsonPath}.nodeId`);
		const source = sourceById.get(reference.sourceId);
		if (source === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.sourceId`, 'Reference source is absent.');
		sourceScopeReference(
			reference.containingScopeId,
			reference.scopeLinkState,
			source,
			`${jsonPath}.containingScopeId`
		);
		const referenceNode = nodeById.get(reference.nodeId);
		const namedCandidate = declarationCandidateByNameNodeId.get(reference.nodeId);
		const namedDeclaration =
			namedCandidate === undefined ? undefined : declarationByCandidateId.get(namedCandidate.id);
		const namedDeclarationNode =
			namedDeclaration?.nodeId === null || namedDeclaration?.nodeId === undefined
				? undefined
				: nodeById.get(namedDeclaration.nodeId);
		if (
			reference.role === 'DECLARATION_NAME' &&
			namedDeclarationNode !== undefined &&
			isValidationParameterProperty(namedDeclarationNode) &&
			(reference.resolutionState !== 'UNSUPPORTED' ||
				reference.symbolId !== null ||
				reference.resolvedSymbolId !== null)
		)
			issue(
				'CONFORMANCE_OVERCLAIM',
				`${jsonPath}.resolutionState`,
				'Parameter-property declaration-name references must preserve unsupported checker-symbol resolution.'
			);
		if (source?.analysisDisposition === 'DEEP_INDEXED' && referenceNode !== undefined) {
			let expectedScopeLink: {
				readonly scope: StaticSemanticSnapshot['scopes'][number] | undefined;
				readonly state: 'RESOLVED' | 'UNSUPPORTED';
			};
			if (referenceRequiresUnsupportedScopeLink(referenceNode)) {
				expectedScopeLink = { scope: undefined, state: 'UNSUPPORTED' };
			} else if (reference.role === 'DECLARATION_NAME') {
				const candidate = declarationCandidateByNameNodeId.get(reference.nodeId);
				const declarationNode =
					candidate === undefined ? undefined : nodeById.get(candidate.nodeId);
				expectedScopeLink =
					declarationNode === undefined
						? {
								scope: nearestRetainedScope(
									referenceNode.parentId === null
										? undefined
										: nodeById.get(referenceNode.parentId),
									true
								),
								state: 'RESOLVED'
							}
						: expectedDeclarationScopeLink(declarationNode);
			} else {
				expectedScopeLink = {
					scope: nearestRetainedScope(
						referenceNode.parentId === null ? undefined : nodeById.get(referenceNode.parentId),
						true
					),
					state: 'RESOLVED'
				};
			}
			validateRecomputedScopeLink(
				reference.containingScopeId,
				reference.scopeLinkState,
				expectedScopeLink,
				`${jsonPath}.containingScopeId`
			);
		}
		if (source !== undefined) {
			if (reference.symbolId !== null)
				symbolReference(reference.symbolId, source.projectId, `${jsonPath}.symbolId`);
			if (reference.resolvedSymbolId !== null)
				symbolReference(
					reference.resolvedSymbolId,
					source.projectId,
					`${jsonPath}.resolvedSymbolId`
				);
			compilerSymbolProvenance(
				reference.resolutionProvenanceId,
				source.projectId,
				`${jsonPath}.resolutionProvenanceId`,
				reference.sourceId
			);
			scopeDerivedProvenance(
				reference.structuralProvenanceId,
				source.projectId,
				`${jsonPath}.structuralProvenanceId`,
				reference.sourceId
			);
			if (reference.scopeLinkState === 'UNSUPPORTED')
				degradedSymbolProvenance(
					reference.structuralProvenanceId,
					source.projectId,
					`${jsonPath}.structuralProvenanceId`,
					reference.sourceId
				);
			if (reference.resolutionState === 'UNRESOLVED' || reference.resolutionState === 'UNSUPPORTED')
				degradedSymbolProvenance(
					reference.resolutionProvenanceId,
					source.projectId,
					`${jsonPath}.resolutionProvenanceId`,
					reference.sourceId
				);
		}
		const direct =
			reference.resolutionState === 'RESOLVED_DIRECT' &&
			reference.symbolId !== null &&
			reference.symbolId === reference.resolvedSymbolId;
		const alias =
			reference.resolutionState === 'RESOLVED_ALIAS' &&
			reference.symbolId !== null &&
			reference.resolvedSymbolId !== null &&
			aliasBySymbolId.get(reference.symbolId)?.terminalSymbolId === reference.resolvedSymbolId;
		const unresolved =
			reference.resolutionState === 'UNRESOLVED' && reference.resolvedSymbolId === null;
		const unsupported =
			reference.resolutionState === 'UNSUPPORTED' &&
			reference.symbolId === null &&
			reference.resolvedSymbolId === null;
		if (!direct && !alias && !unresolved && !unsupported)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.resolutionState`,
				'Reference resolution state and symbol identities disagree.'
			);
		if (
			reference.role === 'DECLARATION_NAME' &&
			!nodeById
				.get(reference.nodeId)
				?.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName)
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.role`,
				'Declaration-name reference must bind a retained declaration-name node.'
			);
		const expected = semanticReferenceId({
			nodeId: reference.nodeId,
			resolvedSymbolId: reference.resolvedSymbolId,
			resolutionState: reference.resolutionState,
			role: reference.role,
			symbolId: reference.symbolId
		});
		if (reference.id !== expected)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Reference identity mismatch.');
	}

	for (const [index, resolution] of snapshot.moduleResolutions.entries()) {
		const jsonPath = `$.moduleResolutions[${index}]`;
		nodeReference(resolution.nodeId, resolution.sourceId, `${jsonPath}.nodeId`);
		const source = sourceById.get(resolution.sourceId);
		if (resolution.specifierState === 'LITERAL' && resolution.specifier === null)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.specifier`,
				'Literal module occurrence requires its exact specifier text.'
			);
		if (resolution.specifierState === 'NON_LITERAL' && resolution.specifier !== null)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.specifier`,
				'Nonliteral module occurrence cannot invent a specifier text.'
			);
		if (
			resolution.specifierState === 'NON_LITERAL' &&
			(resolution.occurrenceKind !== 'DYNAMIC_IMPORT' ||
				resolution.resolutionState !== 'UNSUPPORTED')
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.specifierState`,
				'Nonliteral module occurrences must be unsupported dynamic imports.'
			);
		if (resolution.occurrenceKind === 'IMPORT_TYPE' && !resolution.typeOnly)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.typeOnly`,
				'ImportType module occurrences must be type-only.'
			);
		if (resolution.occurrenceKind === 'DYNAMIC_IMPORT' && resolution.typeOnly)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.typeOnly`,
				'Dynamic imports are runtime module occurrences.'
			);
		if (source === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.sourceId`, 'Module occurrence source is absent.');
		if (source !== undefined) {
			if (resolution.moduleSymbolId !== null)
				symbolReference(resolution.moduleSymbolId, source.projectId, `${jsonPath}.moduleSymbolId`);
			if (resolution.targetSourceId !== null) {
				const target = sourceById.get(resolution.targetSourceId);
				if (target === undefined)
					issue(
						'DANGLING_REFERENCE',
						`${jsonPath}.targetSourceId`,
						'Resolved module source is absent.'
					);
				else if (target.projectId !== source.projectId)
					issue(
						'CROSS_PROJECT_REFERENCE',
						`${jsonPath}.targetSourceId`,
						'Resolved module source belongs to another project context.'
					);
			}
			compilerSymbolProvenance(
				resolution.provenanceId,
				source.projectId,
				`${jsonPath}.provenanceId`,
				resolution.sourceId
			);
			if (
				resolution.resolutionState === 'UNRESOLVED' ||
				resolution.resolutionState === 'UNSUPPORTED'
			)
				degradedSymbolProvenance(
					resolution.provenanceId,
					source.projectId,
					`${jsonPath}.provenanceId`,
					resolution.sourceId
				);
		}
		const resolvedSource =
			resolution.resolutionState === 'RESOLVED_SOURCE' && resolution.targetSourceId !== null;
		const resolvedNonSource =
			(resolution.resolutionState === 'RESOLVED_AMBIENT' ||
				resolution.resolutionState === 'RESOLVED_EXTERNAL') &&
			(resolution.moduleSymbolId !== null || resolution.targetSourceId !== null);
		const unresolved =
			(resolution.resolutionState === 'UNRESOLVED' ||
				resolution.resolutionState === 'UNSUPPORTED') &&
			resolution.moduleSymbolId === null &&
			resolution.targetSourceId === null;
		if (!resolvedSource && !resolvedNonSource && !unresolved)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.resolutionState`,
				'Module-resolution state and resolved targets disagree.'
			);
		const expected = semanticModuleResolutionId({
			moduleSymbolId: resolution.moduleSymbolId,
			nodeId: resolution.nodeId,
			occurrenceKind: resolution.occurrenceKind,
			resolutionState: resolution.resolutionState,
			specifier: resolution.specifier,
			specifierState: resolution.specifierState,
			targetSourceId: resolution.targetSourceId,
			typeOnly: resolution.typeOnly
		});
		if (resolution.id !== expected)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Module-resolution identity mismatch.');
	}

	const exportKeys = new Set<string>();
	for (const [index, moduleExport] of snapshot.moduleExports.entries()) {
		const jsonPath = `$.moduleExports[${index}]`;
		const source = sourceById.get(moduleExport.sourceId);
		if (source === undefined)
			issue('DANGLING_REFERENCE', `${jsonPath}.sourceId`, 'Module-export source is absent.');
		if (moduleExport.exportName.length === 0)
			issue('INVALID_VALUE', `${jsonPath}.exportName`, 'Module-export name must be non-empty.');
		const exportKey = `${moduleExport.sourceId}\0${moduleExport.exportName}`;
		if (exportKeys.has(exportKey))
			issue('DUPLICATE_ID', jsonPath, 'A source may expose at most one binding per export name.');
		exportKeys.add(exportKey);
		if (source !== undefined) {
			symbolReference(moduleExport.symbolId, source.projectId, `${jsonPath}.symbolId`);
			if (moduleExport.targetSymbolId !== null)
				symbolReference(
					moduleExport.targetSymbolId,
					source.projectId,
					`${jsonPath}.targetSymbolId`
				);
			compilerSymbolProvenance(
				moduleExport.provenanceId,
				source.projectId,
				`${jsonPath}.provenanceId`,
				moduleExport.sourceId
			);
			if (moduleExport.state === 'UNRESOLVED')
				degradedSymbolProvenance(
					moduleExport.provenanceId,
					source.projectId,
					`${jsonPath}.provenanceId`,
					moduleExport.sourceId
				);
		}
		const targetCoherent =
			moduleExport.state === 'ALIAS' || moduleExport.state === 'REEXPORT'
				? moduleExport.targetSymbolId !== null
				: moduleExport.targetSymbolId === null;
		if (!targetCoherent)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.state`,
				'Module-export state and target symbol disagree.'
			);
		const expected = semanticModuleExportId({
			exportName: moduleExport.exportName,
			sourceId: moduleExport.sourceId,
			state: moduleExport.state,
			symbolId: moduleExport.symbolId,
			targetSymbolId: moduleExport.targetSymbolId
		});
		if (moduleExport.id !== expected)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Module-export identity mismatch.');
	}

	function typeRecordReference(
		typeId: string,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const type = typeById.get(typeId as never);
		if (type === undefined || type.programId !== programId || type.projectId !== projectId) {
			issue(
				type === undefined ? 'DANGLING_REFERENCE' : 'CROSS_PROJECT_REFERENCE',
				jsonPath,
				type === undefined
					? 'Referenced type is absent.'
					: 'Referenced type belongs to a different Program or project.'
			);
			return false;
		}
		return true;
	}

	function signatureRecordReference(
		signatureId: string,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const signature = signatureById.get(signatureId as never);
		if (
			signature === undefined ||
			signature.programId !== programId ||
			signature.projectId !== projectId
		) {
			issue(
				signature === undefined ? 'DANGLING_REFERENCE' : 'CROSS_PROJECT_REFERENCE',
				jsonPath,
				signature === undefined
					? 'Referenced Signature is absent.'
					: 'Referenced Signature belongs to a different Program or project.'
			);
			return false;
		}
		return true;
	}

	function typeParameterRecordReference(
		typeParameterId: string,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		if (!referenceCheck()) return false;
		const parameter = typeParameterById.get(typeParameterId as never);
		if (
			parameter === undefined ||
			parameter.programId !== programId ||
			parameter.projectId !== projectId
		) {
			issue(
				parameter === undefined ? 'DANGLING_REFERENCE' : 'CROSS_PROJECT_REFERENCE',
				jsonPath,
				parameter === undefined
					? 'Referenced type parameter is absent.'
					: 'Referenced type parameter belongs to a different Program or project.'
			);
			return false;
		}
		return true;
	}

	function typeParameterOwnerReference(
		owner: SemanticTypeParameterOwner,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		switch (owner.kind) {
			case 'TYPE':
				return typeRecordReference(owner.id, programId, projectId, `${jsonPath}.id`);
			case 'SIGNATURE':
				return signatureRecordReference(owner.id, programId, projectId, `${jsonPath}.id`);
			case 'DECLARATION':
				return declarationProgramReference(owner.id, programId, projectId, `${jsonPath}.id`);
		}
	}

	function signatureOwnerReference(
		owner: SemanticSignatureOwner,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		switch (owner.kind) {
			case 'TYPE':
				return typeRecordReference(owner.id, programId, projectId, `${jsonPath}.id`);
			case 'SYMBOL':
				return symbolProgramReference(owner.id, programId, projectId, `${jsonPath}.id`);
			case 'DECLARATION':
				return declarationProgramReference(owner.id, programId, projectId, `${jsonPath}.id`);
		}
	}

	function typeOrSignatureReference(
		ref: SemanticTypeOrSignatureRef,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		return ref.kind === 'TYPE'
			? typeRecordReference(ref.id, programId, projectId, `${jsonPath}.id`)
			: signatureRecordReference(ref.id, programId, projectId, `${jsonPath}.id`);
	}

	function typeSubjectReference(
		ref: SemanticTypeSubjectRef,
		programId: string,
		projectId: string,
		jsonPath: string
	): boolean {
		switch (ref.kind) {
			case 'AST_NODE':
				return nodeProgramReference(ref.id, programId, projectId, `${jsonPath}.id`);
			case 'DECLARATION':
				return declarationProgramReference(ref.id, programId, projectId, `${jsonPath}.id`);
			case 'SYMBOL':
				return symbolProgramReference(ref.id, programId, projectId, `${jsonPath}.id`);
		}
	}

	function publicFlagNames(flags: number, values: object): string[] {
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
	}

	function expectedTypeCategory(
		flags: number
	): StaticSemanticSnapshot['types'][number]['category'] {
		if ((flags & ts.TypeFlags.Literal) !== 0) return 'LITERAL';
		if ((flags & ts.TypeFlags.Union) !== 0) return 'UNION';
		if ((flags & ts.TypeFlags.Intersection) !== 0) return 'INTERSECTION';
		if ((flags & ts.TypeFlags.TypeParameter) !== 0) return 'TYPE_PARAMETER';
		if ((flags & ts.TypeFlags.Object) !== 0) return 'OBJECT';
		if ((flags & ts.TypeFlags.Index) !== 0) return 'INDEX';
		if (
			(flags &
				(ts.TypeFlags.Any |
					ts.TypeFlags.Unknown |
					ts.TypeFlags.String |
					ts.TypeFlags.Number |
					ts.TypeFlags.Boolean |
					ts.TypeFlags.ESSymbol |
					ts.TypeFlags.BigInt |
					ts.TypeFlags.Void |
					ts.TypeFlags.Undefined |
					ts.TypeFlags.Null |
					ts.TypeFlags.Never |
					ts.TypeFlags.NonPrimitive)) !==
			0
		)
			return 'INTRINSIC';
		return 'OTHER';
	}

	function expectedUnsupportedTypeStructures(flags: number, objectFlags: number | null): string[] {
		const unsupported = new Set<string>();
		if ((flags & ts.TypeFlags.Conditional) !== 0) unsupported.add('CONDITIONAL');
		if ((flags & ts.TypeFlags.IndexedAccess) !== 0) unsupported.add('INDEXED_ACCESS');
		if ((flags & ts.TypeFlags.Index) !== 0) unsupported.add('INDEX_TARGET');
		if ((flags & ts.TypeFlags.Substitution) !== 0) unsupported.add('SUBSTITUTION');
		if ((flags & ts.TypeFlags.TemplateLiteral) !== 0) unsupported.add('TEMPLATE_LITERAL');
		if ((flags & ts.TypeFlags.StringMapping) !== 0) unsupported.add('STRING_MAPPING');
		if (objectFlags !== null && (objectFlags & ts.ObjectFlags.Mapped) !== 0)
			unsupported.add('MAPPED');
		return [...unsupported].sort();
	}

	for (const [index, type] of snapshot.types.entries()) {
		const jsonPath = `$.types[${index}]`;
		programProjectReference(type.programId, type.projectId, jsonPath);
		compilerTypeProvenance(type.provenanceId, type.projectId, `${jsonPath}.provenanceId`);
		if (
			type.displayProfile !== SEMANTIC_TYPE_DISPLAY_PROFILE ||
			type.fingerprintProfile !== SEMANTIC_TYPE_FINGERPRINT_PROFILE ||
			!SHA256.test(type.displaySha256) ||
			!SHA256.test(type.fingerprintSha256) ||
			type.displaySha256 !== sha256(type.display) ||
			type.display.length === 0 ||
			!isUnicodeScalarString(type.display)
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Type display and fingerprint must use the frozen profiles, scalar representation, and exact SHA-256 digests.'
			);
		if (
			!Number.isSafeInteger(type.flags) ||
			type.flags < 0 ||
			(type.objectFlags !== null &&
				(!Number.isSafeInteger(type.objectFlags) || type.objectFlags < 0)) ||
			!isCanonicalSet(type.flagNames) ||
			!isCanonicalSet(type.objectFlagNames) ||
			!isCanonicalSet(type.unsupportedStructureKinds) ||
			!sameMembers(type.flagNames, publicFlagNames(type.flags, ts.TypeFlags)) ||
			!sameMembers(
				type.objectFlagNames,
				type.objectFlags === null ? [] : publicFlagNames(type.objectFlags, ts.ObjectFlags)
			) ||
			((type.flags & ts.TypeFlags.Object) === 0) !== (type.objectFlags === null) ||
			type.category !== expectedTypeCategory(type.flags) ||
			!sameMembers(
				type.unsupportedStructureKinds,
				expectedUnsupportedTypeStructures(type.flags, type.objectFlags)
			) ||
			(type.structureState === 'COMPLETE') !== (type.unsupportedStructureKinds.length === 0)
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Type flags, category, object flags, unsupported structures, and structure state are incoherent.'
			);
		const anchorKeys = type.acquisitionAnchors.map((anchor) => canonicalSemanticJson(anchor));
		if (type.acquisitionAnchors.length === 0 || !isCanonicalSet(anchorKeys))
			issue(
				'NONCANONICAL_ORDER',
				`${jsonPath}.acquisitionAnchors`,
				'Type acquisition anchors must be a non-empty canonical set.'
			);
		for (const [anchorIndex, anchor] of type.acquisitionAnchors.entries()) {
			const anchorPath = `${jsonPath}.acquisitionAnchors[${anchorIndex}]`;
			switch (anchor.kind) {
				case 'NODE':
					nodeProgramReference(
						anchor.nodeId,
						type.programId,
						type.projectId,
						`${anchorPath}.nodeId`
					);
					if (!typeQueryModes.has(anchor.queryMode))
						issue('INVALID_VALUE', `${anchorPath}.queryMode`, 'Unknown type query mode.');
					break;
				case 'DECLARATION':
					declarationProgramReference(
						anchor.declarationId,
						type.programId,
						type.projectId,
						`${anchorPath}.declarationId`
					);
					if (!typeQueryModes.has(anchor.queryMode))
						issue('INVALID_VALUE', `${anchorPath}.queryMode`, 'Unknown type query mode.');
					break;
				case 'SYMBOL':
					symbolProgramReference(
						anchor.symbolId,
						type.programId,
						type.projectId,
						`${anchorPath}.symbolId`
					);
					if (!typeQueryModes.has(anchor.queryMode))
						issue('INVALID_VALUE', `${anchorPath}.queryMode`, 'Unknown type query mode.');
					break;
				case 'TYPE_COMPONENT':
					if (!Number.isSafeInteger(anchor.componentOrdinal) || anchor.componentOrdinal < 0)
						issue(
							'INVALID_VALUE',
							`${anchorPath}.componentOrdinal`,
							'Type-component ordinal is invalid.'
						);
					typeRecordReference(
						anchor.parentTypeId,
						type.programId,
						type.projectId,
						`${anchorPath}.parentTypeId`
					);
					break;
				case 'SIGNATURE_COMPONENT':
					if (!Number.isSafeInteger(anchor.componentOrdinal) || anchor.componentOrdinal < 0)
						issue(
							'INVALID_VALUE',
							`${anchorPath}.componentOrdinal`,
							'Signature-component ordinal is invalid.'
						);
					signatureRecordReference(
						anchor.signatureId,
						type.programId,
						type.projectId,
						`${anchorPath}.signatureId`
					);
					break;
			}
		}
		if (type.symbolId !== null)
			symbolProgramReference(type.symbolId, type.programId, type.projectId, `${jsonPath}.symbolId`);
		if (type.aliasSymbolId !== null)
			symbolProgramReference(
				type.aliasSymbolId,
				type.programId,
				type.projectId,
				`${jsonPath}.aliasSymbolId`
			);
		const expectedIdentityBasis =
			type.symbolId !== null ||
			type.aliasSymbolId !== null ||
			type.acquisitionAnchors.some((anchor) => anchor.kind === 'DECLARATION')
				? 'DECLARATION_ANCHORED'
				: type.acquisitionAnchors.some(
							(anchor) => anchor.kind === 'NODE' || anchor.kind === 'SYMBOL'
					  )
					? 'QUERY_ANCHORED'
					: 'STRUCTURAL';
		if (type.identityBasis !== expectedIdentityBasis)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.identityBasis`,
				'Type identity basis does not match its declaration and acquisition evidence.'
			);
		const expectedId = semanticTypeId({
			fingerprintProfile: type.fingerprintProfile,
			fingerprintSha256: type.fingerprintSha256,
			identityBasis: type.identityBasis,
			programId: type.programId
		});
		if (type.id !== expectedId)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Type identity mismatch.');
	}

	const typeParameterOwnerOrdinalKeys = new Set<string>();
	for (const [index, parameter] of snapshot.typeParameters.entries()) {
		const jsonPath = `$.typeParameters[${index}]`;
		programProjectReference(parameter.programId, parameter.projectId, jsonPath);
		compilerTypeProvenance(parameter.provenanceId, parameter.projectId, `${jsonPath}.provenanceId`);
		if (
			!Number.isSafeInteger(parameter.ordinal) ||
			parameter.ordinal < 0 ||
			parameter.name.length === 0 ||
			!isUnicodeScalarString(parameter.name)
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Type parameter name and non-negative owner ordinal are invalid.'
			);
		typeParameterOwnerReference(
			parameter.owner,
			parameter.programId,
			parameter.projectId,
			`${jsonPath}.owner`
		);
		const ownerOrdinalKey = `${canonicalSemanticJson(parameter.owner)}\0${String(parameter.ordinal)}`;
		if (typeParameterOwnerOrdinalKeys.has(ownerOrdinalKey))
			issue(
				'DUPLICATE_ID',
				jsonPath,
				'A type-parameter owner may contain at most one parameter at each ordinal.'
			);
		typeParameterOwnerOrdinalKeys.add(ownerOrdinalKey);
		if (parameter.declarationId !== null)
			declarationProgramReference(
				parameter.declarationId,
				parameter.programId,
				parameter.projectId,
				`${jsonPath}.declarationId`
			);
		if (parameter.owner.kind === 'DECLARATION') {
			const ownerDeclaration = declarationById.get(parameter.owner.id);
			const parameterDeclaration =
				parameter.declarationId === null ? undefined : declarationById.get(parameter.declarationId);
			if (parameter.declarationId === null)
				issue(
					'INVALID_VALUE',
					`${jsonPath}.declarationId`,
					'Declaration-owned type parameter must identify its distinct TypeParameterDeclaration.'
				);
			else if (parameter.declarationId === parameter.owner.id)
				issue(
					'INVALID_VALUE',
					`${jsonPath}.declarationId`,
					'Type-parameter declaration must be distinct from its enclosing generic declaration owner.'
				);
			else if (
				ownerDeclaration !== undefined &&
				parameterDeclaration !== undefined &&
				parameterDeclaration.sourceId !== ownerDeclaration.sourceId
			)
				issue(
					'CROSS_PROJECT_REFERENCE',
					`${jsonPath}.declarationId`,
					'Type-parameter declaration and its generic declaration owner must belong to the same source.'
				);
			else if (
				ownerDeclaration !== undefined &&
				parameterDeclaration !== undefined &&
				(parameterDeclaration.start < ownerDeclaration.start ||
					parameterDeclaration.end > ownerDeclaration.end)
			)
				issue(
					'INVALID_VALUE',
					`${jsonPath}.declarationId`,
					'Type-parameter declaration span must be contained by its enclosing generic declaration owner.'
				);
		}
		typeRecordReference(
			parameter.parameterTypeId,
			parameter.programId,
			parameter.projectId,
			`${jsonPath}.parameterTypeId`
		);
		if (
			parameter.owner.kind === 'SIGNATURE' &&
			!typeById
				.get(parameter.parameterTypeId)
				?.acquisitionAnchors.some(
					(anchor) =>
						anchor.kind === 'SIGNATURE_COMPONENT' &&
						anchor.signatureId === parameter.owner.id &&
						anchor.componentKind === 'TYPE_PARAMETER' &&
						anchor.componentOrdinal === parameter.ordinal
				)
		)
			issue(
				'DANGLING_REFERENCE',
				`${jsonPath}.parameterTypeId`,
				'Signature type parameter must retain its exact Signature-component acquisition anchor.'
			);
		for (const [stateName, typeIdName] of [
			['constraintState', 'constraintTypeId'],
			['defaultState', 'defaultTypeId']
		] as const) {
			const state = parameter[stateName];
			const referencedTypeId = parameter[typeIdName];
			if ((state === 'RESOLVED') !== (referencedTypeId !== null))
				issue(
					'INVALID_VALUE',
					`${jsonPath}.${stateName}`,
					'Only RESOLVED type-parameter state may carry a resolved type identity.'
				);
			if (referencedTypeId !== null)
				typeRecordReference(
					referencedTypeId,
					parameter.programId,
					parameter.projectId,
					`${jsonPath}.${typeIdName}`
				);
			if (
				referencedTypeId !== null &&
				!typeById
					.get(referencedTypeId)
					?.acquisitionAnchors.some(
						(anchor) =>
							anchor.kind === 'TYPE_COMPONENT' &&
							anchor.parentTypeId === parameter.parameterTypeId &&
							anchor.componentKind ===
								(stateName === 'constraintState' ? 'GENERIC_TARGET' : 'TYPE_ARGUMENT') &&
							anchor.componentOrdinal === 0
					)
			)
				issue(
					'DANGLING_REFERENCE',
					`${jsonPath}.${typeIdName}`,
					'Resolved constraint or default type must retain its exact type-component acquisition anchor.'
				);
		}
		const expectedId = semanticTypeParameterId({
			declarationId: parameter.declarationId,
			ordinal: parameter.ordinal,
			owner: parameter.owner
		});
		if (parameter.id !== expectedId)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Type-parameter identity mismatch.');
	}

	for (const [index, signature] of snapshot.signatures.entries()) {
		const jsonPath = `$.signatures[${index}]`;
		programProjectReference(signature.programId, signature.projectId, jsonPath);
		compilerTypeProvenance(signature.provenanceId, signature.projectId, `${jsonPath}.provenanceId`);
		if (
			signature.fingerprintProfile !== SEMANTIC_SIGNATURE_FINGERPRINT_PROFILE ||
			!SHA256.test(signature.displaySha256) ||
			!SHA256.test(signature.fingerprintSha256) ||
			signature.displaySha256 !== sha256(signature.display) ||
			signature.display.length === 0 ||
			!isUnicodeScalarString(signature.display)
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Signature display and fingerprint must use the frozen profile, scalar representation, and exact SHA-256 digests.'
			);
		signatureOwnerReference(
			signature.owner,
			signature.programId,
			signature.projectId,
			`${jsonPath}.owner`
		);
		if (signature.declarationId !== null)
			declarationProgramReference(
				signature.declarationId,
				signature.programId,
				signature.projectId,
				`${jsonPath}.declarationId`
			);
		if (
			(signature.identityBasis === 'DECLARATION_ANCHORED' && signature.declarationId === null) ||
			(signature.identityBasis === 'OWNER_ORDINAL' &&
				(signature.providerOrdinal === null ||
					!Number.isSafeInteger(signature.providerOrdinal) ||
					signature.providerOrdinal < 0)) ||
			(signature.providerOrdinal !== null &&
				(!Number.isSafeInteger(signature.providerOrdinal) || signature.providerOrdinal < 0))
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Signature identity basis, declaration, and provider ordinal are incoherent.'
			);
		if (
			(signature.owner.kind === 'DECLARATION' && signature.declarationId !== signature.owner.id) ||
			(signature.owner.kind === 'SYMBOL' &&
				signature.declarationId !== null &&
				declarationById.get(signature.declarationId)?.symbolId !== signature.owner.id)
		)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`${jsonPath}.owner`,
				'Signature declaration and owner do not identify the same callable.'
			);
		if (
			(signature.declarationRole === 'CONSTRUCT_SIGNATURE' &&
				signature.signatureKind !== 'CONSTRUCT') ||
			(signature.declarationRole === 'CALL_SIGNATURE' && signature.signatureKind !== 'CALL') ||
			(signature.semanticKind === 'OVERLOAD_SIGNATURE' &&
				![
					'OVERLOAD_DECLARATION',
					'AMBIENT_OVERLOAD',
					'CALL_SIGNATURE',
					'CONSTRUCT_SIGNATURE'
				].includes(signature.declarationRole)) ||
			(['OVERLOAD_DECLARATION', 'AMBIENT_OVERLOAD'].includes(signature.declarationRole) &&
				signature.semanticKind !== 'OVERLOAD_SIGNATURE') ||
			(signature.semanticKind === 'IMPLEMENTATION_SIGNATURE' &&
				signature.declarationRole !== 'DECLARATION')
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Signature kind, semantic kind, and declaration role are incoherent.'
			);
		typeRecordReference(
			signature.returnTypeId,
			signature.programId,
			signature.projectId,
			`${jsonPath}.returnTypeId`
		);
		if (
			!typeById
				.get(signature.returnTypeId)
				?.acquisitionAnchors.some(
					(anchor) =>
						anchor.kind === 'SIGNATURE_COMPONENT' &&
						anchor.signatureId === signature.id &&
						anchor.componentKind === 'RETURN' &&
						anchor.componentOrdinal === 0
				)
		)
			issue(
				'DANGLING_REFERENCE',
				`${jsonPath}.returnTypeId`,
				'Signature return type must retain its exact Signature-component acquisition anchor.'
			);
		const expectedParameters = snapshot.signatureParameters
			.filter((parameter) => parameter.signatureId === signature.id)
			.sort(
				(left, right) =>
					(left.role === right.role ? 0 : left.role === 'THIS' ? -1 : 1) ||
					left.ordinal - right.ordinal
			)
			.map((parameter) => parameter.id);
		const expectedTypeParameters = snapshot.typeParameters
			.filter(
				(parameter) => parameter.owner.kind === 'SIGNATURE' && parameter.owner.id === signature.id
			)
			.sort((left, right) => left.ordinal - right.ordinal)
			.map((parameter) => parameter.id);
		if (
			new Set(signature.parameterIds).size !== signature.parameterIds.length ||
			canonicalSemanticJson(signature.parameterIds) !== canonicalSemanticJson(expectedParameters)
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.parameterIds`,
				'Signature parameter membership must be complete, unique, and ordered as THIS then PARAMETER ordinal.'
			);
		if (
			new Set(signature.typeParameterIds).size !== signature.typeParameterIds.length ||
			canonicalSemanticJson(signature.typeParameterIds) !==
				canonicalSemanticJson(expectedTypeParameters)
		)
			issue(
				'INVALID_VALUE',
				`${jsonPath}.typeParameterIds`,
				'Signature type-parameter membership must be complete, unique, and ordered by ordinal.'
			);
		for (const parameterId of signature.parameterIds)
			if (!signatureParameterById.has(parameterId))
				issue(
					'DANGLING_REFERENCE',
					`${jsonPath}.parameterIds`,
					'Signature references an absent parameter.'
				);
		for (const parameterId of signature.typeParameterIds)
			typeParameterRecordReference(
				parameterId,
				signature.programId,
				signature.projectId,
				`${jsonPath}.typeParameterIds`
			);
		const expectedId =
			signature.identityBasis === 'DECLARATION_ANCHORED' && signature.declarationId !== null
				? semanticSignatureId({
						declarationId: signature.declarationId,
						identityBasis: 'DECLARATION_ANCHORED',
						programId: signature.programId,
						semanticKind: signature.semanticKind,
						signatureKind: signature.signatureKind
					})
				: signature.providerOrdinal === null
					? null
					: semanticSignatureId({
							fingerprintProfile: signature.fingerprintProfile,
							fingerprintSha256: signature.fingerprintSha256,
							identityBasis: 'OWNER_ORDINAL',
							owner: signature.owner,
							programId: signature.programId,
							providerOrdinal: signature.providerOrdinal,
							semanticKind: signature.semanticKind,
							signatureKind: signature.signatureKind
						});
		if (expectedId === null || signature.id !== expectedId)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Signature identity mismatch.');
	}

	const signatureParameterKeys = new Set<string>();
	for (const [index, parameter] of snapshot.signatureParameters.entries()) {
		const jsonPath = `$.signatureParameters[${index}]`;
		const signature = signatureById.get(parameter.signatureId);
		if (signature === undefined) {
			issue(
				'DANGLING_REFERENCE',
				`${jsonPath}.signatureId`,
				'Signature parameter references an absent Signature.'
			);
			continue;
		}
		compilerTypeProvenance(parameter.provenanceId, signature.projectId, `${jsonPath}.provenanceId`);
		if (
			!Number.isSafeInteger(parameter.ordinal) ||
			parameter.ordinal < 0 ||
			parameter.name.length === 0 ||
			!isUnicodeScalarString(parameter.name) ||
			(parameter.role === 'THIS' && (parameter.optional || parameter.rest))
		)
			issue(
				'INVALID_VALUE',
				jsonPath,
				'Signature parameter name, ordinal, or THIS-parameter modifiers are incoherent.'
			);
		const parameterKey = `${parameter.signatureId}\0${parameter.role}\0${String(parameter.ordinal)}`;
		if (signatureParameterKeys.has(parameterKey))
			issue(
				'DUPLICATE_ID',
				jsonPath,
				'A Signature may contain at most one parameter per role and ordinal.'
			);
		signatureParameterKeys.add(parameterKey);
		if (parameter.role === 'THIS' && parameter.ordinal !== 0)
			issue('INVALID_VALUE', `${jsonPath}.ordinal`, 'THIS parameter ordinal must be zero.');
		if (parameter.declarationId !== null)
			declarationProgramReference(
				parameter.declarationId,
				signature.programId,
				signature.projectId,
				`${jsonPath}.declarationId`
			);
		if (parameter.symbolId !== null)
			symbolProgramReference(
				parameter.symbolId,
				signature.programId,
				signature.projectId,
				`${jsonPath}.symbolId`
			);
		typeRecordReference(
			parameter.typeId,
			signature.programId,
			signature.projectId,
			`${jsonPath}.typeId`
		);
		if (
			!typeById
				.get(parameter.typeId)
				?.acquisitionAnchors.some(
					(anchor) =>
						anchor.kind === 'SIGNATURE_COMPONENT' &&
						anchor.signatureId === parameter.signatureId &&
						anchor.componentKind === parameter.role &&
						anchor.componentOrdinal === parameter.ordinal
				)
		)
			issue(
				'DANGLING_REFERENCE',
				`${jsonPath}.typeId`,
				'Signature parameter type must retain its exact Signature-component acquisition anchor.'
			);
		const expectedId = semanticSignatureParameterId({
			ordinal: parameter.ordinal,
			role: parameter.role,
			signatureId: parameter.signatureId
		});
		if (parameter.id !== expectedId)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Signature-parameter identity mismatch.');
	}

	for (const [index, overloadSet] of snapshot.overloadSets.entries()) {
		const jsonPath = `$.overloadSets[${index}]`;
		programProjectReference(overloadSet.programId, overloadSet.projectId, jsonPath);
		symbolProgramReference(
			overloadSet.callableSymbolId,
			overloadSet.programId,
			overloadSet.projectId,
			`${jsonPath}.callableSymbolId`
		);
		compilerTypeProvenance(
			overloadSet.provenanceId,
			overloadSet.projectId,
			`${jsonPath}.provenanceId`
		);
		const expectedId = semanticOverloadSetId({
			callableSymbolId: overloadSet.callableSymbolId,
			programId: overloadSet.programId
		});
		if (overloadSet.id !== expectedId)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Overload-set identity mismatch.');
	}

	const constraintRelationsByParameter = new Map<
		string,
		Extract<StaticSemanticSnapshot['typeRelations'][number], { kind: 'PARAMETER_CONSTRAINT' }>[]
	>();
	const membershipsByOverloadSet = new Map<
		string,
		Extract<StaticSemanticSnapshot['typeRelations'][number], { kind: 'OVERLOAD_MEMBERSHIP' }>[]
	>();
	const constituentRelationsByComposite = new Map<
		string,
		Extract<
			StaticSemanticSnapshot['typeRelations'][number],
			{ kind: 'INTERSECTION_CONSTITUENT' | 'UNION_CONSTITUENT' }
		>[]
	>();
	const assignabilityRelationsByProgramRequest = new Map<
		string,
		Extract<StaticSemanticSnapshot['typeRelations'][number], { kind: 'ASSIGNABILITY' }>[]
	>();

	function selectorOccurrenceId(
		selector: StaticSemanticSnapshot['assignabilityRequests'][number]['source'],
		programId: string,
		projectId: string
	): StaticSemanticSnapshot['astNodes'][number]['id'] | null {
		const source = sourceByProjectPath.get(`${projectId}\0${selector.logicalPath}`);
		if (source === undefined || source.programId !== programId) return null;
		return (
			snapshot.astNodes.find(
				(node) =>
					node.sourceId === source.id &&
					node.start === selector.start &&
					node.end === selector.end &&
					node.kind === selector.syntaxKind
			)?.id ?? null
		);
	}
	for (const [index, relation] of snapshot.typeRelations.entries()) {
		const jsonPath = `$.typeRelations[${index}]`;
		programProjectReference(relation.programId, relation.projectId, jsonPath);
		compilerTypeProvenance(relation.provenanceId, relation.projectId, `${jsonPath}.provenanceId`);
		const { id: _id, provenanceId: _provenanceId, ...identityPreimage } = relation;
		if (
			relation.id !==
			semanticTypeRelationId(identityPreimage as Parameters<typeof semanticTypeRelationId>[0])
		)
			issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Type-relation identity mismatch.');
		switch (relation.kind) {
			case 'TYPE_OF': {
				typeSubjectReference(
					relation.subject,
					relation.programId,
					relation.projectId,
					`${jsonPath}.subject`
				);
				if (!typeQueryModes.has(relation.queryMode))
					issue('INVALID_VALUE', `${jsonPath}.queryMode`, 'Unknown type query mode.');
				if ((relation.state === 'CONFIRMED') !== (relation.typeId !== null))
					issue('INVALID_VALUE', jsonPath, 'TYPE_OF state and resolved type identity disagree.');
				if (relation.typeId !== null) {
					typeRecordReference(
						relation.typeId,
						relation.programId,
						relation.projectId,
						`${jsonPath}.typeId`
					);
					const type = typeById.get(relation.typeId);
					const anchored = type?.acquisitionAnchors.some((anchor) => {
						if (relation.subject.kind === 'AST_NODE')
							return (
								anchor.kind === 'NODE' &&
								anchor.nodeId === relation.subject.id &&
								anchor.queryMode === relation.queryMode
							);
						if (relation.subject.kind === 'DECLARATION')
							return (
								anchor.kind === 'DECLARATION' &&
								anchor.declarationId === relation.subject.id &&
								anchor.queryMode === relation.queryMode
							);
						return (
							anchor.kind === 'SYMBOL' &&
							anchor.symbolId === relation.subject.id &&
							anchor.queryMode === relation.queryMode
						);
					});
					if (!anchored)
						issue(
							'DANGLING_REFERENCE',
							`${jsonPath}.typeId`,
							'Confirmed TYPE_OF result must be retained as a matching type acquisition anchor.'
						);
				}
				break;
			}
			case 'TYPE_ALIAS':
				declarationProgramReference(
					relation.aliasDeclarationId,
					relation.programId,
					relation.projectId,
					`${jsonPath}.aliasDeclarationId`
				);
				if ((relation.state === 'CONFIRMED') !== (relation.aliasedTypeId !== null))
					issue('INVALID_VALUE', jsonPath, 'TYPE_ALIAS state and resolved type identity disagree.');
				if (relation.aliasedTypeId !== null)
					typeRecordReference(
						relation.aliasedTypeId,
						relation.programId,
						relation.projectId,
						`${jsonPath}.aliasedTypeId`
					);
				break;
			case 'UNION_CONSTITUENT':
			case 'INTERSECTION_CONSTITUENT': {
				if (
					relation.state !== 'CONFIRMED' ||
					!Number.isSafeInteger(relation.ordinal) ||
					relation.ordinal < 0
				)
					issue(
						'INVALID_VALUE',
						jsonPath,
						'Constituent relations must be confirmed with a non-negative ordinal.'
					);
				typeRecordReference(
					relation.compositeTypeId,
					relation.programId,
					relation.projectId,
					`${jsonPath}.compositeTypeId`
				);
				typeRecordReference(
					relation.constituentTypeId,
					relation.programId,
					relation.projectId,
					`${jsonPath}.constituentTypeId`
				);
				const expectedCategory = relation.kind === 'UNION_CONSTITUENT' ? 'UNION' : 'INTERSECTION';
				if (typeById.get(relation.compositeTypeId)?.category !== expectedCategory)
					issue(
						'INVALID_VALUE',
						`${jsonPath}.compositeTypeId`,
						'Constituent relation kind does not match the composite type category.'
					);
				const constituent = typeById.get(relation.constituentTypeId);
				if (
					!constituent?.acquisitionAnchors.some(
						(anchor) =>
							anchor.kind === 'TYPE_COMPONENT' &&
							anchor.parentTypeId === relation.compositeTypeId &&
							anchor.componentKind ===
								(relation.kind === 'UNION_CONSTITUENT' ? 'UNION' : 'INTERSECTION') &&
							anchor.componentOrdinal === relation.ordinal
					)
				)
					issue(
						'DANGLING_REFERENCE',
						`${jsonPath}.constituentTypeId`,
						'Constituent relation must be mirrored by its exact type-component acquisition anchor.'
					);
				appendGrouped(
					constituentRelationsByComposite,
					`${relation.kind}\0${relation.compositeTypeId}`,
					relation
				);
				break;
			}
			case 'GENERIC_INSTANTIATION':
				if (relation.state !== 'CONFIRMED')
					issue(
						'INVALID_VALUE',
						`${jsonPath}.state`,
						'Generic-instantiation relations must be confirmed.'
					);
				typeOrSignatureReference(
					relation.genericTarget,
					relation.programId,
					relation.projectId,
					`${jsonPath}.genericTarget`
				);
				typeOrSignatureReference(
					relation.instantiatedTarget,
					relation.programId,
					relation.projectId,
					`${jsonPath}.instantiatedTarget`
				);
				for (const argumentTypeId of relation.argumentTypeIds)
					typeRecordReference(
						argumentTypeId,
						relation.programId,
						relation.projectId,
						`${jsonPath}.argumentTypeIds`
					);
				if (relation.instantiatedTarget.kind === 'TYPE' && relation.genericTarget.kind === 'TYPE') {
					const instantiatedTypeId = relation.instantiatedTarget.id;
					if (
						!typeById
							.get(relation.genericTarget.id)
							?.acquisitionAnchors.some(
								(anchor) =>
									anchor.kind === 'TYPE_COMPONENT' &&
									anchor.parentTypeId === instantiatedTypeId &&
									anchor.componentKind === 'GENERIC_TARGET' &&
									anchor.componentOrdinal === 0
							)
					)
						issue(
							'DANGLING_REFERENCE',
							`${jsonPath}.genericTarget`,
							'Generic target must retain its exact acquisition anchor from the instantiated type.'
						);
					for (const [argumentIndex, argumentTypeId] of relation.argumentTypeIds.entries())
						if (
							!typeById
								.get(argumentTypeId)
								?.acquisitionAnchors.some(
									(anchor) =>
										anchor.kind === 'TYPE_COMPONENT' &&
										anchor.parentTypeId === instantiatedTypeId &&
										anchor.componentKind === 'TYPE_ARGUMENT' &&
										anchor.componentOrdinal === argumentIndex
								)
						)
							issue(
								'DANGLING_REFERENCE',
								`${jsonPath}.argumentTypeIds[${argumentIndex}]`,
								'Generic argument order must be mirrored by exact type-component acquisition anchors.'
							);
				}
				break;
			case 'PARAMETER_CONSTRAINT': {
				typeParameterRecordReference(
					relation.typeParameterId,
					relation.programId,
					relation.projectId,
					`${jsonPath}.typeParameterId`
				);
				const expectedState =
					relation.constraintState === 'UNRESOLVED'
						? 'UNRESOLVED'
						: relation.constraintState === 'UNSUPPORTED'
							? 'UNSUPPORTED'
							: 'CONFIRMED';
				const parameter = typeParameterById.get(relation.typeParameterId);
				if (
					relation.state !== expectedState ||
					(relation.constraintState === 'RESOLVED') !== (relation.constraintTypeId !== null) ||
					parameter?.constraintState !== relation.constraintState ||
					parameter?.constraintTypeId !== relation.constraintTypeId
				)
					issue(
						'INVALID_VALUE',
						jsonPath,
						'Constraint relation must exactly mirror its type-parameter constraint and epistemic state.'
					);
				if (relation.constraintTypeId !== null)
					typeRecordReference(
						relation.constraintTypeId,
						relation.programId,
						relation.projectId,
						`${jsonPath}.constraintTypeId`
					);
				appendGrouped(constraintRelationsByParameter, relation.typeParameterId, relation);
				break;
			}
			case 'TYPE_EXTENSION':
			case 'TYPE_IMPLEMENTATION':
				if (relation.state !== 'CONFIRMED')
					issue('INVALID_VALUE', `${jsonPath}.state`, 'Heritage type relations must be confirmed.');
				typeRecordReference(
					relation.baseTypeId,
					relation.programId,
					relation.projectId,
					`${jsonPath}.baseTypeId`
				);
				typeRecordReference(
					relation.derivedTypeId,
					relation.programId,
					relation.projectId,
					`${jsonPath}.derivedTypeId`
				);
				if (relation.heritageOccurrence.kind === 'AST_NODE')
					nodeProgramReference(
						relation.heritageOccurrence.id,
						relation.programId,
						relation.projectId,
						`${jsonPath}.heritageOccurrence.id`
					);
				else
					declarationProgramReference(
						relation.heritageOccurrence.id,
						relation.programId,
						relation.projectId,
						`${jsonPath}.heritageOccurrence.id`
					);
				break;
			case 'ASSIGNABILITY': {
				const request = snapshot.assignabilityRequests.find(
					(candidate) => candidate.requestId === relation.requestId
				);
				const program = programById.get(relation.programId);
				if (
					request === undefined ||
					program === undefined ||
					relation.checkerContextDigest !== program.contextDigest ||
					!SHA256.test(relation.checkerContextDigest)
				)
					issue(
						request === undefined ? 'DANGLING_REFERENCE' : 'IDENTITY_MISMATCH',
						jsonPath,
						'Assignability relation must bind a requested judgment and its exact Program checker context.'
					);
				if (
					relation.state === 'CONFIRMED'
						? relation.sourceTypeId === null ||
							relation.targetTypeId === null ||
							typeof relation.result !== 'boolean'
						: relation.result !== null ||
							(relation.sourceTypeId !== null && relation.targetTypeId !== null)
				)
					issue(
						'INVALID_VALUE',
						jsonPath,
						'Assignability state, endpoint resolution, and Boolean judgment are incoherent.'
					);
				if (relation.sourceTypeId !== null)
					typeRecordReference(
						relation.sourceTypeId,
						relation.programId,
						relation.projectId,
						`${jsonPath}.sourceTypeId`
					);
				if (relation.targetTypeId !== null)
					typeRecordReference(
						relation.targetTypeId,
						relation.programId,
						relation.projectId,
						`${jsonPath}.targetTypeId`
					);
				if (request !== undefined)
					for (const [selectorName, typeId] of [
						['source', relation.sourceTypeId],
						['target', relation.targetTypeId]
					] as const) {
						if (typeId === null) continue;
						const selector = request[selectorName];
						const nodeId = selectorOccurrenceId(selector, relation.programId, relation.projectId);
						if (
							nodeId === null ||
							!typeById
								.get(typeId)
								?.acquisitionAnchors.some(
									(anchor) =>
										anchor.kind === 'NODE' &&
										anchor.nodeId === nodeId &&
										anchor.queryMode === selector.queryMode
								)
						)
							issue(
								'DANGLING_REFERENCE',
								`${jsonPath}.${selectorName}TypeId`,
								'Resolved assignability endpoint must match its exact requested node and type acquisition anchor in the same Program.'
							);
					}
				appendGrouped(
					assignabilityRelationsByProgramRequest,
					`${relation.programId}\0${relation.requestId}`,
					relation
				);
				break;
			}
			case 'OVERLOAD_MEMBERSHIP': {
				if (
					relation.state !== 'CONFIRMED' ||
					!Number.isSafeInteger(relation.ordinal) ||
					relation.ordinal < 0
				)
					issue(
						'INVALID_VALUE',
						jsonPath,
						'Overload membership must be confirmed with a non-negative ordinal.'
					);
				const overloadSet = overloadSetById.get(relation.overloadSetId);
				if (
					overloadSet === undefined ||
					overloadSet.programId !== relation.programId ||
					overloadSet.projectId !== relation.projectId
				)
					issue(
						overloadSet === undefined ? 'DANGLING_REFERENCE' : 'CROSS_PROJECT_REFERENCE',
						`${jsonPath}.overloadSetId`,
						'Overload membership set is absent or belongs to another Program.'
					);
				signatureRecordReference(
					relation.signatureId,
					relation.programId,
					relation.projectId,
					`${jsonPath}.signatureId`
				);
				const signature = signatureById.get(relation.signatureId);
				const roleMatches =
					relation.role === 'IMPLEMENTATION_SIGNATURE'
						? signature?.semanticKind === 'IMPLEMENTATION_SIGNATURE'
						: relation.role === 'OVERLOAD_DECLARATION' || relation.role === 'AMBIENT_OVERLOAD'
							? signature?.semanticKind === 'OVERLOAD_SIGNATURE' &&
								signature.declarationRole === relation.role
							: signature?.semanticKind === 'OVERLOAD_SIGNATURE' &&
								signature.declarationRole === relation.role &&
								signature.signatureKind ===
									(relation.role === 'CALL_SIGNATURE' ? 'CALL' : 'CONSTRUCT');
				const callableOwnerSymbolIds = new Set<string>();
				if (signature?.owner.kind === 'SYMBOL') callableOwnerSymbolIds.add(signature.owner.id);
				else if (signature?.owner.kind === 'DECLARATION') {
					const symbolId = declarationById.get(signature.owner.id)?.symbolId;
					if (symbolId !== null && symbolId !== undefined) callableOwnerSymbolIds.add(symbolId);
				} else if (signature?.owner.kind === 'TYPE') {
					const ownerType = typeById.get(signature.owner.id);
					if (ownerType?.symbolId !== null && ownerType?.symbolId !== undefined)
						callableOwnerSymbolIds.add(ownerType.symbolId);
					if (ownerType?.aliasSymbolId !== null && ownerType?.aliasSymbolId !== undefined)
						callableOwnerSymbolIds.add(ownerType.aliasSymbolId);
				}
				if (
					!roleMatches ||
					(overloadSet !== undefined && !callableOwnerSymbolIds.has(overloadSet.callableSymbolId))
				)
					issue(
						'INVALID_VALUE',
						jsonPath,
						'Overload membership role and callable owner are incoherent with its Signature.'
					);
				appendGrouped(membershipsByOverloadSet, relation.overloadSetId, relation);
				break;
			}
		}
	}

	for (const parameter of snapshot.typeParameters) {
		const relations = constraintRelationsByParameter.get(parameter.id) ?? [];
		if (relations.length !== 1)
			issue(
				'POPULATION_MISMATCH',
				'$.typeRelations',
				`Type parameter ${parameter.id} must have exactly one matching constraint relation.`
			);
	}
	for (const overloadSet of snapshot.overloadSets) {
		const memberships = membershipsByOverloadSet.get(overloadSet.id) ?? [];
		const ordinals = memberships.map((membership) => membership.ordinal).sort((a, b) => a - b);
		if (
			memberships.length < 2 ||
			new Set(ordinals).size !== ordinals.length ||
			!ordinals.every((ordinal, index) => ordinal === index)
		)
			issue(
				'POPULATION_MISMATCH',
				'$.typeRelations',
				`Overload set ${overloadSet.id} must have at least two memberships with unique, contiguous ordinals.`
			);
		const membershipsBySignatureKind = new Map<
			StaticSemanticSnapshot['signatures'][number]['signatureKind'],
			{
				readonly declarationId: StaticSemanticSnapshot['signatures'][number]['declarationId'];
				readonly membership: (typeof memberships)[number];
			}[]
		>();
		for (const membership of memberships) {
			const signature = signatureById.get(membership.signatureId);
			if (signature === undefined) continue;
			appendGrouped(membershipsBySignatureKind, signature.signatureKind, {
				declarationId: signature.declarationId,
				membership
			});
			if (signature.declarationId === null)
				issue(
					'INVALID_VALUE',
					'$.typeRelations',
					`Overload membership ${membership.id} must retain a non-null Signature declaration.`
				);
		}
		for (const [signatureKind, kindMemberships] of membershipsBySignatureKind) {
			if (kindMemberships.length < 2)
				issue(
					'POPULATION_MISMATCH',
					'$.typeRelations',
					`Overload set ${overloadSet.id} Signature kind ${signatureKind} must have at least two memberships.`
				);
			const declarationIds = kindMemberships.flatMap(({ declarationId }) =>
				declarationId === null ? [] : [declarationId]
			);
			if (new Set(declarationIds).size !== declarationIds.length)
				issue(
					'DUPLICATE_ID',
					'$.typeRelations',
					`Overload set ${overloadSet.id} Signature kind ${signatureKind} must use distinct declaration identities.`
				);
		}
	}
	const overloadMembershipsBySignature = new Map<string, number>();
	for (const memberships of membershipsByOverloadSet.values())
		for (const membership of memberships)
			overloadMembershipsBySignature.set(
				membership.signatureId,
				(overloadMembershipsBySignature.get(membership.signatureId) ?? 0) + 1
			);
	for (const signature of snapshot.signatures) {
		const count = overloadMembershipsBySignature.get(signature.id) ?? 0;
		if (
			(signature.semanticKind === 'OVERLOAD_SIGNATURE' ||
				signature.semanticKind === 'IMPLEMENTATION_SIGNATURE') &&
			count !== 1
		)
			issue(
				'POPULATION_MISMATCH',
				'$.typeRelations',
				`Overload or implementation Signature ${signature.id} must belong to exactly one overload set.`
			);
		if (signature.semanticKind === 'SIGNATURE' && count !== 0)
			issue(
				'INVALID_VALUE',
				'$.typeRelations',
				`Non-overload Signature ${signature.id} cannot be a member of an overload set.`
			);
		if (count > 1)
			issue(
				'DUPLICATE_ID',
				'$.typeRelations',
				`Signature ${signature.id} may not be duplicated across overload memberships.`
			);
	}
	for (const [key, constituents] of constituentRelationsByComposite) {
		const ordinals = constituents.map((constituent) => constituent.ordinal).sort((a, b) => a - b);
		if (
			constituents.length < 2 ||
			new Set(ordinals).size !== ordinals.length ||
			!ordinals.every((ordinal, index) => ordinal === index)
		)
			issue(
				'POPULATION_MISMATCH',
				'$.typeRelations',
				`Composite ${key} must have at least two unique, contiguous constituent relations.`
			);
	}
	for (const type of snapshot.types)
		if (
			(type.category === 'UNION' || type.category === 'INTERSECTION') &&
			!constituentRelationsByComposite.has(
				`${type.category === 'UNION' ? 'UNION_CONSTITUENT' : 'INTERSECTION_CONSTITUENT'}\0${type.id}`
			)
		)
			issue(
				'POPULATION_MISMATCH',
				'$.typeRelations',
				`Composite type ${type.id} lacks its constituent relation closure.`
			);
	for (const signature of snapshot.signatures) {
		const ordinaryOrdinals = snapshot.signatureParameters
			.filter(
				(parameter) => parameter.signatureId === signature.id && parameter.role === 'PARAMETER'
			)
			.map((parameter) => parameter.ordinal)
			.sort((a, b) => a - b);
		if (!ordinaryOrdinals.every((ordinal, index) => ordinal === index))
			issue(
				'INVALID_VALUE',
				'$.signatureParameters',
				`Signature ${signature.id} ordinary parameter ordinals must be contiguous from zero.`
			);
	}
	const typeParametersByOwner = new Map<
		string,
		StaticSemanticSnapshot['typeParameters'][number][]
	>();
	for (const parameter of snapshot.typeParameters)
		appendGrouped(typeParametersByOwner, canonicalSemanticJson(parameter.owner), parameter);
	for (const [owner, parameters] of typeParametersByOwner) {
		const ordinals = parameters.map((parameter) => parameter.ordinal).sort((a, b) => a - b);
		if (!ordinals.every((ordinal, index) => ordinal === index))
			issue(
				'INVALID_VALUE',
				'$.typeParameters',
				`Type-parameter owner ${owner} ordinals must be contiguous from zero.`
			);
	}
	for (const program of snapshot.programs)
		for (const request of snapshot.assignabilityRequests) {
			const relations =
				assignabilityRelationsByProgramRequest.get(`${program.id}\0${request.requestId}`) ?? [];
			if (typeRequested ? relations.length !== 1 : relations.length !== 0)
				issue(
					'POPULATION_MISMATCH',
					'$.typeRelations',
					`Assignability request ${request.requestId} must have exactly one judgment per requested Program.`
				);
		}
	if (
		assignabilityRelationsByProgramRequest.size !==
		(typeRequested ? snapshot.programs.length * snapshot.assignabilityRequests.length : 0)
	)
		issue(
			'POPULATION_MISMATCH',
			'$.typeRelations',
			'Assignability relations must equal the exact requested Program-by-request judgment matrix.'
		);

	for (const [index, diagnostic] of snapshot.diagnostics.entries()) {
		path(diagnostic.path, `$.diagnostics[${index}].path`);
		if (!projectById.has(diagnostic.projectId))
			issue(
				'DANGLING_REFERENCE',
				`$.diagnostics[${index}].projectId`,
				'Diagnostic project is absent.'
			);
		if (
			diagnostic.sourceId !== null &&
			sourceById.get(diagnostic.sourceId)?.projectId !== diagnostic.projectId
		)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`$.diagnostics[${index}].sourceId`,
				'Diagnostic source belongs elsewhere or is absent.'
			);
		const diagnosticSource =
			diagnostic.sourceId === null ? undefined : sourceById.get(diagnostic.sourceId);
		if (
			(diagnostic.start === null) !== (diagnostic.end === null) ||
			(diagnostic.start !== null &&
				diagnostic.end !== null &&
				(diagnostic.start > diagnostic.end ||
					(diagnosticSource !== undefined && diagnostic.end > diagnosticSource.textLength)))
		)
			issue('INVALID_VALUE', `$.diagnostics[${index}]`, 'Diagnostic UTF-16 span is invalid.');
		if (
			(diagnostic.locationKind === 'NONE' &&
				(diagnostic.sourceId !== null ||
					diagnostic.path !== null ||
					diagnostic.start !== null ||
					diagnostic.end !== null)) ||
			(diagnostic.locationKind === 'PATH' &&
				(diagnostic.sourceId !== null || diagnostic.path === null)) ||
			(diagnostic.locationKind === 'SOURCE' &&
				(diagnostic.sourceId === null || diagnostic.path === null))
		)
			issue(
				'INVALID_VALUE',
				`$.diagnostics[${index}].locationKind`,
				'Diagnostic location discriminator must exactly govern source, path, and span fields.'
			);
		if (
			diagnostic.locationKind === 'SOURCE' &&
			(diagnosticSource === undefined || diagnostic.path !== diagnosticSource.logicalPath)
		)
			issue(
				'CROSS_PROJECT_REFERENCE',
				`$.diagnostics[${index}].path`,
				'Source-bound diagnostic source and logical path disagree.'
			);
		if (!/^TS[1-9][0-9]*$/u.test(diagnostic.code))
			issue(
				'INVALID_VALUE',
				`$.diagnostics[${index}].code`,
				'Diagnostic code must be exactly TS followed by a positive decimal TypeScript code.'
			);
		diagnosticMessage(diagnostic.message, `$.diagnostics[${index}].message`);
		for (const [relatedIndex, related] of diagnostic.related.entries()) {
			path(related.path, `$.diagnostics[${index}].related[${relatedIndex}].path`);
			if (!/^TS[1-9][0-9]*$/u.test(related.code))
				issue(
					'INVALID_VALUE',
					`$.diagnostics[${index}].related[${relatedIndex}].code`,
					'Related diagnostic code must be exactly TS followed by a positive decimal TypeScript code.'
				);
			diagnosticMessage(
				related.message,
				`$.diagnostics[${index}].related[${relatedIndex}].message`
			);
			const relatedSource =
				related.path === null || !referenceCheck()
					? undefined
					: sourceByProjectPath.get(`${diagnostic.projectId}\0${related.path}`);
			if (related.path === null && related.start !== null)
				issue(
					'INVALID_VALUE',
					`$.diagnostics[${index}].related[${relatedIndex}]`,
					'A related diagnostic span requires a logical path.'
				);
			if (
				(related.start === null) !== (related.end === null) ||
				(related.start !== null &&
					related.end !== null &&
					(related.start > related.end ||
						(relatedSource !== undefined && related.end > relatedSource.textLength)))
			)
				issue(
					'INVALID_VALUE',
					`$.diagnostics[${index}].related[${relatedIndex}]`,
					'Related diagnostic span is invalid or outside its project source.'
				);
		}
		if (!Number.isSafeInteger(diagnostic.multiplicity) || diagnostic.multiplicity < 1)
			issue(
				'INVALID_VALUE',
				`$.diagnostics[${index}].multiplicity`,
				'Diagnostic multiplicity must be a positive safe integer.'
			);
		if (!isCanonicalMultiset(diagnostic.related.map((related) => canonicalSemanticJson(related))))
			issue(
				'NONCANONICAL_ORDER',
				`$.diagnostics[${index}].related`,
				'Related diagnostic payloads must form a canonical sorted multiset; duplicates are retained.'
			);
		const expected = semanticDiagnosticId({
			category: diagnostic.category,
			code: diagnostic.code,
			end: diagnostic.end,
			family: diagnostic.family,
			locationKind: diagnostic.locationKind,
			message: diagnostic.message,
			path: diagnostic.path,
			projectId: diagnostic.projectId,
			related: diagnostic.related,
			sourceId: diagnostic.sourceId,
			start: diagnostic.start
		});
		if (diagnostic.id !== expected)
			issue('IDENTITY_MISMATCH', `$.diagnostics[${index}].id`, 'Diagnostic identity mismatch.');
		provenance(
			diagnostic.provenanceId,
			diagnostic.projectId,
			'TS_PROJECT',
			`$.diagnostics[${index}].provenanceId`,
			diagnostic.locationKind === 'SOURCE' && diagnostic.start !== null
				? (diagnostic.sourceId ?? undefined)
				: undefined
		);
	}

	const compilerQueryKeys = new Set<string>();
	for (const [index, observation] of snapshot.compilerInputs.entries()) {
		path(observation.logicalPath, `$.compilerInputs[${index}].logicalPath`);
		if (!Number.isSafeInteger(observation.invocationCount) || observation.invocationCount < 1)
			issue(
				'INVALID_VALUE',
				`$.compilerInputs[${index}].invocationCount`,
				'Compiler input invocation count must be a positive safe integer.'
			);
		if (!SHA256.test(observation.resultDigest))
			issue(
				'INVALID_VALUE',
				`$.compilerInputs[${index}].resultDigest`,
				'Compiler input result digest is invalid.'
			);
		if (
			observation.operation === 'READ_FILE' &&
			observation.result === 'PRESENT' &&
			(!SHA256.test(observation.contentSha256) || observation.contentBytes < 0)
		)
			issue(
				'INVALID_VALUE',
				`$.compilerInputs[${index}]`,
				'Present READ_FILE result requires bounded content metadata.'
			);
		if (observation.operation === 'GET_DIRECTORIES' || observation.operation === 'READ_DIRECTORY') {
			for (const entry of observation.resultEntries)
				path(entry, `$.compilerInputs[${index}].resultEntries`);
			if (
				!isCanonicalSet(observation.resultEntries) ||
				(observation.result === 'NOT_DIRECTORY' && observation.resultEntries.length > 0)
			)
				issue(
					'INVALID_VALUE',
					`$.compilerInputs[${index}].resultEntries`,
					'Directory observations require canonical results and empty missing-directory results.'
				);
			if (observation.resultEntries.length > observation.scannedEntries)
				issue(
					'INVALID_VALUE',
					`$.compilerInputs[${index}].scannedEntries`,
					'Directory observation cannot retain more results than it scanned.'
				);
			if (observation.result === 'NOT_DIRECTORY' && observation.scannedEntries !== 0)
				issue(
					'INVALID_VALUE',
					`$.compilerInputs[${index}].scannedEntries`,
					'A missing directory must report zero scanned entries.'
				);
		}
		if (observation.operation === 'READ_DIRECTORY')
			for (const values of [observation.excludes, observation.extensions, observation.includes]) {
				if (!isCanonicalSet(values))
					issue(
						'NONCANONICAL_ORDER',
						`$.compilerInputs[${index}]`,
						'READ_DIRECTORY parameters must be canonical sets.'
					);
				if (values.some((entry) => entry.length > snapshot.budgets.maxPathCharacters))
					issue(
						'INVALID_VALUE',
						`$.compilerInputs[${index}]`,
						'READ_DIRECTORY path-like query parameters exceed the producing path-character budget.'
					);
			}
		if (
			(observation.operation === 'REALPATH' || observation.operation === 'CURRENT_DIRECTORY') &&
			observation.result === 'RESOLVED'
		)
			path(observation.resolvedLogicalPath, `$.compilerInputs[${index}].resolvedLogicalPath`);
		if (
			observation.operation === 'CURRENT_DIRECTORY' &&
			(observation.logicalPath !== '.' || observation.resolvedLogicalPath !== '.')
		)
			issue(
				'INVALID_VALUE',
				`$.compilerInputs[${index}]`,
				'CURRENT_DIRECTORY is fixed to the logical repository root.'
			);
		if (
			observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES' &&
			observation.logicalPath !== '.'
		)
			issue(
				'INVALID_VALUE',
				`$.compilerInputs[${index}].logicalPath`,
				'Case-sensitivity observation is rooted at the logical repository root.'
			);
		const { id: _resultId, resultDigest: _resultDigest, ...resultFields } = observation;
		if (observation.resultDigest !== compilerInputResultDigest(resultFields))
			issue(
				'IDENTITY_MISMATCH',
				`$.compilerInputs[${index}].resultDigest`,
				'Compiler input result digest does not bind its exact observed result.'
			);
		const { id: _id, ...identityFields } = observation;
		if (
			observation.id !==
			semanticContextInputId({ ...identityFields, subjectId: snapshot.subjectId })
		)
			issue(
				'IDENTITY_MISMATCH',
				`$.compilerInputs[${index}].id`,
				'Compiler input identity mismatch.'
			);
		const queryKey = compilerInputQueryKey(observation);
		if (compilerQueryKeys.has(queryKey))
			issue(
				'INVALID_VALUE',
				`$.compilerInputs[${index}]`,
				'A compiler query may have exactly one deterministic captured result.'
			);
		compilerQueryKeys.add(queryKey);
	}
	const filesystemClaims = new Map<
		string,
		{
			directoryAbsent: boolean;
			directoryPresent: boolean;
			fileAbsent: boolean;
			filePresent: boolean;
			realpathAbsent: boolean;
			realpathResolved: boolean;
		}
	>();
	for (const observation of snapshot.compilerInputs) {
		const claims = filesystemClaims.get(observation.logicalPath) ?? {
			directoryAbsent: false,
			directoryPresent: false,
			fileAbsent: false,
			filePresent: false,
			realpathAbsent: false,
			realpathResolved: false
		};
		if (observation.operation === 'READ_FILE' || observation.operation === 'FILE_EXISTS') {
			claims.filePresent ||= observation.result === 'PRESENT';
			claims.fileAbsent ||= observation.result === 'ABSENT';
		}
		if (
			observation.operation === 'DIRECTORY_EXISTS' ||
			observation.operation === 'GET_DIRECTORIES' ||
			observation.operation === 'READ_DIRECTORY'
		) {
			claims.directoryPresent ||= observation.result === 'DIRECTORY';
			claims.directoryAbsent ||= observation.result === 'NOT_DIRECTORY';
		}
		if (observation.operation === 'REALPATH') {
			claims.realpathAbsent ||= observation.result === 'ABSENT';
			claims.realpathResolved ||= observation.result === 'RESOLVED';
		}
		filesystemClaims.set(observation.logicalPath, claims);
	}
	for (const [logicalPath, claims] of filesystemClaims) {
		if (
			(claims.filePresent && claims.fileAbsent) ||
			(claims.directoryPresent && claims.directoryAbsent) ||
			(claims.filePresent && claims.directoryPresent) ||
			(claims.realpathAbsent && (claims.realpathResolved || claims.filePresent))
		)
			issue(
				'INVALID_VALUE',
				'$.compilerInputs',
				`Compiler filesystem observations disagree on the stable path kind or existence for ${logicalPath}.`
			);
	}
	const claimedContextIds = snapshot.projects.flatMap((project) => project.contextInputIds);
	if (!sameMembers(claimedContextIds, contextIds))
		issue(
			'DANGLING_REFERENCE',
			'$.compilerInputs',
			'Compiler-input closure must equal the exact union claimed by projects.'
		);

	function nodeReference(nodeId: string, sourceId: string, jsonPath: string): void {
		if (!referenceCheck()) return;
		const node = nodeById.get(nodeId as never);
		if (!node) issue('DANGLING_REFERENCE', jsonPath, 'Referenced node is absent.');
		else if (node.sourceId !== sourceId)
			issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Referenced node belongs elsewhere.');
	}

	for (const [index, literal] of snapshot.literals.entries()) {
		nodeReference(literal.nodeId, literal.sourceId, `$.literals[${index}].nodeId`);
		const literalNode = nodeById.get(literal.nodeId);
		const literalDescriptor =
			literalNode === undefined ? null : semanticLiteralDescriptor(literalNode.kind);
		const encodingMatchesNode =
			literalNode !== undefined &&
			(literal.valueEncoding === 'UTF16_CODE_UNITS_LE'
				? isUtf16CodeUnitLiteralKind(literalNode.kind)
				: literalDescriptor?.valueEncoding === literal.valueEncoding);
		if (
			literalNode !== undefined &&
			(literalDescriptor?.valueType !== literal.valueType ||
				!encodingMatchesNode ||
				(literal.valueState === 'EXACT' &&
					!literalValueMatchesNodeKind(
						literalNode.kind,
						literal.valueType,
						literal.valueEncoding,
						literal.value
					)))
		)
			issue(
				'INVALID_VALUE',
				`$.literals[${index}]`,
				'Literal type, encoding, and fixed value must agree with the retained literal AST node kind.'
			);
		if (!SHA256.test(literal.valueSha256) || !SHA256.test(literal.lexemeSha256))
			issue(
				'INVALID_VALUE',
				`$.literals[${index}]`,
				'Literal value and lexeme digests must be lowercase SHA-256.'
			);
		if (literalNode !== undefined && literal.lexemeLength !== literalNode.end - literalNode.start)
			issue(
				'INVALID_VALUE',
				`$.literals[${index}].lexemeLength`,
				'Literal lexeme length must bind the retained source span exactly.'
			);
		if (literal.valueState === 'EXACT') {
			const expectedLength = literalValueLength(literal.value);
			if (
				!exactLiteralValueType(literal.valueType, literal.value) ||
				literal.valueLength !== expectedLength ||
				literal.valueSha256 !==
					literalValueDigest(literal.valueEncoding, literal.valueType, literal.value) ||
				literal.valueLength > snapshot.budgets.maxLiteralCharacters
			)
				issue(
					'INVALID_VALUE',
					`$.literals[${index}]`,
					'Exact literal type, encoding, length, digest, or budget is incoherent.'
				);
		} else if (literal.valueEncoding === 'UTF16_CODE_UNITS_LE') {
			if (
				literal.value !== null ||
				literal.valueLength < 1 ||
				literalNode === undefined ||
				!isUtf16CodeUnitLiteralKind(literalNode.kind)
			)
				issue(
					'INVALID_VALUE',
					`$.literals[${index}]`,
					'UTF-16-code-unit literals must redact a non-scalar cooked string and retain its original code-unit length and digest.'
				);
		} else if (
			literal.value !== null ||
			literal.valueLength <= snapshot.budgets.maxLiteralCharacters ||
			['NULL', 'BOOLEAN'].includes(literal.valueType)
		) {
			issue(
				'INVALID_VALUE',
				`$.literals[${index}]`,
				'Ordinary digest-only literals must redact an over-limit textual value.'
			);
		}
	}
	for (const [index, invocation] of snapshot.invocations.entries()) {
		nodeReference(invocation.nodeId, invocation.sourceId, `$.invocations[${index}].nodeId`);
		nodeReference(
			invocation.calleeNodeId,
			invocation.sourceId,
			`$.invocations[${index}].calleeNodeId`
		);
		for (const argumentId of invocation.argumentNodeIds)
			nodeReference(argumentId, invocation.sourceId, `$.invocations[${index}].argumentNodeIds`);
		if (invocation.templateNodeId !== null)
			nodeReference(
				invocation.templateNodeId,
				invocation.sourceId,
				`$.invocations[${index}].templateNodeId`
			);
		const invocationNode = nodeById.get(invocation.nodeId);
		const invocationChildren = childrenByParent.get(invocation.nodeId) ?? [];
		const calleeChildren = invocationChildren.filter((node) =>
			node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationCallee)
		);
		const argumentChildren = invocationChildren
			.filter((node) => node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationArgument))
			.sort((left, right) => left.siblingOrdinal - right.siblingOrdinal);
		const templateChildren = invocationChildren.filter((node) =>
			node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationTemplate)
		);
		const expected = semanticInvocationSiteId({
			invocationKind: invocation.invocationKind,
			nodeId: invocation.nodeId
		});
		if (invocation.id !== expected)
			issue(
				'IDENTITY_MISMATCH',
				`$.invocations[${index}].id`,
				'Invocation-site identity mismatch.'
			);
		const expectedOptional =
			invocation.invocationKind === 'CALL' &&
			invocationNode !== undefined &&
			(invocationNode.publicFlags & ts.NodeFlags.OptionalChain) !== 0;
		const variantCoherent =
			invocation.invocationKind === 'CALL'
				? invocation.templateNodeId === null && invocation.optional === expectedOptional
				: invocation.invocationKind === 'NEW'
					? invocation.templateNodeId === null && invocation.optional === false
					: invocation.templateNodeId !== null &&
						invocation.optional === false &&
						invocation.argumentNodeIds.length === 0;
		if (
			semanticInvocationKind(invocationNode?.kind ?? -1) !== invocation.invocationKind ||
			!variantCoherent ||
			calleeChildren.length !== 1 ||
			calleeChildren[0]!.id !== invocation.calleeNodeId ||
			invocation.argumentNodeIds.length !== argumentChildren.length ||
			!invocation.argumentNodeIds.every(
				(id, argumentIndex) => id === argumentChildren[argumentIndex]!.id
			) ||
			templateChildren.length !== (invocation.invocationKind === 'TAGGED_TEMPLATE' ? 1 : 0) ||
			(invocation.invocationKind === 'TAGGED_TEMPLATE' &&
				templateChildren[0]!.id !== invocation.templateNodeId)
		)
			issue(
				'INVALID_VALUE',
				`$.invocations[${index}]`,
				'Invocation projection must reproduce its exact call, new, or tagged-template variant and absolute child order.'
			);
	}
	for (const [index, assignment] of snapshot.assignments.entries()) {
		nodeReference(assignment.nodeId, assignment.sourceId, `$.assignments[${index}].nodeId`);
		nodeReference(
			assignment.targetNodeId,
			assignment.sourceId,
			`$.assignments[${index}].targetNodeId`
		);
		if (assignment.valueNodeId !== null)
			nodeReference(
				assignment.valueNodeId,
				assignment.sourceId,
				`$.assignments[${index}].valueNodeId`
			);
		const assignmentNode = nodeById.get(assignment.nodeId);
		const assignmentChildren = childrenByParent.get(assignment.nodeId) ?? [];
		const targetChildren = assignmentChildren.filter((node) =>
			node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentTarget)
		);
		const valueChildren = assignmentChildren.filter((node) =>
			node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue)
		);
		const derivedAssignmentKind =
			assignmentNode === undefined ? null : semanticAssignmentKind(assignmentNode);
		const expectedOperatorKind =
			derivedAssignmentKind === 'INITIALIZER'
				? ts.SyntaxKind.EqualsToken
				: (assignmentNode?.operatorKind ?? null);
		const requiresValue =
			derivedAssignmentKind === 'BINARY' || derivedAssignmentKind === 'INITIALIZER';
		if (
			derivedAssignmentKind !== assignment.assignmentKind ||
			targetChildren.length !== 1 ||
			targetChildren[0]!.id !== assignment.targetNodeId ||
			valueChildren.length !== (requiresValue ? 1 : 0) ||
			(requiresValue
				? valueChildren[0]!.id !== assignment.valueNodeId
				: assignment.valueNodeId !== null) ||
			(assignment.valueNodeId !== null && assignment.targetNodeId === assignment.valueNodeId) ||
			expectedOperatorKind === null ||
			assignment.operatorKind !== expectedOperatorKind ||
			assignment.operatorName !== typescriptSyntaxKindName(expectedOperatorKind)
		)
			issue(
				'INVALID_VALUE',
				`$.assignments[${index}]`,
				'Assignment projection must reproduce its retained kind, operator, target, and value children.'
			);
	}
	const candidateNameParentIds = new Set(
		snapshot.astNodes
			.filter(
				(node) =>
					node.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName) &&
					node.parentId !== null
			)
			.map((node) => node.parentId)
	);
	const conditionallyNamedCandidateKinds = new Set<number>([
		ts.SyntaxKind.FunctionExpression,
		ts.SyntaxKind.ClassExpression,
		ts.SyntaxKind.ImportClause
	]);
	const expectedDeclarationCandidates = snapshot.astNodes
		.filter(
			(node) =>
				semanticDeclarationCandidateRole(node.kind) !== null &&
				(!conditionallyNamedCandidateKinds.has(node.kind) || candidateNameParentIds.has(node.id))
		)
		.map((node) => node.id);
	const expectedLiterals = snapshot.astNodes
		.filter((node) => isSemanticLiteralKind(node.kind))
		.map((node) => node.id);
	const expectedInvocations = snapshot.astNodes
		.filter((node) => semanticInvocationKind(node.kind) !== null)
		.map((node) => node.id);
	const expectedAssignments = snapshot.astNodes
		.filter((node) => semanticAssignmentKind(node) !== null)
		.map((node) => node.id);
	if (
		!sameMembers(
			snapshot.declarationCandidates.map((record) => record.nodeId),
			expectedDeclarationCandidates
		)
	)
		issue(
			'POPULATION_MISMATCH',
			'$.declarationCandidates',
			'Declaration-candidate projection must be total over the exact bounded retained-AST taxonomy.'
		);
	if (
		!sameMembers(
			snapshot.literals.map((record) => record.nodeId),
			expectedLiterals
		)
	)
		issue(
			'POPULATION_MISMATCH',
			'$.literals',
			'Literal projection must be total over the retained AST.'
		);
	if (
		!sameMembers(
			snapshot.invocations.map((record) => record.nodeId),
			expectedInvocations
		)
	)
		issue(
			'POPULATION_MISMATCH',
			'$.invocations',
			'Invocation projection must be total over call, new, and tagged-template nodes in the retained AST.'
		);
	if (
		!sameMembers(
			snapshot.assignments.map((record) => record.nodeId),
			expectedAssignments
		)
	)
		issue(
			'POPULATION_MISMATCH',
			'$.assignments',
			'Assignment projection must be total over the retained AST.'
		);
	for (const [index, assignment] of snapshot.assignments.entries()) {
		const node = nodeById.get(assignment.nodeId);
		if (node !== undefined && semanticAssignmentKind(node) !== assignment.assignmentKind)
			issue(
				'INVALID_VALUE',
				`$.assignments[${index}].assignmentKind`,
				'Assignment kind must be derived from its AST node.'
			);
	}

	const populationsByKind = new Map(snapshot.populations.map((record) => [record.kind, record]));
	const populationKinds = snapshot.populations.map((record) => record.kind);
	if (
		!sameMembers(populationKinds, POPULATIONS) ||
		new Set(populationKinds).size !== POPULATIONS.length ||
		!populationKinds.every((kind, index) => kind === POPULATIONS[index])
	)
		issue(
			'POPULATION_MISMATCH',
			'$.populations',
			'Every semantic population kind must be reconciled exactly once in registered order.'
		);
	for (const [index, population] of snapshot.populations.entries()) {
		for (const [partition, values] of Object.entries(population.members))
			if (!isCanonicalSet(values))
				issue(
					'NONCANONICAL_ORDER',
					`$.populations[${index}].members.${partition}`,
					'Population witness manifests must be canonical sets.'
				);
		const recomputed = semanticPopulation(
			population.kind,
			population.members,
			population.expectedZero
		);
		if (
			canonicalSemanticJson(population) !== canonicalSemanticJson(recomputed) ||
			!population.reconciles
		)
			issue(
				'POPULATION_MISMATCH',
				`$.populations[${index}]`,
				'Population counts and digests must be recomputed from retained partition witnesses.'
			);
	}

	function emitted(
		kind: SemanticPopulationKind,
		analyzed: readonly string[],
		contextOnly: readonly string[] = [],
		unsupported: readonly string[] = [],
		unknown: readonly string[] = []
	): void {
		const population = populationsByKind.get(kind);
		if (!population) return;
		if (
			!sameMembers(population.members.analyzed, analyzed) ||
			!sameMembers(population.members.contextOnly, contextOnly) ||
			!sameMembers(population.members.unsupported, unsupported) ||
			!sameMembers(population.members.unknown, unknown)
		) {
			issue(
				'POPULATION_MISMATCH',
				`$.populations.${kind}`,
				'Population emission manifests do not match serialized records.'
			);
		}
	}

	emitted('PROJECT', projectIds);
	emitted('PROGRAM', programIds);
	emitted(
		'SOURCE',
		snapshot.sources
			.filter((source) => source.analysisDisposition === 'DEEP_INDEXED')
			.map((source) => source.id),
		snapshot.sources
			.filter((source) => source.analysisDisposition === 'CONTEXT_ONLY')
			.map((source) => source.id)
	);
	emitted(
		'SCOPE',
		snapshot.scopes
			.filter(
				(scope) =>
					scope.sourceId === null ||
					sourceById.get(scope.sourceId)?.analysisDisposition === 'DEEP_INDEXED'
			)
			.map((scope) => scope.id),
		snapshot.scopes
			.filter(
				(scope) =>
					scope.sourceId !== null &&
					sourceById.get(scope.sourceId)?.analysisDisposition === 'CONTEXT_ONLY'
			)
			.map((scope) => scope.id)
	);
	emitted('AST_NODE', nodeIds);
	emitted('DECLARATION_CANDIDATE', declarationCandidateIds);
	emitted(
		'DECLARATION',
		snapshot.declarations.map((record) => record.id),
		[],
		snapshot.declarations
			.filter(
				(record) =>
					record.scopeLinkState === 'UNSUPPORTED' || record.symbolBindingState === 'UNSUPPORTED'
			)
			.map((record) => record.id)
	);
	emitted('SYMBOL', symbolIds);
	emitted(
		'ALIAS',
		aliasIds,
		[],
		snapshot.aliases.filter((record) => record.state === 'UNSUPPORTED').map((record) => record.id),
		snapshot.aliases
			.filter((record) => record.state === 'UNRESOLVED' || record.state === 'CIRCULAR')
			.map((record) => record.id)
	);
	emitted(
		'REFERENCE',
		snapshot.references.map((record) => record.id),
		[],
		snapshot.references
			.filter(
				(record) =>
					record.scopeLinkState === 'UNSUPPORTED' || record.resolutionState === 'UNSUPPORTED'
			)
			.map((record) => record.id),
		snapshot.references
			.filter(
				(record) =>
					record.resolutionState === 'UNRESOLVED' && record.scopeLinkState !== 'UNSUPPORTED'
			)
			.map((record) => record.id)
	);
	emitted(
		'MODULE_RESOLUTION',
		moduleResolutionIds,
		[],
		snapshot.moduleResolutions
			.filter((record) => record.resolutionState === 'UNSUPPORTED')
			.map((record) => record.id),
		snapshot.moduleResolutions
			.filter((record) => record.resolutionState === 'UNRESOLVED')
			.map((record) => record.id)
	);
	emitted(
		'MODULE_EXPORT',
		moduleExportIds,
		[],
		[],
		snapshot.moduleExports
			.filter((record) => record.state === 'UNRESOLVED')
			.map((record) => record.id)
	);
	emitted(
		'TYPE',
		typeIds,
		[],
		snapshot.types
			.filter((record) => record.structureState === 'BOUNDED')
			.map((record) => record.id)
	);
	emitted(
		'TYPE_PARAMETER',
		typeParameterIds,
		[],
		snapshot.typeParameters
			.filter(
				(record) =>
					record.constraintState === 'UNSUPPORTED' || record.defaultState === 'UNSUPPORTED'
			)
			.map((record) => record.id),
		snapshot.typeParameters
			.filter(
				(record) => record.constraintState === 'UNRESOLVED' || record.defaultState === 'UNRESOLVED'
			)
			.map((record) => record.id)
	);
	emitted('SIGNATURE', signatureIds);
	emitted('SIGNATURE_PARAMETER', signatureParameterIds);
	emitted('OVERLOAD_SET', overloadSetIds);
	emitted(
		'TYPE_RELATION',
		typeRelationIds,
		[],
		snapshot.typeRelations
			.filter((record) => record.state === 'UNSUPPORTED')
			.map((record) => record.id),
		snapshot.typeRelations
			.filter((record) => record.state === 'UNRESOLVED')
			.map((record) => record.id)
	);
	emitted(
		'LITERAL',
		snapshot.literals.map((record) => record.nodeId)
	);
	emitted('INVOCATION_SITE', invocationIds);
	emitted(
		'ASSIGNMENT',
		snapshot.assignments.map((record) => record.nodeId)
	);
	emitted('DIAGNOSTIC', diagnosticIds);
	emitted('PROVENANCE', provenanceIds);
	const frameworkMembers = snapshot.projects.flatMap((project) =>
		project.frameworkCandidates.map((candidate) => `${project.id}\0${candidate}`)
	);
	emitted('FRAMEWORK_CANDIDATE', frameworkMembers, [], frameworkMembers);
	emitted('CONTEXT_INPUT', [], contextIds);
	for (const values of [
		snapshot.literals.map((record) => record.nodeId),
		snapshot.assignments.map((record) => record.nodeId)
	]) {
		if (!isCanonicalSet(values))
			issue(
				'NONCANONICAL_ORDER',
				'$',
				'Node-backed syntax projections must be unique canonical sets.'
			);
	}
	const invocationNodeIds = snapshot.invocations.map((record) => record.nodeId);
	if (new Set(invocationNodeIds).size !== invocationNodeIds.length)
		issue(
			'DUPLICATE_ID',
			'$.invocations',
			'Invocation records must reference unique invocation nodes; record order is governed only by invocation identity.'
		);
	if (!sameMembers([...referencedProvenanceIds], provenanceIds))
		issue(
			'DANGLING_REFERENCE',
			'$.provenances',
			'Provenance table must equal the transitive closure of fact provenance references.'
		);
	const factProvenanceByCapability: Readonly<
		Record<
			'TS_PROJECT' | 'TS_SYMBOL' | 'TS_SYNTAX' | 'TS_TYPE',
			readonly SemanticFactProvenanceRecord[]
		>
	> = {
		TS_PROJECT: snapshot.provenances.filter(
			(record) => referencedProvenanceIds.has(record.id) && record.capability === 'TS_PROJECT'
		),
		TS_SYMBOL: snapshot.provenances.filter(
			(record) => referencedProvenanceIds.has(record.id) && record.capability === 'TS_SYMBOL'
		),
		TS_SYNTAX: snapshot.provenances.filter(
			(record) => referencedProvenanceIds.has(record.id) && record.capability === 'TS_SYNTAX'
		),
		TS_TYPE: snapshot.provenances.filter(
			(record) => referencedProvenanceIds.has(record.id) && record.capability === 'TS_TYPE'
		)
	};
	const capabilityIsPartial = (
		capability: 'TS_PROJECT' | 'TS_SYMBOL' | 'TS_SYNTAX' | 'TS_TYPE'
	): boolean => {
		const factPartial = factProvenanceByCapability[capability].some(
			(record) =>
				record.epistemic.capabilityCoverage === 'partial' ||
				record.epistemic.freshness === 'unknown' ||
				record.epistemic.unresolvedRegions.length > 0 ||
				record.limitations.some((limitation) => limitation.closureEffect !== 'NONE')
		);
		const populationPartial = snapshot.populations.some(
			(population) =>
				populationCapability(population.kind) === capability &&
				(population.failed > 0 || population.unknown > 0 || population.unsupported > 0)
		);
		const limitationPartial = snapshot.limitations.some(
			(limitation) => limitation.capability === capability && limitation.closureEffect !== 'NONE'
		);
		const declaredProjectPartial = snapshot.projects.some((project) =>
			project.partialityReasons.some((reason) => reason.capability === capability)
		);
		const projectExecutionPartial =
			capability === 'TS_PROJECT' &&
			(snapshot.programs.some((program) =>
				program.diagnosticFamilies.some(
					(family) => family.state === 'FAILED' || family.coverage === 'BOUNDED'
				)
			) ||
				snapshot.sources.some(
					(source) =>
						source.origin === 'UNKNOWN' ||
						!['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)
				));
		const frameworkSyntaxPartial =
			capability === 'TS_SYNTAX' &&
			(snapshot.projects.some((project) => project.frameworkCandidates.length > 0) ||
				snapshot.populations.some(
					(population) =>
						population.kind === 'FRAMEWORK_CANDIDATE' &&
						(population.failed > 0 || population.unknown > 0 || population.unsupported > 0)
				));
		const parserRecoveryPartial =
			(capability === 'TS_SYNTAX' || capability === 'TS_SYMBOL' || capability === 'TS_TYPE') &&
			snapshot.diagnostics.some(
				(diagnostic) => diagnostic.family === 'SYNTACTIC' && diagnostic.category === 'ERROR'
			);
		const symbolResolutionPartial =
			capability === 'TS_SYMBOL' &&
			(snapshot.declarations.some(
				(record) =>
					record.scopeLinkState === 'UNSUPPORTED' || record.symbolBindingState === 'UNSUPPORTED'
			) ||
				snapshot.aliases.some((record) => record.state !== 'RESOLVED') ||
				snapshot.references.some(
					(record) =>
						record.scopeLinkState === 'UNSUPPORTED' ||
						record.resolutionState === 'UNRESOLVED' ||
						record.resolutionState === 'UNSUPPORTED'
				) ||
				snapshot.moduleResolutions.some(
					(record) =>
						record.resolutionState === 'UNRESOLVED' || record.resolutionState === 'UNSUPPORTED'
				) ||
				snapshot.moduleExports.some((record) => record.state === 'UNRESOLVED'));
		const typeResolutionPartial =
			capability === 'TS_TYPE' &&
			(snapshot.types.some((record) => record.structureState === 'BOUNDED') ||
				snapshot.typeParameters.some(
					(record) =>
						['UNRESOLVED', 'UNSUPPORTED'].includes(record.constraintState) ||
						['UNRESOLVED', 'UNSUPPORTED'].includes(record.defaultState)
				) ||
				snapshot.typeRelations.some((record) => record.state !== 'CONFIRMED'));
		return (
			factPartial ||
			populationPartial ||
			limitationPartial ||
			declaredProjectPartial ||
			projectExecutionPartial ||
			frameworkSyntaxPartial ||
			parserRecoveryPartial ||
			symbolResolutionPartial ||
			typeResolutionPartial
		);
	};
	const implementedCapabilityStates = new Map(
		snapshot.capabilities
			.filter(
				(entry) =>
					entry.capability === 'TS_PROJECT' ||
					entry.capability === 'TS_SYMBOL' ||
					entry.capability === 'TS_SYNTAX' ||
					(typeRequested && entry.capability === 'TS_TYPE')
			)
			.map((entry) => [entry.capability, entry.state])
	);
	const implementedCapabilities = typeRequested
		? (['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX', 'TS_TYPE'] as const)
		: (['TS_PROJECT', 'TS_SYMBOL', 'TS_SYNTAX'] as const);
	for (const capability of implementedCapabilities) {
		const expectedState = capabilityIsPartial(capability) ? 'PARTIAL' : 'SUPPORTED';
		if (implementedCapabilityStates.get(capability) !== expectedState)
			issue(
				'INVALID_VALUE',
				'$.capabilities',
				`${capability} state must exactly roll up its capability-specific facts and closure losses.`
			);
	}
	const partialSignal =
		capabilityIsPartial('TS_PROJECT') ||
		capabilityIsPartial('TS_SYMBOL') ||
		capabilityIsPartial('TS_SYNTAX') ||
		(typeRequested && capabilityIsPartial('TS_TYPE'));
	if ((snapshot.health === 'PARTIAL') !== partialSignal)
		issue(
			'INVALID_VALUE',
			'$.health',
			'Snapshot health must exactly roll up implemented capability partiality.'
		);
	if (!snapshot.expectedEmpty && snapshot.projects.length === 0)
		issue(
			'POPULATION_MISMATCH',
			'$.projects',
			'An unexpectedly empty all-project snapshot cannot be complete.'
		);

	for (const declarationCandidateId of declarationCandidateIds)
		if (!declarationCandidateById.has(declarationCandidateId as never))
			issue(
				'DANGLING_REFERENCE',
				'$.declarationCandidates',
				'Declaration-candidate index mismatch.'
			);
	if (budgetExhausted) {
		issue('VALIDATION_BUDGET_EXHAUSTED', '$', 'Semantic validation budget was exhausted.');
		return { issues, state: 'BUDGET_EXHAUSTED' };
	}
	return issues.length === 0 ? { issues: [], state: 'VALID' } : { issues, state: 'INVALID' };
}

function materializeValidationOptions(overrides: unknown): {
	readonly issue?: SemanticValidationIssue;
	readonly options?: SemanticValidationOptions;
} {
	if (overrides === null || typeof overrides !== 'object') {
		return {
			issue: {
				code: 'INVALID_SHAPE',
				message: 'Semantic validation options must be a plain object.',
				path: '$validationOptions'
			}
		};
	}
	if (isProxy(overrides)) {
		return {
			issue: {
				code: 'INVALID_SHAPE',
				message: 'Proxy values are not permitted in semantic validation options.',
				path: '$validationOptions'
			}
		};
	}
	try {
		if (
			Array.isArray(overrides) ||
			![Object.prototype, null].includes(Reflect.getPrototypeOf(overrides))
		) {
			return {
				issue: {
					code: 'INVALID_SHAPE',
					message: 'Semantic validation options must have Object.prototype or null prototype.',
					path: '$validationOptions'
				}
			};
		}
		const ownKeys = Reflect.ownKeys(overrides);
		if (ownKeys.some((key) => typeof key !== 'string')) {
			return {
				issue: {
					code: 'INVALID_SHAPE',
					message: 'Semantic validation options must not contain symbol properties.',
					path: '$validationOptions'
				}
			};
		}
		const options: Record<keyof SemanticValidationOptions, number> = {
			maxDepth: DEFAULT_OPTIONS.maxDepth,
			maxDiagnostics: DEFAULT_OPTIONS.maxDiagnostics,
			maxIssues: DEFAULT_OPTIONS.maxIssues,
			maxRecords: DEFAULT_OPTIONS.maxRecords,
			maxReferenceChecks: DEFAULT_OPTIONS.maxReferenceChecks,
			maxStringCharacters: DEFAULT_OPTIONS.maxStringCharacters
		};
		for (const key of ownKeys as string[]) {
			if (!VALIDATION_OPTION_KEY_SET.has(key)) {
				return {
					issue: {
						code: 'INVALID_SHAPE',
						message: `Unknown semantic validation option ${key}.`,
						path: `$validationOptions.${key}`
					}
				};
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(overrides, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
				return {
					issue: {
						code: 'INVALID_SHAPE',
						message: 'Semantic validation options must be enumerable data properties.',
						path: `$validationOptions.${key}`
					}
				};
			}
			if (!Number.isSafeInteger(descriptor.value) || descriptor.value <= 0) {
				return {
					issue: {
						code: 'INVALID_VALUE',
						message: 'Semantic validation budgets must be positive safe integers.',
						path: `$validationOptions.${key}`
					}
				};
			}
			options[key as keyof SemanticValidationOptions] = descriptor.value as number;
		}
		return { options };
	} catch (error) {
		return {
			issue: {
				code: 'INVALID_SHAPE',
				message:
					error instanceof Error
						? `Semantic validation option inspection failed closed: ${error.message}`
						: 'Semantic validation option inspection failed closed.',
				path: '$validationOptions'
			}
		};
	}
}

export function validateStaticSemanticSnapshot(
	value: unknown,
	overrides: Partial<SemanticValidationOptions> = {},
	context: SemanticValidationContext = {}
): SemanticValidationResult {
	const materializedOptions = materializeValidationOptions(overrides);
	if (materializedOptions.issue !== undefined)
		return { issues: [materializedOptions.issue], state: 'INVALID' };
	const options = materializedOptions.options!;
	let wire;
	try {
		wire = materializeSemanticSnapshotWire(value, options);
	} catch (error) {
		return {
			issues: [
				{
					code: 'INVALID_SHAPE',
					message:
						error instanceof Error
							? `Semantic wire inspection failed closed: ${error.message}`
							: 'Semantic wire inspection failed closed.',
					path: '$'
				}
			],
			state: 'INVALID'
		};
	}
	const shapeIssues = wire.issues.slice(0, options.maxIssues);
	if (shapeIssues.length > 0) {
		const budget = shapeIssues.some((issue) => issue.budget);
		return {
			issues: shapeIssues.map((issue) => ({
				code: issue.budget
					? 'VALIDATION_BUDGET_EXHAUSTED'
					: issue.message.startsWith('Absolute')
						? 'ABSOLUTE_PATH'
						: 'INVALID_SHAPE',
				message: issue.message,
				path: issue.path
			})),
			state: budget ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
	try {
		if (wire.value === undefined || wire.canonicalBytes === undefined)
			return {
				issues: [
					{
						code: 'INVALID_SHAPE',
						message: 'Semantic wire inspection produced no inert value or canonical byte count.',
						path: '$'
					}
				],
				state: 'INVALID'
			};
		return validateStaticSemanticSnapshotUnsafe(wire.value, wire.canonicalBytes, options, context);
	} catch (error) {
		return {
			issues: [
				{
					code: 'INVALID_SHAPE',
					message:
						error instanceof Error
							? `Malformed semantic snapshot: ${error.message}`
							: 'Malformed semantic snapshot.',
					path: '$'
				}
			],
			state: 'INVALID'
		};
	}
}

function validationBudgetEvidenceFailure(
	code: StaticSemanticValidationBudgetEvidenceErrorCode,
	message: string
): never {
	throw new StaticSemanticValidationBudgetEvidenceError(code, message);
}

function independentValidationSnapshotWitness(
	snapshot: StaticSemanticSnapshot
): StaticSemanticValidationBudgetEvidenceView {
	try {
		const canonicalSnapshot = canonicalSemanticJsonWitness(snapshot);
		return Object.freeze({
			budgetsDigest: sha256(canonicalSemanticJson(snapshot.budgets)),
			canonicalSnapshotBytes: canonicalSnapshot.bytes,
			phase: 'VALIDATE',
			snapshotSha256: canonicalSnapshot.sha256
		});
	} catch {
		return validationBudgetEvidenceFailure(
			'SNAPSHOT_MISMATCH',
			'Validated semantic snapshot could not be independently canonicalized for budget evidence.'
		);
	}
}

export function validateStaticSemanticSnapshotWithBudgetEvidence(
	snapshot: StaticSemanticSnapshot,
	providerBinding: StaticSemanticOperationBudgetProviderBinding,
	overrides: Partial<SemanticValidationOptions> = {},
	context: SemanticValidationContext = {}
): StaticSemanticValidationBudgetEvidenceResult {
	if (providerBinding === null || typeof providerBinding !== 'object' || isProxy(providerBinding))
		return validationBudgetEvidenceFailure(
			'INVALID_BINDING',
			'Semantic validation budget evidence requires an opaque operation provider binding.'
		);
	const validation = validateStaticSemanticSnapshot(snapshot, overrides, context);
	if (validation.state !== 'VALID') return Object.freeze({ evidence: null, validation });
	const view = independentValidationSnapshotWitness(snapshot);
	const evidence = Object.freeze(Object.create(null)) as StaticSemanticValidationBudgetEvidence;
	staticSemanticValidationBudgetEvidenceStates.set(evidence, {
		binding: providerBinding,
		consumed: false,
		snapshot,
		view
	});
	return Object.freeze({ evidence, validation });
}

/** @internal Consumed only by the fixed semantic operation budget session. */
export function takeStaticSemanticValidationBudgetEvidence(
	evidence: StaticSemanticValidationBudgetEvidence,
	providerBinding: StaticSemanticOperationBudgetProviderBinding,
	expectedSnapshot: StaticSemanticSnapshot,
	expectedBudgetsDigest: string
): StaticSemanticValidationBudgetEvidenceView {
	const state =
		evidence !== null && typeof evidence === 'object'
			? staticSemanticValidationBudgetEvidenceStates.get(evidence)
			: undefined;
	if (state === undefined)
		return validationBudgetEvidenceFailure(
			'INVALID_EVIDENCE',
			'Semantic validation budget evidence is not validator-issued.'
		);
	if (state.binding !== providerBinding)
		return validationBudgetEvidenceFailure(
			'BINDING_MISMATCH',
			'Semantic validation budget evidence does not bind the exact operation provider binding.'
		);
	if (state.snapshot !== expectedSnapshot)
		return validationBudgetEvidenceFailure(
			'SNAPSHOT_MISMATCH',
			'Semantic validation budget evidence does not bind the exact snapshot object.'
		);
	if (state.view.budgetsDigest !== expectedBudgetsDigest)
		return validationBudgetEvidenceFailure(
			'BUDGET_MISMATCH',
			'Semantic validation budget evidence does not bind the expected snapshot budgets.'
		);
	if (state.consumed)
		return validationBudgetEvidenceFailure(
			'EVIDENCE_REUSED',
			'Semantic validation budget evidence is single-use.'
		);
	const current = independentValidationSnapshotWitness(expectedSnapshot);
	if (
		current.budgetsDigest !== state.view.budgetsDigest ||
		current.canonicalSnapshotBytes !== state.view.canonicalSnapshotBytes ||
		current.snapshotSha256 !== state.view.snapshotSha256
	)
		return validationBudgetEvidenceFailure(
			'SNAPSHOT_MISMATCH',
			'Semantic validation budget evidence no longer binds the exact validated snapshot bytes.'
		);
	state.consumed = true;
	return Object.freeze({ ...state.view });
}
