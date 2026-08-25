import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import { canonicalSemanticJson } from '../semantic/canonical.js';

export const CODING_AGENT_CLI_ARTIFACT_REFERENCE_PREFIX = 'artifact:sha256:' as const;

export const CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS = Object.freeze({
	maxInputBytes: 1_048_576,
	maxOutputBytes: 16_777_216
} as const);

export type CodingAgentCliArtifactErrorCode =
	| 'ARTIFACT_BUDGET_EXCEEDED'
	| 'ARTIFACT_BYTES_INVALID'
	| 'ARTIFACT_DIGEST_MISMATCH'
	| 'ARTIFACT_ENCODING_INVALID'
	| 'ARTIFACT_JSON_INVALID'
	| 'ARTIFACT_JSON_NONCANONICAL'
	| 'ARTIFACT_NOT_FOUND'
	| 'ARTIFACT_REFERENCE_INVALID'
	| 'ARTIFACT_STORE_FAILED';

export class CodingAgentCliArtifactError extends Error {
	constructor(
		readonly code: CodingAgentCliArtifactErrorCode,
		message: string
	) {
		super(message);
		this.name = 'CodingAgentCliArtifactError';
	}
}

/**
 * Trust-bound storage port. Implementations may persist outside the subject tree, but this
 * package supplies only an in-memory implementation and never interprets a reference as a path.
 */
export interface CodingAgentCliArtifactStore {
	read(reference: string): Promise<Uint8Array | null> | Uint8Array | null;
	write(reference: string, bytes: Uint8Array): Promise<void> | void;
}

export interface CodingAgentCliPublishedArtifact {
	readonly bytes: number;
	readonly digest: string;
	readonly reference: string;
}

const ARTIFACT_REFERENCE = /^artifact:sha256:([0-9a-f]{64})$/u;

function sha256(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function positiveByteBudget(maxBytes: number): number {
	if (
		!Number.isSafeInteger(maxBytes) ||
		maxBytes < 1 ||
		maxBytes > CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
	)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_BUDGET_EXCEEDED',
			'The artifact byte budget is invalid.'
		);
	return maxBytes;
}

export function codingAgentCliArtifactDigest(reference: string): string {
	const match = ARTIFACT_REFERENCE.exec(reference);
	if (match === null)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_REFERENCE_INVALID',
			'The artifact reference must be a lowercase SHA-256 content reference.'
		);
	return match[1]!;
}

export function codingAgentCliArtifactReference(bytes: Uint8Array | string): string {
	return `${CODING_AGENT_CLI_ARTIFACT_REFERENCE_PREFIX}${sha256(bytes)}`;
}

function materializeBytes(value: unknown, maxBytes: number): Uint8Array {
	if (!(value instanceof Uint8Array) || isProxy(value))
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_BYTES_INVALID',
			'The artifact store returned an invalid byte value.'
		);
	if (value.byteLength > maxBytes)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_BUDGET_EXCEEDED',
			'The content-addressed artifact exceeds its admitted byte budget.'
		);
	return Uint8Array.from(value);
}

function decodeUtf8(bytes: Uint8Array): string {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_ENCODING_INVALID',
			'The content-addressed JSON artifact is not valid UTF-8.'
		);
	}
}

function parseCanonicalJson(text: string): unknown {
	let value: unknown;
	try {
		value = JSON.parse(text) as unknown;
	} catch {
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_JSON_INVALID',
			'The content-addressed artifact is not valid JSON.'
		);
	}
	let canonical: string;
	try {
		canonical = canonicalSemanticJson(value);
	} catch {
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_JSON_INVALID',
			'The content-addressed artifact is not canonicalizable closed JSON data.'
		);
	}
	if (canonical !== text)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_JSON_NONCANONICAL',
			'The content-addressed JSON artifact is not in canonical form.'
		);
	return value;
}

export async function readCodingAgentCliJsonArtifact(
	store: CodingAgentCliArtifactStore,
	reference: string,
	maxBytes: number = CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxInputBytes
): Promise<unknown> {
	const budget = positiveByteBudget(maxBytes);
	const expectedDigest = codingAgentCliArtifactDigest(reference);
	let stored: Uint8Array | null;
	try {
		stored = await store.read(reference);
	} catch {
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_STORE_FAILED',
			'The content-addressed artifact store could not read the requested artifact.'
		);
	}
	if (stored === null)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_NOT_FOUND',
			'The requested content-addressed artifact is unavailable.'
		);
	const bytes = materializeBytes(stored, budget);
	if (sha256(bytes) !== expectedDigest)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_DIGEST_MISMATCH',
			'The artifact bytes do not match their content address.'
		);
	return parseCanonicalJson(decodeUtf8(bytes));
}

export async function publishCodingAgentCliJsonArtifact(
	store: CodingAgentCliArtifactStore,
	value: unknown,
	maxBytes: number
): Promise<CodingAgentCliPublishedArtifact> {
	const budget = positiveByteBudget(maxBytes);
	let json: string;
	try {
		json = canonicalSemanticJson(value);
	} catch {
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_JSON_INVALID',
			'The operation result could not be represented as canonical closed JSON data.'
		);
	}
	const encoded = new TextEncoder().encode(json);
	if (encoded.byteLength > budget)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_BUDGET_EXCEEDED',
			'The operation result artifact exceeds the admitted output byte budget.'
		);
	const bytes = Uint8Array.from(encoded);
	const digest = sha256(bytes);
	const reference = `${CODING_AGENT_CLI_ARTIFACT_REFERENCE_PREFIX}${digest}`;
	try {
		await store.write(reference, Uint8Array.from(bytes));
	} catch {
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_STORE_FAILED',
			'The content-addressed artifact store could not publish the operation result.'
		);
	}

	// A result reference is admitted only after exact read-after-write verification.
	const verified = await readCodingAgentCliJsonArtifact(store, reference, budget);
	if (canonicalSemanticJson(verified) !== json)
		throw new CodingAgentCliArtifactError(
			'ARTIFACT_DIGEST_MISMATCH',
			'The published operation result failed read-after-write verification.'
		);
	return Object.freeze({ bytes: bytes.byteLength, digest, reference });
}

export class InMemoryCodingAgentCliArtifactStore implements CodingAgentCliArtifactStore {
	readonly #artifacts = new Map<string, Uint8Array>();

	read(reference: string): Uint8Array | null {
		const value = this.#artifacts.get(reference);
		return value === undefined ? null : Uint8Array.from(value);
	}

	write(reference: string, bytes: Uint8Array): void {
		const digest = codingAgentCliArtifactDigest(reference);
		const materialized = materializeBytes(
			bytes,
			CODING_AGENT_CLI_ARTIFACT_SAFETY_CEILINGS.maxOutputBytes
		);
		if (sha256(materialized) !== digest)
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_DIGEST_MISMATCH',
				'The artifact write does not match its content address.'
			);
		const existing = this.#artifacts.get(reference);
		if (existing !== undefined && !Buffer.from(existing).equals(Buffer.from(materialized)))
			throw new CodingAgentCliArtifactError(
				'ARTIFACT_DIGEST_MISMATCH',
				'The content-addressed artifact store refused a conflicting write.'
			);
		this.#artifacts.set(reference, Uint8Array.from(materialized));
	}
}
