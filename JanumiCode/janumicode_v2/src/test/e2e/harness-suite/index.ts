/**
 * Harness suite entrypoint — wires Mocha manually so the F5 launch
 * config path (which invokes `--extensionTestsPath` directly via
 * @vscode/test-electron) works alongside the pnpm script path (which
 * uses @vscode/test-cli + the .vscode-test.harness.mjs `files` glob).
 *
 * The smoke suite's index.ts is an empty stub because @vscode/test-cli
 * handles everything itself; the harness suite needs both entry points
 * to work because developers run it via F5 in VS Code to debug
 * breakpoints, AND CI invokes `pnpm harness:e2e` for unattended runs.
 *
 * Exports `run(): Promise<void>` per the extension test runner contract.
 * Any test failure inside the suite rejects the promise so the test
 * runner's exit code is non-zero.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mocha = require('mocha');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs');

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    // Each harness run includes a Phase 0→10 pipeline. Mock-mode is
    // fast (<1m); real-mode can run up to an hour. The env knob lets
    // the launching process override.
    timeout: Number.parseInt(process.env.JANUMICODE_HARNESS_TIMEOUT_MS ?? '3600000', 10),
  });

  // Discover every `*.harness.test.js` sibling of this index.
  const suiteDir = __dirname;
  for (const entry of fs.readdirSync(suiteDir)) {
    if (entry.endsWith('.harness.test.js')) {
      mocha.addFile(path.join(suiteDir, entry));
    }
  }

  return new Promise<void>((resolve, reject) => {
    try {
      mocha.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${failures} harness test(s) failed`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
