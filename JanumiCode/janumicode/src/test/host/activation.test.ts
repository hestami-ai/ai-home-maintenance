import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation', () => {
	test('extension is present', () => {
		const ext = vscode.extensions.getExtension('undefined_publisher.janumicode');
		assert.notStrictEqual(ext, undefined, 'Extension should be found');
	});

	test('extension activates without error', async () => {
		const ext = vscode.extensions.getExtension('undefined_publisher.janumicode');
		assert.notStrictEqual(ext, undefined, 'Extension should be found');
		if (ext && !ext.isActive) {
			await ext.activate();
		}
		assert.strictEqual(ext!.isActive, true, 'Extension should be active');
	});
});
