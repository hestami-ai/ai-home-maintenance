# §16 item 23 — the Execution Attempt record

> ## ⚠️ SUPERSEDED 2026-07-15 by `HARMONIZATION-LOG.md`. Three of its four blockers are FALSE.
>
> This file is retained because §9.4 keeps history and because the *manner* of its wrongness is the finding.
> Do not act on it. Corrections, in descending importance:
>
> - **Blocker 1 (*"the field set exists in no ratified source"*) is FALSE.** I searched RPH-DOC-007 and never
>   opened **RPH-DOC-009**, the rank-9 storage authority, which defines `create table execution_attempts (…)`
>   in full at its §10.4 — id, step, attempt_number, state, timings, runtime_binding_id, idempotency_key,
>   external_operation_id, reconciliation_state, result, error, `provenance jsonb not null`, plus both unique
>   constraints. DOC-009 also already carries `producing_execution_attempt_id` / `security_classification` /
>   `retention_class` on artifacts — §9.7's *"typed Artifact of its producing Attempt"* relation, ratified.
> - **"The floor's independence requirement is NOT REPRESENTABLE" is FALSE** — this was the headline I gave the
>   sponsor. `ActorReference` (`envelopes.ts:22-31`) carries `roleId`, `modelId`, `providerId`,
>   `executionInstanceId`: all four §8.4 L851 axes. `RuntimeBinding` (`objects.ts:498-510`, from DOC-009 §10.5)
>   carries `roleId`, `modelSelectionPolicy`, `contextAssemblyPolicyId`. What is actually wrong is narrow:
>   `IndependenceRequirement` is a single-valued enum where L851 wants a conjunction, and `rph-assurance`'s
>   hand-rolled `Identity` re-invented `ActorReference` and dropped `roleId`. **§8.4 L869 was invoked in error.**
> - **Blocker 3 (*"no write path, and creating one is item 6 territory"*) is FALSE as stated.** Item 6's safe
>   default is a recipe — *"Extend the versioned registry and mappings"* — not a prohibition. So is item 23's:
>   *"Evolve policy registry, schemas, persistence, projections, fixtures, and conformance tests **together**
>   before claiming support."* I read a construction spec as a wall.
> - **Blocker 4 survives, but I created it.** DOC-002 §3.3 roots the Attempt in the Execution Aggregate, and
>   PWA authoring has no Execution Plan. The rule that forces authoring to *be* an Attempt is a sentence **I
>   wrote** in `991c510` ten hours before citing it as an obstacle. The over-reach is mine; see the log's C5.
> - **The document's own authority claim is wrong.** This guide is not RPH-DOC-000 (§16 item 1: *"This guide is
>   itself proposed"*; §17 L2538 binds RPH-DOC-000 to the Vocabulary Charter).
>
> **What stands:** the `rawOutput`-is-chain-of-thought hazard (below) — still a real trap for any future
> Attempt design; item 14's staleness; and the `art`-prefix disclosure.

**Status: SUPERSEDED — reached the right caution on a false premise.**
Produced 2026-07-15 by a verified workflow (draft + four adversarial lenses: invention / structural-crux / deadlock / hollowness). All four returned REWORK on the draft; 13 blocking findings. Related: `PROPOSED-EDITS-recording-and-cot.md`, commits `991c510`, `2acbd86`, `5ff86c9`, `942b0a9`.

---

## The decision

§9.7 as amended requires every bounded model call — including every retry, reformat, and repair — to become its own **Execution Attempt** with its own record, and volunteered reasoning to be redacted, retained against that Attempt, and purged at expiry. Neither is representable in the accepted contracts. Both §9.7 clauses end by instructing us to block the capability and bring item 23 to you. This is that.

**Do not ratify a shape today.** What is asked instead: leave both clauses **blocked and disclosed**, accept the fixes that need no ratification (landed in `942b0a9`), and answer the three questions below.

---

## Why it cannot be ratified — four independent blockers

**1. The field set exists in no ratified source.** RPH-DOC-007 — the serialized-boundary authority — contains exactly five occurrences of the Attempt: a prefix-table row and four id references. **No interface. No field list.** Compare its sibling: `m1-object-fields.json`'s ExecutionStep entry cites `DOC-002 §21` *and* `DOC-007 §15`. A proposed ExecutionAttempt can cite neither. Any field set would be **authored from guide prose, not confirmed** — which item 23 exists to prevent.

**2. A competing, undefined contract sits on the same payload.** `CompleteExecutionStepPayload` already carries `executionProvenance: ExecutionProvenance`, and `ValidatorResult` carries it again. The vocab's own note: *"NOT field-defined; distinct from ProvenanceRecord (§7.1). Source TBD."* The code has degraded it to `z.unknown()` (`messages.ts:106`). §10.1: *"These are information requirements, not permission to add tables, fields, objects, or Events. Use existing DOC-007/009 records and relations only where lossless."* Designing an Attempt that carries resolved-model provenance **without first settling ExecutionProvenance** mints a second provenance shape one line from the ratified-by-name one.

**3. There is no write path, and creating one is item 6 territory.** `CompleteExecutionStepPayloadSchema` is a `z.strictObject`; no field carries an Attempt record. `completeExecutionStep` passes no `mutateStep`, so `advanceStep`'s only mutation is `stepState`. Nothing in the accepted registry can insert into a step. Ratifying a schema therefore yields either (a) an Attempt as unconstructible as today, now with a schema attached — **this codebase's standing failure at greater cost** — or (b) content on a Command payload, which `execution.ts:167–172` mirrors into the permanent `domain_events` table in the same commit.

**4. The Attempt's home does not exist on the plane that motivates it.** §5.4: *"**Execution Aggregate**, rooted at an Execution Plan: steps, attempts, results, retries, and tactic state."* The material agent transformation this codebase actually runs is **PWA authoring**, which has no Execution Plan — `pi-agent.ts` has zero `ExecutionPlan` references. Either authoring calls are Attempts without a Plan (contradicting §5.4), or §8.4's *"producing Attempt/invocation"* binds a different record there. **No ratified text decides this.** Item 23 names it: *"producing-Attempt/context and protected-transition binding"*.

---

## The bullet we dodged

The draft proposed an Attempt field holding `rawOutput` — output *before* coercion — stored inline and permanently. For any reason-then-answer model (§9.7 names *"raw inline reasoning from a local or open-weight model"*), **`rawOutput` IS volunteered chain-of-thought.** §9.7 requires it purgeable and span-separated, and says *block* where separation is not lossless. The draft would have written the prohibited artifact into immutable storage and defended it as "retained whole". It also banned the `extensions` bag for leaking into projections, then exempted its own field from the same argument.

That is the bug we spent 2026-07-15 removing, promoted to a ratified contract.

---

## Item 14 does NOT block this — and item 14 is factually stale

Item 14 says *"no canonicalization algorithm exists"*. One does: `packages/rph-contracts/src/hash.ts:86-87` — a prefixed, JCS-aligned `contentHash`, in production use at `kit.ts:220`. And §10.1 scopes hashing to *"immutable, content-hashed Artifact/Evidence/Baseline content"*; an Attempt is none of the three.

**Reported as drift per §17, not requested as a change.** Do not close item 14 by association — its cross-aggregate-promotion half is untouched and nobody examined it.

---

## The floor's independence requirement is NOT REPRESENTABLE

Found while executing the recommendation, and it refutes it.

**§8.4 L851, verbatim:** *"prohibit same-invocation self-review and use **at least a distinct evaluator invocation, role, and review context** whose actual identities and lineage are recorded; the same base model is allowed **only when the active profile permits** its visible common-mode limitation, while stricter profiles may require a different model/provider or human/organizational independence"*

That is **four mandatory dimensions, conjunctively**: distinct invocation, distinct role, distinct review context, and — since no profile mechanism exists to permit sameness — a different base model.

The contract expresses **one**: `IndependenceRequirement` is single-valued. `Identity` has **no `role` field at all**.

- **§8.4 L867:** *"A planner may optimize optional controls but cannot weaken mandatory applicability or independence."* → picking a different single axis is a **weakening**, not a fix. (An earlier recommendation to switch `DIFFERENT_MODEL` → `DIFFERENT_INVOCATION` was exactly this, and was wrong.)
- **§8.4 L869 governs:** *"If even that floor cannot be represented and enforced losslessly, the PWA cannot be published and the protected runtime transition cannot proceed until the contract is corrected."*
- **Item 23 withholds "conjunctive independence" by name.**

So this is blocked and disclosed. It is not resolved by choosing a different axis, and not by a local guard in `composeAssuranceOutcome` — a hardcoded branch enforcing a rule **no policy declares** is the registry displaying one rule while a constant decides, which is the exact failure this project keeps rediscovering.

---

## What landed instead (`942b0a9`) — needed no ratification

**The judge model is pinned or the review refuses.** `AGY_MODEL_LABEL = JUDGE_MODEL ?? 'agy:default'` resolved at module load, and the Validator recorded that as the evaluator's `modelId`. Unset by default → agy chose its own model, never reported it, and the recorded evaluator identity was the literal `'agy:default'` — a placeholder standing where an identity belongs. `judgeModel()` now throws when unpinned; `--model` is always passed, so the model that judged is the model recorded. Authority: §8.4 (*"actual identities and lineage are recorded"*), §14.6 (*"allowed and resolved"*), §13.3 (*"Fail closed on missing identity…"*). Mutation-proven.

---

## Reported, not fixed — each needs an answer, none is a local edit

**`executionAttemptId: z.string()` accepts `""`** on a required field of a permanent Event. But this is **systemic, not local**: 162 id fields in `vocab/m3-commands-events.json` are bare `"string"`, with the prefix rule living in an unenforced `note` (`"id-ref (attempt_ prefix)"`). Tightening one of 162 is arbitrary, and `RphIdSchema` would reject ids used across the fixtures. Either `id-ref` becomes a real vocab type, or the note is documentation pretending to be a contract.

**`executionProvenance: z.unknown()`** — blocker 2. Cannot be fixed without Q2.

**The `art` prefix** is a live §5.3 violation but a *disclosed* one: `ids.ts` generates `ARTIFACT: 'art'` while §5.3 says prefixes *"require a Decision before schemas reject or generate them."* `ids.ts:8-9` flags it; the M0 sheet logged it and asked. **Nobody answered.** The failure is an absent decision loop, not a rogue mint.

---

## The questions

**Q1 — Where does a Decision live?** *(Answered by the sponsor, 2026-07-15: ADRs are a category error — they are an artifact a specific SDLC PWA would have, not an RPH concept. §0.1 confirms it: "ratified repository Architecture Decisions" sits at rank **12 of 15**, under "Orientation", below the whole RPH-DOC corpus. Item 23 is a rank-1/rank-7 question. The mechanism already exists and was used at `991c510`: **amend the authority document and the vocab that generates the code, and commit.** No new furniture. This file is a working note, not the authority.)*

**Q2 — The two prerequisites nobody can design the Attempt without.**
1. Is `ExecutionProvenance` — named on `CompleteExecutionStep` and `ValidatorResult`, undefined in both docs, `z.unknown()` in code — the ratified home for an Attempt's resolved-actor/provenance content? §10.1 permits existing records *"only where lossless"*, so no Attempt can be designed until this is answered.
2. Does §9.7's Attempt reach the **authoring plane** at all, given §5.4 roots attempts in an Execution Plan the authoring path does not have? Either authoring runs get an Execution Plan (materially larger than anyone has priced) or §8.4's *"producing Attempt/invocation"* binds a different record there.

**Q3 — The floor is unrepresentable (above). Which?**
1. **Correct the contract** so independence can be conjunctive and `role` exists — this is item 23 territory and larger than it sounds.
2. **Accept §8.4 L869 on its terms**: publication blocks until corrected. Honest, and cheap while JPWB is development-stage with no production data.
3. Something else you decide.

---

## Cost, if you ever authorize the Attempt

Baseline: `AUTHORING_CONVERSATION` (`a1dcd6e`) — 2 fields, 1 Command, 1 Event, no gate, no projection contract, no redaction, no purge = **41 files, 761 insertions**.

The Attempt is **≥2–4× that and honestly unsized**, because it is not one change: ExecutionProvenance must be designed first; a write path must be created (item 6); the authoring-plane rooting must be settled; §14.2/P12 conformance is mandatory and requires proving *"review for version/Attempt `n/a` cannot satisfy `n+1/b`"* — unexpressible until Attempt `a` has a representation.

**A storage consequence worth knowing:** `professional_work_object_versions` keys `PRIMARY KEY (id, revision)` and the adapter serializes whole `currentState`. Attempts embedded in Plan state mean every attempt re-copies every prior attempt into a new immutable row — **O(N²) under a retry storm.**

**The body store is unsized and will not be estimated here.** It depends on ARTIFACT's fields (`m1-object-fields.json` refuses to design them by design), on `ArtifactReference`'s undefined shape, and on a purgeable store whose obvious forms §5.6 forbids **by name**. Estimating it would require choosing the shape — the one thing item 23 exists to prevent.
