# JanumiLegal Canonical Legal Vocabulary v1

**Status:** Authored entries for CLV v1, Layer 1 (core).
**Parents:** `janumilegal_product_description_evolution.md` §1; `janumilegal_implementation_roadmap.md` Wave 1.
**Scope:** Core vocabulary that platform code, lens packs, prompts, and schemas bind to. Practice-area extensions are namespaced and added in Layer 2.
**Authoring rule:** Every term has a canonical name, one-line definition, long definition, allowed and prohibited synonyms, example uses, example misuses, and known collisions. Jurisdiction variants are flagged when a term has materially different mechanics across MD/VA/PA/DC (the JC Law jurisdictions).
**Format note:** In production these become rows in the `canonical_vocabulary` table. This document is the authored content; the migration that lands them is generated from this file.

---

## Conventions

- **termId** format: `clv.core.<name>.v1` for core terms; `clv.<scope>.<name>.v1` for scoped extensions.
- **Scope**: `core` = platform-wide; `practice_area` = lens-pack scope; `jurisdiction` = jurisdiction-scoped variant; `firm` = firm config scope.
- **Prohibited synonyms** must always include any canonical term whose meaning the term collides with — this is what the VCC checks against.

---

## Section 1 — Issues, Claims, Assertions

These three are the most-conflated terms in legal practice. Distinguishing them is the first job of the CLV.

### `clv.core.issue.v1` — issue

- **One-line definition:** A bounded legal question whose answer affects the matter outcome.
- **Long definition:** An issue is a discrete legal question identified during decomposition (Issue Bloom). It is the unit of analysis the lens uses to plan research, decide retain/remove/defer/escalate (Issue Prune), and structure synthesis. An issue is not a cause of action, not a factual assertion, and not a conclusion.
- **Allowed synonyms:** legal question, point of law (when context makes it unambiguous).
- **Prohibited synonyms:** claim, cause of action, count, allegation, assertion, finding, conclusion.
- **Example use:** "The issue of whether support arrears justify withholding access is retained under the existing order."
- **Example misuse:** "The plaintiff filed an issue against the defendant" (this is a *claim* or *cause of action*).
- **Known collisions:** lay use of "issue" to mean "problem"; in employment law and contracts, "issue" sometimes colloquially refers to a disputed clause.

### `clv.core.claim.v1` — claim

- **One-line definition:** A cause of action or count asserted by a party against another party.
- **Long definition:** A claim is a legal cause of action — the formal basis on which a party seeks relief. Each claim has elements that must be pleaded and ultimately proven. The complaint contains claims; an enforcement motion may seek relief on claims; the prayer for relief is structured per claim.
- **Allowed synonyms:** cause of action, count.
- **Prohibited synonyms:** issue, assertion, allegation, fact, finding, conclusion.
- **Example use:** "The complaint asserts three claims: breach of contract, unjust enrichment, and conversion."
- **Example misuse:** "The expert's claim is that the timeline is wrong" (this is an *assertion* or *opinion*).
- **Known collisions:** insurance "claim" (request for benefits under policy — a different sense); "small claim" (court division); patent "claim" (numbered element of a patent — entirely different domain). When CLV scope is `practice_area = insurance` or `practice_area = patent`, alternate definitions are registered as scoped extensions; the core meaning prevails everywhere else.

### `clv.core.assertion.v1` — assertion

- **One-line definition:** A statement of fact or position offered by a party, witness, attorney, or system.
- **Long definition:** An assertion is any statement asserting that something is the case. It carries no inherent evidentiary status until evaluated. In source-to-claim trace, the *claim* is the assertion sense — that is, an asserted fact or characterization tied to a source. (This is a deliberate naming inheritance from the source document; the CLV resolves the internal collision by binding "source-to-claim trace" to `assertion`, not to `clv.core.claim.v1`.)
- **Allowed synonyms:** statement, position (in argumentative context).
- **Prohibited synonyms:** fact, finding, conclusion, claim (in cause-of-action sense).
- **Example use:** "The mother's assertion that the child does not want to go is recorded but not adjudicated."
- **Example misuse:** "The complaint contains five assertions" (those are *claims*).
- **Known collisions:** "source-to-claim trace" — this CLV entry resolves the conflict by stating that the term "claim" inside that phrase refers to the assertion sense; product UI and prompts should prefer "source-to-assertion trace" going forward, with "source-to-claim trace" preserved as a permitted historical synonym.

---

## Section 2 — Facts, Findings, Conclusions

### `clv.core.fact.v1` — fact

- **One-line definition:** Something asserted or established about the world, with a recorded source and confidence label.
- **Long definition:** A fact in JanumiLegal is always paired with a source and a confidence label drawn from a controlled set: `document_supported`, `client_reported`, `opposing_party_claim`, `attorney_note`, `unverified`, `conflicting`. A bare fact without source and label is invalid in any matter-track artifact.
- **Allowed synonyms:** factual statement.
- **Prohibited synonyms:** finding, conclusion, allegation (when context is adjudicative), assertion (when source-bound discipline is required).
- **Example use:** "Document-supported fact: father has access every other weekend Friday 6 PM to Sunday 6 PM (custody_order.pdf)."
- **Example misuse:** "Fact: the mother is in contempt" (this is a *legal conclusion*, not a fact).
- **Known collisions:** lay "fact" overlaps with "truth"; the CLV definition is operational, not philosophical.

### `clv.core.allegation.v1` — allegation

- **One-line definition:** A factual claim made by a party in a pleading or court-recorded statement, not yet adjudicated.
- **Long definition:** An allegation is a party's assertion of fact within a litigation context, distinguished from a fact (which carries source and confidence) and from a finding (which is adjudicated). Pleadings contain allegations; complaints allege claims supported by allegations.
- **Allowed synonyms:** alleged fact (when the allegation context is in force).
- **Prohibited synonyms:** fact, finding, conclusion.
- **Example use:** "The complaint alleges that the defendant breached the agreement on April 10."
- **Example misuse:** "The court finds the allegations are facts" (the court's finding *converts* allegation status; do not pre-collapse).

### `clv.core.finding.v1` — finding

- **One-line definition:** A determination by a court, tribunal, hearing officer, or other authorized adjudicator.
- **Long definition:** A finding is an adjudicated determination — a fact found by a fact-finder or a legal determination by a court. Findings of fact and conclusions of law are distinct. JanumiLegal artifacts must not characterize anything as a finding unless it was made by an authorized adjudicator.
- **Allowed synonyms:** determination (in adjudicative context), finding of fact, finding of law.
- **Prohibited synonyms:** fact, allegation, conclusion (in non-adjudicative context).
- **Example use:** "The trial court's findings of fact establish that exchanges occurred at the designated location."
- **Example misuse:** "The agent's finding is that contempt may apply" (an agent does not make findings — this is a *machine-assessed conclusion candidate*).

### `clv.core.conclusion.v1` — conclusion

- **One-line definition:** A reasoned legal output applying law to facts.
- **Long definition:** A legal conclusion is a reasoned application of authority to facts producing a position on a legal question. In JanumiLegal, every conclusion must carry: facts relied upon, authorities relied upon, assumptions, missing facts, adverse considerations, could-change-if conditions, verification status, and attorney review status.
- **Allowed synonyms:** legal conclusion, conclusion of law (formal).
- **Prohibited synonyms:** finding, fact, opinion (when used to mean a court opinion — different sense), advice.
- **Example use:** "The Direct Legal Conclusion Lens emits a conclusion candidate with full dependency labels."
- **Example misuse:** "Final conclusion sent to client" (per doctrine, conclusions are draft until attorney-approved).

---

## Section 3 — Legal Reasoning Primitives

### `clv.core.rule.v1` — rule

- **One-line definition:** A normative statement drawn from authority that governs how a question is decided.
- **Long definition:** A rule is the operative norm extracted from a statute, regulation, court rule, or case-law synthesis. Rules are mapped to elements (`clv.core.element.v1`) for fact-to-law analysis. A rule has a source authority and may have jurisdictional scope.
- **Allowed synonyms:** legal rule, governing rule.
- **Prohibited synonyms:** standard, test, factor, element (each has its own term).
- **Example use:** "The applicable rule prohibits withholding access based on support disputes."
- **Example misuse:** "Apply the contempt rule" (which rule? The CLV requires an authority reference).

### `clv.core.element.v1` — element

- **One-line definition:** A constituent component of a rule, claim, or offense that must be satisfied independently.
- **Long definition:** An element is a discrete component that must be proven (claim) or established (rule) for the rule to apply. Element-by-element analysis is the standard JanumiLegal pattern in `RuleElementMap` and `FactToRuleMap`.
- **Allowed synonyms:** prong (when used for individual components of multi-prong tests).
- **Prohibited synonyms:** factor (which is balanced, not satisfied independently), rule, standard.
- **Example use:** "The contempt elements include a valid order, knowledge, specific obligation, failure to comply, and supporting evidence."
- **Example misuse:** "The best-interests elements" (best-interests analysis uses *factors*, not elements).

### `clv.core.factor.v1` — factor

- **One-line definition:** A consideration weighed in a balancing or totality-of-circumstances analysis.
- **Long definition:** A factor is a consideration that a court balances or weighs alongside others in reaching a determination. Unlike an element, a factor is not pass/fail — its weight depends on context. Best-interests-of-the-child analysis is a paradigmatic factor-based test.
- **Allowed synonyms:** consideration (in balancing-test context).
- **Prohibited synonyms:** element, rule, standard, prong.
- **Example use:** "Best-interests factors include the child's preference, parental fitness, and stability of the home environment."
- **Example misuse:** "The plaintiff failed to prove all factors" (factors are weighed, not proven; this misuses the term).
- **Jurisdiction variant — MD:** Maryland's best-interests factors derive from Montgomery County Dept. of Social Services v. Sanders (1979) and Taylor v. Taylor (1986); JC Law lens packs should reference the canonical Sanders/Taylor factor list.

### `clv.core.standard.v1` — standard

- **One-line definition:** The level of proof, scrutiny, or care that a legal question requires.
- **Long definition:** A standard governs how a determination is made. Examples: "preponderance of the evidence," "clear and convincing," "beyond a reasonable doubt," "abuse of discretion," "de novo," "rational basis," "strict scrutiny," "reasonable person." A rule may carry a standard; an issue analysis must identify the applicable standard.
- **Allowed synonyms:** standard of proof, standard of review, standard of care (each context-specific; long definition disambiguates).
- **Prohibited synonyms:** test, rule, element, factor.
- **Example use:** "Civil contempt requires proof by clear and convincing evidence in many jurisdictions; confirm MD standard."
- **Example misuse:** "Apply the four-element standard" (a four-element rule has elements, not standards).

### `clv.core.test.v1` — test

- **One-line definition:** A structured analytical framework for resolving a legal question, often comprising elements, factors, or stages.
- **Long definition:** A test is a named analytical framework — sometimes element-based, sometimes factor-based, sometimes a combination. Examples: the Lemon test, the Strickland test, the Twombly/Iqbal pleading standard, the Mathews v. Eldridge balancing test. JanumiLegal artifacts naming a test must cite the source authority.
- **Allowed synonyms:** legal test, framework (when ambiguity is resolved by context).
- **Prohibited synonyms:** standard, rule, element, factor.
- **Example use:** "The applicable test for ineffective assistance is Strickland's two-prong analysis."
- **Example misuse:** Treating "test" and "standard" as synonyms (they are not).

---

## Section 4 — Authority

### `clv.core.authority.v1` — authority

- **One-line definition:** A legal source that provides binding or persuasive support for a proposition.
- **Long definition:** Authority is the primary or secondary legal source cited to support a proposition. Authority is classified as primary (statutes, regulations, court opinions, court rules) or secondary (treatises, restatements, law review articles); within primary, as controlling (binding in the relevant jurisdiction and posture) or persuasive. The Authority Verification Lens distinguishes mechanical checks (citation format, source presence, quote match) from machine-assessed checks (support, controlling status, treatment).
- **Allowed synonyms:** legal authority, source authority.
- **Prohibited synonyms:** source (broader; sources include client documents, evidence, etc.), citation (the reference *to* an authority is not the authority itself).
- **Example use:** "Controlling authority in MD on this issue includes the Family Law Article §9-105."
- **Example misuse:** "The custody order is the authority" (the order is *matter-specific authority* — a sub-class — but the CLV reserves the bare term "authority" for legal sources of general application).

### `clv.core.citation.v1` — citation

- **One-line definition:** The formatted reference identifying an authority.
- **Long definition:** A citation is the reference to an authority in the conventional format (Bluebook, ALWD, jurisdiction-specific). A citation has a parsed structure (reporter, volume, page, year, court, etc.) that mechanical checks operate on.
- **Allowed synonyms:** cite (informal but common in practice).
- **Prohibited synonyms:** authority, source, reference (each broader).
- **Example use:** "The citation parses cleanly under MD format; the source document is retrieved; the pinpoint quote matches."
- **Example misuse:** "Verify the citation supports the proposition" (this conflates citation format check with authority support assessment — *different* checks).

### `clv.core.reference.v1` — reference

- **One-line definition:** A pointer to a source, authority, document, or prior matter context.
- **Long definition:** A reference is a generic pointer. Specific reference types — `SourceRef`, `ArtifactRef`, `AuthorityRef`, `MatterRef` — are the implementation forms. The bare term "reference" in user-facing text should usually be replaced by the specific type.
- **Allowed synonyms:** pointer (technical); link (UI-specific).
- **Prohibited synonyms:** citation, authority, source.

### `clv.core.source.v1` — source

- **One-line definition:** Any document, communication, or record from which facts, claims, or authorities are drawn.
- **Long definition:** A source is the broadest category — it encompasses authorities, client documents, evidence, communications, prior work product, and any other matter content. The Source Document Inventory classifies sources by type and matter role. A source-to-assertion (historical: source-to-claim) trace links assertions back to their sources.
- **Allowed synonyms:** source document (when applicable), evidence (when admitted/proffered).
- **Prohibited synonyms:** authority (narrower), citation.
- **Example use:** "The source for the access schedule is custody_order.pdf."
- **Example misuse:** "Source the claim" (verb form is acceptable colloquially but the CLV prefers "trace the claim to its source").

### `clv.core.trace.v1` — trace

- **One-line definition:** The recorded link between an assertion or output and its supporting source(s).
- **Long definition:** A trace is the structured link from an assertion (or claim, conclusion, citation) back to the source(s) that support it, including supporting span, fact or authority type, the state that generated the trace, verification status, and attorney confirmation status. Trace integrity is one of JanumiLegal's core trust surfaces.
- **Allowed synonyms:** source-to-assertion trace, source-to-claim trace (historical synonym).
- **Prohibited synonyms:** citation (citation is narrower), reference.
- **Example use:** "Every material assertion in the draft memo carries a trace."
- **Example misuse:** "Trace the verification" (verification has its own status; tracing is from assertion to source).

---

## Section 5 — Releases and Communications

### `clv.core.release.v1` — release

- **One-line definition:** The act of permitting an artifact to leave attorney-internal scope for any external target.
- **Long definition:** Release is the governing act controlled by the Release Gate Evaluator. Release targets include internal use, attorney review, client communication, opposing counsel, court filing, agency submission, public release, and archival record. Release is determined by workflow state, artifact type, firm policy, review status, and target audience — not by free-form LLM judgment.
- **Allowed synonyms:** release decision, release authorization (formal).
- **Prohibited synonyms:** export, send, filing, service, delivery (each is a *form* of release; "release" is the gating concept).
- **Example use:** "Release status: external_release_blocked pending attorney approval."

### `clv.core.export.v1` — export

- **One-line definition:** Producing an artifact or governed-stream package for movement outside the matter scope.
- **Long definition:** Export is the act of generating a package from matter content for an authorized destination (discovery production, file transfer, in-camera submission, etc.). Every export is matter-scoped, classification-filtered, attorney-authorized, and recorded.
- **Allowed synonyms:** export package (the resulting artifact).
- **Prohibited synonyms:** release (broader), send, filing, service.
- **Example use:** "Export request for discovery production; classification filter excludes work_product_mental and attorney_client by default."

### `clv.core.filing.v1` — filing

- **One-line definition:** Submitting a document to a court or tribunal in accordance with that forum's procedures.
- **Long definition:** Filing is the formal act of submitting a document to a court of competent jurisdiction. Filing requires attorney signature by an attorney admitted in the forum, completion of caption and certificate of service, exhibit assembly, and conformity with local rules. Filing is a release form with the strictest gate.
- **Allowed synonyms:** court filing, e-filing (when filed electronically).
- **Prohibited synonyms:** release (broader), service, delivery, submission (where context is non-court).
- **Example use:** "The motion is in filing-ready state pending attorney signature."

### `clv.core.service.v1` — service

- **One-line definition:** Delivering a court-bound document to opposing parties as required by procedural rules.
- **Long definition:** Service is the procedural act of delivering pleadings, motions, discovery, or other court-bound documents to other parties or their counsel, governed by jurisdiction-specific rules. Service of process (initial complaint) is a distinct sub-category with stricter rules.
- **Allowed synonyms:** service of process (for initial process); certificate of service (documentation).
- **Prohibited synonyms:** delivery (generic), filing (different action), release.
- **Jurisdiction variants:** MD Rule 1-321 (general service); MD Rule 2-121 (service of process). VA, PA, DC have analogous rule numbers.

### `clv.core.delivery.v1` — delivery

- **One-line definition:** The generic act of conveying a document or communication to a recipient.
- **Long definition:** Delivery is the broadest term. Service is a delivery; sending is a delivery; filing is a delivery to a court. The CLV reserves "delivery" for contexts that require the generic sense.
- **Allowed synonyms:** conveyance.
- **Prohibited synonyms:** release, filing, service, send (each narrower or domain-specific).

### `clv.core.send.v1` — send

- **One-line definition:** The act of transmitting a communication (typically client-facing) once approved.
- **Long definition:** Send is the act that follows attorney approval of a client message, opposing-counsel email, or similar communication. The CLV reserves "send" for the post-approval transmission step. Pre-approval, no client communication is sent.
- **Allowed synonyms:** transmit (formal).
- **Prohibited synonyms:** release (broader), filing, service.
- **Example misuse:** "Send to court" (use *file*).

---

## Section 6 — Reviews, Approvals, Signatures

### `clv.core.review.v1` — review

- **One-line definition:** Evaluation of an artifact by an authorized human against firm policy and ethical obligations.
- **Long definition:** Review is the human evaluation step. Review may produce a comment, a request for revision, or a determination that the artifact is acceptable for the next stage. Review is not approval — review precedes approval.
- **Allowed synonyms:** human review, attorney review (when scoped), reviewer evaluation.
- **Prohibited synonyms:** approval, validation (narrower, system-level), sign-off (informal; ambiguous between review and approval).

### `clv.core.approval.v1` — approval

- **One-line definition:** A reviewer's formal authorization that an artifact meets the requirements for a specific release target.
- **Long definition:** Approval is the formal act represented by an `AttorneyAction` record bound to the artifact's exact bytes and a specific release target. Approval is target-specific: approval for internal use is not approval for client release; approval for client release is not approval for filing.
- **Allowed synonyms:** authorization (formal contexts).
- **Prohibited synonyms:** review, signature (signatures may follow approval but are distinct), sign-off.

### `clv.core.signature.v1` — signature

- **One-line definition:** A formal attestation by an attorney bound to an artifact, often required for filing or external release.
- **Long definition:** A signature is a binding attestation. Signature modes include wet, electronic, platform attestation, and ECF-compatible. A filing signature carries Rule-11-equivalent obligations under federal practice and analogues under state rules. Signatures are recorded as `AttorneyAction` records with `action: signed_for_filing` (or other signing actions).
- **Allowed synonyms:** sign (verb form).
- **Prohibited synonyms:** approval (signature is a specific approval form), review.

### `clv.core.authorization.v1` — authorization

- **One-line definition:** A grant of permission to perform a specific action.
- **Long definition:** Authorization is the broadest permissioning term. Granting a paralegal authority to draft is an authorization; client-granted authority to file is an authorization; export authorization is an authorization. The specific record is always an `AttorneyAction` or equivalent.
- **Allowed synonyms:** permission (in technical contexts), grant.
- **Prohibited synonyms:** approval (narrower), signature.

### `clv.core.ratification.v1` — ratification

- **One-line definition:** Subsequent attorney endorsement of an action already taken.
- **Long definition:** Ratification is the post-hoc adoption of an action — for example, an attorney ratifying a paralegal's draft after the fact. Ratification is recorded as an `AttorneyAction` with `action: ratified` and is distinct from approval-before-action.
- **Allowed synonyms:** post-action approval (informal).
- **Prohibited synonyms:** approval (which precedes action), signature.

---

## Section 7 — Parties

### `clv.core.party.v1` — party

- **One-line definition:** A named participant in a matter with a defined role.
- **Long definition:** A party is any named individual or entity occupying a defined role in the matter — client, opposing party, third party, witness, expert, etc. The Party / Relationship Mapper agent populates the party set for each matter.
- **Allowed synonyms:** participant (in non-litigation contexts).
- **Prohibited synonyms:** person (lay), entity (broader and ambiguous).

### `clv.core.client.v1` — client

- **One-line definition:** The party the firm represents in a matter.
- **Long definition:** The client is the party with whom an attorney-client relationship is established for the matter. In joint representation, multiple clients share the matter; in entity representation, the client is the entity (with implications for who speaks for the privilege). Privilege attaches to the attorney-client relationship.
- **Allowed synonyms:** represented party.
- **Prohibited synonyms:** party (broader), customer (commercial sense; do not use for legal context).
- **Jurisdiction variants:** MD, VA, PA, DC follow analogous corporate-client privilege rules; entity vs. constituent boundaries should be set in the Privilege Frame.

### `clv.core.opposing_party.v1` — opposing party

- **One-line definition:** A party adverse to the client in the matter.
- **Long definition:** The opposing party is the party (or parties) with interests adverse to the client. Communications with represented opposing parties are subject to no-contact rules (MD Rule 19-304.2 and analogues).
- **Allowed synonyms:** adverse party.
- **Prohibited synonyms:** opponent (informal), enemy (improper).

### `clv.core.non_party.v1` — non-party

- **One-line definition:** A participant in matter activity who is not a named party.
- **Long definition:** Non-parties include witnesses, deponents, document custodians, experts, and others who interact with the matter without being named. Non-party subpoenas, non-party communications, and non-party document productions follow distinct rules.
- **Allowed synonyms:** non-party participant.
- **Prohibited synonyms:** third party (which has a narrower meaning).

### `clv.core.third_party.v1` — third party

- **One-line definition:** A non-party with material interests or involvement in the matter.
- **Long definition:** A third party is a non-party whose interests, documents, or testimony are material — third-party beneficiaries, third-party subpoena targets, third-party-payer insurers. Distinguished from generic non-parties by materiality.
- **Allowed synonyms:** (none; the term is itself the canonical form).
- **Prohibited synonyms:** non-party (broader), party.

### `clv.core.witness.v1` — witness

- **One-line definition:** A non-party who provides factual testimony or whose factual perception is material.
- **Long definition:** A witness is a non-party whose perception, knowledge, or testimony is material to the matter. Fact witnesses, expert witnesses, and character witnesses are sub-types.
- **Allowed synonyms:** fact witness (specific), expert witness (specific), character witness (specific).
- **Prohibited synonyms:** party, deponent (deponents may or may not be witnesses).

---

## Section 8 — Artifacts and Production

### `clv.core.artifact.v1` — artifact

- **One-line definition:** A structured output produced by a lens state, governed by a schema and a release status.
- **Long definition:** An artifact is any structured output: a research memo, a draft motion, a redline, an authority verification packet, a client message draft, a filing package. Every artifact has a type, a version hash, a state-of-origin, a release status, and a chain of attorney actions.
- **Allowed synonyms:** output (technical), production artifact.
- **Prohibited synonyms:** document (broader; includes sources).

### `clv.core.draft.v1` — draft

- **One-line definition:** An artifact prior to attorney approval for any external release target.
- **Long definition:** Draft is a release status, not an artifact type. Every artifact begins as a draft. Drafts may be reviewed, revised, and re-drafted; they become approved (for a specific target) only via an `AttorneyAction`.
- **Allowed synonyms:** draft artifact.
- **Prohibited synonyms:** artifact (which encompasses both drafts and approved forms), work product (broader concept).

### `clv.core.work_product.v1` — work product

- **One-line definition:** Material prepared in anticipation of litigation or in connection with rendering legal services, subject to the work-product doctrine.
- **Long definition:** Work product is a privilege-doctrine concept distinguishing factual work product (typically discoverable on substantial-need/undue-hardship showing) from opinion work product (mental impressions, conclusions, opinions, legal theories — accorded near-absolute protection). The Governed Stream classification distinguishes `work_product_factual` from `work_product_mental` to honor this distinction.
- **Allowed synonyms:** attorney work product.
- **Prohibited synonyms:** artifact (artifacts are the technical outputs; work product is the privilege concept).

### `clv.core.deliverable.v1` — deliverable

- **One-line definition:** An artifact intended for an external recipient, post-approval.
- **Long definition:** A deliverable is a post-approval artifact ready for or already conveyed to its target audience. The same underlying artifact moves from draft → approved → delivered.
- **Allowed synonyms:** approved artifact (in the post-approval, pre-delivery state).
- **Prohibited synonyms:** draft, artifact (broader).

### `clv.core.production.v1` — production

- **One-line definition:** The legal-domain output stream of a matter — drafts, deliverables, filings, communications.
- **Long definition:** Production is the matter's collective output. The Legal Production Queue surfaces in-flight production items. Production also has a discovery-specific sense (document production in litigation); CLV resolves this by reserving the bare term for the broader sense and using "discovery production" for the discovery-specific sense.
- **Allowed synonyms:** legal production (qualifying); output (technical).
- **Prohibited synonyms:** discovery production (use the qualified phrase when that sense is meant).

### `clv.core.filing_package.v1` — filing package

- **One-line definition:** The complete bundle assembled for a court filing — pleading, exhibits, certificate of service, signature page, local-rule compliance items.
- **Long definition:** A filing package is the production unit for a court filing. Assembly is governed by the Court Filing Draft Lens; release is governed by the Release Gate Evaluator with the strictest gate.
- **Allowed synonyms:** filing bundle.
- **Prohibited synonyms:** filing (the act, not the package).

---

## Section 9 — Gates, Blocks, Escalations

### `clv.core.gate.v1` — gate

- **One-line definition:** A workflow control point that conditions onward progress on stated criteria.
- **Long definition:** A gate is a control point with explicit input criteria and explicit pass/fail/escalate outputs. The Release Gate Evaluator is the primary gate; per-state validators are smaller gates. Gate logic is mostly deterministic.
- **Allowed synonyms:** control point (technical), gate point.
- **Prohibited synonyms:** check (narrower; checks may feed gates), validator (a validator runs at a gate but is not the gate).

### `clv.core.block.v1` — block

- **One-line definition:** A gate's negative determination preventing onward progress.
- **Long definition:** A block is the state where a gate has refused passage. Blocks have a recorded basis. Blocks are clearable when their basis is resolved; stale blocks should not silently clear.
- **Allowed synonyms:** blocker (the underlying issue producing the block).
- **Prohibited synonyms:** failure (broader), error (broader).

### `clv.core.escalation.v1` — escalation

- **One-line definition:** Routing of a decision to a higher-authority human or specialized reviewer.
- **Long definition:** Escalation is the act of routing a decision beyond automated handling — to an attorney, supervising partner, conflicts officer, or specialized reviewer. Escalations are recorded and have stated triggers.
- **Allowed synonyms:** escalate (verb).
- **Prohibited synonyms:** referral (used for specific contexts only), block (different concept).

### `clv.core.hold.v1` — hold

- **One-line definition:** A pause on a workflow or matter pending external action, typically attorney-initiated.
- **Long definition:** A hold is a deliberate pause. Litigation holds suspend retention deletion. Workflow holds suspend state advancement. Holds carry a stated basis and a designated authorizer.
- **Allowed synonyms:** pause (informal), litigation hold (specific).
- **Prohibited synonyms:** block (different concept), escalation.

### `clv.core.flag.v1` — flag

- **One-line definition:** A non-blocking marker drawing attention to a condition.
- **Long definition:** A flag highlights a condition that may require review without itself blocking progress. Risk flags, candor flags, and confidentiality flags are flag forms. Flags become blocks only if a gate consumes them as block conditions.
- **Allowed synonyms:** marker, warning (informal).
- **Prohibited synonyms:** block, escalation, hold.

---

## Section 10 — Multi-Matter Tenancy Terms (added per multi-matter addendum §1)

### `clv.core.matter.v1` — matter

- **One-line definition:** A discrete legal engagement undertaken on behalf of a client (or jointly represented clients) within a firm.
- **Long definition:** A matter is the workflow unit and the isolation unit. Each matter has a client (or joint set), a primary practice area, an active lens or lens stack, a procedural posture, a privilege frame, and a Governed Stream segment. A matter is the unit of attorney-client relationship for retention, billing, and conflicts purposes.
- **Allowed synonyms:** engagement, case (in litigation contexts; ambiguous in transactional).
- **Prohibited synonyms:** project (developer-domain term), file (administrative sense; the firm "file" overlaps with but is not identical to the matter).
- **Example use:** "Matter ID is the third tier of the scope tuple."

### `clv.core.joint_representation.v1` — joint representation

- **One-line definition:** A representation of two or more clients in the same matter, governed by informed-consent and conflict rules.
- **Long definition:** Joint representation is a single engagement with multiple represented clients. It is permitted only with informed written consent (subject to ethics rules) and creates a shared privilege within the joint set; communications with one joint client are generally not privileged against the others. Conflict-emergence procedures are pre-defined.
- **Allowed synonyms:** joint engagement, multiple representation.
- **Prohibited synonyms:** common-interest representation (different concept; common-interest links separate representations).
- **Jurisdiction variants:** MD Rule 19-301.7, VA Rule 1.7, PA Rule 1.7, DC Rule 1.7 govern.

### `clv.core.common_interest.v1` — common-interest

- **One-line definition:** A privileged information-sharing relationship between separately represented parties with aligned legal interests.
- **Long definition:** A common-interest privilege (also called joint-defense in criminal contexts) preserves privilege for communications among separately represented parties pursuing a common legal interest. Documented in a common-interest agreement; modeled in JanumiLegal as a `CommonInterestLink` with explicit shared artifacts (multi-matter §7.2).
- **Allowed synonyms:** common-interest privilege, joint-defense (in criminal contexts).
- **Prohibited synonyms:** joint representation (different concept).

### `clv.core.screen.v1` — screen

- **One-line definition:** An ethical wall isolating a user from a matter.
- **Long definition:** A screen is the structural and policy isolation that separates a user from all access to a matter. Screens arise from former-client conflicts, lateral-attorney conflicts, and other Rule-1.10/1.11/1.18-implicating circumstances. A screen is enforced at the data-access layer, not the UI layer.
- **Allowed synonyms:** ethical wall, ethical screen, conflict screen.
- **Prohibited synonyms:** block (different concept), filter (operational term, not ethical).
- **Jurisdiction variants:** MD, VA, PA, DC have analogous rules; some require notice to former client and certifications.

### `clv.core.active_matter_context.v1` — active matter context

- **One-line definition:** The matter currently in force in a user's session, against which all session actions are stamped.
- **Long definition:** Exactly one active matter context is in force at any moment for any user session. All actions, writes, and reads inherit the active matter context. Switching is a deliberate, recorded event. Mismatch between active matter context and an action's target matter is an alarm condition.
- **Allowed synonyms:** active matter, session matter context.
- **Prohibited synonyms:** current matter (informal; ambiguous).

### `clv.core.mistaken_matter_action.v1` — mistaken-matter action

- **One-line definition:** An action discovered to have been performed under the wrong active matter context.
- **Long definition:** A mistaken-matter action is the recovery flow for context errors. The recovery records the misattribution in both matters' streams, surfaces a remediation checklist, and triggers re-evaluation of any release gates affected.
- **Allowed synonyms:** misattributed action, wrong-matter action.
- **Prohibited synonyms:** error (too generic), mistake (too generic).

---

## Section 11 — Verification Status (deterministic vs. probabilistic)

These are the controlled-vocabulary verification labels per source document §Core Product Doctrine and §Authority Verification.

### `clv.core.source_located.v1` — source located
- Mechanical: the cited source is retrievable in the corpus.

### `clv.core.quote_matched.v1` — quote matched
- Mechanical: a quoted span exists verbatim in the source.

### `clv.core.machine_assessed_support.v1` — machine-assessed support
- Probabilistic: an LLM/agent has evaluated whether the authority supports the proposition. Never collapses with citator status.

### `clv.core.machine_assessed_treatment.v1` — machine-assessed treatment
- Probabilistic: an LLM/agent or a non-citator-grade tool has classified an authority's treatment status (still good law, distinguished, overruled). Distinct from citator-grade treatment until a commercial citator is wired.

### `clv.core.citator_status.v1` — citator status
- Status from a commercial or open-data citator, when available. Never collapsed with machine-assessed support or treatment.

### `clv.core.attorney_confirmation_required.v1` — attorney confirmation required
- The artifact has been machine-assessed but requires attorney confirmation before any release target.

### `clv.core.attorney_confirmed.v1` — attorney confirmed
- An attorney has confirmed the verification result via an `AttorneyAction`. The strongest available label.

**Standing rule:** The UI never renders a single "verified" label that conflates these. Every verified item displays its highest applicable specific label.

---

## Section 12 — Release Status (controlled vocabulary)

Per source document §Release Gate examples, normalized:

- `internal_draft`
- `attorney_review_required`
- `business_review_required`
- `client_release_blocked`
- `approved_for_internal_use`
- `approved_for_client_use`
- `approved_for_external_use`
- `approved_for_filing`
- `external_release_blocked`
- `insufficient_information`
- `held_pending_conflict_resolution`
- `held_pending_lnfr_resolution`

Each is a distinct CLV entry of the same shape (`clv.core.release_status_<name>.v1`). Definitions are kept in the release-status registry rather than re-listed here for brevity; the registry is part of the CLV migration.

---

## Section 13 — Privilege Classification Vocabulary

Per `governed_stream_privilege.md` §4, normalized:

- `op_metadata`
- `work_product_factual`
- `work_product_mental`
- `attorney_client`
- `client_confidential`
- `public_record`

Each is a distinct CLV entry. The Privilege Classifier agent emits one of these on every matter-track write.

---

## Section 14 — Versioning, Migration, and Extension

- This is CLV v1. Every entry has `version: "v1"`.
- New entries are added by additive migration (`v1.1`, `v1.2`, etc.), each with rationale.
- Superseding an entry produces a new termId (e.g., `clv.core.issue.v2`), with the predecessor's `supersedes` field referencing it; predecessors remain readable for historical interpretation.
- Practice-area extensions (Layer 2) are namespaced: `clv.family_law.<term>.v1`, `clv.criminal_defense.<term>.v1`, etc. They may not redefine core terms; they may register new terms that are scoped to the lens pack.
- Jurisdiction variants are registered as alternate `jurisdictionVariants` on the relevant core term, never as separate top-level entries.
- Firm-config (Layer 3) extensions are permitted only with namespaced ids (`clv.firm_jclaw.<term>.v1`) and may not redefine core or practice-area terms.
- The VCC (multi-matter §1.2 / evolution §2) checks every load and merge against these rules.

---

## Section 15 — Implementation Note

This document is the source of truth for the CLV v1 migration. The migration runner at Wave 1 reads a structured form of these entries (extracted by a small generator) and inserts them into the `canonical_vocabulary` table. The generator and the migration are part of the Wave 1 deliverable; this prose document is preserved as the human-readable canonical form.

When updating: edit this document, regenerate the structured form, produce a new migration. Never write to the table by hand.
