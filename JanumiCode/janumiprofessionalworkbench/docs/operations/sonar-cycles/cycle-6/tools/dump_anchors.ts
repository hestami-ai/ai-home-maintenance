// Dump the mutation ledger's anchors per target file, so each fix agent can be told which exact texts in its file
// must stay byte-identical and occur exactly once (docs/operations/sonarqube.md section 4).
// usage (from the JPWB root): bun <this file> <out.json>
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = process.cwd();
const mod = await import(pathToFileURL(join(root, 'scripts/mutants/ledger.ts')).href);
const mutants: ReadonlyArray<Record<string, unknown>> = mod.DECLARED_MUTANTS;
const isHistory: (m: unknown) => boolean = mod.isHistory;

const byFile: Record<string, { id: string; find: string; history: boolean }[]> = {};
for (const m of mutants) {
	const file = String(m.file);
	(byFile[file] ??= []).push({ id: String(m.id), find: String(m.find), history: isHistory(m) });
}
writeFileSync(process.argv[2]!, JSON.stringify(byFile, null, 1));
const live = mutants.filter((m) => !isHistory(m)).length;
console.log(`entries=${mutants.length} live=${live} files=${Object.keys(byFile).length}`);
