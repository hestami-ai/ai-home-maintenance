# JAN-CAPBIND-DS-001 — Authoring the Four Source-TBD Sub-Types: Design

*v0.1.0 · 2026-07-26 · Closes **N-5**, and with it **N-2** (RPH-EXE-004), **N-3** (RPH-EXE-005) and **N-4**.
Sponsor grant: authoring these shapes is authorized; a commit of the code is the authorization of the change.
Predecessors: `JAN-EXECREM-RESIDUALS.md` §5 (the findings), `JAN-EXEBIND-DS-001` §4-R3 (which escalated rather than
authored), `docs/_working/AUDIT-placeholder-helpers.md` (which established that these four are genuinely undefined).*

---

## 0. THE FIRST THING TO CHECK WAS WHETHER THERE WAS A GAP AT ALL

N-5 says four ratified helper sub-types are `Source TBD`. Before authoring anything I had to establish that the
corpus really is silent, because **this repo has a documented instance of exactly the opposite mistake.**

`m1-object-fields.json` line 2131 records it:

> `ApplicabilityRule` — *"**RATIFIED AFTER ALL** — audit 2026-07-16. DOC-004 §5.1 (L267) contains
> `interface ApplicabilityRule { … }` defining: objectTypeConditions, … The previous note said 'NOT field-defined …
> Source TBD' **WHILE CITING THIS SECTION** — the harvest pass reached inside this very interface, took its enums,
> and recorded its fields as nonexistent. A pass that extracts one kind of thing reports the absence of every other
> kind."*

So `Source TBD` in that file is **not** evidence of a corpus gap; it is evidence of what one harvest pass found. And
my four notes are *citation-bearing* — `CapabilityRequest` cites "persistence: `capability_requests` §31",
`InputBinding` cites "DOC-002 §21" — which is the precise pattern that produced the `ApplicabilityRule` error.
Authoring over a ratified interface would be far worse than leaving the gap: it would put invented semantics into a
contract while a ratified definition sat unread.

**Verified three independent ways. The gap is real.**

1. **`docs/_working/AUDIT-placeholder-helpers.md` (2026-07-16)** already ran this exact check with method: all 34
   `z.record(z.string(), z.unknown())` helpers audited against the **full 14-file corpus** rather than the
   DOC-002/DOC-007 pair; one agent per type; a mention, a field whose *type* is the helper, and a schema filename in
   an index all explicitly disqualified; every positive attacked by two adversarial refuters requiring a unanimous
   verdict; all 9 survivors re-verified by hand. It found 9 ratified-after-all and **25 genuinely undefined — and
   `CapabilityGrant`, `CapabilityRequest`, `InputBinding` and `OutputBinding` are all four in the undefined list.**
   It says of them: *"the restraint on these was **correct**"*.
2. **I read the cited sections myself**, because the audit is still a panel of the same kind of thing I am:
   - **§31** is a **bare list of table names** — `runtime_bindings`, `capability_requests`, `capability_grants` — with
     no columns anywhere. A table name is not a field definition; the audit's disqualification holds.
   - **§21's ExecutionStep interface** declares `inputBindings: InputBinding[]` / `outputBindings: OutputBinding[]` —
     a **usage**, the disqualified category. `InputBinding` itself is never defined.
3. **No other definition exists**: searching the whole corpus for these four type names returns only usages inside
   interfaces plus the §31 table list.

**So this is genuine authoring, and every field below is marked `DERIVED` with a citation or `AUTHORED` with a
justification.** Nothing is presented as ratified that is not.

---

## 1. WHAT THE CORPUS DOES SAY — the derivation basis

The corpus withheld the **field lists**. It did not withhold the **concepts**, and a shape that ignores what the
ratified prose says about the concept is also an invention. Every quote below is verbatim, and every one constrains
the authoring.

### 1a. §22.1 Runtime invariants — seven ratified sentences, and four of them shape these types

> * Requested capability is not granted capability.
> * **Capability scope must be explicit.**
> * **Secret access must never be inferred from tool availability.**
> * Runtime Binding changes increment revision but not necessarily PWU semantic version.
> * **Privilege expansion requires a new authorization event.**
> * Revoked bindings cannot be used for new attempts.
> * Model output is treated as untrusted external input.

This is the single most important source, and it is **normative, not descriptive**:

- *"Capability scope must be explicit"* is a **requirement on the field list.** A capability that carries no scope
  violates a ratified invariant. `scope` is therefore DERIVED, not invented — the corpus withheld its *type*, not
  its existence.
- *"Secret access must never be inferred from tool availability"* requires that a capability's **kind** distinguish
  secret access from tool availability. A single opaque capability string cannot satisfy it, because granting a tool
  would be indistinguishable from granting the secret it uses.
- *"Privilege expansion requires a new authorization event"* requires that **granted ⊆ requested be decidable** —
  otherwise "expansion" is not a defined notion — and forbids widening a grant in place. This is exactly N-4.
- *"Requested capability is not granted capability"* is RPH-EXE-004 and requires the two sets be **separately
  represented and comparable**.

### 1b. RPH-EXE-004's full statement NAMES CAPABILITIES

> `{ "id": "RPH-EXE-004", "statement": "When a binding requests **file-system and network access** but only
> **file-system** is granted, **network operations** fail authorization (requested capability is not granted
> capability).", "layer": 3, "sourceRef": "§12" }`
> — `packages/rph-domain/vocab/m12-conformance.json:124`

The conformance catalog is ratified, and its statement is far more specific than N-5's summary suggested. It gives:

- **two concrete capability kinds by name**: file-system and network;
- the **mechanism**: request a set, grant a subset, and an *operation* outside the granted subset fails
  authorization;
- the **granularity**: authorization is asked per *operation*, so a capability must be identifiable at the point of
  use.

A shape that cannot express "requested {file-system, network}, granted {file-system}" cannot satisfy the rule's own
example. This is the tightest constraint in the design.

### 1c. RPH-EXE-005's full statement

> `{ "id": "RPH-EXE-005", "statement": "Starting a step whose **required input artifact** is absent leaves the step
> **not ready** and performs **no model/tool invocation**.", "layer": 3, "sourceRef": "§12" }`
> — `packages/rph-domain/vocab/m12-conformance.json:125`

An `InputBinding` must therefore express (i) that an input is **required**, and (ii) **which artifact** it refers to
— otherwise "the required input artifact is absent" has no subject. Two fields, both forced.

### 1d. §21.1 Step invariants

> * A step cannot run until preconditions are satisfied.
> * A succeeded step must record outputs or an explicit no-output result.
> * Every tool or model invocation must produce provenance.

The first is RPH-EXE-005's kernel (`stepMayBecomeReady`). The second is already enforced (RPH-EXE-006, WP-11) and
tells us `outputBindings` is about *declared* outputs rather than recorded results — the recorded result travels on
the completion command. That distinction keeps `OutputBinding` from duplicating `structuredResult`.

### 1e. The RuntimeBinding interface — capabilities are SANDBOX-scoped runtime permissions

> ```typescript
> interface RuntimeBinding extends ObjectEnvelope {
>   objectType: 'RUNTIME_BINDING';
>   executionStepId: string;
>   roleId: string;
>   modelSelectionPolicy: ModelSelectionPolicy;
>   requestedCapabilities: CapabilityRequest[];
>   grantedCapabilities: CapabilityGrant[];
>   sandboxPolicy: SandboxPolicy;
>   contextAssemblyPolicyId: string;
>   observabilityPolicyId: string;
>   memoryPolicyId?: string;
>   authorizationStatus: 'REQUESTED' | 'AUTHORIZED' | 'PARTIALLY_AUTHORIZED' | 'DENIED' | 'REVOKED';
> }
> ```

The company these fields keep is evidence. A binding is *a role invoking a model inside a sandbox*, so its
capabilities are the runtime permissions of that sandbox — which is consistent with §12's Execution Plan defining
"tools" and "**runtime permissions**", and with `ExecutionStep.stepType` including `MODEL_INVOCATION`,
`TOOL_INVOCATION` and `RETRIEVAL`.

Note also `PARTIALLY_AUTHORIZED`: a ratified status that only makes sense if a grant can be a **strict subset** of a
request. The status is ratified evidence for the subset semantics, and RPH-EXE-004's example is the paradigm case.

### 1f. The two kernel predicates already tell us the comparison

> `export function capabilityAuthorized(input: CapabilityCheckInput): Check {`
> `  if (input.grantedCapabilities.includes(input.requiredCapability)) return { ok: true };`
> — `packages/rph-domain/src/execution.ts:292`, with
> `CapabilityCheckInput = { grantedCapabilities: readonly string[]; requiredCapability: string }`

**The much-cited "type mismatch" resolves in the predicate's favour.** N-5 records that `capabilityAuthorized` takes
`string[]` while the contract holds `Record<string,unknown>[]`, and calls this a sign that predicate and contract "do
not typecheck against each other". They do not — but the predicate is **right**: it compares capabilities by a
stable **identity**, which is what RPH-EXE-004's example requires ("only file-system is granted" is an identity
comparison). What is missing is an identity ON the contract type for a caller to project. The fix is therefore to
give the sub-types an identity field and let the call site pass `granted.map(g => g.capabilityId)` — **not** to
loosen the ratified kernel to accept opaque bags.

> `export function stepMayBecomeReady(preconditionsSatisfied: boolean): Check {`
> — `packages/rph-domain/src/execution.ts:312`

It takes a **boolean**, so RPH-EXE-005's "required input artifact is absent" must be **RESOLVED by the caller**. This
is the F-30 shape precisely: WP-12 found `hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId`, where a governed
act was satisfied by any non-empty string. Passing `!!step.inputBindings.length` here would repeat it exactly. The
caller must resolve *"is every required input artifact present in the store?"* and pass that.

### 1g. Refusal codes are constrained

`RphErrorCodeSchema` is a closed 15-value enum (`packages/rph-contracts/src/errors.ts:9`) and contains **neither**
`RPH_CAPABILITY_NOT_GRANTED` **nor** `RPH_PRECONDITION_UNSATISFIED`. Both are kernel labels and must travel in the
refusal **message**, with a ratified code carrying the refusal — the WP-11 discipline, already applied to
`RPH_BINDING_NOT_AUTHORIZED`.

---

## 2. Rulings (to be finalised against the workflow's adversarial findings)

*This section is authored against the evidence above and then attacked. The land order, the four field lists, and the
N-2/N-3/N-4 enforcement sites are recorded in §3–§6 once the adversarial pass has run — deliberately, so that the
shapes are argued before they are typed, and so the record shows which of them survived attack rather than only what
was finally written.*

**Standing constraints every ruling must satisfy**, each earned by a defect in this lineage:

| # | Constraint | Why — the defect that earned it |
|---|---|---|
| C1 | New fields OPTIONAL wherever a stored object or event could lack them | WP-1's invariant; RW-7 broke it by declaring `cause` required and forgetting replay |
| C2 | The reference seed must keep working | mutant `B5` exists to prove that refusing the absent-binding case makes every existing plan unstartable |
| C3 | Enforce at a COMMAND site, observable through `Engine.dispatch` | F-28: a pure-predicate test is not enforcement, and the manifest certified three rules on that basis |
| C4 | No refusal whose remedy the engine forbids | the §15.3 allowlist limb was an unrecoverable wedge and had to be withdrawn |
| C5 | Resolve facts; never accept a truthiness test for a governed act | F-30: `!!waiverOrRevisionId` let `'x'` retire a mandatory step |
| C6 | Ratified code + distinct 20-char marker; kernel labels in the message | the enforcement register gates marker uniqueness so two rows cannot be satisfied by one refusal |
| C7 | Every guard gets a NAMED test that goes RED under a declared mutant | CON-000 B7; and the ledger's `expectRed` makes "something caught it" distinguishable from "this test caught it" |
| C8 | Mutate the CONSEQUENCE, not the condition | V-2c: `if (false)` makes blocks dead and TypeScript stops narrowing, so 14 mutants proved nothing |

### 2a. What the EXISTING DATA already decided for me

Reading every producer, not just the contracts:

- **`inputBindings` and `outputBindings` are `[]` in every fixture in the repo** and the reference seed authors no
  RuntimeBinding at all. So those two shapes have a clean slate — nothing to break.
- **The capability arrays already have a de-facto shape.** Fixtures dispatch
  `requestedCapabilities: [{ capability: 'fs.read' }]`, `[{ capability: 'file-system' }]`,
  `grantedCapabilities: [{ capability: 'shell.exec' }]`. An authoring that named the identity field anything other
  than `capability` would break all of them for no reason. **The field name is therefore settled by precedent, not
  by preference.**
- **And those values are in two dialects** — `'file-system'` (which matches RPH-EXE-004's ratified wording verbatim)
  and `'fs.read'` / `'shell.exec'` (a dotted convention from nowhere). Two vocabularies for one concept in one repo,
  which is a finding in its own right (recorded below as **N-10**), not something to standardise silently.

### 2b. RULING R-A — `capability` is the IDENTITY, and the kernel predicate was right all along

N-5 records the `string[]` vs `Record<string,unknown>[]` mismatch as evidence that "the predicate and the contract it
guards do not typecheck against each other", implying one of them is wrong. **The predicate is right.**
`capabilityAuthorized` does `granted.includes(required)` — an identity comparison — and RPH-EXE-004's own example
*is* an identity comparison ("only file-system is granted"). What was missing is an identity **on the contract type**
for a caller to project. So: give the sub-types a `capability` identity, and let the call site pass
`granted.map(g => g.capability)`. **Loosening the ratified kernel to accept opaque bags would have been the wrong
repair, and it is the one the "mismatch" framing invites.**

### 2c. RULING R-B — scope must be EXPLICIT, and explicitness is decidable while narrowing is not

§22.1 ratifies *"Capability scope must be explicit."* That is a requirement on the field list, so `scope` is derived.
But note precisely what is and is not decidable:

- **Presence is decidable.** "Explicit" literally means *stated*, and a command can refuse a capability entry that
  states no scope. This is enforced at `RequestRuntimeBinding` / `AuthorizeRuntimeBinding`.
- **Narrowing is not.** Whether a granted scope is *narrower than* a requested scope requires a scope algebra the
  corpus does not define. Inventing one would be the invention this design exists to avoid, and it would be
  undecidable for free text in any case.

So the subset rule (below) compares **capability identity**, and `scope` is required-to-be-stated but **not
machine-compared**. That limit is DISCLOSED as a residual rather than hidden behind a comparison that looks
authoritative and is not.

`scope` is **optional in the schema and required at the command boundary** — C1 forces the first (a stored binding
written before today has no scope and must still parse) and §22.1 forces the second. That split is the only
arrangement that satisfies both, and it is the same arrangement RW-7 arrived at for `cause` after getting it wrong.

### 2d. RULING R-C — REFUSE to author `OutputBinding`

**No rule quantifies over an `OutputBinding`'s fields.** RPH-EXE-006 ("a succeeded step must record outputs or an
explicit no-output result") is about the *completion payload* — `structuredResult`, `outputArtifactIds`,
`noOutputResult` — not about this declaration. The only thing any code reads is the array's **length**:

> `declaresOutputBindings: Array.isArray(outputBindings) && outputBindings.length > 0`

Authoring fields for it would therefore be pure invention with **zero** enforcement value — a shape asserting
professional meaning nobody ratified and nothing checks. It stays `z.record(z.string(), z.unknown())`, and N-5's
disposition for it becomes *"deliberately opaque, no rule blocked, verified"* rather than *"Source TBD"*.

**That is a closure, not a dodge**: N-5's harm was that four types were *undispositioned*, so nobody could tell an
unauthored shape from an unauthorable one. Three are authored because rules need them; one is declared opaque
because no rule does, and the difference is now on the record with the evidence.

### 2e. RULING R-D — the subset rule makes `PARTIALLY_AUTHORIZED` mean something, and closes N-6 as a side effect

This is the design's central move, and every part of it is ratified.

`RuntimeBinding.authorizationStatus` ratifies **five** states including `PARTIALLY_AUTHORIZED`. That state is only
coherent if a grant can be a **strict subset** of a request — and RPH-EXE-004's example *is* that case: requested
{file-system, network}, granted {file-system}. Meanwhile N-6 records that **no command can drive a binding into
`PARTIALLY_AUTHORIZED`**, so a ratified state was unreachable and `bindingPermitsExecution`'s acceptance of it was
untestable through the bus.

Both follow from one rule at one site — `AuthorizeRuntimeBinding`:

| granted vs requested | disposition | why |
|---|---|---|
| granted ⊄ requested | **REFUSED** | §22.1 *"privilege expansion requires a new authorization event"* — granting what was never asked for IS expansion, and doing it inside an authorization of something else is expansion without its own event. This is **N-4**. |
| granted ⊇ requested | `AUTHORIZED` | the request was met in full |
| granted ⊂ requested | `PARTIALLY_AUTHORIZED` | the ratified state, now reachable — **N-6** |

So one precondition plus one status derivation closes **N-4**, makes **RPH-EXE-004** decidable at a command boundary,
and closes **N-6**. The mechanism is `ALL_OF(fromStates(…), predicate(…))` — `PredicateInput` already carries
`{ state, payload, command, read }`, so the comparison needs no new machinery.

**What this does NOT claim.** RPH-EXE-004's statement is literally about *"network operations fail authorization"* —
an operation-level check. The engine governs *plans*; the actual model/tool invocation happens outside it, and there
is no command representing "perform a network operation". So what becomes enforced is the rule's **decidable core at
the command boundary**: a grant may not exceed its request, and a binding is only `AUTHORIZED` when the request was
met in full. The operation-level half remains outside this engine's surface and is disclosed as such — stated this
way deliberately, because the *previous* record on N-2 claimed enforcement needed "a runtime capability plane that
does not exist", which was wrong, and the correction must not overshoot into claiming more than is true either.

### 2f. RULING R-E — N-3 resolves a FACT, never a truthiness test

`stepMayBecomeReady(preconditionsSatisfied: boolean)` takes a boolean, so RPH-EXE-005's *"required input artifact is
absent"* must be resolved by the caller. **Passing `step.inputBindings.length > 0` would reproduce F-30 exactly** —
the defect where `hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId` let the string `'x'` retire a mandatory
step. The caller must resolve *"does every required input binding name an artifact that RESOLVES in the store?"* and
pass that.

`required` defaults to **true** when unstated (`required ?? true`), matching WP-12's `mandatory ?? true`: an unmarked
input is treated as needed, because the fail-open reading lets a typo silently downgrade a requirement.

**The vacuous-negative hazard here is acute and named in advance.** `StartExecutionStep` already refuses on plan
liveness, PWU openness, binding authority, source state, and the start-gate. A test for this refusal must arrange an
ACTIVE plan, an open PWU, an authorized-or-absent binding, a QUEUED step whose predecessors are all
terminal-success, **and** a required input naming an unresolvable artifact — otherwise it passes because a different
guard fired, and would pass with this one deleted.

---

## 3. THE AUTHORED SHAPES

Every field carries its provenance. `DERIVED` means a cited ratified sentence or existing code forces it; `AUTHORED`
means nothing does and I am adding it, with the reason. **There are no `AUTHORED` fields below** — which is itself
the result worth reporting: once §22.1 and the two rule statements were read properly, the shapes fell out of the
corpus, and every candidate field that did *not* fall out was refused rather than invented.

### `CapabilityRequest` — what a binding ASKS FOR

| field | type | required | provenance | note |
|---|---|---|---|---|
| `capability` | `string` | **yes** | `DERIVED_FROM_CODE` + `DERIVED_FROM_RULE` | The comparable identity. Forced by every existing fixture (`{ capability: 'fs.read' }`) and by RPH-EXE-004's identity comparison. |
| `scope` | `string` | no *(schema)* / **yes** *(command)* | `DERIVED_FROM_CORPUS` | §22.1 *"Capability scope must be explicit."* Optional in the schema for replay (C1); refused at the command boundary when absent (R-B). |

### `CapabilityGrant` — what an authorization ACTUALLY CONFERS

| field | type | required | provenance | note |
|---|---|---|---|---|
| `capability` | `string` | **yes** | `DERIVED_FROM_CODE` + `DERIVED_FROM_RULE` | Same identity, so requested and granted are comparable — which is the whole content of *"requested capability is not granted capability."* |
| `scope` | `string` | no *(schema)* / **yes** *(command)* | `DERIVED_FROM_CORPUS` | §22.1, as above. Stated, not machine-narrowed (R-B). |

**Refused for both:** a `kind` enum (`FILE_SYSTEM` / `NETWORK` / `SECRET` / `TOOL`). It is tempting — RPH-EXE-004
names two of those and §22.1 distinguishes secrets from tools — but a closed enum would **forbid capabilities the
corpus never enumerated**, and §22.1's secret invariant is already satisfied *structurally* by the subset rule: you
cannot obtain secret access unless it was explicitly requested **and** explicitly granted, so it can never be
*inferred* from tool availability. An enum would add a taxonomy and subtract expressiveness, for a guarantee the
subset rule already provides. Also refused: `justification`, `grantedBy`, `expiresAt` — the first two are carried by
the authorizing event's own envelope, and the third would author an expiry semantics no rule asks for.

### `InputBinding` — what a step NEEDS before it can run

| field | type | required | provenance | note |
|---|---|---|---|---|
| `artifactId` | `string` | no | `DERIVED_FROM_RULE` | RPH-EXE-005's *"required input **artifact**"* has no subject without it. Optional because an input may legitimately be bound to something other than a recorded artifact; a binding with no `artifactId` is not *absent*, it is **not artifact-backed**, and only artifact-backed inputs are checkable. |
| `required` | `boolean` | no → **defaults true** | `DERIVED_FROM_RULE` | RPH-EXE-005 says *"**required** input artifact"*, so requiredness must be expressible. `required ?? true` mirrors WP-12's `mandatory ?? true`: fail-closed, so a typo cannot silently downgrade a requirement. |

**Refused:** a `name` / `role` label. Nothing reads it and no rule quantifies over it. It is the most plausible
invention here, which is exactly why it is refused — plausibility is not provenance.

### `OutputBinding` — deliberately left opaque

Per **R-C**. `z.record(z.string(), z.unknown())` stands, and the vocab note changes from `"Source TBD"` to a stated
disposition with the evidence: no rule quantifies over its fields, only its array length is read, and authoring it
would be invention with no enforcement value.

---

## 4. Land order

Contract changes land in ONE regeneration batch ahead of the fixes that use them — the WP-1 discipline, for the same
reason WP-1 had: emitting a field before the contract carries it makes every affected command reject at runtime.

| WP | Title | Delivers | Behaviour |
|---|---|---|---|
| **CB-0** | The vocab batch | the three shapes + `PruneCause`-style notes; `bun run gen`; `validate.test.ts` count updated | **neutral** — new fields optional, nothing emits them yet |
| **CB-1** | N-4 + N-6: the subset precondition and the derived status | `AuthorizeRuntimeBinding` refuses granted ⊄ requested; sets `AUTHORIZED` vs `PARTIALLY_AUTHORIZED` | **behaviour change**, 2 named red proofs + 3 mutants |
| **CB-2** | R-B: scope explicitness at the command boundary | `RequestRuntimeBinding` / `AuthorizeRuntimeBinding` refuse a capability entry stating no scope | **behaviour change**; updates the ~6 fixtures that omit scope |
| **CB-3** | N-3: RPH-EXE-005 enforced | `StartExecutionStep` resolves artifact presence and calls `stepMayBecomeReady` | **behaviour change**, red proof must clear five earlier guards (R-E) |
| **CB-4** | Registers + N-10 | `enforcement-register.ts` rows re-dispositioned ENFORCED with probes; RESIDUALS §1 A-8..A-10; N-10 recorded | records |

**Gate (`G-CAPBIND-001`)**: `bun run gate` — check-types · lint · boundary · build · test (dist) · test:coverage at
the armed thresholds · svelte-check · e2e · `mutants` with **0 SURVIVED and 0 UNANCHORED**. Plus, specific to this
series: the enforcement register's call-site census will go **RED by design** the moment `capabilityAuthorized` gains
a production caller, and that row must be re-dispositioned in the **same commit** — the discipline RW-6 wrote down
and then skipped.

---

## 5. RECONCILIATION — what the adversarial pass changed about the design above

§§2–4 were written from primary sources **before** the verification workflow reported, deliberately, so that it
would attack an authored design rather than supply one. It did, over 16 agents: six excavation lenses, three
independent proposals from different priors, three judges on distinct axes, a synthesis, and three adversaries. It
corrected me on one substantive ruling and out-engineered me on four mechanical points.

### 5a. **R-B IS WITHDRAWN — I over-authored `scope`.**

I derived a `scope` field from §22.1's *"Capability scope must be explicit"*, calling it forced by the corpus. **It is
not.** That sentence has two readings and I silently took one:

- **(a)** a capability entry must carry a distinct `scope` field — my reading;
- **(b)** the capability must be *named precisely enough to be explicit*, so the **identity carries the scope**.

The existing data votes for (b): every literal in the repo is a scoped identity — `'fs.read'`, `'shell.exec'` — not a
bare noun with a separate qualifier. Authoring a `scope` field therefore **picks a side in a question the corpus
leaves open**, and then makes it a *command-boundary obligation* every caller must satisfy — which is precisely what
my own adversary lens defines as invented semantics, and I wrote that lens two hours before writing R-B.

**`scope` is not authored.** §22.1's explicitness requirement is recorded as satisfied by (i) `capability` being
REQUIRED — an unnamed capability cannot be requested at all — and (ii) the subset rule, which makes access
un-inferable. **The alternative reading is DISCLOSED as an open question**, not resolved: if the sponsor reads §22.1
as demanding a distinct scope field, that is a ratification decision, and the shape below is designed to accept the
field later without a migration.

That leaves the authored surface at **one field per capability type** — and it is worth stating plainly that the
adversarial pass moved this design toward authoring **less**, not more.

### 5b. Four mechanical corrections I would have got wrong

1. **`gen-objects.ts` treats a one-field helper as a placeholder.** `isPlaceholder`'s third limb is
   `!FORCE_FULL.has(h.name) && h.fields.length < 2`, so a single-field authoring **silently stays a permissive
   `z.record` and buys no enforcement whatever.** `CapabilityRequest`/`CapabilityGrant` need explicit `FORCE_FULL`
   entries — whose own comment already sanctions exactly this ("emit as a full helper even with a single field").
   Without this the whole series would have appeared to land and enforced nothing: **a silent no-op wearing a
   contract change**, which is this lineage's signature defect.
2. **Padding to disambiguate would not have worked.** With `scope` refused, `CapabilityRequest` and
   `CapabilityGrant` are structurally identical, so TypeScript cannot tell a request from a grant. My instinct was to
   add a distinguishing field — but **shapes differing only by optional members stay mutually assignable**, so
   padding would be invention *and* ineffective. The real mitigation is that the containment predicate takes
   **named** parameters `{requested, granted}`, making a swap require a deliberate edit.
3. **N-4's check belongs in `advanceStatus`'s `guard` slot, not in an `allOf` precondition.** `kit.ts` evaluates
   precondition → guard → checkTransition, so `fromStates` still wins on a *re*-authorization and
   `command-reissue-guard.test.ts` stays byte-unchanged — no hand-ordered `allOf` to defend, and the existing
   vacuity in that file is not deepened.
4. **`capabilityAuthorized` must NOT be reused for the subset check.** Its input is
   `{ grantedCapabilities, requiredCapability }` — **single-operation containment**, a different question from
   set-⊆-set. Reusing it would be the wrong predicate wearing the right name, and — worse — would import it into a
   handler, tripping the enforcement register's call-site census while the rule it is cited for stayed unenforced.
   A new `grantedWithinRequest` predicate keeps that census honest.

### 5c. And it found a vacuous test on the way

`json-schema.test.ts` reads **exactly one** committed artifact (`ObjectEnvelope.json`) while its header claims *"the
committed `schemas/` artifacts must not have drifted"*. A missed regeneration of any other artifact is therefore
invisible to it. Recorded as **N-14**; the WP-0 gate extends it to the artifacts this series touches, which is the
minimum honest response to finding it while relying on it.

### 5d. Standing

The corrections are adopted. §3's tables are superseded for `CapabilityRequest`/`CapabilityGrant` (one field,
`capability`, required, `FORCE_FULL`), and `scope` moves from *authored* to *disclosed open question*. R-C
(refusing `OutputBinding`) and R-E (resolving a fact rather than a truthiness test for N-3) **survived attack
unchanged**.

### 5e. **R-D IS SPLIT — its subset half stands; its "closes N-6 as a side effect" half was over-reaching.**

R-D claimed one precondition at `AuthorizeRuntimeBinding` would refuse `granted ⊄ requested` **and** derive
`AUTHORIZED` vs `PARTIALLY_AUTHORIZED`, closing N-6 for free. **The first half is right and survived. The second is
wrong**, on evidence I did not check:

`m2-transitions.json` declares `REQUESTED → PARTIALLY_AUTHORIZED` with its **own trigger, "partial grant"** — a
distinct arrow, not a variant landing of the AUTHORIZED one. And `advanceStatus` takes a **single** `target`, so a
handler cannot conditionally land on a different state without changing the primitive. Deriving the status inside
`AuthorizeRuntimeBinding` would therefore make one command drive two ratified arrows while the machine says they have
different triggers — smuggling a state transition rather than declaring it.

So **N-6 is a PRECONDITION on N-2, not a side effect of it.** Reaching `PARTIALLY_AUTHORIZED` needs a real
`PartiallyAuthorizeRuntimeBinding` command: a vocab command entry, an event, a handler, and the machine arrow. That
is its own work package, and it is scheduled as one rather than absorbed. Until it lands, RPH-EXE-004's decidable
core is the **subset refusal alone** — which is still a genuine closure of N-4, and still more than existed before.

**The pattern in both 5a and 5e is the same and worth naming**: each time, I took a ratified sentence that admits two
readings and quietly resolved it in the direction that let me close more findings at once. Authoring under a grant
makes that failure *easier*, not harder, because the thing that would previously have stopped me — "I am not
authorized to decide this" — is gone, and nothing replaces it except the discipline of checking which readings exist.

### 5f. The open question the sponsor now owns, stated precisely

§22.1's *"Capability scope must be explicit"* is left **inexpressible, not merely unenforced**, and that is a
deliberate filing rather than an oversight. Minting a `scope` field requires choosing its value domain — a path set?
a host set? a resource-limit record? a structured object? — **and nothing in the corpus says.** If a `string` or
`string[]` were landed today and the corpus later ratified a structured object, the field would have to be
**replaced rather than extended**, and any data written in between is unmigratable. The empty default is the only one
that is safe in both directions.

The concrete cost, stated so it is not discovered later: **path- or host-limited grants — "file-system, but only
under `/tmp`" — cannot be expressed**, and that is very likely what §22.1 means.

**Nothing here is implemented yet.** The land order in §4 is superseded by the workflow's five-WP order, which
sequences the register/manifest/probe re-disposition into the *same commit* as the wiring — because the census
tripwire fires on the import alone, and shipping that across two commits is exactly the rot RW-6 wrote down and then
committed anyway.
