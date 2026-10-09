/**
 * ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`) — ONE NUMBER FOR WHAT THE FENCE SKELETON READS EVERY CODE POINT AS.
 * `bun scripts/fence-skeleton/digest.ts` prints it, as the runtime running it computes it.
 *
 * ⛔ WHY IT EXISTS: the skeleton read the RUNTIME's Unicode tables, and bun (Unicode 15.0) and node (Unicode 16.0) read
 * 102 code points apart — so the fence the qualification scripts measured (bun) was not always the fence production
 * sent (node). `verif/fence-skeleton-determinism.test.ts` holds this digest to ONE literal in-process under vitest
 * (node) AND through this CLI under bun, so a skeleton that reads any code point differently in either runtime reddens.
 *
 * ⭐ WHAT IT HASHES — EVERYTHING THE CHOOSER READS A CODE POINT AS (`REG-F-481`; `REG-D-013`): for every code point, every
 * reading of it in a line read in logical order (`fenceReadings`: the generated table and the terminators' reading of
 * nothing), every reading of it in a line laid out reversed (`reversedReadings`: the brackets mirrored), and whether a
 * line holding it is read reversed (`reordersLine`). So a change to the table, to which terminators read as nothing, or
 * to which code points make a line be read reversed moves it. ⚠ EVERY CODE POINT'S READINGS AND FLAGS, NOT HOW A SLICE
 * APPLIES THEM: the slice rules (`review-fence.ts` `readSlice` — position by position, per LF line, every line holding a
 * control, its two reversed layouts) move no digest; `reasoning-review-validator.test.ts` pins each one at the points
 * its rows stand — a change confined to other inputs of a rule, or to two rules together, is not seen there.
 *
 * ⚠ Each reading is written as hex code points, ASCII only — so the hash never depends on how a runtime encodes a lone
 * surrogate. A lone surrogate is a code point here too: a string can hold one, and the chooser must read it alike
 * everywhere.
 */
import { createHash } from 'node:crypto';
import * as fence from '../../apps/rph-demo/src/lib/server/assurance/review-fence.js';

/** What the chooser reads one code point as: in a line in logical order, in one laid out reversed, and whether a line
 *  holding it is read reversed. */
export interface FenceReader {
	readonly fenceReadings: (cp: number) => readonly string[];
	readonly reversedReadings: (cp: number) => readonly string[];
	readonly reordersLine: (cp: number) => boolean;
}

/** Readings as hex code points: each reading's code points joined by `,`, the readings by `|`. */
const hexes = (readings: readonly string[]): string =>
	readings.map((reading) => [...reading].map((c) => c.codePointAt(0)!.toString(16)).join(',')).join('|');

/** sha256 over `cp:forward/reversed` (and `!` when a line holding it is read reversed), for every code point 0 to
 *  U+10FFFF. */
export function fenceSkeletonDigest(reader: FenceReader = fence): string {
	const hash = createHash('sha256');
	let chunk = '';
	for (let cp = 0; cp <= 0x10ffff; cp += 1) {
		const bidi = reader.reordersLine(cp) ? '!' : '';
		chunk += `${cp.toString(16)}:${hexes(reader.fenceReadings(cp))}/${hexes(reader.reversedReadings(cp))}${bidi}\n`;
		if (chunk.length >= 65_536) {
			hash.update(chunk);
			chunk = '';
		}
	}
	hash.update(chunk);
	return hash.digest('hex');
}

if (import.meta.main) process.stdout.write(`${fenceSkeletonDigest()}\n`);
