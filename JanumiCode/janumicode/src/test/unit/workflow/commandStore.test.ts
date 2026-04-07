import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	insertCommand,
	appendCommandOutput,
	completeCommand,
	reconcileOrphanedCommands,
	getCommandsForDialogue,
	getCommandOutputs,
	subscribeCommandPersistence,
	unsubscribeCommandPersistence,
	type WorkflowCommandRecord,
} from '../../../lib/workflow/commandStore';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/database/init';

describe('CommandStore', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;
	let commandId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
		commandId = randomUUID();

		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(dialogueId);
	});

	afterEach(() => {
		unsubscribeCommandPersistence();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('insertCommand', () => {
		it('inserts new command record', () => {
			const result = insertCommand(
				commandId,
				dialogueId,
				'cli_invocation',
				'Test Command',
				new Date().toISOString()
			);

			expect(result.success).toBe(true);

			const commands = getCommandsForDialogue(dialogueId);
			expect(commands.success).toBe(true);
			if (commands.success) {
				expect(commands.value.length).toBe(1);
				expect(commands.value[0].command_id).toBe(commandId);
				expect(commands.value[0].label).toBe('Test Command');
				expect(commands.value[0].status).toBe('running');
			}
		});

		it('sets default collapsed to false', () => {
			insertCommand(
				commandId,
				dialogueId,
				'llm_api_call',
				'LLM Call',
				new Date().toISOString()
			);

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].collapsed).toBe(false);
			}
		});

		it('respects collapsed flag when provided', () => {
			insertCommand(
				commandId,
				dialogueId,
				'role_invocation',
				'Role Call',
				new Date().toISOString(),
				true
			);

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].collapsed).toBe(true);
			}
		});

		it('handles INSERT OR IGNORE for duplicate command_id', () => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'First', new Date().toISOString());
			const result = insertCommand(commandId, dialogueId, 'cli_invocation', 'Second', new Date().toISOString());

			expect(result.success).toBe(true);

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value.length).toBe(1);
				expect(commands.value[0].label).toBe('First');
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = insertCommand(commandId, dialogueId, 'cli_invocation', 'Test', new Date().toISOString());
			expect(result.success).toBe(false);
		});

		it('stores all command types', () => {
			const types: WorkflowCommandRecord['command_type'][] = ['cli_invocation', 'llm_api_call', 'role_invocation'];

			for (const type of types) {
				const id = randomUUID();
				insertCommand(id, dialogueId, type, `Test ${type}`, new Date().toISOString());
			}

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value.length).toBe(3);
				types.forEach((type, i) => {
					expect(commands.value[i].command_type).toBe(type);
				});
			}
		});
	});

	describe('appendCommandOutput', () => {
		beforeEach(() => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test', new Date().toISOString());
		});

		it('appends summary line', () => {
			const result = appendCommandOutput(
				commandId,
				'summary',
				'Command started',
				new Date().toISOString()
			);

			expect(result.success).toBe(true);

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value.length).toBe(1);
				expect(outputs.value[0].line_type).toBe('summary');
				expect(outputs.value[0].content).toBe('Command started');
			}
		});

		it('appends detail line', () => {
			appendCommandOutput(commandId, 'detail', 'Processing...', new Date().toISOString());

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value[0].line_type).toBe('detail');
			}
		});

		it('appends error line', () => {
			appendCommandOutput(commandId, 'error', 'Error occurred', new Date().toISOString());

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value[0].line_type).toBe('error');
			}
		});

		it('appends stdin line', () => {
			appendCommandOutput(commandId, 'stdin', 'Input content', new Date().toISOString());

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value[0].line_type).toBe('stdin');
			}
		});

		it('appends tool_input line with tool_name', () => {
			appendCommandOutput(
				commandId,
				'tool_input',
				'Tool input data',
				new Date().toISOString(),
				'file_write'
			);

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value[0].line_type).toBe('tool_input');
				expect(outputs.value[0].tool_name).toBe('file_write');
			}
		});

		it('appends tool_output line with tool_name', () => {
			appendCommandOutput(
				commandId,
				'tool_output',
				'Tool output data',
				new Date().toISOString(),
				'file_read'
			);

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value[0].line_type).toBe('tool_output');
				expect(outputs.value[0].tool_name).toBe('file_read');
			}
		});

		it('maintains insertion order', () => {
			appendCommandOutput(commandId, 'summary', 'Line 1', new Date().toISOString());
			appendCommandOutput(commandId, 'detail', 'Line 2', new Date().toISOString());
			appendCommandOutput(commandId, 'detail', 'Line 3', new Date().toISOString());

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value.length).toBe(3);
				expect(outputs.value[0].content).toBe('Line 1');
				expect(outputs.value[1].content).toBe('Line 2');
				expect(outputs.value[2].content).toBe('Line 3');
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = appendCommandOutput(commandId, 'summary', 'Test', new Date().toISOString());
			expect(result.success).toBe(false);
		});

		it('stores null tool_name when not provided', () => {
			appendCommandOutput(commandId, 'summary', 'Test', new Date().toISOString());

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value[0].tool_name).toBeNull();
			}
		});
	});

	describe('completeCommand', () => {
		beforeEach(() => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test', new Date().toISOString());
		});

		it('marks command as success', () => {
			const result = completeCommand(commandId, 'success');

			expect(result.success).toBe(true);

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].status).toBe('success');
				expect(commands.value[0].completed_at).toBeDefined();
			}
		});

		it('marks command as error', () => {
			completeCommand(commandId, 'error');

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].status).toBe('error');
			}
		});

		it('updates label when provided', () => {
			completeCommand(commandId, 'success', 'Updated Label');

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].label).toBe('Updated Label');
			}
		});

		it('preserves original label when not provided', () => {
			completeCommand(commandId, 'success');

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].label).toBe('Test');
			}
		});

		it('uses provided completedAt timestamp', () => {
			const timestamp = '2024-01-01T00:00:00.000Z';
			completeCommand(commandId, 'success', undefined, timestamp);

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].completed_at).toBe(timestamp);
			}
		});

		it('generates timestamp when not provided', () => {
			const before = Date.now();
			completeCommand(commandId, 'success');
			const after = Date.now();

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success && commands.value[0].completed_at) {
				const timestamp = new Date(commands.value[0].completed_at).getTime();
				expect(timestamp).toBeGreaterThanOrEqual(before);
				expect(timestamp).toBeLessThanOrEqual(after);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = completeCommand(commandId, 'success');
			expect(result.success).toBe(false);
		});
	});

	describe('reconcileOrphanedCommands', () => {
		it('marks running commands as error', () => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Running', new Date().toISOString());

			const result = reconcileOrphanedCommands();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(1);
			}

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].status).toBe('error');
				expect(commands.value[0].label).toContain('orphaned');
			}
		});

		it('appends orphaned suffix to label', () => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test Command', new Date().toISOString());

			reconcileOrphanedCommands();

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].label).toBe('Test Command (orphaned)');
			}
		});

		it('sets completed_at timestamp', () => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test', new Date().toISOString());

			reconcileOrphanedCommands();

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				expect(commands.value[0].completed_at).toBeDefined();
			}
		});

		it('returns count of reconciled commands', () => {
			insertCommand(randomUUID(), dialogueId, 'cli_invocation', 'Cmd1', new Date().toISOString());
			insertCommand(randomUUID(), dialogueId, 'cli_invocation', 'Cmd2', new Date().toISOString());
			insertCommand(randomUUID(), dialogueId, 'cli_invocation', 'Cmd3', new Date().toISOString());

			const result = reconcileOrphanedCommands();

			if (result.success) {
				expect(result.value).toBe(3);
			}
		});

		it('ignores already completed commands', () => {
			const cmd1 = randomUUID();
			const cmd2 = randomUUID();
			insertCommand(cmd1, dialogueId, 'cli_invocation', 'Running', new Date().toISOString());
			insertCommand(cmd2, dialogueId, 'cli_invocation', 'Done', new Date().toISOString());
			completeCommand(cmd2, 'success');

			const result = reconcileOrphanedCommands();

			if (result.success) {
				expect(result.value).toBe(1);
			}
		});

		it('returns zero when no orphaned commands', () => {
			const result = reconcileOrphanedCommands();

			if (result.success) {
				expect(result.value).toBe(0);
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = reconcileOrphanedCommands();
			expect(result.success).toBe(false);
		});
	});

	describe('getCommandsForDialogue', () => {
		it('retrieves commands for dialogue', () => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test', new Date().toISOString());

			const result = getCommandsForDialogue(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].dialogue_id).toBe(dialogueId);
			}
		});

		it('returns empty array for dialogue with no commands', () => {
			const result = getCommandsForDialogue(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('orders commands by started_at ASC', () => {
			const cmd1 = randomUUID();
			const cmd2 = randomUUID();
			const cmd3 = randomUUID();

			insertCommand(cmd2, dialogueId, 'cli_invocation', 'Second', '2024-01-02T00:00:00.000Z');
			insertCommand(cmd1, dialogueId, 'cli_invocation', 'First', '2024-01-01T00:00:00.000Z');
			insertCommand(cmd3, dialogueId, 'cli_invocation', 'Third', '2024-01-03T00:00:00.000Z');

			const result = getCommandsForDialogue(dialogueId);

			if (result.success) {
				expect(result.value.length).toBe(3);
				expect(result.value[0].command_id).toBe(cmd1);
				expect(result.value[1].command_id).toBe(cmd2);
				expect(result.value[2].command_id).toBe(cmd3);
			}
		});

		it('converts collapsed integer to boolean', () => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test', new Date().toISOString(), true);

			const result = getCommandsForDialogue(dialogueId);

			if (result.success) {
				expect(typeof result.value[0].collapsed).toBe('boolean');
				expect(result.value[0].collapsed).toBe(true);
			}
		});

		it('filters by dialogue_id', () => {
			const otherDialogueId = randomUUID();
			const db = getDatabase()!;
			db.prepare(
				"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'other', 'ACTIVE', datetime('now'))"
			).run(otherDialogueId);

			insertCommand(randomUUID(), dialogueId, 'cli_invocation', 'Test1', new Date().toISOString());
			insertCommand(randomUUID(), otherDialogueId, 'cli_invocation', 'Test2', new Date().toISOString());

			const result = getCommandsForDialogue(dialogueId);

			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].label).toBe('Test1');
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getCommandsForDialogue(dialogueId);
			expect(result.success).toBe(false);
		});
	});

	describe('getCommandOutputs', () => {
		beforeEach(() => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test', new Date().toISOString());
		});

		it('retrieves outputs for command', () => {
			appendCommandOutput(commandId, 'summary', 'Test output', new Date().toISOString());

			const result = getCommandOutputs(commandId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(1);
				expect(result.value[0].command_id).toBe(commandId);
			}
		});

		it('returns empty array for command with no outputs', () => {
			const result = getCommandOutputs(commandId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('orders outputs by id ASC', () => {
			appendCommandOutput(commandId, 'summary', 'First', new Date().toISOString());
			appendCommandOutput(commandId, 'detail', 'Second', new Date().toISOString());
			appendCommandOutput(commandId, 'detail', 'Third', new Date().toISOString());

			const result = getCommandOutputs(commandId);

			if (result.success) {
				expect(result.value.length).toBe(3);
				expect(result.value[0].content).toBe('First');
				expect(result.value[1].content).toBe('Second');
				expect(result.value[2].content).toBe('Third');
			}
		});

		it('includes all output fields', () => {
			appendCommandOutput(
				commandId,
				'tool_output',
				'Output content',
				'2024-01-01T00:00:00.000Z',
				'test_tool'
			);

			const result = getCommandOutputs(commandId);

			if (result.success && result.value.length > 0) {
				const output = result.value[0];
				expect(output.id).toBeDefined();
				expect(output.command_id).toBe(commandId);
				expect(output.line_type).toBe('tool_output');
				expect(output.tool_name).toBe('test_tool');
				expect(output.content).toBe('Output content');
				expect(output.timestamp).toBe('2024-01-01T00:00:00.000Z');
			}
		});

		it('handles database errors', () => {
			tempDb.cleanup();
			const result = getCommandOutputs(commandId);
			expect(result.success).toBe(false);
		});
	});

	describe('event bus subscription', () => {
		it('subscribes to workflow:command events', () => {
			const unsubscribe = subscribeCommandPersistence();
			expect(typeof unsubscribe).toBe('function');
		});

		it('returns same unsubscribe function on multiple calls', () => {
			const unsub1 = subscribeCommandPersistence();
			const unsub2 = subscribeCommandPersistence();
			expect(unsub1).toBe(unsub2);
		});

		it('unsubscribes successfully', () => {
			subscribeCommandPersistence();
			unsubscribeCommandPersistence();
			
			const unsub2 = subscribeCommandPersistence();
			expect(typeof unsub2).toBe('function');
		});
	});

	describe('integration scenarios', () => {
		it('manages complete command lifecycle', () => {
			insertCommand(commandId, dialogueId, 'cli_invocation', 'Test Command', new Date().toISOString());
			
			appendCommandOutput(commandId, 'summary', 'Starting...', new Date().toISOString());
			appendCommandOutput(commandId, 'detail', 'Processing step 1', new Date().toISOString());
			appendCommandOutput(commandId, 'detail', 'Processing step 2', new Date().toISOString());
			
			completeCommand(commandId, 'success', 'Test Command - Completed');

			const commands = getCommandsForDialogue(dialogueId);
			const outputs = getCommandOutputs(commandId);

			expect(commands.success && outputs.success).toBe(true);
			if (commands.success && outputs.success) {
				expect(commands.value[0].status).toBe('success');
				expect(commands.value[0].label).toBe('Test Command - Completed');
				expect(outputs.value.length).toBe(3);
			}
		});

		it('handles multiple commands for same dialogue', () => {
			const cmd1 = randomUUID();
			const cmd2 = randomUUID();

			insertCommand(cmd1, dialogueId, 'cli_invocation', 'Command 1', '2024-01-01T00:00:00.000Z');
			insertCommand(cmd2, dialogueId, 'llm_api_call', 'Command 2', '2024-01-02T00:00:00.000Z');

			appendCommandOutput(cmd1, 'summary', 'Output 1', new Date().toISOString());
			appendCommandOutput(cmd2, 'summary', 'Output 2', new Date().toISOString());

			const commands = getCommandsForDialogue(dialogueId);
			const outputs1 = getCommandOutputs(cmd1);
			const outputs2 = getCommandOutputs(cmd2);

			if (commands.success && outputs1.success && outputs2.success) {
				expect(commands.value.length).toBe(2);
				expect(outputs1.value[0].content).toBe('Output 1');
				expect(outputs2.value[0].content).toBe('Output 2');
			}
		});

		it('reconciles orphaned commands on startup', () => {
			insertCommand(randomUUID(), dialogueId, 'cli_invocation', 'Orphan 1', new Date().toISOString());
			insertCommand(randomUUID(), dialogueId, 'cli_invocation', 'Orphan 2', new Date().toISOString());

			const reconciled = reconcileOrphanedCommands();

			expect(reconciled.success).toBe(true);
			if (reconciled.success) {
				expect(reconciled.value).toBe(2);
			}

			const commands = getCommandsForDialogue(dialogueId);
			if (commands.success) {
				commands.value.forEach(cmd => {
					expect(cmd.status).toBe('error');
					expect(cmd.label).toContain('orphaned');
				});
			}
		});

		it('handles tool invocation tracking', () => {
			insertCommand(commandId, dialogueId, 'role_invocation', 'Executor', new Date().toISOString());
			
			appendCommandOutput(commandId, 'summary', 'Executing task', new Date().toISOString());
			appendCommandOutput(commandId, 'tool_input', '{"path": "file.ts"}', new Date().toISOString(), 'file_write');
			appendCommandOutput(commandId, 'tool_output', 'File written', new Date().toISOString(), 'file_write');
			
			completeCommand(commandId, 'success');

			const outputs = getCommandOutputs(commandId);
			if (outputs.success) {
				expect(outputs.value.length).toBe(3);
				expect(outputs.value[1].line_type).toBe('tool_input');
				expect(outputs.value[1].tool_name).toBe('file_write');
				expect(outputs.value[2].line_type).toBe('tool_output');
			}
		});
	});
});
