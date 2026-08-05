# DESIGN — the de minimis floor's declared scope (REG-F-024)

**Date:** 2026-08-05 · **Status:** proposed, for the increment that follows this note · **Supersedes:** REG-F-024's own account of its blocker, in three places.

---

## 1. What REG-F-024 said, and what is actually true

REG-F-024 records that wiring the ratified §5.1 applicability determination as a precondition on
`RequestAssuranceAssessment` **refused 54 drives**, the reference undertaking failing at step #47 on an
`EVIDENCE` subject under `floor.schema-invariant`. That measurement stands. Its **explanation does not**, and the
explanation is what has been blocking the fix.

The entry says the mismatch is not the drive's fault because `seedFloorPolicies` scopes all three floor policies
to `PROFESSIONAL_WORK_ARCHITECTURE`, *"and its own comment says why: the single-value `applicableObjectTypes`
limitation is §16-unresolved; the plane-agnostic array is a later reconciliation."*

Three things are wrong with that, and I wrote all three.

**(a) There is no single-value limitation, and there never was.** The field is
`applicableObjectTypes: z.array(ProfessionalWorkObjectTypeSchema)` — a required array of the ratified 22-value
object-type enum. The vocab entry says nothing about §16 or single values; its only note records the DOC-002
→ DOC-007 rename from `targetTypes`. **The array was available the whole time.**

**(b) The comment was wrong when written, not stale.** `git log -S` puts it in `3162083a`, *the same commit*
that introduced the seeding it describes — so it never described a constraint that had since been lifted. It
described one that did not exist.

**(c) The test fixture already does the right thing.** `__tests__/floor-fixtures.ts::seedFloorPolicies` seeds
`['PROFESSIONAL_WORK_ARCHITECTURE', 'PROFESSIONAL_WORK_UNIT', 'ARTIFACT']`. Somebody needed the broader scope,
wrote it, and it worked. **Production seeds one type; the fixture seeds three.** So the tests have been passing
against a floor scoped more honestly than the one that ships.

I took a code comment as evidence of a contract constraint and did not read the schema — while writing up a
finding about transcriptions used as evidence. That is the same error as REG-F-026 group (b)'s note, made in
the register entry that was supposed to be the careful account.

## 2. §16 item 23 is real, and it forbids the current behaviour

The comment's gesture at "§16-unresolved" pointed at something that exists. Item 23 is
**"Mandatory assurance-floor representation and broader coverage/topology"**, and it is genuinely open: current
contracts *"do not fully freeze material-boundary identity/classification, locked inherited policy assignment,
producing-Attempt/context and protected-transition binding…"*.

But what item 23 leaves unresolved is **which transformations are material** — not which object types a policy
may name. And its own guidance is a direct instruction on this case, verbatim:

> **Never interpret the missing wire shape as permission to omit or hide the floor.**

Scoping the floor so that it does not reach PWUs, Artifacts or Evidence, and citing the unresolved wire shape as
the reason, is exactly the reading item 23 forbids. **The narrow scope is not a neutral placeholder awaiting
reconciliation; it is the thing the ratified item rules out.**

## 3. The real shape: the floor's DECLARED scope contradicts its ENFORCED scope

`floor-gate.ts` — the §8.4 step-4 protected-transition gate, reused by the authoring plane's `PublishPwa` and the
execution plane's `completeExecutionStep` — **never reads `applicableObjectTypes` or `applicability` at all.** It
requires the hardcoded `FLOOR_POLICY_IDS_REQUIRED` triple and asks whether the subject's recorded floor
assessments are satisfied or waived.

So the floor is **already universal in enforcement and narrow only in declaration**, and the two disagree. The
declaration is the wrong one: §8.4 scopes the floor by *"every material professional transformation"* and never
enumerates object types at all.

## 4. Why broadening is monotone-safe

This is the property that makes the fix small, and it needs stating because "widen the floor's scope" sounds like
it should make more things mandatory:

- **The gate's requirement set is independent of applicability.** Broadening cannot add a required assessment,
  because nothing consults the field when deciding what is required.
- **The only consumer of applicability is the precondition**, and `applicabilityPermitsAssessment` refuses only
  on `NOT_APPLICABLE`. Broadening therefore **permits strictly more and requires strictly nothing more.**

The 54 refusals were caused by a false declaration, not by a genuine scope conflict. Correcting the declaration
removes them without changing what the engine demands of anyone.

## 5. Decision

**D-1 — Derive the floor's declared scope from the ratified enum rather than listing types.**
`seedFloorPolicies` will declare `applicableObjectTypes` as every `ProfessionalWorkObjectType` value, read from
`ProfessionalWorkObjectTypeSchema.options`. Rationale:

- **Over-declaration is the safe error here and under-declaration is the forbidden one.** Item 23 forbids
  omitting or hiding the floor; it forbids nothing about declaring it broadly. Given §4's monotonicity, a type
  named needlessly costs nothing operationally, while a type omitted silently exempts real work.
- **A derived list cannot rot.** A hand-written list of 22 goes stale the day a 23rd object type is added — and
  the failure mode is silent under-declaration, i.e. the forbidden direction. This is the same reason the
  fixture's three-type list is *also* wrong: it was right for what its authors needed and is already missing
  `EVIDENCE`, which is what step #47 tripped on.
- **It does not resolve item 23 and must not claim to.** Material-boundary classification stays open. This
  declares only that *no governed object type is outside the floor's reach*, which is §8.4's own position.

**D-2 — A gate holding declared ⊇ enforced.** The divergence that produced this finding is invisible from either
side alone: `seedFloorPolicies` looks deliberate, `floor-gate` looks correct, and only comparing them shows the
contradiction. A test will assert that every object type the floor gate can be invoked on is inside the floor
policies' declared scope, deriving both sides rather than restating either.

**D-3 — Then wire the precondition**, which is REG-F-024's actual deliverable, and confirm the 54 refusals are
gone — with the reference undertaking's step #47 named as the specific case that must now pass.

**D-4 — Correct the record in place.** REG-F-024's entry, `seed-workbench.ts`'s comment, and `assurance.ts`'s
withdrawal comment all repeat the false limitation. Each is corrected where it stands, per the standing practice
of striking rather than deleting, because the wrong account is what made this look like a ratification blocker
for a week.

## 6. What this deliberately does NOT do

- **It does not decide materiality.** Item 23's open question is untouched.
- **It does not change the floor gate.** The enforced scope was already right.
- **It does not touch the additive catalog policies.** Their scope is authored per-policy from the ontology
  (`appliesToPwuKinds`, delivered under REG-F-022's second instance) and is a different question.
