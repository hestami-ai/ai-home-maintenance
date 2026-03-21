/**
 * Speech-to-text handlers for GovernedStreamPanel.
 * Extracted to reduce main class LOC — manages SoX recording, transcription, and webview messaging.
 */

import * as vscode from 'vscode';
import { SpeechToTextService, resolveSpeechConfig } from '../../speech/speechToTextService';

/**
 * Manages speech-to-text lifecycle and webview messaging.
 * Owns the SpeechToTextService instance and recording target state.
 */
export class SpeechHandler {
	private _service: SpeechToTextService | null = null;
	private _targetInputId: string | null = null;

	get service(): SpeechToTextService {
		if (!this._service) {
			this._service = new SpeechToTextService();
		}
		return this._service;
	}

	get soxAvailable(): boolean {
		return this._service?.soxAvailable ?? false;
	}

	async sendCapability(webview: vscode.Webview): Promise<void> {
		const cfg = vscode.workspace.getConfiguration('janumicode.speech');
		const enabled = cfg.get<boolean>('enabled', true);

		if (!enabled) {
			webview.postMessage({ type: 'speechCapability', data: { enabled: false, soxAvailable: false } });
			return;
		}

		const recPath = cfg.get<string>('soxRecPath', 'rec');
		const svc = this.service;
		const soxAvailable = await svc.checkSoxAvailable(recPath);

		if (!soxAvailable) {
			const hint = process.platform === 'win32'
				? 'Install: choco install sox.portable (or download from https://sox.sourceforge.net/)'
				: process.platform === 'darwin'
					? 'Install: brew install sox'
					: 'Install: sudo apt install sox';
			vscode.window.showWarningMessage(
				`Speech-to-text requires SoX but 'rec' was not found. ${hint}`,
			);
		}

		webview.postMessage({ type: 'speechCapability', data: { enabled, soxAvailable } });
	}

	async handleStart(targetInputId: string, webview: vscode.Webview): Promise<void> {
		try {
			const config = await resolveSpeechConfig();
			const svc = this.service;

			if (svc.isRecording) {
				await this.handleStop(webview);
				return;
			}

			this._targetInputId = targetInputId;
			await svc.startRecording(config);

			webview.postMessage({
				type: 'speechRecordingStarted',
				data: { targetInputId },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			webview.postMessage({
				type: 'speechError',
				data: { targetInputId, error: message },
			});
		}
	}

	async handleStop(webview: vscode.Webview): Promise<void> {
		const svc = this.service;
		const targetInputId = this._targetInputId || '';

		try {
			webview.postMessage({
				type: 'speechTranscribing',
				data: { targetInputId },
			});

			const wavPath = await svc.stopRecording();
			const config = await resolveSpeechConfig();
			const text = await svc.transcribe(wavPath, config);

			webview.postMessage({
				type: 'speechResult',
				data: { targetInputId, text },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			webview.postMessage({
				type: 'speechError',
				data: { targetInputId, error: message },
			});
		} finally {
			this._targetInputId = null;
		}
	}

	handleCancel(webview: vscode.Webview): void {
		const svc = this.service;
		svc.cancel();
		if (this._targetInputId) {
			webview.postMessage({
				type: 'speechError',
				data: { targetInputId: this._targetInputId, error: 'Recording cancelled' },
			});
			this._targetInputId = null;
		}
	}

	cancel(): void {
		this.service.cancel();
	}
}
