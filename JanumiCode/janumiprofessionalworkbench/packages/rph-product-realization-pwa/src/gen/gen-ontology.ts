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

const out = `// GENERATED FILE — do not edit by hand. Regenerate with \`bun run gen:ontology\`.
// Source: vocab/m8-ontology.json (grounded from DOC-003 + DOC-004 + DOC-006, reconciled).
export const PRODUCT_REALIZATION_PWA_ONTOLOGY = ${JSON.stringify(ontology, null, '\t')} as const;
`;

writeFileSync(OUT, out);
const t = (ontology.pwuTemplates as unknown[]).length;
const p = (ontology.seedPolicies as unknown[]).length;
console.log(`generated ${OUT}: ${t} PWU templates, ${p} seed policies`);
