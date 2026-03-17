/**
 * Speech-to-Text Service
 *
 * Records audio via SoX `rec` CLI and transcribes using either:
 *   - OpenAI Whisper API (cloud, uses existing `openai` SDK)
 *   - Local `whisper` CLI (offline, user-installed)
 *
 * Runs in the extension host (Node.js). VS Code webviews cannot
 * access the microphone, so recording must happen here.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import OpenAI from 'openai';
import { LLMProvider } from '../types';
import { getSecretKeyManager } from '../config/secretKeyManager';
import { getLogger, isLoggerInitialized } from '../logging';

const IS_WINDOWS = process.platform === 'win32';

// ==================== TYPES ====================

export type SpeechBackend = 'whisper-api' | 'whisper-local';

export interface SpeechToTextConfig {
	backend: SpeechBackend;
	openaiApiKey?: string;
	whisperModel: string;
	localWhisperPath: string;
	soxRecPath: string;
	language?: string;
}

interface RecordingSession {
	tempFilePath: string;
	process: ChildProcess;
	startTime: number;
}

// ==================== CONFIG RESOLVER ====================

/**
 * Read speech settings from VS Code configuration and resolve the API key.
 */
export async function resolveSpeechConfig(): Promise<SpeechToTextConfig> {
	const cfg = vscode.workspace.getConfiguration('janumicode.speech');
	const backend = cfg.get<SpeechBackend>('backend', 'whisper-api');

	let openaiApiKey: string | undefined;
	if (backend === 'whisper-api') {
		// Try provider-generic env var first
		openaiApiKey = process.env.OPENAI_API_KEY;
		if (!openaiApiKey) {
			try {
				const key = await getSecretKeyManager().getApiKey('speech', LLMProvider.OPENAI);
				if (key) { openaiApiKey = key; }
			} catch { /* SecretStorage may not be initialized yet */ }
		}
	}

	return {
		backend,
		openaiApiKey,
		whisperModel: cfg.get<string>('model', backend === 'whisper-api' ? 'whisper-1' : 'base.en'),
		localWhisperPath: cfg.get<string>('localWhisperPath', 'whisper'),
		soxRecPath: cfg.get<string>('soxRecPath', 'rec'),
		language: cfg.get<string>('language', '') || undefined,
	};
}

// ==================== SERVICE ====================

export class SpeechToTextService {
	private _recording: RecordingSession | null = null;
	private _soxAvailable: boolean | null = null;

	get isRecording(): boolean {
		return this._recording !== null;
	}

	/** Returns the cached SoX availability result, or null if not yet checked. */
	get soxAvailable(): boolean | null {
		return this._soxAvailable;
	}

	/**
	 * Check if SoX `rec` is available on this system.
	 * Caches the result after the first call.
	 */
	async checkSoxAvailable(recPath: string = 'rec'): Promise<boolean> {
		if (this._soxAvailable !== null) { return this._soxAvailable; }

		const recCmd = recPath;
		this._soxAvailable = await new Promise<boolean>((resolve) => {
			const proc = spawn(recCmd, ['--version'], {
				stdio: ['pipe', 'pipe', 'pipe'],
				...(IS_WINDOWS ? { shell: true } : {}),
			});
			const timeout = setTimeout(() => { try { proc.kill(); } catch {} resolve(false); }, 3000);
			proc.on('error', () => { clearTimeout(timeout); resolve(false); });
			proc.on('close', (code) => { clearTimeout(timeout); resolve(code === 0); });
		});

		this._log('debug', `SoX availability check: ${this._soxAvailable}`, { recCmd });
		return this._soxAvailable;
	}

	/** Reset the cached SoX availability (e.g. after config change). */
	resetAvailabilityCache(): void {
		this._soxAvailable = null;
	}

	/**
	 * Start recording audio via SoX `rec`.
	 * Records 16kHz mono WAV to a temp file (optimal for Whisper).
	 */
	async startRecording(config: SpeechToTextConfig): Promise<void> {
		if (this._recording) {
			throw new Error('Recording already in progress');
		}

		const tempFile = path.join(os.tmpdir(), `janumicode-speech-${Date.now()}.wav`);
		const recCmd = config.soxRecPath || 'rec';

		const args = [
			tempFile,
			'rate', '16000',
			'channels', '1',
		];

		this._log('debug', 'Starting audio recording', { recCmd, tempFile });

		const proc = spawn(recCmd, args, {
			stdio: ['pipe', 'pipe', 'pipe'],
			...(IS_WINDOWS ? { shell: true } : {}),
		});

		return new Promise<void>((resolve, reject) => {
			let settled = false;

			const fail = (err: Error) => {
				if (settled) { return; }
				settled = true;
				this._recording = null;
				this._cleanupTempFile(tempFile);
				reject(err);
			};

			// ENOENT fires on non-Windows when the binary isn't found
			proc.on('error', (err) => {
				fail(this._enrichRecError(err, recCmd));
			});

			// On Windows with shell:true, cmd.exe spawns fine but `rec` fails
			// inside the shell — we get a quick close with non-zero exit code
			// instead of an ENOENT error event.
			proc.on('close', (code) => {
				if (!settled && code !== null && code !== 0) {
					fail(this._enrichRecError(
						Object.assign(new Error(`rec exited immediately with code ${code}`), { code: 'ENOENT' }),
						recCmd,
					));
				}
			});

			// If the process is still alive after 500ms, recording is working
			setTimeout(() => {
				if (!settled) {
					settled = true;
					this._recording = {
						tempFilePath: tempFile,
						process: proc,
						startTime: Date.now(),
					};
					resolve();
				}
			}, 500);
		});
	}

	/**
	 * Stop the active recording and return the path to the WAV file.
	 */
	async stopRecording(): Promise<string> {
		if (!this._recording) {
			throw new Error('No recording in progress');
		}

		const { tempFilePath, process: proc, startTime } = this._recording;
		this._recording = null;

		const duration = Date.now() - startTime;
		this._log('debug', 'Stopping recording', { duration, tempFilePath });

		return new Promise<string>((resolve, reject) => {
			proc.on('close', () => {
				try {
					const stats = fs.statSync(tempFilePath);
					if (stats.size < 100) {
						this._cleanupTempFile(tempFilePath);
						reject(new Error('Recording too short or empty. Try holding the mic button longer.'));
						return;
					}
					resolve(tempFilePath);
				} catch {
					reject(new Error('Recording file not found after stopping'));
				}
			});

			if (IS_WINDOWS && proc.pid) {
				spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { shell: true });
			} else {
				proc.kill('SIGTERM');
			}
		});
	}

	/**
	 * Transcribe a WAV file using the configured backend.
	 * Always cleans up the temp file when done.
	 */
	async transcribe(wavPath: string, config: SpeechToTextConfig): Promise<string> {
		try {
			if (config.backend === 'whisper-api') {
				return await this._transcribeWithWhisperApi(wavPath, config);
			} else {
				return await this._transcribeWithLocalWhisper(wavPath, config);
			}
		} finally {
			this._cleanupTempFile(wavPath);
		}
	}

	/**
	 * Cancel any active recording, cleaning up temp files.
	 */
	cancel(): void {
		if (!this._recording) { return; }

		const { tempFilePath, process: proc } = this._recording;
		this._recording = null;

		try {
			if (IS_WINDOWS && proc.pid) {
				spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { shell: true });
			} else {
				proc.kill('SIGTERM');
			}
		} catch { /* process may already be dead */ }

		this._cleanupTempFile(tempFilePath);
		this._log('debug', 'Recording cancelled');
	}

	// ==================== PRIVATE: TRANSCRIPTION ====================

	private async _transcribeWithWhisperApi(
		wavPath: string,
		config: SpeechToTextConfig,
	): Promise<string> {
		if (!config.openaiApiKey) {
			throw new Error(
				'OpenAI API key required for Whisper transcription. '
				+ 'Set OPENAI_API_KEY environment variable or configure via JanumiCode: Set API Key.',
			);
		}

		this._log('debug', 'Transcribing via Whisper API', { model: config.whisperModel });

		const client = new OpenAI({ apiKey: config.openaiApiKey });
		const fileStream = fs.createReadStream(wavPath);

		const result = await client.audio.transcriptions.create({
			file: fileStream,
			model: config.whisperModel || 'whisper-1',
			language: config.language,
			response_format: 'text',
		});

		const text = typeof result === 'string' ? result : (result as { text: string }).text;
		this._log('debug', 'Whisper API transcription complete', { textLength: text.length });
		return text.trim();
	}

	private async _transcribeWithLocalWhisper(
		wavPath: string,
		config: SpeechToTextConfig,
	): Promise<string> {
		const whisperCmd = config.localWhisperPath || 'whisper';
		const args = [
			wavPath,
			'--model', config.whisperModel || 'base.en',
			'--output_format', 'txt',
			'--output_dir', path.dirname(wavPath),
		];
		if (config.language) {
			args.push('--language', config.language);
		}

		this._log('debug', 'Transcribing via local whisper', { whisperCmd, model: config.whisperModel });

		return new Promise<string>((resolve, reject) => {
			const proc = spawn(whisperCmd, args, {
				stdio: ['pipe', 'pipe', 'pipe'],
				...(IS_WINDOWS ? { shell: true } : {}),
			});

			let stderr = '';
			proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

			proc.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`Local whisper failed (exit ${code}): ${stderr.slice(0, 500)}`));
					return;
				}
				// whisper CLI writes <filename>.txt next to the input
				const txtPath = wavPath.replace(/\.wav$/, '.txt');
				try {
					const text = fs.readFileSync(txtPath, 'utf-8').trim();
					try { fs.unlinkSync(txtPath); } catch { /* ignore cleanup error */ }
					this._log('debug', 'Local whisper transcription complete', { textLength: text.length });
					resolve(text);
				} catch {
					reject(new Error('Local whisper output file not found'));
				}
			});

			proc.on('error', (err) => {
				if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
					reject(new Error(
						`Local whisper CLI not found at "${whisperCmd}". `
						+ 'Install: pip install openai-whisper  '
						+ 'Or set janumicode.speech.localWhisperPath in settings.',
					));
				} else {
					reject(new Error(`Local whisper error: ${err.message}`));
				}
			});
		});
	}

	// ==================== PRIVATE: HELPERS ====================

	private _enrichRecError(err: Error, recCmd: string): Error {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			const hint = IS_WINDOWS
				? 'Install SoX: choco install sox.portable  (or download from https://sox.sourceforge.net/)'
				: process.platform === 'darwin'
					? 'Install SoX: brew install sox'
					: 'Install SoX: sudo apt install sox';

			return new Error(
				`SoX 'rec' not found at "${recCmd}". ${hint}. `
				+ 'Configure path: janumicode.speech.soxRecPath',
			);
		}
		return err;
	}

	private _cleanupTempFile(filePath: string): void {
		try {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		} catch { /* ignore cleanup error */ }
	}

	private _log(level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: Record<string, unknown>): void {
		if (isLoggerInitialized()) {
			const logger = getLogger().child({ component: 'speech' });
			logger[level](msg, ctx);
		}
	}
}
