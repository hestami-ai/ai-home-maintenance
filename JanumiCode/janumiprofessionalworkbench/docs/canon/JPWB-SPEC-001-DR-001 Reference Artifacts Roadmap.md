# JPWB-SPEC-001-DR-001 — Reference Artifacts: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-28 · Design authority: `JPWB-SPEC-001` v0.1.0 (DRAFT) and its §11.4 rulings. Commissioned by the
proposed REG-005 entry at `JPWB-SPEC-001 commissioning record`. Sponsor direction: "Proceed with all three in the
order you recommend."*

> **NO SEPARATE DESIGN NOTE, and the reason is recorded rather than assumed.** Standing practice is design → roadmap
> → implementation. The design already exists: SPEC-001 states the obligations, and §11.4 rules the twenty-seven
> choices a design note would otherwise have had to make. Authoring a second design document would re-derive ruled
> material and create a rival authority for one concern — the dual-authority defect CON-000 B3 exists to prevent.
> This roadmap therefore cites SPEC-001 as its design authority and adds only sequencing and verification.

## 0. What this discharges

REG-D-009 requires a SPEC to be **paired with enforced repository reference artifacts that cite the spec sections
they implement**, and states plainly that *"a shape reference that no type check or conformance test enforces
asserts a status nothing performs"* (CON-000 B7). SPEC-001 currently asserts 1,479 obligations and is paired with
almost nothing. These three work packages are the first instalment of that pairing — not the whole of it.

## 1. Land order

| WP | Title | Discharges | Why here |
|---|---|---|---|
| **S-1** | Required query scope | `SPEC-001-INV-02`, FORK-9 | A live user-visible defect, smallest blast radius, and the compiler does the enforcing. |
| **S-2** | Verification binding | §12.3's ratification precondition | Largest, and S-1 supplies the worked example of what a bound obligation looks like. |
| **S-3** | The surface layer | FORK-19, and the ledger gap recorded 2026-07-28 | Last because it is the only one that changes an *instrument*, and instruments are safest to change when the things they measure are stable. |

**S-1 before S-2 deliberately.** S-2 must decide, 300 times, whether an obligation gets a named check or a demotion
to `SHOULD`. Doing S-1 first means that judgement is made against a real example of the pattern rather than in the
abstract — and S-1's fixtures become citable from S-2's edits.

---

## 2. S-1 — the scope parameter becomes required

### 2.1 The defect, measured

A brand-new Undertaking renders the seed's **65 assessments, 2 decisions and 2 baselines**. Cause:
`packages/rph-engine/src/queries.ts:46-51` — `listAssessments`, `listObservations`, `listDecisions` and
`listBaselines` take only `(h: EngineHandle)`. The identical bug was found and fixed once, for
`listExecutionPlans`, at `undertakings/[id]/+page.server.ts:314-318` ("the F-6 fix"); its four siblings were left.

### 2.2 Why *optional* is the wrong repair, per FORK-9

`listPwus(h, undertakingId?)` already carries a scope — and it is **optional**. That is precisely why the four
functions written after it declared no scope at all: an optional parameter is an invitation to omit it, and the
omission is invisible at every call site. The ruling therefore requires the scope be **required in the signature**,
so omission is a compile error rather than a review finding.

### 2.3 The shape

```ts
/** The subject a workspace query is bound to. REQUIRED on every list query that can be subject-bound. */
export type QueryScope =
  | { readonly kind: 'UNDERTAKING'; readonly undertakingId: string }
  | { readonly kind: 'WORKSPACE' };
```

`WORKSPACE` is **explicit, never a default**. A caller that genuinely wants every object in the workspace says so,
and that statement is reviewable; today the same intent is indistinguishable from a forgotten argument.

**Scoping is TWO-HOP, and the precedent is the F-6 fix's own comment** — *"a plan carries no undertakingId (F-1)"*.
The same holds here; every one of the four resolves through the Undertaking's PWU ids:

| Object | Link field | Scope rule |
|---|---|---|
| `ASSURANCE_ASSESSMENT` | `subjectObjectIds` | intersects the Undertaking's PWU id set |
| `ASSURANCE_OBSERVATION` | `subjectObjectIds` | as above |
| `DECISION` | `subjectObjectIds` | as above |
| `BASELINE` | `itemObjectVersions` (keys) | as above, over the item ids |

### 2.4 Call sites — 14, in three honest groups

Sizing is done; nothing here is discovery. The groups are what makes this safe:

- **THE LEAK (4)** — `undertakings/[id]/+page.server.ts:256, 297, 303, 309`. These become `UNDERTAKING`.
- **LEGITIMATELY GLOBAL (6)** — `baselines/+page.server.ts:22`, `decisions/+page.server.ts:15`, and
  `test-api/introspect/+server.ts:34, 36, 37, 38` plus `:50`. These become explicit `WORKSPACE`. The introspect
  endpoint in particular MUST stay global: it is the e2e harness's ground-truth read, and scoping it would blind
  every existing spec.
- **POLICY LOOKUPS (3)** — `floor.ts:250, 364, 380`. Assessed individually; each is a floor-gate question about the
  workspace, so each becomes explicit `WORKSPACE` unless reading shows otherwise.

### 2.5 Verification — the predicted red, stated before the work

1. **A compile-level red first.** After the signature change and *before* the call sites are updated,
   `bun run check-types` SHALL fail with 14 errors. That failure is the enforcement mechanism itself and SHALL be
   observed, not assumed — it is the whole argument for required-over-optional.
2. **A behavioural red.** A new e2e SHALL assert that a freshly created Undertaking's Assurance, Decisions and
   Baselines tabs are **empty**, and SHALL be observed FAILING against today's code before the fix. Modelled on
   `undertaking-atomicity.e2e.ts`: it asserts on `/test-api/introspect` ground truth and on rendered rows, and it
   asserts its own arrangement so it cannot pass vacuously.
3. **A mutation entry** reverting the scope to optional, with a named victim — runnable, because the mutated file
   is under `packages/`.
4. Full gate.

---

## 3. S-2 — verification binding over §§2–9

### 3.1 The measurement that opened it

Of **780** normative sentences, **324 (41.5%)** name a check within the adjacent sentence; **300** name none within
±2 sentences; **27** leaf subsections carry a `SHALL` and name no check anywhere in the subsection. The commission
template's rule is unambiguous: *"An unverifiable SHALL is a defect."*

### 3.2 The disposition rule — three outcomes, never a fourth

Every unbound obligation gets exactly one:

- **BIND** — name an existing or specified fixture (`SPEC-001-PF/NF-nn`, a repository test id, or a schema
  conformance check). Preferred wherever the obligation is machine-decidable.
- **DEMOTE** — restate as `SHOULD` where the obligation is real but not mechanically checkable. A demotion is a
  *loss* and SHALL carry its reason inline; a silent demotion is worse than an unbound SHALL because it looks
  settled.
- **DELETE** — remove where the sentence turns out to restate an adjacent obligation. Subject to §8's controlled
  redundancy: a restatement WITH a citation at a boundary is required and SHALL NOT be deleted.

**The concentration matters.** The unbound obligations cluster in the **field-contract tables** (§2.4.3, §2.5.2,
§2.6.2, §2.7.4, §2.7.5, §2.8.4). Most are discharged not one-by-one but by **one schema conformance test per
interface**, which is why 300 is a smaller number than it reads.

### 3.3 Verification

A **counting check** is authored as part of this work package and run before and after: it enumerates normative
`SHALL`/`SHALL NOT` sentences and reports how many name a check. The exit criterion is `0` unbound authored
obligations, with every demotion carrying a reason. The check itself SHALL be re-runnable, so §12.1's pass-3 row
becomes a measurement anyone can repeat rather than a number in a report.

---

## 4. S-3 — the surface layer

### 4.1 Two instruments, one blind spot

- `packages/rph-domain/src/enforcement-register.ts` — `CoverageLayer` has no `SURFACE` member and
  `LAYER_BY_PACKAGE` maps `packages/` prefixes only, so `layerOfTestFile` fail-closes every `apps/` path to
  `UNKNOWN`. No surface-layer obligation can be recorded as enforced.
- `scripts/mutants/run.ts` — executes `bunx vitest run <victim>`. Playwright specs are not vitest specs, so no
  guard whose red-proof is an e2e can be carried by the ledger. Census: **zero** `apps/` entries, **zero** e2e
  victims.

The live instance is already on the record: the `runSteps` atomicity guard landed 2026-07-28 with an e2e red-proof
and **no ledger entry**, because an honest one could not be run. The dishonest version is worse than the absence —
naming an e2e victim makes vitest exit non-zero for finding no spec, which the runner records as `KILLED`, a
verdict produced by the file-matcher rather than by any guard.

### 4.2 The work

1. `CoverageLayer` gains `SURFACE`; `LAYER_BY_PACKAGE` gains `apps/rph-demo/` → `SURFACE`. The fail-closed default
   stays `UNKNOWN` — this widens what can be *recognised*, never what is *assumed*.
2. `run.ts` dispatches a victim matching `*.e2e.ts` to Playwright rather than vitest, and a mixed victim set is a
   declared error rather than a silent partial run.
3. The atomicity guard gets its ledger entry, with `e2e/undertaking-atomicity.e2e.ts` as the named victim.
4. **The predicted red that proves the whole package:** that new entry SHALL report `KILLED`, and a control — an
   e2e victim named for a mutation that does not affect it — SHALL report `SURVIVED`. Without the control, a runner
   that reports `KILLED` for every e2e victim is indistinguishable from one that works.

---

## 5. Exit gate

`bun run gate` in full after each work package — check-types, lint, boundary, build, both test modes, coverage
against the ratchet, svelte-check, e2e, and `mutants` with `KILLED_UNNAMED` blocking. No work package is complete
on a green that was not preceded by a named, observed red.
