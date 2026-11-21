// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (`REG-D-189`; `d84/d84-facts.md` §3.2 (c); the lead's rulings r1, Q6) — THE UNDERTAKING PAGE'S BATCH RUNNERS
// AND THE ASSURANCE STAGE'S DEPS, ONE DEFINITION: moved here whole from `routes/undertakings/[id]/+page.server.ts`, which imports them back, so that
// D84's measurement driver builds the stage's deps as the server builds them — the engine, the content store, the executor's selection, the
// Undertaking's sandbox, the sessions root, the page's atomic batch and the reviewer's — and never a restated copy that could drift from them.
// ⛔ NOTHING HERE CHANGED IN THE MOVE: each function's body, and each comment above it, are as the page had them. A `+page.server.ts` may export
// only the names SvelteKit reads, which is why they live here and not there.
import type { AssuranceStageDeps } from './assurance/assurance-stage.js';
import type { StageRecordDeps } from './assurance/assurance-stage-records.js';
import { selectExecutor } from './execution/executor-selection.js';
import { durableSessionsRoot, resolveUndertakingSandbox } from './execution/workspace-host.js';
import { ASSURANCE_REVIEWER_CREDENTIAL } from './identity.js';
import { dispatch, dispatchBatch, dispatchMultiPartyBatch, getArtifactStore, getEngine, hostNow, mintUiId } from './workbench.js';

/** ⚠ ONE TENANT, DECLARED RATHER THAN INLINE. §31.2 requires an opaque tenant-scoped key prefix, and this demo
 *  is single-tenant; naming the constant keeps the day it becomes multi-tenant a one-line change instead of a
 *  search for string literals. */
export const EXECUTION_TENANT_PREFIX = 'tnt-local';

/** One command of a batch, as the page builds it: its type, its aggregate's type and id, and its payload. */
export type Step = [command: string, aggType: string, aggId: string, payload: unknown];

/**
 * Run a command sequence ATOMICALLY, returning the rejection that stopped it (naming the command that failed;
 * DUPLICATE is fine) or null on success. Prefixing the command type turns an opaque "Schema validation failed"
 * into a locatable one.
 *
 * ATOMIC SINCE 2026-07-28, AND IT WAS A REAL DEFECT UNTIL THEN (JPWB-SPEC-001 `SPEC-001-INV-14`, FORK-23 (b)).
 * This function used to loop `dispatch` one command at a time and `return` on the first refusal — so every command
 * BEFORE the refused one stayed committed. The seeded reference Undertaking makes that visible in one click:
 * its root PWU sits at EXECUTING/QUEUED, the overview row offers Record Assurance because it branches on
 * `workLifecycleState` alone, and the sequence ends in a `QUEUED -> SUCCEEDED` hop that is not an arrow
 * (`transitions.data.ts:505-509`). The engine refused, correctly — and two ASSURANCE_ASSESSMENT objects were
 * already on disk, appearing thereafter in the Assurance tab as orphans. Every click minted two more.
 *
 * WHAT MAKES THE FIX SMALL IS THAT NOTHING NEW WAS NEEDED. `dispatchBatch` wraps the identical loop — same
 * ACCEPTED/DUPLICATE accept criteria — in `store.transaction()` and unwinds every commit on the first refusal
 * (`command-bus.ts:169-188`). This same application already dispatched atomically in two other places: the PWA
 * Designer (`pwa/[id]/+page.server.ts:632`) and the authoring turn (`authoring-turn.ts:452`). Only this surface
 * did not, and the specification that ruled it (FORK-8/FORK-23) was itself drafted on the false premise that the
 * engine had no multi-command envelope — a claim struck at SPEC-001 §11.1.8.
 *
 * The error CONTRACT is unchanged: callers still receive `"<CommandType>: <message>"` or null, so no call site
 * moves. `failedIndex` names the offending command; it is always present on a failed batch, and the fallbacks
 * exist so a future batch that fails without one degrades to a locatable message rather than to `undefined`.
 *
 * RED-PROOF: `e2e/undertaking-atomicity.e2e.ts`. Against the pre-fix implementation its first spec fails on the
 * assessment-count assertion — NOT on the refusal assertion, which passed throughout. A test that only checked
 * the error was surfaced would have been green against this defect for as long as it existed.
 */
/**
 * ⭐ THE ONE PLACE A REFUSED BATCH BECOMES A MESSAGE — for the single-party runner and the multi-party one alike.
 *
 * ⛔ IT IS ONE FUNCTION BECAUSE THE LEDGER'S OWN GATE SAID SO. `R23` briefly gave these five lines two homes,
 * and `S3-runSteps-loses-atomicity` — whose anchor is the `batch.ok` line — immediately reported UNANCHORED:
 * *"a claim someone cited as evidence can no longer be performed."* The repair is not a cleverer anchor. Two
 * copies of the rule *"a Surface must not report success for a sequence the engine refused"* is exactly the
 * drift that lets one copy be fixed and the other not.
 */
function batchError(
	batch: ReturnType<typeof dispatchBatch>,
	commandTypeAt: (index: number) => string
): string | null {
	if (batch.ok) return null;
	const at = batch.failedIndex ?? batch.results.length - 1;
	const failed = batch.results[at];
	return `${commandTypeAt(at)}: ${failed?.error?.message ?? failed?.status ?? 'REJECTED'}`;
}

export function runSteps(steps: readonly Step[]): string | null {
	return batchError(
		dispatchBatch(
			steps.map(([commandType, targetAggregateType, targetAggregateId, payload]) => ({
				commandType,
				targetAggregateType,
				targetAggregateId,
				payload
			}))
		),
		(index) => steps[index]?.[0] ?? '(unknown command)'
	);
}

/**
 * ⭐⭐ ONE TRANSACTION, TWO ACTING PARTIES (`JAN-EXEC` `R23`, design §4.16).
 *
 * ⛔ THE TWO-BATCH VERSION OF THIS WAS A REAL REGRESSION AND `undertaking-atomicity.e2e.ts` CAUGHT IT: 39
 * assessments before a refused affordance, 42 after. Three orphans, which is verbatim the defect
 * `SPEC-001-INV-14` pins — *"a partially-applied sequence SHALL NOT leave committed state behind"*.
 *
 * ⚠ AND THE OBVIOUS FIX WAS THE WRONG ONE. Reordering the batches so the refusal happens first would have made
 * that spec green while leaving the window open in the other direction, and collapsing back to one session would
 * have restored the self-review (`REG-F-400`). The envelope itself had to admit two parties, because the corpus
 * requires BOTH atomicity and independence and the engine could previously express only one at a time.
 *
 * Each entry names the credential it is issued under; the reviewer's assessments and the controller's state hops
 * commit together or not at all, and every command is stamped from its OWN resolved principal.
 */
export function runMultiParty(
	reviewerSteps: readonly Step[],
	operatorSteps: readonly Step[]
): string | null {
	const entries = [
		...reviewerSteps.map((step) => ({ step, as: ASSURANCE_REVIEWER_CREDENTIAL })),
		...operatorSteps.map((step) => ({ step, as: undefined }))
	];
	return batchError(
		dispatchMultiPartyBatch(
			entries.map(({ step: [commandType, targetAggregateType, targetAggregateId, payload], as }) => ({
				command: { commandType, targetAggregateType, targetAggregateId, payload },
				...(as === undefined ? {} : { as })
			}))
		),
		(index) => entries[index]?.step[0] ?? '(unknown command)'
	);
}

/** ⭐ Package L17b1 — what the assurance stage's records and the tactic record need of this route: its store, its ids, its clock and its batch. */
export function stageRecordDepsOf(): StageRecordDeps {
	return {
		store: getArtifactStore(),
		tenantPrefix: EXECUTION_TENANT_PREFIX,
		newId: mintUiId,
		now: hostNow,
		runSteps: (steps) => runSteps(steps.map((s): Step => [s[0], s[1], s[2], s[3]]))
	};
}

/**
 * ⭐ L17b2 — WHAT A PRESS OF THE ASSURANCE STAGE, OR OF ITS HISTORIAN ONCE MORE, IS HANDED: the stage's records, the executor, the shared workspace and
 * the sessions root, as L17b1's act handed them; and the reviewer's batch for the Historian's assessment (`runMultiParty`, as the declared reviews'
 * steps go out under the reviewer's credential).
 */
export function stageDepsOf(testMode: boolean): AssuranceStageDeps {
	return {
		...stageRecordDepsOf(),
		engine: getEngine(),
		dispatchExchange: (payload, aggregateId) => dispatch('RecordModelExchange', 'MODEL_EXCHANGE', aggregateId, payload),
		testMode,
		executor: selectExecutor({ testMode }),
		sandboxOf: (undertakingId) => resolveUndertakingSandbox(undertakingId),
		sessionsRoot: durableSessionsRoot(process.env),
		runReviewerSteps: (steps) => runMultiParty(steps.map((s): Step => [s[0], s[1], s[2], s[3]]), [])
	};
}
