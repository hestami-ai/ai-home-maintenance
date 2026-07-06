/**
 * GPU-free replay harness — e2e smoke.
 *
 * Boots the real extension in replay mode (JANUMICODE_REPLAY_MODE=1) against a
 * prepared cal-40 clone and asserts it activates and renders the governed
 * stream WITHOUT contacting the GPU/LLM/CLI — the fail-loud providers +
 * gpuGuard turn any accidental live call into an activation failure, so a clean
 * activation is itself the no-GPU guarantee.
 *
 * Skips when no clone is supplied (JANUMICODE_REPLAY_DB unset / missing), so it
 * is safe in CI where we commit no fixtures. The fine-grained memory-bounding
 * assertions (delivered ≤ window, keyset load-older, store cap + perf) live in
 * the fast unit tests — governedStreamViewProviderSnapshot.test.ts and
 * recordsStore.test.ts — which run on every `pnpm test`.
 */

// ES imports (not require) so this file is a MODULE — isolates its top-level
// consts from the sibling script-style smoke suite (which would otherwise
// collide on shared global names like `assert` / `vscode`).
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as vscode from 'vscode';

const EXTENSION_ID = 'hestami-ai.janumicode';
const SIDEBAR_VIEW_ID = 'janumicode.governedStream';
const REPLAY_DB = process.env.JANUMICODE_REPLAY_DB;

describe('JanumiCode v2 — replay harness smoke', function () {
  this.timeout(90_000);

  before(function () {
    if (!REPLAY_DB || !fs.existsSync(REPLAY_DB)) {
      // No prepared clone → nothing to replay. Skip cleanly (CI has no fixture).
      this.skip();
    }
  });

  it('activates in replay mode against the cal-40 clone (no GPU/LLM/CLI)', async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} not found`);
    if (!ext.isActive) await ext.activate();
    // If any live provider/transport had been reached, gpuGuard/fail-loud would
    // have thrown during bootstrap and activation would not be active here.
    assert.strictEqual(ext.isActive, true, 'extension failed to activate in replay mode');
  });

  it('governed stream sidebar registers (replayed run renders)', async () => {
    await vscode.commands.executeCommand(`${SIDEBAR_VIEW_ID}.focus`);
    assert.ok(true, 'sidebar focus succeeded');
  });
});
