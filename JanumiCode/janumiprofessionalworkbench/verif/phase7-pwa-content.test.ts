// ⭐ `JAN-EXEC` Phase 7 — THE RUN'S BRIEF AND ITS PWA'S CONTENT, DECLARED ONCE, HOLD TO §3.2, EACH LIMB BESIDE A CONTROL
// THAT FAILS WHEN IT SHOULD (`docs/_working/DESIGN-the-live-end-to-end-run.md` §3.1, §3.2; round 1's BLOCKER, 2026-10-09).
//
// `scripts/phase7/pwa-content.ts` is the one source of the run's product brief and of its PWA's prompts: the gate's
// rehearsal types it (`apps/rph-demo/e2e/phase7-five-unit.e2e.ts`), the negative control hands the reviewer its
// end-to-end instruction (`negative-control.ts`), and the run's own lane is to type it. Round 1's prompts carried a brief
// of their own, which was not the one the acceptance suite and the negative control test — the run would have told each
// phase one product and tested it against another. So each limb below holds the REAL declaration, and beside it a
// ⛔ CONTROL drives the same check on a copy broken the way the limb exists to catch, and must see it fail:
//   · ⭐ the brief is `product-brief.md`, byte for byte, at its SHA-256 — ⛔ round 1's brief, the file's lines ended CRLF,
//     and the brief short of its last LF all fail;
//   · ⭐ every phase's instruction carries that brief verbatim — ⛔ a prompt carrying round 1's does not;
//   · ⭐ each instruction is the ENGINE's — `renderedPrompt` equals `prepareModelInvocation`'s own `prompt` for the type as
//     the designer stores it and the unit as instantiation builds it — ⛔ a rendering that drops the output contract
//     differs, and so does a declaration the designer would trim. ⚠ BOTH ARE BUILT HERE BY HAND (`storedTemplate`,
//     `unitSubject`), so this limb cannot see a route that builds either otherwise (round 1's verifier, 2026-10-09):
//     what the route itself sends is held in the gate, where each phase's try records `renderedPrompt`'s bytes as its
//     input (`apps/rph-demo/e2e/phase7-five-unit.e2e.ts`, section 6);
//   · ⭐ each renders UNDER 4,000 characters, the reasoning review's own `USER_INTENT_MAX` — ⛔ one that reaches 4,000
//     exactly fails, and the output contract is what reaches it;
//   · ⭐ each uses only {subject}, {title}, {description} and {purpose}, the markers the engine fills for a unit — ⛔
//     `{criteria}` (the designer's own example, `REG-F-507`) and `{statement}` (declared by the map, never filled) fail,
//     and the engine refuses both;
//   · ⭐ every type has a non-empty purpose — ⛔ an empty one and a blank one fail;
//   · ⭐ the module imports nothing, so Playwright, bun and vitest load the same value — ⛔ an import of Playwright, a
//     `require` and a dynamic import are each caught.
// ⭑ ITS MUTANTS, DRIVEN 2026-10-09 on a disposable copy of the working tree, never this one, with this file as it stands:
// ten edits to `pwa-content.ts` and `negative-control.ts` — a byte of the brief, round 1's brief in the prompts, an output
// contract past the budget, `{criteria}` in a prompt, the root's purpose emptied, the brief read from its file, a
// renderer that drops the contract, the negative control's own prompt, the budget raised, `{statement}` among the
// markers — and each reddened the limb it attacks, here or in `phase7-negative-control.test.ts`. ⭐ Driven again on these
// bytes after round 2's edit (2026-10-09), each reddened the same tests; and the three route mutants section 6 of the
// gate's spec catches left this file and `phase7-negative-control.test.ts` green. ~~⚠ None is declared in
// `scripts/mutants/ledger.ts` yet.~~ ⭑ All thirteen are declared there as `PQ7-M88` to `PQ7-M100` (2026-10-09), each
// re-driven and killed by its named victim.
// No model is called, and nothing here starts a process.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	assembleStepContext,
	DEFAULT_CONTEXT_ASSEMBLY_POLICY,
	markersIn,
	prepareModelInvocation,
	type InvocationSubject
} from '@janumipwb/rph-application';
import type { PromptTemplate } from '@janumipwb/rph-contracts';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { REASONING_REVIEW_BUDGET } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import {
	PHASE7_E2E,
	PHASE7_INSTRUCTION_BUDGET,
	PHASE7_MARKERS,
	PHASE7_PHASES,
	PHASE7_PWA,
	PHASE7_ROOT,
	PRODUCT_BRIEF,
	promptMarkers,
	renderedPrompt,
	type Phase7TypeDeclaration
} from '../scripts/phase7/pwa-content.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BRIEF_FILE = `${ROOT}scripts/phase7/product-brief.md`;
const CONTENT_MODULE = `${ROOT}scripts/phase7/pwa-content.ts`;
/** The canonical brief's SHA-256, as the acceptance suite pins it (`verif/phase7-acceptance.test.ts`). */
const BRIEF_SHA256 = 'ef1b696cab064ffcebc4d23411a3a43fca5142b8bcbfd006f88f3095284b25c8';

/** ⛔ Round 1's brief, quoted from `phase7-pwa.ts` as it stood at the BLOCKER — the control the brief limb must refuse. */
const ROUND_1_BRIEF = [
	'The product: wordfreq, a Node.js command-line tool with no dependencies.',
	'It reads text from a file named on its command line, or from standard input when no file is named, and prints the N most frequent words with their counts, most frequent first.',
	'Its options set N, turn on case folding, and name a file of stop words to leave out.',
	'Bad input exits with a defined, documented non-zero exit code: an unknown option has one, and a file that cannot be read has another.'
].join(' ');

/** The types a model runs — the four phases — held to be four, so a check over none cannot pass. */
const MODEL_TYPES = PHASE7_PWA.types.filter((t) => t.workDischarge === 'MODEL');

// ── THE CHECKS, each pure, so its control drives exactly what its limb drives ───────────────────────────────────────

/** Why `text` is not the canonical brief — its bytes, then its hash — or `[]` when it is. */
function briefFaults(text: string): string[] {
	const canonical = readFileSync(BRIEF_FILE);
	const bytes = Buffer.from(text, 'utf8');
	const sha = createHash('sha256').update(bytes).digest('hex');
	return [
		...(bytes.equals(canonical)
			? []
			: [
					`its ${bytes.length} bytes are not product-brief.md's ${canonical.length}, byte for byte`
				]),
		...(sha === BRIEF_SHA256 ? [] : [`its SHA-256 is ${sha}, not ${BRIEF_SHA256}`])
	];
}

/** The model types whose instruction does not carry the canonical brief verbatim, by name. */
const withoutTheBrief = (types: readonly Phase7TypeDeclaration[]): string[] =>
	types.filter((t) => !renderedPrompt(t).includes(PRODUCT_BRIEF)).map((t) => t.name);

/** The type as the designer stores it (`routes/pwa/[id]/+page.server.ts`): text trimmed, its markers read from it. */
function storedTemplate(t: Phase7TypeDeclaration): PromptTemplate {
	const templateText = (t.prompt ?? '').trim();
	const outputContract = (t.outputContract ?? '').trim();
	return {
		templateText,
		templateVersion: 1,
		declaredPlaceholders: markersIn(templateText),
		...(outputContract ? { outputContract } : {}),
		status: 'ACTIVE'
	};
}

/**
 * The unit as instantiation builds it (`routes/undertakings/+page.server.ts`: its title the type's name, its
 * description the type's purpose) and as the route hands it to the step (`undertakings/[id]/+page.server.ts`: the
 * type's purpose beside it when there is one).
 */
function unitSubject(t: Phase7TypeDeclaration): InvocationSubject {
	const title = t.name.trim();
	const purpose = t.purpose.trim();
	return { id: 'pwu_phase7_unit', title, description: purpose, ...(purpose ? { purpose } : {}) };
}

/**
 * ⭐ The ENGINE's instruction for the unit — what its model receives and its reviewer is shown — or its refusal. ⚠ For the
 * type and the unit as built above, by hand: the route's own is held in the gate (`phase7-five-unit.e2e.ts`, section 6).
 */
function engineInstruction(t: Phase7TypeDeclaration): string {
	const plan = prepareModelInvocation(unitSubject(t), 'pwutype_phase7', storedTemplate(t), {
		policy: DEFAULT_CONTEXT_ASSEMBLY_POLICY,
		alsoAssembles: []
	});
	return plan.ready ? plan.prompt : `REFUSED: ${plan.reason}`;
}

/** The model types whose instruction, as this module renders it, is not the engine's, by name. */
const notTheEngines = (types: readonly Phase7TypeDeclaration[]): string[] =>
	types.filter((t) => renderedPrompt(t) !== engineInstruction(t)).map((t) => t.name);

/** The model types whose instruction is not UNDER the budget, each with its length. */
const pastTheBudget = (types: readonly Phase7TypeDeclaration[]): string[] =>
	types
		.filter((t) => renderedPrompt(t).length >= PHASE7_INSTRUCTION_BUDGET)
		.map((t) => `${t.name}: ${renderedPrompt(t).length}`);

/**
 * The markers each type's prompt uses that no work unit fills — read by the ENGINE's own reading of the text
 * (`markersIn`, what the render guard refuses on) — and any brace its instruction still holds once rendered.
 */
const markerFaults = (types: readonly Phase7TypeDeclaration[]): string[] =>
	types.flatMap((t) => [
		...markersIn(t.prompt ?? '')
			.filter((m) => !PHASE7_MARKERS.includes(m))
			.map((m) => `${t.name}: {${m}} is filled by no work unit`),
		...(/[{}]/.test(renderedPrompt(t))
			? [`${t.name}: its rendered instruction still holds a brace`]
			: [])
	]);

/** The types whose purpose is empty or blank, by name. */
const withoutAPurpose = (types: readonly Phase7TypeDeclaration[]): string[] =>
	types.filter((t) => t.purpose.trim() === '').map((t) => t.name);

/** Every module `source` loads — a static import or re-export, an import-equals, a `require`, a dynamic `import()`. */
function loadsOf(source: string): string[] {
	const sf = ts.createSourceFile('module.ts', source, ts.ScriptTarget.Latest, true);
	const found: string[] = [];
	const visit = (n: ts.Node): void => {
		if (
			(ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
			n.moduleSpecifier !== undefined &&
			ts.isStringLiteral(n.moduleSpecifier)
		)
			found.push(n.moduleSpecifier.text);
		if (ts.isImportEqualsDeclaration(n)) found.push(n.moduleReference.getText(sf));
		if (
			ts.isCallExpression(n) &&
			(n.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(n.expression) && n.expression.text === 'require'))
		)
			found.push(n.arguments[0]?.getText(sf) ?? '(no argument)');
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return found;
}

/** `t` with `ask` added to the end of its prompt — a copy, never the declaration. */
const withAsk = (t: Phase7TypeDeclaration, ask: string): Phase7TypeDeclaration => ({
	...t,
	prompt: `${t.prompt ?? ''} ${ask}`
});

describe('JAN-EXEC Phase 7 — the run’s brief is the canonical one, and every phase is told it', () => {
	it('⭐ the brief is product-brief.md, byte for byte, at its SHA-256', () => {
		expect(createHash('sha256').update(readFileSync(BRIEF_FILE)).digest('hex')).toBe(BRIEF_SHA256);
		expect(briefFaults(PRODUCT_BRIEF)).toEqual([]);
	});

	it('⛔ CONTROL — round 1’s brief, the file’s lines ended CRLF, and the brief short of its last LF: each is refused', () => {
		expect(briefFaults(ROUND_1_BRIEF)).toHaveLength(2);
		expect(briefFaults(PRODUCT_BRIEF.replace(/\n/g, '\r\n'))).toHaveLength(2);
		expect(briefFaults(PRODUCT_BRIEF.slice(0, -1))).toHaveLength(2);
	});

	it('⭐ every phase’s instruction carries the brief verbatim, its last LF included — and the population is the four phases', () => {
		expect(MODEL_TYPES.map((t) => t.name)).toEqual(PHASE7_PHASES.map((t) => t.name));
		expect(MODEL_TYPES).toHaveLength(4);
		expect(withoutTheBrief(MODEL_TYPES)).toEqual([]);
	});

	it('⛔ CONTROL — a phase whose prompt carries round 1’s brief in its place is named', () => {
		const roundOne: Phase7TypeDeclaration = {
			...PHASE7_E2E,
			prompt: PHASE7_E2E.prompt!.replace(PRODUCT_BRIEF.slice(0, -1), ROUND_1_BRIEF)
		};
		// Arrangement: the substitution happened, so the control is not vacuous.
		expect(roundOne.prompt).toContain(ROUND_1_BRIEF);
		expect(withoutTheBrief([...MODEL_TYPES.filter((t) => t !== PHASE7_E2E), roundOne])).toEqual([
			PHASE7_E2E.name
		]);
	});
});

describe('JAN-EXEC Phase 7 — each phase’s instruction is the engine’s, and under what the reviewer is shown', () => {
	it('⭐ renderedPrompt is the engine’s own instruction for each phase — the brief, the ask and the output contract', () => {
		for (const t of MODEL_TYPES) {
			expect(engineInstruction(t), t.name).not.toMatch(/^REFUSED/);
			expect(t.outputContract?.trim(), `${t.name} declares no output contract`).toBeTruthy();
			expect(engineInstruction(t), t.name).toContain(
				`The output this work requires:\n${t.outputContract}`
			);
		}
		expect(notTheEngines(MODEL_TYPES)).toEqual([]);
	});

	it('⛔ CONTROL — a rendering that drops the output contract, and a declaration the designer would trim, are named', () => {
		// The module's rendering held against the engine's for a type it renders without the contract.
		const dropped = MODEL_TYPES.filter(
			(t) => renderedPrompt({ ...t, outputContract: undefined }) !== engineInstruction(t)
		);
		expect(dropped.map((t) => t.name)).toEqual(MODEL_TYPES.map((t) => t.name));
		// A purpose with a trailing space: the designer stores it trimmed, so the engine renders another text.
		const untrimmed: Phase7TypeDeclaration = { ...PHASE7_E2E, purpose: `${PHASE7_E2E.purpose} ` };
		expect(notTheEngines([untrimmed])).toEqual([PHASE7_E2E.name]);
	});

	it('⭐ each instruction renders UNDER 4,000 characters — the reasoning review’s own USER_INTENT_MAX', () => {
		expect(PHASE7_INSTRUCTION_BUDGET).toBe(REASONING_REVIEW_BUDGET.USER_INTENT_MAX);
		expect(pastTheBudget(MODEL_TYPES)).toEqual([]);
	});

	it('⛔ CONTROL — an instruction of 4,000 characters exactly is refused, one of 3,999 is not, and the output contract counts', () => {
		const room = PHASE7_INSTRUCTION_BUDGET - renderedPrompt(PHASE7_E2E).length;
		expect(room, 'arrangement: the end-to-end instruction has room to pad').toBeGreaterThan(1);
		const padded = (n: number): Phase7TypeDeclaration => ({
			...PHASE7_E2E,
			prompt: `${PHASE7_E2E.prompt}${'x'.repeat(n)}`
		});
		expect(renderedPrompt(padded(room))).toHaveLength(PHASE7_INSTRUCTION_BUDGET);
		expect(pastTheBudget([padded(room)])).toEqual([
			`${PHASE7_E2E.name}: ${PHASE7_INSTRUCTION_BUDGET}`
		]);
		expect(pastTheBudget([padded(room - 1)])).toEqual([]);
		// The template alone is under the budget: the contract the engine appends is what reaches it.
		expect(renderedPrompt({ ...padded(room), outputContract: undefined }).length).toBeLessThan(
			PHASE7_INSTRUCTION_BUDGET
		);
	});
});

describe('JAN-EXEC Phase 7 — each prompt uses only the markers a unit fills, and every type has a purpose', () => {
	it('⭐ the four markers are exactly those the engine fills for a unit of each phase — its map, less {statement}', () => {
		const declaresEvery: PromptTemplate = {
			templateText: '{subject} {title} {description} {statement} {purpose}',
			templateVersion: 1,
			declaredPlaceholders: ['subject', 'title', 'description', 'statement', 'purpose'],
			status: 'ACTIVE'
		};
		for (const t of MODEL_TYPES)
			expect(
				Object.keys(assembleStepContext(unitSubject(t), declaresEvery)).sort(),
				t.name
			).toEqual([...PHASE7_MARKERS].sort());
	});

	it('⭐ each prompt uses only {subject}, {title}, {description} and {purpose}, and renders with no brace left', () => {
		for (const t of MODEL_TYPES)
			expect(markersIn(t.prompt ?? '').length, t.name).toBeGreaterThan(0);
		expect(markerFaults(MODEL_TYPES)).toEqual([]);
		// The module's own reading of the markers, which the gate's rehearsal uses, agrees with the engine's.
		for (const t of MODEL_TYPES)
			expect(promptMarkers(t.prompt ?? ''), t.name).toEqual(markersIn(t.prompt ?? ''));
	});

	it('⛔ CONTROL — {criteria} (REG-F-507) and {statement} are named, and the engine refuses each at render', () => {
		const criteria = withAsk(PHASE7_E2E, 'Assess {subject} against {criteria}.');
		const statement = withAsk(PHASE7_E2E, 'Its statement: {statement}.');
		expect(markerFaults([criteria])).toEqual([
			`${PHASE7_E2E.name}: {criteria} is filled by no work unit`,
			`${PHASE7_E2E.name}: its rendered instruction still holds a brace`
		]);
		expect(markerFaults([statement])).toEqual([
			`${PHASE7_E2E.name}: {statement} is filled by no work unit`,
			`${PHASE7_E2E.name}: its rendered instruction still holds a brace`
		]);
		// ⛔ The harm the limb prevents: the step is refused at render, after it has started (`REG-F-508`).
		expect(engineInstruction(criteria)).toMatch(/^REFUSED: .*supplies no value for \{criteria\}/);
		expect(engineInstruction(statement)).toMatch(/^REFUSED: .*supplies no value for \{statement\}/);
	});

	it('⭐ every type, the root included, has a non-empty purpose', () => {
		expect(PHASE7_PWA.types).toHaveLength(5);
		expect(PHASE7_PWA.types).toContain(PHASE7_ROOT);
		expect(withoutAPurpose(PHASE7_PWA.types)).toEqual([]);
	});

	it('⛔ CONTROL — an empty purpose and a blank one are named, and a blank one leaves {purpose} unfilled', () => {
		const empty: Phase7TypeDeclaration = { ...PHASE7_E2E, name: 'empty', purpose: '' };
		const blank: Phase7TypeDeclaration = { ...PHASE7_E2E, name: 'blank', purpose: '   ' };
		expect(withoutAPurpose([...PHASE7_PWA.types, empty, blank])).toEqual(['empty', 'blank']);
		expect(engineInstruction(blank)).toMatch(/^REFUSED: .*supplies no value for \{purpose\}/);
	});
});

describe('JAN-EXEC Phase 7 — the content module is pure', () => {
	it('⭐ it loads no module at all — no Playwright, no file read — so every runner loads the same value', () => {
		expect(loadsOf(readFileSync(CONTENT_MODULE, 'utf8'))).toEqual([]);
	});

	it('⛔ CONTROL — an import of Playwright, a require and a dynamic import are each caught', () => {
		expect(loadsOf("import { expect } from '@playwright/test';\nexport const x = 1;")).toEqual([
			'@playwright/test'
		]);
		expect(loadsOf("export const x = require('node:fs');")).toEqual(["'node:fs'"]);
		expect(loadsOf("export const x = await import('node:fs');")).toEqual(["'node:fs'"]);
		expect(loadsOf("export { a } from './other.js';")).toEqual(['./other.js']);
	});
});
