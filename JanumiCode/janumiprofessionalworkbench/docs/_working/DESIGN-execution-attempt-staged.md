# Execution Attempt record — staged design (#4 / §16 item 23)

> **Status: STAGED — blocked-and-disclosed, but the block is now NARROWER than the corpus notes say.**
> This is a *design*, not an implementation. It records the ratified target, the verified current state, what has
> since become unblocked, and the two decisions that remain before an Execution Attempt record can be constructed.
> It **supersedes** `DECISION-item23-attempt-record.md` (itself already marked SUPERSEDED — three of its four
> blockers were false) and **consolidates the execution-plane half** that Increment P deferred. It corrects one
> stale claim in `HARMONIZATION-LOG.md` (see §6). No code changes accompany it; the panel verdict was
> **DOCUMENT_STAGED**, and the two open decisions below are why.

---

## 1. The ratified target — DOC-009 §10.4

The Execution Attempt is **fully ratified as a storage shape** (correcting item-23 "blocker 1", which claimed the
field set existed in no ratified source). DOC-009 §10.4:

```sql
create table execution_attempts (
    id text primary key,
    execution_step_id text not null references execution_steps(id),
    attempt_number integer not null,
    state text not null,
    started_at timestamptz, completed_at timestamptz,
    runtime_binding_id text not null,
    idempotency_key text not null,
    external_operation_id text, reconciliation_state text,
    result jsonb, error jsonb, provenance jsonb not null,
    constraint uq_execution_attempt unique (execution_step_id, attempt_number),
    constraint uq_execution_idempotency unique (idempotency_key)
);
```

DOC-009 also ratifies `producing_execution_attempt_id` on the artifacts table (§18.1) — §9.7's "typed Artifact of
its producing Attempt" relation — which `ProvenanceRecord.producingExecutionAttemptId` and
`ExecutionProvenance.producingExecutionAttemptId` already generate a reference field for. DOC-002 §3.3 roots the
Attempt in the **Execution Aggregate** (aggregate root: Execution Plan). §5.4: the aggregate owns "steps,
attempts, results, retries, and tactic state."

---

## 2. Verified current state (code + vocab are authoritative here, NOT the log)

| Element | State | Evidence |
|---|---|---|
| `ExecutionProvenance` | **CONTRACTED** — `z.strictObject{ originType?, producingExecutionAttemptId?, executedBy?, evaluator? }` | `objects.ts:216-221` (generated from `m1-object-fields.json:2706-2734`) |
| Attempt id on the wire | Caller-supplied **free string**; carried on `CompleteExecutionStep` / `ExecutionProvenance` / `RecordArtifact` / `DetectAssumption` | `execution.ts:322`, `artifact.ts:48`, `assurance.ts:519` |
| Attempt id minting | Only the **seed** mints an id string (`mintId('ata')`); it constructs **no** record | `reference-undertaking.ts:525,604` |
| `EXECUTION_ATTEMPT` object type | **Does not exist** — not a `ProfessionalWorkObjectType`, so no object schema and no store row | `enums.ts:581-586` (lists `EXECUTION_PLAN`, `RUNTIME_BINDING`; no attempt, no step) |
| `execution_attempts` table | **Not built** — the SQLite schema has exactly five tables, none for attempts | `rph-persistence/src/schema.ts:7-67` |
| `StartExecutionStep` | Advances step → `RUNNING`; mints **nothing** (no attempt, no idempotency_key, no runtime_binding_id) — echoes an optional caller `runtimeBindingId` onto the event only | `execution.ts:273-297` |
| `CompleteExecutionStep` | Carries `executionProvenance` + `executionAttemptId`; **no** idempotencyKey. Passes **no** `mutateStep`, so this content lands **only in the event payload**, never on the step object | `execution.ts:301-390`, `:320-329` |
| Per-attempt `idempotency_key` | **No source.** The only `idempotencyKey` is the **command envelope's** dedup key (PK of `command_receipts`) — a *different* thing from §10.4's per-attempt key | `kit.ts:280-288`, `schema.ts:57-58` |
| Attempt-open `runtime_binding_id` binding | **None.** `RuntimeBinding` exists as its own object with a caller-supplied id (`requestRuntimeBinding`), created by its own command, not bound at attempt-open | `runtime-binding.ts:15,32` |
| Retry-cap counting (RPH-EXE-008) | **Not built** — "wired when attempt counting lands" | `execution.ts:402-403` |

---

## 3. What has become UNBLOCKED (the DECISION doc's four blockers, re-adjudicated)

1. **"Field set exists in no ratified source" → FALSE.** DOC-009 §10.4 defines the table in full (§1 above). Adjudicated in HARMONIZATION-LOG C2.
2. **"A competing, undefined `ExecutionProvenance` sits on the same payload" → RESOLVED.** `ExecutionProvenance`
   is now a contracted `z.strictObject` grounded in the ratified §7.1 `ProvenanceRecord` vocabulary, and — this
   matters — it carries `producingExecutionAttemptId` + `executedBy`/`evaluator` (`ActorReference`s) + `originType`,
   **not** raw provider/model strings and **not** `rawOutput`. So the §10.4 `provenance jsonb not null` column is
   now **sourceable losslessly** from an existing ratified shape, and the "second provenance shape one line from the
   ratified one" objection is gone. **This is the single biggest change since item 23 was written, and the log has
   not caught up (see §6).**
3. **"No write path, and creating one is item 6 territory" → still true, but item 6 is a recipe, not a wall.** The
   write path remains unbuilt (§2), but §16 item 6's safe default is *"extend the versioned registry and mappings"*
   — a construction spec. Building it is permitted; building it piecemeal and claiming premature support is not.
4. **"The Attempt's home does not exist on the plane that motivates it" → RESOLVED as a category error.** The
   material agent transformation this codebase runs today is **PWA authoring**, which has no Execution Plan and
   should not be given one to satisfy a draft sentence. Increment P (#10) settled it: an authored artifact
   legitimately carries **no** `producingExecutionAttemptId` (a producing invocation binds only for AI-generated
   *execution-plane* artifacts). **The Attempt is execution-plane only** — it is not a universal record of every
   model call.

**Net:** of the four original blockers, two are false, one is resolved, and the fourth is a scoping clarification.
What remains is not a research problem — it is two design decisions plus a bounded build.

---

## 4. The remaining design (what constructing the Attempt actually takes)

Building on the contracted `ExecutionProvenance`, an Execution Attempt record needs:

1. **A home for the record.** Either (a) a new `EXECUTION_ATTEMPT` `ProfessionalWorkObjectType` with a store row,
   or (b) a §10.4 `execution_attempts` **projection** rebuilt from the event stream. See §5 — this is Decision 1,
   and it is load-bearing.
2. **An attempt-open write path** that mints, at the moment a bounded model/agent invocation begins:
   - `attempt_number` — monotonic per `execution_step_id` (the `uq_execution_attempt` constraint), which is also
     what RPH-EXE-008 retry-cap counting reads;
   - `idempotency_key` — a **per-attempt** key (the `uq_execution_idempotency` constraint), distinct from the
     command envelope's dedup key, with **no current source** (§2);
   - `runtime_binding_id` — bound from an existing `RuntimeBinding` (`not null` in §10.4), with **no current
     attempt-open binding** (§2).
   The natural host is `StartExecutionStep`, which already advances the step and echoes an optional
   `runtimeBindingId` — extend it to *construct* the Attempt (mint `idempotency_key`, **require** and bind
   `runtime_binding_id`), or introduce a dedicated `StartExecutionAttempt` command. Either is a real contract
   addition (§16 item 6/23), not a rewrite.
3. **Attempt lifecycle + result.** `state`, `started_at`/`completed_at`, `reconciliation_state`,
   `external_operation_id`, `result`/`error` jsonb, and `provenance jsonb` — the last now serialized from the
   contracted `ExecutionProvenance`.
4. **Resolving `producingExecutionAttemptId`.** Today it is an unresolvable free string; once attempts are records,
   an artifact's `producingExecutionAttemptId` resolves against `execution_attempts(id)`, closing the
   §8.4/§9.7 "producing Attempt/invocation" binding on the execution plane.
5. **Retry-cap counting (RPH-EXE-008)** rides directly on `attempt_number`.

---

## 5. The two decisions that keep it STAGED (why DOCUMENT, not code, today)

**Decision 1 — Attempt as event-projection vs typed command-sourced object.** DOC-009 §10.4 defines a *table*
(storage), and §16 item 21 forbids a **competing Event authority** and a universal-stream record. An Execution
Attempt whose content (`executionProvenance`, `executionAttemptId`) is *already* on the emitted
`ExecutionStepSucceeded`/`…Started` events must not be re-authored as a second source of truth: that would
**double-record** the same content into `domain_events` **and** a new attempt store (the future hazard the
superseded decision doc named; today content is recorded **once**, in the event payload — §2). This argues for the
`execution_attempts` shape as a **rebuildable projection over the event stream**, not a new command-sourced object
— but that choice must be ratified, because it decides whether an Attempt is a first-class typed object (with a
`ProfessionalWorkObjectType`, a prefix Decision under §5.3 — the seed already uses `ata`, a live undecided prefix)
or a read-model. It cannot be smuggled in.

**Decision 2 — the attempt-open mint/bind contract.** `idempotency_key text not null` and
`runtime_binding_id text not null` must both be produced at attempt-open, and neither has a source today. This
needs a ratified extension — `StartExecutionStep` gaining attempt construction, or a new `StartExecutionAttempt`
command — that specifies *how* the per-attempt `idempotency_key` is derived (and how it differs from the envelope
key) and *which* `RuntimeBinding` is bound. Until that contract exists, any minted Attempt would carry a
fabricated key, which is exactly the "unconstructible record with a schema attached" failure item 23 exists to
prevent.

**A storage constraint informing Decision 1:** `professional_work_object_versions` keys `PRIMARY KEY (id,
revision)` and serializes the whole `currentState`. Embedding attempts in the Execution Plan's state would
re-copy every prior attempt into each new immutable revision — **O(N²) under a retry storm** — which further
favors an append-only projection/table over Plan-embedded state.

---

## 6. Harmonization finding — the log is STALE on ExecutionProvenance

`HARMONIZATION-LOG.md` still describes `ExecutionProvenance` as *"a `FORCE_PLACEHOLDER` `z.record(string,
unknown)`"* (L3188) and *"undefined ExecutionProvenance"* (L3757, L3762) — its last word on the type, carried into
Increment P's #4 disposition. But the shape **has since been contracted** (`objects.ts:216-221`; vocab notes
`m1:2714`, `m3:4403` "now a CONTRACTED shape … AUTHORED under §0.3"; handler comment `execution.ts:318`). The
contracting landed in vocab + code but was **never recorded in the log**. Increment Y records this correction, so
the #4 disposition is no longer read against a stale premise: the `provenance jsonb` prerequisite is **done**, and
the residual block is Decisions 1 and 2 above — not "undefined ExecutionProvenance."

---

## 7. The un-stage gate

The Execution Attempt record becomes a bounded build (no longer research) once **both** are ratified:

1. **Decision 1** — Attempt as rebuildable §10.4 projection vs typed object (+ its §5.3 prefix Decision).
2. **Decision 2** — the attempt-open mint/bind contract (`StartExecutionStep` extension or `StartExecutionAttempt`):
   how `idempotency_key` is derived and which `RuntimeBinding` binds.

Prerequisite **already met:** `ExecutionProvenance` is contracted, so `provenance jsonb` is sourceable losslessly,
and the `rawOutput`-is-chain-of-thought hazard (§9.7) is **structurally avoided** — the contracted shape carries
`executedBy`/`evaluator` `ActorReference`s and `producingExecutionAttemptId`, never raw inline reasoning.
