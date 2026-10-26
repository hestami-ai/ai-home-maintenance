// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-D-111` (5); `REG-F-530`) — THE REPLAY'S SWITCH:
// `JPWB_REPLAY=<recording folder>`, read by BOTH selectors, so the executor and the reviewer replay together or not at all.
//
// ⛔ HONOURED ONLY IN TEST MODE, AND REFUSED OUTSIDE IT WITH ITS OWN CODE. The rule the declared stand-ins obey
// (`createFloorRegistry`; `REG-D-052`): a deterministic answerer switched on in any environment once let the floor record
// SATISFIED while nothing reviewed anything. A replay is deterministic answers from a file, so outside test mode the
// switch is not ignored — ignoring it would run the real tools the operator meant to replace — it is REFUSED, before
// anything is dispatched, by each selector (`EXECUTOR_REPLAY_OUTSIDE_TEST_MODE`, `REVIEWER_REPLAY_OUTSIDE_TEST_MODE`).
// ⛔ AND NEVER BESIDE ~~A NAMED TOOL~~ ⭐ ANY LIVE-BACKEND SELECTION (`REG-D-112` (c): the review of E4, finding 2 — the
// general form of the rule this paragraph first gave for two variables). A replay with `JPWB_EXECUTOR` or
// `JPWB_ASSURANCE_TOOL` also set ~~is refused (`…_REPLAY_BESIDE_A_TOOL`)~~ — ⭐ or the authoring agent `JPWB_AGENT`, or a
// model or program any live backend would run (`LIVE_SELECTIONS_BESIDE_A_REPLAY`) — is refused
// (`…_REPLAY_BESIDE_A_LIVE_SELECTION`), naming each: whichever one won silently, the other would be a configuration that
// did nothing — and the one that could win wrongly is the live backend, a paid call where the operator asked for a replay
// (`REG-D-067`: the replay never falls back to a live reviewer, the stand-in, or answers by order). `JPWB_AGENT=pi` was
// the case the first form missed: the authoring turn is not replayed (`REG-D-112` (c)), so beside the switch it would
// have been LIVE Pi, unrefused.
// ⭐ AND THE AUTHORING TURN IS REFUSED UNDER THE SWITCH (`REG-D-112` (c); `authoringRefusedUnderReplay`): the replay covers
// the execution half from the published PWA, its recording holds no authoring call, and an authoring turn's floor would ask
// the REPLAY reviewer a review the recording does not hold — so the authoring route refuses the turn before it begins.
// ⚠ IT IS READ, NEVER OPENED, HERE: the folder is read when the replay opens (`replay-run.ts`), where a recording that
// cannot be read is a refusal recorded on the step — the selectors stay free of file reads, as the other arms are.

/** The switch. */
export const REPLAY_VARIABLE = 'JPWB_REPLAY';

/** The recording folder the switch names, trimmed; blank or whitespace is UNSET — the selectors' rule for every switch. */
export function resolveReplayRecording(configured: string | undefined): string | undefined {
	return configured?.trim() || undefined;
}

/**
 * ⭐ `REG-D-112` (c) — EVERY LIVE-BACKEND SELECTION A REPLAY REFUSES BESIDE IT: the tools, the models they run and the
 * authoring agent with its model, read from the environment — ~~the gate's eight~~ ⭐ the gate's live-backend variables
 * (`verif/live-backend-isolation.ts`, `LIVE_BACKEND_VARIABLES`) less the two program overrides, which the adapters
 * CAPTURED when they loaded and the selectors are handed apart (`overrides`), and less this switch itself ⭐ — and less the
 * authoring review's allowance (`JPWB_AUTHORING_REVIEW_ALLOWANCE`, stripped from the gate since package O, design D26): a server
 * setting that selects no backend, so a replay beside it is no live selection, and its authoring turns are refused anyway
 * (`authoringRefusedUnderReplay`). Among them is
 * `JPWB_AGENT_MODEL`, the authoring agent's model (`agent/pi-agent.ts`) — ⭐ which the gate's entry points remove too
 * since the re-review of E4's fix round, so one a shell exported never turns a gate replay test into this refusal.
 */
export const LIVE_SELECTIONS_BESIDE_A_REPLAY = [
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_AGENT',
	'JPWB_AGENT_MODEL'
] as const;

/**
 * ⭐ `REG-D-112` (c) — THE LIVE-BACKEND SELECTIONS SET BESIDE THE SWITCH, by name: each environment variable above that is
 * set (blank or whitespace is unset, the selectors' rule), and each program override the adapters captured
 * (`JPWB_AGY_BIN`, `JPWB_DEVIN_BIN`). Empty when none is — the only arrangement a replay runs in.
 */
export function liveSelectionsBesideReplay(
	env: Readonly<Record<string, string | undefined>>,
	overrides: { readonly agy: string | undefined; readonly devin: string | undefined }
): string[] {
	return [
		...LIVE_SELECTIONS_BESIDE_A_REPLAY.filter((name) => (env[name]?.trim() ?? '') !== ''),
		...(overrides.agy === undefined ? [] : ['JPWB_AGY_BIN']),
		...(overrides.devin === undefined ? [] : ['JPWB_DEVIN_BIN'])
	];
}

/** The sentence each selector's `…_REPLAY_BESIDE_A_LIVE_SELECTION` refusal carries, naming what was set. */
export const besideReplayReason = (set: readonly string[]): string =>
	`${REPLAY_VARIABLE} is set and so is ${set.join(', ')}: a replay answers from its recording alone, so beside it a ` +
	'live backend would either do nothing or — winning silently — make a paid call where a replay was asked for ' +
	'(REG-D-112 (c)). Unset one or the other.';

/**
 * ⭐ `REG-D-112` (c) — WHY AN AUTHORING TURN IS REFUSED WHILE THE SWITCH IS SET, or undefined when it is not. Read from
 * `env` (the process's by default) whatever mode the host runs in: outside test mode the selectors refuse the switch
 * anyway, and the turn is refused either way.
 */
export function authoringRefusedUnderReplay(
	env: Readonly<Record<string, string | undefined>> = process.env
): string | undefined {
	if (resolveReplayRecording(env[REPLAY_VARIABLE]) === undefined) return undefined;
	return (
		`${REPLAY_VARIABLE} is set, and an authoring turn is not replayed (REG-D-112 (c)): a replay covers the execution ` +
		'half from the PUBLISHED PWA, which it re-creates from its recording, and the recording holds no authoring call — ' +
		'so this turn would reach a live authoring agent, or ask the replay a review it does not hold. Unset ' +
		`${REPLAY_VARIABLE} to author.`
	);
}
