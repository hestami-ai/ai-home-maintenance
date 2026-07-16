// GENERATOR — emits src/ontology.data.ts from the grounded ontology extraction vocab/m8-ontology.json
// (DOC-003 + DOC-004 + DOC-006, reconciled). Run via `bun run gen:ontology`. The ontology ships as versioned
// DATA so the engine mechanism stays PWA-agnostic; build-meta (conflicts/openItems) is stripped.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VOCAB = join(HERE, '..', '..', 'vocab', 'm8-ontology.json');
const OUT = join(HERE, '..', 'ontology.data.ts');

const parsed = JSON.parse(readFileSync(VOCAB, 'utf8')) as Record<string, unknown>;
const ontology = {
	version: '1.0.0',
	pwuTemplates: parsed.pwuTemplates ?? [],
	seedPolicies: parsed.seedPolicies ?? [],
	conformanceProfiles: parsed.conformanceProfiles ?? [],
	roleDefaults: parsed.roleDefaults ?? [],
	compatibilityPhaseMapping: parsed.compatibilityPhaseMapping ?? []
};

// `as const satisfies OntologyData`, NOT a bare `as const`.
//
// This emitted `} as const;` and ontology.ts surfaced it through a type ASSERTION
// (`...seedPolicies as readonly SeedPolicy[]`). An assertion only requires comparability — it verifies nothing
// structurally. Proven by mutation on 2026-07-16: re-adding the invented `statement` field to a criterion in
// this generated file passed `bun run check-types` (EXIT=0) AND the full 21/21 gate, and deleting the ratified
// `severityIfNotMet` passed too. The dataset was the LARGEST of the five restatements of the invented criterion
// shape and the only one with no check at all — the type layer, the runtime layer (engine.ts types seedPolicies
// as `readonly unknown[]`) and the test layer (ontology.test.ts asserts only `criteria.length > 0`) were all
// blind. `satisfies` at the literal site is what actually checks it: it keeps the `as const` literal types AND
// structurally verifies both halves (extra field AND missing field). Annotating the accessor instead does NOT
// work — excess-property checking fires only on fresh literals, so it would catch a missing field and miss the
// invented one, which is the exact drift this exists to stop.
const out = `// GENERATED FILE — do not edit by hand. Regenerate with \`bun run gen:ontology\`.
// Source: vocab/m8-ontology.json (grounded from DOC-003 + DOC-004 + DOC-006, reconciled).
//
// Checked at this literal with \`satisfies OntologyData\` — a drift in the ratified DOC-004 §7 criterion shape,
// or an extra/missing field anywhere in the dataset, fails THIS build. Do not weaken this to a bare \`as const\`
// or move the check to a type assertion in ontology.ts: an assertion verifies nothing (see gen-ontology.ts).
import type { OntologyData } from './ontology.types.js';

export const PRODUCT_REALIZATION_PWA_ONTOLOGY = ${JSON.stringify(ontology, null, '\t')} as const satisfies OntologyData;
`;

writeFileSync(OUT, out);
const t = (ontology.pwuTemplates as unknown[]).length;
const p = (ontology.seedPolicies as unknown[]).length;
console.log(`generated ${OUT}: ${t} PWU templates, ${p} seed policies`);
