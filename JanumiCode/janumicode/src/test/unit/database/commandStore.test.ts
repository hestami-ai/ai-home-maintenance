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
} from '../../../lib/workflow/commandStore';
import { getDatabase } from '../../../lib/database/init';

describe('CommandStore', () => {
	let tempDb: TempDbContext;
	const DLG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee01';
	const DLG_ID_2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee02';
	const CMD_ID_1 = 'cmd-executor-001';
	const CMD_ID_2 = 'cmd-verifier-001';

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(DLG_ID);
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal 2', 'ACTIVE', datetime('now'))"
		).run(DLG_ID_2);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('insertCommand', () => {
		it('inserts a new workflow command', () => {
			const timestamp = new Date().toISOString();
			const result = insertCommand(
				CMD_ID_1,
				DLG_ID,
				'role_invocation',
				'EXECUTOR: Implement feature',
				timestamp
			);

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT * FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as any;

			expect(row).toBeDefined();
			expect(row.dialogue_id).toBe(DLG_ID);
			expect(row.command_type).toBe('role_invocation');
			expect(row.label).toBe('EXECUTOR: Implement feature');
			expect(row.status).toBe('running');
			expect(row.collapsed).toBe(0);
			expect(row.started_at).toBe(timestamp);
			expect(row.completed_at).toBeNull();
		});

		it('inserts command with collapsed flag', () => {
			const timestamp = new Date().toISOString();
			const result = insertCommand(
				CMD_ID_1,
				DLG_ID,
				'cli_invocation',
				'npm test',
				timestamp,
				true
			);

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT collapsed FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as { collapsed: number };

			expect(row.collapsed).toBe(1);
		});

		it('supports different command types', () => {
			const timestamp = new Date().toISOString();

			insertCommand(CMD_ID_1, DLG_ID, 'cli_invocation', 'CLI command', timestamp);
			insertCommand(CMD_ID_2, DLG_ID, 'llm_api_call', 'LLM call', timestamp);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT command_type FROM workflow_commands WHERE dialogue_id = ?'
			).all(DLG_ID) as { command_type: string }[];

			expect(rows).toHaveLength(2);
			expect(rows[0].command_type).toBe('cli_invocation');
			expect(rows[1].command_type).toBe('llm_api_call');
		});

		it('ignores duplicate insertions (INSERT OR IGNORE)', () => {
			const timestamp = new Date().toISOString();

			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Original label', timestamp);
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Duplicate label', timestamp);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM workflow_commands WHERE command_id = ?'
			).all(CMD_ID_1);

			expect(rows).toHaveLength(1);
			expect((rows[0] as any).label).toBe('Original label');
		});

		it('isolates commands by dialogue_id', () => {
			const timestamp = new Date().toISOString();

			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Command 1', timestamp);
			insertCommand(CMD_ID_2, DLG_ID_2, 'role_invocation', 'Command 2', timestamp);

			const db = getDatabase()!;
			const rows1 = db.prepare(
				'SELECT * FROM workflow_commands WHERE dialogue_id = ?'
			).all(DLG_ID);
			const rows2 = db.prepare(
				'SELECT * FROM workflow_commands WHERE dialogue_id = ?'
			).all(DLG_ID_2);

			expect(rows1).toHaveLength(1);
			expect(rows2).toHaveLength(1);
		});
	});

	describe('appendCommandOutput', () => {
		beforeEach(() => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Test command', timestamp);
		});

		it('appends summary output', () => {
			const timestamp = new Date().toISOString();
			const result = appendCommandOutput(CMD_ID_1, 'summary', 'Executing task...', timestamp);

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT * FROM workflow_command_outputs WHERE command_id = ?'
			).get(CMD_ID_1) as any;

			expect(row).toBeDefined();
			expect(row.line_type).toBe('summary');
			expect(row.content).toBe('Executing task...');
			expect(row.timestamp).toBe(timestamp);
			expect(row.tool_name).toBeNull();
		});

		it('appends detail output', () => {
			const timestamp = new Date().toISOString();
			appendCommandOutput(CMD_ID_1, 'detail', 'Running npm install...', timestamp);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT line_type, content FROM workflow_command_outputs WHERE command_id = ?'
			).get(CMD_ID_1) as { line_type: string; content: string };

			expect(row.line_type).toBe('detail');
			expect(row.content).toBe('Running npm install...');
		});

		it('appends error output', () => {
			const timestamp = new Date().toISOString();
			appendCommandOutput(CMD_ID_1, 'error', 'Error: File not found', timestamp);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT line_type, content FROM workflow_command_outputs WHERE command_id = ?'
			).get(CMD_ID_1) as { line_type: string; content: string };

			expect(row.line_type).toBe('error');
			expect(row.content).toBe('Error: File not found');
		});

		it('appends stdin output', () => {
			const timestamp = new Date().toISOString();
			const stdinContent = 'System prompt + compiled context';
			appendCommandOutput(CMD_ID_1, 'stdin', stdinContent, timestamp);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT line_type FROM workflow_command_outputs WHERE command_id = ?'
			).get(CMD_ID_1) as { line_type: string };

			expect(row.line_type).toBe('stdin');
		});

		it('appends tool input/output with tool_name', () => {
			const timestamp = new Date().toISOString();
			appendCommandOutput(CMD_ID_1, 'tool_input', '{"action": "search"}', timestamp, 'code_search');
			appendCommandOutput(CMD_ID_1, 'tool_output', '{"results": [...]}', timestamp, 'code_search');

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT line_type, tool_name FROM workflow_command_outputs WHERE command_id = ? ORDER BY id ASC'
			).all(CMD_ID_1) as { line_type: string; tool_name: string }[];

			expect(rows).toHaveLength(2);
			expect(rows[0].line_type).toBe('tool_input');
			expect(rows[0].tool_name).toBe('code_search');
			expect(rows[1].line_type).toBe('tool_output');
			expect(rows[1].tool_name).toBe('code_search');
		});

		it('maintains insertion order via auto-incrementing id', () => {
			const timestamp = new Date().toISOString();
			appendCommandOutput(CMD_ID_1, 'summary', 'First line', timestamp);
			appendCommandOutput(CMD_ID_1, 'detail', 'Second line', timestamp);
			appendCommandOutput(CMD_ID_1, 'detail', 'Third line', timestamp);

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT id, content FROM workflow_command_outputs WHERE command_id = ? ORDER BY id ASC'
			).all(CMD_ID_1) as { id: number; content: string }[];

			expect(rows).toHaveLength(3);
			expect(rows[0].content).toBe('First line');
			expect(rows[1].content).toBe('Second line');
			expect(rows[2].content).toBe('Third line');
			expect(rows[0].id).toBeLessThan(rows[1].id);
			expect(rows[1].id).toBeLessThan(rows[2].id);
		});

		it('handles multiple outputs for same command', () => {
			const timestamp = new Date().toISOString();
			for (let i = 0; i < 10; i++) {
				appendCommandOutput(CMD_ID_1, 'detail', `Output line ${i}`, timestamp);
			}

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT * FROM workflow_command_outputs WHERE command_id = ?'
			).all(CMD_ID_1);

			expect(rows).toHaveLength(10);
		});
	});

	describe('completeCommand', () => {
		beforeEach(() => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Running task', timestamp);
		});

		it('marks command as success', () => {
			const completedAt = new Date().toISOString();
			const result = completeCommand(CMD_ID_1, 'success', undefined, completedAt);

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT status, completed_at FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as { status: string; completed_at: string };

			expect(row.status).toBe('success');
			expect(row.completed_at).toBe(completedAt);
		});

		it('marks command as error', () => {
			const result = completeCommand(CMD_ID_1, 'error');

			expect(result.success).toBe(true);

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT status FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as { status: string };

			expect(row.status).toBe('error');
		});

		it('updates label on completion', () => {
			completeCommand(CMD_ID_1, 'success', 'EXECUTOR: Task completed successfully');

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT label FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as { label: string };

			expect(row.label).toBe('EXECUTOR: Task completed successfully');
		});

		it('preserves label if not provided', () => {
			completeCommand(CMD_ID_1, 'success');

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT label FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as { label: string };

			expect(row.label).toBe('Running task');
		});

		it('sets completed_at to current time if not provided', () => {
			const beforeComplete = new Date();
			completeCommand(CMD_ID_1, 'success');
			const afterComplete = new Date();

			const db = getDatabase()!;
			const row = db.prepare(
				'SELECT completed_at FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as { completed_at: string };

			const completedTime = new Date(row.completed_at);
			expect(completedTime.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
			expect(completedTime.getTime()).toBeLessThanOrEqual(afterComplete.getTime());
		});
	});

	describe('reconcileOrphanedCommands', () => {
		it('marks running commands as error with orphaned label', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Running task 1', timestamp);
			insertCommand(CMD_ID_2, DLG_ID, 'role_invocation', 'Running task 2', timestamp);

			const result = reconcileOrphanedCommands();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(2);
			}

			const db = getDatabase()!;
			const rows = db.prepare(
				'SELECT status, label, completed_at FROM workflow_commands WHERE dialogue_id = ?'
			).all(DLG_ID) as { status: string; label: string; completed_at: string }[];

			expect(rows).toHaveLength(2);
			expect(rows[0].status).toBe('error');
			expect(rows[0].label).toContain('orphaned');
			expect(rows[0].completed_at).not.toBeNull();
			expect(rows[1].status).toBe('error');
			expect(rows[1].label).toContain('orphaned');
		});

		it('does not affect already completed commands', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Task 1', timestamp);
			insertCommand(CMD_ID_2, DLG_ID, 'role_invocation', 'Task 2', timestamp);

			completeCommand(CMD_ID_1, 'success');

			const result = reconcileOrphanedCommands();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(1);
			}

			const db = getDatabase()!;
			const row1 = db.prepare(
				'SELECT status, label FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_1) as { status: string; label: string };
			const row2 = db.prepare(
				'SELECT status, label FROM workflow_commands WHERE command_id = ?'
			).get(CMD_ID_2) as { status: string; label: string };

			expect(row1.status).toBe('success');
			expect(row1.label).not.toContain('orphaned');
			expect(row2.status).toBe('error');
			expect(row2.label).toContain('orphaned');
		});

		it('returns zero when no orphaned commands exist', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Task', timestamp);
			completeCommand(CMD_ID_1, 'success');

			const result = reconcileOrphanedCommands();
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(0);
			}
		});
	});

	describe('getCommandsForDialogue', () => {
		it('returns empty array when no commands exist', () => {
			const result = getCommandsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('retrieves all commands for a dialogue', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Task 1', timestamp);
			insertCommand(CMD_ID_2, DLG_ID, 'cli_invocation', 'Task 2', timestamp);

			const result = getCommandsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});

		it('orders commands by started_at ascending', () => {
			const timestamp1 = new Date('2024-01-01T10:00:00Z').toISOString();
			const timestamp2 = new Date('2024-01-01T11:00:00Z').toISOString();
			const timestamp3 = new Date('2024-01-01T09:00:00Z').toISOString();

			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Task 1', timestamp1);
			insertCommand(CMD_ID_2, DLG_ID, 'role_invocation', 'Task 2', timestamp2);
			insertCommand('cmd-003', DLG_ID, 'role_invocation', 'Task 3', timestamp3);

			const result = getCommandsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].label).toBe('Task 3');
				expect(result.value[1].label).toBe('Task 1');
				expect(result.value[2].label).toBe('Task 2');
			}
		});

		it('converts collapsed boolean correctly', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Not collapsed', timestamp, false);
			insertCommand(CMD_ID_2, DLG_ID, 'role_invocation', 'Collapsed', timestamp, true);

			const result = getCommandsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].collapsed).toBe(false);
				expect(result.value[1].collapsed).toBe(true);
			}
		});

		it('isolates commands by dialogue_id', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Task 1', timestamp);
			insertCommand(CMD_ID_2, DLG_ID_2, 'role_invocation', 'Task 2', timestamp);

			const result1 = getCommandsForDialogue(DLG_ID);
			const result2 = getCommandsForDialogue(DLG_ID_2);

			expect(result1.success && result1.value).toHaveLength(1);
			expect(result2.success && result2.value).toHaveLength(1);
		});

		it('includes all command fields', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'llm_api_call', 'LLM invocation', timestamp, true);
			completeCommand(CMD_ID_1, 'success', 'LLM completed', timestamp);

			const result = getCommandsForDialogue(DLG_ID);
			expect(result.success).toBe(true);
			if (result.success) {
				const cmd = result.value[0];
				expect(cmd.command_id).toBe(CMD_ID_1);
				expect(cmd.dialogue_id).toBe(DLG_ID);
				expect(cmd.command_type).toBe('llm_api_call');
				expect(cmd.label).toBe('LLM completed');
				expect(cmd.status).toBe('success');
				expect(cmd.collapsed).toBe(true);
				expect(cmd.started_at).toBe(timestamp);
				expect(cmd.completed_at).toBe(timestamp);
			}
		});
	});

	describe('getCommandOutputs', () => {
		beforeEach(() => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'Test command', timestamp);
		});

		it('returns empty array when no outputs exist', () => {
			const result = getCommandOutputs(CMD_ID_1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('retrieves all outputs for a command', () => {
			const timestamp = new Date().toISOString();
			appendCommandOutput(CMD_ID_1, 'summary', 'Line 1', timestamp);
			appendCommandOutput(CMD_ID_1, 'detail', 'Line 2', timestamp);
			appendCommandOutput(CMD_ID_1, 'error', 'Line 3', timestamp);

			const result = getCommandOutputs(CMD_ID_1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(3);
			}
		});

		it('orders outputs by id (insertion order)', () => {
			const timestamp = new Date().toISOString();
			appendCommandOutput(CMD_ID_1, 'summary', 'First', timestamp);
			appendCommandOutput(CMD_ID_1, 'detail', 'Second', timestamp);
			appendCommandOutput(CMD_ID_1, 'detail', 'Third', timestamp);

			const result = getCommandOutputs(CMD_ID_1);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value[0].content).toBe('First');
				expect(result.value[1].content).toBe('Second');
				expect(result.value[2].content).toBe('Third');
			}
		});

		it('includes all output fields', () => {
			const timestamp = new Date().toISOString();
			appendCommandOutput(CMD_ID_1, 'tool_input', '{"query": "search"}', timestamp, 'grep');

			const result = getCommandOutputs(CMD_ID_1);
			expect(result.success).toBe(true);
			if (result.success) {
				const output = result.value[0];
				expect(output.id).toBeDefined();
				expect(output.command_id).toBe(CMD_ID_1);
				expect(output.line_type).toBe('tool_input');
				expect(output.tool_name).toBe('grep');
				expect(output.content).toBe('{"query": "search"}');
				expect(output.timestamp).toBe(timestamp);
			}
		});

		it('isolates outputs by command_id', () => {
			const timestamp = new Date().toISOString();
			insertCommand(CMD_ID_2, DLG_ID, 'role_invocation', 'Command 2', timestamp);

			appendCommandOutput(CMD_ID_1, 'summary', 'Output 1', timestamp);
			appendCommandOutput(CMD_ID_2, 'summary', 'Output 2', timestamp);

			const result1 = getCommandOutputs(CMD_ID_1);
			const result2 = getCommandOutputs(CMD_ID_2);

			expect(result1.success && result1.value).toHaveLength(1);
			expect(result2.success && result2.value).toHaveLength(1);
			if (result1.success && result2.success) {
				expect(result1.value[0].content).toBe('Output 1');
				expect(result2.value[0].content).toBe('Output 2');
			}
		});
	});

	describe('workflow scenarios', () => {
		it('simulates complete command lifecycle', () => {
			const startedAt = new Date().toISOString();

			// Start command
			insertCommand(CMD_ID_1, DLG_ID, 'role_invocation', 'EXECUTOR: Implement feature', startedAt);

			// Append outputs
			appendCommandOutput(CMD_ID_1, 'summary', 'Starting execution...', startedAt);
			appendCommandOutput(CMD_ID_1, 'detail', 'Creating new file...', startedAt);
			appendCommandOutput(CMD_ID_1, 'detail', 'Writing code...', startedAt);

			// Complete command
			const completedAt = new Date().toISOString();
			completeCommand(CMD_ID_1, 'success', 'EXECUTOR: Feature implemented', completedAt);
			appendCommandOutput(CMD_ID_1, 'summary', 'Execution completed successfully', completedAt);

			// Verify command record
			const commands = getCommandsForDialogue(DLG_ID);
			expect(commands.success).toBe(true);
			if (commands.success) {
				expect(commands.value[0].status).toBe('success');
				expect(commands.value[0].label).toBe('EXECUTOR: Feature implemented');
			}

			// Verify outputs
			const outputs = getCommandOutputs(CMD_ID_1);
			expect(outputs.success).toBe(true);
			if (outputs.success) {
				expect(outputs.value).toHaveLength(4);
			}
		});

		it('simulates error scenario', () => {
			const timestamp = new Date().toISOString();

			insertCommand(CMD_ID_1, DLG_ID, 'cli_invocation', 'npm test', timestamp);
			appendCommandOutput(CMD_ID_1, 'summary', 'Running tests...', timestamp);
			appendCommandOutput(CMD_ID_1, 'error', 'Error: 3 tests failed', timestamp);
			completeCommand(CMD_ID_1, 'error', 'npm test (failed)', timestamp);

			const commands = getCommandsForDialogue(DLG_ID);
			if (commands.success) {
				expect(commands.value[0].status).toBe('error');
			}
		});

		it('simulates VS Code restart with orphaned commands', () => {
			const timestamp = new Date().toISOString();

			// Three commands were running when VS Code crashed
			insertCommand('cmd-001', DLG_ID, 'role_invocation', 'Task 1', timestamp);
			insertCommand('cmd-002', DLG_ID, 'role_invocation', 'Task 2', timestamp);
			insertCommand('cmd-003', DLG_ID, 'role_invocation', 'Task 3', timestamp);

			// Extension activates and reconciles
			const result = reconcileOrphanedCommands();
			expect(result.success && result.value).toBe(3);

			// All commands marked as orphaned
			const commands = getCommandsForDialogue(DLG_ID);
			if (commands.success) {
				expect(commands.value.every(c => c.status === 'error')).toBe(true);
				expect(commands.value.every(c => c.label.includes('orphaned'))).toBe(true);
			}
		});

		it('simulates multiple role invocations in workflow', () => {
			const ts1 = new Date('2024-01-01T10:00:00Z').toISOString();
			const ts2 = new Date('2024-01-01T10:05:00Z').toISOString();
			const ts3 = new Date('2024-01-01T10:10:00Z').toISOString();

			// EXECUTOR
			insertCommand('cmd-executor', DLG_ID, 'role_invocation', 'EXECUTOR', ts1);
			appendCommandOutput('cmd-executor', 'summary', 'Code changes applied', ts1);
			completeCommand('cmd-executor', 'success', 'EXECUTOR: Complete', ts1);

			// VERIFIER
			insertCommand('cmd-verifier', DLG_ID, 'role_invocation', 'VERIFIER', ts2);
			appendCommandOutput('cmd-verifier', 'summary', 'Verification passed', ts2);
			completeCommand('cmd-verifier', 'success', 'VERIFIER: PASS', ts2);

			// HISTORIAN
			insertCommand('cmd-historian', DLG_ID, 'role_invocation', 'HISTORIAN', ts3);
			appendCommandOutput('cmd-historian', 'summary', 'No historical concerns', ts3);
			completeCommand('cmd-historian', 'success', 'HISTORIAN: Clear', ts3);

			const commands = getCommandsForDialogue(DLG_ID);
			expect(commands.success).toBe(true);
			if (commands.success) {
				expect(commands.value).toHaveLength(3);
				expect(commands.value[0].label).toContain('EXECUTOR');
				expect(commands.value[1].label).toContain('VERIFIER');
				expect(commands.value[2].label).toContain('HISTORIAN');
			}
		});
	});
});
