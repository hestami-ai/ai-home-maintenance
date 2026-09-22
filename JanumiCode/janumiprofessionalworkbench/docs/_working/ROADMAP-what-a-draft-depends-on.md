# ROADMAP — `JAN-CRITREAD` `DD`: what a draft depends on

**Design:** `DESIGN-what-a-draft-depends-on.md` (revision 3, `ddb8d2dc`) · **Ratified:** `REG-D-070` (sponsor,
2026-09-22) · **Defect:** `REG-F-430` · **Date:** 2026-09-22

⭑ **Exit:** the whole-log limb refuses only on declared groups; every dependency is declared, and undeclared reads on
the named file set are caught by gates; PR-2 refuses naming G1, PR-2a commits, W3 is refused naming G4; every refusal
names what changed; the fork is captured in one read transaction at a store-issued position; every outermost write
takes the lock up front; manual edits to a PWA with an open draft are refused at one choke point; the assistant is
shown only active policies; `gate:fast` green except `REG-D-067`'s accepted set, which must not grow.

⚠ **Every increment's gate run** compares its failing e2e set AND each failure's location with the previous run's:
same thirteen, same lines, or the increment stops and the difference is explained before anything is committed.

⛔ **Not in this roadmap (ruled order, `REG-D-070` Q2):** `REG-F-433`'s join key → dropping G4 → `REG-F-431`'s drain
fix. `REG-F-431` must not be fixed while G4 stands.

---

## `DD-0` — a ledger status for a guard abolished by ruling

The ledger reports `RETIRED` only when `supersededBy` names a successor proving the same guard
(`scripts/mutants/run.ts:202-211`; `verif/mutant-ledger.test.ts:82`). `DD-3` abolishes guards with no successor
(the exact-tail length term; a DUPLICATE's earlier events). The instrument needs a status for that before any entry
uses it.

- `DeclaredMutant` gains `abolishedBy?: string` — the ruling (a `REG-` id) and the reason. The runner reports
  `ABOLISHED`, decided before anything is applied, like `RETIRED`; it is never a failure and never counted as a kill.
- `verif/mutant-ledger.test.ts`: `abolishedBy` must cite an existing `REG-D-` entry; it may not be combined with
  `supersededBy`, `expectSurvive` or `duplicateOf`.

| Instrument | Must show first |
|---|---|
| a fixture entry with `abolishedBy` citing a non-existent ruling | RED in the ledger test |
| **CONTROL** | every existing entry's verdict unchanged |

---

## `DD-1` — the store: a real position, a consistent fork, the lock taken up front

- **Port** (`rph-ports/src/ports/storage.ts`): `highWaterMark(): number` (the store-issued commit sequence);
  `eventsAfter(mark: number): DomainEvent[]`; `readTransaction<T>(fn: () => T): T`. The contract text states
  §5.3's premises: writes serializable against every other writer; the sequence commit-ordered.
- **Driver** (`sql-driver.ts`): the outermost `transaction()` runs `BEGIN IMMEDIATE`; a new `readTransaction()`
  runs a deferred one; `busy_timeout` set explicitly.
- **SQLite adapter**: `highWaterMark` = `MAX(global_sequence)`; `eventsAfter` = `WHERE global_sequence > ?`.
- **Overlay**: captured inside `source.readTransaction`, recording the source's high-water mark as its **base mark**
  (a distinct accessor, not the overlay's own synthetic count); `eventsAfter`/`highWaterMark` over its own staged log.
- **Engine**: the handle exposes the base mark of a fork.
- **Every other `StorageAdapter`** (test doubles included) implements the three methods.
- **Floor**: the canonical exchange drain retries a busy write a bounded number of times before reporting the shortfall.

| Instrument | Must show first |
|---|---|
| **Two processes** (worker threads over one SQLite file, each its own id space): B's deferred transaction reads, A commits, B writes | ⭐ on HEAD: `SQLITE_BUSY_SNAPSHOT` thrown out of B — **RED**; after: B waits and succeeds |
| the same, B being a type birth through `withPwaVersionBump` and an exchange drain | RED on HEAD |
| `highWaterMark`/`eventsAfter` on both adapters, as a conformance table with "returns nothing" and "returns everything" stubs as each other's controls | compile-red on HEAD |
| the overlay's base mark equals the source's mark at capture, and stays fixed when the source grows | new |
| **CONTROL** | the whole suite and the e2e set unchanged |

⚠ `guards:export`: each new package export gets a guard (a mutant crediting it) or the census is regenerated with the
reason stated.

---

## `DD-2` — the bus: declared groups, alongside today's form

`dispatchBatchGuarded`'s event-log argument gains a third form, `{ mark, admittedEventIds, groups }`. Still first and
inside the same transaction: read `eventsAfter(mark)`, skip admitted events **by id**, load each remaining event's
aggregate and match it against the groups with a pure function in `rph-application` (`{ field, equals | contains |
oneOf }` over string ids); **collect every** violation (group name, aggregate, first event: type, actor,
correlation); an event whose aggregate cannot be loaded, or whose loaded type differs from the event's, is a
violation (fail closed). A store that cannot be locked in time → `RPH_STORE_BUSY`. The two existing forms are
unchanged in this increment.

| Instrument | Must show first |
|---|---|
| G-B1 a non-admitted tail event on a group member refuses and is named | new |
| G-B2 a non-admitted tail event on a NON-member commits | new — the discrimination control |
| G-B3 two violations → both named | new |
| G-B4 an admitted event on a member is skipped **by id** (an equal-count foreign event is not) | new |
| G-B5 an unloadable aggregate → refused (fail closed) | new |
| mutants: each key operator; the admitted-skip by identity; collect-all → first-only; fail-closed → treat as non-member | each KILLED by its own test, one victim each |
| **CONTROL** | B1–B5 unchanged and green |

---

## `DD-3` — the turn: the declared dependencies

`commitAuthoringTurn` switches to the groups form and the §5.1 pins; the exact-tail form is deleted from the bus.

- **Pins:** `P`; the three floor policies; the policies the replay will validate (the ordered union of each recorded
  command's newly-referenced ids against its own prior state); the validator id of each recorded completion as an
  absence pin; the write set at its base revision (captured when the draft first touches an aggregate).
- **Groups:** G1 `AUTHORING_CONVERSATION pwaId=P`; G2 `PWU_TYPE pwaId=P`; G3 `ASSURANCE_ASSESSMENT subjectObjectIds∋P
  ∧ assurancePolicyId∈floor`; G4 `MODEL_EXCHANGE subjectObjectId=P` (kept, `REG-D-070` Q2).
- **Retired:** the all-policies pin (`authoring-turn.ts:146-150`).
- **Disclosure:** every violation with its role; `COMMIT_FAILED` for a replay refusal while every declared dependency
  held, worded as a gap in the rule.
- **Recorder:** refuses to record a command under a principal other than the turn's; reads may still re-bind.
- **Idempotency:** the conversation append's key becomes turn-scoped (`workbench.ts:362-364`).
- **Ledger** (per `DESIGN` §5.8, G4 kept): B4 + TT-M3 ~~and W2 + TT-M9~~ `abolishedBy: REG-D-070`; TT-M1, TT-M1b,
  TT-M2 re-anchored; TT-M4, M6, M8, M10, M11 stay live and are re-run. ⚠ **W2 + TT-M9 stay live, W2 re-aimed —
  `REG-F-438`** (a DUPLICATE of another writer's act AFTER the fork is in the tail).

⭑ **BUILT IN TWO PARTS (2026-09-22).** **DD-3b** — the pins, the groups, the disclosure, the gap classification, the
exact-tail form deleted, the ledger — and **DD-3c** — the recorder's principal rule, the turn-scoped conversation key,
the `RPH_STORE_BUSY` arrow — each gated and committed on its own.

| Test | Asserts | on HEAD |
|---|---|---|
| **PR-2 by group** | `CONFLICTED`, naming G1 and the conversation event | ⭐ RED (detail is `@event-log…`) — the old assertion replaced, never loosened |
| **PR-2a** | commits | ⭐ RED (`CONFLICTED`) |
| **an unrelated policy edited mid-turn** | commits | RED ~~(all-policies pin)~~ — **observed: refused by the whole-log limb, which runs first; the pin would have refused it too** |
| **a type born for `P` without the bump** | `CONFLICTED`, naming G2 | green on HEAD via the limb; the naming is new |
| **another turn's floor record for `P`** | `CONFLICTED`, naming G3 | same |
| **W3** | `CONFLICTED`, naming G4 | green on HEAD; re-asserted by name |
| **a replayed-policy change** (a draft removes and re-adds a declared policy; the policy is suspended concurrently) | `CONFLICTED`, naming the policy | RED — the per-command derivation's own case |
| **foreign-principal write** | the recorder refuses; a read re-bind still works (the page loader) | new |
| **CONTROL** | PR-1 family, PR-3, W1, W4, `floor-recording.test.ts` | green before and after |

---

## `DD-4` — the refusal: one choke point

- A small `open-drafts` module holds which PWAs have an open draft; `authoring-turn.ts` writes it, `workbench.ts`
  reads it (no import cycle).
- `workbench.ts`'s `dispatch`, `dispatchBatch` and `dispatchMultiPartyBatch` call one check, synchronously with the
  dispatch, that derives each command's owning PWA (PWA commands → target; `DefinePwuType` and
  `AppendConversationEntries` → payload `pwaId`; type edits/removals → the canonical type's `pwaId`) and refuses a
  write to a PWA with an open draft, naming the draft. A draft holds it from start until commit or discard.
- The page stops offering the manual editors while an agent run is live (`+page.svelte:103`).
- `newPolicyVersion` skips PWAs with an open draft and reports them; `recordWaiver` is refused while a draft is open.

| Instrument | Must show first |
|---|---|
| a manual `defineType` while a turn on `P` is open | RED on HEAD (accepted) → refused, naming the draft |
| a `test-api/dispatch` write to `P` while open | RED on HEAD → refused |
| a write to another PWA while `P`'s draft is open | accepted — the control |
| a discard releases it; a commit releases it | new |
| `newPolicyVersion` with `P` open | `P` skipped and reported; other PWAs migrated |
| mutants: the check removed; owner derivation wrong for type edits | KILLED |
| ⚠ **e2e** | before building, list every spec that edits a PWA while a candidate is staged; each is either a true case of the refusal (re-asserted) or evidence the refusal is too broad (stop and report) |

---

## `DD-5` — the assistant sees only active policies (`REG-D-070` Q3)

**First, before any code:** confirm that a draft never needs to reference a non-active policy — trace the broker's
`createPolicy` → reference path and the handler's newly-referenced status check. ⛔ If a draft can legitimately
reference a non-active policy (for example one it created itself in the same draft), **stop and put it back to the
sponsor** with the finding; do not widen the ruling.

- `list_assurance_policies` (the agent tool) and the broker's listing return only `ACTIVE` policies, plus any the draft
  itself created if the first step shows that is needed and the sponsor agrees.

| Instrument | Must show first |
|---|---|
| a suspended policy is not offered to the agent | RED on HEAD |
| **CONTROL** | the agent-authoring e2e specs unchanged |

---

## `DD-6` — the gates for dependencies nobody declared

- **Scan-site census** over the named file set (the turn, `workbench.ts`'s broker and conversation paths,
  `lib/server/agent/**`, `floor.ts`, `assurance/**`, `packages/rph-authoring`, and the handlers of the command types a
  turn records): every list or scan call is classified as a declared group, display-only or advisory; a new call site
  reddens until classified. Its scope and its limits are stated in the test's header.
- **Key-field immutability census** over every conjunct field of G1–G4; **event-per-state-change census** (every
  committed state change carries an event on its own aggregate).
- **Direct by-id containment**: a scan-context flag in `listByType` and the handler scans, so a scan's loads are not
  counted; a conformance test over the turn scenarios asserts each direct by-id load is pinned, grouped or advisory.

| Instrument | Must show first |
|---|---|
| each gate's control mutant (an undeclared read added; a key field rewritten after birth; a state change without an event) | RED |
| a scan's own loads are NOT counted as direct reads | a mutant removing the flag reddens the containment test |

⭑ **BUILT IN TWO PARTS (2026-09-22).** **DD-6a** — the scan-site census, the key-field premise and the
event-per-state-change premise, the last two measured across the WHOLE suite by wrapping `commit` (the seam
`emitted-event-guard.ts` already uses), each with its control mutant. **DD-6b** — the direct by-id containment gate
(the scan-context flag in `listByType` and the handler scans, and the conformance test over the turn scenarios),
which needs load instrumentation of its own and is its own increment.

⚠ **A MEASUREMENT IS NOT YET A GUARD.** `DD6-M2` SURVIVED its first aim: the key-field premise was measured over
every commit in the suite, and nothing in the suite ever tried to rewrite a key field, so the mutant changed no
observable outcome. The case was added to the premise test (an append naming ANOTHER PWA) and the mutant then died
there. A property under no attack is measured, not guarded.

---

## `DD-7` — the records

- `REG-F-430`: **CLOSED**, struck at the head, with the measured evidence (the reds observed first, the mutant
  verdicts, PR-2a committing).
- `REG-F-434`: *"what closes the gap is the whole-log counter"* struck to G1.
- `REG-D-069` and `REG-D-070`: statuses to the delivered build.
- `apps/rph-demo/AUTHORING-BACKBONE.md:269-271`: the "safe false conflict" limit pointed at the ratified rule.
- `DESIGN-the-turn-that-refuses-itself.md` §2 and §5.3: struck to the new mechanism, with a pointer.
- The ruled next sequence (`REG-F-433` → drop G4 → `REG-F-431`) recorded where the next programme will find it.
