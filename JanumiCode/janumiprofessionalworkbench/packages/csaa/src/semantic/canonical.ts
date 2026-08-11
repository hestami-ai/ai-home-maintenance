import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

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
	for (let index = 0; index < text.length; index += 1) encoded += text.charCodeAt(index).toString(16).padStart(4, '0');
	return encoded;
}

export function parseUtf16CodeUnitsHex(encoded: string): Uint16Array | null {
	if (encoded.length % 4 !== 0 || !/^[a-f0-9]*$/u.test(encoded)) return null;
	const units = new Uint16Array(encoded.length / 4);
	for (let index = 0; index < units.length; index += 1) units[index] = Number.parseInt(encoded.slice(index * 4, index * 4 + 4), 16);
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

export function semanticUtf16CodeUnitsDigest(domain: string, discriminators: readonly string[], value: string | Uint16Array): string {
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

const CANONICAL_BUFFER_LIMIT = 64 * 1024;
const CANONICAL_BUFFER_CHUNK_LIMIT = 1_024;

function writeCanonicalSemanticJson(value: unknown, write: CanonicalChunkWriter): void {
	const ancestors = new Set<object>();

	function assertUnicodeScalars(text: string): void {
		if (!isUnicodeScalarString(text)) throw new TypeError('Semantic canonical JSON rejects lone UTF-16 surrogates.');
	}

	function dataDescriptor(input: object, key: PropertyKey): PropertyDescriptor {
		const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
		if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) throw new TypeError('Semantic canonical JSON requires enumerable data properties.');
		return descriptor;
	}

	function serialize(input: unknown): void {
		if (input === null) {
			write('null');
			return;
		}
		if (typeof input === 'string') {
			assertUnicodeScalars(input);
			write(JSON.stringify(input));
			return;
		}
		if (typeof input === 'boolean') {
			write(input ? 'true' : 'false');
			return;
		}
		if (typeof input === 'number') {
			if (!Number.isFinite(input)) throw new TypeError('Semantic canonical JSON requires finite numbers.');
			if (Number.isInteger(input) && !Number.isSafeInteger(input)) throw new TypeError('Semantic canonical JSON rejects unsafe integer values.');
			write(JSON.stringify(input));
			return;
		}
		if (typeof input !== 'object') throw new TypeError(`Semantic canonical JSON cannot serialize ${typeof input}.`);
		if (isProxy(input)) throw new TypeError('Semantic canonical JSON rejects Proxy values.');
		if (ancestors.has(input)) throw new TypeError('Semantic canonical JSON rejects cyclic values.');
		ancestors.add(input);
		try {
			if (Array.isArray(input)) {
				const ownKeys = Reflect.ownKeys(input);
				if (ownKeys.some((key) => typeof key !== 'string' || key !== 'length' && !/^(?:0|[1-9][0-9]*)$/u.test(key))) throw new TypeError('Semantic canonical JSON rejects array expando properties.');
				const lengthDescriptor = Reflect.getOwnPropertyDescriptor(input, 'length');
				const length = lengthDescriptor !== undefined && 'value' in lengthDescriptor ? lengthDescriptor.value : undefined;
				if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) throw new TypeError('Semantic canonical JSON requires a valid array length.');
				if (ownKeys.length !== length + 1) throw new TypeError('Semantic canonical JSON rejects sparse arrays.');
				write('[');
				for (let index = 0; index < length; index += 1) {
					if (index !== 0) write(',');
					serialize(dataDescriptor(input, String(index)).value);
				}
				write(']');
				return;
			}
			const prototype = Reflect.getPrototypeOf(input) as object | null;
			if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Semantic canonical JSON requires plain objects.');
			const ownKeys = Reflect.ownKeys(input);
			if (ownKeys.some((key) => typeof key !== 'string')) throw new TypeError('Semantic canonical JSON rejects symbol properties.');
			const entries = (ownKeys as string[]).map((key) => {
				assertUnicodeScalars(key);
				return [key, dataDescriptor(input, key).value] as const;
			}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
			write('{');
			for (let index = 0; index < entries.length; index += 1) {
				if (index !== 0) write(',');
				const [key, child] = entries[index]!;
				write(JSON.stringify(key));
				write(':');
				serialize(child);
			}
			write('}');
		} finally {
			ancestors.delete(input);
		}
	}

	serialize(value);
}

/**
 * The semantic identity profile is a deliberately separate RFC 8785 / JCS
 * subset. DWP-001's pretty-printed inventory canonicalization is an existing
 * identity contract and must not be reused or changed for semantic identities.
 */
export function canonicalSemanticJson(value: unknown): string {
	const output: string[] = [];
	let buffered: string[] = [];
	let bufferedCharacters = 0;
	const flush = (): void => {
		if (buffered.length === 0) return;
		output.push(buffered.join(''));
		buffered = [];
		bufferedCharacters = 0;
	};
	writeCanonicalSemanticJson(value, (chunk) => {
		if (chunk.length >= CANONICAL_BUFFER_LIMIT) {
			flush();
			output.push(chunk);
			return;
		}
		if (bufferedCharacters + chunk.length > CANONICAL_BUFFER_LIMIT || buffered.length >= CANONICAL_BUFFER_CHUNK_LIMIT) flush();
		buffered.push(chunk);
		bufferedCharacters += chunk.length;
	});
	flush();
	return output.join('');
}

/**
 * Computes the exact witness for the canonical UTF-8 representation while
 * retaining only a bounded batch of emitted canonical tokens.
 */
export function canonicalSemanticJsonWitness(value: unknown): CanonicalSemanticJsonWitness {
	const hash = createHash('sha256');
	let bytes = 0;
	let buffered: string[] = [];
	let bufferedBytes = 0;
	const flush = (): void => {
		if (buffered.length === 0) return;
		hash.update(buffered.join(''), 'utf8');
		buffered = [];
		bufferedBytes = 0;
	};
	writeCanonicalSemanticJson(value, (chunk) => {
		const chunkBytes = Buffer.byteLength(chunk, 'utf8');
		bytes += chunkBytes;
		if (chunkBytes >= CANONICAL_BUFFER_LIMIT) {
			flush();
			hash.update(chunk, 'utf8');
			return;
		}
		if (bufferedBytes + chunkBytes > CANONICAL_BUFFER_LIMIT || buffered.length >= CANONICAL_BUFFER_CHUNK_LIMIT) flush();
		buffered.push(chunk);
		bufferedBytes += chunkBytes;
	});
	flush();
	return { bytes, sha256: hash.digest('hex') };
}
