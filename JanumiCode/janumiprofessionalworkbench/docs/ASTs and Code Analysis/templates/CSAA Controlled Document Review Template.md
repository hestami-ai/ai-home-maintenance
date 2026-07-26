# CSAA Controlled Document Review Template

**Template version:** `0.3.0`

**Status:** Stage A program-control template; mandatory starting point under `REG-D-017` / W0-16; not a Normative CSAA member

**Purpose:** Provide an independent, adversarial, evidence-bearing review of a proposed CSAA controlled document.

**Authority rule:** The obligation to use this as a preserved-field starting point derives from `REG-D-017` / W0-16. A review may recommend disposition; it never confers program status by itself, and adoption requires the separately performed and recorded authority act.

---

## 1. Review metadata

| Field | Value |
| --- | --- |
| Review ID | |
| Document ID/title | |
| Document version | |
| Content digest | |
| Corpus wave/review phase | |
| Review date | |
| Reviewer identity | |
| Reviewer authority and independence basis | |
| Governing grant/commission | |
| Parent authorities loaded | |
| Repository subject, if applicable | |
| Review method | |
| Prior review superseded | |

---

## 2. Review disposition

Choose one:

- `ACCEPT_FOR_ADOPTION`
- `ACCEPT_WITH_MINISTERIAL_CORRECTIONS`
- `REVISE_AND_REVIEW_AGAIN`
- `BLOCKED_BY_AUTHORITY_OR_SEMANTIC_DECISION`
- `REJECT`

**Recommended disposition:**

**Summary rationale:**

**Residual uncertainty:**

This recommendation SHALL NOT be recorded as sponsor adoption unless the required authority separately performs that act.

### Result and phase-applicability convention

Every checklist result SHALL use one of:

- `APPLICABLE_NOW_PASS`
- `APPLICABLE_NOW_FAIL`
- `ALLOCATED_TO_LATER_WAVE`
- `NOT_APPLICABLE_WITH_RATIONALE`
- `UNVERIFIED_OR_BLOCKED`

A Wave 1 review verifies semantic ownership, explicit allocation, and later-wave commissioning. It does not require fixtures, machine contracts, conformance suites, persistence mechanisms, provider qualifications, or other artifacts assigned to later waves to exist. `ALLOCATED_TO_LATER_WAVE` is acceptable only when the owning future document, obligation, and decision gate are explicit and the current document does not claim that capability is performed. An unauthorized omission or a current claim depending on absent evidence is a failure.

---

## 3. Authority and document-control review

| Check | Result | Evidence/finding ID |
| --- | --- | --- |
| Permanent ID and filename rules satisfied | | |
| Version, lifecycle status, settledness, and authority are distinct | | |
| Exact grant/ratification record cited | | |
| Parent and inherited authorities identified | | |
| `Governs` and `Does Not Govern` boundaries explicit | | |
| Precedence and conflict routing explicit | | |
| Change and supersession procedures explicit | | |
| Manifest and member metadata synchronized | | |
| No title, voice, or tool output self-confers authority | | |
| No historical document is cited as current authority | | |

---

## 4. Scope and semantic-ownership review

| Check | Result | Evidence/finding ID |
| --- | --- | --- |
| Subject and applicability are closed and reproducible | | |
| Semantic owner is singular for each concern | | |
| Specializations cite rather than duplicate base meaning | | |
| Implementation facts are separated from intended meaning | | |
| Enforced shapes are separated from implementation actuals | | |
| Static facts are separated from runtime observations | | |
| Technical records do not redefine canon-owned assurance terms | | |
| Out-of-scope professional and infrastructure semantics remain excluded | | |
| Unknown, unsupported, incomplete, conflicting, stale, and not-analyzed states remain visible | | |

---

## 5. Requirement and verification-binding review

| Measure | Count or result |
| --- | --- |
| SHALL statements | |
| SHALL NOT statements | |
| Stable requirement IDs | |
| Requirements with verification binding | |
| Requirements with authorized deferred verification | |
| Requirements missing a binding | |
| Requirement-ledger reconciliation | |

Every mandatory clause SHALL have one stable ID and an executable verification route or explicit authorized deferral. A prose assertion such as “tested” without a verifying artifact and failure meaning is insufficient.

---

## 6. Source and evidence review

| Check | Result | Evidence/finding ID |
| --- | --- | --- |
| Repository claims are bound to revision/worktree identity | | |
| Configuration, lockfile, analyzer, and rule versions identified | | |
| Generated/virtual-to-authored provenance preserved | | |
| Coverage and traces identify build/instrumentation/workload/environment | | |
| Provider-normalized facts retain raw provenance | | |
| Current-tool and licensing claims use current primary or installed evidence | | |
| Inference is labeled and bounded | | |
| No absence-of-finding claim exceeds declared coverage | | |

---

## 7. Executable-closure allocation and review

For a pre-executable wave, use `ALLOCATED_TO_LATER_WAVE` where the check is explicitly commissioned to a later owner. Do not create a later-wave artifact merely to make this review green.

| Check | Result | Evidence/finding ID |
| --- | --- | --- |
| Independent fixture exists or is explicitly commissioned | | |
| Expected results were not copied from the analyzer under test | | |
| Oracle changes have independent authority | | |
| Negative and no-false-green cases exist | | |
| Empty/vacuous implementations are killed | | |
| Incremental/full equivalence has an oracle | | |
| Provider disagreements remain visible | | |
| Stale/mixed-revision evidence cannot report green | | |
| Failure, timeout, cancellation, and degraded modes are tested | | |
| Security, confidentiality, isolation, and recovery obligations have owners | | |

---

## 8. Adversarial economy review

Attempt to satisfy the document incorrectly through each path:

1. return an empty graph;
2. skip unsupported files without reporting them;
3. bind results only to the parent commit of a dirty tree;
4. treat generated TypeScript as authored source;
5. collapse all dependency edge types;
6. report “dead” from no static callers;
7. report “secure” because one analyzer returned nothing;
8. report behavioral preservation from type checking or unchanged line coverage;
9. attach coverage or traces from another build;
10. erase provider disagreement during normalization;
11. mutate an Analyzer Finding Record into green;
12. treat a local pre-commit run as the authoritative gate;
13. select a tool before the semantic contract exists;
14. let the implementation author weaken the oracle;
15. retire prose before every obligation survives executably.

For every path, record whether the document blocks it textually and whether an executable test is assigned now, explicitly allocated to a later wave, or not applicable with rationale.

---

## 9. Findings

| Finding ID | Severity | Concern owner | Evidence | Defect or risk | Required correction | Blocking scope | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | `BLOCKER / MAJOR / MINOR / NOTE` | | | | | | `OPEN` |

Findings SHALL be stable and individually dispositioned. A summary statement SHALL NOT hide an unresolved blocker or major finding.

---

## 10. Strongest opposing review

State the strongest reasonable case against the review's recommended disposition:

**Opposing case:**

**Evidence supporting it:**

**Why the recommendation still stands or changes:**

---

## 11. Re-review closure

| Finding ID | Correction location | Verification performed | Result | Closed by |
| --- | --- | --- | --- | --- |
| | | | | |

Re-review SHALL verify the correction rather than accept the author's statement that it was made.

---

## 12. Adoption-decision preparation

This section prepares evidence for a separate adoption instrument. It is not the adoption instrument and SHALL NOT contain a reviewer-authored sponsor disposition.

### 12.1 Candidate identity and readiness

| Field | Value |
| --- | --- |
| Exact candidate document ID/version | |
| SHA-256 digest of reviewed candidate bytes | |
| Requirement-ledger identity/state | |
| Review report identity/version | |
| Unresolved blocker count | |
| Unresolved major count | |
| Ministerial corrections permitted without re-review | |
| Recommended for sponsor adoption package? | `YES / NO` |

### 12.2 Material normative decisions and unresolved forks

Create one row for every unresolved fork and every material normative change introduced by the candidate. Do not combine independently contestable decisions merely because they occur in one document.

| Decision ID | Proposed change or fork | Governing owner/boundary | Verified evidence and limits | Strongest opposition | Consequence if ratified | Consequence if amended | Consequence if rejected | Consequence if deferred | Reviewer recommendation/confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | |

If there are no such decisions, write `NONE` and explain why the candidate contains only already conferred ground or ministerial carriage. A blank table never means none.

### 12.3 Required separate adoption instrument

The adoption instrument SHALL:

1. cite this exact review and requirement ledger;
2. identify the exact candidate version and digest;
3. carry forward every open finding and review limitation;
4. reproduce each Section 12.2 decision as its own full-judgment surface;
5. provide an individual sponsor response field for every such decision;
6. state adoption, rejection, amendment, and deferral consequences for the document as a whole;
7. name the exact `JPWB-REG-005` conferral entry to be appended if adopted;
8. require synchronized member/manifest status carriage.

A single aggregate recommendation in Section 2 does not satisfy these adoption requirements.

---

## 13. Handoff

Report:

- final recommendation;
- exact reviewed version and digest;
- checks and tools run;
- all open findings and their blocking scopes;
- unavailable review capabilities;
- filenames added, removed, or changed;
- whether the requirement ledger closes;
- whether the Section 12 adoption package is ready;
- whether independent sponsor adoption is still required.
