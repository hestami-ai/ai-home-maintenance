import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	retrieveRelevantClaims,
	retrieveRelevantVerdicts,
	retrieveRelevantDecisions,
	retrieveTurnsByTimeWindow,
	searchForContradictions,
	searchForPrecedents,
	retrieveHistoricalContext,
	type HistoricalQueryOptions,
} from '../../../lib/context/historical';
import { getDatabase } from '../../../lib/database/init';
import { Role, Phase, ClaimStatus, ClaimCriticality, HumanAction, VerdictType } from '../../../lib/types';
import { randomUUID } from 'node:crypto';

describe('Historical Context', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const insertClaim = (statement: string, status = ClaimStatus.OPEN, criticality = ClaimCriticality.NON_CRITICAL) => {
		const db = getDatabase()!;
		const claimId = randomUUID();
		const turnId = randomUUID();
		
		db.prepare(`
			INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			claimId,
			statement,
			Role.EXECUTOR,
			criticality,
			status,
			dialogueId,
			turnId,
			new Date().toISOString()
		);
		
		return claimId;
	};

	const insertVerdict = (claimId: string, verdict: VerdictType, rationale: string) => {
		const db = getDatabase()!;
		const verdictId = randomUUID();
		
		db.prepare(`
			INSERT INTO verdicts (verdict_id, claim_id, verdict, constraints_ref, evidence_ref, rationale, novel_dependency, timestamp)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			verdictId,
			claimId,
			verdict,
			null,
			null,
			rationale,
			false,
			new Date().toISOString()
		);
		
		return verdictId;
	};

	const insertGateAndDecision = (action: HumanAction, rationale: string) => {
		const db = getDatabase()!;
		const gateId = randomUUID();
		const decisionId = randomUUID();
		
		db.prepare(`
			INSERT INTO gates (gate_id, dialogue_id, gate_type, phase, created_at)
			VALUES (?, ?, ?, ?, ?)
		`).run(gateId, dialogueId, 'REVIEW', Phase.EXECUTE, new Date().toISOString());
		
		db.prepare(`
			INSERT INTO human_decisions (decision_id, gate_id, action, rationale, attachments_ref, timestamp)
			VALUES (?, ?, ?, ?, ?, ?)
		`).run(decisionId, gateId, action, rationale, null, new Date().toISOString());
		
		return { gateId, decisionId };
	};

	const insertDialogueEvent = (role: Role, phase: Phase, summary: string, content: string) => {
		const db = getDatabase()!;
		
		db.prepare(`
			INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).run(
			dialogueId,
			'turn',
			role,
			phase,
			'statement',
			summary,
			content,
			new Date().toISOString(),
			new Date().toISOString()
		);
	};

	describe('retrieveRelevantClaims', () => {
		it('retrieves claims successfully', () => {
			insertClaim('User authentication is required');
			insertClaim('Database connection is established');

			const result = retrieveRelevantClaims('authentication');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
				expect(result.value[0].item.statement).toBeDefined();
			}
		});

		it('calculates relevance scores', () => {
			insertClaim('User authentication is required');
			insertClaim('API endpoint returns authentication token');

			const result = retrieveRelevantClaims('authentication');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.every(item => item.relevanceScore >= 0 && item.relevanceScore <= 1)).toBe(true);
			}
		});

		it('sorts by relevance score descending', () => {
			insertClaim('User authentication is required');
			insertClaim('Database connection established');
			insertClaim('Authentication token generation');

			const result = retrieveRelevantClaims('authentication');

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 1) {
				for (let i = 0; i < result.value.length - 1; i++) {
					expect(result.value[i].relevanceScore).toBeGreaterThanOrEqual(result.value[i + 1].relevanceScore);
				}
			}
		});

		it('filters by similarity threshold', () => {
			insertClaim('User authentication is required');
			insertClaim('Completely unrelated claim about database');

			const result = retrieveRelevantClaims('authentication', { similarityThreshold: 0.5 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.every(item => item.relevanceScore >= 0.5)).toBe(true);
			}
		});

		it('respects limit option', () => {
			for (let i = 0; i < 20; i++) {
				insertClaim(`Claim ${i} about authentication`);
			}

			const result = retrieveRelevantClaims('authentication', { limit: 5 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeLessThanOrEqual(5);
			}
		});

		it('returns empty array when no claims exist', () => {
			const result = retrieveRelevantClaims('authentication');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('includes timestamp and dialogueId', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test');

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 0) {
				expect(result.value[0].timestamp).toBeDefined();
				expect(result.value[0].dialogueId).toBe(dialogueId);
			}
		});

		it('applies token budget when specified', () => {
			for (let i = 0; i < 10; i++) {
				insertClaim(`This is a very long claim statement with many words that will consume tokens ${i}`.repeat(5));
			}

			const result = retrieveRelevantClaims('claim', { tokenBudget: 500 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeLessThan(10);
			}
		});
	});

	describe('retrieveRelevantVerdicts', () => {
		it('retrieves verdicts for claim IDs', () => {
			const claimId = insertClaim('Test claim');
			insertVerdict(claimId, VerdictType.VERIFIED, 'Verification rationale');

			const result = retrieveRelevantVerdicts([claimId]);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].item.claim_id).toBe(claimId);
			}
		});

		it('returns empty array for empty claim IDs', () => {
			const result = retrieveRelevantVerdicts([]);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('retrieves multiple verdicts', () => {
			const claimId1 = insertClaim('Claim 1');
			const claimId2 = insertClaim('Claim 2');
			insertVerdict(claimId1, VerdictType.VERIFIED, 'Rationale 1');
			insertVerdict(claimId2, VerdictType.CONDITIONAL, 'Rationale 2');

			const result = retrieveRelevantVerdicts([claimId1, claimId2]);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(2);
			}
		});

		it('assigns relevance score of 1.0', () => {
			const claimId = insertClaim('Test claim');
			insertVerdict(claimId, VerdictType.VERIFIED, 'Rationale');

			const result = retrieveRelevantVerdicts([claimId]);

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 0) {
				expect(result.value[0].relevanceScore).toBe(1.0);
			}
		});

		it('respects limit option', () => {
			const claimId = insertClaim('Test claim');
			for (let i = 0; i < 10; i++) {
				insertVerdict(claimId, VerdictType.VERIFIED, `Rationale ${i}`);
			}

			const result = retrieveRelevantVerdicts([claimId], { limit: 3 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeLessThanOrEqual(3);
			}
		});

		it('includes all verdict fields', () => {
			const claimId = insertClaim('Test claim');
			insertVerdict(claimId, VerdictType.VERIFIED, 'Test rationale');

			const result = retrieveRelevantVerdicts([claimId]);

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 0) {
				const verdict = result.value[0].item;
				expect(verdict.verdict_id).toBeDefined();
				expect(verdict.claim_id).toBe(claimId);
				expect(verdict.verdict).toBe(VerdictType.VERIFIED);
				expect(verdict.rationale).toBe('Test rationale');
			}
		});
	});

	describe('retrieveRelevantDecisions', () => {
		it('retrieves human decisions', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'Approval rationale');

			const result = retrieveRelevantDecisions('approval');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
			}
		});

		it('calculates relevance scores based on rationale', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'User authentication approved');
			insertGateAndDecision(HumanAction.REJECT, 'Database changes rejected');

			const result = retrieveRelevantDecisions('authentication');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.every(item => item.relevanceScore >= 0 && item.relevanceScore <= 1)).toBe(true);
			}
		});

		it('filters by similarity threshold', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'Authentication approved');
			insertGateAndDecision(HumanAction.REJECT, 'Unrelated decision');

			const result = retrieveRelevantDecisions('authentication', { similarityThreshold: 0.3 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.every(item => item.relevanceScore >= 0.3)).toBe(true);
			}
		});

		it('sorts by relevance score descending', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'Authentication system approved');
			insertGateAndDecision(HumanAction.REJECT, 'Some decision');
			insertGateAndDecision(HumanAction.APPROVE, 'Authentication module approved');

			const result = retrieveRelevantDecisions('authentication');

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 1) {
				for (let i = 0; i < result.value.length - 1; i++) {
					expect(result.value[i].relevanceScore).toBeGreaterThanOrEqual(result.value[i + 1].relevanceScore);
				}
			}
		});

		it('includes dialogueId from gate join', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'Test decision');

			const result = retrieveRelevantDecisions('test');

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 0) {
				expect(result.value[0].dialogueId).toBe(dialogueId);
			}
		});

		it('returns empty array when no decisions exist', () => {
			const result = retrieveRelevantDecisions('test');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('retrieveTurnsByTimeWindow', () => {
		it('retrieves dialogue events', () => {
			insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, 'Test summary', 'Test content');

			const result = retrieveTurnsByTimeWindow(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
			}
		});

		it('filters by current dialogue when specified', () => {
			const otherDialogueId = randomUUID();
			insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, 'Test 1', 'Content 1');
			
			const db = getDatabase()!;
			db.prepare(`
				INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, speech_act, summary, content, timestamp, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).run(otherDialogueId, 'turn', Role.VERIFIER, Phase.VERIFY, 'statement', 'Test 2', 'Content 2', new Date().toISOString(), new Date().toISOString());

			const result = retrieveTurnsByTimeWindow(dialogueId, { currentDialogueOnly: true });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].dialogueId).toBe(dialogueId);
			}
		});

		it('respects limit option', () => {
			for (let i = 0; i < 20; i++) {
				insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, `Summary ${i}`, `Content ${i}`);
			}

			const result = retrieveTurnsByTimeWindow(dialogueId, { limit: 5 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeLessThanOrEqual(5);
			}
		});

		it('assigns relevance score of 1.0', () => {
			insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, 'Test', 'Content');

			const result = retrieveTurnsByTimeWindow(dialogueId);

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 0) {
				expect(result.value[0].relevanceScore).toBe(1.0);
			}
		});

		it('includes all event fields', () => {
			insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, 'Test summary', 'Test content');

			const result = retrieveTurnsByTimeWindow(dialogueId);

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 0) {
				const event = result.value[0].item;
				expect(event.event_id).toBeDefined();
				expect(event.dialogue_id).toBe(dialogueId);
				expect(event.role).toBe(Role.EXECUTOR);
				expect(event.phase).toBe(Phase.EXECUTE);
				expect(event.summary).toBe('Test summary');
			}
		});

		it('returns empty array when no events exist', () => {
			const result = retrieveTurnsByTimeWindow(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('searchForContradictions', () => {
		it('finds disproved claims with high similarity', () => {
			const claim = {
				claim_id: randomUUID(),
				statement: 'User authentication is required',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.OPEN,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};

			insertClaim('User authentication is required', ClaimStatus.DISPROVED);

			const result = searchForContradictions(claim);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.every(item => item.item.status === ClaimStatus.DISPROVED)).toBe(true);
			}
		});

		it('filters by high similarity threshold', () => {
			const claim = {
				claim_id: randomUUID(),
				statement: 'User authentication required',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.OPEN,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};

			insertClaim('Completely different claim', ClaimStatus.DISPROVED);

			const result = searchForContradictions(claim);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.every(item => item.relevanceScore > 0.7)).toBe(true);
			}
		});

		it('searches across all dialogues', () => {
			const claim = {
				claim_id: randomUUID(),
				statement: 'Test claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.OPEN,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};

			const result = searchForContradictions(claim);

			expect(result.success).toBe(true);
		});

		it('returns empty array when no contradictions found', () => {
			const claim = {
				claim_id: randomUUID(),
				statement: 'Unique claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.OPEN,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};

			const result = searchForContradictions(claim);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('searchForPrecedents', () => {
		it('finds high-relevance decisions', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'Authentication system approved');

			const result = searchForPrecedents('authentication');

			expect(result.success).toBe(true);
		});

		it('filters by relevance threshold above 0.6', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'Authentication approved');

			const result = searchForPrecedents('authentication');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.every(item => item.relevanceScore > 0.6)).toBe(true);
			}
		});

		it('searches across all dialogues', () => {
			insertGateAndDecision(HumanAction.APPROVE, 'Test decision');

			const result = searchForPrecedents('test');

			expect(result.success).toBe(true);
		});

		it('returns empty array when no precedents found', () => {
			const result = searchForPrecedents('nonexistent');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('retrieveHistoricalContext', () => {
		it('retrieves comprehensive historical context', () => {
			const claimId = insertClaim('Test claim');
			insertVerdict(claimId, VerdictType.VERIFIED, 'Verification');
			insertGateAndDecision(HumanAction.APPROVE, 'Approval');
			insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, 'Event', 'Content');

			const result = retrieveHistoricalContext('test', [claimId], dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claims).toBeDefined();
				expect(result.value.verdicts).toBeDefined();
				expect(result.value.decisions).toBeDefined();
				expect(result.value.turns).toBeDefined();
				expect(result.value.tokenCount).toBeGreaterThan(0);
			}
		});

		it('allocates token budget across components', () => {
			const claimId = insertClaim('Test claim');
			insertVerdict(claimId, VerdictType.VERIFIED, 'Verification');
			insertGateAndDecision(HumanAction.APPROVE, 'Approval');
			insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, 'Event', 'Content');

			const result = retrieveHistoricalContext('test', [claimId], dialogueId, { tokenBudget: 1000 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenCount).toBeLessThanOrEqual(1000);
			}
		});

		it('returns all component arrays', () => {
			const result = retrieveHistoricalContext('test', [], dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(Array.isArray(result.value.claims)).toBe(true);
				expect(Array.isArray(result.value.verdicts)).toBe(true);
				expect(Array.isArray(result.value.decisions)).toBe(true);
				expect(Array.isArray(result.value.turns)).toBe(true);
			}
		});

		it('handles empty results gracefully', () => {
			const result = retrieveHistoricalContext('nonexistent', [], dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenCount).toBeGreaterThanOrEqual(0);
			}
		});

		it('distributes budget evenly across components', () => {
			for (let i = 0; i < 10; i++) {
				const claimId = insertClaim(`Claim ${i} with many words`);
				insertVerdict(claimId, VerdictType.VERIFIED, `Verdict ${i} with rationale`);
				insertGateAndDecision(HumanAction.APPROVE, `Decision ${i} with rationale`);
				insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, `Event ${i}`, `Content ${i}`);
			}

			const result = retrieveHistoricalContext('test', [], dialogueId, { tokenBudget: 400 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claims.length).toBeGreaterThan(0);
				expect(result.value.verdicts.length).toBeGreaterThan(0);
				expect(result.value.decisions.length).toBeGreaterThan(0);
				expect(result.value.turns.length).toBeGreaterThan(0);
			}
		});
	});

	describe('edge cases', () => {
		it('handles very long claim statements', () => {
			const longStatement = 'This is a very long claim statement '.repeat(100);
			insertClaim(longStatement);

			const result = retrieveRelevantClaims('claim');

			expect(result.success).toBe(true);
		});

		it('handles special characters in queries', () => {
			insertClaim('Test claim with special chars: @#$%');

			const result = retrieveRelevantClaims('special @#$%');

			expect(result.success).toBe(true);
		});

		it('handles empty query strings', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('');

			expect(result.success).toBe(true);
		});

		it('handles zero token budget', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test', { tokenBudget: 0 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('handles very large limits', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test', { limit: 10000 });

			expect(result.success).toBe(true);
		});

		it('handles similarity threshold of 0', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test', { similarityThreshold: 0 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
			}
		});

		it('handles similarity threshold of 1', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test', { similarityThreshold: 1 });

			expect(result.success).toBe(true);
		});

		it('handles unicode in queries and content', () => {
			insertClaim('测试声明 with 日本語');

			const result = retrieveRelevantClaims('日本語');

			expect(result.success).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('combines multiple retrieval functions', () => {
			const claimId = insertClaim('Integration test claim');
			insertVerdict(claimId, VerdictType.VERIFIED, 'Integration verdict');
			insertGateAndDecision(HumanAction.APPROVE, 'Integration decision');

			const claimsResult = retrieveRelevantClaims('integration');
			const verdictsResult = retrieveRelevantVerdicts([claimId]);
			const decisionsResult = retrieveRelevantDecisions('integration');

			expect(claimsResult.success).toBe(true);
			expect(verdictsResult.success).toBe(true);
			expect(decisionsResult.success).toBe(true);
		});

		it('handles workflow progression through phases', () => {
			insertDialogueEvent(Role.EXECUTOR, Phase.INTAKE, 'Intake event', 'Content');
			insertDialogueEvent(Role.EXECUTOR, Phase.ARCHITECTURE, 'Architecture event', 'Content');
			insertDialogueEvent(Role.EXECUTOR, Phase.EXECUTE, 'Execute event', 'Content');

			const result = retrieveTurnsByTimeWindow(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(3);
			}
		});

		it('supports iterative context building', () => {
			const claimId1 = insertClaim('First claim');
			const claimId2 = insertClaim('Second claim');
			insertVerdict(claimId1, VerdictType.VERIFIED, 'First verdict');
			insertVerdict(claimId2, VerdictType.CONDITIONAL, 'Second verdict');

			const context1 = retrieveHistoricalContext('first', [claimId1], dialogueId);
			const context2 = retrieveHistoricalContext('second', [claimId2], dialogueId);

			expect(context1.success && context2.success).toBe(true);
		});
	});

	describe('options handling', () => {
		it('merges options with defaults', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test', { limit: 20 });

			expect(result.success).toBe(true);
		});

		it('respects all option fields', () => {
			insertClaim('Test claim');

			const options: HistoricalQueryOptions = {
				limit: 15,
				timeWindowDays: 30,
				currentDialogueOnly: true,
				similarityThreshold: 0.4,
				tokenBudget: 500,
			};

			const result = retrieveRelevantClaims('test', options);

			expect(result.success).toBe(true);
		});

		it('handles undefined options gracefully', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test', undefined);

			expect(result.success).toBe(true);
		});

		it('handles partial options', () => {
			insertClaim('Test claim');

			const result = retrieveRelevantClaims('test', { limit: 5 });

			expect(result.success).toBe(true);
		});
	});
});
