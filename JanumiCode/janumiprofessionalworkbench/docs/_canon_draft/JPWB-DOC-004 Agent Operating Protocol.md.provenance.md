# Provenance — JPWB-DOC-004 Agent Operating Protocol (v0.1.0, 2026-07-16)

Maps each major section of the draft to its sources. Line references are to the source files as they existed on 2026-07-16. "Brief" = the Canon Synthesis Design Brief (session scratchpad, 2026-07-16). "Guide" = `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md`. "EngConst" = `docs/Recursive Professional Harness/Janumi Professional Workbench - Engineering Constitution.md`. Extract files (`docs/extract-*.md`) were used as the survey layer; primary citations below are to the underlying sources they quote.

## Status block
- Brief §4 (status block schema, L36-53); Brief §5 JPWB-DOC-004 scope (L83-86). Settledness PRESUMPTIVE per Brief §3 ladder (L26-34).

## §1 Purpose
- Guide §15 preamble ("minimum operating contract… repository-local instructions and accepted ADRs still apply", L2379-2381).
- Convergence framing: Brief §7 (L98-100) and Brief §13 (L166-172). C1 commitment stance: Brief §2 (L22).

## §2 Reading protocol
- §2.1 Load order: NEW (session consensus — Brief §5 DOC-004 scope, L85: "load order: CON-000 → task-relevant artifacts; the repo is shape authority"). Ordering pattern adapted from RPH README coding-agent reading sequence (README.md L144-157, via extract-rph-readme-exec.md L48) and "authoritative order, not generation order" (README.md L3, via extract L43). Non-example (no full re-read per task) NEW per Brief §11 P6 edge rule.
- §2.2 Precedence by concern: Brief §10 rule of recognition item 3 (L136); conflict-surfacing rule from README.md L179 (via extract-rph-readme-exec.md L47).
- §2.3 Repository as shape authority: Brief §6 authority partition (L94-96); Brief §5 DOC-003 authority partition (L80). Two-way cut (shapes carry no semantic authority) NEW (session consensus, implied by Brief §6 "precedence by concern, not by document").
- §2.4 Retired material: opening now delegates the status-and-authority declaration to CON-000 Part B by reference (review repair 2026-07-16, altitude rule Brief §11 / §10 item 5) instead of restating Brief §10 item 8; consumption rules retained as this section's own content; gap→OPEN QUESTION routing from Brief §9 case 8 (L128).

## §3 Intake discipline
- §3.1 checklist: adapted from Guide §15.1 intake block (L2385-2399), compressed; wire-detail items generalized to canon-artifact references per Brief §11 no-shape-restatement. Proportionality sentence ("not every item applies") NEW per P6 edge rule.
- §3.2: Guide §15.1 (L2401: inspect real repository; no blind vocabulary replacement).
- §3.3 change contract: Guide §15.1 (L2403).
- §3.4 adjudicate-or-escalate at intake: replaces Guide §15.1's pure stop rule (L2403: "stop and surface the conflict") per Brief §5 DOC-004 scope (L85: "the adjudicate-or-escalate rule replacing the pure stop rule"). Safe-default consumption discipline adapted from Guide §16 preamble (L2494). Constitutional/vocabulary escalation reserve: Brief §8 delegation boundaries (L115). "Files a new entry or appends a superseding entry" wording aligned to REG-005's append-only changeProcedure (review repair 2026-07-16; was "files or updates").

## §4 Smallest coherent change
- Guide §15.2 (L2405-2425): vertical trace ladder (compressed — assurance-repair sub-rungs folded; wire-level rungs kept as layer names only), "change every affected layer, but do not widen the feature", field-readiness questions.
- Non-example ("not smallest diff") NEW per P6 edge rule; "land together" from Guide §14.5 (L2362).
- New-concept burden-of-proof paragraph (review repair 2026-07-16, survivorship): Janumi Constitution Discussion.md L12991-12995 ("SHALL explain why composition, specialization, or relationship modeling is insufficient") + New-Concept Test questions L25882-25888.
- Removal-counterpart paragraph (review repair 2026-07-16, survivorship): Fusion Analogy L277-287 (change-impact interrogation) + L269-293 (system-continuity test) + L256-262 (degradation signature); Hyrum presumption from Validator Subsystem L164.

## §5 Implementation discipline
- Guide §15.3 (L2429-2442), condensed and re-altituded: rules whose semantics live in DOC-003 are stated as procedural obligations with delegation by ID per Brief §11 altitude rule.
- Untrusted-proposal rule + non-example: Guide §15.3 (L2434) + NEW non-example per P6.
- "Never build projection theater": NEW normative formulation grounded in Brief §10 item 7 anti-vacuity clause (L140) and Brief §13 ground truth (hollow governed layer, L168; provenance-theater sourceSection, L169). Staged-schema-evolution non-example NEW (review repair 2026-07-16, P6 — resolves tension with the forward-safe-migrations bullet).
- Write-path-around-Commands non-example (migrations/projectors/telemetry) NEW (review repair 2026-07-16, P6 edge rule).
- Secrets-in-durable-records bullet (review repair 2026-07-16, survivorship): JSRP ruling, Janumi Constitution Discussion.md L20745-20768 + L20880-20890 ("records SHALL store secret references, not secret values"); vaulting mechanics ceded to repository per Brief §6.
- Boolean/badge prohibition: Guide §15.3 (L2436), shape detail ceded.
- Ad hoc wire-field change prohibition: Brief §9 case 7 (L127) + Guide §16 item 4 safe default (L2501).

## §6 Verification and handoff
- §6.1 ladder: Guide §15.4 (L2444-2455), near-verbatim, wire-slice qualifiers trimmed. Skip-rung judgment sentence NEW per P6.
- §6.2: Guide §15.4 (L2456: inspect artifacts not exit codes; report what was not verified). "Green exit code is an execution fact" phrasing adapted from Guide §13.4 (L2243).
- §6.3: Guide §15.5 (L2458-2470) + §15.6 definition-of-done spirit (L2472-2488), compressed; REG-005 line NEW.

## §7 Engineering practice (EngConst absorption)
- §7.1 Comments: EngConst L1-313 — primary principle (L5), self-documenting first (L21-30), why-not-what (L34-46), business context minimal fragments (L50-62), boundary contracts (L81-99), invariants (L103-114), error handling (L118-126), TODOs (L142-160), warnings (L164-175), drift (L179-191), secrets (L195-207), comment taxonomy (L211-252), agent editing rules incl. inferred rationale (L271-287), closing standard (L307-313).
- §7.2 Observability: EngConst L317-689 — reconstructability (L329), boundaries first + capture set (L333-355), decision traces (L359-374), structured logs (L378-395), correlation (L399-412), typed errors (L416-437), failure evidence (L441-458), LLM-call telemetry + redaction (L462-481), transitions incl. rejected (L485-504), fail loudly / no silent repair (L599-612), final standard (L685-689). CoT-log prohibition cross-ref: Guide §14.6 (L2373). Correlation-ID prohibition scoped to request/job/queue/model-call flows with process-lifecycle non-example NEW (review repair 2026-07-16, P6 edge rule).
- §7.3 Debugging: EngConst L616-681 — nine-step workflow (L618-630), report contract (L634-664), absence-of-evidence anti-pattern (L681).
- §7.4 Testing: EngConst L693-1253 — philosophy (L695-703), behavior not implementation (L723-735), bug→permanent test (L739-748), trust boundaries (L752-767), evidence pyramid (L771-781), prompt regression (L1037-1049), trajectory tests (L1053-1069), observability tests (L1073-1097), coverage philosophy (L1153-1166), definition of done (L1241-1253). Behavioral-assertion + fixture discipline: Guide §14.3 (L2346). Numeric floors ceded to repo gates: re-altituding of Guide §14.4 (L2350-2354) per Brief §6 — see Open Items. Review repairs 2026-07-16: duplicate definitional sentence cut (vacuity); regression-test hedges ("significant"/"when feasible") replaced with a recordable infeasibility act (voice rule); test-weakening prohibition restored from JCODE-INV-006 (Janumi Constitution Discussion.md L24789-24791; kin L23434-23447); no-mocking-internal-domain-seams and mutation-evidence bullets restored from RPH-DOC-008 L2438 and L2355-2368 (survivorship).
- §7.5 Quality gates: Guide §14.5 (L2363: address or scoped exception, never suppress); complexity rule EngConst L1188, restated as protocol content with the "standing sponsor directive" claim dropped and REG-Q-041 cited inline (review repair 2026-07-16 — no REG-005 DECISION records the directive; CON-000 B5); tooling-procedure cession NEW (resolves EngConst L1186 pointing outside the JPWB tree — see Elicitation).

## §8 The Divergence Protocol
- §8.1 table: Brief §8 (L102-113), near-verbatim as mandated. Underlying taxonomy: RPH-DOC-009 L2425-2433 (via extract-doc009-a.md L46).
- Anti-gaming paragraph (doubt resolves toward escalation): NEW (session consensus; consequence of Brief §8's CODE_BEHAVIOR_UNDOCUMENTED/SEMANTIC_CONFLICT actions).
- Convergence presumption: Brief §7 (L98-100).
- Worked routing (hollow governed layer): Brief §9 case 3 (L123) + Brief §13 (L168). Worked routing (floor-criteria edit): NEW, grounded in session ground truth (memory: editing floor criteria ships a policy that lies).
- §8.2 delegation boundaries: Brief §8 (L115), near-verbatim, itemized. JanumiCode-as-one-PWA non-example: Brief §9 case 5 (L125).
- §8.3 adjudicate-or-escalate: NEW articulation of Brief §5 (L85) + Brief §8 actions; partial-blockage rule NEW.

## §9 Filing findings and register entries
- Register nature (append-only, close-by-merge, rulings may not float): Brief §5 REG-005 (L88-92). Lost-CoT-ruling example: Brief §5 (L89, "that is how the CoT ruling got lost").
- §9.1 when-to-file triggers: NEW (session consensus; derived from Brief §8 actions and Brief §5 REG-005 open-questions scope, L91).
- §9.2 entry format: Brief §5 (L92), verbatim fields. Evidence discipline and decidable-statement rule: NEW. Safe-default characterization: Guide §16 preamble (L2494: "conservative progress without creating new meaning").

## §10 Drafting standards for agent-authored normative text
- Items 1-6: Brief §11 (L143-151), restated as agent obligations per Brief §5 DOC-004 scope (L85: "drafting standards for any normative text the agent authors (P6 edge rule)").
- Item 7 (epistemic honesty / status conferred): Brief §10 item 2 (L135) + EngConst L281 (never invent rationale; label inference). C1 parenthetical: Brief §2 (L22).

## §11 Worked example: the §9.7 over-application
- Mandated by Brief §5 (L86) and Brief §9 case 1 (L121).
- §11.1 rule text: `docs/Documentation Challenges/coding-guide-fallacy-analysis-6a2b0f.md` L104-107 (§9.7 quoted text).
- §11.2 failure: fallacy-6a2b0f.md L4-23, L109-117 (hardcoded `thinkingLevel: 'off'` with §9.7 citation). "Two independent agents": Brief §2 P6 (L19) and Brief §13 (L171).
- §11.3 fallacy naming: fallacy-6a2b0f.md L138-150 (category error; usage vs generation; overgeneralization). "Compliance-by-elimination / vacuous compliance" class name: Brief §2 P6 (L19).
- §11.4 correct reading: fallacy-6a2b0f.md L88-90, L152-157 (enable thinking; fence output; declared rationale remains governed). Review repair 2026-07-16: the sponsor's conversational ruling (fallacy-6a2b0f.md L56-58 [HUMAN]) is no longer asserted as effective — it was lost unregistered (REG-Q-027, CON-000 B5); the draft now cites REG-F-004 for the decided consumption≠generation adjudication and routes the pending ruling and the substantive retention policy to REG-Q-027, whose safe default governs until merge (also breaks the DOC-004↔DOC-003 PER-8 circular routing on this concern; the DOC-003 side of that repair belongs to DOC-003's repair pass). Original routing intent: Brief §9 case 6 (L126).
- §11.5 general test: NEW (session consensus — generalization of the fallacy analysis into a reusable three-question check; "over-application is not the safe direction" is the drafted resolution of fallacy-6a2b0f.md's open question at extract-docchallenges.md L61).

## Closing line
- NEW; restates Brief C1 (L22) and Brief §3 HYPOTHESIS/PRESUMPTIVE stance for this artifact's own text.

## ELICITATION-REQUIRED

1. **Quality-gate exception scope (§7.5).** EngConst L1188 mandates complexity findings be addressed "fully" while EngConst L1220 permits "documented exceptions where required or strongly recommended." The draft reconciles as "explicit recorded exception, not silence," but the sponsor's intended exception scope is unadjudicated.
2. **Post-retirement home of the SonarQube/scanner procedure (§7.5).** EngConst L1186 points to `JanumiCode\janumicode_v2\docs\sonarqube-headless-remediation-guide.md`, outside the JPWB tree. The draft cedes tooling procedure to "the repository"; sponsor should confirm where that operational doc will live once the source corpus is retired.
3. **Numeric coverage/mutation floors (§7.4).** Guide §14.4 states specific floors (100%/90%/risk-based). The draft cedes numbers to repository gates and keeps only their meaning ("diagnostics, not goals"). Confirm the floors are (or will be) encoded in repo gate configuration; otherwise they are lost at retirement.

## Finalizer pass (2026-07-16)
Cross-artifact residue closed by the program finalizer: Attention Item entries added to DOC-002 §3 and DOC-003 §3 (disposition meanings NEW — REG-E-021); DOC-004 §7.2 exchange-record pointer to DOC-003 PER-9 and §11.4 repointed to PER-12; REG-Q-048 (cross-organization scope) and REG-E-001..022 filed in REG-005 Section E. Conferral instrument: 'JPWB Canon Ratify Sheet (R1).md'.

## Amendment pass (2026-07-16, sponsor-directed: AssessmentCriterion incident)
REG-D-008 applied: CON-000 B1 gained the reference-artifact non-example (implementation is never its own shape authority); DOC-004 §2.3 gained the reference/experiment discipline paragraph; REG-005 gained REG-D-008 (decision) + REG-F-005 (the AssessmentCriterion impoverishment, DOCS_STRONGER + B7); Ratify Sheet Part 4 gained retirement precondition 2 (shape-survivorship audit). Source: sponsor discussion of the {id, statement, mandatory} vs ratified 8-field criterion gap found against the pre-canon corpus.
