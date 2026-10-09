// ⭐ `JAN-CRITREAD` J2-1 — THE REVIEW INPUT MODULE STAYS LOADABLE OUTSIDE THE DEMO HOST.
//
// `apps/rph-demo/src/lib/server/assurance/review-input.ts` builds what the reasoning reviewer is handed, and reviewer
// qualification replays cases through it from `scripts/reviewer-qual/` — outside SvelteKit, so no `$lib`, and
// outside the demo host, so nothing that opens or reads the host's engine (DESIGN-what-the-tests-prove.md §5.2:
// "one module whose imports exclude `authoring-turn.ts` and every `$lib` specifier"; ROADMAP J2-1: the guard
// refuses `$lib`, `authoring-turn`, `workbench`, `floor` and `floor-over-subject`).
//
// ⚠ THE WHOLE CLOSURE, NOT THE FIRST HOP. The failure this prevents is the runner failing to LOAD the module, and a
// helper the module imports that reaches `$lib` fails that exactly as a direct import does. So the walk follows
// every relative import to its file and reads that too; package imports (`@janumipwb/*`, `node:*`) end the walk —
// packages cannot import the app. Type-only imports and re-exports count: a type import of `floor.ts` pulls the
// floor, the authoring turn and `$lib` into any program that typechecks the module. So do the two forms that are
// not import statements — a type-level `import('…')` (an ImportTypeNode, not a call) and a triple-slash `path` or
// `types` reference (a comment the parser files beside the statements) — and each is resolved through the same
// walk and refused by the same list.
//
// ⭐ `JAN-PRQUAL` `PQ-1` (design D1; `REG-F-476`) — THE CENSUS RE-POINTED WITH THE PROCESS-RESULT RENDERER. A process result's
// renderer lived in `execution/process-result-floor.ts`, which imports `floor-over-subject`: the closure refused it, so no
// fingerprint reached what the reviewer of a process result reads (`REG-D-072` D17). It now lives INSIDE the closure —
// `assurance/process-result-render.ts`, with the fence module `assurance/review-fence.ts` — and `review-input.ts` imports
// both, and the validator's budget seam, at RUNTIME. The guard is unchanged in what it refuses (`floor-over-subject` among
// the rest, anywhere in the closure); what is added is that the census names the new modules as INSIDE it, so a renderer
// moved back behind the floor reddens here, and the floor that builds through the module is shown to stay OUTSIDE it.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url)).split('\\').join('/');
const SERVER = 'apps/rph-demo/src/lib/server';
const MODULE = `${SERVER}/assurance/review-input.ts`;
/** ⭐ `PQ-1` — the pure modules the builders now reach at runtime, each required INSIDE the closure. */
const RENDERER = `${SERVER}/assurance/process-result-render.ts`;
const FENCE = `${SERVER}/assurance/review-fence.ts`;
const VALIDATOR = `${SERVER}/assurance/reasoning-review-validator.ts`;
/** The host modules the closure may never reach: each opens, reads or records through the demo host's engine. */
const FORBIDDEN_MODULES = [
	`${SERVER}/authoring-turn.ts`,
	`${SERVER}/workbench.ts`,
	`${SERVER}/floor.ts`,
	`${SERVER}/execution/floor-over-subject.ts`
] as const;

/** A module a file names, and how it names it: by an import form, or by a triple-slash reference. */
interface Named {
	readonly spec: string;
	readonly how: 'imports' | 'references';
}

/**
 * Every module a file names — static imports (type-only included), re-exports, `import()` as a call AND as a type,
 * `require`, and triple-slash `path` and `types` references.
 */
function specifiersOf(fileName: string, text: string): Named[] {
	const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
	const out: Named[] = [];
	const imports = (spec: string): void => {
		out.push({ spec, how: 'imports' });
	};
	// A `path` reference names a FILE relative to this one, with or without a leading `./` — so it is made relative
	// here, and an absolute or aliased path fails to resolve and is refused below.
	for (const r of sf.referencedFiles)
		out.push({ spec: r.fileName.startsWith('.') ? r.fileName : `./${r.fileName}`, how: 'references' });
	// A `types` reference names a module as an import does: a package, or a relative path.
	for (const r of sf.typeReferenceDirectives) out.push({ spec: r.fileName, how: 'references' });
	const visit = (node: ts.Node): void => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		)
			imports(node.moduleSpecifier.text);
		else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference) &&
			ts.isStringLiteral(node.moduleReference.expression)
		)
			imports(node.moduleReference.expression.text);
		else if (
			ts.isCallExpression(node) &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
			node.arguments[0] &&
			ts.isStringLiteral(node.arguments[0])
		)
			imports(node.arguments[0].text);
		// `type F = import('../floor.js').FloorView` and `typeof import('…')` — a type, not a call.
		else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal))
			imports(node.argument.literal.text);
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return out;
}

/** A relative specifier, resolved to the repo-relative file it names (`./x.js` → `x.ts` or `x/index.ts`). */
function resolveRelative(root: string, fromFile: string, spec: string): string | undefined {
	const segs = fromFile.split('/').slice(0, -1);
	for (const s of spec.replace(/[.]js$/, '').split('/')) {
		if (s === '.') continue;
		if (s === '..') segs.pop();
		else segs.push(s);
	}
	const stem = segs.join('/');
	return [`${stem}.ts`, `${stem}/index.ts`, stem].find((c) => /[.]ts$/.test(c) && existsSync(`${root}${c}`));
}

interface ImportScan {
	/** Every file the walk read, repo-relative, entry first. */
	readonly closure: readonly string[];
	/** Every specifier seen, as `file: specifier`. */
	readonly seen: readonly string[];
	/** What the closure may not contain, each named with the file that imports it. */
	readonly violations: readonly string[];
}

/** Walk `entry`'s relative import closure under `root` and name every forbidden import in it. */
function scanImports(root: string, entry: string, forbidden: readonly string[]): ImportScan {
	const closure: string[] = [];
	const seen: string[] = [];
	const violations: string[] = [];
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.shift()!;
		if (closure.includes(file)) continue;
		closure.push(file);
		for (const { spec, how } of specifiersOf(file, readFileSync(`${root}${file}`, 'utf8'))) {
			seen.push(`${file}: ${spec}`);
			if (spec.startsWith('$')) {
				violations.push(`${file}: ${how} ${spec} — a SvelteKit alias, unresolvable outside the app`);
				continue;
			}
			if (!spec.startsWith('.')) continue; // a package or a builtin: packages cannot import the app
			const target = resolveRelative(root, file, spec);
			if (target === undefined) {
				// ⚠ FAIL CLOSED: an import this walk cannot follow is one it cannot clear.
				violations.push(`${file}: ${how} ${spec}, which does not resolve to a .ts file`);
				continue;
			}
			if (forbidden.includes(target)) violations.push(`${file}: ${how} ${spec} (${target})`);
			else queue.push(target);
		}
	}
	return { closure, seen, violations };
}

describe('JAN-CRITREAD J2-1 — review-input.ts imports nothing that needs SvelteKit or the demo host', () => {
	it('⛔ THIS REPOSITORY — nothing in the module’s import closure is $lib, the authoring turn, the workbench or a floor', () => {
		expect(scanImports(REPO_ROOT, MODULE, FORBIDDEN_MODULES).violations.join('; '), 'forbidden import(s)').toBe('');
	});

	// ⭐ `JAN-CRITREAD` J2-3 (DESIGN §5.6: "the check's builders live in the module of §5.2, with a guard that it imports
	// only that module, the validator and packages"). ⚠ Held to the SAME forbidden list rather than to an allow-list: the
	// check's closure also holds the runner, the record and the transports' failure class, all under
	// `scripts/reviewer-qual/`, and what the list refuses is exactly what would stop the check LOADING outside the app.
	it('⛔ J2-3 — the reviewer-qualification check’s closure is held to the same list, and reaches the builders and the validator', () => {
		const check = 'scripts/reviewer-qual/check.ts';
		const scan = scanImports(REPO_ROOT, check, FORBIDDEN_MODULES);
		expect(scan.violations.join('; '), 'forbidden import(s) in the check’s closure').toBe('');
		for (const f of [
			'scripts/reviewer-qual/check-core.ts',
			'scripts/reviewer-qual/fingerprint.ts',
			// ⭐ `JAN-PRQUAL` `PQ-1` (`REG-F-481`) — the skeleton's digest, which the fingerprint hashes beside the probes.
			'scripts/fence-skeleton/digest.ts',
			MODULE,
			`${SERVER}/assurance/reasoning-review-validator.ts`
		])
			expect(scan.closure, f).toContain(f);
	});

	// ⭐ `JAN-PRQUAL` `PQ-1` (design D1) — THE PROCESS-RESULT RENDERER IS INSIDE THE CLOSURE, AND ITS FLOOR IS NOT.
	it('⛔ PQ-1 — the renderer, the fence and the validator are in the module’s closure; the floor that builds through it is outside', () => {
		const scan = scanImports(REPO_ROOT, MODULE, FORBIDDEN_MODULES);
		for (const f of [RENDERER, FENCE, VALIDATOR]) expect(scan.closure, f).toContain(f);
		// ⛔ The floor imports `floor-over-subject`: the module importing IT would be refused — and it does not.
		expect(scan.closure).not.toContain(`${SERVER}/execution/process-result-floor.ts`);
		const viaFloor = scanImports(REPO_ROOT, `${SERVER}/execution/process-result-floor.ts`, FORBIDDEN_MODULES);
		expect(
			viaFloor.violations.some((v) => v.includes('floor-over-subject')),
			'CONTROL: the floor still reaches floor-over-subject, so the census can see the edge it refuses'
		).toBe(true);
		// ⭑ The renderer's OWN closure is held to the list too: it is what the fingerprint must reach.
		expect(scanImports(REPO_ROOT, RENDERER, FORBIDDEN_MODULES).violations.join('; ')).toBe('');
	});

	it('⭐ CONTROL — the population is real: the module is read, its imports are seen, and every banned module exists', () => {
		const scan = scanImports(REPO_ROOT, MODULE, FORBIDDEN_MODULES);
		expect(scan.closure[0]).toBe(MODULE);
		// Its three type sources — a reader that parsed nothing would pass the census above vacuously.
		expect(scan.seen).toEqual(
			expect.arrayContaining([
				`${MODULE}: @janumipwb/rph-contracts`,
				`${MODULE}: @janumipwb/rph-assurance`,
				`${MODULE}: @janumipwb/rph-projections`
			])
		);
		// ⭐ `PQ-1` — and its RUNTIME imports: the renderer, the validator's budget seam, and the fence module for the one
		// encoder of JSON on a line (`jsonLine`, `REG-F-481`), which the renderer and the validator import too.
		expect(scan.seen).toEqual(
			expect.arrayContaining([
				`${MODULE}: ./process-result-render.js`,
				`${MODULE}: ./reasoning-review-validator.js`,
				`${MODULE}: ./review-fence.js`
			])
		);
		// A ban on a path that moved would ban nothing.
		for (const f of FORBIDDEN_MODULES) expect(existsSync(`${REPO_ROOT}${f}`), f).toBe(true);
	});

	describe('⛔ CONTROL — every form is caught, directly and through a helper (mkdtemp fixtures)', () => {
		const dirs: string[] = [];
		afterAll(() => {
			for (const d of dirs) rmSync(d, { recursive: true, force: true });
		});

		/** A fixture tree holding the banned modules (empty) and an entry module with `body`, plus a helper. */
		function fixture(body: string, helper = "export type { AssessmentCriterion } from '@janumipwb/rph-contracts';\n") {
			const root = `${mkdtempSync(join(tmpdir(), 'j21-imports-')).split('\\').join('/')}/`;
			dirs.push(root);
			for (const f of [...FORBIDDEN_MODULES, MODULE, `${SERVER}/assurance/helper.ts`]) {
				mkdirSync(`${root}${f.slice(0, f.lastIndexOf('/'))}`, { recursive: true });
				writeFileSync(`${root}${f}`, 'export {};\n');
			}
			writeFileSync(`${root}${MODULE}`, body);
			writeFileSync(`${root}${SERVER}/assurance/helper.ts`, helper);
			return root;
		}
		const violationsOf = (root: string) => scanImports(root, MODULE, FORBIDDEN_MODULES).violations;

		it('a clean module — packages and a clean helper — is not refused (the guard does not refuse everything)', () => {
			const root = fixture(
				"import type { PwaGraphExport } from '@janumipwb/rph-projections';\nimport './helper.js';\nexport {};\n"
			);
			expect(violationsOf(root)).toEqual([]);
		});

		it.each([
			['a $lib import', "import { x } from '$lib/server/stipulations.js';\n", /imports \$lib\/server\/stipulations\.js — a SvelteKit alias/],
			['a TYPE-only import of the floor', "import type { FloorView } from '../floor.js';\n", /imports \.\.\/floor\.js \(apps\/rph-demo\/src\/lib\/server\/floor\.ts\)/],
			['a re-export from the workbench', "export { getEngine } from '../workbench.js';\n", /imports \.\.\/workbench\.js \(apps\/rph-demo\/src\/lib\/server\/workbench\.ts\)/],
			['a dynamic import of the authoring turn', "export const t = () => import('../authoring-turn.js');\n", /imports \.\.\/authoring-turn\.js \(apps\/rph-demo\/src\/lib\/server\/authoring-turn\.ts\)/],
			['an import that does not resolve', "import './nowhere.js';\n", /imports \.\/nowhere\.js, which does not resolve/],
			// ⚠ THE FORMS THAT ARE NOT IMPORT STATEMENTS. A type-level `import('…')` is an ImportTypeNode, not a call, and a
			// triple-slash directive is a comment the parser files beside the statements — each pulls its target into any
			// program that typechecks the module, exactly as an import declaration does.
			['a TYPE-LEVEL import() of the floor', "export type F = import('../floor.js').FloorView;\n", /imports \.\.\/floor\.js \(apps\/rph-demo\/src\/lib\/server\/floor\.ts\)/],
			['a triple-slash PATH reference to the floor', '/// <reference path="../floor.ts" />\nexport {};\n', /references \.\.\/floor\.ts \(apps\/rph-demo\/src\/lib\/server\/floor\.ts\)/],
			['a triple-slash TYPES reference to the workbench', '/// <reference types="../workbench" />\nexport {};\n', /references \.\.\/workbench \(apps\/rph-demo\/src\/lib\/server\/workbench\.ts\)/]
		])('%s is refused, and named', (_label, body, message) => {
			const violations = violationsOf(fixture(body));
			expect(violations).toHaveLength(1);
			expect(violations[0]).toMatch(message);
		});

		it('a HELPER that imports floor-over-subject is refused — the walk reads the whole closure', () => {
			const root = fixture("import './helper.js';\n", "import '../execution/floor-over-subject.js';\n");
			expect(violationsOf(root)).toEqual([
				`${SERVER}/assurance/helper.ts: imports ../execution/floor-over-subject.js (${SERVER}/execution/floor-over-subject.ts)`
			]);
		});

		it('a HELPER reached only by a triple-slash reference is read too — a reference joins the closure as an import does', () => {
			const root = fixture('/// <reference path="helper.ts" />\nexport {};\n', "import '../execution/floor-over-subject.js';\n");
			expect(violationsOf(root)).toEqual([
				`${SERVER}/assurance/helper.ts: imports ../execution/floor-over-subject.js (${SERVER}/execution/floor-over-subject.ts)`
			]);
		});
	});
});
