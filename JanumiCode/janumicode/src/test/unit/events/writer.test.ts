import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { writeDialogueTurn, writeClaim, writeVerdict } from '../../../lib/events/writer';
import { Role, Phase, SpeechAct, ClaimStatus, ClaimCriticality, VerdictType } from '../../../lib/types';
import { getDatabase } from '../../../lib/database/init';

describe('Event Writer', () => {
	let tempDb: TempDbContext;

	// UUID-format ID (36 chars) required by CHECK constraint
	const DLG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		// Create a dialogue record for FK constraints
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(DLG_ID);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('writes a dialogue turn with auto-generated turn_id and timestamp', () => {
		const result = writeDialogueTurn({
			dialogue_id: DLG_ID,
			role: Role.EXECUTOR,
			phase: Phase.PROPOSE,
			speech_act: SpeechAct.CLAIM,
			content_ref: 'test proposal content',
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.dialogue_id).toBe(DLG_ID);
			expect(result.value.role).toBe(Role.EXECUTOR);
			expect(result.value.phase).toBe(Phase.PROPOSE);
			expect(result.value.turn_id).toBeGreaterThan(0);
			expect(result.value.timestamp).toBeTruthy();
		}
	});

	it('writes a claim and auto-generates claim_id', () => {
		// A dialogue turn must exist for the FK constraint on claims
		const turnResult = writeDialogueTurn({
			dialogue_id: DLG_ID,
			role: Role.EXECUTOR,
			phase: Phase.PROPOSE,
			speech_act: SpeechAct.CLAIM,
			content_ref: 'setup turn',
		});
		expect(turnResult.success).toBe(true);
		if (!turnResult.success) { return; }

		const result = writeClaim({
			dialogue_id: DLG_ID,
			statement: 'The database supports concurrent writes',
			introduced_by: Role.EXECUTOR,
			criticality: ClaimCriticality.CRITICAL,
			status: ClaimStatus.OPEN,
			turn_id: turnResult.value.turn_id,
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.claim_id).toBeTruthy();
			expect(result.value.statement).toBe('The database supports concurrent writes');
			expect(result.value.criticality).toBe(ClaimCriticality.CRITICAL);
			expect(result.value.status).toBe(ClaimStatus.OPEN);
		}
	});

	it('writes a verdict and returns the created record', () => {
		// A dialogue turn must exist for the FK constraint on claims
		const turnResult = writeDialogueTurn({
			dialogue_id: DLG_ID,
			role: Role.EXECUTOR,
			phase: Phase.PROPOSE,
			speech_act: SpeechAct.CLAIM,
			content_ref: 'setup turn',
		});
		expect(turnResult.success).toBe(true);
		if (!turnResult.success) { return; }

		// Create a claim to reference
		const claimResult = writeClaim({
			dialogue_id: DLG_ID,
			statement: 'TypeScript is configured',
			introduced_by: Role.EXECUTOR,
			criticality: ClaimCriticality.NON_CRITICAL,
			status: ClaimStatus.OPEN,
			turn_id: turnResult.value.turn_id,
		});
		expect(claimResult.success).toBe(true);
		if (!claimResult.success) { return; }

		const verdictResult = writeVerdict({
			claim_id: claimResult.value.claim_id,
			verdict: VerdictType.VERIFIED,
			constraints_ref: null,
			evidence_ref: null,
			rationale: 'tsconfig.json found in workspace root',
		});
		expect(verdictResult.success).toBe(true);
		if (verdictResult.success) {
			expect(verdictResult.value.verdict).toBe(VerdictType.VERIFIED);
			expect(verdictResult.value.rationale).toBe('tsconfig.json found in workspace root');
		}
	});
});
