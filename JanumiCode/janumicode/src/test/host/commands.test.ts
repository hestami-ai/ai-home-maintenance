import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Registered Commands', () => {
	test('registered commands include core JanumiCode commands', async () => {
		const allCommands = await vscode.commands.getCommands(true);

		const expectedCommands = [
			'janumicode.startDialogue',
			'janumicode.showWorkflowStatus',
			'janumicode.exportHistory',
			'janumicode.openGovernedStream',
		];

		for (const cmd of expectedCommands) {
			assert.ok(
				allCommands.includes(cmd),
				`Command "${cmd}" should be registered`
			);
		}
	});
});
