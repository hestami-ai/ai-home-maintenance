// THE WORKBENCH DEMO SIGN-OFF POLICY — one definition, read by every assurance act the surface offers.
//
// ── WHY IT IS A MODULE AND NOT A LITERAL IN A ROUTE ACTION ────────────────────────────────────────────────────
// It was inline in `recordAssurance`. The moment a SECOND assurance act needed the same policy (S-1b's blocking
// finding), copying it would have produced two definitions of one governed object — which is exactly how four
// restatements of `AssessmentCriterion` came to disagree with each other and with the ratified shape
// (`assessment-criterion-contract.test.ts`). A policy is a governed object; it gets one home.
//
// ── ⚠ AND IT NOW DECLARES `dispositionRules`, WHICH IT DID NOT (S-1b / DESIGN-blocking-finding-capability §2) ──
// GATE C in `completeAssuranceAssessment` — `rejectForeclosedDisposition`, the DOC-004 §10.3 foreclosure — reads
// the POLICY's own rule:
//
//     const dispositionRule = (dispositionRules ?? []).find((r) => r?.disposition === disposition);
//     const forbidden = new Set(dispositionRule?.forbiddenOpenSeverities ?? []);
//     if (forbidden.size === 0) return null;          // ← no rule, no foreclosure
//
// `dispositionRules` is `.optional()` on `CreateAssurancePolicyPayload`, and this policy declared none. So on the
// only assurance surface the workbench has, **an operator could record a BLOCKING finding and still sign the work
// off SATISFIED.** The gate is correct, reachable, and was switched off by omission. An optional policy field
// that defaults to "no constraint" is a gate disabled by silence, which is the hardest kind to see.
import type { AssuranceSeverity } from '@janumipwb/rph-contracts';

/** The demo policy's stable id. */
export const DEMO_POLICY_ID = 'pol_01ARZ3NDEKTSV4RRFFQ69GDEM0';
export const DEMO_POLICY_VERSION = '1.0.0';
/** The finding code the adverse arm records against. Declared in `findingDefinitions` below. */
export const DEMO_FINDING_CODE = 'DEMO_UNFIT';

/** The severities that forbid a SATISFIED sign-off while still OPEN (DOC-004 §10.3's default ladder). */
export const DEMO_FORBIDDEN_OPEN_SEVERITIES: readonly AssuranceSeverity[] = ['BLOCKING', 'CRITICAL'];

/**
 * The `CreateAssurancePolicy` payload for the demo sign-off policy.
 *
 * ⚠ VERSIONING IS DISCLOSED, NOT AUTOMATED. The route creates this policy only if `DEMO_POLICY_ID` does not
 * already exist, so a DURABLE host that created it before `dispositionRules` landed keeps the old, unforeclosed
 * definition. Editing a live policy's meaning under the same version is precisely what `semanticVersion` and
 * `EditAssurancePolicy` exist to prevent, and silently re-writing it here would be the surface authoring a
 * governance change nobody decided. Test mode resets per spec, so E2E always gets this definition; a durable host
 * needs a deliberate policy version bump, which is a governance act and not this module's to perform.
 */
export const DEMO_POLICY_PAYLOAD = {
	policyId: DEMO_POLICY_ID,
	version: DEMO_POLICY_VERSION,
	name: 'Workbench Demo Sign-off',
	purpose: 'Operator sign-off that the demo PWU produced its expected output.',
	rationale:
		'The interactive demo drives the assurance axis; this assessment backs a SATISFIED disposition. Independence NONE — the operator is the reviewer.',
	applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
	evaluatedClaimTypes: ['FITNESS'],
	criteria: [
		{
			id: 'DEMO-01',
			name: 'Expected output present',
			description: 'The PWU has produced its declared expected output.',
			criterionType: 'QUALITATIVE',
			evaluationMethod: 'HUMAN_JUDGMENT',
			requiredEvidenceIds: [],
			severityIfNotMet: 'MATERIAL',
			mayBeNotApplicable: false
		}
	],
	evaluatorRole: 'REVIEWER',
	// NONE, and said out loud: one operator plays producer and reviewer in a standalone demo. Requiring a distinct
	// evaluator needs a second identity this host does not have. The field is enforced
	// (`assurance-independence.test.ts`); what is weak here is the DECLARATION, and it is weak on purpose.
	independenceRequirement: 'NONE',
	// GATE C's input. Without this the §10.3 foreclosure below cannot fire at all — see the header.
	dispositionRules: [
		{
			disposition: 'SATISFIED',
			condition: {},
			forbiddenOpenSeverities: [...DEMO_FORBIDDEN_OPEN_SEVERITIES]
		}
	],
	findingDefinitions: [
		{
			code: DEMO_FINDING_CODE,
			name: 'Output not fit for the approved need',
			description: 'The declared expected output is absent or does not serve the need.',
			defaultSeverity: 'MATERIAL',
			affectedClaimTypes: ['FITNESS'],
			defaultControlActions: ['GATHER_CONTEXT']
		}
	],
	permittedControlActions: ['CONTINUE', 'GATHER_CONTEXT']
} as const;
