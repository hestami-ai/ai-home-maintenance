// Emit JSON Schema (Draft 2020-12) for every contract schema into schemas/ (committed interop artifact).
// Derived from the Zod source — the single source of truth (docs D4). Run via `bun run gen`.
//
// THE LIST ITSELF LIVES IN `schema-manifest.ts` (N-14). It was here, and the drift test could not reach it — this
// module deletes and rewrites `schemas/` at import, so a test importing it would REGENERATE the artifacts it was
// checking and pass by construction. The test therefore read one file out of 107 while its header claimed to
// check them all. Sharing the enumeration is what lets the check be total without a second copy of the list.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emittedSchemas } from './schema-manifest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'schemas');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'objects'), { recursive: true });
mkdirSync(join(OUT, 'enums'), { recursive: true });

const schemas = emittedSchemas();
for (const { dir, name, json } of schemas)
	writeFileSync(join(OUT, dir, `${name}.json`), `${JSON.stringify(json, null, 2)}\n`);
console.log(`emitted ${schemas.length} JSON schemas to ${OUT}`);
