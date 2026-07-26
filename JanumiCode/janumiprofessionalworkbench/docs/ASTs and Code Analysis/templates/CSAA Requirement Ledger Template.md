# CSAA Requirement Ledger Template

**Template version:** `0.3.0`

**Status:** Stage A program-control template; mandatory starting point under `REG-D-017` / W0-16; not a Normative CSAA member

**Purpose:** Account for every applicable SHALL and SHALL NOT from governing canon, granted program working references, ratified specifications, and enforced reference-artifact obligations.

**Authority rule:** The obligation to use this as a preserved-field starting point derives from `REG-D-017` / W0-16. The template records obligations and evidence; it does not create, waive, amend, interpret, or confer authority.

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
| Independent reviewer | |
| Governing grant or commission | |
| Applicable canon/spec/program versions | |
| Ledger state | `OPEN / READY_FOR_REVIEW / CLOSED_FOR_NAMED_COMMISSION` |

---

## 2. Intake counts

| Source artifact | Version or subject identity | Applicable SHALL count | Applicable SHALL NOT count | Ledger rows created | Extraction evidence |
| --- | --- | ---: | ---: | ---: | --- |
| | | | | | |

The row count SHALL reconcile to the applicable obligation count. A difference is a visible extraction defect, not an acceptable omission.

---

## 3. Requirement ledger

| Requirement ID | Owner/source | Version/section | Obligation summary | Applicability and subject | Obligation disposition | Disposition authority or rationale | Planned implementation or document site | Implementation state | Enforced reference artifact | Verification IDs | Verification state | Oracle owner/status | Evidence record | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | `APPLICABLE_NOW` | | | `NOT_STARTED` | | | `NOT_RUN` | | | |

### Allowed obligation-disposition values

- `APPLICABLE_NOW`
- `ALLOCATED_TO_LATER_WAVE`
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
- `ALLOCATED_TO_LATER_WAVE` SHALL name the exact later document or wave, owning requirement, activation condition, and intended verification. It is a visible allocation, not satisfaction or waiver.
- `DEFERRED_BY_CITED_AUTHORITY` SHALL cite the authority, deferred scope, expiry or reconsideration trigger, and safe default. It is not satisfaction.
- `WAIVED_BY_CITED_AUTHORITY` SHALL cite authority that is competent to waive the obligation for the exact subject and version.
- `DIVERGENT_WITH_FINDING` SHALL cite the open finding and blocks closure.
- `NOT_APPLICABLE_WITH_RATIONALE` SHALL identify the excluded subject boundary and reasoning; where applicability is a judgment reserved to an authority, it SHALL cite that authority.
- `NOT_REQUIRED_CURRENT_PHASE` is permitted for implementation or verification only when the obligation disposition independently explains why current-phase performance is not required.

---

## 5. Apparent conflicts and gaps

| Record ID | Requirements involved | Conflict or missing information | Classification | Safe default | Register/divergence record | Blocking scope | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | `OPEN` |

An apparent conflict SHALL remain visible until the concern owner or applicable authority resolves it. The ledger SHALL NOT silently choose the more convenient obligation.

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
| Allocated to later wave | |
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
  + Allocated to later wave
  + Deferred by cited authority
  + Waived by cited authority
  + Divergent with finding
  + Not applicable with rationale

Unaccounted = Extracted obligations - Disposition total
```

`CLOSED_FOR_NAMED_COMMISSION` means closed only against the exact commission, subject version, and source versions in Section 1. It is not a claim that later-wave allocations, deferrals, or waivers have been implemented or verified.

Closure requires:

- `Unaccounted = 0`;
- `Divergent with finding = 0`;
- every `APPLICABLE_NOW` row has implementation state `IMPLEMENTED`;
- every `APPLICABLE_NOW` row has verification state `PASSED` and cites its `PASSED` Section 6 record and exact evidence;
- `Applicable now = Applicable-now implemented = Applicable-now verification passed`;
- `Applicable-now not implemented = 0`;
- `Applicable-now verification not passed = 0`;
- every later-wave allocation, deferral, waiver, and not-applicable judgment satisfies its disposition-specific rule;
- every failed, blocked, inconclusive, stale, or unsupported verification is either rerun to `PASSED` for an `APPLICABLE_NOW` row or bound to a non-applicable-now disposition with the required authority;
- every oracle change has the required independent authority;
- the subject and evidence are still current at closure time.

---

## 9. Sign-off

| Role | Identity | Decision | Date | Evidence or authority reference |
| --- | --- | --- | --- | --- |
| Author | | | | |
| Independent reviewer | | | | |
| Adoption authority, if required | | | | |

Completion claims are made against this closed ledger, never against the diff alone.
