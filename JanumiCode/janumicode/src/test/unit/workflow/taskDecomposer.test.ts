import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { decomposeGoalIntoTaskGraph } from '../../../lib/workflow/taskDecomposer';
import { createDialogueRecord } from '../../../lib/dialogue/lifecycle';
import { createIntentRecord } from '../../../lib/database/makerStore';
import type { IntentRecord, AcceptanceContract } from '../../../lib/types/maker';
import { RiskPosture, ValidationType } from '../../../lib/types/maker';
import type { RoleCLIProvider } from '../../../lib/cli/roleCLIProvider';
import type { Result } from '../../../lib/types';
import type { RoleCLIResult } from '../../../lib/cli/types';
import { randomUUID } from 'node:crypto';

// ─── Canonical fixture builders ──────────────────────────────────────

function makeStreamResult(jsonBody: string, exitCode = 0): Result<RoleCLIResult> {
	return {
		success: true,
		value: {
			response: jsonBody,
			exitCode,
			executionTime: 100,
			rawOutput: jsonBody,
		},
	};
}

function makeStreamFailure(message = 'Provider error'): Result<RoleCLIResult> {
	return {
		success: false,
		error: new Error(message),
	};
}

function makeUnit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		temp_id: 'u1',
		label: 'Test unit',
		goal: 'Test goal',
		category: 'IMPLEMENTATION',
		inputs: [],
		outputs: [],
		preconditions: [],
		postconditions: [],
		allowed_tools: [],
		preferred_provider: null,
		max_change_scope: '.',
		observables: ['Test observable'],
		falsifiers: ['Test fails'],
		verification_method: 'test',
		...overrides,
	};
}

/**
 * Build N minimum-quality units. The decomposition quality check rejects fewer
 * than 3 units (TASK_GRAPH_LIMITS.reject_below_for_nontrivial), so success-path
 * tests need at least 3 valid units.
 */
function makeMinQualityUnits(): Record<string, unknown>[] {
	return [
		makeUnit({ temp_id: 'u1', label: 'Unit 1', goal: 'First step' }),
		makeUnit({ temp_id: 'u2', label: 'Unit 2', goal: 'Second step' }),
		makeUnit({ temp_id: 'u3', label: 'Unit 3', goal: 'Third step' }),
	];
}

describe('TaskDecomposer', () => {
	let tempDb: TempDbContext;
	let mockProvider: RoleCLIProvider;
	let intentRecord: IntentRecord;
	let contract: AcceptanceContract;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();

		const dialogueId = randomUUID();
		// task_graphs has FKs to dialogues.dialogue_id and intent_records.intent_id —
		// both parent rows must exist before decomposeGoalIntoTaskGraph runs.
		createDialogueRecord(dialogueId, 'Test goal');
		const intentResult = createIntentRecord(dialogueId, 'Implement user authentication', {
			scope_in: ['auth system', 'login flow'],
			scope_out: ['admin panel'],
			priority_axes: ['security', 'usability'],
			risk_posture: RiskPosture.BALANCED,
			clarifications_resolved: [],
		});
		if (!intentResult.success) {
			throw new Error(`Failed to seed intent record: ${intentResult.error.message}`);
		}
		intentRecord = intentResult.value;

		contract = {
			contract_id: randomUUID(),
			intent_id: intentRecord.intent_id,
			dialogue_id: dialogueId,
			success_conditions: ['Users can log in', 'Passwords are hashed'],
			required_validations: [
				{
					type: ValidationType.UNIT_TEST,
					description: 'Auth tests pass',
					command: 'npm test auth',
					expected_exit_code: 0,
				},
			],
			non_goals: ['OAuth integration', 'Social login'],
			human_judgment_required: [],
			created_at: new Date().toISOString(),
		};

		mockProvider = {
			id: 'mock-provider',
			name: 'mock-provider',
			detect: vi.fn(),
			invoke: vi.fn(),
			invokeStreaming: vi.fn(),
			getCommandPreview: vi.fn(),
		};
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('decomposeGoalIntoTaskGraph', () => {
		it('successfully decomposes goal into task graph', async () => {
			const responseBody = JSON.stringify({
				units: [
					makeUnit({
						temp_id: 'u1',
						label: 'Create auth schema',
						goal: 'Create database schema for users',
						category: 'SCAFFOLD',
						outputs: ['users table'],
						postconditions: ['Database has users table'],
						allowed_tools: ['file_write', 'bash'],
						max_change_scope: 'src/db/',
						observables: ['Migration file exists'],
						falsifiers: ['Migration fails to run'],
						verification_method: 'Run migrations',
					}),
					makeUnit({ temp_id: 'u2', label: 'Implement login', goal: 'Build the login endpoint' }),
					makeUnit({ temp_id: 'u3', label: 'Hash passwords', goal: 'Add bcrypt hashing' }),
				],
				edges: [],
			});

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamResult(responseBody));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'Historical context',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				2
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.units.length).toBeGreaterThan(0);
				expect(result.value.graph).toBeDefined();
				expect(result.value.edges).toBeDefined();
			}
		});

		it('handles JSON wrapped in markdown code blocks', async () => {
			const responseBody = '```json\n' + JSON.stringify({
				units: makeMinQualityUnits(),
				edges: [],
			}) + '\n```';

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamResult(responseBody));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				1
			);

			expect(result.success).toBe(true);
		});

		it('retries on parse failure', async () => {
			const validResponse = JSON.stringify({
				units: makeMinQualityUnits(),
				edges: [],
			});

			vi.mocked(mockProvider.invokeStreaming)
				.mockResolvedValueOnce(makeStreamResult('Invalid JSON'))
				.mockResolvedValueOnce(makeStreamResult(validResponse));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				2
			);

			expect(result.success).toBe(true);
			expect(mockProvider.invokeStreaming).toHaveBeenCalledTimes(2);
		});

		it('fails after max attempts', async () => {
			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamResult('Invalid JSON'));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				2
			);

			expect(result.success).toBe(false);
			expect(mockProvider.invokeStreaming).toHaveBeenCalledTimes(2);
		});

		it('handles provider invocation failure', async () => {
			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamFailure('Provider error'));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				1
			);

			expect(result.success).toBe(false);
		});

		it('handles missing units array', async () => {
			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(
				makeStreamResult(JSON.stringify({ edges: [] }))
			);

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				2
			);

			expect(result.success).toBe(false);
		});

		it('handles empty units array', async () => {
			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(
				makeStreamResult(JSON.stringify({ units: [], edges: [] }))
			);

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				2
			);

			expect(result.success).toBe(false);
		});

		it('normalizes missing fields in units', async () => {
			// LLM returns 3 units with only the minimum fields the quality check requires
			// (label, observables, falsifiers). The decomposer should default the rest:
			// temp_id, category=IMPLEMENTATION, max_change_scope='.', etc.
			const responseBody = JSON.stringify({
				units: [
					{ label: 'Minimal unit 1', observables: ['obs1'], falsifiers: ['f1'] },
					{ label: 'Minimal unit 2', observables: ['obs2'], falsifiers: ['f2'] },
					{ label: 'Minimal unit 3', observables: ['obs3'], falsifiers: ['f3'] },
				],
				edges: [],
			});

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamResult(responseBody));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				1
			);

			expect(result.success).toBe(true);
			if (result.success) {
				// After normalization, units have unit_id (not temp_id)
				expect(result.value.units[0].unit_id).toBeDefined();
				expect(result.value.units[0].category).toBe('IMPLEMENTATION');
				expect(result.value.units[0].max_change_scope).toBe('.');
			}
		});

		it('includes architecture document in prompt when provided', async () => {
			const architectureDoc = {
				doc_id: randomUUID(),
				dialogue_id: intentRecord.dialogue_id,
				version: 1,
				implementation_sequence: [
					{
						step_id: 'step-1',
						label: 'Setup database',
						description: 'Create schema',
						dependencies: [],
						components_involved: ['db'],
						estimated_complexity: 'medium',
						verification_method: 'Run migrations',
					},
				],
				components: [
					{
						component_id: 'comp-1',
						label: 'Auth Service',
						responsibility: 'Handle authentication',
						file_scope: 'src/auth/',
						interfaces: [],
						dependencies: [],
					},
				],
				data_models: [],
				interfaces: [],
				capabilities: [],
				workflow_graph: [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			} as never;

			const responseBody = JSON.stringify({
				units: makeMinQualityUnits().map(u => ({ ...u, max_change_scope: 'src/auth/' })),
				edges: [],
			});

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamResult(responseBody));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				{ maxAttempts: 1, architectureDoc } as never
			);

			expect(result.success).toBe(true);
			const invokeCalls = vi.mocked(mockProvider.invokeStreaming).mock.calls;
			expect(invokeCalls.length).toBeGreaterThan(0);
		});

		it('calls onEvent callback during invocation', async () => {
			const responseBody = JSON.stringify({
				units: makeMinQualityUnits(),
				edges: [],
			});

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamResult(responseBody));

			const onEvent = vi.fn();

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				1,
				onEvent
			);

			expect(result.success).toBe(true);
		});

		it('creates edges between units', async () => {
			const responseBody = JSON.stringify({
				units: [
					makeUnit({
						temp_id: 'u1',
						label: 'Unit 1',
						goal: 'First unit',
						category: 'SCAFFOLD',
						outputs: ['schema'],
					}),
					makeUnit({
						temp_id: 'u2',
						label: 'Unit 2',
						goal: 'Second unit',
						category: 'IMPLEMENTATION',
						inputs: ['schema'],
					}),
					makeUnit({
						temp_id: 'u3',
						label: 'Unit 3',
						goal: 'Third unit',
						category: 'TEST',
					}),
				],
				edges: [
					{
						from_temp_id: 'u1',
						to_temp_id: 'u2',
						edge_type: 'DEPENDS_ON',
					},
				],
			});

			vi.mocked(mockProvider.invokeStreaming).mockResolvedValue(makeStreamResult(responseBody));

			const result = await decomposeGoalIntoTaskGraph(
				intentRecord,
				contract,
				'',
				intentRecord.dialogue_id,
				mockProvider,
				'/workspace',
				1
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.edges.length).toBe(1);
				expect(result.value.edges[0].edge_type).toBe('DEPENDS_ON');
			}
		});
	});
});
