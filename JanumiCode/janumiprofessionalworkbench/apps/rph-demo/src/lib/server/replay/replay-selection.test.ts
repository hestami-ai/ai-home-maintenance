// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-D-111` (5); `REG-F-530`) — THE SWITCH, AT BOTH
// SELECTORS: `JPWB_REPLAY` in test mode answers REPLAY for the executor and the reviewer alike; outside test mode it is
// refused with its own code; beside a named tool it is refused; and unset, nothing changes.
//
// ⭑ PREDICTED RED, WRITTEN BEFORE THE ARM EXISTED: test mode with `JPWB_REPLAY` set answers `STAND_IN` today
// (`executor-selection.ts:202-204`; `reviewer-selection.ts:160-162`, at `03b3bf03`), because neither selector reads the switch.
import { describe, expect, it } from 'vitest';
import { assurancePreflight } from '../assurance/preflight.js';
import { selectReviewer } from '../assurance/reviewer-selection.js';
import { executorRecordIdentity, selectExecutor } from '../execution/executor-selection.js';

/** ⭑ A folder the selector only names: it reads no file, so no absolute path need be spelled here (`REG-F-536`). */
const DIR = 'recordings/one-unit';
const NO_OVERRIDES = { agy: undefined, devin: undefined } as const;

describe('JPWB_REPLAY — the replay switch, read by both selectors (D2)', () => {
	it('test mode with the switch set answers REPLAY, for the executor and the reviewer alike', () => {
		const env = { JPWB_REPLAY: DIR };
		expect(selectExecutor({ testMode: true, env, overrides: NO_OVERRIDES })).toEqual({
			kind: 'REPLAY',
			recordingDir: DIR
		});
		expect(selectReviewer({ testMode: true, env, overrides: NO_OVERRIDES })).toEqual({
			kind: 'REPLAY',
			recordingDir: DIR
		});
	});

	it('the folder is read trimmed, as every switch is; blank or whitespace is unset, and the stand-in stays', () => {
		expect(
			selectExecutor({
				testMode: true,
				env: { JPWB_REPLAY: `  ${DIR}\n` },
				overrides: NO_OVERRIDES
			})
		).toEqual({ kind: 'REPLAY', recordingDir: DIR });
		for (const blank of ['', '   '])
			for (const select of [selectExecutor, selectReviewer])
				expect(
					select({ testMode: true, env: { JPWB_REPLAY: blank }, overrides: NO_OVERRIDES })
				).toEqual({
					kind: 'STAND_IN'
				});
	});

	it('outside test mode the switch is REFUSED, with its own code, and never ignored for the real tools', () => {
		// ⛔ A configured live tool beside it does not rescue it: outside test mode the switch itself is the refusal.
		const env = {
			JPWB_REPLAY: DIR,
			JPWB_EXECUTOR: 'pi',
			JPWB_EXECUTOR_MODEL: 'fixture-executor',
			JPWB_ASSURANCE_TOOL: 'devin',
			JPWB_ASSURANCE_MODEL: 'fixture-assurance'
		};
		const executor = selectExecutor({ testMode: false, env, overrides: NO_OVERRIDES });
		expect(executor).toMatchObject({ kind: 'REFUSED', code: 'EXECUTOR_REPLAY_OUTSIDE_TEST_MODE' });
		expect(executor.kind === 'REFUSED' ? executor.reason : '').toContain('JPWB_REPLAY');
		const reviewer = selectReviewer({ testMode: false, env, overrides: NO_OVERRIDES });
		expect(reviewer).toMatchObject({ kind: 'REFUSED', code: 'REVIEWER_REPLAY_OUTSIDE_TEST_MODE' });
		expect(reviewer.kind === 'REFUSED' ? reviewer.reason : '').toContain('JPWB_REPLAY');
		// ⭑ And the preflight every model step asks first carries the reviewer's refusal, so nothing is dispatched.
		expect(assurancePreflight({ testMode: false, env })).toMatchObject({
			ready: false,
			code: 'REVIEWER_REPLAY_OUTSIDE_TEST_MODE'
		});
	});

	it('beside a named tool the switch is refused in test mode too: neither may silently win', () => {
		const executor = selectExecutor({
			testMode: true,
			env: { JPWB_REPLAY: DIR, JPWB_EXECUTOR: 'pi', JPWB_EXECUTOR_MODEL: 'fixture-executor' },
			overrides: NO_OVERRIDES
		});
		expect(executor).toMatchObject({
			kind: 'REFUSED',
			code: 'EXECUTOR_REPLAY_BESIDE_A_TOOL',
			toolId: 'pi'
		});
		const reviewer = selectReviewer({
			testMode: true,
			env: {
				JPWB_REPLAY: DIR,
				JPWB_ASSURANCE_TOOL: 'devin',
				JPWB_ASSURANCE_MODEL: 'fixture-assurance'
			},
			overrides: NO_OVERRIDES
		});
		expect(reviewer).toMatchObject({
			kind: 'REFUSED',
			code: 'REVIEWER_REPLAY_BESIDE_A_TOOL',
			toolId: 'devin'
		});
	});

	it('the replay is a ready reviewer to the preflight, and the executor’s record falls back to no configured model', () => {
		expect(assurancePreflight({ testMode: true, env: { JPWB_REPLAY: DIR } })).toEqual({
			ready: true,
			code: 'READY',
			guidance: ''
		});
		// ⭑ No configured model produced a replayed answer: the replay reports the recorded producer itself, graded
		// HOST_CONFIGURED (`replay-executor.ts`), and a turn that throws falls back to the stand-in's `unresolved`.
		expect(executorRecordIdentity({ kind: 'REPLAY', recordingDir: DIR })).toEqual({
			modelId: 'unresolved',
			providerId: 'unresolved'
		});
	});
});
