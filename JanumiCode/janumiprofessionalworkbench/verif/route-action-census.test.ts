// THE ROUTE ACTION CENSUS — every mutating surface action is a known one.
//
// ⚠ WHAT THIS DOES NOT DO, STATED FIRST BECAUSE IT IS THE POINT. It does NOT check whether an action declares
// an `expectedRevision`, and it makes no coverage claim about PER-4. A wired-vs-unwired ratchet was designed
// and adversarially refuted (see `docs/_working/ROADMAP-fork22-surface-wiring.md` §5): every static classifier
// proposed either could not see `acceptAgentCandidate` — whose guard is a cross-file call to
// `dispatchBatchGuarded`, with no `dispatch` token in the action body at all — or keyed on argument arity, which
// cannot distinguish a page-derived revision from `dispatch(…, getEngine().loadObject(id)?.revision)`. That
// second one is REG-F-050's exact shape: a classifier greening on it would certify the very defect the
// surrounding machinery exists to catch.
//
// So this instrument does the smaller thing it can do honestly: IT PINS THE POPULATION. A new mutating action
// cannot appear without a human being made to look at it and decide. That is worth having on its own, because
// once a route is CORRECTLY wired its own e2e already reddens on any break in the chain — the one thing no
// existing test can see is an action that was never wired in the first place.
//
// ── WHY AN EXTRACTOR AND NOT A HAND LIST ─────────────────────────────────────────────────────────────────────
// A hand-maintained list is an allowlist, and allowlists rot: a new action added to an EXISTING file moves no
// number. The population here is derived from the filesystem every run, and the snapshot is the comparison
// TARGET — never a filter. `expect(derived).toEqual(SNAPSHOT)` fails when the tree gains an action;
// `derived.filter(x => !KNOWN.has(x))` would not, and that difference is the whole design.
//
// ── THE UNDERCOUNT THIS PINS, WHICH IS THE REASON THE EXTRACTOR IS TESTED SEPARATELY ─────────────────────────
// The obvious pattern `^\t(\w+): async \(` finds ELEVEN actions in `pwa/[id]` and there are SEVENTEEN. Six are
// non-async one-liners (`submitForReview: ({ params }) => advancePwa(…)`). I hit that undercount while
// enumerating for the roadmap and only caught it because an independent count disagreed. A silent undercount in
// a census is worse than no census, so `extractActionKeys` is exercised against synthetic sources below,
// including that exact shape.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const ROUTES = `${REPO_ROOT}apps/rph-demo/src/routes`;

/** Every `+page.server.ts` / `+server.ts` under the demo's routes, as a route-relative path. */
function routeModules(): string[] {
	const out: string[] = [];
	const walk = (abs: string, rel: string): void => {
		for (const entry of readdirSync(abs)) {
			const childAbs = `${abs}/${entry}`;
			if (statSync(childAbs).isDirectory()) {
				walk(childAbs, rel === '' ? entry : `${rel}/${entry}`);
			} else if (entry === '+page.server.ts' || entry === '+server.ts') {
				out.push(rel === '' ? entry : `${rel}/${entry}`);
			}
		}
	};
	walk(ROUTES, '');
	return out.sort((a, b) => a.localeCompare(b));
}

/** The body of `export const actions: Actions = { … };`, by brace matching. Returns '' when there is none. */
function actionsBlock(source: string): string {
	const marker = 'export const actions: Actions = {';
	const start = source.indexOf(marker);
	if (start === -1) return '';
	let depth = 0;
	for (let i = start + marker.length - 1; i < source.length; i += 1) {
		const ch = source[i];
		if (ch === '{') depth += 1;
		else if (ch === '}') {
			depth -= 1;
			// Brace matching rather than a `\n};` regex: greedy-to-last would swallow anything declared after
			// the actions object, and non-greedy would stop at the first nested close.
			if (depth === 0) return source.slice(start + marker.length, i);
		}
	}
	throw new Error('unbalanced actions object');
}

/**
 * The action names in an `actions` object body.
 *
 * ⚠ IT THROWS ON A SHAPE IT DOES NOT RECOGNISE rather than skipping it. A census that silently drops what it
 * cannot parse reports a smaller population and calls it complete — which is the failure mode this file exists
 * to avoid, so it must not commit it itself. Every top-level key is found first; then each is REQUIRED to be a
 * function form. A key that is neither is a loud failure demanding this extractor be taught the new shape.
 */
export function extractActionKeys(body: string): string[] {
	// One TAB of indentation is exactly the actions object's own key depth; an action BODY is indented two or
	// more, so nested object literals cannot be mistaken for actions.
	const keys = [...body.matchAll(/^\t([A-Za-z]\w*):/gm)].map((m) => m[1] as string);
	for (const key of keys) {
		// `async (` and a bare `(` both, because six real actions are non-async one-liners.
		const isFn = new RegExp(`^\\t${key}: (?:async )?\\(`, 'm').test(body);
		if (!isFn) {
			throw new Error(
				`action "${key}" is not a recognised function form — teach extractActionKeys its shape rather ` +
					`than letting the census undercount silently.`
			);
		}
	}
	return keys;
}

/** Exported HTTP verbs of a `+server.ts` endpoint. */
function extractEndpointVerbs(source: string): string[] {
	return [...source.matchAll(/^export const (GET|POST|PUT|PATCH|DELETE)\b/gm)].map(
		(m) => m[1] as string
	);
}

function census(): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const rel of routeModules()) {
		const source = readFileSync(`${ROUTES}/${rel}`, 'utf8');
		const block = actionsBlock(source);
		const names = block === '' ? extractEndpointVerbs(source) : extractActionKeys(block);
		if (names.length > 0) out[rel] = names;
	}
	return out;
}

/**
 * THE PINNED POPULATION. Regenerating this is a DECISION, not a chore: every added name is a surface act that
 * mutates governed state, and it needs an answer to "does this update an existing aggregate, and if so does it
 * declare the revision the page was rendered from?" (JPWB-DOC-003 §9 PER-4).
 *
 * Wiring status is tracked in `docs/_working/ROADMAP-fork22-surface-wiring.md`, deliberately NOT here — this
 * file would otherwise start making a claim it cannot check.
 */
const PINNED: Readonly<Record<string, readonly string[]>> = {
	'+page.server.ts': ['create', 'delete'],
	'baselines/+page.server.ts': ['create', 'submit', 'approve'],
	'decisions/+page.server.ts': ['propose', 'approve', 'grant', 'deny'],
	'pwa/[id]/+page.server.ts': [
		'acceptAgentCandidate',
		'discardAgentCandidate',
		'editDetails',
		'defineType',
		'editType',
		'removeType',
		'submitForReview',
		'validate',
		'publish',
		'deprecate',
		'retire',
		'recordWaiver',
		'createPolicy',
		'editPolicy',
		'newPolicyVersion',
		'suspendPolicy',
		'activatePolicy'
	],
	'pwa/[id]/agent/+server.ts': ['POST'],
	'test-api/dispatch/+server.ts': ['POST'],
	'test-api/introspect/+server.ts': ['GET'],
	'test-api/reset/+server.ts': ['POST'],
	'undertakings/+page.server.ts': ['create'],
	'undertakings/[id]/+page.server.ts': [
		'proposePwu',
		'beginExecute',
		'startStep',
		'failStep',
		'retryStep',
		'skipStep',
		'cancelStep',
		'pruneStep',
		'enterWaitStep',
		'resolveWaitStep',
		'cancelPlan',
		'completePlan',
		'failPlan',
		'completeStep',
		'recordAssurance',
		'markSatisfied'
	]
};

describe('route action census — the surface cannot gain a mutating act unnoticed', () => {
	it('matches the pinned population exactly', () => {
		expect(census()).toEqual(PINNED);
	});

	it('has a population large enough that a broken walk would be visible', () => {
		// Without this, an extractor that returned {} for everything would satisfy a snapshot regenerated from
		// its own output. The number is a floor, not an assertion about the current total.
		expect(Object.values(census()).flat().length).toBeGreaterThan(35);
	});
});

describe('CONTROL — the extractor discriminates, and fails loudly rather than undercounting', () => {
	const SYNTHETIC = [
		'\tasyncOne: async ({ request }) => {',
		'\t\treturn fail(400, {});',
		'\t},',
		'',
		'\t// A NON-ASYNC ONE-LINER — the shape that made the first enumeration undercount by six.',
		'\tterseOne: ({ params }) => advancePwa(\'X\', params.id, {}),',
		'',
		'\tblockNoAsync: ({ params }) => {',
		'\t\treturn { ok: params.id };',
		'\t}'
	].join('\n');

	it('finds BOTH the async and the non-async forms', () => {
		// A regex requiring `async (` returns only ['asyncOne'] here — this is the undercount, pinned.
		expect(extractActionKeys(SYNTHETIC)).toEqual(['asyncOne', 'terseOne', 'blockNoAsync']);
	});

	it('does NOT mistake a nested object key for an action', () => {
		// Nested literals sit at two-plus tabs. An extractor matching any indentation reports `selectedOption`
		// and `rationale` as actions.
		const nested = [
			'\tonlyAction: async ({ request }) => {',
			'\t\tconst r = dispatch(\'X\', \'Y\', id, {',
			'\t\t\tselectedOption,',
			'\t\t\trationale',
			'\t\t});',
			'\t\treturn r;',
			'\t}'
		].join('\n');
		expect(extractActionKeys(nested)).toEqual(['onlyAction']);
	});

	it('THROWS on an unrecognised shape instead of silently dropping it', () => {
		// THE CONTROL FOR THE CONTROL. If the extractor ever skipped what it could not parse, the census would
		// shrink and stay green — a smaller population reported as a complete one.
		expect(() => extractActionKeys('\thandoff: someImportedHandler,')).toThrow(
			/not a recognised function form/
		);
	});

	it('brace-matches the actions object rather than reaching for the last `};` in the file', () => {
		const source = [
			'export const actions: Actions = {',
			'\tonly: async () => {',
			'\t\tconst shape = { a: 1 };',
			'\t\treturn shape;',
			'\t}',
			'};',
			'',
			'export const helper = {',
			'\tnotAnAction: 1',
			'};'
		].join('\n');
		expect(extractActionKeys(actionsBlock(source))).toEqual(['only']);
	});
});
