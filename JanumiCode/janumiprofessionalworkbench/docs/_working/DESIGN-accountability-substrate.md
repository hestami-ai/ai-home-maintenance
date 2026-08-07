# DESIGN — The accountability substrate

**Authority:** REG-D-025 (standing directive, 2026-08-06). **Method:** the directive's mandated
adversarial corpus pass — 12 agents, 2.0M tokens, measure-then-refute, run **before** any authoring.

---

## 0. The directive's hypothesis, tested and upheld

The sponsor's ground for mandating a corpus-first pass was that *"the document corpus has thought
through a lot of these scenarios… the implementation has not followed as closely."*

**Measured across six axes: almost the entire accountability substrate is RATIFIED AND UNBUILT.**
The pieces that genuinely need authoring are three, and they are narrow. Everything the sponsor asked
for — *"the ability to track identities and roles"* so Platform can *"just plug in"* — already has a
ratified shape sitting in the corpus, and in three cases a **declared, persisted field that nothing
ever writes.**

---

## 1. Ratified and unbuilt (transcribe)

### 1.1 ⚠ The engine skips the first two obligations of every command handler

**RPH-DOC-002 §27.2 "Required command behavior"**, verbatim:

> Every command handler must: **1. authenticate actor; 2. authorize requested operation;** 3. load
> aggregate; **4. check expected revision;** 5. validate preconditions; 6. enforce invariants;
> 7. produce one or more domain events; 8. persist events atomically; …

`Engine.dispatch` has six stages — identity *presence*, envelope schema, payload hash, idempotency,
payload schema, handler route. **Steps 1 and 2 are absent as pipeline stages**, and step 4 is
conditional (§1.4). Reinforced by **JPWB-DOC-004 §5** (*"derive tenant and principal context from
authenticated context, never from a payload's claim about itself"*), **JPWB-DOC-003 §9 PER-3**,
**RPH-DOC-009 §3.7** (*"authenticated commands"*), **RPH-DOC-007 §39** (*"Human decisions require
authenticated identity"*).

**And it was already found once.** `JAN-ROADMAP-001-v2/W0/evidence/divergence-register.md` records
it verbatim — *"the corpus mandates authentication on governed commands… with **no**
production-only/demo exemption ↔ JPWB: **no authenticating boundary exists**"* — and nothing acted
on it. This is REG-F-047 at its true scope.

### 1.2 ⚠ `causationId` answers the cascade question, and nothing writes it

**RPH-DOC-007**, verbatim: *"`correlationId` groups one professional operation across services.
**`causationId` identifies the command or event that caused this command.**"*

Declared on **both** envelopes (`envelopes.ts:83`, `:105`) and **persisted** to the events table
(`sqlite-storage-adapter.ts:213`). **Writers: zero.** Measured on the reference undertaking:
`causationId` 0/332 events, `provenance.sourceEventIds` 0/88 objects.

**This settles the one concern I raised against the sponsor's cascade ruling without authoring
anything.** I argued that a cascade acting as its triggering actor would make the record say a human
performed acts they did not, and proposed inventing a derivation marker. **The corpus already
separates the two axes** — `issuedBy` is *who the act is attributed to*, `causationId` is *what act
caused it*. A cascade contesting a claim records Alice as actor and her invalidation as cause. That
is exactly *"who did what, when, why, where, how"*, and it has been specified and unpopulated the
whole time. **Sixth instance this week of an instinct to invent where transcription was available.**

### 1.3 The role socket is ratified twice and used nowhere

`ActorReference.roleId` appears in **RPH-DOC-002 §5** and **RPH-DOC-007 §6** (both the TypeScript
interface and the JSON Schema). Production writes: **zero**. Production reads: **zero**.

That is precisely the *"ability to track identities and roles"* the directive asks for — already
ratified. Note `record-assurance.ts:38` records a deliberate refusal to *synthesize* a `roleId` from
a label, on §8.12 grounds; the socket must be **fed from authenticated context**, never invented,
which is the same rule as §1.1.

### 1.4 ⚠ `expectedRevision` is ratified MANDATORY and enforced only when volunteered

Ratified in four places, including §27.2's step 4 and **RPH §28.1** (*"All aggregate mutations
require an expected revision"*) and **JPWB-DOC-003 §9 PER-4** (*"Optimistic concurrency; never
last-write-wins"*). The envelope declares it `.optional()`; the check runs only
`if (command.expectedRevision !== undefined)`; **zero of the production command-producing sites set
it.** So the ratified concurrency contract is inert by default — a caller opts *in* to being
protected.

### 1.5 `ValidatorContract.implementationType: EXTERNAL_SERVICE | HUMAN` — ratified, unbuilt

**RPH-DOC-004 §4.1**, with its schema file named in **RPH-DOC-007 §3**. A second genuine plug-in
seam, and the one that lets a human or an external service satisfy an assurance obligation — which
is what the enterprise scenarios need. (`RuntimeBinding`, RPH-DOC-002 §22, is the seam that **is**
built.)

---

## 2. ⚠ The foreseeable race the directive names

The sponsor: *"Race conditions… we should make every attempt to avoid when it is foreseeable that a
design path might cause such a situation."*

**The design path is already in the code, and I added two instances of it today.** Every handler
performs cross-aggregate reads **outside any transaction** (20 `readAllEvents()` sites) and then
commits with a compare-and-swap on **one** aggregate. Nothing detects a stale cross-aggregate read;
the result is a fully legitimate-looking governed record.

- `claimsWithAdmissibleEvidence` (INC-2) — folds evidence, then commits the claim. Evidence
  invalidated between fold and commit ⇒ a claim recorded SUPPORTED on evidence that is no longer
  admissible, **which is the precise state ASR-8 exists to forbid.**
- `contestedClaimsAgainstBaselineItems` (INC-3) — derives contested claims, then commits the
  baseline. A claim contested between derivation and commit ⇒ promotion proceeds.

**Neither is protected by `expectedRevision`, because the aggregate they read is not the aggregate
they write.** §1.4's remedy does not reach this; **RPH-DOC-009 §30.2**'s does — *"domain event;
saga/controller; compensating actions; explicit intermediate states."*

---

## 3. Genuinely absent (authoring required, and narrow)

1. **The signature of the trust boundary.** The corpus ratifies that the gate must exist and what
   Platform supplies; it does not specify the parameter's shape. **AUTHORED.**
2. **A binding rule that a derived act SHALL carry its causation.** The field is ratified; the
   obligation to populate it on a derived act is not. **AUTHORED** — and it is the rule that makes
   §1.2 enforceable rather than merely available.
3. **A ports-and-adapters integration contract.** `packages/rph-ports` is repository invention; no
   ratified sentence names it. **AUTHORED** — and it should stay minimal, since the two ratified
   seams (§1.5, RuntimeBinding) are the ones that carry actual obligations.

---

## 4. ⚠ A corpus-internal conflict, flagged not resolved

**JPWB-DOC-003 §3** (Common object contract) requires that every authoritative semantic object carry
*"…creating/updating actor, time, and provenance; **tenant and organization scope**; authority or an
authority reference where professional effect requires it…"*

**JPWB-SPEC-001 §1.4 N-9** (ratified) declares tenant/organization identity **not governed** here.

Both are ratified. The object contract demands a field the specification says is out of scope, and
the code has neither (`tenantId`/`organizationId`: zero occurrences). **This is the first genuine
candidate for the amendment process REG-D-025 authorizes** — and it is exactly the seam the sponsor's
pluggability ruling touches, so it is raised for a ruling rather than resolved by preference.

Also corrected: **REG-E-006's framing is partly wrong.** The two-plane architecture *and* edition
tiering are carried in **ratified JPWB-DOC-001 §8**; only the three named editions, the trust tiers,
and the stack are Executive-Overview-only.

---

## 5. Sequence

Accountability is the substrate, so it goes first, smallest-first, each increment separately
acceptable:

1. **`causationId` written on every derived act** — needs nothing new; closes the cascade concern.
2. **The symmetric revoke guard** (REG-E-031 ruled) — one guard, one control.
3. ~~**`expectedRevision` required** where the engine can supply it — the ratified default restored.~~
   **⚠ STRUCK 2026-08-07 (REG-F-050): an engine-supplied expectation is `x !== x`.** The handler compares the
   field against the same single read it would have been filled from, so the check could never fail — and this
   line contradicts §1.4 above, which correctly locates the gap at the CALLER. **Replaced by: implement
   JPWB-SPEC-001 §11.4.22 FORK-22** (ratified, REG-D-023), which binds the SURFACE to set `expectedRevision`
   from the projection's `derivedAtSubjectRevision` — a caller-side value that is literally *"the revision they
   believe current"*, and the one thing the engine cannot fabricate. SPEC-001 also names the check
   (`SPEC-001-FX-FRESH-18`), its assertion, a census over `workbench.ts`, and a red-proof mutant. Zero of it is
   implemented; SPEC-001 says so itself.
4. **The trust-boundary parameter** — `issuedBy` derived rather than asserted (§1.1). The largest.
5. **`roleId` + `AuthorityReference` fed and read** — the identity/role sockets (REG-E-027).
6. **The cross-aggregate read race** (§2) — needs §30.2's tier; sequenced last because it is the
   only item with no ratified mechanism in place.
