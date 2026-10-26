// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L2 — D20 (`REG-F-580`; `REG-D-135` (4); DESIGN-data-flow-order-and-deliverable-review.md D20,
// revision 2; roadmap 9b.2a) — THE LANE HANDS THE AUTHORING REVIEW ITS ALLOWANCE.
//
// The server holds the bound (`apps/rph-demo/src/lib/server/assurance/review-allowance.ts`): each authoring review round reserves
// its worst case against `JPWB_AUTHORING_REVIEW_ALLOWANCE` before its first reviewer call. The paid lane boots its server with
// that allowance for a paid half-B run — what the limit leaves after the calls spent before the run and the negative control's
// 4 — and sets none for the dry run, half A or the one-unit lane; Send's check counts what it handed over
// (`verif/phase7-half-b.test.ts`).
//
// ⭑ `e2e-live-exec/lane-config.ts` imports nothing (Playwright loads it in the runner's own process), so it RESTATES the
// product's variable and the validator's calls a review; this file holds each restatement to the product's own export, and the
// prior calls' reading to the spec's (`phase7-operator.ts`, `priorReviewerCalls`). ⭑ The config is read from its AST, never
// loaded: loading it runs its lane-key refusal and the run-folder check.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
	AUTHORING_REVIEW_ALLOWANCE_VARIABLE,
	LANE_BUDGET,
	LIVE_RUN_DIR_VARIABLE,
	PHASE7_HALF_VARIABLE,
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_PAID_LIMIT,
	PHASE7_PAID_VARIABLE,
	PHASE7_PRIOR_CALLS_VARIABLE,
	laneKeysRefusal,
	phase7AuthoringReviewAllowance,
	phase7AuthoringReviewAllowanceEnv
} from '../apps/rph-demo/e2e-live-exec/lane-config.js';
import { priorReviewerCalls } from '../apps/rph-demo/e2e-live-exec/phase7-operator.js';
import { REVIEWER_CALLS_PER_REVIEW } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { AUTHORING_REVIEW_ALLOWANCE_VARIABLE as PRODUCT_VARIABLE } from '../apps/rph-demo/src/lib/server/assurance/review-allowance.js';

const CONFIG_FILE = fileURLToPath(new URL('../apps/rph-demo/playwright.live-exec.config.ts', import.meta.url));
const config = () => ts.createSourceFile(CONFIG_FILE, readFileSync(CONFIG_FILE, 'utf8'), ts.ScriptTarget.Latest, true);

/** A paid half-B run of the Phase 7 lane, `prior` the calls spent before it. */
const paidHalfB = (prior: string | undefined) => ({
	[LIVE_RUN_DIR_VARIABLE]: 'a-run-folder',
	[PHASE7_PAID_VARIABLE]: '1',
	[PHASE7_HALF_VARIABLE]: 'B',
	[PHASE7_PRIOR_CALLS_VARIABLE]: prior
});

/** Every key the lane requires, set: the arrangement the shell-variable refusal adds one thing to. */
const COMPLETE = {
	JPWB_EXECUTOR: 'pi',
	JPWB_EXECUTOR_MODEL: 'openai-codex/gpt-5.4-mini',
	JPWB_ASSURANCE_TOOL: 'devin',
	JPWB_ASSURANCE_MODEL: 'glm-5-3-flash-high'
} as const;

describe('⭐ L2 — the lane restates the product, and is held to it', () => {
	it('the variable the lane hands over is the one the server reads', () => {
		expect(AUTHORING_REVIEW_ALLOWANCE_VARIABLE).toBe(PRODUCT_VARIABLE);
	});

	it('the lane’s calls a review are the validator’s own bound, which the floor reserves at a part', () => {
		expect(LANE_BUDGET.reviewerCallsPerTry).toBe(REVIEWER_CALLS_PER_REVIEW);
	});
});

describe('⭐⭐ L2 — D20: a paid half-B run’s server is booted with the allowance; the dry run and half A are handed none', () => {
	// ⛔ PREDICTED RED, read from the code at 59135143: the config lays no allowance over the server — so the authoring floor
	// inside Send has no bound, and Send's check counts an estimate (`REG-F-580`).
	it('⛔ RED — the allowance is the limit less the calls spent before the run and the negative control’s 4: 2,400 − 1,117 − 4 = 1,279 at P6 again’s planned spend', () => {
		expect([PHASE7_PAID_LIMIT, PHASE7_NEGATIVE_CONTROL_RESERVE]).toEqual([2400, 4]);
		expect(phase7AuthoringReviewAllowanceEnv(paidHalfB('1117'))).toEqual({ [AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: '1279' });
		expect(phase7AuthoringReviewAllowanceEnv(paidHalfB('0'))).toEqual({ [AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: '2396' });
		expect(phase7AuthoringReviewAllowanceEnv(paidHalfB(' 12 '))).toEqual({ [AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: '2384' });
		expect([1117, 0, 2396, 2397, 5000].map(phase7AuthoringReviewAllowance), 'never below none').toEqual([1279, 2396, 0, 0, 0]);
	});

	it('⛔ RED — a prior the spec cannot read hands an allowance of none, fail-closed — and the spec’s boot refuses that run before any press', () => {
		for (const given of ['', 'twelve', '-1', '012', undefined])
			expect(phase7AuthoringReviewAllowanceEnv(paidHalfB(given)), String(given)).toEqual({
				[AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: '0'
			});
	});

	it('⭑ the prior is read as the spec reads it (`priorReviewerCalls`), every input alike', () => {
		for (const given of ['0', ' 12 ', '149', '1117', '-1', '1.5', '', 'twelve', '012', '9007199254740993', undefined]) {
			const read = priorReviewerCalls({ [PHASE7_PRIOR_CALLS_VARIABLE]: given });
			expect(phase7AuthoringReviewAllowanceEnv(paidHalfB(given))[AUTHORING_REVIEW_ALLOWANCE_VARIABLE], String(given)).toBe(
				String(typeof read === 'number' ? phase7AuthoringReviewAllowance(read) : 0)
			);
		}
	});

	// ⛔ PREDICTED RED for the paid limb above; ⭑ CONTROL for these: nothing is handed today, so they pass before the build — and
	// a build that handed every run the allowance reddens them (`P6X-L2-M6`, `P6X-L2-M9`).
	it('⭑ the dry run is handed none — `JPWB_PHASE7_PAID` unset, or anything but exactly 1, as the spec reads it', () => {
		for (const paid of [undefined, '', '0', ' 1', 'true'])
			expect(phase7AuthoringReviewAllowanceEnv({ ...paidHalfB('1117'), [PHASE7_PAID_VARIABLE]: paid }), String(paid)).toEqual({});
	});

	it('⭑ half A is handed none, paid or dry — its PWA is typed by the operator, and no authoring review runs', () => {
		for (const half of [undefined, '', 'A'])
			expect(phase7AuthoringReviewAllowanceEnv({ ...paidHalfB('1117'), [PHASE7_HALF_VARIABLE]: half }), String(half)).toEqual({});
	});

	it('⭑ the one-unit lane is handed none: no run folder, no Phase 7 run', () => {
		expect(phase7AuthoringReviewAllowanceEnv({ ...paidHalfB('1117'), [LIVE_RUN_DIR_VARIABLE]: undefined })).toEqual({});
	});

	it('⛔ RED — the config lays it over the server’s environment from its own, after the keys it passes through, and PI_OFFLINE stays last', () => {
		const sf = config();
		const env: ts.ObjectLiteralExpression[] = [];
		const visit = (n: ts.Node): void => {
			if (
				ts.isPropertyAssignment(n) &&
				n.name.getText(sf) === 'env' &&
				ts.isObjectLiteralExpression(n.initializer) &&
				ts.isPropertyAssignment(n.parent.parent) &&
				n.parent.parent.name.getText(sf) === 'webServer'
			)
				env.push(n.initializer);
			ts.forEachChild(n, visit);
		};
		visit(sf);
		expect(env, 'the config has one webServer.env literal').toHaveLength(1);
		const laid = env[0]!.properties.map((p) =>
			ts.isSpreadAssignment(p) ? `...${p.expression.getText(sf)}` : (p.name?.getText(sf) ?? p.getText(sf))
		);
		expect(laid.slice(-3), 'the allowance is not laid over the server, after the keys passed through').toEqual([
			'...passthrough',
			'...phase7AuthoringReviewAllowanceEnv(process.env)',
			'PI_OFFLINE'
		]);
	});
});

describe('⭐ L2 — an allowance exported in the shell is refused at boot, by a rule of THIS LANE', () => {
	// ⛔ PREDICTED RED, read from the code at 59135143: the config passes the operator's whole shell to the server, so an exported
	// allowance would reach the dry run and half A, and stand beside the one the lane hands a paid half-B run.
	it('⛔ RED — set to a value, it is refused, naming it; the lane alone hands it over', () => {
		expect(laneKeysRefusal(COMPLETE), 'arrangement: the complete keys boot').toBeUndefined();
		const refusal = laneKeysRefusal({ ...COMPLETE, [AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: '5000' });
		expect(refusal).toContain(
			`  · ${AUTHORING_REVIEW_ALLOWANCE_VARIABLE}="5000" is refused by a rule of THIS LANE, not of the product: the lane hands ` +
				'the server the authoring review’s allowance itself — for a paid half-B run, the limit less the calls spent before ' +
				'the run and the negative control’s 4, and none otherwise (REG-F-580; design D20) — and one exported in the shell ' +
				'would reach the dry run and half A, and stand beside the one the lane counts. Unset it.'
		);
	});

	it('⭑ CONTROL — blank is no allowance to the server, and is not refused', () => {
		for (const blank of ['', '   '])
			expect(laneKeysRefusal({ ...COMPLETE, [AUTHORING_REVIEW_ALLOWANCE_VARIABLE]: blank }), JSON.stringify(blank)).toBeUndefined();
	});
});
