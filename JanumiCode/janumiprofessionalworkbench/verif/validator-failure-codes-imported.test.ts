// ⭐ `JAN-SELRES` RS-2 (D6, D7) — THE APP IMPORTS THE PACKAGE'S VALIDATOR FAILURE CODES; IT NEVER RESTATES ONE.
//
// ⛔ WHY A RESTATED LITERAL IS A DEFECT EVEN WHEN IT IS SPELLED RIGHT. The code a refused substitute carries
// (`VALIDATOR_MODEL_SUBSTITUTED`, `packages/rph-assurance/src/validators.ts`) is written by the validator's throw and
// READ by the floor's classifier with `o.code === …` — a string comparison no compiler checks. Spelled as a literal in
// either place, it keeps working only until the package's word moves; then a substitution is recorded under one
// spelling and matched under another, and the classifier answers "retry the reviewer" again (`REG-F-460`, reopened).
// Imported, a moved word is a compile error at both ends.
//
// ⭑ NO BEHAVIOUR CAN SEE THIS: today the literal and the import are the same string, so every behavioural test passes
// either way. The property is one of FORM, and this file asks it of form — a structural walk of the TypeScript, never
// a grep, so a comment or a test naming the code is not a restatement.
//
// ⭑ A SPLIT SPELLING IS STILL A SPELLING. An expression whose value is a string the source fixes by itself is FOLDED
// before it is compared: a literal, a no-substitution template, a parenthesised one, a `+` of two such, or a template
// whose every substitution is one — so `'VALIDATOR_MODEL_' + 'SUBSTITUTED'` is a restatement as much as the whole word.
//
// ⚠ ITS BOUND: `.ts` production sources under `apps/rph-demo/src` (not `*.test.ts`, which pin the value on purpose, and
// not `.svelte` markup). A restatement inside a workspace package other than `rph-assurance` is not looked for. Only a
// value fixed by the expression itself is folded: a name bound to a string (`const a = 'VALIDATOR_MODEL_'; a + …`), a
// call (`.concat`, `.join`, `String.raw`) or a computed value is not resolved.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VALIDATOR_FAILURE_CODES } from '@janumipwb/rph-assurance';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const APP_SRC = join(ROOT, 'apps', 'rph-demo', 'src');
const rel = (path: string): string => relative(ROOT, path).split('\\').join('/');

/** Every production `.ts` source under `dir`. */
function productionSources(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '.svelte-kit') continue;
		const path = join(dir, name);
		if (statSync(path).isDirectory()) productionSources(path, out);
		else if (name.endsWith('.ts') && !/[.](test|spec)[.]ts$/.test(name)) out.push(path);
	}
	return out;
}

const CODES: ReadonlySet<string> = new Set(VALIDATOR_FAILURE_CODES);

/** The string `node` evaluates to when the expression fixes it by itself, or `undefined` (see the header's bound). */
function folded(node: ts.Node): string | undefined {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isParenthesizedExpression(node)) return folded(node.expression);
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		const left = folded(node.left);
		const right = left === undefined ? undefined : folded(node.right);
		return right === undefined ? undefined : `${left}${right}`;
	}
	if (ts.isTemplateExpression(node)) {
		let text = node.head.text;
		for (const span of node.templateSpans) {
			const value = folded(span.expression);
			if (value === undefined) return undefined;
			text += value + span.literal.text;
		}
		return text;
	}
	return undefined;
}

/** Where `text` (the source of `file`) restates a code as a string, and whether it imports one from the package. */
function restatementsIn(
	file: string,
	text: string
): { readonly restated: string[]; readonly imports: boolean } {
	const restated: string[] = [];
	let imports = false;
	const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
	const visit = (node: ts.Node): void => {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === '@janumipwb/rph-assurance' &&
			node.importClause?.namedBindings &&
			ts.isNamedImports(node.importClause.namedBindings) &&
			node.importClause.namedBindings.elements.some((e) =>
				CODES.has((e.propertyName ?? e.name).text)
			)
		) {
			imports = true;
			return; // an import names the code as an identifier, never as a string
		}
		const value = folded(node);
		if (value !== undefined && CODES.has(value)) {
			restated.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`);
			return; // the whole expression is ONE restatement; its parts are not counted again
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return { restated, imports };
}

/** Where each file restates a code as a string, and which files import one from the package by name. */
function walk(): { readonly restated: string[]; readonly importers: string[] } {
	const restated: string[] = [];
	const importers: string[] = [];
	for (const file of productionSources(APP_SRC)) {
		const found = restatementsIn(rel(file), readFileSync(file, 'utf8'));
		restated.push(...found.restated);
		if (found.imports) importers.push(rel(file));
	}
	return { restated, importers };
}

describe('⭐ D6/D7 — no app source restates a validator failure code; the two that use one import it', () => {
	const { restated, importers } = walk();

	it('⛔ no production source under apps/rph-demo/src spells a VALIDATOR_FAILURE_CODES member as a string', () => {
		expect(
			restated,
			'a validator failure code is restated as a literal instead of imported'
		).toEqual([]);
	});

	it('⭑ CONTROL — the walk reads the app, and SEES the two sites that use the code, importing it', () => {
		// Without this, "none restated" above holds for a walk that read nothing: here the same walk must find the
		// throw that writes the code and the classifier that reads it, each importing it from the package.
		expect(importers).toContain(
			'apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts'
		);
		expect(importers).toContain('apps/rph-demo/src/lib/server/floor.ts');
	});

	it('⭑ CONTROL — the fold SEES a split spelling, and folds only what the source fixes by itself', () => {
		// Without this, "none restated" above holds for a walk that compared single literals only — the bound a
		// concatenation walked past. Each line below is one restatement, reported once; the last two are not constant.
		const source = [
			"const a = 'VALIDATOR_MODEL_SUBSTITUTED';",
			"const b = 'VALIDATOR_MODEL_' + 'SUBSTITUTED';",
			"const c = ('VALIDATOR_' + `MODEL_`) + 'SUBSTITUTED';",
			"const d = `VALIDATOR_MODEL_${'SUBSTITUTED'}`;",
			"const e = 'VALIDATOR_MODEL_' + suffix;",
			'const f = `VALIDATOR_MODEL_${suffix}`;'
		].join('\n');
		expect(restatementsIn('control.ts', source)).toEqual({
			restated: ['control.ts:1', 'control.ts:2', 'control.ts:3', 'control.ts:4'],
			imports: false
		});
	});
});
