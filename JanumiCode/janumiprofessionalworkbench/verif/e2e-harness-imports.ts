// ⭐ THE IMPORT CENSUS'S SCANNER (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md` §4.8) — who takes Playwright's
// own `test` under `apps/rph-demo/e2e/`, and whether the harness's `test` still carries the lane control.
//
// The lane control's per-test attribution rides an AUTOMATIC fixture on the `test` that `e2e/support/harness.ts`
// exports. A spec that takes `test` from `@playwright/test` instead declares its tests on a `test` without that
// fixture, and nothing would say so. This names every such file. Kept apart from its test so it can be run over any
// tree — the red-first observation ran it over `HEAD`'s.
//
// ⭑ WHAT COUNTS AS TAKING PLAYWRIGHT'S `test` (every form that yields it):
//   · a named import of `test`, aliased or not, that is not type-only — `import { test }`, `import { test as t }`;
//   · a DEFAULT import — `@playwright/test`'s default export IS `test`;
//   · a NAMESPACE import — `import * as pw` makes `pw.test` reachable;
//   · a re-export of it — `export { test } from`, `export * from`;
//   · `require('@playwright/test')` or `import('@playwright/test')` — which cannot be told apart from the forms above;
//   · a TypeScript import-equals, `import pw = require('@playwright/test')` — not a call, so it has its own limb.
// ⭑ AND FROM EITHER MODULE NAME: `@playwright/test` is a re-export of the unscoped `playwright/test`, which yields the
// same `test` (both added after J1-3's adversarial review found them passing).
// A type-only import (`import type`, `import type pw = require(…)`, or a named import marked `type`) and `expect`,
// `request`, `devices`, `defineConfig`, … are free.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import ts from 'typescript';

export const E2E_DIR = 'apps/rph-demo/e2e';
export const HARNESS = `${E2E_DIR}/support/harness.ts`;
/** The module names that yield Playwright's `test`: the scoped package, and the unscoped module it re-exports. */
const PLAYWRIGHT = new Set(['@playwright/test', 'playwright/test']);

function tsFiles(dir: string, acc: string[] = []): string[] {
	if (!existsSync(dir)) return acc;
	for (const name of readdirSync(dir)) {
		const p = `${dir}/${name}`;
		if (statSync(p).isDirectory()) tsFiles(p, acc);
		else if (/\.[cm]?ts$/.test(name)) acc.push(p);
	}
	return acc;
}

const fromPlaywright = (n: ts.Expression | undefined): boolean =>
	n !== undefined && ts.isStringLiteral(n) && PLAYWRIGHT.has(n.text);

/** Each way `source` takes Playwright's own `test`, as `line: text`. Empty when it takes none. */
export function playwrightTestTakes(source: string): string[] {
	const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const out: string[] = [];
	const at = (n: ts.Node, what: string) =>
		out.push(`${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${what}`);
	const visit = (n: ts.Node): void => {
		if (
			ts.isImportDeclaration(n) &&
			fromPlaywright(n.moduleSpecifier) &&
			!n.importClause?.isTypeOnly
		) {
			const clause = n.importClause;
			if (clause?.name)
				at(n, `a default import (${clause.name.text}) — the module's default export IS test`);
			const bindings = clause?.namedBindings;
			if (bindings && ts.isNamespaceImport(bindings))
				at(n, `a namespace import (${bindings.name.text})`);
			if (bindings && ts.isNamedImports(bindings))
				for (const el of bindings.elements)
					if (!el.isTypeOnly && (el.propertyName ?? el.name).text === 'test')
						at(el, `a named import of test`);
		}
		if (ts.isExportDeclaration(n) && fromPlaywright(n.moduleSpecifier) && !n.isTypeOnly) {
			const clause = n.exportClause;
			if (clause === undefined || !ts.isNamedExports(clause))
				at(n, 'a re-export of the whole module');
			else
				for (const el of clause.elements)
					if (!el.isTypeOnly && (el.propertyName ?? el.name).text === 'test')
						at(el, 'a re-export of test');
		}
		if (
			ts.isCallExpression(n) &&
			(n.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(n.expression) && n.expression.text === 'require')) &&
			fromPlaywright(n.arguments[0])
		)
			at(n, 'a dynamic import or require of the module');
		if (
			ts.isImportEqualsDeclaration(n) &&
			!n.isTypeOnly &&
			ts.isExternalModuleReference(n.moduleReference) &&
			fromPlaywright(n.moduleReference.expression)
		)
			at(n, 'an import-equals require of the module');
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** Whether `source` imports `test` from the harness module (`…/support/harness`, or `./harness` beside it). */
export function takesHarnessTest(source: string, fromSupport: boolean): boolean {
	const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	return sf.statements.some(
		(s) =>
			ts.isImportDeclaration(s) &&
			ts.isStringLiteral(s.moduleSpecifier) &&
			(fromSupport
				? s.moduleSpecifier.text === './harness'
				: /(^|\/)support\/harness$/.test(s.moduleSpecifier.text)) &&
			!s.importClause?.isTypeOnly &&
			s.importClause?.namedBindings !== undefined &&
			ts.isNamedImports(s.importClause.namedBindings) &&
			s.importClause.namedBindings.elements.some(
				(el) => !el.isTypeOnly && (el.propertyName ?? el.name).text === 'test'
			)
	);
}

/**
 * Whether the harness's exported `test` is `<something>.extend(...)` carrying a fixture declared `{ auto: true }` — the
 * lane control's per-test fixture. ⚠ STRUCTURAL, not behavioural: that the fixture DOES what it says is the lane's
 * business, observed in the browser suite.
 */
export function harnessTestIsAutoExtended(source: string): boolean {
	const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	let found = false;
	const hasAuto = (n: ts.Node): boolean => {
		if (
			ts.isPropertyAssignment(n) &&
			ts.isIdentifier(n.name) &&
			n.name.text === 'auto' &&
			n.initializer.kind === ts.SyntaxKind.TrueKeyword
		)
			return true;
		return ts.forEachChild(n, hasAuto) ?? false;
	};
	for (const s of sf.statements) {
		if (
			!ts.isVariableStatement(s) ||
			!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
		)
			continue;
		for (const d of s.declarationList.declarations) {
			const init = d.initializer;
			if (
				ts.isIdentifier(d.name) &&
				d.name.text === 'test' &&
				init !== undefined &&
				ts.isCallExpression(init) &&
				ts.isPropertyAccessExpression(init.expression) &&
				init.expression.name.text === 'extend' &&
				hasAuto(init)
			)
				found = true;
		}
	}
	return found;
}

export interface CensusResult {
	/** Every `.ts` under `e2e/` other than the harness, repo-relative. */
	readonly scanned: readonly string[];
	/** Each file that takes Playwright's own `test`, with how. */
	readonly takers: Readonly<Record<string, readonly string[]>>;
	/** Each spec (`*.e2e.ts`) that does NOT take its `test` from the harness module. */
	readonly specsWithoutHarnessTest: readonly string[];
	/** How many files take `test` from the harness module. */
	readonly harnessTakers: number;
}

/** The census over the tree rooted at `root` (a repository root). */
export function e2eImportCensus(root: string): CensusResult {
	const scanned = tsFiles(`${root}/${E2E_DIR}`)
		.map((f) => f.slice(root.length + 1))
		.filter((rel) => rel !== HARNESS)
		.sort((a, b) => a.localeCompare(b));
	const takers: Record<string, readonly string[]> = {};
	const specsWithoutHarnessTest: string[] = [];
	let harnessTakers = 0;
	for (const rel of scanned) {
		const source = readFileSync(`${root}/${rel}`, 'utf8');
		const takes = playwrightTestTakes(source);
		if (takes.length > 0) takers[rel] = takes;
		const fromHarness = takesHarnessTest(source, rel.startsWith(`${E2E_DIR}/support/`));
		if (fromHarness) harnessTakers += 1;
		if (rel.endsWith('.e2e.ts') && !fromHarness) specsWithoutHarnessTest.push(rel);
	}
	return { scanned, takers, specsWithoutHarnessTest, harnessTakers };
}
