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
	// Bytes that are NOT the UTF-8 encoding of the source string, so the fatal decoder can be reached. The rest of
	// the row (size, digest, classification) still derives from the source, which is exactly the mismatch a
	// corrupted artifact presents.
	readonly rawBytes?: ReadonlyMap<string, Uint8Array>;
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
		const raw = options.rawBytes?.get(path);
		if (!omitBytes.has(path)) bytes.set(path, raw ?? encoder.encode(source));
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

	/**
	 * ⚠⚠ C9–C14 CLOSE A GAP THAT WAS DERIVED FROM THE CODE, NOT NOTICED IN THE TESTS. Of the ELEVEN finding codes
	 * this module can emit, C1–C8 observed only FIVE. The six below were unreachable by any assertion in the
	 * repository, which means six of this module's refusals could have been deleted outright and every suite would
	 * still have passed. `SPECIFIER_AMBIGUOUS` is the sharpest of them: it is the one refusal the file argues for
	 * in prose — *"Returning the first present candidate would be a PREFERENCE — a bet on which file the runtime
	 * picks... The wager is the class of thing under repair"* — and nothing checked that the bet was still refused.
	 *
	 * ⚠ `omitBytes` in this file's own harness was authored, threaded, and consumed by NO test until C13. An
	 * option built to make a failure reachable, and then not reached, is the same shape of gap one layer down.
	 */

	// C9 — THE REFUSAL THE FILE ARGUES FOR. Candidate generation is WIDE and selection is STRICT: two present
	// candidates must REFUSE, never pick. Pins the candidate ORDER too, so a narrowing of generation is also caught.
	it('refuses to bet when a specifier resolves to more than one present candidate', () => {
		const result = closure(
			new Map([
				[
					ANALYZER,
					`import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`
				],
				[DEP, `export const thing = 1;\n`],
				['verif/synthetic-dep.js', `export const thing = 1;\n`]
			])
		);
		expect(result.findings).toEqual([
			{
				code: 'SPECIFIER_AMBIGUOUS',
				importerPath: ANALYZER,
				path: ANALYZER,
				resolvedCandidate: `${DEP} | verif/synthetic-dep.js`,
				specifier: './synthetic-dep.js'
			}
		]);
		expect(result.paths).toEqual([]);
	});

	// C10 — AN UNDECIDABLE EDGE IS A REFUSAL, NOT AN ABSENCE. A dynamic import of a variable cannot be resolved
	// from bytes; treating it as "no edge" is precisely how a capsule ships without a module the analyzer loads.
	it('refuses a dynamic import whose specifier is not a literal rather than ignoring it', () => {
		const result = closure(
			new Map([
				[ANALYZER, `const spec = './synthetic-dep.js';\nexport const use = () => import(spec);\n`],
				[DEP, `export const thing = 1;\n`]
			])
		);
		expect(result.findings).toEqual([
			{
				code: 'SPECIFIER_NOT_LITERAL',
				importerPath: ANALYZER,
				path: ANALYZER,
				resolvedCandidate: null,
				specifier: null
			}
		]);
		expect(result.paths).toEqual([]);
	});

	// C11 — A FILE THE PARSER REJECTS HAS NO KNOWABLE IMPORT GRAPH, so an empty specifier list from it is a
	// silent lie. This is the one case where "we found no imports" and "we could not look" are indistinguishable.
	it('refuses a source the parser rejects instead of reading no imports from it', () => {
		const result = closure(
			new Map([
				[ANALYZER, `import { thing } from './synthetic-dep.js';\nexport const broken = (;\n`],
				[DEP, `export const thing = 1;\n`]
			])
		);
		expect(result.findings.map((entry) => entry.code)).toEqual(['SOURCE_SYNTAX_INVALID']);
		expect(result.findings[0]?.path).toBe(ANALYZER);
		expect(result.paths).toEqual([]);
	});

	// C12 — THE DECODER IS FATAL ON PURPOSE. A lossy decode would substitute U+FFFD and hand the parser a file
	// that is not the one on disk, so the closure would describe bytes nobody has.
	it('refuses bytes that are not valid UTF-8 rather than decoding them lossily', () => {
		const result = closure(
			new Map([
				[
					ANALYZER,
					`import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`
				],
				[DEP, `export const thing = 1;\n`]
			]),
			{ rawBytes: new Map([[DEP, Uint8Array.from([0x21, 0xff, 0xfe, 0x0a])]]) }
		);
		expect(result.findings.map((entry) => entry.code)).toEqual(['SOURCE_UNDECODABLE']);
		expect(result.findings[0]?.path).toBe(DEP);
		expect(result.paths).toEqual([]);
	});

	// C13 — A ROW WITHOUT BYTES IS NOT AN EMPTY FILE. The manifest can list an artifact the byte store cannot
	// produce; reading that as "no imports" is the silent-empty-closure defect this module exists to remove.
	it('refuses a manifest row whose frozen bytes are unavailable', () => {
		const result = closure(
			new Map([
				[
					ANALYZER,
					`import { thing } from './synthetic-dep.js';\nexport const use = () => thing;\n`
				],
				[DEP, `export const thing = 1;\n`]
			]),
			{ omitBytes: [DEP] }
		);
		expect(result.findings.map((entry) => entry.code)).toEqual(['BYTES_UNAVAILABLE']);
		expect(result.findings[0]?.path).toBe(DEP);
		expect(result.paths).toEqual([]);
	});

	// C14 — THE REQUEST ITSELF IS CHECKED, and all three arms matter: a caller that asks for nothing, a budget
	// that permits nothing, and a duplicate entry that would make the walk's "enters at most once" claim false.
	it('refuses an entry population that is empty, unbudgeted, or duplicated', () => {
		const subject = frozenSubject(new Map([[ANALYZER, `export const use = 1;\n`]]));
		const request = { entryPaths: [ANALYZER], maxClosureNodes: 32, subject };
		expect(
			resolveFrozenModuleClosure({ ...request, entryPaths: [] }).findings.map((e) => e.code)
		).toEqual(['ENTRY_INVALID']);
		expect(
			resolveFrozenModuleClosure({ ...request, maxClosureNodes: 0 }).findings.map((e) => e.code)
		).toEqual(['ENTRY_INVALID']);
		expect(
			resolveFrozenModuleClosure({ ...request, entryPaths: [ANALYZER, ANALYZER] }).findings.map(
				(e) => e.code
			)
		).toEqual(['ENTRY_INVALID']);
		// The CONTROL for this control: the same request WITHOUT any of those three faults must succeed, or the
		// three reds above would prove only that the helper is broken.
		expect(resolveFrozenModuleClosure(request).findings).toEqual([]);
	});
});
