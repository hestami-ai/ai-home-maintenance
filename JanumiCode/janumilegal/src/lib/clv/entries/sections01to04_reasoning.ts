/**
 * CLV v1 — Sections 1–4: Legal reasoning primitives.
 *
 * Authored from docs/clv/canonical_vocabulary_v1.md sections 1–4.
 * The Markdown doc is the human canonical form; this is the runtime form.
 * Both must remain consistent. A consistency check tool may be added later.
 */

import type { CanonicalVocabularyEntry } from '../types.js';

const V = 'v1';

export const SECTION_01_ISSUES_CLAIMS_ASSERTIONS: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.issue.v1',
    canonicalName: 'issue',
    oneLineDefinition: 'A bounded legal question whose answer affects the matter outcome.',
    longDefinition:
      'An issue is a discrete legal question identified during decomposition (Issue Bloom). It is the unit of analysis the lens uses to plan research, decide retain/remove/defer/escalate (Issue Prune), and structure synthesis. An issue is not a cause of action, not a factual assertion, and not a conclusion.',
    scope: 'core',
    allowedSynonyms: ['legal question', 'point of law'],
    prohibitedSynonyms: ['claim', 'cause of action', 'count', 'allegation', 'assertion', 'finding', 'conclusion'],
    exampleUsage: ['The issue of whether support arrears justify withholding access is retained under the existing order.'],
    exampleMisuse: ["The plaintiff filed an issue against the defendant (this is a claim or cause of action)."],
    collisionsWith: ['clv.core.claim.v1', 'clv.core.assertion.v1'],
    version: V,
  },
  {
    termId: 'clv.core.claim.v1',
    canonicalName: 'claim',
    oneLineDefinition: 'A cause of action or count asserted by a party against another party.',
    longDefinition:
      'A claim is a legal cause of action — the formal basis on which a party seeks relief. Each claim has elements that must be pleaded and ultimately proven. The complaint contains claims; an enforcement motion may seek relief on claims; the prayer for relief is structured per claim.',
    scope: 'core',
    allowedSynonyms: ['cause of action', 'count'],
    prohibitedSynonyms: ['issue', 'assertion', 'allegation', 'fact', 'finding', 'conclusion'],
    exampleUsage: ['The complaint asserts three claims: breach of contract, unjust enrichment, and conversion.'],
    exampleMisuse: ["The expert's claim is that the timeline is wrong (this is an assertion or opinion)."],
    collisionsWith: ['clv.core.issue.v1', 'clv.core.assertion.v1'],
    version: V,
  },
  {
    termId: 'clv.core.assertion.v1',
    canonicalName: 'assertion',
    oneLineDefinition: 'A statement of fact or position offered by a party, witness, attorney, or system.',
    longDefinition:
      'An assertion is any statement asserting that something is the case. It carries no inherent evidentiary status until evaluated. In source-to-claim trace, the "claim" is the assertion sense — that is, an asserted fact or characterization tied to a source. Product UI and prompts should prefer "source-to-assertion trace"; "source-to-claim trace" remains a permitted historical synonym.',
    scope: 'core',
    allowedSynonyms: ['statement', 'position'],
    prohibitedSynonyms: ['fact', 'finding', 'conclusion', 'claim'],
    exampleUsage: ["The mother's assertion that the child does not want to go is recorded but not adjudicated."],
    exampleMisuse: ['The complaint contains five assertions (those are claims).'],
    collisionsWith: ['clv.core.claim.v1', 'clv.core.fact.v1'],
    version: V,
  },
];

export const SECTION_02_FACTS_FINDINGS_CONCLUSIONS: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.fact.v1',
    canonicalName: 'fact',
    oneLineDefinition: 'Something asserted or established about the world, with a recorded source and confidence label.',
    longDefinition:
      'A fact in JanumiLegal is always paired with a source and a confidence label drawn from a controlled set: document_supported, client_reported, opposing_party_claim, attorney_note, unverified, conflicting. A bare fact without source and label is invalid in any matter-track artifact.',
    scope: 'core',
    allowedSynonyms: ['factual statement'],
    prohibitedSynonyms: ['finding', 'conclusion', 'allegation', 'assertion'],
    exampleUsage: ['Document-supported fact: father has access every other weekend Friday 6 PM to Sunday 6 PM (custody_order.pdf).'],
    exampleMisuse: ['Fact: the mother is in contempt (this is a legal conclusion, not a fact).'],
    version: V,
  },
  {
    termId: 'clv.core.allegation.v1',
    canonicalName: 'allegation',
    oneLineDefinition: 'A factual claim made by a party in a pleading or court-recorded statement, not yet adjudicated.',
    longDefinition:
      "An allegation is a party's assertion of fact within a litigation context, distinguished from a fact (which carries source and confidence) and from a finding (which is adjudicated). Pleadings contain allegations; complaints allege claims supported by allegations.",
    scope: 'core',
    allowedSynonyms: ['alleged fact'],
    prohibitedSynonyms: ['fact', 'finding', 'conclusion'],
    exampleUsage: ['The complaint alleges that the defendant breached the agreement on April 10.'],
    exampleMisuse: ["The court finds the allegations are facts (the court's finding converts allegation status; do not pre-collapse)."],
    version: V,
  },
  {
    termId: 'clv.core.finding.v1',
    canonicalName: 'finding',
    oneLineDefinition: 'A determination by a court, tribunal, hearing officer, or other authorized adjudicator.',
    longDefinition:
      'A finding is an adjudicated determination — a fact found by a fact-finder or a legal determination by a court. Findings of fact and conclusions of law are distinct. JanumiLegal artifacts must not characterize anything as a finding unless it was made by an authorized adjudicator.',
    scope: 'core',
    allowedSynonyms: ['determination', 'finding of fact', 'finding of law'],
    prohibitedSynonyms: ['fact', 'allegation', 'conclusion'],
    exampleUsage: ["The trial court's findings of fact establish that exchanges occurred at the designated location."],
    exampleMisuse: ["The agent's finding is that contempt may apply (an agent does not make findings — this is a machine-assessed conclusion candidate)."],
    version: V,
  },
  {
    termId: 'clv.core.conclusion.v1',
    canonicalName: 'conclusion',
    oneLineDefinition: 'A reasoned legal output applying law to facts.',
    longDefinition:
      'A legal conclusion is a reasoned application of authority to facts producing a position on a legal question. In JanumiLegal, every conclusion must carry: facts relied upon, authorities relied upon, assumptions, missing facts, adverse considerations, could-change-if conditions, verification status, and attorney review status.',
    scope: 'core',
    allowedSynonyms: ['legal conclusion', 'conclusion of law'],
    prohibitedSynonyms: ['finding', 'fact', 'opinion', 'advice'],
    exampleUsage: ['The Direct Legal Conclusion Lens emits a conclusion candidate with full dependency labels.'],
    exampleMisuse: ['Final conclusion sent to client (per doctrine, conclusions are draft until attorney-approved).'],
    version: V,
  },
];

export const SECTION_03_REASONING_PRIMITIVES: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.rule.v1',
    canonicalName: 'rule',
    oneLineDefinition: 'A normative statement drawn from authority that governs how a question is decided.',
    longDefinition:
      'A rule is the operative norm extracted from a statute, regulation, court rule, or case-law synthesis. Rules are mapped to elements for fact-to-law analysis. A rule has a source authority and may have jurisdictional scope.',
    scope: 'core',
    allowedSynonyms: ['legal rule', 'governing rule'],
    prohibitedSynonyms: ['standard', 'test', 'factor', 'element'],
    exampleUsage: ['The applicable rule prohibits withholding access based on support disputes.'],
    exampleMisuse: ['Apply the contempt rule (which rule? The CLV requires an authority reference).'],
    version: V,
  },
  {
    termId: 'clv.core.element.v1',
    canonicalName: 'element',
    oneLineDefinition: 'A constituent component of a rule, claim, or offense that must be satisfied independently.',
    longDefinition:
      'An element is a discrete component that must be proven (claim) or established (rule) for the rule to apply. Element-by-element analysis is the standard JanumiLegal pattern in RuleElementMap and FactToRuleMap.',
    scope: 'core',
    allowedSynonyms: ['prong'],
    prohibitedSynonyms: ['factor', 'rule', 'standard'],
    exampleUsage: ['The contempt elements include a valid order, knowledge, specific obligation, failure to comply, and supporting evidence.'],
    exampleMisuse: ['The best-interests elements (best-interests analysis uses factors, not elements).'],
    version: V,
  },
  {
    termId: 'clv.core.factor.v1',
    canonicalName: 'factor',
    oneLineDefinition: 'A consideration weighed in a balancing or totality-of-circumstances analysis.',
    longDefinition:
      'A factor is a consideration that a court balances or weighs alongside others in reaching a determination. Unlike an element, a factor is not pass/fail — its weight depends on context. Best-interests-of-the-child analysis is a paradigmatic factor-based test.',
    scope: 'core',
    allowedSynonyms: ['consideration'],
    prohibitedSynonyms: ['element', 'rule', 'standard', 'prong'],
    jurisdictionVariants: {
      MD: 'Maryland best-interests factors derive from Sanders (1979) and Taylor (1986). Family-law lens packs operating in Maryland should reference the canonical Sanders/Taylor factor list.',
    },
    exampleUsage: ["Best-interests factors include the child's preference, parental fitness, and stability of the home environment."],
    exampleMisuse: ['The plaintiff failed to prove all factors (factors are weighed, not proven; this misuses the term).'],
    version: V,
  },
  {
    termId: 'clv.core.standard.v1',
    canonicalName: 'standard',
    oneLineDefinition: 'The level of proof, scrutiny, or care that a legal question requires.',
    longDefinition:
      'A standard governs how a determination is made. Examples: preponderance of the evidence, clear and convincing, beyond a reasonable doubt, abuse of discretion, de novo, rational basis, strict scrutiny, reasonable person. A rule may carry a standard; an issue analysis must identify the applicable standard.',
    scope: 'core',
    allowedSynonyms: ['standard of proof', 'standard of review', 'standard of care'],
    prohibitedSynonyms: ['test', 'rule', 'element', 'factor'],
    exampleUsage: ['Civil contempt requires proof by clear and convincing evidence in many jurisdictions; confirm MD standard.'],
    exampleMisuse: ['Apply the four-element standard (a four-element rule has elements, not standards).'],
    version: V,
  },
  {
    termId: 'clv.core.test.v1',
    canonicalName: 'test',
    oneLineDefinition: 'A structured analytical framework for resolving a legal question, often comprising elements, factors, or stages.',
    longDefinition:
      'A test is a named analytical framework — sometimes element-based, sometimes factor-based, sometimes a combination. Examples: the Lemon test, the Strickland test, the Twombly/Iqbal pleading standard, the Mathews v. Eldridge balancing test. JanumiLegal artifacts naming a test must cite the source authority.',
    scope: 'core',
    allowedSynonyms: ['legal test', 'framework'],
    prohibitedSynonyms: ['standard', 'rule', 'element', 'factor'],
    exampleUsage: ["The applicable test for ineffective assistance is Strickland's two-prong analysis."],
    exampleMisuse: ['Treating "test" and "standard" as synonyms (they are not).'],
    version: V,
  },
];

export const SECTION_04_AUTHORITY: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.authority.v1',
    canonicalName: 'authority',
    oneLineDefinition: 'A legal source that provides binding or persuasive support for a proposition.',
    longDefinition:
      'Authority is the primary or secondary legal source cited to support a proposition. Authority is classified as primary (statutes, regulations, court opinions, court rules) or secondary (treatises, restatements, law review articles); within primary, as controlling (binding in the relevant jurisdiction and posture) or persuasive. The Authority Verification Lens distinguishes mechanical checks (citation format, source presence, quote match) from machine-assessed checks (support, controlling status, treatment).',
    scope: 'core',
    allowedSynonyms: ['legal authority', 'source authority'],
    prohibitedSynonyms: ['source', 'citation'],
    exampleUsage: ['Controlling authority in MD on this issue includes the Family Law Article §9-105.'],
    exampleMisuse: ['The custody order is the authority (the order is matter-specific authority — a sub-class — but the bare term authority is reserved for legal sources of general application).'],
    version: V,
  },
  {
    termId: 'clv.core.citation.v1',
    canonicalName: 'citation',
    oneLineDefinition: 'The formatted reference identifying an authority.',
    longDefinition:
      'A citation is the reference to an authority in the conventional format (Bluebook, ALWD, jurisdiction-specific). A citation has a parsed structure (reporter, volume, page, year, court, etc.) that mechanical checks operate on.',
    scope: 'core',
    allowedSynonyms: ['cite'],
    prohibitedSynonyms: ['authority', 'source', 'reference'],
    exampleUsage: ['The citation parses cleanly under MD format; the source document is retrieved; the pinpoint quote matches.'],
    exampleMisuse: ['Verify the citation supports the proposition (this conflates citation format check with authority support assessment — different checks).'],
    version: V,
  },
  {
    termId: 'clv.core.reference.v1',
    canonicalName: 'reference',
    oneLineDefinition: 'A pointer to a source, authority, document, or prior matter context.',
    longDefinition:
      'A reference is a generic pointer. Specific reference types — SourceRef, ArtifactRef, AuthorityRef, MatterRef — are the implementation forms. The bare term "reference" in user-facing text should usually be replaced by the specific type.',
    scope: 'core',
    allowedSynonyms: ['pointer', 'link'],
    prohibitedSynonyms: ['citation', 'authority', 'source'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.source.v1',
    canonicalName: 'source',
    oneLineDefinition: 'Any document, communication, or record from which facts, claims, or authorities are drawn.',
    longDefinition:
      'A source is the broadest category — it encompasses authorities, client documents, evidence, communications, prior work product, and any other matter content. The Source Document Inventory classifies sources by type and matter role. A source-to-assertion trace links assertions back to their sources.',
    scope: 'core',
    allowedSynonyms: ['source document', 'evidence'],
    prohibitedSynonyms: ['authority', 'citation'],
    exampleUsage: ['The source for the access schedule is custody_order.pdf.'],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.trace.v1',
    canonicalName: 'trace',
    oneLineDefinition: 'The recorded link between an assertion or output and its supporting source(s).',
    longDefinition:
      'A trace is the structured link from an assertion (or claim, conclusion, citation) back to the source(s) that support it, including supporting span, fact or authority type, the state that generated the trace, verification status, and attorney confirmation status. Trace integrity is one of JanumiLegal\'s core trust surfaces.',
    scope: 'core',
    allowedSynonyms: ['source-to-assertion trace', 'source-to-claim trace'],
    prohibitedSynonyms: ['citation', 'reference'],
    exampleUsage: ['Every material assertion in the draft memo carries a trace.'],
    exampleMisuse: ['Trace the verification (verification has its own status; tracing is from assertion to source).'],
    version: V,
  },
];
