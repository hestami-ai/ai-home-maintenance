import type { FrozenSubject } from '../contracts/subject.js';

const byteStores = new WeakMap<FrozenSubject, ReadonlyMap<string, Uint8Array>>();

export function attachFrozenSubjectBytes(
	subject: FrozenSubject,
	bytes: ReadonlyMap<string, Uint8Array>
): void {
	byteStores.set(subject, new Map([...bytes].map(([path, value]) => [path, value.slice()])));
}

export function readFrozenSubjectArtifact(
	subject: FrozenSubject,
	path: string
): Uint8Array | undefined {
	const bytes = byteStores.get(subject)?.get(path);
	return bytes?.slice();
}

export function hasFrozenSubjectArtifact(subject: FrozenSubject, path: string): boolean {
	return byteStores.get(subject)?.has(path) ?? false;
}

export function isFrozenSubjectCapability(value: unknown): value is FrozenSubject {
	return value !== null && typeof value === 'object' && byteStores.has(value as FrozenSubject);
}

export function transferFrozenSubjectBytes(source: FrozenSubject, target: FrozenSubject): void {
	const bytes = byteStores.get(source);
	if (bytes === undefined) throw new Error('Source FrozenSubject byte capability is unavailable.');
	attachFrozenSubjectBytes(target, bytes);
}
