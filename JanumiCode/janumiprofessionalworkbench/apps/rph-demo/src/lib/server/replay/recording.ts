// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D1; `REG-D-111` (5); `REG-F-530`) — THE REPLAY'S RECORDING:
// what a paid run leaves for CI to replay at no cost, as one folder of four files.
//
//   recording.json   the commit, the reviewer fingerprint, the PWA-content digest, ⭐ the OS FAMILY it was made on, ⭐ the
//                    PUBLISHED PWA's declared content (`REG-D-112` (c), below), the models, the scrub's token kinds, and
//                    the expected stage matrix (the run report's cells: stage, row, value);
//   executor.jsonl   one line per EXECUTOR TRY, in dispatch order: the unit, `turnSha256` (over the scrubbed turn text),
//                    ⭐ `instructionsSha256` and `toolsSha256` (the executor's system prompt and tool definitions, below),
//                    the tool calls in the order the model made them, with their arguments, what the host observed of
//                    each ⭐ and `resultSha256`, the hash of the result the model READ of it (below), the answer (⭐ a
//                    failed call's REPORTER with it), and the producer;
//   commands.jsonl   one line per command the REAL runner was asked to run, in the order it was asked: the argv and the
//                    recorded outcome — exit, timedOut, durationMs, outputComplete, the declared omissions, and the
//                    capture's bytes (stdout, stderr) — or the refusal it gave;
//   reviewer.jsonl   one line per REVIEWER CALL ⭐ OF THE EXECUTION HALF, in dispatch order: the unit, the framing, the
//                    role, `promptSha256` (over the scrubbed prompt), the prompt's own bytes, the reply (ANSWERED /
//                    NOT_RETAINED / NO_ANSWER_SPAN / THROWN with its sanitised message), the evaluator, and the call's
//                    ELAPSED time.
//
// ⛔ ALL THREE MUST REPLAY (`REG-F-530`): a replay of the executor alone either pays the reviewer and runs real commands,
// or reviews with the stand-in and stops at the first unit. So the recording holds the reviewer's answers and the
// commands' results beside the executor's turns, and the replay serves each from here (`replay-run.ts`).
//
// ⭐⭐ `REG-D-112` (c) — THE REPLAY COVERS THE EXECUTION HALF, FROM THE PUBLISHED PWA. The authoring turn is not replayed:
// its own model calls leave no record (`agent/pi-agent.ts`), so the recorder LEAVES OUT the authoring floor's reviews (a
// Reasoning Review whose subject is the PWA itself, `floor.ts`'s `runPwaFloor`) and records instead what the turn
// PRODUCED — the published PWA's declared content (`RecordedPwa`: its types and prompts as `DefinePwuType` takes them,
// and the policies they name, each by the hash of its content). The replay re-creates that PWA before the Undertaking
// (`replay-pwa.ts`) and holds it to `pwaContentDigest` BEFORE THE FIRST CALL (`ReplayRun.checkPublishedPwa`): ~~a recording
// of another PWA is refused there, and serves no try.~~ ⭐ (the re-review of E4's fix round, on the check's real scope) a
// re-created PWA that does not digest to the recording's is refused there, and serves no try: a recording whose `pwa`
// and digest disagree, or a re-creation the engine stores otherwise than recorded, in the fields the digest covers. A
// recording made on another PWA carries that PWA and its digest, and replays it — nothing in a replay types a PWA.
// ⛔ A type its author REMOVED is neither recorded nor digested (`liveTypesOf`).
//
// ⭐⭐ THE EXECUTOR'S KEY IS ITS WHOLE INSTRUCTION, NOT ONLY ITS TURN (the review of E4, finding 1). What a model answered
// is a function of the system prompt it was given and the tools it was offered as well as the turn's text, so a try is
// served only when all three hash to the recording's: `instructionsSha256` over the execution contract AS SENT
// (`instructionsOfSentPrompt` — the payload's system prompt less Pi's own date and working-directory lines), and
// `toolsSha256` over each tool's name, description and parameter schema AS MINTED (`toolDefinitionsSha256`). The replay
// recomputes both from the code under test (`replay-executor.ts`) and refuses `REPLAY_STALE` on a mismatch, naming the
// part and both hashes — a changed `EXECUTION_CONTRACT_PROMPT` or tool surface can no longer replay green.
// ⭐⭐ AND WHAT IT READ MID-TURN (the lead's delegated decision of 2026-10-15, to be registered; the second fix round's F7,
// "stated, not built" there). The answer was also made reading each call's RESULT — `write_file`'s message,
// `run_command`'s rendered exit, output and structured result (`toPiToolResult`) — so each recorded call carries
// `resultSha256`, over the scrubbed text the run's payload sent the model as that call's output (`function_call_output`).
// The replay renders the result again from the code under test, as Pi would send it (`toolResultAsSent`), and refuses
// `REPLAY_STALE` where the hash differs, naming the call and both hashes: a change to how a result is rendered can no
// longer replay green under an answer made reading the old rendering.
// ⚠⚠ A SIZE MEASURED OF A SCRUBBED PATH IS ~~THE HOST'S~~ ⭐ THE REPLAY'S — A LIMIT OF THIS KEY, STATED. The scrub makes a
// path the same on every host, but not a number measured of text that holds one: a `write_file` whose contents name the
// run's own workspace is reported as so many bytes, and ~~the replay host's workspace path is another length. Such a call
// goes `REPLAY_STALE` where the two hosts' directories differ in length~~ ⭐ (the check of E4's polish round, F2) a
// replay's workspace path is another length, on the recording's own host too: a replay builds its sandbox in a fresh
// temporary folder (`replay-run.ts`, `disposableRoot`), never at the run's `<JPWB_DEMO_DB>.workspaces`
// (`workspace-host.ts`), so the two are as long only by chance. Such a call goes `REPLAY_STALE` in EVERY replay whose
// sandbox path is not as long as the run's workspace path, the recording's own host included, and the refusal says so
// (`ReplayRun.checkToolResult`).
//
// ⛔ SCRUBBED BEFORE IT IS WRITTEN, AND HASHED OVER THE SCRUBBED BYTES (`REG-F-536`). Every executor prompt carries the
// host's absolute workspace path, which names the operator's account, and a command's output can carry it too. The
// recorder (`scripts/phase7/record-replay.ts`) replaces the run's own directories by TOKENS (`scrubPairs`), and every
// hash in the recording is taken over the scrubbed text. The replay scrubs ITS OWN directories to the same tokens before
// it hashes, so a recorded prompt and a replayed one compare equal exactly when they differ only in where they ran.
// ⚠ A path the scrub does not know ~~— a home folder in a stack trace —~~ is not scrubbed: the recorder's archive scan
// refuses the recording instead (`archive-scan.ts`), so what cannot be scrubbed is never written. ⭐ (The review of E4,
// finding 5: the home folder IS scrubbed — it is one of the scrub's three places, `ScrubPlace`. What the scrub does not
// know is any OTHER path: another account's folder, a drive or a share outside the run's three places.) The scan reads
// the recording's DECODED values ~~, so a backslash JSON doubled is not read as a path~~ (`record-replay.ts`), and ~~a
// backslash JSON doubled is not read as a share at any depth of escaping~~ ⭐ JSON doubling keeps a backslash run's
// ratio, so code whose runs are equal is no share at any depth of escaping, and a share is one (`archive-scan.ts`,
// `PATH_PATTERNS`).
//
// ⚠⚠ A RECORDING REPLAYS ON THE OS FAMILY IT WAS MADE ON — A LIMIT OF THIS FORMAT, STATED (finding 6). A run's text is
// spelled as its host spells it — paths with `\` or `/`, line ends, the messages its programs print — and the scrub's
// tokens stand for one host's spellings: on POSIX a path's native and forward-slash spellings coincide, so a POSIX
// replay's own scrub names a token a Windows recording does not hold, and the first prompt carrying a path would go
// REPLAY_STALE for a reason that is not the code's. So the manifest names its family (`osFamily`), and `readRecording`
// refuses a recording of the other one first, naming both. Replaying across families would need a recording per family,
// or a scrub that normalises every spelling; neither is built.
//
// ── ⛔ `REG-Q-066` — THE RECORDING CARRIES A COMMAND'S stderr, AND THIS IS ITS DISPOSITION ──────────────────────────────
// `commands.jsonl` holds each command's captured stdout AND stderr (D1): commands are replayed, never re-run, so the
// bytes a review was shown must be written back exactly. They are the recorded run's own capture (`PURGEABLE_AT_EXPIRY`,
// `child-process-runner.ts`) and its evidence's mint (`RETAINED_BY_PARTICIPATION`, `R16`); what the recording adds is a
// COMMITTED copy. ⭑ The recorder writes it only scrubbed of the run's directories, and refuses on any archive-scan hit —
// the account name or an absolute path (`REG-F-536`). ⚠ THE RESIDUAL IS LARGER THAN THE STORES', AND IT IS STATED: the
// scan cannot see a secret a command read from disk and printed, and a committed file has no purge — git history is its
// removal path. `verif/agy-stderr-unbound.test.ts` lists this module among the disposed sites, for this paragraph.
//
// ⭑ THE FORMAT LIVES IN THE PRODUCT, NOT IN THE RECORDER, because the product READS it: the replay arms open a recording
// under `JPWB_REPLAY` in test mode (`replay-switch.ts`). The recorder writes through `recordingFiles` and every reader
// reads through `readRecording`, so the two cannot disagree about a field.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { ProcessOutputOmission } from '@janumipwb/rph-ports';

/**
 * The format's own name and version. ⛔ A reader refuses any other: a recording of another shape replays another run.
 * ⭐ ~~`/1`~~ `/2` (the review of E4; `REG-D-112`): the executor's key (`instructionsSha256`, `toolsSha256`), the published
 * PWA (`pwa`), the OS family (`osFamily`) and a failed call's reporter (`reportedBy`). A `/1` recording holds none of them,
 * so it is refused as another shape rather than read with its key half missing. None was ever committed.
 * ⭐ ~~`/2`~~ `/3` (the lead's delegated decision of 2026-10-15, to be registered): each tool call's `resultSha256`. A `/2`
 * recording keys no result, and is refused the same way. None was committed either.
 */
export const RECORDING_FORMAT = 'jpwb-replay-recording/3';

/** The OS family a recording was made on (finding 6, the header's "⚠⚠"). */
export type OsFamily = 'windows' | 'posix';

/** The family of `platform` — this process's by default. */
export const osFamilyOf = (platform: string = process.platform): OsFamily =>
	platform === 'win32' ? 'windows' : 'posix';

/** The four files, by role. */
export const RECORDING_FILES = {
	manifest: 'recording.json',
	executor: 'executor.jsonl',
	commands: 'commands.jsonl',
	reviewer: 'reviewer.jsonl'
} as const;

/**
 * The directories a run's text names, each replaced by a token. ⭑ The two the run's own bytes can carry: the
 * Undertaking's deliverable workspace, which Pi prints into every executor prompt (`REG-F-536`) and a test runner prints
 * into its output, and the process-output workspace beside it (`workspace-host.ts`) — ⭐ and the HOME folder of the
 * account the run ran as, which a tool's failure prints (devin's prompt and export files live under its temp folder, in
 * P3's thrown reviewer call) and which names the account itself.
 */
export type ScrubPlace = 'WORKSPACE' | 'PROCESS_OUTPUT' | 'HOME';

const PLACES: readonly ScrubPlace[] = ['WORKSPACE', 'PROCESS_OUTPUT', 'HOME'];

/**
 * How a path is spelled in text. ⭑ THREE, BECAUSE THE RUN WRITES THREE: the host's own (`\` on Windows), the forward-slash
 * form Pi prints the working directory in, and the JSON-escaped form (each `\` doubled) a record that holds JSON keeps.
 * Each has its own token, so expanding a token gives back the very spelling it replaced.
 */
export type ScrubSpelling = 'native' | 'posix' | 'json';

const SPELLINGS: readonly ScrubSpelling[] = ['json', 'native', 'posix'];

/**
 * The token one place in one spelling is replaced by: `JPWB_REPLAY_<PLACE>_<SPELLING>`, e.g. `JPWB_REPLAY_WORKSPACE_NATIVE`.
 * ⛔ IT ENDS IN A WORD CHARACTER, ON PURPOSE, AND NO TOKEN IS ANOTHER'S PREFIX. The archive scan (`archive-scan.ts`) reads a
 * separator after a non-word character as the start of an absolute path: a token closed by `}` made every path relative
 * to it — `{{HOME}}\AppData\…` in a JSON line — read as a UNC path, and refused the recording it was there to make
 * committable (driven on this test's own fixture). After a word character the scan's lookbehinds hold, and a token
 * is never mistaken for the start of a path. Distinct final words keep `expandText`'s plain `replaceAll` exact.
 * ⭐ (Since the re-review of E4's fix round the scan reads a share by its runs' ratio, so `\\AppData\\…` in a line — runs
 * of two and two — is no share after a `}` either; the word-character ending stays, for the patterns that still read a
 * separator after a non-word character as a path's start.)
 */
export const scrubToken = (place: ScrubPlace, spelling: ScrubSpelling): string =>
	`JPWB_REPLAY_${place}_${spelling.toUpperCase()}`;

/** Every token a recording can carry, in a stable order: what `recording.json` lists as its scrub's token kinds. */
export const SCRUB_TOKENS: readonly string[] = PLACES.flatMap((place) =>
	SPELLINGS.map((spelling) => scrubToken(place, spelling))
);

/** One literal spelling and the token that stands for it. */
export interface ScrubPair {
	readonly literal: string;
	readonly token: string;
}

/**
 * ⭐ THE SCRUB'S PAIRS for a run's own directories — every spelling of each, LONGEST FIRST, so a path that another
 * contains (the workspace inside its own `.process-output` sibling's name, or inside the home folder) is never replaced
 * before the longer one.
 * ⚠ On a host where two spellings coincide (POSIX: native is posix), the first token in `SPELLINGS`'s order keeps the
 * literal and the other is kept for EXPANSION only (`expandText`), so a recording made on either host ~~reads on
 * either~~ ⭐ EXPANDS on either — but a replay's own scrub there names the first token, which a recording of the other
 * family does not hold; so a recording REPLAYS on its own family only, and `readRecording` says so (finding 6).
 * ⛔ A PLACE THAT IS EMPTY OR A FILESYSTEM ROOT IS LEFT OUT: `/` as a home would replace every separator in the text.
 */
export function scrubPairs(
	places: Readonly<Partial<Record<ScrubPlace, string>>>
): readonly ScrubPair[] {
	const pairs: ScrubPair[] = [];
	for (const place of PLACES) {
		const native = places[place] ?? '';
		if (native === '' || dirname(native) === native) continue;
		const posix = native.replaceAll('\\', '/');
		const json = native.replaceAll('\\', '\\\\');
		const spelled: Readonly<Record<ScrubSpelling, string>> = { native, posix, json };
		for (const spelling of SPELLINGS)
			pairs.push({ literal: spelled[spelling], token: scrubToken(place, spelling) });
	}
	return pairs.sort((a, b) => b.literal.length - a.literal.length);
}

/** `text` with each literal replaced by its token — longest literal first (`scrubPairs`'s order). */
export function scrubText(text: string, pairs: readonly ScrubPair[]): string {
	let out = text;
	for (const { literal, token } of pairs) if (literal !== '') out = out.replaceAll(literal, token);
	return out;
}

/** `text` with each token replaced by the literal it stands for: `scrubText`'s inverse, for this host's directories. */
export function expandText(text: string, pairs: readonly ScrubPair[]): string {
	let out = text;
	for (const { literal, token } of pairs) out = out.replaceAll(token, literal);
	return out;
}

/** SHA-256 of `text`'s UTF-8 bytes, as lower-case hex — every hash a recording holds. */
export const sha256Hex = (text: string): string =>
	createHash('sha256').update(text, 'utf8').digest('hex');

/** Strings in code-unit order: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);

/**
 * `value` as JSON with every object's keys in code-unit order — so a hash over it is a function of the value, never of
 * the order a producer happened to build its keys in (a provider payload's schema and the replay's own minting agree on
 * the content, not necessarily on the order).
 */
export function canonicalJson(value: unknown): string {
	const canonical = (v: unknown): unknown => {
		if (Array.isArray(v)) return v.map(canonical);
		if (typeof v === 'object' && v !== null)
			return Object.fromEntries(
				Object.keys(v)
					.sort(byCodeUnit)
					.map((k) => [k, canonical((v as Record<string, unknown>)[k])])
			);
		return v;
	};
	return JSON.stringify(canonical(value)) ?? 'null';
}

// ── ⭐⭐ THE EXECUTOR'S KEY BEYOND ITS TURN (the review of E4, finding 1) ─────────────────────────────────────────────

/**
 * The lines Pi appends after a CUSTOM system prompt, last: the date and the working directory (`pi-coding-agent`
 * `dist/core/system-prompt.js`, `buildSystemPrompt`: *"Add date and working directory last"*). The date moves every day
 * and the directory is the run's, so neither is the instruction a replay can be held to.
 */
const PI_PROMPT_TRAILER = /\nCurrent date: \d{4}-\d{2}-\d{2}\nCurrent working directory: [^\n]*$/;

/**
 * ⭐ THE EXECUTOR'S INSTRUCTIONS, AS SENT: a provider payload's system prompt less Pi's own trailer — or undefined when
 * the trailer is not there, so nothing is guessed about where the instruction ends.
 * ⚠ ANYTHING ELSE PI ADDED STAYS IN, and so stays in the hash: an `APPEND_SYSTEM.md`, or the project context files Pi
 * gathers from the working directory's ancestors (`resource-loader.js`, `loadProjectContextFiles`). A run whose executor
 * was sent those was instructed by more than the code's contract, and its recording is stale against the code — the
 * replay names that, rather than replaying it as the contract's. ⭐ Since the E4 polish round the executor's loader
 * adds neither (`tools/pi-executor-resources.ts`; the lead's delegated decision of 2026-10-15, to be registered); a
 * run made before it could have.
 */
export function instructionsOfSentPrompt(sent: string): string | undefined {
	const trailer = PI_PROMPT_TRAILER.exec(sent);
	return trailer === null ? undefined : sent.slice(0, trailer.index);
}

/** One tool definition as the executor's key holds it: what the model was told the tool is. */
export interface ToolDefinitionKey {
	readonly name: string;
	readonly description: string;
	/** The parameter schema as JSON — what the provider payload carries (`pi-ai`, `convertResponsesTools`). */
	readonly parameters: unknown;
}

/** SHA-256 of the scrubbed instructions. */
export const instructionsSha256 = (instructions: string, scrub: (s: string) => string): string =>
	sha256Hex(scrub(instructions));

/** SHA-256 of the scrubbed canonical JSON of the tool definitions, in the order they were offered. */
export const toolDefinitionsSha256 = (
	tools: readonly ToolDefinitionKey[],
	scrub: (s: string) => string
): string =>
	sha256Hex(
		scrub(
			canonicalJson(
				tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))
			)
		)
	);

// ── ⭐⭐ THE PUBLISHED PWA (`REG-D-112` (c)) ──────────────────────────────────────────────────────────────────────────

/** A store row as the recorder and the replay both read one: `run-report-core.ts`'s `StoredObject`, or the engine's. */
export interface PwaObjectRow {
	readonly id: string;
	readonly objectType: string;
	readonly state: Readonly<Record<string, unknown>>;
	readonly firstSequence?: number;
}

/** One PWU Type of the published PWA: its id in the recorded run, and its content as `DefinePwuType` takes it. */
export interface RecordedPwuType {
	readonly id: string;
	readonly declared: Readonly<Record<string, unknown>>;
}

/** A policy the PWA's types name, by the hash of its content (`policyContentSha256`). */
export interface RecordedPolicy {
	readonly policyId: string;
	readonly contentSha256: string;
}

/**
 * ⭐ THE PUBLISHED PWA, ENOUGH TO RE-CREATE IT (`REG-D-112` (c)): its own fields as `CreatePwa` takes them, its root, its
 * types as `DefinePwuType` takes them (ids kept, so their links stay), and the policies they name. ⚠ A POLICY IS NOT THE
 * PWA's TO CREATE — it is the host's library (`seedPolicyLibrary`) — so it is held to its recorded hash, and a host whose
 * policy differs, or lacks it, is refused by name (`replay-pwa.ts`).
 */
export interface RecordedPwa {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly domain: string;
	readonly version: string;
	readonly rootTypeId: string;
	readonly types: readonly RecordedPwuType[];
	readonly policies: readonly RecordedPolicy[];
}

/**
 * `DefinePwuTypePayload`'s fields besides the two ids — what re-creates a type's declared state. ⭐ Pinned to the schema's
 * own keys by `recording.test.ts` (the re-review of E4's fix round), so a field `DefinePwuType` gains is not dropped from
 * the re-created PWA unnoticed.
 */
export const DECLARED_TYPE_FIELDS = [
	'pwuKind',
	'name',
	'purpose',
	'isRoot',
	'permittedParentTypeIds',
	'permittedChildTypeIds',
	'permittedChildren',
	'requiredInputs',
	'requiredOutputs',
	'requiredAssurancePolicyIds',
	'completionRule',
	'executionBoundary',
	'boundaryContract',
	'promptTemplate',
	'contextSpecification',
	'workDischarge'
] as const;

/** The object envelope's fields (`rph-contracts` `objectEnvelopeShape`): who and when, never what a policy says. */
const ENVELOPE_FIELDS: ReadonlySet<string> = new Set([
	'id',
	'objectType',
	'schemaVersion',
	'semanticVersion',
	'revision',
	'lifecycleStatus',
	'createdAt',
	'createdBy',
	'updatedAt',
	'updatedBy',
	'provenance',
	'ontologyId',
	'ontologyVersion',
	'tags',
	'extensions'
]);

/** SHA-256 of a policy's content — its state less the envelope — as canonical JSON. */
export const policyContentSha256 = (state: Readonly<Record<string, unknown>>): string =>
	sha256Hex(
		canonicalJson(
			Object.fromEntries(Object.entries(state).filter(([k]) => !ENVELOPE_FIELDS.has(k)))
		)
	);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const recordOf = (v: unknown): Readonly<Record<string, unknown>> =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * ⭐ THE PWA's LIVE TYPES (the re-review of E4's fix round): ⛔ never one its author removed — `RemovePwuType` tombstones a
 * type (`status: 'REMOVED'`), its row staying in the store, and the engine's own graph skips it (`pwa-authoring.ts`,
 * `pwuTypeNodesOf`). Re-created as a live type, it would be an orphan — nothing references a removed type — and
 * `ValidatePwa` refuses the PWA. The digest and the recorded PWA both read the types through here, so they cannot
 * disagree about which types the PWA has.
 */
const liveTypesOf = (objects: readonly PwaObjectRow[], pwaId: string): PwaObjectRow[] =>
	objects.filter(
		(o) => o.objectType === 'PWU_TYPE' && o.state.pwaId === pwaId && o.state.status !== 'REMOVED'
	);

/** The one published PWA among `objects`, or why there is not one. */
function publishedPwaOf(objects: readonly PwaObjectRow[]): PwaObjectRow | string {
	const published = objects.filter(
		(o) =>
			o.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE' && o.state.publicationStatus === 'PUBLISHED'
	);
	return published.length === 1
		? published[0]!
		: `the store holds ${published.length} published PWAs, and a recording is of one`;
}

/**
 * ⭐ THE PUBLISHED PWA'S DECLARED CONTENT, DIGESTED: each of its ⭐ live types' (`liveTypesOf`) name, kind, purpose, root
 * mark, discharge, policies and prompt (its text and output contract), sorted by name, as canonical JSON. ~~What the
 * recorded run ran on — so a replay of another PWA is told apart before its first call~~ ⭐ The recorder digests the run's
 * PWA, and the replay the PWA it re-created from the recording (`ReplayRun.checkPublishedPwa`): equal digests show that
 * the recording's `pwa` and its digest agree, and that the engine stored the re-created types as recorded — in these
 * fields, and no others.
 * ⭑ MOVED HERE from the recorder (`record-replay-core.ts`) and unchanged, so the recorder that writes the digest and the
 * replay that reads it compute it with one function.
 */
export function pwaContentDigest(objects: readonly PwaObjectRow[]): string | string[] {
	const pwa = publishedPwaOf(objects);
	if (typeof pwa === 'string') return [pwa];
	const types = liveTypesOf(objects, pwa.id)
		.map((t) => {
			const prompt = recordOf(t.state.promptTemplate);
			return {
				name: str(t.state.name),
				pwuKind: str(t.state.pwuKind),
				purpose: str(t.state.purpose),
				isRoot: t.state.isRoot === true,
				workDischarge: str(t.state.workDischarge),
				requiredAssurancePolicyIds: Array.isArray(t.state.requiredAssurancePolicyIds)
					? [...(t.state.requiredAssurancePolicyIds as unknown[])].map(String).sort(byCodeUnit)
					: [],
				prompt: str(prompt.templateText),
				outputContract: prompt.outputContract ?? null
			};
		})
		.sort((a, b) => byCodeUnit(a.name, b.name));
	return createHash('sha256').update(JSON.stringify(types), 'utf8').digest('hex');
}

/**
 * ⭐ THE PUBLISHED PWA, AS A RECORDING KEEPS IT (`RecordedPwa`) — or the problems that stop it. Its ⭐ live types
 * (`liveTypesOf`) in the order the store defined them (`firstSequence`), which the engine accepted once; the policies
 * they name in code-unit order.
 */
export function recordedPwaOf(objects: readonly PwaObjectRow[]): RecordedPwa | string[] {
	const pwa = publishedPwaOf(objects);
	if (typeof pwa === 'string') return [pwa];
	const problems: string[] = [];
	const rootTypeId = str(pwa.state.rootPwuTypeId);
	if (rootTypeId === '') problems.push(`the published PWA ${pwa.id} names no root type`);
	const types = liveTypesOf(objects, pwa.id)
		.sort((a, b) => (a.firstSequence ?? 0) - (b.firstSequence ?? 0) || byCodeUnit(a.id, b.id))
		.map((t) => ({
			id: t.id,
			declared: Object.fromEntries(
				DECLARED_TYPE_FIELDS.filter((k) => t.state[k] !== undefined).map((k) => [k, t.state[k]])
			)
		}));
	const policyIds = [
		...new Set(
			types.flatMap((t) =>
				Array.isArray(t.declared.requiredAssurancePolicyIds)
					? (t.declared.requiredAssurancePolicyIds as unknown[]).map(String)
					: []
			)
		)
	].sort(byCodeUnit);
	const policies: RecordedPolicy[] = [];
	for (const policyId of policyIds) {
		const row = objects.find((o) => o.objectType === 'ASSURANCE_POLICY' && o.id === policyId);
		if (row === undefined)
			problems.push(
				`the published PWA names the policy ${policyId}, which the store does not hold`
			);
		else policies.push({ policyId, contentSha256: policyContentSha256(row.state) });
	}
	if (problems.length > 0) return problems;
	return {
		id: pwa.id,
		name: str(pwa.state.name),
		description: str(pwa.state.description),
		domain: str(pwa.state.domain),
		version: str(pwa.state.version),
		rootTypeId,
		types,
		policies
	};
}

/** Who answered: the identity the run's record named for a call. */
export interface RecordedIdentity {
	readonly agentId: string;
	readonly modelId: string;
	readonly providerId: string;
}

/** One cell of the run report's stage matrix (`run-report-core.ts`, `MatrixCell`), as the recording expects it. */
export interface RecordedCell {
	readonly stage: string;
	readonly row: string;
	/** One of §1's five values, or null where the report could not decide the cell. */
	readonly value: string | null;
}

export interface RecordingManifest {
	readonly format: typeof RECORDING_FORMAT;
	/** The commit the recorded run ran on. ⚠ For a person reading the recording: no replay code reads it (finding 4). */
	readonly commit: string;
	/**
	 * The reviewer fingerprint (`scripts/reviewer-qual/fingerprint.ts`) the recorded run's reviewer was qualified at.
	 * ⚠ For a person reading the recording, as `commit` is: no replay code reads it (finding 4).
	 */
	readonly reviewerFingerprint: string;
	/**
	 * SHA-256 of the published PWA's declared content (`pwaContentDigest`). ⭐ READ BEFORE THE FIRST CALL (the review of
	 * E4, finding 4): the replay digests the PWA it re-created, and refuses every try unless the two are equal
	 * (`ReplayRun.checkPublishedPwa`). ~~What the recorded run ran on — so a replay of another PWA is told apart before its
	 * first call~~ was this field's claim while nothing read it.
	 */
	readonly pwaContentDigest: string;
	/** ⭐ The OS family the recorded run ran on, and so the one it replays on (finding 6; the header's "⚠⚠"). */
	readonly osFamily: OsFamily;
	/** ⭐ The published PWA, enough to re-create it before the Undertaking (`REG-D-112` (c); `RecordedPwa`). */
	readonly pwa: RecordedPwa;
	readonly models: {
		readonly executor: RecordedIdentity;
		/**
		 * ⭐ AND THE BOUND THE REVIEWING TOOL WAS HELD TO (`REVIEWER_CALL_BOUND_MS`), null when the recorded reviewer declared
		 * none. ⭐ THE RECORDED RUN'S, FOR A PERSON READING IT — ~~what decides whether a call that threw is run once more~~:
		 * the replay holds the validator to the PRODUCT's bound (the review of E4, finding 8; `assurance/index.ts`), and
		 * refuses a recording whose thrown calls that bound would dispose otherwise (`replay-run.ts`, `boundDisagreements`).
		 */
		readonly reviewer: RecordedIdentity & { readonly callBoundMs: number | null };
	};
	/** The scrub's token kinds (`SCRUB_TOKENS`): what the recording's text may carry in place of a run's path. */
	readonly scrub: { readonly tokens: readonly string[] };
	readonly expectedMatrix: readonly RecordedCell[];
}

/** What the host observed of a call (`AdapterToolCall['outcome']`). */
export type RecordedToolOutcome = 'COMPLETED' | 'REFUSED' | 'FAILED' | 'UNKNOWN';
const TOOL_OUTCOMES: ReadonlySet<unknown> = new Set<RecordedToolOutcome>([
	'COMPLETED',
	'REFUSED',
	'FAILED',
	'UNKNOWN'
]);

export interface RecordedToolCall {
	readonly name: string;
	/** The arguments the model gave, scrubbed. */
	readonly arguments: Readonly<Record<string, unknown>>;
	/** What the host observed happen to the call in the recorded run — the replay must observe the same. */
	readonly outcome: RecordedToolOutcome;
	/**
	 * ⭐ SHA-256 of the call's RESULT as the model read it — the text the run's payload sent as the call's output
	 * (`function_call_output`), scrubbed (the lead's delegated decision of 2026-10-15, to be registered). The replay
	 * renders the result again from the code under test and holds it to this (`ReplayRun.checkToolResult`).
	 */
	readonly resultSha256: string;
}

/**
 * The turn's answer, or why none arrived (`AdapterAnswer`'s shape, so the replay hands back what the run's adapter did).
 * ⭐ A FAILED CALL CARRIES ITS REPORTER (the review of E4, finding 9): `AdapterAnswer`'s `CALL_FAILED` says whether the
 * PROVIDER or the TOOL reported the failure, and a replay that said PROVIDER of every one would state a fact about a call
 * the recording does not hold. Recorded, and replayed as recorded.
 */
export type RecordedAnswer =
	| { readonly arrived: true; readonly text: string }
	| {
			readonly arrived: false;
			readonly cause: 'CALL_FAILED';
			readonly reportedBy: 'PROVIDER' | 'TOOL';
			readonly message: string;
	  }
	| { readonly arrived: false; readonly cause: 'CALL_ABORTED'; readonly message?: string }
	| { readonly arrived: false; readonly cause: 'ENDED_WITHOUT_ANSWER' };

export interface ExecutorTry {
	/** The unit the try was for, by its slug or id as the recorder names it: what a REPLAY_STALE names. */
	readonly unit: string;
	/** SHA-256 of the scrubbed turn text — what the replay checks the turn it is sent against. */
	readonly turnSha256: string;
	/** ⭐ SHA-256 of the executor's instructions as sent (`instructionsSha256`; finding 1) — the key beside the turn. */
	readonly instructionsSha256: string;
	/** ⭐ SHA-256 of the tools the executor was offered (`toolDefinitionsSha256`; finding 1) — the key beside the turn. */
	readonly toolsSha256: string;
	/** ⛔ IN THE ORDER THE MODEL MADE THEM, and replayed one at a time in it (`REG-F-518`). */
	readonly toolCalls: readonly RecordedToolCall[];
	readonly answer: RecordedAnswer;
	readonly producer: RecordedIdentity;
}

export type RecordedCommand =
	| {
			readonly argv: readonly string[];
			readonly ran: true;
			readonly exitCode: number | null;
			readonly timedOut: boolean;
			readonly durationMs: number;
			readonly outputComplete: boolean;
			readonly omissions: readonly ProcessOutputOmission[];
			readonly stdout: string;
			readonly stderr: string;
	  }
	| { readonly argv: readonly string[]; readonly ran: false; readonly refusedBecause: string };

/**
 * A reviewer call's reply, in each retention form a record can hold — the qualification record's forms
 * (`scripts/reviewer-qual/record.ts`, `CallReply`), with THROWN for a call whose `print` threw.
 * ⭐ THROWN CARRIES THE TOOL'S OWN MESSAGE, before the validator's seam sanitised it: the replay throws it again and the
 * seam sanitises it again (`sanitiseToolFailure`), so the record of the replayed call says what the recorded one said.
 */
export type RecordedReply =
	| { readonly status: 'ANSWERED'; readonly text: string }
	| { readonly status: 'NOT_RETAINED' }
	| { readonly status: 'NO_ANSWER_SPAN'; readonly parses: boolean }
	| { readonly status: 'THROWN'; readonly message: string };

export type RecordedRole = 'initial' | 'repair' | 'retry';
const ROLES: ReadonlySet<unknown> = new Set<RecordedRole>(['initial', 'repair', 'retry']);

export interface ReviewerCall {
	/** The unit the reviewed subject belongs to, when the recorder could name one. */
	readonly unit: string | null;
	/** What was reviewed: `work-product`, `command`, `pwa`, … — the recorder's reading of the subject. */
	readonly framing: string;
	readonly role: RecordedRole;
	/** SHA-256 of the scrubbed prompt. */
	readonly promptSha256: string;
	/** The prompt's own bytes, scrubbed — for a person diagnosing a stale call, never compared by the replay. */
	readonly prompt: string;
	readonly reply: RecordedReply;
	readonly evaluator: RecordedIdentity;
	/** ⭐ The call's ELAPSED time in ms: replayed through the validator's clock, so a retry happens where it happened. */
	readonly elapsedMs: number;
}

export interface Recording {
	readonly manifest: RecordingManifest;
	readonly executor: readonly ExecutorTry[];
	readonly commands: readonly RecordedCommand[];
	readonly reviewer: readonly ReviewerCall[];
}

/**
 * ⛔ Why a folder is not a recording this replay can read: the file and line, and what is wrong there. Its message opens
 * with its code, so a floor or a step that records it says which refusal it was.
 */
export class RecordingRefusal extends Error {
	readonly code = 'REPLAY_RECORDING_REFUSED';
	constructor(detail: string) {
		super(`REPLAY_RECORDING_REFUSED: ${detail}`);
	}
}

function refuse(where: string, what: string): never {
	throw new RecordingRefusal(`the recording is refused: ${where} ${what}`);
}

type Json = Readonly<Record<string, unknown>>;

const isRecord = (v: unknown): v is Json =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function field<T>(
	o: Json,
	key: string,
	where: string,
	check: (v: unknown) => v is T,
	kind: string
): T {
	const v = o[key];
	if (!check(v)) refuse(where, `has no ${kind} \`${key}\``);
	return v as T;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isHex64 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);

function identity(v: unknown, where: string): RecordedIdentity {
	if (!isRecord(v)) return refuse(where, 'has no identity object');
	return {
		agentId: field(v, 'agentId', where, isString, 'string'),
		modelId: field(v, 'modelId', where, isString, 'string'),
		providerId: field(v, 'providerId', where, isString, 'string')
	};
}

function pwaOf(v: unknown, where: string): RecordedPwa {
	if (!isRecord(v)) return refuse(where, 'is not an object');
	const types = Array.isArray(v.types) ? v.types : refuse(where, 'has no `types` list');
	const policies = Array.isArray(v.policies) ? v.policies : refuse(where, 'has no `policies` list');
	return {
		id: field(v, 'id', where, isString, 'string'),
		name: field(v, 'name', where, isString, 'string'),
		description: field(v, 'description', where, isString, 'string'),
		domain: field(v, 'domain', where, isString, 'string'),
		version: field(v, 'version', where, isString, 'string'),
		rootTypeId: field(v, 'rootTypeId', where, isString, 'string'),
		types: types.map((t, i) => {
			const at = `${where} types[${i}]`;
			if (!isRecord(t)) return refuse(at, 'is not an object');
			return {
				id: field(t, 'id', at, isString, 'string'),
				declared: field(t, 'declared', at, isRecord, 'object')
			};
		}),
		policies: policies.map((p, i) => {
			const at = `${where} policies[${i}]`;
			if (!isRecord(p)) return refuse(at, 'is not an object');
			return {
				policyId: field(p, 'policyId', at, isString, 'string'),
				contentSha256: field(p, 'contentSha256', at, isHex64, 'SHA-256')
			};
		})
	};
}

function manifestOf(v: unknown, where: string): RecordingManifest {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	if (v.format !== RECORDING_FORMAT)
		refuse(
			where,
			`names the format ${JSON.stringify(v.format)}, not ${RECORDING_FORMAT}: a recording of another shape replays another run`
		);
	const models = isRecord(v.models) ? v.models : refuse(where, 'has no `models`');
	const reviewer = isRecord(models.reviewer)
		? models.reviewer
		: refuse(where, 'has no `models.reviewer`');
	const bound = reviewer.callBoundMs;
	if (bound !== null && !isCount(bound))
		refuse(where, 'has a `models.reviewer.callBoundMs` that is neither a count nor null');
	const scrub = isRecord(v.scrub) ? v.scrub : refuse(where, 'has no `scrub`');
	const tokens = field(scrub, 'tokens', where, isStringArray, 'string list');
	const known = new Set(SCRUB_TOKENS);
	const unknown = tokens.filter((t) => !known.has(t));
	if (unknown.length > 0)
		refuse(where, `lists scrub tokens this replay does not know: ${unknown.join(', ')}`);
	const matrix = Array.isArray(v.expectedMatrix)
		? v.expectedMatrix
		: refuse(where, 'has no `expectedMatrix` list');
	if (v.osFamily !== 'windows' && v.osFamily !== 'posix')
		refuse(where, 'has an `osFamily` that is neither windows nor posix');
	return {
		format: RECORDING_FORMAT,
		commit: field(v, 'commit', where, isString, 'string'),
		reviewerFingerprint: field(v, 'reviewerFingerprint', where, isString, 'string'),
		pwaContentDigest: field(v, 'pwaContentDigest', where, isString, 'string'),
		osFamily: v.osFamily as OsFamily,
		pwa: pwaOf(v.pwa, `${where} pwa`),
		models: {
			executor: identity(models.executor, `${where} models.executor`),
			reviewer: {
				...identity(reviewer, `${where} models.reviewer`),
				callBoundMs: bound as number | null
			}
		},
		scrub: { tokens },
		expectedMatrix: matrix.map((c, i) => {
			const at = `${where} expectedMatrix[${i}]`;
			if (!isRecord(c)) return refuse(at, 'is not an object');
			if (c.value !== null && !isString(c.value))
				refuse(at, 'has a `value` that is neither a string nor null');
			return {
				stage: field(c, 'stage', at, isString, 'string'),
				row: field(c, 'row', at, isString, 'string'),
				value: c.value as string | null
			};
		})
	};
}

function answerOf(v: unknown, where: string): RecordedAnswer {
	if (!isRecord(v)) return refuse(where, 'has no `answer` object');
	if (v.arrived === true)
		return { arrived: true, text: field(v, 'text', where, isString, 'string') };
	if (v.arrived !== false) return refuse(where, 'has an `answer` that neither arrived nor did not');
	if (v.message !== undefined && !isString(v.message))
		refuse(where, 'has an `answer.message` that is not a string');
	switch (v.cause) {
		case 'CALL_FAILED':
			// ⭐ Finding 9: the reporter is part of a failed call, and a recording that does not say it is refused.
			if (v.reportedBy !== 'PROVIDER' && v.reportedBy !== 'TOOL')
				return refuse(
					where,
					'has a CALL_FAILED `answer` that names no `reportedBy` (PROVIDER or TOOL)'
				);
			return {
				arrived: false,
				cause: 'CALL_FAILED',
				reportedBy: v.reportedBy,
				message: field(v, 'message', where, isString, 'string')
			};
		case 'CALL_ABORTED':
			return {
				arrived: false,
				cause: 'CALL_ABORTED',
				...(isString(v.message) ? { message: v.message } : {})
			};
		case 'ENDED_WITHOUT_ANSWER':
			return { arrived: false, cause: 'ENDED_WITHOUT_ANSWER' };
		default:
			return refuse(where, 'has an `answer.cause` this replay does not know');
	}
}

function executorTryOf(v: unknown, where: string): ExecutorTry {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	const calls = Array.isArray(v.toolCalls) ? v.toolCalls : refuse(where, 'has no `toolCalls` list');
	return {
		unit: field(v, 'unit', where, isString, 'string'),
		turnSha256: field(v, 'turnSha256', where, isHex64, 'SHA-256'),
		instructionsSha256: field(v, 'instructionsSha256', where, isHex64, 'SHA-256'),
		toolsSha256: field(v, 'toolsSha256', where, isHex64, 'SHA-256'),
		toolCalls: calls.map((c, i) => {
			const at = `${where} toolCalls[${i}]`;
			if (!isRecord(c)) return refuse(at, 'is not an object');
			const outcome = c.outcome;
			if (!TOOL_OUTCOMES.has(outcome)) refuse(at, 'has no known `outcome`');
			return {
				name: field(c, 'name', at, isString, 'string'),
				arguments: field(c, 'arguments', at, isRecord, 'object'),
				outcome: outcome as RecordedToolOutcome,
				resultSha256: field(c, 'resultSha256', at, isHex64, 'SHA-256')
			};
		}),
		answer: answerOf(v.answer, where),
		producer: identity(v.producer, `${where} producer`)
	};
}

function omissionsOf(v: unknown, where: string): ProcessOutputOmission[] {
	if (!Array.isArray(v)) return refuse(where, 'has no `omissions` list');
	return v.map((o, i) => {
		const at = `${where} omissions[${i}]`;
		if (!isRecord(o) || (o.stream !== 'STDOUT' && o.stream !== 'STDERR'))
			return refuse(at, 'names no stream');
		return {
			stream: o.stream,
			reason: field(o, 'reason', at, isString, 'string'),
			byteSize: field(o, 'byteSize', at, isCount, 'count'),
			byteOffset: field(o, 'byteOffset', at, isCount, 'count')
		};
	});
}

function commandOf(v: unknown, where: string): RecordedCommand {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	const argv = field(v, 'argv', where, isStringArray, 'string list');
	if (v.ran === false)
		return {
			argv,
			ran: false,
			refusedBecause: field(v, 'refusedBecause', where, isString, 'string')
		};
	if (v.ran !== true) return refuse(where, 'neither ran nor was refused');
	const exitCode = v.exitCode;
	if (exitCode !== null && !(typeof exitCode === 'number' && Number.isInteger(exitCode)))
		refuse(where, 'has an `exitCode` that is neither an integer nor null');
	return {
		argv,
		ran: true,
		exitCode: exitCode as number | null,
		timedOut: field(v, 'timedOut', where, isBoolean, 'boolean'),
		durationMs: field(v, 'durationMs', where, isCount, 'count'),
		outputComplete: field(v, 'outputComplete', where, isBoolean, 'boolean'),
		omissions: omissionsOf(v.omissions, where),
		stdout: field(v, 'stdout', where, isString, 'string'),
		stderr: field(v, 'stderr', where, isString, 'string')
	};
}

function replyOf(v: unknown, where: string): RecordedReply {
	if (!isRecord(v)) return refuse(where, 'has no `reply` object');
	switch (v.status) {
		case 'ANSWERED':
			return { status: 'ANSWERED', text: field(v, 'text', where, isString, 'string') };
		case 'NOT_RETAINED':
			return { status: 'NOT_RETAINED' };
		case 'NO_ANSWER_SPAN':
			return { status: 'NO_ANSWER_SPAN', parses: field(v, 'parses', where, isBoolean, 'boolean') };
		case 'THROWN':
			return { status: 'THROWN', message: field(v, 'message', where, isString, 'string') };
		default:
			return refuse(where, 'has a `reply.status` this replay does not know');
	}
}

function reviewerCallOf(v: unknown, where: string): ReviewerCall {
	if (!isRecord(v)) return refuse(where, 'is not a JSON object');
	if (v.unit !== null && !isString(v.unit))
		refuse(where, 'has a `unit` that is neither a string nor null');
	if (!ROLES.has(v.role)) refuse(where, 'has no known `role`');
	return {
		unit: v.unit as string | null,
		framing: field(v, 'framing', where, isString, 'string'),
		role: v.role as RecordedRole,
		promptSha256: field(v, 'promptSha256', where, isHex64, 'SHA-256'),
		prompt: field(v, 'prompt', where, isString, 'string'),
		reply: replyOf(v.reply, where),
		evaluator: identity(v.evaluator, `${where} evaluator`),
		elapsedMs: field(v, 'elapsedMs', where, isCount, 'count')
	};
}

/** One `.jsonl` file's lines, each parsed by `of`, each refusal naming its file and line. */
function linesOf<T>(dir: string, file: string, of: (v: unknown, where: string) => T): T[] {
	const path = join(dir, file);
	if (!existsSync(path)) return refuse(file, 'is absent');
	const out: T[] = [];
	const lines = readFileSync(path, 'utf8').split('\n');
	lines.forEach((line, i) => {
		if (line.trim() === '') return;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			refuse(`${file}:${i + 1}`, 'is not one JSON value');
		}
		out.push(of(parsed, `${file}:${i + 1}`));
	});
	return out;
}

/**
 * ⭐ READ A RECORDING, WHOLE, OR REFUSE IT. Every field of every line is checked against the shape above, and a refusal
 * names the file, the line and the field — so a replay never starts on half a recording and fails at the call it could
 * not read.
 * ⛔ THE FOLDER MUST BE ABSOLUTE: a relative one resolves against whichever process reads it (the test runner's folder or
 * the server's), and the two would read two recordings.
 * ⛔ AND IT MUST HAVE BEEN MADE ON THIS HOST'S OS FAMILY (`host`, this process's by default; finding 6): a recording of
 * the other family is refused here, naming both — the reason it could not replay — rather than read and then refused
 * `REPLAY_STALE` at its first path, a reason that would point at the code.
 */
export function readRecording(dir: string, host: OsFamily = osFamilyOf()): Recording {
	if (!isAbsolute(dir))
		return refuse(
			'its folder',
			`'${dir}' is not absolute, so it would be read relative to whichever process opened it`
		);
	if (!existsSync(dir) || !statSync(dir).isDirectory())
		return refuse('its folder', 'does not exist');
	const manifestPath = join(dir, RECORDING_FILES.manifest);
	if (!existsSync(manifestPath)) return refuse(RECORDING_FILES.manifest, 'is absent');
	let manifest: unknown;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	} catch {
		refuse(RECORDING_FILES.manifest, 'is not one JSON value');
	}
	const read = manifestOf(manifest, RECORDING_FILES.manifest);
	if (read.osFamily !== host)
		refuse(
			RECORDING_FILES.manifest,
			`was made on the ${read.osFamily} family, and this host is ${host}: a recording replays on the OS family it ` +
				'was made on, its paths and its programs’ output spelled as that family spells them (the format’s stated limit)'
		);
	return {
		manifest: read,
		executor: linesOf(dir, RECORDING_FILES.executor, executorTryOf),
		commands: linesOf(dir, RECORDING_FILES.commands, commandOf),
		reviewer: linesOf(dir, RECORDING_FILES.reviewer, reviewerCallOf)
	};
}

/**
 * ⭐ A RECORDING AS ITS FOUR FILES' TEXT — the one serialisation, so the recorder and a test that constructs a recording
 * write the same bytes. The manifest is tab-indented JSON; each `.jsonl` line is one JSON value, in order, newline-ended.
 */
export function recordingFiles(recording: Recording): Readonly<Record<string, string>> {
	const jsonl = (rows: readonly unknown[]): string =>
		rows.map((r) => `${JSON.stringify(r)}\n`).join('');
	return {
		[RECORDING_FILES.manifest]: `${JSON.stringify(recording.manifest, null, '\t')}\n`,
		[RECORDING_FILES.executor]: jsonl(recording.executor),
		[RECORDING_FILES.commands]: jsonl(recording.commands),
		[RECORDING_FILES.reviewer]: jsonl(recording.reviewer)
	};
}
