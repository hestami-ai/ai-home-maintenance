import { posix } from 'node:path';

import ts from 'typescript';

import type { FrozenSubject } from '../contracts/subject.js';

import { hasFrozenSubjectArtifact, readFrozenSubjectArtifact } from './frozen-store.js';
import { assertCanonicalRelativePath } from './paths.js';

/**
 * Derives the transitive relative-import closure of a retained analyzer from FROZEN BYTES ALONE.
 *
 * ⚠ WHY THIS EXISTS. Capsule membership used to be a hand-enumerated ladder of literal path equality, and an
 * artifact earning no match was dropped SILENTLY. When a retained analyzer gained a correctly-motivated relative
 * import, the imported file was never materialized, the capsule's dynamic `import()` could not resolve it, and the
 * failure surfaced as a constant-valued digest naming nothing. The list did not rot — nothing ever derived the
 * population it was standing in for.
 *
 * ⚠⚠ PATH COMPARISON HERE IS EXACT-STRING AND MUST STAY THAT WAY. Do not route through `canonicalPathKey`
 * (`subject/paths.ts:34-43`): it consults `ts.sys.useCaseSensitiveFileNames` when no platform is given, and closure
 * membership flows into the artifact set's content digest and therefore its identity. Routing through it would make
 * a content-addressed identity PLATFORM-DEPENDENT. Exact-case is safe because `canonicalPathKey` is paired with
 * `assertNoCanonicalPathCollisions` (`subject/paths.ts:92-106`), so a subject that survived freezing has no
 * case-colliding paths.
 */

export type FrozenModuleClosureFindingCode =
	| 'BYTES_UNAVAILABLE'
	| 'CLOSURE_BUDGET_EXHAUSTED'
	| 'ENTRY_INVALID'
	| 'ENTRY_NOT_IN_SUBJECT'
	| 'SOURCE_SYNTAX_INVALID'
	| 'SOURCE_UNDECODABLE'
	| 'SPECIFIER_AMBIGUOUS'
	| 'SPECIFIER_ESCAPES_SUBJECT'
	| 'SPECIFIER_EXCLUDED_FROM_SUBJECT'
	| 'SPECIFIER_NOT_LITERAL'
	| 'SPECIFIER_UNRESOLVED';

export interface FrozenModuleClosureFinding {
	readonly code: FrozenModuleClosureFindingCode;
	readonly importerPath: string | null;
	readonly path: string | null;
	readonly resolvedCandidate: string | null;
	readonly specifier: string | null;
}

export interface FrozenModuleClosure {
	readonly bareSpecifiers: readonly string[];
	readonly dependencies: readonly string[];
	readonly findings: readonly FrozenModuleClosureFinding[];
	readonly paths: readonly string[];
}

export interface FrozenModuleClosureRequest {
	readonly entryPaths: readonly string[];
	readonly maxClosureNodes: number;
	readonly subject: FrozenSubject;
}

const TYPESCRIPT_SOURCE = /\.(?:ts|tsx|mts|cts)$/u;

function compareText(left: string, right: string): number {
	if (left < right) return -1;
	return left > right ? 1 : 0;
}

function finding(
	code: FrozenModuleClosureFindingCode,
	importerPath: string | null,
	specifier: string | null,
	resolvedCandidate: string | null,
	path: string | null
): FrozenModuleClosureFinding {
	return { code, importerPath, path, resolvedCandidate, specifier };
}

function compareFindings(
	left: FrozenModuleClosureFinding,
	right: FrozenModuleClosureFinding
): number {
	return (
		compareText(left.code, right.code) ||
		compareText(left.importerPath ?? '', right.importerPath ?? '') ||
		compareText(left.specifier ?? '', right.specifier ?? '') ||
		compareText(left.path ?? '', right.path ?? '')
	);
}

function failed(findings: readonly FrozenModuleClosureFinding[]): FrozenModuleClosure {
	// The fail-closed law: there is no partial closure, because a partial closure is precisely what the capsule
	// cannot survive. `paths` empty IFF `findings` non-empty.
	return {
		bareSpecifiers: [],
		dependencies: [],
		findings: [...findings].sort(compareFindings),
		paths: []
	};
}

interface SpecifierOccurrence {
	readonly literal: boolean;
	readonly specifier: string | null;
}

function specifierOf(node: ts.Node): SpecifierOccurrence | null {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
		const expression = node.moduleSpecifier;
		if (expression === undefined) return null;
		return ts.isStringLiteral(expression)
			? { literal: true, specifier: expression.text }
			: { literal: false, specifier: null };
	}
	if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
		const expression = node.moduleReference.expression;
		return ts.isStringLiteral(expression)
			? { literal: true, specifier: expression.text }
			: { literal: false, specifier: null };
	}
	if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
		const argument = node.arguments[0];
		if (argument === undefined) return null;
		return ts.isStringLiteral(argument)
			? { literal: true, specifier: argument.text }
			: { literal: false, specifier: null };
	}
	return null;
}

/**
 * ⚠ Type-only edges are traversed like any other. We deliberately do NOT model elision: the live counterexample
 * for the fixpoint runs THROUGH an `import type` edge, so treating those as absent is exactly how a depth-2
 * requirement disappears from view. The closure is a statement about the SOURCE GRAPH, which is decidable, not
 * about what a runtime will elide, which is a guess about a toolchain we do not control.
 */
function collectModuleSpecifiers(source: ts.SourceFile): readonly SpecifierOccurrence[] {
	const found: SpecifierOccurrence[] = [];
	const visit = (node: ts.Node): void => {
		const occurrence = specifierOf(node);
		if (occurrence !== null) found.push(occurrence);
		ts.forEachChild(node, visit);
	};
	ts.forEachChild(source, visit);
	return found;
}

/**
 * Candidate generation is WIDE, selection is STRICT. Returning the first present candidate would be a
 * PREFERENCE — a bet on which file the runtime picks. Requiring exactly one present candidate is a REFUSAL.
 * The wager is the class of thing under repair, so this refuses.
 */
function candidatesFor(joined: string): readonly string[] {
	if (joined.endsWith('.js')) {
		const stem = joined.slice(0, -3);
		return [`${stem}.ts`, `${stem}.tsx`, joined];
	}
	if (joined.endsWith('.mjs')) return [`${joined.slice(0, -4)}.mts`, joined];
	if (joined.endsWith('.cjs')) return [`${joined.slice(0, -4)}.cts`, joined];
	if (/\.(?:ts|tsx|json)$/u.test(joined)) return [joined];
	return [`${joined}.ts`, `${joined}.tsx`, `${joined}/index.ts`, joined];
}

type Selection =
	| { readonly kind: 'ABSENT'; readonly firstCandidate: string }
	| { readonly kind: 'AMBIGUOUS'; readonly present: readonly string[] }
	| { readonly kind: 'ESCAPE' }
	| { readonly kind: 'RESOLVED'; readonly path: string };

function resolveRelative(
	rows: ReadonlySet<string>,
	importer: string,
	specifier: string
): Selection {
	const joined = posix.normalize(posix.join(posix.dirname(importer), specifier));
	if (joined === '..' || joined.startsWith('../') || joined.startsWith('/'))
		return { kind: 'ESCAPE' };
	const canonical: string[] = [];
	for (const candidate of candidatesFor(joined)) {
		try {
			canonical.push(assertCanonicalRelativePath(candidate));
		} catch {
			// A candidate that is not a canonical repository-relative path cannot be a subject artifact.
		}
	}
	if (canonical.length === 0) return { kind: 'ESCAPE' };
	const present = canonical.filter((candidate) => rows.has(candidate));
	if (present.length > 1) return { kind: 'AMBIGUOUS', present };
	const only = present[0];
	if (only === undefined) return { kind: 'ABSENT', firstCandidate: canonical[0]! };
	return { kind: 'RESOLVED', path: only };
}

type ParsedSource =
	| { readonly finding: FrozenModuleClosureFinding; readonly kind: 'FAILED' }
	| { readonly kind: 'PARSED'; readonly source: ts.SourceFile };

function parseFrozenSource(subject: FrozenSubject, path: string): ParsedSource {
	const missing: ParsedSource = {
		finding: finding('BYTES_UNAVAILABLE', null, null, null, path),
		kind: 'FAILED'
	};
	// `hasFrozenSubjectArtifact` is a presence PROBE: `readFrozenSubjectArtifact` returns a defensive `.slice()`,
	// so probing through it would copy a whole file merely to ask whether it is there.
	if (!hasFrozenSubjectArtifact(subject, path)) return missing;
	const bytes = readFrozenSubjectArtifact(subject, path);
	if (bytes === undefined) return missing;
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return { finding: finding('SOURCE_UNDECODABLE', null, null, null, path), kind: 'FAILED' };
	}
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
	const parseDiagnostics = (source as unknown as { readonly parseDiagnostics?: readonly unknown[] })
		.parseDiagnostics;
	if (parseDiagnostics !== undefined && parseDiagnostics.length > 0)
		return { finding: finding('SOURCE_SYNTAX_INVALID', null, null, null, path), kind: 'FAILED' };
	return { kind: 'PARSED', source };
}

type Edge =
	| { readonly kind: 'BARE'; readonly specifier: string }
	| { readonly finding: FrozenModuleClosureFinding; readonly kind: 'FINDING' }
	| { readonly kind: 'TARGET'; readonly path: string; readonly specifier: string };

function classifyEdge(
	rows: ReadonlySet<string>,
	excluded: ReadonlySet<string>,
	importer: string,
	occurrence: SpecifierOccurrence
): Edge {
	const fault = (
		code: FrozenModuleClosureFindingCode,
		specifier: string | null,
		candidate: string | null
	): Edge => ({
		finding: finding(code, importer, specifier, candidate, importer),
		kind: 'FINDING'
	});
	if (!occurrence.literal || occurrence.specifier === null)
		return fault('SPECIFIER_NOT_LITERAL', null, null);
	const specifier = occurrence.specifier;
	if (!specifier.startsWith('.')) return { kind: 'BARE', specifier };
	const selection = resolveRelative(rows, importer, specifier);
	if (selection.kind === 'ESCAPE') return fault('SPECIFIER_ESCAPES_SUBJECT', specifier, null);
	if (selection.kind === 'AMBIGUOUS')
		return fault('SPECIFIER_AMBIGUOUS', specifier, selection.present.join(' | '));
	if (selection.kind === 'ABSENT')
		return fault(
			excluded.has(selection.firstCandidate)
				? 'SPECIFIER_EXCLUDED_FROM_SUBJECT'
				: 'SPECIFIER_UNRESOLVED',
			specifier,
			selection.firstCandidate
		);
	return { kind: 'TARGET', path: selection.path, specifier };
}

function validateEntries(
	request: FrozenModuleClosureRequest,
	rows: ReadonlySet<string>
): readonly FrozenModuleClosureFinding[] {
	const findings: FrozenModuleClosureFinding[] = [];
	if (request.entryPaths.length === 0)
		findings.push(finding('ENTRY_INVALID', null, null, null, null));
	if (!Number.isSafeInteger(request.maxClosureNodes) || request.maxClosureNodes <= 0)
		findings.push(finding('ENTRY_INVALID', null, null, null, null));
	const seen = new Set<string>();
	for (const entry of request.entryPaths) {
		let canonical: string;
		try {
			canonical = assertCanonicalRelativePath(entry);
		} catch {
			findings.push(finding('ENTRY_INVALID', null, null, null, entry));
			continue;
		}
		if (seen.has(canonical)) findings.push(finding('ENTRY_INVALID', null, null, null, canonical));
		seen.add(canonical);
		if (!rows.has(canonical))
			findings.push(finding('ENTRY_NOT_IN_SUBJECT', null, null, null, canonical));
	}
	return findings;
}

interface ClosureAccumulator {
	readonly bare: Set<string>;
	readonly findings: FrozenModuleClosureFinding[];
	readonly frontier: string[];
	readonly paths: Set<string>;
}

/**
 * Expands ONE already-parsed module into the accumulator, and decides one thing: whether the node budget was
 * exhausted. Exhaustion is terminal — the caller stops the whole traversal on `true` — because a budget refusal
 * must never degrade into a partial closure that keeps walking.
 */
function expandModuleEdges(
	request: FrozenModuleClosureRequest,
	rows: ReadonlySet<string>,
	excluded: ReadonlySet<string>,
	accumulator: ClosureAccumulator,
	current: string,
	source: ts.SourceFile
): boolean {
	for (const occurrence of collectModuleSpecifiers(source)) {
		const edge = classifyEdge(rows, excluded, current, occurrence);
		if (edge.kind === 'BARE') {
			// The package boundary. Bare specifiers are COLLECTED, never traversed.
			accumulator.bare.add(edge.specifier);
			continue;
		}
		if (edge.kind === 'FINDING') {
			accumulator.findings.push(edge.finding);
			continue;
		}
		if (accumulator.paths.has(edge.path)) continue;
		if (accumulator.paths.size >= request.maxClosureNodes) {
			accumulator.findings.push(
				finding('CLOSURE_BUDGET_EXHAUSTED', current, edge.specifier, edge.path, current)
			);
			return true;
		}
		accumulator.paths.add(edge.path);
		accumulator.frontier.push(edge.path);
	}
	return false;
}

export function resolveFrozenModuleClosure(
	request: FrozenModuleClosureRequest
): FrozenModuleClosure {
	const rows = new Set(request.subject.artifacts.map((artifact) => artifact.path));
	const excluded = new Set(request.subject.excludedArtifacts.map((artifact) => artifact.path));

	const invalid = validateEntries(request, rows);
	if (invalid.length > 0) return failed(invalid);

	// `paths` IS the visited set, and membership is added at ENQUEUE time. Two structures collapse into one and
	// termination is a one-line proof: a path enters at most once, so total pushes <= maxClosureNodes and each
	// iteration performs exactly one shift. The loop is bounded REGARDLESS of graph shape, cycles included.
	const paths = new Set(request.entryPaths.map((entry) => assertCanonicalRelativePath(entry)));
	const frontier = [...paths].sort(compareText);
	const bare = new Set<string>();
	const findings: FrozenModuleClosureFinding[] = [];
	const accumulator: ClosureAccumulator = { bare, findings, frontier, paths };

	while (frontier.length > 0) {
		const current = frontier.shift()!;
		// A legitimate closure member with no module graph of its own (a `.json` baseline, say). Not an error.
		if (!TYPESCRIPT_SOURCE.test(current)) continue;
		const parsed = parseFrozenSource(request.subject, current);
		if (parsed.kind === 'FAILED') {
			findings.push(parsed.finding);
			continue;
		}
		if (expandModuleEdges(request, rows, excluded, accumulator, current, parsed.source)) break;
	}

	if (findings.length > 0) return failed(findings);

	const entries = new Set(request.entryPaths.map((entry) => assertCanonicalRelativePath(entry)));
	return {
		bareSpecifiers: [...bare].sort(compareText),
		dependencies: [...paths].filter((path) => !entries.has(path)).sort(compareText),
		findings: [],
		paths: [...paths].sort(compareText)
	};
}
