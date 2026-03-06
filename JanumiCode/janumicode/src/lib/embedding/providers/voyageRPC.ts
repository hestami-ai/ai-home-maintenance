/**
 * Voyage Local RPC Embedding Provider
 * Communicates with the voyage-embed Python CLI via stdio NDJSON RPC.
 * Uses voyage-4-nano ONNX model for local inference.
 *
 * Protocol: NDJSON lines over stdin/stdout
 * Messages: hello, embed, stats, validate, shutdown
 */

import { ChildProcess, spawn } from 'node:child_process';
import { createInterface, Interface as ReadlineInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import type { Result } from '../../types';
import type { EmbeddingProvider, EmbeddingResult, EmbedOptions } from '../provider';
import { getLogger, isLoggerInitialized } from '../../logging';
import * as vscode from 'vscode';

const DEFAULT_CLI_COMMAND = 'voyage-embed';
const DEFAULT_MODEL = 'onnx-community/voyage-4-nano-ONNX';
const DEFAULT_VARIANT = 'q4f16';
const HELLO_TIMEOUT_MS = 10_000;
const EMBED_TIMEOUT_MS = 30_000;

/**
 * RPC request/response types
 */
interface RPCMessage {
	id: string;
	method: string;
	[key: string]: unknown;
}

interface RPCResponse {
	id: string;
	method: string;
	[key: string]: unknown;
}

/**
 * Pending request tracker
 */
interface PendingRequest {
	resolve: (value: RPCResponse) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class VoyageRPCClient implements EmbeddingProvider {
	readonly name = 'voyage-local';
	readonly dimensions: number;

	private process: ChildProcess | null = null;
	private readline: ReadlineInterface | null = null;
	private pending = new Map<string, PendingRequest>();
	private ready = false;
	private cliCommand: string;
	private model: string;
	private variant: string;

	constructor(dimensions?: number) {
		this.dimensions = dimensions ?? 1024;
		const config = vscode.workspace.getConfiguration('janumicode');
		this.cliCommand = config.get<string>('embedding.localCliPath', DEFAULT_CLI_COMMAND);
		this.model = DEFAULT_MODEL;
		this.variant = DEFAULT_VARIANT;
	}

	async embed(texts: string[], options?: EmbedOptions): Promise<Result<EmbeddingResult[]>> {
		const logger = isLoggerInitialized()
			? getLogger().child({ component: 'embedding.voyage-local' })
			: undefined;

		if (texts.length === 0) {
			return { success: true, value: [] };
		}

		try {
			await this.ensureRunning();

			const response = await this.sendRequest('embed', {
				texts,
				input_type: options?.inputType ?? 'document',
				dimensions: options?.dimensions ?? this.dimensions,
			}, EMBED_TIMEOUT_MS);

			if (response.method === 'error') {
				return {
					success: false,
					error: new Error(`RPC error: ${response.message ?? 'unknown'}`),
				};
			}

			const embeddings = response.embeddings as Array<{ data: string; tokens: number; truncated: boolean }>;
			const results: EmbeddingResult[] = embeddings.map((e) => {
				const buffer = Buffer.from(e.data, 'base64');
				return {
					embedding: new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4),
					tokenCount: e.tokens,
					truncated: e.truncated,
				};
			});

			return { success: true, value: results };
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			logger?.error('Voyage RPC embedding failed', { error: msg });
			return {
				success: false,
				error: error instanceof Error ? error : new Error(msg),
			};
		}
	}

	async validateConnection(): Promise<Result<boolean>> {
		try {
			await this.ensureRunning();
			return { success: true, value: true };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error : new Error('Connection validation failed'),
			};
		}
	}

	/**
	 * Gracefully shut down the RPC process
	 */
	async shutdown(): Promise<void> {
		if (!this.process || !this.ready) {
			this.cleanup();
			return;
		}

		try {
			await this.sendRequest('shutdown', {}, 5_000);
		} catch {
			// Best-effort shutdown
		}

		this.cleanup();
	}

	private async ensureRunning(): Promise<void> {
		if (this.ready && this.process && !this.process.killed) {
			return;
		}

		await this.spawnProcess();
		await this.handshake();
	}

	private async spawnProcess(): Promise<void> {
		this.cleanup();

		this.process = spawn(this.cliCommand, [
			'rpc',
			'--model', this.model,
			'--variant', this.variant,
			'--provider', 'auto',
		], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env },
		});

		this.process.on('error', (err) => {
			const logger = isLoggerInitialized()
				? getLogger().child({ component: 'embedding.voyage-local' })
				: undefined;
			logger?.error('voyage-embed process error', { error: err.message });
			this.ready = false;
		});

		this.process.on('exit', (code) => {
			const logger = isLoggerInitialized()
				? getLogger().child({ component: 'embedding.voyage-local' })
				: undefined;
			logger?.info('voyage-embed process exited', { code });
			this.ready = false;
			// Reject all pending requests
			for (const [id, pending] of this.pending) {
				pending.reject(new Error(`Process exited with code ${code}`));
				clearTimeout(pending.timer);
				this.pending.delete(id);
			}
		});

		if (!this.process.stdout) {
			throw new Error('Failed to get stdout from voyage-embed process');
		}

		this.readline = createInterface({ input: this.process.stdout });
		this.readline.on('line', (line) => {
			try {
				const msg = JSON.parse(line) as RPCResponse;
				const pending = this.pending.get(msg.id);
				if (pending) {
					clearTimeout(pending.timer);
					this.pending.delete(msg.id);
					pending.resolve(msg);
				}
			} catch {
				// Ignore malformed lines
			}
		});
	}

	private async handshake(): Promise<void> {
		const response = await this.sendRequest('hello', {
			version: '1.0',
			dimensions: this.dimensions,
		}, HELLO_TIMEOUT_MS);

		if (response.method !== 'hello.ok') {
			throw new Error(`Handshake failed: unexpected response method '${response.method}'`);
		}

		this.ready = true;
	}

	private sendRequest(method: string, params: Record<string, unknown>, timeoutMs: number): Promise<RPCResponse> {
		return new Promise((resolve, reject) => {
			if (!this.process?.stdin || this.process.killed) {
				reject(new Error('RPC process not running'));
				return;
			}

			const id = randomUUID();
			const msg: RPCMessage = { id, method, ...params };

			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`RPC timeout after ${timeoutMs}ms for method '${method}'`));
			}, timeoutMs);

			this.pending.set(id, { resolve, reject, timer });

			const line = JSON.stringify(msg) + '\n';
			this.process.stdin.write(line, (err) => {
				if (err) {
					clearTimeout(timer);
					this.pending.delete(id);
					reject(err);
				}
			});
		});
	}

	private cleanup(): void {
		this.ready = false;

		for (const [id, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error('Cleanup'));
			this.pending.delete(id);
		}

		if (this.readline) {
			this.readline.close();
			this.readline = null;
		}

		if (this.process && !this.process.killed) {
			this.process.kill();
		}
		this.process = null;
	}
}

/**
 * Create a VoyageRPCClient instance.
 * Returns null if the CLI command is not available.
 */
export async function createVoyageRPCClient(
	dimensions?: number
): Promise<VoyageRPCClient | null> {
	// Quick check: try to see if the CLI exists
	try {
		const client = new VoyageRPCClient(dimensions);
		// Don't validate here — defer to first use
		return client;
	} catch {
		return null;
	}
}
