// ⭐ `JAN-EXEC` Phase 7 `P7-2` — THE RUN'S LANE, HELD WHERE THE GATE CAN SEE IT (DESIGN-the-live-end-to-end-run.md §6 P7-2,
// D1, D3, D4, D5, D8, D11).
//
// `apps/rph-demo/e2e-live-exec/phase7.live.ts` is paid and never runs in the gate: the gate type-checks and lints it,
// and nothing else would see a change to what it does. So this file holds it from SOURCE, read from the AST, never a
// substring grep (`verif/live-exec-lane-config.test.ts`'s way): Playwright's own `test`, its own timeout, dry unless
// paid, every act the operator's own, nothing taken that resets or stipulates, no reviewer model variable named, and
// nothing done when the module loads. And it DRIVES the operator (`e2e-live-exec/phase7-operator.ts`) — the boot and
// devin's readiness through an injected runner, the presses on a page made here, the store's reading of a unit, the
// limit, the POST log — and ⭑ THE RUN ITSELF (`runTheLane`), on hands made here: its order, where it ends, and what it
// writes down. ⭑ Round 2's fix pass moved the run's order out of the spec, where its verification found a dry run that
// never pressed the root, a phase past its allowance that started the next beside it, and the boot's readiness check
// dropped, each passing every test here.
// ⛔ NO PROGRAM BUT NODE ITSELF IS RUN HERE: the readiness check's runner is injected, and the real runner is driven on
// `process.execPath`. No browser, no server and no model.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ExecutionPlanSchema,
	ExecutionStepSchema,
	ModelExchangeSchema,
	ProfessionalWorkUnitSchema
} from '@janumipwb/rph-contracts';
import { errors, type Locator, type Page } from '@playwright/test';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import type { EngineSnapshot } from '../apps/rph-demo/e2e/support/harness.js';
import {
	LANE_BUDGET,
	LIVE_RUN_DIR_VARIABLE,
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_PAID_LIMIT,
	PHASE7_PAID_VARIABLE,
	PHASE7_PRIOR_CALLS_VARIABLE,
	PHASE7_RECORD_ASSURANCE_MS,
	PHASE7_UNIT_ALLOWANCE_MS,
	REVIEWER_MODEL_VARIABLE
} from '../apps/rph-demo/e2e-live-exec/lane-config.js';
import {
	DEVIN_PROGRAM,
	INHERITED_PREFIXES,
	OVERLAY_KEYS,
	PHASE7_SIGN_OFF_MS,
	PHASE7_UI_MS,
	PHASE7_UNDERTAKING,
	READINESS_CALL_MS,
	actionOfUrl,
	beginExecute,
	bootOf,
	DECLARED_RERUN_RATIONALE,
	declaredRerunOffered,
	DRY_PRESS_NOT_REACHED,
	execFileRunner,
	inheritedVariables,
	lanePaths,
	laneVerdict,
	limitCheck,
	logPosts,
	markSatisfied,
	modelListed,
	openLane,
	outcomeOf,
	overlayOf,
	pressFormAction,
	priorReviewerCalls,
	readinessRefusals,
	recordAssurance,
	recordAssuranceOffered,
	recordedReviewerCalls,
	refusalOf,
	refusedReviewsOf,
	rerunDeclared,
	reviewerReadiness,
	reviewerUnderTest,
	runTheLane,
	signOffWorstCase,
	stoppedAfter,
	typesAsTyped,
	unitStateOf,
	unpressed,
	upstreamNotAssured,
	writeOnce,
	type ActionOutcome,
	type ArchiveCall,
	type Boot,
	type EnvelopeType,
	type LaneHands,
	RULE_RATIONALE,
	recover,
	recoveryOffers,
	type RecoveryAct,
	type RecoveryOffers,
	type ProgramRunner,
	type RunRecord,
	type RunUnit,
	type SignOffAct,
	type StartOffer,
	type UnitState
} from '../apps/rph-demo/e2e-live-exec/phase7-operator.js';
import { PHASE7_PWA, promptMarkers } from '../scripts/phase7/pwa-content.js';
import { PHASE7_ARCHIVE_UNITS } from '../scripts/phase7/run-archive.js';
import { readinessUnitOf, startReadiness } from '@janumipwb/rph-projections';

const APP = fileURLToPath(new URL('../apps/rph-demo/', import.meta.url));
const SPEC = 'e2e-live-exec/phase7.live.ts';
const OPERATOR = 'e2e-live-exec/phase7-operator.ts';
const CONFIG = 'playwright.live-exec.config.ts';
const MODEL_VARIABLES = ['JPWB_JUDGE_MODEL', 'JPWB_ASSURANCE_MODEL'] as const;

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-p7-live-spec-'));
afterAll(() => rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

let seq = 0;
/** A fresh folder of this file's own. */
const folder = (label: string): string => {
	const dir = join(ROOT, `${label}-${++seq}`);
	mkdirSync(dir, { recursive: true });
	return dir;
};

// ── THE SOURCE, READ FROM THE AST ────────────────────────────────────────────────────────────────────────────────────

const parsed = (rel: string) =>
	ts.createSourceFile(rel, readFileSync(`${APP}${rel}`, 'utf8'), ts.ScriptTarget.Latest, true);
const flat = (sf: ts.SourceFile, n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ');

/** Every node of `sf` that `pick` keeps. */
function nodes<T extends ts.Node>(sf: ts.SourceFile, pick: (n: ts.Node) => n is T): T[] {
	const out: T[] = [];
	const visit = (n: ts.Node): void => {
		if (pick(n)) out.push(n);
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

/** The names `sf` imports from `specifier`, and whether the import is type-only. */
function importsFrom(
	sf: ts.SourceFile,
	specifier: string
): { names: string[]; typeOnly: boolean }[] {
	return sf.statements.flatMap((st) =>
		ts.isImportDeclaration(st) &&
		ts.isStringLiteral(st.moduleSpecifier) &&
		st.moduleSpecifier.text === specifier &&
		st.importClause?.namedBindings &&
		ts.isNamedImports(st.importClause.namedBindings)
			? [
					{
						names: st.importClause.namedBindings.elements.map(
							(e) => (e.propertyName ?? e.name).text
						),
						typeOnly: st.importClause.isTypeOnly
					}
				]
			: []
	);
}

/** Every module `sf` imports from. */
const specifiersOf = (sf: ts.SourceFile): string[] =>
	sf.statements.flatMap((st) =>
		ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)
			? [st.moduleSpecifier.text]
			: []
	);

/** The arguments of every call to the bare function `name`, each as source text, whitespace collapsed. */
const callsTo = (sf: ts.SourceFile, name: string): string[][] =>
	nodes(sf, ts.isCallExpression)
		.filter((c) => ts.isIdentifier(c.expression) && c.expression.text === name)
		.map((c) => c.arguments.map((a) => flat(sf, a)));

/** The arguments of every call `object.method(…)`, whitespace collapsed. */
const methodCalls = (sf: ts.SourceFile, object: string, method: string): string[][] =>
	nodes(sf, ts.isCallExpression)
		.filter(
			(c) =>
				ts.isPropertyAccessExpression(c.expression) &&
				c.expression.name.text === method &&
				flat(sf, c.expression.expression) === object
		)
		.map((c) => c.arguments.map((a) => flat(sf, a)));

/** Every call of a method `method`, on whatever. */
const anyMethodCalls = (sf: ts.SourceFile, method: string): ts.CallExpression[] =>
	nodes(sf, ts.isCallExpression).filter(
		(c) => ts.isPropertyAccessExpression(c.expression) && c.expression.name.text === method
	);

/** The initializer of every variable `name` declared in `sf`, whitespace collapsed. */
const initializersOf = (sf: ts.SourceFile, name: string): string[] =>
	nodes(sf, ts.isVariableDeclaration)
		.filter((d) => ts.isIdentifier(d.name) && d.name.text === name && d.initializer !== undefined)
		.map((d) => flat(sf, d.initializer!));

/** The value of every property `name` of every object literal in `sf`, whitespace collapsed. */
const propertiesNamed = (sf: ts.SourceFile, name: string): string[] =>
	nodes(sf, ts.isPropertyAssignment)
		.filter((p) => p.name.getText(sf) === name)
		.map((p) => flat(sf, p.initializer));

/** The function a node sits in, by its name — a declaration's, or the variable a function expression is bound to. */
function enclosingFunction(n: ts.Node): string | undefined {
	for (let at: ts.Node | undefined = n.parent; at !== undefined; at = at.parent) {
		if (ts.isFunctionDeclaration(at) && at.name) return at.name.text;
		if (
			(ts.isArrowFunction(at) || ts.isFunctionExpression(at)) &&
			ts.isVariableDeclaration(at.parent)
		)
			return at.parent.name.getText();
	}
	return undefined;
}

/** Every place `sf` NAMES a reviewer model variable itself: a string, a template, or `process.env` read by name. */
function modelVariablesNamed(sf: ts.SourceFile): string[] {
	const out: string[] = [];
	const at = (n: ts.Node, what: string) =>
		out.push(`${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}: ${what}`);
	const visit = (n: ts.Node): void => {
		if (
			ts.isStringLiteralLike(n) ||
			ts.isTemplateHead(n) ||
			ts.isTemplateMiddle(n) ||
			ts.isTemplateTail(n)
		)
			for (const v of MODEL_VARIABLES) if (n.text.includes(v)) at(n, `the text names ${v}`);
		if (
			ts.isPropertyAccessExpression(n) &&
			(MODEL_VARIABLES as readonly string[]).includes(n.name.text)
		)
			at(n, `reads ${n.getText(sf)}`);
		ts.forEachChild(n, visit);
	};
	visit(sf);
	return out;
}

describe('⛔ the spec, from source: Playwright’s own `test`, its own timeout, dry unless paid, every act the operator’s', () => {
	const sf = parsed(SPEC);

	it('takes `test` from @playwright/test, and from the harness only `gotoHydrated` — whose `test` posts a lane control that 404s outside test mode', () => {
		expect(importsFrom(sf, '@playwright/test').flatMap((i) => i.names)).toContain('test');
		expect(importsFrom(sf, '../e2e/support/harness').flatMap((i) => i.names)).toEqual([
			'gotoHydrated'
		]);
	});

	it('⛔ never resets the engine — a durable store refuses it — and stipulates nothing', () => {
		for (const file of [SPEC, OPERATOR]) {
			const source = parsed(file);
			const imported = specifiersOf(source).flatMap((s) =>
				importsFrom(source, s).flatMap((i) => i.names)
			);
			for (const name of ['resetEngine', 'registerStipulation']) {
				expect(callsTo(source, name), `${file} calls ${name}`).toEqual([]);
				expect(imported, `${file} imports ${name}`).not.toContain(name);
			}
		}
	});

	it('⭐ sets its OWN timeout, once: the setup and four phases’ allowance (D4) — the config’s stays the one-unit lane’s', () => {
		expect(methodCalls(sf, 'test', 'setTimeout')).toEqual([['PHASE7_TEST_TIMEOUT_MS']]);
	});

	it('⛔ D1 — paid only when JPWB_PHASE7_PAID is exactly 1; anything else is dry', () => {
		expect(initializersOf(sf, 'paid')).toEqual(["process.env[PHASE7_PAID_VARIABLE] === '1'"]);
	});

	it('⭐ the run is the operator’s `runTheLane`, booted by `bootOf` on this process’s environment and the run folder’s store, and held to `laneVerdict`', () => {
		expect(callsTo(sf, 'runTheLane')).toHaveLength(1);
		expect(callsTo(sf, 'bootOf')).toEqual([
			['{ paid, env: process.env, serverEnv: test.info().config.webServer?.env, store }']
		]);
		expect(initializersOf(sf, 'store')).toEqual(['join(runFolder, STORE_FILE)']);
		expect(callsTo(sf, 'laneVerdict')).toEqual([['record']]);
		const held = anyMethodCalls(sf, 'toEqual').filter((c) => {
			const asserted = (c.expression as ts.PropertyAccessExpression).expression;
			return (
				ts.isCallExpression(asserted) &&
				flat(sf, asserted.expression) === 'expect' &&
				flat(sf, asserted.arguments[0]!) === 'laneVerdict(record)'
			);
		});
		expect(held.map((c) => c.arguments.map((a) => flat(sf, a)))).toEqual([['[]']]);
	});

	it('⛔ D4, D5 — every act on a unit is the operator’s, on that unit’s own row; the spec waits on no response itself', () => {
		// ⭐ `REG-D-112` (E3's review, finding 5) — the unit's own row BY ITS ID: a title may repeat in half B.
		for (const act of ['beginExecute', 'markSatisfied'])
			expect(callsTo(sf, act), act).toEqual([
				['page', 'unitRowById(page, unit.unitId!)', 'actionFields']
			]);
		// ⭐ R3-B F2 (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (15)) — and Record Assurance waited for
		// up to the bound the lane hands the spec, never one the spec chooses.
		expect(callsTo(sf, 'recordAssurance'), 'recordAssurance').toEqual([
			['page', 'unitRowById(page, unit.unitId!)', 'actionFields', 'timeoutMs']
		]);
		// ⭐ P7-6R R-1f — and the run plan's rule's acts too: the row's offers read, and each act pressed, on the unit's own row.
		expect(callsTo(sf, 'recoveryOffers'), 'recoveryOffers').toEqual([
			['unitRowById(page, unit.unitId!)']
		]);
		expect(callsTo(sf, 'recover'), 'recover').toEqual([
			['page', 'unitRowById(page, unit.unitId!)', 'act', 'actionFields']
		]);
		// ⭐ `E12F` F1, F3 — the dry rehearsal's read, and the rule's declared re-run: each on the unit's own row ⭐ — by its id,
		// as every act's (`REG-D-112`, E3's review finding 5; the merge of E12 and E3).
		expect(callsTo(sf, 'recordAssuranceOffered'), 'recordAssuranceOffered').toEqual([
			['unitRowById(page, unit.unitId!)']
		]);
		expect(callsTo(sf, 'declaredRerunOffered'), 'declaredRerunOffered').toEqual([
			['unitRowById(page, unit.unitId!)']
		]);
		expect(callsTo(sf, 'rerunDeclared'), 'rerunDeclared').toEqual([
			['page', 'unitRowById(page, unit.unitId!)', 'actionFields', 'timeoutMs']
		]);
		expect(anyMethodCalls(sf, 'waitForResponse')).toEqual([]);
		expect(callsTo(sf, 'pressAction')).toEqual([]);
		expect(callsTo(sf, 'pressFormAction')).toEqual([]);
	});

	it('⭐ the page is loaded afresh on the Undertaking the setup created, and its overview shown', () => {
		expect(callsTo(sf, 'gotoHydrated')).toEqual([['page', 'undertakingPath']]);
		expect(propertiesNamed(sf, 'showOverview')).toEqual([
			"async () => { await gotoHydrated(page, undertakingPath); await page.getByRole('button', { name: 'overview', exact: true }).click({ timeout: PHASE7_UI_MS }); }"
		]);
	});

	it('⛔ neither the spec nor the operator names a reviewer model variable — the mapping has one home', () => {
		expect(modelVariablesNamed(sf), SPEC).toEqual([]);
		expect(modelVariablesNamed(parsed(OPERATOR)), OPERATOR).toEqual([]);
	});

	it('⛔ the module does nothing when it loads — Playwright loads it twice, in the runner and in the worker', () => {
		const kinds = sf.statements.map((st) =>
			ts.isImportDeclaration(st)
				? 'import'
				: ts.isExpressionStatement(st) &&
					  ts.isCallExpression(st.expression) &&
					  flat(sf, st.expression.expression) === 'test.describe'
					? 'test.describe'
					: flat(sf, st)
		);
		expect([...new Set(kinds)]).toEqual(['import', 'test.describe']);
		expect(kinds.filter((k) => k === 'test.describe')).toHaveLength(1);
	});

	it('⭐ every read of the store goes through a fresh request context: the test takes no pooled `request` (REG-F-501)', () => {
		const body = nodes(sf, ts.isArrowFunction).find(
			(f) => ts.isCallExpression(f.parent) && flat(sf, f.parent.expression) === 'test'
		);
		const bound = body?.parameters[0]?.name;
		expect(
			bound !== undefined && ts.isObjectBindingPattern(bound)
				? bound.elements.map((e) => e.name.getText(sf))
				: undefined
		).toEqual(['page', 'baseURL']);
	});
});

describe('⛔ D4 — the operator bounds every Begin & Execute by one phase’s allowance, and every press by a bound', () => {
	const op = parsed(OPERATOR);

	it('each press waits on its own response with the bound it was given', () => {
		const waits = anyMethodCalls(op, 'waitForResponse');
		expect(waits.map((w) => enclosingFunction(w))).toEqual(['pressFormAction']);
		expect(
			waits.map((w) => (w.arguments[1] === undefined ? 'no bound' : flat(op, w.arguments[1])))
		).toEqual(['{ timeout: timeoutMs }']);
	});

	it('Begin & Execute is pressed with PHASE7_UNIT_ALLOWANCE_MS; the sign-off acts with their own bound', () => {
		const presses = nodes(op, ts.isCallExpression).filter(
			(c) => ts.isIdentifier(c.expression) && c.expression.text === 'pressFormAction'
		);
		expect(
			presses.map((c) => [
				enclosingFunction(c),
				flat(op, c.arguments[1]!),
				flat(op, c.arguments[3]!)
			])
		).toEqual([
			['beginExecute', "'beginExecute'", 'PHASE7_UNIT_ALLOWANCE_MS'],
			// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B8) — ~~'PHASE7_SIGN_OFF_MS'~~: Record Assurance runs the unit's
			// declared reviews now, so it is waited for up to its act and those reviews (~~`PHASE7_RECORD_ASSURANCE_MS`~~ ⭐ the
			// bound the lane gives it, `timeoutMs`, for the unit's declared policies — R3-B F2; the lead's delegated decision of
			// 2026-10-16, registered as REG-D-114 (15)).
			['recordAssurance', "'recordAssurance'", 'timeoutMs'],
			// ⭐ `E12F` F3 — the rule's re-run of the declared reviews that did not conclude: bounded as Record Assurance is, its
			// act and a review of each declared policy.
			['rerunDeclared', "'rerunDeclaredReviews'", 'timeoutMs'],
			['markSatisfied', "'markSatisfied'", 'PHASE7_SIGN_OFF_MS'],
			// ⭐ P7-6R R-1f — the rule's acts: an abandonment, bounded as a sign-off act; a re-run, as a phase (a re-run of the
			// work runs the phase again).
			['recover', 'act', 'PHASE7_SIGN_OFF_MS'],
			['recover', 'act', 'PHASE7_UNIT_ALLOWANCE_MS'],
			// ⭐ E3 (C1) — half B's designer acts: "Accept exact candidate", then Submit for Review, Validate and Publish, each
			// bounded as a sign-off act is — none calls a model (`acceptCandidate`, `designerAct`).
			['acceptCandidate', "'acceptAgentCandidate'", 'PHASE7_SIGN_OFF_MS'],
			['designerAct', 'act', 'PHASE7_SIGN_OFF_MS']
		]);
	});

	// ⭐⭐ P7-6 B3 (the fix round) — EVERY FILL AND EVERY CLICK THE LANE MAKES CARRIES ITS OWN BOUND, in the operator and in the
	// spec's hands (whose `showOverview` the rule calls). ⛔ The page's default (`setDefaultTimeout`) is set in the spec, where
	// no test here drives it: a hand that leaned on it was bounded only so long as that one line stood.
	it('⛔ B3 — every fill and every click in the operator and the spec passes an explicit timeout', () => {
		for (const file of [OPERATOR, SPEC]) {
			const sf = parsed(file);
			for (const method of ['fill', 'click'])
				for (const c of anyMethodCalls(sf, method))
					expect(
						c.arguments.map((a) => flat(sf, a)).join(', '),
						`${file}: ${flat(sf, c)}`
					).toMatch(/\btimeout\b/);
		}
		expect(anyMethodCalls(op, 'fill'), 'arrangement: the operator fills the rule’s rationale').not.toEqual([]);
	});

	it('⛔ takes nothing from the harness but its types, and nothing from phase7-pwa, whose imports verif’s program refuses', () => {
		expect(importsFrom(op, '../e2e/support/harness.js')).toEqual([
			{ names: ['EngineSnapshot', 'ObjectRow'], typeOnly: true }
		]);
		expect(specifiersOf(op).filter((s) => s.includes('phase7-pwa'))).toEqual([]);
	});
});

// ── A PAGE MADE HERE, FOR THE PRESSES ────────────────────────────────────────────────────────────────────────────────

const PAGE_URL = 'http://127.0.0.1:4322/undertakings/und_1';
/** A request of `method` to `url`, failing with `errorText` should it fail. */
const requestTo = (url: string, method: string, errorText = 'net::ERR_FAILED') => ({
	url: () => url,
	method: () => method,
	failure: () => ({ errorText })
});
/** A response to a request of `method` to `url`. */
const response = (url: string, method: string) => ({
	url: () => url,
	request: () => requestTo(url, method)
});
const SUCCESS_BODY = '{"type":"success","status":200,"data":"[{}]"}';

/**
 * A fake page whose one response is `answer` — or none: its wait then rejects as Playwright's does at its bound, here
 * after `boundAfterMs` — and whose button's click fails each request in `fails`, in order, as a browser reports a
 * request that failed in transit. It records the wait it was asked for and the failure listeners it holds.
 */
function fakePage(
	answer: { status: number; body: string } | 'none',
	opts: {
		fails?: readonly ReturnType<typeof requestTo>[];
		boundAfterMs?: number;
		clickThrows?: Error;
	} = {}
) {
	const asked: { predicate?: (r: unknown) => boolean; timeout?: number } = {};
	const listeners = new Set<(r: unknown) => void>();
	const page = {
		url: () => PAGE_URL,
		on: (event: string, h: (r: unknown) => void) => {
			if (event === 'requestfailed') listeners.add(h);
		},
		off: (event: string, h: (r: unknown) => void) => {
			if (event === 'requestfailed') listeners.delete(h);
		},
		waitForResponse: (predicate: (r: unknown) => boolean, options?: { timeout?: number }) => {
			asked.predicate = predicate;
			asked.timeout = options?.timeout;
			return answer === 'none'
				? new Promise((_, reject) =>
						setTimeout(
							() => reject(new errors.TimeoutError(`Timeout ${options?.timeout}ms exceeded.`)),
							opts.boundAfterMs ?? 0
						)
					)
				: Promise.resolve({
						status: () => answer.status,
						body: async () => Buffer.from(answer.body, 'utf8')
					});
		}
	};
	let clicked = 0;
	const button = {
		click: async () => {
			clicked += 1;
			if (opts.clickThrows) throw opts.clickThrows;
			for (const failed of opts.fails ?? []) for (const h of [...listeners]) h(failed);
		},
		getByRole: () => button
	};
	return {
		page: page as unknown as Page,
		button: button as unknown as Locator,
		asked,
		clicks: () => clicked,
		listeners: () => listeners.size
	};
}
/** The decoder the spec hands in is `actionFields`; a stand-in that says it was called. */
const decode = () => ({ decodedBy: 'the spec’s decoder' });

describe('⭐ D5 — a press keeps what came back, and a press with NO ANSWER is RETURNED, never thrown', () => {
	it('⛔ Begin & Execute waits one phase’s allowance, on ITS OWN action’s POST', async () => {
		const f = fakePage({ status: 200, body: SUCCESS_BODY });
		const outcome = await beginExecute(f.page, f.button, decode);
		expect(f.asked.timeout).toBe(PHASE7_UNIT_ALLOWANCE_MS);
		expect(f.clicks()).toBe(1);
		expect(f.asked.predicate!(response(`${PAGE_URL}?/beginExecute`, 'POST'))).toBe(true);
		expect(f.asked.predicate!(response(`${PAGE_URL}?/beginExecute`, 'GET'))).toBe(false);
		expect(f.asked.predicate!(response(`${PAGE_URL}?/recordAssurance`, 'POST'))).toBe(false);
		expect(outcome).toEqual({
			status: 200,
			envelopeType: 'success',
			rawBody: SUCCESS_BODY,
			decoded: { decodedBy: 'the spec’s decoder' },
			timedOutAfterMs: null,
			requestFailure: null
		});
		expect(f.listeners(), 'the press left its failure listener on the page').toBe(0);
	});

	it('⛔ a press with no answer within its bound comes back as that, so the run can say so and start nothing beside it (REG-F-535)', async () => {
		const f = fakePage('none');
		const outcome = await pressFormAction(f.page, 'beginExecute', f.button, 1_234, decode);
		expect(outcome).toEqual({
			status: null,
			envelopeType: null,
			rawBody: null,
			decoded: null,
			timedOutAfterMs: 1_234,
			requestFailure: null
		});
		expect(refusalOf(outcome)).toBe('no answer within 1234 ms');
	});

	it('⛔ a POST that FAILS IN TRANSIT comes back AT ONCE as that — never waited out for its bound — and only ITS OWN failure counts', async () => {
		// ⭐ The arrangement round 2's verification drove against headless Edge: the server destroys the POST's socket,
		// the browser reports `net::ERR_EMPTY_RESPONSE` at once, and the response wait runs on to its bound — here 200 ms.
		const f = fakePage('none', {
			boundAfterMs: 200,
			fails: [
				requestTo(`${PAGE_URL}?/beginExecute`, 'GET', 'net::ERR_ABORTED'),
				requestTo(`${PAGE_URL}?/recordAssurance`, 'POST', 'net::ERR_CONNECTION_RESET'),
				requestTo(`${PAGE_URL}?/beginExecute`, 'POST', 'net::ERR_EMPTY_RESPONSE')
			]
		});
		const outcome = await pressFormAction(
			f.page,
			'beginExecute',
			f.button,
			PHASE7_UNIT_ALLOWANCE_MS,
			decode
		);
		expect(
			outcome,
			'the failed POST was waited out, or another request’s failure was taken'
		).toEqual({
			status: null,
			envelopeType: null,
			rawBody: null,
			decoded: null,
			timedOutAfterMs: null,
			requestFailure: 'net::ERR_EMPTY_RESPONSE'
		});
		expect(refusalOf(outcome)).toBe(
			'no answer: the request failed in transit (net::ERR_EMPTY_RESPONSE)'
		);
		expect(f.listeners(), 'the press left its failure listener on the page').toBe(0);
	});

	it('⛔ a click that never lands — its button never came — is THROWN, never read as a press past its bound', async () => {
		const f = fakePage('none', {
			clickThrows: new errors.TimeoutError('locator.click: Timeout 120000ms exceeded.')
		});
		await expect(pressFormAction(f.page, 'beginExecute', f.button, 1_234, decode)).rejects.toThrow(
			'locator.click: Timeout 120000ms exceeded.'
		);
		expect(f.listeners()).toBe(0);
	});

	it('⭐ the envelope’s own verdict, not the HTTP status: a refusal at 200 reads as a failure, decoded by the spec’s decoder', () => {
		const refusal = outcomeOf(
			200,
			'{"type":"failure","status":400,"data":"[{\\"error\\":1},\\"no\\"]"}',
			() => ({
				error: 'Execution failed: BeginPwuShaping'
			})
		);
		expect([refusal.envelopeType, refusalOf(refusal)]).toEqual([
			'failure',
			'Execution failed: BeginPwuShaping'
		]);
	});

	it('⛔ an `error` or redirect envelope keeps SvelteKit’s fields, never the action decoder’s; a body that is no envelope keeps its bytes, with no type', () => {
		const thrown = outcomeOf(500, '{"type":"error","error":{"message":"Internal Error"}}', decode);
		expect([thrown.envelopeType, thrown.decoded]).toEqual([
			'error',
			{ error: { message: 'Internal Error' } }
		]);
		const moved = outcomeOf(200, '{"type":"redirect","status":303,"location":"/"}', decode);
		expect([moved.envelopeType, moved.decoded]).toEqual(['redirect', { location: '/' }]);
		const garbled = outcomeOf(502, '<html>Bad Gateway</html>', decode);
		expect(garbled).toEqual({
			status: 502,
			envelopeType: null,
			rawBody: '<html>Bad Gateway</html>',
			decoded: null,
			timedOutAfterMs: null,
			requestFailure: null
		});
		expect(refusalOf(garbled)).toBe('<html>Bad Gateway</html>');
	});
});

/**
 * A unit's row as the page draws it: its buttons count only once the row is SHOWN (`waitFor` visible), as on a page
 * still drawing; `offered` is how many Record Assurance it then shows. Every wait and click is logged, in order.
 */
function signOffRow(offered: number) {
	const log: string[] = [];
	const asked: { action: string | undefined; timeout: number | undefined }[] = [];
	let shown = false;
	const page = {
		url: () => PAGE_URL,
		on: () => undefined,
		off: () => undefined,
		waitForResponse: (predicate: (r: unknown) => boolean, options?: { timeout?: number }) => {
			asked.push({
				action: ['recordAssurance', 'markSatisfied'].find((a) =>
					predicate(response(`${PAGE_URL}?/${a}`, 'POST'))
				),
				timeout: options?.timeout
			});
			return Promise.resolve({
				status: () => 200,
				body: async () => Buffer.from(SUCCESS_BODY, 'utf8')
			});
		}
	};
	const button = (name: string) => ({
		count: async () => (shown ? (name === 'Record Assurance' ? offered : 1) : 0),
		click: async () => void log.push(`click ${name}`),
		waitFor: async (o: { state: string; timeout: number }) =>
			void log.push(`wait for ${name} ${o.state} ${o.timeout}`)
	});
	const row = {
		waitFor: async (o: { state: string; timeout: number }) => {
			shown = true;
			log.push(`wait for the row ${o.state} ${o.timeout}`);
		},
		getByRole: (_role: string, o: { name: string }) => button(o.name)
	};
	return { page: page as unknown as Page, row: row as unknown as Locator, log, asked };
}

describe('⭐ D5 — the sign-off acts on the page: the row waited for, Mark Satisfied only once Record Assurance has left it', () => {
	it('⛔ Record Assurance waits for the row BEFORE judging it — a row offering it is pressed with ~~its own bound~~ ⭐ the bound it is given, half A’s here, its declared reviews counted (E2), one offering none is not pressed', async () => {
		const offering = signOffRow(1);
		const pressed = await recordAssurance(offering.page, offering.row, decode, PHASE7_RECORD_ASSURANCE_MS);
		expect(pressed?.envelopeType, 'a row that offers Record Assurance read as offering none').toBe(
			'success'
		);
		expect(offering.log).toEqual([
			`wait for the row visible ${PHASE7_UI_MS}`,
			'click Record Assurance'
		]);
		expect(offering.asked).toEqual([{ action: 'recordAssurance', timeout: PHASE7_RECORD_ASSURANCE_MS }]);
		const bare = signOffRow(0);
		expect(await recordAssurance(bare.page, bare.row, decode, PHASE7_RECORD_ASSURANCE_MS)).toBeNull();
		expect(bare.log, 'a row that offers no Record Assurance was pressed').toEqual([
			`wait for the row visible ${PHASE7_UI_MS}`
		]);
	});

	it('⛔ E12F F1 (REG-D-112 (b)) — the dry rehearsal READS the row and presses nothing: the row waited for, Record Assurance counted, no click, no POST', async () => {
		const offering = signOffRow(1);
		expect(await recordAssuranceOffered(offering.row)).toBe(true);
		expect([offering.log, offering.asked], 'the rehearsal pressed something').toEqual([
			[`wait for the row visible ${PHASE7_UI_MS}`],
			[]
		]);
		expect(await recordAssuranceOffered(signOffRow(0).row), 'a row offering none read as offering it').toBe(false);
	});

	it('⛔ Mark Satisfied is pressed only once Record Assurance has LEFT the row — never the EXECUTING row’s own (P7-3)', async () => {
		const r = signOffRow(1);
		const green = await markSatisfied(r.page, r.row, decode);
		expect(green.envelopeType).toBe('success');
		expect(r.log).toEqual([
			`wait for Record Assurance detached ${PHASE7_UI_MS}`,
			'click Mark Satisfied'
		]);
		expect(r.asked).toEqual([{ action: 'markSatisfied', timeout: PHASE7_SIGN_OFF_MS }]);
	});

	it('⛔ R3-B F2 (the lead’s delegated decision of 2026-10-16, registered as REG-D-114 (15)) — Record Assurance and the rule’s re-run of the declared reviews are each waited for up to the bound it is given', async () => {
		// ⛔ PREDICTED RED, read from the code: both presses waited `PHASE7_RECORD_ASSURANCE_MS`, §3.2's four policies' reviews,
		// whatever the unit declared — so a unit of half B's declaring five could be abandoned at 4,140 s with its fifth review
		// still inside its own bound.
		// ⭑ The presses' half only: the bound is handed in here. The lane's half, half B's bound from the unit's own declared
		// policies, is held in `verif/phase7-half-b.test.ts` ('⛔ R3-B F2 — an agent’s unit declaring FIVE policies …').
		const FIVE_REVIEWS = PHASE7_SIGN_OFF_MS + 5 * LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs;
		const offering = signOffRow(1);
		await recordAssurance(offering.page, offering.row, decode, FIVE_REVIEWS);
		const r = recoveryRow(['rerun-declared-reviews', 'rerun-declared-rationale']);
		await rerunDeclared(r.page, r.row, decode, FIVE_REVIEWS);
		expect([offering.asked, r.asked], 'a press was not waited for up to the bound it was given').toEqual([
			[{ action: 'recordAssurance', timeout: FIVE_REVIEWS }],
			[{ action: 'rerunDeclaredReviews', timeout: FIVE_REVIEWS }]
		]);
	});
});

/**
 * ⭐ P7-6R R-1f — a waiting unit's row as the page draws it (R-1d): the test ids it carries (`offered`), and a log of what
 * the operator did to it — filled which field with what, clicked which button, each with the bound it was given — with
 * every response it waited on.
 * ⭐⭐ P7-6 B3 (the fix round) — ⛔ AND A FIELD OR BUTTON THE ROW DOES NOT CARRY CANNOT BE FILLED OR CLICKED: either waits
 * out its bound and throws, as Playwright's does. Until this, `fill` succeeded on any name, so a press on a field the page
 * never renders — the abandonment's rationale on a unit no longer WAITING (`+page.svelte`) — passed every test, and in the
 * paid lane waited out its bound and threw, ending the run `lane-error` with its final archive never taken. A field's
 * button stands with it: `rerun-review` with `rerun-review-rationale`, and `Abandon`'s field is `abandon-rationale`.
 */
function recoveryRow(offered: readonly string[]) {
	const log: string[] = [];
	const asked: { action: string | undefined; timeout: number | undefined }[] = [];
	let shown = false;
	const page = {
		url: () => PAGE_URL,
		on: () => undefined,
		off: () => undefined,
		waitForResponse: (predicate: (r: unknown) => boolean, options?: { timeout?: number }) => {
			asked.push({
				action: ['rerunReview', 'rerunWork', 'abandonPwu', 'rerunDeclaredReviews'].find((a) =>
					predicate(response(`${PAGE_URL}?/${a}`, 'POST'))
				),
				timeout: options?.timeout
			});
			return Promise.resolve({
				status: () => 200,
				body: async () => Buffer.from(SUCCESS_BODY, 'utf8')
			});
		}
	};
	/** Whether the row carries `name`: an offered test id, a field of one, or the Abandon button beside its field. */
	const carried = (name: string): boolean =>
		offered.some((o) => name === o || name === `${o}-rationale`) ||
		(name === 'Abandon' && offered.includes('abandon-rationale'));
	const absent = (act: string, name: string, o?: { timeout?: number }) =>
		new errors.TimeoutError(`locator.${act}: Timeout ${o?.timeout}ms exceeded waiting for ${name}.`);
	const element = (name: string) => ({
		count: async () => (shown && offered.includes(name) ? 1 : 0),
		click: async (o?: { timeout?: number }) => {
			if (!carried(name)) throw absent('click', name, o);
			log.push(`click ${name} (${o?.timeout})`);
		},
		fill: async (text: string, o?: { timeout?: number }) => {
			if (!carried(name)) throw absent('fill', name, o);
			log.push(`fill ${name}: ${text} (${o?.timeout})`);
		}
	});
	const row = {
		waitFor: async (o: { state: string; timeout: number }) => {
			shown = true;
			log.push(`wait for the row ${o.state} ${o.timeout}`);
		},
		getByTestId: (id: string) => element(id),
		getByRole: (_role: string, o: { name: string }) => element(o.name)
	};
	return { page: page as unknown as Page, row: row as unknown as Locator, log, asked };
}

describe('⭐ P7-6R R-1f — the run plan’s rule’s acts on the page: what the row offers, and each act typed and pressed', () => {
	it('⛔ the row is waited for BEFORE its offers are read, and each offer is read by the page’s own test id', async () => {
		const all = recoveryRow(['rerun-review', 'rerun-work', 'abandon-rationale']);
		expect(await recoveryOffers(all.row)).toEqual({
			rerunReview: true,
			rerunWork: true,
			abandon: true
		});
		expect(all.log).toEqual([`wait for the row visible ${PHASE7_UI_MS}`]);
		const concluded = recoveryRow(['rerun-work', 'abandon-rationale']);
		expect(await recoveryOffers(concluded.row)).toEqual({
			rerunReview: false,
			rerunWork: true,
			abandon: true
		});
	});

	it('⛔ each act types the run plan’s rationale into ITS OWN field, presses ITS OWN button, and waits on ITS OWN action — a re-run for a phase’s allowance, an abandonment for a sign-off act’s', async () => {
		const pressed = async (act: 'rerunReview' | 'rerunWork' | 'abandonPwu') => {
			const r = recoveryRow(['rerun-review', 'rerun-work', 'abandon-rationale']);
			expect((await recover(r.page, r.row, act, decode)).envelopeType).toBe('success');
			return [r.log, r.asked];
		};
		// ⭐ P7-6 B3 — each fill and each click with a bound of its own, never the page's default alone.
		expect(await pressed('rerunReview')).toEqual([
			[`fill rerun-review-rationale: ${RULE_RATIONALE.rerunReview} (${PHASE7_UI_MS})`, `click rerun-review (${PHASE7_UI_MS})`],
			[{ action: 'rerunReview', timeout: PHASE7_UNIT_ALLOWANCE_MS }]
		]);
		expect(await pressed('rerunWork')).toEqual([
			[`fill rerun-work-rationale: ${RULE_RATIONALE.rerunWork} (${PHASE7_UI_MS})`, `click rerun-work (${PHASE7_UI_MS})`],
			[{ action: 'rerunWork', timeout: PHASE7_UNIT_ALLOWANCE_MS }]
		]);
		expect(await pressed('abandonPwu')).toEqual([
			[`fill abandon-rationale: ${RULE_RATIONALE.abandonPwu} (${PHASE7_UI_MS})`, `click Abandon (${PHASE7_UI_MS})`],
			[{ action: 'abandonPwu', timeout: PHASE7_SIGN_OFF_MS }]
		]);
	});

	// ⭐⭐ P7-6 B3 (the fix round) — ⛔ THE ABANDONMENT'S FIELD IS RENDERED FOR A WAITING UNIT ONLY (`+page.svelte`: `abandon-
	// rationale` inside `recoveryByPwu`), so a press on a row that does not carry it must FAIL — at the act's own bound —
	// never type into nothing and click. Its bound is explicit, so it cannot wait on whatever the page's default became.
	it('⭐ E12F F3 — the declared re-run: offered by the row’s own test id, the rule’s rationale typed into its own field, its own button pressed, waited for as Record Assurance is', async () => {
		const offering = recoveryRow(['rerun-declared-reviews', 'rerun-declared-rationale']);
		expect(await declaredRerunOffered(offering.row)).toBe(true);
		expect(offering.log).toEqual([`wait for the row visible ${PHASE7_UI_MS}`]);
		expect(await declaredRerunOffered(recoveryRow(['rerun-review']).row), 'another offer read as the declared re-run').toBe(false);
		const r = recoveryRow(['rerun-declared-reviews', 'rerun-declared-rationale']);
		expect((await rerunDeclared(r.page, r.row, decode, PHASE7_RECORD_ASSURANCE_MS)).envelopeType).toBe('success');
		expect([r.log, r.asked], 'the re-run was not typed, pressed, and waited for as Record Assurance is').toEqual([
			[`fill rerun-declared-rationale: ${DECLARED_RERUN_RATIONALE} (${PHASE7_UI_MS})`, `click rerun-declared-reviews (${PHASE7_UI_MS})`],
			[{ action: 'rerunDeclaredReviews', timeout: PHASE7_RECORD_ASSURANCE_MS }]
		]);
	});

	it('⛔ B3 — an abandonment on a row that does NOT carry its field fails, at its own bound, and presses nothing', async () => {
		const r = recoveryRow(['rerun-work']);
		await expect(recover(r.page, r.row, 'abandonPwu', decode)).rejects.toThrow(
			`locator.fill: Timeout ${PHASE7_UI_MS}ms exceeded waiting for abandon-rationale.`
		);
		expect([r.log, r.asked], 'something was pressed on a row that offers no abandonment').toEqual([[], []]);
	});
});

describe('⭐ D3 — the boot record', () => {
	it('⛔ keeps every JPWB_, RPH_ and PI_ variable, its prefix in ANY case — Windows finds `jpwb_agent` as JPWB_AGENT — and nothing else', () => {
		expect(INHERITED_PREFIXES).toEqual(['JPWB_', 'RPH_', 'PI_']);
		expect(
			inheritedVariables({
				JPWB_EXECUTOR: 'pi',
				jpwb_agent: 'mock',
				RPH_DEMO_MODE: 'server',
				PI_CODING_AGENT_DIR: 'D:/pi',
				PATH: '/bin',
				PIPELINE: 'x',
				JPWB_UNSET: undefined
			})
		).toEqual({
			JPWB_EXECUTOR: 'pi',
			PI_CODING_AGENT_DIR: 'D:/pi',
			RPH_DEMO_MODE: 'server',
			jpwb_agent: 'mock'
		});
	});

	it('⛔ a value whose name says it is a secret is kept as its length — and no variable the lane or the server reads is one', () => {
		expect(
			inheritedVariables({
				PI_OPENAI_API_KEY: 'sk-abcdef',
				JPWB_SERVICE_TOKEN: 'xyz',
				JPWB_SEED: 'empty'
			})
		).toEqual({
			JPWB_SEED: 'empty',
			JPWB_SERVICE_TOKEN: '(withheld: 3 characters)',
			PI_OPENAI_API_KEY: '(withheld: 9 characters)'
		});
		const read = [
			...OVERLAY_KEYS,
			'JPWB_ASSURANCE_TOOL',
			...Object.values(REVIEWER_MODEL_VARIABLE),
			'JPWB_EXECUTOR',
			'JPWB_EXECUTOR_MODEL',
			'JPWB_AGY_BIN',
			'JPWB_DEVIN_BIN',
			'JPWB_AGENT',
			'JPWB_AGENT_MODEL',
			'JPWB_REVIEW_SEES_PRIOR',
			'JPWB_LIVE_RUN_DIR',
			'JPWB_PHASE7_PAID',
			PHASE7_PRIOR_CALLS_VARIABLE,
			'PI_CODING_AGENT_DIR'
		];
		const kept = inheritedVariables(Object.fromEntries(read.map((name) => [name, 'value'])));
		expect(Object.entries(kept).filter(([, v]) => v !== 'value')).toEqual([]);
	});

	it('⭐ the overlay is the five keys the config lays over the shell for its server — ⭐ R3-C, PI_OFFLINE among them — read from the config’s source', () => {
		const config = parsed(CONFIG);
		const env = nodes(config, ts.isPropertyAssignment).find(
			(p) =>
				p.name.getText(config) === 'env' &&
				ts.isObjectLiteralExpression(p.initializer) &&
				ts.isPropertyAssignment(p.parent.parent) &&
				p.parent.parent.name.getText(config) === 'webServer'
		);
		const keys =
			env && ts.isObjectLiteralExpression(env.initializer)
				? env.initializer.properties
						.filter(ts.isPropertyAssignment)
						.map((p) => p.name.getText(config))
				: [];
		expect([...OVERLAY_KEYS]).toEqual(keys);
		expect(
			overlayOf({
				RPH_DEMO_MODE: 'server',
				JPWB_DEMO_DB: 'D:/run/demo.sqlite',
				JPWB_EXECUTOR: 'pi'
			})
		).toEqual({
			RPH_DEMO_MODE: 'server',
			JPWB_HARNESS: null,
			JPWB_SEED: null,
			JPWB_DEMO_DB: 'D:/run/demo.sqlite',
			PI_OFFLINE: null
		});
	});

	it('⛔ D8 — a paid run’s prior reviewer calls are a non-negative integer, or refused naming the variable and the limit', () => {
		for (const [given, read] of [
			['0', 0],
			[' 12 ', 12],
			['149', 149]
		] as const)
			expect(priorReviewerCalls({ [PHASE7_PRIOR_CALLS_VARIABLE]: given }), given).toBe(read);
		for (const given of ['-1', '1.5', '', 'twelve', '012', undefined]) {
			const refused = priorReviewerCalls({ [PHASE7_PRIOR_CALLS_VARIABLE]: given });
			expect(refused, String(given)).toBe(
				`${PHASE7_PRIOR_CALLS_VARIABLE}=${JSON.stringify(given ?? null)} is not a non-negative integer. A paid run counts ` +
					`the reviewer calls spent before it (P7-3a's) against the sponsor's limit of ${PHASE7_PAID_LIMIT} (design §6 ` +
					'P7-2 D8; REG-D-102 (4)): set it to that count, 0 if none were spent.'
			);
		}
	});

	it('⛔ the reviewer readied is devin, with its configured model — another wired tool is refused by a rule of THIS SPEC', () => {
		const variable = REVIEWER_MODEL_VARIABLE.devin;
		expect(
			reviewerUnderTest({ JPWB_ASSURANCE_TOOL: ' devin ', [variable]: ' glm-5-3-flash-max ' })
		).toEqual({
			model: 'glm-5-3-flash-max'
		});
		expect(
			reviewerUnderTest({ JPWB_ASSURANCE_TOOL: 'agy', [REVIEWER_MODEL_VARIABLE.agy]: 'm' })
		).toEqual({
			refusal:
				'JPWB_ASSURANCE_TOOL="agy" is refused by a rule of THIS SPEC: its readiness check is devin’s (design §6 ' +
				'P7-2 D3), and Phase 7 is measured with the selected reviewer, devin (REG-D-119, REG-D-102).'
		});
		expect(reviewerUnderTest({ JPWB_ASSURANCE_TOOL: 'devin', [variable]: '  ' })).toEqual({
			refusal: `${variable} is not set.`
		});
	});
});

/** A runner that answers each program call from `answers`, by its arguments, and records each call. */
function scripted(
	answers: Record<string, { exitCode: number | null; stdout?: string; failure?: string }>
) {
	const calls: [string, readonly string[], number][] = [];
	const run: ProgramRunner = async (program, args, timeoutMs) => {
		calls.push([program, args, timeoutMs]);
		const a = answers[args.join(' ')] ?? { exitCode: 1 };
		return {
			exitCode: a.exitCode,
			stdout: a.stdout ?? '',
			stderr: '',
			failure: a.failure ?? null
		};
	};
	return { run, calls };
}
const READY = {
	'--version': { exitCode: 0, stdout: 'devin 3000.6.14\n' },
	'models list': {
		exitCode: 0,
		stdout: 'GLM-5.3 Flash Max   glm-5-3-flash-max\nGLM-5.3 Flash High   glm-5-3-flash-high\nGPT 5   gpt-5\n'
	}
};

describe('⭐ D3 — devin’s readiness: its version and its model list, the configured model in it, no model called', () => {
	it('⛔ ready: `devin --version` and `devin models list` both exit 0, and the list names the configured model whole', async () => {
		const r = scripted(READY);
		const ready = await reviewerReadiness('glm-5-3-flash-max', r.run);
		expect(r.calls).toEqual([
			[DEVIN_PROGRAM, ['--version'], READINESS_CALL_MS],
			[DEVIN_PROGRAM, ['models', 'list'], READINESS_CALL_MS]
		]);
		expect(ready.modelsList.listed).toBe(true);
		expect(readinessRefusals(ready)).toEqual([]);
	});

	it('⛔ a list that names only a longer id does not list the model, and the refusal names the model and its variable', async () => {
		const r = scripted({
			'--version': { exitCode: 0 },
			'models list': { exitCode: 0, stdout: 'glm-5-3-flash-max-preview\n' }
		});
		expect(readinessRefusals(await reviewerReadiness('glm-5-3-flash-max', r.run))).toEqual([
			`\`devin models list\` does not list "glm-5-3-flash-max", the model ${REVIEWER_MODEL_VARIABLE.devin} ` +
				'configures: the account offers no such model, or it is spelt otherwise (its output is in lane/boot.json)'
		]);
	});

	it('⭐ a devin that cannot start, or exits otherwise, is refused in its own words', async () => {
		const r = scripted({
			'--version': { exitCode: null, failure: 'spawn devin ENOENT' },
			'models list': { exitCode: 2, stdout: 'glm-5-3-flash-max' }
		});
		expect(readinessRefusals(await reviewerReadiness('glm-5-3-flash-max', r.run))).toEqual([
			'`devin --version` spawn devin ENOENT',
			'`devin models list` exited 2'
		]);
	});

	it('⭐ a whole id only: colour codes dropped, a prefix or a suffix never enough, a blank model never listed', () => {
		const esc = String.fromCodePoint(27);
		expect(modelListed(`${esc}[32mglm-5-3-flash-max${esc}[0m  ready`, 'glm-5-3-flash-max')).toBe(
			true
		);
		expect(modelListed('xglm-5-3-flash-max', 'glm-5-3-flash-max')).toBe(false);
		expect(modelListed('glm-5-3-flash-max-preview', 'glm-5-3-flash-max')).toBe(false);
		expect(modelListed('| openai/gpt-5.6 |', 'openai/gpt-5.6')).toBe(true);
		expect(modelListed('anything', '  ')).toBe(false);
	});

	it('⛔ the real runner: an exit code as the program gave it, a program that never started named, and one that outlasted its bound killed', async () => {
		const exited = await execFileRunner(
			process.execPath,
			['-e', 'process.stdout.write("out"); process.exit(3)'],
			30_000
		);
		expect(exited).toEqual({ exitCode: 3, stdout: 'out', stderr: '', failure: null });
		const missing = await execFileRunner(join(ROOT, 'no-such-program'), [], 30_000);
		expect([missing.exitCode, missing.failure]).toEqual([null, expect.stringContaining('ENOENT')]);
		const started = Date.now();
		const slow = await execFileRunner(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], 300);
		expect([slow.exitCode, slow.failure]).toEqual([
			null,
			'killed after 300 ms: it did not finish within its bound'
		]);
		expect(Date.now() - started).toBeLessThan(15_000);
	});
});

describe('⭐ D3 — the boot: what the run starts from, and EVERY reason it may not go on, at once', () => {
	/** A paid Phase 7 run's keys, as the selected arrangement sets them (~~REG-D-084~~ ⭐ REG-D-119), its run folder named. */
	const keys = {
		JPWB_EXECUTOR: 'pi',
		JPWB_EXECUTOR_MODEL: 'openai-codex/gpt-5.6-sol',
		JPWB_ASSURANCE_TOOL: 'devin',
		[REVIEWER_MODEL_VARIABLE.devin]: 'glm-5-3-flash-high',
		[LIVE_RUN_DIR_VARIABLE]: 'D:/runs/phase7-1',
		[PHASE7_PAID_VARIABLE]: '1'
	};

	it('⭐ a clean boot refuses nothing, and writes down the overlay, the readiness and the prior calls', async () => {
		const store = join(folder('clean-boot'), 'demo.sqlite');
		writeFileSync(store, '');
		const boot = await bootOf({
			paid: true,
			env: { ...keys, [PHASE7_PRIOR_CALLS_VARIABLE]: '3' },
			serverEnv: {
				RPH_DEMO_MODE: 'server',
				JPWB_HARNESS: '1',
				JPWB_SEED: 'empty',
				JPWB_DEMO_DB: store
			},
			store,
			run: scripted(READY).run
		});
		expect(boot.refusals).toEqual([]);
		expect(boot.prior).toBe(3);
		expect([
			boot.record.mode,
			boot.record.overlay.JPWB_DEMO_DB,
			boot.record.readiness?.modelsList.listed,
			boot.record.inherited.JPWB_ASSURANCE_TOOL
		]).toEqual(['paid', store, true, 'devin']);
	});

	it('⛔ devin not ready, a paid run with no prior count, the server’s store elsewhere and none made in the run folder — each refused, all at once', async () => {
		const store = join(folder('refused-boot'), 'demo.sqlite');
		const boot = await bootOf({
			paid: true,
			env: keys,
			serverEnv: { JPWB_DEMO_DB: 'D:/elsewhere/demo.sqlite' },
			store,
			run: scripted({ ...READY, '--version': { exitCode: null, failure: 'spawn devin ENOENT' } })
				.run
		});
		expect(boot.refusals).toEqual([
			'`devin --version` spawn devin ENOENT',
			priorReviewerCalls({}),
			`the server keeps its store at D:/elsewhere/demo.sqlite, not in the run folder, at ${store}`,
			`${store} does not exist: the server made no store in the run folder`
		]);
		expect(boot.record.refusals).toEqual(boot.refusals);
	});
});

// ── THE STORE, AS THE RUN READS IT (`REG-F-540`) ────────────────────────────────────────────────────────────────────

const unitState = (
	lifecycleState: string,
	executionState: string,
	assuranceState: string,
	planStepState: string | null
): UnitState => ({ lifecycleState, executionState, assuranceState, planStepState });
/** What Begin & Execute leaves a unit that completed — the root's TRANSFORMATION too — and one that stopped (K1). */
const COMPLETED = unitState('EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'SUCCEEDED');
const STOPPED = unitState('EXECUTING', 'RUNNING', 'UNASSESSED', 'RUNNING');
/** ⭐ P7-6R R-1b — a phase the floor refused, WAITING for a person's choice. */
const WAITING = unitState('EXECUTING', 'WAITING', 'UNASSESSED', 'WAITING');
/** ⭐ P7-6R R-1c — a waiting phase abandoned: its step cancelled. */
const ABANDONED = unitState('ABANDONED', 'WAITING', 'UNASSESSED', 'CANCELLED');
const ASSURED = unitState('UNDER_ASSURANCE', 'SUCCEEDED', 'SATISFIED', 'SUCCEEDED');
/** ⭐ `E12F` F3 — left under assessment by a declared review that did not conclude (`REG-D-112` (a)). */
const ASSESSING = unitState('UNDER_ASSURANCE', 'SUCCEEDED', 'ASSESSING', 'SUCCEEDED');
const SATISFIED = unitState('SATISFIED', 'SUCCEEDED', 'SATISFIED', 'SUCCEEDED');

describe('⭐ the store, as the run reads it after every act (REG-F-540)', () => {
	it('⛔ a unit’s axes and its LAST plan’s step — each field one the product’s contract declares', () => {
		// ⭑ HELD TO THE PRODUCT: each name read here is a field of the object the dump carries.
		expect(Object.keys(ProfessionalWorkUnitSchema.shape)).toEqual(
			expect.arrayContaining([
				'title',
				'undertakingId',
				'workLifecycleState',
				'executionState',
				'assuranceState'
			])
		);
		expect(Object.keys(ExecutionPlanSchema.shape)).toEqual(
			expect.arrayContaining(['workUnitId', 'steps'])
		);
		expect(Object.keys(ExecutionStepSchema.shape)).toContain('stepState');
		const snap = {
			pwus: [
				{
					id: 'pwu_1',
					state: {
						workLifecycleState: 'EXECUTING',
						executionState: 'SUCCEEDED',
						assuranceState: 'UNASSESSED'
					}
				},
				{ id: 'pwu_2', state: { workLifecycleState: 'PROPOSED' } }
			],
			executionPlans: [
				{ id: 'pln_a', state: { workUnitId: 'pwu_1', steps: [{ stepState: 'FAILED' }] } },
				{ id: 'pln_b', state: { workUnitId: 'pwu_9', steps: [{ stepState: 'RUNNING' }] } },
				{
					id: 'pln_c',
					state: {
						workUnitId: 'pwu_1',
						steps: [{ stepState: 'QUEUED' }, { stepState: 'SUCCEEDED' }]
					}
				}
			]
		} as unknown as EngineSnapshot;
		expect(unitStateOf(snap, 'pwu_1')).toEqual(COMPLETED);
		expect(unitStateOf(snap, 'pwu_2')).toEqual({
			lifecycleState: 'PROPOSED',
			executionState: null,
			assuranceState: null,
			planStepState: null
		});
	});

	it('⛔ D8 — the reviewer calls the store records: EVERY ASSURANCE exchange, thrown and retried ones among them, and no try', () => {
		expect(ModelExchangeSchema.shape.plane.options).toContain('ASSURANCE');
		const exchange = (plane: string, exchangeRole: string, disposition: string) => ({
			id: `mx_${plane}_${exchangeRole}_${disposition}`,
			state: { plane, exchangeRole, disposition }
		});
		const snap = {
			modelExchanges: [
				exchange('EXECUTION', 'INITIAL', 'ACCEPTED'),
				exchange('ASSURANCE', 'INITIAL', 'NO_RESPONSE'),
				exchange('ASSURANCE', 'RETRY', 'ACCEPTED'),
				exchange('ASSURANCE', 'INITIAL', 'REJECTED')
			],
			evidence: [],
			artifacts: []
		} as unknown as EngineSnapshot;
		expect(recordedReviewerCalls(snap), 'the limit counted something other than every call').toBe(
			3
		);
	});
});

/**
 * ~~⭐ R3-B's fix round, F1 — WHAT THE ONE RULE COUNTS BEFORE A PHASE, AND BEFORE THE RULE'S RE-RUN OF ITS WORK: a model unit's
 * worst case, each try's review and each reviewed command's, (3 + 32) × 4 = 140; AND BEFORE THE RULE'S RE-RUN OF A STOPPED
 * PHASE'S REVIEW: a re-review's worst case, (1 + 32) × 4 = 132.~~ ⛔ `REG-D-114` (14), as amended 2026-10-16: a phase's whole
 * worst case would refuse every phase once about 306 calls are spent ⭐ (at the limit of 450; ~~at today's 600, once 456 are:
 * 600, less the 4 held back and the phase's 140~~ ~~⭐ at today's 650, once 506 are: 650, less the 4 held back and the
 * phase's 140, P6 package L, F1; `REG-D-120` Q15~~ ~~⭐ at today's 800, once 656 are: 800, less the 4 held back and the
 * phase's 140, package Q, F5; `REG-D-123` Q26~~ ~~⭐ at today's 900, once 756 are: 900, less the 4 held back and the
 * phase's 140, the review in parts, package C, B6; `REG-D-126` Q32~~ ⭐ at today's 1000, once 856 are: 1000, less the 4 held
 * back and the phase's 140, the review in parts, package I, B8b; `REG-D-131` Q37).
 * ~~⭐ `REG-D-114` (14), as amended 2026-10-16 — WHAT THE ONE RULE COUNTS BEFORE A PHASE, BEFORE THE RULE'S RE-RUN OF ITS WORK OR
 * OF ITS REVIEW, AND BEFORE A MODEL ROOT'S PRESS: ONE TRY'S RESERVE, a review of up to `reviewerCallsPerTry` calls — 4, D8's
 * own rule: the lane checks the limit again before every later press.~~ ⛔ SUPERSEDED BY THE SPONSOR'S RULING (`REG-D-135` (4),
 * Q44; design D16): a press's own spend carried the total past the limit, for nothing checked it during the press.
 * ⭐⭐ `JAN-EXEC` Phase 7, package L — D16 — WHAT THE ONE RULE COUNTS BEFORE EACH PRESS: THE PRESS'S WHOLE WORST CASE. Before a
 * phase's Begin & Execute, the rule's re-run of its work and a MODEL root's press, (3 tries + 32 retained command runs) × 6
 * calls = 210; before the rule's re-run of a stopped phase's review, its refused reviews × 6 — and where the store names none
 * (these hands' store holds no review), every review the stopped attempt holds, (1 work product + 32 command runs) × 6 = 198.
 * ⛔ Restated, never read from the lane, so a figure the lane moved fails here.
 */
const WHOLE_PRESS = (3 + 32) * 6;
/** ⭐ D16 — a re-run of a stopped phase's review whose refused reviews the store cannot name: the attempt's every review. */
const REREVIEW_UNREAD = (1 + 32) * 6;
/** ⭐ D16 — what a check says it counted ahead of its act (`LimitCheck.counted`), restated. ~~'one try’s reserve'~~ */
const COUNTED_PRESS = 'its whole press’s worst case, (3 tries + 32 command runs) × 6 calls';
const COUNTED_REREVIEW_UNREAD =
	'its refused reviews’ worst case — the store names none, so every review the attempt holds, (1 work product + 32 command runs) × 6 calls';
const COUNTED_SIGN_OFF = 'its declared reviews’ worst case';

// ⭐⭐ `JAN-EXEC` Phase 7, package L — D16 (`REG-D-135` (4); design D16): before the rule's re-run of a stopped phase's REVIEW the
// lane counts the refused reviews it re-runs × 6 — the server re-runs only those (`rerunReview`, `stoppedUnitOf`'s refusals):
// the stopped attempt's work product and each of its command evidence whose floor is not SATISFIED. Read from the dump as the
// server reads the store; where it names no stopped attempt, NONE — the caller then counts every review the attempt can hold.
describe('⭐⭐ package L — D16: the refused reviews a re-run of a stopped phase’s review re-runs, read from the store', () => {
	const FLOOR = ['floor.schema-invariant', 'floor.identity-provenance', 'floor.reasoning-review'];
	/** The three floor policies' assessments over `subject`, every one SATISFIED but `refusedBy`'s, at `at`. */
	const floorOver = (subject: string, at: string, refusedBy?: string) =>
		FLOOR.map((policy, i) => ({
			id: `asmt_${subject}_${i}_${at}`,
			state: {
				subjectObjectIds: [subject],
				assurancePolicyId: policy,
				assessmentState: policy === refusedBy ? 'INCONCLUSIVE' : 'SATISFIED',
				updatedAt: at
			}
		}));
	/** A unit whose plan's step waits on attempt `step_1#2`, an earlier attempt's work product beside it. */
	const stopped = (stepType = 'MODEL_GENERATION', over: { assessments?: unknown[] } = {}) =>
		({
			executionPlans: [
				{
					id: 'pln_1',
					state: {
						workUnitId: 'pwu_r',
						status: 'ACTIVE',
						steps: [
							{
								id: 'step_1',
								stepType,
								stepState: 'WAITING',
								inputBindings: stepType === 'ASSURANCE_INVOCATION' ? [{ artifactId: 'art_2', required: true }] : []
							}
						]
					}
				}
			],
			artifacts: [
				{ id: 'art_1', state: { producingExecutionAttemptId: 'step_1#1' } },
				{ id: 'art_2', state: { producingExecutionAttemptId: 'step_1#2' } }
			],
			evidence: [
				{ id: 'evd_old', state: { contentReference: { producingExecutionAttemptId: 'step_1#1' } } },
				{ id: 'evd_a', state: { contentReference: { producingExecutionAttemptId: 'step_1#2' } } },
				{ id: 'evd_b', state: { contentReference: { producingExecutionAttemptId: 'step_1#2' } } }
			],
			assessments: over.assessments ?? [
				...floorOver('art_1', '2026-10-25T10:00:00.000Z', 'floor.reasoning-review'),
				...floorOver('evd_old', '2026-10-25T10:00:00.000Z', 'floor.reasoning-review'),
				// The stopped attempt: its work product refused, one command clean, one refused and then — later — still refused.
				...floorOver('art_2', '2026-10-25T11:00:00.000Z', 'floor.reasoning-review'),
				...floorOver('evd_a', '2026-10-25T11:00:00.000Z'),
				...floorOver('evd_b', '2026-10-25T11:00:00.000Z'),
				...floorOver('evd_b', '2026-10-25T11:30:00.000Z', 'floor.reasoning-review')
			]
		}) as unknown as EngineSnapshot;

	it('⭐ the stopped attempt’s work product and command evidence whose LATEST floor is not SATISFIED — never an earlier attempt’s, never a satisfied one', () => {
		// art_2 (refused) and evd_b (its latest assessment refused); evd_a is SATISFIED; art_1 and evd_old are attempt 1's.
		expect(refusedReviewsOf(stopped(), 'pwu_r')).toBe(2);
	});

	it('⭐ a re-review’s waiting step names its work product as its input: the same attempt, the same refusals', () => {
		expect(refusedReviewsOf(stopped('ASSURANCE_INVOCATION'), 'pwu_r')).toBe(2);
	});

	it('⛔ a floor policy with NO assessment leaves the subject refused: MISSING is not SATISFIED', () => {
		const partial = stopped('MODEL_GENERATION', {
			assessments: [
				...floorOver('art_2', '2026-10-25T11:00:00.000Z'),
				...floorOver('evd_a', '2026-10-25T11:00:00.000Z'),
				...floorOver('evd_b', '2026-10-25T11:00:00.000Z').filter((a) => a.state.assurancePolicyId !== 'floor.identity-provenance')
			]
		});
		expect(refusedReviewsOf(partial, 'pwu_r')).toBe(1);
	});

	it('⛔ no stopped attempt in the store — no waiting step, or no work product of it — and it names NONE (undefined), never zero', () => {
		const none = { ...stopped(), executionPlans: [] } as unknown as EngineSnapshot;
		expect(refusedReviewsOf(none, 'pwu_r')).toBeUndefined();
		const noWork = { ...stopped(), artifacts: [] } as unknown as EngineSnapshot;
		expect(refusedReviewsOf(noWork, 'pwu_r')).toBeUndefined();
		expect(refusedReviewsOf(stopped(), 'pwu_other')).toBeUndefined();
	});

	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package N's check, finding 4 (design D9, D16) — ONE ATTEMPT, TWO TRIES: each try records its own work
	 * product (RD6) and each try's runs are joined in the try, each evidence naming its try (`producingTry`). The stop is the
	 * refused try's — the try that made the attempt's last work product — as `stoppedUnitOf` reads it, and `rerunReview`
	 * re-runs that try's refused floors alone. `tryOne` is how try 1's command names its try: by number, or not at all.
	 */
	const twoTries = (tryOne: 'named' | 'unnamed' = 'named') =>
		({
			...stopped(),
			artifacts: [
				{ id: 'art_t1', state: { producingExecutionAttemptId: 'step_1#1' } },
				{ id: 'art_t2', state: { producingExecutionAttemptId: 'step_1#1' } }
			],
			evidence: [
				{
					id: 'evd_t1',
					state: { contentReference: { producingExecutionAttemptId: 'step_1#1', ...(tryOne === 'named' ? { producingTry: 1 } : {}) } }
				},
				{ id: 'evd_t2', state: { contentReference: { producingExecutionAttemptId: 'step_1#1', producingTry: 2 } } }
			],
			assessments: [
				// Try 1: its command refused (its finding went back to the model); try 2: its work product and its command refused.
				...floorOver('art_t1', '2026-10-25T10:00:00.000Z'),
				...floorOver('evd_t1', '2026-10-25T10:00:00.000Z', 'floor.reasoning-review'),
				...floorOver('art_t2', '2026-10-25T11:00:00.000Z', 'floor.reasoning-review'),
				...floorOver('evd_t2', '2026-10-25T11:00:00.000Z', 'floor.reasoning-review')
			]
		}) as unknown as EngineSnapshot;

	it('⛔ package N’s check, finding 4 — a two-try attempt: the REFUSED TRY’s reviews alone, as the server re-runs them — never an earlier try’s', () => {
		// ⛔ RED BEFORE, driven: 3 — every refused command evidence of the attempt, try 1's among them, which `stoppedUnitOf`
		// leaves out and `rerunReview` never re-runs: D16's "refused reviews being re-run × 6" over-counted by one review.
		expect(refusedReviewsOf(twoTries(), 'pwu_r'), 'try 1’s refused command was counted as one the re-run re-runs').toBe(2);
	});

	it('⭑ package N’s check, finding 4 CONTROL — a command naming no try (joined after the loop, before package N) is the attempt’s, as the server reads it', () => {
		expect(refusedReviewsOf(twoTries('unnamed'), 'pwu_r')).toBe(3);
	});
});

describe('⭐ D8 — the limit, and D5 — what the run records of each unit', () => {
	// ⭐ P7-6R — the limit is 200 since `REG-D-105` (1), which amends `REG-D-102` (4)'s 150.
	// ⭑ `REG-D-108` — THE ARITHMETIC IS READ AGAINST THE LIMIT, NOT A COPY OF IT. These cases pinned 200 and went red when the
	// sponsor raised the limit to 230; what they hold is the boundary (one under starts, the limit does not), which a
	// typed number only restates. The limit's VALUE is pinned once, against the register (`live-exec-lane-config.test.ts`).
	// ⭐⭐ ONE RULE (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (14)) — ~~prior + recorded + the reserve
	// must total UNDER the sponsor's limit: one under it starts a phase, the limit does not~~: prior + recorded + the reserve +
	// what the act counts must total AT MOST the limit. ~~Before a phase the act counts its first call, so a phase starts with
	// exactly that call left — the same phases as before — and the record says so.~~ ~~⭐ R3-B's fix round (F1): before a phase
	// the act counts its worst case, a model unit's, so a phase starts only with that many calls left under the limit.~~
	// ⭐ `REG-D-114` (14), as amended 2026-10-16: before a phase the act counts one try's reserve, so a phase starts while one
	// try's review still fits — and the record says what it counted.
	// ⭐ Package L — D16 (`REG-D-135` (4)): ~~a phase starts with one try’s reserve reaching it~~ — with its WHOLE PRESS reaching it.
	it('⛔ ONE RULE — prior + recorded + the reserve + what the act counts must total AT MOST the sponsor’s limit: a phase starts with its whole press reaching it, not past it', () => {
		const L = PHASE7_PAID_LIMIT;
		expect(PHASE7_NEGATIVE_CONTROL_RESERVE).toBe(4);
		expect(limitCheck(L - 4 - WHOLE_PRESS - 45, 45, WHOLE_PRESS, COUNTED_PRESS)).toEqual({
			prior: L - 4 - WHOLE_PRESS - 45,
			recorded: 45,
			reserve: 4,
			ahead: WHOLE_PRESS,
			counted: COUNTED_PRESS,
			total: L,
			limit: L,
			allowed: true
		});
		expect(limitCheck(L - 4 - WHOLE_PRESS - 45, 46, WHOLE_PRESS, COUNTED_PRESS).allowed).toBe(false);
		expect(limitCheck(0, L - 4 - WHOLE_PRESS + 1, WHOLE_PRESS, COUNTED_PRESS).allowed).toBe(false);
		// ⭑ The rule is the same for every act, whatever it counts: at the limit let through, one past it held back.
		expect([limitCheck(L - 20, 0, 16, COUNTED_SIGN_OFF).allowed, limitCheck(L - 20, 1, 16, COUNTED_SIGN_OFF).allowed, limitCheck(L - 4, 0, 0, 'none: it runs no model').allowed]).toEqual([
			true,
			false,
			true
		]);
	});

	const state = (executionState: string, planStepState: string): UnitState => ({
		lifecycleState: 'EXECUTING',
		executionState,
		assuranceState: 'UNASSESSED',
		planStepState
	});

	it('⛔ a unit stopped unless its press was accepted AND the store reads its execution and its step SUCCEEDED (REG-F-540)', () => {
		expect(stoppedAfter('success', state('SUCCEEDED', 'SUCCEEDED'))).toBe(false);
		expect(stoppedAfter('failure', state('RUNNING', 'RUNNING'))).toBe(true);
		expect(
			stoppedAfter('success', state('RUNNING', 'SUCCEEDED')),
			'the envelope alone is not the record'
		).toBe(true);
		expect(stoppedAfter('success', state('SUCCEEDED', 'RUNNING'))).toBe(true);
		expect(stoppedAfter(null, state('SUCCEEDED', 'SUCCEEDED')), 'a press with no answer').toBe(
			true
		);
	});

	// ⛔ MOVED 2026-10-25 (`JAN-EXEC` Phase 7, package M; `REG-D-135` (2); design D6, which names it) — ~~"D5 — a phase ran on an
	// unassured upstream when an EARLIER PHASE stopped; the root is their parent, not their upstream"~~: the old rule read ANY
	// earlier phase's stop (`upstreamNotAssured(units, order)`), so an unrelated stop marked a unit whose own producers were
	// accepted. Its expectations, struck: root stopped -> requirements false; requirements fine -> design false; design
	// stopped -> design false (not its own upstream), implementation and end-to-end TRUE. Restated below on the unit's OWN
	// producers, read from the store.
	it('⭐ THE PREDICTED RED (D6) — `upstreamNotAssured` reads the unit’s OWN producers: false when they are accepted and an UNRELATED unit stopped; true when one of its own is not accepted', () => {
		const snap = (states: Readonly<Record<string, string>>, waits: Readonly<Record<string, string[]>>): EngineSnapshot =>
			({
				pwus: Object.entries(states).map(([id, workLifecycleState]) => ({
					id,
					state: { objectType: 'PROFESSIONAL_WORK_UNIT', workLifecycleState, dependencyIds: waits[id] ?? [] }
				}))
			}) as unknown as EngineSnapshot;
		// The consumer's producer is SATISFIED; an unrelated phase STOPPED (still EXECUTING, waiting).
		const s = snap({ producer: 'SATISFIED', unrelated: 'EXECUTING', consumer: 'PROPOSED' }, { consumer: ['producer'] });
		expect(upstreamNotAssured(s, 'consumer'), 'an unrelated stop marked a unit whose own producer is accepted').toBe(false);
		// ⭑ THE PAIR: its own producer not accepted — EXECUTING, CONDITIONALLY_SATISFIED, ABANDONED — reads true.
		for (const state of ['EXECUTING', 'CONDITIONALLY_SATISFIED', 'ABANDONED'])
			expect(
				upstreamNotAssured(snap({ producer: state, consumer: 'PROPOSED' }, { consumer: ['producer'] }), 'consumer'),
				`its own producer ${state}`
			).toBe(true);
		// ⭑ RECOMPOSED and BASELINED are accepted, as SATISFIED is; a unit that waits for nothing has no upstream to fault.
		for (const state of ['RECOMPOSED', 'BASELINED'])
			expect(upstreamNotAssured(snap({ producer: state, consumer: 'PROPOSED' }, { consumer: ['producer'] }), 'consumer')).toBe(false);
		expect(upstreamNotAssured(snap({ alone: 'PROPOSED' }, {}), 'alone')).toBe(false);
	});

	it('⭐ each unit starts unpressed: no id, no press, no state — `null`, never a `false` that reads as “it ran”', () => {
		expect(unpressed(PHASE7_ARCHIVE_UNITS)[1]).toEqual({
			order: 2,
			slug: 'requirements',
			title: 'Requirements',
			unitId: null,
			archive: '02-requirements',
			beginExecute: null,
			after: null,
			stopped: null,
			upstreamNotAssured: null,
			limitCheck: null,
			recovery: [],
			signOff: null,
			// ⭐ Package M (D4, D6) — and why it was never pressed, null until the run says.
			notStarted: null
		});
	});
});

// ── THE RUN ITSELF, ON HANDS MADE HERE ───────────────────────────────────────────────────────────────────────────────

const answered = (envelopeType: EnvelopeType, status = 200): ActionOutcome => ({
	status,
	envelopeType,
	rawBody: `{"type":"${envelopeType}"}`,
	decoded: {},
	timedOutAfterMs: null,
	requestFailure: null
});
/**
 * ⭐ E12's re-review F1 — what the run record keeps of a sign-off act that was answered (`answered`), and the store after it;
 * ⭐ F4 — with its refusal, in the server's words, when it was not accepted.
 */
const actAnswered = (envelopeType: EnvelopeType, after: UnitState): SignOffAct => ({
	status: 200,
	envelopeType,
	timedOutAfterMs: null,
	requestFailure: null,
	refusal: envelopeType === 'success' ? null : `{"type":"${envelopeType}"}`,
	after
});
const OUTLASTED: ActionOutcome = {
	status: null,
	envelopeType: null,
	rawBody: null,
	decoded: null,
	timedOutAfterMs: PHASE7_UNIT_ALLOWANCE_MS,
	requestFailure: null
};
const LOST_IN_TRANSIT: ActionOutcome = {
	...OUTLASTED,
	timedOutAfterMs: null,
	requestFailure: 'net::ERR_EMPTY_RESPONSE'
};

interface Script {
	readonly paid: boolean;
	readonly prior?: number;
	readonly refusals?: readonly string[];
	/** Each unit's press, by slug: what came back, the store after it, and the reviewer calls it recorded. */
	readonly presses: Readonly<
		Record<string, { outcome: ActionOutcome; after: UnitState; calls?: number }>
	>;
	/**
	 * Each unit's sign-off, by slug: Record Assurance (null: not offered), Mark Satisfied, and the store after each — and
	 * `calls`, the model calls Record Assurance recorded: ~~a sign-off calls no model (D11)~~ ⛔ `E12F` F1: since E2 it asks
	 * the reviewer for one review per declared policy, so a dry run must never press it, and the limit counts what it did.
	 */
	readonly signOffs?: Readonly<
		Record<
			string,
			{
				ra: ActionOutcome | null;
				raAfter?: UnitState;
				ms?: ActionOutcome;
				msAfter?: UnitState;
				calls?: number;
				/**
				 * ⭐ `E12F` F3 — after a refused Record Assurance: whether the row offers re-running the declared reviews that did
				 * not conclude, and what the re-run came to — its answer, the store after it, the reviewer calls it recorded.
				 */
				rerun?: { offered: boolean; outcome?: ActionOutcome; after?: UnitState; calls?: number };
			}
		>
	>;
	/** The model exchanges the store holds besides reviews: a dry run's must be none. */
	readonly executorExchanges?: number;
	/**
	 * ⭐ Package L — D16 (`REG-D-135` (4)) — the units, by slug, whose store NAMES their stopped attempt's refused reviews, and how
	 * many: the unit's last plan ACTIVE with its step's id and type, the attempt's work product and `n − 1` command evidence, and
	 * each one's floor recorded INCONCLUSIVE (`refusedReviewsOf` reads them as the server does). A unit not named holds none, as
	 * these hands' store always did — so the lane counts every review the attempt could hold.
	 */
	readonly refusedReviews?: Readonly<Record<string, number>>;
	/** The unit titles the setup reads: the five, unless said. */
	readonly titles?: readonly string[];
	/** The read, counted from 1, that throws as a server gone would. */
	readonly readThrowsAt?: number;
	/**
	 * ⭐ E12's polish (fix3's F1) — the unit, by slug, whose Mark Satisfied hand throws before it presses, as its wait for
	 * Record Assurance to leave the row does at its bound (`markSatisfied`).
	 */
	readonly markSatisfiedThrowsOn?: string;
	/**
	 * ⭐ P7-6R R-1f — what each unit's row offers after a stop, by slug, and what each recovery act came to: the answer, the
	 * store after it, and the reviewer calls it recorded. A unit not named offers no re-run.
	 */
	readonly recoveries?: Readonly<
		Record<
			string,
			{
				readonly offers: RecoveryOffers;
				/**
				 * ⭐ P7-6 B3 — what the row offers when it is read again, after a re-run; the first offers, unless said. A unit
				 * no longer WAITING offers no abandonment's field (`+page.svelte`).
				 */
				readonly offersAfter?: RecoveryOffers;
				/**
				 * ⭐ P7-6 B3 — `newPlan`: whether the act's server answer DISPATCHED a plan revision, so the store holds a new
				 * plan B (RD5). A re-run does, unless the server refused it before dispatching anything (`false`); an
				 * abandonment never does.
				 */
				readonly acts?: Partial<
					Record<
						RecoveryAct,
						{ outcome: ActionOutcome; after: UnitState; calls?: number; newPlan?: boolean }
					>
				>;
			}
		>
	>;
}

/**
 * ⭐ Package L — D16 — the store a named unit's stopped attempt leaves (`Script.refusedReviews`): attempt `step_pwu_<slug>_1#1`'s
 * work product, `n − 1` command evidence, and each one's three floor policies recorded, the review INCONCLUSIVE — the refusals
 * the server's `rerunReview` re-runs (`stoppedUnitOf`).
 */
function refusedStore(named: Readonly<Record<string, number>>) {
	const artifacts: ObjectRowLike[] = [];
	const evidence: ObjectRowLike[] = [];
	const assessments: ObjectRowLike[] = [];
	for (const [slug, n] of Object.entries(named)) {
		const attempt = `step_pwu_${slug}_1#1`;
		const subjects = [`art_${slug}`, ...Array.from({ length: n - 1 }, (_, k) => `evd_${slug}_${k + 1}`)];
		artifacts.push({ id: subjects[0]!, state: { producingExecutionAttemptId: attempt } });
		for (const id of subjects.slice(1)) evidence.push({ id, state: { contentReference: { producingExecutionAttemptId: attempt } } });
		for (const subject of subjects)
			for (const policy of ['floor.schema-invariant', 'floor.identity-provenance', 'floor.reasoning-review'])
				assessments.push({
					id: `asmt_${subject}_${policy}`,
					state: {
						subjectObjectIds: [subject],
						assurancePolicyId: policy,
						assessmentState: policy === 'floor.reasoning-review' ? 'INCONCLUSIVE' : 'SATISFIED',
						updatedAt: '2026-10-25T11:00:00.000Z'
					}
				});
	}
	return { artifacts, evidence, assessments };
}
type ObjectRowLike = { readonly id: string; readonly state: Record<string, unknown> };

/** A run folder of its own, a store made here, and the hands the run uses, each call logged in order. */
function laneOf(script: Script) {
	const lane = openLane(folder('lane'));
	const calls: string[] = [];
	/** ⭐ R3-B F2 — each sign-off press the lane asked for, and the bound it gave it. */
	const bounds: [string, number | undefined][] = [];
	const archives: ArchiveCall[] = [];
	const store = new Map<string, UnitState>();
	/** ⭐ P7-6 B3 — each unit's plans: a re-run supersedes the last, whose step it cancels, and adds plan B (RD5). */
	const plans = new Map<string, number>();
	const recoveryReads = new Map<string, number>();
	const idOf = (slug: string) => `pwu_${slug}`;
	let reviewerCallCount = 0;
	let reads = 0;
	let onDisk: RunRecord | null = null;
	let onDiskAtMarkSatisfied: RunRecord | null = null;
	const snapshot = (): EngineSnapshot =>
		({
			undertakings: [{ id: 'und_1', state: { name: PHASE7_UNDERTAKING.name } }],
			pwus: PHASE7_ARCHIVE_UNITS.map((u) => {
				const s = store.get(idOf(u.slug));
				return {
					id: idOf(u.slug),
					state: {
						// ⭐ Package M (`REG-D-135` (2); design D1, D7) — what instantiation records of §3.2's PWA, which declares no
						// data flow: the root waits for its four phases, and each phase for nothing.
						objectType: 'PROFESSIONAL_WORK_UNIT',
						title: u.title,
						undertakingId: 'und_1',
						dependencyIds: u.slug === 'root' ? PHASE7_ARCHIVE_UNITS.slice(1).map((p) => idOf(p.slug)) : [],
						inputRequirements: [],
						workLifecycleState: s?.lifecycleState ?? 'PROPOSED',
						executionState: s?.executionState ?? 'NOT_STARTED',
						assuranceState: s?.assuranceState ?? 'UNASSESSED'
					}
				};
			}),
			executionPlans: [...store].flatMap(([id, s]) =>
				s.planStepState === null
					? []
					: Array.from({ length: plans.get(id) ?? 1 }, (_, i) => {
							const last = i === (plans.get(id) ?? 1) - 1;
							// ⭐ D16 — a unit whose store names its refused reviews: its plans as the server's store holds them.
							const named = script.refusedReviews?.[id.slice('pwu_'.length)] !== undefined;
							return {
								id: i === 0 ? `pln_${id}` : `pln_${id}_${i + 1}`,
								// A superseded plan's step was cancelled with it; the last plan's is the unit's.
								state: {
									workUnitId: id,
									...(named ? { status: last ? 'ACTIVE' : 'SUPERSEDED' } : {}),
									steps: [
										{
											stepState: last ? s.planStepState : 'CANCELLED',
											...(named ? { id: `step_${id}_${i + 1}`, stepType: 'MODEL_GENERATION' } : {})
										}
									]
								}
							};
						})
			),
			modelExchanges: [
				...Array.from({ length: reviewerCallCount }, (_, i) => ({
					id: `mx_review_${i}`,
					state: { plane: 'ASSURANCE', exchangeRole: 'INITIAL', disposition: 'ACCEPTED' }
				})),
				...Array.from({ length: script.executorExchanges ?? 0 }, (_, i) => ({
					id: `mx_try_${i}`,
					state: { plane: 'EXECUTION' }
				}))
			],
			// ⭐ D16 — each named unit's stopped attempt: its work product, its command evidence, and their floors, refused.
			...refusedStore(script.refusedReviews ?? {})
		}) as unknown as EngineSnapshot;
	const signOffOf = (unit: RunUnit) => script.signOffs?.[unit.slug] ?? { ra: null };
	const hands: LaneHands = {
		setUp: async (note) => {
			calls.push('setUp');
			note(null);
			const titles = script.titles ?? PHASE7_ARCHIVE_UNITS.map((u) => u.title);
			return new Map(
				titles.map((title) => [
					title,
					{
						id: idOf(PHASE7_ARCHIVE_UNITS.find((u) => u.title === title)?.slug ?? title),
						state: { undertakingId: 'und_1' }
					}
				])
			);
		},
		beginExecute: async (unit) => {
			calls.push(`beginExecute ${unit.slug}`);
			const press = script.presses[unit.slug];
			if (press === undefined) throw new Error(`the script presses no ${unit.slug}`);
			store.set(unit.unitId!, press.after);
			reviewerCallCount += press.calls ?? 0;
			return press.outcome;
		},
		showOverview: async () => void calls.push('showOverview'),
		// ⭐ Package M (`REG-D-135` (2); design D3, D6) — THE PAGE'S OFFER, read from the rule the engine's refusal reads
		// (`startReadiness`) over this store, as the page's load reads it: offered where the engine would start the unit.
		startOffers: async (units) => {
			calls.push('startOffers');
			const snap = snapshot();
			const lookup = (id: string) => readinessUnitOf(id, snap.pwus.find((p) => p.id === id)?.state);
			return new Map(
				units.map((u): [string, StartOffer] => {
					if (lookup(u.unitId!)?.workLifecycleState !== 'PROPOSED') return [u.unitId!, { offered: false, reason: null, kinds: [] }];
					const r = startReadiness(u.unitId!, lookup);
					return [u.unitId!, { offered: r.startable, reason: r.reason, kinds: r.kinds }];
				})
			);
		},
		recoveryOffers: async (unit) => {
			calls.push(`recoveryOffers ${unit.slug}`);
			const read = (recoveryReads.get(unit.slug) ?? 0) + 1;
			recoveryReads.set(unit.slug, read);
			const recovery = script.recoveries?.[unit.slug];
			return (
				(read > 1 ? recovery?.offersAfter : undefined) ??
				recovery?.offers ?? {
					rerunReview: false,
					rerunWork: false,
					abandon: false
				}
			);
		},
		recover: async (unit, act) => {
			calls.push(`recover ${unit.slug} ${act}`);
			const r = script.recoveries?.[unit.slug]?.acts?.[act];
			if (r === undefined) throw new Error(`the script recovers no ${unit.slug} by ${act}`);
			// ⭐ P7-6 B3 — a re-run the server dispatched leaves a new plan B in the store; one refused before it, none.
			if (act !== 'abandonPwu' && (r.newPlan ?? true))
				plans.set(unit.unitId!, (plans.get(unit.unitId!) ?? 1) + 1);
			store.set(unit.unitId!, r.after);
			reviewerCallCount += r.calls ?? 0;
			return r.outcome;
		},
		recordAssurance: async (unit, timeoutMs) => {
			calls.push(`recordAssurance ${unit.slug}`);
			bounds.push([`recordAssurance ${unit.slug}`, timeoutMs]);
			const s = signOffOf(unit);
			if (s.raAfter) store.set(unit.unitId!, s.raAfter);
			reviewerCallCount += s.calls ?? 0;
			return s.ra;
		},
		// ⭐ `E12F` F1 — the row read, Record Assurance found or not, NOTHING pressed: no call recorded.
		recordAssuranceOffered: async (unit) => {
			calls.push(`offersRecordAssurance ${unit.slug}`);
			return signOffOf(unit).ra !== null;
		},
		// ⭐ `E12F` F3 — the row's declared re-run, and the act.
		declaredRerunOffered: async (unit) => {
			calls.push(`offersDeclaredRerun ${unit.slug}`);
			return signOffOf(unit).rerun?.offered === true;
		},
		rerunDeclared: async (unit, timeoutMs) => {
			calls.push(`rerunDeclared ${unit.slug}`);
			bounds.push([`rerunDeclared ${unit.slug}`, timeoutMs]);
			const r = signOffOf(unit).rerun;
			if (r?.outcome === undefined) throw new Error(`the script re-runs no declared review of ${unit.slug}`);
			if (r.after) store.set(unit.unitId!, r.after);
			reviewerCallCount += r.calls ?? 0;
			return r.outcome;
		},
		markSatisfied: async (unit) => {
			calls.push(`markSatisfied ${unit.slug}`);
			if (unit.slug === script.markSatisfiedThrowsOn) {
				// ⭐ E12's polish (fix3's F1) — lane/run.json as it stood on disk when the hand threw: what a kill there would leave.
				onDiskAtMarkSatisfied = existsSync(lane.run) ? (JSON.parse(readFileSync(lane.run, 'utf8')) as RunRecord) : null;
				throw new errors.TimeoutError(`locator.waitFor: Timeout ${PHASE7_UI_MS}ms exceeded.`);
			}
			const s = signOffOf(unit);
			if (s.msAfter) store.set(unit.unitId!, s.msAfter);
			return s.ms ?? answered('success');
		},
		read: async () => {
			reads += 1;
			calls.push('read');
			if (reads === script.readThrowsAt) {
				// ⭐ E12's polish — lane/run.json as it stood on disk when the read failed: what a kill there would leave.
				onDisk = existsSync(lane.run) ? (JSON.parse(readFileSync(lane.run, 'utf8')) as RunRecord) : null;
				throw new Error('connect ECONNREFUSED 127.0.0.1:4322');
			}
			const snap = snapshot();
			return { text: JSON.stringify(snap), snapshot: snap };
		},
		archive: async (call) => {
			calls.push(`archive ${call.name}`);
			archives.push(call);
			return [...call.capturesBefore, `capture-of-${call.name}`];
		},
		screenshot: async (name) => {
			calls.push(`screenshot ${name}`);
			return null;
		}
	};
	const boot: Boot = {
		record: {
			startedAt: '2026-10-10T00:00:00.000Z',
			mode: script.paid ? 'paid' : 'dry',
			node: process.version,
			inherited: {},
			overlay: overlayOf(undefined),
			readiness: null,
			priorReviewerCalls: script.prior ?? 0,
			refusals: script.refusals ?? []
		},
		refusals: script.refusals ?? [],
		prior: script.prior ?? 0
	};
	return {
		run: () => runTheLane({ boot, lane, hands, flushPosts: () => void calls.push('flushPosts') }),
		calls,
		bounds,
		/** The calls of these kinds, in order. */
		only: (...kinds: string[]) => calls.filter((c) => kinds.some((k) => c.startsWith(k))),
		archives,
		lane,
		written: (): RunRecord => JSON.parse(readFileSync(lane.run, 'utf8')) as RunRecord,
		/** ⭐ E12's polish — lane/run.json as it stood on disk when the `readThrowsAt` read failed; null if none failed. */
		onDiskAtTheFailedRead: (): RunRecord | null => onDisk,
		/** ⭐ E12's polish (fix3's F1) — lane/run.json as it stood on disk when the `markSatisfiedThrowsOn` hand threw. */
		onDiskWhenMarkSatisfiedThrew: (): RunRecord | null => onDiskAtMarkSatisfied,
		action: (name: string) => existsSync(join(lane.actions, `${name}.json`))
	};
}

/** The five presses of a run in which every unit completes. */
const ALL_COMPLETE = Object.fromEntries(
	PHASE7_ARCHIVE_UNITS.map((u) => [u.slug, { outcome: answered('success'), after: COMPLETED }])
);
/** Record Assurance and Mark Satisfied, each accepted, the store reading each. */
const GREEN = {
	ra: answered('success'),
	raAfter: ASSURED,
	ms: answered('success'),
	msAfter: SATISFIED
};

/**
 * ⭐ R3-B's fix round, F1 — A PAID RUN THAT REACHES ITS SIGN-OFFS WITH `spent` CALLS, the prior's and the recorded together.
 * Each phase counts ~~its worst case (`UNIT_WORST`)~~ ~~⭐ one try's reserve (`TRY_RESERVE`; `REG-D-114` (14), as amended
 * 2026-10-16)~~ ⭐ its whole press's worst case (`WHOLE_PRESS`; package L, D16; `REG-D-135` (4)) before its press, so a prior near the limit stops the FIRST phase: the run starts from `spent`, or — past the
 * prior that lets each phase through exactly at the limit — from that prior, every phase recording nothing but the LAST,
 * which records the rest: no phase's check comes after it. So each sign-off reads the totals it read when the prior alone
 * was `spent`, the recorded calls in place of part of it.
 * ⛔ RETIRED (package M; `REG-D-135` (2); design D6) — ~~`spentBySignOff(spent)`: the calls spent in the 'end-to-end' press~~:
 * every sign-off no longer comes after every press, so its four users moved to `spentBefore`, below, which spends them in the
 * press the sign-off under test follows.
 */

/**
 * ⭐ `JAN-EXEC` Phase 7, package M (`REG-D-135` (2); design D6) — A PAID RUN WHOSE `slug` PHASE'S SIGN-OFF IS READ WITH `spent`
 * CALLS, the prior's and the recorded together. ⛔ `spentBySignOff` spent them in the LAST phase, because every sign-off came
 * after every press; each unit's sign-off now follows its own press, so the calls are spent before the run, or in `slug`'s own
 * press — and every phase before it passes its own check exactly at the limit, spending nothing.
 */
function spentBefore(slug: string, spent: number) {
	const prior = Math.min(spent, PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS);
	return {
		prior,
		recorded: spent - prior,
		presses: { ...ALL_COMPLETE, [slug]: { outcome: answered('success'), after: COMPLETED, calls: spent - prior } }
	};
}

describe('⭐⭐ THE RUN, IN ITS ORDER — `runTheLane` on hands made here (D1, D4, D5, D8)', () => {
	it('⛔ a refused boot presses nothing: boot.json and run.json are written, `refused-at-boot`, and the verdict says why', async () => {
		const l = laneOf({
			paid: false,
			refusals: ['`devin --version` spawn devin ENOENT'],
			presses: {}
		});
		const record = await l.run();
		expect(l.calls).toEqual(['flushPosts']);
		expect(existsSync(l.lane.boot)).toBe(true);
		expect(l.written().end?.reason).toBe('refused-at-boot');
		expect(laneVerdict(record)).toEqual([
			"the run ended 'refused-at-boot', not 'dry-run-stop': `devin --version` spawn devin ENOENT"
		]);
	});

	// ── ⛔ MOVED 2026-10-25 (`JAN-EXEC` Phase 7, package M; `REG-D-135` (2); design D7, which names the first of them) ────────
	// HALF A'S DRY REHEARSAL PRESSED THE ROOT FIRST, and these four held it: ~~"⛔ DRY: the root is pressed, its answer kept, its
	// state read from the store and the run archived — then the run stops, before any phase, and the verdict holds the press
	// PROVED (D1, D5)"~~ (`setUp`, `beginExecute root`, `read`, `screenshot 01-root`, `archive 01-root`; the root not stopped;
	// `dry-run-stop`); ~~"⛔ DRY: a root whose press was REFUSED, or a store holding a model exchange, fails the verdict"~~ (the
	// line "the dry run did not prove the root's press: …"); ~~"⛔ DRY, D11 — after the root's archive the ROOT's sign-off is
	// REHEARSED … up to the reviewer call"~~ (the root's row read for Record Assurance, `DRY_SIGN_OFF_NOT_REACHED`, the final
	// archive diffed with `01-root`'s); and ~~"⛔ DRY, D11 — the verdict holds the root's sign-off REHEARSED UP TO THE REVIEWER
	// CALL"~~ (its three shortfall lines). ⛔ Under D7 the root waits for its four phases, each a model's, so a dry run can press
	// NO unit and reach no sign-off. What it rehearses now is THE ORDER — and the same four questions are asked of it below.
	it('⭐ D7 — DRY: NOTHING IS PRESSED. The order is recorded; each row’s offer is read — the four phases offered and recorded not reached in a dry run, the ROOT WITHHELD for its children, in the page’s words; the final archive taken; and the verdict holds the order PROVED (D1, D6, D7)', async () => {
		const l = laneOf({
			paid: false,
			presses: ALL_COMPLETE,
			signOffs: { root: GREEN }
		});
		const record = await l.run();
		expect(l.calls, 'the dry run’s order (D1, D6, D7)').toEqual([
			'setUp',
			// what each unit waits for, read from the store into the record
			'read',
			// the page loaded afresh, and each row's offer read — never pressed
			'showOverview',
			'startOffers',
			'screenshot 06-final',
			'read',
			'archive 06-final',
			'read',
			'flushPosts'
		]);
		expect(l.only('beginExecute', 'recordAssurance', 'offersRecordAssurance'), 'the dry run pressed, or read for a sign-off').toEqual([]);
		expect(record.order, 'the order the run recorded').toEqual({
			dependencies: {
				root: ['requirements', 'design', 'implementation', 'end-to-end'],
				requirements: [],
				design: [],
				implementation: [],
				'end-to-end': []
			},
			pressed: []
		});
		expect(record.units.map((u) => [u.slug, u.beginExecute, u.notStarted])).toEqual([
			[
				'root',
				null,
				'not started: it waits for "Requirements" (PROPOSED), "Design" (PROPOSED), "Implementation and unit tests" (PROPOSED) and "End-to-end verification" (PROPOSED) to be accepted'
			],
			['requirements', null, DRY_PRESS_NOT_REACHED],
			['design', null, DRY_PRESS_NOT_REACHED],
			['implementation', null, DRY_PRESS_NOT_REACHED],
			['end-to-end', null, DRY_PRESS_NOT_REACHED]
		]);
		expect(l.written().units.map((u) => u.notStarted), 'the record written lacks why each was not pressed').toEqual(
			record.units.map((u) => u.notStarted)
		);
		expect(l.archives.map((a) => [a.name, a.unitId, a.capturesBefore]), 'the one archive-and-check cycle').toEqual([
			['06-final', null, []]
		]);
		expect([record.end?.reason, record.dryRun, l.written().end?.reason]).toEqual([
			'dry-run-stop',
			{ modelExchanges: 0 },
			'dry-run-stop'
		]);
		expect(laneVerdict(record)).toEqual([]);
	});

	it('⛔ D7 — DRY: a store holding a model exchange, or a dry run that pressed a unit, fails the verdict — the dry run proves the order, and calls no model', async () => {
		const called = await laneOf({ paid: false, presses: ALL_COMPLETE, executorExchanges: 2 }).run();
		expect(laneVerdict(called)).toEqual(['the dry run recorded 2 model exchange(s)']);
		const green = await laneOf({ paid: false, presses: ALL_COMPLETE }).run();
		const pressed: RunRecord = {
			...green,
			units: green.units.map((u) =>
				u.slug === 'requirements'
					? { ...u, notStarted: null, beginExecute: { status: 200, envelopeType: 'success', timedOutAfterMs: null, requestFailure: null } }
					: u
			)
		};
		expect(laneVerdict(pressed), 'a dry run that pressed a phase').toEqual([
			'the dry run pressed Requirements: a dry run presses no unit, each it would press running a model (D1)'
		]);
	});

	it('⛔ D7 — DRY: the verdict holds the order REHEARSED, each shortfall its own line, with what was read: the order recorded, an offered unit read and not reached, and the root withheld in the page’s words', async () => {
		const green = await laneOf({ paid: false, presses: ALL_COMPLETE }).run();
		expect(laneVerdict(green), 'CONTROL: the rehearsal as the lane records it').toEqual([]);
		expect(laneVerdict({ ...green, order: null }), 'no order recorded').toEqual([
			'the dry run recorded no order: what each unit waits for was not read from the store'
		]);
		expect(
			laneVerdict({ ...green, units: green.units.map((u) => (u.slug === 'root' ? u : { ...u, notStarted: null })) }),
			'no offered unit read and recorded not reached'
		).toEqual(['the dry run rehearsed no press: no unit the page offered was read and recorded not reached in a dry run']);
		expect(
			laneVerdict({ ...green, units: green.units.map((u) => (u.slug === 'root' ? { ...u, notStarted: null } : u)) }),
			'the root not shown withheld'
		).toEqual(['the dry run did not show the root withheld for the units it waits for (D7): nothing recorded']);
	});

	// ⛔ MOVED 2026-10-25 (`JAN-EXEC` Phase 7, package M; `REG-D-135` (2); design D6, D7, which name it) — ~~"⭐ PAID: each phase in
	// order, the limit read before each; a phase that stops is left as found and the later ones run with an unassured
	// upstream; the sign-off takes each completed phase and the root LAST"~~. Its struck expectations: the presses root,
	// requirements, design, implementation, end-to-end; implementation and end-to-end `upstreamNotAssured` TRUE for design's
	// stop; the sign-offs after every press (requirements, implementation, end-to-end, then the root), requirements' read at
	// 10 recorded (total 36) and implementation's at 10 (total 42); the root signed off; the archives 01-root first, each
	// diffed with all before it. ⭐ Restated on the same script: the root waits for its four phases, so it is pressed only
	// once all four are accepted — here never, design having stopped; each phase is signed off right after it ran.
	it('⭐ D6, D7 — PAID: each phase the page offers, one at a time in the tree’s order, the limit read before each; each signed off RIGHT AFTER it ran, before the next press; a phase that stops is left as found, and the phases that do not wait for it still run; the ROOT, waiting for a phase still stopped, is NEVER pressed — recorded not started, in the page’s words', async () => {
		const l = laneOf({
			paid: true,
			prior: 10,
			presses: {
				root: ALL_COMPLETE.root!,
				requirements: { outcome: answered('success'), after: COMPLETED, calls: 3 },
				design: { outcome: answered('failure'), after: STOPPED, calls: 2 },
				implementation: { outcome: answered('success'), after: COMPLETED, calls: 4 },
				'end-to-end': { outcome: answered('success'), after: COMPLETED, calls: 1 }
			},
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				implementation: { ra: answered('failure'), raAfter: COMPLETED },
				'end-to-end': GREEN
			}
		});
		const record = await l.run();
		expect(l.only('beginExecute'), 'the presses: only what the page offered, the root never').toEqual([
			'beginExecute requirements',
			'beginExecute design',
			'beginExecute implementation',
			'beginExecute end-to-end'
		]);
		expect(record.order?.pressed, 'the press order, as the run records it').toEqual([
			'requirements',
			'design',
			'implementation',
			'end-to-end'
		]);
		// ⭐ D6 — `upstreamNotAssured` reads each phase's OWN producers, and §3.2's phases wait for none: design's stop marks
		// nothing it does not produce for.
		expect(record.units.map((u) => [u.slug, u.stopped, u.upstreamNotAssured])).toEqual([
			['root', null, null],
			['requirements', false, false],
			['design', true, false],
			['implementation', false, false],
			['end-to-end', false, false]
		]);
		expect(
			record.units.slice(1).map((u) => u.limitCheck?.recorded),
			'the limit did not read what the store recorded before each phase'
		).toEqual([0, 3, 5, 9]);
		expect(
			l.only('beginExecute', 'showOverview', 'recordAssurance', 'markSatisfied', 'startOffers'),
			'each phase signed off before the next press, the page loaded afresh before every reading of it'
		).toEqual([
			'showOverview',
			'startOffers',
			'beginExecute requirements',
			'showOverview',
			'recordAssurance requirements',
			'markSatisfied requirements',
			'showOverview',
			'startOffers',
			'beginExecute design',
			// ⭐ P7-6R R-1f — the stopped design phase's row, read for the run plan's rule; it offers no re-run here; then its
			// row read for a sign-off it does not offer.
			'showOverview',
			'showOverview',
			'showOverview',
			'startOffers',
			'beginExecute implementation',
			'showOverview',
			'recordAssurance implementation',
			// ⭐ `E12F` F3 — a refused Record Assurance: the page loaded afresh, the row read for a declared re-run (it offers none).
			'showOverview',
			'showOverview',
			'startOffers',
			'beginExecute end-to-end',
			'showOverview',
			'recordAssurance end-to-end',
			'markSatisfied end-to-end',
			'showOverview',
			'startOffers'
		]);
		const [root, requirements, design, implementation] = record.units as [RunUnit, RunUnit, RunUnit, RunUnit];
		expect(requirements.signOff, 'each act’s state is not the store’s, read after it').toEqual({
			offered: true,
			// ⭐ `E12F` F2 — the limit read before it: 10 before, ⭐ (D6) 3 recorded — its own press, the only one before it — 4
			// held back, its own 2 × 6 counted (package L, D13: each declared review up to SIX calls).
			limitCheck: { prior: 10, recorded: 3, reserve: 4, ahead: 12, counted: COUNTED_SIGN_OFF, total: 29, limit: PHASE7_PAID_LIMIT, allowed: true },
			recordAssurance: actAnswered('success', ASSURED),
			rerunDeclared: null,
			rerunLimitCheck: null,
			markSatisfied: actAnswered('success', SATISFIED),
			refused: null,
			notPressed: null
		});
		expect(implementation.signOff).toEqual({
			offered: true,
			// ⭐ D6 — 9 recorded before it (requirements' 3, design's 2, its own 4); 3 × 6 = 18 counted, total 41.
			limitCheck: { prior: 10, recorded: 9, reserve: 4, ahead: 18, counted: COUNTED_SIGN_OFF, total: 41, limit: PHASE7_PAID_LIMIT, allowed: true },
			recordAssurance: actAnswered('failure', COMPLETED),
			rerunDeclared: null,
			rerunLimitCheck: null,
			markSatisfied: null,
			refused: { act: 'Record Assurance', reason: '{"type":"failure"}' },
			notPressed: null
		});
		// ⭐ D6 — the stopped phase's row read, and nothing pressed; the root, never pressed, has no sign-off.
		expect([design.signOff?.offered, design.signOff?.recordAssurance, root.signOff]).toEqual([false, null, null]);
		expect(root.notStarted, 'the root is not recorded not started, in the page’s words').toBe(
			'not started: it waits for "Design" (EXECUTING) and "Implementation and unit tests" (EXECUTING) to be accepted'
		);
		expect(l.action('04-implementation-markSatisfied')).toBe(false);
		expect(l.action('01-root-beginExecute'), 'the root was pressed').toBe(false);
		expect(
			l.archives.map((a) => [a.name, a.unitId, a.refusal, a.capturesBefore]),
			'an archive was not diffed with the one before it, in the order pressed (K5)'
		).toEqual([
			['02-requirements', 'pwu_requirements', null, []],
			['03-design', 'pwu_design', '{"type":"failure"}', ['capture-of-02-requirements']],
			['04-implementation', 'pwu_implementation', null, ['capture-of-02-requirements', 'capture-of-03-design']],
			[
				'05-end-to-end',
				'pwu_end-to-end',
				null,
				['capture-of-02-requirements', 'capture-of-03-design', 'capture-of-04-implementation']
			],
			[
				'06-final',
				null,
				null,
				[
					'capture-of-02-requirements',
					'capture-of-03-design',
					'capture-of-04-implementation',
					'capture-of-05-end-to-end'
				]
			]
		]);
		expect([record.end?.reason, l.written().end?.reason]).toEqual(['complete', 'complete']);
		expect(laneVerdict(record)).toEqual([]);
	});

	it('⭐ THE PREDICTED RED (D6), THROUGH THE LANE — a phase pressed after an UNRELATED phase stopped records `upstreamNotAssured` FALSE: §3.2’s phases wait for no other phase, so design’s stop is no upstream of implementation’s', async () => {
		const l = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, design: { outcome: answered('failure'), after: STOPPED } },
			signOffs: { requirements: GREEN, implementation: GREEN, 'end-to-end': GREEN }
		});
		const record = await l.run();
		const of = (slug: string) => record.units.find((u) => u.slug === slug)!;
		expect([of('design').stopped, of('implementation').beginExecute?.envelopeType], 'arrangement: design stopped, implementation ran after it').toEqual([
			true,
			'success'
		]);
		expect(of('implementation').upstreamNotAssured, 'an unrelated stop marked a phase whose own producers are accepted').toBe(false);
		expect(of('end-to-end').upstreamNotAssured).toBe(false);
	});

	it('⭐ D7 — PAID: every phase accepted, so the ROOT is offered LAST and pressed, then signed off: the press order the four phases in the tree’s order, the root fifth', async () => {
		const l = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: { root: GREEN, requirements: GREEN, design: GREEN, implementation: GREEN, 'end-to-end': GREEN }
		});
		const record = await l.run();
		const last = ['requirements', 'design', 'implementation', 'end-to-end', 'root'];
		expect(l.only('beginExecute'), 'the root was not pressed last').toEqual(last.map((u) => `beginExecute ${u}`));
		expect(record.order?.pressed).toEqual(last);
		expect(l.only('beginExecute', 'markSatisfied'), 'a unit was pressed before the one before it was signed off').toEqual(
			last.flatMap((u) => [`beginExecute ${u}`, `markSatisfied ${u}`])
		);
		expect(record.units.map((u) => [u.slug, u.upstreamNotAssured, u.notStarted])).toEqual([
			['root', false, null],
			['requirements', false, null],
			['design', false, null],
			['implementation', false, null],
			['end-to-end', false, null]
		]);
		expect(l.archives.map((a) => a.name)).toEqual([
			'02-requirements',
			'03-design',
			'04-implementation',
			'05-end-to-end',
			'01-root',
			'06-final'
		]);
		expect([record.end?.reason, laneVerdict(record)]).toEqual(['complete', []]);
	});

	// ── ⭐⭐ `JAN-EXEC` P7-6R R-1f — THE RUN PLAN'S RULE, ACTED AS THE OPERATOR (`REG-D-105` (4)), REHEARSED WITH NO MODEL ───────
	// A review that did not conclude is re-run once; a review that concluded against the work has its work re-run once; a
	// re-run refused again is abandoned. Which re-run is the rule's is read off the row (re-run the review is offered only
	// after a review that did not conclude, R-1d), each act types the rule's own rationale, and the limit is read before
	// each re-run, as between phases (D8).
	it('⭐ REG-D-105 (4) — PAID: a stopped phase whose row offers the review is re-run once by REVIEW; one offering only the work, by WORK; a re-run refused again is ABANDONED; the limit read before each re-run; the recovered phase signed off, the abandoned one not', async () => {
		const l = laneOf({
			paid: true,
			prior: 10,
			presses: {
				root: ALL_COMPLETE.root!,
				requirements: { outcome: answered('failure'), after: WAITING, calls: 2 },
				design: { outcome: answered('failure'), after: WAITING, calls: 2 },
				implementation: { outcome: answered('success'), after: COMPLETED, calls: 4 },
				'end-to-end': { outcome: answered('success'), after: COMPLETED, calls: 1 }
			},
			recoveries: {
				requirements: {
					offers: { rerunReview: true, rerunWork: true, abandon: true },
					acts: { rerunReview: { outcome: answered('success'), after: COMPLETED, calls: 1 } }
				},
				design: {
					offers: { rerunReview: false, rerunWork: true, abandon: true },
					acts: {
						rerunWork: { outcome: answered('failure'), after: WAITING, calls: 3 },
						abandonPwu: { outcome: answered('success'), after: ABANDONED }
					}
				}
			},
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				implementation: GREEN,
				'end-to-end': GREEN
			}
		});
		const record = await l.run();
		expect(
			l.only('beginExecute', 'recoveryOffers', 'recover'),
			'the rule did not act on each stopped phase, in order, before the next started'
		).toEqual([
			// ⛔ MOVED (package M; `REG-D-135` (2); design D7): ~~'beginExecute root'~~ first — the root waits for its phases, and
			// here never starts (D4, below).
			'beginExecute requirements',
			'recoveryOffers requirements',
			'recover requirements rerunReview',
			'beginExecute design',
			'recoveryOffers design',
			'recover design rerunWork',
			// ⭐ P7-6 B3 — the row asked again, on the page loaded afresh, before the abandonment it offers is pressed.
			'recoveryOffers design',
			'recover design abandonPwu',
			'beginExecute implementation',
			'beginExecute end-to-end'
		]);
		// ⚠ A refused re-run leaves the page stale, and its row may predate the re-run's own wait: the abandonment is pressed
		// on the page loaded afresh.
		const reworked = l.calls.indexOf('recover design rerunWork');
		expect(
			l.calls
				.slice(reworked, l.calls.indexOf('recover design abandonPwu'))
				.filter((c) => c === 'showOverview' || c === 'recoveryOffers design'),
			'the abandonment was pressed on the page the refused re-run left, or on a row not asked again'
		).toEqual(['showOverview', 'recoveryOffers design']);
		const [, requirements, design, implementation] = record.units as [
			RunUnit,
			RunUnit,
			RunUnit,
			RunUnit
		];
		expect(
			requirements.recovery.map((r) => [
				r.act,
				r.rationale,
				r.limitCheck?.recorded,
				r.envelopeType,
				r.after
			]),
			'a review that did not conclude is not re-run once, by the rule, after the limit'
		).toEqual([['rerunReview', RULE_RATIONALE.rerunReview, 2, 'success', COMPLETED]]);
		expect(
			design.recovery.map((r) => [
				r.act,
				r.rationale,
				r.limitCheck?.recorded ?? null,
				r.envelopeType
			]),
			'a concluded refusal is not re-run once by its work, then abandoned when refused again'
		).toEqual([
			['rerunWork', RULE_RATIONALE.rerunWork, 5, 'failure'],
			['abandonPwu', RULE_RATIONALE.abandonPwu, null, 'success']
		]);
		// ⭐ P7-6 B3 — what the STORE read each act to: the re-run of the review recovered, the re-run of the work was refused
		// again (a new plan whose step waits), and only that one was abandoned.
		expect([...requirements.recovery, ...design.recovery].map((r) => [r.act, r.reading])).toEqual([
			['rerunReview', 'recovered'],
			['rerunWork', 'refused-again'],
			['abandonPwu', null]
		]);
		for (const rationale of Object.values(RULE_RATIONALE))
			expect(rationale).toMatch(/^The run plan’s rule, REG-D-105 \(4\): /);
		// ⛔ MOVED (package M; design D6): ~~root [false, null]; implementation and end-to-end `upstreamNotAssured` TRUE~~ — the
		// root is never pressed, and the flag reads each phase's OWN producers, of which §3.2's phases have none.
		expect(record.units.map((u) => [u.slug, u.stopped, u.upstreamNotAssured])).toEqual([
			['root', null, null],
			['requirements', false, false],
			['design', true, false],
			['implementation', false, false],
			['end-to-end', false, false]
		]);
		expect(
			implementation.limitCheck?.recorded,
			'the limit before a phase did not count the re-runs'
		).toBe(2 + 1 + 2 + 3);
		// ⭐⭐ P5 package B (F3; the sponsor, 2026-10-18: "Yes, hold the root", REG-D-117 Q7) — AND THE ROOT IS HELD while a phase is
		// ABANDONED: ~~its row read, nothing pressed, and its sign-off recorded not pressed, naming the abandoned phase~~ ⭐⭐ (package
		// M; `REG-D-135` (2); design D4) — the WORKBENCH now holds it: the root waits for the abandoned phase, the page withholds
		// its Begin & Execute and says why, and the lane records it NOT STARTED, in the page's words — never pressed, never signed
		// off. ⛔ RED BEFORE F3, driven: the root's Record Assurance and Mark Satisfied were pressed after the abandonment, as in P5.
		expect(
			l.only('recordAssurance', 'markSatisfied'),
			'the recovered phase was not signed off, the abandoned one was, or the root was signed off beside it'
		).toEqual([
			'recordAssurance requirements',
			'markSatisfied requirements',
			'recordAssurance implementation',
			'markSatisfied implementation',
			'recordAssurance end-to-end',
			'markSatisfied end-to-end'
		]);
		const root = record.units[0]!;
		// ⛔ MOVED (package M; design D4): ~~the root's sign-off recorded held, `notPressed` naming Design ABANDONED and REG-D-117
		// Q7~~ — the root is never pressed, so it has no sign-off; it is recorded not started, its producer named abandoned.
		expect([root.beginExecute, root.signOff], 'the root was pressed, or signed off, over an abandoned phase').toEqual([null, null]);
		expect(root.notStarted, 'the root is not recorded not started, naming the abandoned phase').toBe(
			'not started: its producer "Design" was ABANDONED'
		);
		expect(l.written().units[0]!.notStarted, 'the run record written lacks why the root never started').toBe(root.notStarted);
		expect([l.action('01-root-recordAssurance'), l.action('01-root-markSatisfied')]).toEqual([false, false]);
		for (const file of [
			'02-requirements-rerunReview',
			'03-design-rerunWork',
			'03-design-abandonPwu'
		])
			expect(l.action(file), `lane/actions/${file}.json`).toBe(true);
		expect([record.end?.reason, laneVerdict(record)]).toEqual(['complete', []]);
	});

	it('⛔ REG-D-105 (4), D8 — AT THE LIMIT a stopped phase is NOT re-run: the act is recorded unpressed, and the run ends `paid-limit`', async () => {
		// ⛔ PREDICTED RED, read from the code (R3-B's check, F1): the re-run of the review counted its first call only, so with
		// 131 calls left under the limit, one short of a re-review's worst case, it was pressed. ⭑ The re-run and every phase are
		// scripted, so a lane that presses past the limit is caught by the assertion, not by a script with no press for it.
		// ⭐ `REG-D-114` (14), as amended 2026-10-16 — ~~one call past a re-review's worst case~~: the re-run counts ~~one try's
		// reserve~~ ⭐ (package L, D16; `REG-D-135` (4)) its refused reviews' worst case — these hands' store names none, so every
		// review the attempt holds — and the stopped phase's own press spends one call more than leaves room for it.
		const prior = 0;
		const spent = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - REREVIEW_UNREAD + 1;
		const l = laneOf({
			paid: true,
			prior,
			presses: {
				...ALL_COMPLETE,
				requirements: { outcome: answered('failure'), after: WAITING, calls: spent }
			},
			recoveries: {
				requirements: {
					offers: { rerunReview: true, rerunWork: true, abandon: true },
					acts: { rerunReview: { outcome: answered('success'), after: COMPLETED } }
				}
			},
			signOffs: { root: GREEN }
		});
		const record = await l.run();
		expect(l.only('recover '), 'a re-run was pressed past the limit').toEqual([]);
		// ⛔ MOVED (package M; `REG-D-135` (2); design D7): ~~['beginExecute root', 'beginExecute requirements']~~ — the root waits
		// for its phases, so requirements is the first press, and the limit stops the run before any other.
		expect(l.only('beginExecute')).toEqual(['beginExecute requirements']);
		expect(record.units[1]!.recovery).toEqual([
			{
				act: 'rerunReview',
				rationale: RULE_RATIONALE.rerunReview,
				// ⭐ The one rule (`REG-D-114` (14)): ~~the re-run's first call~~ ~~⭐ R3-B's fix round (F1): a re-review's worst
				// case~~ ⭐ as amended 2026-10-16: one try's reserve counted, which would pass the limit by one call — ~~total:
				// PHASE7_PAID_LIMIT~~.
				limitCheck: {
					prior,
					recorded: spent,
					reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
					ahead: REREVIEW_UNREAD,
					counted: COUNTED_REREVIEW_UNREAD,
					total: PHASE7_PAID_LIMIT + 1,
					limit: PHASE7_PAID_LIMIT,
					allowed: false
				},
				status: null,
				envelopeType: null,
				timedOutAfterMs: null,
				requestFailure: null,
				after: null,
				reading: null,
				refusal: null,
				notPressed: `the limit: ${PHASE7_PAID_LIMIT + 1} of ${PHASE7_PAID_LIMIT} reviewer calls (D8)`
			}
		]);
		expect(record.end?.reason).toBe('paid-limit');
	});

	it('⛔ D4 — a re-run with NO ANSWER ends the run there, named for the act: the server may still be running it', async () => {
		const l = laneOf({
			paid: true,
			prior: 0,
			presses: {
				root: ALL_COMPLETE.root!,
				requirements: { outcome: answered('failure'), after: WAITING }
			},
			recoveries: {
				requirements: {
					offers: { rerunReview: false, rerunWork: true, abandon: true },
					acts: { rerunWork: { outcome: OUTLASTED, after: WAITING } }
				}
			}
		});
		const record = await l.run();
		expect(l.only('beginExecute', 'recover')).toEqual([
			// ⛔ MOVED (package M; `REG-D-135` (2); design D7): ~~'beginExecute root'~~ first — the root waits for its phases.
			'beginExecute requirements',
			'recoveryOffers requirements',
			'recover requirements rerunWork'
		]);
		expect([record.end?.reason, record.end?.detail]).toEqual([
			'allowance-exceeded',
			`Requirements's rerunWork outlasted its allowance of ${PHASE7_UNIT_ALLOWANCE_MS} ms`
		]);
		// ⭐ Package M (`REG-D-135` (2); design D6) — AND THE LANE ENDS THERE, AT ONCE: the store read once after the act, and the
		// run ended. ⛔ Since the sign-off follows each press in the one loop, an end the recovery reached and the loop ignored
		// no longer led to a later PRESS — the sign-off's own `reached` check stops the loop — but the lane still read the
		// unit's row beside the re-run the server may still be running, and took the final archive of a unit still running
		// (P76R-M40, measured SURVIVED by this package's first run, 2026-10-26, before this pin).
		expect(l.calls.slice(l.calls.indexOf('recover requirements rerunWork')), 'the lane acted after a re-run with no answer').toEqual([
			'recover requirements rerunWork',
			'read',
			'flushPosts'
		]);
	});

	it('⛔ a stop the row offers no re-run for — a failed step, R-2’s — is left as found, as before R-1', async () => {
		const l = laneOf({
			paid: true,
			prior: 0,
			presses: {
				root: ALL_COMPLETE.root!,
				requirements: { outcome: answered('failure'), after: STOPPED },
				design: { outcome: answered('success'), after: COMPLETED },
				implementation: { outcome: answered('success'), after: COMPLETED },
				'end-to-end': { outcome: answered('success'), after: COMPLETED }
			},
			signOffs: { root: GREEN, design: GREEN, implementation: GREEN, 'end-to-end': GREEN }
		});
		const record = await l.run();
		expect(l.only('recoveryOffers', 'recover')).toEqual(['recoveryOffers requirements']);
		expect(record.units[1]!.recovery).toEqual([]);
		expect(record.end?.reason).toBe('complete');
	});

	// ── ⭐⭐ P7-6 B3 (the fix round) — THE RULE DECIDES FROM THE STORE, AFTER A RE-RUN, WHAT THE RE-RUN CAME TO ────────────────
	// ⛔ It abandoned on ANY stop after a re-run (`stoppedAfter`), and two kinds of stop are not "a re-run refused again":
	//   · a press the server refused BEFORE dispatching anything — a missing rationale, RD7 unable to rebuild, the reviewer's
	//     preflight — leaves the unit WAITING with NO NEW PLAN: no re-run was made, and the rule abandoned it with a false
	//     rationale, skipping the re-run the row still offered;
	//   · a re-run that leaves the unit RUNNING or FAILED (an executor try that did not run, a refused evidence join, a floor
	//     that threw: R-2's stops) — and the abandonment's field is rendered for a WAITING unit only, so its fill waited out
	//     its bound and threw: the run ended `lane-error`, its final archive never taken.
	// Now: a new plan whose step WAITS is refused again — abandoned, if the row offers it; no new plan, the re-run was not
	// made — the server's words kept, the unit left as found; a new plan not waiting — left as found, and recorded.
	const refusedWith = (error: string): ActionOutcome => ({ ...answered('failure'), decoded: { error } });
	/** ⭐ E12's re-review F4 — a Record Assurance refused, in the server's own words: a declared review did not conclude. */
	const DID_NOT_CONCLUDE =
		"Assurance recorded, and the declared review did not conclude in this PWU's favour: pol_intent_preservation reached INCONCLUSIVE.";
	const FAILED = unitState('EXECUTING', 'FAILED', 'UNASSESSED', 'FAILED');
	const OTHERS_COMPLETE = {
		root: ALL_COMPLETE.root!,
		design: ALL_COMPLETE.design!,
		implementation: ALL_COMPLETE.implementation!,
		'end-to-end': ALL_COMPLETE['end-to-end']!
	};
	const OTHERS_GREEN = { root: GREEN, design: GREEN, implementation: GREEN, 'end-to-end': GREEN };
	const EVERY_OFFER: RecoveryOffers = { rerunReview: true, rerunWork: true, abandon: true };
	const NO_OFFER: RecoveryOffers = { rerunReview: false, rerunWork: false, abandon: false };

	it('⛔ B3 — a re-run the server refused BEFORE DISPATCHING ANYTHING (no new plan in the store) is NOT abandoned: the re-run was not made, the server’s words kept, the unit left as found', async () => {
		const REFUSAL = 'The review cannot be re-run, and the unit keeps waiting: the producing prompt cannot be rebuilt.';
		const l = laneOf({
			paid: true,
			prior: 0,
			presses: { ...OTHERS_COMPLETE, requirements: { outcome: answered('failure'), after: WAITING, calls: 1 } },
			recoveries: {
				requirements: {
					offers: EVERY_OFFER,
					acts: {
						rerunReview: { outcome: refusedWith(REFUSAL), after: WAITING, newPlan: false },
						abandonPwu: { outcome: answered('success'), after: ABANDONED }
					}
				}
			},
			signOffs: OTHERS_GREEN
		});
		const record = await l.run();
		expect(l.only('recover '), 'a re-run that was never made was abandoned as one refused again').toEqual([
			'recover requirements rerunReview'
		]);
		const requirements = record.units[1]!;
		expect(requirements.recovery.map((r) => [r.act, r.reading, r.refusal])).toEqual([
			['rerunReview', 'not-made', REFUSAL]
		]);
		expect([requirements.stopped, requirements.after]).toEqual([true, WAITING]);
		expect(record.end?.reason).toBe('complete');
	});

	it('⛔ B3 — a re-run that leaves the unit NOT WAITING — RUNNING or FAILED, an R-2 stop — is left as found and recorded: no abandonment is pressed', async () => {
		for (const after of [STOPPED, FAILED]) {
			const l = laneOf({
				paid: true,
				prior: 0,
				presses: { ...OTHERS_COMPLETE, requirements: { outcome: answered('failure'), after: WAITING } },
				recoveries: {
					requirements: {
						offers: { rerunReview: false, rerunWork: true, abandon: true },
						// A unit no longer WAITING: its row renders no abandonment's field, and no re-run.
						offersAfter: NO_OFFER,
						acts: {
							rerunWork: { outcome: refusedWith('Execution failed: the executor try did not run.'), after },
							abandonPwu: { outcome: answered('success'), after: ABANDONED }
						}
					}
				},
				signOffs: OTHERS_GREEN
			});
			const record = await l.run();
			expect(l.only('recover '), `${after.executionState}: an abandonment was pressed`).toEqual([
				'recover requirements rerunWork'
			]);
			expect(record.units[1]!.recovery.map((r) => [r.act, r.reading, r.after])).toEqual([
				['rerunWork', 'stopped-otherwise', after]
			]);
			expect(record.end?.reason, after.executionState ?? '').toBe('complete');
		}
	});

	it('⛔ B3 — refused again, and the row read afresh offers NO abandonment: none is pressed — never a control the row does not offer — and that is recorded', async () => {
		const l = laneOf({
			paid: true,
			prior: 0,
			presses: { ...OTHERS_COMPLETE, requirements: { outcome: answered('failure'), after: WAITING } },
			recoveries: {
				requirements: {
					offers: EVERY_OFFER,
					offersAfter: NO_OFFER,
					acts: {
						rerunReview: { outcome: answered('failure'), after: WAITING },
						abandonPwu: { outcome: answered('success'), after: ABANDONED }
					}
				}
			},
			signOffs: OTHERS_GREEN
		});
		const record = await l.run();
		expect(l.only('recover ')).toEqual(['recover requirements rerunReview']);
		expect(
			record.units[1]!.recovery.map((r) => [r.act, r.reading, r.status, r.notPressed])
		).toEqual([
			['rerunReview', 'refused-again', 200, null],
			['abandonPwu', null, null, 'the row, read again after the re-run, offers no abandonment']
		]);
		expect(record.end?.reason).toBe('complete');
	});

	it('⭑ CONTROL — a WAITING unit whose row offers NO re-run at all is left as found, and never abandoned by the rule', async () => {
		const l = laneOf({
			paid: true,
			prior: 0,
			presses: { ...OTHERS_COMPLETE, requirements: { outcome: answered('failure'), after: WAITING } },
			recoveries: {
				requirements: {
					offers: { rerunReview: false, rerunWork: false, abandon: true },
					acts: { abandonPwu: { outcome: answered('success'), after: ABANDONED } }
				}
			},
			signOffs: OTHERS_GREEN
		});
		const record = await l.run();
		expect(l.only('recoveryOffers', 'recover')).toEqual(['recoveryOffers requirements']);
		expect([record.units[1]!.recovery, record.units[1]!.after]).toEqual([[], WAITING]);
	});

	it('⛔ D4 — a phase PAST ITS ALLOWANCE ends the run there: it is archived, and the next is never pressed beside it, ~~nothing signed off~~ nor its own sign-off (REG-F-535)', async () => {
		const l = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, implementation: { outcome: OUTLASTED, after: STOPPED } }
		});
		const record = await l.run();
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6, D7): ~~root, requirements, design, implementation pressed, and no
		// showOverview or Record Assurance after them~~ — the root waits for its phases, and each phase's sign-off follows its
		// own press (these rows offer no Record Assurance: the hand is asked, and nothing pressed). After the press with no
		// answer, nothing: not its sign-off, not the next phase, not a reload.
		expect(l.only('beginExecute', 'recordAssurance', 'showOverview')).toEqual([
			'showOverview',
			'beginExecute requirements',
			'showOverview',
			'recordAssurance requirements',
			'showOverview',
			'beginExecute design',
			'showOverview',
			'recordAssurance design',
			'showOverview',
			'beginExecute implementation'
		]);
		expect(l.archives.map((a) => a.name).at(-1)).toBe('04-implementation');
		expect(record.end).toEqual({
			reason: 'allowance-exceeded',
			at: expect.any(String),
			detail: `Implementation and unit tests's Begin & Execute outlasted its allowance of ${PHASE7_UNIT_ALLOWANCE_MS} ms`
		});
		expect(laneVerdict(record)).toEqual([
			`the run ended 'allowance-exceeded', not 'complete': Implementation and unit tests's Begin & Execute outlasted its allowance of ${PHASE7_UNIT_ALLOWANCE_MS} ms`
		]);
	});

	it('⛔ D4 — a phase whose request FAILED IN TRANSIT ends the run there too, `request-failed`: the server may still be running it', async () => {
		const l = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, design: { outcome: LOST_IN_TRANSIT, after: STOPPED } }
		});
		const record = await l.run();
		// ⛔ MOVED (package M; design D7): ~~'beginExecute root'~~ first.
		expect(l.only('beginExecute')).toEqual(['beginExecute requirements', 'beginExecute design']);
		expect(record.units[2]!.beginExecute?.requestFailure).toBe('net::ERR_EMPTY_RESPONSE');
		expect([record.end?.reason, record.end?.detail]).toEqual([
			'request-failed',
			"Design's Begin & Execute failed in transit (net::ERR_EMPTY_RESPONSE): the server may have stopped, or may still be running it"
		]);
	});

	// ⛔ MOVED (package M; `REG-D-135` (2); design D7) — ~~"the ROOT's press with no answer ends the run before any phase, dry or
	// paid"~~ (dry: `allowance-exceeded`, no dry count; paid: `beginExecute root` alone, `request-failed`): the root is pressed
	// LAST now, once its phases are accepted, and never in a dry run. The rule it held — a press with no answer ends the run,
	// the root's included — is restated where the root's press now is.
	it('⛔ D4 — the ROOT’s press with no answer, LAST, ends the run there: nothing is pressed or signed off after it; dry, the root is never pressed', async () => {
		const dry = laneOf({ paid: false, presses: { ...ALL_COMPLETE, root: { outcome: OUTLASTED, after: STOPPED } } });
		const dryRecord = await dry.run();
		expect([dryRecord.end?.reason, dry.only('beginExecute')]).toEqual(['dry-run-stop', []]);
		const paid = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, root: { outcome: LOST_IN_TRANSIT, after: STOPPED } },
			signOffs: { root: GREEN, requirements: GREEN, design: GREEN, implementation: GREEN, 'end-to-end': GREEN }
		});
		const paidRecord = await paid.run();
		expect(paid.only('beginExecute').at(-1), 'the root was not the last press').toBe('beginExecute root');
		expect(paid.only('beginExecute', 'recordAssurance').slice(-2), 'something was pressed after the root’s lost press').toEqual([
			'recordAssurance end-to-end',
			'beginExecute root'
		]);
		expect(paidRecord.end?.reason).toBe('request-failed');
	});

	it('⛔ a throw AFTER a press with no answer keeps why the run ended — the archive of a unit still running must not relabel it a lane error', async () => {
		// ~~Reads: after the root; before requirements and after it; before design and after it; before implementation, and
		// — the seventh — after it~~ ⭐ (package M, D6): the order's read; for requirements and design each, its limit, its
		// upstream, after its press and its sign-off's limit (four each); then implementation's limit and upstream, and — the
		// twelfth — after it, as the server gone would leave it.
		const l = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, implementation: { outcome: OUTLASTED, after: STOPPED } },
			readThrowsAt: 12
		});
		await expect(l.run()).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:4322');
		expect([l.written().end?.reason, l.written().end?.detail]).toEqual([
			'allowance-exceeded',
			`Implementation and unit tests's Begin & Execute outlasted its allowance of ${PHASE7_UNIT_ALLOWANCE_MS} ms; then: connect ECONNREFUSED 127.0.0.1:4322`
		]);
	});

	it('⛔ D8 — at the sponsor’s limit, counting what the store records, the run ends `paid-limit` before the phase — ~~and what completed is still signed off, the root last~~ and the first sign-off, its own declared reviews counted, would cross it too: held back, and no later one is pressed (E12F F2)', async () => {
		// ⭑ `REG-D-108` — the prior spend is set against the limit, so the design phase is the one that reaches it. ⭐ R3-B's
		// fix round (F1) — ~~prior: PHASE7_PAID_LIMIT - 10, requirements recording 6~~: each phase counts ~~its worst case~~ ⭐
		// one try's reserve (`REG-D-114` (14), as amended 2026-10-16), so the prior lets requirements through exactly at the
		// limit, and requirements spends that reserve: the run then stands at the limit, with the same ~~446~~ ⭐ calls spent as before: the limit less the 4 held back, ~~596 at
		// today's 600 (P5 package C, F2)~~ ~~⭐ 646 at today's 650 (P6 package L, F1; `REG-D-120` Q15)~~ ~~⭐ 796 at today's 800
		// (package Q, F5; `REG-D-123` Q26)~~ ~~⭐ 896 at today's 900 (the review in parts, package C, B6; `REG-D-126` Q32)~~
		// ⭐ 996 at today's 1000 (the review in parts, package I, B8b; `REG-D-131` Q37).
		// ⭐ Package L — D16 (`REG-D-135` (4)): ~~TRY_RESERVE~~ the whole press, counted before requirements and spent by it.
		const prior = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS;
		const l = laneOf({
			paid: true,
			prior,
			presses: {
				root: ALL_COMPLETE.root!,
				requirements: { outcome: answered('success'), after: COMPLETED, calls: WHOLE_PRESS }
			},
			signOffs: { root: GREEN, requirements: GREEN }
		});
		const record = await l.run();
		// ⛔ `E12F` F2 — ~~'recordAssurance requirements', 'recordAssurance root'~~: a limit a phase may not cross, a sign-off's
		// worst case added, is crossed by the first sign-off — recorded unpressed, its row read and nothing pressed — and the
		// lane stops there: the root's is never attempted.
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6, D7): ~~'beginExecute root' first; then design's own check read past the
		// limit before any sign-off~~ — the root waits for its phases, and requirements' sign-off follows its own press, so it is
		// the FIRST act the limit stops: design is never checked, nor pressed. (A phase held back by its own check past the limit
		// is the D16 case below.)
		expect(l.only('beginExecute', 'recordAssurance', 'offersRecordAssurance')).toEqual([
			'beginExecute requirements',
			'offersRecordAssurance requirements'
		]);
		expect(record.units.filter((u) => u.signOff !== null).map((u) => [u.slug, u.signOff?.limitCheck?.allowed, u.signOff?.notPressed?.startsWith('the limit: ')])).toEqual([
			['requirements', false, true]
		]);
		expect([record.units[2]!.limitCheck, record.units[2]!.beginExecute], 'design was checked or pressed after the limit stopped the run').toEqual([null, null]);
		expect(record.units[2]!.notStarted).toBe('not started: offered, and the run ended before it was pressed');
		expect(laneVerdict(record)).toEqual(["the run ended 'paid-limit', not 'complete'"]);
	});

	// ── ⛔⛔ `E12F` — THE SIGN-OFF ASKS A REVIEWER SINCE E2: A DRY RUN STOPS BEFORE IT (F1), THE LIMIT SEES IT (F2), AND A REVIEW
	// THAT DID NOT CONCLUDE IS RE-RUN ONCE BY THE RULE (F3) ─────────────────────────────────────────────────────────────────
	// ⛔ MOVED (package M; `REG-D-135` (2); design D7) — ~~"E12F F1 (REG-D-112 (b)) — DRY: the root's sign-off stops BEFORE the
	// reviewer call — Record Assurance found on its row and NOT pressed, recorded not reached in a dry run"~~ (the root's row
	// read, `offersRecordAssurance root`, its sign-off recorded `DRY_SIGN_OFF_NOT_REACHED`): a dry run now presses no unit, so it
	// reaches no sign-off at all. What the case held — a dry sign-off asks no reviewer — holds the more strongly, and is held so.
	it('⛔ E12F F1 (REG-D-112 (b)) — DRY: no sign-off is reached at all, so none asks a reviewer: no Record Assurance read or pressed, no Mark Satisfied, no re-run, no model exchange — the order rehearsed instead (D7)', async () => {
		// ⛔ PREDICTED RED, read from the code: the dry run signed the root off by the paid run's own acts (D11) — Record
		// Assurance pressed, which since E2 asks the reviewer once per declared policy — and the verdict then said "the dry
		// run recorded 2 model exchange(s)": two paid calls, made by the run that may call no model.
		const l = laneOf({ paid: false, presses: ALL_COMPLETE, signOffs: { root: { ...GREEN, calls: 2 }, requirements: { ...GREEN, calls: 2 } } });
		const record = await l.run();
		expect(l.only('recordAssurance', 'markSatisfied', 'rerunDeclared', 'offersRecordAssurance'), 'the dry run reached a sign-off').toEqual([]);
		expect(record.units.map((u) => u.signOff)).toEqual([null, null, null, null, null]);
		expect([l.action('01-root-recordAssurance'), l.action('02-requirements-recordAssurance')]).toEqual([false, false]);
		expect(record.dryRun).toEqual({ modelExchanges: 0 });
		expect(laneVerdict(record), 'a dry run that reached no sign-off failed its verdict').toEqual([]);
	});

	it('⛔ E12F F2 — PAID: the limit is read before EACH SIGN-OFF, its own declared reviews counted at their bound: the last phase passes its check, and a sign-off that would cross the limit is NOT pressed — recorded, no later sign-off pressed, and the run ends `paid-limit`', async () => {
		// ⛔ PREDICTED RED, read from the code: every sign-off pressed — the limit was read before each phase and each re-run,
		// never before a sign-off, whose declared reviews (up to 16 calls for the design phase) it counted nowhere.
		// ⭐ R3-B's fix round (F1) — ~~prior: PHASE7_PAID_LIMIT - 20, each phase recording 1~~: each phase counts ~~its worst
		// case~~ ⭐ one try's reserve (`REG-D-114` (14), as amended 2026-10-16), so the run's calls are spent before it, or in its
		// last phase (`spentBySignOff`), and each sign-off reads the totals it did.
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6): ~~`spentBySignOff(PHASE7_PAID_LIMIT - 16)`, the calls spent in the last
		// phase; the last phase's own check passed; requirements' sign-off at the limit exactly (prior + 0 + 4 + 12), design's
		// 12 over it~~ — each sign-off now follows its own press, so the calls are spent in DESIGN's press (`spentBefore`): its own
		// check passes at the limit exactly, and its sign-off, its 4 × 6 counted, is the act that would cross it.
		const { prior, recorded, presses } = spentBefore('design', PHASE7_PAID_LIMIT - 16);
		const l = laneOf({
			paid: true,
			prior,
			presses,
			signOffs: { root: GREEN, requirements: GREEN, design: GREEN, implementation: GREEN, 'end-to-end': GREEN }
		});
		const record = await l.run();
		expect(record.units[2]!.limitCheck?.allowed, 'arrangement: design passes its own check').toBe(true);
		// ⭐ requirements (2 policies): prior + 0 + 4 + 12, under the limit, pressed; design (4): prior + 198 + 4 + 24, 12 over it,
		// held back — and the lane stops there: implementation and end-to-end are never pressed, and the root never offered.
		expect(l.only('recordAssurance', 'offersRecordAssurance'), 'a sign-off was pressed past the limit, or after it').toEqual([
			'recordAssurance requirements',
			'offersRecordAssurance design'
		]);
		expect(l.only('beginExecute'), 'a phase was pressed after the limit stopped the lane').toEqual([
			'beginExecute requirements',
			'beginExecute design'
		]);
		expect(record.units.map((u) => [u.slug, u.signOff?.limitCheck?.ahead, u.signOff?.limitCheck?.total, u.signOff?.limitCheck?.allowed])).toEqual([
			['root', undefined, undefined, undefined],
			['requirements', 12, prior + 16, true],
			['design', 24, PHASE7_PAID_LIMIT + 12, false],
			['implementation', undefined, undefined, undefined],
			['end-to-end', undefined, undefined, undefined]
		]);
		expect(
			[record.units[0]!.signOff, record.units[3]!.signOff, record.units[4]!.signOff],
			'a sign-off after the limit stopped the lane was attempted'
		).toEqual([null, null, null]);
		expect(record.units[2]!.signOff).toEqual({
			offered: true,
			limitCheck: { prior, recorded, reserve: 4, ahead: 24, counted: COUNTED_SIGN_OFF, total: PHASE7_PAID_LIMIT + 12, limit: PHASE7_PAID_LIMIT, allowed: false },
			recordAssurance: null,
			rerunDeclared: null,
			rerunLimitCheck: null,
			markSatisfied: null,
			refused: null,
			notPressed: `the limit: ${PHASE7_PAID_LIMIT + 12} of ${PHASE7_PAID_LIMIT} reviewer calls, the sign-off's own 24 counted (D8; E12F F2)`
		});
		// ⭐ Package L — D13: ~~[8, 8, 16, 12, 12]~~ — each unit's declared policies × 6.
		expect(PHASE7_ARCHIVE_UNITS.map((u) => signOffWorstCase(u)), 'each unit’s declared policies × reviewerCallsPerTry').toEqual([12, 12, 24, 18, 18]);
		expect([record.end?.reason, laneVerdict(record)]).toEqual(['paid-limit', ["the run ended 'paid-limit', not 'complete'"]]);
	});

	// ── ⭐⭐ ONE LIMIT RULE FOR EVERY CHECK (`REG-D-114` (14), the lead's delegated decision of 2026-10-16) ──────────────────
	// The lane may REACH the limit and never pass it by what it counts: the calls spent before, those the store records, those
	// held back and what the act itself counts must total AT MOST the limit. ⛔ Two rules stood, one per package: E12's checks
	// before a sign-off and before the rule's re-run of its declared reviews let an act through only UNDER the limit; E3's
	// before half B's Send and its root's press let it reach it. They differed only at a total equal to the limit, so each
	// check is held there: the two E12 checks went red at it; ~~the phase's, the re-run's,~~ Send's and the root's are
	// pinned. ~~⭐ R3-B's fix round (F1): the phase's and the re-run's count their WORST CASE now, as the root's does, and each
	// went red one call past the limit — the re-run of a review in `AT THE LIMIT a stopped phase is NOT re-run` — the
	// re-review's held at the limit too.~~ ⭐ `REG-D-114` (14), AS AMENDED 2026-10-16: the phase's, each re-run's and a MODEL
	// root's count ONE TRY'S RESERVE (D8's own rule: the lane checks again before every later press), each held at the limit
	// and one call past it; a sign-off's and a declared re-run's still count their worst case, and Send the authoring floor's.
	it('⛔ ONE RULE — a sign-off whose own worst case brings the total EXACTLY to the limit is pressed; the next, past it, is held back', async () => {
		// ⛔ PREDICTED RED, read from the code: `limitCheck` let a sign-off through only with its total UNDER the limit, so the
		// requirements unit's, its two declared policies' 8 calls bringing the total to the limit exactly, was held back.
		// ⭐ R3-B's fix round (F1) — ~~prior: the limit less the reserve and requirements' 8~~: each phase counts ~~its worst case~~
		// ⭐ one try's reserve, so the calls before the sign-offs are spent before the run (`spentBySignOff`), the same total.
		// ⛔ MOVED (package M; `REG-D-135` (2); design D6): ~~`spentBySignOff`, the calls spent in the last phase; the next, past the
		// limit, design's SIGN-OFF, held back (+ 12)~~ — requirements' sign-off follows its own press, which spends the calls
		// (`spentBefore`); the act after it, past the limit, is design's PRESS, held back; and one call more, requirements' own
		// sign-off is held back.
		const { prior, recorded, presses } = spentBefore(
			'requirements',
			PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - signOffWorstCase(PHASE7_ARCHIVE_UNITS[1]!)
		);
		const l = laneOf({
			paid: true,
			prior,
			presses,
			signOffs: { root: GREEN, requirements: GREEN, design: GREEN, implementation: GREEN, 'end-to-end': GREEN }
		});
		const record = await l.run();
		expect(l.only('recordAssurance', 'markSatisfied', 'beginExecute'), 'a sign-off that reaches the limit was held back').toEqual([
			'beginExecute requirements',
			'recordAssurance requirements',
			'markSatisfied requirements'
		]);
		expect([record.units[1]!.signOff?.limitCheck, record.units[2]!.limitCheck]).toEqual([
			// ⭐ Package L — D13: requirements' 2 × 6.
			{ prior, recorded, reserve: 4, ahead: 12, counted: COUNTED_SIGN_OFF, total: PHASE7_PAID_LIMIT, limit: PHASE7_PAID_LIMIT, allowed: true },
			{ prior, recorded, reserve: 4, ahead: WHOLE_PRESS, counted: COUNTED_PRESS, total: PHASE7_PAID_LIMIT - 12 + WHOLE_PRESS, limit: PHASE7_PAID_LIMIT, allowed: false }
		]);
		expect(record.end?.reason).toBe('paid-limit');
		// ⭑ One call more, and the sign-off itself is past the limit: held back, its row read, nothing pressed.
		const past = spentBefore('requirements', PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - signOffWorstCase(PHASE7_ARCHIVE_UNITS[1]!) + 1);
		const pastLane = laneOf({ paid: true, prior: past.prior, presses: past.presses, signOffs: { requirements: GREEN } });
		const held = await pastLane.run();
		expect([pastLane.only('recordAssurance'), held.units[1]!.signOff?.limitCheck?.total, held.units[1]!.signOff?.limitCheck?.allowed]).toEqual([
			[],
			PHASE7_PAID_LIMIT + 1,
			false
		]);
	});

	it('⛔ ONE RULE — the rule’s re-run of the declared reviews, its worst case bringing the total EXACTLY to the limit, is pressed', async () => {
		// ⛔ PREDICTED RED, read from the code: the re-run's check let it through only UNDER the limit, so design's re-run, its
		// four policies' 16 calls bringing the total to the limit exactly after Record Assurance spent 12, was held back.
		// ⭐ R3-B's fix round (F1) — ~~prior: the limit less the reserve, 16 and 12~~: each phase counts ~~its worst case~~ ⭐ one
		// try's reserve, so the calls before the sign-offs are spent before the run (`spentBySignOff`), the same total.
		// ⭐ Package L — D13: ~~16~~ design's re-run counts 4 × 6 = 24.
		// ⛔ MOVED (package M; design D6): ~~`spentBySignOff`, the calls spent in the last phase, and the run `complete`~~ — the
		// calls are spent in design's own press (`spentBefore`), its sign-off following it; after its re-run the total stands at
		// the limit, so the next phase's press is held back and the run ends `paid-limit`.
		const { prior, recorded, presses } = spentBefore('design', PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - 24 - 12);
		const l = laneOf({
			paid: true,
			prior,
			presses,
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				design: {
					ra: refusedWith(DID_NOT_CONCLUDE),
					raAfter: ASSESSING,
					calls: 12,
					rerun: { offered: true, outcome: answered('success'), after: ASSURED },
					msAfter: SATISFIED
				},
				implementation: GREEN,
				'end-to-end': GREEN
			}
		});
		const record = await l.run();
		expect(l.only('rerunDeclared'), 'a re-run of the declared reviews that reaches the limit was held back').toEqual([
			'rerunDeclared design'
		]);
		expect(record.units[2]!.signOff?.rerunLimitCheck).toEqual({
			prior,
			recorded: recorded + 12,
			reserve: 4,
			ahead: 24,
			counted: COUNTED_SIGN_OFF,
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		});
		expect(record.end?.reason).toBe('paid-limit');
	});

	// ~~⛔ REG-D-114 (14), AS AMENDED — before a phase it counts ONE TRY’S RESERVE~~ ⛔ SUPERSEDED (`REG-D-135` (4); design D16).
	it('⛔ D16 (REG-D-135 (4)) — before a phase it counts the press’s WHOLE worst case, (3 tries + 32 command runs) × 6 = 210: a phase is pressed with it reaching the limit exactly, and the next, one call past it, is not', async () => {
		// ⛔ PREDICTED RED (package L), read from the code: before a phase the one rule counted ONE TRY'S RESERVE, 4, so a phase
		// whose whole press passes the limit was pressed, and its own spend could carry the total past the limit (D16).
		// ⛔ PREDICTED RED, read from the code: before a phase the one rule counted the phase's WORST CASE, a model unit's 140
		// (R3-B's fix round, F1), so a phase whose one try's reserve reaches the limit exactly was held back — as every phase
		// would be once about 306 calls are spent ⭐ (at the limit of 450; ~~at today's 600, once 456 are: 600, less the 4 held back
		// and the phase's 140~~ ~~⭐ at today's 650, once 506 are: 650, less the 4 held back and the phase's 140, P6 package L, F1;
		// `REG-D-120` Q15~~ ~~⭐ at today's 800, once 656 are: 800, less the 4 held back and the phase's 140, package Q, F5;
		// `REG-D-123` Q26~~ ~~⭐ at today's 900, once 756 are: 900, less the 4 held back and the phase's 140, the review in parts,
		// package C, B6; `REG-D-126` Q32~~ ⭐ at today's 1000, once 856 are: 1000, less the 4 held back and the phase's 140, the
		// review in parts, package I, B8b; `REG-D-131` Q37) (`REG-D-114` (14), as amended 2026-10-16). ⭑ Every phase is scripted, so a lane
		// that presses one past the limit runs on and is caught here by the assertion, not by a script that has no press for it.
		const prior = PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - WHOLE_PRESS;
		const l = laneOf({
			paid: true,
			prior,
			presses: { ...ALL_COMPLETE, requirements: { outcome: answered('success'), after: COMPLETED, calls: 1 } },
			signOffs: { root: GREEN, requirements: GREEN }
		});
		const record = await l.run();
		// ⛔ MOVED (package M; design D7): ~~'beginExecute root'~~ first — the root waits for its phases.
		expect(l.only('beginExecute'), 'a phase whose whole press reaches the limit was held back, or the next, past it, pressed').toEqual([
			'beginExecute requirements'
		]);
		expect([record.units[1]!.limitCheck, record.units[2]!.limitCheck]).toEqual([
			{ prior, recorded: 0, reserve: 4, ahead: WHOLE_PRESS, counted: COUNTED_PRESS, total: PHASE7_PAID_LIMIT, limit: PHASE7_PAID_LIMIT, allowed: true },
			{ prior, recorded: 1, reserve: 4, ahead: WHOLE_PRESS, counted: COUNTED_PRESS, total: PHASE7_PAID_LIMIT + 1, limit: PHASE7_PAID_LIMIT, allowed: false }
		]);
		expect(record.end?.reason).toBe('paid-limit');
	});

	/**
	 * A paid run whose requirements phase stops, its row offering `rerun`, its own press having spent `spent` calls from none
	 * before the run: the rule's re-run of it is checked against what that press spent, ~~one try's reserve~~ ⭐ (package L,
	 * D16) the re-run's whole worst case ahead — a re-run of the work's whole press, a re-run of the review's refused reviews.
	 */
	const stoppedHaving = (rerun: 'rerunReview' | 'rerunWork', spent: number) =>
		laneOf({
			paid: true,
			prior: 0,
			presses: { ...ALL_COMPLETE, requirements: { outcome: answered('failure'), after: WAITING, calls: spent } },
			recoveries: {
				requirements: {
					offers: { rerunReview: rerun === 'rerunReview', rerunWork: true, abandon: true },
					acts: { [rerun]: { outcome: answered('success'), after: COMPLETED, calls: 1 } }
				}
			},
			signOffs: { root: GREEN, requirements: GREEN }
		});
	/** ⭐ D16 — the calls a stopped phase's press may spend for the re-run's worst case `ahead` to reach the limit exactly. */
	const reaching = (ahead: number) => PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - ahead;

	// ~~⛔ REG-D-114 (14), AS AMENDED — before the rule’s re-run of a stopped phase’s REVIEW it counts ONE TRY’S RESERVE~~ ⛔ SUPERSEDED.
	it('⛔ D16 (REG-D-135 (4)) — before the rule’s re-run of a stopped phase’s REVIEW it counts its refused reviews × 6 — here every review the attempt holds, the store naming none: one reaching the limit exactly is pressed, and one a call past it is not', async () => {
		// ⛔ PREDICTED RED (package L), read from the code: the re-run counted ONE TRY'S RESERVE, 4, so a re-run whose refused
		// reviews pass the limit was pressed. ⭑ The phase's own check passes under either count (its press is the whole of the
		// spend before it), so the red is the re-run's. The re-run and every phase are scripted.
		const at = stoppedHaving('rerunReview', reaching(REREVIEW_UNREAD));
		const pressed = await at.run();
		expect(at.only('recover '), 'a re-run of the review whose refused reviews reach the limit was held back').toEqual([
			'recover requirements rerunReview'
		]);
		expect(pressed.units[1]!.recovery[0]?.limitCheck).toEqual({
			prior: 0,
			recorded: reaching(REREVIEW_UNREAD),
			reserve: 4,
			ahead: REREVIEW_UNREAD,
			counted: COUNTED_REREVIEW_UNREAD,
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		});
		// ⭑ Pressed, it spends a call, and the next phase is held back past the limit.
		// ⛔ MOVED (package M; design D7): ~~'beginExecute root'~~ first.
		expect([at.only('beginExecute'), pressed.end?.reason]).toEqual([['beginExecute requirements'], 'paid-limit']);
		const past = stoppedHaving('rerunReview', reaching(REREVIEW_UNREAD) + 1);
		const held = await past.run();
		expect(past.only('recover '), 'a re-run of the review whose refused reviews pass the limit was pressed').toEqual([]);
		expect(held.units[1]!.recovery.map((r) => [r.act, r.limitCheck?.total, r.limitCheck?.allowed, r.notPressed])).toEqual([
			['rerunReview', PHASE7_PAID_LIMIT + 1, false, `the limit: ${PHASE7_PAID_LIMIT + 1} of ${PHASE7_PAID_LIMIT} reviewer calls (D8)`]
		]);
	});

	it('⭐ D16 (REG-D-135 (4)) — where the store NAMES the stopped attempt’s refused reviews, the re-run of the review counts those × 6, never every review the attempt could hold: two named, 12 — at the limit exactly, pressed; a call past it, not', async () => {
		// ⛔ PREDICTED RED (package L): the re-run counted ONE TRY'S RESERVE, 4, whatever the store named. ⭑ The server re-runs the
		// refused reviews alone (`rerunReview`), so counting every review the attempt could hold (198) would refuse a re-run that
		// fits — the count the store names is the press's whole worst case.
		const named = (spent: number) =>
			laneOf({
				paid: true,
				prior: 0,
				refusedReviews: { requirements: 2 },
				presses: { ...ALL_COMPLETE, requirements: { outcome: answered('failure'), after: WAITING, calls: spent } },
				recoveries: {
					requirements: {
						offers: { rerunReview: true, rerunWork: true, abandon: true },
						acts: { rerunReview: { outcome: answered('success'), after: COMPLETED, calls: 1 } }
					}
				},
				signOffs: { root: GREEN, requirements: GREEN }
			});
		const at = named(reaching(2 * 6));
		const pressed = await at.run();
		expect(at.only('recover '), 'a re-run of the review whose two refused reviews reach the limit was held back').toEqual([
			'recover requirements rerunReview'
		]);
		expect(pressed.units[1]!.recovery[0]?.limitCheck).toEqual({
			prior: 0,
			recorded: reaching(2 * 6),
			reserve: 4,
			ahead: 2 * 6,
			counted: 'its refused reviews’ worst case, 2 × 6 calls',
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		});
		const past = named(reaching(2 * 6) + 1);
		await past.run();
		expect(past.only('recover '), 'a re-run of the review whose two refused reviews pass the limit was pressed').toEqual([]);
	});

	// ~~⛔ REG-D-114 (14), AS AMENDED — before the rule’s re-run of a stopped phase’s WORK it counts ONE TRY’S RESERVE~~ ⛔ SUPERSEDED.
	it('⛔ D16 (REG-D-135 (4)) — before the rule’s re-run of a stopped phase’s WORK it counts the press’s WHOLE worst case, 210: one reaching the limit exactly is pressed, and one a call past it is not', async () => {
		// ⛔ PREDICTED RED (package L), read from the code: the re-run of the work counted ONE TRY'S RESERVE, 4, so a re-run
		// whose whole press passes the limit was pressed. ⭑ The phase's own check passes under either count, so the red is the
		// re-run's. The re-run and every phase are scripted.
		const at = stoppedHaving('rerunWork', reaching(WHOLE_PRESS));
		const pressed = await at.run();
		expect(at.only('recover '), 'a re-run of the work whose whole press reaches the limit was held back').toEqual([
			'recover requirements rerunWork'
		]);
		expect(pressed.units[1]!.recovery[0]?.limitCheck).toEqual({
			prior: 0,
			recorded: reaching(WHOLE_PRESS),
			reserve: 4,
			ahead: WHOLE_PRESS,
			counted: COUNTED_PRESS,
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: true
		});
		const past = stoppedHaving('rerunWork', reaching(WHOLE_PRESS) + 1);
		const held = await past.run();
		expect(past.only('recover '), 'a re-run of the work whose whole press passes the limit was pressed').toEqual([]);
		expect(held.units[1]!.recovery.map((r) => [r.act, r.limitCheck, r.notPressed])).toEqual([
			[
				'rerunWork',
				{ prior: 0, recorded: reaching(WHOLE_PRESS) + 1, reserve: 4, ahead: WHOLE_PRESS, counted: COUNTED_PRESS, total: PHASE7_PAID_LIMIT + 1, limit: PHASE7_PAID_LIMIT, allowed: false },
				`the limit: ${PHASE7_PAID_LIMIT + 1} of ${PHASE7_PAID_LIMIT} reviewer calls (D8)`
			]
		]);
		expect(held.end?.reason).toBe('paid-limit');
	});

	it('⭐ R3-B F2 (the lead’s delegated decision of 2026-10-16, registered as REG-D-114 (15)) — half A’s sign-off presses are each given §3.2’s bound, four policies’ reviews: its values do not change', async () => {
		// ⛔ PREDICTED RED, read from the code: the lane gave its sign-off hands no bound at all — the press chose its own, the
		// same for every unit of either half (`PHASE7_RECORD_ASSURANCE_MS`).
		const l = laneOf({
			paid: true,
			prior: 10,
			presses: ALL_COMPLETE,
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				design: {
					ra: refusedWith(DID_NOT_CONCLUDE),
					raAfter: ASSESSING,
					rerun: { offered: true, outcome: answered('success'), after: ASSURED },
					msAfter: SATISFIED
				},
				implementation: GREEN,
				'end-to-end': GREEN
			}
		});
		await l.run();
		expect(l.bounds, 'a sign-off press of half A was not given §3.2’s bound').toEqual([
			['recordAssurance requirements', PHASE7_RECORD_ASSURANCE_MS],
			['recordAssurance design', PHASE7_RECORD_ASSURANCE_MS],
			['rerunDeclared design', PHASE7_RECORD_ASSURANCE_MS],
			['recordAssurance implementation', PHASE7_RECORD_ASSURANCE_MS],
			['recordAssurance end-to-end', PHASE7_RECORD_ASSURANCE_MS],
			['recordAssurance root', PHASE7_RECORD_ASSURANCE_MS]
		]);
	});

	it('⭐ E12F F3 (REG-D-105 (4), REG-D-112 (a)) — PAID: a Record Assurance refused whose row, read afresh, offers re-running the declared reviews that did not conclude has them re-run ONCE by the rule, the limit read first; accepted, Mark Satisfied follows', async () => {
		// ⛔ PREDICTED RED, read from the code: the refused Record Assurance was recorded and the unit left — UNDER_ASSURANCE and
		// ASSESSING, stranded, as the page then offered it nothing to do.
		const l = laneOf({
			paid: true,
			prior: 10,
			presses: ALL_COMPLETE,
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				design: {
					ra: refusedWith(DID_NOT_CONCLUDE),
					raAfter: ASSESSING,
					calls: 4,
					rerun: { offered: true, outcome: answered('success'), after: ASSURED, calls: 1 },
					msAfter: SATISFIED
				},
				implementation: GREEN,
				'end-to-end': GREEN
			}
		});
		const record = await l.run();
		const onDesign = l.calls.filter((c) => c.endsWith(' design'));
		expect(onDesign, 'the rule did not re-run the declared reviews of a refused sign-off').toEqual([
			'beginExecute design',
			'recordAssurance design',
			'offersDeclaredRerun design',
			'rerunDeclared design',
			'markSatisfied design'
		]);
		const design = record.units[2]!.signOff!;
		expect([design.rerunDeclared, design.rerunLimitCheck?.ahead, design.rerunLimitCheck?.allowed, design.markSatisfied?.after, design.refused]).toEqual([
			actAnswered('success', ASSURED),
			// ⭐ Package L — D13: ~~16~~ 4 × 6.
			24,
			true,
			SATISFIED,
			null
		]);
		// ⭐ E12's re-review F4 — Record Assurance's refusal is KEPT, on its own act, though no refusal stands: the rule's accepted
		// re-run stood in for it, and Mark Satisfied was accepted.
		expect([design.recordAssurance?.refusal, design.rerunDeclared?.refusal, design.markSatisfied?.refusal]).toEqual([
			DID_NOT_CONCLUDE,
			null,
			null
		]);
		expect(l.action('03-design-rerunDeclaredReviews'), 'the re-run’s answer was not kept').toBe(true);
		expect([record.end?.reason, laneVerdict(record)]).toEqual(['complete', []]);
	});

	it('⛔ E12F F3 — a declared re-run refused again is LEFT AS FOUND: never a second re-run, no Mark Satisfied; a row offering none, and one the limit stops, are left as found too', async () => {
		const refusedTwice = await laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: {
				root: GREEN,
				design: { ra: refusedWith(DID_NOT_CONCLUDE), raAfter: ASSESSING, rerun: { offered: true, outcome: answered('failure'), after: ASSESSING } }
			}
		}).run();
		const twice = refusedTwice.units[2]!.signOff!;
		expect([twice.rerunDeclared?.envelopeType, twice.markSatisfied, twice.refused]).toEqual([
			'failure',
			null,
			{ act: 'Re-run the declared reviews', reason: '{"type":"failure"}' }
		]);
		// ⭐ E12's re-review F4 — the refusal that stands is the re-run's; Record Assurance's own is kept on its act.
		expect([twice.recordAssurance?.refusal, twice.rerunDeclared?.refusal]).toEqual([DID_NOT_CONCLUDE, '{"type":"failure"}']);
		const notOffered = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: { root: GREEN, design: { ra: answered('failure'), raAfter: ASSESSING, rerun: { offered: false } } }
		});
		const left = (await notOffered.run()).units[2]!.signOff!;
		expect([left.rerunDeclared, left.refused?.act, notOffered.only('rerunDeclared')]).toEqual([null, 'Record Assurance', []]);
		// ⭐ The limit read before the re-run stops it, as before a phase: recorded, the run ends `paid-limit`, and the lane stops
		// there — the root's sign-off, prior + 12 + 4 + 8, 6 under the limit, which would fit, is never attempted. ⭐ The merge
		// of E12 and E3 — stated against `PHASE7_PAID_LIMIT`, now ~~450~~ ~~⭐ 600 (`REG-D-117` Q10; P5 package C, F2)~~ ~~⭐ 650
		// (`REG-D-120` Q15; P6 package L, F1)~~ ⭐ 800 (`REG-D-123` Q26; package Q, F5):
		// ~~200 + 12 + 4 + 8 = 224~~. ⭐ R3-B's fix round (F1) —
		// ~~prior: PHASE7_PAID_LIMIT - 30~~: each phase counts ~~its worst case~~ ⭐ one try's reserve (`REG-D-114` (14), as
		// amended 2026-10-16), so the calls before the sign-offs are spent before the run, or in its last phase
		// (`spentBySignOff`), and "prior" above is those calls, the same total.
		// ⛔ MOVED (package M; design D6): ~~`spentBySignOff`~~ — spent in design's own press, its sign-off following it.
		const near = spentBefore('design', PHASE7_PAID_LIMIT - 30);
		const limited = laneOf({
			paid: true,
			prior: near.prior,
			presses: near.presses,
			signOffs: {
				root: GREEN,
				design: { ra: answered('failure'), raAfter: ASSESSING, calls: 12, rerun: { offered: true, outcome: answered('success'), after: ASSURED } }
			}
		});
		const stopped = await limited.run();
		const atTheLimit = stopped.units[2]!.signOff!;
		expect([atTheLimit.rerunLimitCheck?.allowed, atTheLimit.rerunDeclared, limited.only('rerunDeclared'), stopped.end?.reason]).toEqual([
			false,
			null,
			[],
			'paid-limit'
		]);
		expect([atTheLimit.notPressed, stopped.units[0]!.signOff, limited.only('recordAssurance root')]).toEqual([
			// ⭐ Package L — D13: ~~+ 2, 16~~ — 30 under, design's 12 spent, 4 held back and its re-run's 4 × 6: 10 over.
			`the limit: ${PHASE7_PAID_LIMIT + 10} of ${PHASE7_PAID_LIMIT} reviewer calls, the sign-off's own 24 counted (D8; E12F F2)`,
			null,
			[]
		]);
		// ⭐ Package M (`REG-D-135` (2); design D6) — AND THE LANE STOPS THERE: no later unit's press is checked, the page's offers
		// are not read again. ⛔ Since the sign-off follows each press in the one loop, a lane that ignored the re-run's limit
		// still ended `paid-limit` — at the NEXT unit's own check, its whole press past the limit — so the run's end alone no
		// longer told the two apart (E12-M64, measured SURVIVED by this package's first run, 2026-10-26, before this pin).
		expect(
			[stopped.units[3]!.limitCheck, stopped.units[4]!.limitCheck],
			'the lane went on to check a later press after the limit stopped the re-run'
		).toEqual([null, null]);
	});

	it('⛔ E12F F3 — a Record Assurance with NO ANSWER is left as found: the rule re-runs nothing beside a press the server may still be running (D4), whatever the row then offers', async () => {
		// ⛔ PREDICTED RED, read from the code: the rule took any Record Assurance short of success — one that outlasted its
		// bound, or whose request failed in transit — for a refusal, read the row afresh and re-ran the declared reviews.
		const unanswered: readonly ActionOutcome[] = [
			{ ...OUTLASTED, timedOutAfterMs: PHASE7_RECORD_ASSURANCE_MS },
			LOST_IN_TRANSIT
		];
		for (const ra of unanswered) {
			const l = laneOf({
				paid: true,
				presses: ALL_COMPLETE,
				signOffs: {
					root: GREEN,
					design: { ra, raAfter: ASSESSING, rerun: { offered: true, outcome: answered('success'), after: ASSURED } }
				}
			});
			const design = (await l.run()).units[2]!.signOff!;
			expect(
				[l.only('offersDeclaredRerun', 'rerunDeclared', 'markSatisfied design'), design.rerunDeclared, design.refused],
				refusalOf(ra)
			).toEqual([[], null, { act: 'Record Assurance', reason: refusalOf(ra) }]);
		}
	});

	// ── ⛔⛔ E12’s re-review F1 (D4; `REG-F-535`) — A SIGN-OFF ACT WITH NO ANSWER ENDS THE RUN THERE ───────────────────────────
	// Since E2 a sign-off act asks the reviewer, and each declared review records its calls only when it finishes: a press
	// beside one still running runs two units' reviews at once, and the limit read before it misses the calls in flight.
	it('⛔ E12’s re-review F1 (D4) — a Record Assurance with NO ANSWER ends the run there: nothing is pressed beside it, the final archive is taken, and the run ends for the act', async () => {
		// ⛔ PREDICTED RED, read from the code: the unanswered press was recorded refused and the lane went on — the page loaded,
		// implementation's limit read without design's calls in flight, its Record Assurance pressed, then the root's — and the
		// run ended `complete`.
		const l = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				design: { ra: { ...OUTLASTED, timedOutAfterMs: PHASE7_RECORD_ASSURANCE_MS }, raAfter: ASSESSING },
				implementation: GREEN,
				'end-to-end': GREEN
			}
		});
		const record = await l.run();
		expect(
			l.only('recordAssurance', 'offersRecordAssurance', 'offersDeclaredRerun', 'rerunDeclared', 'markSatisfied'),
			'an act was pressed beside a Record Assurance with no answer'
		).toEqual(['recordAssurance requirements', 'markSatisfied requirements', 'recordAssurance design']);
		const detail = `Design's Record Assurance outlasted its allowance of ${PHASE7_RECORD_ASSURANCE_MS} ms`;
		expect(record.end).toEqual({ reason: 'allowance-exceeded', at: expect.any(String), detail });
		// ⭐ The store read after it, then the final archive, which holds the sign-offs made before it — and nothing else.
		expect(l.calls.slice(l.calls.indexOf('recordAssurance design'))).toEqual([
			'recordAssurance design',
			'read',
			'screenshot 06-final',
			'read',
			'archive 06-final',
			'flushPosts'
		]);
		const design = record.units[2]!.signOff!;
		expect([design.recordAssurance, design.refused]).toEqual([
			{ status: null, envelopeType: null, timedOutAfterMs: PHASE7_RECORD_ASSURANCE_MS, requestFailure: null, refusal: null, after: ASSESSING },
			{ act: 'Record Assurance', reason: `no answer within ${PHASE7_RECORD_ASSURANCE_MS} ms` }
		]);
		expect(
			[record.units[3]!.signOff, record.units[4]!.signOff, record.units[0]!.signOff],
			'a sign-off after the unanswered one was attempted'
		).toEqual([null, null, null]);
		expect(l.written().end?.reason).toBe('allowance-exceeded');
		expect(laneVerdict(record)).toEqual([`the run ended 'allowance-exceeded', not 'complete': ${detail}`]);
	});

	it('⛔ E12’s re-review F1 (D4) — and so does the rule’s re-run of the declared reviews with no answer, a Record Assurance lost in transit, and — D4’s general form — a Mark Satisfied with none', async () => {
		const outlasted = (ms: number): ActionOutcome => ({ ...OUTLASTED, timedOutAfterMs: ms });
		const cases = [
			{
				design: {
					ra: answered('failure'),
					raAfter: ASSESSING,
					rerun: { offered: true, outcome: outlasted(PHASE7_RECORD_ASSURANCE_MS), after: ASSESSING }
				},
				last: 'rerunDeclared design',
				end: ['allowance-exceeded', `Design's Re-run the declared reviews outlasted its allowance of ${PHASE7_RECORD_ASSURANCE_MS} ms`]
			},
			{
				design: { ra: LOST_IN_TRANSIT, raAfter: ASSESSING },
				last: 'recordAssurance design',
				end: [
					'request-failed',
					"Design's Record Assurance failed in transit (net::ERR_EMPTY_RESPONSE): the server may have stopped, or may still be running it"
				]
			},
			{
				design: { ...GREEN, ms: outlasted(PHASE7_SIGN_OFF_MS) },
				last: 'markSatisfied design',
				end: ['allowance-exceeded', `Design's Mark Satisfied outlasted its allowance of ${PHASE7_SIGN_OFF_MS} ms`]
			}
		];
		for (const c of cases) {
			const l = laneOf({
				paid: true,
				presses: ALL_COMPLETE,
				signOffs: { root: GREEN, requirements: GREEN, design: c.design, implementation: GREEN, 'end-to-end': GREEN }
			});
			const record = await l.run();
			const acts = l.only('recordAssurance', 'offersRecordAssurance', 'offersDeclaredRerun', 'rerunDeclared', 'markSatisfied');
			expect(acts.slice(acts.indexOf(c.last) + 1), `${c.last}: an act was pressed after it`).toEqual([]);
			expect([record.end?.reason, record.end?.detail], c.last).toEqual(c.end);
			expect(l.archives.at(-1)?.name, `${c.last}: the final archive was not taken`).toBe('06-final');
		}
	});

	it('⛔ E12’s re-review F1 — a throw AFTER a sign-off act with no answer keeps why the run ended: the store read beside reviews still running must not relabel it a lane error', async () => {
		// ⭑ Reads: ~~the root's; two per phase (its limit, its store); requirements' limit, then the store after its Record
		// Assurance and after its Mark Satisfied; design's limit — and, the fourteenth, the store after design's Record
		// Assurance~~ ⭐ (package M, D6): the order's; requirements' limit, upstream and store, its sign-off's limit, and the store
		// after its Record Assurance and after its Mark Satisfied (2 to 7); design's limit, upstream and store, its sign-off's
		// limit — and, the twelfth, the store after design's Record Assurance, as a server gone would leave it.
		const l = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				design: { ra: { ...OUTLASTED, timedOutAfterMs: PHASE7_RECORD_ASSURANCE_MS }, raAfter: ASSESSING }
			},
			readThrowsAt: 12
		});
		await expect(l.run()).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:4322');
		expect([l.written().end?.reason, l.written().end?.detail]).toEqual([
			'allowance-exceeded',
			`Design's Record Assurance outlasted its allowance of ${PHASE7_RECORD_ASSURANCE_MS} ms; then: connect ECONNREFUSED 127.0.0.1:4322`
		]);
		// ⛔ E12's polish (the confirm's F1 residue) — AND THE ACT AND ITS BOUND ARE KEPT, whatever the read did. ⛔ PREDICTED RED,
		// driven by the confirm: design's sign-off was assigned only when `signOff` returned, so lane/run.json held none, and the
		// report read the lane's own end as a problem with its inputs and design's stage 7 as a sign-off never attempted.
		const kept = l.written().units[2]!.signOff;
		expect(
			[kept?.offered, kept?.limitCheck?.allowed, kept?.recordAssurance, kept?.refused],
			'the act and its bound were lost with the read after it'
		).toEqual([
			true,
			true,
			{ status: null, envelopeType: null, timedOutAfterMs: PHASE7_RECORD_ASSURANCE_MS, requestFailure: null, refusal: null, after: null },
			{ act: 'Record Assurance', reason: `no answer within ${PHASE7_RECORD_ASSURANCE_MS} ms` }
		]);
		// ⭐ And on disk BEFORE the read: a run killed while it hung would leave it too — no catch writes then.
		expect(
			l.onDiskAtTheFailedRead()?.units[2]?.signOff?.recordAssurance?.timedOutAfterMs,
			'the act was not on disk when the read began'
		).toBe(PHASE7_RECORD_ASSURANCE_MS);
	});

	it('⛔ E12’s polish (the confirm’s F1 residue, its general form) — whatever the store read after it does, an act the lane pressed stays in lane/run.json with its bound: the rule’s re-run of the declared reviews, a Mark Satisfied, and a recovery act', async () => {
		const outlasted = (ms: number): ActionOutcome => ({ ...OUTLASTED, timedOutAfterMs: ms });
		const gone = 'connect ECONNREFUSED 127.0.0.1:4322';
		// ⭑ Reads, as above, to design's sign-off's limit (~~13~~ 11, package M); then the store after its refused Record
		// Assurance (~~14~~ 12), the re-run's limit (~~15~~ 13) and — the ~~sixteenth~~ fourteenth — the store after the re-run,
		// which got no answer.
		const rerun = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: {
				root: GREEN,
				requirements: GREEN,
				design: { ra: answered('failure'), raAfter: ASSESSING, rerun: { offered: true, outcome: outlasted(PHASE7_RECORD_ASSURANCE_MS), after: ASSESSING } }
			},
			readThrowsAt: 14
		});
		await expect(rerun.run()).rejects.toThrow(gone);
		const reran = rerun.written().units[2]!.signOff;
		expect([reran?.recordAssurance?.after, reran?.rerunLimitCheck?.allowed, reran?.rerunDeclared, reran?.refused], 'the re-run').toEqual([
			ASSESSING,
			true,
			{ status: null, envelopeType: null, timedOutAfterMs: PHASE7_RECORD_ASSURANCE_MS, requestFailure: null, refusal: null, after: null },
			{ act: 'Re-run the declared reviews', reason: `no answer within ${PHASE7_RECORD_ASSURANCE_MS} ms` }
		]);
		// ⭑ Design's sign-off's limit (~~13~~ 11, package M), the store after its accepted Record Assurance (~~14~~ 12), and — the
		// ~~fifteenth~~ thirteenth — after Mark Satisfied, whose request failed in transit.
		const satisfied = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: { root: GREEN, requirements: GREEN, design: { ...GREEN, ms: LOST_IN_TRANSIT } },
			readThrowsAt: 13
		});
		await expect(satisfied.run()).rejects.toThrow(gone);
		const marked = satisfied.written().units[2]!.signOff;
		expect([satisfied.written().end?.reason, marked?.recordAssurance?.after, marked?.markSatisfied, marked?.refused], 'Mark Satisfied').toEqual([
			'request-failed',
			ASSURED,
			{ status: null, envelopeType: null, timedOutAfterMs: null, requestFailure: 'net::ERR_EMPTY_RESPONSE', refusal: null, after: null },
			{ act: 'Mark Satisfied', reason: 'no answer: the request failed in transit (net::ERR_EMPTY_RESPONSE)' }
		]);
		// ⭑ D4's general form, the run plan's rule — reads: ~~the root's~~ the order's (package M); requirements' limit, upstream
		// and store; the re-run's limit; and — the ~~fifth~~ sixth — the store after the re-run of its review, which got no answer.
		const recovered = laneOf({
			paid: true,
			presses: { ...OTHERS_COMPLETE, requirements: { outcome: answered('failure'), after: WAITING } },
			recoveries: { requirements: { offers: EVERY_OFFER, acts: { rerunReview: { outcome: outlasted(PHASE7_UNIT_ALLOWANCE_MS), after: WAITING } } } },
			signOffs: OTHERS_GREEN,
			readThrowsAt: 6
		});
		await expect(recovered.run()).rejects.toThrow(gone);
		expect(
			recovered.written().units[1]!.recovery.map((r) => [r.act, r.limitCheck?.allowed, r.timedOutAfterMs, r.after, r.reading]),
			'the recovery act'
		).toEqual([['rerunReview', true, PHASE7_UNIT_ALLOWANCE_MS, null, null]]);
		expect(recovered.written().end?.reason).toBe('allowance-exceeded');
		expect(
			recovered.onDiskAtTheFailedRead()?.units[1]?.recovery.map((r) => r.timedOutAfterMs),
			'the recovery act was not on disk when the read began'
		).toEqual([PHASE7_UNIT_ALLOWANCE_MS]);
	});

	it('⛔ E12’s polish (fix3’s F1) — the store read after an accepted Record Assurance completes the act on the unit’s record, written before Mark Satisfied: a throw in Mark Satisfied’s wait leaves lane/run.json the state read, not `after: null`', async () => {
		// ⭑ Requirements' Record Assurance accepted, and the store read after it came back; then its Mark Satisfied hand
		// throws before it presses, as its wait for Record Assurance to leave the row does at its bound. ⛔ PREDICTED RED,
		// driven by the check: the read's state was returned and never written back, so lane/run.json kept the act as it
		// stood before the read, `after` null.
		const l = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: { root: GREEN, requirements: GREEN },
			markSatisfiedThrowsOn: 'requirements'
		});
		await expect(l.run()).rejects.toThrow(`locator.waitFor: Timeout ${PHASE7_UI_MS}ms exceeded.`);
		expect(l.calls.slice(l.calls.indexOf('recordAssurance requirements')), 'the throw came after the read').toEqual([
			'recordAssurance requirements',
			'read',
			'markSatisfied requirements',
			'flushPosts'
		]);
		expect(
			[l.written().end?.reason, l.written().units[1]!.signOff?.recordAssurance],
			'the state the read after Record Assurance came back with was lost'
		).toEqual(['lane-error', actAnswered('success', ASSURED)]);
		// ⭐ And on disk before Mark Satisfied: a run killed in its wait gets no catch to write the record.
		expect(
			l.onDiskWhenMarkSatisfiedThrew()?.units[1]?.signOff?.recordAssurance?.after,
			'the state read was not on disk when Mark Satisfied began'
		).toEqual(ASSURED);
	});

	it('⛔ E12’s polish (fix3’s F1, its general form) — and after a REFUSED Record Assurance: a throw before the rule’s re-run of the declared reviews leaves lane/run.json the state read', async () => {
		// ⭑ Reads to requirements' sign-off's limit (~~10~~ 5, package M: the order's, then its limit, upstream and store); the
		// store after its refused Record Assurance (~~11~~ 6); and — the ~~twelfth~~ seventh — the limit before the rule's re-run,
		// which throws as a server gone would. The re-run is never pressed.
		const l = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: { root: GREEN, requirements: { ra: answered('failure'), raAfter: ASSESSING, rerun: { offered: true } } },
			readThrowsAt: 7
		});
		await expect(l.run()).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:4322');
		expect(l.calls.slice(l.calls.indexOf('recordAssurance requirements')), 'the throw came after the read').toEqual([
			'recordAssurance requirements',
			'read',
			'showOverview',
			'offersDeclaredRerun requirements',
			'read',
			'flushPosts'
		]);
		expect(
			l.written().units[1]!.signOff?.recordAssurance,
			'the state the read after Record Assurance came back with was lost'
		).toEqual(actAnswered('failure', ASSESSING));
		expect(
			l.onDiskAtTheFailedRead()?.units[1]?.signOff?.recordAssurance?.after,
			'the state read was not on disk when the re-run’s limit was read'
		).toEqual(ASSESSING);
	});

	it('⛔ E12’s polish (fix3’s F1, its general form) — and after the rule’s ACCEPTED re-run of the declared reviews: a throw in Mark Satisfied’s wait leaves lane/run.json the state read after the re-run', async () => {
		// ⭑ Requirements' Record Assurance refused, and the rule's re-run of its declared reviews accepted, the store read
		// after each; then the Mark Satisfied hand throws before it presses.
		const l = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: {
				root: GREEN,
				requirements: {
					ra: answered('failure'),
					raAfter: ASSESSING,
					rerun: { offered: true, outcome: answered('success'), after: ASSURED }
				}
			},
			markSatisfiedThrowsOn: 'requirements'
		});
		await expect(l.run()).rejects.toThrow(`locator.waitFor: Timeout ${PHASE7_UI_MS}ms exceeded.`);
		expect(l.calls.slice(l.calls.indexOf('recordAssurance requirements')), 'the throw came after the reads').toEqual([
			'recordAssurance requirements',
			'read',
			'showOverview',
			'offersDeclaredRerun requirements',
			'read',
			'rerunDeclared requirements',
			'read',
			'markSatisfied requirements',
			'flushPosts'
		]);
		const kept = l.written().units[1]!.signOff;
		expect(
			[kept?.recordAssurance, kept?.rerunDeclared],
			'the state the read after the re-run came back with was lost'
		).toEqual([actAnswered('failure', ASSESSING), actAnswered('success', ASSURED)]);
		expect(
			l.onDiskWhenMarkSatisfiedThrew()?.units[1]?.signOff?.rerunDeclared?.after,
			'the state read was not on disk when Mark Satisfied began'
		).toEqual(ASSURED);
	});

	it('⛔ an `error` envelope, and a redirect, reload the page before the store is read; a refusal does not', async () => {
		const l = laneOf({
			paid: true,
			presses: {
				...ALL_COMPLETE,
				requirements: { outcome: answered('error', 500), after: STOPPED },
				design: { outcome: answered('failure'), after: STOPPED },
				implementation: { outcome: answered('redirect'), after: STOPPED }
			},
			signOffs: { root: GREEN, 'end-to-end': GREEN }
		});
		await l.run();
		// ⭐ P7-6R R-1f: after the store is read, the run plan's rule loads the page again to read a stopped phase's choices —
		// AFTER the read, so each press is held to what comes between it and the store's first read.
		const beforeTheRead = (slug: string): string[] => {
			const pressed = l.calls.indexOf(`beginExecute ${slug}`);
			return l.calls
				.slice(pressed + 1, l.calls.indexOf('read', pressed))
				.filter((c) => c === 'showOverview');
		};
		expect(['requirements', 'design', 'implementation'].map(beforeTheRead)).toEqual([
			['showOverview'],
			[],
			['showOverview']
		]);
	});

	it('⛔ a unit whose row offers no Record Assurance is recorded as offered none, and nothing is pressed on it', async () => {
		const l = laneOf({
			paid: true,
			presses: ALL_COMPLETE,
			signOffs: { root: GREEN, requirements: { ra: null } }
		});
		const record = await l.run();
		expect(record.units[1]!.signOff).toEqual({
			offered: false,
			// ⭐ `E12F` F2 — read before the row was: it would have allowed the press. ⭐ Package L — D13: ~~8, 12~~ 2 × 6, 16.
			limitCheck: { prior: 0, recorded: 0, reserve: 4, ahead: 12, counted: COUNTED_SIGN_OFF, total: 16, limit: PHASE7_PAID_LIMIT, allowed: true },
			recordAssurance: null,
			rerunDeclared: null,
			rerunLimitCheck: null,
			markSatisfied: null,
			refused: null,
			notPressed: null
		});
		expect(l.only('markSatisfied requirements')).toEqual([]);
	});

	it('⛔ an instantiation that did not build one unit per type ends the run, a lane error saying so, before anything is pressed', async () => {
		const titles = PHASE7_ARCHIVE_UNITS.map((u) => u.title);
		const l = laneOf({ paid: false, presses: ALL_COMPLETE, titles: titles.slice(0, 4) });
		await expect(l.run()).rejects.toThrow('instantiation did not build one unit per type');
		expect(l.only('beginExecute')).toEqual([]);
		expect(l.written().end?.reason).toBe('lane-error');
		expect(l.written().end?.detail).toContain(JSON.stringify(titles[4]));
	});
});

describe('⭐ D5 — every POST the page sends, logged — the refused ones too, which leave nothing in the stores', () => {
	it('⛔ one line per POST, numbered in the order sent, written as each completes; a GET is no line; what is unanswered is flushed', () => {
		const handlers: Record<string, ((x: unknown) => void)[]> = {};
		const page = {
			on: (event: string, h: (x: unknown) => void) => void (handlers[event] ??= []).push(h)
		};
		const fire = (event: string, x: unknown) => handlers[event]?.forEach((h) => h(x));
		const request = (method: string, url: string) => ({
			method: () => method,
			url: () => url,
			failure: () => ({ errorText: 'net::ERR_ABORTED' })
		});
		const file = join(ROOT, 'posts.jsonl');
		const log = logPosts(page as unknown as Page, file);
		const a = request('POST', `${PAGE_URL}?/beginExecute`);
		const b = request('POST', `${PAGE_URL}?/recordAssurance`);
		const c = request('GET', `${PAGE_URL}/__data.json`);
		const d = request('POST', `${PAGE_URL}?/markSatisfied`);
		for (const r of [a, b, c, d]) fire('request', r);
		fire('response', { request: () => b, status: () => 200 });
		fire('response', { request: () => c, status: () => 200 });
		fire('requestfailed', a);
		log.flush();
		const lines = readFileSync(file, 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l) as Record<string, unknown>);
		expect(lines.map(({ at: _at, ...rest }) => rest)).toEqual([
			{ seq: 2, url: `${PAGE_URL}?/recordAssurance`, action: 'recordAssurance', status: 200 },
			{
				seq: 1,
				url: `${PAGE_URL}?/beginExecute`,
				action: 'beginExecute',
				status: null,
				failure: 'net::ERR_ABORTED'
			},
			{
				seq: 3,
				url: `${PAGE_URL}?/markSatisfied`,
				action: 'markSatisfied',
				status: null,
				failure: 'no response before the run ended'
			}
		]);
		expect(lines.every((l) => typeof l.at === 'string')).toBe(true);
	});

	it('⭐ a POST’s action is the one its URL names', () => {
		expect(actionOfUrl(`${PAGE_URL}?/beginExecute`)).toBe('beginExecute');
		expect(actionOfUrl(`${PAGE_URL}?/createType&x=1`)).toBe('createType');
		expect(actionOfUrl(PAGE_URL)).toBeNull();
	});
});

describe('⭐ D2 — the lane writes only under <RUN>/lane, and a run folder serves one run', () => {
	it('⛔ a lane that already holds a boot record is refused, and a lane file is written once', () => {
		const run = join(ROOT, 'run-folder');
		mkdirSync(run);
		const paths = openLane(run);
		expect(paths).toEqual(lanePaths(run));
		writeOnce(paths.boot, { mode: 'dry' });
		expect(() => writeOnce(paths.boot, { mode: 'paid' })).toThrow('EEXIST');
		expect(() => openLane(run)).toThrow(
			`refused: ${paths.boot} already exists — this run folder has served a run, and a run folder serves one (design §6 P7-2 D2)`
		);
		writeFileSync(join(paths.actions, 'x.json'), '{}');
		expect(readFileSync(paths.boot, 'utf8')).toBe('{\n\t"mode": "dry"\n}\n');
	});
});

describe('⭐ the arrangement — the PWA as the designer stored it, read back beside the declaration', () => {
	/** `PHASE7_PWA`'s types as the designer stores them, each with what the form records. */
	function storedTypes(drop?: string): EngineSnapshot {
		const ids = new Map(PHASE7_PWA.types.map((t, i) => [t.name, `typ_${i}`]));
		const pwuTypes = PHASE7_PWA.types.map((t) => ({
			id: ids.get(t.name)!,
			state: {
				pwaId: 'pwa_1',
				name: t.name,
				pwuKind: t.pwuKind,
				purpose: t.purpose,
				workDischarge: t.workDischarge,
				isRoot: t.isRoot === true,
				promptTemplate:
					t.prompt === undefined
						? undefined
						: {
								templateText: t.prompt,
								status: 'ACTIVE',
								declaredPlaceholders: promptMarkers(t.prompt),
								...(t.name === drop ? {} : { outputContract: t.outputContract })
							},
				requiredAssurancePolicyIds: [...t.policyIds],
				permittedChildren: (t.children ?? []).map((c) => ({
					typeId: ids.get(c)!,
					cardinality: 'M1'
				}))
			}
		}));
		return { pwuTypes } as unknown as EngineSnapshot;
	}

	it('⛔ a faithful record reads as declared; one whose output contract the form dropped does not', () => {
		const faithful = typesAsTyped(storedTypes(), 'pwa_1', PHASE7_PWA.types);
		expect(faithful.typed).toEqual(faithful.expected);
		const dropped = typesAsTyped(storedTypes('Design'), 'pwa_1', PHASE7_PWA.types);
		expect(dropped.typed).not.toEqual(dropped.expected);
	});
});
