// ⭐⭐ `JAN-MHX` MH-1 — the pin of THE BRIDGE's bytes (`DESIGN-multi-harness-executor.md` D11; roadmap B4).
//
// ⭑ IN A FILE OF ITS OWN, apart from `host-tool-bridge.test.ts`, because the mutation runner judges a whole file: with
// the pin beside them, every mutant of the bridge's behaviour was killed by its changed bytes alone, whatever the
// behaviour cases found. Here the pin is the only victim; there, the behaviour is.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBridge } from './host-tool-bridge.js';

describe('⭐ D11 — the bridge is a pinned constant', () => {
	it('B4 — the bytes writeBridge writes are pinned by hash', async () => {
		// ⭑ As `DEVIN_REVIEWER_PREAMBLE`'s are pinned: a change to them is a change to what every CLI runs, and must be one a
		// reviewer sees here. ⛔ THE MUTANT: any byte of the source changed.
		const dir = await mkdtemp(join(tmpdir(), 'jpwb-bridge-pin-'));
		try {
			const written = readFileSync(await writeBridge(dir));
			expect(createHash('sha256').update(written).digest('hex')).toBe(
				'5188371375361044dc58036871f7963c1569717443f8cc130be28788bc5e1e27'
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
