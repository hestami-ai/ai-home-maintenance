import { isProxy } from 'node:util/types';
import {
	TYPESCRIPT_PROVIDER_VERSION,
	type SemanticDeclarationCandidateNameState
} from '../contracts/semantic.js';
import { isUnicodeScalarString } from './canonical.js';

export type DurableDeclarationLanguageVariant = 'JSX' | 'Standard';

export interface DurableDeclarationIdentityInput {
	readonly ambient: boolean;
	readonly contentSha256: string;
	readonly declarationFile: boolean;
	readonly end: number;
	readonly kind: number;
	readonly languageVariant: string;
	readonly logicalPath: string;
	readonly name: string | null;
	readonly nameState: SemanticDeclarationCandidateNameState;
	readonly scriptKind: number;
	readonly start: number;
	readonly typescriptVersion: typeof TYPESCRIPT_PROVIDER_VERSION;
}

export interface DurableDeclarationIdentityPreimage extends Omit<
	DurableDeclarationIdentityInput,
	'languageVariant'
> {
	readonly languageVariant: DurableDeclarationLanguageVariant;
}

const INPUT_KEYS = [
	'ambient',
	'contentSha256',
	'declarationFile',
	'end',
	'kind',
	'languageVariant',
	'logicalPath',
	'name',
	'nameState',
	'scriptKind',
	'start',
	'typescriptVersion'
] as const satisfies readonly (keyof DurableDeclarationIdentityInput)[];

const LANGUAGE_VARIANTS = new Set<DurableDeclarationLanguageVariant>(['JSX', 'Standard']);

const NAME_STATES = new Set<SemanticDeclarationCandidateNameState>([
	'ATOMIC',
	'COMPUTED',
	'PATTERN',
	'MISSING',
	'ANONYMOUS'
]);

const SHA256 = /^[a-f0-9]{64}$/u;

function malformed(message: string): never {
	throw new TypeError(`Durable declaration identity input ${message}`);
}

function byCodeUnitOrder(a: string, b: string): number {
	return Number(a > b) - Number(a < b);
}

function exactInputRecord(value: unknown): Record<keyof DurableDeclarationIdentityInput, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value) || isProxy(value)) {
		return malformed('must be a non-Proxy plain data object.');
	}
	const prototype = Reflect.getPrototypeOf(value) as object | null;
	if (prototype !== Object.prototype && prototype !== null) {
		return malformed('must have Object.prototype or null as its prototype.');
	}
	const ownKeys = Reflect.ownKeys(value);
	if (ownKeys.some((key) => typeof key !== 'string')) {
		return malformed('must not contain symbol properties.');
	}
	const actualKeys = [...(ownKeys as string[])].sort(byCodeUnitOrder);
	const expectedKeys = [...INPUT_KEYS].sort(byCodeUnitOrder);
	if (
		actualKeys.length !== expectedKeys.length ||
		actualKeys.some((key, index) => key !== expectedKeys[index])
	) {
		return malformed('must contain exactly the declared content-coordinate fields.');
	}
	const result = Object.create(null) as Record<keyof DurableDeclarationIdentityInput, unknown>;
	for (const key of INPUT_KEYS) {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
			return malformed(`field ${key} must be an enumerable data property.`);
		}
		result[key] = descriptor.value;
	}
	return result;
}

function booleanField(value: unknown, field: string): boolean {
	if (typeof value !== 'boolean') return malformed(`field ${field} must be boolean.`);
	return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		return malformed(`field ${field} must be a non-negative safe integer.`);
	}
	return value as number;
}

function scalarString(value: unknown, field: string): string {
	if (typeof value !== 'string' || !isUnicodeScalarString(value)) {
		return malformed(`field ${field} must be a Unicode scalar string.`);
	}
	return value;
}

function enumField<T extends string>(value: unknown, field: string, allowed: ReadonlySet<T>): T {
	if (typeof value !== 'string' || !allowed.has(value as T)) {
		return malformed(`field ${field} has an unsupported value.`);
	}
	return value as T;
}

function canonicalLogicalPath(value: unknown): string {
	const path = scalarString(value, 'logicalPath');
	if (
		path.length === 0 ||
		path.includes('\\') ||
		path.startsWith('/') ||
		/^[A-Za-z]:/u.test(path) ||
		path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
	)
		return malformed('field logicalPath must be a canonical repository-relative path.');
	return path;
}

export function durableDeclarationIdentityPreimage(
	input: DurableDeclarationIdentityInput
): DurableDeclarationIdentityPreimage {
	const record = exactInputRecord(input);
	const logicalPath = canonicalLogicalPath(record.logicalPath);
	const contentSha256 = scalarString(record.contentSha256, 'contentSha256');
	if (!SHA256.test(contentSha256)) {
		return malformed('field contentSha256 must be a lowercase SHA-256 digest.');
	}
	const typescriptVersion = scalarString(record.typescriptVersion, 'typescriptVersion');
	if (typescriptVersion !== TYPESCRIPT_PROVIDER_VERSION) {
		return malformed(`field typescriptVersion must equal ${TYPESCRIPT_PROVIDER_VERSION}.`);
	}
	const start = nonNegativeInteger(record.start, 'start');
	const end = nonNegativeInteger(record.end, 'end');
	if (start > end) return malformed('requires start to be less than or equal to end.');
	const nameState = enumField(record.nameState, 'nameState', NAME_STATES);
	const name = record.name === null ? null : scalarString(record.name, 'name');
	if (nameState === 'ATOMIC' ? name === null || name.length === 0 : name !== null) {
		return malformed('requires a non-empty exact name only for ATOMIC nameState.');
	}

	return Object.freeze({
		ambient: booleanField(record.ambient, 'ambient'),
		contentSha256,
		declarationFile: booleanField(record.declarationFile, 'declarationFile'),
		end,
		kind: nonNegativeInteger(record.kind, 'kind'),
		languageVariant: enumField(record.languageVariant, 'languageVariant', LANGUAGE_VARIANTS),
		logicalPath,
		name,
		nameState,
		scriptKind: nonNegativeInteger(record.scriptKind, 'scriptKind'),
		start,
		typescriptVersion
	});
}
