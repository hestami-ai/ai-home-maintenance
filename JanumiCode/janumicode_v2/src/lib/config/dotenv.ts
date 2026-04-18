/**
 * Minimal .env loader shared between the extension host and the CLI.
 *
 * The extension's activate() calls this with `context.extensionUri.fsPath`
 * so API keys (ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, …)
 * reach child processes spawned via the CLI-backed agent invoker. The
 * CLI entry point calls it too — `node dist/cli/janumicode.js` isn't
 * launched by VS Code, so without this the Orchestrator's gemini_cli
 * subprocess sees an empty env and fails with:
 *   When using Gemini API, you must specify the GEMINI_API_KEY env var.
 *
 * Design:
 *   - Does not overwrite existing env vars — the user's shell wins.
 *   - Strips optional `export ` prefix so POSIX shell-style files work.
 *   - Ignores comments (`#`) and blank lines.
 *   - Silent on missing / unreadable .env — loading is opt-in.
 *   - Does NOT support multi-line values, interpolation, or quoted
 *     strings. Add those only if a concrete need appears; today every
 *     key in the repo's .env is a single-line token.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export function loadDotenv(extensionPath: string): void {
  try {
    const envPath = path.join(extensionPath, '.env');
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cleaned = trimmed.replace(/^export\s+/, '');
      const eqIndex = cleaned.indexOf('=');
      if (eqIndex === -1) continue;
      const key = cleaned.slice(0, eqIndex).trim();
      const value = cleaned.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    /* .env loading is optional */
  }
}
