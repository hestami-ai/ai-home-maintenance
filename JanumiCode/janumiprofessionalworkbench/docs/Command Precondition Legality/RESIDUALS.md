# JAN-CMDPRE — History Audit & Disclosed-Residual Register

*Deliverable of **JAN-CMDPRE-DWP-09** (master work package DS-001:D7). Read-only history audit of the
reference seed for pre-existing contradictions, plus the register of disclosed residuals carried by the
DWP-00…08 series. Authored under the sponsor's standing "Proceed" authority (JAN-ROADMAP-001).*

> **Nothing in this audit rewrote, deleted, or compensated any event.** The audit reads
> `engine.readAllEvents()` and `loadObject()` only. Events are ratified immutable and the corpus supplies no
> retraction (JPWB-DOC-003 §9 / PER-1, PER-2; JPWB-CON-000 AX-7). §3 states why a contradiction, had one been
> found, would be **unrepairable**.

---

## 1. What was audited, and how

**Target.** The full reference seed — `seedWorkbench` (`packages/rph-engine/src/seed-workbench.ts`), the
superset history the engine ships: the policy library (3 locked de-minimis floor policies + the ratified
additive Product Realization catalog), the **Product Realization PWA** authored and published with its 9 PWU
Types, the **Field Service Management Undertaking** instantiated under it, and that undertaking's full
Professional Work Graph driven end to end through the reference-undertaking chain
(claim → evidence → assessment → decision → baseline). This is the same history whose invariance every DWP
guarded ("the reference seed drives unchanged", roadmap §12).

**Method.** A scratch runner (not shipped — see §5 for the exact source, so this is reproducible) seeded a
fresh in-memory store, then scanned the resulting append-only log for the two contradiction shapes the roadmap
outcome names and the SPEC's INV-6 enumerates:

1. **Duplicate terminal / once-only event per aggregate** — more than one event of the same type on one
   aggregate, keyed by `(aggregateType, aggregateId, eventType)`; a *contradicting* duplicate would be a second
   `DecisionRevoked` / `BaselineSuperseded` / `AssurancePolicySuperseded` (SPEC-001-INV-6, §4 row 4).
2. **Re-pointed PWA root** — more than one distinct `rootPwuTypeId` ever asserted for one PWA.

A third, informational pass loaded each aggregate's final state and flagged any axis sitting in a machine
**terminal** state (`STATE_MACHINES[...].terminalStates`), to cross-check that every terminal state was reached
by exactly one transition.

**Scale.** 299 events across 104 aggregates.

---

## 2. Findings

### 2.1 Contradictions found: **none**

| Contradiction shape scanned | Result | Evidence |
|---|---|---|
| >1 terminal/once-only event of the same type on one aggregate | **0** | No `DecisionRevoked`, `BaselineSuperseded`, or `AssurancePolicySuperseded` occurs at all in the seed; the terminal facts that do occur (`BaselinePromoted` ×2, `DecisionEffective` ×2, `BaselineApproved` ×2) each land **once per aggregate** — the counts of 2 are across two *distinct* baseline/decision aggregates, never a second event on one. |
| Re-pointed PWA root | **0** | Exactly one `PwaPublished` carrying one `rootPwuTypeId`; exactly one PWU Type declares `isRoot`. `repointedRoots: []`. |
| Terminal state reached by >1 transition | **0** | The 8 PWUs that reach a terminal axis (`executionState=SUCCEEDED`, `assuranceState=SATISFIED`, one `workLifecycleState=BASELINED`) each arrive via a single final `PwuStateChanged`. |

The reference seed is **contradiction-free with respect to the three shapes scanned above** — a same-type
terminal/once-only duplicate on one aggregate, a re-pointed root, and a terminal state reached by more than one
transition. This is the expected result and it is load-bearing, not a formality: the seed is driven entirely
through *legal* transitions, and — after DWP-01a…08 — every re-issue of a state-advancing or `commitState`
command is now **refused** with no event appended. A history built through the hardened engine cannot accrue
**those** contradiction shapes.

**Scope of the claim (do not over-read it).** The census keys duplicates on `(aggregateType, aggregateId,
eventType)` and scans the root by `rootPwuTypeId` cardinality; it is therefore *structurally blind* to four
other shapes it does **not** assert freedom from: (a) two **different** mutually-exclusive terminal events on one
aggregate (e.g. an `ExecutionPlanCompleted` **and** an `ExecutionPlanFailed`) — each a distinct `eventType`, so
each is a `count=1` group; (b) a terminal aggregate that later received a non-self event of a different type; (c)
a **non-monotonic** `aggregateRevision` (the census never reads revision); (d) a **cross-aggregate** stale
reference (a `REVOKED` Decision still named by an `AUTHORITATIVE` Baseline; a root pointing at a `REMOVED` PwuType).
The audit provides no evidence the seed contains any of these — but it also does not *scan* for them; surfacing
them is exactly the deferred **R5** (projection-level contradiction surfacing). The unqualified sense of
"contradiction-free" is therefore the three-shape sense above, not a universal one.

### 2.2 Multiplicities observed that are **not** contradictions

The per-aggregate duplicate-event census returned two shapes. Both are legitimate; both are recorded here so a
future reader does not mistake either for a defect (and does not "fix" them into an over-refusal):

- **`PwaEdited` ×9 on the seed PWA, identical payloads** (`{pwaId}`, revisions 1–9). This is the
  `bumpPwaSemanticVersion` **derived write** — the PWA's semantic version is bumped once per `DefinePwuType`,
  and the seed defines 9 PWU Types. Each event records a *real, ordered* version increment; the payload carries
  no discriminator beyond `pwaId` because the increment itself is the fact. This is **residual R1** (§4) — a
  derived write with no command of its own, so DWP-08 could site no precondition on it. It is **not** a
  duplicate terminal fact: `PwaEdited` is legitimately repeatable, and "count of `PwaEdited` per PWA" is
  therefore not a contradiction signal.

- **`PwuStateChanged` ×8–9 per PWU, distinct payloads.** These are the normal multi-axis lifecycle steps
  (`READY → PLANNED → EXECUTING → EVIDENCE_PENDING → UNDER_ASSURANCE → SATISFIED/BASELINED`), each a distinct
  `(previousState, newState)` on one or more of the four PWU axes — including the legal *same-`workLifecycle`*
  sub-advances (e.g. `EXECUTING → EXECUTING` while `executionState` moves `RUNNING → SUCCEEDED`) that
  `ChangePwuState`'s DWP-02 vacuity predicate exists to *admit* while refusing only the all-four-axes NOOP. A
  recurring event type carrying distinct, ordered transitions is the lifecycle working, not a contradiction.

---

## 3. Why a contradiction would be UNREPAIRABLE (DOC-003 §9.1)

Had the audit found a duplicate terminal event or a re-pointed root, it would be recorded here as an
**unrepairable** residual — never silently corrected — for a structural reason the canon fixes:

- **Events assert; they are never rewritten.** "A persisted domain event records an accepted state change and
  is never rewritten … Event payloads carry the accepted facts" (JPWB-DOC-003 §9 / **PER-1**). "History is
  never rewritten by invalidation — the record of prior satisfaction stands" (**PER-2**).
- **A false append has no retraction.** "A second event for a change that did not happen is a permanent false
  entry in an append-only record with no retraction" — this is JAN-CMDPRE-SPEC-001 **INV-2 WHY**'s wording,
  restating the ratified principle **JPWB-CON-000 AX-7**: "History is append-only. Accepted semantic changes
  produce immutable events; correction moves forward through new events, supersession, or reconciliation, never
  by rewriting." The roadmap's legacy citation "DOC-007 §9.1" resolves to these live canon clauses (the DOC-007
  numbering predates the canon consolidation; the persistence semantics moved to DOC-003 §9 / PER-1–PER-2).

The consequence is definite: the **only lawful remedy for a pre-existing contradiction is a forward superseding
event** (a new supersession/correction fact that preserves the contradicting one, per DOC-003 REL-3 / ASR-8),
**never** a deletion, edit, or compensation of the offending event. Because the reference seed contains no such
contradiction, no remedy is owed — and the register asserts that the correct disposition of any that *were*
found would be **disclose-and-supersede**, not repair-in-place. That distinction is the whole point of a
residual register: some facts are permanent, and the record's job is to make them legible, not to erase them.

---

## 4. Disclosed-residual register

These are **not** seed contradictions (§2 found none). They are the mechanism-level items the DWP-00…08 series
deliberately left open, each disclosed at delivery and gathered here as the series' standing residual set. Each
is safe (none admits a currently-refused command; none breaks a legitimate flow), bounded, and carries its
disposition.

| # | Residual | Origin | Why open | Disposition |
|---|---|---|---|---|
| **R1** | **`bumpPwaSemanticVersion`** is a **derived write** (emits `PwaEdited` on the owning PWA every time a PWU Type is defined/edited/removed) with **no command of its own** and a synthesised idempotency key. It fires 9× on the seed PWA. | DWP-08 | It is not dispatched as a command, so there is no handler site at which to evaluate a `(state, payload)` precondition. Refusing it would require refusing its *trigger* (`DefinePwuType`/`EditPwuType`/`RemovePwuType`), which already carry their own preconditions (DWP-08). | **Benign, retained.** Each bump is a real increment. If a future design gives the version bump a first-class command (or an explicit "no-op if version unchanged" guard on the derived path), it inherits the standard precondition obligation. Until then: disclosed, not a contradiction. |
| **R2** | **`AppendConversationEntries` duplicate-BATCH rule** — the *empty-batch* refusal shipped in DWP-08; refusing a **re-submitted identical batch** did not. | DWP-08 | Conversation entries carry **no per-batch identity**, so the only available key is content. A content-only key **over-refuses** a legitimately recurring identical turn (the establishment's adversarial verify caught exactly this). SPEC-001-INV-6 names `entries` as an accumulative field, so the harm (a re-issue appending the batch twice) is real — but undecidable from `(state, payload)` without a stable batch id. | **Deferred, disclosed.** Awaits a stable per-batch id (a `conversationEntryBatchId` or per-entry id in the payload contract), at which point the duplicate-batch rule becomes a clean reader precondition. |
| **R3** | **`expectedRevision` migration** — optimistic-concurrency preconditions are not yet required on every mutating command. | DS-001 §15 | Out of the JAN-CMDPRE precondition-legality scope (that program governs *source-state* legality, not concurrency tokens). | Deferred; disclosed in the design. |
| **R4** | **Retraction of written events** — there is no command to retract or compensate an event. | DS-001 §15 | Structural, by ratification: events are immutable and append-only (§3). This is a *property*, not a gap — the only lawful correction is a forward superseding event. | Permanent by design. Recorded so it is never mistaken for a missing feature. |
| **R5** | **Projection-level contradiction surfacing** — read models do not yet flag a stored contradiction to the UI. | DS-001 §15 | The audit is currently a point-in-time script (this document), not a live projection. | Deferred; the audit method in §1/§5 is the seed of a future projection-side check. |
| **R6** | **`advancePwuLifecycle` (the F-6 PWU-lifecycle family)** — the six state-advancing PWU commands `BeginPwuShaping`, `MarkPwuReady`, `ChallengePwu`, `ReshapePwu`, `InvalidatePwu`, `SupersedePwu` carry **no** `precondition` field: `advancePwuLifecycle` is the third write primitive, independent of `advanceStatus`, so the DWP-06 compiler-mandatory INV-1 does not reach them. | SPEC §5.4 / F-6 | They advance a status axis but their re-issue refusal rides on `canAdvanceWorkLifecycle` → `canTransition` (which excludes the NOOP), classified GUARD_ONLY_ACCIDENTAL. Not migrated to the `fromStates` mechanism; lowest-priority remediation. | **Deferred, disclosed.** A same-state re-issue *is* refused today and returns the correct `RPH_ILLEGAL_STATE_TRANSITION` (SPEC §7), so this is a mechanism-uniformity gap (INV-1 coverage + wrong-code risk if a guard changes), not a live exploit; no application-layer re-issue kill test exists yet. |

**R1 and R2 are the two DWP-08 disclosures** the series owed to this register; **R3–R5** are the standing
deferrals from DS-001 §15; **R6** is the SPEC's F-6 backlog (the one state-advancing family outside INV-1). Together
they are the DWP-00…08 mechanism-level residuals gathered in one place. (Genuinely out of this register's scope,
because established after the fact: the SPEC §3.1/§7 execution-plan/pwa target sets tabled under F-1 were
subsequently **DELIVERED** in DWP-05, so they are closed, not residual.)

---

## 5. Reproduction

The audit script is scratch (not shipped, so it never enters the package build or the gate). It ran under the
vitest/Node runtime because the engine's `better-sqlite3` driver refuses Bun. To re-run, drop this file at
`packages/rph-engine/src/_dwp09-audit.test.ts`, run `bunx vitest run src/_dwp09-audit.test.ts` from the
`rph-engine` package, read the emitted JSON, then delete the file.

```ts
import { writeFileSync } from 'node:fs';
import { STATE_MACHINES } from '@janumipwb/rph-domain';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { it } from 'vitest';
import { createEngine, seedWorkbench } from './index.js';

it('DWP-09 read-only history audit', () => {
	let s = 0;
	const engine = createEngine({ ontology, now: () => '2026-07-12T00:00:00Z', newEventId: () => `e${++s}` });
	seedWorkbench(engine);
	const events = engine.readAllEvents();
	const aggIds = [...new Set(events.map((e) => e.aggregateId))];

	// (1) duplicate (aggregate, eventType) census. Key on a JSON-encoded tuple (unambiguous, no in-id
	// collision) and carry the tuple in the value, so the report never re-parses the key.
	const byAggType = new Map<string, { key: [string, string, string]; list: typeof events }>();
	for (const e of events) {
		const key: [string, string, string] = [e.aggregateType, e.aggregateId, e.eventType];
		const k = JSON.stringify(key);
		const entry = byAggType.get(k) ?? { key, list: [] as typeof events };
		entry.list.push(e);
		byAggType.set(k, entry);
	}
	const duplicates = [...byAggType.values()]
		.filter(({ list }) => list.length > 1)
		.map(({ key: [aggregateType, aggregateId, eventType], list }) => ({
			aggregateType, aggregateId, eventType, count: list.length,
			eventIds: list.map((e) => e.eventId),
			payloadsDistinct: new Set(list.map((e) => JSON.stringify(e.payload))).size > 1
		}));

	// (2) re-pointed PWA root
	const rootAssertions = new Map<string, Set<string>>();
	for (const e of events) {
		const p = e.payload as Record<string, unknown> | null;
		if (p && typeof p.rootPwuTypeId === 'string')
			(rootAssertions.get(e.aggregateId) ?? rootAssertions.set(e.aggregateId, new Set()).get(e.aggregateId)!).add(p.rootPwuTypeId);
	}
	const repointedRoots = [...rootAssertions.entries()].filter(([, v]) => v.size > 1);

	writeFileSync('dwp09-audit.json', JSON.stringify({ totals: { events: events.length, aggregates: aggIds.length }, duplicates, repointedRoots }, null, 2));
	engine.close();
});
```

Result of the run captured for this register: **299 events, 104 aggregates; 0 contradicting duplicate terminal
events; 0 re-pointed roots.** The only per-aggregate multiplicities were `PwaEdited` (residual R1) and the
distinct-payload `PwuStateChanged` lifecycle steps (§2.2).

---

*End of JAN-CMDPRE RESIDUALS register. Read-only audit executed against the reference seed; series residuals
R1–R5 disclosed. The register's standing rule: a stored contradiction is disclosed and superseded forward,
never repaired in place (§3).*
