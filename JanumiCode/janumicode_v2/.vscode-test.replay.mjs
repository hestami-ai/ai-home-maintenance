// @ts-check
/**
 * @vscode/test-cli config for the GPU-FREE replay harness e2e.
 *
 * Boots the extension in replay mode against a prepared cal-40 clone and runs
 * the replay smoke suite. NO GPU/LLM/CLI is touched (fail-loud providers +
 * gpuGuard); if the clone/fixture is missing the suite skips cleanly, so this
 * is CI-safe even though we commit no replay fixtures.
 *
 * Prepare a clone first, then export its path:
 *   node scripts/replay/prep-replay-db.mjs --src <cal-40 .db> --dest /tmp/clone.db --copy-files
 *   JANUMICODE_REPLAY_DB=/tmp/clone.db pnpm replay:e2e
 *
 * For Tier-2 engine replay also set JANUMICODE_REPLAY_ENGINE=1 +
 * JANUMICODE_REPLAY_FIXTURE=<governed_stream.ndjson from --export-json>.
 */

import { defineConfig } from '@vscode/test-cli';
import path from 'node:path';

const rootDir = path.dirname(new URL(import.meta.url).pathname);

/** @type {Record<string,string>} */
const env = {
  JANUMICODE_REPLAY_MODE: '1',
  JANUMICODE_AUTOSHOW_LOGS: '0',
};
// Pass through the operator-supplied clone / fixture paths (unset → suite skips).
for (const key of [
  'JANUMICODE_REPLAY_DB',
  'JANUMICODE_REPLAY_STRICT',
  'JANUMICODE_REPLAY_ENGINE',
  'JANUMICODE_REPLAY_FIXTURE',
  'JANUMICODE_REPLAY_APPEND',
]) {
  if (process.env[key]) env[key] = process.env[key];
}

export default defineConfig({
  files: 'out/test/e2e/suite/**/*.replay.test.js',
  workspaceFolder: path.join(rootDir, 'test-and-evaluation', 'test-workspace'),
  mocha: { ui: 'bdd', color: true, timeout: 120_000 },
  launchArgs: ['--disable-workspace-trust', '--disable-extensions'],
  env,
});
