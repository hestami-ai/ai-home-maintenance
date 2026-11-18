/**
 * The Sonar exceptions register's committed checks (JAN-SONARCM D-5; roadmap S5): the register and JAN-ENGC-001 §7.4's
 * fields; the approval against the decision register (V-8's first two limbs, J6); the join between markers and
 * entries (V-8's last two); the directives the Sonar scope admits; the NOSONAR census (V-10); the declared pins
 * (route (b)); the comment reader; the generated page; V-9's lint channel, run live on JPWB's own configuration; and
 * V-9's record. Each predicted red is a fixture that fails alone, with its own message, while every other check
 * passes; the real tree passes first. The engine's runs are one-off proofs, recorded in the register, not tests here.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { afterAll, describe, expect, it } from 'vitest';
import {
	checkTree,
	commentsOf,
	isDate,
	isNoSonar,
	main,
	MARKER_FORM,
	pageDrift,
	PAGE_FILE,
	passedDates,
	problemsOf,
	readInputs,
	REGISTER_FILE,
	renderPage,
	RULE_SET_FILE,
	RULINGS_FILE,
	type ProofRun,
	type Register,
	type SourceComment
} from '../scripts/sonar/exceptions.js';

type Core = typeof import('../scripts/sonar/runner-core.cjs');

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const core = createRequire(import.meta.url)('../scripts/sonar/runner-core.cjs') as Core;
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const scratch: string[] = [];
function tempDir(label: string): string {
	const d = mkdtempSync(join(tmpdir(), `jpwb-sonar-exceptions-${label}-`));
	scratch.push(d);
	return d;
}
afterAll(() => {
	for (const d of scratch) rmSync(d, { recursive: true, force: true });
});

function put(dir: string, rel: string, text: string): void {
	mkdirSync(dirname(join(dir, rel)), { recursive: true });
	writeFileSync(join(dir, rel), text);
}

// ── The fixture: a register, a decision register, the scope's files and a pinning test that pass every check ──────

type Json = Record<string, unknown>;

const RULE_KEYS: ReadonlySet<string> = new Set(['typescript:S3776', 'typescript:S6582']);
const PIN = 'An edit to any file of the reference changes this digest';
const PIN_TEST = 'verif/pin.test.ts';
const PINNED_FILE = 'verif/fixtures/phase7/reference/src/options.js';
const RULINGS_PATH = 'docs/canon/JPWB-REG-005 Decision and Divergence Register.md';

const RULINGS = [
	'# A decision register (a fixture)',
	'',
	'## Rulings',
	'',
	'### REG-D-990 — SPONSOR RULING: the first exceptions',
	'',
	'EXC-001 and EXC-002 are approved, each for the reason its entry gives.',
	'',
	'### REG-D-991 — SPONSOR RULING: the lead may approve exceptions',
	'',
	'A delegation, recorded.',
	'',
	'### REG-D-992 — DELEGATED (`REG-D-991`): an exception approved under the delegation',
	'',
	'EXC-003 is approved under REG-D-991.',
	'',
	"### REG-D-993 — DECISION: a lead's own decision",
	'',
	'It names EXC-001 and EXC-003.',
	'',
	'### ~~REG-D-994~~ — SPONSOR RULING: struck',
	'',
	'It names EXC-001.',
	'',
	'### REG-D-995 — DELEGATED (`REG-D-993`): a delegation that rests on a decision',
	'',
	'It names EXC-003.',
	'',
	'### REG-D-996 — DELEGATED: no delegation named',
	'',
	'It names EXC-003.',
	'',
	'### REG-D-997 — SPONSOR RULING: about something else',
	'',
	'It names EXC-0010 and XEXC-001, and nothing more.',
	'',
	'### REG-D-998 — DELEGATED (`REG-D-999`): a delegation the register does not hold',
	'',
	'It names EXC-003.',
	''
].join('\n');

function baseEntry(id: string, more: Json): Json {
	return {
		id,
		tool: 'SonarJS',
		rule: { key: 'typescript:S3776', eslintName: 'sonarjs/cognitive-complexity' },
		finding: 'Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed.',
		why: 'The table reads as one decision; split, it reads as three.',
		risk: 'A later branch is added without a review of the whole.',
		controls: 'Each row of the table has its own test.',
		approval: { ruling: 'REG-D-990', kind: 'sponsor' },
		owner: 'the toolchain session',
		term: { temporary: false },
		...more
	};
}

function baseRegister(): Json {
	return {
		schema: 'jpwb-sonar-exceptions/1',
		$comment: 'A fixture.',
		exceptions: [
			baseEntry('EXC-001', { locations: [{ path: 'scripts/a.ts', markers: 1 }] }),
			baseEntry('EXC-002', {
				pinned: { path: PINNED_FILE, findings: 1 },
				why: "A test pins the file's bytes.",
				term: { temporary: true, review: '2027-01-01' }
			}),
			baseEntry('EXC-003', {
				rule: { key: 'typescript:S6582', eslintName: '@typescript-eslint/prefer-optional-chain' },
				finding: "Prefer using an optional chain expression instead, as it's more concise and easier to read.",
				locations: [{ path: 'scripts/b.ts', markers: 2 }],
				approval: { ruling: 'REG-D-992', kind: 'delegated' },
				term: { temporary: true, removal: 'when the parser of record accepts the chain', expiry: '2027-06-30' }
			})
		],
		pinnedFolders: [{ folder: 'verif/fixtures/phase7/reference/', pinnedBy: PIN_TEST, pin: PIN }],
		sharedNames: { $comment: 'A fixture.', derivedFrom: {}, names: [] },
		markerProof: { $comment: 'A fixture.', runs: [], cases: [] }
	};
}

function baseSources(): Record<string, string> {
	return {
		'scripts/a.ts': [
			'// eslint-disable-next-line sonarjs/cognitive-complexity -- EXC-001 the table reads as one decision',
			'export function a(): number {',
			'\treturn 1;',
			'}',
			''
		].join('\n'),
		'scripts/b.ts': [
			'export function b(x?: { y?: { z: number } }): number | undefined {',
			'\t// eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- EXC-003 the parser of record',
			'\tconst first = x && x.y && x.y.z;',
			'\t// eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- EXC-003 the same, again',
			'\treturn first ?? (x && x.y && x.y.z);',
			'}',
			''
		].join('\n'),
		'scripts/c.ts': [
			'// Text that only looks like a directive, or like NOSONAR, is not one: none of these is a comment.',
			"export const s = '// eslint-disable-next-line no-console -- EXC-009 a string';",
			'export const t = `/* eslint-disable */ ${s} // NOSONAR`;',
			'export const r = /[//]NOSONAR/;',
			'// A comment may mention NOSONAR later in its text, and a line comment may say eslint-disable: neither counts.',
			'// eslint-disable no-console',
			'/* eslint-env node */',
			'/* global window */',
			'/** eslint-disable */',
			''
		].join('\n'),
		[PINNED_FILE]: 'export const options = {};\n'
	};
}

interface Fixture {
	register: Json;
	sources: Record<string, string>;
	rulings: string;
	pins: Record<string, string>;
}

function fixture(): Fixture {
	return { register: baseRegister(), sources: baseSources(), rulings: RULINGS, pins: { [PIN_TEST]: `// ⚠ ${PIN}; it is re-pinned deliberately.\n` } };
}

function entry(f: Fixture, i: number): Json {
	return (f.register.exceptions as Json[])[i]!;
}

/** Appends one line to a file of the scope (a new file when absent) and returns its 1-based line number. */
function addLine(f: Fixture, path: string, line: string): number {
	const text = f.sources[path] ?? '';
	const n = text.split('\n').length;
	f.sources[path] = `${text}${line}\n`;
	return n;
}

/** Every check on a fixture, as `checkTree` runs them on a checkout; the page is always the fixture's own. */
function problems(f: Fixture): string[] {
	let pageText: string | undefined;
	try {
		pageText = renderPage(f.register as unknown as Register);
	} catch {
		pageText = undefined;
	}
	return problemsOf({
		registerJson: f.register,
		ruleKeys: RULE_KEYS,
		rulingsText: f.rulings,
		files: Object.entries(f.sources).map(([path, text]) => ({ path, text })),
		read: (p) => f.pins[p],
		pageText
	});
}

// ── The real tree, first ─────────────────────────────────────────────────────────────────────────────────────────

describe('the real tree', () => {
	it('CONTROL — passes every check: the register, the rulings, the pins, the scan of the Sonar scope, the join and the page', () => {
		expect(checkTree(ROOT, readInputs(ROOT))).toEqual([]);
	});

	it('the command, run as an operator runs it, says every check holds', () => {
		const r = spawnSync('bun', ['run', 'scripts/sonar/exceptions.ts', '--check'], { cwd: ROOT, encoding: 'utf8' });
		expect(r.stderr).toBe('');
		expect(r.stdout).toMatch(/^sonar:exceptions --check — every check holds \(\d+ exception\(s\)\)\.\n$/m);
		expect(r.status).toBe(0);
	});

	it('the paths the checks read are the ones the module names', () => {
		expect([REGISTER_FILE, PAGE_FILE, RULE_SET_FILE, RULINGS_FILE]).toEqual([
			'docs/operations/sonar-exceptions.json',
			'docs/operations/sonar-exceptions.md',
			'scripts/sonar/rules.json',
			RULINGS_PATH
		]);
	});
});

describe('the fixture', () => {
	it('CONTROL — passes every check, with a marker entry, a pinned entry and a delegated one', () => {
		expect(problems(fixture())).toEqual([]);
	});
});

// ── V-8: the register meets §7.4 and joins its markers, each limb alone ──────────────────────────────────────────

describe('V-8, each limb alone', () => {
	it('an entry with no owner', () => {
		const f = fixture();
		delete entry(f, 0).owner;
		expect(problems(f)).toEqual(['EXC-001: "owner" is missing or empty (JAN-ENGC-001 §7.4)']);
	});

	it('an approval citing a ruling the register lacks', () => {
		const f = fixture();
		entry(f, 0).approval = { ruling: 'REG-D-999', kind: 'sponsor' };
		expect(problems(f)).toEqual([`EXC-001: its approval cites REG-D-999, which the decision register does not hold (${RULINGS_PATH})`]);
	});

	it('a marker with no entry', () => {
		const f = fixture();
		const n = addLine(f, 'scripts/d.ts', '// eslint-disable-next-line sonarjs/cognitive-complexity -- EXC-009 no entry has this id');
		expect(problems(f)).toEqual([`scripts/d.ts:${n}: the marker cites EXC-009, which has no entry in docs/operations/sonar-exceptions.json`]);
	});

	it('an entry with no marker that is not pinned', () => {
		const f = fixture();
		f.sources['scripts/a.ts'] = 'export function a(): number {\n\treturn 1;\n}\n';
		expect(problems(f)).toEqual(['EXC-001: no marker in the Sonar scope cites it, and it is not a pinned entry']);
	});
});

describe("§7.4's other fields and the register's form, each alone", () => {
	for (const field of ['finding', 'why', 'risk', 'controls'] as const) {
		it(`an entry with no "${field}"`, () => {
			const f = fixture();
			delete entry(f, 0)[field];
			expect(problems(f)).toEqual([`EXC-001: "${field}" is missing or empty (JAN-ENGC-001 §7.4)`]);
		});
	}

	it('an entry whose text is blank', () => {
		const f = fixture();
		entry(f, 0).risk = '   ';
		expect(problems(f)).toEqual(['EXC-001: "risk" is missing or empty (JAN-ENGC-001 §7.4)']);
	});

	it('an entry whose text holds a line break', () => {
		const f = fixture();
		entry(f, 0).why = 'one line\nand another';
		expect(problems(f)).toEqual(['EXC-001: "why" holds a line break; write it as one line']);
	});

	it('an entry with no tool, or another tool', () => {
		const f = fixture();
		delete entry(f, 0).tool;
		expect(problems(f)).toEqual(['EXC-001: "tool" must be "SonarJS", not undefined']);
		entry(f, 0).tool = 'ESLint';
		expect(problems(f)).toEqual(['EXC-001: "tool" must be "SonarJS", not "ESLint"']);
	});

	it('an entry with no rule', () => {
		const f = fixture();
		delete entry(f, 0).rule;
		expect(problems(f)).toEqual(['EXC-001: "rule" is missing (JAN-ENGC-001 §7.4)']);
	});

	it('a rule key the committed rule set lacks', () => {
		const f = fixture();
		entry(f, 0).rule = { key: 'typescript:S9999', eslintName: 'sonarjs/cognitive-complexity' };
		expect(problems(f)).toEqual(['EXC-001: rule typescript:S9999 is not in the committed rule set (scripts/sonar/rules.json)']);
	});

	it("a rule key that is not the engine's form", () => {
		const f = fixture();
		entry(f, 0).rule = { key: 'S3776', eslintName: 'sonarjs/cognitive-complexity' };
		expect(problems(f)).toEqual(['EXC-001: "rule.key" must be the engine\'s key, such as typescript:S3776, not "S3776"']);
	});

	it('an ESLint name that is not one', () => {
		const f = fixture();
		entry(f, 0).rule = { key: 'typescript:S3776', eslintName: 'Sonarjs/Cognitive Complexity' };
		expect(problems(f)).toEqual(['EXC-001: "rule.eslintName" must be the rule\'s name as ESLint knows it, not "Sonarjs/Cognitive Complexity"']);
	});

	it('an entry with neither locations nor pinned, and one with both', () => {
		const f = fixture();
		delete entry(f, 0).locations;
		expect(problems(f)).toEqual(['EXC-001: give "locations" (its markers\' files) or "pinned" (route (b)), exactly one']);
		entry(f, 0).locations = [{ path: 'scripts/a.ts', markers: 1 }];
		entry(f, 0).pinned = { path: PINNED_FILE, findings: 1 };
		expect(problems(f)).toEqual(['EXC-001: give "locations" (its markers\' files) or "pinned" (route (b)), exactly one']);
	});

	it('a location with no count, and a file listed twice', () => {
		const f = fixture();
		entry(f, 0).locations = [{ path: 'scripts/a.ts', markers: 0 }];
		expect(problems(f)).toEqual(['EXC-001: each location must hold "path" and "markers", a count of 1 or more']);
		entry(f, 0).locations = [
			{ path: 'scripts/a.ts', markers: 1 },
			{ path: 'scripts/a.ts', markers: 1 }
		];
		expect(problems(f)).toEqual(['EXC-001: scripts/a.ts is listed twice']);
	});

	it('an entry with no approval', () => {
		const f = fixture();
		delete entry(f, 0).approval;
		expect(problems(f)).toEqual(['EXC-001: "approval" is missing (JAN-ENGC-001 §7.4)']);
	});

	it('an approval of another kind, and one naming no REG-D ruling', () => {
		const f = fixture();
		entry(f, 0).approval = { ruling: 'REG-D-990', kind: 'lead' };
		expect(problems(f)).toEqual(['EXC-001: "approval.kind" must be "sponsor" or "delegated", not "lead"']);
		entry(f, 0).approval = { ruling: 'REG-F-638', kind: 'sponsor' };
		expect(problems(f)).toEqual(['EXC-001: "approval.ruling" must name a REG-D ruling, not "REG-F-638"']);
	});

	it('an entry with no term', () => {
		const f = fixture();
		delete entry(f, 0).term;
		expect(problems(f)).toEqual(['EXC-001: "term" must hold "temporary", true or false']);
	});

	it('a temporary exception with no removal condition, review date or expiry', () => {
		const f = fixture();
		entry(f, 0).term = { temporary: true };
		expect(problems(f)).toEqual(['EXC-001: a temporary exception needs a removal condition, a review date or an expiry (JAN-ENGC-001 §7.4)']);
	});

	it('a date that is not a calendar date, and an empty removal condition', () => {
		const f = fixture();
		entry(f, 1).term = { temporary: true, review: '2027-02-30' };
		expect(problems(f)).toEqual(['EXC-002: "term.review" must be a date, YYYY-MM-DD']);
		entry(f, 1).term = { temporary: true, review: '2027-01-01' };
		entry(f, 2).term = { temporary: true, removal: '', expiry: '2027-06-30' };
		expect(problems(f)).toEqual(['EXC-003: "term.removal" is empty']);
	});

	it('an unknown field', () => {
		const f = fixture();
		entry(f, 0).onwer = 'a typo';
		expect(problems(f)).toEqual(['EXC-001: unknown field "onwer"']);
	});

	it('a malformed id, and an id two entries share', () => {
		const f = fixture();
		entry(f, 0).id = 'EXC-1';
		expect(problems(f)).toEqual(['an entry\'s "id" must be EXC- and three digits, not "EXC-1"']);
		entry(f, 0).id = 'EXC-001';
		entry(f, 2).id = 'EXC-001';
		expect(problems(f)).toEqual(['EXC-001: 2 entries have this id']);
	});

	it('a register of another schema', () => {
		const f = fixture();
		f.register.schema = 'jpwb-sonar-exceptions/0';
		expect(problems(f)).toEqual(['docs/operations/sonar-exceptions.json: "schema" must be jpwb-sonar-exceptions/1, not "jpwb-sonar-exceptions/0"']);
	});

	it("a register missing its record of the shared names or of V-9", () => {
		const f = fixture();
		delete f.register.sharedNames;
		expect(problems(f)).toEqual(['"sharedNames" must hold "derivedFrom" and "names"']);
		f.register = baseRegister();
		delete f.register.markerProof;
		expect(problems(f)).toEqual(['"markerProof" must hold "runs" and "cases"']);
	});
});

// ── The approval: never the author's own (J6) ────────────────────────────────────────────────────────────────────

describe('the approval, each fault alone', () => {
	it('a ruling the register has struck', () => {
		const f = fixture();
		entry(f, 0).approval = { ruling: 'REG-D-994', kind: 'sponsor' };
		expect(problems(f)).toEqual(['EXC-001: its approval cites REG-D-994, which the decision register has struck']);
	});

	it("a lead's own DECISION given as the sponsor's", () => {
		const f = fixture();
		entry(f, 0).approval = { ruling: 'REG-D-993', kind: 'sponsor' };
		expect(problems(f)).toEqual(['EXC-001: its approval is "sponsor", but REG-D-993 is not a sponsor ruling (its heading reads "DECISION: a lead\'s own decision")']);
	});

	it('a delegated approval whose ruling names no delegation', () => {
		const f = fixture();
		entry(f, 2).approval = { ruling: 'REG-D-996', kind: 'delegated' };
		expect(problems(f)).toEqual(['EXC-003: its approval is "delegated", but REG-D-996\'s heading does not read DELEGATED (`REG-D-nnn`)']);
	});

	it('a delegation that rests on a decision, not on the sponsor', () => {
		const f = fixture();
		entry(f, 2).approval = { ruling: 'REG-D-995', kind: 'delegated' };
		expect(problems(f)).toEqual(['EXC-003: REG-D-995 rests on the delegation REG-D-993, which is not a sponsor ruling (its heading reads "DECISION: a lead\'s own decision")']);
	});

	it('a delegation the register does not hold', () => {
		const f = fixture();
		entry(f, 2).approval = { ruling: 'REG-D-998', kind: 'delegated' };
		expect(problems(f)).toEqual([`EXC-003: REG-D-998 rests on the delegation REG-D-999, which the decision register does not hold (${RULINGS_PATH})`]);
	});

	it('a ruling that does not name the entry: EXC-0010 and XEXC-001 are not EXC-001', () => {
		const f = fixture();
		entry(f, 0).approval = { ruling: 'REG-D-997', kind: 'sponsor' };
		expect(problems(f)).toEqual(['EXC-001: REG-D-997 does not name EXC-001']);
	});
});

// ── The markers, joined to their entries ─────────────────────────────────────────────────────────────────────────

describe('the join, each fault alone', () => {
	it("a marker naming a rule other than its entry's", () => {
		const f = fixture();
		f.sources['scripts/a.ts'] = (f.sources['scripts/a.ts'] ?? '').replace('sonarjs/cognitive-complexity', 'sonarjs/no-identical-functions');
		expect(problems(f)).toEqual(["scripts/a.ts:1: the marker for EXC-001 names sonarjs/no-identical-functions, but its entry's rule is sonarjs/cognitive-complexity"]);
	});

	it("a file whose count differs from its entry's", () => {
		const f = fixture();
		entry(f, 2).locations = [{ path: 'scripts/b.ts', markers: 3 }];
		expect(problems(f)).toEqual(['EXC-003: scripts/b.ts holds 2 marker(s) citing it; its entry says 3']);
	});

	it('a file its entry does not list', () => {
		const f = fixture();
		addLine(f, 'scripts/c.ts', '// eslint-disable-next-line sonarjs/cognitive-complexity -- EXC-001 a copy elsewhere');
		expect(problems(f)).toEqual(['EXC-001: scripts/c.ts holds 1 marker(s) citing it, but its entry does not list that file']);
	});

	it('a file its entry lists that is not in the Sonar scope', () => {
		const f = fixture();
		entry(f, 0).locations = [
			{ path: 'scripts/a.ts', markers: 1 },
			{ path: 'scripts/zz.ts', markers: 1 }
		];
		expect(problems(f)).toEqual(['EXC-001: scripts/zz.ts is not in the Sonar scope']);
	});

	it('a marker citing a pinned entry', () => {
		const f = fixture();
		const n = addLine(f, 'scripts/c.ts', '// eslint-disable-next-line sonarjs/cognitive-complexity -- EXC-002 a pinned one');
		expect(problems(f)).toEqual([`scripts/c.ts:${n}: the marker cites EXC-002, a pinned entry, which takes no marker`]);
	});
});

// ── The directives the Sonar scope admits: the marker alone ──────────────────────────────────────────────────────

describe('the directives, each alone', () => {
	const form = (n: number, kind: string): string =>
		`scripts/c.ts:${n}: ${kind} can turn a rule off; the only directive the Sonar scope admits is the marker, ${MARKER_FORM}`;
	const cases: ReadonlyArray<readonly [string, string, (n: number) => string]> = [
		['a block eslint-disable', '/* eslint-disable sonarjs/cognitive-complexity */', (n) => form(n, '/* eslint-disable */')],
		['an eslint-enable', '/* eslint-enable */', (n) => form(n, '/* eslint-enable */')],
		['the -line form', 'f(); // eslint-disable-line no-console', (n) => form(n, '// eslint-disable-line')],
		['an inline rule configuration', '/* eslint no-console: "off" */', (n) => form(n, '/* eslint */')],
		[
			'the marker in a block comment',
			'/* eslint-disable-next-line sonarjs/cognitive-complexity -- EXC-001 the block form */',
			(n) => form(n, '/* eslint-disable-next-line */')
		],
		[
			'a -next-line without an exception',
			'// eslint-disable-next-line no-console',
			(n) =>
				`scripts/c.ts:${n}: eslint-disable-next-line no-console cites no exception; write ${MARKER_FORM}, with an entry in docs/operations/sonar-exceptions.json (J1)`
		],
		[
			'a -next-line whose reason cites no exception',
			'// eslint-disable-next-line no-console -- logging is the point',
			(n) =>
				`scripts/c.ts:${n}: eslint-disable-next-line no-console cites no exception; write ${MARKER_FORM}, with an entry in docs/operations/sonar-exceptions.json (J1)`
		],
		[
			'a marker with an id and no reason',
			'// eslint-disable-next-line sonarjs/cognitive-complexity -- EXC-001',
			(n) => `scripts/c.ts:${n}: the marker for EXC-001 gives no reason after the id`
		],
		[
			'a marker whose reason does not follow its id after a space',
			'// eslint-disable-next-line sonarjs/cognitive-complexity -- EXC-001: a colon',
			(n) => `scripts/c.ts:${n}: the marker's reason must follow its id after a space: ${MARKER_FORM}`
		],
		[
			'a marker naming two rules',
			'// eslint-disable-next-line sonarjs/a, sonarjs/b -- EXC-001 two',
			(n) => `scripts/c.ts:${n}: a marker names one rule, and this names 2 (sonarjs/a, sonarjs/b)`
		],
		['a marker naming no rule', '// eslint-disable-next-line -- EXC-001 none', (n) => `scripts/c.ts:${n}: a marker names one rule, and this names none`]
	];
	for (const [name, line, message] of cases) {
		it(name, () => {
			const f = fixture();
			const n = addLine(f, 'scripts/c.ts', line);
			expect(problems(f)).toEqual([message(n)]);
		});
	}

	it('CONTROL — a quoted rule is read as ESLint reads it, without its quotes', () => {
		const f = fixture();
		f.sources['scripts/a.ts'] = (f.sources['scripts/a.ts'] ?? '').replace('sonarjs/cognitive-complexity', '"sonarjs/cognitive-complexity"');
		expect(problems(f)).toEqual([]);
	});
});

// ── V-10: no NOSONAR ─────────────────────────────────────────────────────────────────────────────────────────────

describe('V-10, the NOSONAR census', () => {
	for (const line of ['//NOSONAR', '/* nosonar */', '/** NOSONAR */', 'f(); // NoSonar: mixed case']) {
		it(`a copy with ${line}`, () => {
			const f = fixture();
			const n = addLine(f, 'scripts/c.ts', line);
			expect(problems(f)).toEqual([
				`scripts/c.ts:${n}: a comment starts with NOSONAR, which silences every rule on its line in the engine; record an exception instead (V-10)`
			]);
		});
	}

	it("matches the engine's own rule, as V-9's NOSONAR cases measured it", () => {
		const c = (value: string): SourceComment => ({ kind: 'line', value, line: 1 });
		expect(isNoSonar(c(' NOSONAR'))).toBe(true);
		expect(isNoSonar(c(' nosonar'))).toBe(true);
		expect(isNoSonar(c(' a comment that mentions NOSONAR later'))).toBe(false);
		expect(isNoSonar({ kind: 'block', value: '* NOSONAR ', line: 1 })).toBe(true);
	});
});

// ── The declared pins (route (b)) ────────────────────────────────────────────────────────────────────────────────

describe('the pins, each fault alone', () => {
	it('a pinned entry outside the declared folders', () => {
		const f = fixture();
		entry(f, 1).pinned = { path: 'scripts/a.ts', findings: 1 };
		expect(problems(f)).toEqual(['EXC-002: scripts/a.ts is under no folder the register declares pinned']);
	});

	it('a pinned file outside the Sonar scope', () => {
		const f = fixture();
		entry(f, 1).pinned = { path: 'verif/fixtures/phase7/reference/src/gone.js', findings: 1 };
		expect(problems(f)).toEqual(['EXC-002: its pinned file verif/fixtures/phase7/reference/src/gone.js is not in the Sonar scope']);
	});

	it('a declared pin whose words the test no longer holds', () => {
		const f = fixture();
		f.pins[PIN_TEST] = '// the words are gone\n';
		expect(problems(f)).toEqual([`verif/fixtures/phase7/reference/: ${PIN_TEST} no longer holds the words "${PIN}"`]);
	});

	it('a declared pin whose test cannot be read', () => {
		const f = fixture();
		delete f.pins[PIN_TEST];
		expect(problems(f)).toEqual([`verif/fixtures/phase7/reference/: ${PIN_TEST}, the test said to pin it, cannot be read`]);
	});

	it('a declared folder that is not a folder', () => {
		const f = fixture();
		(f.register.pinnedFolders as Json[])[0]!.folder = 'verif/fixtures/phase7/reference';
		expect(problems(f)).toEqual(['each pinned folder must hold "folder" (ending in /), "pinnedBy" and "pin"']);
	});
});

// ── The comment reader ───────────────────────────────────────────────────────────────────────────────────────────

describe('the comment reader', () => {
	const read3 = (path: string, text: string): Array<[string, string, number]> =>
		commentsOf(path, text).map((c) => [c.kind, c.value.trim(), c.line]);

	it('reads a comment before a closing parenthesis, in an empty block, after a comma, and at the end of a file', () => {
		const text = [
			'f(a,',
			'\t/* before the parenthesis */',
			');',
			'function g() { /* in an empty block */ }',
			'const o = { a: 1, // after a comma',
			'\tb: 2 };',
			'x;',
			'// at the end'
		].join('\n');
		expect(read3('scripts/x.ts', text)).toEqual([
			['block', 'before the parenthesis', 2],
			['block', 'in an empty block', 4],
			['line', 'after a comma', 5],
			['line', 'at the end', 8]
		]);
	});

	it('reads no comment inside a string, a template or a regular expression, and one after a division', () => {
		const text = [
			"const s = '// in a string';",
			'const t = `// in a template ${s} /* still the template */`;',
			'const r = /[//]x/;',
			'const d = 4 / 2; // after a division'
		].join('\n');
		expect(read3('scripts/x.ts', text)).toEqual([['line', 'after a division', 4]]);
	});

	it('skips a shebang and reads the comment after it', () => {
		expect(read3('scripts/x.js', '#!/usr/bin/env node\n// after the shebang\n')).toEqual([['line', 'after the shebang', 2]]);
	});

	it('reads JSX text as text, and a comment inside braces as a comment', () => {
		expect(read3('scripts/x.tsx', 'export const el = <div>// not a comment {/* a comment */}</div>;\n')).toEqual([['block', 'a comment', 1]]);
	});

	it('reads a JSDoc block as a block comment whose value starts with *', () => {
		expect(read3('scripts/x.ts', '/** NOSONAR */\nexport const x = 1;\n')).toEqual([['block', '* NOSONAR', 1]]);
	});

	it('reads the comments after a documentation block at the end of a file, which TypeScript hangs on the end-of-file token', () => {
		// The first build of the reader walked the end-of-file token's JSDoc child instead of the token, and missed all three.
		const text = 'export const x = 1;\n/** a trailing doc */\n// after it\n//NOSONAR\n';
		expect(read3('scripts/x.ts', text)).toEqual([
			['block', '* a trailing doc', 2],
			['line', 'after it', 3],
			['line', 'NOSONAR', 4]
		]);
	});
});

// ── The page ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('the page', () => {
	const register = JSON.parse(read(REGISTER_FILE)) as Register;

	it('a hand-edited copy fails, naming the command', () => {
		expect(pageDrift(`${read(PAGE_FILE)}\nedited by hand\n`, register)).toEqual([
			'docs/operations/sonar-exceptions.md is not what docs/operations/sonar-exceptions.json generates: run `bun run sonar:exceptions` and commit the result'
		]);
		expect(pageDrift(undefined, register)).toHaveLength(1);
		expect(pageDrift(read(PAGE_FILE), register)).toEqual([]);
	});

	it('the page written into a mkdtempSync folder equals the committed bytes', () => {
		const dir = tempDir('page');
		for (const rel of [REGISTER_FILE, RULE_SET_FILE, RULINGS_FILE]) put(dir, rel, read(rel));
		const out: string[] = [];
		const err: string[] = [];
		expect(main([`--root=${dir}`], (s) => out.push(s), (s) => err.push(s))).toBe(0);
		expect(err).toEqual([]);
		expect(out).toEqual(['sonar:exceptions — wrote docs/operations/sonar-exceptions.md.\n']);
		expect(readFileSync(join(dir, PAGE_FILE)).equals(readFileSync(join(ROOT, PAGE_FILE)))).toBe(true);
		out.length = 0;
		expect(main([`--root=${dir}`], (s) => out.push(s), (s) => err.push(s))).toBe(0);
		expect(out).toEqual(['sonar:exceptions — docs/operations/sonar-exceptions.md is current.\n']);
	});

	it('nothing is written from a register whose form fails', () => {
		const dir = tempDir('invalid');
		const broken = baseRegister();
		delete (broken.exceptions as Json[])[0]!.owner;
		put(dir, REGISTER_FILE, JSON.stringify(broken));
		put(dir, RULE_SET_FILE, JSON.stringify({ rules: [...RULE_KEYS] }));
		put(dir, RULINGS_FILE, RULINGS);
		const err: string[] = [];
		expect(main([`--root=${dir}`], () => undefined, (s) => err.push(s))).toBe(1);
		expect(err).toEqual(['EXC-001: "owner" is missing or empty (JAN-ENGC-001 §7.4)\n']);
		expect(existsSync(join(dir, PAGE_FILE))).toBe(false);
	});

	it('an input that cannot be read exits 2', () => {
		const err: string[] = [];
		expect(main([`--root=${tempDir('empty')}`], () => undefined, (s) => err.push(s))).toBe(2);
		expect(err[0]).toMatch(/^sonar:exceptions — an input could not be read: /);
	});

	it('renders each entry with its fields, its entries in id order, and a | in a cell as its entity', () => {
		const f = fixture();
		(f.register.exceptions as Json[]).reverse();
		const page = renderPage(f.register as unknown as Register);
		const order = ['### EXC-001', '### EXC-002', '### EXC-003'].map((h) => page.indexOf(h));
		expect(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1]!))).toBe(true);
		expect(page).toContain('### EXC-001 · typescript:S3776 (`sonarjs/cognitive-complexity`)');
		expect(page).toContain('- **Where:** `scripts/a.ts` (1 marker(s))');
		expect(page).toContain(`- **Where:** \`${PINNED_FILE}\`, 1 finding(s), with no marker: a test pins the file's bytes (route (b)).`);
		expect(page).toContain('- **Approved by:** REG-D-992, a ruling of a delegation the register records.');
		expect(page).toContain('- **Term:** Temporary: removal condition: when the parser of record accepts the chain; expiry 2027-06-30.');
		expect(page).toContain('- **Term:** Temporary: review by 2027-01-01.');
		expect(page).toContain('- **Term:** Not temporary.');
		(f.register.pinnedFolders as Json[])[0]!.pin = 'a | b';
		expect(renderPage(f.register as unknown as Register)).toContain('"a &#124; b"');
	});
});

// ── The dates: listed by --check, judged by S4's sweep, never by the gate ────────────────────────────────────────

describe('the dates', () => {
	it('lists each review date and expiry that has passed, and none before', () => {
		const register = baseRegister() as unknown as Register;
		expect(passedDates(register, '2026-11-18')).toEqual([]);
		expect(passedDates(register, '2027-07-01')).toEqual(['EXC-002: its review date, 2027-01-01, has passed', 'EXC-003: its expiry, 2027-06-30, has passed']);
	});

	it('reads a calendar date, and nothing else, as a date', () => {
		expect(['2028-02-29', '2026-11-18'].map(isDate)).toEqual([true, true]);
		expect(['2026-02-29', '2026-13-01', '2026-1-01', '20261118'].map(isDate)).toEqual([false, false, false, false]);
	});
});

// ── V-9's lint channel, live ─────────────────────────────────────────────────────────────────────────────────────

describe("V-9's lint channel, live on JPWB's own ESLint configuration (texts never written)", () => {
	const eslint = new ESLint({ cwd: ROOT });
	const FILE = join(ROOT, 'scripts', 'sonar', 'v9-lint-seed.ts');
	const seed = (marker: string): string => `export function seed(a: number): number {\n${marker}\tconst spare = a * 2;\n\treturn a;\n}\n`;
	const lint = async (marker: string): Promise<Array<[string | null, string]>> => {
		const [r] = await eslint.lintText(seed(marker), { filePath: FILE });
		return (r?.messages ?? []).map((m) => [m.ruleId, m.message]);
	};
	const UNUSED: [string, string] = [
		'@typescript-eslint/no-unused-vars',
		"'spare' is assigned a value but never used. Allowed unused vars must match /^_/u."
	];
	const marker = (rule: string): string => `\t// eslint-disable-next-line ${rule} -- EXC-001 V-9, the lint channel\n`;

	it('CONTROL — unmarked, lint reports the unused local', async () => {
		expect(await lint('')).toEqual([UNUSED]);
	});

	it('the marker silences it, and no directive is reported unused', async () => {
		expect(await lint(marker('@typescript-eslint/no-unused-vars'))).toEqual([]);
	});

	it('a marker naming another loaded rule leaves it reported, and the directive is reported unused', async () => {
		expect(await lint(marker('@typescript-eslint/no-explicit-any'))).toEqual([
			[null, "Unused eslint-disable directive (no problems were reported from '@typescript-eslint/no-explicit-any')."],
			UNUSED
		]);
	});

	it('a marker naming sonarjs/cognitive-complexity fails: lint does not load the plugin until S2', async () => {
		expect(await lint(marker('sonarjs/cognitive-complexity'))).toEqual([
			['sonarjs/cognitive-complexity', "Definition for rule 'sonarjs/cognitive-complexity' was not found."],
			UNUSED
		]);
	});
});

// ── V-9's record and the 15 shared names ─────────────────────────────────────────────────────────────────────────

/** The engine runs of V-9's record that ran under an engine or Node other than the matrix pins. */
function engineDrift(runs: readonly ProofRun[], pins: ReturnType<Core['pinsFromMatrix']>): string[] {
	const want: Readonly<Record<string, string>> = {
		extension: pins.extension,
		languageServer: pins.languageServer,
		sonarjs: pins.sonarjs,
		jre: pins.jre
	};
	const out: string[] = [];
	for (const r of runs.filter((x) => x.channel === 'engine')) {
		for (const [k, v] of Object.entries(want)) {
			if (r.engine?.[k] !== v) out.push(`${r.id}: ${k} ${r.engine?.[k] ?? '(none)'}, the matrix pins ${v}`);
		}
		if (r.node !== pins.node) out.push(`${r.id}: Node ${r.node ?? '(none)'}, the matrix pins ${pins.node}`);
	}
	return out;
}

describe("V-9's record and the shared names", () => {
	const register = JSON.parse(read(REGISTER_FILE)) as Register;
	const names = register.sharedNames.names;
	const pins = core.pinsFromMatrix(JSON.parse(read('scripts/toolchain/matrix.json')) as unknown);

	it('lists the 15 names F-5 counted: 12 shared with ESLint core, 2 with typescript-eslint, 1 with both', () => {
		expect(names).toHaveLength(15);
		expect(new Set(names.map((n) => n.pluginRule)).size).toBe(15);
		const by: Record<string, number> = {};
		for (const n of names) by[n.sharedWith] = (by[n.sharedWith] ?? 0) + 1;
		expect(by).toEqual({ 'eslint-core': 12, 'typescript-eslint': 2, both: 1 });
	});

	it('names each colliding rule as its package names it', () => {
		for (const n of names) {
			const byWhere: Record<string, string[]> = {
				'eslint-core': [n.pluginRule],
				'typescript-eslint': [`@typescript-eslint/${n.pluginRule}`],
				both: [n.pluginRule, `@typescript-eslint/${n.pluginRule}`]
			};
			expect(n.collidingRules, n.pluginRule).toEqual(byWhere[n.sharedWith]);
		}
	});

	it('marks S1481 measured, and no other', () => {
		expect(names.filter((n) => n.measured).map((n) => [n.pluginRule, n.sonarKey])).toEqual([['no-unused-vars', 'S1481']]);
	});

	it('each case cites runs the record holds', () => {
		const ids = new Set(register.markerProof.runs.map((r) => r.id));
		const missing = register.markerProof.cases.flatMap((c) => c.runs.filter((r) => !ids.has(r)).map((r) => `${c.id}: ${r}`));
		expect(missing).toEqual([]);
	});

	it('every engine run of the record ran under the engine the matrix pins: an engine change re-runs V-9', () => {
		expect(engineDrift(register.markerProof.runs, pins), 'the marker form is the engine\'s behaviour; prove it again under the new engine').toEqual([]);
	});

	it('CONTROL — a run under another SonarJS is reported', () => {
		const run = register.markerProof.runs.find((r) => r.channel === 'engine');
		expect(run).toBeDefined();
		const doctored = { ...run!, engine: { ...run!.engine, sonarjs: '14.5.0.1' } };
		expect(engineDrift([doctored], pins)).toEqual([`${doctored.id}: sonarjs 14.5.0.1, the matrix pins ${pins.sonarjs}`]);
	});
});
