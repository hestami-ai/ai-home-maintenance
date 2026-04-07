import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Workflow Smoke', () => {
	const extensionId = 'undefined_publisher.janumicode';

	async function getActivatedExtension(): Promise<vscode.Extension<unknown>> {
		const ext = vscode.extensions.getExtension(extensionId);
		assert.ok(ext, `Extension ${extensionId} should be installed`);
		if (!ext.isActive) {
			await ext.activate();
		}
		assert.strictEqual(ext.isActive, true, 'Extension should be active');
		return ext;
	}

	test('golden command flow executes without throwing', async () => {
		await getActivatedExtension();
		const goldenCommands = [
			'janumicode.openGovernedStream',
			'janumicode.startDialogue',
			'janumicode.showWorkflowStatus',
			'janumicode.findInStream',
		];
		for (const cmd of goldenCommands) {
			try {
				await Promise.resolve(vscode.commands.executeCommand(cmd));
			} catch (error) {
				assert.fail(`Command ${cmd} should execute without throwing: ${String(error)}`);
			}
		}
	});

	test('startDialogue can be retried safely', async () => {
		await getActivatedExtension();
		await Promise.resolve(vscode.commands.executeCommand('janumicode.startDialogue'));
		await Promise.resolve(vscode.commands.executeCommand('janumicode.startDialogue'));
	});

	test('re-activation is idempotent', async () => {
		const ext = await getActivatedExtension();
		await Promise.resolve(ext.activate());
		assert.strictEqual(ext.isActive, true, 'Extension should remain active after re-activate');
	});

	test('core commands remain registered after reactivation', async () => {
		await getActivatedExtension();
		const allCommands = await vscode.commands.getCommands(true);
		for (const cmd of [
			'janumicode.startDialogue',
			'janumicode.openGovernedStream',
			'janumicode.showWorkflowStatus',
			'janumicode.findInStream',
		]) {
			assert.ok(allCommands.includes(cmd), `Expected command to remain registered: ${cmd}`);
		}
	});
});
