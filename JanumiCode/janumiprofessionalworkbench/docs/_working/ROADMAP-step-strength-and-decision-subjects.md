# ROADMAP — Step strength, and a Decision that names its subject

Implements `DESIGN-step-strength-and-decision-subjects.md` (rulings on REG-F-105 / REG-F-106, sponsor grant
REG-D-041). Six increments. Each lands **red test first → change → mutant with a predicted red → full gate →
register entry → commit**, in that order, with the register written *before* the gate because the register is an
input to the C-0 controls.

**Acceptance is behavioural, not declarative** (DESIGN §6). An authored-but-unread `strength` field would be
this design failing, so every increment that adds a field also names the test that reddens without it.

---

## R-1 — `ExecutionStep.strength` exists, and `SkipExecutionStepPayload.mandatory` does not

**Contract change.** Generated, never hand-edited: `packages/rph-contracts/vocab/*.json` → `bun run gen`.

1. `m1-object-fields.json`, `ExecutionStep.fields` — append after `stepState`:
   `{ field: 'strength', type: 'ObligationStrength', required: false, enumRef: 'ObligationStrengthSchema',
   note: 'UNRATIFIED-AUTHORED (annotated 2026-08-10 under sponsor grant REG-D-041) …' }`
   The note carries the compressed reasoning: §21.1's remedy names a *plan revision*, so mandatoriness is a fact
   of the plan; the enum is reused from `Obligation.strength` (RPH-DOC-002 §10.1) rather than minted; absent ⇒
   MANDATORY at the gate; `CONDITIONAL` gates as MANDATORY until a ratified applicability predicate exists
   (Guide §8.4 L844, *"ambiguity resolves to material"*). Ends *"Ratification pending."*
2. `canonical-vocabulary.json`, `ObligationStrength.appliesTo` — extend to name both sites
   (`ObligationObject.strength; ExecutionStep.strength`). One enum, two declared homes, visible in the vocabulary
   rather than discovered in generated output.
3. `m3-commands-events.json`, `SkipExecutionStep` payload — **delete** the `mandatory` field.
4. `bun run gen`. Expected diff: `ExecutionStepSchema` gains `strength: ObligationStrengthSchema.optional()`;
   `SkipExecutionStepPayloadSchema` loses `mandatory`. `ProposeExecutionPlanPayload.steps` is
   `z.array(ExecutionStepSchema)`, so plan authoring gains the field with no payload edit.

**Predicted breakage, which is the point.** `strictObject` makes every remaining `mandatory:` caller a *type*
error, not a silent no-op. Sites to repair: `execution.ts` handler (R-2), `execrem-wp12-skip-authorization.test.ts`
(R-2), any fixture. **A caller that still sends `mandatory` at runtime is refused by the schema** — the loud
failure the design asks for.

**Gate:** `bun run check-types` + `bunx vitest run packages/rph-contracts`.

---

## R-2 — The skip gate reads the step, not the request

**Red first.** New `packages/rph-application/src/handlers/step-strength-authority.test.ts`, four cases over one
plan, no authorization anywhere:

| Step | `strength` | Expected |
|---|---|---|
| S-mandatory | `MANDATORY` | **REFUSED** |
| S-conditional | `CONDITIONAL` | **REFUSED** — fail-closed until a predicate exists |
| S-advisory | `ADVISORY` | ACCEPTED |
| S-legacy | *absent* | **REFUSED** — absent ⇒ MANDATORY |

Plus one **control**: the ADVISORY row must be the *same step shape* as the MANDATORY row, differing only in
`strength` — otherwise "ACCEPTED" could be some other permission and the discrimination is unproved.

**Change.** `execution.ts` `skipExecutionStep` — the precheck already receives `(step, plan)`:

```ts
precheck: (step) => {
  …resolveSkipAuthorization unchanged…
  const check = canSkipStep({
    mandatory: (step.strength as ObligationStrength | undefined) !== 'ADVISORY',
    hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId
  });
```

The ratified `canSkipStep` kernel keeps its signature; only the *provenance* of its first input changes — from
the skipper's assertion to the approved plan's declaration. Rewrite the handler docblock, which currently states
`mandatory` is caller-asserted and that no step-level field is ratified: it will be false the moment this lands.

**Amend, don't delete, the admission test.** `execrem-wp12-skip-authorization.test.ts`'s REG-F-105 admission
("same caller, same step: REFUSED when it says `true`, ACCEPTED when it says `false`") is now *unreachable* —
the payload field is gone. Per the retire-by-striking rule it is **converted, not removed**: the same two
dispatches now differ by the step's declared `strength`, and the test's header records that it was written as an
admission of a bypass and is retained as the proof the bypass is closed.

**Mutants** (`scripts/mutants/ledger.ts`), each reddening its own test:
- **M1 — the fail-open default.** `?? 'MANDATORY'` ⇒ the absent case becomes skippable. Predicted red: *S-legacy*
  only.
- **M2 — CONDITIONAL leaks.** `!== 'ADVISORY'` ⇒ `=== 'MANDATORY'`. Predicted red: *S-conditional* only.

Two mutants because the two failures are independent: a repository can hold the legacy default and still let
CONDITIONAL through, and one mutant reddening both tests would prove neither separately.

**Gate:** full.

---

## R-3 — The `COMPLETED` gloss stops citing a source that does not carry it

`packages/rph-domain/vocab/m11-execution.json:37` glosses `COMPLETED` as *"All required steps reached terminal
success; plan finished."* against `sourceRef: "§20.1; Contract §15"`. **Verified: RPH-DOC-002 §20.1 is the
`ExecutionPlan` interface plus a bare status enum with no per-value meanings.**

Correct the `sourceRef` to disclose the authorship (`§20.1 (status value only — the "required steps" gloss is
AUTHORED, not stated there; see REG-F-107)`). **No completion rule is implemented**: none is ratified, and
inventing one is the defect this whole design is about. What changes is only that the attribution stops being
false. File **REG-F-107**.

**Gate:** vocab consumers — `bunx vitest run packages/rph-domain`.

---

## R-4 — A subject catalog the Decision Center can offer

New `listGovernedObjects(handle, scope)` in `packages/rph-engine/src/queries.ts`, returning
`{ id, objectType, name, semanticVersion, revision }`.

- **Derived, not enumerated.** The type set is `ProfessionalWorkObjectTypeSchema.options` — the contract's own
  registry. Hand-listing the types here is the enumeration defect one level up, and is what made my "three exempt
  types" claim in REG-F-106 wrong.
- **One pass over the event log** grouping `aggregateType → ids`, not 23 calls to `listByType` (which rescans
  per type).
- **Scope is required and honoured**, per the `QueryScope` discipline (SPEC-001 INV-02 / FORK-9): `WORKSPACE`
  passes through; `UNDERTAKING` filters on the object's **own** id being in `undertakingObjectIds(...)` — these
  are candidate *subjects*, so membership is ownership, not subject-intersection. The signature takes the scope
  rather than defaulting it, for the reason the file already records at L185.

**Test:** `queries.test.ts` — the catalog over the seeded workbench contains the reference PWU with its true
`semanticVersion`; `UNDERTAKING` scope is a strict, non-empty subset of `WORKSPACE`. **Control:** a type present
in the enum with zero instances contributes zero rows and does not throw — so the catalog is proved to be walking
the registry rather than a fixture.

**Gate:** `bunx vitest run packages/rph-engine`.

---

## R-5 — `/decisions` proposes with a subject, and approves against the pin

`apps/rph-demo/src/routes/decisions/{+page.server.ts,+page.svelte}`.

1. **`load`** additionally returns the R-4 catalog (`{ kind: 'WORKSPACE' }`, matching the existing
   `listDecisions` call and the route's SPEC-001 INV-02 comment).
2. **`propose`** reads `subjectObjectIds` (multi-select) and **refuses an empty selection with a reason**:
   *"A decision must name what it is about — an authorization is bound to exact subjects and versions
   (ASR-15)."* Passes the ids through instead of `[]`.
3. **`approve`** replaces `subjectSemanticVersions: {}` with versions **read from the store at approval time**
   for the decision's own `subjectObjectIds`, mirroring the S-0 baseline authorization. The handler compares them
   to the propose-time pin, so a subject that moved makes the approval **refused as stale** — ASR-15's *"A
   decision approving version n never authorizes version n+1"* becoming operative on this route.
4. **The disclosure is rewritten, not kept.** The REG-F-106 notice says the form *"authorizes nothing"*; after
   (2) that is false, and a stale warning on a repaired surface is worse than none. It becomes: an approved
   decision is a **standing, version-bound authority** the acting surfaces will find and honour, and it stops
   resolving the moment its subject changes version.

**Tests.**
- Unit (`+page.server` actions, the existing route-test pattern): empty selection ⇒ 400 with the reason;
  a named subject ⇒ ACCEPTED and the stored decision's `subjectObjectIds` is non-empty.
- **The stale-approval test, which is the increment's point:** propose naming a PWU, mutate the PWU's version,
  then approve ⇒ **REFUSED**. This is the first test on this route that can fail for a governance reason rather
  than a form reason.
- E2E `decisions-subject.e2e.ts`: propose with a subject → row appears → approve → EFFECTIVE.

**Mutants:**
- **M3 — the surface stops requiring a subject.** Delete the empty-selection refusal. Predicted red: the empty
  selection unit test only.
- **M4 — approve goes back to `{}`.** Predicted red: the stale-approval test only. This is the mutant that
  proves the pin comparison is live rather than vacuous — the precise vacuity REG-F-106 recorded.

**Gate:** `cd apps/rph-demo && bun run check` + `bunx playwright test`.

---

## R-6 — Register, corrections, and the full gate

1. **Amend REG-F-105 in place** (strike, don't delete): it is **not a new question** (JAN-EXECPLAN-DR-003:41 and
   :225 disclosed and deferred it on 2026-07-24); the corpus **gestures** five times rather than being silent;
   and the caller-asserted horn I offered as respectable is **ruled out** by Guide §8.4 L844.
2. **Amend REG-F-106 in place:** *both* options I put to the sponsor are refuted, with the citations; the corpus
   supports a third, repair-the-form option; the three-tier lens is what settles it.
3. **REG-D-041** — the sponsor grant and its bounds.
4. **REG-F-107** — the `COMPLETED` provenance defect.
5. **New REG-F entries** for what R-2 and R-5 shipped.
6. **Owed to governance, recorded as OPEN and non-blocking** (DESIGN §6): ratify `strength`; rule on
   strength-vs-obligation agreement; settle the `COMPLETED` gloss; rule on expiry for non-waiver decisions.

**Full gate:** `check-types` (3 legs) · `lint` · `boundary` · `build` · `bunx vitest run` · `test:dist` ·
`apps/rph-demo bun run check` · `bunx playwright test` · `bun run mutants`.

**Commit discipline:** `git commit -F - <<'EOF'`; verify `CSAA staged: 0` on every commit.

---

## Sequencing and why it is this order

R-1 before R-2 because the type error *is* the call-site census — it derives the list of things to repair
instead of my enumerating them. R-3 stands alone (a provenance correction, no code). R-4 before R-5 because the
surface cannot offer a subject it cannot list. R-6 last, and the register is written **before** the final gate,
because the register is an input to the C-0 controls.

## Not in scope

Obligation-consistency at plan proposal; a plan-completion rule; expiry on non-waiver decisions; S-1b rejection.
Each is recorded in DESIGN §5 with why it is deferred rather than forgotten.
