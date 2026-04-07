import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	adoptCachedOutput,
	extractJsonFromRawOutput,
} from '../../../lib/workflow/outputAdopter';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/database/init';

describe('OutputAdopter', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();

		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(dialogueId);

		db.prepare(
			`INSERT INTO workflow_state (dialogue_id, current_phase, metadata, created_at, updated_at)
			 VALUES (?, 'INTAKE', '{}', datetime('now'), datetime('now'))`
		).run(dialogueId);

		db.prepare(
			`INSERT INTO intake_conversations (conv_id, dialogue_id, turn_count, created_at)
			 VALUES (?, ?, 0, datetime('now'))`
		).run(randomUUID(), dialogueId);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('extractJsonFromRawOutput', () => {
		it('parses direct JSON', () => {
			const raw = '{"key": "value", "number": 42}';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.key).toBe('value');
				expect(result.value.number).toBe(42);
			}
		});

		it('extracts JSON from markdown code fence', () => {
			const raw = '```json\n{"key": "value"}\n```';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.key).toBe('value');
			}
		});

		it('extracts JSON from code fence without json label', () => {
			const raw = '```\n{"key": "value"}\n```';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.key).toBe('value');
			}
		});

		it('extracts JSON surrounded by prose', () => {
			const raw = 'Here is the result:\n{"key": "value"}\nThat was it.';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.key).toBe('value');
			}
		});

		it('finds JSON with balanced braces', () => {
			const raw = 'Preamble text\n{"outer": {"inner": "value"}}\nTrailing text';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.outer).toBeDefined();
			}
		});

		it('extracts from JSONL stream (last complete object)', () => {
			const raw = '{"partial": true}\n{"complete": true, "count": 5}\n{"incomplete":';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.complete).toBe(true);
				expect(result.value.count).toBe(5);
			}
		});

		it('skips small objects in JSONL', () => {
			const raw = '{"a": 1}\n{"b": 2}\n{"full": "object", "with": "many", "fields": true}';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.full).toBe('object');
			}
		});

		it('handles whitespace variations', () => {
			const raw = '  \n  {"key": "value"}  \n  ';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.key).toBe('value');
			}
		});

		it('returns error for empty string', () => {
			const result = extractJsonFromRawOutput('');
			expect(result.success).toBe(false);
		});

		it('returns error for non-JSON content', () => {
			const raw = 'This is just plain text without JSON';
			const result = extractJsonFromRawOutput(raw);
			expect(result.success).toBe(false);
		});

		it('returns error for truncated JSON', () => {
			const raw = '{"incomplete": "object", "missing":';
			const result = extractJsonFromRawOutput(raw);
			expect(result.success).toBe(false);
		});

		it('handles JSON with special characters', () => {
			const raw = String.raw`{"text": "Hello\nWorld", "escaped": "\"quoted\""}`;
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.text).toBeDefined();
			}
		});

		it('prefers fence over surrounding JSON', () => {
			const raw = '{"outer": 1}\n```json\n{"inner": 2}\n```';
			const result = extractJsonFromRawOutput(raw);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.inner).toBe(2);
			}
		});
	});

	describe('adoptCachedOutput', () => {
		describe('error handling', () => {
			it('returns error when no cached output', async () => {
				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('No cached CLI output');
				}
			});

			it('returns error when cached output is too short', async () => {
				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: 'short' }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(false);
			});

			it('returns error when JSON extraction fails', async () => {
				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: 'This is not JSON at all and quite long' }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('extract JSON');
				}
			});

			it('returns error for unsupported phase', async () => {
				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET current_phase = 'EXECUTE', metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: '{"data": "value"}' }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('not supported');
				}
			});

			it('handles database errors', async () => {
				tempDb.cleanup();
				const result = await adoptCachedOutput(dialogueId);
				expect(result.success).toBe(false);
			});
		});

		describe('intake phase adoption', () => {
			it('adopts conversational response', async () => {
				const output = {
					conversationalResponse: 'This is a response',
					updatedPlan: { title: 'Test Plan' },
					suggestedQuestions: ['Q1', 'Q2'],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.phase).toBe('INTAKE');
					expect(result.value.fieldsAdopted).toContain('conversationalResponse');
					expect(result.value.fieldsAdopted).toContain('updatedPlan');
				}
			});

			it('adopts synthesis output', async () => {
				const output = {
					conversationalResponse: 'Synthesis complete',
					updatedPlan: {
						title: 'Final Plan',
						summary: 'Summary',
						requirements: ['R1', 'R2'],
					},
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(
					JSON.stringify({
						cachedRawCliOutput: JSON.stringify(output),
						intakeSubState: 'SYNTHESIZING',
					}),
					dialogueId
				);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.subPhase).toBe('SYNTHESIZING');
					expect(result.value.parsedType).toBe('IntakeSynthesisResponse');
				}
			});

			it('rejects synthesis without updatedPlan', async () => {
				const output = {
					conversationalResponse: 'Missing plan',
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(
					JSON.stringify({
						cachedRawCliOutput: JSON.stringify(output),
						intakeSubState: 'SYNTHESIZING',
					}),
					dialogueId
				);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('missing or empty "updatedPlan"');
				}
			});

			it('adopts analysis output', async () => {
				const output = {
					analysisSummary: 'Analysis complete',
					initialPlan: { title: 'Initial Plan' },
					codebaseFindings: ['Finding 1', 'Finding 2'],
					engineeringDomainAssessment: [{ domain: 'web', confidence: 0.9 }],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(
					JSON.stringify({
						cachedRawCliOutput: JSON.stringify(output),
						intakeSubState: 'INTENT_DISCOVERY',
					}),
					dialogueId
				);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.parsedType).toBe('IntakeAnalysisResponse');
					expect(result.value.fieldsAdopted).toContain('analysisSummary');
					expect(result.value.fieldsAdopted).toContain('codebaseFindings');
				}
			});

			it('adopts proposer output for business domains', async () => {
				const output = {
					domains: [{ name: 'Domain1' }],
					personas: [{ name: 'User' }],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(
					JSON.stringify({
						cachedRawCliOutput: JSON.stringify(output),
						intakeSubState: 'PROPOSING_BUSINESS_DOMAINS',
					}),
					dialogueId
				);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.subPhase).toBe('PROPOSING_BUSINESS_DOMAINS');
					expect(result.value.fieldsAdopted).toContain('domains');
				}
			});

			it('rejects proposer output without expected fields', async () => {
				const output = {
					unexpected: 'field',
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(
					JSON.stringify({
						cachedRawCliOutput: JSON.stringify(output),
						intakeSubState: 'PROPOSING_JOURNEYS',
					}),
					dialogueId
				);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('expected fields');
				}
			});
		});

		describe('architecture phase adoption', () => {
			beforeEach(() => {
				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET current_phase = 'ARCHITECTURE' WHERE dialogue_id = ?`
				).run(dialogueId);
			});

			it('adopts decomposition output', async () => {
				const output = {
					capabilities: [{ name: 'Cap1' }],
					workflows: [{ name: 'WF1' }],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.phase).toBe('ARCHITECTURE');
					expect(result.value.parsedType).toBe('DecompositionResult');
					expect(result.value.fieldsAdopted).toContain('capabilities');
				}
			});

			it('adopts modeling output', async () => {
				const output = {
					data_models: [{ name: 'Model1' }],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.parsedType).toBe('ModelingResult');
					expect(result.value.fieldsAdopted).toContain('data_models');
				}
			});

			it('adopts design output', async () => {
				const output = {
					components: [{ name: 'Component1' }],
					interfaces: [{ name: 'Interface1' }],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.parsedType).toBe('DesignResult');
					expect(result.value.fieldsAdopted).toContain('components');
					expect(result.value.fieldsAdopted).toContain('interfaces');
				}
			});

			it('adopts sequencing output', async () => {
				const output = {
					implementation_sequence: [{ step: 1, task: 'Task1' }],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.parsedType).toBe('SequencingResult');
					expect(result.value.fieldsAdopted).toContain('implementation_sequence');
				}
			});

			it('rejects unknown architecture output', async () => {
				const output = {
					unknown_field: 'value',
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error.message).toContain('Cannot determine architecture sub-phase');
				}
			});
		});

		describe('propose phase adoption', () => {
			beforeEach(() => {
				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET current_phase = 'PROPOSE' WHERE dialogue_id = ?`
				).run(dialogueId);
			});

			it('adopts proposal output', async () => {
				const output = {
					proposal: 'Implementation proposal',
					assumptions: [{ claim: 'Assumption 1' }],
					artifacts: [{ type: 'file', path: 'test.ts' }],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.phase).toBe('PROPOSE');
					expect(result.value.parsedType).toBe('ExecutorResponse');
					expect(result.value.fieldsAdopted).toContain('proposal');
				}
			});

			it('handles proposal without assumptions', async () => {
				const output = {
					proposal: 'Simple proposal',
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.fieldsAdopted).toContain('proposal');
				}
			});
		});

		describe('verify phase adoption', () => {
			beforeEach(() => {
				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET current_phase = 'VERIFY' WHERE dialogue_id = ?`
				).run(dialogueId);
			});

			it('adopts verification output', async () => {
				const output = {
					verdict: 'APPROVED',
					rationale: 'All checks passed',
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.phase).toBe('VERIFY');
					expect(result.value.parsedType).toBe('VerifierResponse');
					expect(result.value.fieldsAdopted).toContain('verdict');
					expect(result.value.fieldsAdopted).toContain('rationale');
				}
			});

			it('handles verdict without rationale', async () => {
				const output = {
					verdict: 'REJECTED',
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.fieldsAdopted).toContain('verdict');
				}
			});
		});

		describe('fallback to command block output', () => {
			it('reads from last failed command when no metadata cache', async () => {
				const commandId = randomUUID();
				const output = { conversationalResponse: 'From command block' };

				const db = getDatabase()!;
				db.prepare(
					`INSERT INTO workflow_commands (command_id, dialogue_id, command_type, label, status, collapsed, started_at)
					 VALUES (?, ?, 'cli_invocation', 'Test', 'error', 0, datetime('now'))`
				).run(commandId, dialogueId);

				db.prepare(
					`INSERT INTO workflow_command_outputs (command_id, line_type, content, timestamp)
					 VALUES (?, 'detail', ?, datetime('now'))`
				).run(commandId, JSON.stringify(output));

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.fieldsAdopted).toContain('conversationalResponse');
				}
			});

			it('prefers metadata cache over command block', async () => {
				const commandId = randomUUID();

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(
					JSON.stringify({
						cachedRawCliOutput: JSON.stringify({ conversationalResponse: 'From metadata' }),
					}),
					dialogueId
				);

				db.prepare(
					`INSERT INTO workflow_commands (command_id, dialogue_id, command_type, label, status, collapsed, started_at)
					 VALUES (?, ?, 'cli_invocation', 'Test', 'error', 0, datetime('now'))`
				).run(commandId, dialogueId);

				db.prepare(
					`INSERT INTO workflow_command_outputs (command_id, line_type, content, timestamp)
					 VALUES (?, 'detail', ?, datetime('now'))`
				).run(commandId, JSON.stringify({ conversationalResponse: 'From command' }));

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
			});
		});

		describe('cache cleanup', () => {
			it('clears cache flags after successful adoption', async () => {
				const output = { conversationalResponse: 'Test' };

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(
					JSON.stringify({
						cachedRawCliOutput: JSON.stringify(output),
						lastFailedPhase: 'INTAKE',
						lastError: 'Some error',
					}),
					dialogueId
				);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);

				const state = db.prepare(
					'SELECT metadata FROM workflow_state WHERE dialogue_id = ?'
				).get(dialogueId) as { metadata: string };
				const metadata = JSON.parse(state.metadata);

				expect(metadata.cachedRawCliOutput).toBeUndefined();
				expect(metadata.lastFailedPhase).toBeUndefined();
				expect(metadata.lastError).toBeUndefined();
			});
		});

		describe('integration scenarios', () => {
			it('adopts complete intake flow', async () => {
				const output = {
					conversationalResponse: 'Complete analysis',
					updatedPlan: { title: 'Plan', summary: 'Summary', requirements: ['R1'] },
					suggestedQuestions: ['Q1'],
				};

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: JSON.stringify(output) }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.fieldsAdopted.length).toBeGreaterThan(0);
					expect(result.value.warnings).toBeDefined();
				}

				const events = db.prepare(
					'SELECT * FROM dialogue_events WHERE dialogue_id = ?'
				).all(dialogueId);
				expect(events.length).toBeGreaterThan(0);
			});

			it('handles markdown-wrapped JSON from CLI', async () => {
				const output = {
					proposal: 'Implementation',
					assumptions: [],
				};
				const wrappedOutput = `Here's the result:\n\`\`\`json\n${JSON.stringify(output)}\n\`\`\`\nDone.`;

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET current_phase = 'PROPOSE', metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: wrappedOutput }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.parsedType).toBe('ExecutorResponse');
				}
			});

			it('adopts from JSONL stream output', async () => {
				const jsonlOutput = [
					'{"status": "processing"}',
					'{"status": "complete", "verdict": "APPROVED", "rationale": "All good"}',
				].join('\n');

				const db = getDatabase()!;
				db.prepare(
					`UPDATE workflow_state SET current_phase = 'VERIFY', metadata = ? WHERE dialogue_id = ?`
				).run(JSON.stringify({ cachedRawCliOutput: jsonlOutput }), dialogueId);

				const result = await adoptCachedOutput(dialogueId);

				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.value.fieldsAdopted).toContain('verdict');
				}
			});
		});
	});
});
