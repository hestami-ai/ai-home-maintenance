// ⛔ A BROKEN FIXTURE (`verif/phase7-seeded-faults.test.ts`, `verif/phase7-spawn-check.test.ts`): an end-to-end test that DOES
// start the real tool and is false of a correct product — it expects an unknown option to succeed. Its suite is red on the
// product's own entry and on the faithful CLI alike, so the tools must judge nothing: no variant, and no spawn verdict.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../../bin/wordfreq.js', import.meta.url));

test('an unknown option is ignored', () => {
	const r = spawnSync(process.execPath, [BIN, '--bogus'], { input: 'a', encoding: 'utf8', timeout: 30_000 });
	assert.equal(r.status, 0);
});
