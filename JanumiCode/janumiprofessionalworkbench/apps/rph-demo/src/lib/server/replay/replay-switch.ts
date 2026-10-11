// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-D-111` (5); `REG-F-530`) — THE REPLAY'S SWITCH:
// `JPWB_REPLAY=<recording folder>`, read by BOTH selectors, so the executor and the reviewer replay together or not at all.
//
// ⛔ HONOURED ONLY IN TEST MODE, AND REFUSED OUTSIDE IT WITH ITS OWN CODE. The rule the declared stand-ins obey
// (`createFloorRegistry`; `REG-D-052`): a deterministic answerer switched on in any environment once let the floor record
// SATISFIED while nothing reviewed anything. A replay is deterministic answers from a file, so outside test mode the
// switch is not ignored — ignoring it would run the real tools the operator meant to replace — it is REFUSED, before
// anything is dispatched, by each selector (`EXECUTOR_REPLAY_OUTSIDE_TEST_MODE`, `REVIEWER_REPLAY_OUTSIDE_TEST_MODE`).
// ⛔ AND NEVER BESIDE A NAMED TOOL. A replay with `JPWB_EXECUTOR` or `JPWB_ASSURANCE_TOOL` also set is refused
// (`…_REPLAY_BESIDE_A_TOOL`): whichever one won silently, the other would be a configuration that did nothing — and the
// one that could win wrongly is the live tool, a paid call where the operator asked for a replay (`REG-D-067`: the
// replay never falls back to a live reviewer, the stand-in, or answers by order).
// ⚠ IT IS READ, NEVER OPENED, HERE: the folder is read when the replay opens (`replay-run.ts`), where a recording that
// cannot be read is a refusal recorded on the step — the selectors stay free of file reads, as the other arms are.

/** The switch. */
export const REPLAY_VARIABLE = 'JPWB_REPLAY';

/** The recording folder the switch names, trimmed; blank or whitespace is UNSET — the selectors' rule for every switch. */
export function resolveReplayRecording(configured: string | undefined): string | undefined {
	return configured?.trim() || undefined;
}
