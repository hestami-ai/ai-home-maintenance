# DESIGN — the execution feedback loop, bounded

**Status:** design, pre-roadmap. Implements the increment `REG-D-059` licensed and left OPEN.

---

## 1. The ruling, and what it said was missing

**Sponsor (`REG-D-059`), verbatim:** *"the automated reviews / policies … are fed back into the executing agent
of the PWU so that it may attempt to address the identified findings. However, that could go in loops so there
is expected to be a loop detection capability … At some point — say two loops or three — there would be an
escalation to the relevant human(s)."*

That entry already measured the ground and named the gap precisely:

> **"So three of the four parts exist**: feed-back, guidance, and a human-escalation arm. **What is missing is
> the LOOP** — a bound greater than one, and the classification that decides when to stop."

⭑ And it named the order: *"the reasoning review over work products; **then the loop**, bounded by the
flaw-trend classifier; then escalation."* The review landed (`REG-F-355`/`356`). **The loop is next, and it is
next by a ruling rather than by preference.**

⭑⭑ The paper the sponsor supplied corroborates the shape independently: Netflix's Phase III puts one judge in
**two roles — "quality gating and reflective generation."** Gating and feeding back are one judge's two jobs.

## 2. ⭑ What already exists — four parts, not three

`REG-D-059` counted three. A fourth turned up on measurement:

| Part | Where | State |
|---|---|---|
| Feed-back + guidance | `classifyFloorRemediation` → `REFINE_SUBJECT`, `autoRefine: true`, structured findings | ✅ **subject-agnostic** — reads codes and dispositions, *never prose* |
| Human escalation arm | `ESCALATE_REVIEW` | ✅ modelled |
| Independence arm | `CHANGE_REVIEWER` | ✅ modelled |
| ⭑ **Repair-try machinery** | `ExchangeRole = 'initial' \| 'retry' \| 'reformat' \| 'repair'`; `ExchangeDisposition` includes `'repair-requested'` | ✅ **already used by the reviewer's own repair path** |

⭑ So a repair try is already a first-class record shape, with `PER-9`'s rule that *"each retry, reformat, and
repair request"* is its own record, and CSAA-007's *"repair never rewrites predecessor raw output"* enforced
structurally by passing the predecessor RECORD rather than its id.

**What is genuinely absent is the bound and the classifier.** That is the whole increment.

## 3. The classifier — and what must NOT be ported

`REG-D-059` did this analysis already and it holds:

- ✅ **The flaw-count trend ports.** `CONVERGING` / `STALLED` / `DIVERGING` are computed from the high-severity
  finding count across tries, and JPWB's `ASSURANCE_OBSERVATION`s carry severity.
- ⛔ **`SCOPE_BLIND` and the tool-call-loop signal must NOT be ported.** Both key on tool-call history, and a
  JPWB execution step invokes **no tools** — `MODEL_INVOCATION` is the only step type. A signal derived from an
  empty history reads as "no loop" forever: **a check that cannot fail**, which this repository has shipped
  before and now names as a defect class.

⭑ **Three states, not four**, and the omission is recorded as a measurement about *this* system rather than as
an oversight.

## 4. ⛔ INCONCLUSIVE must never feed back — and there is a gap

`REG-D-059` is explicit, and it is the substantive half of the ruling:

> *"`INCONCLUSIVE` — the reviewer could not tell — must not feed a finding back to the agent, because there is
> no finding. `ASR-11` limb 1 says it in terms: a validator failure 'neither rejects nor satisfies the subject.'
> **Feeding an inconclusive review back as though it were a critique would manufacture work from silence.**"*

⚠ **The existing guard is partial.** `classifyFloorRemediation` excludes *operational* codes
(`VALIDATOR_EXECUTION_FAILED`, `INDEPENDENCE_VIOLATION`) from `findings`, so a boundary-rejected review yields
none. But its `REFINE_SUBJECT` arm keys on `disposition !== 'SATISFIED' && subjectFindings.length > 0` — so an
**`INCONCLUSIVE` review that nonetheless carried subject-coded observations would feed back.** With the offline
reviewer that cannot arise; with a live one it can, because the model chooses the disposition.

⭑ **This design closes it explicitly rather than relying on the reviewer's good manners.**

## 5. The loop

```
try 1 ─ produce ─ review ─ SATISFIED? ─ done
                     │
                     └─ REFINE_SUBJECT + autoRefine ─ classify trend
                                                        │
                          CONVERGING & tries < bound ────┴─ feed findings back → try n+1
                          STALLED / DIVERGING ──────────── stop, ESCALATE_REVIEW
                          tries = bound ────────────────── stop, ESCALATE_REVIEW
```

**Bound: 3 tries** (the sponsor's *"say two loops or three"* — three attempts, i.e. the initial plus two
repairs). ⚠ Configurable, but with a **default that exists**, unlike the model: a bound is a safety property of
the harness, not a deployment choice about quality, so `REG-D-052`'s refuse-on-absence does not apply here.

**The findings are appended to the producer's next prompt** — not the reviewer's prose wholesale, but the
structured `{code, statement}` pairs `classifyFloorRemediation` already returns. ⭑ The producer is told what
failed and asked to address it; it is *not* told how, because that would be the harness doing the professional
work.

⚠ **Each try is its own exchange record** with `role: 'repair'` and a predecessor, and the artifact of a
superseded try is not rewritten — `PER-9` and CSAA-007 both require it, and both are already implemented.

## 6. What this does NOT do

- ⛔ **No unsticking agent.** The sibling project's `unstickingAgent.ts` (Socratic elicitation + environmental
  detective) is a second agent with workspace access. Out of scope, and its environmental mode has nothing to
  read on this plane.
- ⛔ **No human escalation *route*.** `ESCALATE_REVIEW` is reached and recorded; where it goes is the sponsor's
  own *"possibly getting a bit far afield"* and stays intent.
- ⛔ **No judge lifecycle.** Drift detection and rubric re-tuning (the paper's Phases I/II/IV) are a programme.
