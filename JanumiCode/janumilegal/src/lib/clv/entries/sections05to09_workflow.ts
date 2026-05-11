/**
 * CLV v1 — Sections 5–9: Workflow primitives.
 *
 * Authored from docs/clv/canonical_vocabulary_v1.md sections 5–9.
 */

import type { CanonicalVocabularyEntry } from '../types.js';

const V = 'v1';

export const SECTION_05_RELEASES: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.release.v1',
    canonicalName: 'release',
    oneLineDefinition: 'The act of permitting an artifact to leave attorney-internal scope for any external target.',
    longDefinition:
      'Release is the governing act controlled by the Release Gate Evaluator. Release targets include internal use, attorney review, client communication, opposing counsel, court filing, agency submission, public release, and archival record. Release is determined by workflow state, artifact type, firm policy, review status, and target audience — not by free-form LLM judgment.',
    scope: 'core',
    allowedSynonyms: ['release decision', 'release authorization'],
    prohibitedSynonyms: ['export', 'send', 'filing', 'service', 'delivery'],
    exampleUsage: ['Release status: external_release_blocked pending attorney approval.'],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.export.v1',
    canonicalName: 'export',
    oneLineDefinition: 'Producing an artifact or governed-stream package for movement outside the matter scope.',
    longDefinition:
      'Export is the act of generating a package from matter content for an authorized destination (discovery production, file transfer, in-camera submission, etc.). Every export is matter-scoped, classification-filtered, attorney-authorized, and recorded.',
    scope: 'core',
    allowedSynonyms: ['export package'],
    prohibitedSynonyms: ['release', 'send', 'filing', 'service'],
    exampleUsage: ['Export request for discovery production; classification filter excludes work_product_mental and attorney_client by default.'],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.filing.v1',
    canonicalName: 'filing',
    oneLineDefinition: "Submitting a document to a court or tribunal in accordance with that forum's procedures.",
    longDefinition:
      'Filing is the formal act of submitting a document to a court of competent jurisdiction. Filing requires attorney signature by an attorney admitted in the forum, completion of caption and certificate of service, exhibit assembly, and conformity with local rules. Filing is a release form with the strictest gate.',
    scope: 'core',
    allowedSynonyms: ['court filing', 'e-filing'],
    prohibitedSynonyms: ['release', 'service', 'delivery', 'submission'],
    exampleUsage: ['The motion is in filing-ready state pending attorney signature.'],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.service.v1',
    canonicalName: 'service',
    oneLineDefinition: 'Delivering a court-bound document to opposing parties as required by procedural rules.',
    longDefinition:
      'Service is the procedural act of delivering pleadings, motions, discovery, or other court-bound documents to other parties or their counsel, governed by jurisdiction-specific rules. Service of process (initial complaint) is a distinct sub-category with stricter rules.',
    scope: 'core',
    allowedSynonyms: ['service of process', 'certificate of service'],
    prohibitedSynonyms: ['delivery', 'filing', 'release'],
    jurisdictionVariants: {
      MD: 'MD Rule 1-321 (general service); MD Rule 2-121 (service of process).',
      VA: 'VA analogous rules apply; service-of-process rules differ from MD.',
      PA: 'Pa. R.C.P. 400 series govern service of process.',
      DC: 'Superior Court and DC Court of Appeals rules govern.',
    },
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.delivery.v1',
    canonicalName: 'delivery',
    oneLineDefinition: 'The generic act of conveying a document or communication to a recipient.',
    longDefinition:
      'Delivery is the broadest term. Service is a delivery; sending is a delivery; filing is a delivery to a court. The CLV reserves "delivery" for contexts that require the generic sense.',
    scope: 'core',
    allowedSynonyms: ['conveyance'],
    prohibitedSynonyms: ['release', 'filing', 'service', 'send'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.send.v1',
    canonicalName: 'send',
    oneLineDefinition: 'The act of transmitting a communication (typically client-facing) once approved.',
    longDefinition:
      'Send is the act that follows attorney approval of a client message, opposing-counsel email, or similar communication. The CLV reserves "send" for the post-approval transmission step. Pre-approval, no client communication is sent.',
    scope: 'core',
    allowedSynonyms: ['transmit'],
    prohibitedSynonyms: ['release', 'filing', 'service'],
    exampleUsage: [],
    exampleMisuse: ['Send to court (use file).'],
    version: V,
  },
];

export const SECTION_06_REVIEWS_APPROVALS_SIGNATURES: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.review.v1',
    canonicalName: 'review',
    oneLineDefinition: 'Evaluation of an artifact by an authorized human against firm policy and ethical obligations.',
    longDefinition:
      'Review is the human evaluation step. Review may produce a comment, a request for revision, or a determination that the artifact is acceptable for the next stage. Review is not approval — review precedes approval.',
    scope: 'core',
    allowedSynonyms: ['human review', 'attorney review', 'reviewer evaluation'],
    prohibitedSynonyms: ['approval', 'validation', 'sign-off'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.approval.v1',
    canonicalName: 'approval',
    oneLineDefinition: "A reviewer's formal authorization that an artifact meets the requirements for a specific release target.",
    longDefinition:
      "Approval is the formal act represented by an AttorneyAction record bound to the artifact's exact bytes and a specific release target. Approval is target-specific: approval for internal use is not approval for client release; approval for client release is not approval for filing.",
    scope: 'core',
    allowedSynonyms: ['authorization'],
    prohibitedSynonyms: ['review', 'signature', 'sign-off'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.signature.v1',
    canonicalName: 'signature',
    oneLineDefinition: 'A formal attestation by an attorney bound to an artifact, often required for filing or external release.',
    longDefinition:
      'A signature is a binding attestation. Signature modes include wet, electronic, platform attestation, and ECF-compatible. A filing signature carries Rule-11-equivalent obligations under federal practice and analogues under state rules. Signatures are recorded as AttorneyAction records with action: signed_for_filing (or other signing actions).',
    scope: 'core',
    allowedSynonyms: ['sign'],
    prohibitedSynonyms: ['approval', 'review'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.authorization.v1',
    canonicalName: 'authorization',
    oneLineDefinition: 'A grant of permission to perform a specific action.',
    longDefinition:
      'Authorization is the broadest permissioning term. Granting a paralegal authority to draft is an authorization; client-granted authority to file is an authorization; export authorization is an authorization. The specific record is always an AttorneyAction or equivalent.',
    scope: 'core',
    allowedSynonyms: ['permission', 'grant'],
    prohibitedSynonyms: ['approval', 'signature'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.ratification.v1',
    canonicalName: 'ratification',
    oneLineDefinition: 'Subsequent attorney endorsement of an action already taken.',
    longDefinition:
      "Ratification is the post-hoc adoption of an action — for example, an attorney ratifying a paralegal's draft after the fact. Ratification is recorded as an AttorneyAction with action: ratified and is distinct from approval-before-action.",
    scope: 'core',
    allowedSynonyms: ['post-action approval'],
    prohibitedSynonyms: ['approval', 'signature'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
];

export const SECTION_07_PARTIES: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.party.v1',
    canonicalName: 'party',
    oneLineDefinition: 'A named participant in a matter with a defined role.',
    longDefinition:
      'A party is any named individual or entity occupying a defined role in the matter — client, opposing party, third party, witness, expert, etc. The Party / Relationship Mapper agent populates the party set for each matter.',
    scope: 'core',
    allowedSynonyms: ['participant'],
    prohibitedSynonyms: ['person', 'entity'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.client.v1',
    canonicalName: 'client',
    oneLineDefinition: 'The party the firm represents in a matter.',
    longDefinition:
      'The client is the party with whom an attorney-client relationship is established for the matter. In joint representation, multiple clients share the matter; in entity representation, the client is the entity (with implications for who speaks for the privilege). Privilege attaches to the attorney-client relationship.',
    scope: 'core',
    allowedSynonyms: ['represented party'],
    prohibitedSynonyms: ['party', 'customer'],
    jurisdictionVariants: {
      MD: 'MD, VA, PA, DC follow analogous corporate-client privilege rules; entity vs. constituent boundaries should be set in the Privilege Frame.',
    },
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.opposing_party.v1',
    canonicalName: 'opposing party',
    oneLineDefinition: 'A party adverse to the client in the matter.',
    longDefinition:
      'The opposing party is the party (or parties) with interests adverse to the client. Communications with represented opposing parties are subject to no-contact rules (MD Rule 19-304.2 and analogues).',
    scope: 'core',
    allowedSynonyms: ['adverse party'],
    prohibitedSynonyms: ['opponent', 'enemy'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.non_party.v1',
    canonicalName: 'non-party',
    oneLineDefinition: 'A participant in matter activity who is not a named party.',
    longDefinition:
      'Non-parties include witnesses, deponents, document custodians, experts, and others who interact with the matter without being named. Non-party subpoenas, non-party communications, and non-party document productions follow distinct rules.',
    scope: 'core',
    allowedSynonyms: ['non-party participant'],
    prohibitedSynonyms: ['third party'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.third_party.v1',
    canonicalName: 'third party',
    oneLineDefinition: 'A non-party with material interests or involvement in the matter.',
    longDefinition:
      'A third party is a non-party whose interests, documents, or testimony are material — third-party beneficiaries, third-party subpoena targets, third-party-payer insurers. Distinguished from generic non-parties by materiality.',
    scope: 'core',
    allowedSynonyms: [],
    prohibitedSynonyms: ['non-party', 'party'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.witness.v1',
    canonicalName: 'witness',
    oneLineDefinition: 'A non-party who provides factual testimony or whose factual perception is material.',
    longDefinition:
      'A witness is a non-party whose perception, knowledge, or testimony is material to the matter. Fact witnesses, expert witnesses, and character witnesses are sub-types.',
    scope: 'core',
    allowedSynonyms: ['fact witness', 'expert witness', 'character witness'],
    prohibitedSynonyms: ['party', 'deponent'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
];

export const SECTION_08_ARTIFACTS: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.artifact.v1',
    canonicalName: 'artifact',
    oneLineDefinition: 'A structured output produced by a lens state, governed by a schema and a release status.',
    longDefinition:
      'An artifact is any structured output: a research memo, a draft motion, a redline, an authority verification packet, a client message draft, a filing package. Every artifact has a type, a version hash, a state-of-origin, a release status, and a chain of attorney actions.',
    scope: 'core',
    allowedSynonyms: ['output', 'production artifact'],
    prohibitedSynonyms: ['document'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.draft.v1',
    canonicalName: 'draft',
    oneLineDefinition: 'An artifact prior to attorney approval for any external release target.',
    longDefinition:
      'Draft is a release status, not an artifact type. Every artifact begins as a draft. Drafts may be reviewed, revised, and re-drafted; they become approved (for a specific target) only via an AttorneyAction.',
    scope: 'core',
    allowedSynonyms: ['draft artifact'],
    prohibitedSynonyms: ['artifact', 'work product'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.work_product.v1',
    canonicalName: 'work product',
    oneLineDefinition: 'Material prepared in anticipation of litigation or in connection with rendering legal services, subject to the work-product doctrine.',
    longDefinition:
      'Work product is a privilege-doctrine concept distinguishing factual work product (typically discoverable on substantial-need/undue-hardship showing) from opinion work product (mental impressions, conclusions, opinions, legal theories — accorded near-absolute protection). The Governed Stream classification distinguishes work_product_factual from work_product_mental to honor this distinction.',
    scope: 'core',
    allowedSynonyms: ['attorney work product'],
    prohibitedSynonyms: ['artifact'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.deliverable.v1',
    canonicalName: 'deliverable',
    oneLineDefinition: 'An artifact intended for an external recipient, post-approval.',
    longDefinition:
      'A deliverable is a post-approval artifact ready for or already conveyed to its target audience. The same underlying artifact moves from draft → approved → delivered.',
    scope: 'core',
    allowedSynonyms: ['approved artifact'],
    prohibitedSynonyms: ['draft', 'artifact'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.production.v1',
    canonicalName: 'production',
    oneLineDefinition: "The legal-domain output stream of a matter — drafts, deliverables, filings, communications.",
    longDefinition:
      "Production is the matter's collective output. The Legal Production Queue surfaces in-flight production items. Production also has a discovery-specific sense (document production in litigation); the bare term is reserved for the broader sense and 'discovery production' is used for the discovery-specific sense.",
    scope: 'core',
    allowedSynonyms: ['legal production', 'output'],
    prohibitedSynonyms: ['discovery production'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.filing_package.v1',
    canonicalName: 'filing package',
    oneLineDefinition: 'The complete bundle assembled for a court filing — pleading, exhibits, certificate of service, signature page, local-rule compliance items.',
    longDefinition:
      'A filing package is the production unit for a court filing. Assembly is governed by the Court Filing Draft Lens; release is governed by the Release Gate Evaluator with the strictest gate.',
    scope: 'core',
    allowedSynonyms: ['filing bundle'],
    prohibitedSynonyms: ['filing'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
];

export const SECTION_09_GATES: readonly CanonicalVocabularyEntry[] = [
  {
    termId: 'clv.core.gate.v1',
    canonicalName: 'gate',
    oneLineDefinition: 'A workflow control point that conditions onward progress on stated criteria.',
    longDefinition:
      'A gate is a control point with explicit input criteria and explicit pass/fail/escalate outputs. The Release Gate Evaluator is the primary gate; per-state validators are smaller gates. Gate logic is mostly deterministic.',
    scope: 'core',
    allowedSynonyms: ['control point', 'gate point'],
    prohibitedSynonyms: ['check', 'validator'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.block.v1',
    canonicalName: 'block',
    oneLineDefinition: "A gate's negative determination preventing onward progress.",
    longDefinition:
      'A block is the state where a gate has refused passage. Blocks have a recorded basis. Blocks are clearable when their basis is resolved; stale blocks should not silently clear.',
    scope: 'core',
    allowedSynonyms: ['blocker'],
    prohibitedSynonyms: ['failure', 'error'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.escalation.v1',
    canonicalName: 'escalation',
    oneLineDefinition: 'Routing of a decision to a higher-authority human or specialized reviewer.',
    longDefinition:
      'Escalation is the act of routing a decision beyond automated handling — to an attorney, supervising partner, conflicts officer, or specialized reviewer. Escalations are recorded and have stated triggers.',
    scope: 'core',
    allowedSynonyms: ['escalate'],
    prohibitedSynonyms: ['referral', 'block'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.hold.v1',
    canonicalName: 'hold',
    oneLineDefinition: 'A pause on a workflow or matter pending external action, typically attorney-initiated.',
    longDefinition:
      'A hold is a deliberate pause. Litigation holds suspend retention deletion. Workflow holds suspend state advancement. Holds carry a stated basis and a designated authorizer.',
    scope: 'core',
    allowedSynonyms: ['pause', 'litigation hold'],
    prohibitedSynonyms: ['block', 'escalation'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
  {
    termId: 'clv.core.flag.v1',
    canonicalName: 'flag',
    oneLineDefinition: 'A non-blocking marker drawing attention to a condition.',
    longDefinition:
      'A flag highlights a condition that may require review without itself blocking progress. Risk flags, candor flags, and confidentiality flags are flag forms. Flags become blocks only if a gate consumes them as block conditions.',
    scope: 'core',
    allowedSynonyms: ['marker', 'warning'],
    prohibitedSynonyms: ['block', 'escalation', 'hold'],
    exampleUsage: [],
    exampleMisuse: [],
    version: V,
  },
];
