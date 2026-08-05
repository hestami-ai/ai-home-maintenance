# ROADMAP — validator health (REG-E-024(c))

**Design:** `DESIGN-validator-health.md` · **Date:** 2026-08-05

Each increment: land → gate → commit. Every increment names the test that must redden first.

---

## INC 1 — the corpus declares the transition table

The vocab records *"NO transition table specified in the doc"*, so the arrows are authored. Amend DOC-004 §35 in
the **§0.3 marked blockquote convention** — the same instrument used for the §31/§32 cancellation amendment — to
declare the five arrows and their triggers, citing §34.1's *"alternate validator implementation"* as why the
status must be operative rather than descriptive.

**Predicted red:** the corpus-amendment gate in `doc004-conformance.test.ts` gains a check that §35 declares the
table; stripping the amendment reddens it. As with the last amendment, the check must read the **declaration**,
not prose mentioning it.

**Gate:** `rph-product-realization-pwa`.

---

## INC 2 — the object, the machine, the contracts

- `VALIDATOR_REGISTRY_ENTRY` as a `ProfessionalWorkObjectType`.
- `ValidatorRegistryEntry.status` gains its five transitions in `m2-transitions.json`, `initialState: ACTIVE`,
  provenance naming the amendment as their source.
- Five commands + five events in `m3-commands-events.json`.
- `bun run gen`.

**Predicted red:** `state-reachability.test.ts` currently pins `ValidatorRegistryEntry.status.{ACTIVE,DEGRADED,
DISABLED}` as unreachable and lists the machine among those with no arrows at all. **Both pins must redden** —
that is the finding closing, and the pins come out rather than being widened.

**Gate:** `check-types` + `rph-domain` + `rph-contracts`.

---

## INC 3 — handlers

Five handlers through the existing `advanceStatus` kit so the machine, not the handler, owns legality. `Register`
creates; the other four advance. Each refuses from an illegal source state by construction.

**Predicted red:** a test driving `DEGRADED → DISABLED → ACTIVE` and asserting `DEGRADED → ACTIVE` is refused
from `DISABLED` (it is not an arrow) — plus the control that the legal arrows are ACCEPTED, so the refusals are
about legality and not about everything being refused.

**Gate:** `rph-application`.

---

## INC 4 — the status becomes operative

- `selectAssuranceEvaluator` REFUSES a `DISABLED` validator (§35 availability, §34.1 alternate).
- `DEGRADED` does **not** refuse — asserted explicitly, because the non-refusal is a design claim.
- Absent registry entry does **not** refuse: the disclosed fail-open, identical in shape to `attemptsMade` and
  `lastFailureClass`. Today no production path registers a validator, so refusing on absence would break every
  existing assessment — and the census would then be measuring a system nobody could use.

**Predicted red:** remove the refusal → the `DISABLED` case stops refusing while both over-refusal guards
(`DEGRADED` selectable, unregistered selectable) stay green.

**Gate:** `rph-application`.

---

## INC 5 — the read-model, before F-29's seventh instance

A new engine refusal the projection is not told about is F-29, and this session created the sixth instance in
exactly this way — by adding a refusal and not the affordance. Same split as the retry cap and §36: the kernel
decides, the caller supplies the fact, the withheld affordance carries its reason.

**Predicted red:** remove the limb → the withheld-evaluator assertion reddens while the over-refusal guards stay
green.

**Gate:** `rph-projections` + `apps/rph-demo` `check`.

---

## INC 6 — census, register, full gate

- The reachability census reports **zero** unreachable states and **zero** arrowless machines — the first time
  since REG-F-023 was filed.
- Register: REG-E-024(c) CLOSED; REG-F-023 CLOSED; the corpus amendment recorded.
- Full gate: vitest + `test:dist` + `check-types` + `lint` + `boundary` + svelte-check + playwright.

---

## What would make this roadmap wrong

1. **If `DEGRADED` should bar selection** — INC 4's second bullet inverts; nothing else moves.
2. **If the sponsor wants degradation derived from the failed assessment rather than declared** — INC 3 gains a
   derivation and the separate command becomes redundant; the arrows survive.
3. **If registering validators should be mandatory before assessing** — INC 4's fail-open becomes a refusal, and
   that is a much larger change: every existing caller would need a registered validator first.
