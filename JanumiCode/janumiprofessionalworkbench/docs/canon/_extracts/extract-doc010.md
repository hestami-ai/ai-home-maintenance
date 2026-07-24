# Extract: RPH-DOC-010 PWA Designer and Undertaking Workbench — Reference Demonstration

Source: `docs/Recursive Professional Harness/Janumi Professional Workbench PWA Designer and Undertaking Workbench - Reference Demonstration.md` (full file, 1769 lines).
Note: canonical UX specification, not a transcript — no HUMAN/ASSISTANT tags apply and no sponsor turns occur, so there are no SPONSOR-RULINGS items. Citation filename shortened to `RPH-DOC-010.md`. Focus per brief: five workbench contexts, definition-vs-instance separation, interaction grammar.

## CONSTITUTIONAL CANDIDATES

- "A PWA defines reusable professional-work structure; it is not a concrete Undertaking, an instantiated Professional Work Graph, or a temporal Execution Workflow." (RPH-DOC-010.md L88) — The document's primary correction in one sentence; the definition/instance/execution triple never collapses.
- "A published PWA version is immutable. ... Changes create a successor version." (RPH-DOC-010.md L739-741) — Publication freezes definitions; evolution is supersession, mirroring baseline immutability doctrine.
- "The user must always be able to identify whether they are operating in: PWA DESIGN CONTEXT or: UNDERTAKING CONTEXT ... These contexts should have visibly distinct headers, icons, and permission models." (RPH-DOC-010.md L245-257) — Context legibility is a hard UX obligation, backed by distinct permission models, not styling preference.
- "Execution succeeded AND required outputs exist AND required evidence is admissible AND required assurance is satisfied or validly waived AND required approval is effective" (RPH-DOC-010.md L474-480) — Five-conjunct completion rule for a PWU Type; execution success alone can never complete work (INV-5 in type-definition form).
- "PWA edits do not mutate existing Undertakings automatically. ... Undertaking edits do not mutate the PWA automatically." (RPH-DOC-010.md L1668-1669) — Bidirectional mutation firewall between definition and instance; acceptance criteria 7-8.
- "Concrete execution and assurance state appears only on instances." (RPH-DOC-010.md L1673) — Type side is state-free; any state indicator on the PWA side is a conformance violation.
- "A PWA version change for an existing Undertaking is a governed semantic migration, not a silent template refresh." (RPH-DOC-010.md L1197) — Version adoption is governed work with impact analysis, never automatic re-templating.
- "Because a PWU Type belongs to a PWA, the Undertaking cannot create an Undertaking-owned PWU Type." (RPH-DOC-010.md L1231) — Type-minting authority lives solely with the PWA; instances extend only via PWA-defined extension points.

## DOCTRINE-CONOP

- "Each mode exposes a different underlying object and authority boundary" — PWA Design / Undertaking / Execution / Assurance / Governance (RPH-DOC-010.md L1295-1303) — The five-context CONOP: modes are authority boundaries over distinct primary objects, not tabs over one model.
- "Assurance | Claims, evidence, criteria, assessments, and findings | Evaluate assurance without exercising governance authority" (RPH-DOC-010.md L1302) — Assurance mode assesses but cannot approve; governance authority is reserved to the Governance context (Decisions/Baselines).
- "The PWA Designer must not display concrete Field Service assumptions, requirements, findings, or execution states except as test fixtures or examples." (RPH-DOC-010.md L269) — Designer purity rule: no instance content leaks into the definition surface except labeled fixtures.
- "This graph is a View of the PWA definition and represents allowed professional-work composition. ... It does not represent execution order." (RPH-DOC-010.md L417-419) — Work Architecture View semantics: permitted composition, never temporal sequence.
- "This View shows actual state from the Undertaking's Professional Work Graph. The Product Realization PWA Work Architecture View shows type definitions without actual state." (RPH-DOC-010.md L1004-1006) — The paired-view contract: same shape, opposite content — instance state vs. stateless types.
- "The UI must clearly distinguish: INHERITED FROM PRODUCT REALIZATION PWA from: DEFINED FOR THIS UNDERTAKING" (RPH-DOC-010.md L869-879) — Provenance-of-properties doctrine: every displayed property declares whether it is PWA-inherited or Undertaking-local.
- "An existing Undertaking remains bound to its selected PWA version until explicitly migrated." (RPH-DOC-010.md L1167) — Version pinning is the default; new PWA versions never reach running Undertakings implicitly.
- "Potentially invalidated • Architecture Approval • Architecture Baseline" (RPH-DOC-010.md L1220-1223) — Migration preview must disclose that adopting a new PWA version can void version-bound approvals and baselines.
- "Displays a governed Execution Plan and the temporal Execution Workflow that carries it out; neither is the Professional Work Graph." (RPH-DOC-010.md L1352) — Execution mode renders plan+workflow only; the semantic graph is a different object with a different surface.
- "If no applicable PWA-defined type or extension point exists, the system must block local type creation and offer a PWA Change Proposal. A permitted resulting PWU Instance belongs to the Undertaking and does not mutate the PWA." (RPH-DOC-010.md L1633) — Fail-closed extension grammar: block, then route learning upward as a proposal.
- "must exercise the complete Product Realization PWA architecture without being presented as either the PWA definition or the resulting product." (RPH-DOC-010.md L1078) — Three-way identity: fixture Undertaking ≠ PWA ≠ produced product; each named separately (also §46 criterion 4).

## VOCABULARY

- "The term `Lens` is retired as the canonical name for a PWA because earlier material used it for work architectures, UI perspectives, product subsystems, and templates. ... Other legacy names require classification rather than a blind `Lens`-to-`PWA` suffix change." (RPH-DOC-010.md L92-102) — Lens retirement rule: each legacy use must be re-classified by intended meaning (View/Viewpoint/Projection vs. PWA).
- "The word `workflow` remains valid for temporal execution or approval behavior. It is not the canonical name for a PWA or Professional Work Graph." (RPH-DOC-010.md L156) — Reserved-word rule for `workflow`; §36 lists valid uses, §46 criteria 18-19 enforce it.
- "Professional Work Architecture and selected version ↓ instantiated as Undertaking ↓ owns Professional Work Graph ↓ executed through Execution Plans and Execution Workflows" (RPH-DOC-010.md L53-61) — The formal ownership chain: instantiation, ownership, and execution are three distinct relations.
- "Selected PWU Instances are performed through governed Execution Plans and temporal Execution Workflows, evaluated through assurance, governed through Decisions, and accepted through Baselines to produce the Field Service Management SaaS product." (RPH-DOC-010.md L1766) — The one truthful sentence the system may say; the canonical end-to-end narration the UI must preserve.

## SEMANTIC-INVARIANTS

- "The PWA Designer must distinguish type-level relationships from instance-level relationships." ... instance-level relationships "occur only inside Undertakings." (RPH-DOC-010.md L511-530) — Relationship vocabularies are level-scoped: PERMITS_CHILD_TYPE-class edges live in PWAs; DECOMPOSES/SATISFIES-class edges only in Undertakings.
- "The Product Realization PWA references policy definitions but does not contain assessment instances." (RPH-DOC-010.md L613) — Policies are assigned at type level; assessments exist only as instance-side facts.
- "Independence: Reviewer must not be the sole producer of the architecture ... Result: Version-bound Decision" (RPH-DOC-010.md L646-656) — The PWA encodes reviewer independence, and every approval outcome binds to a specific version.
- "The PWA may define compatible default execution strategies without treating them as the professional-work architecture itself. ... The Undertaking may select or override an allowed strategy." (RPH-DOC-010.md L690-715) — Execution strategy is a compatible default, never the architecture; instance choice stays within the allowed set.
- "This creates a PWA change proposal, not an automatic PWA mutation." (RPH-DOC-010.md L1289) — Bottom-up learning from Undertakings enters PWA governance as a proposal with linked evidence, never as direct edit.
- "It is not treated as the Product Realization PWA itself." — the fixture is labeled "REFERENCE FIXTURE" (RPH-DOC-010.md L771-780) — Conformance fixtures appear in the Designer only as labeled fixtures; fixture ≠ definition (§46 criterion 13).

## PROTOCOL-PRACTICE

- "DRAFT → UNDER REVIEW → VALIDATED → PUBLISHED → DEPRECATED → RETIRED ... Before publication, the PWA must pass: schema validation; type-reference validation; decomposition consistency; assurance assignment validation; role and authority validation; baseline consistency; conformance fixture execution; compatibility analysis." (RPH-DOC-010.md L747-765) — PWA lifecycle FSM plus the eight publication gates; publishing is the governed act.
- "1. Create Undertaking. 2. Bind exact PWA version. 3. Create root PWU Instance. 4. Instantiate mandatory root children. 5. Apply policy assignments. 6. Apply role and governance defaults. 7. Create instantiation event. 8. Open Undertaking Overview." (RPH-DOC-010.md L1574-1581) — Instantiate-PWA contract: exact-version binding, mandatory-children instantiation, and an instantiation event, in order.
- "published PWA is not edited in place ... 1. Create draft successor version. 2. Record source version. 3. Apply definition changes. 4. Run impact analysis across ... existing Undertakings." (RPH-DOC-010.md L1596-1611) — Revise-PWA contract: successor-draft workflow with provenance and Undertaking impact analysis before review and publication.
- Undertaking matrix: Evidence "No in-place edit ... Invalidate"; Decision editable only "Before effective ... Revoke"; Baseline editable "Before promotion ... Supersede" (RPH-DOC-010.md L1460-1470) — Instance-side grammar: post-authority objects are never edited, only invalidated, revoked, or superseded.

## OPEN-QUESTIONS-CONTRADICTIONS

- §3.4 defines an Undertaking as "instantiated under one or more compatible PWAs and bound to a selected PWA version" (RPH-DOC-010.md L110), yet §23 records a singular "PWA ID; PWA version" (L837) and §42 says "Bind exact PWA version" (L1577) — multi-PWA Undertakings are permitted by definition but unsupported by every binding, migration, and UI contract in the document.
- §11 lists "Multi-Tenancy Architecture" as a PWA-defined permitted child PWU Type of Architecture Definition (RPH-DOC-010.md L441), but §28 shows the Multi-Tenancy Architecture instance's type as "Custom Architecture Concern" (L1025) and §29's inspector as "Architecture Concern" (L1055) — the same instance carries three inconsistent type identities, blurring the PWA-defined-type vs. generic-extension-point boundary that §33/§44 depend on.
