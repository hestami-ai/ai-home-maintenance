// ⭐ `JAN-SELREV` SR-1 (D8) — THE PROBE A CHILD RUN EXECUTES WITH ~~THE EIGHT~~ ⭐ EVERY LIVE-BACKEND VARIABLE EXPORTED.
//
// ⛔ ON ITS OWN IT PROVES ALMOST NOTHING, AND IT SAYS SO. In a clean shell none of them is set, so every case below
// is green whatever the gate's entry points do. Its instrument is `verif/live-backend-isolation.test.ts`, which starts
// the gate's vitest entry points as CHILD processes with all of them exported and runs this file inside them: an
// in-process assertion is green today and proves nothing.
//
// ⭑ WHAT IT ASKS, per `REG-F-457` G8: each backend switch keys on its variable's ABSENCE — the reviewer on
// `JPWB_ASSURANCE_TOOL` (`createFloorRegistry`), the executor on `JPWB_EXECUTOR` (⭐ `JAN-SELRES` D4: the executor
// selector, `execution/executor-selection.ts`; `execution/model.ts` no longer chooses), the authoring agent on
// `JPWB_AGENT` (`workbench.ts`) — so an exported selection turns the gate's stand-ins into real, paid runs.
// ⛔ NOTHING HERE RUNS A REVIEW, OPENS AN EXECUTOR OR STARTS AN AGENT: it reads what each switch SELECTS.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { describe, expect, it } from 'vitest';
import { createFloorRegistry } from './assurance/index.js';
import { STANDIN_VALIDATOR_ID } from './assurance/standin-reasoning-review-validator.js';
import { selectExecutor } from './execution/executor-selection.js';
import { agentMode, isTestMode } from './workbench.js';

/**
 * The live-backend variables — the design's (D8) and those added since, each marked below — RESTATED here and never
 * imported from the module that removes them: a name that module forgot must still be asked about, or its omission
 * would pass here too.
 */
const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN',
	// ⭐ `JAN-EXEC` Phase 8 (the review of E4, finding 11) — the ninth: in test mode the replay switch selects the
	// replay's arms over the stand-ins asked about below (`replay/replay-switch.ts`).
	'JPWB_REPLAY',
	// ⭐ The re-review of E4's fix round — the tenth: the authoring agent's model, which the replay refuses beside its
	// switch (`replay/replay-switch.ts`, `LIVE_SELECTIONS_BESIDE_A_REPLAY`).
	'JPWB_AGENT_MODEL'
] as const;

describe('⭐ D8 — a gate process inherits no live-backend selection', () => {
	it('none of them reached this process', () => {
		const reached = LIVE_BACKEND_VARIABLES.filter((v) => process.env[v] !== undefined).map(
			(v) => `${v}=${JSON.stringify(process.env[v])}`
		);
		expect(reached, 'a live-backend selection reached a gate process').toEqual([]);
	});

	it('the reviewer is the declared stand-in', () => {
		expect(isTestMode()).toBe(true);
		expect(
			createFloorRegistry({ testMode: isTestMode() }).get(FLOOR_POLICY_IDS.REASONING_REVIEW)
				?.validatorId
		).toBe(STANDIN_VALIDATOR_ID);
	});

	// ⭐ `JAN-SELRES` RS-1 (D4) — ASKED AS THE REVIEWER'S LIMB ASKS THE REGISTRY: the selector `beginExecute` asks, in
	// the mode the host runs in. ~~`execution/model.ts` selects it exactly when no executor tool resolves~~ — it chooses
	// nothing now; the selector does, and answers the stand-in only in test mode with no tool named.
	it('the executor is the fixture — the executor selector answers the stand-in', () => {
		expect(isTestMode()).toBe(true);
		expect(selectExecutor({ testMode: isTestMode() }).kind).toBe('STAND_IN');
	});

	it('the authoring agent is the deterministic mock', () => {
		expect(agentMode()).toBe('mock');
	});

	// ⭑ THE CHILD'S RECEIPT — run only when the instrument started this process (its flag), and the instrument then
	// requires five passes of five. A child started without the exported environment has no flag, skips this case and
	// fails that count; an entry point that removed MORE than ~~the eight~~ ⭐ the live-backend variables loses the canary
	// and fails here.
	it.runIf(process.env.LIVE_BACKEND_PROBE === '1')(
		'the environment the instrument exported reached this process — its canary, not one of the live-backend variables, survived',
		() => {
			expect(process.env.JPWB_LIVE_BACKEND_CANARY).toBe('exported');
		}
	);
});
