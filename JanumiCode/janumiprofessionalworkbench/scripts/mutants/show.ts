// `bun run scripts/mutants/show.ts <id-substring>` — print a declared mutant exactly as the ledger holds it.
//
// Exists because every attempt to read the ledger by regex from a shell heredoc mangled the escaping. Importing
// the module is exact by construction, and a mutation harness whose entries can only be read approximately is a
// harness whose verdicts mean approximately something.
import { DECLARED_MUTANTS } from './ledger.js';

const q = process.argv[2] ?? '';
const hits = DECLARED_MUTANTS.filter((m) => m.id.includes(q));
console.log(`${hits.length} match(es) for ${JSON.stringify(q)}\n`);
for (const m of hits) {
	console.log(`── ${m.id}`);
	console.log(`   file:      ${m.file}`);
	console.log(`   find:      ${JSON.stringify(m.find)}`);
	console.log(`   replace:   ${JSON.stringify(m.replace)}`);
	console.log(
		`   expectRed: ${m.expectRed.length > 0 ? m.expectRed.join(', ') : '(none — runs package-wide)'}`
	);
	console.log(`   source:    ${m.source}\n`);
}
