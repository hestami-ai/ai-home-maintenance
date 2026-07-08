/**
 * RPC Worker — worker_threads bridge between extension host and sidecar.
 *
 * Runs in a Worker thread. Spawns the sidecar as a child process,
 * watches the SharedArrayBuffer for requests, sends them over NDJSON
 * to the sidecar, and writes responses back.
 */

import { parentPort, workerData } from 'node:worker_threads';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

const CTRL_OFFSET = 0;
const LEN_OFFSET = 1;
const DATA_OFFSET = 8;

const CTRL_IDLE = 0;
const CTRL_REQUEST = 1;
const CTRL_RESPONSE = 2;
const CTRL_ERROR = 3;

interface WorkerData {
  sab: SharedArrayBuffer;
  dbPath: string;
  sidecarPath: string;
  nodePath: string;
}

const { sab, dbPath, sidecarPath, nodePath } = workerData as WorkerData;
const ctrl = new Int32Array(sab, 0, 2);
const data = new Uint8Array(sab, DATA_OFFSET);

// ── Spawn Sidecar Process ───────────────────────────────────────────

interface SidecarReply {
  ok: boolean;
  /**
   * On success: JSON-serialized `result` (string, possibly the literal
   * `"null"`). On error: JSON-serialized `error` payload — either a
   * plain string for legacy/throw paths, or an object for structured
   * errors like RpcResultTooLarge. The client at rpcClient.ts re-parses
   * this string and throws the typed error.
   */
  payload: string;
}

let sidecar: ChildProcess;
let requestId = 0;
const pendingRequests = new Map<string, (response: SidecarReply) => void>();

function spawnSidecar(): void {
  sidecar = spawn(nodePath, [sidecarPath, dbPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = createInterface({ input: sidecar.stdout! });

  rl.on('line', (line) => {
    try {
      const response = JSON.parse(line);
      const resolver = pendingRequests.get(response.id);
      if (resolver) {
        pendingRequests.delete(response.id);
        // Distinguish success from error explicitly so structured sidecar
        // errors (e.g. RpcResultTooLarge) flow through CTRL_ERROR with
        // their JSON shape intact, instead of being silently treated as
        // a `result` and parsed as a stray string by the caller.
        if (response.error !== undefined && response.error !== null) {
          resolver({ ok: false, payload: JSON.stringify(response.error) });
        } else {
          resolver({ ok: true, payload: JSON.stringify(response.result ?? null) });
        }
      }
    } catch {
      // Ignore malformed lines
    }
  });

  sidecar.stderr?.on('data', (chunk) => {
    parentPort?.postMessage({ type: 'sidecar-stderr', data: chunk.toString() });
  });

  sidecar.on('exit', (code) => {
    parentPort?.postMessage({ type: 'sidecar-exit', code });
  });
}

spawnSidecar();

// ── Request/Response Loop ───────────────────────────────────────────

function sendToSidecar(method: string, params: Record<string, unknown>): Promise<SidecarReply> {
  return new Promise((resolve) => {
    const id = `req-${++requestId}`;
    pendingRequests.set(id, resolve);
    const request = JSON.stringify({ id, method, params }) + '\n';
    sidecar.stdin!.write(request);
  });
}

async function processLoop(): Promise<void> {
  while (true) {
    // Wait for a request from the main thread
    Atomics.wait(ctrl, CTRL_OFFSET, CTRL_IDLE);

    const ctrlValue = Atomics.load(ctrl, CTRL_OFFSET);
    if (ctrlValue !== CTRL_REQUEST) {
      // Spurious wake — go back to waiting
      continue;
    }

    // Read request from shared buffer
    const requestLen = Atomics.load(ctrl, LEN_OFFSET);
    const requestBytes = data.slice(0, requestLen);
    const requestJson = new TextDecoder().decode(requestBytes);

    try {
      const { method, params } = JSON.parse(requestJson);
      const reply = await sendToSidecar(method, params);
      const encoded = new TextEncoder().encode(reply.payload);

      // Write response to shared buffer; route sidecar-side errors to
      // CTRL_ERROR so the client can distinguish them from a real result
      // and (for structured payloads like RpcResultTooLarge) re-parse
      // the JSON shape into a typed Error subclass.
      data.set(encoded);
      Atomics.store(ctrl, LEN_OFFSET, encoded.byteLength);
      Atomics.store(ctrl, CTRL_OFFSET, reply.ok ? CTRL_RESPONSE : CTRL_ERROR);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const encoded = new TextEncoder().encode(errMsg);
      data.set(encoded);
      Atomics.store(ctrl, LEN_OFFSET, encoded.byteLength);
      Atomics.store(ctrl, CTRL_OFFSET, CTRL_ERROR);
    }

    // Wake the main thread
    Atomics.notify(ctrl, CTRL_OFFSET);
  }
}

processLoop().catch((err) => {
  parentPort?.postMessage({ type: 'worker-error', error: String(err) });
  process.exit(1);
});
