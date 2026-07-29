# JPWB-SPEC-001-DR-002 — The Undertaking Workbench Surface: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-28 · Design authority: `JPWB-SPEC-001` v0.1.0 (DRAFT) §§2–8 and its §11.4 rulings. Sibling of
`JPWB-SPEC-001-DR-001`, which discharged the verification instruments. Sponsor direction, 2026-07-28: "Surface
defects first."*

> **NO SEPARATE DESIGN NOTE, for the reason DR-001 records.** Standing practice is design → roadmap →
> implementation. The design already exists: SPEC-001 §§2–8 states what a Surface owes, and §11.4 rules the
> twenty-seven choices a design note would otherwise re-open. A second design document would create a rival
> authority for one concern — the defect CON-000 B3 exists to prevent. This roadmap cites SPEC-001 as its design
> authority and adds only findings, sequencing, and verification.

---

## 0. Why this roadmap exists, and the mistake that produced it

DR-001's **S-2** was closed **PARTIAL** at commit `289aa160`: 373 of 770 in-scope obligations bound, **397
unbound**, against an exit criterion of zero. The work-package brief assumed the residual was *citation grind* —
obligations that had a check and simply had not been made to name it.

**That assumption was wrong, and sampling the residual is what showed it.** What is actually unbound:

| Obligation | Text | Why it is unbound |
|---|---|---|
| `O-8-R1` | "A Surface presenting a PWU **SHALL** disclose that PWU's material uncertainty." | No Surface renders uncertainty. Nothing to name. |
| `O-8-R6` | "A stale, partial, or rebuilding Projection **SHALL** identify itself as such." | No staleness disclosure exists. |
| `O-9-R2` | "Every Surface **SHALL** be addressable, and its address **SHALL** encode `subjectId`." | Addressability was ruled in §11.4 and never built. |
| `O-8-R4` | "A Surface **SHALL NOT** render a provenance field that no read path populates from a real source." | Requires a provenance-rendering surface to constrain. |

§2.8.3, §2.9.4, §3's invariant sections and §8's boundary sections are all this shape. **A substantial fraction of
the 397 are unbound because the surface does not exist, not because the citation is missing.** Grinding S-2 to zero
first would therefore have produced one of two things: bindings pointing at artifacts that do not exist, or a wall
of absence-checks to be revisited the moment the surface lands.

So the order is inverted: **building the Surface is upstream of binding the specification.** This roadmap is the
upstream half. It does not close S-2; it makes S-2's blocked remainder closable, and each work package below binds
the obligations it makes bindable, as it lands.

*Recorded honestly: three sections were sampled, not all 397. Some of the residual — the §2.9.x field-contract
tables in particular — is genuinely citation grind and is unaffected by this argument.*

---

## 1. Findings, re-derived rather than remembered

The backlog sweep that produced these items predates three commits, and this programme's standing rule is that a
record is re-derived before it is acted on. Doing so **withdrew one finding entirely and added two**.

| # | Finding | Verdict |
|---|---|---|
| **F-A** | The Undertaking workbench cannot scroll | **CONFIRMED** |
| **F-B** | Nine unreachable step-level form actions | **WITHDRAWN — the record was wrong** |
| **F-C** | A new Undertaking instantiates no PWU tree | **CONFIRMED, and larger than recorded** |
| **F-D** | The surface fabricates a governed risk profile | **NEW** |
| **F-E** | The uncertainty plane has no UI (AX-3) | **CONFIRMED** |
| **F-F** | Persistence is in-memory only | **CONFIRMED, and smaller than recorded** |
| **F-G** | `/favicon.png` 404s on every page load | **CONFIRMED** |
| **F-H** | The help / "Rosetta" system | **NOT A BACKLOG ITEM — it does not exist anywhere** |
| **F-I** | `ReviseDecomposition` performs none of DOC-003's revision obligations | **OPEN — restated 2026-07-29** |

### F-A — the workbench cannot scroll (CONFIRMED)

`apps/rph-demo/src/routes/+layout.svelte:74-76` derives `fullBleed` true for `/undertakings/<id>`, and `:311-314`
then applies `.content.full { padding: 0; overflow: hidden }`. The comment above it states the warrant:

> *"Full-bleed, viewport-locked graph surfaces manage their own internal scrolling."*

**The Undertaking workbench does not.** Its 1,128-line `+page.svelte` carries exactly one `overflow: hidden`
(`:735`, on a `height: calc(100vh - 320px)` box) and one `overflow-x: auto` (`:813`). There is **no vertical scroll
container anywhere on the page**. Everything below the fold is unreachable — which is precisely what the sponsor
reported.

This is the recurring defect of this programme in its purest form: **a comment asserting an invariant that nothing
checks, and that the thing it licenses does not satisfy.** `calc(100vh - 320px)` is a second instance — a hardcoded
assumption about chrome height that no test pins.

### F-B — the nine unreachable actions were not unreachable (WITHDRAWN)

The record claimed nine step-level form actions were declared server-side and reachable from no markup. Six were
named: `failStep`, `retryStep`, `skipStep`, `cancelStep`, `enterWaitStep`, `resolveWaitStep`.

All six are reachable. They are bound through lookup tables at `undertakings/[id]/+page.svelte:61-83` —
`STEP_ACTION` and `STEP_CONTROL_ACTION` — keyed to the read-model's `advanceCommands` / `controlCommands`
allowlists, which is the correct design (F-11 forbids rendering the wider state-machine topology). Three passing
e2e specs exercise them: `execution-plan.e2e.ts:221` (the allowlist), `:254` (Wait/Resume), and
`execution-tier3.e2e.ts:142` (retry-cap exhaustion).

**The original finding came from grepping for the literal string `action="?/…"`, which cannot see a dynamically
bound action.** This is the **eighth** recorded instance of the absence-of-evidence error in this programme, and it
is the same failure as the S-2 obligation counter's regex, which could not see four of the spec's own fixture
namespaces. Both were greps whose blindness was invisible in their output: an empty result and a correct result
look identical.

*Nothing is owed here. The finding is withdrawn, and no work package addresses it.*

### F-C — the PWA is a Work Architecture that nothing instantiates (CONFIRMED, larger)

Creating an Undertaking (`undertakings/+page.server.ts:65-107`) drives the full Intent lifecycle and then
`CreateUndertaking`. It creates **zero** PWUs. The only way to populate one is `proposePwu`, which instantiates a
**single** PWU from a hand-picked Type, one at a time.

The PWA's authored composition tree — the `permittedChildren` with the `M1/M+/C1/C+` cardinality the PWA Designer
was rebuilt to author — **is never instantiated into an Undertaking.** A reusable Professional Work Architecture
that no Undertaking instantiates is not performing the role DOC-001 gives it.

**And the kernel to do it already exists.** `packages/rph-application/src/handlers/decomposition.ts` implements
`proposeDecomposition` (`:39`), `validateDecomposition` (`:231`) and `reviseDecomposition` (`:277`); all three
commands are in `packages/rph-contracts/vocab/m3-commands-events.json`. They are referenced from **nowhere** in
`apps/rph-demo/src/`.

This is the wiring pathology this programme has already measured once and named — the harmonization programme found
74% of the kernel dead in production. W-3 is therefore a **wiring** work package, not a build.

### F-D — the surface fabricates governed inputs (NEW)

`undertakings/[id]/+page.server.ts:590-596`, inside `proposePwu`:

```ts
riskProfile: {
    consequence: 'MEDIUM',
    uncertainty: 'MEDIUM',
    irreversibility: 'MEDIUM',
    securitySensitivity: 'MEDIUM',
    regulatoryExposure: 'LOW'
}
```

…and `:579-584` stuffs `boundaries` with `inScope: ["<title> for this Undertaking"]` and the literal
`outOfScope: ['not yet known']`.

The risk profile is a **governed input that selects the assurance tier**. Here it is five constants that no
professional chose, written into canonical state and indistinguishable downstream from a judgement. This is
`O-8-R4`'s defect with the polarity reversed: the spec forbids *rendering* a field no read path populates; this
*writes* a field no read path populates.

The `boundaries` placeholder is defensible and differently sourced — the comment at `:576-578` records that
DOC-002 §9.1 permits "not yet known" and that `MarkPwuReady` rightly rejects the empty case. **That one is honest
and stays.** The risk profile is not, and does not.

### F-E — the uncertainty plane has no UI (CONFIRMED)

`residualUncertainty` is produced by the agent path (`agent/tools.ts:141`), rendered into rationale prose
(`agent/rationale.ts:52`), validated (`assurance/reasoning-review-validator.ts:145`) and written at
`undertakings/[id]/+page.server.ts:909`. **No `.svelte` file in the application renders it.** The data flows the
whole way and terminates at the surface boundary.

This is `O-8-R1` unbound, exactly.

### F-F — persistence is one wiring change, not a subsystem (CONFIRMED, smaller)

`packages/rph-persistence/src/sql-driver.ts:28` — `createSqliteDriver(filename = ':memory:')`. `CreateEngineDeps`
(`rph-engine/src/engine.ts:77-78`) documents `store` as *"Defaults to an in-memory SqliteStorageAdapter."* The demo
(`lib/server/workbench.ts:74-77`) passes `ontology`, `validateOntology` and a test clock — **never a store.**

The whole persistence stack exists and is unit-tested. The demo just never asks for a file. The work is a path, a
**seed-only-if-empty** guard (today `getEngine()` unconditionally seeds on first use, which would double-seed a
restored file), and a reset path. It is not a new subsystem.

### F-G — `/favicon.png` (CONFIRMED)

`[404] GET /favicon.png` appears in every Playwright run, including the gate log that certified S-1/S-2/S-3.

### F-H — the help / "Rosetta" system does not exist (NOT A BACKLOG ITEM)

`grep -ril rosetta` across every `.md`, `.ts` and `.svelte` in the repository returns **nothing**. It is not a
started-and-abandoned item; it exists only in an agent's memory of a conversation. It is therefore **not carried
into this roadmap** — it is unstarted design work, and design work enters through a design note, not a remediation
roadmap. Recorded here so the absence is deliberate rather than an oversight.

### F-I — `ReviseDecomposition` performs none of DOC-003's revision obligations (OPEN)

> **RESTATED 2026-07-29 after adversarial verification, and the correction runs in BOTH directions.** The first
> statement (below the rule) called this "a command advertises three fields its handler never reads" and cited
> CON-000 B7. A subsequent conversational re-reading then went the other way — that the fields *are* recorded on
> the event and that the handler matches a ratified "supersede, new contract = DRAFT" transition, so the finding
> was largely a misreading. **That second reading was wrong, and citing it would have minted a fresh B7 violation
> inside the correction to a B7 finding.** Six independent verifiers refuted or qualified every limb of it. What
> follows is what survived, with a runtime probe behind the load-bearing claims.

**The ratified obligation.** `JPWB-DOC-003` is OPERATIVE (REG-D-010, 2026-07-24) and binds revision three times:

- **DEC-2** (`:215`): *"Revising a decomposition is legal, changes the parent's semantic version, and **triggers
  impact analysis**."*
- **DEC-3** SCOPE (`:221`): *"governs every decomposition, **revision**, and delegation"* — rule: *"No mandatory
  obligation silently disappears."*
- **DEC-4** SCOPE (`:225`): *"governs decomposition, delegation, **semantic revision**, and context assembly."*

`obligationAllocations` and `constraintPropagations` are precisely the DEC-3 and DEC-4 carriers. So the payload
is not a speculative shape somebody invented — **it is the shape ratified canon requires**, and the handler
reads none of it.

**What the handler does.** `packages/rph-application/src/handlers/decomposition.ts:277-289`:
`export const reviseDecomposition: CommandHandler = (ctx, command) =>` — **no payload parameter**, and no
`mutate`. It advances `status` to `SUPERSEDED` and bumps `semanticVersion`. Of DEC-2's three requirements it
performs exactly one (the version bump). Obligation conservation, constraint disposition and impact analysis are
not performed, not refused, and not recorded as unperformed.

**What happens to the payload, measured rather than reasoned.** A runtime probe (real `SqliteStorageAdapter`,
real engine) dispatched a revise carrying all four fields. Result `ACCEPTED`; the aggregate's
`childWorkUnitIds` was **unchanged**, `obligationAllocations` and `constraintPropagations` still `[]`. The fields
do reach the **event** — `kit.ts:569` emits `command.payload` verbatim when no `eventPayload` builder is supplied
— but that is a far weaker fact than it sounds, in three ways:

1. All three are `.optional()`, so the ordinary call records nothing but a `rationale` string. Every existing
   test call site passes `{rationale}` alone.
2. They survive **only because the event contract is unenforced**.
   `DecompositionRevisedPayloadSchema` (`messages.ts:1020-1025`) is a `strictObject` requiring
   `supersedesDecompositionContractId`, `rationale`, `semanticVersion`, `status` — and the emitted payload fails
   it four ways, including *"Unrecognized keys: childWorkUnitIds, obligationAllocations,
   constraintPropagations"*. The gate never runs because `DecompositionRevised` is absent from
   `RATIFIED_EVENT_PAYLOADS`, and it is absent **because** the vocab entry is annotated `UNRATIFIED-AUTHORED`:
   `gen-messages.ts:226-229` skips such entries. **The annotation is the mechanism that disabled the check, not
   a disclosure that mitigates it.**
3. **Nothing reads the event.** Searched two ways across `rph-projections`, `rph-engine`, `rph-assurance`,
   `rph-authoring` and `apps/rph-demo`: zero consumers.

So the emitted audit record omits the two facts it exists to carry — that a contract was superseded, and at
which version — and carries three keys its own contract forbids.

**A caution against a tempting defence.** The vocab note *"DOC-002-only; new contract = DRAFT"*
(`m3-commands-events.json:7150-7157`) does NOT license the handler. It is unratified by its own paired entry
(*"Do NOT treat this sourceSection as proof the shape is ratified"*), the engine states the vocab's `drivesFrom`
*"has no ratified authority"* (`kit.ts:507`), and DOC-002 has no DecompositionContract transition matrix at all.
The only ratified sentence on the subject is DEC-2's, and it describes an **in-place** revision. Nor would
repairing this contradict the state machine: `checkTransition` constrains `status` only, and `advanceStatus`'s
`mutate` hook is used at eleven sites — including `supersedeAssurancePolicy` (`assurance.ts:332-351`), which
writes a payload-derived field **while advancing to SUPERSEDED**. The repair is mechanically available and has
direct precedent.

**The caller-visible residual, which no obligation catches.** A caller supplying `childWorkUnitIds` receives
`ACCEPTED` and has no way to learn nothing was applied. SPEC-001's disclosure duties do not reach it: INV-08
(`:3085`) obliges disclosure only *"when a Command issued from a Surface is refused"*, and INV-14 (`:3286`) fires
only where a sequence *"is interrupted by a refusal"*. An accepted-but-unapplied command falls between them.

**Disposition — SPONSOR DIRECTION 2026-07-29: the code SHALL NOT sit in a grey area.** Superseding the earlier
"leave it", which was given on the briefing corrected above. Resolved at commit `50785b5b` by two changes,
**neither of which required a ratification decision**:

1. **A revision carrying a field this handler cannot honour is REFUSED**, by name, citing the obligation each
   carries. One never needs canon's permission to refuse to do what one does not do. This is B7 **discharged**
   rather than deferred: the missing capability is now visible on every attempt instead of never.
2. **The emitted event conforms to the payload schema it declares** — `supersedesDecompositionContractId`,
   `rationale`, `semanticVersion`, `status`. Making an event match its own declared shape is likewise not a
   model change.

**The event payload was subsequently RATIFIED by sponsor conferral (2026-07-29, REG-F-006).** The shape had first
been asserted only in `decomposition-revise-conformance.test.ts`, deliberately, because clearing the
vocabulary's not-yet-ratified provenance marker adds the event to `RATIFIED_EVENT_PAYLOADS` and **that is a
conferral of status** — the sponsor's under B2, never the author's. With it conferred, the engine's own (d2)
event gate now runs: a non-conforming `DecompositionRevised` is refused at dispatch with `VALIDATION_FAILED`,
where before it was committed and only the test noticed. The enforcement moved out of the test suite and into
the engine; the test remains as the direct statement of the shape.

*A trap discovered while performing that conferral, recorded because the next editor will meet it: the
`sourceSection` field is **both prose and a machine predicate** — `gen-messages` substring-matches it. Writing
the marker's literal name into the new text, in a sentence explaining that the marker had been removed, silently
re-applied it and left the event out of enforcement while the entry read as ratified. Caught by simulating the
generator's filter before trusting the regeneration.*

Three mutants, each proved by hand before recording: `FI-a` restores the acceptance; `FI-b` drops only the DEC-3
carrier from the guard list — the likelier slip, because the headline case still refuses while obligation
conservation goes on being silently unperformed; `FI-c` stops the event recording the status it transitions to.
The CONTROL was already green before the guard was written, proving it could not simply be "refuse everything".

**The finding remains OPEN as a CAPABILITY gap — and UNSCHEDULED, which the first wording of this section hid.**
It said the remainder awaited "a decomposition-model increment awaiting ratification". That named nothing: no
such item exists in any plan, the phrase was coined here, and it put a governance blocker in front of work that
appears to need only scheduling — DOC-003 is OPERATIVE and already binds revision, so the semantics are settled.

**The kernel is already built.** `rph-domain/src/decomposition.ts` exports `validateObligationConservation`
(`:62`) and `validateConstraintPropagation` (`:165`), both adversarially reviewed under milestone M9, and
`validateDecomposition` already calls them (`rph-application/src/handlers/decomposition.ts:210-211`). The revise
path is a **second call site nobody wired**.

**How it went missing is the part worth keeping.** The tracker defers that wiring forward four times, every
station marked ✅ — M9 *"commands/BINDINGS wiring → M10/M11"*, M10 *"command handlers → M11/M13"*, M11
*"… command handlers … → M13"*, M13 *"✅ core … live-command-drive handlers deferred"*. It fell off the end of
its own chain, and no milestone holds it now. That is this repository's already-measured pathology — *74% of the
kernel dead in production* — arriving through deferral notes instead of through code.

DOC-003's obligation conservation, constraint disposition and impact analysis are still unimplemented. What
changed is that the gap is **declared, refused and enforced** rather than silent.

**CONFERRED 2026-07-29 — the finding now lives in the register as `JPWB-REG-005` §REG-F-006**, which is the
authority for it; this section is the working record. The B7 escalation CON-000 B7 requires is therefore
performed rather than documented around, and under B5 the ruling is effective. The interim proposal file has
been deleted rather than left beside the register entry: a second copy of a conferred disposition is a rival
authority, which is what B3 exists to prevent. It remains in git history.

---

## 1a. Status — ALL FIVE LANDED, 2026-07-28

| WP | Commit | Gate |
|---|---|---|
| **W-1** the workbench scrolls | `5701ce68` | green |
| **W-2** durable persistence | `b51e8ef4` | green |
| **W-3** the PWA instantiates | `ec95a520` | green |
| **W-4** the risk profile is authored | `602f8d3c` | green |
| **W-5** the disclosure plane | `42e80883` | green |

Final gate: **148 ledger entries → 134 distinct mutations, KILLED 128, SURVIVED 0, UNANCHORED 0, NO_COMPILE 0,
KILLED_UNNAMED 0, ABORTED_DIRTY 0, CONTROL_HELD 4.** 1,976 unit tests, 65 e2e. Coverage 95.28 / 83.70 / 97.03 /
97.19 against ratcheted floors of 95 / 83 / 96.5 / 97.

**The programme's own recurring finding recurred four more times, and every instance was caught by an
arrangement assertion or a mutant rather than by review.** Recorded here because the *pattern* is the deliverable:

1. **W-1** — the probe measured `main .content`, passed pre-fix, and broke **on the fix**, because the scrollport
   moves into the page when the page starts owning it. An arrangement assertion that holds in only one of the two
   states is a defect assertion wearing the wrong label.
2. **W-2** — a mutant I predicted would redden did not: the seed guard is redundant because command idempotency
   already prevents the double-seed. Not recorded, per V-3d. What replaced it was an obligation sitting in the
   engine's own doc comment (`recoverOutbox` — "a durable host SHALL call this at startup"), unmet because nothing
   had been durable before.
3. **W-4** — the control drove the browser form and passed **only because `required` stopped the submit**. The
   server-side refusal never executed, so a one-token mutation (`?? 'MEDIUM'`) would have survived behind green.
4. **W-5** — the natural data source, `AssuranceAssessment.residualUncertainty`, is always `[]`, and the kernel
   already recorded that *"the object's `[]` is SILENCE, not a finding of 'none'"*. Reading it would have hardcoded
   O-8-R7's defect into the component built to satisfy O-8-R7.

**Two findings were withdrawn or corrected before any code was written** — F-B (the nine "unreachable" actions were
reachable) and the whole of W-3's original design (`ProposeDecomposition` does not instantiate). Both had been
authored by inference from names rather than from implementations.

**A fifth instance, recorded 2026-07-29, and it is the one that nearly went into the canon.** F-I was restated
twice: first as "a command advertises three fields its handler never reads", then — in conversation — as
"largely a misreading, since the fields are on the event and the handler matches a ratified transition". The
second restatement was checked by six independent verifiers before it was written down. **Every limb was refuted
or qualified**: the "ratified transition" it leaned on is unratified by its own entry, the engine states that
vocabulary field has no authority, and the only ratified sentence on revision (DOC-003 DEC-2) describes an
in-place revision that the handler does not perform. Writing it would have justified a B7 downgrade by citing an
unratified source as ratified — a fresh B7 violation inside the correction to a B7 finding. **The inference-from-
names failure mode has a mirror image: inference-from-a-plausible-reading, in the direction that makes a finding
go away.** It is the more dangerous of the two, because nothing is left behind to trip over.

### Open at close

The programme's five work packages are complete. These are not, and are recorded here because a status block
that lists only what landed reads as a claim that nothing else is outstanding.

| | Status |
|---|---|
| **F-I** — DOC-003's revision obligations unimplemented | **OPEN as a capability gap**, conferred to the register as **REG-F-006** (2026-07-29). No longer grey: the command refuses what it cannot perform, and its event payload is ratified and engine-enforced. DOCS_STRONGER remediation is **unscheduled**: the M9 conservation kernel exists and `validateDecomposition` already calls it; the revise path is a second call site no milestone still holds. |
| **S-2's 397 unbound obligations** in SPEC-001 §§0–10 | **OPEN.** W-3/W-4/W-5 made a portion bindable; that binding pass was not run. |
| `ValidateDecomposition` passes **vacuously** | **OPEN.** Its conservation guard reads the parent's `obligationIds`/`constraintIds`; every surface path sets both `[]`. |
| **SPEC-001 ratification** | Gated on S-2 reaching zero (CON-000 B2 — a sponsor act regardless). |
| The help / "Rosetta" system | Does not exist anywhere in the repository. Unstarted design work, not backlog. |

---

## 2. Land order

| WP | Title | Discharges | Why here |
|---|---|---|---|
| **W-1** | The workbench scrolls | F-A, F-G | **Must be first.** Every later work package is verified by looking at this page, and it currently clips. A visual verification against a clipped page is not a verification. |
| **W-2** | Durable persistence | F-F | Second because it is small, and because from here on manual verification survives a restart instead of evaporating. |
| **W-3** | The PWA instantiates | F-C | The substantial one. Wires the existing decomposition kernel to the surface. |
| **W-4** | The risk profile is authored, not fabricated | F-D | After W-3, because instantiation is where a risk profile is legitimately chosen. |
| **W-5** | The disclosure plane | F-E, and §2.8.3's register | Last: it discloses facts the earlier packages make real, and disclosing a fabricated risk profile would be worse than not disclosing it. |

**W-4 after W-3 deliberately.** Removing the fabricated constants before there is an authoring moment to replace
them with would leave `proposePwu` unable to satisfy its own contract. The fabrication is a defect *because* there
is no authoring surface; W-3 builds the surface, W-4 removes the fabrication.

**W-5 after W-4 deliberately, and this is the load-bearing one.** `O-8-R1` requires a Surface to *disclose material
uncertainty*. Wiring that display while `uncertainty` is still the hardcoded `'MEDIUM'` of F-D would render a
fabricated constant in the typography of a professional judgement — which is `O-8-R4` committed at the surface, and
strictly worse than the present silence.

---

## 3. The work packages

Each: **the defect measured → the RED that must be observed first → the change → the mutants → the obligations it
binds.** No work package is complete on a green that was not preceded by a named, observed red.

### W-1 — the workbench scrolls

- **Red first.** A new e2e (`undertaking-scroll.e2e.ts`) that drives `/undertakings/<id>`, measures
  `scrollHeight > clientHeight` on the workbench's scroll container, and asserts the last panel is reachable. It
  must fail on today's tree, and the failure must be *clipping*, not a selector miss — assert the element exists
  first, then that it scrolls. **Plus a CONTROL**: the PWA Designer at `/pwa/<id>` is legitimately viewport-locked
  and must NOT gain a page scrollbar. A fix that makes everything scroll is not a fix.
- **Change.** Give the workbench its own vertical scroll container rather than removing `fullBleed` — the graph
  panels genuinely are viewport-locked, and the layout's comment is describing a real design, just not one the page
  implements. Retire `calc(100vh - 320px)` for a flex-based measure, since the magic number is the same class of
  unchecked assumption.
- **Mutants.** `W1-the-scroll-container-loses-its-overflow` (KILLED by the new spec) and
  `W1-CONTROL-the-designer-gains-a-page-scrollbar` (must be KILLED by the control case — proving the control is not
  decorative).
- **Also.** Add `static/favicon.png`. No mutant: an asset's existence is not a behaviour, and minting a check for
  it would be the "more names is a weaker bar" error.

### W-2 — durable persistence

- **Red first.** A test that constructs a workbench engine against a temp file, writes an Undertaking, disposes,
  reconstructs against the same file, and reads it back. Fails today because nothing accepts a path.
  **Plus a CONTROL**: the second construction must NOT re-seed — assert the seeded object count is unchanged, since
  a double-seed would make the round-trip *appear* to pass while silently doubling the workspace.
- **Change.** `workbench.ts` accepts a store path (env-configured; `:memory:` remains the default under
  `RPH_DEMO_MODE=test` so e2e determinism is untouched). `getEngine()` seeds only when the store is empty. A reset
  path that is explicit rather than a side effect of restarting.
- **Mutants.** `W2-the-seed-guard-always-reports-empty` (double-seed), `W2-the-store-path-is-ignored`.
- **Watch.** `sql-driver.ts:29-36` throws under Bun. The SvelteKit server runs under Node so this is fine in
  production, but any verification script must be `node`/`vite-node`, never `bun run`.

### W-3 — the PWA instantiates

> **AMENDED 2026-07-28, BEFORE ANY CODE WAS WRITTEN. The paragraph this replaces was wrong in three ways, and
> each was verified against the source rather than taken on report.** The original text is preserved in
> `git show 69b6f6f5`. It was written from the *names* of three commands and the *existence* of a cardinality
> enum, without reading either implementation — the same method that produced F-B's withdrawn finding two
> sections above, and it failed the same way.

**Correction 1 — `ProposeDecomposition` does not instantiate anything.** The original text said "wire
`ProposeDecomposition` / `ValidateDecomposition` to the surface" and expected PWUs to appear.
`packages/rph-application/src/handlers/decomposition.ts:39-72` calls `createObject` exactly once, with
`objectType: DECOMPOSITION_CONTRACT`. `childWorkUnitIds` is copied into contract state and into the event payload
and **is never iterated**. The handler in fact *requires the parent to exist already*
(`decomposition.ts:41-48`), which is the tell: a contract is written **over ids that already exist**.

The kernel's real order is the reverse of the roadmap's. Child PWUs are created **first**, by `ProposePwu`, each
carrying its own `parentWorkUnitId`; the contract is recorded afterwards. So W-3 is:

1. Walk the published PWA's composition tree and emit one `ProposePwu` per planned instance, children carrying
   `parentWorkUnitId`.
2. Then one `ProposeDecomposition` + `ValidateDecomposition` per parent that actually gained children.
3. All of it inside **one `dispatchBatch`**, so a partial tree is impossible.

**Correction 2 — the cardinality rule as written contradicted itself.** "`M1`/`C1` instantiate one … `C*`
conditional children are offered, not created" says two different things about `C1`. The ratified semantics are in
`packages/rph-contracts/vocab/canonical-vocabulary.json:65-75`: *"M1 mandatory-exactly-one; M+
mandatory-one-or-more; C1 conditional-zero-or-one; C+ conditional-zero-or-more."* The mandatory minimum is **1 for
M1 and M+, 0 for C1 and C+**. W-3 instantiates M1→1, M+→1, C1→0, C+→0, and a permitted child carrying no rule
defaults to M1.

**Correction 3 — one clause cannot be built the way it is written, and the reason is a defect.** *(Heading
amended 2026-07-29: it read "not buildable at all", which this same paragraph contradicts three sentences
later.)* "M+/C+ instantiate one and **offer more**" cannot amend a contract once it exists.
`reviseDecomposition` is declared `(ctx, command)` — **no payload parameter** (`decomposition.ts:277-289`) —
while `ReviseDecompositionPayloadSchema` declares `childWorkUnitIds`, `obligationAllocations` and
`constraintPropagations` (`packages/rph-contracts/src/messages.ts:406-411`). None is applied to the contract;
the handler only advances status to `SUPERSEDED` and bumps `semanticVersion`. So W-3 offers further children as
an affordance that records the parent link **on the PWU** (`parentWorkUnitId`, already folded by
`professional-work-graph.ts`) and does not amend the contract. **This is recorded as finding F-I above, not
skipped.**

*Two claims in this paragraph were checked in 2026-07-29's verification and both need qualifying. First,
"silently discarded" was too strong for the event and too weak for the object: the fields are written verbatim to
an unread event log in defiance of that event's own strict schema, and are never applied to the aggregate — see
F-I. Second, a **second** `DecompositionContract` naming the same parent IS accepted today
(`dwp03-precondition-coverage.test.ts:318-325`), so "amend" is not the only conceivable route — but nothing
constrains a parent to one live contract, no gate enforces supersede-before-propose, and no projection consumes
a second one, so that route is unguarded rather than available. **W-3 built neither**, and the deferred
affordance is carried as part of F-I.*

- **Red first.** An e2e that creates an Undertaking from the seeded published PWA and asserts — against
  `/test-api/introspect` engine ground truth, not the DOM — that the Undertaking owns **8** PWUs. The seeded root
  permits seven children, every one `M1` (`seed-workbench.ts:62-70`), so root + 7 = 8. **The seed is a
  discriminating fixture and that is why the number matters**: `Architecture Definition` permits one child at `C+`
  (`seed-workbench.ts:92`), so an implementation that instantiates everything permitted reports **9**, and one
  that ignores cardinality entirely also reports 9. Fails today reporting **0**.
- **Controls.** Three, because the roadmap's single control is too weak to kill the mutants: (a) a PWA whose root
  permits no children instantiates exactly one PWU — not zero, not a fabricated child; (b) a depth-2 fixture with
  an `M+` and a `C1`, proving the walk recurses and that `M+` yields one rather than zero or many; (c) a PWA whose
  root permits a child type that does not resolve — which **publishes cleanly today**, because `definePwuType`
  never checks that `permittedChildTypeIds` resolve — proving the batch is atomic when `ProposePwu` refuses
  mid-tree.
- **Mutants.** `W3-cardinality-is-ignored-every-permitted-child-is-instantiated` (reports 9),
  `W3-the-walk-does-not-recurse`, `W3-the-tree-is-dispatched-non-atomically`. **One victim each** — and no mutant
  may name a unit spec and an e2e spec together: `isE2eTarget` (`scripts/mutants/run.ts:333-341`) treats a mixed
  set as a declared error and throws, aborting the whole run.
- **Known collateral, to be amended in the same change.** Four existing e2e specs assume a new Undertaking owns
  either nothing or one PWU. `undertaking-pwu.e2e.ts` asserts `toHaveLength(1)` and then indexes `pwus[0]`, which
  becomes the auto-instantiated root; `undertaking-scope.e2e.ts` asserts its probe shows "No traceability links",
  false once it owns PWUs; `pwu-lifecycle.e2e.ts` and `undertaking-atomicity.e2e.ts` use bare
  `Begin & Execute` locators that go strict-mode-ambiguous against eight PROPOSED rows.
- **Binds.** The `O-4` closure matrix (§2.4.1, 18 unbound) and §2.4.2's derivation obligations.
- **Does NOT bind the conservation obligations, and W-3 must say so.** `ValidateDecomposition`'s P2/P3 guard reads
  the parent's `obligationIds` / `constraintIds` (`decomposition.ts:147,176`), and every surface path hardcodes
  both to `[]`. The validation will pass trivially on every tree W-3 can build. That is acceptable for W-3 and it
  is **vacuous**, so `decomposition-conservation.test.ts` being green must not be read as covering the surface.

### W-4 — the risk profile is authored

- **Red first.** A test asserting that no code path writes a `riskProfile` the caller did not supply. Fails today
  against `+page.server.ts:590-596`. This is the shape that matters: not "the UI has a dropdown" but **"the surface
  cannot mint a governed value."**
- **Change.** `riskProfile` becomes a required input at the instantiation moment W-3 creates. Absent a
  professional's judgement the PWU is **not proposed** — the same fail-closed posture §16 takes elsewhere. The
  `boundaries` placeholder stays, with its DOC-002 §9.1 warrant kept in place.
- **Mutants.** `W4-an-unsupplied-risk-profile-defaults-to-MEDIUM` (the exact defect, restored),
  `W4-the-tier-selection-ignores-the-authored-profile`.
- **Binds.** `O-8-R4` and its neighbours in §2.8.3.

### W-5 — the disclosure plane

- **Red first.** An e2e asserting a PWU with recorded `residualUncertainty` renders it, and — per `O-8-R2`,
  *"absence of a disclosure SHALL be reportable, not merely undetectable"* — that a **count** of rendered
  disclosures is available and is compared against expected, so a surface that silently renders none fails rather
  than passing quietly. **Plus a CONTROL**: a PWU with no residual uncertainty must render the *absence*
  distinguishably, not an empty region indistinguishable from "not yet assessed".
- **Change.** A disclosure region on the workbench carrying residual uncertainty, provenance, and staleness. Every
  field traced to a real read path — a field with no populated source is not rendered, per `O-8-R4`.
- **Mutants.** `W5-the-disclosure-region-renders-nothing`,
  `W5-an-empty-uncertainty-list-renders-as-absence-of-uncertainty` (the two are not the same claim, and conflating
  them is the defect `O-8-R7` names).
- **Binds.** §2.8.3's disclosure obligations (17 unbound) and §6.3's surface disclosure register (7 unbound).

---

## 4. Verification

`bun run gate` in full after each work package: check-types, lint, boundary, build, both test modes, coverage
against the ratchet, svelte-check, e2e, and `mutants` with `KILLED_UNNAMED` blocking.

Every new mutant lands in the **`SURFACE`** coverage layer that DR-001's S-3 established at commit `b06dfa99` —
this is the first programme of work able to hold `apps/rph-demo` to the same bar as the kernel, and W-1 is its
first real exercise beyond S-3's own control entry.

**One victim per mutant.** A longer list is a lower bar, and `verif/mutant-ledger.test.ts` now enforces it.

---

## 5. What this roadmap does not do

- **It does not close S-2.** It makes the blocked fraction of the 397 closable, and binds what each package makes
  bindable. The unblocked remainder — the §2.9.x field-contract tables — is untouched citation work.
- **It does not ratify SPEC-001.** Ratification is a sponsor act under CON-000 B2, and its §12.3 precondition
  stands until S-2 reaches zero.
- **It does not build the help / Rosetta system** (F-H), which needs a design note first.
- **It does not repair the recorded-not-repaired list** — the 11 §11.4 citation slips, the two §§1–10 corrections
  owed (§3.7's "thirty e2e specs" against 28 measured; §2.8.4's false claim that DOC-003 carries no Question
  object, contradicted by `JPWB-DOC-003:84`), the two fixture ids with no §10 body, and the five unbound disclosure
  codes. These remain open and are recorded here so they are not lost.
