// ⭐⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`; design D2 under the sponsor's answer (a) of 2026-10-03) — THE FENCE SKELETON READS
// EVERY CODE POINT ALIKE UNDER NODE AND UNDER BUN.
//
// ⛔ IT DID NOT. The skeleton read the runtime's Unicode — `normalize('NFKC')`, `\p{Mn}` and the rest, `toLowerCase()` —
// and bun 1.3.14 (Unicode 15.0) and node v24 (Unicode 16.0) read 102 code points apart: the same slice could get
// `<<<UNTRUSTED-01>>>` under bun and `<<<UNTRUSTED-00>>>` under node. The qualification scripts and the fingerprint run
// under bun; production and vitest run under node. A prompt the fingerprint measured could then differ from the prompt
// production sent, for an input carrying one of those characters, and no test would see it.
//
// ⭐ So the skeleton is now one lookup per code point in a generated table, and THIS pins it: a digest of everything the
// chooser reads every code point as (`scripts/fence-skeleton/digest.ts`) — every reading of it in a line read in order,
// every reading of it in a line laid out reversed, and whether a line holding it is read reversed (`REG-F-481`;
// `REG-D-013`) — held to ONE literal in this process (vitest, node) AND by the same digest computed by bun through its
// CLI — the pattern the fingerprint test follows to show the CLI computes what the function computes. ⚠ THE LITERAL MOVES
// WITH THE TABLE AND WITH EVERY CODE POINT'S READINGS AND FLAGS: a deliberate change to the table (a new Unicode version,
// a changed rule), to which terminators also read as nothing, or to which code points make a line be read reversed
// changes it, and the new value is written here in the same change, never taken on trust from one runtime alone — both
// limbs must agree with it. ⚠ WHAT IT DOES NOT HASH: how a slice applies those readings — position by position, per LF
// line, every line holding a control, in its two reversed layouts (`review-fence.ts` `readSlice`). A change there moves
// no digest; `reasoning-review-validator.test.ts` pins each of those rules through the real validator, in every
// framing, at the points its rows stand — a change confined to other inputs of a rule, or to two rules together, is not
// seen there.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fence from '../apps/rph-demo/src/lib/server/assurance/review-fence.js';
import { fenceSkeletonDigest } from '../scripts/fence-skeleton/digest.js';
import { BUN, hermeticEnv } from './reviewer-qualification-hermetic.js';

const REPO = fileURLToPath(new URL('../', import.meta.url)).split('\\').join('/');

/** ⭐ THE ONE VALUE — the digest of every reading of every code point (the table of Unicode 18.0.0 and the stated
 *  supplement, and which terminators also read as nothing) and of every code point's flag for a line read reversed —
 *  every code point's readings and flags, not how a slice applies them. */
const SKELETON_DIGEST = '4517416abd9dae3c19e49b0130f81e6d46497061e2e3fd9bb77a9a61d56d443f';

describe('⭐⭐ JAN-PRQUAL PQ-1 (REG-F-481) — the fence skeleton is the same in every runtime: one digest, node and bun', () => {
	it('⭐ in this process (vitest, node): the digest is the literal', () => {
		expect(process.versions.bun, 'the in-process limb runs under node, not bun').toBeUndefined();
		expect(fenceSkeletonDigest()).toBe(SKELETON_DIGEST);
	});

	it('⭐ under bun, through the CLI: the same literal', () => {
		const r = spawnSync(BUN, [`${REPO}scripts/fence-skeleton/digest.ts`], {
			cwd: REPO,
			encoding: 'utf8',
			env: hermeticEnv(),
			windowsHide: true
		});
		expect(r.status, r.stderr).toBe(0);
		expect(r.stdout.trim(), 'the CLI computes what the function computes, in the other runtime').toBe(SKELETON_DIGEST);
	}, 60_000);

	it('⭑ CONTROL — the digest discriminates: a reader that reads ONE code point differently, in either order, or reverses one more line, has another digest', () => {
		expect(fenceSkeletonDigest(fence), 'arrangement: the product’s own reader is the default').toBe(SKELETON_DIGEST);
		expect(fence.fenceReadings(0x41), 'arrangement: the code point reads as itself').toEqual(['A']);
		const A = (cp: number, other: readonly string[], to: readonly string[]) => (cp === 0x41 ? to : other);
		expect(fenceSkeletonDigest({ ...fence, fenceReadings: (cp) => A(cp, fence.fenceReadings(cp), ['B']) }), 'in order').not.toBe(
			SKELETON_DIGEST
		);
		// ⭐ A reading ADDED, the first kept: a set read as its first member alone is another reader.
		expect(
			fenceSkeletonDigest({ ...fence, fenceReadings: (cp) => A(cp, fence.fenceReadings(cp), ['A', '']) }),
			'one reading more'
		).not.toBe(SKELETON_DIGEST);
		expect(
			fenceSkeletonDigest({ ...fence, reversedReadings: (cp) => A(cp, fence.reversedReadings(cp), ['B']) }),
			'laid out reversed'
		).not.toBe(SKELETON_DIGEST);
		expect(fenceSkeletonDigest({ ...fence, reordersLine: (cp) => cp === 0x41 || fence.reordersLine(cp) }), 'a line reversed').not.toBe(
			SKELETON_DIGEST
		);
	});
});
