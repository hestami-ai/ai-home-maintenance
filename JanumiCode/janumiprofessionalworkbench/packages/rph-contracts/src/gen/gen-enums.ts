// GENERATOR — emits src/enums.ts from the ratified canonical vocabulary.
// Run via `bun run gen:enums`. The vocabulary (vocab/canonical-vocabulary.json) is the single source
// for enum VALUES (grounded from the RPH specs + reconciled per docs §5); enums.ts is the single source
// for enum TYPES/runtime validators; JSON Schema derives from enums.ts. This keeps values, TS types, and
// JSON Schema all derived from ONE source (Constitution / tracker D4).
//
// Finding.* enums are per-policy finding vocabularies and belong to the Product Realization PWA policy DATA (M8),
// not the global contract enum surface — they are intentionally skipped here.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface CanonicalEnum {
	name: string;
	values: string[];
	appliesTo?: string;
	canonicalSource?: string;
	note?: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const VOCAB_PATH = join(HERE, '..', '..', 'vocab', 'canonical-vocabulary.json');
const OUT_PATH = join(HERE, '..', 'enums.ts');

// Dotted enum names get explicit, curated TS identifiers.
const NAME_OVERRIDES: Record<string, string> = {
	'WorkRiskProfile.consequence': 'RiskConsequence',
	'WorkRiskProfile.uncertainty': 'RiskUncertainty',
	'WorkRiskProfile.irreversibility': 'RiskIrreversibility',
	'WorkRiskProfile.securitySensitivity': 'RiskSecuritySensitivity',
	'WorkRiskProfile.regulatoryExposure': 'RiskRegulatoryExposure'
};

function identifier(name: string): string {
	const overridden = NAME_OVERRIDES[name];
	if (overridden) return overridden;
	const id = name.replace(/[^A-Za-z0-9]/g, '');
	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id)) {
		throw new Error(`Cannot derive a TS identifier from enum name "${name}"`);
	}
	return id;
}

const vocab = JSON.parse(readFileSync(VOCAB_PATH, 'utf8')) as { canonicalEnums: CanonicalEnum[] };
const enums = vocab.canonicalEnums
	.filter((e) => !e.name.startsWith('Finding.'))
	.sort((a, b) => identifier(a.name).localeCompare(identifier(b.name)));

const seen = new Map<string, string>();
for (const e of enums) {
	const id = identifier(e.name);
	const prior = seen.get(id);
	if (prior)
		throw new Error(`Duplicate normalized enum identifier "${id}" from "${prior}" and "${e.name}"`);
	seen.set(id, e.name);
	if (e.values.length === 0) throw new Error(`Enum "${e.name}" has no values`);
	if (new Set(e.values).size !== e.values.length)
		throw new Error(`Enum "${e.name}" has duplicate values`);
}

const lines: string[] = [
	'// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:enums`.',
	'// Source of enum VALUES: vocab/canonical-vocabulary.json (ratified per docs §5, grounded from RPH specs).',
	'// Each closed enum is authored ONCE here as a Zod schema; TS types + JSON Schema derive from it.',
	"import { z } from 'zod';",
	''
];

for (const e of enums) {
	const id = identifier(e.name);
	const values = e.values.map((v) => JSON.stringify(v)).join(', ');
	const sourceSuffix = e.canonicalSource ? ` — ${e.canonicalSource}` : '';
	const doc = `${e.appliesTo ?? e.name}${sourceSuffix}`;
	lines.push(
		`/** ${doc} */`,
		`export const ${id}Schema = z.enum([${values}]);`,
		`export type ${id} = z.infer<typeof ${id}Schema>;`,
		''
	);
}

lines.push(
	'/** Registry of every canonical enum schema, for introspection, JSON-Schema emission, and fidelity tests. */',
	'export const CANONICAL_ENUM_SCHEMAS = {'
);
for (const e of enums) {
	const id = identifier(e.name);
	lines.push(`\t'${e.name}': ${id}Schema,`);
}
lines.push('} as const;', '');

writeFileSync(OUT_PATH, lines.join('\n'));
console.log(`generated ${OUT_PATH} with ${enums.length} enums`);
