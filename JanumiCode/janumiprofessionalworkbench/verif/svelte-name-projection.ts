// THE SVELTE `name=` PROJECTION CONSUMER — increment 1 of JAN-CSAADEC / `CD-02`.
//
// ⛔⛔ THE ONE FACT THIS MODULE EXISTS TO STOP A CONSUMER GETTING WRONG, AND IT IS COUNTER-INTUITIVE.
//
// `packages/csaa`'s `transformSvelteVirtualSource` projects markup into real TypeScript. In that projection a
// STATIC attribute — `<input name="version" />` — becomes
//
//     svelteHTML.createElement("input", {  "name":`version`, });
//                                                 ^^^^^^^^^ a NoSubstitutionTemplateLiteral
//
// **NOT a StringLiteral.** `ts.SyntaxKind` even prints that kind under its alias `FirstTemplateToken`, so the
// obvious reading of a debug dump reinforces the mistake. A consumer written with `ts.isStringLiteral` therefore
// matches NOTHING at any static emitter site, finds ZERO keys, and — because "no emitter is missing a reader" is
// vacuously true of an empty set — reports a CLEAN ALL-CLEAR. That is a control that cannot fail, built by
// accident, and it is the exact shape `feedback_a_control_that_cannot_fail` records shipping three times.
//
// So the kind is PINNED by a fixture (`svelte-name-projection.test.ts`) rather than assumed, and the refuted
// predicate is DRIVEN in this module's own vocabulary (`STRING_LITERAL_REFUTED_POLICY`) rather than described in
// a comment, because a comment cannot redden.
//
// ── ⚠ THE SECOND FACT, WHICH IS A PRECONDITION THE OBVIOUS MUTANT SILENTLY DEPENDS ON ────────────────────────
//
// "Zero StringLiterals" is a property of a walk SCOPED TO MARKUP HOSTS, not of the projection. The same projected
// file also carries `name:` PropertyAssignments from ordinary script-block object literals, and several of those
// genuinely ARE `StringLiteral`. An UNSCOPED walk using `ts.isStringLiteral` therefore does NOT yield zero — and a
// census reporting a handful of keys, one of them the empty string, does not read as an all-clear to anyone. The
// mutant would then be recorded as passing for the wrong reason. Hence `markupHost` below, and hence the second
// driven policy `UNSCOPED_REFUTED_POLICY`.
//
// ── WHAT THIS MODULE IS NOT ──────────────────────────────────────────────────────────────────────────────────
//
// It is NOT wired into `verif/form-key-emitter-census.test.ts`. That swap is `CD-03` and it carries its own
// cross-validation and its own fast-path tiering. This module ships alone so it can be judged alone.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
	SVELTE2TSX_PROVIDER_VERSION,
	SVELTE_PROVIDER_VERSION,
	SVELTE_TYPESCRIPT_PROVIDER_VERSION,
	SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS,
	transformSvelteVirtualSource
} from '../packages/csaa/src/providers/svelte/svelte-virtual-source.js';

/**
 * The provider versions the projection contract is pinned to.
 *
 * ⭑ RE-EXPORTED RATHER THAN RESTATED. `assertProviderVersions` inside the bridge refuses with a NAMED
 * `VERSION_MISMATCH` when svelte, svelte2tsx or typescript drift off these — which is the strongest argument for
 * IMPORTING the bridge instead of hand-rolling an equivalent: a version drift becomes a named refusal rather than
 * a silently different projection that still produces a plausible number.
 */
export const PINNED_PROVIDER_VERSIONS = Object.freeze({
	svelte: SVELTE_PROVIDER_VERSION,
	svelte2tsx: SVELTE2TSX_PROVIDER_VERSION,
	typescript: SVELTE_TYPESCRIPT_PROVIDER_VERSION
});

export const APP_SOURCE_ROOT = 'apps/rph-demo/src';

/** `.svelte-kit` holds a GENERATED `root.svelte`; measuring it would census the framework, not the product. */
const SKIP = new Set(['node_modules', 'dist', '.svelte-kit', 'e2e-results', 'build']);

/** Every authored `.svelte` file under the app, repo-relative and forward-slashed (the bridge demands canonical). */
export function svelteFiles(root: string = APP_SOURCE_ROOT): string[] {
	const out: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (SKIP.has(entry.name)) continue;
			const p = join(dir, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (entry.name.endsWith('.svelte')) out.push(p.replaceAll('\\', '/'));
		}
	};
	walk(root);
	return out.sort((a, b) => Number(a > b) - Number(a < b));
}

export interface ProjectedSvelte {
	readonly parseDiagnosticCount: number;
	readonly path: string;
	readonly sourceFile: ts.SourceFile;
	readonly virtualSourceText: string;
}

/**
 * Project one `.svelte` file to a parsed TypeScript `SourceFile`.
 *
 * ⚠ `setParentNodes` is TRUE and that is load-bearing, not a default: `markupHost` walks PARENTS to decide
 * whether a `name:` site is markup at all, and without parent links every site would classify as `NOT_MARKUP` and
 * the census would empty — silently, and in the comfortable direction.
 */
export function projectSvelte(path: string, bytes?: Readonly<Uint8Array>): ProjectedSvelte {
	const transform = transformSvelteVirtualSource({
		authoredBytes: bytes ?? readFileSync(path),
		authoredLogicalPath: path,
		limits: SVELTE_VIRTUAL_SOURCE_IMPLEMENTATION_LIMITS
	});
	const sourceFile = ts.createSourceFile(
		transform.evidence.virtual.logicalPath,
		transform.virtualSourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	return {
		parseDiagnosticCount: (sourceFile as unknown as { parseDiagnostics: readonly unknown[] })
			.parseDiagnostics.length,
		path,
		sourceFile,
		virtualSourceText: transform.virtualSourceText
	};
}

/** Where a `name` property sits in the projection. `NOT_MARKUP` is a script-block object literal, not a control. */
export type NameHost = 'COMPONENT_PROPS' | 'ELEMENT' | 'NOT_MARKUP';

/**
 * Classify the host of an object-literal member.
 *
 * `ELEMENT`         — argument 1 of `svelteHTML.createElement("tag", { … })`, which is how every DOM element's
 *                     attributes are projected.
 * `COMPONENT_PROPS` — the `props:` object of `new $$_X0C({ target: …, props: { … } })`, which is how a Svelte
 *                     component's props are projected. ⚠ MEASURED ZERO OCCURRENCES TREE-WIDE. It is recognised
 *                     here PROSPECTIVELY and is reddenable only by a fixture; it is NOT counted as live coverage,
 *                     and the design claim that this form "would have been LOST" overclaims on today's tree.
 */
export function markupHost(member: ts.Node): NameHost {
	const object = member.parent;
	if (object === undefined || !ts.isObjectLiteralExpression(object)) return 'NOT_MARKUP';
	const owner = object.parent;
	if (
		owner !== undefined &&
		ts.isCallExpression(owner) &&
		ts.isPropertyAccessExpression(owner.expression) &&
		owner.expression.name.text === 'createElement' &&
		ts.isIdentifier(owner.expression.expression) &&
		owner.expression.expression.text === 'svelteHTML' &&
		owner.arguments[1] === object
	)
		return 'ELEMENT';
	if (
		owner !== undefined &&
		ts.isPropertyAssignment(owner) &&
		!ts.isComputedPropertyName(owner.name) &&
		owner.name.text === 'props' &&
		owner.parent !== undefined &&
		ts.isObjectLiteralExpression(owner.parent) &&
		owner.parent.parent !== undefined &&
		ts.isNewExpression(owner.parent.parent) &&
		owner.parent.parent.arguments?.[0] === owner.parent
	)
		return 'COMPONENT_PROPS';
	return 'NOT_MARKUP';
}

/** Is this object-literal member the `name` attribute/prop? The projection writes the KEY as `"name"`. */
function isNameMember(member: ts.ObjectLiteralElementLike): boolean {
	if (ts.isShorthandPropertyAssignment(member)) return member.name.text === 'name';
	if (!ts.isPropertyAssignment(member)) return false;
	const key = member.name;
	if (ts.isComputedPropertyName(key)) return false;
	return key.text === 'name';
}

/**
 * How a policy reads a `name` initializer. Two families ship: the CORRECT one, and the REFUTED ones whose only
 * job is to be driven to a measured number, so that "a consumer written this way finds nothing" is a fact this
 * suite establishes rather than a warning it prints.
 */
export interface NamePolicy {
	/** Recognise a fully-static name and return its text, or `null` when this initializer is not static. */
	readonly staticName: (initializer: ts.Expression) => string | null;
	/** Whether the walk is scoped to markup hosts. FALSE is a refuted arrangement, kept driveable. */
	readonly scopedToMarkup: boolean;
}

/**
 * ⭑ THE PRODUCTION POLICY. `isNoSubstitutionTemplateLiteral`, because that is what a static `name="x"` becomes.
 * Rewriting this predicate to `ts.isStringLiteral` is `M-1` as a SOURCE mutation, and it must redden the census.
 */
export const PROJECTION_POLICY: NamePolicy = Object.freeze({
	staticName: (initializer: ts.Expression): string | null =>
		ts.isNoSubstitutionTemplateLiteral(initializer) ? initializer.text : null,
	scopedToMarkup: true
});

/**
 * ⛔ `M-1` MADE DRIVEABLE — the predicate a consumer reaches for by reflex. It must yield ZERO static names over
 * the whole application. If this ever yields a non-zero count, the projection's literal kind has changed and
 * `PROJECTION_POLICY` is now measuring something else; read the kind fixture, not this comment.
 */
export const STRING_LITERAL_REFUTED_POLICY: NamePolicy = Object.freeze({
	staticName: (initializer: ts.Expression): string | null =>
		ts.isStringLiteral(initializer) ? initializer.text : null,
	scopedToMarkup: true
});

/**
 * ⛔ `M-1b` MADE DRIVEABLE — the correction that `M-1`'s predicted red silently depends on. Same refuted
 * predicate, UNSCOPED. It does NOT yield zero: it yields the script-block phantoms, which is why the scoping is a
 * stated precondition of `M-1` rather than an implementation detail nobody wrote down.
 */
export const UNSCOPED_REFUTED_POLICY: NamePolicy = Object.freeze({
	staticName: STRING_LITERAL_REFUTED_POLICY.staticName,
	scopedToMarkup: false
});

/** ⛔ `M-1b`'s other half: the CORRECT predicate, unscoped — what the scoping is actually buying, measured. */
export const UNSCOPED_PROJECTION_POLICY: NamePolicy = Object.freeze({
	staticName: PROJECTION_POLICY.staticName,
	scopedToMarkup: false
});

export interface EmittedNames {
	/** `path :: expression` for a dynamic name whose head could be read — the analysable dynamic population. */
	readonly dynamic: string[];
	/** The template HEADS of dynamic names, e.g. `cardinality:`. AST data, not a truncated regex capture. */
	readonly dynamicHeads: string[];
	/** `path :: kind :: text` for an initializer kind this consumer does not recognise. DECLARED, never dropped. */
	readonly other: string[];
	/** Fully-static emitted keys. */
	readonly staticNames: Set<string>;
	/** `path :: form` for `{name}` / `{...rest}` — shapes no AST walk resolves without dataflow. */
	readonly unanalysable: string[];
}

/**
 * Every `name` a projected template emits.
 *
 * ⚠ AN UNRECOGNISED INITIALIZER KIND IS DECLARED, NEVER DROPPED. A census that quietly narrows its own population
 * is the defect one level up, and `arrow-command-census.ts` records shipping exactly that once.
 */
export function emittedNamesFromProjection(
	projected: readonly ProjectedSvelte[],
	policy: NamePolicy = PROJECTION_POLICY
): EmittedNames {
	const staticNames = new Set<string>();
	const dynamic: string[] = [];
	const dynamicHeads: string[] = [];
	const unanalysable: string[] = [];
	const other: string[] = [];
	for (const { path, sourceFile } of projected) {
		/** One `name:` PropertyAssignment, classified. The three outcomes are exhaustive by construction. */
		const readInitializer = (initializer: ts.Expression): void => {
			const literal = policy.staticName(initializer);
			if (literal !== null) {
				staticNames.add(literal);
				return;
			}
			if (ts.isTemplateExpression(initializer)) {
				dynamic.push(`${path} :: ${initializer.getText(sourceFile)}`);
				dynamicHeads.push(initializer.head.text);
				return;
			}
			other.push(`${path} :: ${ts.SyntaxKind[initializer.kind]} :: ${initializer.getText(sourceFile)}`);
		};
		/** One object-literal member. `inMarkup` is the object's host, hoisted so a spread can consult it. */
		const readMember = (member: ts.ObjectLiteralElementLike, inMarkup: boolean): void => {
			if (ts.isSpreadAssignment(member)) {
				if (policy.scopedToMarkup && !inMarkup) return;
				unanalysable.push(`${path} :: {...${member.expression.getText(sourceFile)}}`);
				return;
			}
			if (!isNameMember(member)) return;
			if (policy.scopedToMarkup && markupHost(member) === 'NOT_MARKUP') return;
			if (ts.isShorthandPropertyAssignment(member)) {
				unanalysable.push(`${path} :: {name}`);
				return;
			}
			if (ts.isPropertyAssignment(member)) readInitializer(member.initializer);
		};
		const visit = (node: ts.Node): void => {
			if (ts.isObjectLiteralExpression(node)) {
				const inMarkup = node.properties.some((p) => markupHost(p) !== 'NOT_MARKUP');
				for (const member of node.properties) readMember(member, inMarkup);
			}
			ts.forEachChild(node, visit);
		};
		visit(sourceFile);
	}
	const sort = (a: string, b: string): number => Number(a > b) - Number(a < b);
	return {
		dynamic: [...dynamic].sort(sort),
		dynamicHeads: [...new Set(dynamicHeads)].sort(sort),
		other: [...other].sort(sort),
		staticNames,
		unanalysable: [...unanalysable].sort(sort)
	};
}

/** Classify every `name` site by host — the measurement `M-1b` exists to keep honest. */
export function nameHostCensus(projected: readonly ProjectedSvelte[]): Record<NameHost, number> {
	const counts: Record<NameHost, number> = { COMPONENT_PROPS: 0, ELEMENT: 0, NOT_MARKUP: 0 };
	for (const { sourceFile } of projected) {
		const visit = (node: ts.Node): void => {
			if (
				(ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
				isNameMember(node)
			)
				counts[markupHost(node)] += 1;
			ts.forEachChild(node, visit);
		};
		visit(sourceFile);
	}
	return counts;
}
