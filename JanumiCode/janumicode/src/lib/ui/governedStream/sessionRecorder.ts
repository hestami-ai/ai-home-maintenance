/**
 * Session Recorder for the Governed Stream.
 *
 * Captures all webview-bound postMessage payloads to a JSONL file so sessions
 * can be replayed later for visual diagnostics — without re-running the workflow.
 *
 * Usage:
 *   recorder.start(dialogueId)   — begin capturing
 *   recorder.record(payload)     — call inside _postToWebview
 *   await recorder.stop()        — flush to .janumicode/recordings/session-*.jsonl
 *   await SessionRecorder.replay(filePath, postFn, delayMs) — re-drive events
 */

import * as vscode from 'vscode';
import * as path from 'path';

// ==================== Types ====================

interface RecordedEvent {
	/** Milliseconds since recording started. */
	ts: number;
	/** Verbatim postMessage payload. */
	payload: unknown;
}

// ==================== Helpers ====================

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== SessionRecorder ====================

export class SessionRecorder {
	private _events: RecordedEvent[] = [];
	private _active = false;
	private _startTs = 0;
	private _dialogueId = 'unknown';

	get isActive(): boolean { return this._active; }

	/** Start a new recording session, discarding any previous buffer. */
	start(dialogueId: string): void {
		this._events = [];
		this._active = true;
		this._startTs = Date.now();
		this._dialogueId = dialogueId;
	}

	/** Record a single postMessage payload. No-op when not recording. */
	record(payload: unknown): void {
		if (!this._active) { return; }
		this._events.push({ ts: Date.now() - this._startTs, payload });
	}

	/** Stop recording and flush to a JSONL file. Returns the file path, or null on failure. */
	async stop(): Promise<string | null> {
		if (!this._active) { return null; }
		this._active = false;
		return this._flush();
	}

	private async _flush(): Promise<string | null> {
		try {
			const wsFolders = vscode.workspace.workspaceFolders;
			if (!wsFolders?.length || this._events.length === 0) { return null; }

			const ts = new Date().toISOString().replace(/[:.]/g, '-');
			const prefix = this._dialogueId.slice(0, 8);
			const filename = `session-${prefix}-${ts}.jsonl`;

			const dir = vscode.Uri.joinPath(wsFolders[0].uri, '.janumicode', 'recordings');
			await vscode.workspace.fs.createDirectory(dir);

			const fileUri = vscode.Uri.joinPath(dir, filename);
			const content = this._events.map((e) => JSON.stringify(e)).join('\n');
			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));

			return fileUri.fsPath;
		} catch (err) {
			console.error('[SessionRecorder] Failed to flush recording:', err);
			return null;
		}
	}

	// ==================== Replay ====================

	/**
	 * Replay a previously recorded session into a webview.
	 *
	 * @param filePath  Absolute path to the .jsonl recording file.
	 * @param postFn    Function that sends a payload to the webview (i.e. _postToWebview).
	 * @param delayMs   Milliseconds between events (default: 80).
	 */
	static async replay(
		filePath: string,
		postFn: (payload: unknown) => void,
		delayMs = 80
	): Promise<void> {
		const uri = vscode.Uri.file(filePath);
		const raw = await vscode.workspace.fs.readFile(uri);
		const text = Buffer.from(raw).toString('utf-8');
		const lines = text.split('\n').filter(Boolean);

		if (lines.length === 0) {
			vscode.window.showWarningMessage('Recording file is empty.');
			return;
		}

		const events: RecordedEvent[] = lines.map((l) => JSON.parse(l) as RecordedEvent);

		// Clear the stream before replaying
		postFn({ type: 'clearStream' });
		await sleep(200);

		for (const ev of events) {
			postFn(ev.payload);
			await sleep(delayMs);
		}
	}
}

// ==================== File Picker ====================

/**
 * Show a file open dialog filtered to .janumicode/recordings/*.jsonl.
 * Returns the selected file path or null if cancelled.
 */
export async function pickRecordingFile(): Promise<string | null> {
	const wsFolders = vscode.workspace.workspaceFolders;
	const defaultUri = wsFolders?.length
		? vscode.Uri.joinPath(wsFolders[0].uri, '.janumicode', 'recordings')
		: undefined;

	const result = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		defaultUri,
		filters: { 'Session Recordings': ['jsonl'], 'All Files': ['*'] },
		title: 'Open Session Recording',
	});

	return result?.[0]?.fsPath ?? null;
}
