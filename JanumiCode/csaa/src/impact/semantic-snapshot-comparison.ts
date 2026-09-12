import { posix } from 'node:path';

import type { SemanticSourceRecord, StaticSemanticSnapshot } from '../contracts/semantic.js';
import type { FrozenSubject } from '../contracts/subject.js';
import { compareText } from '../inventory/canonical.js';
import {
	canonicalSemanticJsonPrefixedSha256,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';
import { validateStaticSemanticSnapshot } from '../semantic/validate-snapshot.js';

export const SEMANTIC_SNAPSHOT_COMPARISON_REQUEST_SCHEMA_VERSION =
	'jan-csaa-semantic-snapshot-comparison-request/1.0.0' as const;
export const SEMANTIC_SNAPSHOT_COMPARISON_SCHEMA_VERSION =
	'jan-csaa-semantic-snapshot-comparison/1.0.0' as const;
export const SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION =
	'jan-csaa-compare-semantic-snapshots/1.0.0' as const;
export const SEMANTIC_SNAPSHOT_COMPARISON_CAPABILITY = 'JAN-CSAA-CAP-032' as const;
export const SEMANTIC_SNAPSHOT_COMPARISON_CAPABILITY_STATUS = 'PARTIAL' as const;
export const SEMANTIC_SNAPSHOT_COMPARISON_METHOD =
	'exact-source-path-plus-unique-content-lineage/1.0.0' as const;

export const SEMANTIC_SNAPSHOT_COMPARISON_PROFILE = Object.freeze({
	classificationFields:
		'ANALYSIS_DISPOSITION_ARTIFACT_CLASS_ARTIFACT_ROLES_DECLARATION_LANGUAGE_MODULE_ORIGIN_ROOT_FILE',
	identityKey: 'LOGICAL_PATH',
	lineageInference: 'UNIQUE_UNMATCHED_CONTENT_SHA256',
	population: 'SEMANTIC_SOURCE_RECORDS'
} as const);

export const SEMANTIC_SNAPSHOT_COMPARISON_NONCLAIMS = Object.freeze([
	'BEHAVIOR_PRESERVATION',
	'EXHAUSTIVE_CROSS_REVISION_LINEAGE',
	'NON_IMPACT_OR_SAFE_REMOVAL',
	'SYMBOL_DECLARATION_OR_GRAPH_DELTA',
	'GATE_DECISION_REMEDIATION_OR_DISPOSITION_AUTHORITY'
] as const);

export interface SemanticSnapshotComparisonBudgets {
	readonly maxDeltas: number;
	readonly maxFrontiers: number;
	readonly maxInputSources: number;
	readonly maxLineageCandidates: number;
	readonly maxResultBytes: number;
}

export interface SemanticSnapshotComparisonBinding {
	readonly semanticSnapshotId: StaticSemanticSnapshot['id'];
	readonly subjectId: string;
}

export interface SemanticSnapshotComparisonRequest {
	readonly after: SemanticSnapshotComparisonBinding;
	readonly before: SemanticSnapshotComparisonBinding;
	readonly budgets: SemanticSnapshotComparisonBudgets;
	readonly operationVersion: typeof SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION;
	readonly profile: typeof SEMANTIC_SNAPSHOT_COMPARISON_PROFILE;
	readonly schemaVersion: typeof SEMANTIC_SNAPSHOT_COMPARISON_REQUEST_SCHEMA_VERSION;
}

export type SemanticSnapshotSourceDeltaKind =
	| 'ADDED'
	| 'CONFLICTING_LINEAGE'
	| 'MODIFIED'
	| 'MODIFIED_AND_RECLASSIFIED'
	| 'MOVED'
	| 'MOVED_AND_RENAMED'
	| 'RECLASSIFIED'
	| 'REMOVED'
	| 'RENAMED'
	| 'UNCHANGED';

export interface SemanticSnapshotComparisonSourceReference {
	readonly classificationDigest: string;
	readonly contentSha256: string;
	readonly logicalPath: string;
	readonly provenanceId: string;
	readonly sourceId: string;
	readonly subjectId: string;
}

export interface SemanticSnapshotSourceDelta {
	readonly afterSources: readonly SemanticSnapshotComparisonSourceReference[];
	readonly beforeSources: readonly SemanticSnapshotComparisonSourceReference[];
	readonly certainty: 'CONFIRMED' | 'CONFLICTING' | 'INFERRED';
	readonly id: string;
	readonly kind: SemanticSnapshotSourceDeltaKind;
	readonly ordinal: number;
	readonly reasons: readonly string[];
}

export interface SemanticSnapshotComparisonFrontier {
	readonly kind: 'AFTER_SNAPSHOT_OPEN' | 'AMBIGUOUS_LINEAGE' | 'BEFORE_SNAPSHOT_OPEN';
	readonly ordinal: number;
	readonly reason: string;
	readonly sourcePaths: readonly string[];
}

export interface SemanticSnapshotComparisonResult {
	readonly after: SemanticSnapshotComparisonBinding;
	readonly before: SemanticSnapshotComparisonBinding;
	readonly capability: typeof SEMANTIC_SNAPSHOT_COMPARISON_CAPABILITY;
	readonly capabilityStatus: typeof SEMANTIC_SNAPSHOT_COMPARISON_CAPABILITY_STATUS;
	readonly changedObjects: {
		readonly added: readonly string[];
		readonly conflicting: readonly string[];
		readonly modified: readonly string[];
		readonly moved: readonly string[];
		readonly reclassified: readonly string[];
		readonly removed: readonly string[];
		readonly renamed: readonly string[];
		readonly unknown: readonly string[];
	};
	readonly closure: 'CLOSED_FOR_SELECTED_SOURCE_POPULATIONS' | 'OPEN';
	readonly contentDigest: string;
	readonly coverage: {
		readonly afterSources: number;
		readonly beforeSources: number;
		readonly changedDeltas: number;
		readonly deltas: number;
		readonly frontiers: number;
		readonly lineageCandidatePairs: number;
		readonly unchangedDeltas: number;
	};
	readonly deltas: readonly SemanticSnapshotSourceDelta[];
	readonly frontiers: readonly SemanticSnapshotComparisonFrontier[];
	readonly id: string;
	readonly method: typeof SEMANTIC_SNAPSHOT_COMPARISON_METHOD;
	readonly nonclaims: typeof SEMANTIC_SNAPSHOT_COMPARISON_NONCLAIMS;
	readonly operationVersion: typeof SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION;
	readonly profile: typeof SEMANTIC_SNAPSHOT_COMPARISON_PROFILE;
	readonly schemaVersion: typeof SEMANTIC_SNAPSHOT_COMPARISON_SCHEMA_VERSION;
	readonly unknownChangeState: 'NONE_WITHIN_CLOSED_SOURCE_POPULATIONS' | 'POSSIBLE_OUTSIDE_CAPTURE';
}

export interface SemanticSnapshotComparisonDiagnostic {
	readonly code:
		| 'BUDGET_EXCEEDED'
		| 'IDENTITY_MISMATCH'
		| 'INCOMPARABLE_PROVIDER_PROFILE'
		| 'OPEN_FRONTIER'
		| 'REQUEST_INVALID'
		| 'RESULT_BUDGET_EXCEEDED'
		| 'SNAPSHOT_INVALID';
	readonly message: string;
	readonly path: string | null;
}

export type SemanticSnapshotComparisonOutcome =
	| {
			readonly diagnostics: readonly SemanticSnapshotComparisonDiagnostic[];
			readonly outcome: 'complete' | 'partial';
			readonly result: SemanticSnapshotComparisonResult;
	  }
	| {
			readonly bindings: {
				readonly after: SemanticSnapshotComparisonBinding;
				readonly before: SemanticSnapshotComparisonBinding;
			};
			readonly diagnostics: readonly [SemanticSnapshotComparisonDiagnostic];
			readonly outcome: 'incomparable';
	  }
	| {
			readonly diagnostics: readonly [SemanticSnapshotComparisonDiagnostic];
			readonly outcome: 'unavailable';
	  };

export interface SemanticSnapshotComparisonValidationIssue {
	readonly code: 'EXPECTED_OUTCOME_UNAVAILABLE' | 'OUTCOME_INVALID' | 'OUTCOME_MISMATCH';
	readonly message: string;
}

export type SemanticSnapshotComparisonValidationResult =
	| { readonly issues: readonly []; readonly state: 'VALID' }
	| {
			readonly issues: readonly SemanticSnapshotComparisonValidationIssue[];
			readonly state: 'INVALID';
	  };

const REQUEST_KEYS = [
	'after',
	'before',
	'budgets',
	'operationVersion',
	'profile',
	'schemaVersion'
] as const;
const BINDING_KEYS = ['semanticSnapshotId', 'subjectId'] as const;
const BUDGET_KEYS = [
	'maxDeltas',
	'maxFrontiers',
	'maxInputSources',
	'maxLineageCandidates',
	'maxResultBytes'
] as const;
const PROFILE_KEYS = [
	'classificationFields',
	'identityKey',
	'lineageInference',
	'population'
] as const;
const SAFETY = Object.freeze({
	maxDeltas: 2_000_000,
	maxFrontiers: 2_000_000,
	maxInputSources: 2_000_000,
	maxLineageCandidates: 10_000_000,
	maxResultBytes: 256 * 1024 * 1024
});

class Refusal extends Error {
	constructor(
		readonly code: SemanticSnapshotComparisonDiagnostic['code'],
		message: string,
		readonly path: string | null
	) {
		super(message);
	}
}

function deepFreezeConstructed<Value>(value: Value, seen = new WeakSet<object>()): Value {
	if (value === null || typeof value !== 'object' || seen.has(value)) return value;
	seen.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor !== undefined && 'value' in descriptor)
			deepFreezeConstructed(descriptor.value, seen);
	}
	return Object.freeze(value);
}

function exactRecord(
	value: unknown,
	keys: readonly string[],
	path: string
): Record<string, unknown> {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		isProxyValue(value) ||
		Object.getPrototypeOf(value) !== Object.prototype
	)
		throw new Refusal('REQUEST_INVALID', 'Expected an exact plain-data object.', path);
	const actual = Reflect.ownKeys(value);
	if (actual.some((key) => typeof key !== 'string'))
		throw new Refusal('REQUEST_INVALID', 'Symbol-bearing request objects are unsupported.', path);
	const sorted = (actual as string[]).sort(compareText);
	const expected = [...keys].sort(compareText);
	if (sorted.length !== expected.length || sorted.some((key, index) => key !== expected[index]))
		throw new Refusal('REQUEST_INVALID', 'Object keys do not match the closed schema.', path);
	const result: Record<string, unknown> = {};
	for (const key of expected) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !('value' in descriptor))
			throw new Refusal(
				'REQUEST_INVALID',
				'Accessors are unsupported in request data.',
				`${path}.${key}`
			);
		result[key] = descriptor.value;
	}
	return result;
}

function scalar(value: unknown, path: string): string {
	if (typeof value !== 'string' || value.length === 0 || !isUnicodeScalarString(value))
		throw new Refusal('REQUEST_INVALID', 'Expected a nonempty Unicode-scalar string.', path);
	return value;
}

function binding(value: unknown, path: string): SemanticSnapshotComparisonBinding {
	const record = exactRecord(value, BINDING_KEYS, path);
	return {
		semanticSnapshotId: scalar(
			record.semanticSnapshotId,
			`${path}.semanticSnapshotId`
		) as StaticSemanticSnapshot['id'],
		subjectId: scalar(record.subjectId, `${path}.subjectId`)
	};
}

function profile(value: unknown): typeof SEMANTIC_SNAPSHOT_COMPARISON_PROFILE {
	const record = exactRecord(value, PROFILE_KEYS, '$.profile');
	for (const key of PROFILE_KEYS)
		if (record[key] !== SEMANTIC_SNAPSHOT_COMPARISON_PROFILE[key])
			throw new Refusal(
				'REQUEST_INVALID',
				'The exact declared comparison profile is required.',
				`$.profile.${key}`
			);
	return SEMANTIC_SNAPSHOT_COMPARISON_PROFILE;
}

function request(value: unknown): SemanticSnapshotComparisonRequest {
	const record = exactRecord(value, REQUEST_KEYS, '$');
	if (record.schemaVersion !== SEMANTIC_SNAPSHOT_COMPARISON_REQUEST_SCHEMA_VERSION)
		throw new Refusal('REQUEST_INVALID', 'Unsupported request schema version.', '$.schemaVersion');
	if (record.operationVersion !== SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION)
		throw new Refusal('REQUEST_INVALID', 'Unsupported operation version.', '$.operationVersion');
	const rawBudgets = exactRecord(record.budgets, BUDGET_KEYS, '$.budgets');
	const budgets = {} as Record<(typeof BUDGET_KEYS)[number], number>;
	for (const key of BUDGET_KEYS) {
		const amount = rawBudgets[key];
		if (
			typeof amount !== 'number' ||
			!Number.isSafeInteger(amount) ||
			amount < 1 ||
			amount > SAFETY[key]
		)
			throw new Refusal(
				'REQUEST_INVALID',
				'Comparison budget is outside its safety range.',
				`$.budgets.${key}`
			);
		budgets[key] = amount;
	}
	return {
		after: binding(record.after, '$.after'),
		before: binding(record.before, '$.before'),
		budgets: budgets as unknown as SemanticSnapshotComparisonBudgets,
		operationVersion: SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION,
		profile: profile(record.profile),
		schemaVersion: SEMANTIC_SNAPSHOT_COMPARISON_REQUEST_SCHEMA_VERSION
	};
}

function unavailable(
	code: SemanticSnapshotComparisonDiagnostic['code'],
	message: string,
	path: string | null
): SemanticSnapshotComparisonOutcome {
	return deepFreezeConstructed({
		diagnostics: [{ code, message, path }] as const,
		outcome: 'unavailable' as const
	});
}

function classificationContent(source: SemanticSourceRecord) {
	return {
		analysisDisposition: source.analysisDisposition,
		artifactClass: source.artifactClass,
		artifactRoles: [...source.artifactRoles].sort(compareText),
		declarationFile: source.declarationFile,
		languageVariant: source.languageVariant,
		moduleKind: source.moduleKind,
		origin: source.origin,
		rootFile: source.rootFile
	};
}

function sourceReference(
	source: SemanticSourceRecord,
	subjectId: string
): SemanticSnapshotComparisonSourceReference {
	return {
		classificationDigest: canonicalSemanticJsonPrefixedSha256(
			'source-classification:',
			classificationContent(source)
		),
		contentSha256: source.contentSha256,
		logicalPath: source.logicalPath,
		provenanceId: source.provenanceId,
		sourceId: source.id,
		subjectId
	};
}

interface PendingDelta {
	readonly afterSources: readonly SemanticSnapshotComparisonSourceReference[];
	readonly beforeSources: readonly SemanticSnapshotComparisonSourceReference[];
	readonly certainty: SemanticSnapshotSourceDelta['certainty'];
	readonly kind: SemanticSnapshotSourceDeltaKind;
	readonly reasons: readonly string[];
}

function samePathDelta(
	before: SemanticSnapshotComparisonSourceReference,
	after: SemanticSnapshotComparisonSourceReference
): PendingDelta {
	const contentChanged = before.contentSha256 !== after.contentSha256;
	const classificationChanged = before.classificationDigest !== after.classificationDigest;
	const kind: SemanticSnapshotSourceDeltaKind = contentChanged
		? classificationChanged
			? 'MODIFIED_AND_RECLASSIFIED'
			: 'MODIFIED'
		: classificationChanged
			? 'RECLASSIFIED'
			: 'UNCHANGED';
	const reasons = [
		...(contentChanged ? ['CONTENT_SHA256_CHANGED'] : []),
		...(classificationChanged ? ['SOURCE_CLASSIFICATION_CHANGED'] : []),
		...(!contentChanged && !classificationChanged
			? ['EXACT_PATH_CONTENT_AND_CLASSIFICATION_MATCH']
			: [])
	].sort(compareText);
	return { afterSources: [after], beforeSources: [before], certainty: 'CONFIRMED', kind, reasons };
}

function inferredLineageDelta(
	before: SemanticSnapshotComparisonSourceReference,
	after: SemanticSnapshotComparisonSourceReference
): PendingDelta {
	const sameDirectory = posix.dirname(before.logicalPath) === posix.dirname(after.logicalPath);
	const sameBasename = posix.basename(before.logicalPath) === posix.basename(after.logicalPath);
	const kind: SemanticSnapshotSourceDeltaKind = sameBasename
		? 'MOVED'
		: sameDirectory
			? 'RENAMED'
			: 'MOVED_AND_RENAMED';
	return {
		afterSources: [after],
		beforeSources: [before],
		certainty: 'INFERRED',
		kind,
		reasons: [
			'UNIQUE_UNMATCHED_CONTENT_SHA256_PAIR',
			...(before.classificationDigest === after.classificationDigest
				? []
				: ['SOURCE_CLASSIFICATION_CHANGED_ACROSS_INFERRED_LINEAGE'])
		].sort(compareText)
	};
}

function deltaKey(delta: PendingDelta): string {
	return `${delta.kind}\0${delta.beforeSources.map((source) => source.logicalPath).join('\0')}\0${delta.afterSources.map((source) => source.logicalPath).join('\0')}`;
}

function materializeDeltas(
	beforeSnapshot: StaticSemanticSnapshot,
	afterSnapshot: StaticSemanticSnapshot,
	budgets: SemanticSnapshotComparisonBudgets
): { deltas: SemanticSnapshotSourceDelta[]; lineageCandidatePairs: number } {
	const before = beforeSnapshot.sources.map((source) =>
		sourceReference(source, beforeSnapshot.subjectId)
	);
	const after = afterSnapshot.sources.map((source) =>
		sourceReference(source, afterSnapshot.subjectId)
	);
	const beforeByPath = new Map(before.map((source) => [source.logicalPath, source]));
	const afterByPath = new Map(after.map((source) => [source.logicalPath, source]));
	const pending: PendingDelta[] = [];
	const unmatchedBefore: SemanticSnapshotComparisonSourceReference[] = [];
	const unmatchedAfter: SemanticSnapshotComparisonSourceReference[] = [];
	for (const source of before) {
		const counterpart = afterByPath.get(source.logicalPath);
		if (counterpart === undefined) unmatchedBefore.push(source);
		else pending.push(samePathDelta(source, counterpart));
	}
	for (const source of after)
		if (!beforeByPath.has(source.logicalPath)) unmatchedAfter.push(source);
	const beforeByContent = new Map<string, SemanticSnapshotComparisonSourceReference[]>();
	const afterByContent = new Map<string, SemanticSnapshotComparisonSourceReference[]>();
	for (const source of unmatchedBefore) {
		const group = beforeByContent.get(source.contentSha256) ?? [];
		group.push(source);
		beforeByContent.set(source.contentSha256, group);
	}
	for (const source of unmatchedAfter) {
		const group = afterByContent.get(source.contentSha256) ?? [];
		group.push(source);
		afterByContent.set(source.contentSha256, group);
	}
	let lineageCandidatePairs = 0;
	const contentDigests = [...new Set([...beforeByContent.keys(), ...afterByContent.keys()])].sort(
		compareText
	);
	for (const contentSha256 of contentDigests) {
		const beforeGroup = [...(beforeByContent.get(contentSha256) ?? [])].sort((left, right) =>
			compareText(left.logicalPath, right.logicalPath)
		);
		const afterGroup = [...(afterByContent.get(contentSha256) ?? [])].sort((left, right) =>
			compareText(left.logicalPath, right.logicalPath)
		);
		lineageCandidatePairs += beforeGroup.length * afterGroup.length;
		if (lineageCandidatePairs > budgets.maxLineageCandidates)
			throw new Refusal(
				'BUDGET_EXCEEDED',
				'Lineage candidate pairs exceed maxLineageCandidates.',
				'$.budgets.maxLineageCandidates'
			);
		if (beforeGroup.length === 1 && afterGroup.length === 1) {
			pending.push(inferredLineageDelta(beforeGroup[0]!, afterGroup[0]!));
			continue;
		}
		if (beforeGroup.length > 0 && afterGroup.length > 0) {
			pending.push({
				afterSources: afterGroup,
				beforeSources: beforeGroup,
				certainty: 'CONFLICTING',
				kind: 'CONFLICTING_LINEAGE',
				reasons: ['CONTENT_SHA256_LINEAGE_IS_NOT_ONE_TO_ONE']
			});
			continue;
		}
		for (const source of beforeGroup)
			pending.push({
				afterSources: [],
				beforeSources: [source],
				certainty: 'CONFIRMED',
				kind: 'REMOVED',
				reasons: ['NO_SAME_PATH_OR_UNIQUE_CONTENT_MATCH_IN_AFTER_SNAPSHOT']
			});
		for (const source of afterGroup)
			pending.push({
				afterSources: [source],
				beforeSources: [],
				certainty: 'CONFIRMED',
				kind: 'ADDED',
				reasons: ['NO_SAME_PATH_OR_UNIQUE_CONTENT_MATCH_IN_BEFORE_SNAPSHOT']
			});
	}
	pending.sort((left, right) => compareText(deltaKey(left), deltaKey(right)));
	if (pending.length > budgets.maxDeltas)
		throw new Refusal(
			'BUDGET_EXCEEDED',
			'Comparison deltas exceed maxDeltas.',
			'$.budgets.maxDeltas'
		);
	const deltas = pending.map((delta, ordinal): SemanticSnapshotSourceDelta => {
		const content = { ...delta, ordinal };
		return {
			...content,
			id: canonicalSemanticJsonPrefixedSha256('semantic-source-delta:', content)
		};
	});
	return { deltas, lineageCandidatePairs };
}

function snapshotFrontiers(
	before: StaticSemanticSnapshot,
	after: StaticSemanticSnapshot,
	deltas: readonly SemanticSnapshotSourceDelta[],
	maxFrontiers: number
): SemanticSnapshotComparisonFrontier[] {
	const pending: Omit<SemanticSnapshotComparisonFrontier, 'ordinal'>[] = [];
	if (before.health !== 'COMPLETE' || before.limitations.length > 0)
		pending.push({
			kind: 'BEFORE_SNAPSHOT_OPEN',
			reason: `Before snapshot health is ${before.health} with ${before.limitations.length} explicit limitation(s).`,
			sourcePaths: []
		});
	if (after.health !== 'COMPLETE' || after.limitations.length > 0)
		pending.push({
			kind: 'AFTER_SNAPSHOT_OPEN',
			reason: `After snapshot health is ${after.health} with ${after.limitations.length} explicit limitation(s).`,
			sourcePaths: []
		});
	for (const delta of deltas) {
		if (delta.kind !== 'CONFLICTING_LINEAGE') continue;
		pending.push({
			kind: 'AMBIGUOUS_LINEAGE',
			reason: 'Content-equivalent unmatched sources do not form a unique one-to-one lineage pair.',
			sourcePaths: [...delta.beforeSources, ...delta.afterSources]
				.map((source) => source.logicalPath)
				.sort(compareText)
		});
	}
	pending.sort((left, right) =>
		compareText(
			`${left.kind}\0${left.sourcePaths.join('\0')}`,
			`${right.kind}\0${right.sourcePaths.join('\0')}`
		)
	);
	if (pending.length > maxFrontiers)
		throw new Refusal(
			'BUDGET_EXCEEDED',
			'Comparison frontiers exceed maxFrontiers.',
			'$.budgets.maxFrontiers'
		);
	return pending.map((frontier, ordinal) => ({ ...frontier, ordinal }));
}

function changedPaths(
	deltas: readonly SemanticSnapshotSourceDelta[],
	kinds: readonly SemanticSnapshotSourceDeltaKind[]
): string[] {
	return [
		...new Set(
			deltas
				.filter((delta) => kinds.includes(delta.kind))
				.flatMap((delta) => [...delta.beforeSources, ...delta.afterSources])
				.map((source) => source.logicalPath)
		)
	].sort(compareText);
}

function compatible(before: StaticSemanticSnapshot, after: StaticSemanticSnapshot): boolean {
	return (
		before.schemaVersion === after.schemaVersion &&
		before.extractionVersion === after.extractionVersion &&
		before.provider.api === after.provider.api &&
		before.provider.id === after.provider.id &&
		before.provider.version === after.provider.version
	);
}

export function compareSemanticSnapshots(
	requestValue: unknown,
	beforeSnapshot: StaticSemanticSnapshot,
	afterSnapshot: StaticSemanticSnapshot,
	subjects: { readonly after: FrozenSubject; readonly before: FrozenSubject }
): SemanticSnapshotComparisonOutcome {
	try {
		const accepted = request(requestValue);
		if (
			accepted.before.semanticSnapshotId !== beforeSnapshot.id ||
			accepted.before.subjectId !== beforeSnapshot.subjectId ||
			accepted.after.semanticSnapshotId !== afterSnapshot.id ||
			accepted.after.subjectId !== afterSnapshot.subjectId ||
			accepted.before.subjectId !== subjects.before.descriptor.subjectId ||
			accepted.after.subjectId !== subjects.after.descriptor.subjectId
		)
			throw new Refusal('IDENTITY_MISMATCH', 'Request and snapshot identities differ.', null);
		if (
			beforeSnapshot.sources.length + afterSnapshot.sources.length >
			accepted.budgets.maxInputSources
		)
			throw new Refusal(
				'BUDGET_EXCEEDED',
				'Source populations exceed maxInputSources.',
				'$.budgets.maxInputSources'
			);
		if (!compatible(beforeSnapshot, afterSnapshot))
			return deepFreezeConstructed({
				bindings: { after: accepted.after, before: accepted.before },
				diagnostics: [
					{
						code: 'INCOMPARABLE_PROVIDER_PROFILE' as const,
						message: 'Semantic schema, extraction, and provider identities must match exactly.',
						path: null
					}
				] as const,
				outcome: 'incomparable' as const
			});
		if (
			validateStaticSemanticSnapshot(beforeSnapshot, {}, { frozenSubject: subjects.before })
				.state !== 'VALID' ||
			validateStaticSemanticSnapshot(afterSnapshot, {}, { frozenSubject: subjects.after }).state !==
				'VALID'
		)
			throw new Refusal(
				'SNAPSHOT_INVALID',
				'One or both semantic snapshots failed independent validation.',
				null
			);
		const { deltas, lineageCandidatePairs } = materializeDeltas(
			beforeSnapshot,
			afterSnapshot,
			accepted.budgets
		);
		const frontiers = snapshotFrontiers(
			beforeSnapshot,
			afterSnapshot,
			deltas,
			accepted.budgets.maxFrontiers
		);
		const changedDeltas = deltas.filter((delta) => delta.kind !== 'UNCHANGED').length;
		const closure: SemanticSnapshotComparisonResult['closure'] =
			frontiers.length === 0 ? 'CLOSED_FOR_SELECTED_SOURCE_POPULATIONS' : 'OPEN';
		const content: Omit<SemanticSnapshotComparisonResult, 'contentDigest' | 'id'> = {
			after: accepted.after,
			before: accepted.before,
			capability: SEMANTIC_SNAPSHOT_COMPARISON_CAPABILITY,
			capabilityStatus: SEMANTIC_SNAPSHOT_COMPARISON_CAPABILITY_STATUS,
			changedObjects: {
				added: changedPaths(deltas, ['ADDED']),
				conflicting: changedPaths(deltas, ['CONFLICTING_LINEAGE']),
				modified: changedPaths(deltas, ['MODIFIED', 'MODIFIED_AND_RECLASSIFIED']),
				moved: changedPaths(deltas, ['MOVED', 'MOVED_AND_RENAMED']),
				reclassified: changedPaths(deltas, ['RECLASSIFIED', 'MODIFIED_AND_RECLASSIFIED']),
				removed: changedPaths(deltas, ['REMOVED']),
				renamed: changedPaths(deltas, ['RENAMED', 'MOVED_AND_RENAMED']),
				unknown: changedPaths(deltas, ['CONFLICTING_LINEAGE'])
			},
			closure,
			coverage: {
				afterSources: afterSnapshot.sources.length,
				beforeSources: beforeSnapshot.sources.length,
				changedDeltas,
				deltas: deltas.length,
				frontiers: frontiers.length,
				lineageCandidatePairs,
				unchangedDeltas: deltas.length - changedDeltas
			},
			deltas,
			frontiers,
			method: SEMANTIC_SNAPSHOT_COMPARISON_METHOD,
			nonclaims: SEMANTIC_SNAPSHOT_COMPARISON_NONCLAIMS,
			operationVersion: SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION,
			profile: SEMANTIC_SNAPSHOT_COMPARISON_PROFILE,
			schemaVersion: SEMANTIC_SNAPSHOT_COMPARISON_SCHEMA_VERSION,
			unknownChangeState:
				closure === 'OPEN' ? 'POSSIBLE_OUTSIDE_CAPTURE' : 'NONE_WITHIN_CLOSED_SOURCE_POPULATIONS'
		};
		const id = canonicalSemanticJsonPrefixedSha256('semantic-snapshot-comparison:', content);
		const resultWithoutDigest = { ...content, id };
		const result: SemanticSnapshotComparisonResult = {
			...resultWithoutDigest,
			contentDigest: canonicalSemanticJsonPrefixedSha256('sha256:', resultWithoutDigest)
		};
		if (canonicalSemanticJsonWitness(result).bytes + 1 > accepted.budgets.maxResultBytes)
			throw new Refusal(
				'RESULT_BUDGET_EXCEEDED',
				'Canonical result exceeds maxResultBytes.',
				'$.budgets.maxResultBytes'
			);
		return deepFreezeConstructed({
			diagnostics:
				closure === 'OPEN'
					? [
							{
								code: 'OPEN_FRONTIER' as const,
								message: 'Snapshot coverage or cross-revision lineage remains open.',
								path: null
							}
						]
					: [],
			outcome: closure === 'OPEN' ? ('partial' as const) : ('complete' as const),
			result
		});
	} catch (error) {
		if (error instanceof Refusal) return unavailable(error.code, error.message, error.path);
		return unavailable('REQUEST_INVALID', 'Semantic snapshot comparison failed closed.', null);
	}
}

export function validateSemanticSnapshotComparisonOutcome(
	requestValue: unknown,
	candidate: unknown,
	beforeSnapshot: StaticSemanticSnapshot,
	afterSnapshot: StaticSemanticSnapshot,
	subjects: { readonly after: FrozenSubject; readonly before: FrozenSubject }
): SemanticSnapshotComparisonValidationResult {
	const expected = compareSemanticSnapshots(requestValue, beforeSnapshot, afterSnapshot, subjects);
	if (expected.outcome === 'unavailable')
		return deepFreezeConstructed({
			issues: [
				{
					code: 'EXPECTED_OUTCOME_UNAVAILABLE' as const,
					message: 'The bound inputs do not produce a comparison outcome that can be validated.'
				}
			],
			state: 'INVALID' as const
		});
	try {
		const expectedWitness = canonicalSemanticJsonWitness(expected);
		const candidateWitness = canonicalSemanticJsonWitness(candidate);
		if (
			expectedWitness.bytes !== candidateWitness.bytes ||
			expectedWitness.sha256 !== candidateWitness.sha256
		)
			return deepFreezeConstructed({
				issues: [
					{
						code: 'OUTCOME_MISMATCH' as const,
						message: 'Canonical outcome bytes differ from deterministic reconstruction.'
					}
				],
				state: 'INVALID' as const
			});
		return deepFreezeConstructed({ issues: [] as const, state: 'VALID' as const });
	} catch {
		return deepFreezeConstructed({
			issues: [
				{
					code: 'OUTCOME_INVALID' as const,
					message: 'Candidate comparison outcome is not finite canonical plain data.'
				}
			],
			state: 'INVALID' as const
		});
	}
}
