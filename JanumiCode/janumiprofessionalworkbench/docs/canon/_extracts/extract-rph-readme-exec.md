# Extract: RPH README + Janumi Platform Executive Overview

Sources: `docs/Recursive Professional Harness/README.md` (198 lines) and `docs/Recursive Professional Harness/Janumi Platform - Executive Overview.md` (28 lines).
Both are authored specification/navigation documents, not chat transcripts, so no [HUMAN]/[ASSISTANT] tags apply and no sponsor rulings occur in-source.

## CONSTITUTIONAL CANDIDATES

- "The core principle — governance is the product, not a feature." (Janumi Platform - Executive Overview.md L11) — The platform's single-sentence identity claim; everything else (tiers, audit, editions) derives from it.
- "An AI agent may propose anything, but is never silently promoted to authority (Capability ≠ Authority)." (Janumi Platform - Executive Overview.md L11) — Names the Capability ≠ Authority axiom at product-family scope; grounds exec≠assurance and human adjudication.
- "Every consequential decision is adjudicated by an authorized human—approve, refine, reject, waive, or escalate—through three tiers (`READ`, `PROPOSE`, `GOVERN`)." (Janumi Platform - Executive Overview.md L11) — Canonical adjudication verb set and the three-tier authority model, stated constitutionally.
- "The resulting software product is distinct from the Undertaking that produces it." (Janumi Platform - Executive Overview.md L7) — Work-versus-work-product separation; prevents conflating governed professional work with its output artifact.
- "The early JanumiCode harness is valuable but trapped on the desktop ... That excludes users without the toolchain, blocks teams from collaborating on one governed Undertaking, and gives organizations no tenancy, identity, or audit foundation." (Janumi Platform - Executive Overview.md L9) — The problem statement justifying the entire platform evolution; vision anchor for Cloud/collaboration direction.
- "Janumi Platform remains independent of any single PWA or domain product by design." (Janumi Platform - Executive Overview.md L27) — Platform neutrality is a design commitment, constraining any JanumiCode-specific coupling into shared services.
- "The platform is designed, built, and documented to support SOC 2 Type 2, DoD RMF (NIST SP 800-53), and GDPR obligations, with a tamper-evident, hash-chained audit trail" (Janumi Platform - Executive Overview.md L23) — Regulated-trust posture as a build-time commitment, not an aspiration; audit is tamper-evident by construction.
## DOCTRINE-CONOP

- "A trusted control plane provides durable RPH execution, professional-work services, assurance, governance, identity, tenancy, and audit ... An isolated execution plane runs untrusted compilers and coding agents in ephemeral, per-tenant sandboxes under a Compute Broker that meters and fair-shares." (Janumi Platform - Executive Overview.md L13) — Two-plane doctrine: trust boundary between governed services and untrusted execution.
- "Its durable workflows are temporal execution machinery; they are not the PWAs or Professional Work Graphs they operate." (Janumi Platform - Executive Overview.md L13) — Workflow-engine-is-not-the-work doctrine restated at platform level; blocks workflow-first ontology regression.
- "Three Janumi Platform editions differ by build-time inclusion of a commercial `ee/` set plus a runtime license—never by a source fork" (Janumi Platform - Executive Overview.md L15) — Open-core doctrine: one codebase, edition split by build inclusion and license only.
- "**Community** (AGPL, single-tenant, self-hosted, BYOK) ... **Enterprise** (commercial, self-hosted)—adds SSO and full SCIM, private or air-gapped models ... **Cloud** (hosted, multi-tenant)—adds managed hosted operations, metered billing, and cross-tenant fairness" (Janumi Platform - Executive Overview.md L17-19) — Canonical three-edition ladder and each edition's differentiators.
- "Web, Mobile, and the VS Code extension are clients, not edition splits." (Janumi Platform - Executive Overview.md L21) — Client-versus-edition orthogonality; surfaces never define licensing boundaries.
- "REL-1 (shared platform foundation, Cloud beta, and Community) → REL-2 (Enterprise, Cloud GA on RKE2, and the compliance audit) → REL-3 (Mobile) → REL-4 (HA/multi-node, stronger isolation, and contractual SLA)." (Janumi Platform - Executive Overview.md L25) — Canonical release roadmap ordering platform, editions, mobile, and hardening.
- "Migration of the legacy decomposition engine is deliberately parked until its behavior can move cleanly into RPH, PWA, Undertaking, and Professional Work Graph semantics." (Janumi Platform - Executive Overview.md L27) — CONOP ruling: semantics-first migration; no premature port of the legacy engine.
- "JanumiCode is the software-product domain specialization of JPWB, not a single PWA. It combines software-product PWAs, specialized Views, assurance policies, coding-agent integrations, repository and IDE integrations, build and test systems, and deployment capabilities." (Janumi Platform - Executive Overview.md L5) — Positions JanumiCode as a domain product layer, defining its composition.
## VOCABULARY

- "Janumi is the company and product family. ... Janumi Platform is the shared multi-tenant technical and service foundation. ... Janumi Professional Workbench (JPWB) is the general-purpose professional-work environment. ... RPH is the underlying control and runtime architecture." (README.md L33-36) — The four-level product-family naming ladder; both documents state it identically.
- "A Professional Work Architecture (PWA) defines reusable professional-work structure and PWU Types. ... An Undertaking is concrete professional work instantiated under a selected PWA version. ... A Professional Work Graph belongs to an Undertaking and contains its PWU Instances" (README.md L37-39) — Reusable-definition vs concrete-instance vs owned-graph distinction, the corpus's central ontology triple.
- "JanumiCode is a domain product containing multiple software-product PWAs." (README.md L41) — JanumiCode is neither a PWA nor the platform; it is a domain product.
- "Product Realization PWA is the canonical replacement for the former architectural use of `Product Lens`." (README.md L42) — Retired-term ruling: Product Lens is superseded as architecture.
- "Residual uses of `Product Lens`, `Lens`, `phase`, or `dialogue` are valid only when explicitly identifying legacy or compatibility concepts." (README.md L46) — The retired-terms list and the only condition under which they may appear.
- "Field Service Management SaaS Reference Undertaking is the canonical fixture; the Field Service Management SaaS product is its distinct output." (README.md L43) — Names the golden fixture and separates it from its product output.

## SEMANTIC-INVARIANTS

- "A repository commit is not an authoritative Baseline." (README.md L44) — Baseline authority comes from governance, never from VCS state; load-bearing against commit-as-baseline shortcuts.
- "A Validator is an implementation of an Assurance Policy; validator output is not itself an authoritative decision." (README.md L92) — Sensor-versus-authority separation: assurance evidence never self-authorizes.
- "It must never be presented as the PWA definition or as the resulting Field Service Management SaaS product." (README.md L108) — Fixture confinement invariant: the Reference Undertaking is an example, never definition or output.
- "Legacy names in this document identify migration inputs rather than canonical architecture." (README.md L100) — Interpretation rule for RPH-DOC-005: legacy vocabulary is data, not authority.

## PROTOCOL-PRACTICE

- "These artifacts evolved through exploration, so later specifications often sharpen or supersede earlier material. Read them in the authoritative order below rather than in generation order." (README.md L3) — Corpus navigation rule: authoritative order, not chronological order, governs reading.
- "The Janumi Product Architecture and Canonical Vocabulary Charter is the naming and product-boundary authority for this directory." (README.md L29) — Single naming authority (RPH-DOC-000) for the whole document set.
- "It is an orientation aid, not a substitute for the charter or the numbered specifications." (README.md L50) — Authority status of the Executive Overview: orientation only.
- "Canonical vocabulary and product boundaries outrank older or compatibility terminology / Domain invariants and authority rules outrank fixture convenience / PWA and Undertaking semantics outrank database, Execution Workflow, or UI convenience / Executable conformance tests outrank implementation shortcuts" (README.md L159-177) — The four-rung conflict-precedence ladder for the corpus.
- "Conflicts must be surfaced. They must not be silently resolved by redefining a canonical term." (README.md L179) — Conflict-handling rule: escalation, never silent term redefinition.
- Coding-agent reading sequence: "0. Vocabulary Charter ... 10. PWA Designer and Undertaking Workbench UX / 11. Actual codebase inventory and repository-specific implementation plan" (README.md L144-157) — Mandated agent onboarding order ending at the real codebase, docs first.
- Earlier exploratory discussions "remain useful background. They are not implementation authority where they conflict with this document set." (README.md L191) — Background-material demotion rule; exploration never outranks the numbered set.
- "The earlier workflow-canvas feature description is likewise a legacy input and UI inspiration. Its useful visual inspection ... ideas remain; its workflow-first ontology has been superseded." (README.md L193) — Salvage rule: keep the canvas UX ideas, retire the workflow-first ontology.
- "Read this only after the domain and fixture." (README.md L116) — Contracts (RPH-DOC-007) are downstream of semantics; wire shapes never lead.

## OPEN-QUESTIONS-CONTRADICTIONS

- The README demotes the Executive Overview to "an orientation aid, not a substitute for the charter" (README.md L50), yet the Overview is the only in-directory source for the two-plane architecture, three editions, trust tiers, roadmap, and named stack (Janumi Platform - Executive Overview.md L13-25). Canon must decide where those claims' authority actually lives.
- README defines JanumiCode as "a domain product containing multiple software-product PWAs" (README.md L41) while the Overview says it also bundles Views, integrations, build/test, and deployment (L5) — compatible, but the minimal vs expansive definitions should be reconciled in one canonical sentence.
