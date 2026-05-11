# JanumiLegal Product Description — Evolution Addendum

**Status:** Companion document to `janumilegal_product_description.md` (the "source document").
**Purpose:** Address the architectural gaps identified during assessment of the source document. Each section below either fills a gap, proposes a mechanism where the source document was silent, or formalizes something the source document named in prose but did not specify.

This document does **not** restate the source. It evolves it. Where this addendum and the source disagree, this addendum prevails.

---

## 0. Codebase Boundary

JanumiLegal is a **separate codebase** from JanumiCode v2. It manifests under:

```
JanumiCode/janumilegal/
```

Implications:

- JanumiLegal may **adapt** patterns, schemas, and architectural lessons from JanumiCode v2 (lens runtime, bounded agent execution, sidecar SQLite, MMP, Governed Stream, V-model reasoning review, recursive decomposition with saturation termination), but it does **not** import JanumiCode v2 source.
- Reusable concepts must be re-implemented in JanumiLegal with legal-domain semantics, not legal-flavored wrappers around code-domain modules.
- Bug fixes and architectural improvements do **not** automatically flow between codebases. Cross-product learnings should be captured as design notes, not as shared modules.
- JanumiLegal owns its own lens runtime, its own state machine, its own agent registry, its own DB schema, its own webview/UI bundles, its own evaluation harness.

The MVP scope from the source document (§MVP Strategy, items 1–19) stands as written. This addendum does **not** narrow it.

---

## 1. Canonical Legal Vocabulary Module (CLV)

### 1.1 Purpose

Establish a single authoritative lexicon for every legal-technical term used by lens packs, prompt templates, schemas, validators, and the Governed Stream. Without it, prompt drift, schema drift, and cross-lens semantic collisions are inevitable.

### 1.2 Scope

The CLV is a **Layer 1 (core platform) component**. Lens packs (Layer 2) and firm configurations (Layer 3) **consume** the CLV but may not redefine canonical terms. They may extend the CLV through registered, namespaced extensions only.

### 1.3 Vocabulary entry shape

Each canonical term is a versioned record:

```ts
type CanonicalVocabularyEntry = {
  termId: string;                     // e.g., "clv.core.issue.v1"
  canonicalName: string;              // "issue"
  oneLineDefinition: string;          // platform-wide meaning
  longDefinition: string;             // disambiguating description
  scope: "core" | "practice_area" | "jurisdiction" | "firm";
  scopeQualifier?: string;            // e.g., "family_law", "MD", "firm_acme"
  allowedSynonyms: string[];          // permitted in user-facing text
  prohibitedSynonyms: string[];       // forbidden because they collide
  jurisdictionVariants?: Record<string, string>;  // jurisdiction-specific shadings
  collisionsWith?: string[];          // termIds known to collide if used loosely
  exampleUsage: string[];
  exampleMisuse: string[];
  governingAuthority?: string;        // statute/rule that defines the term, if any
  version: string;
  supersedes?: string;                // prior termId
};
```

### 1.4 Initial core vocabulary (non-exhaustive)

The CLV must define, at minimum, distinct entries for:

- **issue** (legal question), **claim** (cause of action), **assertion** (factual statement) — three separate terms that are routinely conflated.
- **authority** (legal source) vs. **permission** (capability) vs. **attorney of authority** (signing attorney).
- **fact** (document-supported), **allegation** (party assertion), **finding** (adjudicated determination), **conclusion** (reasoned legal output).
- **rule**, **element**, **factor**, **standard**, **test** — all used informally but with distinct legal mechanics.
- **release**, **export**, **filing**, **service**, **delivery**, **send** — distinct in legal workflow.
- **review**, **approval**, **signature**, **authorization**, **ratification**.
- **party**, **client**, **opposing party**, **non-party**, **third party**, **witness**.
- **artifact**, **draft**, **work product**, **deliverable**, **production**, **filing package**.
- **gate**, **block**, **escalation**, **hold**, **flag**.
- **trace**, **citation**, **reference**, **source** (especially "source-to-claim trace" — the term **claim** here means the **assertion** sense, not the **cause of action** sense; this is exactly the kind of internal collision the CLV must resolve).

### 1.5 CLV runtime guarantees

- Every prompt template references CLV `termId`s for all canonical terms it asserts authority over.
- Every schema field with a domain-meaningful name (`issue`, `claim`, `authority`, etc.) declares its CLV `termId` in schema metadata.
- The Governed Stream tags events with the CLV term context they were produced under.
- Reading the CLV is free; writing it requires a versioned migration with a rationale and a back-reference to any superseded entry.

---

## 2. Vocabulary Collision Check (VCC)

### 2.1 Purpose

Detect, **before runtime**, situations where two lens packs, two jurisdiction profiles, or a firm config and a lens pack disagree about what a term means.

### 2.2 Three collision surfaces

1. **Cross-lens collisions** (two lens packs loaded for the same matter use the same word for different concepts).
2. **Cross-jurisdiction collisions** (a lens pack's term has different mechanics in the active jurisdiction; e.g., "summary judgment" standard).
3. **Cross-firm collisions** (firm configuration redefines a term defined by a lens pack or by core).

### 2.3 When the VCC runs

- **Lens-pack load** — when a lens pack is registered or upgraded.
- **Firm-config merge** — when a firm configuration is applied or modified.
- **Matter open** — when a matter activates lens packs and jurisdiction profiles in combination.
- **Lens upgrade in flight** — when a matter's lens version changes during an active workflow (see §10).
- **CLV publish** — whenever a new CLV version is committed.

### 2.4 Collision resolution rules

```text
Severity matrix:

CORE redefinition by Layer 2 or Layer 3        → BLOCK (hard error)
LENS redefinition by Layer 3                   → BLOCK unless namespaced extension
JURISDICTION variance with no variant mapping  → WARN + require attorney acknowledgement
SYNONYM overlap with prohibitedSynonyms        → BLOCK
SOFT collision (different exampleUsage)        → WARN

Resolution surface:
- BLOCK: registration fails; lens pack/firm config not loadable
- WARN + ack: attorney must acknowledge in firm-admin console; recorded to Governed Stream
```

### 2.5 VCC output artifact

A `VocabularyCollisionReport` is produced and stored in the firm registry. It is referenced by every matter that activates the colliding combination. Audit trail.

---

## 3. Governed Stream — Privilege and Discovery Architecture

### 3.1 Premise

Unlike the developer-tooling Governed Stream in JanumiCode v2, the JanumiLegal Governed Stream is **potentially discoverable**. Sanctions proceedings, malpractice litigation, bar disciplinary action, and ordinary discovery in the underlying matter can all reach it. This must be designed for, not patched in.

### 3.2 Stream classification at write time

Every event written to the Governed Stream carries one of these classifications, **assigned at write time and immutable thereafter**:

```text
op_metadata          - operational telemetry only; non-substantive (state entered, timing, agent id)
work_product_factual - work product, factual basis
work_product_mental  - work product, mental impressions / opinion
attorney_client      - attorney-client privileged communication
client_confidential  - non-privileged but confidential client information
public_record        - inherently non-privileged (filed pleading text, public statute reference)
```

### 3.3 Dual-track storage

The Governed Stream is split into two physical stores:

- **Operational track** — `op_metadata` only. Available to platform operations, telemetry, eval, and engineering. Retained per platform policy.
- **Matter track** — everything else. Encrypted, scoped to the matter, retention policy bound to **matter lifecycle** (not platform lifecycle).

Cross-track reads are not possible by default. A unified matter view exists only inside the firm's authorized boundary.

### 3.4 Privilege labeling agent

A new agent — **Privilege/Work Product Classifier** (already named in source §Tier 10 #46) — is now mandatory on every stream write that is not declared `op_metadata` by the writer. The agent assigns the classification; the orchestrator enforces it.

### 3.5 Discovery export controls

- No platform-wide bulk export.
- Matter-scoped export only, gated by attorney-of-record authorization.
- Export packages **redact** by classification: a discovery production export by default excludes `work_product_mental` and `attorney_client`.
- Every export records who exported, when, what classification filters were applied, and what was redacted (logged to operational track only — the export log itself is not in the matter track).

### 3.6 Retention

- `op_metadata`: platform retention policy.
- Matter track: configured per firm and per matter type; default = matter lifecycle + jurisdictional retention floor (typically 5–10 years post-closure).
- **No "delete everything" admin button.** Matter-track deletion requires a documented retention-policy basis or a court order, recorded.

### 3.7 Mental-impressions firewall

`work_product_mental` events — pruning rationales, attorney critique notes, strategy notes, draft attorney commentary — are written to a **separately keyed** segment of the matter track. Compromise of the matter track does not by itself disclose mental-impressions content. This is an architectural concern, not a policy one.

### 3.8 Standalone design doc requirement

This section is a **summary**. Before any code that writes to the Governed Stream lands, a dedicated design document `docs/design/governed_stream_privilege.md` must be produced and reviewed by counsel, not just engineering.

---

## 4. Lens Phase Manifests (Machine-Readable Lens Definitions)

The source document describes lens state machines in prose ("the lens may include states such as..."). This is insufficient.

### 4.1 Manifest shape

Every lens ships as a versioned, machine-readable manifest:

```ts
type LensPhaseManifest = {
  lensId: string;
  lensVersion: string;
  supersedes?: string;
  practiceArea: string;
  applicableJurisdictions: string[];
  states: LensState[];
  requiredArtifacts: ArtifactSpec[];
  validators: ValidatorRef[];
  escalationTriggers: EscalationRule[];
  releasePolicies: ReleasePolicyRef[];
  clvBindings: string[];              // CLV termIds this lens depends on
  dependencies: { lensId: string; version: string }[];
};

type LensState = {
  stateId: string;
  required: boolean;
  predecessors: string[];             // hard ordering constraint
  permittedAgents: string[];          // registry agentIds
  inputSchema: string;
  outputSchema: string;
  validators: string[];
  escalationConditions: string[];
  clvScope: string[];                 // CLV terms this state may write
  artifactsProduced: string[];
};
```

### 4.2 Manifest guarantees

- The orchestrator executes manifests, never prose.
- A lens cannot be loaded if its manifest fails schema validation, references unknown agents, references unknown CLV terms, or fails the VCC.
- Prose lens descriptions in product documentation are derived **from** manifests, not the other way around.

---

## 5. Legal Non-Functional Requirements (LNFR) Layer

### 5.1 Premise

JanumiCode v2 elevated NFRs to a first-class phase. JanumiLegal needs the same for its cross-cutting legal concerns, which are currently scattered across Tier 10.

### 5.2 LNFR domains

```text
- privilege (attorney-client, work product, joint defense, common interest)
- candor to tribunal
- conflicts of interest (current, former, imputed, positional, business)
- unauthorized practice of law (UPL)
- jurisdictional admission and pro hac vice
- confidentiality (client, third-party, sealed records, protective orders)
- deadlines and limitations
- retention and records management
- malpractice exposure
- billing and engagement scope
- sanctions and Rule 11 / Rule 3.1 equivalents
- competence (Model Rule 1.1 and analogues)
- supervisory responsibility (Model Rules 5.1, 5.3)
```

### 5.3 LNFR bloom and saturation

LNFRs are bloomed and saturated **per matter**, not per lens, because they cut across lens packs. The bloom uses the same recursive decomposition discipline as legal Issue Bloom (§7), with LNFR-specific seed sets.

### 5.4 LNFR gates

Each LNFR domain produces gate inputs consumed by the Release Gate Evaluator. An LNFR gate failure is **a release blocker even if every lens-internal validator passes**. A clean lens does not override an unresolved LNFR.

### 5.5 LNFR ownership

LNFR results are owned by the matter, not by any individual lens. Adding a lens to a running matter does not reset the LNFR state.

---

## 6. Context Handoff Between Lens States (Narrative Curator Analog)

### 6.1 Premise

JanumiCode v2 produces handoff documents at phase boundaries via a Narrative Curator. JanumiLegal needs the equivalent or downstream lens states will silently lose context.

### 6.2 Lens Boundary Handoff (LBH)

At every state transition flagged as a **handoff boundary** (and at every cross-lens boundary), an **LBH document** is produced:

```ts
type LensBoundaryHandoff = {
  fromState: string;
  toState: string;
  matterId: string;
  governingObjective: string;          // verbatim from Client Objective Mirror
  retainedFacts: FactRef[];
  retainedIssues: IssueRef[];
  prunedIssuesWithReasons: PruningDecision[];
  authorityStatus: AuthorityStateSnapshot;
  openQuestions: string[];
  assumptionsCarried: AssumptionRef[];
  privilegeContext: PrivilegeFrame;
  releaseFrame: ReleaseFrameSnapshot;
  clvContext: string[];                // CLV terms in active scope
  curatorNotes: string;                // human-readable summary
};
```

The downstream state receives the LBH as input. This makes context loss between states **detectable** — an Intent Drift Detector run can compare the final artifact to the originating LBH.

### 6.3 Cross-lens handoffs are stricter

A handoff between two lens packs (e.g., Family Law → Court Filing Draft) requires not just the LBH but also a **CLV scope check** — the receiving lens must declare it consumes the CLV terms the producing lens emitted.

---

## 7. Issue Bloom — Saturation and Termination (Proposals)

The source document does not specify when Issue Bloom stops. Three candidate proposals follow. **Proposal C is recommended.** A decision is required before lens-pack authoring begins.

### Proposal A — Fixed-pass with lens-defined seed coverage

Each lens pack ships a **lens-expected issue coverage seed set** (a checklist of issue domains the lens must touch). Bloom runs a fixed N passes (default 3). Termination = all seed domains touched **and** N passes completed.

- Pros: simple, predictable, cheap, easy to test.
- Cons: under-blooms novel matter shapes that fall outside the seed; over-blooms simple matters.

### Proposal B — Saturation by marginal yield

Bloom runs until two consecutive passes produce **no new issue domains** (subdomain refinements still allowed). A hard pass cap (e.g., 6) prevents runaway.

- Pros: adapts to matter complexity.
- Cons: definition of "new domain" is fragile; LLM stochasticity can falsely "saturate" or falsely "find new"; hard to gold-test.

### Proposal C — Three-pass hybrid with seed coverage and divergence dampening (recommended)

Three passes, with explicit roles, mirroring the JanumiCode v2 NFR three-pass pattern:

```text
Pass 1: SEED COVERAGE
  - Lens-defined issue-domain seed set must be touched.
  - Each domain produces an issue candidate or an explicit "not applicable here, because..." record.
  - Output: every seed domain has a candidate or a recorded non-applicability.

Pass 2: DIVERGENCE
  - Permitted to introduce issue domains outside the seed set.
  - Required to produce at least one matter-specific issue candidate that is NOT in the seed set, OR an explicit attestation that no off-seed issue is plausible.
  - Output: novel candidates, with provenance.

Pass 3: CONSOLIDATION + DAMPENING
  - No new issue domains permitted.
  - Permitted: refining, splitting, merging, restating existing candidates.
  - Required: produce the final IssueCandidateSet for handoff to Issue Prune.
  - If pass 3 produces a new domain, that is treated as an error and the bloom escalates to attorney review.
```

Termination = pass 3 emits a clean `IssueCandidateSet`. Hard cap = 3. No saturation loop, no runaway.

This proposal:

- Inherits JanumiCode v2's three-pass discipline (which is known to work).
- Forces seed coverage (Pass 1) so common issues are never silently skipped.
- Forces divergence (Pass 2) so the system can't trivially pass by rubber-stamping the seed.
- Forbids late additions (Pass 3) so consolidation is genuinely consolidation.
- Is **gold-testable**: each pass has a well-defined output contract.
- Composes with the Issue Prune state, which then makes the retain/remove/defer/escalate decision against an auditable input.

### Recursive decomposition under Proposal C

Issue Bloom is shallow (it produces top-level candidates). **Sub-issue decomposition** is a separate, lens-controlled recursion that may run on retained issues post-prune, with its own three-pass discipline per recursion level and a tier-based gate (analogous to JanumiCode v2's Wave 6 design).

---

## 8. Conflicts Agent and Citator Integration

### 8.1 Conflicts agent (new — Tier 10)

A **Conflict-of-Interest Detection Agent** is added to the registry. It runs:

- **At matter open** — against the firm's matter and party history.
- **On party addition** — when a new party, witness, or related entity is identified.
- **On lens activation** — when a lens that may produce client-facing or court-facing output is activated.
- **On reviewer assignment** — to confirm the assigned reviewer has no personal conflict.

It produces a `ConflictReport` with severity (none / waivable / non-waivable / imputed / requires-screening) consumed by the Release Gate Evaluator. A non-waivable or unresolved conflict is a **hard release block** at every external target.

### 8.2 Citator integration (mandatory before authority claims become attorney-confirmable)

The Authority Verification Lens currently labels machine-assessed support without an external authority corpus. This is acceptable for placeholder-fixture testing only. Before any Authority Verification result can reach attorney-review packets in production:

- A real citator integration (Shepard's, KeyCite, or open-data equivalent) must be wired.
- "Good law" status must come from the citator, not from LLM judgment.
- Citator results carry their own `verification_status` independent of LLM `machine_assessed_support` — these never collapse into a single "verified" label.
- Absence of citator coverage for a jurisdiction must be an explicit, stream-recorded condition, not silent.

---

## 9. Attorney Signature and Approval Semantics

The source document treats "attorney approval" as a boolean. Refined model:

```ts
type AttorneyAction = {
  attorneyId: string;
  barNumbers: { jurisdiction: string; barNumber: string }[];
  role:
    | "drafter"
    | "supervising_attorney"
    | "reviewer"
    | "attorney_of_record"
    | "signing_attorney"
    | "approving_partner";
  action:
    | "drafted"
    | "reviewed"
    | "approved_for_internal_use"
    | "approved_for_client_release"
    | "approved_for_filing"
    | "signed_for_filing"
    | "signed_engagement"
    | "ratified";
  artifactRef: string;
  artifactVersionHash: string;        // binds approval to exact bytes
  signatureMode: "wet" | "electronic" | "platform_attestation" | "ecf_compatible";
  jurisdictionRequirementsMet: boolean;
  timestamp: string;
  governedStreamEventId: string;
};
```

Release gates consume `AttorneyAction` records, not booleans. A different attorney role is required for different release targets (e.g., filing requires `signing_attorney` with a bar number admitted in the forum jurisdiction, **not** any approving partner).

---

## 10. Lens Versioning and In-Flight Migration

### 10.1 Premise

Statutes, rules, and case law change. Lens packs will version. Matters that began under lens v1.3 may still be running when v1.4 ships.

### 10.2 Versioning rules

- Every state output, artifact, validator run, and Governed Stream event records the **exact lens version** under which it was produced.
- A matter is **pinned** to the lens version active at the time of its last completed state by default.
- Upgrading a matter's lens version is an **explicit, attorney-authorized action**, not automatic.

### 10.3 Migration paths

When a lens upgrade is requested mid-matter:

```text
SAFE upgrade  : new version is a superset; all prior states remain valid; matter advances on new version
PARTIAL upgrade: some prior states must be re-run; orchestrator marks them stale; attorney approves re-run
INCOMPATIBLE  : structural change; matter remains on old version unless attorney force-migrates with documented basis
```

Lens packs ship with declared migration metadata identifying which version transitions are SAFE, PARTIAL, or INCOMPATIBLE.

### 10.4 Authority freeze

Authority retrievals carry the citator timestamp at retrieval. A lens upgrade does not silently invalidate authority verification, but the Release Gate Evaluator may require re-verification if the authority age exceeds a configurable freshness floor.

---

## 11. First-Customer Hardcoding Audit

The source document warns that first-customer configuration must not become hardcoded platform architecture. This addendum operationalizes that.

### 11.1 Configuration-vs-code linter

A platform-level lint rule (CI gate) flags any of the following that mention firm-, jurisdiction-, or practice-area-specific identifiers in core code (Layer 1):

- Hardcoded jurisdiction strings.
- Hardcoded firm names, attorney names, bar numbers.
- Hardcoded practice-area branches (`if practiceArea === 'family_law'`).
- Hardcoded court names or court-rule numbers.
- Hardcoded file paths under firm-specific directories.

Findings are **errors** in core, **warnings** in lens packs (Layer 2), **allowed** in firm config (Layer 3).

### 11.2 Onboarding parity test

A continuous test ("the second-firm test") instantiates the platform with a synthetic second firm, second jurisdiction, second practice area, and runs the canonical evaluation suite. This test fails if the second firm's onboarding requires any change outside Layer 3 configuration and Layer 2 lens-pack adaptation.

### 11.3 Hardcoded-shape audit

A periodic audit reviews the schema, DB tables, agent registry, and CLV for any identifier that names a Layer 3 entity. Findings are tracked.

---

## 12. Multi-Party Privilege Model

### 12.1 Premise

Privilege is multi-relational, not binary.

### 12.2 Privilege frames

The Privilege/Work Product Classifier (Tier 10 #46) operates against an explicit **privilege frame** for each matter:

```ts
type PrivilegeFrame = {
  matterId: string;
  attorneyClientPairs: { attorney: string; client: string }[];
  jointRepresentation?: { attorneys: string[]; clients: string[] };
  commonInterestPartners?: { partyId: string; basis: string }[];
  corporateClient?: {
    entityId: string;
    privilegedRoles: string[];          // who at the entity speaks for the privilege
    upjohnApplies: boolean;
  };
  protectiveOrders?: { orderId: string; scope: string }[];
  sealedRecords?: SourceRef[];
  thirdPartyPresenceWaivers?: { partyId: string; effect: "waived" | "preserved" }[];
};
```

Every Governed Stream classification of `attorney_client` or `work_product_*` is evaluated against the frame, not against a flat boolean.

---

## 13. MMP — Explicit Adoption

The source document indirectly evokes the JanumiCode v2 Mirror/Menu/Pre-Mortem protocol but never names it.

### 13.1 MMP in JanumiLegal

The Client Objective Mirror Agent (Tier 1 #2) is renamed and expanded as the **Matter MMP Agent**, producing the three card types adapted to legal context:

- **Mirror cards** — assumptions about matter type, client objective, jurisdiction, procedural posture, release intent. Attorney accepts/rejects/edits.
- **Menu cards** — strategic decisions surfaced for attorney choice (e.g., enforcement-only vs. enforcement-with-modification posture; conservative vs. aggressive prayer for relief).
- **Pre-Mortem cards** — risks the system has identified that the attorney must acknowledge before downstream states proceed (e.g., "support arrears defense is contested; failure to brief it may waive the issue").

### 13.2 MMP boundaries

- MMP runs at matter open, at lens activation, at major handoff boundaries (per §6), and on demand.
- MMP submissions are recorded to the Governed Stream as `work_product_mental` (per §3.2) — they encode attorney mental impressions.
- MMP decisions become **inputs to subsequent states**, not optional prompts.

---

## 14. Agent Capability Boundaries

The source document's registry permits capability sets like `verify`, `critique`, `gate` on the same agent. Tightened rule:

```text
A single agent registry entry may declare AT MOST ONE capability from each of these mutually exclusive groups:

Group A (production):  draft, redline, summarize, classify, extract, decompose, retrieve, map
Group B (assessment):  verify, critique
Group C (governance):  gate, escalate, package

An agent that drafts may not also gate.
An agent that gates may not also draft.
An agent that verifies may not also produce the artifact it verifies.
```

Composite workflows are achieved by orchestrating multiple agents, not by widening one agent's capability surface. This prevents the failure mode where a single LLM invocation both produces and signs off on an output.

---

## 15. Open Items Deferred for Design

The following are acknowledged as needing dedicated design before implementation but are not specified in this addendum:

1. **Citator data model and license** — which citator(s), under what license, with what jurisdictional coverage.
2. **E-filing protocol integration** — court-by-court ECF / state e-filing connectors are out of scope for this addendum; treated as Layer 3 concerns initially.
3. **DMS integrations** (iManage, NetDocuments, etc.) — privilege-aware ingestion and write-back are non-trivial; require their own design doc.
4. **Calibration/gold-capture discipline** — the JanumiCode v2 Wave 6 deferral list flagged this; do not repeat the deferral here. A separate design doc on the legal evaluation harness and gold-capture protocol is required before lens-pack v1 ships.
5. **Webview vs. Electron vs. web-app form factor decision** — VS Code extension is the source-document substrate; the long-term form factor is open. Decide before UI workbench scope grows.

---

## 16. Summary of Evolution

This addendum adds the following first-class platform components to the source document's three-layer architecture:

- **Canonical Legal Vocabulary (CLV)** — Layer 1.
- **Vocabulary Collision Check (VCC)** — Layer 1.
- **Privilege-aware Governed Stream** — Layer 1, with mandatory dual-track storage and write-time classification.
- **Lens Phase Manifests** — Layer 2 contract.
- **Legal NFR layer (LNFR)** — Layer 1, matter-scoped.
- **Lens Boundary Handoff (LBH)** — Layer 1 contract.
- **Issue Bloom three-pass discipline (Proposal C)** — Layer 1 default; lens packs may override only with platform approval.
- **Conflicts agent and citator integration** — Layer 1 (conflicts agent) and Layer 1 binding (citator).
- **Attorney action / signature model** — replaces boolean approval throughout.
- **Lens versioning and migration** — Layer 1.
- **First-customer hardcoding audit** — CI gate.
- **Multi-party privilege frames** — Layer 1.
- **Explicit MMP adoption** — Layer 1.
- **Tightened agent capability boundaries** — registry rule.

The doctrine of the source document is preserved: the lens owns the workflow, the agent owns only the bounded state task, procedural completeness is the product claim, verification has tiers, and release is governed separately from generation. This addendum supplies the missing architectural mechanisms to make that doctrine durable in legal practice.
