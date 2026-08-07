# ROADMAP — FORK-22 item 2 across the surface: declaring the revision the page was rendered from

**Design:** `DESIGN-fork22-freshness.md` (§3 is the mechanism; this document is the programme).
**Authority:** REG-D-025. **Ruling:** JPWB-SPEC-001 §11.4.22 item 2 (ratified, REG-D-023) + JPWB-DOC-003 §9 PER-4.
**Corrections this document carries:** REG-F-052 (the count), REG-F-053 (what the /decisions red proved).

---

## 0. The number I published is retired, not restated

`0b21d752` said **"3 of 33 in-scope actions"**. Both halves were wrong, and the second is worse than the first
because it looked reproducible.

- **"3"** — measured, it was **4**. `pwa/[id]#acceptAgentCandidate` was already revision-guarded, and the same
  commit message called it *"the working precedent"* two paragraphs later. See REG-F-052.
- **"33"** — **not reproducible from any enumeration.** It counts route *actions*, but reaching 33 requires an
  unstated exclusion rule, and applying that rule silently drops `undertakings#create` despite its **five**
  UPDATE dispatch sites. A number that needs an unwritten rule to reproduce is not a measurement.

**So this document publishes the enumerations instead, and states the unit every time.** Both were derived from
the filesystem, not estimated.

## 1. The two populations, enumerated

### 1a. Route actions — 43, by name

| File | n | Actions |
|---|---|---|
| `routes/+page.server.ts` | 2 | create · delete |
| `routes/baselines/` | 3 | create · **submit ✓** · **approve ✓** |
| `routes/decisions/` | 4 | propose · **approve ✓** · **grant ✓** · **deny ✓** |
| `routes/pwa/[id]/` | 17 | **acceptAgentCandidate ✓** · discardAgentCandidate · editDetails · defineType · editType · removeType · submitForReview · validate · publish · deprecate · retire · recordWaiver · createPolicy · editPolicy · newPolicyVersion · suspendPolicy · activatePolicy |
| `routes/undertakings/` | 1 | create |
| `routes/undertakings/[id]/` | 16 | proposePwu · beginExecute · startStep · failStep · retryStep · skipStep · cancelStep · pruneStep · enterWaitStep · resolveWaitStep · cancelPlan · completePlan · failPlan · completeStep · recordAssurance · markSatisfied |

Plus 4 endpoints (`pwa/[id]/agent` POST, and the three `test-api/*`).

⚠ **The obvious extraction misses six of these.** `^\t(\w+): async \(` finds 11 in `pwa/[id]`, not 17: six are
non-async one-liners (`submitForReview: ({ params }) => advancePwa(…)`). Recorded because any future instrument
over this population will reach for that pattern first, and its undercount is silent.

### 1b. Dispatch sites — 87: 21 CREATE, 66 UPDATE

| File | sites | UPDATE |
|---|---|---|
| `routes/undertakings/[id]/` | 34 | 30 |
| `routes/pwa/[id]/` | 20 | 16 |
| `routes/undertakings/` | 9 | 5 |
| `lib/server/agent/tools.ts` | 9 | 5 |
| `routes/decisions/` | 4 | 3 |
| `lib/server/floor.ts` | 4 | 2 |
| `routes/baselines/` | 3 | 2 |
| `routes/+page.server.ts` | 2 | 1 |
| `lib/server/workbench.ts` | 1 | 1 |
| `routes/test-api/dispatch/` | 1 | 1 |

**UPDATE sites declaring a revision today: 6 of 66** — decisions ×3, baselines ×2, and the
`acceptAgentCandidate` batch. 30 of the 66 sit inside a batch.

## 2. PER-4 has TWO legitimate surface shapes, and a survey that knows only one will misclassify 30 sites

**Shape A — the form round-trip.** One act, one aggregate. The loader carries `revision`, the template renders a
hidden field, the action parses it *strictly* and fails closed, `dispatch()` takes it as the fifth argument.
Landed on `/decisions` and `/baselines`. The guard lives in **one** module,
`$lib/server/optimistic-concurrency.ts`.

**Shape B — the session-scoped revision vector.** A multi-aggregate turn whose *duration* is the exposure.
`snapshotRevisions` (`authoring-turn.ts:124-145`) captures a revision for the PWA, every PWU-Type, every
assurance policy and the conversation at **turn start**; `commitGuardPreconditions` turns that into a guard
vector — with `mustNotExist` for aggregates that did not yet exist — and `dispatchBatchGuarded` verifies it
atomically alongside the base event count and per-object content hashes.

Shape B is **stronger** than PER-4 requires, and it is not a re-fetch: the capture precedes an entire agent
conversation. It is the right shape wherever a batch spans more than one aggregate, because **only the first
command touching an aggregate can carry a page-derived value** — computing the sequels server-side would be the
re-fetched tautology in a different costume (REG-F-050).

⚠ **`dispatchBatch` already threads a per-element `expectedRevision`** (`UiCommandInput` carries it and every
element goes through `uiCommand`). **The batch sites are not blocked at the dispatch layer.** I had assumed they
were; they are blocked one layer earlier.

## 3. The real blocker is the LOADER, and it is repo-wide

Grepping for the value rather than the field name: **`revision:` reaches a template from a route loader in
exactly two places** — `decisions` and `baselines`, both added this week. Every other loader drops it, exactly as
those two did.

`ExecutionPlanInput` (`packages/rph-projections/src/execution-view.ts:176-183`) has **no `revision` field at
all**, and `shapeExecutionPlanInput` never reads one — so the 16 `undertakings/[id]` actions are blocked in the
*projection contract*, not in the route.

**This inverts the work.** The remaining increments are not "thread an argument through 27 actions"; they are
"stop discarding the revision in each loader, then thread it." That is DESIGN §3 item 1 — *"Stop discarding the
revision… This is the structural fix — everything else is threading"* — recurring one layer up, for the third
time (`ObjectRow`, then `dispatch()`, now the loaders).

## 4. Sequence

| # | Increment | Shape | Blocked on |
|---|---|---|---|
| ✅ W-1 | `/decisions` — approve, grant, deny | A | — |
| ✅ W-2 | Extract the guard to one module + pin the empty-string branch | A | — |
| ✅ W-3 | `/baselines` — submit, approve | A | — |
| W-4 | `routes/+page.server.ts#delete` and `undertakings#create`'s 5 UPDATE sites | A | loader |
| W-5 | `pwa/[id]` — the 5 `advancePwa` lifecycle actions + the 5 policy actions | A | loader |
| W-6 | `ExecutionPlanInput` gains `revision`; `shapeExecutionPlanInput` carries it | — | contract change |
| W-7 | `undertakings/[id]` — 16 actions over the repaired projection | A + B | W-6 |
| W-8 | `lib/server/floor.ts`, `agent/tools.ts` — 7 UPDATE sites reached through helpers, not `dispatch()` | B | design |

W-4 and W-5 are independent and can land in either order. **W-6 is the pivot**: it unblocks the largest single
file (30 UPDATE sites) and is a contract change rather than a surface change, so it wants its own design pass.

## 5. The ratchet is DEFERRED, and the reason is specific

A wired-vs-unwired instrument was designed and **adversarially refuted as unsound**. Recorded rather than
quietly dropped, because "we should add a ratchet" will otherwise be re-proposed:

1. **It would have been red on day one.** The proposed classifier keys on `dispatch(…)` arity within the same
   module. `acceptAgentCandidate` contains no `dispatch` token — its guard is a cross-file call to
   `commitAuthoringTurn` → `dispatchBatchGuarded`. So the design could never place its own pinned positive
   entry, and the only fixes were to hardcode it (the allowlist it claimed to avoid) or to contradict its own
   census.
2. **Arity cannot see the tautology this repo already pays to pin.** `dispatch(…, getEngine().loadObject(id)?.revision)`
   is 5 arguments and protects nothing — REG-F-050's exact shape. A ratchet that greens on it would green-light
   the defect the surrounding machinery exists to catch.
3. **Its control mutant was not attributable.** Renaming a route action key breaks a live form post and reddens
   that route's e2e, so RED could not distinguish "the ratchet works" from "the e2e caught a broken form."

**The deeper reason, and the thing to solve first:** once a route is *correctly* wired, its e2e already reddens
on any break in the chain — so the ratchet's only unique job is detecting a **newly added unwired action**, and
no find/replace mutant on existing code can prove that capability. The honest instrument for it is an
enumeration test that pins the action set and forces a human to classify anything new; it claims nothing about
wiring. **That is the next thing to build here, and it is deliberately less than what was proposed.**

## 6. What this programme does not claim

Item 2 of FORK-22's four. Items 1, 3 and 4 need the affordance state machine the surface does not have.
No protection against concurrent **agents**, which dispatch outside the surface entirely. And no freshness
model: `ProjectionEnvelope`, `freshness` and `derivedAtSubjectRevision` still occur nowhere in the tree.
