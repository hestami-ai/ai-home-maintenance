# Extract: Janumi Product Architecture and Canonical Vocabulary Charter (RPH-DOC-000), lines 1-1100

Source: `docs/Recursive Professional Harness/Janumi Product Architecture and Canonical Vocabulary Charter - Governing Product Ontology, Subsystem Boundaries, and Naming Authority.md`, lines 1-1100 only. Cited below as `RPH-DOC-000.md`.
Speaker note: this is a spec document, not a transcript — no HUMAN/ASSISTANT turns exist, so no SPONSOR-RULINGS items arise from this slice.

## CONSTITUTIONAL CANDIDATES

- "This Charter is the naming and product-boundary authority for future Janumi specifications." (RPH-DOC-000.md L53) — Supreme-authority clause: every later spec's vocabulary is subordinate to this document.
- "Where an older artifact conflicts with this Charter: 1. the professional meaning in this Charter takes precedence; 2. the conflict must be surfaced; 3. the older artifact must not be silently reinterpreted in a way that changes its substantive requirements; 4. terminology should be corrected during the next revision" (RPH-DOC-000.md L57-62) — Conflict-resolution protocol: precedence without silent reinterpretation; conflicts must surface.
- "This Charter is not merely a glossary. It defines: product ontology; subsystem boundaries; architectural levels; ownership of responsibilities; valid composition relationships; naming rules; customization levels; delivery outcomes; versioning expectations." (RPH-DOC-000.md L64-76) — Self-declared scope: the Charter governs structure and composition, not just words.
- "**Supersedes:** Informal and inconsistent uses of `Lens`, `workflow`, `Product Lens`, `Product Lens Workbench`, and JanumiCode as a single Professional Work Architecture" (RPH-DOC-000.md L10) — Header-level supersession list: five legacy usages explicitly retired.
- "it prevents the following concepts from being treated as interchangeable: JanumiCode / Product Realization PWA / Field Service Management Undertaking / Field Service Management SaaS Product / Product Realization View / Execution Workflow ... These are related, but they are not the same thing." (RPH-DOC-000.md L36-47) — The Charter's core non-equivalence set; conflation of these six is the named failure mode.
- "JPWB should be capable of building, assuring, governing, and evolving the professional-work systems that define and produce JPWB. This is a required dogfooding property." (RPH-DOC-000.md L352-356) — Bootstrap requirement: self-hosting generality is constitutional, not aspirational.
- "The term `Lens` is retired as the canonical name for a Professional Work Architecture. Use: Professional Work Architecture / PWA" (RPH-DOC-000.md L828-835) — Canonical retirement rule; the Charter's headline terminology ruling.
- "Do not use `workflow` as the canonical term for an entire PWA." (RPH-DOC-000.md L755) — Terminology rule reserving `workflow` for the temporal execution level only (valid per L726).

## DOCTRINE-CONOP

- "This hierarchy is conceptual, not necessarily a statement that each item must be deployed as a separate service or executable. ... The conceptual boundaries remain important even when implementation components are shared." (RPH-DOC-000.md L96-111) — Doctrine separating conceptual ontology from physical deployment; shared infra never dissolves boundaries.
- "Janumi Platform: provides infrastructure, runtime, services, and controls / Professional Work Architecture: defines the reusable professional-work structure / Undertaking: instantiates and operates that structure" (RPH-DOC-000.md L248-257) — Three-level machinery/structure/instantiation doctrine; the Charter's load-bearing division of responsibility.
- "RPH is primarily an architectural and runtime concept. JPWB is the principal user-facing environment through which RPH capabilities are exposed." (RPH-DOC-000.md L385-387) — RPH/JPWB relationship: control architecture vs surface; domain products build on both (L408-417).
- "A PWA is not primarily a temporal sequence. It may include: semantic progression; prerequisites; dependencies; feedback relationships; iteration permissions; conditional decomposition. But it is not reduced to a fixed linear workflow." (RPH-DOC-000.md L454-467) — Anti-linearization doctrine: PWAs are architectures of work, never phase pipelines.
- "JanumiCode is not a single PWA. It is a productized software-engineering environment containing multiple PWAs and domain-specific capabilities." (RPH-DOC-000.md L898-900) — Domain-product doctrine: products contain PWA libraries plus surfaces; a product is never one architecture.
- "A recurring concern such as security patching may be represented as: Independent PWA ... PWA module ... PWA profile ... View ... The classification must be explicit." (RPH-DOC-000.md L1071-1089) — Four-way representation choice with mandatory explicit classification; blocks ambiguous "security thing" constructs.

## VOCABULARY

- "**Janumi** is the company, product family, brand, and organizational authority responsible for the Janumi Platform and associated domain products." (RPH-DOC-000.md L119) — Root term: Janumi names the authority, never an architecture, Undertaking, workflow, or deployment (L134-142).
- "The **Janumi Platform** is the shared technical, operational, commercial, and governance foundation on which Janumi products and tenant workloads operate." (RPH-DOC-000.md L150) — Platform = shared foundation; supplies machinery only (L244).
- "**Janumi Professional Workbench** Abbreviation: JPWB ... JPWB is the general professional-work substrate used by Janumi's domain products." (RPH-DOC-000.md L275-298) — Canonical name, sole abbreviation, and ontological role: domain-agnostic substrate (capabilities at L285-296).
- "A **Professional Work Architecture** is a reusable, versioned architecture defining how a class of professional work should be structured, decomposed, executed, assured, governed, and accepted." (RPH-DOC-000.md L431) — Canonical PWA definition; "reusable, versioned" and "class of work" are the load-bearing qualifiers.
- "A **Professional Work Unit** is a bounded, identifiable, executable, assessable, and traceable unit of professional work." (RPH-DOC-000.md L523) — Canonical PWU definition; carries intent, obligations, execution/assurance/shape-integrity state, governance, traceability (L525-542).
- "PWU Type: reusable definition in a PWA / PWU Instance: concrete professional work in an Undertaking" (RPH-DOC-000.md L564-572) — The type/instance axis; Types live in PWAs, Instances in Undertakings.
- "An **Undertaking** is a concrete body of professional work instantiated under one or more compatible PWAs." (RPH-DOC-000.md L580) — Canonical Undertaking definition; note "one or more compatible PWAs" permits multi-PWA instantiation.
- "A **Professional Work Graph** is the instantiated semantic graph of professional-work objects and relationships belonging to an Undertaking." (RPH-DOC-000.md L651) — Canonical PWG definition: the graph belongs to an Undertaking and holds instances, evidence, decisions, baselines, trace links.
- "An **Execution Plan** is the governed plan for performing one or more PWUs." (RPH-DOC-000.md L706) — Plan sits between graph and workflow; governs steps, models, tools, permissions, escalation, termination.
- "An **Execution Workflow** is the temporal execution structure through which a plan is carried out. The term `workflow` is valid at this level." (RPH-DOC-000.md L724-726) — The only level where `workflow` is canonical vocabulary.
- "A **View** is a user-facing representation ... A **Projection** is a derived representation optimized for a particular question or user need. A View may be implemented using one or more projections. A **Viewpoint** is the organizing concern through which data is selected or arranged." (RPH-DOC-000.md L771-790) — Three distinct presentation-layer terms; View=surface, Projection=derivation, Viewpoint=concern.
- "Product Lens becomes Product Realization PWA / Lens Designer becomes PWA Designer / Lens Library becomes PWA Library / Lens version becomes PWA version / Lens migration becomes PWA version migration" (RPH-DOC-000.md L855-875) — The complete Lens-term migration table; the interpretive key for all legacy documents.
- "`Lens` may remain in: legacy code; migration adapters; historical documents; informal UI terminology for viewpoints; branded names that are explicitly defined. When used for a UI perspective, prefer: View; Viewpoint; Projection." (RPH-DOC-000.md L837-851) — Bounded residual-use exception to the Lens retirement.
- "**JanumiCode** is the Janumi domain product for software-product conception, realization, implementation, validation, deployment, operation, maintenance, and evolution." (RPH-DOC-000.md L883) — Canonical JanumiCode definition: a domain product built on Platform, JPWB, RPH, and software-product PWAs (L886-894).
- "The **Product Realization PWA** is the reusable Professional Work Architecture used to shape, define, architect, implement, validate, and baseline a software product." (RPH-DOC-000.md L965) — Canonical name for the ex-"Product Lens"; seven top-level PWU Types at L969-978.

## SEMANTIC-INVARIANTS

- "The Undertaking is the governed body of work. The resulting product is the output produced and evolved through that work." (RPH-DOC-000.md L609-611) — Work ≠ product invariant; e.g. FSM SaaS Undertaking vs FSM SaaS (L613-619).
- "The Professional Work Graph represents what the professional work is and how its semantic elements relate. An execution workflow represents how work is temporally performed." (RPH-DOC-000.md L696-698) — Semantic-graph ≠ temporal-execution invariant; the what/how boundary.
- "A Security View is not automatically a Security Maintenance PWA." (RPH-DOC-000.md L801) — Presentation ≠ architecture invariant: a filtered surface never implies a reusable body of work.
- "These surfaces are domain-specific projections and interaction models. They are not themselves PWAs." (RPH-DOC-000.md L955-957) — All JanumiCode named surfaces (Architecture Studio, V&V View, etc.) are projections, never architectures.
- "The legacy JanumiCode decomposition viewer is understood as an early form of a: Product Realization View ... It was not the Product Realization PWA itself." (RPH-DOC-000.md L1004-1012) — Retroactive classification of the legacy viewer as View, not PWA; governs how prior work is read.
- "JPWB is not: exclusively a workflow editor; only a PWA authoring tool; only an Undertaking dashboard; specific to software engineering; identical to JanumiCode." (RPH-DOC-000.md L360-366) — JPWB non-equivalence list; especially JPWB ≠ JanumiCode.

## OPEN-QUESTIONS-CONTRADICTIONS

- §3 hierarchy renders JPWB and JanumiCode as sibling children of Janumi Platform (RPH-DOC-000.md L84-94), yet §15.1 states JanumiCode "is built on: Janumi Platform; JPWB; RPH" (L886-890) — sibling-vs-layered tension: the tree flattens a dependency the prose declares; canon must pick one rendering.
