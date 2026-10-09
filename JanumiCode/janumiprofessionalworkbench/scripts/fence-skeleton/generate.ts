/**
 * ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`) — WRITES THE FENCE SKELETON'S TABLE FROM THE COMMITTED UNICODE INPUTS.
 * `bun scripts/fence-skeleton/generate.ts` — reads `core.ts`'s `INPUT_DIR`, writes `core.ts`'s `TABLE_MODULE`.
 *
 * ⛔ THE ONLY WAY THE TABLE IS WRITTEN. `verif/fence-skeleton-table.test.ts` runs the same `generate` over the same inputs
 * and compares the result with the committed module byte for byte, so a hand edit to the table, or an input changed
 * without regenerating, reddens the gate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, INPUT_DIR, type InputKey, SOURCES, TABLE_MODULE } from './core.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** The committed extracts, by input. */
export function committedExtracts(root: string): Record<InputKey, string> {
	return Object.fromEntries(
		SOURCES.map((s) => [s.key, readFileSync(join(root, INPUT_DIR, s.extract), 'utf8')])
	) as Record<InputKey, string>;
}

if (import.meta.main) {
	writeFileSync(join(ROOT, TABLE_MODULE), generate(committedExtracts(ROOT)));
	process.stdout.write(`fence-skeleton generate — ${TABLE_MODULE} written from ${INPUT_DIR}\n`);
}
