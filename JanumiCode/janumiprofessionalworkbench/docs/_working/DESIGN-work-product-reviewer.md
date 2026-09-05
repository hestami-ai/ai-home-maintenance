# DESIGN — a reviewer that can read a work product

**Status:** DESIGN (pre-roadmap) · **Date:** 2026-09-05 · **Programme:** `JAN-WPREVIEW`
**Follows:** `REG-F-355` (the floor runs over a work product; the reviewer cannot read one)
**Sponsor:** *"Proceed."*

---

## 1. The one thing left

`REG-F-355` left the floor running over a work product and blocking with `INCONCLUSIVE`, because the offline
reviewer judges a **PWA graph export** and a work product is not one. Everything else — facts, subject,
recording, gate, remediation — is built. **This is the reviewer.**

## 2. ⛔ The shortcut this design must not take, named first

`REG-F-355`'s own e2e names its mutant: *"teach the offline reviewer to pass any parseable work product, at
which point 'assured' would mean a JSON parse."* ⭑ **That is the failure mode, and it is not hypothetical:**
this exact file's docblock records that both of its unreadable arms *"used to return SATISFIED with zero
findings — a control that cannot fail, sitting inside the assurance floor."*

**So the offline arm must perform REAL structural checks and record what it did not check.**

## 3. Design

### 3.1 The offline arm judges structure, and says so

Mirroring the graph arm exactly — which judges structure, passes a well-formed graph, and is *"honest about
its limits"*:

| Arrangement | Criterion | Why that criterion, in its own words |
|---|---|---|
| not parseable | — | `INCONCLUSIVE` via the existing `unreadable()`: a reviewer that could not read its subject has not reviewed it |
| parses to **nothing** (no string content) | **`RR-04-no-proxy-satisfaction`** | *"No proxy or surface satisfaction that conceals the underlying problem."* ⭑ Something was produced and nothing was said — surface satisfaction exactly |
| **every** value merely echoes the prompt | **`RR-01-no-problem-substitution`** | *"The result genuinely discharges its delegated obligation rather than substituting an easier problem."* ⭑ Restating the question instead of answering it IS the substitution |
| otherwise | — | `SATISFIED`, **with a recorded LIMITATION** that only structure was judged |

⭑ **Both criterion ids are REAL and their wording fits** — read from the policy, not invented. Inventing one
would attribute a failure to a criterion that says nothing about the thing, which the `unreadable()` docblock
already refuses for parsing.

### 3.2 ⚠ `SATISFIED` here means less than it sounds, and the record says so

The limitation is not decoration. Without it, a structurally-sound work product would be recorded as having
passed a *reasoning* review, when what passed was a shape check. **The limitation is what keeps the word
honest**, and `ASR-11` requires a valid result to identify its limitations anyway.

### 3.3 Echo detection, and why it does not false-positive

**Every** string value must appear within the prompt for the echo arm to fire — not *any*. The demo's own
deterministic fixture returns `{workProduct: 'Assessment complete.', basis: <prompt fragment>}`: one value
echoes and one does not, so it is **not** an echo. ⭑ **A test pins that**, because an echo rule that flagged
the fixture would be discovered by breaking the demo rather than by reasoning.

### 3.4 Selection

The registry picks the work-product arm when the subject's `objectType` is `ARTIFACT`. **One validator, two
arms**, rather than a second registered validator — the policy is the same policy, and `ASR-4` says a policy's
meaning is stable across validator replacement.

## 4. Boundaries

No new criteria · no new policy · no invented criterion ids · the graph arm untouched · the real (`agy`)
reviewer's work-product prompt is **not** in this increment and is recorded as owed · no CSAA.
