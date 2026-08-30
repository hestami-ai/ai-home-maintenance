// ⚠⚠ THIS FILE IS UNREACHABLE ON PURPOSE. DO NOT MOVE IT, DO NOT FIX IT, DO NOT DELETE IT.
//
// It is the positive control for the Slice ledger's blind-spot check (JAN-SLICE SL-L3, REG-F-293).
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// The ledger's gate asserts that the WIDE discovery sweep finds nothing the NARROW recognition predicate misses.
// Stated as `discovery \ recognition == {}`, that is an ABSENCE assertion — and a sweep that silently returned
// nothing would satisfy it perfectly. The gate would be green because it looked at no files.
//
// So exactly one Slice-shaped file is committed where recognition cannot reach it, and the gate asserts the delta
// is EXACTLY this file. That gives three distinguishable outcomes instead of two:
//
//   delta == {}          -> FAIL. The sweep stopped seeing the canary; it is no longer measuring anything.
//   delta == {CANARY}    -> PASS. The sweep ran, and found no real Slice hiding.
//   delta  > {CANARY}    -> FAIL, naming the extras. A real Slice is somewhere the ledger cannot see it.
//
// ── WHY IT IS SAFE HERE, VERIFIED ────────────────────────────────────────────────────────────────────────────
//   - `packages/rph-engine/tsconfig.json` has `"include": ["src"]` — not typechecked, not emitted to dist.
//   - the vitest package project collects `src/**/*.test.ts` — not collected, so it never runs.
//   - coverage includes `packages/*/src/**/*.ts` — not in the denominator.
//   - `packages/csaa/test-fixtures/` is the existing precedent for a fixture tree outside `src`.
//
// ⚠ IT *IS* LINTED, AND `boundary` (dependency-cruiser) DOES WALK IT — eslint's ignore list covers dist,
// node_modules, coverage, .turbo, .svelte-kit, build and docs, but NOT test-fixtures. **So this file must contain
// ZERO imports, forever.** The declaration below is a plain literal with no `satisfies` clause for exactly that
// reason: importing the type would create an edge the boundary gate would have to reason about, for a file that
// is deliberately outside every graph.

export const SLICE = {
	id: 'CANARY',
	title: 'The permanent unreachable Slice that proves the blind-spot sweep ran',
	plane: 'ENGINE',
	scenarioClass: 'normal path',
	citedRules: [],
	dischargesRegisterEntries: [],
	mutants: []
};
