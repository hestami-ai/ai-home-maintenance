# CSAA Controlled Document Review Template

**Template version:** `0.4.0`

**Status:** Standing corpus-construction review template; mandatory starting point under `REG-D-017` / W0-16 as modified prospectively only within the exact intermediate-authorization and documentation-wave scope of `REG-D-021`; not a Normative CSAA member

**Purpose:** Provide an independent, adversarial, evidence-bearing review of a Proposed CSAA controlled document and prepare its exact contribution to the final corpus-review package.

**Authority rule:** The obligation to use this as a preserved-field starting point derives from `REG-D-017` / W0-16. `REG-D-021` removes intermediate sponsor and concern-owner authorization from documentation construction while retaining objective review gates and one final corpus-level sponsor review. A review may recommend inclusion or disposition; it never confers program status by itself.

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
| Independent integrity/provenance validator identity | |
| Integrity-validation method | |
| Ministerial recorder identity, when a controlled result is recorded | |
| Role-overlap check | |
| Governing grant/commission | |
| Parent authorities loaded | |
| Repository subject, if applicable | |
| Review method | |
| Prior review superseded | |

For the same exact judgment surface, the author/integrator, adversarial reviewer, integrity/provenance validator, final decision authority, and ministerial recorder SHALL be distinct identities. The recorder acts only on exact predicates and SHALL NOT supply or reinterpret judgment.

---

## 2. Review disposition

Choose one:

- `ACCEPT_FOR_FINAL_CORPUS`
- `ACCEPT_AFTER_CORRECTION_AND_REVIEW`
- `REVISE_AND_REVIEW_AGAIN`
- `BLOCKED_BY_AUTHORITY_OR_SEMANTIC_DECISION`
- `REJECT`

**Recommended disposition:**

**Summary rationale:**

**Residual uncertainty:**

This recommendation SHALL NOT be recorded as sponsor adoption. Under `REG-D-021`, it becomes evidence for the final exact-corpus sponsor review.

### Result and phase-applicability convention

Every checklist result SHALL use one of:

- `APPLICABLE_NOW_PASS`
- `APPLICABLE_NOW_FAIL`
- `ALLOCATED_TO_LATER_WAVE`
- `NOT_APPLICABLE_WITH_RATIONALE`
- `UNVERIFIED_OR_BLOCKED`

A wave review verifies semantic ownership, explicit allocation, predecessor readiness, and the distinction between documentation specification and performed capability. It does not require fixtures, machine contracts, conformance suites, persistence mechanisms, provider qualifications, or other executable artifacts merely because their specifications are allocated to a later document or phase. `ALLOCATED_TO_LATER_WAVE` is acceptable only when the owning future document or execution phase, obligation, evidence gate, and non-performance state are explicit. An unauthorized omission or a current claim depending on absent evidence is a failure.

---

## 3. Authority and document-control review

| Check | Result | Evidence/finding ID |
| --- | --- | --- |
| Permanent ID and filename rules satisfied | | |
| Version, lifecycle status, settledness, and authority are distinct | | |
| Exact preparation commission and, if already Normative, ratification record cited | | |
| Parent and inherited authorities identified | | |
| `Governs` and `Does Not Govern` boundaries explicit | | |
| Precedence and conflict routing explicit | | |
| Change and supersession procedures explicit | | |
| Adopted-manifest baseline, current member metadata, and non-authoritative working-state record are distinguished and internally consistent | | |
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

Every candidate-byte change after an exact review freeze SHALL trigger affected re-review. The sole exception is an exact pre-frozen administrative substitution set that identifies source and result digests and is independently replayed and validated against the named result before recording; the exception SHALL NOT alter semantic content or reviewer judgment.

---

## 12. Final-corpus decision preparation

This section prepares evidence for the one final exact-corpus review instrument required by `REG-D-021`. It is not that instrument and SHALL NOT contain a reviewer-authored sponsor disposition.

### 12.1 Candidate identity and readiness

| Field | Value |
| --- | --- |
| Exact candidate document ID/version | |
| SHA-256 digest of reviewed candidate bytes | |
| Requirement-ledger identity/state | |
| Review report identity/version | |
| Unresolved blocker count | |
| Unresolved major count | |
| Required corrections before a successor review | |
| Recommended for final corpus package? | `YES / NO` |

### 12.2 Material normative decisions and unresolved forks

Create one row for every unresolved fork and every material normative change introduced by the candidate. Do not combine independently contestable decisions merely because they occur in one document.

| Decision ID | Proposed change or fork | Governing owner/boundary | Verified evidence and limits | Strongest opposition | Consequence if ratified | Consequence if amended | Consequence if rejected | Consequence if deferred | Reviewer recommendation/confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | |

If there are no such decisions, write `NONE` and explain why the candidate introduces no material normative choice or unresolved fork. A blank table never means none.

### 12.3 Required final-corpus integration

The final corpus-review package SHALL:

1. cite this exact review and requirement ledger;
2. identify the exact candidate version and digest;
3. carry forward every open finding and review limitation;
4. reproduce each Section 12.2 decision as its own full-judgment surface;
5. assign every such decision a stable corpus-level decision ID without soliciting an intermediate sponsor response;
6. provide one individual sponsor response field for this member and one for every material decision or unresolved fork, all completed only in the final corpus-review event;
7. state adoption, rejection, amendment, exclusion, and deferral consequences for the document as a whole;
8. include the document in the one exact completed-corpus manifest, or identify it explicitly as excluded or deferred;
9. support one final sponsor-review event and one itemized sponsor response payload without requiring separate document-by-document interactions;
10. append a distinct exact-member `JPWB-REG-005` conferral decision for every accepted member within one controlled final transaction; and
11. require synchronized final member/manifest status carriage for the accepted set.

A single aggregate recommendation or undifferentiated sponsor disposition does not satisfy these requirements. The individual fields are assembled and answered together at the final corpus review; they do not create intermediate sponsor gates.

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
- whether the Section 12 final-corpus contribution is ready;
- whether the exact candidate is ready to remain in the final corpus package; and
- that sponsor conferral remains pending until the completed-corpus review.
