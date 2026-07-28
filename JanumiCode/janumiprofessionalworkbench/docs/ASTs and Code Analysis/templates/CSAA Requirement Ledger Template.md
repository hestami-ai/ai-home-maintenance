# CSAA Requirement Ledger Template

**Template version:** `0.5.0`

**Status:** Standing corpus-construction ledger template; mandatory starting point under `REG-D-017` / W0-16 as modified prospectively only within the exact intermediate-authorization and documentation-wave scope of `REG-D-021` as corrected by `REG-D-022`; not a Normative CSAA member

**Purpose:** Account for every applicable SHALL and SHALL NOT from governing canon, granted program working references, ratified specifications, and enforced reference-artifact obligations.

**Authority rule:** The obligation to use this as a preserved-field starting point derives from `REG-D-017` / W0-16. `REG-D-021`, as corrected and clarified by `REG-D-022`, commissions all remaining documentation waves, removes intermediate sponsor authorization, makes template changes prospective only, and preserves the separation of author/integrator, independent adversarial reviewer, independent integrity/provenance validator, final decision authority, and ministerial recorder. The template records obligations and evidence; it does not create, waive, amend, interpret, or confer authority.

---

## 1. Ledger metadata

| Field | Value |
| --- | --- |
| Ledger ID | |
| Work package or document | |
| Subject repository | |
| Parent commit | |
| Worktree/change-set identity | |
| Configuration and lockfile digests | |
| Intake time | |
| Last refresh time | |
| Prepared by | |
| Author/integrator | |
| Author self-reviewer | |
| Independent adversarial reviewer | |
| Independent integrity/provenance validator | |
| Final decision authority | |
| Ministerial recorder, if applicable | |
| Role-overlap check | |
| Governing grant or commission | |
| Applicable canon/spec/program versions | |
| Ledger state | `OPEN / READY_FOR_REVIEW / CLOSED_FOR_NAMED_COMMISSION` |

For the same exact judgment surface, the author/integrator, adversarial reviewer, integrity/provenance validator, final decision authority, and ministerial recorder SHALL be distinct identities. The recorder acts only on exact predicates and SHALL NOT create, reinterpret, waive, or accept a disposition.

---

## 2. Intake counts

| Source artifact | Version or subject identity | Applicable mandatory affirmative count | Applicable mandatory prohibitive count | Applicable permission count | Ledger rows created | Extraction evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| | | | | | | |

The mandatory counts include the governing source's mandatory vocabulary (`SHALL`/`SHALL NOT`, `MUST`/`MUST NOT`, or an explicitly identified controlled equivalent). When controlled permissions are ledgered, their count is recorded separately. The row count SHALL reconcile to affirmative mandatory obligations plus prohibitive mandatory obligations plus ledgered permissions. A difference is a visible extraction defect, not an acceptable omission.

---

## 3. Requirement ledger

| Requirement ID | Owner/source | Version/section | Obligation summary | Applicability and subject | Obligation disposition | Disposition authority or rationale | Planned implementation or document site | Implementation state | Enforced reference artifact | Verification IDs | Verification state | Oracle owner/status | Evidence record | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | `APPLICABLE_NOW` | | | `NOT_STARTED` | | | `NOT_RUN` | | | |

### Allowed obligation-disposition values

- `APPLICABLE_NOW`
- `ALLOCATED_TO_ACTIVE_DOCUMENTATION_SUBPHASE`
- `ALLOCATED_TO_POST_LEDGER_SELF_REVIEW`
- `ALLOCATED_TO_LATER_WAVE`
- `ALLOCATED_TO_LATER_EXECUTION`
- `ALLOCATED_TO_LATER_LIFECYCLE`
- `CONDITION_SATISFIED_SUCCESSOR_MODEL_CONTROLS`
- `DEFERRED_BY_CITED_AUTHORITY`
- `WAIVED_BY_CITED_AUTHORITY`
- `DIVERGENT_WITH_FINDING`
- `NOT_APPLICABLE_WITH_RATIONALE`

### Allowed implementation-state values

- `NOT_STARTED`
- `PLANNED`
- `IMPLEMENTED`
- `NOT_REQUIRED_CURRENT_PHASE`

### Allowed row verification-state values

- `NOT_RUN`
- `PASSED`
- `FAILED`
- `BLOCKED`
- `INCONCLUSIVE`
- `STALE`
- `UNSUPPORTED`
- `NOT_REQUIRED_CURRENT_PHASE`

Obligation disposition, implementation state, and verification state are independent fields. `IMPLEMENTED` never means verified. `PASSED` never means implemented. `SKIPPED`, blank state, unexplained `N/A`, and a combined `VERIFIED` disposition are prohibited.

For a row to carry verification state `PASSED`, it SHALL cite at least one Verification ID, every verification required by the row SHALL be `PASSED` in Section 6, and the cited evidence SHALL bind the verification to the exact subject version. No other state is equivalent to `PASSED`.

---

## 4. Requirement-row rules

Each row SHALL:

1. cite one stable requirement ID;
2. identify the concern-owning source and exact version;
3. preserve enough source wording to prevent a summary from weakening the obligation;
4. identify why the obligation applies to this subject;
5. carry one allowed obligation disposition;
6. cite the exact authority or rationale required by that disposition;
7. identify the planned implementation, document, configuration, or contract site;
8. carry one allowed implementation state;
9. identify an executable verification method or the explicitly authorized reason verification is not required in the current phase;
10. identify whether the verifying artifact belongs to the oracle stream or implementation stream;
11. carry a verification state reconciled to Section 6;
12. cite the evidence produced by execution;
13. cite the authority for any allocation, deferral, waiver, divergence, or not-applicable judgment.

One row MAY cite multiple implementation sites. Multiple independent obligations SHALL NOT be compressed into one row merely because one implementation performs them together.

Disposition-specific rules:

- `APPLICABLE_NOW` means the named commission cannot close until the row is `IMPLEMENTED` and its required verification records are `PASSED`.
- `ALLOCATED_TO_ACTIVE_DOCUMENTATION_SUBPHASE` SHALL name the commissioned documentation member or record, the objective predecessor/readiness evidence that activates its authoring, its owning requirement, and its intended verification. It does not satisfy that member's own ledger.
- `ALLOCATED_TO_POST_LEDGER_SELF_REVIEW` SHALL bind the exact adversarial question or self-review obligation to the author self-review that begins only after ledger closure and ends before Proposed promotion. It is neither a ledger-closure pass nor an independent-review substitute.
- `ALLOCATED_TO_LATER_WAVE` SHALL name the exact later document or wave, owning requirement, activation condition, and intended verification. It is a visible allocation, not satisfaction or waiver.
- `ALLOCATED_TO_LATER_EXECUTION` SHALL name the separately unauthorized executable activity, its future authority condition, intended evidence, and safe default. Documentation completion cannot satisfy it.
- `ALLOCATED_TO_LATER_LIFECYCLE` SHALL name the exact later lifecycle event, owner, activation condition, evidence, and verification. It cannot be performed early or represented as a current-phase pass.
- `CONDITION_SATISFIED_SUCCESSOR_MODEL_CONTROLS` SHALL cite the competent later authority, show every predecessor condition and its successor control, and preserve any still-required decision grain. It is a disposition result, not implementation or verification of the successor activity.
- `DEFERRED_BY_CITED_AUTHORITY` SHALL cite the authority, deferred scope, expiry or reconsideration trigger, and safe default. It is not satisfaction.
- `WAIVED_BY_CITED_AUTHORITY` SHALL cite authority that is competent to waive the obligation for the exact subject and version.
- `DIVERGENT_WITH_FINDING` SHALL cite the open finding and blocks closure.
- `NOT_APPLICABLE_WITH_RATIONALE` SHALL identify the excluded subject boundary and reasoning; where applicability is a judgment reserved to an authority, it SHALL cite that authority.
- `NOT_REQUIRED_CURRENT_PHASE` is permitted for implementation or verification only when the obligation disposition independently explains why current-phase performance is not required.

Under `REG-D-021`, every remaining documentation wave is commissioned. For a documentation allocation, the activation condition SHALL therefore name objective predecessor/readiness evidence rather than an intermediate sponsor authorization. Executable work allocated beyond documentation SHALL continue to cite its separate, still-unperformed execution authority.

---

## 5. Apparent conflicts and gaps

| Record ID | Requirements involved | Conflict or missing information | Classification | Safe default | Register/divergence record | Blocking scope | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | `OPEN` |

An apparent conflict SHALL remain visible until the applicable authority resolves it. During autonomous corpus construction, agents MAY carry a clearly labeled Proposed interpretation, alternatives, or conservative safe default when doing so creates no authority or irreversible implementation choice; the final corpus package SHALL surface every material unresolved judgment. The ledger SHALL NOT silently choose the more convenient obligation.

---

## 6. Verification catalog

| Verification ID | Requirement IDs | Test/analysis type | Fixture or subject | Preconditions | Action | Expected result | Expected diagnostics/evidence | Failure meaning | Execution state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | `NOT_RUN` |

Allowed execution states:

- `NOT_RUN`
- `PASSED`
- `FAILED`
- `BLOCKED`
- `INCONCLUSIVE`
- `STALE`
- `UNSUPPORTED`
- `NOT_REQUIRED_CURRENT_PHASE`

No state other than `PASSED` means passed. `NOT_REQUIRED_CURRENT_PHASE` SHALL cite the corresponding non-`APPLICABLE_NOW` row disposition and is not evidence of implementation or verification.

---

## 7. Oracle-stream changes

| Oracle change ID | Judgment grain affected | Existing judgment? | Authoring identity | Authorized reviewer | Authority record | Proposed/Conferred | Divergence record if disputed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | `PROPOSED` | |

The identity authoring the implementation change SHALL NOT hold authority within that change to weaken, remove, or rewrite a pre-existing judgment that evaluates it.

---

## 8. Closure summary

| Measure | Count |
| --- | ---: |
| Extracted obligations | |
| Applicable now | |
| Allocated to active documentation subphase | |
| Allocated to post-ledger self-review | |
| Allocated to later wave | |
| Allocated to later execution | |
| Allocated to later lifecycle | |
| Condition satisfied; successor model controls | |
| Deferred by cited authority | |
| Waived by cited authority | |
| Divergent with finding | |
| Not applicable with rationale | |
| Disposition total | |
| Unaccounted | |
| Applicable-now implemented | |
| Applicable-now not implemented | |
| Applicable-now verification passed | |
| Applicable-now verification not passed | |

The counts SHALL reconcile as follows:

```text
Disposition total =
  Applicable now
  + Allocated to active documentation subphase
  + Allocated to post-ledger self-review
  + Allocated to later wave
  + Allocated to later execution
  + Allocated to later lifecycle
  + Condition satisfied; successor model controls
  + Deferred by cited authority
  + Waived by cited authority
  + Divergent with finding
  + Not applicable with rationale

Unaccounted = Extracted obligations - Disposition total
```

`CLOSED_FOR_NAMED_COMMISSION` means closed only against the exact commission, subject version, and source versions in Section 1. It is not a claim that later-wave allocations, deferrals, or waivers have been implemented or verified, and it is not sponsor conferral. Under `REG-D-021`, ledger closure makes the exact candidate eligible to complete author self-review. Only after author self-review also closes may the author freeze and promote the exact candidate to Proposed; independent adversarial review and integrity/provenance validation then follow before eventual inclusion in the final corpus package.

Closure requires:

- `Unaccounted = 0`;
- `Divergent with finding = 0`;
- every `APPLICABLE_NOW` row has implementation state `IMPLEMENTED`;
- every `APPLICABLE_NOW` row has verification state `PASSED` and cites its `PASSED` Section 6 record and exact evidence;
- `Applicable now = Applicable-now implemented = Applicable-now verification passed`;
- `Applicable-now not implemented = 0`;
- `Applicable-now verification not passed = 0`;
- every documentation, self-review, later-wave, later-execution, later-lifecycle, successor-controlled, deferral, waiver, and not-applicable judgment satisfies its disposition-specific rule;
- every failed, blocked, inconclusive, stale, or unsupported verification is either rerun to `PASSED` for an `APPLICABLE_NOW` row or bound to a non-applicable-now disposition with the required authority;
- every oracle change has the required independent authority;
- the subject and evidence are still current at closure time.

---

## 9. Sign-off

| Role | Lifecycle applicability | Identity | Decision | Date | Evidence or authority reference |
| --- | --- | --- | --- | --- | --- |
| Author / ledger closer | Current ledger-closure prerequisite | | | | |
| Author self-reviewer | After ledger closure; required before Proposed promotion | | | | |
| Independent adversarial reviewer | Later lifecycle after Proposed promotion; not a ledger-closure prerequisite | | | | |
| Independent integrity/provenance validator | Later lifecycle after Proposed review; not a ledger-closure prerequisite | | | | |
| Final adoption authority | Final corpus review only; not a ledger-closure prerequisite | | | | |
| Ministerial recorder | Final or delegated exact recording only; not a ledger-closure prerequisite | | | | |

Completion claims are made against this closed ledger, never against the diff alone.
