import * as assert from 'assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

suite('Registered Commands', () => {
	const extensionId = 'undefined_publisher.janumicode';

	async function ensureActivated(): Promise<void> {
		const ext = vscode.extensions.getExtension(extensionId);
		assert.ok(ext, `Extension ${extensionId} should be installed`);
		if (!ext.isActive) {
			await ext.activate();
		}
		assert.strictEqual(ext.isActive, true, 'Extension should be active');
	}

	test('registered commands include core JanumiCode commands', async () => {
		await ensureActivated();
		const allCommands = await vscode.commands.getCommands(true);

		const expectedCommands = [
			'janumicode.startDialogue',
			'janumicode.showWorkflowStatus',
			'janumicode.exportHistory',
			'janumicode.exportDiagnosticSnapshot',
			'janumicode.openGovernedStream',
		];

		for (const cmd of expectedCommands) {
			assert.ok(
				allCommands.includes(cmd),
				`Command "${cmd}" should be registered`
			);
		}
	});

	test('exportDiagnosticSnapshot writes snapshot file when target path is provided', async () => {
		await ensureActivated();

		const targetPath = path.join(
			os.tmpdir(),
			`janumicode-diagnostic-snapshot-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
		);

		try {
			await vscode.commands.executeCommand('janumicode.exportDiagnosticSnapshot', targetPath);
			assert.ok(fs.existsSync(targetPath), 'Snapshot file should be created');

			const content = fs.readFileSync(targetPath, 'utf8');
			const snapshot = JSON.parse(content) as {
				generatedAt?: string;
				database?: unknown;
				logs?: unknown[];
				rows?: unknown;
			};

			assert.ok(typeof snapshot.generatedAt === 'string', 'Snapshot should include generatedAt');
			assert.ok(snapshot.database, 'Snapshot should include database diagnostics');
			assert.ok(Array.isArray(snapshot.logs), 'Snapshot should include logs array');
			assert.ok(snapshot.rows, 'Snapshot should include rows payload');
		} finally {
			if (fs.existsSync(targetPath)) {
				fs.unlinkSync(targetPath);
			}
		}
	});
});
