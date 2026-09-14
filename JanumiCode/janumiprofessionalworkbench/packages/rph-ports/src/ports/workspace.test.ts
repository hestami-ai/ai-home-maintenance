// JAN-EXEC Phase 1 — the containment predicate, pinned in BOTH directions.
//
// ⛔ THIS IS THE ONLY THING STANDING BETWEEN A MODEL-SUPPLIED PATH AND THE HOST'S FILESYSTEM. Every escape here
// is an escape a filesystem adapter would perform for real, so the predicate is tested at the PORT rather than
// once per adapter — the same argument `artifact-store-contract.ts` makes about `purge`.
import { describe, expect, it } from 'vitest';
import { containedWorkspacePath } from './workspace.js';

describe('containedWorkspacePath — what may not leave the workspace', () => {
	it('⛔ REFUSES every shape that resolves outside the workspace root', () => {
		// THE MUTANT: normalize first and check afterwards. `/etc/passwd` normalizes to a tidy-looking
		// `etc/passwd` and reads as contained, which is the escape stated as a pass.
		expect(containedWorkspacePath('../secrets'), 'a leading ..').toBeUndefined();
		expect(containedWorkspacePath('a/../../b'), 'underflow after a pop').toBeUndefined();
		expect(
			containedWorkspacePath('a/b/../../../c'),
			'underflow several levels down'
		).toBeUndefined();
		expect(containedWorkspacePath('/etc/passwd'), 'posix-absolute').toBeUndefined();
		expect(containedWorkspacePath('\\Windows\\System32'), 'backslash-absolute').toBeUndefined();
		expect(containedWorkspacePath('C:/Windows/System32'), 'drive-qualified').toBeUndefined();
		// ⚠ A DRIVE-RELATIVE PATH CARRIES NO SEPARATOR AND WOULD NORMALIZE TO A TIDY RELATIVE STRING. On Windows
		// `c:src` means "src, on drive C, relative to that drive's current directory" — a different volume.
		expect(containedWorkspacePath('c:src'), 'drive-relative').toBeUndefined();
		expect(containedWorkspacePath(''), 'the empty path names nothing').toBeUndefined();
		expect(containedWorkspacePath('.'), 'the root is a directory, not a file').toBeUndefined();
		expect(
			containedWorkspacePath('a/..'),
			'and so is anything that normalizes back to it'
		).toBeUndefined();
	});

	it('⭑ CONTROL — it ACCEPTS the lawful shapes, and normalizes them to one spelling', () => {
		// ⛔ WITHOUT THIS THE PREDICATE IS SATISFIABLE BY REFUSING EVERYTHING, and a workspace nothing can be
		// written into would pass every assertion above while making the seam useless. THE MUTANT: return
		// `undefined` unconditionally.
		expect(containedWorkspacePath('a/b.txt')).toBe('a/b.txt');
		expect(containedWorkspacePath('./a/b.txt'), 'a leading . is not an escape').toBe('a/b.txt');
		// ⚠ `a/../b.txt` IS INSIDE, and refusing every `..` would reject it. A guard that refuses lawful paths
		// teaches its callers to route around it, which is how a containment check comes to be optional.
		expect(containedWorkspacePath('a/../b.txt')).toBe('b.txt');
		expect(containedWorkspacePath('a\\b.txt'), 'backslashes normalize to one spelling').toBe(
			'a/b.txt'
		);
		expect(containedWorkspacePath('a//b.txt'), 'and so do repeated separators').toBe('a/b.txt');
	});

	it('⚠ the normalized form is what a caller must key on — two spellings of one path agree', () => {
		// Without normalization a workspace would hold `a/b.txt` and `a\b.txt` as two different files, and a
		// step that wrote one and read the other would see an absence it did not create.
		expect(containedWorkspacePath('a\\b.txt')).toBe(containedWorkspacePath('./a/b.txt'));
	});
});
