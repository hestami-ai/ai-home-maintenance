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
	snapshot: ['assignments', 'astNodes', 'astTraversalProfile', 'budgets', 'canonicalProfile', 'capabilities', 'compilerInputs', 'contextDigest', 'declarationCandidates', 'diagnostics', 'expectedEmpty', 'extractionVersion', 'fullJanCsaa007Conformance', 'health', 'id', 'invocations', 'limitations', 'literals', 'operationVersion', 'populations', 'programs', 'projects', 'provenances', 'provider', 'requestedCapabilities', 'schemaVersion', 'sources', 'subjectId'],
	budgets: SEMANTIC_BUDGET_KEYS,
	provider: ['api', 'id', 'version'],
	capability: ['capability', 'reason', 'state'],
	project: ['configPath', 'contextInputIds', 'diagnosticIds', 'frameworkCandidates', 'health', 'id', 'kind', 'partialityReasons', 'programId', 'programRecipe', 'projectReferences', 'provenanceId', 'rootDisposition', 'rootNames', 'sourceIds'],
	partiality: ['capability', 'code', 'message', 'path'],
	recipe: ['compilerOptions', 'configClosureDigest', 'configPath', 'kind', 'projectReferences', 'projectResolutionDigest', 'provider', 'rootNames'],
	'recipe-provider': ['id', 'version'],
	provenance: ['capability', 'epistemic', 'extractionVersion', 'id', 'invalidationDependencies', 'limitations', 'parentProvenanceId', 'projectId', 'provider', 'snapshotId', 'sourceId', 'subjectId'],
	epistemic: ['capabilityCoverage', 'conflict', 'executionHealth', 'freshness', 'inference', 'rationale', 'supportBasis', 'unresolvedRegions'],
	'support-basis': ['kind', 'method', 'rationale', 'sourceRefs'],
	invalidation: ['digest', 'kind'],
	limitation: ['capability', 'closureEffect', 'reason', 'region'],
	program: ['checkerState', 'contextDigest', 'diagnosticFamilies', 'diagnosticIds', 'id', 'projectId', 'provenanceId', 'rootSourceIds', 'sourceIds'],
	'diagnostic-family': ['coverage', 'diagnosticIds', 'family', 'manifestDigest', 'occurrenceCount', 'reason', 'recordCount', 'state'],
	source: ['analysisDisposition', 'artifactClass', 'artifactRoles', 'bytes', 'contentSha256', 'declarationFile', 'diagnosticIds', 'id', 'languageVariant', 'logicalPath', 'mapping', 'origin', 'programId', 'projectId', 'provenanceId', 'rootFile', 'rootNodeId', 'scriptKind', 'scriptKindName', 'syntaxProvenanceId', 'textLength'],
	mapping: ['reason', 'state'],
	node: ['end', 'fullStart', 'hasAssignmentInitializer', 'id', 'kind', 'kindName', 'operatorKind', 'operatorName', 'parentId', 'publicFlags', 'siblingOrdinal', 'sourceId', 'start', 'structuralRoles', 'syntacticIdentifierText'],
	'declaration-candidate': ['ambientSyntax', 'candidateRole', 'candidateState', 'exportCarrierNodeId', 'exportSyntax', 'id', 'localModifiers', 'nameNodeId', 'nameState', 'nodeId', 'sourceId', 'syntacticName', 'syntaxKind', 'syntaxKindName'],
	modifier: ['code', 'name'],
	literal: ['lexemeLength', 'lexemeSha256', 'nodeId', 'sourceId', 'value', 'valueEncoding', 'valueLength', 'valueSha256', 'valueState', 'valueType'],
	invocation: ['argumentNodeIds', 'calleeNodeId', 'id', 'invocationKind', 'nodeId', 'optional', 'sourceId', 'targetState', 'templateNodeId'],
	assignment: ['assignmentKind', 'nodeId', 'operatorKind', 'operatorName', 'sourceId', 'targetNodeId', 'valueNodeId'],
	diagnostic: ['category', 'code', 'end', 'family', 'id', 'locationKind', 'message', 'multiplicity', 'path', 'projectId', 'provenanceId', 'related', 'sourceId', 'start'],
	'diagnostic-message': ['category', 'code', 'next', 'text', 'textEncoding', 'textLength', 'textSha256'],
	'diagnostic-related': ['category', 'code', 'end', 'message', 'path', 'start'],
	'compiler-input': ['id', 'logicalPath', 'operation', 'origin', 'result', 'resultDigest'],
	population: ['analyzed', 'contextOnly', 'discovered', 'excluded', 'excludedByPolicy', 'expectedZero', 'failed', 'included', 'kind', 'manifests', 'members', 'reconciles', 'unknown', 'unsupported'],
	'population-manifests': ['analyzed', 'contextOnly', 'discovered', 'excluded', 'excludedByPolicy', 'failed', 'included', 'unknown', 'unsupported'],
	'population-members': ['analyzed', 'contextOnly', 'excluded', 'excludedByPolicy', 'failed', 'unknown', 'unsupported']
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
	'diagnostic.message': 'diagnostic-message',
	'diagnostic-related.message': 'diagnostic-message',
	'population.manifests': 'population-manifests',
	'population.members': 'population-members'
};

const ARRAY_CHILD: Readonly<Record<string, string>> = {
	'snapshot.assignments': 'assignment',
	'snapshot.astNodes': 'node',
	'snapshot.capabilities': 'capability',
	'snapshot.compilerInputs': 'compiler-input',
	'snapshot.declarationCandidates': 'declaration-candidate',
	'snapshot.diagnostics': 'diagnostic',
	'snapshot.invocations': 'invocation',
	'snapshot.limitations': 'limitation',
	'snapshot.literals': 'literal',
	'snapshot.populations': 'population',
	'snapshot.programs': 'program',
	'snapshot.projects': 'project',
	'snapshot.provenances': 'provenance',
	'snapshot.requestedCapabilities': 'scalar',
	'snapshot.sources': 'source',
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
	'compiler-input.logicalPath', 'compiler-input.resolvedLogicalPath', 'diagnostic.path', 'diagnostic-related.path', 'partiality.path',
	'project.configPath', 'recipe.configPath', 'source.logicalPath'
]);
const PATH_ARRAY_FIELDS = new Set([
	'compiler-input.resultEntries', 'project.frameworkCandidates', 'project.projectReferences', 'project.rootNames', 'recipe.projectReferences', 'recipe.rootNames'
]);

const BOOLEAN_FIELDS = new Set([
	'snapshot.expectedEmpty', 'population.expectedZero', 'population.reconciles', 'source.declarationFile', 'source.rootFile',
	'declaration-candidate.ambientSyntax', 'invocation.optional', 'node.hasAssignmentInitializer'
]);
const NUMBER_FIELDS = new Set([
	'population.analyzed', 'population.contextOnly', 'population.discovered', 'population.excluded', 'population.excludedByPolicy', 'population.failed', 'population.included', 'population.unknown', 'population.unsupported',
	'diagnostic-family.occurrenceCount', 'diagnostic-family.recordCount', 'diagnostic.multiplicity', 'diagnostic-message.textLength', 'source.bytes', 'source.scriptKind', 'source.textLength', 'node.end', 'node.fullStart', 'node.kind', 'node.publicFlags', 'node.siblingOrdinal', 'node.start',
	'declaration-candidate.syntaxKind', 'modifier.code', 'literal.lexemeLength', 'literal.valueLength', 'assignment.operatorKind', 'compiler-input.contentBytes', 'compiler-input.invocationCount', 'compiler-input.scannedEntries',
	...SEMANTIC_BUDGET_KEYS.map((key) => `budgets.${key}`)
]);
const NULLABLE_NUMBER_FIELDS = new Set(['diagnostic.end', 'diagnostic.start', 'diagnostic-related.end', 'diagnostic-related.start', 'compiler-input.depth', 'diagnostic-message.code', 'node.operatorKind']);
const NULLABLE_STRING_FIELDS = new Set(['partiality.path', 'provenance.parentProvenanceId', 'provenance.sourceId', 'support-basis.method', 'source.rootNodeId', 'source.syntaxProvenanceId', 'node.syntacticIdentifierText', 'node.parentId', 'node.operatorName', 'declaration-candidate.exportCarrierNodeId', 'declaration-candidate.nameNodeId', 'declaration-candidate.syntacticName', 'invocation.templateNodeId', 'assignment.valueNodeId', 'diagnostic.path', 'diagnostic.sourceId', 'diagnostic-related.path']);
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
	'provenance.capability': ['TS_PROJECT', 'TS_SYNTAX'],
	'epistemic.capabilityCoverage': ['supported', 'partial', 'unsupported', 'excluded', 'not-analyzed'],
	'epistemic.conflict': ['unopposed', 'corroborated', 'conflicting', 'corrected', 'superseded'],
	'epistemic.executionHealth': ['succeeded', 'failed', 'timed-out', 'cancelled', 'resource-exhausted', 'malformed-output', 'unavailable', 'not-run'],
	'epistemic.freshness': ['current-for-subject', 'stale', 'invalidated', 'unknown'],
	'epistemic.inference': ['direct', 'derived', 'candidate', 'bounded-inference', 'unknown', 'not-applicable'],
	'support-basis.kind': ['direct-extraction', 'compiler-confirmed', 'derived', 'unknown', 'not-applicable'],
	'invalidation.kind': ['SUBJECT', 'PROJECT_RECIPE', 'CONTEXT_INPUT', 'PROVIDER', 'EXTRACTION'],
	'limitation.capability': ['TS_PROJECT', 'TS_SYNTAX', 'TS_SYMBOL', 'TS_TYPE'],
	'limitation.closureEffect': ['NONE', 'DEGRADES_CLOSURE', 'FATAL'],
	'program.checkerState': ['CREATED'],
	'diagnostic-family.family': ['CONFIGURATION', 'OPTIONS', 'GLOBAL', 'SYNTACTIC', 'SEMANTIC', 'DECLARATION'],
	'diagnostic-family.coverage': ['COMPLETE', 'BOUNDED'],
	'diagnostic-family.state': ['RUN', 'NOT_APPLICABLE', 'FAILED'],
	'source.analysisDisposition': ['DEEP_INDEXED', 'CONTEXT_ONLY'],
	'source.artifactClass': ['MANIFEST', 'LOCKFILE', 'TOOL_CONFIGURATION', 'PROJECT_CONFIGURATION', 'GENERATED_CONFIGURATION', 'PRODUCTION_SOURCE', 'TEST_SOURCE', 'GENERATOR_SOURCE', 'GENERATED_SOURCE', 'SCRIPT', 'VERIFICATION', 'BUILD_OUTPUT', 'CACHE', 'EXTERNAL_DEPENDENCY', 'VENDOR', 'OTHER', 'CONTEXT_ONLY'],
	'source.origin': ['AUTHORED', 'TEST', 'VERIFICATION', 'SCRIPT', 'GENERATOR', 'GENERATED', 'GENERATED_DECLARATION', 'WORKSPACE_BUILD_DECLARATION', 'EXTERNAL_DECLARATION', 'TOOLCHAIN_LIBRARY', 'CONFIGURATION', 'UNKNOWN'],
	'mapping.state': ['EXACT', 'PARTIAL', 'AMBIGUOUS', 'UNAVAILABLE', 'CONFLICTING', 'NOT_APPLICABLE'],
	'literal.valueState': ['EXACT', 'DIGEST_ONLY'],
	'declaration-candidate.candidateRole': ['BINDING', 'MEMBER', 'SIGNATURE', 'IMPORT_ALIAS', 'EXPORT_BINDING', 'JSDOC_BINDING'],
	'declaration-candidate.candidateState': ['SYNTAX_ONLY'],
	'declaration-candidate.exportSyntax': ['NONE', 'EXPLICIT', 'DEFAULT', 'EXPORT_SPECIFIER', 'EXPORT_ASSIGNMENT', 'NAMESPACE_EXPORT'],
	'declaration-candidate.nameState': ['ATOMIC', 'COMPUTED', 'PATTERN', 'MISSING', 'ANONYMOUS'],
	'literal.valueEncoding': ['JSON_SCALAR', 'TYPESCRIPT_TEXT', 'UTF16_CODE_UNITS_LE'],
	'literal.valueType': ['STRING', 'NUMBER', 'BIGINT', 'BOOLEAN', 'NULL', 'REGEXP', 'NO_SUBSTITUTION_TEMPLATE', 'TEMPLATE_HEAD', 'TEMPLATE_MIDDLE', 'TEMPLATE_TAIL'],
	'invocation.invocationKind': ['CALL', 'NEW', 'TAGGED_TEMPLATE'],
	'invocation.targetState': ['SYNTAX_ONLY'],
	'assignment.assignmentKind': ['BINARY', 'INITIALIZER', 'PREFIX_UPDATE', 'POSTFIX_UPDATE'],
	'diagnostic.category': ['WARNING', 'ERROR', 'SUGGESTION', 'MESSAGE'],
	'diagnostic-related.category': ['WARNING', 'ERROR', 'SUGGESTION', 'MESSAGE'],
	'diagnostic.family': ['CONFIGURATION', 'OPTIONS', 'GLOBAL', 'SYNTACTIC', 'SEMANTIC', 'DECLARATION'],
	'diagnostic.locationKind': ['NONE', 'PATH', 'SOURCE'],
	'diagnostic-message.textEncoding': ['UNICODE_SCALAR', 'UTF16_CODE_UNITS_HEX'],
	'compiler-input.byteBudgetClass': ['FROZEN_SUBJECT', 'LIVE_COMPILER_CONTEXT'],
	'compiler-input.operation': ['READ_FILE', 'FILE_EXISTS', 'DIRECTORY_EXISTS', 'GET_DIRECTORIES', 'READ_DIRECTORY', 'REALPATH', 'CURRENT_DIRECTORY', 'USE_CASE_SENSITIVE_FILE_NAMES'],
	'compiler-input.origin': ['AUTHORED', 'TEST', 'VERIFICATION', 'SCRIPT', 'GENERATOR', 'GENERATED', 'GENERATED_DECLARATION', 'WORKSPACE_BUILD_DECLARATION', 'EXTERNAL_DECLARATION', 'TOOLCHAIN_LIBRARY', 'CONFIGURATION', 'UNKNOWN'],
	'compiler-input.result': ['PRESENT', 'ABSENT', 'DIRECTORY', 'NOT_DIRECTORY', 'RESOLVED', 'CASE_SENSITIVE', 'CASE_INSENSITIVE'],
	'population.kind': ['PROJECT', 'PROGRAM', 'SOURCE', 'AST_NODE', 'DECLARATION_CANDIDATE', 'LITERAL', 'INVOCATION_SITE', 'ASSIGNMENT', 'DIAGNOSTIC', 'PROVENANCE', 'FRAMEWORK_CANDIDATE', 'CONTEXT_INPUT']
};

const COMPILER_INPUT_BASE_KEYS = ['id', 'invocationCount', 'logicalPath', 'operation', 'origin', 'result', 'resultDigest'] as const;

function compilerInputKeys(record: Readonly<Record<string, unknown>>): readonly string[] | undefined {
	const operation = record.operation;
	const result = record.result;
	if (operation === 'READ_FILE') return result === 'PRESENT' ? [...COMPILER_INPUT_BASE_KEYS, 'byteBudgetClass', 'contentBytes', 'contentSha256'] : result === 'ABSENT' ? COMPILER_INPUT_BASE_KEYS : undefined;
	if (operation === 'FILE_EXISTS' && (result === 'PRESENT' || result === 'ABSENT')) return COMPILER_INPUT_BASE_KEYS;
	if (operation === 'DIRECTORY_EXISTS' && (result === 'DIRECTORY' || result === 'NOT_DIRECTORY')) return COMPILER_INPUT_BASE_KEYS;
	if (operation === 'GET_DIRECTORIES' && (result === 'DIRECTORY' || result === 'NOT_DIRECTORY')) return [...COMPILER_INPUT_BASE_KEYS, 'resultEntries', 'scannedEntries'];
	if (operation === 'READ_DIRECTORY' && (result === 'DIRECTORY' || result === 'NOT_DIRECTORY')) return [...COMPILER_INPUT_BASE_KEYS, 'depth', 'excludes', 'extensions', 'includes', 'resultEntries', 'scannedEntries'];
	if (operation === 'REALPATH' && result === 'ABSENT') return COMPILER_INPUT_BASE_KEYS;
	if ((operation === 'REALPATH' || operation === 'CURRENT_DIRECTORY') && result === 'RESOLVED') return [...COMPILER_INPUT_BASE_KEYS, 'resolvedLogicalPath'];
	if (operation === 'USE_CASE_SENSITIVE_FILE_NAMES' && (result === 'CASE_SENSITIVE' || result === 'CASE_INSENSITIVE')) return COMPILER_INPUT_BASE_KEYS;
	return undefined;
}

function looksAbsolute(text: string): boolean {
	return /[a-zA-Z]:[\\/]/u.test(text) || /\\\\[^\\\s]+[\\]/u.test(text) || /(?:^|[\s("'=])\/(?!\/)[^\s]+/u.test(text);
}

function validScalar(field: string, value: unknown): boolean {
	if (BOOLEAN_FIELDS.has(field)) return typeof value === 'boolean';
	if (NUMBER_FIELDS.has(field)) return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
	if (NULLABLE_NUMBER_FIELDS.has(field)) return value === null || typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
	if (NULLABLE_STRING_FIELDS.has(field)) return value === null || typeof value === 'string';
	const nullableAllowed = NULLABLE_ENUM_FIELDS[field];
	if (nullableAllowed !== undefined) return value === null || typeof value === 'string' && nullableAllowed.includes(value);
	const allowed = ENUM_FIELDS[field];
	if (allowed !== undefined) return typeof value === 'string' && allowed.includes(value);
	return typeof value === 'string';
}

export interface SemanticWireMaterializationResult {
	readonly canonicalBytes?: number;
	readonly issues: readonly SemanticWireInspectionIssue[];
	readonly value?: unknown;
}

export function materializeSemanticSnapshotWire(value: unknown, options: SemanticWireInspectionOptions): SemanticWireMaterializationResult {
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
		if (stringCharacters > options.maxStringCharacters) issue(true, path, `Wire string characters exceed ${options.maxStringCharacters}.`);
		if (!isUnicodeScalarString(text)) issue(false, path, 'Ordinary semantic wire strings must contain only Unicode scalar values.');
	}

	function accountCanonicalBytes(addition: number, path: string): void {
		if (!Number.isSafeInteger(addition) || addition < 0 || !Number.isSafeInteger(canonicalBytes + addition)) {
			issue(true, path, 'Canonical semantic wire byte count overflowed.');
			return;
		}
		canonicalBytes += addition;
	}

	function canonicalStringBytes(text: string): number {
		for (let index = 0; index < text.length; index += 1) {
			const code = text.charCodeAt(index);
			if (code < 0x20 || code === 0x22 || code === 0x5c || code > 0x7f) return Buffer.byteLength(JSON.stringify(text), 'utf8');
		}
		return text.length + 2;
	}

	function accountCanonicalScalar(input: unknown, path: string): void {
		if (input === null) accountCanonicalBytes(4, path);
		else if (typeof input === 'string') accountCanonicalBytes(canonicalStringBytes(input), path);
		else if (typeof input === 'boolean') accountCanonicalBytes(input ? 4 : 5, path);
		else if (typeof input === 'number' && Number.isFinite(input) && (!Number.isInteger(input) || Number.isSafeInteger(input))) {
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
			issue(true, path, `Object member count ${ownKeys.length} exceeds the remaining wire-value budget ${Math.max(0, options.maxRecords - visited)}.`);
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
		const length = lengthDescriptor !== undefined && 'value' in lengthDescriptor ? lengthDescriptor.value : undefined;
		if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
			issue(false, path, 'Arrays must have a valid safe length.');
			return null;
		}
		if (path === '$.diagnostics' && length > options.maxDiagnostics) {
			issue(true, path, `Diagnostic count exceeds ${options.maxDiagnostics}.`);
			return null;
		}
		if (length > Math.max(0, options.maxRecords - visited)) {
			issue(true, path, `Array length ${length} exceeds the remaining wire-value budget ${Math.max(0, options.maxRecords - visited)}.`);
			return null;
		}
		const ownKeys = Reflect.ownKeys(input);
		if (ownKeys.length !== length + 1 || ownKeys.some((key) => typeof key !== 'string' || key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))) {
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

	function visit(input: unknown, context: string, depth: number, path: string): unknown {
		visited += 1;
		if (visited > options.maxRecords) {
			issue(true, path, `Wire value count exceeds ${options.maxRecords}.`);
			return null;
		}
		if (depth > options.maxDepth) {
			issue(true, path, `Wire depth exceeds ${options.maxDepth}.`);
			return null;
		}
		if (typeof input === 'string') accountString(input, path);
		if (typeof input === 'number' && (!Number.isFinite(input) || Number.isInteger(input) && !Number.isSafeInteger(input))) issue(false, path, 'Wire numbers must be finite and integer values must be safe.');
		if (input === null || typeof input !== 'object') accountCanonicalScalar(input, path);

		if (context === 'scalar' || context === 'path-scalar' || context === 'literal-value') {
			const valid = context === 'literal-value' ? input === null || ['string', 'boolean'].includes(typeof input) : typeof input === 'string';
			if (!valid) issue(false, path, 'Expected a valid scalar.');
			if (context === 'path-scalar' && typeof input === 'string' && looksAbsolute(input)) issue(false, path, 'Absolute paths are not permitted in semantic path fields.');
			return input;
		}
		if (context.startsWith('field:')) {
			const field = context.slice(6);
			if (!validScalar(field, input)) issue(false, path, `Invalid scalar for ${field}.`);
			if (PATH_SCALAR_FIELDS.has(field) && typeof input === 'string' && looksAbsolute(input)) issue(false, path, 'Absolute paths are not permitted in semantic path fields.');
			return input;
		}
		if (context.startsWith('list-or-null:')) return input === null ? null : visit(input, `list:${context.slice(13)}`, depth, path);
		if (context === 'span-or-null') return input === null ? null : visit(input, 'span', depth, path);

		if (context.startsWith('list:')) {
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
				const itemContext = context.slice(5);
				for (let index = 0; index < array.length; index += 1) visit(array[index], itemContext, depth + 1, `${path}[${index}]`);
				return input;
			} finally {
				ancestors.delete(input);
			}
		}

		if (context === 'json' && (input === null || typeof input === 'string' || typeof input === 'boolean' || typeof input === 'number')) return input;
		if (input === null || typeof input !== 'object') {
			issue(false, path, context === 'json' ? 'Expected a JSON-compatible value.' : `Expected a closed ${context} object.`);
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
				for (const [key, child] of Object.entries(record)) visit(child, 'json', depth + 1, `${path}.${key}`);
				return input;
			}
			const allowed = context === 'compiler-input' ? compilerInputKeys(record) : KEYS[context];
			if (allowed === undefined) {
				issue(false, path, `Invalid closed ${context} discriminator.`);
				return null;
			}
			for (const key of Object.keys(record)) if (!allowed.includes(key)) issue(false, `${path}.${key}`, `Unknown field ${key}.`);
			for (const key of allowed) {
				if (!Object.hasOwn(record, key)) {
					issue(false, `${path}.${key}`, `Missing required field ${key}.`);
					continue;
				}
				let childContext = OBJECT_CHILD[`${context}.${key}`] ?? `field:${context}.${key}`;
				const arrayItem = ARRAY_CHILD[`${context}.${key}`];
				if (arrayItem !== undefined) childContext = `list:${arrayItem}`;
				if (arrayItem === 'scalar' && PATH_ARRAY_FIELDS.has(`${context}.${key}`)) childContext = 'list:path-scalar';
				if (context === 'literal' && key === 'value') childContext = 'literal-value';
				visit(record[key], childContext, depth + 1, `${path}.${key}`);
			}
			return input;
		} finally {
			ancestors.delete(input);
		}
	}

	try {
		const materialized = visit(value, 'snapshot', 0, '$');
		return issues.length === 0 ? { canonicalBytes, issues: [], value: materialized } : { issues };
	} catch (error) {
		issue(false, '$', error instanceof Error ? `Semantic wire inspection failed closed: ${error.message}` : 'Semantic wire inspection failed closed.');
		return { issues };
	}
}

export function inspectSemanticSnapshotWire(value: unknown, options: SemanticWireInspectionOptions): SemanticWireInspectionIssue[] {
	return [...materializeSemanticSnapshotWire(value, options).issues];
}
