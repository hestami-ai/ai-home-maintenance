# DESIGN — the execution governance layer, measured whole (`JAN-EXECGOV`)

**Date:** 2026-09-08. Written at sponsor direction: *"This needs to be addressed holistically and systemically…
and not just a point fix while the wider issue remains unaddressed."*

---

## 1. What was measured

Four carrier surfaces and the ratified corpus, each with stated searches and positive controls. **142 declared
fields** across `RUNTIME_BINDING` (10), `PWU_TYPE`/`EXECUTION_STEP`/`EXECUTION_PLAN` (24), `ASSURANCE_POLICY`
and its sub-objects (79), and the authoring surface (39, overlapping).

⭑ Verified personally, not taken from the census: `STA-8`'s text, `REG-D-052`'s ruling, the absence of any
`RequestRuntimeBinding` dispatch, the `OUT_OF_SCOPE` fall-through, and the capability schema.

## 2. ⛔⛔ ONE RATIFIED RULE IS UNMET ON EVERY PRODUCTION EXECUTION

`STA-8` (`JPWB-DOC-003:203`), verbatim:

> *"Execution requires an approved plan and **authorized Runtime Bindings**, and high-risk irreversible
> execution requires plan approval before it begins."*

**No `RUNTIME_BINDING` is ever created.** `RequestRuntimeBinding` has **zero** production dispatch sites — its
only occurrence is a contract declaration at `messages.ts:3605`. **POSITIVE CONTROL, same form, same
population:** `ApproveExecutionPlan` → **4** production sites. Both production `ActivateExecutionPlan` call
sites pass `authorizedRuntimeBindingIds: []`.

⚠ **And the gate that would notice cannot.** `bindingAuthorityVerdict` (`rph-domain/src/execution.ts:279-280`)
returns `{ ok: true, limb: 'OUT_OF_SCOPE' }` when the step names no binding — correctly, since two absences mean
opposite things. But because *every* production step names none, **every step takes `OUT_OF_SCOPE`** and the
four binding checks are live, tested, and unreachable on real work.

⭑ **This is disclosed, not hidden.** The kernel says so itself: *"every plan in the reference seed — which
authors no RuntimeBinding whatsoever — permanently unstartable"* (`execution.ts:195-196`), and
`SPEC-001:10145` records the confirmed absence with its own control. What has NOT been done is state it as a
**standing breach of `STA-8`**, which is what it is.

## 3. ⛔ AND IT CANNOT BE FIXED WITHOUT A GRANT

Minting a binding requires naming at least one capability — `RequestRuntimeBinding` refuses an empty request
(N-20: *"a request for nothing is refused here, and only here"*) and `AuthorizeRuntimeBinding` refuses an
authorization granting nothing (N-22).

But a capability is `{ capability: z.string() }` — a **free string** — and its vocab note reads *"Helper
undefined (persistence: capability_requests §31)."*

⚠ **So the schema will accept anything, and that is exactly the danger.** Naming a capability
`'model.invoke'` would be **coining governed vocabulary** — the same act as minting
`CONTEXT_ASSEMBLY_POLICY`, which required `D-1`. The difference is that the schema stopped me last time and
will not stop me here. **A ratification act that nothing enforces is still a ratification act.**

## 4. ⛔⛔ WHAT MUST NOT BE WIRED — and this is the larger half of the finding

The instinct behind "make the layer govern" is right in one place and **wrong in most of them**. Canon has
deliberately declined to govern several of these, and implementing them would invent rules the corpus refused
to make.

| Carrier | Status | Evidence |
|---|---|---|
| **`modelSelectionPolicy`** | ⛔ **DO NOT WIRE** | `REG-D-052`, sponsor verbatim: *"We won't be pinning judge model because that will be selected based on performance parameters that have yet to be determined. Meaning that it will need to be configurable."* And `ASR-4`: prompts and models are *"runtime assets of the policy, never the policy itself."* Which model runs a step is **configuration**, by ruling. |
| **`ModelSelectionPolicy`'s shape** | ⛔ explicitly DEFERRED | `REG-005:31738` — *"`ModelSelectionPolicy` is DEFERRED, as `REG-D-048` requires be done explicitly. Grounds: no field shape anywhere in the corpus, no reader, no command that can set it."* |
| **"the declaration must match what ran"** | ⛔ **NOT A RULE** | `PER-9` requires recording *"the resolved provider, model, and version actually invoked"* — and canon **never requires declaring an allowed one, nor binds the two**. *"allowed and resolved"* occurs **once** in the whole corpus, in an observability section, with no stated consequence. Control: canon knows how to write identity-binding (`ASR-16`, *"exactly matching the reviewed version"*) — and did not write it here. |
| **context selection beyond constraints** | ⚠ doctrine, no invariant | `DEC-4`'s SCOPE binds context assembly **for mandatory constraints only**. Selection, prioritization, freshness and compression are assigned to Context Engineering (`DOC-001:154`) with no invariant behind them. |
| **`memoryPolicyId`** | ⛔ ratified field, no writer, no shape | Same class as `ModelSelectionPolicy`. |
| **`riskConditions`, `lifecycleTriggers`, `eventTriggers`, `semanticChangeConditions`** | ⛔ disclosed deferral | The kernel: *"ACTIVATION conditions (§5.3), not SCOPE conditions… activation is a separate concern and is not silently folded in here."* Element types *"DEFINED NOWHERE in the corpus."* |

⭑ **This is the systemic answer, and it is mostly a restraint.** The layer looks under-connected because much of
it was deliberately left open — a fork, a deferral, or a ruling that the value is configuration. **Wiring those
would not be a fix; it would be an implementer inventing governance.**

## 5. ⚠ The part that needs no grant: the authoring surface tells the author things that are not true

The sponsor's own case — *"the human user may use the UI to make manual changes as well"* — is where the
measurement bites hardest, because a setting a person edits and nothing reads is a **fiction presented as
control**. The authoring lane found the delta in both directions across 39 fields: 22 govern, and **11 are
settable-but-unread** (including `AssessmentCriterion.criterionType`, `evaluationMethod`, `mayBeNotApplicable`,
`requiredEvidenceIds`, `ASSURANCE_POLICY.evaluatorRole`, `evaluatedClaimTypes`, `findingDefinitions`).

⛔ **The remedy is NOT to wire eleven fields.** Several are legitimately descriptive, and some belong to
deferred concerns. The remedy is that **a surface must not present an unread setting as though editing it
does something** — which is a disclosure problem, not a wiring problem, and it is checkable.

## 6. Decisions

| # | Decision | Recommendation |
|---|---|---|
| **G-1** | **Grant to name capability vocabulary**, so a `RUNTIME_BINDING` can be minted and `STA-8` satisfied on the live path. | ⭑ The only decision that unblocks the one real breach. Smallest honest form: one capability per step type that a model invocation actually needs, named in the vocabulary with its note, exactly as `D-1` was handled. |
| **G-2** | Should the authoring surface **disclose** unread settings, or should the settings be removed from it? | ⭑ **Disclose.** Removal loses the author's intent; disclosure keeps it and stops the fiction. |
| **G-3** | `producer`-omission independence dodge (`REG-F-364`) | Sponsor's, still open. ⚠ Note it becomes far less urgent under `G-1`: a binding names the role that ran the step, so the producer becomes resolvable from the record rather than caller-supplied. |

⛔ **NOT proposed:** wiring anything in §4. Each would invent a rule canon declined to make, and the register
already records the deferral for most of them.
