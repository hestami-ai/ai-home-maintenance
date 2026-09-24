// ⛔ WHO MAY WRITE A STIPULATION — a census, so that a new writer is a REVIEWED act rather than an accident
// (`JAN-CRITREAD` J1-1d; `DESIGN-what-the-tests-prove.md` §4.3; `REG-D-071` Q5).
//
// ── WHY A CENSUS ──────────────────────────────────────────────────────────────────────────────────────────────
// Form D records a test-stipulated answer as `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it, and an
// engine built to admit stipulations counts that row as met. The engine admits a stipulated row from ANY writer —
// it cannot tell the stand-in from a test that hand-writes the field. Two channels are closed by construction
// (`/test-api/dispatch` refuses the field; `coerceJudgement` drops a model's). What remains is in-process code: any
// file that writes the field, or builds an engine with `admitStipulatedAnswers: true`. This gate names every one.
//
// ── WHAT COUNTS AS A WRITE ────────────────────────────────────────────────────────────────────────────────────
// · a property ASSIGNMENT named `stipulated` — `{ stipulated: 'MET' }`, `{ stipulated: true }`, `{ stipulated }` —
//   whatever its value, in any object literal, including a schema's shape and a test's fixture;
// · a property assignment named `admitStipulatedAnswers` — shorthand included — whose value is not merely
//   FORWARDED from another holder of the same name (`deps.admitStipulatedAnswers`, `this.admitStipulatedAnswers`)
//   and is not `false`.
// A READ (`c.stipulated`, `engine.admitStipulatedAnswers`) and a TYPE (`readonly stipulated?: true`) are not
// writes, so readers of the field are free.
//
// ⚠ THE THREAT MODEL, stated so this is not read wider than it is: an accidental or unnoticed writer, in product
// code or a test. A deliberate forger can write around any census; that is a code-review matter.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Where writers can live. Tests INCLUDED — a test that builds an admitting engine is exactly what this watches. */
const TREES = ['packages', 'apps/rph-demo/src', 'apps/rph-demo/e2e', 'verif', 'scripts'];
/** Never source: build output, dependencies, generated framework state. */
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.svelte-kit', 'build', 'coverage', 'schemas', 'vocab']);

/**
 * ⛔ THE NAMED WRITERS — PINNED, each with WHY it writes and HOW MANY writes it holds. Adding a file is the act this
 * gate exists to make visible: say why, here, in the same commit.
 *
 * ⭑ WHY THE COUNT (J1-2b): naming a file used to exempt the WHOLE file, so a new writer added to a named one —
 * `workbench.ts`, say, beside the flag it already sets — went unseen. J1-2b made that concrete: its read-side tally
 * and projection trip this census, and naming `floor.ts` whole would have blinded it to the one module that runs the
 * floor. A named file now writes exactly as many times as pinned; one more is a new writer, and reddens.
 */
const WRITERS: Readonly<Record<string, { readonly why: string; readonly writes: number }>> = {
	'packages/rph-contracts/src/messages.ts': { why: 'GENERATED — the two payload schemas declare the optional field', writes: 2 },
	'packages/rph-application/src/handlers/assurance.ts': { why: 'copies the command’s field onto the event, field by field', writes: 1 },
	'packages/rph-assurance/src/validators.ts': {
		why: 'the mapper: a stipulated clean finding → UNABLE_TO_DETERMINE + stipulated MET',
		writes: 1
	},
	'packages/rph-engine/src/record-assurance.ts': {
		why: 'the recorder sends FloorCriterion.stipulated across the command boundary',
		writes: 1
	},
	'packages/rph-engine/src/engine.ts': {
		why: 'the handle reports the flag the Engine was built with (`deps.admitStipulatedAnswers === true`)',
		writes: 1
	},
	'apps/rph-demo/src/lib/server/workbench.ts': { why: 'the demo host builds the admitting engine — in TEST mode only', writes: 1 },
	'apps/rph-demo/src/lib/server/assurance/standin-reasoning-review-validator.ts': {
		why: 'THE declared stand-in (J1-2): stipulates the DERIVED remainder CLEAN, only where a test registered one',
		writes: 1
	},
	'apps/rph-demo/src/lib/server/assurance/standin-reasoning-review-validator.test.ts': {
		why: 'the stand-in’s rules, composed as an ADMITTING engine would compose them',
		writes: 1
	},
	'packages/rph-application/src/handlers/record-criterion-result.test.ts': {
		why: 'the handler’s guard: a stipulated command reaches the event',
		writes: 3
	},
	'packages/rph-application/src/handlers/stipulated-answer-gate.test.ts': {
		why: 'Gate E’s admitting branch, driven in admitting and non-admitting engines',
		writes: 2
	},
	'packages/rph-assurance/src/stipulated-row-is-not-a-pass.test.ts': { why: 'the mapper’s and the ladder’s guards', writes: 11 },
	'packages/rph-engine/src/record-assurance.test.ts': { why: 'the recorder’s guard, and the admitting floor end to end', writes: 3 },
	'packages/rph-engine/src/admit-stipulated-answers.test.ts': {
		why: 'the durability lock: admitting engines built over every kind of store',
		writes: 3
	},
	'apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.test.ts': {
		why: 'a MODEL reply that carries `stipulated` — which must be dropped',
		writes: 1
	},
	'apps/rph-demo/src/lib/server/test-api-dispatch-stipulation.test.ts': {
		why: 'a request carrying `stipulated`, which the dispatch route must refuse',
		writes: 1
	},
	// ── READ SIDE (J1-2b, the disclosure): each carries or counts a RECORDED claim; none builds a command. ──────
	'apps/rph-demo/src/lib/server/floor.ts': {
		why: 'the tally’s count, named `stipulated`, and the read-back copying each recorded row’s claim — no command is built',
		writes: 2
	},
	'packages/rph-projections/src/assurance-view.ts': {
		why: 'the §38 view folds each criterion’s recorded claim into criterionResults — a projection, no command',
		writes: 1
	},
	'apps/rph-demo/src/lib/server/floor-disclosure.test.ts': {
		why: 'the disclosure’s fixtures: tallies and rows handed to pure functions — nothing dispatched',
		writes: 9
	},
	'packages/rph-projections/src/assurance-view.test.ts': {
		why: 'event fixtures for the pure §38 projection — nothing dispatched',
		writes: 2
	}
};

function everyFile(dir: string, acc: string[] = []): string[] {
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return acc;
	}
	for (const name of names) {
		if (EXCLUDED_DIRS.has(name)) continue;
		const p = `${dir}/${name}`;
		if (statSync(p).isDirectory()) everyFile(p, acc);
		else if (/\.(ts|mts|cts|svelte)$/.test(name)) acc.push(p);
	}
	return acc;
}

/** The TypeScript in a file: a `.svelte` file's `<script>` bodies, anything else whole. */
function scriptsOf(file: string, source: string): string[] {
	if (!file.endsWith('.svelte')) return [source];
	return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');
}

const isForward = (e: ts.Expression): boolean =>
	ts.isPropertyAccessExpression(e) && e.name.text === 'admitStipulatedAnswers';

/** Every write in a source text, as `line: text`. */
function writesIn(source: string): string[] {
	const out: string[] = [];
	const sf = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const visit = (n: ts.Node): void => {
		if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
			const name = ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : undefined;
			const init = ts.isPropertyAssignment(n) ? n.initializer : n.name;
			const write =
				name === 'stipulated' ||
				(name === 'admitStipulatedAnswers' && init.kind !== ts.SyntaxKind.FalseKeyword && !isForward(init));
			if (write) out.push(`${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}: ${n.getText().slice(0, 80)}`);
		}
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

function census(): Map<string, string[]> {
	const found = new Map<string, string[]>();
	for (const tree of TREES)
		for (const file of everyFile(`${ROOT}${tree}`)) {
			const rel = file.slice(ROOT.length);
			if (rel === 'verif/stipulation-writers.test.ts') continue; // its own fixtures are strings, and named below
			const hits = scriptsOf(file, readFileSync(file, 'utf8')).flatMap(writesIn);
			if (hits.length > 0) found.set(rel, hits);
		}
	return found;
}

describe('⛔ every writer of a stipulation is NAMED', () => {
	const found = census();

	it('⛔ no file outside the named list writes `stipulated`, or builds an engine that admits stipulations', () => {
		const unnamed = [...found.entries()]
			.filter(([file]) => !(file in WRITERS))
			.map(([file, hits]) => `${file} — ${hits.join(' | ')}`);
		expect(
			unnamed,
			'a NEW writer of a stipulation. Name it in WRITERS with the reason it writes one — in the same commit — or remove the write'
		).toEqual([]);
	});

	it('⛔ every named file still writes one — a stale name would hide the next writer behind it', () => {
		expect(Object.keys(WRITERS).filter((f) => !found.has(f))).toEqual([]);
	});

	it('⛔ a named file writes exactly as many times as pinned — one more is a NEW writer inside a named file', () => {
		// THE MUTANT: add a write to a named file (`J12B-M7`) — before J1-2b the file's name alone let it through.
		const drift = Object.entries(WRITERS)
			.filter(([file, w]) => found.has(file) && found.get(file)!.length !== w.writes)
			.map(([file, w]) => `${file} — pinned ${w.writes}, found ${found.get(file)!.length}: ${found.get(file)!.join(' | ')}`);
		expect(drift, 'a named file’s writes changed. Review the new or removed write, then re-pin its count with the reason').toEqual([]);
	});

	it('⭐ CONTROL — the census reads tests and product alike, and skips build output', () => {
		const files = TREES.flatMap((t) => everyFile(`${ROOT}${t}`)).map((f) => f.slice(ROOT.length));
		expect(files.some((f) => f.endsWith('.test.ts')), 'tests are in the population').toBe(true);
		expect(files.some((f) => f.includes('/dist/')), 'build output is not').toBe(false);
		expect(files.length, 'the walk read the repository').toBeGreaterThan(500);
	});
});

describe('⭐ CONTROL — what the instrument calls a write', () => {
	it('finds each written shape', () => {
		const src = [
			"const a = { stipulated: 'MET' };",
			'const b = { stipulated: true as const };',
			'const stipulated = 1; const c = { stipulated };',
			'const d = { admitStipulatedAnswers: true };',
			'const e = { admitStipulatedAnswers: someFlag() };',
			'const admitStipulatedAnswers = true; const f = { admitStipulatedAnswers };'
		].join('\n');
		expect(writesIn(src).map((h) => h.split(':')[0])).toEqual(['1', '2', '3', '4', '5', '6']);
	});

	it('and does NOT count a read, a type, a forward, or a refusing value', () => {
		const src = [
			'const x = c.stipulated;',
			'interface F { readonly stipulated?: true }',
			'const y = { admitStipulatedAnswers: deps.admitStipulatedAnswers };',
			'const z = { admitStipulatedAnswers: false };',
			'const w = { admitStipulatedAnswers: this.admitStipulatedAnswers };'
		].join('\n');
		expect(writesIn(src)).toEqual([]);
	});
});
