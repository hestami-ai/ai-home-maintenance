/**
 * Wrapper for `pnpm test:regression` that translates `--templates X,Y`
 * into the `JANUMICODE_REGRESSION_TEMPLATES` env var before delegating
 * to vitest. Lets operators write
 *   `pnpm test:regression --templates fr_bloom_skeleton`
 * without remembering the env-var name.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..', '..', '..', '..');

const argv = process.argv.slice(2);
const passthrough: string[] = [];
let templates: string | null = null;
let detIdx = -1;
let isDeterministic = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--templates' || a === '--template') {
    templates = argv[++i] ?? null;
  } else if (a === '--deterministic-only') {
    isDeterministic = true;
    detIdx = i;
  } else {
    passthrough.push(a);
  }
}
void detIdx;

const env = { ...process.env };
if (templates) env.JANUMICODE_REGRESSION_TEMPLATES = templates;

const baseArgs = isDeterministic
  ? ['vitest', 'run', 'src/test/regression/', '--exclude', '**/*.regression.live.test.ts']
  : ['vitest', 'run', '--config', 'vitest.regression.config.ts'];

const result = spawnSync('pnpm', ['exec', ...baseArgs, ...passthrough], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
