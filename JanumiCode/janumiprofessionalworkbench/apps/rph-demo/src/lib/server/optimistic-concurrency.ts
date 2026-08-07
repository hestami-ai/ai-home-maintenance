// THE SURFACE HALF OF PER-4 — one home, because a guard that gets copy-pasted becomes several guards that
// disagree.
//
// JPWB-DOC-003 §9 PER-4: *"Updates to existing aggregates declare the revision they believe current. On
// conflict, the command is rejected."* Its NON-EXAMPLE exempts pure creations. SPEC-001 §11.4.22 item 2 binds
// the SURFACE to set `expectedRevision` from the revision the page was rendered at.
//
// The engine's half has always been correct (`loadOrReject` honours the field whenever present). What was
// missing was the surface declaring it, and the whole protection lives in ONE property: the number must
// originate in the read that produced the page and travel back through the form. A revision re-read inside the
// action is always current, can never conflict, and satisfies PER-4's letter while protecting nothing — see
// REG-F-050 and the standing test at `verif/optimistic-concurrency-surface.test.ts`.
//
// ── WHY THIS IS A MODULE AND NOT THREE LINES IN EACH ROUTE ──────────────────────────────────────────────────
// `readRenderedRevision`'s empty-string branch is UNREACHABLE FROM ANY E2E. It only fires when the hidden field
// is absent, and no rendered page omits it — so the branch that carries the entire defence could not be tested
// where it previously lived, inside `routes/decisions/+page.server.ts`. Extracting it makes it directly
// assertable (see `optimistic-concurrency.test.ts`), which is a better reason to move code than reuse is.
//
// ── AND WHY $lib/server/ SPECIFICALLY ───────────────────────────────────────────────────────────────────────
// SvelteKit itself refuses to build a browser-reachable import of `$lib/server/*`. Neither `bun run boundary`
// (it cruises `packages` only — the crawl root is a literal argument, so no file under `apps/` is ever a source
// node) nor eslint (no import plugin is configured) constrains placement here. This directory is the only
// MECHANICAL guarantee available that a fail-closed server guard cannot be pulled into client code.
import { fail } from '@sveltejs/kit';
import type { CommandResult } from '@janumipwb/rph-contracts';

/** The form field the template round-trips the rendered revision through. Deliberately duplicated as a literal
 *  in each `+page.svelte`: a template CANNOT import from `$lib/server/*` (SvelteKit throws at build), so there is
 *  no shared constant to be had. A rename that misses a template is caught, not silent — `form.get` then returns
 *  null and the action fail-closes, reddening that route's e2e. */
export const EXPECTED_REVISION_FIELD = 'expectedRevision';

/**
 * The revision the SUBMITTING PAGE was rendered from, or null when the form declared none.
 *
 * ⚠ `Number('')` IS 0, AND 0 IS A REAL REVISION. `createObject` commits `newRevision: alsoEvents.length`
 * (packages/rph-application/src/handlers/kit.ts:563), so an aggregate with no follow-on events is created AT
 * REVISION 0. If the hidden input goes missing the browser posts an EMPTY STRING, and a naive `Number(raw)`
 * turns *"the form carried nothing"* into *"expect revision 0"* — which MATCHES a freshly created aggregate.
 *
 * That is not hypothetical here. On /baselines the FIRST action after creation (`submit`) acts on a row at
 * revision 0, so under a naive parse it would be ACCEPTED and its e2e assertion would stay green over a form
 * that round-trips nothing at all. Only the SECOND action would fail. A defect that hides behind the first
 * step of the only test that drives it is exactly the kind this guard exists for.
 *
 * THE EMPTY-STRING REJECTION IS THE ENTIRE DEFENCE, and it is the easiest thing here to get wrong. It is
 * carried by the `+` in the shape test below — see the note there for why that is stated once rather than twice.
 */
export function readRenderedRevision(form: FormData): number | null {
	const raw = form.get(EXPECTED_REVISION_FIELD);
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	// ── ONE RULE, AND THE `+` IS THE WHOLE DEFENCE ──────────────────────────────────────────────────────────
	// This single test rejects the empty string. An earlier draft ALSO carried an explicit
	// `if (trimmed === '') return null;` above it — and that line was dead: `/^\d+$/.test('')` is already
	// false, so deleting it changed no behaviour and no test could have told. A guard that cannot fail reads
	// as protection and is not any, so it is gone and the rule is stated once.
	//
	// WHAT THIS BUYS: the defect is now exactly ONE CHARACTER away. Weaken `+` to `*` and the empty string
	// parses, `Number('')` yields 0, and a form that round-tripped NOTHING declares "expect revision 0" —
	// which matches every freshly created aggregate, because `createObject` commits `newRevision:
	// alsoEvents.length` (packages/rph-application/src/handlers/kit.ts:563). That mutant is declared in
	// scripts/mutants/ledger.ts and reddens the sibling test.
	//
	// THE SHAPE TEST ALSO COMES BEFORE `Number`, AND MUST. `Number` accepts spellings no template can emit:
	// `Number('0x2')` is 2 and `Number('1e3')` is 1000, and both pass `Number.isInteger(n) && n >= 0`. The
	// route-local parser this module replaces accepted them; the unit test caught it on its first run, which
	// is the argument for extracting the function rather than copying it into a second route.
	if (!/^\d+$/.test(trimmed)) return null;
	const n = Number(trimmed);
	// Beyond 2^53-1 a revision cannot be real, and equality against the store's number would stop being
	// reliable — so this fails closed rather than comparing two values that may both have been rounded.
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * The refusal for a form that declared no revision.
 *
 * Exported as a CONSTANT rather than as a `return fail(400, …)` helper so each call site keeps its own visible
 * `return`, and so a route can compose it with local context. A shared returner would hide which branch fired.
 */
export const STALE_FORM =
	'This page did not declare the revision it was rendered from. Reload the page and retry.';

/**
 * Map a rejected CommandResult onto an HTTP failure, surfacing the RPH code alongside the message.
 *
 * Without the code a CONFLICT and a state-machine refusal read identically to the professional, and that
 * distinction is the only evidence this surface can offer about WHY the act did not happen.
 *
 * ⚠ TYPED ON `CommandResult`, NOT ON `ReturnType<typeof dispatch>`. That is the type of the seam itself
 * (`EngineHandle.dispatch`, packages/rph-engine/src/engine.ts:102), and `dispatch()` returns it unwrapped. The
 * `typeof` form would tie a pure form-protocol module to the engine HOST — a module that owns the process-wide
 * engine singleton, the sqlite adapter and the deterministic test clock. `import type` would keep that out of
 * the emitted graph, so this is a cohesion choice rather than a workaround: this module must not know that an
 * engine exists.
 *
 * Covers PLAIN `dispatchBatch` too: a per-command revision conflict there surfaces as that command's own
 * CommandResult with status CONFLICT (kit.ts:143-150). Only `dispatchBatchGuarded` reports a batch-level
 * `guardConflict` instead, and its sole caller — `authoring-turn.ts` — already classifies it.
 */
export function refuse(r: CommandResult) {
	return fail(r.status === 'CONFLICT' ? 409 : 400, {
		error: r.error?.message ?? r.status,
		code: r.error?.code
	});
}
