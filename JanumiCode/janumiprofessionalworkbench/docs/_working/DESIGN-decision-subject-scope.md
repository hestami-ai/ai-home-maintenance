# DESIGN — Decision subject scope: what the workbench must be able to authorize

**Occasion:** REG-F-077. **Status:** DESIGN, for the roadmap that follows it.
**Method:** an 8-agent derivation (4 lenses × 1 adversarial refuter). **All four lenses were refuted**, each after
its skeptic had confirmed a great deal — the shape that carries information. Every number below that decides
something was re-measured by hand; where it was not, the text says so.

---

## 0 · What this is

REG-F-077 records that `apps/rph-demo/src/routes/decisions/+page.server.ts:50` hardcodes `subjectObjectIds: []`,
so no Decision the workbench UI creates can satisfy the scope conjunct of any authorization gate. That is true and
was re-verified on 2026-08-09.

**But the entry's framing is wrong in three ways, and each changes the design.** This document restates the
problem, then answers the question the register itself posed and the entry then dropped (REG-005:2235): *"a
decision about which objects are selectable in which context."*

---

## 1 · Three corrections to the finding

**1.1 — "The only surface that can create a Decision" is false.** Two other routes mint Decisions naming real
subjects: `pwa/[id]/+page.server.ts:554` (`RequestWaiver`) and `undertakings/[id]/+page.server.ts:933`. So the
engine, the pinning helper and the surface idiom **already work end to end**. That is the positive control for the
whole increment: this is a form defect, not an engine defect.

**1.2 — "read by four gates" was a snapshot, and it was stale within hours.** Measured from git:

| | |
|---|---|
| REG-F-077 entered the register | `0eaee2a8`, 2026-08-08 **12:57** |
| `reject-authorization.ts` landed | `8c550a9a`, 2026-08-08 **15:11** |
| `waiver-authorization.ts` landed | `54e080fd`, 2026-08-09 **17:41** |

**The count was wrong 2h14m after it was written, and the second addition is mine from yesterday.** The design
must therefore not name a gate count at all: it must state a **re-runnable derivation** and let the count fall out.

**1.3 — "plus version pinning at propose time" over-specifies; that half needs zero surface code.**
`proposeDecision` already derives the pin from the store — `subjectVersions(ctx, p.subjectObjectIds)`
(`handlers/governance.ts:210`), reading each object's live `semanticVersion`. The surface supplies *subjects*; the
engine supplies *versions*. Sending versions from a form would re-open REG-F-014's forgery shape on a new field.

---

## 2 · What the corpus requires, and where it is silent

- **DOC-003 §8.7 ASR-15** binds a Decision to exact subjects **and** exact subject semantic versions.
- **DOC-001 §5.2** reserves the acts such a Decision authorizes to Governance alone.
- **⚠ The corpus is SILENT on the MOMENT of pinning.** Pinning at propose is REG-F-017's disposition, reasoned
  from ASR-15 plus a promotion-scoped analogy — **not from any corpus sentence about decisions**. Where the corpus
  speaks at contract level it points the *other* way: the only Decision payload shapes it defines are §22.1
  `ApproveDecisionPayload` (which carries `subjectSemanticVersions`) and §22.2 `DecisionEffectivePayload`.
  **`ProposeDecisionPayload` appears nowhere in either corpus** — a paired search with `ApproveDecisionPayload`
  as the positive control returns 0 and 1 respectively.

**This design does not reopen that.** REG-F-017 is CLOSED and its immutable-pin reading is fail-closed. It is
recorded because a future ratification could land the other way, and whoever reads this should know the repository
chose, rather than transcribed.

---

## 3 · Deriving the consumer set (the rule, not the number)

A gate census rooted at the field name **cannot be complete**, and REG-F-102 is the proof: `authorityBasis` was
invisible to a `subjectObjectIds`-rooted search *because the defect was the absence of that field*. The weakest
gate is invisible to a search shaped like the strong ones.

**Re-runnable rule — four selectors, all four required:**

1. `objectType !== 'DECISION'` / `DecisionObjectSchema.safeParse` — the §5.2 resolvers.
2. `aggregateType === 'DECISION'` — e.g. `floor-gate.ts:285`.
3. `listByType(h, 'DECISION')` / `listDecisions(…)` — catches queries **and** `apps/rph-demo/src/lib/server/floor.ts:261`.
4. **The event's aggregate is a Decision** — `case 'WaiverRequested'` / `'DecisionEffective'` folds; catches
   `packages/rph-projections/src/assurance-view.ts:302`. **This selector has no field-name and no type-name tell**;
   only the event-type switch reveals it.

Anyone re-running without (3) applied to `apps/` and (4) applied to the projections will under-count. **A second
root is also required** — searching what *establishes* authority (`status` / `objectType` / parse) rather than what
scopes it, which is the only way REG-F-102's class appears at all.

---

## 4 · The measurement that decides the shape

**A PWU's `semanticVersion` is set to 1 at creation and no command ever changes it.** Verified by hand:
`bumpSemanticVersion: true` occurs at exactly two sites — `decomposition.ts:486` and `intent.ts:297` — and
**neither is in `pwu.ts`**.

**Consequence, and it inverts the obvious reading.** The version conjuncts in `abandon-authorization.ts`,
`reject-authorization.ts` and `waiver-authorization.ts` are **inert on the ASR-15 staleness limb**, because their
subjects cannot version. The asymmetry is not *"three gates have a version check and skip does not"* — it is
**"only the promotion gate's version limb can ever fire"**, because only its subjects (INTENT,
DECOMPOSITION_CONTRACT, PWA) can version.

So a red-first arrangement for staleness — approve at v1, move the subject, then act — **is constructible only on
the promotion path**. Any roadmap step that promises a staleness test on the PWU acts is promising something the
engine cannot currently produce.

---

## 5 · The choice: derive per act, not a picker on `/decisions`

`decisionType` is single-valued and the gates demand mutually exclusive values, so **there is no single Decision
that satisfies them all**. A generic picker on `/decisions` would satisfy at most one product, by accident.

**The repository already derives scope correctly in three places** — `subjectVersions` (`governance.ts:210`),
`subjectObjectIds: [params.id]` (`pwa/[id]:553`), `[pwuId]` (`undertakings/[id]:933`). Every one of them sites the
authoring act **next to the object it is about**, where the subject is the route parameter and needs no picking.

**DECISION: site each authorization next to its object; do not build a subject picker on `/decisions`.**
It removes the choosing problem instead of solving it, it matches three working precedents, and it cannot mint a
scope for an object the user is not looking at.

**Two honest limits.** (a) Promotion legitimately names a **tuple** (`[pwuId, baselineId]`), so derivation is
per-act, not one shared helper. (b) `/decisions` still needs to stop *claiming* to author authorizations — see §7.

---

## 6 · How this ships green and worthless, and what catches each

**The write end is not the act end.** Measured: the demo dispatches **zero** `AbandonPwu`, `RejectPwu` or
`PromoteBaseline` — grep over `apps/rph-demo/src` and `apps/rph-demo/e2e` returns nothing outside comments — and
its one live `SkipExecutionStep` hardcodes `mandatory: false` (`undertakings/[id]:762`), **the exact flag that
switches skip authorization off**. So a subject picker can ship with every gate it feeds still unreachable:
REG-F-022's defect moved one position outward, which REG-F-077 itself predicted in as many words.

| # | Hollowness mode | What catches it |
|---|---|---|
| H-1 | Subjects written, no act dispatches them | An **e2e that performs the act**, not one that asserts a page rendered |
| H-2 | The act dispatches but the gate is escapable (`mandatory: false`) | A test driving the act with `mandatory: true` |
| H-3 | Subjects collected but dropped before the payload | Assert on the **stored** decision's `subjectObjectIds`, not the form |
| H-4 | Version pin present but vacuous | Only constructible on the promotion path — see §4 |
| H-5 | The picker offers types no gate accepts | Derive the offered set from the gates, not from a literal |

**One correction to that story, from the refutation:** it is five of six, not six of six. The floor-waiver path
**is** reachable from the demo today — `floorGateBlock` ← `pwaFloorGate` ← `PublishPwa` (`pwa/[id]:520`), with
three e2es driving it. That path is the working precedent §5 rests on.

---

## 7 · What this design does NOT decide

- **`decisionType` on `authorityBasis`.** REG-F-102 fixed the category error and deliberately left the type
  conjunct absent, because choosing one would settle **REG-F-076**, which is OPEN. Governance's call.
- **Whether `/decisions` keeps a propose form at all.** If authorizations are authored next to their objects, the
  route's remaining honest job is *listing and approving*. Its own header already says waivers are not proposable
  there; the same logic may apply to the rest. **Recommended but not decided here.**
- **`approve`'s `subjectSemanticVersions: {}`** (`decisions/+page.server.ts:85`). Benign today — REG-F-017 made the
  pin immutable and the disagreement predicate filters on `pinned[id] !== undefined`, so `{}` iterates zero times.
  **A reviewer fixing line 50 meets line 85 immediately**, so it is named here rather than discovered there.
- **The reported waiver-detail gap** (`resolveWaiverAuthorization` never reads `decision.waiver`;
  `grantWaiver`'s precondition is only type + `fromStates('PROPOSED')`). **Not verified by me, not filed.** Drive
  it before believing it.
