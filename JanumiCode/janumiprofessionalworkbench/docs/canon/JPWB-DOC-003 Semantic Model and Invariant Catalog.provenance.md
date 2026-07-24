# Provenance — JPWB-DOC-003 Semantic Model and Invariant Catalog (v0.2.0, 2026-07-16; repair pass applied — see final section)

Maps each major section/invariant to sources. Extract citations give the extract file (under `docs/` unless prefixed) and the underlying source doc + line range the extract recorded. "Guide" = `docs/Janumi Canonical Implementation Context - Coding Agent Guide.md`. NEW = session consensus (canon design brief, 2026-07-16). Line ranges for extract files refer to the extract's own numbering where the extract is the immediate source of wording.

## Status block
- Schema and settledness class: NEW — brief §3, §4, §5 (DOC-003 scope), §6 (authority partition).

## §1 How to read this artifact
- Entry format (statement/WHY/SCOPE/NON-EXAMPLE): NEW — brief §5 (DOC-003) + §11 drafting standards (P6 edge rule).
- Shape cession rule: NEW — brief §6; consistent with extract-doc007-a.md L6 (extraction note) and Guide §9.4 framing.
- Retirement of legacy INV numbering / STA-2 as INV-5 successor: NEW (session consensus; "INV-5" usage per prior corpus and project memory).

## §2 Five-layer semantic model
- Five layers: Guide §5.1 (L358-366).
- LYR-1: Guide §5.1 L366; extract-doc002-a.md item "seven-way separation" (RPH-DOC-002 L75-83); extract-doc008-a.md nine never-conflate distinctions (RPH-DOC-008 L21-31).
- LYR-2: extract-doc002-a.md (RPH-DOC-002 L91-95); extract-doc008-a.md (RPH-DOC-008 L13).
- LYR-3: extract-doc002-b.md (RPH Canonical Domain Model L2148); extract-doc007-a.md (RPH-DOC-007 L160-164); extract-doc007-b.md (Contract Package L2322); extract-doc008-b.md (L2011-2018, Property P8 L2346-2348). NON-EXAMPLE: NEW (P6).

## §3 Core objects and minimum rules
- Object table: Guide §5.2 (L368-397), compressed; PWU definition also extract-doc002-a.md (RPH-DOC-002 L99-111); Artifact obligations extract-doc003-a.md (RPH-DOC-003 L1214-1223); raw-intent preservation extract-doc008-a.md RPH-INT-001 (L423-441).
- Common object contract: Guide §5.3 (L399-413); ID prefix registry explicitly ceded to repo (brief §6).
- OBJ-1: extract-doc002-a.md (RPH-DOC-002 L152-164); extract-doc007-a.md (RPH-DOC-007 L94-105, L123-125, L302-306). NON-EXAMPLE from doc007 requiredness rule.
- OBJ-2: extract-doc002-a.md (RPH-DOC-002 L331-333); extract-doc007-a.md (RPH-DOC-007 L361-366); extract-doc009-a.md (RPH-DOC-009 L254-256, L2523-2545); Guide §9.4 four-axis table (L1244-1252).
- OBJ-3: extract-doc002-a.md (RPH-DOC-002 L350-356, L533); extract-doc007-a.md (RPH-DOC-007 L428, L572, L895-900); extract-doc008-a.md RPH-CON-009 (L402-417).
- OBJ-4: extract-doc002-a.md (RPH-DOC-002 L843-847); extract-doc002-b.md (L2144); extract-doc008-a.md RPH-ASM-002/-004 (L953-1016); extract-doc004-a.md POL-ASSUMPTION-DISCLOSURE (L941-952). NON-EXAMPLE: NEW (P6, materiality test).
- OBJ-5: extract-doc002-a.md (RPH-DOC-002 L745-746, L998-1004); extract-doc008-a.md RPH-EVD-001 (L1195-1219). NON-EXAMPLE: NEW (P6).
- OBJ-6: extract-doc008-a.md/-b.md RPH-EVD-007 (L1283-1293); extract-doc003-b.md evidence self-declaration (L1346-1353); Guide §8.11.
- OBJ-7: NEW — brief §10.7 anti-vacuity clause + §13 ground truth (hollow governed layer, sourceSection provenance theater); Guide §8.9 "policy attachment proves required treatment ... neither proves that assurance ran" (L1002).

## §4 Aggregate boundaries
- Five aggregates + enclosing-ownership rule: extract-doc002-a.md (RPH-DOC-002 L188, L190-270); Guide §5.4 (L415-423).
- AGG-1: extract-doc002-a.md (RPH-DOC-002 L190-270); extract-doc009-b.md (Persistence Design L2455); Guide §5.4 L423. NON-EXAMPLE from Guide §5.4.

## §5 Relationships and traceability
- REL-1: extract-doc003-a.md (RPH-DOC-003 L353); Guide §5.5 (L425-438) + §6.2 relationship table (L520-529). Relation vocabulary named-not-spelled: brief §6. NON-EXAMPLE: NEW (P6).
- REL-2: extract-doc002-b.md (RPH Canonical Domain Model L1476-1482).
- REL-3: extract-doc002-b.md (L1476-1482); extract-doc007-b.md (Contract Package L1800-1802); extract-doc008-b.md (L1752-1758).
- REL-4: extract-doc003-a.md traceability spine (RPH-DOC-003 L291-331); extract-doc008-b.md (L1722-1748).

## §6 State axes and transition guards
- Four axes + birth initialization: extract-doc002-a.md (RPH-DOC-002 L518-521); extract-doc008-a.md RPH-PWU-001 (L561-577); Guide §6.4. Exact enums ceded (brief §6).
- Cognitive focus additive-only: Guide §6.4 (L596-603).
- STA-1: extract-doc002-a.md (L518-521); extract-doc004-b.md UI indicator rule (L2032); extract-doc008-b.md (L1983-1997). NON-EXAMPLE: NEW (P6, rollup projection).
- STA-2: extract-doc002-b.md (L1298, L2099-2111); extract-doc007-a.md (RPH-DOC-007 L1244); extract-doc008-a.md RPH-PWU-005 (L621-637); extract-doc008-b.md P1 (L2279-2291), Test 9 (extract-doc004-b.md L2130-2134); extract-doc004-b.md (L2076). NON-EXAMPLE: NEW (P6).
- STA-3: extract-doc008-a.md RPH-PWU-006 (L640-670).
- STA-4: extract-doc002-a.md illegal transitions (RPH-DOC-002 L645-655); Guide §6.5 (L613-622); extract-doc008-a.md RPH-PWU-010 (L706-720).
- STA-5: extract-doc002-a.md (RPH-DOC-002 L661-676); Guide §6.1 (L464-475). NON-EXAMPLE (risk-relative sufficiency): extract-doc003-b.md (L1463-1467).
- STA-6: extract-doc002-a.md (RPH-DOC-002 L472-477); Guide §6.5; exploratory bound: Guide §7.3 (L693) + extract-doc004-a.md POL-INTENT-COMPLETENESS (L889).
- STA-7: extract-doc002-a.md exception routes (RPH-DOC-002 L629-641); extract-doc002-b.md invalidation first-class (L1738, L1785); Guide §6.5.

## §7 Decomposition and recomposition
- Two-level recursion, sub-PWU non-entity, composition≠timing: Guide §6.2 (L477-529).
- DEC-1: Guide §6.1 (L475), §6.2 (L495); extract-doc003-b.md (L1955-1972). NON-EXAMPLE: NEW (P6).
- DEC-2: Guide §6.2 contract list (L497-518); extract-doc003-a.md (RPH-DOC-003 L896-939); extract-doc003-b.md (L2000); extract-doc002-a.md (RPH-DOC-002 L895-898). Anti-premature: extract-doc003-b.md (L1987-1992).
- DEC-3: extract-doc002-b.md conservation equation (L2117-2124); extract-doc008-a.md RPH-DEC-002/-007 (L754-768, L843-863); extract-doc004-a.md POL-DECOMPOSITION-COVERAGE (L1052-1116); extract-doc002-a.md explicit allocation (L744, L749). NON-EXAMPLE: NEW (P6).
- DEC-4: extract-doc002-a.md (RPH-DOC-002 L795-803); extract-doc004-a.md POL-CONSTRAINT-PROPAGATION (L1147-1149); extract-doc008-a.md RPH-CNS-002 (L885-931); context omission: extract-doc003-b.md/Guide §7.5 (L720).
- DEC-5: extract-doc008-a.md RPH-DEC-004 (L788-801); named failure mode: extract-doc003-a.md (RPH-DOC-003 L548-555); governed feedback channel: extract-doc003-a.md (L1000-1009).
- DEC-6: extract-doc003-b.md invalid/valid inference (L2018-2033); extract-doc002-a.md emergent-whole rule (L947-952); extract-doc008-a.md RPH-DEC-006 (L821-839); Guide §6.3 (L531-553). NON-EXAMPLE: NEW (P6).

## §8 Assurance model
- ASR-1: extract-doc004-a.md (RPH-DOC-004 L31-43, L182, L256-258); Guide §8.9 governing rule (L976-982); validator-output-no-permissions: extract-doc007-b.md (L2437).
- ASR-2: extract-doc007-b.md nine acceptance gates (L1532-1542); extract-doc004-b.md Test 3 (L2094-2098); extract-doc008-a.md RPH-CON-005 (L321-377).
- ASR-3: Guide §8.4 (L837-870) — floor steps, materiality default, non-suppressibility, lossless-equivalence non-example. Settledness note: the floor is Guide-synthesized (HYPOTHESIS); flagged for elicitation below.
- ASR-4: Guide §8.4 Reasoning Review bullets (L846-854); CoT handling routed to DOC-004 per brief §5 and sponsor CoT ruling (project memory/REG-005 founding material).
- ASR-5: Guide §8.5 (L871-894) — dimensions, coverage planning, not-wire-enums caveat.
- ASR-6: extract-doc004-a.md admissibility (L345-354); Guide §8.11 (L1027).
- ASR-7: extract-doc004-a.md (L358-364); extract-doc003-b.md test-count rule (L1723-1725); extract-doc004-b.md (L1407-1409, L2048-2050); extract-doc002-a.md confidence rule (L1002); Guide §8.11 (L1029-1037).
- ASR-8: extract-doc002-b.md (L2132); extract-doc008-a.md RPH-EVD-005/-006 (L1251-1279); extract-doc002-a.md (L1052-1058); retention: extract-doc009-b.md (L2578).
- ASR-9: extract-doc004-a.md (L402-410, L565-582); extract-doc004-b.md (L1872-1877); extract-doc008-b.md (L1366-1374).
- ASR-10: extract-doc004-b.md (L1621-1651, L1890); extract-doc008-b.md (L1452-1481); two-tier blocking: extract-doc004-b.md invariants 11-12 (L2058-2060).
- ASR-11: extract-doc004-b.md invariants 9-10 (L2054-2056); extract-doc008-b.md (L1378-1403); vague-language ban: extract-doc004-a.md (L505-512).
- ASR-12: extract-doc004-b.md invariants 1-2, 15-16 (L2038-2040, L2066-2068); extract-doc007-b.md subject-version binding (L2284); extract-doc008-b.md (L1436-1448); findings indelible: extract-doc002-b.md (L1387), extract-doc004-b.md (L2062); Guide §8.6 (L898-913, recurrence).
- ASR-13: extract-doc004-a.md (L432-465 — eight dimensions, violation consequences, three-tier profiles); extract-doc008-b.md (L1332-1346); Guide §8.12 (L1051). NON-EXAMPLE both halves: extract-doc004-a.md L432 + Guide §8.4 same-base-model allowance (L851).
- ASR-14: extract-doc004-a.md (L644-661, L827-829); extract-doc004-b.md (L1513-1515, L2062-2064, waiver scope Test 7 L2119-2122); expired waiver blocks promotion: extract-doc008-a.md (L917-931), extract-doc008-b.md (L1566-1578); self-waiver bar: extract-doc002-a.md (L1160-1163). NON-EXAMPLE: NEW (P6).
- ASR-15: extract-doc002-b.md (L1385-1391, L1428-1435); extract-doc008-b.md (L1507-1515, L1582-1596, P5 L2326-2328); authority-without-identity: extract-doc009-a.md (RPH-DOC-009 L2179-2187); Guide §8.16 decision binding list (L1107-1115).
- ASR-16: extract-doc003-a.md promotion gates (RPH-DOC-003 L1116-1125); extract-doc003-b.md blocking list (L1781-1787); extract-doc004-b.md reviewed=promoted (L1476-1499, Test 12 L2148-2152); extract-doc007-b.md (L2296); baseline immutability: extract-doc002-b.md (L1428-1429), extract-doc008-b.md (L1674-1714, P7 L2340-2342).
- ASR-17: extract-doc002-b.md (L1433-1435); extract-doc008-b.md (L1692-1700); extract-doc009-a.md/-b.md (L2197, L2391); Guide §8.16 (L1126).

## §9 Persistence semantics
- Hybrid model + now/became dichotomy: extract-doc009-a.md (RPH-DOC-009 L116, L128-138); Guide §10.1 (L1348-1373).
- PER-1: extract-doc007-a.md (RPH-DOC-007 L63-79, L609-613, L660-666); extract-doc002-b.md (L1654-1656).
- PER-2: extract-doc002-a.md history preservation (L166-177); extract-doc002-b.md (L1488, L1693); extract-doc007-b.md upcasters (L2011-2015); extract-doc008-b.md (L1893-1905). NON-EXAMPLE: extract-doc009-a.md derivation-rule rebuild (L2395).
- PER-3: extract-doc009-a.md (L176-183); extract-doc002-b.md ten-step handler (L1680-1691); Guide §9.3 pipeline + no-bypass list (L1206-1226); atomic write: extract-doc009-a.md (L1359-1369). Exact ordering ceded (brief §6).
- PER-4: extract-doc002-b.md (L1703-1708); extract-doc007-a.md (L605); extract-doc008-a.md exemption-explicit rule (L293-305); extract-doc009-a.md/-b.md (L2505-2511); gapless history: extract-doc007-b.md (L2314). Ground truth: engine honors expectedRevision (brief §13).
- PER-5: extract-doc002-b.md five duplication classes (L1716-1722); extract-doc007-a.md (L604); extract-doc007-b.md (L2140-2141, L2318); extract-doc008-b.md P6 (L2332-2336); Guide §9.3 (L1228).
- PER-6: extract-doc009-a.md (L2622-2640); extract-doc008-b.md (L1927-1962); Guide §9.7 (L1342) — compensation-not-deletion.
- PER-7: extract-doc009-a.md (L144-152, L1701, L2346-2352); extract-doc008-b.md projection-lag rule (L1881-1889); rebuildability: extract-doc009-b.md (L2614).
- PER-8: extract-doc009-a.md (L260-266, L1541-1547); Guide §5.6 quarantine + §10.1 no-hard-delete (L1371). NON-EXAMPLE: Guide §9.7 purgeable reasoning material (L1338), routed to DOC-004.
- PER-9: Guide §5.6 (L440-458) near-fully; Final Persistence Rule motivation: extract-doc009-a.md (L2973-2991).
- PER-10: extract-doc007-a.md six-stage pipeline + applicability list (L127-146); extract-doc002-b.md (L1300-1301, L1335-1341); extract-doc008-a.md RPH-EXE-009 (L1178-1189); read/write asymmetry: extract-doc007-b.md (L2025-2044).

## §10 Single semantic authority
- AUT-1: extract-doc009-a.md (L41-45, L86-94, L2318); shadow no-side-effects: extract-doc009-a.md (L2293-2304), extract-doc009-b.md (L1897, L2931); Guide §10.4 (L1420-1432).
- AUT-2: extract-doc009-b.md staged transfer + explicit acceptance (L1801-2115, L2012) ; one-way cutover: extract-doc009-a.md/-b.md (L2677-2686); convergence-phase application: NEW — brief §7 (routes to DOC-004/REG-005).

## §11 Ambiguities carried to the register
1. Recomposition state ownership: extract-doc002-a.md OPEN item (RPH-DOC-002 L623-624 vs L921-952). Safe default: NEW.
2. Waiver vs invalidated evidence: extract-doc002-b.md OPEN item (L2316 vs L2132). Safe default: NEW.
3. Material-finding default tiebreaker: extract-doc004-a.md OPEN item (L574-575). Safe default: NEW.
4. WAIVED recording path: extract-doc004-a.md OPEN item (L536-553). Safe default: NEW.
5. Independence-satisfying configurations: extract-doc003-b.md OPEN item (L2399). Safe default: NEW.
6. UNKNOWN-value re-entry at write boundary: extract-doc007-b.md OPEN item (L2036-2041 vs L2462). Safe default: NEW.
7. "Authoritative" word usage: extract-doc009-a.md OPEN item (L128 vs L1453). Resolution adopted in text: NEW.

## Repair pass v0.2.0 (2026-07-16, review-findings application)

Materially changed/added sections and their sources:

- **Status block precedence**: rewritten to match the rule of recognition (brief §10.3 / CON-000 Part B) — within-concern conflicts resolve by higher settledness class; only residual conflicts become findings. NEW (repair; finding: precedence over-claim).
- **§3 object table**: restored Reconciliation and Reasoning Activity/Alternative rows (Guide §5.2 objects, dropped without cession). Source: Guide §5.2.
- **§4**: Owned/Reference ownership semantics carried (routed here by DOC-002 §10). Source: Janumi Constitution Discussion.md L14744-14757, L14804-14809.
- **§5 REL-1**: relation vocabulary regrouped into semantic families with one-line meanings; membership declared canon-governed, spellings/registry repo shapes. NEW (repair; authority-partition disambiguation per brief §6).
- **§6 preamble**: four-axes ↔ CON-000 AX-1 five-concern mapping sentence. NEW (repair).
- **§6 STA-3 SCOPE**: stale citation ASR-13 → ASR-14 (waivers) / ASR-12 (supersession).
- **§6 STA-4**: added conditionally-satisfied exclusion from recomposition/promotion. Source: Guide §6.4 L570, §11.7.3 L1855.
- **§6 STA-8 (new)**: Execution Plan governance — one active plan, no new steps/attempts under superseded plan, approved-plan + authorized-bindings gate, high-risk approval-before-irreversible, plan power bounds, mandatory-step skip requires revision/waiver, revision preserves attempt history. Sources: RPH-DOC-002 L1241, L1244, L1246, L1299, L2136-2140; Guide §6.5/§9.1/§10.1.
- **§7 DEC-2**: "high-risk" anchored to the applicable risk/assurance profile. NEW (repair; P6 unanchored qualifier).
- **§7 DEC-6**: "assured required child results" explicitly excludes conditionally satisfied dispositions absent policy-permitted condition closure. Source: Guide §6.4/§11.7.3.
- **§8.1 ASR-1**: declarative-not-executable policy expression rule. Source: RPH-DOC-007 L1294-1296.
- **§8.2 ASR-3**: repaired-successor-still-reviewed rule; per-result transformation-boundary/anti-batching rule. Source: Guide §8.4, §11.7.4.
- **§8.2 ASR-4 NON-EXAMPLE**: volunteered-reasoning routing repointed from JPWB-DOC-004 to PER-12 (retention semantics live here; conduct lesson stays in DOC-004).
- **§8.2 ASR-5**: validation-as-inquiry and epistemic-status-preservation doctrine (signal≠defect; formalization never upgrades authority; tensions preserved). Sources: Guide §8.3/§8.5; Validator Subsystem L275-285, L657-663, L870, L1273-1275.
- **§8.3 ASR-6**: evidence currency anchored to the assessing policy's declared currency requirement. NEW (repair; P6 unanchored qualifier).
- **§8.4 ASR-9**: conditional-satisfaction semantics (joint meaning, all-surface visibility incl. post-baselining, no-unconditional-display, condition→forward obligation, deferral never silent deletion). Sources: RPH-DOC-006 L1097-1102, L1351-1356, L1521, L1791-1808; RPH-DOC-008 L1419-1432, L2109-2116.
- **§8.5 ASR-13**: producer/evaluator invocation split into two dimensions (eight total, matching §11 item 5). Source: RPH-DOC-004 L434-443 via extract-doc004-a.md L43.
- **§8.9 (new) ASR-18/ASR-19**: three-rail assignment/capability/execution separation and PWA publication gates promoted from REG-Q-023/Q-009/Q-010 safe defaults to invariants (settled per Guide §16 item 23); ASR-19 also carries the policy-catalog/branch-ontology cession (meanings travel with the seeded published PWA version; source-of-record provenance tracked in REG-005). Sources: Guide L493, L996-1002, L1533, L1639; Guide §8.10/§7 (catalog meanings).
- **§9 PER-1**: gloss tightened (rejection, not failure, lives outside domain history) + NON-EXAMPLE for post-acceptance failures. NEW (repair; P6).
- **§9 PER-7 SCOPE**: security-trimmed projection rule (partiality disclosure; no protected-existence leakage). Source: Janumi Constitution Discussion.md L8577-8590.
- **§9 PER-8 NON-EXAMPLE**: pointer repaired to PER-12.
- **§9 PER-9**: per-attempt exchange-record requirement (materialized input, pre-coercion output, resolved provider/model/version, truncation, parse/repair outcome; fingerprint identifies, never substitutes; binds to plane's governed-stream record absent an Execution Plan; log-plane redaction vs record-plane omission). Source: Guide §9.7 L1340 (sponsor-adjudicated).
- **§9 PER-11 (new)**: bitemporality invariant (occurrence vs record time; observed/valid/effective where distinct). Sources: Janumi Constitution Discussion.md L1753, L3226-3244, L10818-10825, L17207-17213; Guide §5.3/§5.6.
- **§9 PER-12 (new)**: volunteered-reasoning retention mechanics (redact at boundary, typed Artifact bound to producing Attempt, never admit/forward/log/project, evaluator-context presence = independence violation, purgeable at retention expiry; operative default pending REG-Q-027 sponsor elicitation). Source: Guide §9.7 L1338 (sponsor CoT ruling); breaks the DOC-003↔DOC-004 circular route.
- **§11**: intro and items 6/7 corrected — items 6 and 7 state their actual resolution paths (item 6: repository shape authority per REG-D-004, write-side strictness stated here; item 7: resolved in this artifact's text), matching REG-005's deliberate exclusions.

Cross-artifact follow-ups NOT performed here (out of this repair's scope, DOC-003 only): DOC-004 §7.2 cross-reference to the PER-9 exchange-record rule; DOC-004 §11 repointing to PER-12 by ID; DOC-002 §10 routing-target renames (JPWB-DOC-003 / the repository); REG-005 entry recording the Guide §8.10/§7 seed source-of-record.

## ELICITATION-REQUIRED
- ASR-3/ASR-4 (de minimis floor + Reasoning Review as unconditional): strongest prior synthesis is Guide §8.4, which post-dates the RPH primaries and was partly agent-authored; project ground truth shows the floor's code-side content was partially invented (hollow governed layer memory). Sponsor should confirm the floor's mandate and its materiality-default rule are ratified canon rather than Guide-era overreach. Drafted as committed HYPOTHESIS pending that confirmation.
- §3 object table inclusion of CPCO-era refinements (Narrative Memory, Confidence Assessment, cognitive focus as additive viewpoint): carried from Guide §5.2/§6.4 with its own caveat that these are candidate refinements; sponsor confirmation that they remain in the DOC-003 object list (vs. demotion to DOC-001 doctrine) is desirable.

## Finalizer pass (2026-07-16)
Cross-artifact residue closed by the program finalizer: Attention Item entries added to DOC-002 §3 and DOC-003 §3 (disposition meanings NEW — REG-E-021); DOC-004 §7.2 exchange-record pointer to DOC-003 PER-9 and §11.4 repointed to PER-12; REG-Q-048 (cross-organization scope) and REG-E-001..022 filed in REG-005 Section E. Conferral instrument: 'JPWB Canon Ratify Sheet (R1).md'.
