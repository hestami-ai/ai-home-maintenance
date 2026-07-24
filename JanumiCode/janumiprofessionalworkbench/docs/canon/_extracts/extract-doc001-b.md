# Extract: Migration to the Recursive Professional Harness (lines 1101-2136)

Source: docs/Recursive Professional Harness/Janumi Professional Workbench Product Realization PWA - Migration to the Recursive Professional Harness.md, L1101-L2136. Spec document (no chat turns; HUMAN/ASSISTANT tagging does not apply; no sponsor rulings appear in this range). Filename abbreviated below as "Migration-RPH.md". Focus: architecture intent, DOCTRINE-CONOP priority. 35 items.

## CONSTITUTIONAL CANDIDATES

- "It is to change the fundamental unit of Janumi Professional Workbench from the legacy execution-workflow phase to the Professional Work Unit." (Migration-RPH.md L2118-L2120) — The migration's single purpose statement; PWU replaces phase as the fundamental unit.
- "Shape Engineering defines the work... Harness Engineering provides the capabilities... Loop Engineering determines how execution progresses through time. Assurance Engineering continuously evaluates whether the evolving work remains faithful to the originating intent." (Migration-RPH.md L2126-L2132) — The four-discipline separation of concerns; constitutional decomposition of the whole system.
- "user intent is recursively transformed into professional work, acted upon by generative agents, continuously challenged through assurance, and promoted into an authoritative software outcome only when the available evidence justifies doing so." (Migration-RPH.md L2136) — Closing product thesis: evidence-justified promotion, continuous challenge.
- "A PWU cannot enter `SATISFIED` solely because execution succeeded." (Migration-RPH.md L1889) — Core invariant 5; execution success never implies work satisfaction (exec ≠ assurance).
- "Execution state and assurance state are distinct." (Migration-RPH.md L2086) — Architectural decision 8; the two state axes may never be conflated.
- "The Execution Workflow graph is not the canonical model. Professional Work Objects are the canonical model." (Migration-RPH.md L2079-L2080) — Decisions 1-2; canonical-model ruling underpinning all persistence and UI, and demoting the phase enum to display (L1771).
- "A completion claim must reference admissible evidence." ... "Invalidated evidence cannot support an active completion claim." (Migration-RPH.md L1891, L1907) — Invariants 6 and 11; claims are evidence-backed and evidence invalidation propagates to claims.
- "Baseline promotion requires an authorized decision." (Migration-RPH.md L1909) — Core invariant 12; promotion is governance, never automatic.
- "Runtime capabilities cannot be granted by a PWU or template alone." (Migration-RPH.md L1911) — Core invariant 13; capability authorization is independent of work definition ("Runtime permissions are checked independently from work definitions", L1954).
- "Graph layout changes cannot alter work semantics." (Migration-RPH.md L1917) — Core invariant 16; with §17: "Presentation changes must not alter semantic versions" (L1695). Presentation and semantics are separate version universes.
- "Every semantic object revision must retain provenance and version history." (Migration-RPH.md L1919) — Core invariant 17; provenance retention is non-negotiable.
- "COMMIT is decomposed into a repository operation plus separate baseline governance; a commit never implies baseline promotion." (Migration-RPH.md L2089) — Decision 11; severs repository mechanics from authority.

## DOCTRINE-CONOP

- "Assurance Policy implementations, including validators, must not return only pass or fail." They emit "observations; measurements... evidence references; severity; confidence or uncertainty... recommended control action; affected objects; residual concerns." (Migration-RPH.md L1281-L1292) — Assurance output doctrine: rich typed findings, never boolean gates.
- Permitted control actions: "continue... request more evidence; retry execution; use a different model or tool... revise context; revise prompt; reshape PWU; revise decomposition; replace execution plan; escalate to human; waive; reject; abandon." (Migration-RPH.md L1296-L1312) — The closed control-action vocabulary assurance findings may trigger; defines the loop's degrees of freedom.
- "A PWU does not directly encode its runtime sequence." (Migration-RPH.md L1320) — Decision 4 in the flesh: execution plans (and runtime bindings, decision 5) are separate objects from the work definition.
- Controller CONOP: "Is the PWU sufficiently shaped?... Is decomposition required?... Is there an approved execution plan?... Are runtime bindings authorized?... Execute next eligible step → Capture artifacts, evidence, and observations → Evaluate assurance policies → Select control action... If root PWU is satisfied: assemble evidence package, request baseline promotion" (Migration-RPH.md L1428-L1469) — The canonical controller decision sequence; satisfaction requests, never performs, promotion.
- "The workbench will provide multiple synchronized projections over the same underlying objects." (Migration-RPH.md L1477) — One model, many views, each defined by a primary question: Work "What professional work exists, and what must remain true?" (L1495); Assurance "Why should the user trust the result?" (L1532); Change-Impact "What must be reconsidered if this changes?" (L1584).
- "The first implementation may preserve the legacy phase order through a static compatibility Execution Plan... The runtime model must nevertheless support later dynamic control actions." (Migration-RPH.md L1471) — Compatibility-first doctrine; culminates in "The first migration target is behavioral parity, not maximum autonomy" (L2093, decision 15).
- "Dynamic AI-generated structures are introduced only after the runtime can validate and govern them." (Migration-RPH.md L2094) — Decision 16; governance capability precedes generative autonomy. Mitigates semantic drift via "decomposition contracts, coverage claims, independent validation, and human approval for high-impact shapes" (L2071).
- "REPLAN becomes a general control action... REVIEW becomes governance. ASSUMPTION_SURFACING and HISTORICAL_CHECK become cross-cutting assurance capabilities." (Migration-RPH.md L2088-L2091) — Decisions 10, 12-13: legacy phases dissolve into control actions, governance, and cross-cutting assurance.
- Over-modeling risk: "The architecture could become too complex for ordinary coding tasks. Mitigation: use risk-proportional shaping and assurance profiles." (Migration-RPH.md L2031-L2035) — Proportionality doctrine; rigor scales with risk. Assurance recursion likewise bounded by "risk-based stopping rules... explicit residual uncertainty" (L2059).
- "Not every PWU Type must be instantiated as a PWU Instance for every Undertaking. The Product Realization PWA definition, selected profile, and shaping policies determine which instances are required." (Migration-RPH.md L1104) — Profile-driven instantiation; the PWA catalog is a policy-governed menu, not a mandatory checklist.

## VOCABULARY

- Independence requirement ladder: "'NONE' | 'DIFFERENT_INVOCATION' | 'DIFFERENT_AGENT' | 'DIFFERENT_MODEL' | 'HUMAN'" (Migration-RPH.md L1238-L1243) — Semantic gradation of validator independence; that independence is configurable per assurance policy is the load-bearing rule.
- Four independent state axes per PWU: lifecycle (§11.1), execution state (§11.2), assurance state (§11.3), shape-integrity state (§11.4). (Migration-RPH.md L1108-L1191) — The multi-axis state vocabulary itself; no single status field can represent work.

## SEMANTIC-INVARIANTS

- "Every root PWU must trace to an approved or explicitly provisional intent." (Migration-RPH.md L1881) — Invariant 1; no orphan work. Non-root PWUs need "a parent or an explicit independent authority" (L1883).
- "Every mandatory parent obligation must be delegated, retained, satisfied, waived, or superseded." and "Every mandatory parent constraint must be propagated, retained, waived, or declared inapplicable with rationale." (Migration-RPH.md L1885-L1887) — Invariants 3-4; nothing mandatory silently drops across decomposition.
- "Every assurance result must identify: the claim or subject assessed; the evidence considered; the criteria applied; the disposition; the Assurance Policy implementation identity." (Migration-RPH.md L1893-L1899) — Invariant 7; assurance results carry full provenance of the assessment itself.
- "A material assumption cannot remain implicit after an assurance policy detects it." and "A falsified material assumption must trigger impact analysis." (Migration-RPH.md L1901-L1903; also L1206) — Invariants 8-9; the assumption lifecycle has forcing consequences.
- "A change to intent, constraints, or architecture must identify potentially affected descendants." (Migration-RPH.md L1905) — Invariant 10; change-impact identification is mandatory, not best-effort.
- "Recomposition must establish that child results collectively support the parent claim." (Migration-RPH.md L1915) — Invariant 15; recomposition is a validated claim, not aggregation.
- "Open blocking observations prevent baseline promotion unless an authorized waiver exists." (Migration-RPH.md L1921) — Invariant 18; an authorized waiver is the only lawful bypass, and "Human overrides must record authority, rationale, scope, and affected objects" (L1913).

## PROTOCOL-PRACTICE

- "The initial schema should avoid one generic Execution Workflow JSON document as the primary source of truth... A relational core should be used for universal semantics. Domain-specific extension data should use schema-versioned JSON payloads. EAV should not be used as the canonical extension mechanism." (Migration-RPH.md L1600-L1631) — Persistence doctrine: relational core plus versioned JSON extensions; two named anti-patterns.
- "The migration has a reversible fallback until parity criteria are met." (Migration-RPH.md L1976) — Reversibility protocol; authority transfer is gated by rollback capability, and durable states "survive extension restarts" (L1953).

## OPEN-QUESTIONS-CONTRADICTIONS

- §11.1 draws the PWU lifecycle as a single linear happy path (PROPOSED→...→BASELINED) while §12.4/§14 define a loop of reshaping/replanning control actions; the mainline diagram omits return edges (where RESHAPING or CHALLENGED re-enters is unspecified). (Migration-RPH.md L1112-L1148 vs L1294-L1471) — Re-entry semantics after reshaping are left undefined; implementations must invent them.
- §12.2 says the migration "should define at least" 17 assurance policies, but no criterion distinguishes mandatory from profile-optional, while L1104 makes profiles govern required instances. (Migration-RPH.md L1257-L1277 vs L1104) — Open question: is the 17-policy list itself subject to risk-proportional profiles, or a floor?
