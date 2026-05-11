/**
 * RPC worker — placeholder for the SharedArrayBuffer sync-bridging worker.
 *
 * Wave 0: built but not yet wired. The extension host uses `directDb` for now;
 * the sidecar bundle is built and tested via the standalone harness in tests.
 * Wave 1+ adds the sync bridge that lets synchronous extension-host code paths
 * issue DB calls without async refactoring.
 */

import { parentPort } from 'node:worker_threads';

if (parentPort) {
  parentPort.on('message', (msg: unknown) => {
    parentPort!.postMessage({ ok: false, error: 'rpcWorker not yet implemented in Wave 0', echo: msg });
  });
}
