// ⭐ `JAN-SELRES` RS-1 (D4) — LOADING `model.ts` LOADS NO PI, AND SELECTING PI LOADS IT ONLY THROUGH THE DEFAULT OPENER.
//
// ⛔ WHAT WAS UNINSTRUMENTED. D4 keeps `openPi`'s default a LAZY import "so the gate still never loads Pi's SDK" — and
// nothing in the gate reddened when `model.ts` imported `../tools/pi-executor.js` eagerly: `model.test.ts`'s Pi case
// watches only the opener it injects, so an eager import BESIDE that opener passes it (`JAN-SELRES` RS-1's
// verification, ADV-M2). That mutant was not even driven then, because every test that could see it imports
// `model.ts` — and so would itself load Pi's SDK under the mutation.
//
// ⭑ SO THIS FILE READS `model.ts` AS SOURCE TEXT AND IMPORTS NEITHER IT NOR ANYTHING THAT DOES: only the parser, the
// filesystem and vitest. A structural walk — never a grep, so prose and strings may still name the module — asks:
//   · `model.ts`'s own loads of the Pi adapter: none static, and exactly one dynamic, inside the DEFAULT opener —
//     `const openPi = deps.openPi ?? (async (…) => (await import('../tools/pi-executor.js'))…)` — which runs only when
//     a Pi session is opened with no opener handed in;
//   · everything `model.ts` loads STATICALLY, followed file by file through relative and `$lib` imports: no Pi adapter,
//     no Pi SDK package, and no import the walk could not resolve (fail-closed — an unresolved edge is a finding).
// ⚠ WHAT IT DOES NOT SEE: a dynamic import in a file `model.ts` reaches (lazy there, as `model.ts`'s own is), and the
// imports inside a workspace package — `@janumipwb/*` is a leaf here, and only `apps/rph-demo` declares Pi's SDK.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
/** `apps/rph-demo/src/lib`, which SvelteKit's `$lib` names. */
const LIB = resolve(HERE, '..', '..');
const MODEL = join(HERE, 'model.ts');
const PI_EXECUTOR = resolve(HERE, '..', 'tools', 'pi-executor.ts');

/** A specifier naming the Pi adapter, however it is spelled. */
const PI_ADAPTER = /(^|\/)pi-executor(\.js|\.ts)?$/;
/** Pi's SDK — the package `pi-executor.ts` imports at module scope. */
const PI_SDK = /^@earendil-works\//;

const namesPiAdapter = (specifier: ts.Expression): boolean =>
	ts.isStringLiteralLike(specifier) && PI_ADAPTER.test(specifier.text);

/**
 * ⭑ IS `node` INSIDE `openPi`'s DEFAULT? — the arrow that is the right operand of `deps.openPi ?? (…)`, where that
 * expression initialises `const openPi`. Its nearest enclosing function must be that arrow, uncalled: an arrow invoked
 * where it is written, or an import in a function nested inside it, is not the default opener.
 */
function inDefaultOpener(node: ts.Node): boolean {
	let fn: ts.Node | undefined = node.parent;
	while (fn !== undefined && !ts.isFunctionLike(fn)) fn = fn.parent;
	if (fn === undefined || !ts.isArrowFunction(fn)) return false;
	let operand: ts.Node = fn;
	while (ts.isParenthesizedExpression(operand.parent)) operand = operand.parent;
	const either = operand.parent;
	if (
		!ts.isBinaryExpression(either) ||
		either.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken ||
		either.right !== operand
	)
		return false;
	const injected = either.left;
	if (
		!ts.isPropertyAccessExpression(injected) ||
		!ts.isIdentifier(injected.expression) ||
		injected.expression.text !== 'deps' ||
		injected.name.text !== 'openPi'
	)
		return false;
	let declared: ts.Node = either;
	while (ts.isParenthesizedExpression(declared.parent)) declared = declared.parent;
	return (
		ts.isVariableDeclaration(declared.parent) &&
		ts.isIdentifier(declared.parent.name) &&
		declared.parent.name.text === 'openPi'
	);
}

/**
 * Every place `source` LOADS the Pi adapter, by form. ⚠ A dynamic import whose module the walk cannot name is reported
 * whatever it names: it could be the adapter, and a walk that skipped it would pass by not looking.
 */
function piAdapterLoads(source: string): string[] {
	const sf = ts.createSourceFile('model.ts', source, ts.ScriptTarget.Latest, true);
	const out: string[] = [];
	const visit = (n: ts.Node): void => {
		if (
			ts.isImportDeclaration(n) &&
			namesPiAdapter(n.moduleSpecifier) &&
			!n.importClause?.isTypeOnly
		)
			out.push(n.importClause ? 'static import' : 'side-effect import');
		if (
			ts.isExportDeclaration(n) &&
			n.moduleSpecifier !== undefined &&
			namesPiAdapter(n.moduleSpecifier) &&
			!n.isTypeOnly
		)
			out.push('re-export');
		if (
			ts.isImportEqualsDeclaration(n) &&
			ts.isExternalModuleReference(n.moduleReference) &&
			namesPiAdapter(n.moduleReference.expression)
		)
			out.push('import-equals');
		if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
			const [specifier] = n.arguments;
			if (specifier === undefined || !ts.isStringLiteralLike(specifier))
				out.push('dynamic import of a module the walk cannot name');
			else if (PI_ADAPTER.test(specifier.text))
				out.push(
					inDefaultOpener(n)
						? 'dynamic import inside the default opener'
						: 'dynamic import OUTSIDE the default opener'
				);
		}
		if (
			ts.isCallExpression(n) &&
			ts.isIdentifier(n.expression) &&
			n.expression.text === 'require' &&
			n.arguments[0] !== undefined &&
			namesPiAdapter(n.arguments[0])
		)
			out.push('require');
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/**
 * The modules a file loads STATICALLY. ⚠ Only a wholly type-only declaration (`import type …`) is skipped: under
 * `verbatimModuleSyntax` an `import { type X }` is kept as an import of the module, so it is followed.
 */
function staticSpecifiers(sf: ts.SourceFile): string[] {
	const out: string[] = [];
	for (const s of sf.statements) {
		if (
			ts.isImportDeclaration(s) &&
			!s.importClause?.isTypeOnly &&
			ts.isStringLiteral(s.moduleSpecifier)
		)
			out.push(s.moduleSpecifier.text);
		if (
			ts.isExportDeclaration(s) &&
			!s.isTypeOnly &&
			s.moduleSpecifier !== undefined &&
			ts.isStringLiteral(s.moduleSpecifier)
		)
			out.push(s.moduleSpecifier.text);
		if (
			ts.isImportEqualsDeclaration(s) &&
			ts.isExternalModuleReference(s.moduleReference) &&
			ts.isStringLiteral(s.moduleReference.expression)
		)
			out.push(s.moduleReference.expression.text);
	}
	return out;
}

/** The file a relative or `$lib` specifier names, as the bundler resolves it — `.js` written for a `.ts` source. */
function resolveSpecifier(from: string, specifier: string): string | undefined {
	const base = specifier.startsWith('$lib/')
		? join(LIB, specifier.slice('$lib/'.length))
		: resolve(dirname(from), specifier);
	return [base.replace(/\.js$/, '.ts'), base, `${base}.ts`, join(base, 'index.ts')].find(
		(c) => existsSync(c) && statSync(c).isFile()
	);
}

/** Everything `entry` loads statically: the files, the bare packages they name, and the edges that did not resolve. */
function staticGraph(entry: string): {
	readonly files: readonly string[];
	readonly packages: readonly string[];
	readonly unresolved: readonly string[];
} {
	const files = new Set<string>();
	const packages = new Set<string>();
	const unresolved: string[] = [];
	const pending = [entry];
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (files.has(file)) continue;
		files.add(file);
		if (!file.endsWith('.ts')) continue;
		const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
		for (const specifier of staticSpecifiers(sf)) {
			if (!specifier.startsWith('.') && !specifier.startsWith('$lib/')) {
				packages.add(specifier);
				continue;
			}
			const target = resolveSpecifier(file, specifier);
			if (target === undefined) unresolved.push(`${file} -> ${specifier}`);
			else pending.push(target);
		}
	}
	return { files: [...files], packages: [...packages], unresolved };
}

const slashed = (path: string): string => path.split('\\').join('/');

describe('⭐ D4 — the gate never loads Pi’s SDK: `model.ts` reaches Pi only through the default opener', () => {
	it('⛔ model.ts loads the Pi adapter exactly once — dynamically, inside the default opener — and nowhere else', () => {
		expect(
			piAdapterLoads(readFileSync(MODEL, 'utf8')),
			'model.ts loads the Pi adapter somewhere a gate test would run it'
		).toEqual(['dynamic import inside the default opener']);
	});

	it('⛔ nothing model.ts loads STATICALLY is the Pi adapter or Pi’s SDK — and every edge was followed', () => {
		const graph = staticGraph(MODEL);
		// ⭑ ARRANGEMENT — the walk reached what model.ts imports as VALUES, so the absences below are not the absence of a
		// walk. (`executor-selection.ts` is imported as a type only, which is erased, so it is rightly not followed.)
		const reached = graph.files.map(slashed);
		for (const neighbour of ['assurance/agy-cli.ts', 'execution/producer-session.ts'])
			expect(
				reached.some((f) => f.endsWith(`/${neighbour}`)),
				`the walk never reached ${neighbour}`
			).toBe(true);
		expect(graph.unresolved, 'an import the walk could not follow').toEqual([]);
		expect(
			reached.filter((f) => PI_ADAPTER.test(f)),
			'loading model.ts loads the Pi adapter'
		).toEqual([]);
		expect(
			graph.packages.filter((p) => PI_SDK.test(p)),
			'loading model.ts loads Pi’s SDK'
		).toEqual([]);
	});
});

describe('⭑ CONTROLS — the walk sees each load it forbids, and passes what it must', () => {
	const OPENER = [
		'const openPi =',
		'\tdeps.openPi ??',
		'\t(async (context, modelId) =>',
		"\t\t(await import('../tools/pi-executor.js')).openPiExecutionSession(context, modelId));"
	].join('\n');

	it('the default opener, as model.ts writes it, is the one load it allows', () => {
		expect(piAdapterLoads(OPENER)).toEqual(['dynamic import inside the default opener']);
	});

	it('ADV-M2’s shape — an eager import BESIDE an injected opener — is seen', () => {
		expect(
			piAdapterLoads([`const piModule = import('../tools/pi-executor.js');`, OPENER].join('\n'))
		).toEqual([
			'dynamic import OUTSIDE the default opener',
			'dynamic import inside the default opener'
		]);
	});

	it('every static form is seen, a type-only one is not, and a mention is not a load', () => {
		expect(
			piAdapterLoads(
				[
					"import { openPiExecutionSession } from '../tools/pi-executor.js';",
					"import '../tools/pi-executor.js';",
					"export { openPiExecutionSession } from '../tools/pi-executor.js';",
					"import { type Thing } from '../tools/pi-executor.js';",
					"import type { Other } from '../tools/pi-executor.js';",
					"export type { Other } from '../tools/pi-executor.js';",
					"// import('../tools/pi-executor.js') in a comment",
					'const s = \'await import("../tools/pi-executor.js")\';'
				].join('\n')
			)
		).toEqual(['static import', 'side-effect import', 're-export', 'static import']);
	});

	it('an opener INVOKED where it is written, an import nested inside it, and an unnamed module are all seen', () => {
		expect(
			piAdapterLoads(
				[
					"const openPi = deps.openPi ?? (async () => (await import('../tools/pi-executor.js')))();",
					"const nested = deps.openPi ?? (async () => { const f = () => import('../tools/pi-executor.js'); return f(); });",
					'const named = deps.openPi ?? (async () => import(adapterPath));',
					"const other = deps.somethingElse ?? (async () => import('../tools/pi-executor.js'));"
				].join('\n')
			)
		).toEqual([
			'dynamic import OUTSIDE the default opener',
			'dynamic import OUTSIDE the default opener',
			'dynamic import of a module the walk cannot name',
			'dynamic import OUTSIDE the default opener'
		]);
	});

	it('the static walk sees Pi’s SDK where it IS loaded — from the adapter itself, read as text', () => {
		const graph = staticGraph(PI_EXECUTOR);
		expect(graph.packages.filter((p) => PI_SDK.test(p)).length).toBeGreaterThan(0);
		// …and the adapter's own path, in the form the walk records it, is one the file check matches.
		expect(graph.files.map(slashed).some((f) => PI_ADAPTER.test(f))).toBe(true);
	});
});
