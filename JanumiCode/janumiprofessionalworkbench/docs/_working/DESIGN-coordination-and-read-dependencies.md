# DESIGN — Coordination, read dependencies, and the coordinator that is ratified and hollow

**Status:** DESIGN. Nothing here is implemented. Supersedes the race analysis in
`DESIGN-accountability-substrate.md` §2, which this pass found to be **wrong in its central claim**.

**Method:** a thirteen-agent survey (corpus / handler census / mechanism inventory / prior art →
one adversarial refuter per candidate → completeness critic), run 2026-08-08. Every load-bearing
claim below was then re-verified by hand against the file it cites. Where the survey and I
disagree, the file won.

---

## 0. THE PASS OVERTURNED THE FINDING IT WAS RUN TO CONFIRM, AND THAT IS THE HEADLINE

`DESIGN-accountability-substrate.md` §2 asserted two live races and I have repeated them since:

> `claimsWithAdmissibleEvidence` — folds evidence, then commits the claim. Evidence invalidated
> between fold and commit ⇒ a claim recorded SUPPORTED on evidence that is no longer admissible,
> **which is the precise state ASR-8 exists to forbid.**

**The last clause is backwards.** ASR-8 does not forbid that state; for the *link*, it REQUIRES it.
JPWB-DOC-003 §8.3 ASR-8, verbatim (L271, L273):

> Contradicting evidence remains attached and visible; **the record never self-curates toward
> support.** … **SCOPE:** governs the live epistemic graph. **Retention is dependency-driven:**
> evidence is retained while any active or historical claim, assessment, decision, or baseline
> depends on it.

A claim that DROPPED an invalidated evidence id from `supportingEvidenceIds` would be the
self-curating record ASR-8 forbids, and would destroy the retention predicate that same clause
defines. **The persisted link is the conformant outcome, not the defect.** I cited ASR-8 as the
authority against the very state ASR-8 requires — the most expensive kind of error available here,
because it borrows a ratified rule's authority for its opposite.

**What ASR-8 DOES require is in its first sentence, and that part is unmet** — see §4.

### And the race framing itself does not survive

Eight candidates went to independent refuters. **Eight were refuted** — seven `NOT_REACHABLE`, one
`ALREADY_PROTECTED`, all at HIGH confidence. Critically, **they were not refuted on
single-process grounds**, which is the defence CON-000 AX-10 rejects and which I had pre-loaded
into their prompts. They were refuted on **serializability**:

> The candidate's own "interleaving" is a SERIAL history. … A race is an outcome reachable under
> interleaving that no serial order produces; the state complained of IS the serial order 1→2→3,
> which the engine permits by design.

For `claims-with-admissible-evidence` the refuter built the dependency graph explicitly: `T1`
(RecordClaimAssessment) reads Evidence and writes Claim; `T2` (InvalidateEvidence) reads Evidence
and the `supportsGraph`, which filters `eventType !== 'EvidenceProposed'` and therefore **never
reads claim status**. One RW edge `T1→T2`, no back edge, no cycle ⇒ serializable ⇒ the interleaving
admits no state a serial order does not.

**This matters for AX-10 and it is the reason the refutation is admissible.** AX-10 forbids a
correctness property that holds only in one process. Serializability is not such a property: if
every interleaving is equivalent to some legal serial history, then adding a second writer does not
change professional meaning, and there is nothing topology-dependent to design out. **The
single-process argument would have been inadmissible; this one is not.**

**Residual, disclosed:** the census produced **29** candidates, **26** decision-bearing. The
verification stage was capped at **8**. **Eighteen decision-bearing candidates were never
adversarially verified.** They are not cleared — they are unexamined, and this document does not
claim otherwise.

---

## 1. The mechanism gap is real, and it is stated precisely

The question put to the mechanism agent was: *a handler for command C targeting aggregate A reads
aggregate B and decides based on what it read — what can it express TODAY to make the write fail if
B changed?* The answer, proved from the types rather than from failure to find one:

- The only channel from a handler to the store is `commitState` → `CommitInput`
  (`packages/rph-ports/src/ports/storage.ts:43-55`). It carries **one** `aggregateId` and **one**
  `expectedRevision`. No array, no map, no second id.
- `SqliteStorageAdapter.commit` compares that scalar against that one id and nothing else.
- A single `dispatch()` **opens no transaction of its own**. Identity guard, envelope validation,
  payload hashing, the `getReceipt` idempotency lookup, payload validation and handler routing all
  run OUTSIDE any transaction; the transaction opens only inside `commit`. **81 handler reads across
  10 files happen outside it.**

So: **the expectation is singular and the read window is untransacted.** A handler cannot say "and
B must still be at revision r".

**The host CAN.** `dispatchBatchGuarded` (`command-bus.ts:551-577`) checks a whole
`RevisionPrecondition[]` vector *inside* the transaction, before dispatching. The mechanism exists,
is correct, and is **reachable only from a host, never from a handler.** That asymmetry is the
finding, not the absence.

---

## 2. ASR-12 IS THE CANON ANCHOR, AND THE SURVEY REPORTED IT ABSENT

The corpus agent searched `read dependency, dependency revision, version vector, revision vector,
snapshot, stale read, expectedRevision, derivedAtSubjectRevision, preconditions` and concluded the
general read-invalidation rule *"is nowhere in canon."*

It is in DOC-003 **§8.4, L289**, verbatim:

> **ASR-12 · Assurance binds to exact versions and never floats.** Every assessment references an
> **active** policy version and its subject's **exact semantic version**. An assessment of version n
> never satisfies version n+1; **a semantic change to the subject invalidates or forces review of
> prior assessments.**

That is a ratified rule that a derived verdict is invalidated by a revision change in an aggregate
it merely READ. Narrower than "all reads" — but for the assurance cluster, which is where the
census clustered, it is exactly on point and it BINDS.

**None of the searched terms could match *"binds to exact versions and never floats."*** This is the
same failure the register has recorded repeatedly: **the search was for the field name, not the
content.** It is now instance seven and eight, and it happened inside a survey I designed with a
rule against it printed in the preamble. Writing the rule into the prompt did not make the agent
follow it, and it did not make me check.

**Consequence:** several `NOT_REACHABLE` verdicts are correct as *race* verdicts and are
simultaneously **ASR-12 non-conformances** with a canon anchor. Not being a race does not make them
conformant. That is the reframing this pass buys.

---

## 3. THE COORDINATOR TIER IS RATIFIED, SHAPED, REGISTERED — AND EIGHT OF ITS NINE STATES CANNOT BE REACHED

REG-E-029's disposition says the evidence→claim cascade *"stays cross-aggregate and **still needs
the coordinator**."* The survey concluded the coordinator's *"AUTHORIZATION exists … but its SHAPE
does not."*

**The shape exists.** `packages/rph-domain/src/transitions.data.ts:1725` declares `Harness.status`:

```
states:         FRAMING, PLANNING, COORDINATING, WAITING, SYNTHESIZING,
                COMPLETED, ESCALATED, SUSPENDED, SUPERSEDED
initialState:   FRAMING          terminalStates: COMPLETED, SUPERSEDED
  COORDINATING -> WAITING        'durable wait on a dependency/callback'
  WAITING      -> COORDINATING   'wait resolved / restart recovery resumes'
  COORDINATING -> SYNTHESIZING   'child results ready for synthesis'
  SYNTHESIZING -> COORDINATING   'synthesis reveals more work'
  COORDINATING -> ESCALATED      'insufficient authority / no-progress'
```

**That is a saga.** A durable process with explicit intermediate states, a durable wait, a
restart-recovery resume arrow, and an escalation exit — four of AGG-1's five permitted mechanisms,
already modelled. It is backed in prose canon too: DOC-003 §2 layer 4 (L60) — *"**Coordination** —
allocation, supervision, synchronization, reconciliation, synthesis, and escalation, represented by
RPH behavior."*

**And it is hollow.** `packages/rph-application/src/handlers/harness.ts` is **49 lines** with **one**
handler, `proposeHarness`, which writes `status: 'FRAMING'`. `registry.ts:200` registers exactly one
command, `ProposeHarness`. **No command traverses a single arrow.** One state of nine is reachable;
zero of FIFTEEN arrows are. (This document first said "eight" — counted from an excerpt, not the machine; corrected against the C-0 census, which reads `transitions.data.ts` directly.)

This is the fifth hollow of the programme, and the one that matters most: **the mechanism AGG-1
requires and REG-E-029 says the cascade needs is already declared, and nothing can move it.**

### 3.1 ⚠ THE CONTROL THAT SHOULD HAVE CAUGHT IT CANNOT, BY CONSTRUCTION

`state-reachability.test.ts:74-89` `strandedFrom` walks `m.transitions` — **the machine's own
declared arrows** — from `initialState`. `Harness.status` is fully connected in its data, so it
reports **zero stranded**, correctly and uselessly.

I built that control myself, days ago, for exactly this defect class in the PWU assurance axis
(`c1173a1b`, `dacabc0d`). It asks *"is this state reachable in the diagram?"* The question that
matters is *"is this arrow traversable by a registered command?"* **A machine can be perfectly
connected on paper and immovable at runtime, and the existing control is blind to the difference.**

**This is the general form I was supposed to ask for when I closed the PWU finding and did not:**
declared-arrow reachability ≠ command reachability. The general control is:

> For every state machine, for every declared arrow, is there a registered command whose handler can
> perform it? Every arrow with no command is either an unbuilt capability or a lie in the data.

That control is cheap, it is derivable from `transitions.data.ts` × `registry.ts` × the handlers, and
it would have found this on the day the Harness machine was authored.

---

## 4. WHAT ASR-8 ACTUALLY REQUIRES IS UNMET, AND THE PROJECTION ASSERTS IT ANYWAY

ASR-8's first sentence (L271): *"When evidence is invalidated or expires, **every dependent supported
claim becomes contested, under review, or invalidated**; dependent assessments become invalidated or
review-required; baseline readiness is recalculated."*

- **Canonical state does not do this.** `invalidateEvidence` computes `affectedClaimIds` and writes
  them onto the EVENT; its own header says *"it RECORDS the impact on the event. It does not mutate
  the claims."* No claim transitions to contested.
- **The projection DOES.** `packages/rph-projections/src/assurance-view.ts:342-363` (`foldInvalidation`)
  marks every assessment whose `evidenceConsideredIds` include an invalidated id.
- **And the gates read canonical, not the projection.** `pwaFloorGate` → `floorGateBlock` and
  `loadPwaFloor` read canonical objects.

**So the read model shows an assessment invalidated while `PublishPwa` passes.** The divergence is
shipped, and it points the dangerous way: the surface tells the professional the cascade happened,
and the gate that would have stopped publication never saw it.

This is the real defect the race framing was standing in front of. It is not a concurrency bug at
all — it is **ASR-8's cascade implemented in the layer that cannot enforce it and absent from the
layer that can.** It needs the coordinator of §3.

---

## 5. THE GENUINE INTERLEAVING WINDOW IS ONE LAYER ABOVE THE HANDLERS

The census's framing premise — *"handlers are synchronous end to end, so every sketch is a COMMAND
ORDER rather than a thread race"* — is **true of handlers** (zero `async`/`await` across all 17
non-test files) and **false of the layer that calls them.**

`runPwaFloor` (`apps/rph-demo/src/lib/server/floor.ts`): reads the PWA (`:288`), builds the graph
export (`:289`), reads the reasoning-review policy's criteria from the store (`:47`), then **awaits
an out-of-process model call** (`:325` → `agy-cli.ts:49 execFileAsync`), and only then writes
(`:330`). **Every value written after that await was read before it**, in a Node process serving
concurrent requests. That is a real thread-race window, and it is the one place the survey's chosen
form could not express.

**Bounding fact, stated because it limits the finding:** both production callers pass the staged
fork, so those writes replay under `dispatchBatchGuarded` with `snapshotRevisions`' vector. But that
vector (`authoring-turn.ts:125-146`) pins the PWA, the PWU_TYPEs, the ASSURANCE_POLICYs and the
conversation — **and no DECISION.** `hasEffectiveWaiver` reads Decisions to set `FloorView.waived`. A
waiver granted or revoked mid-turn is a read dependency the vector does not carry. **The mechanism
is right and its input is incomplete** — which is a one-line fix and a good first increment.

---

## 6. NON-ATOMIC MULTI-DISPATCH ACTS

Four, each a governed act that can half-happen. The app already knows the rule — `instantiateComposition`'s
docblock (`undertakings/+page.server.ts:152-158`): *"A partially-instantiated architecture is worse
than an un-instantiated one … `dispatchBatch` rolls the whole thing back."* These did not get the
envelope:

| Site | Shape | Residue on mid-way failure |
|---|---|---|
| `recordAssuranceRecordingPlan` | Request → Begin → N×Observation → Complete, separate dispatches, throws on first non-ACCEPTED | assessment stranded in ASSESSING, some observations, no disposition |
| `recordWaiver` (`pwa/[id]/+page.server.ts:534-573`) | `RequestWaiver` then `GrantWaiver`, two canonical dispatches | a REQUESTED waiver Decision with no compensating act |
| `undertakings` `create` | 5 INTENT commands, then `CreateUndertaking`, then a batch | Undertaking committed, tree not — the exact residue its own comment forbids |
| `seed-workbench.ts` | one command at a time in loops, no transaction | partial workbench |

`recordWaiver` carries a second defect: the `waivedPolicyId`/`waivedCriterionId` it pins come from a
cross-aggregate read of assessments, observations and decisions that **nothing re-derives**, and
`pwaFloorGate` later honours the waiver against whatever the floor says then. That is ASR-12's
"never floats" applied to a waiver, and it floats.

---

## 7. THE OUTBOX IS SPECIFIED, ORDERED, AND DELIVERED TO NOBODY

The survey reported *"zero hits for at-least-once … cross-aggregate ordering is genuinely
unspecified."* Both halves are false.

- `command-bus.ts:619`: *"Delivery is therefore at-least-once; subscribers **SHALL** be idempotent.
  A durable host **SHALL** call this at startup."* Two normative SHALLs, in the file the survey
  quotes six times elsewhere.
- Global ordering: `schema.ts:91` `global_sequence INTEGER PRIMARY KEY AUTOINCREMENT`;
  `sqlite-storage-adapter.ts:260` `ORDER BY global_sequence ASC`.
- PER-3 ratifies the transactional outbox: *"atomically persist state, version history, events,
  outbox, and command receipt."*

**The residual is different and worse than the one reported.** `enforcement-register.ts:2286-2293`
already records it: nothing in production registers an event subscriber, and `drainOutbox` **marks
every pending row PUBLISHED after the subscriber loop whether or not any subscriber exists.** There
is no timer or poller. So the cross-aggregate delivery channel the coordinator would ride **exists,
is ordered, is transactional — and silently discards.** Building the coordinator on it without
fixing that would produce a cascade that reports success and delivers nothing.

---

## 8. What is genuinely absent

After four false-absence corrections, three remain, and they are narrow:

1. **A command set that moves a Harness.** The states, arrows and object exist; fifteen arrows have no
   command. This is authoring, and it is the bulk of the work.
2. **The actor who may SELECT a control action.** DOC-002 §4 (L168) reserves it explicitly —
   a Validator *"MUST NOT authorize or select them for execution"* — and REG-E-030 answers it. The
   vocabulary (`permittedControlActions`, `recommendedControlActions`) is already required in shape.
3. **A read-dependency declaration reachable from a handler.** §1. ASR-12 supplies the obligation;
   `CommitInput`'s singular expectation is the gap.

REG-E-030 already binds two shape constraints the survey under-reported: derived acts carry
**explicit derivation provenance distinct from `issuedBy`**, and **a derived act may move work toward
caution and may not approve or revoke** (from REG-E-031). Both constrain §8.1 before it is designed.

---

## 9. Sequence — smallest first, each separately acceptable

| # | Increment | Why here |
|---|---|---|
| **C-0** | **The arrow-reachability control**: every declared arrow × a registered command; failures listed, not summarised | it is the instrument that found §3, generalised; it will find the others before they are designed |
| **C-1** | Add DECISION to the authoring turn's revision vector | one line; closes §5's named hole with the mechanism that already exists |
| **C-2** | Wrap the four multi-dispatch acts of §6 in the batch envelope the app already uses | no new mechanism; deletes four partial-failure residues |
| **C-3** | Make the outbox's silent discard loud (§7) — a drain with no subscriber is a refusal or a recorded gap, never a PUBLISHED row | the coordinator cannot be built on a channel that lies |
| **C-4** | ASR-8's cascade into CANONICAL state, via Harness commands (§3, §4) | the substantive finding; needs C-0 and C-3 first |
| **C-5** | A handler-reachable read-dependency declaration (§1), anchored on ASR-12 | the general remedy; largest, and the only one that changes a port |

**C-0 goes first and it is not merely tooling.** Every increment below it asserts something about
which transitions exist; the control is what stops the next hollow machine from being authored the
way this one was.

---

## 10. What this design does not claim

Not that the 18 unverified candidates are clear — they are unexamined (§0). Not that serializability
clears the assurance cluster of ASR-12 non-conformance — it does not (§2). Not that the four
infrastructure races in `DESIGN-trust-boundary.md` §3 are addressed here; they are a different family
(host/persistence, not coordination) and keep their own sequence. Not that the Harness object as
declared is the right coordinator shape — only that it is the ratified one, and that inventing a
second while this one sits immovable would be the divergence, not the fix.
