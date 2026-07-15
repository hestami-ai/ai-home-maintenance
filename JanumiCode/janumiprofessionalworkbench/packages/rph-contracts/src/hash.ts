// Content hashing for the engine — underpins baseline identity (object_id + semanticVersion +
// contentHash) and evidence integrity (§5 ratify sheet: "SHA-256 over canonical JSON", resolving the
// DOC-007 SHOULD/MUST gap to MUST for baseline items and admitted evidence).
//
// Canonicalization is a DETERMINISTIC subset scheme (JCS-aligned for our data shape):
//   - object keys sorted ascending by UTF-16 code unit (JS default string sort);
//   - minimal separators, no insignificant whitespace;
//   - `undefined`-valued keys omitted (JSON semantics; never persist `undefined`);
//   - numbers MUST be finite integers (the domain models quantities as integers or strings;
//     a float in hashed content is a modeling smell and is rejected loudly, per the Constitution's
//     "fail loud on invariants" rule).
// Cross-language interop (a future platform/MP concern) can upgrade to full RFC-8785 JCS behind the
// same `contentHash` seam without changing call sites, because the prefix records the algorithm.
import { createHash } from 'node:crypto';

export class CanonicalJsonError extends Error {
	override readonly name = 'CanonicalJsonError';
}

/** Deterministic canonical JSON string for the hashable subset of JSON values. */
export function canonicalJson(value: unknown): string {
	return serialize(value);
}

function serializeNumber(n: number): string {
	if (!Number.isFinite(n)) {
		throw new CanonicalJsonError(`Non-finite number cannot be canonicalized: ${String(n)}`);
	}
	if (!Number.isInteger(n)) {
		throw new CanonicalJsonError(
			`Non-integer number cannot be canonicalized (model as integer or string): ${String(n)}`
		);
	}
	return String(n);
}

function serializeObject(obj: Record<string, unknown>): string {
	const proto = Object.getPrototypeOf(obj);
	if (proto !== Object.prototype && proto !== null) {
		throw new CanonicalJsonError(
			'Only plain objects (and arrays) are hashable; got a non-plain object (e.g. Date/Map/class instance). Convert to a plain JSON value first.'
		);
	}
	const keys = Object.keys(obj)
		.filter((k) => obj[k] !== undefined)
		.sort((a, b) => Number(a > b) - Number(a < b));
	const body = keys
		.map((k) => {
			const entry = `${JSON.stringify(k)}:${serialize(obj[k])}`;
			return entry;
		})
		.join(',');
	return `{${body}}`;
}

function serialize(v: unknown): string {
	if (v === null) return 'null';
	const t = typeof v;
	if (t === 'string') return JSON.stringify(v);
	if (t === 'boolean') return v ? 'true' : 'false';
	if (t === 'bigint') return (v as bigint).toString();
	if (t === 'number') return serializeNumber(v as number);
	if (t === 'undefined') {
		throw new CanonicalJsonError(
			'undefined cannot be canonicalized at the top level; use null or omit'
		);
	}
	if (Array.isArray(v)) {
		return `[${v.map((el) => serialize(el === undefined ? null : el)).join(',')}]`;
	}
	if (t === 'object') {
		return serializeObject(v as Record<string, unknown>);
	}
	throw new CanonicalJsonError(`Unsupported type for canonicalization: ${t}`);
}

/** Lowercase hex SHA-256 of a UTF-8 string. */
export function sha256Hex(input: string): string {
	return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * The canonical content hash used across the engine. Returns `sha256:<hex>` so the algorithm is
 * explicit in every stored/compared hash (enables future algorithm agility without silent breakage).
 */
export function contentHash(value: unknown): string {
	return `sha256:${sha256Hex(canonicalJson(value))}`;
}
