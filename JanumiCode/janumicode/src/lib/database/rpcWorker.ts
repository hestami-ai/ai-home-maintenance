/**
 * Database RPC Worker Thread
 *
 * Runs inside a worker_threads Worker. Bridges the synchronous main thread
 * (which calls Atomics.wait) with the async sidecar process (NDJSON over stdio).
 *
 * Flow:
 *   Main thread → writes request to SharedArrayBuffer → Atomics.wait (blocks)
 *   Worker      → reads SAB → writes to sidecar stdin → reads stdout response
 *               → writes response to SAB → Atomics.notify (wakes main thread)
 *
 * The Worker owns the sidecar child process lifecycle.
 */

import { spawn, ChildProcess } from 'node:child_process';
import { createInterface, Interface as ReadlineInterface } from 'node:readline';
import { parentPort, workerData } from 'node:worker_threads';

// ── Constants ────────────────────────────────────────────────────────

/** SharedArrayBuffer layout offsets (bytes) */
const CTRL_OFFSET = 0;           // Int32: control flag
const REQ_LEN_OFFSET = 4;       // Int32: request JSON byte length
const RESP_LEN_OFFSET = 8;      // Int32: response JSON byte length
const DATA_OFFSET = 16;         // Uint8: start of data region

/** Control flag values */
const CTRL_IDLE = 0;
const CTRL_REQUEST_READY = 1;
const CTRL_RESPONSE_READY = 2;

/** Maximum message size in the SAB data region (split between req and resp) */
const MAX_MSG_SIZE = 4 * 1024 * 1024; // 4MB per message

// ── Worker Data ──────────────────────────────────────────────────────

interface WorkerInit {
	sharedBuffer: SharedArrayBuffer;
	nodeBinary: string;
	sidecarScript: string;
}

const { sharedBuffer, nodeBinary, sidecarScript } = workerData as WorkerInit;

const ctrl = new Int32Array(sharedBuffer, CTRL_OFFSET, 4); // 4 Int32s at start
const dataView = new Uint8Array(sharedBuffer, DATA_OFFSET);

// ── Sidecar Process Management ───────────────────────────────────────

let sidecar: ChildProcess | null = null;
let readline: ReadlineInterface | null = null;
let pendingResolve: ((line: string) => void) | null = null;
let sidecarReady = false;

function spawnSidecar(): Promise<void> {
	return new Promise((resolve, reject) => {
		sidecar = spawn(nodeBinary, [sidecarScript], {
			stdio: ['pipe', 'pipe', 'pipe'],
			// Don't inherit env — clean environment for the sidecar
			env: { ...process.env },
		});

		sidecar.on('error', (err) => {
			postLog(`Sidecar spawn error: ${err.message}`);
			if (!sidecarReady) { reject(err); }
		});

		sidecar.on('exit', (code, signal) => {
			postLog(`Sidecar exited: code=${code}, signal=${signal}`);
			sidecar = null;
			readline = null;
			sidecarReady = false;
			// Reject any pending request
			if (pendingResolve) {
				// We can't reject a resolve callback, so we return an error JSON
				const errorResp = JSON.stringify({
					id: '__sidecar_exit__',
					error: { code: 'SIDECAR_EXIT', message: `Sidecar exited: code=${code}` },
				});
				pendingResolve(errorResp);
				pendingResolve = null;
			}
		});

		// Forward stderr to parent for diagnostics
		sidecar.stderr?.on('data', (chunk: Buffer) => {
			postLog(`[sidecar stderr] ${chunk.toString().trim()}`);
		});

		readline = createInterface({ input: sidecar.stdout!, terminal: false });

		// Wait for the ready signal
		readline.once('line', (line: string) => {
			try {
				const msg = JSON.parse(line);
				if (msg.id === '__ready__' && msg.result?.ready) {
					sidecarReady = true;
					// Now set up the normal line handler
					readline!.on('line', handleSidecarResponse);
					resolve();
				} else {
					reject(new Error(`Unexpected first message from sidecar: ${line}`));
				}
			} catch {
				reject(new Error(`Failed to parse sidecar ready message: ${line}`));
			}
		});
	});
}

function handleSidecarResponse(line: string): void {
	if (pendingResolve) {
		const resolve = pendingResolve;
		pendingResolve = null;
		resolve(line);
	} else {
		postLog(`Warning: received sidecar response with no pending request: ${line.slice(0, 200)}`);
	}
}

function sendToSidecar(jsonLine: string): Promise<string> {
	return new Promise((resolve, reject) => {
		if (!sidecar || !sidecar.stdin) {
			reject(new Error('Sidecar not running'));
			return;
		}
		pendingResolve = resolve;
		sidecar.stdin.write(jsonLine + '\n', (err) => {
			if (err) {
				pendingResolve = null;
				reject(err);
			}
		});
	});
}

// ── Logging to Parent ────────────────────────────────────────────────

function postLog(message: string): void {
	parentPort?.postMessage({ type: 'log', message });
}

// ── Encoder/Decoder ──────────────────────────────────────────────────

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── Main Loop ────────────────────────────────────────────────────────

/**
 * Continuously polls the SharedArrayBuffer for requests from the main thread.
 * Uses Atomics.wait to block until a request is ready (no busy-waiting).
 */
async function runLoop(): Promise<void> {
	// Spawn the sidecar
	try {
		await spawnSidecar();
		postLog('Sidecar ready');
	} catch (err) {
		postLog(`Failed to spawn sidecar: ${(err as Error).message}`);
		process.exit(1);
	}

	// Signal to main thread that we're ready via SharedArrayBuffer
	// (can't use postMessage — main thread is blocked on Atomics.wait)
	Atomics.store(ctrl, 3, 1);  // ctrl[3] = ready flag
	Atomics.notify(ctrl, 3);

	while (true) {
		// Wait for main thread to post a request (CTRL_REQUEST_READY)
		const waitResult = Atomics.wait(ctrl, 0, CTRL_IDLE);
		if (waitResult === 'not-equal') {
			// Already has a request — proceed
		}
		// else 'ok' means we were woken by Atomics.notify

		const ctrlValue = Atomics.load(ctrl, 0);
		if (ctrlValue !== CTRL_REQUEST_READY) {
			// Spurious wake or shutdown signal
			if (ctrlValue === -1) {
				// Shutdown signal
				break;
			}
			continue;
		}

		// Read request from SAB
		const reqLen = ctrl[1]; // REQ_LEN_OFFSET / 4 = index 1
		const reqBytes = dataView.slice(0, reqLen);
		const reqJson = decoder.decode(reqBytes);

		// Send to sidecar and get response
		let respJson: string;
		try {
			respJson = await sendToSidecar(reqJson);
		} catch (err) {
			respJson = JSON.stringify({
				id: '__worker_error__',
				error: { code: 'WORKER_ERROR', message: (err as Error).message },
			});
		}

		// Write response to SAB
		const respBytes = encoder.encode(respJson);
		if (respBytes.length > MAX_MSG_SIZE) {
			// Response too large for SAB — send error
			const errResp = encoder.encode(JSON.stringify({
				id: '__size_error__',
				error: { code: 'RESPONSE_TOO_LARGE', message: `Response size ${respBytes.length} exceeds SAB limit ${MAX_MSG_SIZE}` },
			}));
			dataView.set(errResp, MAX_MSG_SIZE); // Write in response region
			ctrl[2] = errResp.length; // RESP_LEN_OFFSET / 4 = index 2
		} else {
			dataView.set(respBytes, MAX_MSG_SIZE); // Response starts at offset MAX_MSG_SIZE in data region
			ctrl[2] = respBytes.length;
		}

		// Signal response ready
		Atomics.store(ctrl, 0, CTRL_RESPONSE_READY);
		Atomics.notify(ctrl, 0);
	}

	// Shutdown
	if (sidecar) {
		sidecar.stdin?.end();
		sidecar.kill();
	}
}

// ── Handle parent messages ───────────────────────────────────────────

parentPort?.on('message', (msg: { type: string }) => {
	if (msg.type === 'shutdown') {
		// Set shutdown signal
		Atomics.store(ctrl, 0, -1);
		Atomics.notify(ctrl, 0);
		if (sidecar) {
			sidecar.stdin?.end();
			setTimeout(() => {
				sidecar?.kill();
				process.exit(0);
			}, 2000);
		} else {
			process.exit(0);
		}
	}
});

// Start the loop
runLoop().catch((err) => {
	postLog(`Worker loop crashed: ${(err as Error).message}`);
	process.exit(1);
});
