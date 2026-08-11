import ts from 'typescript';
import { isProxy } from 'node:util/types';
import type {
	CompilerInputObservation,
	SemanticFactProvenanceRecord,
	SemanticLimitation,
	SemanticPopulationKind,
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
	SEMANTIC_SNAPSHOT_SCHEMA_VERSION,
	TYPESCRIPT_PROVIDER_VERSION
} from '../contracts/semantic.js';
import { sha256 } from '../inventory/canonical.js';
import {
	canonicalSemanticJson,
	hasLoneUtf16CodeUnit,
	isUnicodeScalarString,
	parseUtf16CodeUnitsHex,
	semanticUtf16CodeUnitsDigest
} from './canonical.js';
import {
	hasSemanticIdPrefix,
	semanticContextInputId,
	semanticDeclarationCandidateId,
	semanticDiagnosticId,
	semanticInvocationSiteId,
	compilerInputClosureDigest,
	compilerInputResultDigest,
	semanticNodeId,
	semanticProgramId,
	semanticProjectId,
	semanticProvenanceId,
	semanticSnapshotId,
	semanticSourceId
} from './ids.js';
import { ProgramRecipePolicyError, validateProgramRecipePolicy } from './program-recipe-policy.js';
import { semanticPopulation } from './population.js';
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
	readonly frozenSubject?: Pick<FrozenSubject, 'artifacts' | 'descriptor' | 'projects' | 'workspaces'>;
}

export type SemanticValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| { readonly issues: readonly SemanticValidationIssue[]; readonly state: 'INVALID' | 'BUDGET_EXHAUSTED' };

const DEFAULT_OPTIONS: SemanticValidationOptions = { maxDepth: 128, maxDiagnostics: 100_000, maxIssues: 1_000, maxRecords: 5_000_000, maxReferenceChecks: 20_000_000, maxStringCharacters: 100_000_000 };
const VALIDATION_OPTION_KEYS = ['maxDepth', 'maxDiagnostics', 'maxIssues', 'maxRecords', 'maxReferenceChecks', 'maxStringCharacters'] as const satisfies readonly (keyof SemanticValidationOptions)[];
const VALIDATION_OPTION_KEY_SET = new Set<string>(VALIDATION_OPTION_KEYS);
const SHA256 = /^[a-f0-9]{64}$/u;
const CAPABILITIES = ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'] as const;
const POPULATIONS: readonly SemanticPopulationKind[] = ['PROJECT', 'PROGRAM', 'SOURCE', 'AST_NODE', 'DECLARATION_CANDIDATE', 'LITERAL', 'INVOCATION_SITE', 'ASSIGNMENT', 'DIAGNOSTIC', 'PROVENANCE', 'FRAMEWORK_CANDIDATE', 'CONTEXT_INPUT'];
const DIAGNOSTIC_FAMILIES = ['CONFIGURATION', 'OPTIONS', 'GLOBAL', 'SYNTACTIC', 'SEMANTIC', 'DECLARATION'] as const;
const ARTIFACT_ROLES = ['ANALYSIS_INPUT', 'COMPILER_CANDIDATE', 'CONFIGURATION', 'EXPORT_DECLARATION', 'FRAMEWORK_CANDIDATE', 'GENERATED', 'GENERATOR', 'MANIFEST', 'PRODUCTION', 'SCRIPT', 'TEST', 'VERIFICATION'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLogicalPath(value: string): boolean {
	if (value === '.') return true;
	return value.length > 0
		&& !value.startsWith('/')
		&& !value.startsWith('\\')
		&& !/^[a-zA-Z]:/u.test(value)
		&& !value.includes('\\')
		&& value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

function sortedUnique(values: readonly string[]): string[] {
	return [...new Set(values)].sort();
}

function diagnosticManifestDigest(records: readonly StaticSemanticSnapshot['diagnostics'][number][]): string {
	return sha256(canonicalSemanticJson([...records]
		.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
		.map(({ id, multiplicity }) => ({ id, multiplicity }))));
}

function diagnosticMessageCharacterCount(root: StaticSemanticSnapshot['diagnostics'][number]['message']): number {
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
	return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((value, index) => value === normalizedRight[index]);
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

function compilerInputQueryKey(observation: CompilerInputObservation): string {
	const parameters = observation.operation === 'READ_DIRECTORY'
		? { depth: observation.depth, excludes: observation.excludes, extensions: observation.extensions, includes: observation.includes }
		: {};
	return canonicalSemanticJson({ logicalPath: observation.logicalPath, operation: observation.operation, parameters });
}

function populationCapability(kind: SemanticPopulationKind): 'TS_PROJECT' | 'TS_SYNTAX' {
	return ['AST_NODE', 'DECLARATION_CANDIDATE', 'LITERAL', 'INVOCATION_SITE', 'ASSIGNMENT', 'FRAMEWORK_CANDIDATE'].includes(kind) ? 'TS_SYNTAX' : 'TS_PROJECT';
}

function appendGrouped<Key, Value>(groups: Map<Key, Value[]>, key: Key, value: Value): void {
	const values = groups.get(key);
	if (values === undefined) groups.set(key, [value]);
	else values.push(value);
}

function indexBy<Value>(values: readonly Value[], keyOf: (value: Value) => string): Map<string, Value> {
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

	if (!isRecord(value)) return { issues: [{ code: 'INVALID_SHAPE', message: 'Snapshot must be a plain object.', path: '$' }], state: 'INVALID' };
	if (value.schemaVersion !== SEMANTIC_SNAPSHOT_SCHEMA_VERSION) {
		return { issues: [{ code: 'UNSUPPORTED_SCHEMA_VERSION', message: `Unsupported semantic snapshot schema: ${String(value.schemaVersion)}.`, path: '$.schemaVersion' }], state: 'INVALID' };
	}

	const arrayNames = ['assignments', 'astNodes', 'capabilities', 'compilerInputs', 'declarationCandidates', 'diagnostics', 'invocations', 'limitations', 'literals', 'populations', 'programs', 'projects', 'provenances', 'requestedCapabilities', 'sources'] as const;
	for (const name of arrayNames) {
		if (!Array.isArray(value[name])) issue('INVALID_SHAPE', `$.${name}`, 'Expected an array.');
	}
	if (issues.length > 0) return { issues, state: 'INVALID' };

	const snapshot = value as unknown as StaticSemanticSnapshot;
	const recordCount = snapshot.assignments.length + snapshot.astNodes.length + snapshot.invocations.length + snapshot.compilerInputs.length
		+ snapshot.declarationCandidates.length + snapshot.diagnostics.length + snapshot.literals.length + snapshot.populations.length
		+ snapshot.programs.length + snapshot.projects.length + snapshot.provenances.length + snapshot.sources.length;
	if (recordCount > options.maxRecords) {
		return { issues: [{ code: 'VALIDATION_BUDGET_EXHAUSTED', message: `Record count ${recordCount} exceeds validator limit ${options.maxRecords}.`, path: '$' }], state: 'BUDGET_EXHAUSTED' };
	}
	const referencePopulation = snapshot.projects.reduce((count, record) => count + record.sourceIds.length + record.diagnosticIds.length + record.contextInputIds.length + record.projectReferences.length + record.rootNames.length + 1, 0)
		+ snapshot.programs.reduce((count, record) => count + record.sourceIds.length + record.rootSourceIds.length + record.diagnosticIds.length + record.diagnosticFamilies.reduce((familyCount, family) => familyCount + family.diagnosticIds.length, 0) + 1, 0)
		+ snapshot.sources.reduce((count, record) => count + record.diagnosticIds.length + (record.rootNodeId === null ? 1 : 2), 0)
		+ snapshot.astNodes.reduce((count, record) => count + (record.parentId === null ? 1 : 2), 0)
		+ snapshot.declarationCandidates.reduce((count, record) => count + 3 + (record.nameNodeId === null ? 0 : 1) + (record.exportCarrierNodeId === null ? 0 : 1), 0)
		+ snapshot.diagnostics.reduce((count, record) => count + record.related.length + (record.sourceId === null ? 2 : 3), 0)
		+ snapshot.literals.reduce((count) => count + 2, 0)
		+ snapshot.invocations.reduce((count, record) => count + record.argumentNodeIds.length + (record.templateNodeId === null ? 4 : 5), 0)
		+ snapshot.assignments.reduce((count, record) => count + (record.valueNodeId === null ? 3 : 4), 0)
		+ snapshot.provenances.reduce((count, record) => count + record.invalidationDependencies.length + record.epistemic.supportBasis.sourceRefs.length + (record.parentProvenanceId === null ? 0 : 1) + (record.sourceId === null ? 0 : 1), 0)
		+ snapshot.compilerInputs.reduce((count, record) => count + ('resultEntries' in record ? record.resultEntries.length : 0), 0)
		+ snapshot.populations.reduce((count, record) => count + Object.values(record.members).reduce((memberCount, members) => memberCount + members.length, 0), 0)
		+ snapshot.astNodes.length;
	if (referencePopulation > options.maxReferenceChecks) return { issues: [{ code: 'VALIDATION_BUDGET_EXHAUSTED', message: `Reference count ${referencePopulation} exceeds validator limit ${options.maxReferenceChecks}.`, path: '$' }], state: 'BUDGET_EXHAUSTED' };

	if (snapshot.canonicalProfile !== SEMANTIC_CANONICAL_PROFILE) issue('INVALID_VALUE', '$.canonicalProfile', 'Unexpected semantic canonical profile.');
	if (snapshot.astTraversalProfile !== SEMANTIC_AST_TRAVERSAL_PROFILE) issue('INVALID_VALUE', '$.astTraversalProfile', 'Unexpected AST traversal profile.');
	if (snapshot.extractionVersion !== SEMANTIC_EXTRACTION_VERSION) issue('INVALID_VALUE', '$.extractionVersion', 'Unexpected extraction version.');
	if (snapshot.operationVersion !== SEMANTIC_OPERATION_VERSION) issue('INVALID_VALUE', '$.operationVersion', 'Unexpected semantic operation version.');
	if (snapshot.fullJanCsaa007Conformance !== FULL_JAN_CSAA_007_CONFORMANCE) issue('CONFORMANCE_OVERCLAIM', '$.fullJanCsaa007Conformance', 'Slice 3A must not claim full JAN-CSAA-007 conformance.');
	if (snapshot.provider.id !== 'typescript' || snapshot.provider.version !== TYPESCRIPT_PROVIDER_VERSION || snapshot.provider.api !== 'PUBLIC_COMPILER_API') {
		issue('INVALID_VALUE', '$.provider', 'Snapshot must bind the public TypeScript 5.9.3 Compiler API.');
	}
	if (!SHA256.test(snapshot.subjectId)) issue('INVALID_VALUE', '$.subjectId', 'Subject identity must be lowercase SHA-256.');
	if (!SEMANTIC_BUDGET_KEYS.every((key) => Number.isSafeInteger(snapshot.budgets[key]) && snapshot.budgets[key] > 0)) issue('INVALID_VALUE', '$.budgets', 'Snapshot extraction budgets must be positive safe integers.');
	if (canonicalBytes > snapshot.budgets.maxSnapshotBytes) issue('INVALID_VALUE', '$.budgets.maxSnapshotBytes', 'Canonical snapshot UTF-8 bytes exceed the producing extraction budget.');
	if (snapshot.projects.length > snapshot.budgets.maxProjects) issue('INVALID_VALUE', '$.budgets.maxProjects', 'Retained project count exceeds the producing extraction budget.');
	if (snapshot.sources.length > snapshot.budgets.maxSources) issue('INVALID_VALUE', '$.budgets.maxSources', 'Retained source count exceeds the producing extraction budget.');
	if (snapshot.astNodes.length > snapshot.budgets.maxAstNodes) issue('INVALID_VALUE', '$.budgets.maxAstNodes', 'Retained AST-node count exceeds the producing extraction budget.');
	const diagnosticOccurrences = snapshot.diagnostics.reduce((total, diagnostic) => total + diagnostic.multiplicity, 0);
	if (!Number.isSafeInteger(diagnosticOccurrences) || diagnosticOccurrences > snapshot.budgets.maxDiagnostics) issue('INVALID_VALUE', '$.budgets.maxDiagnostics', 'Retained diagnostic occurrence count exceeds the producing extraction budget.');
	let diagnosticCharacters = 0;
	let diagnosticCharactersOverflow = false;
	for (const diagnostic of snapshot.diagnostics) {
		const perOccurrence = diagnosticMessageCharacterCount(diagnostic.message)
			+ diagnostic.related.reduce((total, related) => total + diagnosticMessageCharacterCount(related.message), 0);
		const contribution = perOccurrence * diagnostic.multiplicity;
		if (!Number.isSafeInteger(perOccurrence) || !Number.isSafeInteger(contribution) || !Number.isSafeInteger(diagnosticCharacters + contribution)) {
			diagnosticCharactersOverflow = true;
			break;
		}
		diagnosticCharacters += contribution;
	}
	if (diagnosticCharactersOverflow || diagnosticCharacters > snapshot.budgets.maxDiagnosticCharacters) issue('INVALID_VALUE', '$.budgets.maxDiagnosticCharacters', 'Retained diagnostic-message characters exceed the producing extraction budget.');
	if (snapshot.compilerInputs.length > snapshot.budgets.maxCompilerQueries) issue('INVALID_VALUE', '$.budgets.maxCompilerQueries', 'Captured compiler query count exceeds the producing extraction budget.');
	const compilerQueryInvocations = snapshot.compilerInputs.reduce((total, observation) => total + observation.invocationCount, 0);
	if (!Number.isSafeInteger(compilerQueryInvocations) || compilerQueryInvocations > snapshot.budgets.maxCompilerQueryInvocations) issue('INVALID_VALUE', '$.budgets.maxCompilerQueryInvocations', 'Captured compiler query invocation count exceeds the producing extraction budget.');
	const liveContextReadsByPath = new Map<string, Extract<CompilerInputObservation, { operation: 'READ_FILE'; result: 'PRESENT' }>>();
	for (const observation of snapshot.compilerInputs) if (observation.operation === 'READ_FILE' && observation.result === 'PRESENT' && observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT' && !liveContextReadsByPath.has(observation.logicalPath)) liveContextReadsByPath.set(observation.logicalPath, observation);
	if (liveContextReadsByPath.size > snapshot.budgets.maxContextFiles) issue('INVALID_VALUE', '$.budgets.maxContextFiles', 'Captured live compiler-context file count exceeds the producing extraction budget.');
	const contextBytes = [...liveContextReadsByPath.values()].reduce((total, observation) => total + observation.contentBytes, 0);
	if (!Number.isSafeInteger(contextBytes) || contextBytes > snapshot.budgets.maxContextBytes) issue('INVALID_VALUE', '$.budgets.maxContextBytes', 'Captured compiler-context bytes exceed the producing extraction budget.');
	for (const [index, observation] of snapshot.compilerInputs.entries()) {
		if (observation.operation === 'READ_FILE' && observation.result === 'PRESENT' && observation.byteBudgetClass === 'LIVE_COMPILER_CONTEXT' && observation.contentBytes > snapshot.budgets.maxContextFileBytes) issue('INVALID_VALUE', `$.compilerInputs[${index}].contentBytes`, 'Captured live compiler-context file exceeds the per-file producing extraction budget.');
	}
	const directoryEntryCount = snapshot.compilerInputs.reduce((total, observation) => total + ('scannedEntries' in observation ? observation.scannedEntries : 0), 0);
	if (!Number.isSafeInteger(directoryEntryCount) || directoryEntryCount > snapshot.budgets.maxDirectoryEntries) issue('INVALID_VALUE', '$.budgets.maxDirectoryEntries', 'Captured directory entries exceed the total producing extraction budget.');
	const compilerInputMetadataBytes = Buffer.byteLength(canonicalSemanticJson(snapshot.compilerInputs), 'utf8');
	if (compilerInputMetadataBytes > snapshot.budgets.maxCompilerInputMetadataBytes) issue('INVALID_VALUE', '$.budgets.maxCompilerInputMetadataBytes', 'Captured compiler-input metadata exceeds the producing extraction budget.');
	if (!SHA256.test(snapshot.contextDigest) || snapshot.contextDigest !== compilerInputClosureDigest(snapshot.compilerInputs)) issue('IDENTITY_MISMATCH', '$.contextDigest', 'Context digest must bind the exact compiler-input observation closure.');
	if (!isCanonicalSet(snapshot.limitations.map(limitationKey))) issue('NONCANONICAL_ORDER', '$.limitations', 'Snapshot limitations must be a canonical set.');
	for (const [index, limitation] of snapshot.limitations.entries()) {
		if (limitation.reason.length === 0 || limitation.region.length === 0) issue('INVALID_VALUE', `$.limitations[${index}]`, 'Structured limitation reason and region must be non-empty.');
		if (limitation.closureEffect === 'FATAL') issue('INVALID_VALUE', `$.limitations[${index}].closureEffect`, 'A snapshot containing a fatal closure failure must not be emitted.');
	}

	const requested = [...snapshot.requestedCapabilities];
	if (!isCanonicalSet(requested)) issue('NONCANONICAL_ORDER', '$.requestedCapabilities', 'Requested capabilities must be unique and canonically ordered.');
	for (const capability of requested) if (!CAPABILITIES.includes(capability)) issue('INVALID_VALUE', '$.requestedCapabilities', `Unknown capability ${String(capability)}.`);
	if (!sameMembers(requested, ['TS_PROJECT', 'TS_SYNTAX'])) issue('INVALID_VALUE', '$.requestedCapabilities', 'Slice 3A snapshot construction is the coupled TS_PROJECT plus TS_SYNTAX increment.');
	if (requested.includes('TS_SYMBOL') || requested.includes('TS_TYPE')) issue('CONFORMANCE_OVERCLAIM', '$.requestedCapabilities', 'A Slice 3A snapshot cannot be constructed for requested unsupported symbol or type capabilities.');
	for (const [index, limitation] of snapshot.limitations.entries()) if (limitation.closureEffect !== 'NONE' && !requested.includes(limitation.capability)) issue('INVALID_VALUE', `$.limitations[${index}]`, 'A closure-degrading limitation must name a requested capability.');
	const capabilityNames = snapshot.capabilities.map((entry) => entry.capability);
	if (!sameMembers(capabilityNames, CAPABILITIES) || new Set(capabilityNames).size !== CAPABILITIES.length || !isCanonicalSet(capabilityNames)) issue('INVALID_VALUE', '$.capabilities', 'Capability records must cover all four Slice 3A vocabulary values exactly once in canonical order.');
	for (const entry of snapshot.capabilities) {
		if (entry.reason.length === 0) issue('INVALID_VALUE', '$.capabilities', `${entry.capability} requires a non-empty support reason.`);
		if ((entry.capability === 'TS_SYMBOL' || entry.capability === 'TS_TYPE') && entry.state !== 'UNSUPPORTED') {
			issue('CONFORMANCE_OVERCLAIM', '$.capabilities', `${entry.capability} must remain UNSUPPORTED in Slice 3A.`);
		}
		if ((entry.capability === 'TS_PROJECT' || entry.capability === 'TS_SYNTAX') && entry.state === 'UNSUPPORTED') {
			issue('INVALID_VALUE', '$.capabilities', `${entry.capability} is the implemented Slice 3A surface.`);
		}
	}

	const snapshotIdentity = semanticSnapshotId({
		astTraversalProfile: snapshot.astTraversalProfile,
		budgets: snapshot.budgets,
		canonicalProfile: snapshot.canonicalProfile,
		contextDigest: snapshot.contextDigest,
		expectedEmpty: snapshot.expectedEmpty,
		extractionVersion: snapshot.extractionVersion,
		operationVersion: snapshot.operationVersion,
		projectRecipeDigests: snapshot.projects.map((project) => project.programRecipe.projectResolutionDigest).sort(),
		provider: snapshot.provider,
		requestedCapabilities: snapshot.requestedCapabilities,
		schemaVersion: snapshot.schemaVersion,
		subjectId: snapshot.subjectId
	});
	if (!hasSemanticIdPrefix(snapshot.id, 'static', 'ts-snapshot') || snapshot.id !== snapshotIdentity) issue('IDENTITY_MISMATCH', '$.id', 'Snapshot identity does not match its semantic input projection.');

	function idsAt(records: readonly unknown[], path: string, prefix: string, family: string): string[] {
		const ids: string[] = [];
		for (let index = 0; index < records.length; index += 1) {
			const record = records[index];
			if (!isRecord(record) || typeof record.id !== 'string') {
				issue('INVALID_SHAPE', `${path}[${index}].id`, 'Record requires an id.');
				continue;
			}
			ids.push(record.id);
			if (!hasSemanticIdPrefix(record.id, prefix, family)) issue('INVALID_VALUE', `${path}[${index}].id`, `Invalid ${family} identity.`);
		}
		if (new Set(ids).size !== ids.length) issue('DUPLICATE_ID', path, 'Record identities must be unique.');
		if (!checkCanonicalOrder(ids)) issue('NONCANONICAL_ORDER', path, 'Records must be ordered by identity.');
		return ids;
	}

	const projectIds = idsAt(snapshot.projects, '$.projects', 'semantic', 'project');
	const programIds = idsAt(snapshot.programs, '$.programs', 'semantic', 'program');
	idsAt(snapshot.sources, '$.sources', 'semantic', 'source');
	const nodeIds = idsAt(snapshot.astNodes, '$.astNodes', 'semantic', 'node');
	const declarationCandidateIds = idsAt(snapshot.declarationCandidates, '$.declarationCandidates', 'semantic', 'decl-candidate');
	const invocationIds = idsAt(snapshot.invocations, '$.invocations', 'semantic', 'invocation');
	const diagnosticIds = idsAt(snapshot.diagnostics, '$.diagnostics', 'diagnostic', 'typescript');
	const provenanceIds = idsAt(snapshot.provenances, '$.provenances', 'analysis', 'provenance');
	const contextIds = idsAt(snapshot.compilerInputs, '$.compilerInputs', 'analysis', 'context-input');
	if (!snapshot.requestedCapabilities.includes('TS_SYNTAX') && (snapshot.astNodes.length + snapshot.declarationCandidates.length + snapshot.literals.length + snapshot.invocations.length + snapshot.assignments.length > 0)) issue('CONFORMANCE_OVERCLAIM', '$', 'TS_SYNTAX records cannot be emitted when syntax was not requested.');
	const projectById = indexBy(snapshot.projects, (record) => record.id);
	const projectByConfigPath = indexBy(snapshot.projects, (record) => record.configPath);
	const programById = indexBy(snapshot.programs, (record) => record.id);
	const sourceById = indexBy(snapshot.sources, (record) => record.id);
	const nodeById = indexBy(snapshot.astNodes, (record) => record.id);
	const literalByNodeId = indexBy(snapshot.literals, (record) => record.nodeId);
	const declarationCandidateById = indexBy(snapshot.declarationCandidates, (record) => record.id);
	const diagnosticById = indexBy(snapshot.diagnostics, (record) => record.id);
	const provenanceById = indexBy<SemanticFactProvenanceRecord>(snapshot.provenances, (record) => record.id);
	const provenanceIndexById = new Map(snapshot.provenances.map((record, index) => [record.id, index]));
	const contextById = indexBy(snapshot.compilerInputs, (record) => record.id);
	const sourcesByProject = new Map<string, StaticSemanticSnapshot['sources'][number][]>();
	const sourcesByProgram = new Map<string, StaticSemanticSnapshot['sources'][number][]>();
	const nodesBySource = new Map<string, StaticSemanticSnapshot['astNodes'][number][]>();
	const childrenByParent = new Map<string, StaticSemanticSnapshot['astNodes'][number][]>();
	const diagnosticsByProject = new Map<string, StaticSemanticSnapshot['diagnostics'][number][]>();
	const diagnosticsBySource = new Map<string, StaticSemanticSnapshot['diagnostics'][number][]>();
	const diagnosticsByProjectFamily = new Map<string, StaticSemanticSnapshot['diagnostics'][number][]>();
	const sourceByProjectPath = new Map<string, StaticSemanticSnapshot['sources'][number]>();
	const presentReadsByProjectPath = new Map<string, Extract<CompilerInputObservation, { operation: 'READ_FILE'; result: 'PRESENT' }>[]>();
	const supportRefsByProject = new Map<string, ReadonlySet<string>>();
	const frozenReads = snapshot.compilerInputs.filter((observation): observation is Extract<CompilerInputObservation, { operation: 'READ_FILE'; result: 'PRESENT' }> => observation.operation === 'READ_FILE' && observation.result === 'PRESENT' && observation.byteBudgetClass === 'FROZEN_SUBJECT');
	const frozenSubject = context.frozenSubject;
	const caseObservation = snapshot.compilerInputs.find((observation) => observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES');
	const caseSensitive = caseObservation?.result !== 'CASE_INSENSITIVE';
	const frozenPathKey = (logicalPath: string): string => caseSensitive ? logicalPath : logicalPath.toLowerCase();
	const workspaceAliases = (frozenSubject?.workspaces ?? []).map((workspace) => ({
		aliasPath: `node_modules/${workspace.name}`,
		targetPath: workspace.path
	})).sort((left, right) => right.aliasPath.length - left.aliasPath.length || (left.aliasPath < right.aliasPath ? -1 : 1));
	function frozenArtifactPath(logicalPath: string): string {
		for (const alias of workspaceAliases) {
			const candidate = frozenPathKey(logicalPath);
			const aliasKey = frozenPathKey(alias.aliasPath);
			if (candidate === aliasKey) return alias.targetPath;
			if (candidate.startsWith(`${aliasKey}/`)) return `${alias.targetPath}/${logicalPath.slice(alias.aliasPath.length + 1)}`;
		}
		return logicalPath;
	}
	if (frozenReads.length > 0 && frozenSubject === undefined) issue('FROZEN_EVIDENCE_REQUIRED', '$validationContext.frozenSubject', 'FROZEN_SUBJECT observations require the exact FrozenSubject artifact witness.');
	if (frozenSubject !== undefined && frozenSubject.descriptor.subjectId !== snapshot.subjectId) issue('FROZEN_EVIDENCE_REQUIRED', '$validationContext.frozenSubject.descriptor.subjectId', 'FrozenSubject witness does not bind the semantic snapshot subject.');
	if (frozenSubject !== undefined && frozenSubject.descriptor.subjectId === snapshot.subjectId) {
		for (const observation of frozenReads) {
			const artifactPath = frozenArtifactPath(observation.logicalPath);
			const matchingArtifacts = frozenSubject.artifacts.filter((artifact) => artifact.canonicalPathKey === frozenPathKey(artifactPath));
			const artifact = matchingArtifacts.length === 1 ? matchingArtifacts[0] : undefined;
			if (artifact === undefined || caseSensitive && artifact.path !== artifactPath || artifact.bytes !== observation.contentBytes || artifact.sha256 !== observation.contentSha256) {
				issue('FROZEN_EVIDENCE_REQUIRED', '$validationContext.frozenSubject.artifacts', `Frozen observation ${observation.logicalPath} does not match exactly one subject artifact by path, bytes, and digest.`);
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
		appendGrouped(diagnosticsByProjectFamily, `${diagnostic.projectId}\0${diagnostic.family}`, diagnostic);
		if (diagnostic.sourceId !== null) appendGrouped(diagnosticsBySource, diagnostic.sourceId, diagnostic);
	}
	for (const project of snapshot.projects) {
		const projectProgram = programById.get(project.programId);
		supportRefsByProject.set(project.id, new Set([snapshot.subjectId, snapshot.id, project.id, projectProgram?.id, ...project.contextInputIds].filter((item): item is string => item !== undefined)));
		for (const contextInputId of project.contextInputIds) {
			const observation = contextById.get(contextInputId);
			if (observation?.operation === 'READ_FILE' && observation.result === 'PRESENT') appendGrouped(presentReadsByProjectPath, `${project.id}\0${observation.logicalPath}`, observation);
		}
	}
	if (projectByConfigPath.size !== snapshot.projects.length) issue('DUPLICATE_ID', '$.projects', 'Project configuration paths must be unique.');
	if (frozenSubject !== undefined && frozenSubject.descriptor.subjectId === snapshot.subjectId) {
		const authoritativePaths = frozenSubject.projects.map((project) => project.configPath);
		if (new Set(authoritativePaths).size !== authoritativePaths.length || snapshot.projects.length !== authoritativePaths.length
			|| !sameMembers(snapshot.projects.map((project) => project.configPath), authoritativePaths)) issue('FROZEN_EVIDENCE_REQUIRED', '$.projects', 'Snapshot projects must equal the complete FrozenSubject project population; INCOMPLETE projects remain present and partial.');
		for (const authoritative of frozenSubject.projects) {
			const project = projectByConfigPath.get(authoritative.configPath);
			if (project === undefined) continue;
			if (canonicalSemanticJson(project.programRecipe) !== canonicalSemanticJson(authoritative.programRecipe)
				|| project.configPath !== authoritative.configPath || project.kind !== authoritative.kind
				|| project.rootDisposition !== authoritative.rootDisposition || !sameMembers(project.rootNames, authoritative.programRecipe.rootNames)
				|| !sameMembers(project.projectReferences, authoritative.projectReferences) || !sameMembers(project.frameworkCandidates, authoritative.frameworkCandidates)) {
				issue('FROZEN_EVIDENCE_REQUIRED', '$.projects', `Project ${authoritative.configPath} does not reproduce its authoritative FrozenSubject recipe and discovery mirrors.`);
			}
			const authoritativeProjectEvidencePartial = authoritative.rootDisposition === 'INCOMPLETE'
				|| authoritative.typescriptDiagnostics.some((entry) => entry.severity === 'ERROR' || entry.code === 'TYPESCRIPT_PROJECT_PARTIAL');
			if (authoritativeProjectEvidencePartial && (project.health !== 'PARTIAL' || !project.partialityReasons.some((reason) => reason.capability === 'TS_PROJECT' && reason.code === 'TYPESCRIPT_PROJECT_PARTIAL'))) issue('FROZEN_EVIDENCE_REQUIRED', '$.projects', `Incomplete or configuration-partial frozen project ${authoritative.configPath} must remain explicitly TS_PROJECT partial.`);
		}
	}
	if (new Set(snapshot.programs.map((program) => program.projectId)).size !== snapshot.programs.length) issue('DUPLICATE_ID', '$.programs', 'Each project may own exactly one Program.');
	const sourceProgramPaths = snapshot.sources.map((source) => `${source.programId}\0${source.logicalPath}`);
	if (new Set(sourceProgramPaths).size !== sourceProgramPaths.length) issue('DUPLICATE_ID', '$.sources', 'A Program may contain at most one source record per logical path.');

	function path(valueToCheck: string | null, jsonPath: string): void {
		if (valueToCheck !== null && !isLogicalPath(valueToCheck)) issue('ABSOLUTE_PATH', jsonPath, 'Serialized paths must be canonical logical paths.');
		else if (valueToCheck !== null && valueToCheck.length > snapshot.budgets.maxPathCharacters) issue('INVALID_VALUE', jsonPath, 'Serialized path exceeds the producing path-character budget.');
	}

	function diagnosticMessage(root: StaticSemanticSnapshot['diagnostics'][number]['message'], jsonPath: string): void {
		const stack = [{ message: root, path: jsonPath }];
		while (stack.length > 0) {
			const current = stack.pop()!;
			if (current.message.textLength === 0) issue('INVALID_VALUE', current.path, 'Diagnostic message text must not be empty.');
			if ((current.message.category === null) !== (current.message.code === null)) issue('INVALID_VALUE', current.path, 'Diagnostic message category and code must be present or absent together.');
			if (!SHA256.test(current.message.textSha256)) issue('INVALID_VALUE', `${current.path}.textSha256`, 'Diagnostic message digest must be lowercase SHA-256.');
			if (current.message.textEncoding === 'UNICODE_SCALAR') {
				if (!isUnicodeScalarString(current.message.text) || current.message.textLength !== current.message.text.length
					|| current.message.textSha256 !== semanticUtf16CodeUnitsDigest('JAN-CSAA-DIAGNOSTIC-TEXT', ['UNICODE_SCALAR'], current.message.text)) issue('INVALID_VALUE', current.path, 'Scalar diagnostic text encoding, length, or digest is incoherent.');
			} else {
				const units = parseUtf16CodeUnitsHex(current.message.text);
				if (units === null || !hasLoneUtf16CodeUnit(units) || current.message.textLength !== units.length
					|| current.message.textSha256 !== semanticUtf16CodeUnitsDigest('JAN-CSAA-DIAGNOSTIC-TEXT', ['UTF16_CODE_UNITS_HEX'], units)) issue('INVALID_VALUE', current.path, 'UTF-16 diagnostic text encoding, length, or digest is incoherent.');
			}
			for (let index = current.message.next.length - 1; index >= 0; index -= 1) stack.push({ message: current.message.next[index]!, path: `${current.path}.next[${index}]` });
		}
	}

	const validatedProvenanceIds = new Set<string>();
	const referencedProvenanceIds = new Set<string>();
	function validateProvenanceRecord(record: SemanticFactProvenanceRecord, jsonPath: string): void {
		if (validatedProvenanceIds.has(record.id)) return;
		validatedProvenanceIds.add(record.id);
		const { id: _id, ...preimage } = record;
		if (semanticProvenanceId(preimage) !== record.id) issue('IDENTITY_MISMATCH', `${jsonPath}.id`, 'Provenance identity does not bind its exact canonical content.');
		if (record.snapshotId !== snapshot.id || record.subjectId !== snapshot.subjectId) issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Provenance does not bind the containing snapshot and subject.');
		if (!snapshot.requestedCapabilities.includes(record.capability)) issue('CONFORMANCE_OVERCLAIM', `${jsonPath}.capability`, `Provenance capability ${record.capability} was not requested.`);
		if (record.extractionVersion !== snapshot.extractionVersion) issue('INVALID_VALUE', `${jsonPath}.extractionVersion`, 'Provenance extraction version is inconsistent.');
		if (record.provider.id !== snapshot.provider.id || record.provider.version !== snapshot.provider.version || record.provider.api !== snapshot.provider.api) issue('INVALID_VALUE', `${jsonPath}.provider`, 'Provenance provider does not match snapshot provider.');
		const epistemic = record.epistemic;
		if (!isRecord(epistemic) || !Array.isArray(record.invalidationDependencies) || !Array.isArray(record.limitations)) issue('INVALID_SHAPE', jsonPath, 'Provenance requires epistemic, invalidation, and limitation state.');
		if (!['supported', 'partial'].includes(epistemic.capabilityCoverage) || epistemic.executionHealth !== 'succeeded' || !['current-for-subject', 'unknown'].includes(epistemic.freshness)
			|| !['unopposed', 'corroborated'].includes(epistemic.conflict) || !['direct', 'derived'].includes(epistemic.inference)) issue('INVALID_VALUE', `${jsonPath}.epistemic`, 'Slice 3A provenance requires explicit successful bounded epistemic state.');
		if (!['direct-extraction', 'compiler-confirmed', 'derived'].includes(epistemic.supportBasis.kind) || epistemic.supportBasis.sourceRefs.length === 0 || epistemic.supportBasis.method === null || epistemic.supportBasis.method.length === 0 || epistemic.rationale.length === 0 || epistemic.supportBasis.rationale.length === 0 || !isCanonicalSet(epistemic.supportBasis.sourceRefs) || !isCanonicalSet(epistemic.unresolvedRegions)) issue('INVALID_VALUE', `${jsonPath}.epistemic`, 'Epistemic support, rationale, and unresolved regions must be explicit non-empty canonical evidence.');
		const degradingLimitation = record.limitations.some((limitation) => limitation.closureEffect !== 'NONE');
		if ((epistemic.freshness === 'unknown' || epistemic.unresolvedRegions.length > 0 || degradingLimitation) && epistemic.capabilityCoverage !== 'partial') issue('INVALID_VALUE', `${jsonPath}.epistemic.capabilityCoverage`, 'Unknown freshness, unresolved regions, or closure-degrading limitations require partial capability coverage.');
		if (!isCanonicalSet(record.limitations.map(limitationKey))) issue('NONCANONICAL_ORDER', `${jsonPath}.limitations`, 'Provenance limitations must be a canonical set.');
		for (const [limitationIndex, limitation] of record.limitations.entries()) {
			if (limitation.capability !== record.capability || limitation.reason.length === 0 || limitation.region.length === 0) issue('INVALID_VALUE', `${jsonPath}.limitations[${limitationIndex}]`, 'Provenance limitation must name the capability and non-empty region and reason.');
			if (limitation.closureEffect === 'FATAL') issue('INVALID_VALUE', `${jsonPath}.limitations[${limitationIndex}].closureEffect`, 'Fatal provenance must not be emitted.');
		}
		const project = projectById.get(record.projectId);
		const program = project === undefined ? undefined : programById.get(project.programId);
		if (project === undefined || program === undefined) issue('CROSS_PROJECT_REFERENCE', `${jsonPath}.projectId`, 'Provenance project or Program is absent.');
		const expectedDependencies = new Map([
			['SUBJECT', snapshot.subjectId],
			['PROJECT_RECIPE', project?.programRecipe.projectResolutionDigest ?? ''],
			['CONTEXT_INPUT', program?.contextDigest ?? ''],
			['PROVIDER', sha256(canonicalSemanticJson(snapshot.provider))],
			['EXTRACTION', sha256(canonicalSemanticJson(snapshot.extractionVersion))]
		]);
		const dependencyKinds = record.invalidationDependencies.map((dependency) => dependency.kind);
		if (!isCanonicalSet(dependencyKinds) || !sameMembers(dependencyKinds, [...expectedDependencies.keys()])) issue('INVALID_VALUE', `${jsonPath}.invalidationDependencies`, 'Provenance invalidation dependencies must cover the five exact Slice 3A inputs.');
		for (const dependency of record.invalidationDependencies) if (!SHA256.test(dependency.digest) || dependency.digest !== expectedDependencies.get(dependency.kind)) issue('IDENTITY_MISMATCH', `${jsonPath}.invalidationDependencies`, `Invalidation dependency ${dependency.kind} does not bind the actual input.`);
		if (record.sourceId === null) {
			if (record.parentProvenanceId !== null) issue('INVALID_VALUE', `${jsonPath}.parentProvenanceId`, 'Project provenance must not have a parent.');
			const expectedSupportRefs = supportRefsByProject.get(record.projectId);
			if (expectedSupportRefs === undefined || !sameMembers(epistemic.supportBasis.sourceRefs, [...expectedSupportRefs])) issue('DANGLING_REFERENCE', `${jsonPath}.epistemic.supportBasis.sourceRefs`, 'Project provenance support must bind exactly the subject, snapshot, project, Program, and attributed compiler inputs.');
		} else {
			const source = sourceById.get(record.sourceId);
			if (source === undefined || source.projectId !== record.projectId) issue('CROSS_PROJECT_REFERENCE', `${jsonPath}.sourceId`, 'Source provenance must bind a source in the same project.');
			const parent = record.parentProvenanceId === null ? undefined : provenanceById.get(record.parentProvenanceId);
			if (parent === undefined || parent.sourceId !== null || parent.parentProvenanceId !== null || parent.projectId !== record.projectId || parent.capability !== record.capability) issue('CROSS_PROJECT_REFERENCE', `${jsonPath}.parentProvenanceId`, 'Source provenance must have exactly one same-project, same-capability project-provenance parent.');
			else {
				referencedProvenanceIds.add(parent.id);
				validateProvenanceRecord(parent, `$.provenances[${provenanceIndexById.get(parent.id) ?? -1}]`);
			}
			if (!sameMembers(epistemic.supportBasis.sourceRefs, [record.parentProvenanceId ?? '', record.sourceId])) issue('INVALID_VALUE', `${jsonPath}.epistemic.supportBasis.sourceRefs`, 'Source provenance support must bind exactly its parent provenance and source.');
		}
	}

	function provenance(provenanceId: string, projectId: string, capability: 'TS_PROJECT' | 'TS_SYNTAX', jsonPath: string, sourceId?: string): SemanticFactProvenanceRecord | undefined {
		referencedProvenanceIds.add(provenanceId);
		const record = provenanceById.get(provenanceId);
		if (record === undefined) {
			issue('DANGLING_REFERENCE', jsonPath, 'Fact references absent provenance.');
			return undefined;
		}
		validateProvenanceRecord(record, `$.provenances[${provenanceIndexById.get(record.id) ?? -1}]`);
		if (record.projectId !== projectId || record.capability !== capability) issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Fact provenance does not bind its project and capability.');
		if ((sourceId ?? null) !== record.sourceId) issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Fact provenance does not bind its exact source context.');
		return record;
	}
	for (const [index, record] of snapshot.provenances.entries()) validateProvenanceRecord(record, `$.provenances[${index}]`);

	for (const [index, project] of snapshot.projects.entries()) {
		path(project.configPath, `$.projects[${index}].configPath`);
		for (const rootName of project.rootNames) path(rootName, `$.projects[${index}].rootNames`);
		for (const reference of project.projectReferences) path(reference, `$.projects[${index}].projectReferences`);
		for (const [candidateIndex, candidate] of project.frameworkCandidates.entries()) path(candidate, `$.projects[${index}].frameworkCandidates[${candidateIndex}]`);
		for (const [reasonIndex, reason] of project.partialityReasons.entries()) path(reason.path, `$.projects[${index}].partialityReasons[${reasonIndex}].path`);
		for (const rootName of project.programRecipe.rootNames) path(rootName, `$.projects[${index}].programRecipe.rootNames`);
		for (const reference of project.programRecipe.projectReferences) path(reference, `$.projects[${index}].programRecipe.projectReferences`);
		path(project.programRecipe.configPath, `$.projects[${index}].programRecipe.configPath`);
		try {
			validateProgramRecipePolicy(project.programRecipe, snapshot.budgets.maxPathCharacters);
		} catch (error) {
			issue(error instanceof ProgramRecipePolicyError && error.message.includes('digest') ? 'IDENTITY_MISMATCH' : 'INVALID_VALUE', `$.projects[${index}].programRecipe`, error instanceof Error ? error.message : 'ProgramRecipe violates the shared materialization policy.');
		}
		if (project.configPath !== project.programRecipe.configPath || project.kind !== project.programRecipe.kind
			|| !sameMembers(project.rootNames, project.programRecipe.rootNames) || !sameMembers(project.projectReferences, project.programRecipe.projectReferences)
			|| project.programRecipe.provider.id !== snapshot.provider.id || project.programRecipe.provider.version !== snapshot.provider.version) issue('IDENTITY_MISMATCH', `$.projects[${index}].programRecipe`, 'Project mirrors do not reproduce the exact ProgramRecipe.');
		for (const values of [project.rootNames, project.projectReferences, project.sourceIds, project.diagnosticIds, project.contextInputIds, project.frameworkCandidates]) {
			if (!isCanonicalSet(values)) issue('NONCANONICAL_ORDER', `$.projects[${index}]`, 'Project manifests must be canonical sets.');
		}
		if (!isCanonicalSet(project.programRecipe.rootNames) || !isCanonicalSet(project.programRecipe.projectReferences)) issue('NONCANONICAL_ORDER', `$.projects[${index}].programRecipe`, 'ProgramRecipe roots and references must be canonical sets.');
		for (const reference of project.projectReferences) if (!projectByConfigPath.has(reference)) issue('DANGLING_REFERENCE', `$.projects[${index}].projectReferences`, `Referenced project ${reference} is absent from the all-project closure.`);
		if (project.rootDisposition === 'INTENTIONAL_EMPTY_SOLUTION' ? project.kind !== 'SOLUTION' || project.rootNames.length !== 0 : project.rootDisposition === 'COMPILER_ROOTS' && project.rootNames.length === 0) issue('INVALID_VALUE', `$.projects[${index}].rootDisposition`, 'Project root disposition is incoherent with kind and roots.');
		if (project.rootDisposition === 'INCOMPLETE' && project.health !== 'PARTIAL') issue('INVALID_VALUE', `$.projects[${index}].health`, 'Incomplete project roots require partial health.');
		if (project.health === 'PARTIAL' ? project.partialityReasons.length === 0 : project.partialityReasons.length > 0) issue('INVALID_VALUE', `$.projects[${index}].partialityReasons`, 'Project health and partiality reasons disagree.');
		const projectCapabilityPartial = project.partialityReasons.some((reason) => reason.capability === 'TS_PROJECT');
		const projectProvenance = provenance(project.provenanceId, project.id, 'TS_PROJECT', `$.projects[${index}].provenanceId`);
		if (projectProvenance !== undefined && projectCapabilityPartial !== (projectProvenance.epistemic.capabilityCoverage === 'partial')) issue('INVALID_VALUE', `$.projects[${index}].provenanceId`, 'Project-fact coverage must agree with TS_PROJECT-specific partiality without inheriting syntax-only losses.');
		if (!isCanonicalSet(project.partialityReasons.map((reason) => `${reason.capability}\0${reason.code}\0${reason.path ?? ''}\0${reason.message}`))) issue('NONCANONICAL_ORDER', `$.projects[${index}].partialityReasons`, 'Project partiality reasons must be a canonical set.');
		for (const [reasonIndex, reason] of project.partialityReasons.entries()) if (reason.message.length === 0 || !snapshot.requestedCapabilities.includes(reason.capability)) issue('INVALID_VALUE', `$.projects[${index}].partialityReasons[${reasonIndex}]`, 'Partiality reason must name a requested capability and a non-empty message.');
		if (project.frameworkCandidates.length > 0 && project.health !== 'PARTIAL') issue('INVALID_VALUE', `$.projects[${index}].health`, 'Framework candidates require explicit project partiality.');
		if (project.frameworkCandidates.length > 0 && !project.partialityReasons.some((reason) => reason.capability === 'TS_SYNTAX' && reason.code === 'FRAMEWORK_CANDIDATES_UNSUPPORTED')) issue('INVALID_VALUE', `$.projects[${index}].partialityReasons`, 'Unsupported framework candidates must explicitly degrade TS_SYNTAX with FRAMEWORK_CANDIDATES_UNSUPPORTED.');
		const expected = semanticProjectId({ configPath: project.configPath, projectResolutionDigest: project.programRecipe.projectResolutionDigest, snapshotId: snapshot.id });
		if (project.id !== expected) issue('IDENTITY_MISMATCH', `$.projects[${index}].id`, 'Project identity mismatch.');
		const ownedProgram = programById.get(project.programId);
		if (ownedProgram === undefined) issue('DANGLING_REFERENCE', `$.projects[${index}].programId`, 'Project program is absent.');
		else if (ownedProgram.projectId !== project.id) issue('CROSS_PROJECT_REFERENCE', `$.projects[${index}].programId`, 'Project points to a Program owned by another project.');
		if (!sameMembers(project.sourceIds, (sourcesByProject.get(project.id) ?? []).map((source) => source.id))) issue('DANGLING_REFERENCE', `$.projects[${index}].sourceIds`, 'Project source manifest is incomplete.');
		if (!sameMembers(project.diagnosticIds, (diagnosticsByProject.get(project.id) ?? []).map((diagnostic) => diagnostic.id))) issue('DANGLING_REFERENCE', `$.projects[${index}].diagnosticIds`, 'Project diagnostic manifest is incomplete.');
		for (const contextId of project.contextInputIds) if (!contextById.has(contextId)) issue('DANGLING_REFERENCE', `$.projects[${index}].contextInputIds`, 'Project context input is absent.');
	}

	for (const [index, program] of snapshot.programs.entries()) {
		const project = projectById.get(program.projectId);
		if (!project) issue('DANGLING_REFERENCE', `$.programs[${index}].projectId`, 'Program project is absent.');
		else if (project.programId !== program.id) issue('CROSS_PROJECT_REFERENCE', `$.programs[${index}].id`, 'Program is not the program bound by its project.');
		const expected = semanticProgramId({ contextDigest: program.contextDigest, projectId: program.projectId });
		if (program.id !== expected) issue('IDENTITY_MISMATCH', `$.programs[${index}].id`, 'Program identity mismatch.');
		const programSources = sourcesByProgram.get(program.id) ?? [];
		const ownedSources = programSources.map((source) => source.id);
		if (!sameMembers(program.sourceIds, ownedSources)) issue('DANGLING_REFERENCE', `$.programs[${index}].sourceIds`, 'Program source manifest is incomplete.');
		const ownedRoots = programSources.filter((source) => source.rootFile).map((source) => source.id);
		if (!sameMembers(program.rootSourceIds, ownedRoots)) issue('DANGLING_REFERENCE', `$.programs[${index}].rootSourceIds`, 'Program root-source manifest is incomplete.');
		if (!isCanonicalSet(program.sourceIds) || !isCanonicalSet(program.rootSourceIds) || !isCanonicalSet(program.diagnosticIds)) issue('NONCANONICAL_ORDER', `$.programs[${index}]`, 'Program manifests must be canonical sets.');
		const projectInputs = project?.contextInputIds.map((id) => contextById.get(id)).filter((input) => input !== undefined) ?? [];
		if (program.contextDigest !== compilerInputClosureDigest(projectInputs)) issue('IDENTITY_MISMATCH', `$.programs[${index}].contextDigest`, 'Program context digest does not bind its exact project compiler observations.');
		if (!sameMembers(program.diagnosticIds, (diagnosticsByProject.get(program.projectId) ?? []).map((diagnostic) => diagnostic.id))) issue('DANGLING_REFERENCE', `$.programs[${index}].diagnosticIds`, 'Program diagnostic manifest is incomplete.');
		if (program.diagnosticFamilies.length !== DIAGNOSTIC_FAMILIES.length || !program.diagnosticFamilies.every((coverage, familyIndex) => coverage.family === DIAGNOSTIC_FAMILIES[familyIndex])) issue('INVALID_VALUE', `$.programs[${index}].diagnosticFamilies`, 'Program must report all six diagnostic families in registered order.');
		for (const coverage of program.diagnosticFamilies) {
			const familyRecords = diagnosticsByProjectFamily.get(`${program.projectId}\0${coverage.family}`) ?? [];
			const familyIds = familyRecords.map((diagnostic) => diagnostic.id).sort();
			const occurrenceCount = familyRecords.reduce((total, diagnostic) => total + diagnostic.multiplicity, 0);
			if (!isCanonicalSet(coverage.diagnosticIds) || coverage.recordCount !== coverage.diagnosticIds.length || coverage.recordCount !== familyRecords.length
				|| coverage.occurrenceCount !== occurrenceCount || coverage.manifestDigest !== diagnosticManifestDigest(familyRecords) || !sameMembers(coverage.diagnosticIds, familyIds)) issue('POPULATION_MISMATCH', `$.programs[${index}].diagnosticFamilies`, `${coverage.family} diagnostic coverage does not match emitted diagnostic records and occurrences.`);
			if (coverage.state === 'NOT_APPLICABLE' || coverage.reason.length === 0 || coverage.state === 'FAILED' && project?.health !== 'PARTIAL') issue('INVALID_VALUE', `$.programs[${index}].diagnosticFamilies`, 'Every Slice 3A diagnostic family must run or fail visibly with a reason.');
			if (coverage.coverage === 'COMPLETE' && coverage.state !== 'RUN') issue('INVALID_VALUE', `$.programs[${index}].diagnosticFamilies`, 'Complete diagnostic coverage requires a successful run.');
			if (coverage.coverage === 'BOUNDED' && project?.health !== 'PARTIAL') issue('INVALID_VALUE', `$.programs[${index}].diagnosticFamilies`, 'Bounded diagnostic coverage must roll up to explicit project partiality.');
		}
		const rootSourceSet = new Set(program.rootSourceIds);
		const rootPaths = programSources.filter((source) => rootSourceSet.has(source.id)).map((source) => source.logicalPath).sort();
		if (project !== undefined && !sameMembers(rootPaths, project.rootNames)) issue('DANGLING_REFERENCE', `$.programs[${index}].rootSourceIds`, 'Program root sources do not reproduce ProgramRecipe roots.');
		provenance(program.provenanceId, program.projectId, 'TS_PROJECT', `$.programs[${index}].provenanceId`);
	}

	for (const [index, source] of snapshot.sources.entries()) {
		path(source.logicalPath, `$.sources[${index}].logicalPath`);
		if (!projectById.has(source.projectId) || !programById.has(source.programId)) issue('DANGLING_REFERENCE', `$.sources[${index}]`, 'Source project or program is absent.');
		if (programById.get(source.programId)?.projectId !== source.projectId) issue('CROSS_PROJECT_REFERENCE', `$.sources[${index}].programId`, 'Source program belongs to another project.');
		const expected = semanticSourceId({ contentSha256: source.contentSha256, logicalPath: source.logicalPath, programId: source.programId });
		if (source.id !== expected) issue('IDENTITY_MISMATCH', `$.sources[${index}].id`, 'Source identity mismatch.');
		if (!SHA256.test(source.contentSha256) || !Number.isSafeInteger(source.bytes) || !Number.isSafeInteger(source.textLength) || source.bytes < 0 || source.textLength < 0) issue('INVALID_VALUE', `$.sources[${index}]`, 'Source byte and digest metadata is invalid.');
		const expectedScriptKindName = ts.ScriptKind[source.scriptKind];
		const expectedLanguageVariant = source.scriptKind === ts.ScriptKind.TSX || source.scriptKind === ts.ScriptKind.JSX ? 'JSX' : 'Standard';
		if (typeof expectedScriptKindName !== 'string' || source.scriptKindName !== expectedScriptKindName || source.languageVariant !== expectedLanguageVariant) issue('INVALID_VALUE', `$.sources[${index}]`, 'Source script-kind code, name, and language variant must agree with the public TypeScript enum.');
		if (!isCanonicalSet(source.artifactRoles) || !source.artifactRoles.every((role) => ARTIFACT_ROLES.includes(role)) || !isCanonicalSet(source.diagnosticIds)) issue('NONCANONICAL_ORDER', `$.sources[${index}]`, 'Source roles and diagnostic manifests must be closed canonical sets.');
		const matchingReads = presentReadsByProjectPath.get(`${source.projectId}\0${source.logicalPath}`) ?? [];
		const expectedByteBudgetClass = source.analysisDisposition === 'DEEP_INDEXED' ? 'FROZEN_SUBJECT' : 'LIVE_COMPILER_CONTEXT';
		if (matchingReads.length !== 1 || matchingReads[0]!.byteBudgetClass !== expectedByteBudgetClass
			|| matchingReads[0]!.contentSha256 !== source.contentSha256 || matchingReads[0]!.contentBytes !== source.bytes || matchingReads[0]!.origin !== source.origin) {
			issue('IDENTITY_MISMATCH', `$.sources[${index}]`, `Every Program source must match exactly one project-attributed ${expectedByteBudgetClass} PRESENT READ_FILE observation by path, bytes, digest, and origin.`);
		}
		if (source.analysisDisposition === 'DEEP_INDEXED') {
			const rootNode = source.rootNodeId === null ? undefined : nodeById.get(source.rootNodeId);
			if (source.artifactClass === 'CONTEXT_ONLY' || !rootNode || rootNode.sourceId !== source.id || rootNode.parentId !== null || rootNode.kind !== ts.SyntaxKind.SourceFile || rootNode.structuralRoles.length !== 1 || rootNode.structuralRoles[0] !== AST_STRUCTURAL_ROLES.sourceFile) issue('DANGLING_REFERENCE', `$.sources[${index}].rootNodeId`, 'Deep-indexed source requires one subject-owned SourceFile root AST node.');
		} else if (source.artifactClass !== 'CONTEXT_ONLY' || source.rootNodeId !== null || (nodesBySource.get(source.id)?.length ?? 0) > 0 || source.rootFile) {
			issue('INVALID_VALUE', `$.sources[${index}].analysisDisposition`, 'Context-only sources must be represented without AST indexing or compiler-root standing.');
		}
		const sourceProvenance = provenance(source.provenanceId, source.projectId, 'TS_PROJECT', `$.sources[${index}].provenanceId`, source.id);
		if ((source.origin === 'UNKNOWN' || !['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)) && sourceProvenance?.epistemic.capabilityCoverage !== 'partial') issue('INVALID_VALUE', `$.sources[${index}].provenanceId`, 'Unknown origin or lossy mapping requires partial source coverage.');
		if (source.analysisDisposition === 'DEEP_INDEXED') {
			if (source.syntaxProvenanceId === null) issue('DANGLING_REFERENCE', `$.sources[${index}].syntaxProvenanceId`, 'Deep-indexed source requires its exact TS_SYNTAX provenance binding.');
			else provenance(source.syntaxProvenanceId, source.projectId, 'TS_SYNTAX', `$.sources[${index}].syntaxProvenanceId`, source.id);
		} else if (source.syntaxProvenanceId !== null) issue('INVALID_VALUE', `$.sources[${index}].syntaxProvenanceId`, 'Context-only source must not claim TS_SYNTAX provenance.');
		if (!sameMembers(source.diagnosticIds, (diagnosticsBySource.get(source.id) ?? []).map((diagnostic) => diagnostic.id))) issue('DANGLING_REFERENCE', `$.sources[${index}].diagnosticIds`, 'Source diagnostic manifest must exactly cover every source-bound diagnostic.');
		for (const diagnosticId of source.diagnosticIds) if (diagnosticById.get(diagnosticId)?.sourceId !== source.id) issue('CROSS_PROJECT_REFERENCE', `$.sources[${index}].diagnosticIds`, 'Source diagnostic belongs elsewhere.');
	}

	const siblingKeys = new Set<string>();
	for (const [index, node] of snapshot.astNodes.entries()) {
		const source = sourceById.get(node.sourceId);
		if (!source || source.analysisDisposition !== 'DEEP_INDEXED') issue('CROSS_PROJECT_REFERENCE', `$.astNodes[${index}].sourceId`, 'Node source is absent or context-only.');
		if (!Number.isSafeInteger(node.fullStart) || !Number.isSafeInteger(node.start) || !Number.isSafeInteger(node.end) || node.fullStart < 0 || node.fullStart > node.start || node.start > node.end || (source && node.end > source.textLength)) issue('INVALID_VALUE', `$.astNodes[${index}]`, 'Node UTF-16 span is invalid.');
		if (node.structuralRoles.length === 0 || !isCanonicalSet(node.structuralRoles)) issue('NONCANONICAL_ORDER', `$.astNodes[${index}].structuralRoles`, 'AST structural roles must be a non-empty canonical set.');
		if (!node.structuralRoles.every((role) => SEMANTIC_AST_STRUCTURAL_ROLES.includes(role))) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'AST structural roles must belong to the closed semantic role vocabulary.');
		if (node.parentId === null) {
			if (node.structuralRoles.length !== 1 || node.structuralRoles[0] !== AST_STRUCTURAL_ROLES.sourceFile) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'A source root must carry exactly the source-file role.');
		} else {
			if (!node.structuralRoles.includes(AST_STRUCTURAL_ROLES.genericChild) || node.structuralRoles.includes(AST_STRUCTURAL_ROLES.sourceFile)) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'Every retained child must carry generic-child and must not carry source-file.');
			const invocationRoleCount = [AST_STRUCTURAL_ROLES.invocationCallee, AST_STRUCTURAL_ROLES.invocationArgument, AST_STRUCTURAL_ROLES.invocationTemplate].filter((role) => node.structuralRoles.includes(role)).length;
			if (invocationRoleCount > 1) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'A child cannot simultaneously occupy multiple invocation roles.');
			if (node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentTarget) && node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue)) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'A child cannot simultaneously be an assignment target and value.');
		}
		const expected = semanticNodeId({ end: node.end, fullStart: node.fullStart, kind: node.kind, parentId: node.parentId, siblingOrdinal: node.siblingOrdinal, sourceId: node.sourceId, start: node.start, structuralRoles: node.structuralRoles });
		if (node.id !== expected) issue('IDENTITY_MISMATCH', `$.astNodes[${index}].id`, 'Node identity mismatch.');
		if (typescriptSyntaxKindName(node.kind) !== node.kindName) issue('INVALID_VALUE', `$.astNodes[${index}].kindName`, 'AST kind code and name must agree with the public TypeScript enum.');
		if (node.publicFlags > PUBLIC_NODE_FLAG_MASK || (node.publicFlags & ~PUBLIC_NODE_FLAG_MASK) !== 0) issue('INVALID_VALUE', `$.astNodes[${index}].publicFlags`, 'AST public flags must be a valid bit set from the public TypeScript NodeFlags surface.');
		const identifierKind = node.kind === ts.SyntaxKind.Identifier || node.kind === ts.SyntaxKind.PrivateIdentifier;
		if (identifierKind ? node.syntacticIdentifierText === null : node.syntacticIdentifierText !== null) issue('INVALID_VALUE', `$.astNodes[${index}].syntacticIdentifierText`, 'Syntactic identifier text, including a recovered empty text, must be present exactly for Identifier and PrivateIdentifier nodes.');
		if ((node.operatorKind === null) !== (node.operatorName === null) || node.operatorKind !== null && typescriptSyntaxKindName(node.operatorKind) !== node.operatorName) issue('INVALID_VALUE', `$.astNodes[${index}]`, 'AST operator code and name must be present together and agree with the public TypeScript enum.');
		if (node.hasAssignmentInitializer && !canHaveAssignmentInitializer(node.kind)) issue('INVALID_VALUE', `$.astNodes[${index}].hasAssignmentInitializer`, 'Only the exact TypeScript syntax kinds with assignment initializers may assert one.');
		if (node.operatorKind !== null && ![ts.SyntaxKind.BinaryExpression, ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression].includes(node.kind)) issue('INVALID_VALUE', `$.astNodes[${index}].operatorKind`, 'Only retained operator-bearing expression nodes may carry an operator.');
		if ([ts.SyntaxKind.BinaryExpression, ts.SyntaxKind.PrefixUnaryExpression, ts.SyntaxKind.PostfixUnaryExpression].includes(node.kind) && node.operatorKind === null) issue('INVALID_VALUE', `$.astNodes[${index}].operatorKind`, 'Retained operator-bearing expression nodes require their public SyntaxKind operator.');
		if (node.parentId !== null) {
			const parent = nodeById.get(node.parentId);
			if (!parent) issue('DANGLING_REFERENCE', `$.astNodes[${index}].parentId`, 'Parent node is absent.');
			else if (parent.sourceId !== node.sourceId || parent.fullStart > node.fullStart || parent.end < node.end) issue('CROSS_PROJECT_REFERENCE', `$.astNodes[${index}].parentId`, 'Parent is from another source or does not contain the child.');
			else {
				const invocationRoles: readonly string[] = [AST_STRUCTURAL_ROLES.invocationCallee, AST_STRUCTURAL_ROLES.invocationArgument, AST_STRUCTURAL_ROLES.invocationTemplate];
				if (node.structuralRoles.some((role) => invocationRoles.includes(role)) && semanticInvocationKind(parent.kind) === null) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'Invocation structural roles require an invocation parent.');
				if (node.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName) && semanticDeclarationCandidateRole(parent.kind) === null) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'Declaration-name roles require a declaration-candidate parent.');
				if ((node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentTarget) || node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue)) && semanticAssignmentKind(parent) === null) issue('INVALID_VALUE', `$.astNodes[${index}].structuralRoles`, 'Assignment structural roles require an assignment-bearing parent.');
			}
		}
		const siblingKey = `${node.sourceId}\0${node.parentId ?? '<root>'}\0${node.siblingOrdinal}`;
		if (siblingKeys.has(siblingKey)) issue('DUPLICATE_ID', `$.astNodes[${index}]`, 'Absolute sibling ordinal must be unique within a parent regardless of structural role.');
		siblingKeys.add(siblingKey);
	}
	for (const [parentId, children] of childrenByParent) {
		const ordinals = children.map((node) => node.siblingOrdinal).sort((left, right) => left - right);
		if (!ordinals.every((ordinal, index) => ordinal === index)) issue('INVALID_VALUE', `$.astNodes.${parentId}`, 'Retained children must use the contiguous absolute order produced by the named AST traversal profile.');
	}
	for (const [sourceIndex, source] of snapshot.sources.entries()) {
		if (source.analysisDisposition !== 'DEEP_INDEXED') continue;
		const sourceNodes = nodesBySource.get(source.id) ?? [];
		const roots = sourceNodes.filter((node) => node.parentId === null);
		if (source.rootNodeId === null || roots.length !== 1 || roots[0]?.id !== source.rootNodeId || roots[0]?.kind !== ts.SyntaxKind.SourceFile || roots[0]?.siblingOrdinal !== 0) issue('DANGLING_REFERENCE', `$.sources[${sourceIndex}].rootNodeId`, 'Deep-indexed source requires exactly one declared SourceFile root node at absolute ordinal zero.');
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
					issue('DANGLING_REFERENCE', `$.astNodes.${node.id}`, 'AST parent relation contains a cycle.');
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
				if (depth > snapshot.budgets.maxAstDepth) issue('INVALID_VALUE', '$.budgets.maxAstDepth', `AST node ${member.id} exceeds the producing depth budget.`);
			}
			if (terminal !== source.rootNodeId) issue('DANGLING_REFERENCE', `$.astNodes.${node.id}`, 'Every AST node must reach its declared source root.');
		}
	}

	function enclosingVariableStatement(node: StaticSemanticSnapshot['astNodes'][number]): StaticSemanticSnapshot['astNodes'][number] | undefined {
		let declaration = node;
		if (node.kind === ts.SyntaxKind.BindingElement) {
			let cursor = node.parentId === null ? undefined : nodeById.get(node.parentId);
			while (cursor !== undefined && [ts.SyntaxKind.ArrayBindingPattern, ts.SyntaxKind.BindingElement, ts.SyntaxKind.ObjectBindingPattern].includes(cursor.kind)) cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
			if (cursor?.kind !== ts.SyntaxKind.VariableDeclaration) return undefined;
			declaration = cursor;
		} else if (node.kind !== ts.SyntaxKind.VariableDeclaration) {
			return undefined;
		}
		const declarationList = declaration.parentId === null ? undefined : nodeById.get(declaration.parentId);
		if (declarationList?.kind !== ts.SyntaxKind.VariableDeclarationList) return undefined;
		const statement = declarationList.parentId === null ? undefined : nodeById.get(declarationList.parentId);
		return statement?.kind === ts.SyntaxKind.VariableStatement ? statement : undefined;
	}

	function hasDeclareModifierCarrier(node: StaticSemanticSnapshot['astNodes'][number]): boolean {
		const seen = new Set<string>();
		let cursor: StaticSemanticSnapshot['astNodes'][number] | undefined = node;
		while (cursor !== undefined && !seen.has(cursor.id)) {
			seen.add(cursor.id);
			if ((childrenByParent.get(cursor.id) ?? []).some((child) => child.kind === ts.SyntaxKind.DeclareKeyword)) return true;
			cursor = cursor.parentId === null ? undefined : nodeById.get(cursor.parentId);
		}
		return false;
	}

	for (const [index, candidate] of snapshot.declarationCandidates.entries()) {
		const node = nodeById.get(candidate.nodeId);
		if (!node || node.sourceId !== candidate.sourceId) issue('CROSS_PROJECT_REFERENCE', `$.declarationCandidates[${index}].nodeId`, 'Declaration-candidate node belongs elsewhere or is absent.');
		if (candidate.nameNodeId !== null) nodeReference(candidate.nameNodeId, candidate.sourceId, `$.declarationCandidates[${index}].nameNodeId`);
		const nameNode = candidate.nameNodeId === null ? undefined : nodeById.get(candidate.nameNodeId);
		if (nameNode !== undefined && (nameNode.parentId !== candidate.nodeId || !nameNode.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName))) issue('INVALID_VALUE', `$.declarationCandidates[${index}].nameNodeId`, 'Candidate name must be the retained declaration-name child of the candidate node.');
		const expectedNameState = nameNode === undefined ? 'ANONYMOUS' : semanticDeclarationNameState(nameNode.kind, nameNode.syntacticIdentifierText);
		if (expectedNameState === null || candidate.nameState !== expectedNameState) issue('INVALID_VALUE', `$.declarationCandidates[${index}].nameState`, 'Declaration name state must be derived exactly from the retained name-node SyntaxKind.');
		if (node !== undefined && (!declarationCandidateMatchesNode(node.kind, candidate.candidateRole, candidate.nameState) || candidate.syntaxKind !== node.kind || candidate.syntaxKindName !== node.kindName || typescriptSyntaxKindName(candidate.syntaxKind) !== candidate.syntaxKindName)) issue('INVALID_VALUE', `$.declarationCandidates[${index}]`, 'Declaration-candidate syntax identity and bounded taxonomy must reproduce its retained AST node.');
		const expected = semanticDeclarationCandidateId({ candidateRole: candidate.candidateRole, nodeId: candidate.nodeId, syntaxKind: candidate.syntaxKind });
		if (candidate.id !== expected) issue('IDENTITY_MISMATCH', `$.declarationCandidates[${index}].id`, 'Declaration-candidate identity mismatch.');
		if (candidate.nameState === 'ANONYMOUS' ? candidate.nameNodeId !== null || candidate.syntacticName !== null : candidate.nameNodeId === null) issue('INVALID_VALUE', `$.declarationCandidates[${index}]`, 'Candidate name state must agree with its retained name node.');
		if (candidate.nameState === 'ATOMIC' ? candidate.syntacticName === null || candidate.syntacticName.length === 0 : candidate.syntacticName !== null) issue('INVALID_VALUE', `$.declarationCandidates[${index}].syntacticName`, 'Only atomic candidate names carry non-empty syntactic text.');
		if (candidate.nameState === 'ATOMIC' && nameNode?.syntacticIdentifierText != null && candidate.syntacticName !== nameNode.syntacticIdentifierText) issue('INVALID_VALUE', `$.declarationCandidates[${index}].syntacticName`, 'Atomic identifier names must reproduce their retained identifier text.');
		if (candidate.nameState === 'ATOMIC' && nameNode !== undefined && nameNode.syntacticIdentifierText === null) {
			const nameLiteral = literalByNodeId.get(nameNode.id);
			if (candidate.syntacticName === null || nameLiteral === undefined || nameLiteral.lexemeLength !== candidate.syntacticName.length || nameLiteral.lexemeSha256 !== sha256(candidate.syntacticName)) issue('INVALID_VALUE', `$.declarationCandidates[${index}].syntacticName`, 'Atomic literal names must retain the exact scalar-safe source lexeme bound by the literal lexeme digest.');
		}
		if (candidate.exportCarrierNodeId !== null) nodeReference(candidate.exportCarrierNodeId, candidate.sourceId, `$.declarationCandidates[${index}].exportCarrierNodeId`);
		const localModifierChildren = (childrenByParent.get(candidate.nodeId) ?? []).filter((child) => isTypeScriptModifierKind(child.kind));
		const expectedLocalModifiers = [...new Map(localModifierChildren.map((child) => [`${child.kind}:${child.kindName}`, { code: child.kind, name: child.kindName }])).values()]
			.sort((left, right) => `${left.code}:${left.name}` < `${right.code}:${right.name}` ? -1 : 1);
		const modifierNames = new Set(candidate.localModifiers.map((modifier) => modifier.name));
		const expectedAmbientSyntax = sourceById.get(candidate.sourceId)?.declarationFile === true || node !== undefined && hasDeclareModifierCarrier(node);
		if (candidate.ambientSyntax !== expectedAmbientSyntax) issue('INVALID_VALUE', `$.declarationCandidates[${index}].ambientSyntax`, 'Ambient syntax must exactly reproduce declaration-file or explicit/inherited declare-modifier context.');
		if (!isCanonicalSet(candidate.localModifiers.map((modifier) => `${modifier.code}:${modifier.name}`))) issue('NONCANONICAL_ORDER', `$.declarationCandidates[${index}].localModifiers`, 'Declaration-candidate local modifiers must be a canonical set.');
		for (const [modifierIndex, modifier] of candidate.localModifiers.entries()) if (typescriptSyntaxKindName(modifier.code) !== modifier.name) issue('INVALID_VALUE', `$.declarationCandidates[${index}].localModifiers[${modifierIndex}]`, 'Local modifier code and name must agree with the public TypeScript enum.');
		if (canonicalSemanticJson(candidate.localModifiers) !== canonicalSemanticJson(expectedLocalModifiers)) issue('INVALID_VALUE', `$.declarationCandidates[${index}].localModifiers`, 'Local modifiers must reproduce the deduplicated set of direct modifier children from the named AST traversal profile.');
		const variableCarrier = node === undefined ? undefined : enclosingVariableStatement(node);
		const carrierModifierNames = new Set((variableCarrier === undefined ? [] : childrenByParent.get(variableCarrier.id) ?? []).filter((child) => isTypeScriptModifierKind(child.kind)).map((child) => child.kindName));
		const expectedExport = candidate.syntaxKind === ts.SyntaxKind.ExportSpecifier ? { carrierId: candidate.nodeId, syntax: 'EXPORT_SPECIFIER' as const }
			: candidate.syntaxKind === ts.SyntaxKind.ExportAssignment ? { carrierId: candidate.nodeId, syntax: 'EXPORT_ASSIGNMENT' as const }
				: candidate.syntaxKind === ts.SyntaxKind.NamespaceExport || candidate.syntaxKind === ts.SyntaxKind.NamespaceExportDeclaration ? { carrierId: candidate.nodeId, syntax: 'NAMESPACE_EXPORT' as const }
					: modifierNames.has('DefaultKeyword') ? { carrierId: candidate.nodeId, syntax: 'DEFAULT' as const }
						: modifierNames.has('ExportKeyword') ? { carrierId: candidate.nodeId, syntax: 'EXPLICIT' as const }
							: carrierModifierNames.has('DefaultKeyword') ? { carrierId: variableCarrier!.id, syntax: 'DEFAULT' as const }
								: carrierModifierNames.has('ExportKeyword') ? { carrierId: variableCarrier!.id, syntax: 'EXPLICIT' as const }
									: { carrierId: null, syntax: 'NONE' as const };
		if (candidate.exportSyntax !== expectedExport.syntax || candidate.exportCarrierNodeId !== expectedExport.carrierId) issue('INVALID_VALUE', `$.declarationCandidates[${index}].exportSyntax`, 'Export syntax and carrier must distinguish node-local syntax from the exact enclosing variable-statement carrier.');
	}

	for (const [index, diagnostic] of snapshot.diagnostics.entries()) {
		path(diagnostic.path, `$.diagnostics[${index}].path`);
		if (!projectById.has(diagnostic.projectId)) issue('DANGLING_REFERENCE', `$.diagnostics[${index}].projectId`, 'Diagnostic project is absent.');
		if (diagnostic.sourceId !== null && sourceById.get(diagnostic.sourceId)?.projectId !== diagnostic.projectId) issue('CROSS_PROJECT_REFERENCE', `$.diagnostics[${index}].sourceId`, 'Diagnostic source belongs elsewhere or is absent.');
		const diagnosticSource = diagnostic.sourceId === null ? undefined : sourceById.get(diagnostic.sourceId);
		if ((diagnostic.start === null) !== (diagnostic.end === null) || diagnostic.start !== null && diagnostic.end !== null && (diagnostic.start > diagnostic.end || diagnosticSource !== undefined && diagnostic.end > diagnosticSource.textLength)) issue('INVALID_VALUE', `$.diagnostics[${index}]`, 'Diagnostic UTF-16 span is invalid.');
		if (diagnostic.locationKind === 'NONE' && (diagnostic.sourceId !== null || diagnostic.path !== null || diagnostic.start !== null || diagnostic.end !== null)
			|| diagnostic.locationKind === 'PATH' && (diagnostic.sourceId !== null || diagnostic.path === null)
			|| diagnostic.locationKind === 'SOURCE' && (diagnostic.sourceId === null || diagnostic.path === null)) issue('INVALID_VALUE', `$.diagnostics[${index}].locationKind`, 'Diagnostic location discriminator must exactly govern source, path, and span fields.');
		if (diagnostic.locationKind === 'SOURCE' && (diagnosticSource === undefined || diagnostic.path !== diagnosticSource.logicalPath)) issue('CROSS_PROJECT_REFERENCE', `$.diagnostics[${index}].path`, 'Source-bound diagnostic source and logical path disagree.');
		if (!/^TS[1-9][0-9]*$/u.test(diagnostic.code)) issue('INVALID_VALUE', `$.diagnostics[${index}].code`, 'Diagnostic code must be exactly TS followed by a positive decimal TypeScript code.');
		diagnosticMessage(diagnostic.message, `$.diagnostics[${index}].message`);
		for (const [relatedIndex, related] of diagnostic.related.entries()) {
			path(related.path, `$.diagnostics[${index}].related[${relatedIndex}].path`);
			if (!/^TS[1-9][0-9]*$/u.test(related.code)) issue('INVALID_VALUE', `$.diagnostics[${index}].related[${relatedIndex}].code`, 'Related diagnostic code must be exactly TS followed by a positive decimal TypeScript code.');
			diagnosticMessage(related.message, `$.diagnostics[${index}].related[${relatedIndex}].message`);
			const relatedSource = related.path === null || !referenceCheck() ? undefined : sourceByProjectPath.get(`${diagnostic.projectId}\0${related.path}`);
			if (related.path === null && related.start !== null) issue('INVALID_VALUE', `$.diagnostics[${index}].related[${relatedIndex}]`, 'A related diagnostic span requires a logical path.');
			if ((related.start === null) !== (related.end === null) || related.start !== null && related.end !== null && (related.start > related.end || relatedSource !== undefined && related.end > relatedSource.textLength)) issue('INVALID_VALUE', `$.diagnostics[${index}].related[${relatedIndex}]`, 'Related diagnostic span is invalid or outside its project source.');
		}
		if (!Number.isSafeInteger(diagnostic.multiplicity) || diagnostic.multiplicity < 1) issue('INVALID_VALUE', `$.diagnostics[${index}].multiplicity`, 'Diagnostic multiplicity must be a positive safe integer.');
		if (!isCanonicalMultiset(diagnostic.related.map((related) => canonicalSemanticJson(related)))) issue('NONCANONICAL_ORDER', `$.diagnostics[${index}].related`, 'Related diagnostic payloads must form a canonical sorted multiset; duplicates are retained.');
		const expected = semanticDiagnosticId({ category: diagnostic.category, code: diagnostic.code, end: diagnostic.end, family: diagnostic.family, locationKind: diagnostic.locationKind, message: diagnostic.message, path: diagnostic.path, projectId: diagnostic.projectId, related: diagnostic.related, sourceId: diagnostic.sourceId, start: diagnostic.start });
		if (diagnostic.id !== expected) issue('IDENTITY_MISMATCH', `$.diagnostics[${index}].id`, 'Diagnostic identity mismatch.');
		provenance(diagnostic.provenanceId, diagnostic.projectId, 'TS_PROJECT', `$.diagnostics[${index}].provenanceId`, diagnostic.locationKind === 'SOURCE' && diagnostic.start !== null ? diagnostic.sourceId ?? undefined : undefined);
	}

	const compilerQueryKeys = new Set<string>();
	for (const [index, observation] of snapshot.compilerInputs.entries()) {
		path(observation.logicalPath, `$.compilerInputs[${index}].logicalPath`);
		if (!Number.isSafeInteger(observation.invocationCount) || observation.invocationCount < 1) issue('INVALID_VALUE', `$.compilerInputs[${index}].invocationCount`, 'Compiler input invocation count must be a positive safe integer.');
		if (!SHA256.test(observation.resultDigest)) issue('INVALID_VALUE', `$.compilerInputs[${index}].resultDigest`, 'Compiler input result digest is invalid.');
		if (observation.operation === 'READ_FILE' && observation.result === 'PRESENT' && (!SHA256.test(observation.contentSha256) || observation.contentBytes < 0)) issue('INVALID_VALUE', `$.compilerInputs[${index}]`, 'Present READ_FILE result requires bounded content metadata.');
		if (observation.operation === 'GET_DIRECTORIES' || observation.operation === 'READ_DIRECTORY') {
			for (const entry of observation.resultEntries) path(entry, `$.compilerInputs[${index}].resultEntries`);
			if (!isCanonicalSet(observation.resultEntries) || observation.result === 'NOT_DIRECTORY' && observation.resultEntries.length > 0) issue('INVALID_VALUE', `$.compilerInputs[${index}].resultEntries`, 'Directory observations require canonical results and empty missing-directory results.');
			if (observation.resultEntries.length > observation.scannedEntries) issue('INVALID_VALUE', `$.compilerInputs[${index}].scannedEntries`, 'Directory observation cannot retain more results than it scanned.');
			if (observation.result === 'NOT_DIRECTORY' && observation.scannedEntries !== 0) issue('INVALID_VALUE', `$.compilerInputs[${index}].scannedEntries`, 'A missing directory must report zero scanned entries.');
		}
		if (observation.operation === 'READ_DIRECTORY') for (const values of [observation.excludes, observation.extensions, observation.includes]) {
			if (!isCanonicalSet(values)) issue('NONCANONICAL_ORDER', `$.compilerInputs[${index}]`, 'READ_DIRECTORY parameters must be canonical sets.');
			if (values.some((entry) => entry.length > snapshot.budgets.maxPathCharacters)) issue('INVALID_VALUE', `$.compilerInputs[${index}]`, 'READ_DIRECTORY path-like query parameters exceed the producing path-character budget.');
		}
		if ((observation.operation === 'REALPATH' || observation.operation === 'CURRENT_DIRECTORY') && observation.result === 'RESOLVED') path(observation.resolvedLogicalPath, `$.compilerInputs[${index}].resolvedLogicalPath`);
		if (observation.operation === 'CURRENT_DIRECTORY' && (observation.logicalPath !== '.' || observation.resolvedLogicalPath !== '.')) issue('INVALID_VALUE', `$.compilerInputs[${index}]`, 'CURRENT_DIRECTORY is fixed to the logical repository root.');
		if (observation.operation === 'USE_CASE_SENSITIVE_FILE_NAMES' && observation.logicalPath !== '.') issue('INVALID_VALUE', `$.compilerInputs[${index}].logicalPath`, 'Case-sensitivity observation is rooted at the logical repository root.');
		const { id: _resultId, resultDigest: _resultDigest, ...resultFields } = observation;
		if (observation.resultDigest !== compilerInputResultDigest(resultFields)) issue('IDENTITY_MISMATCH', `$.compilerInputs[${index}].resultDigest`, 'Compiler input result digest does not bind its exact observed result.');
		const { id: _id, ...identityFields } = observation;
		if (observation.id !== semanticContextInputId({ ...identityFields, subjectId: snapshot.subjectId })) issue('IDENTITY_MISMATCH', `$.compilerInputs[${index}].id`, 'Compiler input identity mismatch.');
		const queryKey = compilerInputQueryKey(observation);
		if (compilerQueryKeys.has(queryKey)) issue('INVALID_VALUE', `$.compilerInputs[${index}]`, 'A compiler query may have exactly one deterministic captured result.');
		compilerQueryKeys.add(queryKey);
	}
	const filesystemClaims = new Map<string, { directoryAbsent: boolean; directoryPresent: boolean; fileAbsent: boolean; filePresent: boolean; realpathAbsent: boolean; realpathResolved: boolean }>();
	for (const observation of snapshot.compilerInputs) {
		const claims = filesystemClaims.get(observation.logicalPath) ?? { directoryAbsent: false, directoryPresent: false, fileAbsent: false, filePresent: false, realpathAbsent: false, realpathResolved: false };
		if (observation.operation === 'READ_FILE' || observation.operation === 'FILE_EXISTS') {
			claims.filePresent ||= observation.result === 'PRESENT';
			claims.fileAbsent ||= observation.result === 'ABSENT';
		}
		if (observation.operation === 'DIRECTORY_EXISTS' || observation.operation === 'GET_DIRECTORIES' || observation.operation === 'READ_DIRECTORY') {
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
		if (claims.filePresent && claims.fileAbsent || claims.directoryPresent && claims.directoryAbsent || claims.filePresent && claims.directoryPresent
			|| claims.realpathAbsent && (claims.realpathResolved || claims.filePresent)) issue('INVALID_VALUE', '$.compilerInputs', `Compiler filesystem observations disagree on the stable path kind or existence for ${logicalPath}.`);
	}
	const claimedContextIds = snapshot.projects.flatMap((project) => project.contextInputIds);
	if (!sameMembers(claimedContextIds, contextIds)) issue('DANGLING_REFERENCE', '$.compilerInputs', 'Compiler-input closure must equal the exact union claimed by projects.');

	function nodeReference(nodeId: string, sourceId: string, jsonPath: string): void {
		if (!referenceCheck()) return;
		const node = nodeById.get(nodeId as never);
		if (!node) issue('DANGLING_REFERENCE', jsonPath, 'Referenced node is absent.');
		else if (node.sourceId !== sourceId) issue('CROSS_PROJECT_REFERENCE', jsonPath, 'Referenced node belongs elsewhere.');
	}

	for (const [index, literal] of snapshot.literals.entries()) {
		nodeReference(literal.nodeId, literal.sourceId, `$.literals[${index}].nodeId`);
		const literalNode = nodeById.get(literal.nodeId);
		const literalDescriptor = literalNode === undefined ? null : semanticLiteralDescriptor(literalNode.kind);
		const encodingMatchesNode = literalNode !== undefined && (literal.valueEncoding === 'UTF16_CODE_UNITS_LE'
			? isUtf16CodeUnitLiteralKind(literalNode.kind)
			: literalDescriptor?.valueEncoding === literal.valueEncoding);
		if (literalNode !== undefined && (literalDescriptor?.valueType !== literal.valueType || !encodingMatchesNode
			|| literal.valueState === 'EXACT' && !literalValueMatchesNodeKind(literalNode.kind, literal.valueType, literal.valueEncoding, literal.value))) issue('INVALID_VALUE', `$.literals[${index}]`, 'Literal type, encoding, and fixed value must agree with the retained literal AST node kind.');
		if (!SHA256.test(literal.valueSha256) || !SHA256.test(literal.lexemeSha256)) issue('INVALID_VALUE', `$.literals[${index}]`, 'Literal value and lexeme digests must be lowercase SHA-256.');
		if (literalNode !== undefined && literal.lexemeLength !== literalNode.end - literalNode.start) issue('INVALID_VALUE', `$.literals[${index}].lexemeLength`, 'Literal lexeme length must bind the retained source span exactly.');
		if (literal.valueState === 'EXACT') {
			const expectedLength = literalValueLength(literal.value);
			if (!exactLiteralValueType(literal.valueType, literal.value) || literal.valueLength !== expectedLength || literal.valueSha256 !== literalValueDigest(literal.valueEncoding, literal.valueType, literal.value) || literal.valueLength > snapshot.budgets.maxLiteralCharacters) issue('INVALID_VALUE', `$.literals[${index}]`, 'Exact literal type, encoding, length, digest, or budget is incoherent.');
		} else if (literal.valueEncoding === 'UTF16_CODE_UNITS_LE') {
			if (literal.value !== null || literal.valueLength < 1 || literalNode === undefined || !isUtf16CodeUnitLiteralKind(literalNode.kind)) issue('INVALID_VALUE', `$.literals[${index}]`, 'UTF-16-code-unit literals must redact a non-scalar cooked string and retain its original code-unit length and digest.');
		} else if (literal.value !== null || literal.valueLength <= snapshot.budgets.maxLiteralCharacters || ['NULL', 'BOOLEAN'].includes(literal.valueType)) {
			issue('INVALID_VALUE', `$.literals[${index}]`, 'Ordinary digest-only literals must redact an over-limit textual value.');
		}
	}
	for (const [index, invocation] of snapshot.invocations.entries()) {
		nodeReference(invocation.nodeId, invocation.sourceId, `$.invocations[${index}].nodeId`);
		nodeReference(invocation.calleeNodeId, invocation.sourceId, `$.invocations[${index}].calleeNodeId`);
		for (const argumentId of invocation.argumentNodeIds) nodeReference(argumentId, invocation.sourceId, `$.invocations[${index}].argumentNodeIds`);
		if (invocation.templateNodeId !== null) nodeReference(invocation.templateNodeId, invocation.sourceId, `$.invocations[${index}].templateNodeId`);
		const invocationNode = nodeById.get(invocation.nodeId);
		const invocationChildren = childrenByParent.get(invocation.nodeId) ?? [];
		const calleeChildren = invocationChildren.filter((node) => node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationCallee));
		const argumentChildren = invocationChildren.filter((node) => node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationArgument)).sort((left, right) => left.siblingOrdinal - right.siblingOrdinal);
		const templateChildren = invocationChildren.filter((node) => node.structuralRoles.includes(AST_STRUCTURAL_ROLES.invocationTemplate));
		const expected = semanticInvocationSiteId({ invocationKind: invocation.invocationKind, nodeId: invocation.nodeId });
		if (invocation.id !== expected) issue('IDENTITY_MISMATCH', `$.invocations[${index}].id`, 'Invocation-site identity mismatch.');
		const expectedOptional = invocation.invocationKind === 'CALL' && invocationNode !== undefined && (invocationNode.publicFlags & ts.NodeFlags.OptionalChain) !== 0;
		const variantCoherent = invocation.invocationKind === 'CALL'
			? invocation.templateNodeId === null && invocation.optional === expectedOptional
			: invocation.invocationKind === 'NEW'
				? invocation.templateNodeId === null && invocation.optional === false
				: invocation.templateNodeId !== null && invocation.optional === false && invocation.argumentNodeIds.length === 0;
		if (semanticInvocationKind(invocationNode?.kind ?? -1) !== invocation.invocationKind || !variantCoherent
			|| calleeChildren.length !== 1 || calleeChildren[0]!.id !== invocation.calleeNodeId
			|| invocation.argumentNodeIds.length !== argumentChildren.length || !invocation.argumentNodeIds.every((id, argumentIndex) => id === argumentChildren[argumentIndex]!.id)
			|| templateChildren.length !== (invocation.invocationKind === 'TAGGED_TEMPLATE' ? 1 : 0)
			|| (invocation.invocationKind === 'TAGGED_TEMPLATE' && templateChildren[0]!.id !== invocation.templateNodeId)) issue('INVALID_VALUE', `$.invocations[${index}]`, 'Invocation projection must reproduce its exact call, new, or tagged-template variant and absolute child order.');
	}
	for (const [index, assignment] of snapshot.assignments.entries()) {
		nodeReference(assignment.nodeId, assignment.sourceId, `$.assignments[${index}].nodeId`);
		nodeReference(assignment.targetNodeId, assignment.sourceId, `$.assignments[${index}].targetNodeId`);
		if (assignment.valueNodeId !== null) nodeReference(assignment.valueNodeId, assignment.sourceId, `$.assignments[${index}].valueNodeId`);
		const assignmentNode = nodeById.get(assignment.nodeId);
		const assignmentChildren = childrenByParent.get(assignment.nodeId) ?? [];
		const targetChildren = assignmentChildren.filter((node) => node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentTarget));
		const valueChildren = assignmentChildren.filter((node) => node.structuralRoles.includes(AST_STRUCTURAL_ROLES.assignmentValue));
		const derivedAssignmentKind = assignmentNode === undefined ? null : semanticAssignmentKind(assignmentNode);
		const expectedOperatorKind = derivedAssignmentKind === 'INITIALIZER' ? ts.SyntaxKind.EqualsToken : assignmentNode?.operatorKind ?? null;
		const requiresValue = derivedAssignmentKind === 'BINARY' || derivedAssignmentKind === 'INITIALIZER';
		if (derivedAssignmentKind !== assignment.assignmentKind || targetChildren.length !== 1 || targetChildren[0]!.id !== assignment.targetNodeId
			|| valueChildren.length !== (requiresValue ? 1 : 0) || (requiresValue ? valueChildren[0]!.id !== assignment.valueNodeId : assignment.valueNodeId !== null)
			|| assignment.valueNodeId !== null && assignment.targetNodeId === assignment.valueNodeId
			|| expectedOperatorKind === null || assignment.operatorKind !== expectedOperatorKind || assignment.operatorName !== typescriptSyntaxKindName(expectedOperatorKind)) issue('INVALID_VALUE', `$.assignments[${index}]`, 'Assignment projection must reproduce its retained kind, operator, target, and value children.');
	}
	const candidateNameParentIds = new Set(snapshot.astNodes.filter((node) => node.structuralRoles.includes(AST_STRUCTURAL_ROLES.declarationName) && node.parentId !== null).map((node) => node.parentId));
	const conditionallyNamedCandidateKinds = new Set<number>([ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ClassExpression, ts.SyntaxKind.ImportClause]);
	const expectedDeclarationCandidates = snapshot.astNodes.filter((node) => semanticDeclarationCandidateRole(node.kind) !== null
		&& (!conditionallyNamedCandidateKinds.has(node.kind) || candidateNameParentIds.has(node.id))).map((node) => node.id);
	const expectedLiterals = snapshot.astNodes.filter((node) => isSemanticLiteralKind(node.kind)).map((node) => node.id);
	const expectedInvocations = snapshot.astNodes.filter((node) => semanticInvocationKind(node.kind) !== null).map((node) => node.id);
	const expectedAssignments = snapshot.astNodes.filter((node) => semanticAssignmentKind(node) !== null).map((node) => node.id);
	if (!sameMembers(snapshot.declarationCandidates.map((record) => record.nodeId), expectedDeclarationCandidates)) issue('POPULATION_MISMATCH', '$.declarationCandidates', 'Declaration-candidate projection must be total over the exact bounded retained-AST taxonomy.');
	if (!sameMembers(snapshot.literals.map((record) => record.nodeId), expectedLiterals)) issue('POPULATION_MISMATCH', '$.literals', 'Literal projection must be total over the retained AST.');
	if (!sameMembers(snapshot.invocations.map((record) => record.nodeId), expectedInvocations)) issue('POPULATION_MISMATCH', '$.invocations', 'Invocation projection must be total over call, new, and tagged-template nodes in the retained AST.');
	if (!sameMembers(snapshot.assignments.map((record) => record.nodeId), expectedAssignments)) issue('POPULATION_MISMATCH', '$.assignments', 'Assignment projection must be total over the retained AST.');
	for (const [index, assignment] of snapshot.assignments.entries()) {
		const node = nodeById.get(assignment.nodeId);
		if (node !== undefined && semanticAssignmentKind(node) !== assignment.assignmentKind) issue('INVALID_VALUE', `$.assignments[${index}].assignmentKind`, 'Assignment kind must be derived from its AST node.');
	}

	const populationsByKind = new Map(snapshot.populations.map((record) => [record.kind, record]));
	const populationKinds = snapshot.populations.map((record) => record.kind);
	if (!sameMembers(populationKinds, POPULATIONS) || new Set(populationKinds).size !== POPULATIONS.length || !populationKinds.every((kind, index) => kind === POPULATIONS[index])) issue('POPULATION_MISMATCH', '$.populations', 'Every semantic population kind must be reconciled exactly once in registered order.');
	for (const [index, population] of snapshot.populations.entries()) {
		for (const [partition, values] of Object.entries(population.members)) if (!isCanonicalSet(values)) issue('NONCANONICAL_ORDER', `$.populations[${index}].members.${partition}`, 'Population witness manifests must be canonical sets.');
		const recomputed = semanticPopulation(population.kind, population.members, population.expectedZero);
		if (canonicalSemanticJson(population) !== canonicalSemanticJson(recomputed) || !population.reconciles) issue('POPULATION_MISMATCH', `$.populations[${index}]`, 'Population counts and digests must be recomputed from retained partition witnesses.');
	}

	function emitted(kind: SemanticPopulationKind, analyzed: readonly string[], contextOnly: readonly string[] = [], unsupported: readonly string[] = [], unknown: readonly string[] = []): void {
		const population = populationsByKind.get(kind);
		if (!population) return;
		if (!sameMembers(population.members.analyzed, analyzed) || !sameMembers(population.members.contextOnly, contextOnly)
			|| !sameMembers(population.members.unsupported, unsupported) || !sameMembers(population.members.unknown, unknown)) {
			issue('POPULATION_MISMATCH', `$.populations.${kind}`, 'Population emission manifests do not match serialized records.');
		}
	}

	emitted('PROJECT', projectIds);
	emitted('PROGRAM', programIds);
	emitted('SOURCE', snapshot.sources.filter((source) => source.analysisDisposition === 'DEEP_INDEXED').map((source) => source.id), snapshot.sources.filter((source) => source.analysisDisposition === 'CONTEXT_ONLY').map((source) => source.id));
	emitted('AST_NODE', nodeIds);
	emitted('DECLARATION_CANDIDATE', declarationCandidateIds);
	emitted('LITERAL', snapshot.literals.map((record) => record.nodeId));
	emitted('INVOCATION_SITE', invocationIds);
	emitted('ASSIGNMENT', snapshot.assignments.map((record) => record.nodeId));
	emitted('DIAGNOSTIC', diagnosticIds);
	emitted('PROVENANCE', provenanceIds);
	const frameworkMembers = snapshot.projects.flatMap((project) => project.frameworkCandidates.map((candidate) => `${project.id}\0${candidate}`));
	emitted('FRAMEWORK_CANDIDATE', frameworkMembers, [], frameworkMembers);
	emitted('CONTEXT_INPUT', [], contextIds);
	for (const values of [snapshot.literals.map((record) => record.nodeId), snapshot.assignments.map((record) => record.nodeId)]) {
		if (!isCanonicalSet(values)) issue('NONCANONICAL_ORDER', '$', 'Node-backed syntax projections must be unique canonical sets.');
	}
	const invocationNodeIds = snapshot.invocations.map((record) => record.nodeId);
	if (new Set(invocationNodeIds).size !== invocationNodeIds.length) issue('DUPLICATE_ID', '$.invocations', 'Invocation records must reference unique invocation nodes; record order is governed only by invocation identity.');
	if (!sameMembers([...referencedProvenanceIds], provenanceIds)) issue('DANGLING_REFERENCE', '$.provenances', 'Provenance table must equal the transitive closure of fact provenance references.');
	const factProvenanceByCapability: Readonly<Record<'TS_PROJECT' | 'TS_SYNTAX', readonly SemanticFactProvenanceRecord[]>> = {
		TS_PROJECT: snapshot.provenances.filter((record) => referencedProvenanceIds.has(record.id) && record.capability === 'TS_PROJECT'),
		TS_SYNTAX: snapshot.provenances.filter((record) => referencedProvenanceIds.has(record.id) && record.capability === 'TS_SYNTAX')
	};
	const capabilityIsPartial = (capability: 'TS_PROJECT' | 'TS_SYNTAX'): boolean => {
		const factPartial = factProvenanceByCapability[capability].some((record) => record.epistemic.capabilityCoverage === 'partial'
			|| record.epistemic.freshness === 'unknown' || record.epistemic.unresolvedRegions.length > 0
			|| record.limitations.some((limitation) => limitation.closureEffect !== 'NONE'));
		const populationPartial = snapshot.populations.some((population) => populationCapability(population.kind) === capability && (population.failed > 0 || population.unknown > 0 || population.unsupported > 0));
		const limitationPartial = snapshot.limitations.some((limitation) => limitation.capability === capability && limitation.closureEffect !== 'NONE');
		const declaredProjectPartial = snapshot.projects.some((project) => project.partialityReasons.some((reason) => reason.capability === capability));
		const projectExecutionPartial = capability === 'TS_PROJECT' && (snapshot.programs.some((program) => program.diagnosticFamilies.some((family) => family.state === 'FAILED' || family.coverage === 'BOUNDED'))
			|| snapshot.sources.some((source) => source.origin === 'UNKNOWN' || !['EXACT', 'NOT_APPLICABLE'].includes(source.mapping.state)));
		const frameworkSyntaxPartial = capability === 'TS_SYNTAX' && (snapshot.projects.some((project) => project.frameworkCandidates.length > 0)
			|| snapshot.populations.some((population) => population.kind === 'FRAMEWORK_CANDIDATE' && (population.failed > 0 || population.unknown > 0 || population.unsupported > 0)));
		return factPartial || populationPartial || limitationPartial || declaredProjectPartial || projectExecutionPartial || frameworkSyntaxPartial;
	};
	const implementedCapabilityStates = new Map(snapshot.capabilities.filter((entry) => entry.capability === 'TS_PROJECT' || entry.capability === 'TS_SYNTAX').map((entry) => [entry.capability, entry.state]));
	for (const capability of ['TS_PROJECT', 'TS_SYNTAX'] as const) {
		const expectedState = capabilityIsPartial(capability) ? 'PARTIAL' : 'SUPPORTED';
		if (implementedCapabilityStates.get(capability) !== expectedState) issue('INVALID_VALUE', '$.capabilities', `${capability} state must exactly roll up its capability-specific facts and closure losses.`);
	}
	const partialSignal = capabilityIsPartial('TS_PROJECT') || capabilityIsPartial('TS_SYNTAX');
	if ((snapshot.health === 'PARTIAL') !== partialSignal) issue('INVALID_VALUE', '$.health', 'Snapshot health must exactly roll up implemented capability partiality.');
	if (!snapshot.expectedEmpty && snapshot.projects.length === 0) issue('POPULATION_MISMATCH', '$.projects', 'An unexpectedly empty all-project snapshot cannot be complete.');

	for (const declarationCandidateId of declarationCandidateIds) if (!declarationCandidateById.has(declarationCandidateId as never)) issue('DANGLING_REFERENCE', '$.declarationCandidates', 'Declaration-candidate index mismatch.');
	if (budgetExhausted) {
		issue('VALIDATION_BUDGET_EXHAUSTED', '$', 'Semantic validation budget was exhausted.');
		return { issues, state: 'BUDGET_EXHAUSTED' };
	}
	return issues.length === 0 ? { issues: [], state: 'VALID' } : { issues, state: 'INVALID' };
}

function materializeValidationOptions(overrides: unknown): { readonly issue?: SemanticValidationIssue; readonly options?: SemanticValidationOptions } {
	if (overrides === null || typeof overrides !== 'object') {
		return { issue: { code: 'INVALID_SHAPE', message: 'Semantic validation options must be a plain object.', path: '$validationOptions' } };
	}
	if (isProxy(overrides)) {
		return { issue: { code: 'INVALID_SHAPE', message: 'Proxy values are not permitted in semantic validation options.', path: '$validationOptions' } };
	}
	try {
		if (Array.isArray(overrides) || ![Object.prototype, null].includes(Reflect.getPrototypeOf(overrides))) {
			return { issue: { code: 'INVALID_SHAPE', message: 'Semantic validation options must have Object.prototype or null prototype.', path: '$validationOptions' } };
		}
		const ownKeys = Reflect.ownKeys(overrides);
		if (ownKeys.some((key) => typeof key !== 'string')) {
			return { issue: { code: 'INVALID_SHAPE', message: 'Semantic validation options must not contain symbol properties.', path: '$validationOptions' } };
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
				return { issue: { code: 'INVALID_SHAPE', message: `Unknown semantic validation option ${key}.`, path: `$validationOptions.${key}` } };
			}
			const descriptor = Reflect.getOwnPropertyDescriptor(overrides, key);
			if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
				return { issue: { code: 'INVALID_SHAPE', message: 'Semantic validation options must be enumerable data properties.', path: `$validationOptions.${key}` } };
			}
			if (!Number.isSafeInteger(descriptor.value) || descriptor.value <= 0) {
				return { issue: { code: 'INVALID_VALUE', message: 'Semantic validation budgets must be positive safe integers.', path: `$validationOptions.${key}` } };
			}
			options[key as keyof SemanticValidationOptions] = descriptor.value as number;
		}
		return { options };
	} catch (error) {
		return {
			issue: {
				code: 'INVALID_SHAPE',
				message: error instanceof Error ? `Semantic validation option inspection failed closed: ${error.message}` : 'Semantic validation option inspection failed closed.',
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
	if (materializedOptions.issue !== undefined) return { issues: [materializedOptions.issue], state: 'INVALID' };
	const options = materializedOptions.options!;
	let wire;
	try {
		wire = materializeSemanticSnapshotWire(value, options);
	} catch (error) {
		return { issues: [{ code: 'INVALID_SHAPE', message: error instanceof Error ? `Semantic wire inspection failed closed: ${error.message}` : 'Semantic wire inspection failed closed.', path: '$' }], state: 'INVALID' };
	}
	const shapeIssues = wire.issues.slice(0, options.maxIssues);
	if (shapeIssues.length > 0) {
		const budget = shapeIssues.some((issue) => issue.budget);
		return {
			issues: shapeIssues.map((issue) => ({ code: issue.budget ? 'VALIDATION_BUDGET_EXHAUSTED' : issue.message.startsWith('Absolute') ? 'ABSOLUTE_PATH' : 'INVALID_SHAPE', message: issue.message, path: issue.path })),
			state: budget ? 'BUDGET_EXHAUSTED' : 'INVALID'
		};
	}
	try {
		if (wire.value === undefined || wire.canonicalBytes === undefined) return { issues: [{ code: 'INVALID_SHAPE', message: 'Semantic wire inspection produced no inert value or canonical byte count.', path: '$' }], state: 'INVALID' };
		return validateStaticSemanticSnapshotUnsafe(wire.value, wire.canonicalBytes, options, context);
	} catch (error) {
		return {
			issues: [{ code: 'INVALID_SHAPE', message: error instanceof Error ? `Malformed semantic snapshot: ${error.message}` : 'Malformed semantic snapshot.', path: '$' }],
			state: 'INVALID'
		};
	}
}
