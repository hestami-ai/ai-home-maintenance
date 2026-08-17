import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

export function isProxyValue(value: unknown): boolean {
	return (
		value !== null && (typeof value === 'object' || typeof value === 'function') && isProxy(value)
	);
}

export function isUnicodeScalarString(text: string): boolean {
	for (let index = 0; index < text.length; index += 1) {
		const code = text.charCodeAt(index);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = text.charCodeAt(index + 1);
			if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff) return false;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			return false;
		}
	}
	return true;
}

export function utf16CodeUnits(text: string): Uint16Array {
	const units = new Uint16Array(text.length);
	for (let index = 0; index < text.length; index += 1) units[index] = text.charCodeAt(index);
	return units;
}

export function utf16CodeUnitsHex(text: string): string {
	let encoded = '';
	for (let index = 0; index < text.length; index += 1)
		encoded += text.charCodeAt(index).toString(16).padStart(4, '0');
	return encoded;
}

export function parseUtf16CodeUnitsHex(encoded: string): Uint16Array | null {
	if (encoded.length % 4 !== 0 || !/^[a-f0-9]*$/u.test(encoded)) return null;
	const units = new Uint16Array(encoded.length / 4);
	for (let index = 0; index < units.length; index += 1)
		units[index] = Number.parseInt(encoded.slice(index * 4, index * 4 + 4), 16);
	return units;
}

export function hasLoneUtf16CodeUnit(units: Uint16Array): boolean {
	for (let index = 0; index < units.length; index += 1) {
		const code = units[index]!;
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = units[index + 1];
			if (next === undefined || next < 0xdc00 || next > 0xdfff) return true;
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			return true;
		}
	}
	return false;
}

export function semanticUtf16CodeUnitsDigest(
	domain: string,
	discriminators: readonly string[],
	value: string | Uint16Array
): string {
	const units = typeof value === 'string' ? utf16CodeUnits(value) : value;
	const bytes = new Uint8Array(units.length * 2);
	for (let index = 0; index < units.length; index += 1) {
		const code = units[index]!;
		bytes[index * 2] = code & 0xff;
		bytes[index * 2 + 1] = code >>> 8;
	}
	const hash = createHash('sha256');
	hash.update('JAN-CSAA-UTF16-CODE-UNITS-LE\0', 'utf8');
	hash.update(domain, 'utf8');
	for (const discriminator of discriminators) {
		hash.update('\0', 'utf8');
		hash.update(discriminator, 'utf8');
	}
	hash.update('\0', 'utf8');
	hash.update(bytes);
	return hash.digest('hex');
}

export interface EncodedSemanticDiagnosticText {
	readonly text: string;
	readonly textEncoding: 'UNICODE_SCALAR' | 'UTF16_CODE_UNITS_HEX';
	readonly textLength: number;
	readonly textSha256: string;
}

export function encodeSemanticDiagnosticText(text: string): EncodedSemanticDiagnosticText {
	const textEncoding = isUnicodeScalarString(text) ? 'UNICODE_SCALAR' : 'UTF16_CODE_UNITS_HEX';
	return {
		text: textEncoding === 'UNICODE_SCALAR' ? text : utf16CodeUnitsHex(text),
		textEncoding,
		textLength: text.length,
		textSha256: semanticUtf16CodeUnitsDigest('JAN-CSAA-DIAGNOSTIC-TEXT', [textEncoding], text)
	};
}

export interface CanonicalSemanticJsonWitness {
	readonly bytes: number;
	readonly sha256: string;
}

type CanonicalChunkWriter = (chunk: string) => void;
export type CanonicalSemanticJsonProgress = () => void;

const CANONICAL_BUFFER_LIMIT = 64 * 1024;
const CANONICAL_BUFFER_CHUNK_LIMIT = 1_024;
const CANONICAL_PROGRESS_CADENCE = 256;

/** Bounded progress cadence shared by the resource-observable canonical traversals. */
function createCanonicalProgressStep(
	onProgress: CanonicalSemanticJsonProgress | undefined
): () => void {
	let workSinceProgress = 0;
	return (): void => {
		if (onProgress === undefined) return;
		workSinceProgress += 1;
		if (workSinceProgress < CANONICAL_PROGRESS_CADENCE) return;
		workSinceProgress = 0;
		onProgress();
	};
}

/**
 * The canonical JSON escape table, transcribed exactly. Keys are distinct UTF-16 code units, so a
 * single lookup reproduces the ordered equality chain it replaces.
 */
const CANONICAL_JSON_SHORT_ESCAPES = new Map<number, string>([
	[0x22, '\\"'],
	[0x5c, '\\\\'],
	[0x08, '\\b'],
	[0x09, '\\t'],
	[0x0a, '\\n'],
	[0x0c, '\\f'],
	[0x0d, '\\r']
]);

/** Returns the escape sequence for a code unit, or undefined when it is emitted verbatim. */
function canonicalJsonEscapeSequence(code: number): string | undefined {
	const shortEscape = CANONICAL_JSON_SHORT_ESCAPES.get(code);
	if (shortEscape !== undefined) return shortEscape;
	if (code < 0x20) return `\\u${code.toString(16).padStart(4, '0')}`;
	return undefined;
}

function canonicalJsonEncodedPiece(
	text: string,
	index: number
): { readonly encoded: string; readonly nextIndex: number } {
	const code = text.charCodeAt(index);
	if (code >= 0xd800 && code <= 0xdbff) {
		const next = text.charCodeAt(index + 1);
		if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff)
			throw new TypeError('Semantic canonical JSON rejects lone UTF-16 surrogates.');
		return { encoded: text.slice(index, index + 2), nextIndex: index + 2 };
	}
	if (code >= 0xdc00 && code <= 0xdfff)
		throw new TypeError('Semantic canonical JSON rejects lone UTF-16 surrogates.');
	const encoded = canonicalJsonEscapeSequence(code) ?? text[index]!;
	return { encoded, nextIndex: index + 1 };
}

function compareUtf16CodeUnitStrings(left: string, right: string, step: () => void): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		step();
		const difference = left.charCodeAt(index) - right.charCodeAt(index);
		if (difference !== 0) return difference < 0 ? -1 : 1;
	}
	if (left.length < right.length) return -1;
	if (left.length > right.length) return 1;
	return 0;
}

type CanonicalSemanticEntry = readonly [string, unknown];

function dataDescriptor(input: object, key: PropertyKey): PropertyDescriptor {
	const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
	if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor))
		throw new TypeError('Semantic canonical JSON requires enumerable data properties.');
	return descriptor;
}

function assertCanonicalSemanticNumber(input: number): void {
	if (!Number.isFinite(input))
		throw new TypeError('Semantic canonical JSON requires finite numbers.');
	if (Number.isInteger(input) && !Number.isSafeInteger(input))
		throw new TypeError('Semantic canonical JSON rejects unsafe integer values.');
}

/** Validates array shape (no expandos, dense, safe length) and returns the canonical length. */
function canonicalSemanticArrayLength(input: readonly unknown[], step: () => void): number {
	const ownKeys = Reflect.ownKeys(input);
	for (const key of ownKeys) {
		step();
		if (typeof key !== 'string' || (key !== 'length' && !/^(?:0|[1-9]\d*)$/u.test(key)))
			throw new TypeError('Semantic canonical JSON rejects array expando properties.');
	}
	const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, 'length');
	const length =
		lengthDescriptor !== undefined && 'value' in lengthDescriptor
			? lengthDescriptor.value
			: undefined;
	if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0)
		throw new TypeError('Semantic canonical JSON requires a valid array length.');
	if (ownKeys.length !== length + 1)
		throw new TypeError('Semantic canonical JSON rejects sparse arrays.');
	return length;
}

function emitCanonicalSemanticArray(
	input: readonly unknown[],
	length: number,
	emit: CanonicalChunkWriter,
	step: () => void,
	serialize: (value: unknown) => void
): void {
	emit('[');
	for (let index = 0; index < length; index += 1) {
		step();
		if (index !== 0) emit(',');
		serialize(dataDescriptor(input, String(index)).value);
	}
	emit(']');
}

/** Validates object shape and returns its entries in UTF-16 code-unit key order. */
function canonicalSemanticObjectEntries(
	input: object,
	step: () => void,
	assertUnicodeScalars: (text: string) => void
): readonly CanonicalSemanticEntry[] {
	const prototype = Reflect.getPrototypeOf(input) as object | null;
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError('Semantic canonical JSON requires plain objects.');
	const ownKeys = Reflect.ownKeys(input);
	for (const key of ownKeys) {
		step();
		if (typeof key !== 'string')
			throw new TypeError('Semantic canonical JSON rejects symbol properties.');
	}
	return (ownKeys as string[])
		.map((key) => {
			step();
			assertUnicodeScalars(key);
			return [key, dataDescriptor(input, key).value] as const;
		})
		.sort(([left], [right]) => {
			step();
			return compareUtf16CodeUnitStrings(left, right, step);
		});
}

function emitCanonicalSemanticObject(
	entries: readonly CanonicalSemanticEntry[],
	emit: CanonicalChunkWriter,
	step: () => void,
	writeCanonicalString: (text: string) => void,
	serialize: (value: unknown) => void
): void {
	emit('{');
	for (let index = 0; index < entries.length; index += 1) {
		step();
		if (index !== 0) emit(',');
		const [key, child] = entries[index]!;
		writeCanonicalString(key);
		emit(':');
		serialize(child);
	}
	emit('}');
}

function writeCanonicalSemanticJson(
	value: unknown,
	write: CanonicalChunkWriter,
	onProgress?: CanonicalSemanticJsonProgress
): void {
	const ancestors = new Set<object>();
	const step = createCanonicalProgressStep(onProgress);
	const emit = (chunk: string): void => {
		step();
		write(chunk);
	};

	function assertUnicodeScalars(text: string): void {
		for (let index = 0; index < text.length; index += 1) {
			step();
			const code = text.charCodeAt(index);
			if (code >= 0xd800 && code <= 0xdbff) {
				const next = text.charCodeAt(index + 1);
				if (!Number.isInteger(next) || next < 0xdc00 || next > 0xdfff)
					throw new TypeError('Semantic canonical JSON rejects lone UTF-16 surrogates.');
				index += 1;
				step();
			} else if (code >= 0xdc00 && code <= 0xdfff) {
				throw new TypeError('Semantic canonical JSON rejects lone UTF-16 surrogates.');
			}
		}
	}

	function writeCanonicalString(text: string): void {
		emit('"');
		let pieces: string[] = [];
		let bufferedCodeUnits = 0;
		const flush = (): void => {
			if (pieces.length === 0) return;
			emit(pieces.join(''));
			pieces = [];
			bufferedCodeUnits = 0;
		};
		for (let index = 0; index < text.length;) {
			step();
			const piece = canonicalJsonEncodedPiece(text, index);
			if (piece.nextIndex === index + 2) {
				step();
				bufferedCodeUnits += 2;
			} else bufferedCodeUnits += 1;
			pieces.push(piece.encoded);
			index = piece.nextIndex;
			if (bufferedCodeUnits >= CANONICAL_PROGRESS_CADENCE) flush();
		}
		flush();
		emit('"');
	}

	function serialize(input: unknown): void {
		step();
		if (input === null) {
			emit('null');
			return;
		}
		if (typeof input === 'string') {
			writeCanonicalString(input);
			return;
		}
		if (typeof input === 'boolean') {
			emit(input ? 'true' : 'false');
			return;
		}
		if (typeof input === 'number') {
			assertCanonicalSemanticNumber(input);
			emit(JSON.stringify(input));
			return;
		}
		if (typeof input !== 'object')
			throw new TypeError(`Semantic canonical JSON cannot serialize ${typeof input}.`);
		if (isProxyValue(input)) throw new TypeError('Semantic canonical JSON rejects Proxy values.');
		if (ancestors.has(input)) throw new TypeError('Semantic canonical JSON rejects cyclic values.');
		ancestors.add(input);
		try {
			if (Array.isArray(input)) {
				const length = canonicalSemanticArrayLength(input, step);
				emitCanonicalSemanticArray(input, length, emit, step, serialize);
				return;
			}
			const entries = canonicalSemanticObjectEntries(input, step, assertUnicodeScalars);
			emitCanonicalSemanticObject(entries, emit, step, writeCanonicalString, serialize);
		} finally {
			ancestors.delete(input);
		}
	}

	onProgress?.();
	serialize(value);
	onProgress?.();
}

function* canonicalJsonStringCodeUnits(
	text: string,
	step: () => void
): Generator<number, void, undefined> {
	yield 0x22;
	for (let index = 0; index < text.length;) {
		step();
		const piece = canonicalJsonEncodedPiece(text, index);
		for (let pieceIndex = 0; pieceIndex < piece.encoded.length; pieceIndex += 1) {
			step();
			yield piece.encoded.charCodeAt(pieceIndex);
		}
		index = piece.nextIndex;
	}
	yield 0x22;
}

/** @internal Exact bounded comparator for canonical JSON string tokens. */
export function compareCanonicalSemanticJsonStrings(
	left: string,
	right: string,
	onProgress?: CanonicalSemanticJsonProgress
): number {
	onProgress?.();
	const step = createCanonicalProgressStep(onProgress);
	const leftUnits = canonicalJsonStringCodeUnits(left, step);
	const rightUnits = canonicalJsonStringCodeUnits(right, step);
	while (true) {
		const leftUnit = leftUnits.next();
		const rightUnit = rightUnits.next();
		if (leftUnit.done || rightUnit.done) {
			onProgress?.();
			if (leftUnit.done === rightUnit.done) return 0;
			if (leftUnit.done) return -1;
			return 1;
		}
		if (leftUnit.value !== rightUnit.value) {
			onProgress?.();
			return leftUnit.value < rightUnit.value ? -1 : 1;
		}
	}
}

/**
 * The semantic identity profile is a deliberately separate RFC 8785 / JCS
 * subset. DWP-001's pretty-printed inventory canonicalization is an existing
 * identity contract and must not be reused or changed for semantic identities.
 */
export function canonicalSemanticJson(value: unknown): string {
	return canonicalSemanticJsonWithProgress(value);
}

/** @internal Resource-observable form used by bounded semantic operations. */
export function canonicalSemanticJsonWithProgress(
	value: unknown,
	onProgress?: CanonicalSemanticJsonProgress
): string {
	const output: string[] = [];
	let buffered: string[] = [];
	let bufferedCharacters = 0;
	const flush = (): void => {
		if (buffered.length === 0) return;
		output.push(buffered.join(''));
		buffered = [];
		bufferedCharacters = 0;
	};
	writeCanonicalSemanticJson(
		value,
		(chunk) => {
			if (chunk.length >= CANONICAL_BUFFER_LIMIT) {
				flush();
				output.push(chunk);
				return;
			}
			if (
				bufferedCharacters + chunk.length > CANONICAL_BUFFER_LIMIT ||
				buffered.length >= CANONICAL_BUFFER_CHUNK_LIMIT
			)
				flush();
			buffered.push(chunk);
			bufferedCharacters += chunk.length;
		},
		onProgress
	);
	flush();
	onProgress?.();
	const canonical = output.join('');
	onProgress?.();
	return canonical;
}

/**
 * Bounded UTF-8 batching in front of a SHA-256 accumulator. The emitted byte order is exactly the
 * order chunks are written, so batching never changes the digest preimage.
 */
function createCanonicalHashBuffer(hash: ReturnType<typeof createHash>): {
	readonly write: (chunk: string, chunkBytes: number) => void;
	readonly flush: () => void;
} {
	let buffered: string[] = [];
	let bufferedBytes = 0;
	const flush = (): void => {
		if (buffered.length === 0) return;
		hash.update(buffered.join(''), 'utf8');
		buffered = [];
		bufferedBytes = 0;
	};
	const write = (chunk: string, chunkBytes: number): void => {
		if (chunkBytes >= CANONICAL_BUFFER_LIMIT) {
			flush();
			hash.update(chunk, 'utf8');
			return;
		}
		if (
			bufferedBytes + chunkBytes > CANONICAL_BUFFER_LIMIT ||
			buffered.length >= CANONICAL_BUFFER_CHUNK_LIMIT
		)
			flush();
		buffered.push(chunk);
		bufferedBytes += chunkBytes;
	};
	return { write, flush };
}

/**
 * Computes the exact witness for the canonical UTF-8 representation while
 * retaining only a bounded batch of emitted canonical tokens.
 */
export function canonicalSemanticJsonWitness(value: unknown): CanonicalSemanticJsonWitness {
	return canonicalSemanticJsonWitnessWithProgress(value);
}

/** @internal Resource-observable form used by bounded semantic operations. */
export function canonicalSemanticJsonWitnessWithProgress(
	value: unknown,
	onProgress?: CanonicalSemanticJsonProgress
): CanonicalSemanticJsonWitness {
	const hash = createHash('sha256');
	let bytes = 0;
	const buffer = createCanonicalHashBuffer(hash);
	writeCanonicalSemanticJson(
		value,
		(chunk) => {
			const chunkBytes = Buffer.byteLength(chunk, 'utf8');
			if (chunkBytes > Number.MAX_SAFE_INTEGER - bytes)
				throw new TypeError('Semantic canonical JSON byte length exceeds safe-integer range.');
			bytes += chunkBytes;
			buffer.write(chunk, chunkBytes);
		},
		onProgress
	);
	buffer.flush();
	onProgress?.();
	const sha256 = hash.digest('hex');
	onProgress?.();
	return { bytes, sha256 };
}

/**
 * Hashes an exact UTF-8 prefix followed by the canonical semantic JSON token stream without
 * materializing the complete canonical value. The prefix is part of the SHA-256 preimage, not a
 * separately hashed witness, so callers can preserve existing domain-separated identity bytes.
 */
export function canonicalSemanticJsonPrefixedSha256(
	prefix: string,
	value: unknown,
	onProgress?: CanonicalSemanticJsonProgress
): string {
	onProgress?.();
	if (!isUnicodeScalarString(prefix))
		throw new TypeError('Semantic canonical JSON hash prefixes require Unicode scalar text.');
	const hash = createHash('sha256');
	hash.update(prefix, 'utf8');
	onProgress?.();
	const buffer = createCanonicalHashBuffer(hash);
	writeCanonicalSemanticJson(
		value,
		(chunk) => {
			buffer.write(chunk, Buffer.byteLength(chunk, 'utf8'));
		},
		onProgress
	);
	buffer.flush();
	onProgress?.();
	const digest = hash.digest('hex');
	onProgress?.();
	return digest;
}
