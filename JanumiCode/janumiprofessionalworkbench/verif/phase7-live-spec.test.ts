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
	LIVE_RUN_DIR_VARIABLE,
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_PAID_LIMIT,
	PHASE7_PAID_VARIABLE,
	PHASE7_PRIOR_CALLS_VARIABLE,
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
	recordedReviewerCalls,
	refusalOf,
	reviewerReadiness,
	reviewerUnderTest,
	runTheLane,
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
	type SignOffRecord,
	type UnitState
} from '../apps/rph-demo/e2e-live-exec/phase7-operator.js';
import { PHASE7_PWA, promptMarkers } from '../scripts/phase7/pwa-content.js';
import { PHASE7_ARCHIVE_UNITS } from '../scripts/phase7/run-archive.js';

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
		for (const act of ['beginExecute', 'recordAssurance', 'markSatisfied'])
			expect(callsTo(sf, act), act).toEqual([
				['page', 'unitRowById(page, unit.unitId!)', 'actionFields']
			]);
		// ⭐ P7-6R R-1f — and the run plan's rule's acts too: the row's offers read, and each act pressed, on the unit's own row.
		expect(callsTo(sf, 'recoveryOffers'), 'recoveryOffers').toEqual([
			['unitRowById(page, unit.unitId!)']
		]);
		expect(callsTo(sf, 'recover'), 'recover').toEqual([
			['page', 'unitRowById(page, unit.unitId!)', 'act', 'actionFields']
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
			['recordAssurance', "'recordAssurance'", 'PHASE7_SIGN_OFF_MS'],
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
	it('⛔ Record Assurance waits for the row BEFORE judging it — a row offering it is pressed with the sign-off bound, one offering none is not pressed', async () => {
		const offering = signOffRow(1);
		const pressed = await recordAssurance(offering.page, offering.row, decode);
		expect(pressed?.envelopeType, 'a row that offers Record Assurance read as offering none').toBe(
			'success'
		);
		expect(offering.log).toEqual([
			`wait for the row visible ${PHASE7_UI_MS}`,
			'click Record Assurance'
		]);
		expect(offering.asked).toEqual([{ action: 'recordAssurance', timeout: PHASE7_SIGN_OFF_MS }]);
		const bare = signOffRow(0);
		expect(await recordAssurance(bare.page, bare.row, decode)).toBeNull();
		expect(bare.log, 'a row that offers no Record Assurance was pressed').toEqual([
			`wait for the row visible ${PHASE7_UI_MS}`
		]);
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
				action: ['rerunReview', 'rerunWork', 'abandonPwu'].find((a) =>
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

	it('⭐ the overlay is the four keys the config lays over the shell for its server — read from the config’s source', () => {
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
			JPWB_DEMO_DB: 'D:/run/demo.sqlite'
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
				'P7-2 D3), and Phase 7 is measured with the selected reviewer, devin (REG-D-084, REG-D-102).'
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
	'models list': { exitCode: 0, stdout: 'GLM-5.3 Flash Max   glm-5-3-flash-max\nGPT 5   gpt-5\n' }
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
	/** A paid Phase 7 run's keys, as the selected arrangement sets them (REG-D-084), its run folder named. */
	const keys = {
		JPWB_EXECUTOR: 'pi',
		JPWB_EXECUTOR_MODEL: 'openai-codex/gpt-5.6-sol',
		JPWB_ASSURANCE_TOOL: 'devin',
		[REVIEWER_MODEL_VARIABLE.devin]: 'glm-5-3-flash-max',
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

describe('⭐ D8 — the limit, and D5 — what the run records of each unit', () => {
	// ⭐ P7-6R — the limit is 200 since `REG-D-105` (1), which amends `REG-D-102` (4)'s 150.
	// ⭑ `REG-D-108` — THE ARITHMETIC IS READ AGAINST THE LIMIT, NOT A COPY OF IT. These cases pinned 200 and went red when the
	// sponsor raised the limit to 230; what they hold is the boundary (one under starts, the limit does not), which a
	// typed number only restates. The limit's VALUE is pinned once, against the register (`live-exec-lane-config.test.ts`).
	it('⛔ prior + recorded + the reserve must total UNDER the sponsor’s limit: one under it starts a phase, the limit does not', () => {
		const L = PHASE7_PAID_LIMIT;
		expect(PHASE7_NEGATIVE_CONTROL_RESERVE).toBe(4);
		expect(limitCheck(L - 50, 45)).toEqual({
			prior: L - 50,
			recorded: 45,
			reserve: 4,
			total: L - 1,
			limit: L,
			allowed: true
		});
		expect(limitCheck(L - 50, 46).allowed).toBe(false);
		expect(limitCheck(0, L - 4).allowed).toBe(false);
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

	it('⛔ D5 — a phase ran on an unassured upstream when an EARLIER PHASE stopped; the root is their parent, not their upstream', () => {
		const units = unpressed(PHASE7_ARCHIVE_UNITS);
		const [root, requirements, design] = units as [RunUnit, RunUnit, RunUnit];
		root.stopped = true;
		expect(upstreamNotAssured(units, 2)).toBe(false);
		requirements.stopped = false;
		expect(upstreamNotAssured(units, 3)).toBe(false);
		design.stopped = true;
		expect(upstreamNotAssured(units, 3), 'a phase is not its own upstream').toBe(false);
		expect(upstreamNotAssured(units, 4)).toBe(true);
		expect(upstreamNotAssured(units, 5)).toBe(true);
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
			signOff: null
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
	 * `calls`, the model calls Record Assurance recorded: a sign-off calls no model (D11), and a dry run must see one that did.
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
			}
		>
	>;
	/** The model exchanges the store holds besides reviews: a dry run's must be none. */
	readonly executorExchanges?: number;
	/** The unit titles the setup reads: the five, unless said. */
	readonly titles?: readonly string[];
	/** The read, counted from 1, that throws as a server gone would. */
	readonly readThrowsAt?: number;
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

/** A run folder of its own, a store made here, and the hands the run uses, each call logged in order. */
function laneOf(script: Script) {
	const lane = openLane(folder('lane'));
	const calls: string[] = [];
	const archives: ArchiveCall[] = [];
	const store = new Map<string, UnitState>();
	/** ⭐ P7-6 B3 — each unit's plans: a re-run supersedes the last, whose step it cancels, and adds plan B (RD5). */
	const plans = new Map<string, number>();
	const recoveryReads = new Map<string, number>();
	const idOf = (slug: string) => `pwu_${slug}`;
	let reviewerCallCount = 0;
	let reads = 0;
	const snapshot = (): EngineSnapshot =>
		({
			undertakings: [{ id: 'und_1', state: { name: PHASE7_UNDERTAKING.name } }],
			pwus: PHASE7_ARCHIVE_UNITS.map((u) => {
				const s = store.get(idOf(u.slug));
				return {
					id: idOf(u.slug),
					state: {
						title: u.title,
						undertakingId: 'und_1',
						workLifecycleState: s?.lifecycleState ?? 'PROPOSED',
						executionState: s?.executionState ?? 'NOT_STARTED',
						assuranceState: s?.assuranceState ?? 'UNASSESSED'
					}
				};
			}),
			executionPlans: [...store].flatMap(([id, s]) =>
				s.planStepState === null
					? []
					: Array.from({ length: plans.get(id) ?? 1 }, (_, i) => ({
							id: i === 0 ? `pln_${id}` : `pln_${id}_${i + 1}`,
							// A superseded plan's step was cancelled with it; the last plan's is the unit's.
							state: {
								workUnitId: id,
								steps: [{ stepState: i === (plans.get(id) ?? 1) - 1 ? s.planStepState : 'CANCELLED' }]
							}
						}))
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
			evidence: [],
			artifacts: []
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
		recordAssurance: async (unit) => {
			calls.push(`recordAssurance ${unit.slug}`);
			const s = signOffOf(unit);
			if (s.raAfter) store.set(unit.unitId!, s.raAfter);
			reviewerCallCount += s.calls ?? 0;
			return s.ra;
		},
		markSatisfied: async (unit) => {
			calls.push(`markSatisfied ${unit.slug}`);
			const s = signOffOf(unit);
			if (s.msAfter) store.set(unit.unitId!, s.msAfter);
			return s.ms ?? answered('success');
		},
		read: async () => {
			reads += 1;
			calls.push('read');
			if (reads === script.readThrowsAt) throw new Error('connect ECONNREFUSED 127.0.0.1:4322');
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
		/** The calls of these kinds, in order. */
		only: (...kinds: string[]) => calls.filter((c) => kinds.some((k) => c.startsWith(k))),
		archives,
		lane,
		written: (): RunRecord => JSON.parse(readFileSync(lane.run, 'utf8')) as RunRecord,
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

	it('⛔ DRY: the root is pressed, its answer kept, its state read from the store and the run archived — then the run stops, before any phase, and the verdict holds the press PROVED (D1, D5)', async () => {
		const l = laneOf({
			paid: false,
			presses: { root: ALL_COMPLETE.root! },
			signOffs: { root: GREEN }
		});
		const record = await l.run();
		// ⭑ Between the root's archive and the stop come its sign-off and the final archive (D11): the next test's.
		expect(l.calls.slice(0, 5)).toEqual([
			'setUp',
			'beginExecute root',
			'read',
			'screenshot 01-root',
			'archive 01-root'
		]);
		expect(l.only('beginExecute'), 'the dry run pressed a phase').toEqual(['beginExecute root']);
		expect(l.action('01-root-beginExecute'), 'the root’s answer was not kept').toBe(true);
		expect([record.end?.reason, record.dryRun, record.units[0]!.stopped]).toEqual([
			'dry-run-stop',
			{ modelExchanges: 0 },
			false
		]);
		expect(l.written().end?.reason).toBe('dry-run-stop');
		expect(laneVerdict(record)).toEqual([]);
	});

	it('⛔ DRY: a root whose press was REFUSED, or a store holding a model exchange, fails the verdict — the dry run proves the press, or nothing', async () => {
		// ⭑ Each root's sign-off is accepted, so each line here stands alone: the sign-off's are the D11 tests' below.
		const refused = await laneOf({
			paid: false,
			presses: { root: { outcome: answered('failure'), after: STOPPED } },
			signOffs: { root: GREEN }
		}).run();
		expect(laneVerdict(refused)).toEqual([
			"the dry run did not prove the root's press: it answered failure, and the store reads its execution RUNNING and its step RUNNING"
		]);
		const called = await laneOf({
			paid: false,
			presses: { root: ALL_COMPLETE.root! },
			signOffs: { root: GREEN },
			executorExchanges: 2
		}).run();
		expect(laneVerdict(called)).toEqual(['the dry run recorded 2 model exchange(s)']);
	});

	it('⛔ DRY, D11 — after the root’s archive the ROOT is signed off by the paid run’s own acts, the page loaded afresh and the store read after each act; then the final archive is taken, and only then are the model exchanges counted', async () => {
		const l = laneOf({
			paid: false,
			presses: { root: ALL_COMPLETE.root! },
			signOffs: { root: GREEN }
		});
		const record = await l.run();
		expect(l.calls, 'the dry run’s order after the root’s archive (design §6 P7-2 D11)').toEqual([
			'setUp',
			'beginExecute root',
			'read',
			'screenshot 01-root',
			'archive 01-root',
			'showOverview',
			'recordAssurance root',
			'read',
			'markSatisfied root',
			'read',
			'screenshot 06-final',
			'read',
			'archive 06-final',
			'read',
			'flushPosts'
		]);
		const root = record.units[0]!;
		expect(root.signOff, 'the root’s sign-off is not the store’s, read after each act').toEqual({
			offered: true,
			recordAssurance: { status: 200, envelopeType: 'success', after: ASSURED },
			markSatisfied: { status: 200, envelopeType: 'success', after: SATISFIED },
			refused: null
		});
		expect(l.written().units[0]!.signOff, 'the run record written lacks the sign-off').toEqual(
			root.signOff
		);
		expect([l.action('01-root-recordAssurance'), l.action('01-root-markSatisfied')]).toEqual([
			true,
			true
		]);
		expect(
			l.archives.map((a) => [a.name, a.unitId, a.capturesBefore]),
			'the final archive was not taken, or not diffed with the root’s (K5)'
		).toEqual([
			['01-root', 'pwu_root', []],
			['06-final', null, ['capture-of-01-root']]
		]);
		expect([record.end?.reason, record.dryRun]).toEqual(['dry-run-stop', { modelExchanges: 0 }]);
		expect(laneVerdict(record)).toEqual([]);
	});

	it('⛔ DRY, D11 — a model call the sign-off made is COUNTED: the exchanges are read after the sign-off and the final archive, never before, and the verdict says so', async () => {
		const record = await laneOf({
			paid: false,
			presses: { root: ALL_COMPLETE.root! },
			signOffs: { root: { ...GREEN, calls: 1 } }
		}).run();
		expect(record.dryRun, 'the exchanges were counted before the sign-off').toEqual({
			modelExchanges: 1
		});
		expect(laneVerdict(record)).toEqual(['the dry run recorded 1 model exchange(s)']);
	});

	it('⛔ DRY, D11 — the verdict holds the root’s sign-off PROVED: its row offered Record Assurance, both acts answered success, and the store read after Mark Satisfied reads the root SATISFIED in lifecycle and assurance (prediction b, REG-F-523) — each shortfall its own line, with what was read', async () => {
		const dryWith = async (signOff: NonNullable<Script['signOffs']>[string]) =>
			laneVerdict(
				await laneOf({
					paid: false,
					presses: { root: ALL_COMPLETE.root! },
					signOffs: { root: signOff }
				}).run()
			);
		const unread =
			"the dry run's root is not SATISFIED: the store, read after Mark Satisfied, reads its lifecycle unread and its assurance unread";
		expect(await dryWith({ ra: null }), 'a row that offered no Record Assurance').toEqual([
			'the dry run did not sign off the root: its row offered no Record Assurance',
			"the dry run's sign-off of the root was not accepted: Record Assurance was never pressed, and Mark Satisfied was never pressed",
			unread
		]);
		expect(
			await dryWith({ ra: answered('failure'), raAfter: COMPLETED }),
			'a refused Record Assurance'
		).toEqual([
			'the dry run\'s sign-off of the root was not accepted: Record Assurance answered failure, and Mark Satisfied was never pressed (Record Assurance refused: {"type":"failure"})',
			unread
		]);
		expect(
			await dryWith({
				ra: answered('success'),
				raAfter: ASSURED,
				ms: answered('failure'),
				msAfter: ASSURED
			}),
			'a refused Mark Satisfied'
		).toEqual([
			'the dry run\'s sign-off of the root was not accepted: Record Assurance answered success, and Mark Satisfied answered failure (Mark Satisfied refused: {"type":"failure"})',
			"the dry run's root is not SATISFIED: the store, read after Mark Satisfied, reads its lifecycle UNDER_ASSURANCE and its assurance SATISFIED"
		]);
		// ⛔ THE ENVELOPE IS NOT THE RECORD (REG-F-540): both acts accepted, and the store unmoved — on either axis.
		expect(await dryWith({ ...GREEN, msAfter: ASSURED }), 'the lifecycle unmoved').toEqual([
			"the dry run's root is not SATISFIED: the store, read after Mark Satisfied, reads its lifecycle UNDER_ASSURANCE and its assurance SATISFIED"
		]);
		expect(
			await dryWith({
				...GREEN,
				msAfter: unitState('SATISFIED', 'SUCCEEDED', 'UNASSESSED', 'SUCCEEDED')
			}),
			'the assurance unmoved'
		).toEqual([
			"the dry run's root is not SATISFIED: the store, read after Mark Satisfied, reads its lifecycle SATISFIED and its assurance UNASSESSED"
		]);
		// ⛔ AND TWO RECORDS NO LANE OF TODAY WRITES, WHICH A BROKEN ONE WOULD: a Mark Satisfied accepted after a REFUSED
		// Record Assurance — the act P7-3 forbids — and a sign-off never attempted.
		const green = await laneOf({
			paid: false,
			presses: { root: ALL_COMPLETE.root! },
			signOffs: { root: GREEN }
		}).run();
		const withRootSignOff = (signOff: SignOffRecord | null): RunRecord => ({
			...green,
			units: [{ ...green.units[0]!, signOff }, ...green.units.slice(1)]
		});
		const signed = green.units[0]!.signOff!;
		expect(
			laneVerdict(
				withRootSignOff({
					...signed,
					recordAssurance: { ...signed.recordAssurance!, envelopeType: 'failure' }
				})
			),
			'Mark Satisfied after a refused Record Assurance'
		).toEqual([
			"the dry run's sign-off of the root was not accepted: Record Assurance answered failure, and Mark Satisfied answered success"
		]);
		expect(laneVerdict(withRootSignOff(null)), 'a sign-off never attempted').toEqual([
			'the dry run did not sign off the root: no sign-off was attempted',
			"the dry run's sign-off of the root was not accepted: Record Assurance was never pressed, and Mark Satisfied was never pressed",
			unread
		]);
	});

	it('⭐ PAID: each phase in order, the limit read before each; a phase that stops is left as found and the later ones run with an unassured upstream; the sign-off takes each completed phase and the root LAST, the page loaded afresh for each and the store read after every act', async () => {
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
		expect(l.only('beginExecute')).toEqual(
			PHASE7_ARCHIVE_UNITS.map((u) => `beginExecute ${u.slug}`)
		);
		expect(record.units.map((u) => [u.slug, u.stopped, u.upstreamNotAssured])).toEqual([
			['root', false, null],
			['requirements', false, false],
			['design', true, false],
			['implementation', false, true],
			['end-to-end', false, true]
		]);
		expect(
			record.units.slice(1).map((u) => u.limitCheck?.recorded),
			'the limit did not read what the store recorded before each phase'
		).toEqual([0, 3, 5, 9]);
		expect(
			l.only('showOverview', 'recordAssurance', 'markSatisfied'),
			'the sign-off’s order, its reloads, or Mark Satisfied after a refused Record Assurance'
		).toEqual([
			// ⭐ P7-6R R-1f — the stopped design phase's row, read for the run plan's rule; it offers no re-run here.
			'showOverview',
			'showOverview',
			'recordAssurance requirements',
			'markSatisfied requirements',
			'showOverview',
			'recordAssurance implementation',
			'showOverview',
			'recordAssurance end-to-end',
			'markSatisfied end-to-end',
			'showOverview',
			'recordAssurance root',
			'markSatisfied root'
		]);
		const [root, requirements, design, implementation] = record.units as [
			RunUnit,
			RunUnit,
			RunUnit,
			RunUnit
		];
		expect(requirements.signOff, 'each act’s state is not the store’s, read after it').toEqual({
			offered: true,
			recordAssurance: { status: 200, envelopeType: 'success', after: ASSURED },
			markSatisfied: { status: 200, envelopeType: 'success', after: SATISFIED },
			refused: null
		});
		expect(implementation.signOff).toEqual({
			offered: true,
			recordAssurance: { status: 200, envelopeType: 'failure', after: COMPLETED },
			markSatisfied: null,
			refused: { act: 'Record Assurance', reason: '{"type":"failure"}' }
		});
		expect([design.signOff, root.signOff?.refused]).toEqual([null, null]);
		expect(l.action('04-implementation-markSatisfied')).toBe(false);
		expect(
			l.archives.map((a) => [a.name, a.unitId, a.refusal, a.capturesBefore]),
			'an archive was not diffed with the one before it (K5)'
		).toEqual([
			['01-root', 'pwu_root', null, []],
			['02-requirements', 'pwu_requirements', null, ['capture-of-01-root']],
			[
				'03-design',
				'pwu_design',
				'{"type":"failure"}',
				['capture-of-01-root', 'capture-of-02-requirements']
			],
			[
				'04-implementation',
				'pwu_implementation',
				null,
				['capture-of-01-root', 'capture-of-02-requirements', 'capture-of-03-design']
			],
			[
				'05-end-to-end',
				'pwu_end-to-end',
				null,
				[
					'capture-of-01-root',
					'capture-of-02-requirements',
					'capture-of-03-design',
					'capture-of-04-implementation'
				]
			],
			[
				'06-final',
				null,
				null,
				[
					'capture-of-01-root',
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
			'beginExecute root',
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
		expect(record.units.map((u) => [u.slug, u.stopped, u.upstreamNotAssured])).toEqual([
			['root', false, null],
			['requirements', false, false],
			['design', true, false],
			['implementation', false, true],
			['end-to-end', false, true]
		]);
		expect(
			implementation.limitCheck?.recorded,
			'the limit before a phase did not count the re-runs'
		).toBe(2 + 1 + 2 + 3);
		expect(
			l.only('recordAssurance'),
			'the recovered phase was not signed off, or the abandoned one was'
		).toEqual([
			'recordAssurance requirements',
			'recordAssurance implementation',
			'recordAssurance end-to-end',
			'recordAssurance root'
		]);
		for (const file of [
			'02-requirements-rerunReview',
			'03-design-rerunWork',
			'03-design-abandonPwu'
		])
			expect(l.action(file), `lane/actions/${file}.json`).toBe(true);
		expect([record.end?.reason, laneVerdict(record)]).toEqual(['complete', []]);
	});

	it('⛔ REG-D-105 (4), D8 — AT THE LIMIT a stopped phase is NOT re-run: the act is recorded unpressed, and the run ends `paid-limit`', async () => {
		const l = laneOf({
			paid: true,
			prior: PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - 2,
			presses: {
				root: ALL_COMPLETE.root!,
				requirements: { outcome: answered('failure'), after: WAITING, calls: 2 }
			},
			recoveries: {
				requirements: { offers: { rerunReview: true, rerunWork: true, abandon: true } }
			},
			signOffs: { root: GREEN }
		});
		const record = await l.run();
		expect(l.only('recover '), 'a re-run was pressed past the limit').toEqual([]);
		expect(l.only('beginExecute')).toEqual(['beginExecute root', 'beginExecute requirements']);
		expect(record.units[1]!.recovery).toEqual([
			{
				act: 'rerunReview',
				rationale: RULE_RATIONALE.rerunReview,
				limitCheck: {
					prior: PHASE7_PAID_LIMIT - PHASE7_NEGATIVE_CONTROL_RESERVE - 2,
					recorded: 2,
					reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
					total: PHASE7_PAID_LIMIT,
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
				notPressed: `the limit: ${PHASE7_PAID_LIMIT} of ${PHASE7_PAID_LIMIT} reviewer calls (D8)`
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
			'beginExecute root',
			'beginExecute requirements',
			'recoveryOffers requirements',
			'recover requirements rerunWork'
		]);
		expect([record.end?.reason, record.end?.detail]).toEqual([
			'allowance-exceeded',
			`Requirements's rerunWork outlasted its allowance of ${PHASE7_UNIT_ALLOWANCE_MS} ms`
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

	it('⛔ D4 — a phase PAST ITS ALLOWANCE ends the run there: it is archived, and the next is never pressed beside it, nothing signed off (REG-F-535)', async () => {
		const l = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, implementation: { outcome: OUTLASTED, after: STOPPED } }
		});
		const record = await l.run();
		expect(l.only('beginExecute', 'recordAssurance', 'showOverview')).toEqual([
			'beginExecute root',
			'beginExecute requirements',
			'beginExecute design',
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
		expect(l.only('beginExecute')).toEqual([
			'beginExecute root',
			'beginExecute requirements',
			'beginExecute design'
		]);
		expect(record.units[2]!.beginExecute?.requestFailure).toBe('net::ERR_EMPTY_RESPONSE');
		expect([record.end?.reason, record.end?.detail]).toEqual([
			'request-failed',
			"Design's Begin & Execute failed in transit (net::ERR_EMPTY_RESPONSE): the server may have stopped, or may still be running it"
		]);
	});

	it('⛔ D4 — the ROOT’s press with no answer ends the run before any phase, dry or paid', async () => {
		const dry = laneOf({ paid: false, presses: { root: { outcome: OUTLASTED, after: STOPPED } } });
		const dryRecord = await dry.run();
		expect([dryRecord.end?.reason, dryRecord.dryRun]).toEqual(['allowance-exceeded', null]);
		const paid = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, root: { outcome: LOST_IN_TRANSIT, after: STOPPED } }
		});
		const paidRecord = await paid.run();
		expect(paid.only('beginExecute', 'recordAssurance')).toEqual(['beginExecute root']);
		expect(paidRecord.end?.reason).toBe('request-failed');
	});

	it('⛔ a throw AFTER a press with no answer keeps why the run ended — the archive of a unit still running must not relabel it a lane error', async () => {
		// Reads: after the root; before requirements and after it; before design and after it; before implementation, and
		// — the seventh — after it, as the server gone would leave it.
		const l = laneOf({
			paid: true,
			presses: { ...ALL_COMPLETE, implementation: { outcome: OUTLASTED, after: STOPPED } },
			readThrowsAt: 7
		});
		await expect(l.run()).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:4322');
		expect([l.written().end?.reason, l.written().end?.detail]).toEqual([
			'allowance-exceeded',
			`Implementation and unit tests's Begin & Execute outlasted its allowance of ${PHASE7_UNIT_ALLOWANCE_MS} ms; then: connect ECONNREFUSED 127.0.0.1:4322`
		]);
	});

	it('⛔ D8 — at the sponsor’s limit, counting what the store records, the run ends `paid-limit` before the phase, and what completed is still signed off, the root last', async () => {
		// ⭑ `REG-D-108` — the prior spend is set against the limit, so the design phase is the one that reaches it.
		const l = laneOf({
			paid: true,
			prior: PHASE7_PAID_LIMIT - 10,
			presses: {
				root: ALL_COMPLETE.root!,
				requirements: { outcome: answered('success'), after: COMPLETED, calls: 6 }
			},
			signOffs: { root: GREEN, requirements: GREEN }
		});
		const record = await l.run();
		expect(l.only('beginExecute', 'recordAssurance')).toEqual([
			'beginExecute root',
			'beginExecute requirements',
			'recordAssurance requirements',
			'recordAssurance root'
		]);
		expect(record.units[2]!.limitCheck).toEqual({
			prior: PHASE7_PAID_LIMIT - 10,
			recorded: 6,
			reserve: 4,
			total: PHASE7_PAID_LIMIT,
			limit: PHASE7_PAID_LIMIT,
			allowed: false
		});
		expect(record.units[2]!.beginExecute).toBeNull();
		expect(laneVerdict(record)).toEqual(["the run ended 'paid-limit', not 'complete'"]);
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
			recordAssurance: null,
			markSatisfied: null,
			refused: null
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
