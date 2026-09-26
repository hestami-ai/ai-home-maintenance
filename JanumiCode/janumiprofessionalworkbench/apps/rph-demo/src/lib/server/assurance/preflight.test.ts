import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFloorRegistry } from './index.js';
import { noProgramsDirectory } from './no-programs.testing.js';
import { assurancePreflight } from './preflight.js';

describe('assurancePreflight — live authoring cannot outrun its mandatory reviewer', () => {
	it('REFUSES a live agy turn when JPWB_JUDGE_MODEL is absent — the preflight can now say NOT ready', () => {
		// ⭐ REWRITTEN (`JAN-SELREV` SR-1, D2): this arrangement used to name NO tool, and an unset tool meant agy. It
		// now means REFUSED outside test mode for a different reason (the tool, not the model — see the case below),
		// so agy is NAMED here to keep this test about what it has always been about: agy's missing model. The code it
		// pinned, `JUDGE_MODEL_UNCONFIGURED`, is renamed for what it refuses — a reviewer with no model — because the
		// one preflight now answers for devin's model as well.
		const result = assurancePreflight({ testMode: false, env: { JPWB_ASSURANCE_TOOL: 'agy' } });

		// ⚠ THIS ASSERTION EXISTS BECAUSE THE PREFLIGHT USED TO BE UNABLE TO FAIL. `ready` was the literal
		// `true` on every path and the code union had ONE member, so a preflight over the mandatory Reasoning
		// Review could not report that the review could not run. It reported READY while the pinned default was
		// one the installed agy rejects (REG-F-331).
		expect(result.ready).toBe(false);
		expect(result.code).toBe('REVIEWER_MODEL_UNSET');
		expect(result.guidance).toMatch(/JPWB_JUDGE_MODEL/);
		expect(result.reviewer).toBeUndefined();
	});

	it('treats whitespace-only live configuration as absent and refuses', () => {
		// ⭐ REWRITTEN (D2): agy is now NAMED, because outside test mode an unset tool is refused for the TOOL, which would
		// hide the whitespace-model refusal this case pins; and `reviewer` replaces the retired `judgeModel` field.
		const r = assurancePreflight({
			testMode: false,
			env: { JPWB_ASSURANCE_TOOL: 'agy', JPWB_JUDGE_MODEL: '  ' }
		});
		expect(r.ready).toBe(false);
		expect(r.reviewer).toBeUndefined();
	});

	it('allows a live turn when the reviewer tool and model are configured, without invoking the reviewer', () => {
		// ⭐ REWRITTEN (D2): this used to expect READY with NO tool named outside test mode — an unconfigured host was
		// given agy. That is now refused (the case below), so the tool is named, and READY reports the reviewer it
		// resolved rather than a bare judge model, because the reviewer may now be devin.
		expect(
			assurancePreflight({
				testMode: false,
				env: { JPWB_ASSURANCE_TOOL: 'agy', JPWB_JUDGE_MODEL: 'gemini-reviewer-v1' }
			})
		).toEqual({
			ready: true,
			code: 'READY',
			guidance: '',
			reviewer: { toolId: 'agy', modelId: 'gemini-reviewer-v1' }
		});
	});

	it('⛔ REFUSES a live turn that names no reviewing tool, however well its models are configured (D2)', () => {
		const r = assurancePreflight({
			testMode: false,
			env: { JPWB_JUDGE_MODEL: 'gemini-reviewer-v1', JPWB_ASSURANCE_MODEL: 'glm-5-3-flash-max' }
		});
		expect(r.ready).toBe(false);
		expect(r.code).toBe('REVIEWER_TOOL_UNSET');
		expect(r.guidance).toContain('JPWB_ASSURANCE_TOOL is not set');
		expect(r.guidance).toContain('REG-D-084');
	});

	it('⭐ a devin-only host is READY — no JPWB_JUDGE_MODEL is asked of a host that does not run agy', () => {
		// ⛔ RED BEFORE `JAN-SELREV`: the preflight checked only `JPWB_JUDGE_MODEL`, so the selected reviewer's own
		// configuration was refused on every authoring turn (`REG-F-443`, G4).
		expect(
			assurancePreflight({
				testMode: false,
				env: { JPWB_ASSURANCE_TOOL: 'devin', JPWB_ASSURANCE_MODEL: 'glm-5-3-flash-max' }
			})
		).toEqual({
			ready: true,
			code: 'READY',
			guidance: '',
			reviewer: { toolId: 'devin', modelId: 'glm-5-3-flash-max' }
		});
	});

	it('allows test-mode mock assurance without live reviewer configuration', () => {
		expect(assurancePreflight({ testMode: true, env: {} }).ready).toBe(true);
	});

	it('REFUSES when test mode names the real agy reviewer with no model configured', () => {
		// ⭐ REWRITTEN (D3): this used to select the real reviewer with `JPWB_ASSESSOR=agy`. That switch is RETIRED — the
		// registry has chosen by `JPWB_ASSURANCE_TOOL` since `f35cb69d`, and the preflight now asks the same selector —
		// so the real reviewer is named the way the registry reads it. That the assessor is now IGNORED is its own case
		// below.
		const r = assurancePreflight({ testMode: true, env: { JPWB_ASSURANCE_TOOL: 'agy' } });
		expect(r.ready).toBe(false);
		expect(r.code).toBe('REVIEWER_MODEL_UNSET');
	});

	it('ignores a production request for the mock assessor just as the registry does', () => {
		// Production still requires the real reviewer, so an unconfigured host refuses rather than silently
		// downgrading to the deterministic mock — which is the selection rule createFloorRegistry enforces.
		// ⭐ REWRITTEN (D2): the refusal it pinned was the judge model's; with no tool named it is now the TOOL's.
		const r = assurancePreflight({ testMode: false, env: { JPWB_ASSESSOR: 'mock' } });
		expect(r.ready).toBe(false);
		expect(r.code).toBe('REVIEWER_TOOL_UNSET');
	});
});

/**
 * ⭐⭐ `REG-F-443` — THE PREFLIGHT AND THE REGISTRY AGREE, IN BOTH DIRECTIONS, BECAUSE THEY ASK ONE SELECTOR.
 *
 * ⛔ THE TWO DISAGREEMENTS IT FILED, BOTH IN TEST MODE: `JPWB_ASSURANCE_TOOL` set with its model unset — the registry
 * ran (and threw for) a real reviewer while the preflight said READY; and `JPWB_ASSESSOR=agy` alone — the registry ran
 * the stand-in while the preflight refused the turn for a model it would never use.
 *
 * ⭑ THE MUTANT PAIR, as `execution/model.test.ts` has for the executor's switch: a preflight that stops asking the
 * selector in test mode reddens the first row; one that reads `JPWB_ASSESSOR` again reddens the second.
 */
describe('⭐ REG-F-443 — the authoring preflight and the floor registry agree, in both directions', () => {
	const REFUSING = 'reasoning-review.unconfigured';
	const ROWS: readonly {
		readonly name: string;
		readonly testMode: boolean;
		readonly env: Readonly<Record<string, string>>;
		readonly ready: boolean;
	}[] = [
		{
			name: 'test mode, a tool with no model',
			testMode: true,
			env: { JPWB_ASSURANCE_TOOL: 'devin' },
			ready: false
		},
		{
			name: 'test mode, the retired assessor alone',
			testMode: true,
			env: { JPWB_ASSESSOR: 'agy' },
			ready: true
		},
		{ name: 'test mode, nothing configured', testMode: true, env: {}, ready: true },
		{
			name: 'server mode, a devin-only host',
			testMode: false,
			env: { JPWB_ASSURANCE_TOOL: 'devin', JPWB_ASSURANCE_MODEL: 'glm-5-3-flash-max' },
			ready: true
		},
		{ name: 'server mode, pi', testMode: false, env: { JPWB_ASSURANCE_TOOL: 'pi' }, ready: false },
		{ name: 'server mode, nothing configured', testMode: false, env: {}, ready: false }
	];
	const VARIABLES = [
		'JPWB_ASSURANCE_TOOL',
		'JPWB_ASSURANCE_MODEL',
		'JPWB_JUDGE_MODEL',
		'JPWB_ASSESSOR'
	] as const;

	beforeEach(() => {
		// The registry reads `process.env`; it never runs a review here, and PATH finds no program even so.
		vi.stubEnv('PATH', noProgramsDirectory());
		for (const v of VARIABLES) vi.stubEnv(v, undefined);
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	for (const row of ROWS)
		it(`${row.name}: the preflight is ${row.ready ? 'READY' : 'refused'} and the registry agrees`, () => {
			for (const [k, v] of Object.entries(row.env)) vi.stubEnv(k, v);
			const preflight = assurancePreflight({ testMode: row.testMode, env: process.env });
			let registered: string | undefined;
			expect(() => {
				registered = createFloorRegistry({ testMode: row.testMode }).get(
					FLOOR_POLICY_IDS.REASONING_REVIEW
				)?.validatorId;
			}, 'the registry must answer, never throw').not.toThrow();

			expect(preflight.ready, `the preflight said ${preflight.code}`).toBe(row.ready);
			expect(registered === REFUSING, `the registry built ${registered}`).toBe(!row.ready);
		});
});

describe('⭐ SR-2 (D7) — a captured program override refuses the preflight, before paid work', () => {
	// ⛔ THE ROADMAP'S EXIT: a misconfigured host is refused BEFORE paid work, and a program override outside test mode is
	// a misconfiguration. The preflight asks the selector, which acts on the override the adapter CAPTURED at load — so
	// the arrangement sets it before a fresh import and removes it after, as a host sets it before the server starts.
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it('⛔ outside test mode, a captured JPWB_DEVIN_BIN refuses a devin host; in test mode the same host is READY', async () => {
		vi.resetModules();
		vi.stubEnv('JPWB_DEVIN_BIN', 'C:/stand-in/devin.exe');
		const { assurancePreflight: fresh } = await import('./preflight.js');
		vi.stubEnv('JPWB_DEVIN_BIN', undefined);
		const env = { JPWB_ASSURANCE_TOOL: 'devin', JPWB_ASSURANCE_MODEL: 'glm-5-3-flash-max' };

		const server = fresh({ testMode: false, env });
		expect(server.ready).toBe(false);
		expect(server.code).toBe('REVIEWER_PROGRAM_OVERRIDDEN');
		expect(server.guidance).toContain('JPWB_DEVIN_BIN="C:/stand-in/devin.exe"');
		expect(server.guidance).toContain('REG-D-084');
		expect(fresh({ testMode: true, env }).ready, 'in test mode the override is honoured').toBe(
			true
		);
	});
});
