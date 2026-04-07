import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	aggregateStreamState,
	computeClaimHealth,
	synthesizeReviewMMP,
	WORKFLOW_PHASES,
	type ReviewItem,
	type ReviewSummary,
} from '../../../lib/ui/governedStream/dataAggregator';
import { ClaimStatus, Phase, GateStatus } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';
import { initializeWorkflowState } from '../../../lib/workflow/stateMachine';
import { writeDialogueEvent } from '../../../lib/events/writer';

describe('dataAggregator', () => {
	let tempDb: TempDbContext;
	const DLG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(DLG_ID);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('WORKFLOW_PHASES', () => {
		it('exports ordered list of workflow phases', () => {
			expect(WORKFLOW_PHASES).toEqual([
				Phase.INTAKE,
				Phase.ARCHITECTURE,
				Phase.PROPOSE,
				Phase.ASSUMPTION_SURFACING,
				Phase.VERIFY,
				Phase.HISTORICAL_CHECK,
				Phase.REVIEW,
				Phase.EXECUTE,
				Phase.VALIDATE,
				Phase.COMMIT,
			]);
		});
	});

	describe('computeClaimHealth', () => {
		it('returns zero summary for empty claims array', () => {
			const result = computeClaimHealth([]);
			expect(result).toEqual({
				open: 0,
				verified: 0,
				disproved: 0,
				unknown: 0,
				conditional: 0,
				total: 0,
			});
		});

		it('counts claims by status correctly', () => {
			const claims = [
				{ claim_id: '1', status: ClaimStatus.OPEN } as any,
				{ claim_id: '2', status: ClaimStatus.VERIFIED } as any,
				{ claim_id: '3', status: ClaimStatus.VERIFIED } as any,
				{ claim_id: '4', status: ClaimStatus.DISPROVED } as any,
				{ claim_id: '5', status: ClaimStatus.UNKNOWN } as any,
				{ claim_id: '6', status: ClaimStatus.CONDITIONAL } as any,
			];

			const result = computeClaimHealth(claims);
			expect(result).toEqual({
				open: 1,
				verified: 2,
				disproved: 1,
				unknown: 1,
				conditional: 1,
				total: 6,
			});
		});

		it('handles all claims of same status', () => {
			const claims = [
				{ claim_id: '1', status: ClaimStatus.VERIFIED } as any,
				{ claim_id: '2', status: ClaimStatus.VERIFIED } as any,
				{ claim_id: '3', status: ClaimStatus.VERIFIED } as any,
			];

			const result = computeClaimHealth(claims);
			expect(result.verified).toBe(3);
			expect(result.total).toBe(3);
			expect(result.open).toBe(0);
		});
	});

	describe('aggregateStreamState', () => {
		it('returns empty state when no dialogue exists', () => {
			const db = getDatabase()!;
			db.prepare('DELETE FROM dialogues').run();

			const result = aggregateStreamState();
			expect(result.activeDialogueId).toBeNull();
			expect(result.currentPhase).toBe(Phase.INTAKE);
			expect(result.streamItems).toEqual([]);
			expect(result.claims).toEqual([]);
			expect(result.claimHealth.total).toBe(0);
		});

		it('aggregates state for single active dialogue', () => {
			initializeWorkflowState(DLG_ID);

			const result = aggregateStreamState(DLG_ID);
			expect(result.activeDialogueId).toBe(DLG_ID);
			expect(result.sessionId).toBe(DLG_ID);
			expect(result.currentPhase).toBe(Phase.INTAKE);
			expect(result.phases).toEqual(WORKFLOW_PHASES);
		});

		it('includes dialogue in dialogueList', () => {
			initializeWorkflowState(DLG_ID);

			const result = aggregateStreamState(DLG_ID);
			expect(result.dialogueList).toHaveLength(1);
			expect(result.dialogueList[0].dialogueId).toBe(DLG_ID);
			expect(result.dialogueList[0].goal).toBe('test goal');
			expect(result.dialogueList[0].status).toBe('ACTIVE');
		});

		it('builds stream items from dialogue events', () => {
			initializeWorkflowState(DLG_ID);
			writeDialogueEvent({
				dialogue_id: DLG_ID,
				event_type: 'human_message',
				phase: Phase.INTAKE,
				role: 'user',
				speech_act: 'inform',
				content: 'Hello',
				summary: 'Hello',
				detail: null,
			});

			const result = aggregateStreamState(DLG_ID);
			expect(result.streamItems.length).toBeGreaterThan(0);
			const humanMsg = result.streamItems.find((i) => i.type === 'human_message');
			expect(humanMsg).toBeDefined();
			if (humanMsg?.type === 'human_message') {
				expect(humanMsg.text).toBe('Hello');
			}
		});

		it('includes milestone for phase changes', () => {
			initializeWorkflowState(DLG_ID);
			writeDialogueEvent({
				dialogue_id: DLG_ID,
				event_type: 'human_message',
				phase: Phase.INTAKE,
				role: 'user',
				speech_act: 'inform',
				content: 'First',
				summary: 'First',
				detail: null,
			});

			const result = aggregateStreamState(DLG_ID);
			const milestone = result.streamItems.find((i) => i.type === 'milestone');
			expect(milestone).toBeDefined();
			if (milestone?.type === 'milestone') {
				expect(milestone.phase).toBe(Phase.INTAKE);
			}
		});

		it('computes claim health from active dialogue claims', () => {
			initializeWorkflowState(DLG_ID);
			const db = getDatabase()!;
			db.prepare(
				`INSERT INTO claims (claim_id, dialogue_id, turn_id, statement, status, criticality, created_at)
				VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
			).run('claim1', DLG_ID, 1, 'Test claim', ClaimStatus.VERIFIED, 'CRITICAL');

			const result = aggregateStreamState(DLG_ID);
			expect(result.claimHealth.verified).toBe(1);
			expect(result.claimHealth.total).toBe(1);
		});

		it('identifies open gates for active dialogue', () => {
			initializeWorkflowState(DLG_ID);
			const db = getDatabase()!;
			db.prepare(
				`INSERT INTO gates (gate_id, dialogue_id, gate_type, message, status, blocking_claims, created_at)
				VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
			).run('gate1', DLG_ID, 'HUMAN_DECISION', 'Test gate', GateStatus.OPEN, '[]');

			const result = aggregateStreamState(DLG_ID);
			expect(result.openGates).toHaveLength(1);
			expect(result.openGates[0].gate_id).toBe('gate1');
		});

		it('builds intake state when in INTAKE phase', () => {
			initializeWorkflowState(DLG_ID);
			const db = getDatabase()!;
			db.prepare(
				`INSERT INTO intake_conversations (dialogue_id, sub_state, turn_count, created_at, updated_at)
				VALUES (?, ?, ?, datetime('now'), datetime('now'))`
			).run(DLG_ID, 'DISCUSSING', 1);

			const result = aggregateStreamState(DLG_ID);
			expect(result.intakeState).not.toBeNull();
			expect(result.intakeState?.subState).toBe('DISCUSSING');
			expect(result.intakeState?.turnCount).toBe(1);
		});

		it('returns null intake state when not in INTAKE phase', () => {
			const db = getDatabase()!;
			db.prepare(
				`INSERT INTO workflow_states (dialogue_id, current_phase, metadata, created_at, updated_at)
				VALUES (?, ?, ?, datetime('now'), datetime('now'))`
			).run(DLG_ID, Phase.PROPOSE, '{}');

			const result = aggregateStreamState(DLG_ID);
			expect(result.intakeState).toBeNull();
		});
	});

	describe('aggregateStreamState - multi-dialogue', () => {
		it('aggregates streams from multiple dialogues', () => {
			const DLG_ID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'goal 2', 'ACTIVE', datetime('now'))"
			).run(DLG_ID_2);

			initializeWorkflowState(DLG_ID);
			initializeWorkflowState(DLG_ID_2);

			const result = aggregateStreamState();
			expect(result.dialogueList).toHaveLength(2);
		});

		it('includes boundary markers for multiple dialogues', () => {
			const DLG_ID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'goal 2', 'COMPLETED', datetime('now'))"
			).run(DLG_ID_2);

			initializeWorkflowState(DLG_ID);
			initializeWorkflowState(DLG_ID_2);

			const result = aggregateStreamState();
			const starts = result.streamItems.filter((i) => i.type === 'dialogue_start');
			const ends = result.streamItems.filter((i) => i.type === 'dialogue_end');
			expect(starts.length).toBeGreaterThanOrEqual(1);
			expect(ends).toHaveLength(1); // Only completed dialogues get end markers
		});
	});

	describe('synthesizeReviewMMP', () => {
		it('returns undefined when no review items', () => {
			const result = synthesizeReviewMMP([], {
				verified: 0,
				disproved: 0,
				unknown: 0,
				conditional: 0,
				open: 0,
				historianFindings: 0,
				needsDecisionCount: 0,
				awarenessCount: 0,
				allClearCount: 0,
				adjudicationAvailable: false,
				consistent: 0,
				inconsistent: 0,
				adjConditional: 0,
				adjUnknown: 0,
			}, []);

			expect(result).toBeUndefined();
		});

		it('creates mirror items for all_clear claims', () => {
			const items: ReviewItem[] = [
				{
					kind: 'claim',
					claim: { claim_id: 'c1', statement: 'Safe claim', status: ClaimStatus.VERIFIED } as any,
					verdict: { verdict: 'VERIFIED', rationale: 'All good' } as any,
					category: 'all_clear',
					categoryReason: 'Verified successfully',
				},
			];

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.mirror).toBeDefined();
			expect(result?.mirror?.items).toHaveLength(1);
			expect(result?.mirror?.items[0].text).toBe('Safe claim');
			expect(result?.mirror?.items[0].status).toBe('accepted');
		});

		it('creates menu items for awareness claims', () => {
			const items: ReviewItem[] = [
				{
					kind: 'claim',
					claim: { claim_id: 'c1', statement: 'Conditional claim', status: ClaimStatus.CONDITIONAL } as any,
					category: 'awareness',
					categoryReason: 'Conditional verdict',
				},
			];

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.menu).toBeDefined();
			expect(result?.menu?.items).toHaveLength(1);
			expect(result?.menu?.items[0].question).toBe('Conditional claim');
			expect(result?.menu?.items[0].options).toHaveLength(3);
			expect(result?.menu?.items[0].options[0].label).toBe('Accept as-is');
		});

		it('creates pre-mortem items for needs_decision claims', () => {
			const items: ReviewItem[] = [
				{
					kind: 'claim',
					claim: { claim_id: 'c1', statement: 'Critical claim', status: ClaimStatus.DISPROVED, criticality: 'CRITICAL' } as any,
					category: 'needs_decision',
					categoryReason: 'CRITICAL claim with DISPROVED verdict',
				},
			];

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.preMortem).toBeDefined();
			expect(result?.preMortem?.items).toHaveLength(1);
			expect(result?.preMortem?.items[0].assumption).toBe('Critical claim');
			expect(result?.preMortem?.items[0].severity).toBe('critical');
		});

		it('handles novel dependency claims as needs_decision', () => {
			const items: ReviewItem[] = [
				{
					kind: 'claim',
					claim: { claim_id: 'c1', statement: 'Uses new library', status: ClaimStatus.VERIFIED } as any,
					verdict: { verdict: 'VERIFIED', novel_dependency: true } as any,
					category: 'needs_decision',
					categoryReason: 'Verified — but introduces a new dependency',
				},
			];

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.preMortem).toBeDefined();
			expect(result?.preMortem?.items).toHaveLength(1);
			expect(result?.preMortem?.items[0].severity).toBe('medium');
			expect(result?.preMortem?.items[0].failureScenario).toContain('New dependency');
		});

		it('adds historian findings as pre-mortem items', () => {
			const findings = ['Finding 1', 'Finding 2'];
			const result = synthesizeReviewMMP([], {} as ReviewSummary, findings);

			expect(result?.preMortem).toBeDefined();
			expect(result?.preMortem?.items).toHaveLength(2);
			expect(result?.preMortem?.items[0].assumption).toBe('Finding 1');
			expect(result?.preMortem?.items[1].assumption).toBe('Finding 2');
		});

		it('combines all three sections when multiple item types present', () => {
			const items: ReviewItem[] = [
				{
					kind: 'claim',
					claim: { claim_id: 'c1', statement: 'Verified claim', status: ClaimStatus.VERIFIED } as any,
					category: 'all_clear',
					categoryReason: 'OK',
				},
				{
					kind: 'claim',
					claim: { claim_id: 'c2', statement: 'Conditional claim', status: ClaimStatus.CONDITIONAL } as any,
					category: 'awareness',
					categoryReason: 'Check',
				},
				{
					kind: 'claim',
					claim: { claim_id: 'c3', statement: 'Critical claim', status: ClaimStatus.DISPROVED } as any,
					category: 'needs_decision',
					categoryReason: 'Critical',
				},
			];

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.mirror).toBeDefined();
			expect(result?.menu).toBeDefined();
			expect(result?.preMortem).toBeDefined();
		});

		it('caps mirror items at 10', () => {
			const items: ReviewItem[] = Array.from({ length: 15 }, (_, i) => ({
				kind: 'claim' as const,
				claim: { claim_id: `c${i}`, statement: `Claim ${i}`, status: ClaimStatus.VERIFIED } as any,
				category: 'all_clear' as const,
				categoryReason: 'OK',
			}));

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.mirror?.items).toHaveLength(10);
		});

		it('caps menu items at 5', () => {
			const items: ReviewItem[] = Array.from({ length: 8 }, (_, i) => ({
				kind: 'claim' as const,
				claim: { claim_id: `c${i}`, statement: `Claim ${i}`, status: ClaimStatus.CONDITIONAL } as any,
				category: 'awareness' as const,
				categoryReason: 'Check',
			}));

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.menu?.items).toHaveLength(5);
		});

		it('handles findings without claim objects', () => {
			const items: ReviewItem[] = [
				{
					kind: 'finding',
					findingText: 'Historical issue found',
					findingIndex: 0,
					category: 'needs_decision',
					categoryReason: 'High-severity finding',
				},
			];

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.preMortem).toBeDefined();
			expect(result?.preMortem?.items[0].assumption).toBe('Historical issue found');
		});
	});

	describe('stream item ordering and timestamps', () => {
		it('orders events chronologically', () => {
			initializeWorkflowState(DLG_ID);
			writeDialogueEvent({
				dialogue_id: DLG_ID,
				event_type: 'human_message',
				phase: Phase.INTAKE,
				role: 'user',
				speech_act: 'inform',
				content: 'First',
				summary: 'First',
				detail: null,
			});
			writeDialogueEvent({
				dialogue_id: DLG_ID,
				event_type: 'human_message',
				phase: Phase.INTAKE,
				role: 'user',
				speech_act: 'inform',
				content: 'Second',
				summary: 'Second',
				detail: null,
			});

			const result = aggregateStreamState(DLG_ID);
			const humanMsgs = result.streamItems.filter((i) => i.type === 'human_message');
			expect(humanMsgs).toHaveLength(2);
			if (humanMsgs[0].type === 'human_message' && humanMsgs[1].type === 'human_message') {
				expect(humanMsgs[0].text).toBe('First');
				expect(humanMsgs[1].text).toBe('Second');
			}
		});

		it('filters out legacy event types', () => {
			initializeWorkflowState(DLG_ID);
			const db = getDatabase()!;
			db.prepare(
				`INSERT INTO dialogue_events (dialogue_id, turn_id, event_type, phase, role, content, summary, timestamp)
				VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
			).run(DLG_ID, 1, 'legacy', Phase.INTAKE, 'system', 'Legacy content', 'Legacy');

			const result = aggregateStreamState(DLG_ID);
			const legacy = result.streamItems.find((i: any) => i.turn?.event_type === 'legacy');
			expect(legacy).toBeUndefined();
		});

		it('skips MMP decision submissions from human_message items', () => {
			initializeWorkflowState(DLG_ID);
			writeDialogueEvent({
				dialogue_id: DLG_ID,
				event_type: 'human_message',
				phase: Phase.INTAKE,
				role: 'user',
				speech_act: 'inform',
				content: '[MMP Decisions] System-generated context',
				summary: '[MMP Decisions] ...',
				detail: null,
			});

			const result = aggregateStreamState(DLG_ID);
			const mmpMsg = result.streamItems.find(
				(i) => i.type === 'human_message' && (i as any).text?.startsWith('[MMP Decisions]')
			);
			expect(mmpMsg).toBeUndefined();
		});
	});

	describe('edge cases and error handling', () => {
		it('handles missing workflow state gracefully', () => {
			const result = aggregateStreamState(DLG_ID);
			expect(result.workflowState).toBeNull();
			expect(result.currentPhase).toBe(Phase.INTAKE);
		});

		it('handles dialogue with no events', () => {
			initializeWorkflowState(DLG_ID);
			const result = aggregateStreamState(DLG_ID);
			expect(result.streamItems.length).toBeGreaterThanOrEqual(0);
		});

		it('handles malformed timestamps gracefully', () => {
			initializeWorkflowState(DLG_ID);
			const db = getDatabase()!;
			db.prepare(
				`INSERT INTO dialogue_events (dialogue_id, turn_id, event_type, phase, role, content, summary, timestamp)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			).run(DLG_ID, 1, 'human_message', Phase.INTAKE, 'user', 'Test', 'Test', '');

			const result = aggregateStreamState(DLG_ID);
			expect(result).toBeDefined();
		});

		it('handles empty claim array in computeClaimHealth', () => {
			const result = computeClaimHealth([]);
			expect(result.total).toBe(0);
			expect(result.open).toBe(0);
		});

		it('handles missing verdict in synthesizeReviewMMP', () => {
			const items: ReviewItem[] = [
				{
					kind: 'claim',
					claim: { claim_id: 'c1', statement: 'No verdict', status: ClaimStatus.OPEN } as any,
					category: 'awareness',
					categoryReason: 'Missing verdict',
				},
			];

			const result = synthesizeReviewMMP(items, {} as ReviewSummary, []);
			expect(result?.menu).toBeDefined();
		});
	});
});
