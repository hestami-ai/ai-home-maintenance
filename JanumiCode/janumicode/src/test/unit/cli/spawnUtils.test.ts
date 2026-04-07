import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	resolveWorkingDirectory,
	setWorkflowAbortSignal,
	getWorkflowAbortSignal,
	killAllActiveProcesses,
	getActiveProcessCount,
} from '../../../lib/cli/spawnUtils';
import * as vscode from 'vscode';

vi.mock('vscode');

describe('Spawn Utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		setWorkflowAbortSignal(undefined);
	});

	describe('resolveWorkingDirectory', () => {
		it('returns explicit directory when provided', () => {
			const explicitDir = '/test/explicit/dir';
			const result = resolveWorkingDirectory(explicitDir);

			expect(result).toBe(explicitDir);
		});

		it('returns VS Code workspace folder when no explicit dir', () => {
			const workspaceFolder = '/test/workspace';
			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const result = resolveWorkingDirectory();

			expect(result).toBe(workspaceFolder);
		});

		it('throws when no workspace and no explicit dir', () => {
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			expect(() => resolveWorkingDirectory()).toThrow('NO_WORKSPACE');
		});

		it('prefers explicit directory over workspace', () => {
			const explicitDir = '/test/explicit';
			const workspaceFolder = '/test/workspace';
			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const result = resolveWorkingDirectory(explicitDir);

			expect(result).toBe(explicitDir);
		});

		it('handles empty string as explicit directory', () => {
			const workspaceFolder = '/test/workspace';
			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const result = resolveWorkingDirectory('');

			expect(result).toBe(workspaceFolder);
		});

		it('uses first workspace folder when multiple exist', () => {
			const firstFolder = '/test/workspace1';
			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: firstFolder } as any,
					name: 'first',
					index: 0,
				},
				{
					uri: { fsPath: '/test/workspace2' } as any,
					name: 'second',
					index: 1,
				},
			];

			const result = resolveWorkingDirectory();

			expect(result).toBe(firstFolder);
		});

		it('handles Windows paths', () => {
			const windowsPath = 'C:\\Users\\test\\workspace';
			const result = resolveWorkingDirectory(windowsPath);

			expect(result).toBe(windowsPath);
		});

		it('handles Unix paths', () => {
			const unixPath = '/home/user/workspace';
			const result = resolveWorkingDirectory(unixPath);

			expect(result).toBe(unixPath);
		});

		it('handles relative paths', () => {
			const relativePath = './relative/path';
			const result = resolveWorkingDirectory(relativePath);

			expect(result).toBe(relativePath);
		});

		it('includes helpful message in error', () => {
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			expect(() => resolveWorkingDirectory()).toThrow('Open a folder or workspace first');
		});
	});

	describe('workflow abort signal', () => {
		it('sets and gets workflow abort signal', () => {
			const controller = new AbortController();
			setWorkflowAbortSignal(controller.signal);

			const result = getWorkflowAbortSignal();

			expect(result).toBe(controller.signal);
		});

		it('clears workflow abort signal', () => {
			const controller = new AbortController();
			setWorkflowAbortSignal(controller.signal);
			setWorkflowAbortSignal(undefined);

			const result = getWorkflowAbortSignal();

			expect(result).toBeUndefined();
		});

		it('returns undefined when not set', () => {
			const result = getWorkflowAbortSignal();

			expect(result).toBeUndefined();
		});

		it('replaces existing signal when set again', () => {
			const controller1 = new AbortController();
			const controller2 = new AbortController();

			setWorkflowAbortSignal(controller1.signal);
			setWorkflowAbortSignal(controller2.signal);

			const result = getWorkflowAbortSignal();

			expect(result).toBe(controller2.signal);
		});

		it('handles aborted signal', () => {
			const controller = new AbortController();
			controller.abort();
			setWorkflowAbortSignal(controller.signal);

			const result = getWorkflowAbortSignal();

			expect(result?.aborted).toBe(true);
		});
	});

	describe('active process management', () => {
		it('returns zero count initially', () => {
			const count = getActiveProcessCount();

			expect(count).toBe(0);
		});

		it('kills all active processes', () => {
			const killed = killAllActiveProcesses();

			expect(killed).toBeGreaterThanOrEqual(0);
		});

		it('clears active processes after kill', () => {
			killAllActiveProcesses();
			const count = getActiveProcessCount();

			expect(count).toBe(0);
		});

		it('returns kill count', () => {
			const killed = killAllActiveProcesses();

			expect(typeof killed).toBe('number');
		});

		it('handles kill with no active processes', () => {
			const killed = killAllActiveProcesses();

			expect(killed).toBe(0);
		});

		it('can be called multiple times', () => {
			killAllActiveProcesses();
			killAllActiveProcesses();
			const count = getActiveProcessCount();

			expect(count).toBe(0);
		});
	});

	describe('edge cases', () => {
		it('handles undefined workspace folders array', () => {
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			expect(() => resolveWorkingDirectory()).toThrow();
		});

		it('handles empty workspace folders array', () => {
			vi.mocked(vscode.workspace).workspaceFolders = [];

			expect(() => resolveWorkingDirectory()).toThrow();
		});

		it('handles null explicit directory', () => {
			const workspaceFolder = '/test/workspace';
			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const result = resolveWorkingDirectory(null as any);

			expect(result).toBe(workspaceFolder);
		});

		it('handles undefined explicit directory', () => {
			const workspaceFolder = '/test/workspace';
			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const result = resolveWorkingDirectory(undefined);

			expect(result).toBe(workspaceFolder);
		});

		it('handles very long path', () => {
			const longPath = '/test/' + 'a'.repeat(1000);
			const result = resolveWorkingDirectory(longPath);

			expect(result).toBe(longPath);
		});

		it('handles path with spaces', () => {
			const pathWithSpaces = '/test/path with spaces/workspace';
			const result = resolveWorkingDirectory(pathWithSpaces);

			expect(result).toBe(pathWithSpaces);
		});

		it('handles path with special characters', () => {
			const specialPath = '/test/path-with_special.chars/workspace';
			const result = resolveWorkingDirectory(specialPath);

			expect(result).toBe(specialPath);
		});

		it('handles path with unicode', () => {
			const unicodePath = '/test/日本語/workspace';
			const result = resolveWorkingDirectory(unicodePath);

			expect(result).toBe(unicodePath);
		});
	});

	describe('abort signal lifecycle', () => {
		it('signal remains accessible after setting', () => {
			const controller = new AbortController();
			setWorkflowAbortSignal(controller.signal);

			const signal1 = getWorkflowAbortSignal();
			const signal2 = getWorkflowAbortSignal();

			expect(signal1).toBe(signal2);
		});

		it('signal state changes are reflected', () => {
			const controller = new AbortController();
			setWorkflowAbortSignal(controller.signal);

			const signal = getWorkflowAbortSignal();
			expect(signal?.aborted).toBe(false);

			controller.abort();
			expect(signal?.aborted).toBe(true);
		});

		it('handles multiple sequential workflows', () => {
			const controller1 = new AbortController();
			setWorkflowAbortSignal(controller1.signal);
			setWorkflowAbortSignal(undefined);

			const controller2 = new AbortController();
			setWorkflowAbortSignal(controller2.signal);

			const result = getWorkflowAbortSignal();
			expect(result).toBe(controller2.signal);
		});

		it('handles abort reason', () => {
			const controller = new AbortController();
			const reason = new Error('User cancelled');
			setWorkflowAbortSignal(controller.signal);

			controller.abort(reason);

			const signal = getWorkflowAbortSignal();
			expect(signal?.reason).toBe(reason);
		});
	});

	describe('working directory resolution priority', () => {
		it('explicit directory has highest priority', () => {
			const explicitDir = '/explicit';
			const workspaceFolder = '/workspace';

			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const result = resolveWorkingDirectory(explicitDir);

			expect(result).toBe(explicitDir);
			expect(result).not.toBe(workspaceFolder);
		});

		it('workspace folder is fallback', () => {
			const workspaceFolder = '/workspace';

			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const result = resolveWorkingDirectory();

			expect(result).toBe(workspaceFolder);
		});

		it('error when no options available', () => {
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			expect(() => resolveWorkingDirectory()).toThrow();
		});
	});

	describe('concurrent operations', () => {
		it('handles concurrent resolve calls', () => {
			const workspaceFolder = '/workspace';
			vi.mocked(vscode.workspace).workspaceFolders = [
				{
					uri: { fsPath: workspaceFolder } as any,
					name: 'test',
					index: 0,
				},
			];

			const results = [
				resolveWorkingDirectory(),
				resolveWorkingDirectory(),
				resolveWorkingDirectory(),
			];

			expect(results.every(r => r === workspaceFolder)).toBe(true);
		});

		it('handles concurrent signal operations', () => {
			const controller1 = new AbortController();
			const controller2 = new AbortController();

			setWorkflowAbortSignal(controller1.signal);
			setWorkflowAbortSignal(controller2.signal);

			const result = getWorkflowAbortSignal();
			expect(result).toBe(controller2.signal);
		});

		it('handles concurrent kill operations', () => {
			const killed1 = killAllActiveProcesses();
			const killed2 = killAllActiveProcesses();

			expect(killed1).toBe(0);
			expect(killed2).toBe(0);
		});
	});

	describe('error messages', () => {
		it('error includes NO_WORKSPACE code', () => {
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			try {
				resolveWorkingDirectory();
				expect.fail('Should have thrown');
			} catch (error: any) {
				expect(error.code).toBe('NO_WORKSPACE');
			}
		});

		it('error message is user-friendly', () => {
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			try {
				resolveWorkingDirectory();
				expect.fail('Should have thrown');
			} catch (error: any) {
				expect(error.message).toContain('workspace folder');
				expect(error.message).toContain('Open a folder');
			}
		});

		it('error suggests File menu action', () => {
			vi.mocked(vscode.workspace).workspaceFolders = undefined;

			try {
				resolveWorkingDirectory();
				expect.fail('Should have thrown');
			} catch (error: any) {
				expect(error.message).toContain('File');
				expect(error.message).toContain('Open Folder');
			}
		});
	});

	describe('process count accuracy', () => {
		it('count is zero after cleanup', () => {
			killAllActiveProcesses();
			expect(getActiveProcessCount()).toBe(0);
		});

		it('count is consistent across multiple reads', () => {
			const count1 = getActiveProcessCount();
			const count2 = getActiveProcessCount();
			const count3 = getActiveProcessCount();

			expect(count1).toBe(count2);
			expect(count2).toBe(count3);
		});
	});

	describe('signal management patterns', () => {
		it('supports workflow start pattern', () => {
			const controller = new AbortController();
			setWorkflowAbortSignal(controller.signal);

			expect(getWorkflowAbortSignal()).toBeDefined();
		});

		it('supports workflow end pattern', () => {
			const controller = new AbortController();
			setWorkflowAbortSignal(controller.signal);
			setWorkflowAbortSignal(undefined);

			expect(getWorkflowAbortSignal()).toBeUndefined();
		});

		it('supports workflow cancel pattern', () => {
			const controller = new AbortController();
			setWorkflowAbortSignal(controller.signal);

			controller.abort();
			killAllActiveProcesses();

			expect(getWorkflowAbortSignal()?.aborted).toBe(true);
		});
	});
});
