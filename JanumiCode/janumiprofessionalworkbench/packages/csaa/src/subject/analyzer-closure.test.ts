import { describe, expect, it } from 'vitest';

import type { CapturedArtifactRecord, FrozenSubject } from '../contracts/subject.js';
import { sha256 } from '../inventory/canonical.js';

import { resolveFrozenModuleClosure } from './analyzer-closure.js';
import { classifyArtifact } from './artifacts.js';
import { attachFrozenSubjectBytes } from './frozen-store.js';
import { canonicalPathKey } from './paths.js';

/**
 * ⚠⚠ EVERY FIXTURE PATH HERE IS SYNTHETIC AND DELIBERATELY NOT NAMED AFTER THE FILE THIS MODULE WAS WRITTEN FOR.
 * The defect under repair was a hand-enumerated allowlist. A control that names the real file would be PASSED by
 * a fix that simply adds one more literal to that list — which is the same defect one level up. These tests are
 * the discrimination between DERIVING a population and ENUMERATING one, so they must fail such a fix.
 */

const ANALYZER = 'verif/synthetic-analyzer.ts';
const DEP = 'verif/synthetic-dep.ts';
const DEEP = 'verif/synthetic-dep-2.ts';

const encoder = new TextEncoder();

function artifact(path: string, source: string): CapturedArtifactRecord {
	const bytes = encoder.encode(source);
	const classification = classifyArtifact(path, source);
	return {
		bytes: bytes.byteLength,
		canonicalPathKey: canonicalPathKey(path),
		disposition: classification.disposition,
		path,
		primaryClass: classification.primaryClass,
		reason: classification.reason,
		roles: classification.roles,
		sha256: sha256(bytes)
	};
}

interface SubjectOptions {
	readonly excluded?: readonly string[];
	readonly omitBytes?: readonly string[];
}

function frozenSubject(
	sources: ReadonlyMap<string, string>,
	options: SubjectOptions = {}
): FrozenSubject {
	const excluded = new Set(options.excluded ?? []);
	const omitBytes = new Set(options.omitBytes ?? []);
	const rows: CapturedArtifactRecord[] = [];
	const bytes = new Map<string, Uint8Array>();
	const excludedArtifacts: { readonly path: string }[] = [];
	for (const [path, source] of sources) {
		if (excluded.has(path)) {
			excludedArtifacts.push({ path });
			continue;
		}
		rows.push(artifact(path, source));
		if (!omitBytes.has(path)) bytes.set(path, encoder.encode(source));
	}
	rows.sort((left, right) => left.path.localeCompare(right.path));
	const subject = {
		artifacts: rows,
		descriptor: { subjectId: 'synthetic-closure-subject' },
		diagnostics: [],
		excludedArtifacts,
		generatedContexts: [],
		population: {
			analyzed: rows.length,
			discovered: rows.length + excludedArtifacts.length,
			excluded: excludedArtifacts.length,
			failed: 0,
			included: rows.length,
			inventoryOnly: 0,
			reconciles: true
		},
		projects: [],
		request: {},
		workspaces: []
	} as unknown as FrozenSubject;
	attachFrozenSubjectBytes(subject, bytes);
	return subject;
}

function closure(sources: ReadonlyMap<string, string>, options: SubjectOptions = {}) {
	return resolveFrozenModuleClosure({
		entryPaths: [ANALYZER],
		maxClosureNodes: 32,
		subject: frozenSubject(sources, options)
	});
}

describe('resolveFrozenModuleClosure', () => {
	// C1 — THE DISCRIMINATING CONTROL. A fix that adds a fourth literal to the allowlist passes any test naming
	// the real dependency and FAILS this one, because nothing here is named in any list.
	it('derives a dependency the allowlist never named', () => {
		const result = closure(
			new Map([
				[
					ANALYZER,
					`import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`
				],
				[DEP, `export const thing = 1;\n`]
			])
		);
		expect(result.findings).toEqual([]);
		expect(result.dependencies).toEqual([DEP]);
		expect(result.paths).toEqual([ANALYZER, DEP]);
	});

	// C2 — THE FIXPOINT, not a depth-1 walk. The live counterexample for this in the repository runs through an
	// `import type` edge, so this fixture uses one: a walk that models elision loses the second hop.
	it('reaches the second hop, through a type-only edge', () => {
		const result = closure(
			new Map([
				[
					ANALYZER,
					`import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`
				],
				[DEP, `import type { Deep } from './synthetic-dep-2.js';\nexport const thing: Deep = 1;\n`],
				[DEEP, `export type Deep = number;\n`]
			])
		);
		expect(result.findings).toEqual([]);
		// Canonically sorted, not discovery-ordered: `-` precedes `.`, so the second hop sorts first. The order is
		// pinned deliberately — `derivePopulation` runs several times per observation and the artifact set asserts
		// that a rebuild equals the first build, so an unstable ordering would break reproduction.
		expect(result.dependencies).toEqual([DEEP, DEP]);
	});

	// C3 — THE FAIL-CLOSED LAW: paths is empty IFF findings is non-empty. Today's defect is that the equivalent
	// condition is SILENT; a partial closure is exactly what the capsule cannot survive.
	it('refuses loudly, and wholly, when a specifier resolves to nothing in the subject', () => {
		const result = closure(
			new Map([
				[ANALYZER, `import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`]
			])
		);
		expect(result.paths).toEqual([]);
		expect(result.dependencies).toEqual([]);
		expect(result.findings).toEqual([
			{
				code: 'SPECIFIER_UNRESOLVED',
				importerPath: ANALYZER,
				path: ANALYZER,
				resolvedCandidate: DEP,
				specifier: './synthetic-dep.js'
			}
		]);
	});

	it('separates an excluded artifact from an absent one', () => {
		const result = closure(
			new Map([
				[
					ANALYZER,
					`import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`
				],
				[DEP, `export const thing = 1;\n`]
			]),
			{ excluded: [DEP] }
		);
		expect(result.findings.map((entry) => entry.code)).toEqual(['SPECIFIER_EXCLUDED_FROM_SUBJECT']);
	});

	it('collects bare specifiers without traversing them', () => {
		const result = closure(
			new Map([
				[
					ANALYZER,
					`import { readFileSync } from 'node:fs';\nimport ts from 'typescript';\nexport const use = () => [readFileSync, ts];\n`
				]
			])
		);
		expect(result.findings).toEqual([]);
		expect(result.bareSpecifiers).toEqual(['node:fs', 'typescript']);
		expect(result.dependencies).toEqual([]);
	});

	it('refuses a specifier that escapes the subject rather than resolving it', () => {
		const result = closure(
			new Map([[ANALYZER, `import { x } from '../../outside.js';\nexport const use = () => x;\n`]])
		);
		expect(result.findings.map((entry) => entry.code)).toEqual(['SPECIFIER_ESCAPES_SUBJECT']);
		expect(result.paths).toEqual([]);
	});

	it('fails closed when an entry is not in the subject at all', () => {
		const result = resolveFrozenModuleClosure({
			entryPaths: ['verif/absent-entry.ts'],
			maxClosureNodes: 32,
			subject: frozenSubject(new Map([[ANALYZER, 'export const nothing = 0;\n']]))
		});
		expect(result.findings.map((entry) => entry.code)).toEqual(['ENTRY_NOT_IN_SUBJECT']);
	});

	it('bounds the walk and says so rather than truncating in silence', () => {
		const result = resolveFrozenModuleClosure({
			entryPaths: [ANALYZER],
			maxClosureNodes: 1,
			subject: frozenSubject(
				new Map([
					[
						ANALYZER,
						`import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`
					],
					[DEP, `export const thing = 1;\n`]
				])
			)
		});
		expect(result.findings.map((entry) => entry.code)).toEqual(['CLOSURE_BUDGET_EXHAUSTED']);
		expect(result.paths).toEqual([]);
	});
});
