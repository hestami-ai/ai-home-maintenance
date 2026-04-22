// @ts-check
/**
 * Layer C — @vscode/test-cli configuration file.
 *
 * The `vscode-test` CLI reads this file to determine:
 *   - which workspace to open in the Extension Development Host
 *   - where the compiled test suite lives
 *   - env vars to inject (hermetic LLM, no output-channel auto-show)
 *
 * Run via `pnpm test:e2e`. The CLI handles downloading VS Code, launching
 * it with the extension, collecting Mocha results, and reporting.
 *
 * @see https://code.visualstudio.com/api/working-with-extensions/testing-extensions
 */

import { defineConfig } from '@vscode/test-cli';
import path from 'node:path';

const rootDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  files: 'out/test/e2e/suite/**/*.smoke.test.js',
  workspaceFolder: path.join(rootDir, 'test-and-evaluation', 'test-workspace'),
  mocha: {
    ui: 'bdd',
    color: true,
    timeout: 60_000,
  },
  launchArgs: [
    '--disable-workspace-trust',
    '--disable-extensions',
  ],
  env: {
    JANUMICODE_LLM_PROVIDER: 'mock',
    JANUMICODE_AUTOSHOW_LOGS: '0',
  },
});
