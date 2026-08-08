# ROADMAP — Coordination programme (C-0 … C-5)

Implements `DESIGN-coordination-and-read-dependencies.md`. Each increment is separately
acceptable and separately gated. **Full gate** for every one: `check-types` · `lint` · `boundary` ·
`bunx vitest run` · `test:dist` · `apps/rph-demo bun run check` · `bunx playwright test`.

**Standing rule for this programme, from REG-F-063:** a control derived from the same artifact as
the defect will agree with it. Every increment below states the artifact its check reads and the
artifact the thing being checked is written in. **If they are the same file, the check is
decorative.**

---

## C-0 — The arrow × command control

**The finding it generalises (REG-F-063):** `Harness.status` declares nine states and fifteen arrows;
`registry.ts` has one Harness command, writing `FRAMING`. Zero arrows are traversable. The existing
`state-reachability.test.ts` reports zero stranded because it walks the machine's **own declared
arrows** — it reads the same artifact the defect is written in.

**The question this control asks instead:** *for every declared arrow, is there a registered command
whose handler can perform it?*

### Why it is derivable today, and cheaply

- **26 machines** are declared in `packages/rph-domain/src/transitions.data.ts` (keys of the form
  `Object.field`), each with `states`, `initialState`, `terminalStates`, `transitions[{from,to,trigger}]`.
- **Handlers declare their transition as DATA.** The `advanceStatus` spec carries
  `machine: 'Evidence.status'`, `target: 'ADMISSIBLE'`, and `precondition: fromStates('PROPOSED')`.
  `fromStates` is not a closure — `command-precondition.ts:67` returns
  `{ kind: 'FROM_STATES', states }`. So a command's arrow set is exactly `states × target`.
- There are **23** such declarations across the handler files against **26** machines, so some
  machines have no handler declaring them at all. That gap is the first thing the control will print.

### Extraction: static, and it must FAIL LOUD

The spec objects are built inside handler bodies, so they are not enumerable without either executing
every command or reading the source. **Read the source**, with the discipline
`verif/route-action-census.test.ts` already uses: the extractor **throws on any shape it does not
recognise** rather than skipping it. A skipped handler is an arrow silently reported unreachable, and
a census that quietly narrows its own population is the failure this repository keeps finding.

**Direction of error, stated because it decides whether the control is safe:** a transition performed
by a handler that does NOT use `advanceStatus` (a direct state write) is invisible to the extractor
and its arrow is reported unreachable. That is a **false positive** — noisy, not dangerous. The
dangerous direction — reporting an arrow traversable when no command can perform it — is
unreachable by construction, because traversability is only ever asserted from an explicit
declaration. Say this in the control's header so a later reader does not "fix" it the wrong way.

### Output contract

Not a count. **A list**, because `10 stranded` is a number a future edit can make smaller without
making anything better:

```
MACHINE                        ARROW                              COMMAND
Harness.status                 FRAMING -> PLANNING                — NONE —
Harness.status                 COORDINATING -> WAITING            — NONE —
…
```

Two ratchets, both blocking, mirroring the mutation ledger's discipline:
- **`ARROWS_WITHOUT_COMMAND`** — must not grow. Seeded at the measured baseline.
- **`MACHINES_WITHOUT_ANY_HANDLER`** — must not grow.

An arrow that is *deliberately* unbuilt is named in an exemption list **with the reason and the
increment that will build it**. Per the standing lesson, an exemption list rots into an allowlist, so
each entry carries the register id that justifies it and the control fails on an entry whose id is
CLOSED.

### Predicted red, named before it is written

- Delete the `COORDINATING → WAITING` arrow from `transitions.data.ts` → `ARROWS_WITHOUT_COMMAND`
  **drops**, so a ratchet on the raw number would go green on a deletion. **The control must
  therefore also pin the arrow TOTAL**, or it rewards removing the evidence.
- Add a fake `MoveHarness` entry to `registry.ts` pointing at a handler that declares
  `machine:'Harness.status'`, `target:'PLANNING'`, `fromStates('FRAMING')` → that one arrow leaves
  the list and nothing else changes. This is the kill that proves the control reads the registry and
  not a hardcoded table.
- **The control's OWN control:** break the extractor (rename `machine:` to `machineName:` in one
  handler) → the extractor must THROW, not report one more unreachable arrow.

**Gate:** full. **Register:** closes the C-0 half of REG-F-063; the Harness itself stays OPEN.

---

## ~~C-1 — DECISION joins the authoring turn's revision vector~~ WITHDRAWN 2026-08-08: VACUOUS

~~`snapshotRevisions` pins the PWA, every PWU_TYPE, every ASSURANCE_POLICY and the conversation.
`hasEffectiveWaiver` reads DECISIONs to set `FloorView.waived`, and no DECISION is pinned. A waiver
granted or revoked mid-turn is a read dependency the vector does not carry.~~

**Every sentence above is TRUE and the increment is still worthless, which is the part worth
keeping.** I promoted a real-but-inconsequential observation to a roadmap increment without tracing
what depends on it. Traced now:

- `FloorView.waived` has exactly two consumers, both in `pwa/[id]/+page.svelte` (L1854, L1874).
  **It is display-only.** It reaches no command, no payload, no canonical write.
- The floor RECORDING is built from `runFloorAndPlanRecording(subject, ctx, …)`, and `ctx` is
  schema-invariant + identity-provenance + reasoning-review. **No waiver enters it.**
- The turn's own staging decision reads `floorResult.floor?.satisfied` — **never `waived`**.
- The publication gate *does* honour an EFFECTIVE waiver (`pwa-authoring.ts:946`), but it runs at
  `PublishPwa`, reading live state at that moment. **A staged turn cannot make it stale.**

So the vector is not missing anything that affects a write: everything the recording depends on —
the PWA, the types, the reasoning-review policy whose criteria it reads — is already pinned. **The
mechanism is right AND its input is complete**, which is the opposite of what this increment and the
survey critic both asserted.

**THIS IS THE SECOND HAZARD IN THIS PROGRAMME THAT DISSOLVED ON VERIFICATION** (REG-F-065 was the
first, and it was mine too). Both were written down from a plausible reading and neither was traced
to a consequence before being scheduled. Recorded as REG-F-066; struck rather than deleted, because
"a read dependency the vector does not carry" is a true sentence a later reader will rediscover, and
they should find the trace rather than repeat it.

---

## C-2 — The four multi-dispatch acts get the envelope the app already uses

`recordAssuranceRecordingPlan`, `recordWaiver`, `undertakings/create`, `seed-workbench`. Each can
half-happen. The app already states the rule — *"A partially-instantiated architecture is worse than
an un-instantiated one"* — and already has `dispatchBatch`. No new mechanism.

`recordWaiver` carries a second defect and it is **not** fixed by batching: the
`waivedPolicyId`/`waivedCriterionId` it pins come from a cross-aggregate read that nothing
re-derives, and `pwaFloorGate` later honours the waiver against whatever the floor says then. That
is ASR-12's *"never floats"*, and it floats. Batching stops the partial write; the floating pin needs
C-5.

**Predicted red, per site:** force the Nth dispatch to fail and assert the store is unchanged.

---

## C-3 — The outbox stops lying

`drainOutbox` marks every pending row PUBLISHED after the subscriber loop **whether or not any
subscriber exists**, nothing in production registers a subscriber, and no timer drains it
(`enforcement-register.ts:2286-2293` already records this). The channel is specified, ordered
(`global_sequence`), transactional, at-least-once by two normative SHALLs — and it discards.

**A cascade built on it would report success and deliver nothing**, so this precedes C-4. A drain
with no subscriber must be a recorded gap or a refusal, never a PUBLISHED row.

---

## C-4 — ASR-8's cascade reaches CANONICAL state

The substantive finding (REG-F-065). ASR-8: *"every dependent supported claim becomes contested,
under review, or invalidated."* Canonical state never does it; `assurance-view.ts:342-363` does it in
the projection; the gates read canonical. **The UI shows an assessment invalidated while
`PublishPwa` passes.**

Needs C-0 (so the Harness arrows it adds are checked), C-3 (so delivery is real), and REG-E-030's two
bounds: derived acts carry **derivation provenance distinct from `issuedBy`**, and a derived act
**may move work toward caution and may not approve or revoke**.

**This is where the Harness stops being hollow** — the cascade is the coordinator's first job.

---

## C-5 — A handler-reachable read-dependency declaration

`CommitInput` carries ONE `aggregateId` and ONE `expectedRevision`
(`packages/rph-ports/src/ports/storage.ts:43-55`), so a handler cannot say *"and B must still be at
revision r"*. The host can, via `dispatchBatchGuarded`'s precondition vector, checked inside the
transaction. **The mechanism exists and is host-only.**

Largest, changes a port, and is the only increment that should wait for the other five. Anchored on
ASR-12, not invented.

---

## Sequencing note

C-0 first, and it is not merely tooling: C-2, C-4 and C-5 all assert something about which
transitions exist, and C-0 is what stops the next machine being authored the way the Harness was.

## Out of scope here

The four **infrastructure** races in `DESIGN-trust-boundary.md` §3 (stale DRAFT read, idempotency-key
PK collision escaping `dispatch` as a raw `SqliteError`, WAL + `BEGIN DEFERRED` with no
`busy_timeout`, and the whole-store `@event-log` counter). Different family — host and persistence,
not coordination — and they keep their own sequence. All four were re-verified from source
2026-08-08 and none is refuted by the serializability argument, because none of them is a
cross-aggregate read: they are a lost update, an uncaught exception, an unretried driver error, and a
false conflict.

**And the eighteen unverified candidates** (§0 of the design) are neither scheduled nor cleared.
