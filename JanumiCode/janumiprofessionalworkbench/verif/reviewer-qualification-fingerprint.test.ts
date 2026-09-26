// ⭐ `JAN-CRITREAD` J2-3 — THE REVIEWER FINGERPRINT (DESIGN-what-the-tests-prove.md §5.5; ROADMAP J2-3 + J2-4).
//
// One exported function, shared by the check and the runner, says WHICH reviewer a qualification record measured:
// the probe set's materialized prompts, the budget constants, the seed criteria whole, and a scoring digest over a
// fixed raw-reply corpus. It must MOVE on every component that decides a verdict — one row per component below, each
// driven by swapping that one seam and nothing else — and must NOT move on an edit that decides nothing: a comment.
//
//   · THE ROWS each show the component moves the fingerprint, and name what does NOT move with it — so a move confined
//     to the probe set or the scoring can be told from one that reached a case prompt (§5.6 limb 1).
//   · THE COMMENT-ONLY GUARD is measured on a DISPOSABLE COPY of the tree, never on this one: a comment is added to the
//     copied validator and the fingerprint recomputed there, with a behaviour edit to the same copy as its control.
//     The packages are reached through real directories of re-exports, never a link, so removing the copy cannot
//     reach the repository.
//   · THE PROBE SET is pinned to reach every branch of assembly, and the oversize-together probes the two content
//     caps a probe can reach — which is why the third, `CONTENT_MAX`, is hashed as a constant.
//   · THE RUNNER AGREES: the case prompts the fingerprint derives are the hashes a run records.
//   · ⭐ AND THE ATTACKS THE ADVERSARIAL REVIEW FOUND INVISIBLE EACH MOVE IT: the plan's independence (E4) and the
//     seeded policy's (E14), a model-supplied `stipulated` honoured (E5), a malformation class no longer detected (E6).
//   · THE BUDGET OBJECT IS THE ONLY PLACE A LIMIT IS WRITTEN — held structurally, over the validator's syntax tree,
//     and behaviourally for every limit a probe can reach.
//   · ⭐ `JAN-SELREV` SR-2 (D6) — THE FINGERPRINT MEASURES THE VALIDATOR WITHOUT `requireReportedModel`. What it hashes
//     is the runner's SCORING seam: the corpus replies that report another model are scored there, never refused, and on
//     a copy the option set in the runner moves the scoring digest — which is why only the product's devin branch sets
//     it. ⚠ The PROBE seam's gate CANNOT move the fingerprint: every probe reply is a bare string that reports no model,
//     so the option set there refuses nothing the fingerprint hashes. That seam's only guard is the test that hands it
//     the corpus replies directly: 'a corpus reply reporting ANOTHER model is scored, never refused', below.
// ⛔ NO MODEL IS REACHABLE: in process PATH names an empty directory, and every child is hermetic
// (`reviewer-qualification-hermetic.ts`).
import { spawnSync } from 'node:child_process';
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { REASONING_REVIEW_BUDGET } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import {
	CASE_SET_V1_FILE,
	CURRENT_CASE_SET_FILE,
	type CaseSet,
	type QualificationCase
} from '../scripts/reviewer-qual/cases.js';
import {
	PRODUCT_SEAMS,
	reviewerFingerprint,
	type ReviewerFingerprint
} from '../scripts/reviewer-qual/fingerprint.js';
import { detectMalformations } from '../scripts/reviewer-qual/malformations.js';
import type { ToolInvocationResult } from '../apps/rph-demo/src/lib/server/tools/backing-tool.js';
import { FINGERPRINT_PROBES, PROBE_SUBJECT } from '../scripts/reviewer-qual/probes.js';
import type { CallLine, CandidateIdentity } from '../scripts/reviewer-qual/record.js';
import { evaluateCase, runQualification } from '../scripts/reviewer-qual/runner.js';
import { CORPUS_CASE, scoringCorpus } from '../scripts/reviewer-qual/scoring-corpus.js';
import { BUN, hermeticEnv, NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.replace(/\\/g, '/')
	.replace(/\/$/, '');
/** ⚠ `JAN-CRITREAD` J2-5 — case set version one, a fixed fixture: no reviewer component depends on the cases. */
const CASES = (JSON.parse(readFileSync(`${REPO}/${CASE_SET_V1_FILE}`, 'utf8')) as CaseSet).cases;
const REPAIR_INSTRUCTION = 'IMPORTANT: reply with ONLY the minified JSON object.';
const TRUNCATED = ' …(truncated)';
const count = (text: string, needle: string): number => text.split(needle).length - 1;

let BASE: ReviewerFingerprint;
beforeAll(async () => {
	// ⛔ No program can be found from this process: the validator's default print is `agyPrint`.
	vi.stubEnv('PATH', NO_PROGRAMS);
	BASE = await reviewerFingerprint(CASES);
}, 60_000);
afterAll(() => {
	vi.unstubAllEnvs();
});

/** Everything but the named components is where it was. */
function onlyMoved(fp: ReviewerFingerprint, moved: readonly (keyof ReviewerFingerprint['components'])[]): void {
	expect(fp.reviewer, 'the reviewer fingerprint moves').not.toBe(BASE.reviewer);
	for (const k of ['probes', 'budget', 'criteria', 'scoring'] as const)
		if (moved.includes(k)) expect(fp.components[k], `${k} moves`).not.toBe(BASE.components[k]);
		else expect(fp.components[k], `${k} does not move`).toBe(BASE.components[k]);
	expect(fp.scoring, 'the RUN line’s scoring digest is the scoring component').toBe(fp.components.scoring);
}

describe('JAN-CRITREAD J2-3 — the reviewer fingerprint MOVES on each component', () => {
	it('⭐ a PROMPT BRANCH — the process-result framing, which no case exercises: the probes move, no case prompt does', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			validator: (print) =>
				PRODUCT_SEAMS.validator((p) =>
					print(p.replace('The COMMAND RESULT to review', 'The COMMAND OUTPUT to review'))
				)
		});
		onlyMoved(fp, ['probes']);
		expect(fp.casePrompts, 'no case is a process result').toEqual(BASE.casePrompts);
	});

	it('⭐ an OVERSIZE PROBE — a change only an input over its budget reaches (how a cut is declared): the probes move', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			validator: (print) => PRODUCT_SEAMS.validator((p) => print(p.replaceAll(TRUNCATED, ' …(cut)')))
		});
		onlyMoved(fp, ['probes']);
		expect(fp.casePrompts, 'every case is seen whole, so no case prompt carries a cut').toEqual(BASE.casePrompts);
	});

	it('⭐ a BUDGET CONSTANT — hashed as itself, so CONTENT_MAX moves the fingerprint though no probe can reach it', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			budget: { ...REASONING_REVIEW_BUDGET, CONTENT_MAX: REASONING_REVIEW_BUDGET.CONTENT_MAX + 1 }
		});
		onlyMoved(fp, ['budget']);
	});

	it('⭐ a CRITERION FIELD — every field of a seed criterion, whole, the ones no prompt or score reads included', async () => {
		const target = 4;
		for (const field of Object.keys(SEEDED_REASONING_REVIEW_CRITERIA[target]!)) {
			const criteria = SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => {
				if (i !== target) return c;
				const v = (c as unknown as Record<string, unknown>)[field];
				const altered =
					typeof v === 'boolean' ? !v : Array.isArray(v) ? [...v, 'EV-ALTERED'] : `${String(v)}-ALTERED`;
				return { ...c, [field]: altered };
			});
			const fp = await reviewerFingerprint(CASES, { ...PRODUCT_SEAMS, criteria });
			expect(fp.reviewer, `${field}: the reviewer fingerprint moves`).not.toBe(BASE.reviewer);
			expect(fp.components.criteria, `${field}: the criteria component moves`).not.toBe(BASE.components.criteria);
		}
	});

	it('⭐ a SCORING RULE — a fault now scored PARTIALLY_MET: the scoring digest moves, no prompt does', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			evaluate: async (a) => {
				const e = await evaluateCase(a);
				return {
					...e,
					scored: {
						...e.scored,
						criteria: e.scored.criteria.map(([k, o]) => [k, o === 'NOT_MET' ? 'PARTIALLY_MET' : o] as const)
					}
				};
			}
		});
		onlyMoved(fp, ['scoring']);
		expect(fp.casePrompts).toEqual(BASE.casePrompts);
	});

	it('⭐ the REPAIR PROMPT — the instruction a failed first parse draws: the scoring digest moves', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			evaluate: (a) =>
				evaluateCase({
					...a,
					call: (p) => a.call(p.replace(REPAIR_INSTRUCTION, `${REPAIR_INSTRUCTION} Nothing else.`))
				})
		});
		onlyMoved(fp, ['scoring']);
	});

	it('⭐ an INDEPENDENCE RULE — the plan’s DIFFERENT_MODEL read as DIFFERENT_PROVIDER (the review’s E4): the scoring digest moves', async () => {
		// The rule lives in the package the runner scores through (`floor.ts` `deMinimisFloorPlan`), not behind a seam:
		// so the package itself is replaced for a FRESH load of the fingerprint, and the fresh load is first shown to
		// measure exactly what the tree measures — the CONTROL — so the move is the rule's and not the reload's.
		const fresh = async () => {
			vi.resetModules();
			return (await import('../scripts/reviewer-qual/fingerprint.js')).reviewerFingerprint(CASES);
		};
		try {
			expect((await fresh()).reviewer, 'CONTROL: a fresh load measures the tree').toBe(BASE.reviewer);
			vi.doMock('@janumipwb/rph-assurance', async (importOriginal) => {
				const real = await importOriginal<typeof import('@janumipwb/rph-assurance')>();
				return {
					...real,
					deMinimisFloorPlan: (subject: Parameters<typeof real.deMinimisFloorPlan>[0]) =>
						real
							.deMinimisFloorPlan(subject)
							.map((p) => (p.independence === 'DIFFERENT_MODEL' ? { ...p, independence: 'DIFFERENT_PROVIDER' as const } : p))
				};
			});
			const fp = await fresh();
			onlyMoved(fp, ['scoring']);
			expect(fp.casePrompts, 'independence reaches no prompt').toEqual(BASE.casePrompts);
		} finally {
			vi.doUnmock('@janumipwb/rph-assurance');
			vi.resetModules();
		}
	}, 120_000);

	it('⭐ the SEEDED POLICY’S INDEPENDENCE — what the recording gate reads (the review’s E14): the criteria component moves', async () => {
		const fp = await reviewerFingerprint(CASES, { ...PRODUCT_SEAMS, independence: 'DIFFERENT_PROVIDER' });
		onlyMoved(fp, ['criteria']);
		expect(PRODUCT_SEAMS.independence, 'the product’s own is the seeded Reasoning Review policy’s').toBe('DIFFERENT_MODEL');
	});

	it('⭐ a MALFORMATION RULE — a class the harness no longer detects (the review’s E6): the scoring digest moves', async () => {
		const fp = await reviewerFingerprint(CASES, {
			...PRODUCT_SEAMS,
			evaluate: async (a) => {
				const e = await evaluateCase(a);
				return { ...e, calls: e.calls.map((c) => ({ ...c, malformations: c.malformations.filter((k) => k !== 'DUPLICATE_KEY') })) };
			}
		});
		onlyMoved(fp, ['scoring']);
		expect(fp.casePrompts).toEqual(BASE.casePrompts);
	});
});

describe('JAN-CRITREAD J2-3 — the reviewer fingerprint does NOT move on what decides no verdict', () => {
	const dirs: string[] = [];
	afterAll(() => {
		for (const d of dirs) rmSync(d, { recursive: true, force: true });
	});

	it('⭐ it is a function of the tree: computed twice, identical in every part', async () => {
		const again = await reviewerFingerprint(CASES);
		expect(again).toEqual(BASE);
		expect(BASE.reviewer).toMatch(/^[0-9a-f]{64}$/);
		expect(BASE.casePrompts.size, 'one entry per case').toBe(CASES.length);
	});

	/** A disposable copy of what the fingerprint loads, with the packages reached through real re-export directories. */
	function disposableTree(): string {
		const root = mkdtempSync(join(tmpdir(), 'jpwb-fpcopy-')).replace(/\\/g, '/');
		dirs.push(root);
		cpSync(`${REPO}/scripts/reviewer-qual`, `${root}/scripts/reviewer-qual`, { recursive: true });
		cpSync(`${REPO}/apps/rph-demo/src/lib/server`, `${root}/apps/rph-demo/src/lib/server`, { recursive: true });
		// The case set the copied `fingerprint.ts` reads when run as a program — the CURRENT one (`cases.ts`, J2-5).
		mkdirSync(dirname(`${root}/${CURRENT_CASE_SET_FILE}`), { recursive: true });
		copyFileSync(`${REPO}/${CURRENT_CASE_SET_FILE}`, `${root}/${CURRENT_CASE_SET_FILE}`);
		writeFileSync(`${root}/package.json`, JSON.stringify({ name: 'jpwb-fingerprint-copy', type: 'module' }));
		for (const pkg of readdirSync(`${REPO}/packages`)) {
			const manifest = `${REPO}/packages/${pkg}/package.json`;
			if (!existsSync(manifest)) continue;
			const { name, exports } = JSON.parse(readFileSync(manifest, 'utf8')) as {
				name?: string;
				exports?: Record<string, { source?: string }>;
			};
			if (!name?.startsWith('@janumipwb/') || !exports) continue;
			const dir = `${root}/node_modules/${name}`;
			mkdirSync(dir, { recursive: true });
			const shim: Record<string, string> = {};
			for (const [sub, target] of Object.entries(exports)) {
				if (!target.source) continue;
				const file = sub === '.' ? 'index.ts' : `${sub.slice(2)}.ts`;
				const real = pathToFileURL(`${REPO}/packages/${pkg}/${target.source.slice(2)}`).href;
				writeFileSync(`${dir}/${file}`, `export * from ${JSON.stringify(real)};\n`);
				shim[sub] = `./${file}`;
			}
			writeFileSync(`${dir}/package.json`, JSON.stringify({ name, type: 'module', exports: shim }));
		}
		return root;
	}
	const fingerprintIn = (root: string): { reviewer: string; components: Record<string, string> } => {
		const r = spawnSync(BUN, ['--conditions=source', `${root}/scripts/reviewer-qual/fingerprint.ts`], {
			cwd: root,
			encoding: 'utf8',
			env: hermeticEnv(),
			windowsHide: true
		});
		expect(r.status, `${root}: ${r.stderr}`).toBe(0);
		return JSON.parse(r.stdout) as { reviewer: string; components: Record<string, string> };
	};
	const VALIDATOR = 'apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts';

	it('⛔ a COMMENT-ONLY edit moves nothing — on a disposable copy, with a behaviour edit to the same copy as its control', () => {
		const here = fingerprintIn(REPO);
		expect(here.reviewer, 'the CLI computes what the function computes').toBe(BASE.reviewer);
		const copy = disposableTree();
		expect(fingerprintIn(copy), 'the copy, unedited, measures what the tree measures').toEqual(here);

		const file = `${copy}/${VALIDATOR}`;
		const original = readFileSync(file, 'utf8');
		const commented = original
			.replace('export const REASONING_REVIEW_BUDGET', '// A comment that decides no verdict.\nexport const REASONING_REVIEW_BUDGET')
			.replace('function judgePrompt(', '/** Nor does this one. */\nfunction judgePrompt(');
		expect(commented.split('\n').length, 'the arrangement added both comments').toBe(original.split('\n').length + 2);
		writeFileSync(file, commented);
		expect(fingerprintIn(copy), 'a comment-only edit').toEqual(here);

		// ⭐ THE CONTROL: the same copy, one budget constant changed — so the copy is what was measured.
		const changed = commented.replace('\tRUBRIC_MAX: 6_000,\n', '\tRUBRIC_MAX: 5_999,\n');
		expect(changed, 'the control edited the copy').not.toBe(commented);
		writeFileSync(file, changed);
		const behaviour = fingerprintIn(copy);
		expect(behaviour.reviewer, 'a behaviour edit moves it').not.toBe(here.reviewer);
		expect(behaviour.components.budget, 'through the budget component').not.toBe(here.components.budget);
	}, 120_000);

	it('⭐ the review’s attacks move it, on a copy — E5, the model’s own `stipulated` honoured; E6, a duplicate key no longer detected', () => {
		const copy = disposableTree();
		/** One edit to one copied file, measured, then undone — each a single literal replacement, shown to apply. */
		const attacked = (rel: string, find: string, replace: string) => {
			const file = `${copy}/${rel}`;
			const original = readFileSync(file, 'utf8');
			expect(original.split(find).length - 1, `${rel}: the attack anchors once`).toBe(1);
			writeFileSync(file, original.replace(find, () => replace));
			try {
				return fingerprintIn(copy);
			} finally {
				writeFileSync(file, original);
			}
		};
		const e5 = attacked(
			VALIDATOR,
			'\t\t\t\t\tfailed: Boolean(f.failed),\n',
			'\t\t\t\t\tfailed: Boolean(f.failed),\n\t\t\t\t\t...(f.stipulated === true ? { stipulated: true as const } : {}),\n'
		);
		const e6 = attacked('scripts/reviewer-qual/malformations.ts', 'if (keys.has(key)) duplicate = true;', 'if (keys.has(key)) duplicate = false;');
		for (const [label, fp] of [
			['E5', e5],
			['E6', e6]
		] as const) {
			expect(fp.components.scoring, `${label}: the scoring digest moves`).not.toBe(BASE.components.scoring);
			// THE CONTROL: the copy measured the tree in everything else, so the move is the attack's.
			for (const k of ['probes', 'budget', 'criteria'] as const) expect(fp.components[k], `${label}: ${k}`).toBe(BASE.components[k]);
		}
	}, 120_000);

	it('⭐ SR-2 (D6) — why the reported-model check is GATED: set in the runner’s validator, on a copy, it moves the scoring digest', () => {
		// ⛔ The scoring corpus holds replies that report OTHER models (`scoring-corpus.ts`), and their outcomes are hashed.
		// A check the fingerprint's validators made would refuse those replies, so an UNGATED check would move the
		// fingerprint of a reviewer whose prompt and scoring did not change. Only the product's devin branch sets it.
		const copy = disposableTree();
		const file = `${copy}/scripts/reviewer-qual/runner.ts`;
		const original = readFileSync(file, 'utf8');
		const find = '\t\tclock: EXCHANGE_CLOCK,\n';
		expect(original.split(find).length - 1, 'the edit anchors once').toBe(1);
		writeFileSync(file, original.replace(find, () => `${find}\t\trequireReportedModel: true,\n`));
		const gated = fingerprintIn(copy);
		expect(gated.components.scoring, 'the scoring digest moves').not.toBe(BASE.components.scoring);
		for (const k of ['probes', 'budget', 'criteria'] as const) expect(gated.components[k], k).toBe(BASE.components[k]);
	}, 120_000);
});

describe('JAN-CRITREAD J2-3 — the probe set reaches every branch of prompt assembly', () => {
	const prompt = (id: string): string => {
		const p = BASE.probePrompts.get(id);
		expect(p, `probe ${id} was materialized`).toBeDefined();
		return p!;
	};
	const any = (needle: string) => FINGERPRINT_PROBES.some((p) => prompt(p.id).includes(needle));

	it('⭐ every framing, every observation kind and its absent report, the rationale both ways, narration, prior gaps, the subject hash', () => {
		expect(BASE.probePrompts.size).toBe(FINGERPRINT_PROBES.length);
		for (const needle of [
			'a canonical graph export',
			'The WORK PRODUCT to review',
			'The COMMAND RESULT to review',
			'The host reported nothing about tool calls',
			'The host was NOT IN A POSITION TO OBSERVE tool calls: ',
			'The host was NOT IN A POSITION TO OBSERVE tool calls.',
			'The host WATCHED and observed NO tool calls',
			'The host OBSERVED these tool calls',
			'[NOT MINTED BY THE HOST]',
			'(a tool this host did not mint)',
			'calls were observed; only the first',
			'(NOT DECLARED',
			'(none declared)',
			'(none recorded)',
			'A PREVIOUS review flagged',
			'candidateSubjectHash',
			'"criterionId":"CRITERION-ID"'
		])
			expect(any(needle), needle).toBe(true);
		expect(prompt('G-DECLARED').includes('(NOT DECLARED'), 'a declared account renders as itself').toBe(false);
	});

	/** How much of the content the prompt carries, when the content was cut. */
	const contentBudget = (id: string, subjectLine: string): number => {
		const p = prompt(id);
		const start = p.indexOf(`${subjectLine}\n`) + subjectLine.length + 1;
		return p.indexOf(TRUNCATED, start) - start;
	};

	it('⭐ each framing has an OVERSIZE-TOGETHER probe that cuts every slice at once, reaching the content caps a probe can reach', () => {
		const B = REASONING_REVIEW_BUDGET;
		expect(count(prompt('G-OVERSIZE-ALL'), TRUNCATED), 'graph: intent, rubric, prior, rationale, narration, content').toBe(6);
		expect(count(prompt('W-OVERSIZE-ALL'), TRUNCATED), 'work product: instruction, rubric, prior, rationale, content').toBe(5);
		expect(count(prompt('P-OVERSIZE-ALL'), TRUNCATED), 'process result: all six').toBe(6);
		for (const id of ['G-OVERSIZE-CONTENT', 'W-OVERSIZE-CONTENT', 'P-OVERSIZE-CONTENT'])
			expect(count(prompt(id), TRUNCATED), `${id}: the content alone is cut`).toBe(1);
		const graph = 'The artifact (a canonical graph export / serialized subject) to review:';
		const work = 'The WORK PRODUCT to review — the output a professional work unit produced by running the instruction above:';
		const command =
			'The COMMAND RESULT to review — what the host observed the command produce (its exit status and output). ' +
			'It was produced by a child process, NOT by the agent, so it carries no reasoning of its own:';
		// The budget left after the scaffolding binds for the graph and work product; the call list pushes the
		// process result below it, to CONTENT_MIN. No probe reaches CONTENT_MAX — which is why it is hashed as a constant.
		for (const [id, line] of [
			['G-OVERSIZE-ALL', graph],
			['W-OVERSIZE-ALL', work],
			['G-OVERSIZE-CONTENT', graph],
			['W-OVERSIZE-CONTENT', work],
			['P-OVERSIZE-CONTENT', command]
		] as const) {
			const b = contentBudget(id, line);
			expect(b, `${id}: above CONTENT_MIN`).toBeGreaterThan(B.CONTENT_MIN);
			expect(b, `${id}: below CONTENT_MAX`).toBeLessThan(B.CONTENT_MAX);
		}
		expect(contentBudget('P-OVERSIZE-ALL', command), 'P-OVERSIZE-ALL: CONTENT_MIN').toBe(B.CONTENT_MIN);
		const intent = /from this intent:\n"""([\s\S]*?)"""/.exec(prompt('G-OVERSIZE-ALL'))?.[1] ?? '';
		expect(intent.length, 'the instruction is cut at USER_INTENT_MAX').toBe(B.USER_INTENT_MAX + TRUNCATED.length);
	});

	it('⭐ the budget object is frozen, and it is the one the fingerprint hashes by default', () => {
		expect(Object.isFrozen(REASONING_REVIEW_BUDGET)).toBe(true);
		expect(PRODUCT_SEAMS.budget).toBe(REASONING_REVIEW_BUDGET);
		expect(Object.keys(REASONING_REVIEW_BUDGET).sort()).toEqual(
			[
				'PROMPT_BUDGET',
				'USER_INTENT_MAX',
				'RUBRIC_MAX',
				'PRIOR_MAX',
				'RATIONALE_MAX',
				'NARRATION_MAX',
				'CONTENT_MAX',
				'CONTENT_MIN'
			].sort()
		);
	});

	it('⛔ the budget object is the ONLY place a limit is written — the validator binds each once, by destructuring the object, and reads every one', () => {
		// Over the syntax tree, so a comment moves nothing and a restatement cannot hide in one. A second binding of a
		// limit — `const CONTENT_MAX = 24_000`, or a renamed or defaulted destructuring — is a limit the prompt could obey
		// while the object the fingerprint hashes says another; and `CONTENT_MAX` is the one no probe can reach.
		const source = readFileSync(`${REPO}/apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts`, 'utf8');
		const tree = ts.createSourceFile('reasoning-review-validator.ts', source, ts.ScriptTarget.Latest, true);
		const members = new Set(Object.keys(REASONING_REVIEW_BUDGET));
		const bindings = new Map<string, string[]>();
		const reads = new Map<string, number>();
		const bind = (name: string, how: string) => bindings.set(name, [...(bindings.get(name) ?? []), how]);
		let written: string[] = [];
		const visit = (n: ts.Node): void => {
			if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
				if (members.has(n.name.text)) bind(n.name.text, 'a const of its own');
				const init = n.initializer;
				if (n.name.text === 'REASONING_REVIEW_BUDGET' && init && ts.isCallExpression(init) && ts.isObjectLiteralExpression(init.arguments[0]!))
					written = init.arguments[0].properties.map((p) =>
						ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) ? p.name.text : `NOT WRITTEN THERE: ${p.getText()}`
					);
			}
			if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && members.has(n.name.text)) {
				const declaration = n.parent.parent;
				const fromTheObject =
					ts.isVariableDeclaration(declaration) &&
					declaration.initializer !== undefined &&
					ts.isIdentifier(declaration.initializer) &&
					declaration.initializer.text === 'REASONING_REVIEW_BUDGET' &&
					n.propertyName === undefined &&
					n.initializer === undefined &&
					n.dotDotDotToken === undefined;
				bind(n.name.text, fromTheObject ? 'destructured from REASONING_REVIEW_BUDGET' : 'bound some other way');
			}
			if (ts.isParameter(n) && ts.isIdentifier(n.name) && members.has(n.name.text)) bind(n.name.text, 'a parameter');
			if (ts.isIdentifier(n) && members.has(n.text)) {
				const p = n.parent;
				const declares = (ts.isVariableDeclaration(p) || ts.isBindingElement(p) || ts.isParameter(p)) && p.name === n;
				const names =
					((ts.isPropertyAssignment(p) || ts.isPropertyAccessExpression(p)) && p.name === n) ||
					(ts.isBindingElement(p) && p.propertyName === n);
				if (!declares && !names) reads.set(n.text, (reads.get(n.text) ?? 0) + 1);
			}
			ts.forEachChild(n, visit);
		};
		visit(tree);
		expect(written.sort(), 'every limit is WRITTEN in the frozen object, as a value').toEqual([...members].sort());
		for (const m of members) {
			expect(bindings.get(m), `${m}: bound exactly once, from the object`).toEqual(['destructured from REASONING_REVIEW_BUDGET']);
			expect(reads.get(m) ?? 0, `${m}: read by the prompt`).toBeGreaterThan(0);
		}
	});

	it('⭐ every limit a probe can reach cuts exactly where the budget object says — intent, rubric, prior gaps, rationale, narration, the whole prompt', () => {
		const B = REASONING_REVIEW_BUDGET;
		const cut = (limit: number) => limit + TRUNCATED.length;
		/** The text between the first `open` and the `close` after it. */
		const between = (text: string, open: string, close: string): string => {
			const start = text.indexOf(open);
			expect(start, `found: ${JSON.stringify(open)}`).toBeGreaterThanOrEqual(0);
			const from = start + open.length;
			const end = text.indexOf(close, from);
			expect(end, `closed by: ${JSON.stringify(close)}`).toBeGreaterThanOrEqual(0);
			return text.slice(from, end);
		};
		for (const id of ['G-OVERSIZE-ALL', 'W-OVERSIZE-ALL', 'P-OVERSIZE-ALL']) {
			const p = prompt(id);
			expect(between(p, '"""', '"""').length, `${id}: the intent, at USER_INTENT_MAX`).toBe(cut(B.USER_INTENT_MAX));
			expect(
				between(p, '(INFORMATIONAL|ADVISORY|MATERIAL|BLOCKING|CRITICAL):\n', '\nThen give an overall').length,
				`${id}: the rubric, at RUBRIC_MAX`
			).toBe(cut(B.RUBRIC_MAX));
			expect(between(p, 'A PREVIOUS review flagged: ', '. Judge whether').length, `${id}: the prior gaps, at PRIOR_MAX`).toBe(
				cut(B.PRIOR_MAX)
			);
			expect(between(p, 'is itself a finding:\n"""', '"""').length, `${id}: the rationale, at RATIONALE_MAX`).toBe(
				cut(B.RATIONALE_MAX)
			);
		}
		expect(
			between(prompt('G-OVERSIZE-ALL'), 'not its private chain-of-thought):\n"""', '"""').length,
			'the narration, at NARRATION_MAX'
		).toBe(cut(B.NARRATION_MAX));
		// The content takes what the scaffolding leaves of PROMPT_BUDGET, so the whole prompt is the budget and its cut.
		for (const id of ['G-OVERSIZE-ALL', 'W-OVERSIZE-ALL'])
			expect(prompt(id).length, `${id}: the whole prompt, at PROMPT_BUDGET`).toBe(cut(B.PROMPT_BUDGET));
	});
});

describe('JAN-CRITREAD J2-3 — the scoring corpus', () => {
	it('⭐ it carries every REG-F-428 class and one repair, and reaches the ladder’s outcomes', async () => {
		const corpus = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA);
		const ids = new Set(SEEDED_REASONING_REVIEW_CRITERIA.map((c) => c.id));
		const firstReply = (r: (typeof corpus)[number]) => {
			const x = r.replies[0]!;
			return typeof x === 'string' ? x : x.answer.arrived ? x.answer.text : '';
		};
		const classes = corpus.map((r) => detectMalformations(firstReply(r), ids));
		for (const k of ['DUPLICATE_KEY', 'UNDECLARED_CRITERION_ID', 'NON_BOOLEAN_FAILED', 'FENCED', 'PROSE_WRAPPED'])
			expect(classes.some((c) => c.includes(k as never)), k).toBe(true);
		expect(
			classes.filter((c) => c.includes('UNDECLARED_CRITERION_ID')).length,
			'an unknown id and a corrupted one'
		).toBeGreaterThanOrEqual(2);
		const dispositions = new Set<string>();
		let repaired = 0;
		for (const entry of corpus) {
			let n = 0;
			const e = await evaluateCase({
				case: CORPUS_CASE,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				candidate: FIXTURE,
				scoringDigest: '0'.repeat(64),
				call: async () => ({ returned: entry.replies[Math.min(n++, entry.replies.length - 1)]!, served: null })
			});
			dispositions.add(e.scored.disposition);
			if (e.calls.length === 2) repaired += 1;
		}
		expect(repaired, 'a reply that fails the first parse draws the repair prompt').toBeGreaterThanOrEqual(1);
		expect([...dispositions].sort()).toEqual(
			['BOUNDARY_REJECTED', 'INCONCLUSIVE', 'REJECTED', 'SATISFIED', 'VALIDATOR_FAILED'].sort()
		);
	});
});

describe('JAN-SELREV SR-2 (D6) — the fingerprint measures the validator WITHOUT `requireReportedModel`', () => {
	it('⛔ a corpus reply reporting ANOTHER model is scored, never refused — by both of the fingerprint’s validators', async () => {
		// ⚠ THE TWO SEAMS ARE NOT GUARDED ALIKE. The fingerprint hashes the SCORING seam's outcomes, so the option set there
		// moves the fingerprint too (the copy test above). The PROBE seam never receives a corpus reply in the fingerprint —
		// its replies are bare strings that report no model — so the option set there moves no fingerprint component: THIS
		// test, handing it the corpus replies directly, is that seam's only guard.
		// ⭑ THE PREMISE, HELD: the corpus reaches the check. Two of its replies report a model other than the candidate's.
		const reporting = scoringCorpus(SEEDED_REASONING_REVIEW_CRITERIA).filter(
			(e) => typeof e.replies[0] !== 'string'
		);
		expect(reporting.map((e) => e.id)).toEqual(['reported-as-producer', 'reported-by-the-producers-provider']);
		for (const entry of reporting) {
			const reply = entry.replies[0] as ToolInvocationResult;
			expect(reply.producer.modelId, `${entry.id}: another model`).not.toBe(FIXTURE.modelLabel);
			// The SCORING seam — the runner's validator, which every corpus outcome is scored through.
			const e = await PRODUCT_SEAMS.evaluate({
				case: CORPUS_CASE,
				criteria: SEEDED_REASONING_REVIEW_CRITERIA,
				candidate: FIXTURE,
				scoringDigest: '0'.repeat(64),
				call: async () => ({ returned: reply, served: null })
			});
			expect(e.calls, `${entry.id}: one call, and no repair`).toHaveLength(1);
			expect(
				e.scored.criteria.length,
				`${entry.id}: scored as a THROW — the runner's validator refused the reported model`
			).toBeGreaterThan(0);
			expect(e.evaluator.modelId).toBe(reply.producer.modelId);
			// The PROBE seam — the product's validator as the fingerprint builds it, handed a reply it never meets there.
			const result = await PRODUCT_SEAMS.validator(async () => reply).evaluate(PROBE_SUBJECT, {
				reasoningReview: FINGERPRINT_PROBES[0]!.input(SEEDED_REASONING_REVIEW_CRITERIA)
			});
			expect(result.executionFailed, `${entry.id}: the probe validator refused the reported model`).toBe(false);
			expect(result.evaluator.modelId).toBe(reply.producer.modelId);
		}
	});
});

const FIXTURE: CandidateIdentity = {
	transport: 'stub',
	agentId: 'stub',
	provider: 'jpwb-stub',
	modelLabel: 'stub-reviewer',
	servedModelDigest: null,
	servedTemplateSha256: null,
	servedModelfileSha256: null,
	templateInjectsDate: null,
	serverVersion: null,
	serverUtcOffset: null,
	options: {},
	bounds: { wallClockMs: 240_000, promptChars: null, printTimeout: null },
	argv: null
};

describe('JAN-CRITREAD J2-3 — the fingerprint and the runner agree', () => {
	it('⭐ the case prompts are the hashes a run records — the initial prompt and the repair', async () => {
		const two: QualificationCase[] = CASES.filter((c) => c.id === 'G-RR-04' || c.id === 'W-CLEAN');
		let n = 0;
		const lines = await runQualification({
			runId: 'qr-agree-1',
			date: '2026-09-24T12:00:00.000Z',
			commit: 'e5f9358b'.repeat(5),
			fingerprint: { reviewer: BASE.reviewer, scoring: BASE.scoring, caseSet: BASE.caseSet },
			cases: two,
			caseSetVersion: 1,
			oracleVersion: 1,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			transport: {
				name: 'stub',
				identify: async () => FIXTURE,
				call: async () => ({
					returned:
						(n += 1) % 2 === 1
							? 'not a judgement'
							: JSON.stringify({
									findings: SEEDED_REASONING_REVIEW_CRITERIA.map((k) => ({
										criterionId: k.id,
										failed: false,
										statement: 'absent'
									})),
									recommendation: 'SATISFIED'
								}),
					served: null
				})
			},
			repetitions: 1,
			env: {}
		});
		const calls = lines.filter((l): l is CallLine => l.kind === 'CALL');
		expect(calls).toHaveLength(4);
		for (const call of calls)
			expect(call.promptSha256, `${call.caseId} ${call.role}`).toBe(BASE.casePrompts.get(call.caseId)![call.role]);
	});

	it('⭐ the case-set digest is over the cases’ inputs: an input edit moves it and moves no reviewer component', async () => {
		const edited = CASES.map((c) =>
			c.id === 'W-CLEAN' && c.arm === 'WORK_PRODUCT' ? { ...c, input: { ...c.input, answer: `${c.input.answer} ` } } : c
		);
		const fp = await reviewerFingerprint(edited);
		expect(fp.caseSet).not.toBe(BASE.caseSet);
		expect(fp.components).toEqual(BASE.components);
		expect(fp.casePrompts.get('W-CLEAN')).not.toEqual(BASE.casePrompts.get('W-CLEAN'));
		expect(fp.casePrompts.get('G-CLEAN')).toEqual(BASE.casePrompts.get('G-CLEAN'));
	});
});
