/**
 * ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`) — THE COMMITTED UNICODE INPUTS, CUT FROM THE WHOLE FILES UNICODE PUBLISHES.
 * `bun scripts/fence-skeleton/extract.ts <dir>` — `<dir>` holds the four whole files `core.ts`'s `SOURCES` names.
 *
 * ⛔ EACH WHOLE FILE IS REFUSED UNLESS ITS SHA-256 IS THE ONE `SOURCES` PINS (`checkedWhole`, in `core.ts`, where a test
 * holds it to that refusal with one forged byte), so an extract can only be cut from the Unicode 18.0.0 files
 * themselves; each extract's header carries the file's name, version, address and hash.
 *
 * ⭐ AND THE CUT IS SHOWN TO LOSE NOTHING, AND THE SUPPLEMENT CLOSED, BEFORE A BYTE IS WRITTEN (`checkedCut`, in `core.ts`,
 * pure, where a test drives each refusal with planted inputs): the table is computed twice — from the extracts, and from
 * every mapping of the whole `confusables.txt` beside the other three — and the two must be equal; and the supplement
 * must be closed under TR39's classes, both ways, over the whole file. Either failing, nothing is written. The
 * confusables extract keeps every mapping, so `generate` asks the closure again on every gate.
 *
 * Run once per Unicode version. `generate.ts` then writes the table from the extracts and the supplement, and the
 * freshness test re-runs it on every gate.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedCut, checkedWhole, extractsOf, INPUT_DIR, type InputKey, SOURCES } from './core.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function fail(message: string): never {
	process.stderr.write(`fence-skeleton extract — ${message}\n`);
	process.exit(1);
}

const dir = process.argv[2];
if (!dir) fail('name the directory that holds the whole Unicode files');

const wholes = {} as Record<InputKey, string>;
for (const source of SOURCES) {
	try {
		wholes[source.key] = checkedWhole(source, readFileSync(join(dir, source.file)));
	} catch (e) {
		fail((e as Error).message);
	}
}
const extracts = extractsOf(wholes);
try {
	checkedCut(wholes, extracts);
} catch (e) {
	fail((e as Error).message);
}

for (const source of SOURCES) writeFileSync(join(ROOT, INPUT_DIR, source.extract), extracts[source.key]);
process.stdout.write(`fence-skeleton extract — ${SOURCES.length} extracts written to ${INPUT_DIR}; the cut loses nothing, and the supplement is closed\n`);
