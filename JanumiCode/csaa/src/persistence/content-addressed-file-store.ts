/**
 * Rebuildable, content-addressed persistence for CSAA analysis artifacts.
 *
 * This module deliberately owns a local, versioned wire contract. Nothing in
 * this cache is authoritative: an incompatible or corrupt store is abandoned
 * and rebuilt from its identity inputs.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
	closeSync,
	existsSync,
	fstatSync,
	fsyncSync,
	lstatSync,
	mkdirSync,
	openSync,
	opendirSync,
	readSync,
	renameSync,
	rmSync,
	unlinkSync,
	writeSync
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { isUint8Array } from 'node:util/types';
import {
	canonicalSemanticJson,
	canonicalSemanticJsonPrefixedSha256,
	canonicalSemanticJsonWitness,
	isProxyValue,
	isUnicodeScalarString
} from '../semantic/canonical.js';

const STORE_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-FILE-STORE@1';
const GENERATION_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-GENERATION@1';
const POINTER_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-CURRENT-POINTER@1';
const PUBLICATION_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-PUBLICATION@1';
const READER_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-READER-PIN@1';
const WRITER_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-WRITER-LOCK@1';
const ACQUISITION_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-LOCK-ACQUISITION@1';
const QUARANTINE_SCHEMA = 'JAN-CSAA-CONTENT-ADDRESSED-QUARANTINE@1';

const FORMAT_FILE = 'format.json';
const CURRENT_FILE = 'current.json';
const LOCK_FILE = '.writer.lock';
const ACQUISITION_FILE = '.writer-acquisition.lock';
const ARTIFACTS_DIRECTORY = 'artifacts';
const GENERATIONS_DIRECTORY = 'generations';
const PUBLICATIONS_DIRECTORY = 'publications';
const READERS_DIRECTORY = 'readers';
const STAGING_DIRECTORY = 'staging';
const QUARANTINE_DIRECTORY = 'quarantine';
const TRASH_DIRECTORY = 'trash';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TOKEN_PATTERN = /^[a-f0-9]{32}$/u;
const TYPED_ARRAY_LENGTH_GETTER_CANDIDATE = Reflect.getOwnPropertyDescriptor(
	Reflect.getPrototypeOf(Uint8Array.prototype) as object,
	'length'
)?.get;

if (TYPED_ARRAY_LENGTH_GETTER_CANDIDATE === undefined)
	throw new Error('The runtime does not expose the intrinsic typed-array length getter.');
const TYPED_ARRAY_LENGTH_GETTER: () => number = TYPED_ARRAY_LENGTH_GETTER_CANDIDATE;

export const CONTENT_ADDRESSED_FILE_STORE_SCHEMAS = Object.freeze({
	store: STORE_SCHEMA,
	generation: GENERATION_SCHEMA,
	pointer: POINTER_SCHEMA,
	publication: PUBLICATION_SCHEMA,
	readerPin: READER_SCHEMA,
	writerLock: WRITER_SCHEMA,
	lockAcquisition: ACQUISITION_SCHEMA
});

export const CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS = Object.freeze({
	maxArtifacts: 4_096,
	maxArtifactBytes: 128 * 1024 * 1024,
	maxTotalArtifactBytes: 1024 * 1024 * 1024,
	maxMetadataBytes: 16 * 1024 * 1024,
	maxDependencyReferences: 16_384,
	maxDirectoryEntries: 16_384,
	maxIdentifierCodeUnits: 1_024,
	maxPublications: 8_192,
	maxReaderPins: 4_096
});

export type ContentAddressedInvalidationKind =
	| 'FILE_CONTENT'
	| 'PARSED_CONFIGURATION'
	| 'LOCKFILE_PROVIDER_VERSION'
	| 'PROJECT_MEMBERSHIP'
	| 'PACKAGE_EXPORTS'
	| 'RULE_QUERY_VERSION'
	| 'ADAPTER_CONFIGURATION'
	| 'GENERATED_SOURCE'
	| 'OTHER_EXPLICIT';

const INVALIDATION_KINDS = new Set<ContentAddressedInvalidationKind>([
	'FILE_CONTENT',
	'PARSED_CONFIGURATION',
	'LOCKFILE_PROVIDER_VERSION',
	'PROJECT_MEMBERSHIP',
	'PACKAGE_EXPORTS',
	'RULE_QUERY_VERSION',
	'ADAPTER_CONFIGURATION',
	'GENERATED_SOURCE',
	'OTHER_EXPLICIT'
]);

export interface ContentAddressedInvalidationInput {
	readonly key: string;
	readonly kind: ContentAddressedInvalidationKind;
	readonly digest: string;
}

export interface ContentAddressedArtifactComputationContext {
	readonly subjectId: string;
	readonly logicalKey: string;
	readonly invalidationInputs: readonly ContentAddressedInvalidationInput[];
	readonly signal: AbortSignal | undefined;
}

export interface ContentAddressedArtifactDefinition {
	readonly logicalKey: string;
	readonly artifactKind: string;
	readonly transformVersion: string;
	readonly dependencyKeys: readonly string[];
	readonly compute: (context: ContentAddressedArtifactComputationContext) => string | Uint8Array;
}

export interface ContentAddressedPublishRequest {
	readonly mode: 'CLEAN' | 'INCREMENTAL';
	readonly expectedCurrentGenerationId: string | null;
	readonly subjectId: string;
	readonly invalidationInputs: readonly ContentAddressedInvalidationInput[];
	readonly outputs: readonly ContentAddressedArtifactDefinition[];
	readonly verifyCleanEquivalence: boolean;
	readonly signal?: AbortSignal;
}

export interface ContentAddressedArtifactReference {
	readonly logicalKey: string;
	readonly artifactKind: string;
	readonly transformVersion: string;
	readonly dependencyKeys: readonly string[];
	readonly dependencyDigest: string;
	readonly sha256: string;
	readonly bytes: number;
}

export interface ContentAddressedPublishResult {
	readonly schema: 'JAN-CSAA-CONTENT-ADDRESSED-PUBLISH-RESULT@1';
	readonly generationId: string;
	readonly publicationGeneration: number;
	readonly mode: 'CLEAN' | 'INCREMENTAL';
	readonly artifacts: readonly ContentAddressedArtifactReference[];
	readonly computedArtifacts: number;
	readonly reusedArtifacts: number;
	readonly computedBytes: number;
	readonly reusedBytes: number;
	readonly cleanEquivalenceVerified: boolean;
}

export interface ContentAddressedInvalidationPlan {
	readonly changedKeys: readonly string[];
	readonly affectedArtifacts: readonly string[];
	readonly reusableArtifacts: readonly string[];
}

export type ContentAddressedRecoveryReason =
	| 'NONE'
	| 'EMPTY_STORE_INITIALIZED'
	| 'MISSING_FORMAT_WITH_STATE'
	| 'CORRUPT_FORMAT'
	| 'UNKNOWN_FORMAT_VERSION'
	| 'CORRUPT_LAYOUT'
	| 'UNEXPECTED_ROOT_ENTRY'
	| 'CORRUPT_CURRENT_GENERATION';

export interface ContentAddressedRecoveryResult {
	readonly schema: 'JAN-CSAA-CONTENT-ADDRESSED-RECOVERY-RESULT@1';
	readonly rebuildRequired: boolean;
	readonly reason: ContentAddressedRecoveryReason;
	readonly currentGenerationId: string | null;
	readonly quarantinedEntries: number;
}

export interface ContentAddressedRetentionRequest {
	readonly keepPublishedGenerations: number;
	readonly signal?: AbortSignal;
}

export interface ContentAddressedRetentionResult {
	readonly schema: 'JAN-CSAA-CONTENT-ADDRESSED-RETENTION-RESULT@1';
	readonly retainedGenerations: readonly string[];
	readonly removedGenerations: number;
	readonly removedArtifacts: number;
}

export type ContentAddressedFileStoreFaultPoint =
	| 'AFTER_STAGING_CREATED'
	| 'AFTER_ARTIFACT_STAGED'
	| 'AFTER_ARTIFACT_PUBLISHED'
	| 'AFTER_GENERATION_STAGED'
	| 'AFTER_GENERATION_PUBLISHED'
	| 'BEFORE_POINTER_SWAP'
	| 'AFTER_POINTER_SWAP'
	| 'AFTER_PUBLICATION_LOG';

export interface ContentAddressedFileStoreOptions {
	readonly maxArtifacts?: number;
	readonly maxArtifactBytes?: number;
	readonly maxTotalArtifactBytes?: number;
	readonly maxMetadataBytes?: number;
	readonly maxDirectoryEntries?: number;
	readonly lockStaleAfterMs?: number;
	readonly readerStaleAfterMs?: number;
	readonly now?: () => number;
	readonly isProcessAlive?: (pid: number) => boolean;
	readonly fault?: (point: ContentAddressedFileStoreFaultPoint) => void;
}

interface NormalizedStoreOptions {
	readonly maxArtifacts: number;
	readonly maxArtifactBytes: number;
	readonly maxTotalArtifactBytes: number;
	readonly maxMetadataBytes: number;
	readonly maxDirectoryEntries: number;
	readonly lockStaleAfterMs: number;
	readonly readerStaleAfterMs: number;
	readonly now: () => number;
	readonly isProcessAlive: (pid: number) => boolean;
	readonly fault: ((point: ContentAddressedFileStoreFaultPoint) => void) | undefined;
}

interface GenerationBody {
	readonly schema: typeof GENERATION_SCHEMA;
	readonly subjectId: string;
	readonly invalidationInputs: readonly ContentAddressedInvalidationInput[];
	readonly artifacts: readonly ContentAddressedArtifactReference[];
}

interface GenerationManifest extends GenerationBody {
	readonly generationId: string;
}

interface CurrentPointerBody {
	readonly schema: typeof POINTER_SCHEMA;
	readonly generationId: string;
	readonly manifestSha256: string;
	readonly publicationGeneration: number;
}

interface CurrentPointer extends CurrentPointerBody {
	readonly pointerSha256: string;
}

interface PublicationRecord {
	readonly schema: typeof PUBLICATION_SCHEMA;
	readonly generationId: string;
	readonly manifestSha256: string;
	readonly publicationGeneration: number;
}

interface ReaderPin {
	readonly schema: typeof READER_SCHEMA;
	readonly token: string;
	readonly pid: number;
	readonly createdAtMs: number;
	readonly generationId: string;
	readonly manifestSha256: string;
}

interface WriterLock {
	readonly schema: typeof WRITER_SCHEMA;
	readonly token: string;
	readonly pid: number;
	readonly acquiredAtMs: number;
}

interface LockAcquisition {
	readonly schema: typeof ACQUISITION_SCHEMA;
	readonly token: string;
	readonly pid: number;
	readonly acquiredAtMs: number;
}

interface ValidatedArtifactDefinition {
	readonly logicalKey: string;
	readonly artifactKind: string;
	readonly transformVersion: string;
	readonly dependencyKeys: readonly string[];
	readonly compute: ContentAddressedArtifactDefinition['compute'];
}

interface ValidatedPublishRequest {
	readonly mode: 'CLEAN' | 'INCREMENTAL';
	readonly expectedCurrentGenerationId: string | null;
	readonly subjectId: string;
	readonly invalidationInputs: readonly ContentAddressedInvalidationInput[];
	readonly outputs: readonly ValidatedArtifactDefinition[];
	readonly verifyCleanEquivalence: boolean;
	readonly signal: AbortSignal | undefined;
}

interface BuiltArtifact {
	readonly reference: ContentAddressedArtifactReference;
	readonly content: Uint8Array | null;
	readonly reused: boolean;
}

interface LoadedGeneration {
	readonly manifest: GenerationManifest;
	readonly manifestSha256: string;
}

interface RecoveryState {
	readonly result: ContentAddressedRecoveryResult;
	readonly pointer: CurrentPointer | null;
}

class ContentAddressedStoreError extends Error {
	public constructor(
		message: string,
		public readonly code: string
	) {
		super(message);
		this.name = new.target.name;
	}
}

export class ContentAddressedStoreValidationError extends ContentAddressedStoreError {
	public constructor(message: string) {
		super(message, 'CSAA_CONTENT_STORE_INVALID_INPUT');
	}
}

export class ContentAddressedStoreBusyError extends ContentAddressedStoreError {
	public constructor(message = 'The CSAA content-addressed store already has an active writer.') {
		super(message, 'CSAA_CONTENT_STORE_BUSY');
	}
}

export class ContentAddressedStoreConflictError extends ContentAddressedStoreError {
	public constructor(message: string) {
		super(message, 'CSAA_CONTENT_STORE_PUBLICATION_CONFLICT');
	}
}

export class ContentAddressedStoreCorruptionError extends ContentAddressedStoreError {
	public constructor(message: string) {
		super(message, 'CSAA_CONTENT_STORE_CORRUPT');
	}
}

export class ContentAddressedStoreCancelledError extends ContentAddressedStoreError {
	public constructor() {
		super(
			'The CSAA content-addressed store operation was cancelled.',
			'CSAA_CONTENT_STORE_CANCELLED'
		);
	}
}

export class ContentAddressedStoreEquivalenceError extends ContentAddressedStoreError {
	public constructor(logicalKey: string) {
		super(
			`Incremental and clean computation differed for artifact ${JSON.stringify(logicalKey)}.`,
			'CSAA_CONTENT_STORE_EQUIVALENCE_FAILURE'
		);
	}
}

function isErrno(error: unknown, code: string): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as NodeJS.ErrnoException).code === code
	);
}

function sha256(content: string | Uint8Array): string {
	return createHash('sha256').update(content).digest('hex');
}

function identity(domain: string, value: unknown): string {
	return canonicalSemanticJsonPrefixedSha256(`${domain}\0`, value);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function assertPlainRecord(
	value: unknown,
	label: string
): asserts value is Record<string, unknown> {
	if (isProxyValue(value))
		throw new ContentAddressedStoreValidationError(`${label} rejects Proxy values.`);
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new ContentAddressedStoreValidationError(`${label} must be a plain object.`);
	const prototype = Reflect.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new ContentAddressedStoreValidationError(`${label} must be a plain object.`);
}

function dataProperty(record: Record<string, unknown>, key: string, label: string): unknown {
	const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		throw new ContentAddressedStoreValidationError(
			`${label}.${key} must be an enumerable data property.`
		);
	return descriptor.value;
}

function optionalDataProperty(
	record: Record<string, unknown>,
	key: string,
	label: string
): unknown {
	const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
	if (descriptor === undefined) return undefined;
	if (!descriptor.enumerable || !('value' in descriptor))
		throw new ContentAddressedStoreValidationError(
			`${label}.${key} must be an enumerable data property.`
		);
	return descriptor.value;
}

function assertExactKeys(
	record: Record<string, unknown>,
	expected: readonly string[],
	label: string
): void {
	const actual = Reflect.ownKeys(record);
	if (actual.some((key) => typeof key !== 'string'))
		throw new ContentAddressedStoreValidationError(`${label} rejects symbol properties.`);
	const sortedActual = (actual as string[]).sort();
	const sortedExpected = [...expected].sort();
	if (
		sortedActual.length !== sortedExpected.length ||
		sortedActual.some((key, index) => key !== sortedExpected[index])
	)
		throw new ContentAddressedStoreValidationError(`${label} has an unsupported property set.`);
}

function denseArray(value: unknown, label: string, maximum: number): readonly unknown[] {
	if (isProxyValue(value))
		throw new ContentAddressedStoreValidationError(`${label} rejects Proxy values.`);
	if (!Array.isArray(value))
		throw new ContentAddressedStoreValidationError(`${label} must be an array.`);
	const keys = Reflect.ownKeys(value);
	for (const key of keys) {
		if (typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key)))
			throw new ContentAddressedStoreValidationError(`${label} rejects array expandos.`);
	}
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
	const length =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > maximum)
		throw new ContentAddressedStoreValidationError(`${label} exceeds its bounded length.`);
	if (keys.length !== (length as number) + 1)
		throw new ContentAddressedStoreValidationError(`${label} rejects sparse arrays.`);
	const copy: unknown[] = [];
	for (let index = 0; index < (length as number); index += 1)
		copy.push(dataProperty(value as unknown as Record<string, unknown>, String(index), label));
	return copy;
}

function scalarString(value: unknown, label: string, maximum: number, allowEmpty = false): string {
	if (
		typeof value !== 'string' ||
		(!allowEmpty && value.length === 0) ||
		value.length > maximum ||
		!isUnicodeScalarString(value)
	)
		throw new ContentAddressedStoreValidationError(`${label} must be bounded Unicode scalar text.`);
	return value;
}

function digestString(value: unknown, label: string): string {
	if (typeof value !== 'string' || !SHA256_PATTERN.test(value))
		throw new ContentAddressedStoreValidationError(`${label} must be a lowercase SHA-256 digest.`);
	return value;
}

function safeInteger(value: unknown, label: string, minimum: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
		throw new ContentAddressedStoreValidationError(`${label} must be a bounded safe integer.`);
	return value as number;
}

function validateSignal(value: unknown, label: string): AbortSignal | undefined {
	if (value === undefined) return undefined;
	if (isProxyValue(value) || !(value instanceof AbortSignal))
		throw new ContentAddressedStoreValidationError(`${label} must be an AbortSignal.`);
	return value;
}

function checkCancellation(signal: AbortSignal | undefined): void {
	if (signal?.aborted === true) throw new ContentAddressedStoreCancelledError();
}

function validateInvalidationInputs(
	value: unknown,
	maximum: number,
	label = 'request.invalidationInputs'
): readonly ContentAddressedInvalidationInput[] {
	const entries = denseArray(value, label, maximum);
	const validated = entries.map((entry, index) => {
		const entryLabel = `${label}[${index}]`;
		assertPlainRecord(entry, entryLabel);
		assertExactKeys(entry, ['key', 'kind', 'digest'], entryLabel);
		const key = scalarString(dataProperty(entry, 'key', entryLabel), `${entryLabel}.key`, 1_024);
		const kind = dataProperty(entry, 'kind', entryLabel);
		if (
			typeof kind !== 'string' ||
			!INVALIDATION_KINDS.has(kind as ContentAddressedInvalidationKind)
		)
			throw new ContentAddressedStoreValidationError(`${entryLabel}.kind is unsupported.`);
		return Object.freeze({
			key,
			kind: kind as ContentAddressedInvalidationKind,
			digest: digestString(dataProperty(entry, 'digest', entryLabel), `${entryLabel}.digest`)
		});
	});
	validated.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
	for (let index = 1; index < validated.length; index += 1) {
		if (validated[index - 1]!.key === validated[index]!.key)
			throw new ContentAddressedStoreValidationError(`${label} contains duplicate keys.`);
	}
	return Object.freeze(validated);
}

function validateDependencyKeys(
	value: unknown,
	inputKeys: ReadonlySet<string>,
	label: string,
	maximum: number
): readonly string[] {
	const values = denseArray(value, label, maximum).map((entry, index) =>
		scalarString(entry, `${label}[${index}]`, 1_024)
	);
	values.sort();
	for (let index = 0; index < values.length; index += 1) {
		const key = values[index]!;
		if (!inputKeys.has(key))
			throw new ContentAddressedStoreValidationError(`${label} names an absent invalidation key.`);
		if (index !== 0 && values[index - 1] === key)
			throw new ContentAddressedStoreValidationError(`${label} contains duplicate keys.`);
	}
	return Object.freeze(values);
}

function validateOutputs(
	value: unknown,
	inputKeys: ReadonlySet<string>,
	maximum: number
): readonly ValidatedArtifactDefinition[] {
	const definitions = denseArray(value, 'request.outputs', maximum).map((entry, index) => {
		const label = `request.outputs[${index}]`;
		assertPlainRecord(entry, label);
		assertExactKeys(
			entry,
			['logicalKey', 'artifactKind', 'transformVersion', 'dependencyKeys', 'compute'],
			label
		);
		const compute = dataProperty(entry, 'compute', label);
		if (typeof compute !== 'function' || isProxyValue(compute))
			throw new ContentAddressedStoreValidationError(
				`${label}.compute must be a non-Proxy function.`
			);
		return Object.freeze({
			logicalKey: scalarString(
				dataProperty(entry, 'logicalKey', label),
				`${label}.logicalKey`,
				1_024
			),
			artifactKind: scalarString(
				dataProperty(entry, 'artifactKind', label),
				`${label}.artifactKind`,
				1_024
			),
			transformVersion: scalarString(
				dataProperty(entry, 'transformVersion', label),
				`${label}.transformVersion`,
				1_024
			),
			dependencyKeys: validateDependencyKeys(
				dataProperty(entry, 'dependencyKeys', label),
				inputKeys,
				`${label}.dependencyKeys`,
				maximum
			),
			compute: compute as ContentAddressedArtifactDefinition['compute']
		});
	});
	let dependencyReferences = 0;
	for (const definition of definitions) {
		dependencyReferences += definition.dependencyKeys.length;
		if (dependencyReferences > CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxDependencyReferences)
			throw new ContentAddressedStoreValidationError(
				'request.outputs exceeds the aggregate dependency-reference budget.'
			);
	}
	definitions.sort((left, right) =>
		left.logicalKey < right.logicalKey ? -1 : left.logicalKey > right.logicalKey ? 1 : 0
	);
	for (let index = 1; index < definitions.length; index += 1) {
		if (definitions[index - 1]!.logicalKey === definitions[index]!.logicalKey)
			throw new ContentAddressedStoreValidationError(
				'request.outputs contains duplicate logical keys.'
			);
	}
	return Object.freeze(definitions);
}

function validatePublishRequest(
	value: unknown,
	options: NormalizedStoreOptions
): ValidatedPublishRequest {
	assertPlainRecord(value, 'request');
	const keys = Reflect.ownKeys(value);
	const allowed = new Set([
		'mode',
		'expectedCurrentGenerationId',
		'subjectId',
		'invalidationInputs',
		'outputs',
		'verifyCleanEquivalence',
		'signal'
	]);
	if (keys.some((key) => typeof key !== 'string' || !allowed.has(key)))
		throw new ContentAddressedStoreValidationError('request has an unsupported property set.');
	for (const required of [
		'mode',
		'expectedCurrentGenerationId',
		'subjectId',
		'invalidationInputs',
		'outputs',
		'verifyCleanEquivalence'
	])
		dataProperty(value, required, 'request');
	const mode = dataProperty(value, 'mode', 'request');
	if (mode !== 'CLEAN' && mode !== 'INCREMENTAL')
		throw new ContentAddressedStoreValidationError('request.mode is unsupported.');
	const expected = dataProperty(value, 'expectedCurrentGenerationId', 'request');
	if (expected !== null) digestString(expected, 'request.expectedCurrentGenerationId');
	const invalidationInputs = validateInvalidationInputs(
		dataProperty(value, 'invalidationInputs', 'request'),
		options.maxArtifacts
	);
	const inputKeys = new Set(invalidationInputs.map((entry) => entry.key));
	const verify = dataProperty(value, 'verifyCleanEquivalence', 'request');
	if (typeof verify !== 'boolean')
		throw new ContentAddressedStoreValidationError(
			'request.verifyCleanEquivalence must be boolean.'
		);
	return Object.freeze({
		mode,
		expectedCurrentGenerationId: expected as string | null,
		subjectId: scalarString(
			dataProperty(value, 'subjectId', 'request'),
			'request.subjectId',
			1_024
		),
		invalidationInputs,
		outputs: validateOutputs(
			dataProperty(value, 'outputs', 'request'),
			inputKeys,
			options.maxArtifacts
		),
		verifyCleanEquivalence: verify,
		signal: validateSignal(optionalDataProperty(value, 'signal', 'request'), 'request.signal')
	});
}

function defaultProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (isErrno(error, 'ESRCH')) return false;
		return true;
	}
}

function normalizeOptions(
	value: ContentAddressedFileStoreOptions | undefined
): NormalizedStoreOptions {
	if (value === undefined) value = {};
	assertPlainRecord(value, 'options');
	const allowed = new Set([
		'maxArtifacts',
		'maxArtifactBytes',
		'maxTotalArtifactBytes',
		'maxMetadataBytes',
		'maxDirectoryEntries',
		'lockStaleAfterMs',
		'readerStaleAfterMs',
		'now',
		'isProcessAlive',
		'fault'
	]);
	if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.has(key)))
		throw new ContentAddressedStoreValidationError('options has an unsupported property set.');
	const integerOption = (key: string, fallback: number, maximum: number): number => {
		const candidate = optionalDataProperty(value as Record<string, unknown>, key, 'options');
		return candidate === undefined
			? fallback
			: safeInteger(candidate, `options.${key}`, 1, maximum);
	};
	const functionOption = <T extends (...arguments_: never[]) => unknown>(
		key: string
	): T | undefined => {
		const candidate = optionalDataProperty(value as Record<string, unknown>, key, 'options');
		if (candidate === undefined) return undefined;
		if (typeof candidate !== 'function' || isProxyValue(candidate))
			throw new ContentAddressedStoreValidationError(
				`options.${key} must be a non-Proxy function.`
			);
		return candidate as T;
	};
	const maxArtifacts = integerOption(
		'maxArtifacts',
		CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxArtifacts,
		CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxArtifacts
	);
	const maxArtifactBytes = integerOption(
		'maxArtifactBytes',
		CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxArtifactBytes,
		CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxArtifactBytes
	);
	const maxTotalArtifactBytes = integerOption(
		'maxTotalArtifactBytes',
		CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxTotalArtifactBytes,
		CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxTotalArtifactBytes
	);
	if (maxTotalArtifactBytes < maxArtifactBytes)
		throw new ContentAddressedStoreValidationError(
			'options.maxTotalArtifactBytes cannot be smaller than options.maxArtifactBytes.'
		);
	return Object.freeze({
		maxArtifacts,
		maxArtifactBytes,
		maxTotalArtifactBytes,
		maxMetadataBytes: integerOption(
			'maxMetadataBytes',
			CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxMetadataBytes,
			CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxMetadataBytes
		),
		maxDirectoryEntries: integerOption(
			'maxDirectoryEntries',
			CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxDirectoryEntries,
			CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxDirectoryEntries
		),
		lockStaleAfterMs: integerOption('lockStaleAfterMs', 5 * 60_000, 24 * 60 * 60_000),
		readerStaleAfterMs: integerOption(
			'readerStaleAfterMs',
			24 * 60 * 60_000,
			30 * 24 * 60 * 60_000
		),
		now: functionOption<() => number>('now') ?? Date.now,
		isProcessAlive:
			functionOption<(pid: number) => boolean>('isProcessAlive') ?? defaultProcessAlive,
		fault: functionOption<(point: ContentAddressedFileStoreFaultPoint) => void>('fault')
	});
}

function writeAll(fileDescriptor: number, content: Uint8Array): void {
	let offset = 0;
	while (offset < content.byteLength) {
		const written = writeSync(fileDescriptor, content, offset, content.byteLength - offset);
		if (written <= 0)
			throw new ContentAddressedStoreCorruptionError('A durable store write made no progress.');
		offset += written;
	}
}

function fsyncDirectoryBestEffort(path: string): void {
	let descriptor: number | undefined;
	try {
		descriptor = openSync(path, 'r');
		fsyncSync(descriptor);
	} catch {
		// Directory fsync is not available on every supported Windows filesystem.
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
	}
}

function durableWriteNew(path: string, content: Uint8Array): void {
	let descriptor: number | undefined;
	try {
		descriptor = openSync(path, 'wx', 0o600);
		writeAll(descriptor, content);
		fsyncSync(descriptor);
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
	}
	fsyncDirectoryBestEffort(dirname(path));
}

function durableWriteCanonicalNew(path: string, value: unknown): void {
	durableWriteNew(path, Buffer.from(canonicalSemanticJson(value), 'utf8'));
}

function durableReplaceCanonical(path: string, temporaryPath: string, value: unknown): void {
	durableWriteCanonicalNew(temporaryPath, value);
	renameSync(temporaryPath, path);
	fsyncDirectoryBestEffort(dirname(path));
}

function assertOrdinaryDirectory(path: string, label: string): void {
	const status = lstatSync(path);
	if (status.isSymbolicLink() || !status.isDirectory())
		throw new ContentAddressedStoreCorruptionError(`${label} is not an ordinary directory.`);
}

function ensureOrdinaryDirectory(path: string, label: string): void {
	try {
		mkdirSync(path);
		fsyncDirectoryBestEffort(dirname(path));
	} catch (error) {
		if (!isErrno(error, 'EEXIST')) throw error;
	}
	assertOrdinaryDirectory(path, label);
}

function assertConfined(parent: string, child: string): void {
	const pathFromParent = relative(resolve(parent), resolve(child));
	if (pathFromParent === '' || pathFromParent === '..' || pathFromParent.startsWith(`..${sep}`))
		throw new ContentAddressedStoreCorruptionError('A store path escaped its confined directory.');
}

function removeConfinedTree(parent: string, child: string): void {
	assertConfined(parent, child);
	rmSync(child, { force: true, recursive: true });
}

function boundedDirectoryNames(path: string, maximum: number): readonly string[] {
	assertOrdinaryDirectory(path, 'Store directory');
	const directory = opendirSync(path);
	const entries: string[] = [];
	try {
		while (true) {
			const entry = directory.readSync();
			if (entry === null) break;
			entries.push(entry.name);
			if (entries.length > maximum)
				throw new ContentAddressedStoreCorruptionError(
					'A store directory exceeds its entry budget.'
				);
		}
	} finally {
		directory.closeSync();
	}
	return entries.sort();
}

function readBoundedOrdinaryFile(
	path: string,
	maximumBytes: number,
	label: string,
	allowEmpty: boolean
): Buffer {
	const pathStatus = lstatSync(path);
	if (pathStatus.isSymbolicLink() || !pathStatus.isFile())
		throw new ContentAddressedStoreCorruptionError(`${label} is not an ordinary file.`);
	let descriptor: number | undefined;
	let bytes: Buffer;
	try {
		descriptor = openSync(path, 'r');
		const status = fstatSync(descriptor);
		if (!status.isFile() || (!allowEmpty && status.size <= 0) || status.size > maximumBytes)
			throw new ContentAddressedStoreCorruptionError(`${label} is not a bounded ordinary file.`);
		bytes = Buffer.allocUnsafe(status.size);
		let offset = 0;
		while (offset < bytes.byteLength) {
			const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
			if (count <= 0)
				throw new ContentAddressedStoreCorruptionError(`${label} ended while it was read.`);
			offset += count;
		}
		const after = fstatSync(descriptor);
		if (after.size !== status.size || after.mtimeMs !== status.mtimeMs)
			throw new ContentAddressedStoreCorruptionError(`${label} changed while it was read.`);
	} finally {
		if (descriptor !== undefined) closeSync(descriptor);
	}
	return bytes;
}

function readCanonicalJson(path: string, maximumBytes: number, label: string): unknown {
	const bytes = readBoundedOrdinaryFile(path, maximumBytes, label, false);
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new ContentAddressedStoreCorruptionError(`${label} is not valid UTF-8.`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text) as unknown;
	} catch {
		throw new ContentAddressedStoreCorruptionError(`${label} is not valid JSON.`);
	}
	try {
		if (canonicalSemanticJson(parsed) !== text)
			throw new ContentAddressedStoreCorruptionError(`${label} is not canonical JSON.`);
	} catch (error) {
		if (error instanceof ContentAddressedStoreCorruptionError) throw error;
		throw new ContentAddressedStoreCorruptionError(
			`${label} is outside the canonical metadata domain.`
		);
	}
	return parsed;
}

function asCorruption<T>(action: () => T, label: string): T {
	try {
		return action();
	} catch (error) {
		if (error instanceof ContentAddressedStoreCorruptionError) throw error;
		throw new ContentAddressedStoreCorruptionError(`${label} failed strict validation.`);
	}
}

function pointerDigest(body: CurrentPointerBody): string {
	return identity('JAN-CSAA-CONTENT-ADDRESSED-CURRENT-POINTER', body);
}

function dependencyDigest(
	definition: Pick<
		ContentAddressedArtifactReference,
		'logicalKey' | 'artifactKind' | 'transformVersion' | 'dependencyKeys'
	>,
	inputsByKey: ReadonlyMap<string, ContentAddressedInvalidationInput>,
	subjectId: string
): string {
	return identity('JAN-CSAA-CONTENT-ADDRESSED-ARTIFACT-DEPENDENCIES', {
		subjectId,
		logicalKey: definition.logicalKey,
		artifactKind: definition.artifactKind,
		transformVersion: definition.transformVersion,
		dependencies: definition.dependencyKeys.map((key) => inputsByKey.get(key)!)
	});
}

function generationId(body: GenerationBody): string {
	return identity('JAN-CSAA-CONTENT-ADDRESSED-GENERATION', body);
}

function publicationFileName(publicationGeneration: number): string {
	return `${String(publicationGeneration).padStart(16, '0')}.json`;
}

function isProtectedCoordinationEntry(name: string): boolean {
	return name === LOCK_FILE || name === ACQUISITION_FILE || name === QUARANTINE_DIRECTORY;
}

function parsePointer(value: unknown): CurrentPointer {
	return asCorruption(() => {
		assertPlainRecord(value, 'current pointer');
		assertExactKeys(
			value,
			['schema', 'generationId', 'manifestSha256', 'publicationGeneration', 'pointerSha256'],
			'current pointer'
		);
		if (dataProperty(value, 'schema', 'current pointer') !== POINTER_SCHEMA)
			throw new Error('schema');
		const body: CurrentPointerBody = {
			schema: POINTER_SCHEMA,
			generationId: digestString(
				dataProperty(value, 'generationId', 'current pointer'),
				'generationId'
			),
			manifestSha256: digestString(
				dataProperty(value, 'manifestSha256', 'current pointer'),
				'manifestSha256'
			),
			publicationGeneration: safeInteger(
				dataProperty(value, 'publicationGeneration', 'current pointer'),
				'publicationGeneration',
				1,
				Number.MAX_SAFE_INTEGER
			)
		};
		const pointerSha256 = digestString(
			dataProperty(value, 'pointerSha256', 'current pointer'),
			'pointerSha256'
		);
		if (pointerSha256 !== pointerDigest(body)) throw new Error('digest');
		return Object.freeze({ ...body, pointerSha256 });
	}, 'Current pointer');
}

function parsePublication(value: unknown): PublicationRecord {
	return asCorruption(() => {
		assertPlainRecord(value, 'publication record');
		assertExactKeys(
			value,
			['schema', 'generationId', 'manifestSha256', 'publicationGeneration'],
			'publication record'
		);
		if (dataProperty(value, 'schema', 'publication record') !== PUBLICATION_SCHEMA)
			throw new Error('schema');
		return Object.freeze({
			schema: PUBLICATION_SCHEMA,
			generationId: digestString(
				dataProperty(value, 'generationId', 'publication record'),
				'generationId'
			),
			manifestSha256: digestString(
				dataProperty(value, 'manifestSha256', 'publication record'),
				'manifestSha256'
			),
			publicationGeneration: safeInteger(
				dataProperty(value, 'publicationGeneration', 'publication record'),
				'publicationGeneration',
				1,
				Number.MAX_SAFE_INTEGER
			)
		});
	}, 'Publication record');
}

function parseWriterLock(value: unknown): WriterLock {
	return asCorruption(() => {
		assertPlainRecord(value, 'writer lock');
		assertExactKeys(value, ['schema', 'token', 'pid', 'acquiredAtMs'], 'writer lock');
		if (dataProperty(value, 'schema', 'writer lock') !== WRITER_SCHEMA) throw new Error('schema');
		const token = dataProperty(value, 'token', 'writer lock');
		if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw new Error('token');
		return Object.freeze({
			schema: WRITER_SCHEMA,
			token,
			pid: safeInteger(dataProperty(value, 'pid', 'writer lock'), 'pid', 1, 2_147_483_647),
			acquiredAtMs: safeInteger(
				dataProperty(value, 'acquiredAtMs', 'writer lock'),
				'acquiredAtMs',
				0,
				Number.MAX_SAFE_INTEGER
			)
		});
	}, 'Writer lock');
}

function parseLockAcquisition(value: unknown): LockAcquisition {
	return asCorruption(() => {
		assertPlainRecord(value, 'lock acquisition');
		assertExactKeys(value, ['schema', 'token', 'pid', 'acquiredAtMs'], 'lock acquisition');
		if (dataProperty(value, 'schema', 'lock acquisition') !== ACQUISITION_SCHEMA)
			throw new Error('schema');
		const token = dataProperty(value, 'token', 'lock acquisition');
		if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw new Error('token');
		return Object.freeze({
			schema: ACQUISITION_SCHEMA,
			token,
			pid: safeInteger(dataProperty(value, 'pid', 'lock acquisition'), 'pid', 1, 2_147_483_647),
			acquiredAtMs: safeInteger(
				dataProperty(value, 'acquiredAtMs', 'lock acquisition'),
				'acquiredAtMs',
				0,
				Number.MAX_SAFE_INTEGER
			)
		});
	}, 'Lock acquisition');
}

function parseReaderPin(value: unknown): ReaderPin {
	return asCorruption(() => {
		assertPlainRecord(value, 'reader pin');
		assertExactKeys(
			value,
			['schema', 'token', 'pid', 'createdAtMs', 'generationId', 'manifestSha256'],
			'reader pin'
		);
		if (dataProperty(value, 'schema', 'reader pin') !== READER_SCHEMA) throw new Error('schema');
		const token = dataProperty(value, 'token', 'reader pin');
		if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw new Error('token');
		return Object.freeze({
			schema: READER_SCHEMA,
			token,
			pid: safeInteger(dataProperty(value, 'pid', 'reader pin'), 'pid', 1, 2_147_483_647),
			createdAtMs: safeInteger(
				dataProperty(value, 'createdAtMs', 'reader pin'),
				'createdAtMs',
				0,
				Number.MAX_SAFE_INTEGER
			),
			generationId: digestString(dataProperty(value, 'generationId', 'reader pin'), 'generationId'),
			manifestSha256: digestString(
				dataProperty(value, 'manifestSha256', 'reader pin'),
				'manifestSha256'
			)
		});
	}, 'Reader pin');
}

export class ContentAddressedReadView {
	readonly #root: string;
	readonly #pinPath: string;
	readonly #token: string;
	readonly #manifest: GenerationManifest;
	readonly #maximumArtifactBytes: number;
	#closed = false;

	public readonly generationId: string;
	public readonly subjectId: string;
	public readonly artifacts: readonly ContentAddressedArtifactReference[];

	public constructor(
		root: string,
		pinPath: string,
		token: string,
		manifest: GenerationManifest,
		maximumArtifactBytes: number
	) {
		this.#root = root;
		this.#pinPath = pinPath;
		this.#token = token;
		this.#manifest = manifest;
		this.#maximumArtifactBytes = maximumArtifactBytes;
		this.generationId = manifest.generationId;
		this.subjectId = manifest.subjectId;
		this.artifacts = manifest.artifacts;
	}

	public readArtifact(logicalKeyValue: string): Uint8Array {
		if (this.#closed) throw new ContentAddressedStoreConflictError('The reader view is closed.');
		const logicalKey = scalarString(logicalKeyValue, 'logicalKey', 1_024);
		const reference = this.#manifest.artifacts.find(
			(candidate) => candidate.logicalKey === logicalKey
		);
		if (reference === undefined)
			throw new ContentAddressedStoreValidationError(
				'The reader view has no artifact for logicalKey.'
			);
		const path = artifactPath(this.#root, reference.sha256);
		return readAndVerifyArtifact(path, reference, this.#maximumArtifactBytes);
	}

	public close(): void {
		if (this.#closed) return;
		this.#closed = true;
		try {
			const pin = parseReaderPin(
				readCanonicalJson(this.#pinPath, 64 * 1024, 'Reader pin during close')
			);
			if (pin.token !== this.#token || pin.generationId !== this.generationId) return;
			unlinkSync(this.#pinPath);
			fsyncDirectoryBestEffort(dirname(this.#pinPath));
		} catch (error) {
			if (isErrno(error, 'ENOENT')) return;
			// A replaced or corrupt pin remains as a conservative retention root.
		}
	}
}

function artifactPath(root: string, digest: string): string {
	return join(root, ARTIFACTS_DIRECTORY, digest.slice(0, 2), `${digest}.blob`);
}

function readAndVerifyArtifact(
	path: string,
	reference: Pick<ContentAddressedArtifactReference, 'sha256' | 'bytes'>,
	maximumArtifactBytes: number
): Uint8Array {
	const content = readBoundedOrdinaryFile(path, maximumArtifactBytes, 'Artifact', true);
	if (content.byteLength !== reference.bytes || sha256(content) !== reference.sha256)
		throw new ContentAddressedStoreCorruptionError('An artifact failed its exact content witness.');
	return Uint8Array.from(content);
}

export class ContentAddressedFileStore {
	readonly #root: string;
	readonly #options: NormalizedStoreOptions;

	public constructor(rootValue: string, options?: ContentAddressedFileStoreOptions) {
		const root = scalarString(rootValue, 'root', 32_768);
		this.#root = resolve(root);
		this.#options = normalizeOptions(options);
	}

	public initialize(): ContentAddressedRecoveryResult {
		this.#prepareLockRoot();
		const token = this.#acquireWriter();
		try {
			return this.#recoverLocked(token).result;
		} finally {
			this.#releaseWriter(token);
		}
	}

	public planInvalidation(inputsValue: unknown): ContentAddressedInvalidationPlan {
		const inputs = validateInvalidationInputs(
			inputsValue,
			this.#options.maxArtifacts,
			'invalidationInputs'
		);
		this.#prepareLockRoot();
		const token = this.#acquireWriter();
		try {
			const state = this.#recoverLocked(token);
			if (state.pointer === null)
				return Object.freeze({
					changedKeys: Object.freeze(inputs.map((entry) => entry.key)),
					affectedArtifacts: Object.freeze([]),
					reusableArtifacts: Object.freeze([])
				});
			const loaded = this.#loadGeneration(state.pointer.generationId, true);
			const previousByKey = new Map(
				loaded.manifest.invalidationInputs.map((entry) => [entry.key, entry])
			);
			const nextByKey = new Map(inputs.map((entry) => [entry.key, entry]));
			const keys = new Set([...previousByKey.keys(), ...nextByKey.keys()]);
			const changedKeys = [...keys]
				.filter((key) => {
					const previous = previousByKey.get(key);
					const next = nextByKey.get(key);
					return previous?.kind !== next?.kind || previous?.digest !== next?.digest;
				})
				.sort();
			const changedSet = new Set(changedKeys);
			const affectedArtifacts = loaded.manifest.artifacts
				.filter((artifact) => artifact.dependencyKeys.some((key) => changedSet.has(key)))
				.map((artifact) => artifact.logicalKey);
			const affectedSet = new Set(affectedArtifacts);
			return Object.freeze({
				changedKeys: Object.freeze(changedKeys),
				affectedArtifacts: Object.freeze(affectedArtifacts),
				reusableArtifacts: Object.freeze(
					loaded.manifest.artifacts
						.map((artifact) => artifact.logicalKey)
						.filter((key) => !affectedSet.has(key))
				)
			});
		} finally {
			this.#releaseWriter(token);
		}
	}

	public publish(requestValue: ContentAddressedPublishRequest): ContentAddressedPublishResult {
		const request = validatePublishRequest(requestValue, this.#options);
		checkCancellation(request.signal);
		this.#prepareLockRoot();
		const token = this.#acquireWriter();
		let stagingPath: string | undefined;
		try {
			const recovered = this.#recoverLocked(token);
			this.#assertExpectedCurrent(request.expectedCurrentGenerationId, recovered.pointer);
			const previous =
				recovered.pointer === null
					? null
					: this.#loadGeneration(recovered.pointer.generationId, true);
			const built = this.#buildArtifacts(request, previous?.manifest ?? null);
			if (request.verifyCleanEquivalence && request.mode === 'INCREMENTAL')
				this.#verifyCleanEquivalence(request, built);
			checkCancellation(request.signal);

			const artifacts = Object.freeze(built.map((entry) => entry.reference));
			const body: GenerationBody = Object.freeze({
				schema: GENERATION_SCHEMA,
				subjectId: request.subjectId,
				invalidationInputs: request.invalidationInputs,
				artifacts
			});
			const id = generationId(body);
			const manifest: GenerationManifest = Object.freeze({ ...body, generationId: id });
			const manifestWitness = canonicalSemanticJsonWitness(manifest);
			if (manifestWitness.bytes > this.#options.maxMetadataBytes)
				throw new ContentAddressedStoreValidationError(
					'The generation manifest exceeds its byte budget.'
				);
			const manifestBytes = Buffer.from(canonicalSemanticJson(manifest), 'utf8');
			const manifestSha256 = manifestWitness.sha256;

			stagingPath = this.#createStagingDirectory();
			this.#fault('AFTER_STAGING_CREATED');
			const stagedArtifacts = join(stagingPath, ARTIFACTS_DIRECTORY);
			ensureOrdinaryDirectory(stagedArtifacts, 'Staged artifacts directory');
			const stagedDigests = new Set<string>();
			for (const artifact of built) {
				checkCancellation(request.signal);
				if (artifact.content === null || stagedDigests.has(artifact.reference.sha256)) continue;
				stagedDigests.add(artifact.reference.sha256);
				durableWriteNew(
					join(stagedArtifacts, `${artifact.reference.sha256}.blob`),
					artifact.content
				);
				this.#fault('AFTER_ARTIFACT_STAGED');
			}
			const stagedGeneration = join(stagingPath, 'generation');
			ensureOrdinaryDirectory(stagedGeneration, 'Staged generation directory');
			durableWriteNew(join(stagedGeneration, 'manifest.json'), manifestBytes);
			this.#fault('AFTER_GENERATION_STAGED');

			for (const digest of [...stagedDigests].sort()) {
				checkCancellation(request.signal);
				this.#publishStagedArtifact(join(stagedArtifacts, `${digest}.blob`), digest);
				this.#fault('AFTER_ARTIFACT_PUBLISHED');
			}
			this.#publishStagedGeneration(stagedGeneration, id, manifestSha256);
			this.#fault('AFTER_GENERATION_PUBLISHED');
			this.#loadGeneration(id, true);
			checkCancellation(request.signal);

			this.#assertOwnWriter(token);
			const currentBeforeSwap = this.#readCurrentPointer();
			this.#assertExpectedCurrent(request.expectedCurrentGenerationId, currentBeforeSwap);
			const publicationGeneration = this.#nextPublicationGeneration(currentBeforeSwap);
			const pointerBody: CurrentPointerBody = Object.freeze({
				schema: POINTER_SCHEMA,
				generationId: id,
				manifestSha256,
				publicationGeneration
			});
			const pointer: CurrentPointer = Object.freeze({
				...pointerBody,
				pointerSha256: pointerDigest(pointerBody)
			});
			this.#fault('BEFORE_POINTER_SWAP');
			checkCancellation(request.signal);
			this.#assertOwnWriter(token);
			const finalCurrent = this.#readCurrentPointer();
			this.#assertExpectedCurrent(request.expectedCurrentGenerationId, finalCurrent);
			if (canonicalSemanticJson(finalCurrent) !== canonicalSemanticJson(currentBeforeSwap))
				throw new ContentAddressedStoreConflictError(
					'The complete current pointer changed before publication.'
				);
			this.#replaceCurrent(pointer, token);
			this.#fault('AFTER_POINTER_SWAP');
			this.#writePublication(pointer);
			this.#fault('AFTER_PUBLICATION_LOG');

			const computed = built.filter((entry) => !entry.reused);
			const reused = built.filter((entry) => entry.reused);
			return Object.freeze({
				schema: 'JAN-CSAA-CONTENT-ADDRESSED-PUBLISH-RESULT@1',
				generationId: id,
				publicationGeneration,
				mode: request.mode,
				artifacts,
				computedArtifacts: computed.length,
				reusedArtifacts: reused.length,
				computedBytes: computed.reduce((sum, entry) => sum + entry.reference.bytes, 0),
				reusedBytes: reused.reduce((sum, entry) => sum + entry.reference.bytes, 0),
				cleanEquivalenceVerified: request.mode === 'CLEAN' || request.verifyCleanEquivalence
			});
		} finally {
			if (stagingPath !== undefined && existsSync(stagingPath))
				removeConfinedTree(join(this.#root, STAGING_DIRECTORY), stagingPath);
			this.#releaseWriter(token);
		}
	}

	public openCurrentReadView(): ContentAddressedReadView | null {
		this.#prepareLockRoot();
		const writerToken = this.#acquireWriter();
		try {
			const recovered = this.#recoverLocked(writerToken);
			if (recovered.pointer === null) return null;
			const loaded = this.#loadGeneration(recovered.pointer.generationId, true);
			const token = randomBytes(16).toString('hex');
			const pin: ReaderPin = Object.freeze({
				schema: READER_SCHEMA,
				token,
				pid: process.pid,
				createdAtMs: this.#now(),
				generationId: loaded.manifest.generationId,
				manifestSha256: loaded.manifestSha256
			});
			const pinPath = join(this.#root, READERS_DIRECTORY, `${token}.json`);
			durableWriteCanonicalNew(pinPath, pin);
			return new ContentAddressedReadView(
				this.#root,
				pinPath,
				token,
				loaded.manifest,
				this.#options.maxArtifactBytes
			);
		} finally {
			this.#releaseWriter(writerToken);
		}
	}

	public retain(requestValue: ContentAddressedRetentionRequest): ContentAddressedRetentionResult {
		assertPlainRecord(requestValue, 'retention request');
		const keys = Reflect.ownKeys(requestValue);
		if (
			keys.some(
				(key) => typeof key !== 'string' || (key !== 'keepPublishedGenerations' && key !== 'signal')
			)
		)
			throw new ContentAddressedStoreValidationError(
				'retention request has unsupported properties.'
			);
		const keep = safeInteger(
			dataProperty(requestValue, 'keepPublishedGenerations', 'retention request'),
			'retention request.keepPublishedGenerations',
			0,
			CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxPublications
		);
		const signal = validateSignal(
			optionalDataProperty(requestValue, 'signal', 'retention request'),
			'retention request.signal'
		);
		checkCancellation(signal);
		this.#prepareLockRoot();
		const token = this.#acquireWriter();
		try {
			const recovered = this.#recoverLocked(token);
			const roots = new Set<string>();
			if (recovered.pointer !== null) roots.add(recovered.pointer.generationId);
			for (const pin of this.#liveReaderPins()) roots.add(pin.generationId);
			const publications = this.#publicationRecords();
			const retainedPublicationNumbers = new Set<number>();
			const retainedPublishedGenerationIds = new Set<string>();
			for (let index = publications.length - 1; index >= 0; index -= 1) {
				const publication = publications[index]!;
				if (retainedPublishedGenerationIds.size >= keep) break;
				if (retainedPublishedGenerationIds.has(publication.generationId)) continue;
				try {
					this.#loadGeneration(publication.generationId, true);
				} catch {
					this.#quarantinePaths(
						[
							join(
								this.#root,
								PUBLICATIONS_DIRECTORY,
								publicationFileName(publication.publicationGeneration)
							)
						],
						'DANGLING_PUBLICATION_LOG'
					);
					continue;
				}
				retainedPublicationNumbers.add(publication.publicationGeneration);
				retainedPublishedGenerationIds.add(publication.generationId);
			}
			for (const id of retainedPublishedGenerationIds) roots.add(id);
			if (recovered.pointer !== null)
				retainedPublicationNumbers.add(recovered.pointer.publicationGeneration);
			// Logs cease to be retention roots before their generations are collected. A crash or
			// cancellation can therefore leave only extra immutable data, never a dangling retained log.
			for (const publication of publications) {
				checkCancellation(signal);
				if (retainedPublicationNumbers.has(publication.publicationGeneration)) continue;
				const path = join(
					this.#root,
					PUBLICATIONS_DIRECTORY,
					publicationFileName(publication.publicationGeneration)
				);
				if (existsSync(path)) this.#moveToTrashAndRemove(path);
			}

			const retainedArtifacts = new Set<string>();
			for (const id of roots) {
				checkCancellation(signal);
				const loaded = this.#loadGeneration(id, true);
				for (const artifact of loaded.manifest.artifacts) retainedArtifacts.add(artifact.sha256);
			}

			let removedGenerations = 0;
			const generationsRoot = join(this.#root, GENERATIONS_DIRECTORY);
			for (const name of boundedDirectoryNames(
				generationsRoot,
				this.#options.maxDirectoryEntries
			)) {
				checkCancellation(signal);
				if (!SHA256_PATTERN.test(name))
					throw new ContentAddressedStoreCorruptionError(
						'The generations directory has an invalid entry.'
					);
				if (roots.has(name)) continue;
				this.#moveToTrashAndRemove(join(generationsRoot, name));
				removedGenerations += 1;
			}

			let removedArtifacts = 0;
			const artifactsRoot = join(this.#root, ARTIFACTS_DIRECTORY);
			for (const shard of boundedDirectoryNames(artifactsRoot, 256)) {
				if (!/^[a-f0-9]{2}$/u.test(shard))
					throw new ContentAddressedStoreCorruptionError(
						'The artifacts directory has an invalid shard.'
					);
				const shardPath = join(artifactsRoot, shard);
				assertOrdinaryDirectory(shardPath, 'Artifact shard');
				for (const name of boundedDirectoryNames(shardPath, this.#options.maxDirectoryEntries)) {
					checkCancellation(signal);
					const match = /^([a-f0-9]{64})\.blob$/u.exec(name);
					if (match === null || match[1]!.slice(0, 2) !== shard)
						throw new ContentAddressedStoreCorruptionError(
							'An artifact shard has an invalid entry.'
						);
					if (retainedArtifacts.has(match[1]!)) continue;
					this.#moveToTrashAndRemove(join(shardPath, name));
					removedArtifacts += 1;
				}
			}
			return Object.freeze({
				schema: 'JAN-CSAA-CONTENT-ADDRESSED-RETENTION-RESULT@1',
				retainedGenerations: Object.freeze([...roots].sort()),
				removedGenerations,
				removedArtifacts
			});
		} finally {
			this.#releaseWriter(token);
		}
	}

	#prepareLockRoot(): void {
		mkdirSync(this.#root, { recursive: true });
		assertOrdinaryDirectory(this.#root, 'Store root');
		ensureOrdinaryDirectory(join(this.#root, QUARANTINE_DIRECTORY), 'Store quarantine directory');
	}

	#now(): number {
		return safeInteger(this.#options.now(), 'clock result', 0, Number.MAX_SAFE_INTEGER);
	}

	#acquireWriter(): string {
		const acquisitionToken = this.#acquireLockAcquisition();
		let writerToken: string | undefined;
		try {
			this.#assertOwnLockAcquisition(acquisitionToken);
			writerToken = this.#acquireWriterWhileCoordinated();
			this.#assertOwnLockAcquisition(acquisitionToken);
			return writerToken;
		} catch (error) {
			if (writerToken !== undefined) this.#releaseWriter(writerToken);
			throw error;
		} finally {
			this.#releaseLockAcquisition(acquisitionToken);
		}
	}

	#acquireWriterWhileCoordinated(): string {
		const lockPath = join(this.#root, LOCK_FILE);
		const createWriter = (): string => {
			const token = randomBytes(16).toString('hex');
			durableWriteCanonicalNew(lockPath, {
				schema: WRITER_SCHEMA,
				token,
				pid: process.pid,
				acquiredAtMs: this.#now()
			} satisfies WriterLock);
			return token;
		};
		if (!existsSync(lockPath)) return createWriter();
		const status = lstatSync(lockPath);
		if (status.isSymbolicLink() || !status.isFile())
			throw new ContentAddressedStoreCorruptionError(
				'The writer lock has an invalid filesystem shape.'
			);
		const oldByFilesystem = this.#now() - status.mtimeMs > this.#options.lockStaleAfterMs;
		if (!oldByFilesystem) throw new ContentAddressedStoreBusyError();
		let existing: WriterLock | undefined;
		try {
			existing = parseWriterLock(readCanonicalJson(lockPath, 64 * 1024, 'Existing writer lock'));
		} catch {
			this.#quarantinePaths([lockPath], 'STALE_INVALID_WRITER_LOCK');
			return createWriter();
		}
		const age = this.#now() - existing.acquiredAtMs;
		if (age <= this.#options.lockStaleAfterMs || this.#options.isProcessAlive(existing.pid))
			throw new ContentAddressedStoreBusyError();
		this.#quarantinePaths([lockPath], 'STALE_DEAD_WRITER_LOCK');
		return createWriter();
	}

	#acquireLockAcquisition(): string {
		const path = join(this.#root, ACQUISITION_FILE);
		for (let attempt = 0; attempt < 4; attempt += 1) {
			const token = randomBytes(16).toString('hex');
			try {
				durableWriteCanonicalNew(path, {
					schema: ACQUISITION_SCHEMA,
					token,
					pid: process.pid,
					acquiredAtMs: this.#now()
				} satisfies LockAcquisition);
				return token;
			} catch (error) {
				if (!isErrno(error, 'EEXIST')) throw error;
			}
			let status: ReturnType<typeof lstatSync>;
			try {
				status = lstatSync(path);
			} catch (error) {
				if (isErrno(error, 'ENOENT')) continue;
				throw error;
			}
			if (status.isSymbolicLink() || !status.isFile())
				throw new ContentAddressedStoreCorruptionError(
					'The lock-acquisition guard has an invalid filesystem shape.'
				);
			if (this.#now() - status.mtimeMs <= this.#options.lockStaleAfterMs)
				throw new ContentAddressedStoreBusyError('Another writer is acquiring the store lock.');
			let existing: LockAcquisition | undefined;
			try {
				existing = parseLockAcquisition(
					readCanonicalJson(path, 64 * 1024, 'Existing lock-acquisition guard')
				);
			} catch {
				this.#quarantinePaths([path], 'STALE_INVALID_LOCK_ACQUISITION');
				continue;
			}
			const age = this.#now() - existing.acquiredAtMs;
			if (age <= this.#options.lockStaleAfterMs || this.#options.isProcessAlive(existing.pid))
				throw new ContentAddressedStoreBusyError('Another writer is acquiring the store lock.');
			this.#quarantinePaths([path], 'STALE_DEAD_LOCK_ACQUISITION');
		}
		throw new ContentAddressedStoreBusyError(
			'The writer acquisition could not be coordinated safely.'
		);
	}

	#assertOwnLockAcquisition(token: string): void {
		const acquisition = parseLockAcquisition(
			readCanonicalJson(
				join(this.#root, ACQUISITION_FILE),
				64 * 1024,
				'Lock-acquisition fencing check'
			)
		);
		if (acquisition.token !== token || acquisition.pid !== process.pid)
			throw new ContentAddressedStoreConflictError(
				'The writer lost its lock-acquisition fencing token.'
			);
	}

	#releaseLockAcquisition(token: string): void {
		const path = join(this.#root, ACQUISITION_FILE);
		try {
			const acquisition = parseLockAcquisition(
				readCanonicalJson(path, 64 * 1024, 'Lock-acquisition release')
			);
			if (acquisition.token !== token || acquisition.pid !== process.pid) return;
			unlinkSync(path);
			fsyncDirectoryBestEffort(this.#root);
		} catch (error) {
			if (isErrno(error, 'ENOENT')) return;
			// Never unlink a guard whose ownership can no longer be proven.
		}
	}

	#assertOwnWriter(token: string): void {
		const lock = parseWriterLock(
			readCanonicalJson(join(this.#root, LOCK_FILE), 64 * 1024, 'Writer lock fencing check')
		);
		if (lock.token !== token || lock.pid !== process.pid)
			throw new ContentAddressedStoreConflictError('The writer lost its lock fencing token.');
	}

	#releaseWriter(token: string): void {
		const lockPath = join(this.#root, LOCK_FILE);
		try {
			const lock = parseWriterLock(readCanonicalJson(lockPath, 64 * 1024, 'Writer lock release'));
			if (lock.token !== token || lock.pid !== process.pid) return;
			unlinkSync(lockPath);
			fsyncDirectoryBestEffort(this.#root);
		} catch (error) {
			if (isErrno(error, 'ENOENT')) return;
			// Never unlink a lock whose ownership can no longer be proven.
		}
	}

	#recoverLocked(token: string): RecoveryState {
		this.#assertOwnWriter(token);
		const formatPath = join(this.#root, FORMAT_FILE);
		if (!existsSync(formatPath)) {
			const stateEntries = boundedDirectoryNames(
				this.#root,
				this.#options.maxDirectoryEntries
			).filter((name) => !isProtectedCoordinationEntry(name));
			if (stateEntries.length !== 0)
				return this.#rebuildStore('MISSING_FORMAT_WITH_STATE', stateEntries);
			this.#createEmptyLayout();
			return {
				result: Object.freeze({
					schema: 'JAN-CSAA-CONTENT-ADDRESSED-RECOVERY-RESULT@1',
					rebuildRequired: false,
					reason: 'EMPTY_STORE_INITIALIZED',
					currentGenerationId: null,
					quarantinedEntries: 0
				}),
				pointer: null
			};
		}
		let format: unknown;
		try {
			format = readCanonicalJson(formatPath, 64 * 1024, 'Store format');
		} catch {
			return this.#rebuildStore(
				'CORRUPT_FORMAT',
				boundedDirectoryNames(this.#root, this.#options.maxDirectoryEntries).filter(
					(name) => !isProtectedCoordinationEntry(name)
				)
			);
		}
		let schema: unknown;
		try {
			assertPlainRecord(format, 'store format');
			assertExactKeys(format, ['schema', 'hashAlgorithm'], 'store format');
			schema = dataProperty(format, 'schema', 'store format');
			if (dataProperty(format, 'hashAlgorithm', 'store format') !== 'SHA-256')
				throw new Error('hash');
		} catch {
			return this.#rebuildStore(
				'CORRUPT_FORMAT',
				boundedDirectoryNames(this.#root, this.#options.maxDirectoryEntries).filter(
					(name) => !isProtectedCoordinationEntry(name)
				)
			);
		}
		if (schema !== STORE_SCHEMA)
			return this.#rebuildStore(
				'UNKNOWN_FORMAT_VERSION',
				boundedDirectoryNames(this.#root, this.#options.maxDirectoryEntries).filter(
					(name) => !isProtectedCoordinationEntry(name)
				)
			);
		try {
			this.#ensureLayout();
		} catch {
			return this.#rebuildStore(
				'CORRUPT_LAYOUT',
				boundedDirectoryNames(this.#root, this.#options.maxDirectoryEntries).filter(
					(name) => !isProtectedCoordinationEntry(name)
				)
			);
		}
		const allowed = new Set([
			FORMAT_FILE,
			CURRENT_FILE,
			LOCK_FILE,
			ACQUISITION_FILE,
			ARTIFACTS_DIRECTORY,
			GENERATIONS_DIRECTORY,
			PUBLICATIONS_DIRECTORY,
			READERS_DIRECTORY,
			STAGING_DIRECTORY,
			QUARANTINE_DIRECTORY,
			TRASH_DIRECTORY
		]);
		const unexpected = boundedDirectoryNames(this.#root, this.#options.maxDirectoryEntries).filter(
			(name) => !allowed.has(name) && !/^\.current-[a-f0-9]{32}\.tmp$/u.test(name)
		);
		if (unexpected.length !== 0)
			return this.#rebuildStore(
				'UNEXPECTED_ROOT_ENTRY',
				boundedDirectoryNames(this.#root, this.#options.maxDirectoryEntries).filter(
					(name) => !isProtectedCoordinationEntry(name)
				)
			);
		const cleanupTargets: string[] = [];
		for (const name of boundedDirectoryNames(
			join(this.#root, STAGING_DIRECTORY),
			this.#options.maxDirectoryEntries
		))
			cleanupTargets.push(join(this.#root, STAGING_DIRECTORY, name));
		for (const name of boundedDirectoryNames(this.#root, this.#options.maxDirectoryEntries)) {
			if (/^\.current-[a-f0-9]{32}\.tmp$/u.test(name)) cleanupTargets.push(join(this.#root, name));
		}
		if (cleanupTargets.length !== 0) this.#quarantinePaths(cleanupTargets, 'ABANDONED_STAGING');
		const trashRoot = join(this.#root, TRASH_DIRECTORY);
		for (const name of boundedDirectoryNames(trashRoot, this.#options.maxDirectoryEntries))
			removeConfinedTree(trashRoot, join(trashRoot, name));
		this.#sanitizePublicationDirectory();

		const currentPath = join(this.#root, CURRENT_FILE);
		if (!existsSync(currentPath))
			return {
				result: Object.freeze({
					schema: 'JAN-CSAA-CONTENT-ADDRESSED-RECOVERY-RESULT@1',
					rebuildRequired: false,
					reason: 'NONE',
					currentGenerationId: null,
					quarantinedEntries: cleanupTargets.length
				}),
				pointer: null
			};
		try {
			const pointer = this.#readCurrentPointer();
			if (pointer === null)
				throw new ContentAddressedStoreCorruptionError('Current pointer disappeared.');
			const loaded = this.#loadGeneration(pointer.generationId, true);
			if (loaded.manifestSha256 !== pointer.manifestSha256)
				throw new ContentAddressedStoreCorruptionError('Current pointer manifest witness differs.');
			this.#ensurePublication(pointer);
			return {
				result: Object.freeze({
					schema: 'JAN-CSAA-CONTENT-ADDRESSED-RECOVERY-RESULT@1',
					rebuildRequired: false,
					reason: 'NONE',
					currentGenerationId: pointer.generationId,
					quarantinedEntries: cleanupTargets.length
				}),
				pointer
			};
		} catch {
			this.#quarantinePaths([currentPath], 'CORRUPT_CURRENT_GENERATION');
			return {
				result: Object.freeze({
					schema: 'JAN-CSAA-CONTENT-ADDRESSED-RECOVERY-RESULT@1',
					rebuildRequired: true,
					reason: 'CORRUPT_CURRENT_GENERATION',
					currentGenerationId: null,
					quarantinedEntries: cleanupTargets.length + 1
				}),
				pointer: null
			};
		}
	}

	#createEmptyLayout(): void {
		durableWriteCanonicalNew(join(this.#root, FORMAT_FILE), {
			schema: STORE_SCHEMA,
			hashAlgorithm: 'SHA-256'
		});
		this.#ensureLayout();
	}

	#ensureLayout(): void {
		for (const [name, label] of [
			[ARTIFACTS_DIRECTORY, 'Artifacts directory'],
			[GENERATIONS_DIRECTORY, 'Generations directory'],
			[PUBLICATIONS_DIRECTORY, 'Publications directory'],
			[READERS_DIRECTORY, 'Readers directory'],
			[STAGING_DIRECTORY, 'Staging directory'],
			[TRASH_DIRECTORY, 'Trash directory']
		] as const)
			ensureOrdinaryDirectory(join(this.#root, name), label);
	}

	#rebuildStore(
		reason: Exclude<
			ContentAddressedRecoveryReason,
			'NONE' | 'EMPTY_STORE_INITIALIZED' | 'CORRUPT_CURRENT_GENERATION'
		>,
		entryNames: readonly string[]
	): RecoveryState {
		const paths = entryNames.map((name) => join(this.#root, name));
		if (paths.length !== 0) this.#quarantinePaths(paths, reason);
		this.#createEmptyLayout();
		return {
			result: Object.freeze({
				schema: 'JAN-CSAA-CONTENT-ADDRESSED-RECOVERY-RESULT@1',
				rebuildRequired: true,
				reason,
				currentGenerationId: null,
				quarantinedEntries: paths.length
			}),
			pointer: null
		};
	}

	#quarantinePaths(paths: readonly string[], reason: string): void {
		if (paths.length === 0) return;
		const quarantineRoot = join(this.#root, QUARANTINE_DIRECTORY);
		ensureOrdinaryDirectory(quarantineRoot, 'Quarantine directory');
		const destination = join(quarantineRoot, randomBytes(16).toString('hex'));
		ensureOrdinaryDirectory(destination, 'Quarantine batch');
		let moved = 0;
		for (const path of paths) {
			if (!existsSync(path)) continue;
			assertConfined(this.#root, path);
			renameSync(path, join(destination, `item-${String(moved).padStart(6, '0')}`));
			moved += 1;
		}
		durableWriteCanonicalNew(join(destination, 'reason.json'), {
			schema: QUARANTINE_SCHEMA,
			reason: scalarString(reason, 'quarantine reason', 1_024),
			items: moved
		});
		fsyncDirectoryBestEffort(quarantineRoot);
	}

	#readCurrentPointer(): CurrentPointer | null {
		const path = join(this.#root, CURRENT_FILE);
		if (!existsSync(path)) return null;
		return parsePointer(readCanonicalJson(path, this.#options.maxMetadataBytes, 'Current pointer'));
	}

	#assertExpectedCurrent(expected: string | null, actual: CurrentPointer | null): void {
		if (actual?.generationId !== (expected ?? undefined)) {
			if (!(actual === null && expected === null))
				throw new ContentAddressedStoreConflictError(
					'The expected current generation is no longer current.'
				);
		}
	}

	#buildArtifacts(
		request: ValidatedPublishRequest,
		previous: GenerationManifest | null
	): readonly BuiltArtifact[] {
		const inputsByKey = new Map(request.invalidationInputs.map((entry) => [entry.key, entry]));
		const previousByKey = new Map(
			previous?.artifacts.map((entry) => [entry.logicalKey, entry]) ?? []
		);
		const built: BuiltArtifact[] = [];
		let totalBytes = 0;
		for (const definition of request.outputs) {
			checkCancellation(request.signal);
			const dependencies = dependencyDigest(definition, inputsByKey, request.subjectId);
			const prior = previousByKey.get(definition.logicalKey);
			if (
				request.mode === 'INCREMENTAL' &&
				prior !== undefined &&
				prior.artifactKind === definition.artifactKind &&
				prior.transformVersion === definition.transformVersion &&
				prior.dependencyDigest === dependencies &&
				sameStrings(prior.dependencyKeys, definition.dependencyKeys)
			) {
				readAndVerifyArtifact(
					artifactPath(this.#root, prior.sha256),
					prior,
					this.#options.maxArtifactBytes
				);
				totalBytes = this.#addArtifactBytes(totalBytes, prior.bytes);
				built.push({ reference: prior, content: null, reused: true });
				continue;
			}
			const content = this.#computeArtifact(
				definition,
				request.subjectId,
				request.invalidationInputs,
				request.signal
			);
			totalBytes = this.#addArtifactBytes(totalBytes, content.byteLength);
			built.push({
				reference: Object.freeze({
					logicalKey: definition.logicalKey,
					artifactKind: definition.artifactKind,
					transformVersion: definition.transformVersion,
					dependencyKeys: definition.dependencyKeys,
					dependencyDigest: dependencies,
					sha256: sha256(content),
					bytes: content.byteLength
				}),
				content,
				reused: false
			});
		}
		return Object.freeze(built);
	}

	#computeArtifact(
		definition: ValidatedArtifactDefinition,
		requestSubjectId: string,
		inputs: readonly ContentAddressedInvalidationInput[],
		signal: AbortSignal | undefined
	): Uint8Array {
		checkCancellation(signal);
		const inputsByKey = new Map(inputs.map((entry) => [entry.key, entry]));
		const declaredInputs = Object.freeze(
			definition.dependencyKeys.map((key) => {
				const input = inputsByKey.get(key);
				if (input === undefined)
					throw new ContentAddressedStoreValidationError(
						'Artifact computation lost a declared invalidation input.'
					);
				return input;
			})
		);
		const context: ContentAddressedArtifactComputationContext = Object.freeze({
			subjectId: requestSubjectId,
			logicalKey: definition.logicalKey,
			invalidationInputs: declaredInputs,
			signal
		});
		const value = definition.compute(context);
		checkCancellation(signal);
		if (typeof value === 'string') {
			if (!isUnicodeScalarString(value))
				throw new ContentAddressedStoreValidationError(
					'Computed text contains a lone UTF-16 surrogate.'
				);
			const bytes = Buffer.byteLength(value, 'utf8');
			if (bytes > this.#options.maxArtifactBytes)
				throw new ContentAddressedStoreValidationError(
					'A computed artifact exceeds its byte budget.'
				);
			return Uint8Array.from(Buffer.from(value, 'utf8'));
		}
		if (isProxyValue(value) || !isUint8Array(value))
			throw new ContentAddressedStoreValidationError(
				'Artifact computation must return text or Uint8Array.'
			);
		const length = Reflect.apply(TYPED_ARRAY_LENGTH_GETTER, value, []) as number;
		if (length > this.#options.maxArtifactBytes)
			throw new ContentAddressedStoreValidationError(
				'A computed artifact exceeds its byte budget.'
			);
		const copy = new Uint8Array(length);
		for (let index = 0; index < length; index += 1) copy[index] = value[index]!;
		return copy;
	}

	#addArtifactBytes(current: number, addition: number): number {
		if (addition > this.#options.maxTotalArtifactBytes - current)
			throw new ContentAddressedStoreValidationError(
				'The artifact generation exceeds its total byte budget.'
			);
		return current + addition;
	}

	#verifyCleanEquivalence(request: ValidatedPublishRequest, built: readonly BuiltArtifact[]): void {
		for (let index = 0; index < request.outputs.length; index += 1) {
			const definition = request.outputs[index]!;
			const clean = this.#computeArtifact(
				definition,
				request.subjectId,
				request.invalidationInputs,
				request.signal
			);
			const expected = built[index]!.reference;
			if (clean.byteLength !== expected.bytes || sha256(clean) !== expected.sha256)
				throw new ContentAddressedStoreEquivalenceError(definition.logicalKey);
		}
	}

	#createStagingDirectory(): string {
		const stagingRoot = join(this.#root, STAGING_DIRECTORY);
		for (let attempt = 0; attempt < 4; attempt += 1) {
			const path = join(stagingRoot, randomBytes(16).toString('hex'));
			try {
				mkdirSync(path);
				fsyncDirectoryBestEffort(stagingRoot);
				return path;
			} catch (error) {
				if (!isErrno(error, 'EEXIST')) throw error;
			}
		}
		throw new ContentAddressedStoreConflictError('Could not allocate a unique staging namespace.');
	}

	#publishStagedArtifact(stagedPath: string, digest: string): void {
		const content = readBoundedOrdinaryFile(
			stagedPath,
			this.#options.maxArtifactBytes,
			'Staged artifact',
			true
		);
		if (sha256(content) !== digest)
			throw new ContentAddressedStoreCorruptionError(
				'A staged artifact changed before publication.'
			);
		const shard = join(this.#root, ARTIFACTS_DIRECTORY, digest.slice(0, 2));
		ensureOrdinaryDirectory(shard, 'Artifact shard');
		const destination = artifactPath(this.#root, digest);
		if (existsSync(destination)) {
			try {
				readAndVerifyArtifact(
					destination,
					{ sha256: digest, bytes: content.byteLength },
					this.#options.maxArtifactBytes
				);
				unlinkSync(stagedPath);
				return;
			} catch {
				this.#quarantinePaths([destination], 'CORRUPT_CONTENT_ADDRESS');
			}
		}
		renameSync(stagedPath, destination);
		fsyncDirectoryBestEffort(shard);
	}

	#publishStagedGeneration(stagedPath: string, id: string, manifestSha256: string): void {
		const destination = join(this.#root, GENERATIONS_DIRECTORY, id);
		if (existsSync(destination)) {
			try {
				const loaded = this.#loadGeneration(id, false);
				if (loaded.manifestSha256 !== manifestSha256) throw new Error('manifest witness');
				removeConfinedTree(join(this.#root, STAGING_DIRECTORY), stagedPath);
				return;
			} catch {
				this.#quarantinePaths([destination], 'CORRUPT_GENERATION_ADDRESS');
			}
		}
		renameSync(stagedPath, destination);
		fsyncDirectoryBestEffort(join(this.#root, GENERATIONS_DIRECTORY));
	}

	#loadGeneration(idValue: string, verifyArtifacts: boolean): LoadedGeneration {
		const id = digestString(idValue, 'generationId');
		const generationPath = join(this.#root, GENERATIONS_DIRECTORY, id);
		assertOrdinaryDirectory(generationPath, 'Generation directory');
		const names = boundedDirectoryNames(generationPath, 2);
		if (names.length !== 1 || names[0] !== 'manifest.json')
			throw new ContentAddressedStoreCorruptionError(
				'A generation directory has unexpected contents.'
			);
		const manifestPath = join(generationPath, 'manifest.json');
		const value = readCanonicalJson(
			manifestPath,
			this.#options.maxMetadataBytes,
			'Generation manifest'
		);
		const manifest = asCorruption(() => {
			assertPlainRecord(value, 'generation manifest');
			assertExactKeys(
				value,
				['schema', 'subjectId', 'invalidationInputs', 'artifacts', 'generationId'],
				'generation manifest'
			);
			if (dataProperty(value, 'schema', 'generation manifest') !== GENERATION_SCHEMA)
				throw new Error('schema');
			const subjectId = scalarString(
				dataProperty(value, 'subjectId', 'generation manifest'),
				'subjectId',
				1_024
			);
			const invalidationInputs = validateInvalidationInputs(
				dataProperty(value, 'invalidationInputs', 'generation manifest'),
				this.#options.maxArtifacts,
				'generation manifest.invalidationInputs'
			);
			const inputMap = new Map(invalidationInputs.map((entry) => [entry.key, entry]));
			const artifactValues = denseArray(
				dataProperty(value, 'artifacts', 'generation manifest'),
				'generation manifest.artifacts',
				this.#options.maxArtifacts
			);
			let totalBytes = 0;
			let dependencyReferences = 0;
			const artifacts = artifactValues.map((artifactValue, index) => {
				const label = `generation manifest.artifacts[${index}]`;
				assertPlainRecord(artifactValue, label);
				assertExactKeys(
					artifactValue,
					[
						'logicalKey',
						'artifactKind',
						'transformVersion',
						'dependencyKeys',
						'dependencyDigest',
						'sha256',
						'bytes'
					],
					label
				);
				const reference: ContentAddressedArtifactReference = Object.freeze({
					logicalKey: scalarString(
						dataProperty(artifactValue, 'logicalKey', label),
						'logicalKey',
						1_024
					),
					artifactKind: scalarString(
						dataProperty(artifactValue, 'artifactKind', label),
						'artifactKind',
						1_024
					),
					transformVersion: scalarString(
						dataProperty(artifactValue, 'transformVersion', label),
						'transformVersion',
						1_024
					),
					dependencyKeys: validateDependencyKeys(
						dataProperty(artifactValue, 'dependencyKeys', label),
						new Set(inputMap.keys()),
						'dependencyKeys',
						this.#options.maxArtifacts
					),
					dependencyDigest: digestString(
						dataProperty(artifactValue, 'dependencyDigest', label),
						'dependencyDigest'
					),
					sha256: digestString(dataProperty(artifactValue, 'sha256', label), 'sha256'),
					bytes: safeInteger(
						dataProperty(artifactValue, 'bytes', label),
						'bytes',
						0,
						this.#options.maxArtifactBytes
					)
				});
				dependencyReferences += reference.dependencyKeys.length;
				if (
					dependencyReferences >
					CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxDependencyReferences
				)
					throw new Error('dependency-reference budget');
				if (reference.dependencyDigest !== dependencyDigest(reference, inputMap, subjectId))
					throw new Error('dependency digest');
				totalBytes = this.#addArtifactBytes(totalBytes, reference.bytes);
				return reference;
			});
			for (let index = 1; index < artifacts.length; index += 1) {
				if (artifacts[index - 1]!.logicalKey >= artifacts[index]!.logicalKey)
					throw new Error('artifact order');
			}
			const body: GenerationBody = Object.freeze({
				schema: GENERATION_SCHEMA,
				subjectId,
				invalidationInputs,
				artifacts: Object.freeze(artifacts)
			});
			const manifestGenerationId = digestString(
				dataProperty(value, 'generationId', 'generation manifest'),
				'generationId'
			);
			if (manifestGenerationId !== id || generationId(body) !== id)
				throw new Error('generation digest');
			return Object.freeze({ ...body, generationId: id });
		}, 'Generation manifest');
		if (verifyArtifacts)
			for (const artifact of manifest.artifacts)
				readAndVerifyArtifact(
					artifactPath(this.#root, artifact.sha256),
					artifact,
					this.#options.maxArtifactBytes
				);
		return Object.freeze({
			manifest,
			manifestSha256: sha256(Buffer.from(canonicalSemanticJson(value), 'utf8'))
		});
	}

	#replaceCurrent(pointer: CurrentPointer, token: string): void {
		const temporaryPath = join(this.#root, `.current-${token}.tmp`);
		durableReplaceCanonical(join(this.#root, CURRENT_FILE), temporaryPath, pointer);
	}

	#writePublication(pointer: CurrentPointer): void {
		const record: PublicationRecord = Object.freeze({
			schema: PUBLICATION_SCHEMA,
			generationId: pointer.generationId,
			manifestSha256: pointer.manifestSha256,
			publicationGeneration: pointer.publicationGeneration
		});
		const path = join(
			this.#root,
			PUBLICATIONS_DIRECTORY,
			publicationFileName(pointer.publicationGeneration)
		);
		if (existsSync(path)) {
			const existing = parsePublication(
				readCanonicalJson(path, this.#options.maxMetadataBytes, 'Publication record')
			);
			if (canonicalSemanticJson(existing) !== canonicalSemanticJson(record))
				throw new ContentAddressedStoreCorruptionError(
					'A publication generation collision was detected.'
				);
			return;
		}
		durableWriteCanonicalNew(path, record);
	}

	#ensurePublication(pointer: CurrentPointer): void {
		const path = join(
			this.#root,
			PUBLICATIONS_DIRECTORY,
			publicationFileName(pointer.publicationGeneration)
		);
		if (existsSync(path)) {
			try {
				const record = parsePublication(
					readCanonicalJson(path, this.#options.maxMetadataBytes, 'Current publication record')
				);
				if (
					record.generationId === pointer.generationId &&
					record.manifestSha256 === pointer.manifestSha256 &&
					record.publicationGeneration === pointer.publicationGeneration
				)
					return;
			} catch {
				// The pointer is the publication authority; quarantine a contradictory log.
			}
			this.#quarantinePaths([path], 'CONTRADICTORY_PUBLICATION_LOG');
		}
		this.#writePublication(pointer);
	}

	#publicationRecords(): readonly PublicationRecord[] {
		const root = join(this.#root, PUBLICATIONS_DIRECTORY);
		const records: PublicationRecord[] = [];
		for (const name of boundedDirectoryNames(
			root,
			Math.min(
				this.#options.maxDirectoryEntries,
				CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxPublications
			)
		)) {
			if (!/^\d{16}\.json$/u.test(name))
				throw new ContentAddressedStoreCorruptionError(
					'The publications directory has an invalid entry.'
				);
			const record = parsePublication(
				readCanonicalJson(join(root, name), this.#options.maxMetadataBytes, 'Publication record')
			);
			if (publicationFileName(record.publicationGeneration) !== name)
				throw new ContentAddressedStoreCorruptionError(
					'A publication filename contradicts its record.'
				);
			records.push(record);
		}
		records.sort((left, right) => left.publicationGeneration - right.publicationGeneration);
		for (let index = 1; index < records.length; index += 1) {
			if (records[index - 1]!.publicationGeneration === records[index]!.publicationGeneration)
				throw new ContentAddressedStoreCorruptionError(
					'Duplicate publication generations were detected.'
				);
		}
		return records;
	}

	#sanitizePublicationDirectory(): void {
		const root = join(this.#root, PUBLICATIONS_DIRECTORY);
		const corrupt: string[] = [];
		for (const name of boundedDirectoryNames(
			root,
			Math.min(
				this.#options.maxDirectoryEntries,
				CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxPublications
			)
		)) {
			const path = join(root, name);
			try {
				if (!/^\d{16}\.json$/u.test(name)) throw new Error('filename');
				const record = parsePublication(
					readCanonicalJson(path, this.#options.maxMetadataBytes, 'Publication record')
				);
				if (publicationFileName(record.publicationGeneration) !== name)
					throw new Error('record filename');
			} catch {
				corrupt.push(path);
			}
		}
		if (corrupt.length !== 0) this.#quarantinePaths(corrupt, 'CORRUPT_PUBLICATION_LOG');
	}

	#nextPublicationGeneration(current: CurrentPointer | null): number {
		const records = this.#publicationRecords();
		const last = records.at(-1)?.publicationGeneration ?? 0;
		const base = Math.max(last, current?.publicationGeneration ?? 0);
		if (base >= Number.MAX_SAFE_INTEGER)
			throw new ContentAddressedStoreCorruptionError('The publication generation is exhausted.');
		return base + 1;
	}

	#liveReaderPins(): readonly ReaderPin[] {
		const root = join(this.#root, READERS_DIRECTORY);
		const pins: ReaderPin[] = [];
		const verifiedGenerationWitnesses = new Map<string, string>();
		for (const name of boundedDirectoryNames(
			root,
			Math.min(
				this.#options.maxDirectoryEntries,
				CONTENT_ADDRESSED_FILE_STORE_SAFETY_CEILINGS.maxReaderPins
			)
		)) {
			const path = join(root, name);
			const match = /^([a-f0-9]{32})\.json$/u.exec(name);
			if (match === null)
				throw new ContentAddressedStoreCorruptionError(
					'The readers directory has an invalid entry.'
				);
			let pin: ReaderPin;
			try {
				pin = parseReaderPin(readCanonicalJson(path, 64 * 1024, 'Reader pin'));
			} catch (error) {
				const status = lstatSync(path);
				if (this.#now() - status.mtimeMs <= this.#options.readerStaleAfterMs) throw error;
				this.#quarantinePaths([path], 'STALE_INVALID_READER_PIN');
				continue;
			}
			if (pin.token !== match[1])
				throw new ContentAddressedStoreCorruptionError(
					'A reader pin token contradicts its filename.'
				);
			const stale = this.#now() - pin.createdAtMs > this.#options.readerStaleAfterMs;
			if (stale && !this.#options.isProcessAlive(pin.pid)) {
				this.#quarantinePaths([path], 'STALE_DEAD_READER_PIN');
				continue;
			}
			let manifestSha256 = verifiedGenerationWitnesses.get(pin.generationId);
			if (manifestSha256 === undefined) {
				manifestSha256 = this.#loadGeneration(pin.generationId, true).manifestSha256;
				verifiedGenerationWitnesses.set(pin.generationId, manifestSha256);
			}
			if (manifestSha256 !== pin.manifestSha256)
				throw new ContentAddressedStoreCorruptionError('A reader pin manifest witness differs.');
			pins.push(pin);
		}
		return pins;
	}

	#moveToTrashAndRemove(path: string): void {
		assertConfined(this.#root, path);
		const trashRoot = join(this.#root, TRASH_DIRECTORY);
		const destination = join(trashRoot, randomBytes(16).toString('hex'));
		renameSync(path, destination);
		fsyncDirectoryBestEffort(dirname(path));
		removeConfinedTree(trashRoot, destination);
	}

	#fault(point: ContentAddressedFileStoreFaultPoint): void {
		this.#options.fault?.(point);
	}
}
