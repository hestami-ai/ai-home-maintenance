import { createHash } from 'node:crypto';

export function sha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

/** Locale- and ICU-independent UTF-16 code-unit ordering for canonical bytes. */
export function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalValue);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => compareText(left, right))
				.map(([key, child]) => [key, canonicalValue(child)])
		);
	}
	return value;
}

export function canonicalJson(value: unknown): string {
	return `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
}

export function sortUniqueBy<T>(
	values: readonly T[],
	key: (value: T) => string,
	populationName: string
): T[] {
	const sorted = [...values].sort((left, right) => compareText(key(left), key(right)));
	for (let index = 1; index < sorted.length; index += 1) {
		if (key(sorted[index - 1]!) === key(sorted[index]!)) {
			throw new Error(`Duplicate ${populationName}: ${key(sorted[index]!)}`);
		}
	}
	return sorted;
}
