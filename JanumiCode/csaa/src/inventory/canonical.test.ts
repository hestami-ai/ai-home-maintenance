import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { assertCanonicalRelativePath, repositoryRelativePath } from '../subject/paths.js';
import { canonicalJson, compareText, sortUniqueBy } from './canonical.js';

const temporaryRoots: string[] = [];

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('canonical inventory primitives', () => {
	it('uses explicit locale-independent code-unit ordering, including case and non-ASCII keys', () => {
		const keys = ['é', 'a', 'ä', 'A'];
		expect([...keys].sort(compareText)).toEqual(['A', 'a', 'ä', 'é']);
		expect(canonicalJson({ é: 4, a: 2, ä: 3, A: 1 })).toBe(
			'{\n  "A": 1,\n  "a": 2,\n  "ä": 3,\n  "é": 4\n}\n'
		);
	});

	it('sorts declared populations and rejects duplicate canonical keys', () => {
		expect(sortUniqueBy([{ id: 'b' }, { id: 'a' }], (value) => value.id, 'fixture')).toEqual([
			{ id: 'a' },
			{ id: 'b' }
		]);
		expect(() => sortUniqueBy([{ id: 'a' }, { id: 'a' }], (value) => value.id, 'fixture')).toThrow(
			'Duplicate fixture: a'
		);
	});

	it('normalizes repository-relative paths and rejects traversal', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-path-'));
		temporaryRoots.push(root);
		mkdirSync(join(root, 'packages', 'demo'), { recursive: true });
		expect(repositoryRelativePath(root, join(root, 'packages', 'demo'))).toBe('packages/demo');
		expect(() => repositoryRelativePath(root, join(root, '..'))).toThrow('escapes repository root');
		expect(() => assertCanonicalRelativePath('packages\\demo')).toThrow('Non-canonical');
		expect(() => assertCanonicalRelativePath('../demo')).toThrow('Non-canonical');
	});
});
