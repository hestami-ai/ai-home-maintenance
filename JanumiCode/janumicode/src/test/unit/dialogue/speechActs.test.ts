import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	handleClaimSpeechAct,
	handleAssumptionSpeechAct,
	handleEvidenceSpeechAct,
	handleVerdictSpeechAct,
	handleDecisionSpeechAct,
	validateSpeechActParams,
} from '../../../lib/dialogue/speechActs';
import { createDialogueSession } from '../../../lib/dialogue/session';
import { Role, Phase, SpeechAct, ClaimCriticality, ClaimStatus } from '../../../lib/types';

describe('SpeechActs', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		const session = createDialogueSession();
		if (session.success) {
			dialogueId = session.value.dialogue_id;
		}
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('handleClaimSpeechAct', () => {
		it('creates a claim and dialogue turn', () => {
			const result = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'The system should handle 1000 concurrent users',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				content_ref: 'blob://claim-1',
				phase: Phase.PROPOSE,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claim.statement).toBe('The system should handle 1000 concurrent users');
				expect(result.value.claim.introduced_by).toBe(Role.EXECUTOR);
				expect(result.value.claim.criticality).toBe(ClaimCriticality.CRITICAL);
				expect(result.value.claim.status).toBe(ClaimStatus.OPEN);
				expect(result.value.turn.role).toBe(Role.EXECUTOR);
				expect(result.value.turn.speech_act).toBe(SpeechAct.CLAIM);
			}
		});

		it('associates claim with turn', () => {
			const result = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://test',
				phase: Phase.PROPOSE,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claim.turn_id).toBe(result.value.turn.event_id);
			}
		});

		it('supports different criticality levels', () => {
			const critical = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Critical claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				content_ref: 'blob://1',
				phase: Phase.PROPOSE,
			});

			const nonCritical = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Non-critical claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://2',
				phase: Phase.PROPOSE,
			});

			expect(critical.success && critical.value.claim.criticality).toBe(ClaimCriticality.CRITICAL);
			expect(nonCritical.success && nonCritical.value.claim.criticality).toBe(ClaimCriticality.NON_CRITICAL);
		});

		it('sets claim status to OPEN', () => {
			const result = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'New claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://test',
				phase: Phase.PROPOSE,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claim.status).toBe(ClaimStatus.OPEN);
			}
		});

		it('creates turn with correct phase', () => {
			const result = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://test',
				phase: Phase.ASSUMPTION_SURFACING,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.turn.phase).toBe(Phase.ASSUMPTION_SURFACING);
			}
		});
	});

	describe('handleAssumptionSpeechAct', () => {
		it('creates an assumption as a critical claim', () => {
			const result = handleAssumptionSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Database connection is always available',
				introduced_by: Role.EXECUTOR,
				content_ref: 'blob://assumption-1',
				phase: Phase.ASSUMPTION_SURFACING,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claim.criticality).toBe(ClaimCriticality.CRITICAL);
				expect(result.value.claim.statement).toBe('Database connection is always available');
			}
		});

		it('creates turn with CLAIM speech act', () => {
			const result = handleAssumptionSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test assumption',
				introduced_by: Role.EXECUTOR,
				content_ref: 'blob://test',
				phase: Phase.ASSUMPTION_SURFACING,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.turn.speech_act).toBe(SpeechAct.CLAIM);
			}
		});

		it('supports assumptions from different phases', () => {
			const propose = handleAssumptionSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Assumption in PROPOSE',
				introduced_by: Role.EXECUTOR,
				content_ref: 'blob://1',
				phase: Phase.PROPOSE,
			});

			const surfacing = handleAssumptionSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Assumption in ASSUMPTION_SURFACING',
				introduced_by: Role.EXECUTOR,
				content_ref: 'blob://2',
				phase: Phase.ASSUMPTION_SURFACING,
			});

			expect(propose.success).toBe(true);
			expect(surfacing.success).toBe(true);
		});
	});

	describe('handleEvidenceSpeechAct', () => {
		it('creates evidence turn for Technical Expert', () => {
			const result = handleEvidenceSpeechAct({
				dialogue_id: dialogueId,
				role: Role.TECHNICAL_EXPERT,
				phase: Phase.ASSUMPTION_SURFACING,
				content_ref: 'blob://evidence-1',
				related_claims: [],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.role).toBe(Role.TECHNICAL_EXPERT);
				expect(result.value.speech_act).toBe(SpeechAct.EVIDENCE);
			}
		});

		it('creates evidence turn for Historian', () => {
			const result = handleEvidenceSpeechAct({
				dialogue_id: dialogueId,
				role: Role.HISTORIAN,
				phase: Phase.HISTORICAL_CHECK,
				content_ref: 'blob://history-evidence',
				related_claims: [],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.role).toBe(Role.HISTORIAN);
				expect(result.value.speech_act).toBe(SpeechAct.EVIDENCE);
			}
		});

		it('associates evidence with related claims', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim',
				phase: Phase.PROPOSE,
			});

			expect(claimResult.success).toBe(true);

			if (claimResult.success) {
				const evidenceResult = handleEvidenceSpeechAct({
					dialogue_id: dialogueId,
					role: Role.TECHNICAL_EXPERT,
					phase: Phase.ASSUMPTION_SURFACING,
					content_ref: 'blob://evidence',
					related_claims: [claimResult.value.claim.claim_id],
				});

				expect(evidenceResult.success).toBe(true);
			}
		});

		it('supports multiple related claims', () => {
			const claim1 = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Claim 1',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim1',
				phase: Phase.PROPOSE,
			});

			const claim2 = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Claim 2',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim2',
				phase: Phase.PROPOSE,
			});

			if (claim1.success && claim2.success) {
				const evidence = handleEvidenceSpeechAct({
					dialogue_id: dialogueId,
					role: Role.TECHNICAL_EXPERT,
					phase: Phase.ASSUMPTION_SURFACING,
					content_ref: 'blob://evidence',
					related_claims: [claim1.value.claim.claim_id, claim2.value.claim.claim_id],
				});

				expect(evidence.success).toBe(true);
			}
		});
	});

	describe('handleVerdictSpeechAct', () => {
		it('creates verdict for a claim', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'System handles 1000 users',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				content_ref: 'blob://claim',
				phase: Phase.PROPOSE,
			});

			expect(claimResult.success).toBe(true);

			if (claimResult.success) {
				const verdictResult = handleVerdictSpeechAct({
					dialogue_id: dialogueId,
					claim_id: claimResult.value.claim.claim_id,
					verdict: ClaimStatus.VERIFIED,
					rationale: 'Load testing confirms capacity',
					content_ref: 'blob://verdict',
				});

				expect(verdictResult.success).toBe(true);
				if (verdictResult.success) {
					expect(verdictResult.value.verdict.claim_id).toBe(claimResult.value.claim.claim_id);
					expect(verdictResult.value.verdict.rationale).toBe('Load testing confirms capacity');
					expect(verdictResult.value.turn.role).toBe(Role.VERIFIER);
					expect(verdictResult.value.turn.speech_act).toBe(SpeechAct.VERDICT);
				}
			}
		});

		it('associates verdict with claim in related_claims', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim',
				phase: Phase.PROPOSE,
			});

			if (claimResult.success) {
				const verdictResult = handleVerdictSpeechAct({
					dialogue_id: dialogueId,
					claim_id: claimResult.value.claim.claim_id,
					verdict: ClaimStatus.VERIFIED,
					rationale: 'Verified',
					content_ref: 'blob://verdict',
				});

				expect(verdictResult.success).toBe(true);
			}
		});

		it('supports constraints reference', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim',
				phase: Phase.PROPOSE,
			});

			if (claimResult.success) {
				const verdictResult = handleVerdictSpeechAct({
					dialogue_id: dialogueId,
					claim_id: claimResult.value.claim.claim_id,
					verdict: ClaimStatus.CONDITIONAL,
					rationale: 'Valid under certain conditions',
					constraints_ref: 'blob://constraints',
					content_ref: 'blob://verdict',
				});

				expect(verdictResult.success).toBe(true);
				if (verdictResult.success) {
					expect(verdictResult.value.verdict.constraints_ref).toBe('blob://constraints');
				}
			}
		});

		it('supports evidence reference', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim',
				phase: Phase.PROPOSE,
			});

			if (claimResult.success) {
				const verdictResult = handleVerdictSpeechAct({
					dialogue_id: dialogueId,
					claim_id: claimResult.value.claim.claim_id,
					verdict: ClaimStatus.VERIFIED,
					rationale: 'Evidence supports claim',
					evidence_ref: 'blob://evidence-data',
					content_ref: 'blob://verdict',
				});

				expect(verdictResult.success).toBe(true);
				if (verdictResult.success) {
					expect(verdictResult.value.verdict.evidence_ref).toBe('blob://evidence-data');
				}
			}
		});

		it('creates turn in VERIFY phase', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim',
				phase: Phase.PROPOSE,
			});

			if (claimResult.success) {
				const verdictResult = handleVerdictSpeechAct({
					dialogue_id: dialogueId,
					claim_id: claimResult.value.claim.claim_id,
					verdict: ClaimStatus.VERIFIED,
					rationale: 'Verified',
					content_ref: 'blob://verdict',
				});

				expect(verdictResult.success).toBe(true);
				if (verdictResult.success) {
					expect(verdictResult.value.turn.phase).toBe(Phase.VERIFY);
				}
			}
		});
	});

	describe('handleDecisionSpeechAct', () => {
		it('creates human decision and turn', () => {
			const result = handleDecisionSpeechAct({
				dialogue_id: dialogueId,
				gate_id: 'gate-review-1',
				action: 'APPROVE',
				rationale: 'Proposal looks good, proceed with execution',
				content_ref: 'blob://decision',
				phase: Phase.REVIEW,
				related_claims: [],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.decision.gate_id).toBe('gate-review-1');
				expect(result.value.decision.rationale).toBe('Proposal looks good, proceed with execution');
				expect(result.value.turn.role).toBe(Role.HUMAN);
				expect(result.value.turn.speech_act).toBe(SpeechAct.DECISION);
			}
		});

		it('supports REJECT action', () => {
			const result = handleDecisionSpeechAct({
				dialogue_id: dialogueId,
				gate_id: 'gate-review-2',
				action: 'REJECT',
				rationale: 'Approach needs revision',
				content_ref: 'blob://decision',
				phase: Phase.REVIEW,
				related_claims: [],
			});

			expect(result.success).toBe(true);
		});

		it('supports OVERRIDE action', () => {
			const result = handleDecisionSpeechAct({
				dialogue_id: dialogueId,
				gate_id: 'gate-review-3',
				action: 'OVERRIDE',
				rationale: 'Overriding verifier concerns',
				content_ref: 'blob://decision',
				phase: Phase.REVIEW,
				related_claims: [],
			});

			expect(result.success).toBe(true);
		});

		it('supports REFRAME action', () => {
			const result = handleDecisionSpeechAct({
				dialogue_id: dialogueId,
				gate_id: 'gate-review-4',
				action: 'REFRAME',
				rationale: 'Need to reconsider the approach',
				content_ref: 'blob://decision',
				phase: Phase.REVIEW,
				related_claims: [],
			});

			expect(result.success).toBe(true);
		});

		it('associates decision with related claims', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				content_ref: 'blob://claim',
				phase: Phase.PROPOSE,
			});

			if (claimResult.success) {
				const decisionResult = handleDecisionSpeechAct({
					dialogue_id: dialogueId,
					gate_id: 'gate-1',
					action: 'APPROVE',
					rationale: 'Approving based on claim',
					content_ref: 'blob://decision',
					phase: Phase.REVIEW,
					related_claims: [claimResult.value.claim.claim_id],
				});

				expect(decisionResult.success).toBe(true);
			}
		});

		it('supports attachments reference', () => {
			const result = handleDecisionSpeechAct({
				dialogue_id: dialogueId,
				gate_id: 'gate-1',
				action: 'APPROVE',
				rationale: 'Approved with attachments',
				attachments_ref: 'blob://attachments',
				content_ref: 'blob://decision',
				phase: Phase.REVIEW,
				related_claims: [],
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.decision.attachments_ref).toBe('blob://attachments');
			}
		});
	});

	describe('validateSpeechActParams', () => {
		describe('CLAIM validation', () => {
			it('validates correct CLAIM parameters', () => {
				const result = validateSpeechActParams(SpeechAct.CLAIM, {
					statement: 'Test claim',
					introduced_by: Role.EXECUTOR,
				});

				expect(result.success).toBe(true);
			});

			it('rejects missing statement', () => {
				const result = validateSpeechActParams(SpeechAct.CLAIM, {
					introduced_by: Role.EXECUTOR,
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('statement');
				}
			});

			it('rejects non-string statement', () => {
				const result = validateSpeechActParams(SpeechAct.CLAIM, {
					statement: 123,
					introduced_by: Role.EXECUTOR,
				});

				expect(result.success).toBe(false);
			});

			it('rejects missing introduced_by', () => {
				const result = validateSpeechActParams(SpeechAct.CLAIM, {
					statement: 'Test claim',
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('introduced_by');
				}
			});
		});

		describe('ASSUMPTION validation', () => {
			it('validates correct ASSUMPTION parameters', () => {
				const result = validateSpeechActParams(SpeechAct.ASSUMPTION, {
					statement: 'Test assumption',
					introduced_by: Role.EXECUTOR,
				});

				expect(result.success).toBe(true);
			});

			it('has same requirements as CLAIM', () => {
				const result = validateSpeechActParams(SpeechAct.ASSUMPTION, {
					introduced_by: Role.EXECUTOR,
				});

				expect(result.success).toBe(false);
			});
		});

		describe('EVIDENCE validation', () => {
			it('validates correct EVIDENCE parameters', () => {
				const result = validateSpeechActParams(SpeechAct.EVIDENCE, {
					content_ref: 'blob://evidence',
					role: Role.TECHNICAL_EXPERT,
				});

				expect(result.success).toBe(true);
			});

			it('rejects missing content_ref', () => {
				const result = validateSpeechActParams(SpeechAct.EVIDENCE, {
					role: Role.TECHNICAL_EXPERT,
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('content_ref');
				}
			});

			it('rejects missing role', () => {
				const result = validateSpeechActParams(SpeechAct.EVIDENCE, {
					content_ref: 'blob://evidence',
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('role');
				}
			});
		});

		describe('VERDICT validation', () => {
			it('validates correct VERDICT parameters', () => {
				const result = validateSpeechActParams(SpeechAct.VERDICT, {
					claim_id: 'claim-123',
					verdict: ClaimStatus.VERIFIED,
					rationale: 'Test rationale',
				});

				expect(result.success).toBe(true);
			});

			it('rejects missing claim_id', () => {
				const result = validateSpeechActParams(SpeechAct.VERDICT, {
					verdict: ClaimStatus.VERIFIED,
					rationale: 'Test rationale',
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('claim_id');
				}
			});

			it('rejects missing verdict', () => {
				const result = validateSpeechActParams(SpeechAct.VERDICT, {
					claim_id: 'claim-123',
					rationale: 'Test rationale',
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('verdict');
				}
			});

			it('rejects missing rationale', () => {
				const result = validateSpeechActParams(SpeechAct.VERDICT, {
					claim_id: 'claim-123',
					verdict: ClaimStatus.VERIFIED,
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('rationale');
				}
			});
		});

		describe('DECISION validation', () => {
			it('validates correct DECISION parameters', () => {
				const result = validateSpeechActParams(SpeechAct.DECISION, {
					gate_id: 'gate-1',
					action: 'APPROVE',
					rationale: 'Test rationale',
				});

				expect(result.success).toBe(true);
			});

			it('rejects missing gate_id', () => {
				const result = validateSpeechActParams(SpeechAct.DECISION, {
					action: 'APPROVE',
					rationale: 'Test rationale',
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('gate_id');
				}
			});

			it('rejects missing action', () => {
				const result = validateSpeechActParams(SpeechAct.DECISION, {
					gate_id: 'gate-1',
					rationale: 'Test rationale',
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('action');
				}
			});

			it('rejects missing rationale', () => {
				const result = validateSpeechActParams(SpeechAct.DECISION, {
					gate_id: 'gate-1',
					action: 'APPROVE',
				});

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('rationale');
				}
			});
		});

		it('rejects unknown speech act', () => {
			const result = validateSpeechActParams('UNKNOWN' as any, {});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Unknown speech act');
			}
		});
	});

	describe('workflow scenarios', () => {
		it('simulates PROPOSE phase with claim and verdict', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Implementation uses PostgreSQL for data storage',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				content_ref: 'blob://proposal',
				phase: Phase.PROPOSE,
			});

			expect(claimResult.success).toBe(true);

			if (claimResult.success) {
				const verdictResult = handleVerdictSpeechAct({
					dialogue_id: dialogueId,
					claim_id: claimResult.value.claim.claim_id,
					verdict: ClaimStatus.VERIFIED,
					rationale: 'PostgreSQL is appropriate for the data requirements',
					content_ref: 'blob://verdict',
				});

				expect(verdictResult.success).toBe(true);
			}
		});

		it('simulates ASSUMPTION_SURFACING with evidence', () => {
			const assumptionResult = handleAssumptionSpeechAct({
				dialogue_id: dialogueId,
				statement: 'All users have modern browsers with ES6 support',
				introduced_by: Role.EXECUTOR,
				content_ref: 'blob://assumption',
				phase: Phase.ASSUMPTION_SURFACING,
			});

			expect(assumptionResult.success).toBe(true);

			if (assumptionResult.success) {
				const evidenceResult = handleEvidenceSpeechAct({
					dialogue_id: dialogueId,
					role: Role.TECHNICAL_EXPERT,
					phase: Phase.ASSUMPTION_SURFACING,
					content_ref: 'blob://browser-stats',
					related_claims: [assumptionResult.value.claim.claim_id],
				});

				expect(evidenceResult.success).toBe(true);
			}
		});

		it('simulates REVIEW phase with human decision', () => {
			const claimResult = handleClaimSpeechAct({
				dialogue_id: dialogueId,
				statement: 'Proposal is ready for execution',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				content_ref: 'blob://ready-claim',
				phase: Phase.PROPOSE,
			});

			if (claimResult.success) {
				const decisionResult = handleDecisionSpeechAct({
					dialogue_id: dialogueId,
					gate_id: 'review-gate-1',
					action: 'APPROVE',
					rationale: 'All verifications passed, approve for execution',
					content_ref: 'blob://approval',
					phase: Phase.REVIEW,
					related_claims: [claimResult.value.claim.claim_id],
				});

				expect(decisionResult.success).toBe(true);
			}
		});
	});
});
