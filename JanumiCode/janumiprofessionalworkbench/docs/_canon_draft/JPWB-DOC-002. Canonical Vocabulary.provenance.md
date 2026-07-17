# Provenance sidecar — JPWB-DOC-002 Canonical Vocabulary (DRAFT 2026-07-16)

Source key:
- CHARTER = `docs/Recursive Professional Harness/Janumi Product Architecture and Canonical Vocabulary Charter - Governing Product Ontology, Subsystem Boundaries, and Naming Authority.md` (RPH-DOC-000; deep-read directly at cited lines)
- GUIDE = `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md` §3 (L203-288)
- EXT(x) = extract file (secondary; line refs inside cite the underlying source)

## Header status block
- Conformed to design-brief §4 YAML schema (REPAIR PASS 2026-07-16); Authority/Supersedes content folded into §0 body and governs bullets. changeProcedure per CON-000 Part B clause 5.

## §0 Authority and scope
- Authority clause: CHARTER L51-62 (via EXT(extract-doc000-a.md) L8-9). The Charter's 4-step conflict protocol (L57-62) was REPLACED in the repair pass: it presupposed live, revisable older artifacts; rewritten against the two real populations (other canon artifacts per CON-000 B3; retired/legacy material per CON-000 B8), with surfacing defined as a JPWB-REG-005 finding. Steps 2-3's substance (surface, never silently reinterpret) is retained for intra-canon conflicts.
- "Not merely a glossary" scope framing: CHARTER L64-76.
- Meanings-not-schemas boundary: NEW (session consensus; per drafting standard "no wire-shape restatement"). Shape authority now cited as the repository per CON-000 Part B (repair pass; former "contracts repository and its canon artifact" referenced a nonexistent seventh artifact).

## §1 Product family ladder
- Janumi definition + is-not list: CHARTER L119, L134-142 (read directly).
- Janumi Platform: CHARTER L150, L244; shared-deployment caveat CHARTER L96-111 (read directly).
- JPWB definition + sole abbreviation: CHARTER L275-298; JPWB is-not list: CHARTER L360-366 (via EXT(doc000-a) L30, L51). Meaning cross-checked against GUIDE L209.
- RPH: CHARTER L385-387 + GUIDE L210 (RPH ≠ Workflow Engine inequality: GUIDE L250).
- Domain Product: CHARTER L2036-2038; view-not-product: CHARTER L1737-1739 (via EXT(_working/extract-doc000-b.md) L28, L46).
- JanumiCode: CHARTER L883-900 + GUIDE L237; not-one-PWA: CHARTER L898-900.
- JanumiCode "built on Platform, specialized from JPWB" vs sibling tree: RESOLVED-BY-SYNTHESIS of the open contradiction flagged in EXT(doc000-a) L55 (CHARTER L84-94 tree vs L886-890 prose). Layered reading adopted on the strength of CHARTER invariant 4 (L1854, read directly), §30 (L1687-1721), and final formulation L2111-2113. Flagged in openItems for sponsor confirmation.
- Product Realization PWA: CHARTER L965 (via EXT(doc000-a) L42).
- Identity paragraph: CHARTER L2111-2113. Canonical reference chain: CHARTER L1342-1344 (via EXT(doc000-b) L8-9).

## §2 Work structure
- PWA definition + anti-linearization: CHARTER L431, L454-467 + GUIDE L212.
- PWU definition: CHARTER L523, L525-542 + GUIDE L213; PWU meaning-content list: EXT(_working/extract-doc001-a.md) L247 (RPH-DOC-001 L127-135).
- Professional Work Object (PWO) entry: RPH-DOC-001 L425 (four defining properties) + L467 ("a PWU is an executable Professional Work Object"); authoritative-graph relation aligns with JPWB-DOC-003 LYR-2. Added in repair pass (survivorship restoration).
- PWU Type / PWU Instance / ownership: CHARTER L564-572, L1866-1868 (invariants 10-11, read directly) + GUIDE L214-215.
- pwuKind compatibility rule: EXT(extract-doc002-a.md) L97 (RPH-DOC-002 L533) + EXT(extract-doc006.md) L128 (RPH-DOC-006 L150).
- Child PWU Type/Instance + no-SubPWU + shorthand non-example: GUIDE L216, L266.
- Undertaking + actuals ownership + output genericity: CHARTER L580, L1256-1278, L1477-1503 + GUIDE L218; work ≠ product: CHARTER L609-619; FSM three-way non-equivalence: CHARTER L1874-1876 (invariants 14-15, read directly).
- PWG: CHARTER L651, L696-698 + GUIDE L219; graph≠execution inequalities: GUIDE L251-252.
- Execution Plan / Execution Workflow + workflow rule + valid/avoid non-example: CHARTER L706, L724-726, L753-763 (read directly) + GUIDE L220-221.
- PWA Profile / template: CHARTER L1173-1207 (via EXT(doc000-b) L38).
- Derivation ladder + immutability + no-silent-mutation + change-proposal flow: CHARTER L1238-1250, L1280-1305 + GUIDE L273-287.
- Reference Fixture: CHARTER L1767-1781 (via EXT(doc000-b) L30); fixture naming: EXT(extract-rph-readme-exec.md) L216.
- PWA Work Architecture View: GUIDE L217.

## §3 Epistemic and professional-state terms
- Outcome: EXT(extract-condisc-1501.md) L26 (Constitution Discussion L1805-1809). Inequalities: GUIDE L242, L245.
- Intent: EXT(extract-doc003-a.md) L105 (RPH-DOC-003 L203-205) + EXT(extract-condisc-21001.md) L44 (L22450). Intent ≠ Requirement: GUIDE L242.
- Artifact/Representation: EXT(condisc-1501) L29 (L2499-2505); inequalities GUIDE L246.
- Evidence admission (provenance/relevance/scope/limitations): EXT(extract-doc008-a.md) L141 (RPH-DOC-008 L1283-1293, L1223-1247). Inequalities: GUIDE L243. Repair pass: refusal/scope-enforcement mechanics removed and delegated to JPWB-DOC-003 ASR-6 (single owner of the invariant; altitude rule).
- Claim / Defect-as-Claim: EXT(extract-condisc-22501.md) L50 (L23930); Claim ≠ Decision: GUIDE L244.
- Assumption accepted≠verified: EXT(extract-doc002-a.md) L99 (RPH-DOC-002 L848); Confidence ≠ Certainty: GUIDE L249.
- Decision: CHARTER L1509-1526 (governance authority list) + GUIDE L230; Decision ≠ Truth / ≠ Action / Validation ≠ Approval: GUIDE L244-248.
- Baseline + commit≠baseline: CHARTER L1528-1557 + GUIDE L231; scoped authority: EXT(extract-doc006.md) L127 (RPH-DOC-006 L1265); satisfaction≠convergence≠acceptance≠promotion: GUIDE L257 (and Guide principle 18, L195).
- Stakeholder/Participant: EXT(condisc-1501) L27 (L1920-1924) + EXT(condisc-21001) L42 (L22371); identity/ownership/authority inequalities: GUIDE L247-248.
- Risk/Issue: EXT(condisc-1501) L30 (L2577-2579).
- Authoritative semantic state inequality: GUIDE L258; dialogue-as-provenance support: EXT(extract-doc005.md) L121 (RPH-DOC-005 L1723).

## §4 Assurance and governance vocabulary
- Six discipline names canonical (definitions owned by JPWB-DOC-001 §5): added in repair pass; grounded in CON-000 §1 ("prove the method at the Shape Engineering level") and DOC-001 §5.2's discipline table — resolves the prior contradiction that listed Shape Engineering as not-yet-canonical.
- Verification / Validation paired entries: Constitution Discussion L23671-23679 ("Passing all tests does not imply product validation"; validation as outcome-facing evidence) + L22940 ("Implementation and verification SHALL remain separate statuses"). Added in repair pass (survivorship restoration; DOC-003 REL-1/REL-2 use both relation types without a meaning ledger).
- Assurance Engineering: GUIDE L211; assurance-evaluates-claims: CHARTER L1509-1526.
- Governance: CHARTER L1509-1526.
- Assurance Policy: GUIDE L222; Assessment-as-application: EXT(extract-doc002-a.md) L100 (RPH-DOC-002 L1108).
- Validator + recommend/decide split: GUIDE L223 + EXT(_canon_draft/extract-doc007-b.md) L259 (Contract Package L1496-1501, L2419-2420); Validator ≠ Assurance Engineering: GUIDE L256; legacy Validator demotion: CHARTER L1588.
- Finding Definition / Assurance Observation / finding shorthand: GUIDE L228-229; findings-as-durable-obligations: GUIDE principle 17 (L193) + EXT(extract-legacy-validator-b.md) L199 (lifecycle, supporting).
- Material professional transformation + non-materiality non-example: GUIDE L227.
- Reasoning Review: GUIDE L224 (and principle 20, L199).
- Professional rationale summary: GUIDE L225.
- Private chain-of-thought (origin-fixed): GUIDE L226. Origin-not-topic non-example: NEW (session consensus, restating the origin axis of the sponsor's CoT ruling).

## §5 Presentation vocabulary
- View/Projection/Viewpoint: CHARTER L771-790 + GUIDE L232-234.
- Security View ≠ Security Maintenance PWA: CHARTER L801; JanumiCode surfaces are projections: CHARTER L955-957 (via EXT(doc000-a) L48-49).
- Lens-ambiguity confusion note: CHARTER L815-824 (read directly).

## §6 Packages and outputs
- Product Shape Package / Implementation Package + distinctness: CHARTER L1366-1370, L1443-1451 (via EXT(doc000-b) L29) + GUIDE L235-236.
- Output named separately; deployment optional; design-without-implementation disposition: CHARTER L1455-1503, L1886 (via EXT(doc000-b) L36, L47).

## §7 Version vocabulary
- Four version words: EXT(extract-doc007-a.md) L133 (RPH-DOC-007 L361-366); revision vs semanticVersion: EXT(extract-doc002-a.md) L95 (RPH-DOC-002 L331-333).
- Cede-field-placement-to-repository: NEW (session consensus per drafting standards).

## §8 Retired and compatibility terminology
- Migration table rows: CHARTER §27 L1561-1591 (read directly, full table) + CHARTER §14 L815-875 (Lens retirement, residual use, migration; read directly) + GUIDE §3.1 L261-271.
- Product Lens Workbench context-classification: CHARTER L1574 + L1903-1944 (via EXT(doc000-b) L52).
- Decomposition-viewer retroactive classification: CHARTER L1004-1012 (via EXT(doc000-a) L50) + CHARTER L1582.
- sub-PWU / dialogue / REPLAN / COMMIT / phase / Professional Endeavor rows: GUIDE L263-271; phase/REPLAN/COMMIT/Validator also CHARTER L1587-1590.
- Residual-use permission + LensAdapter non-example: CHARTER L837-851 (permission is Charter's; the concrete non-example is NEW, session consensus).
- Classify-don't-rename rule: EXT(extract-doc010.md) L146 (RPH-DOC-010 L92-102).
- LEM / PCLC / bare-Endeavor rows: added in repair pass (survivorship restoration). LEM demoted to derived projection over authoritative state: Constitution Discussion L6738-6742. PCLC demoted to additive viewpoint: JPWB-DOC-003 §6 + REG-Q-003. Bare `Endeavor` as pre-Undertaking name: Constitution Discussion L9001-11500 usage.

## §9 Naming rules and naming authority
- §9.1 grammar (products/PWA/Undertaking/View/Package suffixes + examples): CHARTER §28 L1594-1647 (read directly). NOTE: absent from GUIDE §3 — restored here as load-bearing (see verification findings).
- Event past-tense / Command imperative: EXT(extract-doc007-a.md) L134-135 (RPH-DOC-007 L70-75, L664).
- Recurring-concern four-way classification: CHARTER L1071-1089 (via EXT(doc000-a) L24).
- §9.2 naming authority inheritance: CHARTER L53 + L1894-1986. Change protocol restated in repair pass to the CON-000 Part B clause 5 path (REG-005 finding → sponsor ratification → merge); the prior "governance Decision" wording conflated the in-model Decision object with the canon's own change procedure. Alias-marking rule scoped to §9.1's reach with a §8 residual-use non-example (P6 edge rule).
- Machine vocabulary file as bound derivative: EXT(extract-ratify-roadmap.md) L206 (Ratify Sheet M0 L9-11); prose-governs precedence: NEW (session consensus).
- Engine/ontology vocabulary boundary (kinds as validated strings): EXT(extract-ratify-roadmap.md) L205 (Ratify Sheet M0 L52).
- §9.3 canonical/controlling/constitutional/canon/doctrine: EXT(extract-docchallenges.md) L154-158 (CanonVsDoc.md L79-338).

## §10 Content routed elsewhere
- Routing decisions: NEW (session consensus). Underlying facts: four state axes EXT(doc002-a) L98 + EXT(doc001-b) L254; dispositions EXT(doc004-a) L112-115 + EXT(doc006) L126; Owned/Reference EXT(condisc-13501) L19-21; vision-tier terms EXT(add-vision) L10-14; envelope/trajectory EXT(legacy-fusion) L168-170.
- Repair pass: routing targets resolved to explicit IDs per CON-000 Part B clause 1 (domain-model + assurance concerns → JPWB-DOC-003; shapes → the repository); disposition enum spellings removed (no-shape-restatement rule, brief §6); candidate-term routing retargeted from the provenance sidecar to JPWB-REG-005 (sidecars are not canon; brief §11 self-containment); Shape Engineering removed from the candidate list (canonical per §4). Former elicitation item 5 resolved.

## Guide-compression verification (Charter vs GUIDE §3)
Checked whether GUIDE §3 compressed away load-bearing Charter content. Findings — restored in this draft:
1. Naming grammar (CHARTER §28) — entirely absent from GUIDE; restored as §9.1.
2. Lens residual-use permission (CHARTER §14.3) — absent from GUIDE; restored in §8.
3. Conflict-resolution protocol (CHARTER L57-62) — absent from GUIDE; restored as §0.
4. Migration rows absent from GUIDE §3.1 (Product Lens Workbench, Workflow Canvas, Security lens split, Decomposition viewer, Shape document, Field Service rows) — restored in §8.
5. Reference Fixture, Domain Product, template-vs-profile, output-named-separately, deployment-optional — absent from GUIDE; restored in §§1-2, 6.
Terms present in GUIDE but not in the Charter (Assurance Engineering, Reasoning Review, Professional rationale summary, Private chain-of-thought, Material professional transformation, Finding Definition/Assurance Observation, PWA Work Architecture View, child PWU terms): carried forward from GUIDE as later-ratified vocabulary; provenance is the Guide itself plus its underlying rulings.

## ELICITATION-REQUIRED (consolidated)
1. `Professional Endeavor` — ratify as generic semantic supertype/alias or retire outright (currently: candidate alias, Undertaking canonical at product/UX boundaries).
2. Vision-tier candidate terms (Professional Scenario, Professional System, Professional Capability, Civilizational Capability) — admit to canonical vocabulary or hold at vision tier.
3. Candidate engineering terms from the Fusion essay (safe/acceptable operating envelope, trajectory) — admit or hold. (Shape Engineering RESOLVED in repair pass: the discipline name is canonical per CON-000 §1 + DOC-001 §5; only the envelope/trajectory siblings remain candidates.) NEEDS FILING as a JPWB-REG-005 open question (DOC-002 §10 now points there).
4. Sibling-vs-layered rendering of JanumiCode relative to JPWB — this draft adopts the layered reading; sponsor confirmation requested (tracked as REG-Q-037).
5. RESOLVED (repair pass): routing targets fixed to JPWB-DOC-003 and the repository per CON-000 Part B clause 1.
6. Whether the Guide-only terms (Assurance Engineering et al.) are ratified at CANONICAL settledness or remain PRESUMPTIVE with the Guide. NEEDS FILING as a JPWB-REG-005 open question.
Items 2 and 3 (residual candidates) are routed by DOC-002 §10 to JPWB-REG-005; item 2 overlaps REG-Q-039 (vision-object altitude); the register owner should file the residuals as REG-Q/REG-E entries before ratification.

## Finalizer pass (2026-07-16)
Cross-artifact residue closed by the program finalizer: Attention Item entries added to DOC-002 §3 and DOC-003 §3 (disposition meanings NEW — REG-E-021); DOC-004 §7.2 exchange-record pointer to DOC-003 PER-9 and §11.4 repointed to PER-12; REG-Q-048 (cross-organization scope) and REG-E-001..022 filed in REG-005 Section E. Conferral instrument: 'JPWB Canon Ratify Sheet (R1).md'.
