/**
 * Scenario: Export History
 * Tests that exportDialogueMarkdown produces valid markdown
 * containing the dialogue ID, phase, and claims.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../helpers/fakeLogger';
import { exportDialogueMarkdown } from '../../lib/export/streamExporter';
import { Phase, ClaimStatus, GateStatus } from '../../lib/types';
import type { GovernedStreamState } from '../../lib/ui/governedStream/dataAggregator';

describe('Scenario: Export History', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	it('produces markdown with dialogue ID and phase', () => {
		const dialogueId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
		const state: GovernedStreamState = {
			activeDialogueId: dialogueId,
			sessionId: null,
			currentPhase: Phase.REVIEW,
			workflowState: null,
			streamItems: [],
			claims: [
				{
					claim_id: 'claim-001',
					statement: 'Database supports transactions',
					introduced_by: 'EXECUTOR' as any,
					criticality: 'CRITICAL' as any,
					status: ClaimStatus.VERIFIED,
					dialogue_id: dialogueId,
					turn_id: 1,
					created_at: new Date().toISOString(),
				},
			],
			claimHealth: {
				total: 1,
				verified: 1,
				disproved: 0,
				unknown: 0,
				conditional: 0,
				open: 0,
			},
			openGates: [],
			phases: [Phase.INTAKE, Phase.PROPOSE, Phase.ASSUMPTION_SURFACING, Phase.VERIFY, Phase.REVIEW],
			dialogueList: [],
			intakeState: null,
			humanFacingState: null,
		};

		const markdown = exportDialogueMarkdown(dialogueId, state);

		// YAML frontmatter
		expect(markdown).toContain('dialogue_id: ' + dialogueId);
		// Phase
		expect(markdown).toContain(Phase.REVIEW);
		// Claim
		expect(markdown).toContain('Database supports transactions');
	});
});
