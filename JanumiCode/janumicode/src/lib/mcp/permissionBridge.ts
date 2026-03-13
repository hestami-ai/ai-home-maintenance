/**
 * Permission Bridge
 * HTTP server running in the extension host that receives permission requests
 * from the MCP permission server (child process of Claude Code CLI).
 *
 * Flow:
 *   Claude Code → MCP permission server → HTTP POST → this bridge → decision
 *
 * The bridge evaluates requests through the permission decision engine and
 * optionally surfaces human-facing permission cards in the Governed Stream.
 */

import * as http from 'http';
import { randomUUID } from 'crypto';
import {
	evaluatePermission,
	type PermissionRequest,
	type PermissionEvaluation,
} from './permissionDecisionEngine';

// ==================== SINGLETON REGISTRY ====================

/**
 * Active permission bridge singleton.
 * Set by executor during unit invocation, read by GovernedStreamPanel
 * to resolve human permission decisions from the webview.
 */
let activeBridge: PermissionBridge | null = null;

export function setActivePermissionBridge(bridge: PermissionBridge | null): void {
	activeBridge = bridge;
}

export function getActivePermissionBridge(): PermissionBridge | null {
	return activeBridge;
}

// ==================== TYPES ====================

export interface PermissionDecision {
	approved: boolean;
	reason: string;
}

export interface PermissionBridgeOptions {
	/** Pre-approved tool list (from mapUnitToolsToClaudeTools) */
	allowedTools: string[];
	/** Directory scope constraint from the task unit */
	maxChangeScope?: string;
	/**
	 * Callback invoked when a permission request requires human approval.
	 * The bridge awaits this callback before responding to the MCP server.
	 */
	onHumanPrompt?: (request: PermissionRequest) => Promise<PermissionDecision>;
}

// ==================== BRIDGE CLASS ====================

export class PermissionBridge {
	private server: http.Server | null = null;
	private port = 0;
	private options: PermissionBridgeOptions = { allowedTools: [] };
	private sessionApprovals = new Set<string>();

	/**
	 * Pending human decisions keyed by permission request ID.
	 * Used by the extension host to resolve decisions from the webview.
	 */
	private pendingDecisions = new Map<string, {
		resolve: (decision: PermissionDecision) => void;
		timeout: ReturnType<typeof setTimeout>;
	}>();

	/**
	 * Start the HTTP permission listener on a random localhost port.
	 * @returns The port number for the MCP server to connect to.
	 */
	async start(options: PermissionBridgeOptions): Promise<number> {
		this.options = options;
		this.sessionApprovals.clear();

		return new Promise<number>((resolve, reject) => {
			this.server = http.createServer((req, res) => {
				this.handleRequest(req, res);
			});

			this.server.listen(0, '127.0.0.1', () => {
				const addr = this.server!.address();
				if (addr && typeof addr === 'object') {
					this.port = addr.port;
					resolve(this.port);
				} else {
					reject(new Error('Failed to bind permission bridge server'));
				}
			});

			this.server.on('error', reject);
		});
	}

	/**
	 * Stop the HTTP listener and reject any pending decisions.
	 */
	async stop(): Promise<void> {
		// Reject all pending human decisions
		for (const [id, pending] of this.pendingDecisions) {
			clearTimeout(pending.timeout);
			pending.resolve({ approved: false, reason: 'Permission bridge shutting down' });
			this.pendingDecisions.delete(id);
		}

		if (this.server) {
			return new Promise<void>((resolve) => {
				this.server!.close(() => {
					this.server = null;
					this.port = 0;
					resolve();
				});
			});
		}
	}

	getPort(): number {
		return this.port;
	}

	/**
	 * Add a tool to session-level "Approve All" memory.
	 */
	addSessionApproval(toolName: string): void {
		this.sessionApprovals.add(toolName);
	}

	/**
	 * Resolve a pending human permission decision.
	 * Called by GovernedStreamPanel when the user clicks Approve/Deny.
	 */
	resolveDecision(permissionId: string, decision: PermissionDecision, approveAll?: boolean): void {
		const pending = this.pendingDecisions.get(permissionId);
		if (!pending) { return; }

		clearTimeout(pending.timeout);
		this.pendingDecisions.delete(permissionId);

		if (approveAll && decision.approved) {
			// Extract tool name from the stored request context
			// (toolName is embedded in the permissionId as prefix for convenience)
			const toolName = permissionId.split(':')[0];
			if (toolName) {
				this.sessionApprovals.add(toolName);
			}
		}

		pending.resolve(decision);
	}

	// ==================== INTERNAL ====================

	private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		// Only accept POST /permission
		if (req.method !== 'POST' || req.url !== '/permission') {
			res.writeHead(404);
			res.end(JSON.stringify({ error: 'Not found' }));
			return;
		}

		let body = '';
		for await (const chunk of req) {
			body += chunk;
			if (body.length > 100_000) {
				res.writeHead(413);
				res.end(JSON.stringify({ error: 'Request too large' }));
				return;
			}
		}

		let request: PermissionRequest;
		try {
			request = JSON.parse(body) as PermissionRequest;
		} catch {
			res.writeHead(400);
			res.end(JSON.stringify({ error: 'Invalid JSON' }));
			return;
		}

		try {
			const decision = await this.evaluateRequest(request);
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(decision));
		} catch (error) {
			res.writeHead(500);
			res.end(JSON.stringify({
				approved: false,
				reason: error instanceof Error ? error.message : 'Internal error',
			}));
		}
	}

	private async evaluateRequest(request: PermissionRequest): Promise<PermissionDecision> {
		const evaluation: PermissionEvaluation = evaluatePermission(
			request,
			this.options.allowedTools,
			this.options.maxChangeScope,
			this.sessionApprovals,
		);

		if (evaluation.decision === 'approve') {
			return { approved: true, reason: evaluation.reason };
		}

		if (evaluation.decision === 'deny') {
			return { approved: false, reason: evaluation.reason };
		}

		// ask_human — surface permission card and wait
		if (this.options.onHumanPrompt) {
			return this.waitForHumanDecision(request);
		}

		// No human prompt callback — default deny
		return { approved: false, reason: 'No human decision handler available' };
	}

	private waitForHumanDecision(request: PermissionRequest): Promise<PermissionDecision> {
		const permissionId = `${request.tool}:${randomUUID()}`;
		const TIMEOUT_MS = 120_000; // 2 minutes

		return new Promise<PermissionDecision>((resolve) => {
			const timeout = setTimeout(() => {
				this.pendingDecisions.delete(permissionId);
				resolve({ approved: false, reason: 'Permission request timed out (120s)' });
			}, TIMEOUT_MS);

			this.pendingDecisions.set(permissionId, { resolve, timeout });

			// Surface the permission card to the human
			this.options.onHumanPrompt!({
				...request,
				// Attach permissionId for resolution routing
				input: { ...request.input, _permissionId: permissionId },
			}).then((decision) => {
				// If onHumanPrompt resolves directly (not via resolveDecision),
				// clean up the pending entry
				if (this.pendingDecisions.has(permissionId)) {
					clearTimeout(timeout);
					this.pendingDecisions.delete(permissionId);
					resolve(decision);
				}
			}).catch(() => {
				if (this.pendingDecisions.has(permissionId)) {
					clearTimeout(timeout);
					this.pendingDecisions.delete(permissionId);
					resolve({ approved: false, reason: 'Human prompt handler failed' });
				}
			});
		});
	}
}
