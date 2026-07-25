# JAN-EXEBIND-DS-001 — Runtime Binding Authority: Design

*v0.1.0 · 2026-07-25 · Provenance: the three findings **JAN-EXECREM WP-16's conformance gate raised on its first
run** (`JAN-EXECREM-RESIDUALS.md` §5, N-1/N-2/N-3). Roadmap: `JAN-EXEBIND-DR-001`. Sponsor authority: the
standing "Proceed" (JAN-ROADMAP-001).*

---

## 1. Why this exists

`RPH-EXE-003`, `RPH-EXE-004` and `RPH-EXE-005` are **ratified rules whose statement is a command refusal**. Each
is implemented as a correct, unit-tested pure predicate in `packages/rph-domain/src/execution.ts`. **Each is asked
by nothing**, and the M12 conformance manifest certified the whole `RPH-EXE` family COVERED — *"RPH-EXE-001..009
by id"* — on the strength of those unit tests.

That is `F-28`'s shape (RPH-PWU-010, ratified and enforced nowhere while certified COVERED) three more times, in
the same family. It was not found by a review. It was found by the register WP-16 built **because** F-28 happened,
which is the first evidence that the anti-recurrence mechanism does the thing it was built for.

## 2. What the register got WRONG, and why that matters more than the fix

`JAN-EXECREM-RESIDUALS.md` §5 dispositioned two of the three, and **both dispositions were false**. I wrote them,
and I wrote them the same way both times: I searched, found nothing, and recorded the absence as a property of
the world instead of a property of my search.

| Row | What I recorded | What is actually true |
|---|---|---|
| **N-2** (EXE-004) | *"Enforcing it needs a runtime capability plane … that does not exist in this engine at all."* | **The plane exists.** `RUNTIME_BINDING` is a first-class aggregate with an id prefix, a registry entry and a five-state ratified machine; `RequestRuntimeBinding` / `AuthorizeRuntimeBinding` / `DenyRuntimeBinding` / `RevokeRuntimeCapability` are all live in `registry.ts`; the object carries **both** `requestedCapabilities` and `grantedCapabilities`. What is missing is not the plane — it is the **identity of a capability** (§3.3). |
| **N-3** (EXE-005) | *"the transition it would guard is unreachable"* | True, and **not the operative blocker**. `InputBindingSchema` is `z.record(z.string(), z.unknown())`, so *"a step whose required input artifact is absent"* has nothing to quantify over. The rule is unenforceable even where the transition IS reachable. |

Both are the failure mode this codebase has now hit seven times: **"not defined / does not exist" is a claim about
the search, not about the world.** It is recorded here rather than quietly corrected, because a register whose
entries are wrong in the *reassuring* direction is worse than no register — it converts an open hole into a closed
one on paper. The correction is WP-B0.

**What the register got right:** all three rules really are unenforced, and the gate really did catch them. The
error was in the *reasons*, which is exactly the part a gate cannot check.

## 3. Current state, verified

### 3.1 RPH-EXE-003 — buildable today

> *"Starting execution with a runtime binding still in REQUESTED is rejected (runtime binding authorization
> required)."*

Everything the rule quantifies over is ratified and typed:

- `ExecutionStep.runtimeBindingId?: string` — the step names its binding.
- `RuntimeBinding.authorizationStatus` — a **ratified enum**: `REQUESTED | AUTHORIZED | PARTIALLY_AUTHORIZED |
  DENIED | REVOKED`, with a real machine and four live commands.
- `bindingPermitsExecution(status): Check` — the ready kernel, already correct, already unit-tested, with the
  ratified code `RPH_BINDING_NOT_AUTHORIZED`.

**Nothing needs authoring. The check is a load and a call.** This is the one clean fix in the family.

### 3.2 The second limb nobody has asked for — `authorizedRuntimeBindingIds`

JAN-EXECREM WP-14 persisted `EXECUTION_PLAN.authorizedRuntimeBindingIds` precisely because *"nothing could read it
back to check that a step's binding was among the ones the activation authorized, and any rule citing it would
have been dead on arrival."* **It is still read by nothing.** WP-14 made the fact available; it did not make it
load-bearing, and a field that is written and never read is one refactor away from being deleted as unused.

This is a **distinct** authority from §3.1 — *is this binding authorized at all* versus *did THIS activation
authorize this binding* — and it gets its own row, its own code and its own kill test. A binding can be
`AUTHORIZED` and still not be one the sponsor's activation decision covered.

### 3.3 RPH-EXE-004 — the plane exists; the SUBJECT does not

> *"When a binding requests file-system and network access but only file-system is granted, network operations
> fail authorization."*

Two separate obstacles, and conflating them is what produced the wrong disposition:

1. **The operation-time limb is genuinely unbuildable.** No command in this engine performs a capability-bearing
   operation, so there is no site at which "network operations fail authorization" could be evaluated. That half
   stands deferred, and honestly.
2. **The grant-time limb is a REAL, LIVE hazard, and it is not RPH-EXE-004.** `authorizeRuntimeBinding`'s `mutate`
   is `{...base, grantedCapabilities: p.grantedCapabilities ?? []}` — **the payload's grant set is written
   wholesale with no comparison against `requestedCapabilities`**. A binding may therefore be granted a capability
   it never requested. The handler's own comment names this hazard ("*a second actor could grant capabilities the
   binding never REQUESTED (§22.1 — requested is not granted)*") and then guards only the **re**-authorization case
   with `fromStates`. The **first** authorization is unconstrained. The ratified machine's own guard on
   `REQUESTED → AUTHORIZED` reads *"requested capability is NOT granted capability; capability scope must be
   explicit (§22.1)"* — **and no code enforces it.**

**But it cannot be built yet either, and here is the real blocker.** `CapabilityRequestSchema` and
`CapabilityGrantSchema` are both `z.record(z.string(), z.unknown())`, and the vocab says why:

```
"name": "CapabilityGrant",
"fields": [{ "field": "(undefined)", "type": "—",
             "note": "Referenced by RuntimeBinding.grantedCapabilities. NOT field-defined
                      (persistence: capability_grants §31). Source TBD." }]
```

**The ratified corpus never defines what a capability IS.** There is no declared identity key, so "granted ⊆
requested" is not expressible. And the kernel predicate proves the gap independently: `capabilityAuthorized` takes
`{grantedCapabilities: readonly string[], requiredCapability: string}` — **strings** — while the contract holds
`Record<string, unknown>[]`. *The predicate and the contract it is supposed to guard do not typecheck against each
other.* That mismatch has been sitting in the repo unremarked since M11, and it is the tell: nobody ever tried to
connect them, which is exactly how a predicate stays dead.

### 3.4 RPH-EXE-005 — the same root cause

> *"Starting a step whose required input artifact is absent leaves the step not ready and performs no model/tool
> invocation."*

`InputBindingSchema` is `z.record(z.string(), z.unknown())`, vocab-annotated *"Referenced by
`ExecutionStep.inputBindings` (DOC-002 §21). **NOT field-defined. Source TBD.**"* A rule about "the required input
artifact" has nothing to quantify over. The command-unreachability of `NOT_READY`/`READY` (disclosed as F-27) is a
second, independent blocker — but the subject gap is the one that would survive fixing the machine.

### 3.5 The root cause behind BOTH deferrals, stated once

`RPH-EXE-004` and `RPH-EXE-005` fail for **one** reason, and it is the mechanism this whole remediation lineage
keeps meeting:

> **A guard cannot be non-vacuous while one of its inputs is unrepresentable.**

That sentence is F-01 verbatim — `RPH-EXE-006` evaluated `hasOutput || !hasOutput` because the contract had no
field for the second fact. WP-1's fix was to author `NoOutputResult`. Here the same shape appears **one level
up**: the input is unrepresentable because the *corpus itself* declares the shape `Source TBD`, not because the
vocab forgot a field. Authoring it is therefore not a contract chore — it is **inventing normative semantics the
ratified corpus deliberately withholds**, which is a sponsor decision, not an implementer's.

Four helper sub-types sit in this state: `InputBinding`, `OutputBinding`, `CapabilityRequest`, `CapabilityGrant`.
Every one of them is referenced by a ratified rule. **This is a finding about the corpus, not about the code**,
and §4-R3 rules on it.

## 4. Rulings

- **R1 — Build RPH-EXE-003 now.** Nothing is authored; the kernel, the enum, the machine and the field all exist.
  A step naming a binding that is not `AUTHORIZED`/`PARTIALLY_AUTHORIZED` may not start.
- **R2 — Build the allowlist limb (§3.2) with it, as a SEPARATE declared authority.** WP-14's field becomes
  load-bearing or it should not have been persisted. Distinct code, distinct kill test; it must be provable that
  R2 refuses where R1 accepts, or the two rows are one row wearing two names.
- **R3 — Do NOT author `CapabilityRequest` / `CapabilityGrant` / `InputBinding` shapes.** They are `Source TBD` in
  the ratified corpus. Authoring them invents normative semantics the corpus withholds, and this programme's own
  standard (`JAN-EXECREM-RESIDUALS.md` §2) is that authored extensions are labelled, narrow, and anchored to a
  ratified statement — none of which is satisfiable when the anchor says "Source TBD". **Escalate as a corpus
  gap.** RPH-EXE-004's grant-time limb and RPH-EXE-005 stay `UNENFORCED_DISCLOSED`, with §3.3/§3.4's *real*
  reasons replacing my wrong ones.
- **R4 — The unconstrained first grant (§3.3 item 2) is a NEW finding in its own right**, and it is not
  RPH-EXE-004. Record it as such rather than filing it under a rule whose statement is about operations. Calling
  it RPH-EXE-004 would be the same substitution — evidence for one rule accepted for another — that this
  programme exists to stop.
- **R5 — An ABSENT `runtimeBindingId` is OUT OF SCOPE of RPH-EXE-003, not a fail-open.** The rule's antecedent is
  *"with a runtime binding"*. A step naming no binding is not a step whose binding is unauthorized. This is
  load-bearing, and **measured rather than asserted**: the reference seed authors no `RUNTIME_BINDING` at all, and
  a mutant that refuses the absent case fails **34 of the 69** engine tests. *(The first measurement reported a
  false GREEN — `rph-engine` resolves `@janumipwb/rph-application` to its built dist, so mutating src without
  rebuilding proves nothing. Recorded because the claim was right and the evidence was worthless, which are
  different things.)* "The rule as ratified does not cover it" remains the honest reason; the seed is the
  consequence, not the justification. **Disclosed:** an AI step running unbound remains governed only by
  `executionAttempts`' existing *advisory* (`aiNoBinding`), which gates nothing. Recorded in §8, not hidden.

## 5. The fix

One resolution site, `startExecutionStep`'s precheck, evaluated **after** the declared authority limbs
(`planLiveness`, `pwuOpenness`) and **before** the source-state check — the position every other per-command
precheck already occupies, so no existing refusal changes which code a caller sees.

```
bindingAuthorityRefusal(ctx, command, plan, step, stepId) : Refusal | null
  1. step.runtimeBindingId absent/empty       -> null      (R5: outside the rule's antecedent)
  2. id does not resolve to a RUNTIME_BINDING -> REFUSE    RPH_VALIDATION_SEMANTIC_FAILED  (fail-closed)
  3. bindingPermitsExecution(status) fails    -> REFUSE    RPH_INVARIANT_VIOLATION         (R1 / RPH-EXE-003)
  4. id ∉ plan.authorizedRuntimeBindingIds    -> REFUSE    RPH_INVARIANT_VIOLATION         (R2 / §15.3)
```

**Correction to an earlier draft of this section, and the reason it is worth stating.** This design first named
the code for limb 3 as `RPH_BINDING_NOT_AUTHORIZED`. **That is not a ratified wire code** — `RphErrorCodeSchema`
is a closed 15-value enum and does not contain it. `RPH_BINDING_NOT_AUTHORIZED` is the *kernel's* label, returned
in `Check.errorCode` by `bindingPermitsExecution`, and the two vocabularies are different things. The established
pattern (JAN-EXECREM WP-11, `validateStepCompletion`) is to refuse with a **ratified** wire code and carry the
**kernel** code into the message, so a caller can tell the limbs apart and a test can name which cell it killed.
Limb 3 therefore returns `RPH_INVARIANT_VIOLATION` with `(RPH_BINDING_NOT_AUTHORIZED)` in the message. Limb 2
mirrors `pwuOpennessRefusal`'s unresolvable case exactly, code included, because it is the same situation: an
execution act whose authority cannot be *read* cannot be authorized by it.

Limbs 3 and 4 share a wire code, which is exactly why WP-16's discipline requires **distinct markers** — the code
alone could never separate them, and a probe asserting only the code would prove that *something* refused.

Ordering rationale: 3 before 4 so the *ratified* rule is what refuses an unauthorized binding, and the authored
allowlist limb only ever refuses a binding that is otherwise fine. Reversing them would let the authored rule mask
the ratified one — and then RPH-EXE-003's kill test would be vacuous, which is the defect class, reintroduced by
its own fix.

**Registered, not just written.** Both limbs become `ENFORCED` rows in `enforcement-register.ts` with distinct
≥20-character markers and probes observed through `Engine.dispatch`, and RPH-EXE-003's manifest citation moves to
the COMMAND layer. WP-16's gates then hold this fix the same way they hold WP-12b's.

## 6. Conflicts

- **C-1 — the register's own totality gate fires.** Flipping N-1 from `UNENFORCED_DISCLOSED` to `ENFORCED` is a
  compile error until a probe exists (`PROBES` is a total `Record` over the id union). *That is the mechanism
  working*, and it is why WP-B0 (the record correction) must land in the same series and not before it.
- **C-2 — the call-site census goes RED by design.** `bindingPermitsExecution` gains a production caller, so its
  `referencedOnlyBy` assertion fails. The row must be re-dispositioned, which is precisely the tripwire WP-16
  built. **A green build here would mean the census is broken.**
- **C-3 — the reference seed.** No seed step names a binding, so R5 keeps `rph-engine` at 69. Any drift is a real
  regression, not an expected adjustment.

## 7. Enumerated behaviour changes

`StartExecutionStep` on a step whose `runtimeBindingId` names a binding that is `REQUESTED`, `DENIED` or `REVOKED`
→ **REFUSED** (`RPH_INVARIANT_VIOLATION`, message carrying the kernel's `RPH_BINDING_NOT_AUTHORIZED`). On a step
whose binding id does not resolve → **REFUSED** (`RPH_VALIDATION_SEMANTIC_FAILED`). On a step whose binding is
authorized but absent from the plan's activation allowlist → **REFUSED** (`RPH_INVARIANT_VIOLATION`). Everything
else is unchanged; `PARTIALLY_AUTHORIZED` remains startable, per the ratified kernel.

## 8. Residuals, disclosed

1. **An unbound step is still ungoverned.** R5's scope decision is honest but leaves the hole: a `MODEL_INVOCATION`
   step with no `runtimeBindingId` starts freely. `executionAttempts`' `aiNoBinding` advisory sees it and gates
   nothing. Closing it means ruling that AI step types *require* a binding — a new rule, not this one.
2. **`RPH-EXE-004`'s grant-time hazard remains live.** A first authorization may grant a capability never
   requested. Blocked on R3 (the corpus gap), not on effort.
3. **`RPH-EXE-004`'s operation-time limb and `RPH-EXE-005` remain unenforceable**, for §3.3/§3.4's reasons.
4. **Four ratified helper sub-types are `Source TBD`.** Escalated, not fixed.
5. **`capabilityAuthorized`'s signature does not match its own contract** (`string[]` vs `Record<string,unknown>[]`).
   Left as-is deliberately: changing it would imply a capability-identity convention, which is R3's to decide.

## 9. Exit criteria

WP-B0…B3 delivered; RPH-EXE-003 and the allowlist limb `ENFORCED` and **observed through `Engine.dispatch`** with
distinct markers; the manifest citation at the COMMAND layer; `bindingPermitsExecution`'s census row
re-dispositioned; `JAN-EXECREM-RESIDUALS.md` §5 corrected with the real reasons and the new finding (R4) added;
the reference seed drives unchanged (`rph-engine` 69); full gate green; **every new guard live
mutation-red-proofed**, including a proof that R2 refuses where R1 accepts.

---

*`READY_TO_BUILD` — 3 rules examined, 1 buildable, 2 blocked on a corpus gap that is escalated rather than
papered over, 1 new finding raised, 2 of my own register entries corrected. Roadmap: `JAN-EXEBIND-DR-001`.*
