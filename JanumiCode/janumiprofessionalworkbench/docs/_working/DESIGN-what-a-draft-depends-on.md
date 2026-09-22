# DESIGN — what a draft depends on: replacing the whole-log commit check with a dependency rule

**Programme:** `JAN-CRITREAD` · **Date:** 2026-09-22 · **Status:** DRAFT, revision 3 — for the sponsor's rulings in
§7.3 before any code is built.
**Ruling:** `REG-D-069` (sponsor, 2026-09-22) · **Defect:** `REG-F-430` · **Related:** `REG-F-425`, `REG-F-431`,
`REG-F-433`, `REG-F-434`, `REG-F-046`, `REG-D-025`, `REG-D-041`, `REG-D-067`, `REG-D-068`

---

## 0. How this was decided

1. **The ruling.** Three options for `REG-F-430` were put to the sponsor in plain terms: exempt reviewer records
   from the check, keep the strict check, or the proper fix — *work out what each draft actually depends on and
   refuse only when that changes*. The sponsor chose the proper fix (`REG-D-069`), requiring that the check's real
   jobs be kept and that the rule's exact scope come back for ratification.
2. **The map.** Five read-only readers traced, against the current tree, every read a draft makes on its fork,
   every read the commit's replay makes, every other canonical writer, what canon says, and what the engine can
   check cheaply (§2–§3).
3. **The panel.** Three designs from different angles — (A) declared dependency *groups* checked against the log
   tail, (B) *designing the absences out* with store-enforced identity keys, (C) a *recorded read-set* — each
   attacked by its own adversarial critic. All three: SOUND_WITH_REPAIRS, none FATAL.
4. **Revision 1** took B as the core. A three-lens review (concurrency, canon and records, code claims) found B's
   decisive advantage did not hold and two parts of the ratification package were wrong (§4).
5. **Revision 2** took A as the core. A second review — an attack on the new core and a verifier of every
   disposition — found **no interleaving producing a silent stale commit under SQLite, in one process or two**, and
   ten further SERIOUS findings about premises, buildability and the honesty of the ratification package.
6. **This revision** resolves those. Across the three rounds there were **86 findings** (2 BLOCKER, 36 SERIOUS,
   48 MINOR). **§8 lists every BLOCKER and SERIOUS finding with its disposition**, and groups the MINORs by theme.

---

## 1. In plain language (for the sponsor)

**Today** an AI-authored draft is refused at acceptance if *anything at all* was written to the shared record
while it was being worked on — another professional's work on a different PWA, a decision, a baseline, an
execution step. The draft is then lost. That is `REG-F-430`, and it reaches every writer in the app.

**After this design**, the acceptance check still looks at everything saved since the draft started, but a save
only counts if it touches something **the draft actually uses**:

- the draft's PWA; the PWA's types, including a new one appearing; the PWA's conversation, including a first one
  appearing; the PWA's review records under the three review policies;
- the three review policies, and any policy the draft newly uses;
- anything the draft itself writes.

Everything else is ignored: other PWAs, decisions, baselines, undertakings, policies the draft does not use. A
refusal says **what changed**, instead of today's "@event-log changed".

**Two honest limits:**

- If the final save step itself fails although nothing the draft uses changed, the draft is still lost — as today —
  and that is reported as a defect in this rule, to be fixed, never as a conflict.
- The design also stops the page offering manual edits to a PWA while an agent draft on it is open, because such an
  edit silently destroys the draft. That protection works **within one server process**; if the app ever runs
  several processes, an edit in another one still makes the draft be refused at acceptance — never saved stale —
  until a lasting lock is built.

**What you will be asked (§7.3):** the rule itself; whether a *thrown-away* earlier draft's late reviewer note
should still block the next draft on the same PWA; how to treat policies the assistant was *shown but did not use*;
refusing manual edits while a draft is open; and what form the concurrency-rule clarification takes.

---

## 2. The defect, and how far it reaches

The authoring turn stages a candidate on a point-in-time fork and commits it by replaying its commands on canonical
in one transaction (`packages/rph-application/src/command-bus.ts`, `dispatchBatchGuardedAs`), guarded by (1) the
**whole-log limb** — the canonical log may have grown past the fork only by the turn's own witnessed reviewer
records (`TT-1`, `TT-2`); (2) per-aggregate revision preconditions; (3) replay; (4) content-hash postconditions.

The limb trips on **every canonical writer in the app**: another PWA's turn and the execution drains, Library
create/delete (`routes/+page.server.ts:29`, `:45`), Decisions (`decisions/+page.server.ts:75`, `:123`, `:147`,
`:167`), Baselines (`baselines/+page.server.ts:98-219`), Undertakings create (`undertakings/+page.server.ts:67-138`),
every Undertaking Workbench action, and the test-mode `test-api/dispatch` route. A `CONFLICTED` turn's only exit is
`DISCARD` (`authoring-turn-machine.ts:43`).

⚠ Removing the limb alone would not remove the false conflict: the revision vector pins *every* assurance policy
(`authoring-turn.ts:147-150`), though the draft reads only the three floor policies and the ones it newly
references.

---

## 3. What a draft actually depends on (the map)

### 3.1 The reads, classified

| Read | Kind | Guarded today by | Notes |
|---|---|---|---|
| the PWA `P` | by id | revision pin (`authoring-turn.ts:138-140`); replay DRAFT guards; postcondition | — |
| `P`'s live PWU types (`listPwuTypes`) | **set** | pins of types present at the fork; a NEW type only via the PWA bump (`withPwaVersionBump`, `pwa-authoring.ts:201-222`, used at `:559`, `:819`, `:903`) | the bump is recorded as violating AGG-1 (`REG-F-046`, OPEN) |
| the three floor policies | by id | pinned (all-policies) | the verdict is computed on the fork, never re-judged at replay |
| policies a recorded command **newly** references | by id | pinned (all-policies) | the replay decides "newly" per command, against that command's prior state (`pwa-authoring.ts:424`, `:471-477`) |
| every other policy | **shown only** (`list_assurance_policies`) | pinned (over-broad) | the draft cannot reference a policy absent at the fork |
| `P`'s conversation (`getConversation`) | **absence** when none exists | an EXISTING one pinned (`:151-155`); an ABSENT one **only by the limb** | the phantom, driven by `authoring-turn.test.ts:229-271` |
| waiver decisions (`hasEffectiveWaiver`) | set | not pinned | display-only on the turn path (`REG-F-066`) |
| the validator entry `validatorResult.validatorId` | by id (replay, `assurance.ts:2388-2394`) | replay | on the authoring path the id is a dotted plan name (`agy.reasoning-review`, `record-assurance.ts:198`), never a registry id, so the lookup finds nothing |
| idempotency receipts of recorded commands | absence (replay) | replay (REJECTED / DUPLICATE) | the conversation append uses a process-global key that resets on restart (`workbench.ts:362-364`) |

### 3.2 The three jobs, re-examined

- **(a) The conversation phantom** is an *absence* read on the fork. The handler enforces no one-per-PWA rule
  (`pwa-authoring.ts:71-94`).
- **(b) The floor-record shadow is not a read the draft makes; it is a WRITE into a key a reader ranks.** Readers
  rank a subject's assessments per policy by `updatedAt` (`assessment-index.ts:58-82`; a duplicate walk at
  `floor.ts:497-512`), which is the floor run's host-clock time (`floor.ts:408`). Turn T2 floors version *v* of `P`
  and commits; turn T1, which edited `P` to *v+1* and floored it *earlier* by the clock, commits after. The reader
  picks T2's record, finds its version stale, and the publish gate **fails closed** although a SATISFIED floor of
  the current version exists. The limb prevents this today by refusing T1. Two concurrent turns on one PWA are
  impossible in one process (`turnsByPwa`), so this is a multi-process case (`AX-10`). ⚠ The same fail-closed
  result also happens **with no concurrency at all** when two hosts' clocks disagree (T2 commits *before* T1 forks);
  neither the limb nor this design catches that, and it belongs to the reader (§10).
- **(c) The latent PWU_TYPE writer** is a *set* read resting on the PWA bump.

### 3.3 What canon and the corpus already say

- **PER-4** (`DOC-003:349-351`) governs updates to material state and delegates to contract which command types are
  exempt ("pure creations"), so a concurrent *birth* is outside it (§7.3 Q5). **PER-6**: professional correctness
  never depends on in-memory state.
- **ASR-12** is the only ratified read-dependency rule. **AX-10** forbids a correctness property that holds only in
  one process and defers technology to the repository. **AGG-1** forbids a broad transaction simulating workflow
  atomicity.
- **SPEC-001 FORK-22** requires `expectedRevision`, the conflict surfaced with the engine's code and message, no
  automatic retry, and JCUX §50's items for a stale projection. **FORK-23** requires `dispatchBatchGuarded` wherever
  a vector was captured.
- **`DESIGN-coordination-and-read-dependencies.md` §1–§2** state the general obligation and its gap — a HANDLER
  cannot declare a read dependency; only a host can, through `dispatchBatchGuarded` — and `ROADMAP-coordination.md`
  schedules the general remedy as `C-5`. **This design is a host-side instance for the authoring turn and does not
  close `C-5`'s handler gap.**
- **`DESIGN-trust-boundary.md` §3** lists four infrastructure races. This design discharges two for the paths it
  touches — the deferred `BEGIN` under WAL (§5.3) and the missing explicit `busy_timeout` (§5.3) — and leaves the
  idempotency-key primary-key `SqliteError` owed.

---

## 4. The options, and why A is the core

| | Thesis | Panel verdict | Outcome of review |
|---|---|---|---|
| **A** groups | declare a few keyed groups; the commit refuses if an event saved since the fork touches a member of one, other than the turn's own | SOUND_WITH_REPAIRS | **the core** |
| **B** keys | every dependency is a point: an id at a revision, or a store-enforced identity key held or unclaimed | SOUND_WITH_REPAIRS | its decisive advantage failed review |
| **C** read-set | record every read on the fork and re-ask each at commit | SOUND_WITH_REPAIRS | its set checks need a database-wide write lock; recording is coarse because every set read scans the whole log |

**Why not B.** B was chosen in revision 1 because *"a unique key is enforced by the store whatever the transaction
mode"*. That is true of a key **claim** — a draft that itself creates the key — but not of the key **pins** B relied
on ("`P`'s next type slot is unclaimed", "`P`'s conversation key is unclaimed"), which are absence reads needing a
serializable write transaction exactly as A's groups do. For the **draft**, B does what A does: it refuses at
acceptance. B's keys add integrity for *other* writers — no second conversation for a PWA from any writer — at the
cost of a schema migration the migration ladder's own rules do not allow as written, a trigger, a backfill of legacy
duplicates and key state in the fork overlay. That improvement is real and **filed separately** (§10).

**What A reuses.** `TT-1` already reads the log tail after the fork inside the guarded transaction, and `TT-2`'s
witness already names the turn's own events. A narrows "the tail must be exactly the turn's own events" to "no other
tail event may touch a declared group" — **no schema change and no reader change**.

---

## 5. The design

### 5.1 The declared dependencies

A draft `D` on PWA `P`, forked at store position `W` (§5.3), declares:

**By-id pins** — each checked at its revision at `W`, or its absence:

1. `P`.
2. The three floor policies.
3. **The policies the replay will validate**: the ordered union, over the recorded commands, of the ids each command
   newly references against **its own prior state** — exactly what the replay re-validates. *(Revision 2 said
   "relative to the target's base state"; a draft that removes and re-adds a declared policy would then have left a
   replay-validated policy unpinned.)*
4. The validator id of each recorded `CompleteAssuranceAssessment`, as an **absence** pin — on the authoring path it
   names nothing in the store, and the rule should say so rather than leave a replay read undeclared.
5. **The write set** — every aggregate a recorded command targets or `D`'s staged events touch, at its **base**
   revision (captured when the draft first touches it) or absent. *(Replaces the `mustNotExist` derivation keyed on
   the old vector, `authoring-turn.ts:495-511`.)*

The all-policies pin is retired (`:146-150`).

**Groups** — an aggregate type and a key over fields that never change after birth; a member is any aggregate of
that type whose key fields match:

| Group | Type | Key | Job |
|---|---|---|---|
| **G1** | `AUTHORING_CONVERSATION` | `pwaId = P` | (a) — and edits to an existing conversation |
| **G2** | `PWU_TYPE` | `pwaId = P` | (c) — any birth, edit or removal of `P`'s types, **not resting on the bump** |
| **G3** | `ASSURANCE_ASSESSMENT` | `subjectObjectIds ∋ P` **and** `assurancePolicyId` ∈ the floor policies | (b) — for the in-window case; the clock-skew case is §10 |
| **G4** | `MODEL_EXCHANGE` | `subjectObjectId = P` | *only if the sponsor keeps W3 (§7.3 Q2)* |

**A group is violated** iff the store holds an event after `W` on a member that is **not one of `D`'s own acts** (the
witness's admitted events, matched by id). An event whose aggregate **cannot be loaded, or whose loaded type differs
from the event's**, is treated as a violation — fail closed — and named.

**Premises for the groups**, each gated (§5.5): every key field of every group (`pwaId`, `subjectObjectIds`,
`assurancePolicyId`, `subjectObjectId`) is written only at birth — verified today (`pwa-authoring.ts:85`, `:516`;
`EditPwuType` never writes `pwaId`; `assurance.ts:1418-1421` sets the assessment's, `:1817` only echoes them; an
exchange is born terminal); and **every committed state change carries an event on its own aggregate** (the kit
does; the adapter does not enforce it — `REG-F-046`).

### 5.2 The mechanism

- **The bus.** `dispatchBatchGuarded`'s third argument grows from `{ position, admittedEventIds }` to
  `{ position, admittedEventIds, groups }`, each group `{ name, aggregateType, key }` with `key` a conjunction of
  `{ field, equals }` / `{ field, contains }` / `{ field, oneOf }` over string ids. Still **first, inside the same
  transaction**, the bus reads **only the tail** (a new port read, §5.3), skips admitted events by id, loads each
  remaining event's aggregate, matches it with a pure function in `rph-application` (no import of `rph-engine`'s
  queries), and **collects every** violation. A bare number keeps today's meaning.
- **The turn.** `commitAuthoringTurn` passes G1–G3 (G4 if ruled) and the §5.1 pins.
- **Principal.** The turn's recorder **refuses to record a command under a principal other than the turn's** while
  still allowing a handle to be re-bound for reading (which the PWA page loader does). The replay's single principal
  is then correct by construction. *(Revision 2 said "record per command and replay under each"; review showed that
  needs a guarded multi-party replay and credential retention that do not exist.)*

### 5.3 Transactions and position

- **Position is a store-issued, commit-ordered, gap-free sequence**, not an event count. The fork records the
  store's high-water mark (SQLite: `MAX(global_sequence)` — `INTEGER PRIMARY KEY AUTOINCREMENT` under one writer,
  `schema.ts:91`), and the tail read is `global_sequence > W`. *(Today's `position` is an array index into
  `readAllEvents()`, `authoring-turn.ts:157`, `command-bus.ts:646`; under an MVCC store a sequence taken before
  commit can be seen out of order, so a count could hide an event — review, SERIOUS.)* This is part of the **port
  contract**, and `SERIALIZABLE` alone does not supply it.
- **The write lock is taken at the outermost write transaction, in the driver** (`sql-driver.ts:47`:
  `db.transaction(fn)()` → `.immediate()`; a nested call already becomes a savepoint), so `withPwaVersionBump`
  (`pwa-authoring.ts:209`), the multi-party batch (`command-bus.ts:579`) and the guarded batch each take the lock
  before their transaction's first read. Reads a handler makes **before** its transaction opens, and a single
  dispatch that opens no outer transaction, are outside this — they stay covered by the per-command revision check
  and the guarded batch's own checks.
- **A read-mode primitive** is added to the port and driver (a deferred read transaction), and **the fork is captured
  in it** — events, objects, the high-water mark — correcting `snapshot-overlay-storage-adapter.ts:31-37`, which
  builds its "point-in-time" base from separate autocommit reads. The capture does not take the write lock.
- **Lock hold is bounded:** the guarded commit reads only the tail, not the whole log; `busy_timeout` is set
  explicitly (`sql-driver.ts:39` sets none; better-sqlite3's default applies); and the canonical exchange drain
  **retries a busy write** a bounded number of times before reporting the shortfall, so a long commit in another
  process cannot turn into a lost PER-9 record.
- **Port contract (repository-level, not canon):** a write-mode transaction is serializable against every other
  writer, and the store issues the §5.3 sequence. A future MVCC adapter must provide both.

### 5.4 Classification and disclosure

- **A violated pin or group → `CONFLICTED`**, code `RPH_REVISION_CONFLICT`, exit `DISCARD` (PER-4: reload and
  re-form). The disclosure lists **every** violation with its role ("your PWA", "a type of your PWA", "your PWA's
  conversation", "your PWA's review record under policy RR", …), the aggregate, and the first event after `W` that
  touched it (type, actor, correlation) — going past FORK-22's minimum, and replacing the pseudo-aggregate
  `@event-log`.
- **A replay refusal or divergence while every declared dependency held → `COMMIT_FAILED`**, disclosed as *"the
  save step refused X although nothing this draft declares changed"*. The draft is lost, as today; this is a gap in
  the rule, loud and fileable. *(Differential replay was considered to classify these; it has no mechanism in the
  current engine — §10.)*
- **No automatic retry.** If the write lock is not acquired within `busy_timeout` — nothing read or written — the
  refusal carries an engine-authored code (`RPH_STORE_BUSY`) and the draft returns to `READY_TO_COMMIT` through a
  new, narrowly-typed machine arrow; the professional accepts again, which re-runs every check. Any other failure
  keeps today's route to `COMMIT_FAILED`.

### 5.5 The guard for dependencies nobody declared

The limb caught an undeclared dependency for free; narrowing it removes that net. It is replaced by **gates**:

- **Static scan-site census.** Every list or scan call in a named file set — the turn (`authoring-turn.ts`,
  `workbench.ts`'s broker and conversation paths), the agent tools (`lib/server/agent/**`), the floor
  (`floor.ts`, `assurance/**`), the broker (`packages/rph-authoring`) and the handlers of the command types a turn
  records — is recorded in a table and classified as a declared group, display-only, or advisory-only. A new call site
  in that set reddens `gate:fast` until classified.
- **Direct by-id containment.** Loads are recorded **at the query layer**, distinguishing a direct `loadObject` from a
  load made while enumerating a scan (a scan-context flag in `listByType` and the handler scans). A conformance test
  over the turn scenarios asserts every *direct* by-id load is pinned, in a group, or listed advisory. *(Revision 2
  recorded at the storage layer, where a scan's loads and a direct load are indistinguishable — the same defect that
  sank revision 1's recorder.)*
- **Key-field immutability census** over every conjunct field of every group.
- **Each gate carries a control mutant** that must redden it.
- **Stated limits:** the gates cover the named file set and the enumerated scenarios. Reads outside the fork adapter —
  the canonical witness, the artifact store, event payloads read without `loadObject` — are not recorded.

### 5.6 The interleaving the product itself offers

While an agent run is live the page renders the manual editors (`+page.svelte:103`), which write to canonical, while
the page shows the fork (`+page.server.ts:91`) — so a mid-run manual edit is invisible and later destroys the draft.

- **One choke point.** Every page action and `test-api/dispatch` reach canonical through `workbench.ts`'s
  `dispatch`, `dispatchBatch` and `dispatchMultiPartyBatch`. Those three call a single check that derives each
  command's owning PWA (the target for PWA commands; the payload's `pwaId` for a type birth and a conversation append;
  the canonical type's `pwaId` for a type edit or removal) and refuses, with a governed message naming the staged
  candidate, a write to a PWA with an open draft. The registry of open drafts lives in a small module both
  `authoring-turn.ts` and `workbench.ts` import, so no import cycle is created. The check runs **inside the dispatch
  helper, synchronously with the dispatch**, so a turn beginning during the action's `await request.formData()` cannot
  slip past it. The page stops offering the editors while running.
- **Which drafts hold it:** a turn from its start until it is committed or discarded — including `CONFLICTED` and
  `COMMIT_FAILED`, whose only exit is `DISCARD`, so the professional releases it by discarding. A process restart
  releases it, because turns are in-memory.
- **`newPolicyVersion`** migrates DRAFT types referencing a policy across **every** PWA
  (`routes/pwa/[id]/+page.server.ts:436-448`). *Recommended (Q4):* it **skips** a PWA with an open draft and says so
  in its result, rather than refusing the whole action — refusing would let one professional's draft block another's
  action on a different PWA, which is the interference `REG-D-069` removes.
- **`recordWaiver`** renders from the fork's floor but acts on the canonical floor (`+page.server.ts:713`); while a draft
  on the PWA is open it is refused.
- **Not refused, disclosed:** editing or suspending a *floor* policy or a policy the draft references, from any page.
  Those are true dependencies; refusing them would block policy governance workspace-wide whenever any draft is open.
  The draft is refused at acceptance, naming the policy.
- ⚠ **PER-6, AX-10 and the tiers (`REG-D-041`).** The registry is in-memory and per process. That is compatible with
  PER-6 because **correctness does not depend on it**: the acceptance check is the durable guarantee — no draft is ever
  saved stale. The refusal only protects work from being lost. With several processes (the SaaS and Enterprise tiers),
  an edit in one still makes a draft in another be refused at acceptance. A **durable per-PWA lease** is the
  design-out; it is owed (§10).

### 5.7 Behaviour

| Case | Today | After |
|---|---|---|
| **PR-2** — concurrent first conversation | `CONFLICTED`, `@event-log changed…` | `CONFLICTED`, naming G1 and the conversation event; the detail assertion replaced with an equally strong one |
| **PR-2a** — another PWA's reviewed turn | `CONFLICTED` | **commits** (`REG-D-069`) |
| **W3** — a discarded predecessor's late reviewer record on the same PWA | refuses the successor | per **Q2** |
| unrelated policy edited | `CONFLICTED` | commits |
| a type born for `P` without the bump | `CONFLICTED` (limb) | `CONFLICTED`, naming G2 |
| another turn's floor record for `P` (two processes) | `CONFLICTED` (limb) | `CONFLICTED`, naming G3 |
| manual edit to `P` while its draft is open (same process) | accepted; the draft later destroyed | refused, naming the draft |
| conversation append idempotency key | process-global counter | turn-scoped |

### 5.8 What happens to the `TT` work, and a ledger rule this needs

The witness (`TT-2`) admits only `MODEL_EXCHANGE` events (W1 pins that it refuses every other command), and none of
G1–G3 can contain one. So **the witness's admission matters only through G4**, and its fate follows Q2:

| | Q2 = keep G4 (recommended now) | when G4 is dropped |
|---|---|---|
| witness admission; W4; TT-M6, M8, M10, M11 | live — each still has a failure it catches | dead — removed with their tests, listed |
| W1, TT-M7 (the witness writes exchange records only) | live | live — a capability boundary, independent of G4 |
| TT-M4 (the type exemption's shape) | live — killed by W3 | abolished by ruling |
| PR-1, PR-1r, PR-1p, PR-1s, PR-3 | live | PR-1p and PR-1s lose their point (own tries no longer matter) and are re-aimed or removed, listed |
| TT-M5 (drain on the fork) | live | live (PER-9) |

`TT-1`'s bus rule changes meaning: B1 and B2 carry over; **B3 and TT-M2 stay** — the new rule still skips admitted
events *by identity*; **B4 and TT-M3 (the length term) and W2 and TT-M9 (a DUPLICATE's earlier events are not
admitted)** guard properties the new rule removes — with no length term, admitting an event that is not in the tail
changes nothing — so they become vacuous. B5 (a bare number) is unchanged. TT-M1 and TT-M1b are re-anchored.

**A ledger rule is needed.** The runner reports `RETIRED` only when `supersededBy` names a successor mutant proving
the same guard (`scripts/mutants/run.ts:202-211`; `verif/mutant-ledger.test.ts:82` checks the successor exists).
Several guards here are **abolished by ruling** and have no successor. The ledger has no status for that. This design
adds one — a field naming the ruling that abolished the guard, reported distinctly from `RETIRED` and `SURVIVED` — as a
repository change to the instrument, made in the roadmap's first increment. No assertion is weakened to pass:
every changed test is either re-asserted as strongly in its new direction or removed with the ruling that removes its
property named.

---

## 6. What changes, where

| Layer | Change |
|---|---|
| `rph-ports` | a read-mode transaction primitive; a tail read (`eventsAfter(position)`); the store high-water mark; the §5.3 port contract |
| `rph-persistence` `sql-driver.ts` | outermost write transaction `BEGIN IMMEDIATE`; a deferred read transaction; explicit `busy_timeout` |
| `rph-persistence` overlay | fork captured in one read transaction with the high-water mark; base revision captured when an aggregate is first touched |
| `rph-application` `command-bus.ts` | the event-log argument gains `groups`; tail-only read; collect-all violations with role and first event; fail-closed on unloadable aggregates; a pure group matcher; `RPH_STORE_BUSY` |
| `rph-engine` `queries.ts` | a scan-context flag for the containment gate |
| `apps/rph-demo` `authoring-turn.ts` | the §5.1 pins and groups; all-policies pin retired; §5.4 disclosure; recorder refuses a foreign-principal write |
| `apps/rph-demo` `authoring-turn-machine.ts` | `COMMITTING → READY_TO_COMMIT` for `RPH_STORE_BUSY` only |
| `apps/rph-demo` `workbench.ts` + a small open-drafts module | the one-choke-point refusal; turn-scoped idempotency key for the conversation append |
| `apps/rph-demo` routes | editors hidden while running; `newPolicyVersion` skips PWAs with an open draft; `recordWaiver` refused while a draft is open |
| `apps/rph-demo` `floor.ts` | the canonical exchange drain retries a busy write, bounded |
| `scripts/mutants` + `verif/` | the abolished-by-ruling ledger field; scan-site census; key-field census; direct by-id containment; each with a control mutant |
| records | `REG-F-430` closed with evidence; `REG-F-434`'s "what closes the gap is the whole-log counter" struck to G1; `REG-F-431`'s "why it is not fixed here" struck **only if and when G4 is dropped**; `AUTHORING-BACKBONE.md:269-271` pointed at the ratified rule |

---

## 7. For ratification

### 7.1 The rule (plain)

> A staged draft is refused at acceptance only if something it depends on changed since it was started. It depends
> on: its PWA; that PWA's types, including a new one; its conversation, including a first one; its review records
> under the three review policies; those policies and any policy it newly uses; and everything it writes. Nothing else
> can refuse it. A refusal names each thing that changed and what changed it. If the final save step fails although
> nothing it depends on changed, the draft is lost, and that is reported as a defect in this rule, not as a conflict.

### 7.2 The rule (precise)

1. **What a draft depends on.** (a) Every aggregate its candidate-shaping code or its replay reads **by id, other than
   as a member of a scan**; (b) every **keyed set whose membership or absence** its candidate-shaping code read on the
   fork (G1, G2); (c) every **keyed set a canonical reader ranks in an order-sensitive way and the draft's commit writes
   into** (G3); (d) everything it writes.
2. **What it does not depend on — excluded by ruling, not derived:** a catalog entry it was shown but did not reference
   (per Q3); a change behind a refusal shown to the agent on the fork; display-only reads (decisions and waivers;
   reviewer records, unless Q2 keeps G4); commutative whole-set folds (observation sets).
3. **Premises, and where each is enforced:** a group's key fields never change after birth — a census gate; every
   committed state change carries an event on its own aggregate — a census gate; every command a draft records carries
   an idempotency key unique to its turn, and is recorded under the turn's principal — the turn's code. The write
   transaction's serializability and the store's commit sequence are a repository port contract (§5.3), not part of
   this rule.
4. **The commit** checks every pin and group, collecting every violation, then replays, then checks the postconditions,
   in one transaction holding the write lock. Classification per §5.4. No automatic retry.

**Disclosed cost for the tiers (`REG-D-041`):** the port contract binds the SaaS and Enterprise store to serializable
write transactions (or explicit locks) and a commit-ordered sequence, and every writer's outermost transaction takes
the write lock up front.

### 7.3 Questions for the sponsor

- **Q1 — Ratify the rule of §7.1–§7.2.**

- **Q2 — Should a *thrown-away* earlier draft's late reviewer note still block the next draft on the same PWA (W3)?**
  It does today. When you ruled on `REG-D-069`, this behaviour was put to you as a *flaw of the exemption* (the
  exemption would have let such a note through), so the design does not change it without your ruling. The note is not
  something the draft uses. Its only harm: the page's reviewer-answer reader pairs answers to reviews by PWA alone
  (`REG-F-433`), so it could show that stale answer beside the new draft's review.
  - **Today** the block almost never fires: a discard during a review currently *loses* the review's tries
    (`REG-F-431`), so no late note reaches the record.
  - **Once `REG-F-431` is fixed**, every discard during a review produces late notes, and with the block kept, each one
    refuses the next draft on that PWA — routinely, not rarely.
  - *Recommended:* **keep the block now; fix `REG-F-433`'s pairing; then drop the block; fix `REG-F-431` only after
    that.** In that order the block never becomes routine.

- **Q3 — Policies the assistant was shown but did not use.** Example: the assistant is shown a *suspended* policy, so it
  creates a near-duplicate instead; meanwhile someone re-activates the original. PER-4 says the system never silently
  proceeds on stale business assumptions, and the duplicate is arguably one. Three options:
  - **(a) Not a dependency** — the draft commits with the duplicate. No false conflict.
  - **(b) Depend on the *status* of every policy shown** — refuses exactly this case; any status change to any policy
    the assistant listed (usually all of them) refuses every open draft that listed policies.
  - **(c) Show the assistant only active policies** — it can then never have chosen around a suspended one, and a
    policy that becomes active later is like a policy created later: not something it chose against.
  - *Recommended: (c)*, subject to confirming in the roadmap that a draft never needs to reference a non-active policy.

- **Q4 — Refuse manual edits to a PWA while an agent draft on it is open (§5.6)?** *Recommended: yes*, with
  `newPolicyVersion` **skipping** (not refusing) PWAs with an open draft and `recordWaiver` refused while a draft is
  open. Costs: a professional cannot hand-edit a PWA while its agent draft is open (discard or accept it first); a
  policy-version migration leaves a PWA with an open draft on the old version until migrated again; within one process
  only, until a durable lease exists.

- **Q5 — What form the concurrency clarification takes.** PER-4 (`DOC-003:349`) governs updates to material state and
  lets contract exempt "pure creations". Three options:
  - **(a) None needed** — PER-4 concerns a command's own update; nothing in it forbids a guarded *batch* from also
    refusing when a declared group changed. The rule of §7.2 is then repository design, recorded in the register.
  - **(b) A contract Decision** scoped to "a staged multi-command candidate committed through a guarded batch" —
    vehicle: a register DECISION entry and the batch's contract text. ⚠ Doubtful: `REG-D-004` gives contract *shapes* to
    the repository, but *when something is a conflict* is meaning, which it gives to canon.
  - **(c) A canon clarification of PER-4** — vehicle: a canon amendment (the §0.3 blockquote convention) plus a register
    entry. A canon-wide rule would put every other creator of a group member in divergence the day it is ratified,
    because a single dispatch cannot honour it; so it must be scoped to guarded batches.
  - *Recommended: (a)*, with the rule recorded as a register DECISION so it is ratified without claiming to extend
    canon; (c) scoped to guarded batches if you read PER-4 as covering it.

---

## 8. Findings of the three rounds, and where each went

Rounds: **P** = the panel's three critics (9 SERIOUS, 16 MINOR); **R2** = the review of revision 1 (2 BLOCKER,
17 SERIOUS, 18 MINOR); **R3** = the review of revision 2 (10 SERIOUS, 14 MINOR).

### 8.1 Every BLOCKER and SERIOUS finding

| # | Round | Finding | Disposition |
|---|---|---|---|
| 1 | R2 BLOCKER | save-order currency reaches four callers of `latestAssessmentByPolicy` and collides with ASR-10 | withdrawn: no reader change; job (b) is G3 in the guard; the reader is §10 |
| 2 | R2 BLOCKER | W3 inverted "by ruling" when no ruling covers it | §7.3 Q2 |
| 3 | R2 | ledger `RETIRED` needs a successor; the list was incomplete | §5.8 — per-mutant table; a new abolished-by-ruling field |
| 4 | R2 | `REG-F-220` miscited; the in-memory registry conflicts with PER-6 | §5.6 — correctness does not depend on it; PER-6, AX-10, tiers stated |
| 5 | R2 | Q1's argument omitted ASR-10 | moot with #1 |
| 6 | R2 | Q3's example contradicts "the criterion generates the list" | §7.2.2 — exclusions are rulings |
| 7 | R2 | "no dependency-vector rule was drafted" was a noun search | §3.3 — `C-5` acknowledged, and that this design does not close it |
| 8 | R2 | isolation level written into ratified text | §5.3, §7.2.3 — a repository port contract |
| 9 | R2 | `BEGIN IMMEDIATE` placed on a nested `commit` | §5.3 — the driver's outermost write transaction |
| 10 | R2 | B's key pins are absence reads needing the lock | §4 — the core moved to A |
| 11 | R2 | differential replay has no mechanism and misclassifies | §5.4 — dropped; §10 |
| 12 | R2 | ranking by the concluding event undefined for in-progress assessments | moot with #1 |
| 13 | R2 | `newPolicyVersion` writes a PWA's types from any page | §5.6 — skipped for PWAs with an open draft (Q4) |
| 14 | R2 | test-mode `mintUiId` is a per-module counter; two workers mint the same ids | §9 — each worker gets its own id space |
| 15 | R2 | storage-layer read recording cannot be green | §5.5 — query-layer recording with a scan-context flag |
| 16 | R2 | premises said to be store-enforced when most are not | §7.2.3 — each premise with where it is enforced |
| 17 | R2 | reader blast radius understated | moot with #1 |
| 18 | R2 | refusing principal re-binding breaks the page loader | §5.2 — refuse a foreign-principal *write* only |
| 19 | R2 | retirement plan incomplete | §5.8 |
| 20 | R3 | the witness's admission matters only through G4 | §5.8 — the table branches on Q2 |
| 21 | R3 | Q2 omitted the `REG-F-431` coupling | §7.3 Q2 — both today's and the fixed product's cost; recommended ordering; §6 strike conditional |
| 22 | R3 | Q4 hid three costs (cross-PWA blocking, PER-6/AX-10, liveness) | §5.6, §7.3 Q4 — skip not refuse; PER-6 argued; release defined; `recordWaiver` included |
| 23 | R3 | Q3 argued unfairly | §7.3 Q3 — three options with their costs; PER-4 engaged |
| 24 | R3 | the plain rule promised more than §5.4 delivers | §1, §7.1 — the save-step failure stated |
| 25 | R3 | "every finding dispositioned" was false | §0, §8 — all 38 listed; MINORs grouped |
| 26 | R3 | the refusal's location unspecified; `test-api` missed; import cycle | §5.6 — one choke point; owner derivation; a shared module |
| 27 | R3 | position is an event count, unsound under MVCC | §5.3 — a store-issued commit sequence, in the port contract |
| 28 | R3 | by-id containment had revision 1's defect | §5.5 — query layer, scan-context flag |
| 29 | R3 | lock hold grows with the log; a second-process drain times out | §5.3 — tail read, explicit `busy_timeout`, bounded retry of the drain |
| 30 | P (A) | ratification list not generated by its criterion | §7.2.1–§7.2.2 |
| 31 | P (A) | canon-wide doctrine honoured by one call site | §7.3 Q5 |
| 32 | P (A) | deleting the limb removes the undeclared-dependency net | §5.5 |
| 33 | P (A) | deferred `BEGIN` loses a second process's writes | §5.3 |
| 34 | P (C) | the property put to the sponsor was overstated | §7.2.2, Q3 |
| 35 | P (C) | set checks sound only under a database-wide writer lock | §5.3 port contract |
| 36 | P (B) | keys bypassable by a direct `store.commit` | moot — keys are §10 |
| 37 | P (B) | an old binary open during migration births an unkeyed conversation | moot — keys are §10 |
| 38 | P (B) | manual edits offered during a live run | §5.6 |

### 8.2 The MINOR findings, by theme

The 48 MINOR findings are grouped by what they concern; each theme's resolution is in the section named. *(The
grouping is by reading, not a verified per-finding count, so no per-theme numbers are given.)*

- **Citations and wording:** corrected in place — FORK-22 not overstated; the ledger citation
  (`run.ts:202-211`); `C-5`'s nature; 15 seeded type ids, not 16; stale line numbers in the older design.
- **Transactions:** read-mode primitive for the fork; "before its first read" restricted to the
  transaction's own reads; `busy_timeout` explicit; `RPH_STORE_BUSY` engine-coded; the store-busy machine arrow.
- **The rule's edges:** pin 3 derived per command; the validator absence pin; fail closed on an
  unloadable aggregate; every group conjunct in the census; the event-per-state-change premise; G3's clock-skew limit.
- **The refusal:** the check synchronous with the dispatch; the release rule; policy edits
  disclosed, not refused.
- **Instruments and costs:** the gates' file set and limits stated; §11 softened; worker clocks
  fixed in the two-process G3 test; the tier cost disclosed; the migration-ladder and trigger constraints recorded with
  the keys in §10.

---

## 9. Instruments — each with the red it must show first

- **PR-2 by group**: on HEAD the detail is `@event-log…`; the new assertion (G1 and the conversation event) is RED first.
- **PR-2a commits**: RED on HEAD.
- **W3** per Q2; kept → re-asserted naming G4.
- **An unrelated policy edited mid-turn commits**: RED on HEAD (all-policies pin).
- **G2 without the bump**, **G3** from another turn (two processes, **worker clocks fixed so T1's floor is strictly
  earlier than T2's**, asserted as the precondition): each `CONFLICTED`, naming its group.
- **Each group** with a mutant dropping it, KILLED by its own test; the matcher with a mutant per key operator; the
  fail-closed path with a mutant treating an unloadable aggregate as "not a member".
- **Disclosure**: two simultaneous violations → both named.
- **Refusal**: a manual `defineType` and a `test-api/dispatch` write while a turn on `P` is open → refused naming the
  candidate; `newPolicyVersion` → `P` skipped and reported; a discard releases it.
- **Gates**: scan-site census, key-field census, direct by-id containment — each with a control mutant, and one showing
  a scan's own loads are *not* counted.
- **Two processes** (worker threads over one SQLite file, **each with its own id space**): a concurrent first
  conversation, type birth and floor record are each refused; a second-process writer during a guarded commit on a
  **large log** waits and succeeds, including a type birth through `withPwaVersionBump` and an exchange drain.
- **Unchanged and green**: `floor-recording.test.ts`, the `TT` tests §5.8 keeps, and the e2e accepted set (`REG-D-067`),
  which must not grow.

---

## 10. Filed separately, not in scope

- **One conversation per PWA is not enforced for writers outside a turn**, and a PWA's type set has no structural guard
  beyond the bump. B's store-enforced identity keys are the recorded remedy candidate, with the review's costs: the
  migration ladder's rules (additive `ALTER` only) do not allow a new table and backfill as written; a trigger; a
  backfill of legacy duplicates; key state in the overlay.
- **The assessment reader ranks by host clock and ignores version** (`assessment-index.ts`, and the duplicate walk at
  `floor.ts:497-512`): its production callers, the in-progress-masks rule and ASR-10 make it its own design. It is also
  where the clock-skew shadow (§3.2 b) is fixed.
- **Differential replay** as a classifier, if a sibling overlay over the same captured base is ever built.
- A durable per-PWA lease (§5.6); `REG-F-433`'s join key and `REG-F-431`'s drain ordering (sequenced by Q2);
  `REG-F-046`'s AGG-1 remedy (independent now: G2 does not rest on the bump); `C-5`'s handler-reachable declaration; the
  idempotency-key primary-key race of `DESIGN-trust-boundary.md` §3.

## 11. Exit

The whole-log limb refuses only on declared groups; every dependency is declared, and undeclared reads on the named
file set and enumerated scenarios are caught by gates; PR-2 refuses naming G1, PR-2a commits, W3 behaves as ruled;
every refusal names what changed; the fork is captured consistently and the commit holds the write lock for a bounded
time; `gate:fast` green except `REG-D-067`'s accepted set, which must not grow — after the sponsor has ruled on §7.3.
