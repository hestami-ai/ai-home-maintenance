// JAN-TOOLSUITE TS-01/TS-02 — the supported agent tool suite, and the executor's OWN configuration.
//
// ⭑ THE SUITE IS A CAPABILITY DECLARATION, NOT A LIST OF NAMES. A name would let a tool be trusted for facts it
// never supplies — the fabricated-measurement defect this repository records repeatedly. So the recorder never
// asks "is this Pi?"; it asks "does this tool report its own identity?" and believes it exactly that far.
//
// ⚠ AND IT IS AN IN-PROCESS SEAM, NOT A PERSISTED CONTRACT — the same status `createFloorRegistry` declares for
// itself. Of the 100 closed enums in the ratified contracts NOT ONE names a tool, agent, provider, CLI or
// vendor, and `PER-2` would make a deployment fact permanent. A vendor name may not enter the wire vocabulary.
import type { ExchangeIdentityFact } from '@janumipwb/rph-contracts';

export type BackingToolRole = 'EXECUTION' | 'ASSURANCE';

/**
 * The two evidence grades a TOOL can supply, DERIVED from the ratified enum rather than re-listed.
 *
 * ⭑ `Extract` is doing real work here. Re-typing the strings would let this declaration drift from
 * `ExchangeIdentityFactSchema` silently; deriving makes a rename in contracts a COMPILE error here. The other
 * two members are excluded deliberately: `REQUEST_ASSUMED` and `NONE` describe a record's state, not a
 * capability a tool can have.
 */
export type ToolIdentityEvidence = Extract<
	ExchangeIdentityFact['evidence'],
	'PROVIDER_REPORTED' | 'HOST_CONFIGURED'
>;

/**
 * What a tool can be believed about itself.
 *
 * ⭑ EVERY FIELD DRIVES A RECORDED FACT, which is why this is a declaration rather than documentation:
 *   `identity`    → the E-3 `evidence` arm. `PROVIDER_REPORTED` when the tool echoes back which model answered;
 *                   `HOST_CONFIGURED` when only the host asserts it and the tool confirms nothing.
 *   `version`     → whether a resolved model VERSION is available. A model LABEL is not a version, and writing
 *                   one into the version field is the substitution `PER-9` forbids.
 *   `reasoning`   → how the §9.7 answer/reasoning split is performed. `STRUCTURAL` when the tool returns typed
 *                   blocks, `INLINE` when it must be located by scanning, `NONE` when the tool volunteers none.
 *   `diagnostics` → whether a failure diagnostic can carry the prompt. ⚠ Used to decide what to CHECK, never to
 *                   skip checking — see `diagnosticCarriesPrompt`.
 */
export interface ToolReports {
	readonly identity: ToolIdentityEvidence;
	readonly version: boolean;
	readonly reasoning: 'STRUCTURAL' | 'INLINE' | 'NONE';
	readonly diagnostics: 'PROMPT_FREE' | 'PROMPT_BEARING';
}

export interface BackingTool {
	readonly toolId: string;
	/** The roles this tool can serve. ⚠ Capability, NOT policy: independence is decided by `checkIndependence`
	 *  against recorded identity, never by which roles a tool declares. A tool that can do both is not thereby
	 *  permitted to do both AT ONCE for one subject. */
	readonly roles: readonly BackingToolRole[];
	readonly reports: ToolReports;
}

/**
 * The tools this host knows how to drive, each declaring only what was MEASURED by running it.
 *
 * ⛔ NOTHING HERE IS INFERRED FROM DOCUMENTATION. Every value was obtained by driving the tool, because the
 * `agy` seam records what guessing costs: that it takes the prompt only in argv, that an empty `--print`
 * errors, that `-` is taken literally, and that Windows caps the command line near 32,767 chars — all of it
 * learned the hard way.
 */
export const BACKING_TOOLS: readonly BackingTool[] = Object.freeze([
	{
		toolId: 'agy',
		roles: ['EXECUTION', 'ASSURANCE'],
		reports: {
			// The host asserts the model via JPWB_JUDGE_MODEL and agy never echoes it back.
			identity: 'HOST_CONFIGURED',
			version: false,
			// The answer must be LOCATED inside a text blob — `splitAnswerSpan`, a heuristic, not a structure.
			reasoning: 'INLINE',
			// ⛔ execFile rejects with `Command failed: <full argv>` and agy's argv carries the WHOLE prompt.
			diagnostics: 'PROMPT_BEARING'
		}
	},
	{
		toolId: 'pi',
		roles: ['EXECUTION', 'ASSURANCE'],
		reports: {
			// `--mode json` returns provider/model/api/responseId on every message.
			identity: 'PROVIDER_REPORTED',
			// ⚠ Pi reports a model LABEL (`gpt-5.4-mini`), which is NOT a version.
			version: false,
			// `thinking` and `text` arrive as SEPARATE TYPED BLOCKS, so the split is structural.
			reasoning: 'STRUCTURAL',
			// Reads the prompt from stdin, so argv carries none of it.
			diagnostics: 'PROMPT_FREE'
		}
	},
	{
		toolId: 'devin',
		roles: ['EXECUTION', 'ASSURANCE'],
		reports: {
			// ATIF-v1.7 export: `agent.model_name` plus per-step `extra.generation_model`.
			identity: 'PROVIDER_REPORTED',
			version: false,
			// ⭑ MEASURED ABSENCE, NOT AN ASSUMPTION: `thinking`/`reasoning`/`thought` appear NOWHERE in a full
			// export. `PER-12` — there is no obligation to solicit or procure a trace, so this is an observed
			// absence and must be recorded as one rather than as a blocked split.
			reasoning: 'NONE',
			// `--prompt-file` keeps the prompt out of argv entirely — stronger than stdin.
			diagnostics: 'PROMPT_FREE'
		}
	}
]);

/** The tool ids this host can drive, derived from the catalog so the two can never disagree. */
export const KNOWN_TOOL_IDS: readonly string[] = BACKING_TOOLS.map((t) => t.toolId);

/**
 * Select a backing tool for a role, or REFUSE with a message that says what is wrong.
 *
 * ⛔ A SILENT FALLBACK IS THE FICTION `REG-D-052` FORBIDS. If the configured tool is unknown or cannot serve the
 * role, substituting another one would run work on a tool nobody chose and record it as though they had.
 */
export function selectBackingTool(
	toolId: string,
	role: BackingToolRole,
	// ⚠ INJECTABLE ONLY SO THE ROLE REFUSAL IS REACHABLE IN THE GATE. Every tool in the real catalog declares
	// BOTH roles, so with the catalog hard-wired the role branch below could never be entered and its test
	// would assert nothing — "a control that cannot fail", which this repository has shipped before. Same
	// reasoning as `AgyExec`.
	catalog: readonly BackingTool[] = BACKING_TOOLS
): BackingTool {
	const tool = catalog.find((t) => t.toolId === toolId);
	if (!tool)
		throw new Error(
			`Unknown backing tool '${toolId}'. This host can drive: ${catalog.map((t) => t.toolId).join(', ')}. ` +
				'Refusing rather than substituting: running work on a tool nobody chose, and recording it as ' +
				'though they had, is the fiction REG-D-052 forbids.'
		);
	if (!tool.roles.includes(role))
		throw new Error(
			`Backing tool '${toolId}' does not declare the ${role} role (it declares: ${tool.roles.join(', ')}).`
		);
	return tool;
}

// ── The executor's OWN configuration ────────────────────────────────────────────────────────────────────────
//
// ⭑⭑ THIS IS THE ACTUAL DEFECT, AND IT IS ONE LINE OF CONFIGURATION. Until now the execution producer had no
// configuration of its own: `execution/model.ts` read the ASSURANCE backend switch `JPWB_ASSESSOR` and the
// ASSURANCE model `JPWB_JUDGE_MODEL`, so the producing model and the reviewing model were THE SAME BY
// CONSTRUCTION and `checkIndependence('DIFFERENT_MODEL', …)` could only ever refuse. Giving the executor its
// own keys is what makes producer and reviewer CAPABLE of differing; everything else merely records that they do.
//
// ⛔ NO APPLICATION DEFAULT, IN EITHER KEY. `REG-D-052` is a sponsor ruling that the model is configured, never
// pinned, and that its absence is a REFUSAL. `REG-F-331` is the measured reason: a pinned label rotted, the
// installed tool rejected it, and EVERY Reasoning Review failed. A default here would reintroduce that exact
// failure one layer over.

export function resolveExecutorToolId(configured = process.env.JPWB_EXECUTOR): string | undefined {
	const trimmed = configured?.trim();
	return trimmed ? trimmed : undefined;
}

export function resolveExecutorModel(configured = process.env.JPWB_EXECUTOR_MODEL): string | undefined {
	const trimmed = configured?.trim();
	return trimmed ? trimmed : undefined;
}

/** The tool that runs execution steps. Refuses when unconfigured. */
export function executorToolId(): string {
	const id = resolveExecutorToolId();
	if (!id)
		throw new Error(
			'JPWB_EXECUTOR is not set, and there is no application default: the tool that executes work units is ' +
				`a deployment choice and must be configured explicitly. Set it to one of: ${KNOWN_TOOL_IDS.join(', ')}. ` +
				'⚠ It must not name the same tool AND model as the assurance reviewer, or the reasoning review will ' +
				'be refused for non-independence (ASR-13), which is the check working rather than a fault.'
		);
	return id;
}

/** The model the executing tool runs. Refuses when unconfigured — never falls back to the JUDGE model. */
export function executorModel(): string {
	const model = resolveExecutorModel();
	if (!model)
		throw new Error(
			'JPWB_EXECUTOR_MODEL is not set, and there is no application default (REG-D-052: the model is ' +
				'configured, not pinned; REG-F-331: a pinned label rotted and every review failed). ' +
				'⛔ It deliberately does NOT fall back to JPWB_JUDGE_MODEL: that fallback is exactly the ' +
				'producer/reviewer collision this module exists to remove.'
		);
	return model;
}
