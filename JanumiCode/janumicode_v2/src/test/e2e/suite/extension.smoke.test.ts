/**
 * Layer C smoke tests — verify the extension actually activates inside a
 * real VS Code Extension Development Host, that the sidebar webview view
 * provider registers, and that core commands respond.
 *
 * Runs inside Electron via @vscode/test-electron's runTests() pipeline.
 * Each `it()` here boots a clean VS Code subprocess (well, technically the
 * host stays warm across tests in the same `run()` call). The tests assert
 * on the public `vscode` API surface — they cannot reach into the extension
 * host's private state, so they're necessarily coarse-grained.
 *
 * The bread-and-butter check: did the extension activate without throwing,
 * is the sidebar there, do the registered commands exist?
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require('node:assert');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscode = require('vscode');

const EXTENSION_ID = 'hestami-ai.janumicode';
const ACTIVATION_TIMEOUT_MS = 30_000;
const SIDEBAR_VIEW_ID = 'janumicode.governedStream';

const COMMAND_IDS = [
  'janumicode.startWorkflowRun',
  'janumicode.showWorkflowStatus',
  'janumicode.openSettings',
  'janumicode.findInStream',
  'janumicode.showLogs',
];

describe('JanumiCode v2 — extension smoke', function () {
  // Activation can be slow on the first run because the sidecar process
  // boots and the schemas / templates are loaded from disk.
  this.timeout(ACTIVATION_TIMEOUT_MS);

  before(async function () {
    // Wait for activation. The Extension Development Host runs the extension
    // with onStartupFinished, but the test process can race ahead before the
    // bootstrap finishes. Force activation explicitly.
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} not found in extensions list`);
    if (!ext.isActive) {
      await ext.activate();
    }
  });

  it('extension is active', () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, 'extension not found');
    assert.strictEqual(ext.isActive, true, 'extension failed to activate');
  });

  it('all expected commands are registered', async () => {
    const allCommands: string[] = await vscode.commands.getCommands(true);
    for (const id of COMMAND_IDS) {
      assert.ok(
        allCommands.includes(id),
        `command "${id}" not registered (registered command count: ${allCommands.length})`,
      );
    }
  });

  it('sidebar view is contributed', () => {
    // We can't directly query "is the webview rendered" because that's a
    // user-interaction concept. But we CAN ask VS Code to focus the view —
    // if it's not registered, this throws.
    return vscode.commands.executeCommand(`${SIDEBAR_VIEW_ID}.focus`).then(
      () => {
        assert.ok(true, 'sidebar view focus command succeeded');
      },
      (err: unknown) => {
        assert.fail(
          `sidebar view ${SIDEBAR_VIEW_ID} did not register: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    );
  });

  it('showWorkflowStatus command runs without throwing', async () => {
    // The command resolves the active workflow run via the Liaison's
    // getStatus capability. When there's no run yet, it returns the
    // "No active workflow run" message — that's fine, we just want to
    // verify the command path doesn't blow up.
    await vscode.commands.executeCommand('janumicode.showWorkflowStatus');
  });

  it('showLogs command runs without throwing', async () => {
    await vscode.commands.executeCommand('janumicode.showLogs');
  });

  // TODO (Wave 5b Section B+): once the engine is instrumented to write
  // agent_invocation records, add a test here that:
  //   1. Sends a `submitIntent` postMessage to the webview
  //   2. Waits for the workflow run row to appear in the sidecar DB
  //   3. Asserts that at least one agent_invocation record was written
  // The current scaffold can't easily reach into the webview's postMessage
  // channel from the extension test API — we'd need to either expose a
  // command shim like `janumicode._test.submitIntent(text)` or read the DB
  // directly via the extension host's better-sqlite3 instance.
});
