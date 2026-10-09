// REG-Q-066's ONE BOUND — re-answered in Phase 2b, and STILL GATED, because an answer that rests on an
// arrangement rots the moment someone rearranges it.
//
// ── THE QUESTION, VERBATIM ──────────────────────────────────────────────────────────────────────────────────
// REG-Q-066 closes with: "ONE BOUND, stated so this is not read wider than it is: out-of-band logging
// (console/stderr from `agy-cli`) was not tested. It is outside canonical state and outside this census's
// definition of retention, but it is an unexamined escape hatch and an answer should say whether it counts."
//
// ── THE ANSWER UNTIL 2026-09-14: "CLOSED BY NON-USE" ────────────────────────────────────────────────────────
// `REG-F-326` closed the bound because `agyPrint` destructures `const { stdout } = await execFileAsync(...)`
// and `stderr` was bound NOWHERE in the demo application: no surface for retention to occur ON, so PER-9 and
// PER-12 had nothing to govern. ⭑ AND IT SAID WHY THAT WAS GATED RATHER THAN NOTED: "An answer that rests on
// the code NOT doing something rots the moment someone does it."
//
// ══ ⭐⭐ THE ANSWER FROM 2026-09-14: "CLOSED BY DISPOSITION" — AND THIS FILE IS WHY IT IS NOT A WEAKENING ═════
//
// JAN-EXEC Phase 2b lands a REAL `ProcessRunner`, which captures a child process's stdout AND stderr. That ENDS
// the absence, exactly as this gate predicted someone would. ⭑ THE DEMAND THE ANSWER SATISFIES IS THIS GATE'S
// OWN, VERBATIM FROM THE MESSAGE IT USED TO CARRY:
//
//   "Binding `stderr` CREATES the retention surface REG-Q-066 asks about … If this is deliberate, it needs a
//    RETENTION DISPOSITION and REG-Q-066 needs RE-ANSWERING; it must not arrive as a debugging convenience."
//
// Both are delivered, in the SAME COMMIT the binding arrives in (roadmap rule 8), and neither is prose:
//   · SPONSOR RULING `R7` — stdout and stderr are BOTH retained and BOTH come under purge.
//   · The captures go to a SECOND workspace declared `PURGEABLE_AT_EXPIRY`, because `PER-8` makes `purge`
//     REFUSE on the deliverable workspace `R8` declares `RETAINED_BY_PARTICIPATION`, and `Purgeability` has
//     exactly two members (`REG-Q-056` is OPEN; no third is coined).
//   · `ProcessRunOutcome.retention` REFERENCES the retained bytes, so they are not the orphan `REG-F-336` C-2
//     forbids, and `Workspace.purge` is how a purge reaches them.
//   · `createChildProcessRunner` REFUSES to be constructed against a workspace whose bytes could never be
//     purged, or one that has no bytes on a disk at all — the disposition made structural, and the last cases.
//
// ══ ⭐⭐ AND A SECOND DOOR OPENED IN JAN-EXEC PHASE 3 — WHO HANDS THE STREAMS TO A MODEL ══════════════════════
//
// Phase 2b answered WHO CAPTURES them. Phase 3 mints `run_command`, and a command whose output the model cannot
// read is a command the model cannot act on — so both streams are handed back as the tool's result, which puts
// them in the model's context and therefore in the E-1 composite the exchange record stores. ⛔ THAT IS A
// SECOND RETENTION SURFACE AND THIS GATE CAUGHT IT, which is the gate working: the binding arrived and the
// answer had to be re-stated before the commit could go green.
//
// ══ ⭐⭐ AND A THIRD DOOR OPENED IN JAN-EXEC PHASE 5 — WHO TURNS THE STREAMS INTO EVIDENCE ═══════════════
//
// Phase 2b answered who CAPTURES them. Phase 3 answered who HANDS THEM TO A MODEL. Phase 5 asks a third
// question, and it is not a rewording of the second: **evidence is CITED IN A JUDGEMENT and OUTLIVES the turn
// that produced it.** A `TEST_RESULT` naming a command's output is read by a floor run, by a completion gate,
// and by anyone auditing why a step was allowed to succeed — long after the model that ran it has gone.
//
// ⛔ AND THIS GATE CAUGHT IT, WHICH IS THE GATE WORKING FOR THE THIRD TIME. Two files entered the population
// (`process-run-observer.ts` holds the transient streams so something outside the tool closure can see them;
// `process-result-floor.ts` renders them as the subject a reviewer reads) and the commit could not go green
// until the answer was re-stated.
//
// ⭐ `JAN-PRQUAL` `PQ-1` (design D1; `REG-F-476`) — AND THE RENDERER MOVED, SO THE SITE WAS RE-POINTED, NOT WIDENED.
// `renderProcessResult` left `process-result-floor.ts` (which imports `floor-over-subject`, so reviewer qualification
// could not reach it) for `assurance/process-result-render.ts`, a pure module with TWO VIEWS of one run: the EVIDENCE
// bytes the join mints and the REVIEW view a reviewer reads. The floor binds no stream any more — the ratchet below
// ("every disposed site ACTUALLY BINDS") would refuse it standing — so the list names the renderer in its place, still
// four entries, and the disposition moved into the renderer's own header, restated for the two views. ⚠ Same class,
// same argument: participation is a property of USE (`REG-D-050`); both views are content-plane bytes; no byte of
// either stream reaches the record plane.
//
// ⭐ THE DISPOSITION, AND ITS ARGUMENT IS SHORTER THAN PHASE 3'S BECAUSE PHASE 3 DID THE WORK:
//   · NO NEW RETENTION SURFACE IS CREATED BY HOLDING THEM. `run_command` already hands both streams back to the
//     model, so they are already in the E-1 composite stored under `RETAINED_BY_PARTICIPATION`. The observer
//     holds the SAME transient strings for the length of the step and persists nothing of its own.
//   · WHAT PHASE 5 ADDS IS AN **ADDRESSABLE** COPY, and that is a deliberate act with a declared class:
//     `ArtifactStore.put(bytes, 'RETAINED_BY_PARTICIPATION')` (`R16`). The composite is the whole provider
//     payload for a turn and nothing inside it names the test run; an evidence object must name its own bytes.
//   · THE CLASS IS THE SAME ONE, FOR THE SAME REASON (`REG-D-050`, participation is a property of USE): a floor
//     run JUDGES these bytes, so they participated in an assessment. Declaring them purgeable to make the
//     problem go away would mean an assessment resting on bytes the system says it may destroy.
//   · THE RUNNER'S OWN DURABLE COPY IS UNTOUCHED AND UNRECLASSIFIED. `ProcessOutputRetention` still names a
//     `PURGEABLE_AT_EXPIRY` capture in the second workspace, and the evidence carries that reference BESIDE the
//     minted address — so a purge still reaches one copy, and `R7` is not retroactively falsified for any prior
//     run, which re-labelling it would have done.
//   · ⛔ AND NO BYTE REACHES THE RECORD PLANE, unchanged: `ObservedToolCall` has no field that could hold one.
//     `process-run-observer.ts` is CONTENT-plane material by construction and says so in its own header.
//
// ⚠ THE RESIDUAL IS THE SAME ONE PHASE 3 STATED AND IT IS NOW LARGER, WHICH IS THE HONEST WAY TO PUT IT. A
// build that echoes a token or a host path now lands in a SECOND permanent content object — the evidence's —
// and `PER-9`'s E-6 redaction, the removal path both dispositions rely on, still has no producer in this
// repository (`REG-005`). That is a change in the SIZE of a recorded gap, not a new gap.
//
// ⭐ ITS DISPOSITION IS AT `DISPOSED_STDERR_SITES` BELOW AND IN THE BINDING FILE'S OWN HEADER, and its shape is
// this: the class follows `REG-D-050` (participation is a property of USE), the bytes land on the CONTENT plane
// which `PER-9` gives a removal path, and the RECORD plane — which has none — receives no byte of either stream
// because `ObservedToolCall` has no field that could hold one. ⚠ The residual is stated rather than smoothed.
//
// ⛔ AND THE GATE IS TIGHTENED WHERE IT IS NARROWED, DELIBERATELY. One file leaves the absence population, so
// four limbs the previous gate was structurally unable to make are added against that file and the original
// subject:
//   1. the disposed-site list is PINNED at one entry — widening it is an edit a reviewer sees, the idiom
//      `slice-subsumption.test.ts` already uses for a pinned population;
//   2. every disposed site must EXIST — an exemption naming a deleted file silently re-opens the hatch;
//   3. every disposed site must ACTUALLY BIND `stderr` — an exemption nobody earned is scope granted for free,
//      and it would sit there waiting for the next file that wanted it;
//   4. `agy-cli.ts`, REG-Q-066's ORIGINAL subject, is asserted BY NAME to bind none — so the bound this
//      question actually stated stays closed on its own terms even if the list above ever grows.
// ⭑ Plus the one that is not a source probe at all: the disposed module's REFUSALS, driven.
//
// ══ ⛔⛔ AND THE PROBE ITSELF WAS THE WEAKEST PART OF IT — FIVE REALISTIC SHAPES WALKED PAST ═══════════════════
//
// The probe was a pair of REGULAR EXPRESSIONS over ONE LINE AT A TIME: `/\.stderr\b/` or a `{ … stderr … } =`
// on the same line. An adversary drove five arrangements straight through it, each with a working control
// beside it, and every one of the five is a shape this repository's own code would produce:
//
//   1. A MULTI-LINE DESTRUCTURE. `prettier` at `printWidth: 100` produces exactly this the moment the call is
//      long enough, and the line carrying `stderr` then has neither a `.` before it nor a `}` after it.
//   2. `.then(({ stdout, stderr }) => …)` — the idiomatic shape for the very `execFileAsync` call `agy-cli.ts`
//      makes. The `}` is followed by `)` rather than `=`, so the second alternative never matched.
//   3. `e['stderr']` — an element access. Neither alternative looks for one.
//   4. A DESTRUCTURED PARAMETER, `function record({ stdout, stderr }) { … }` — same `})` as (2).
//   5. A COMPUTED KEY: `r['std' + 'err']`, and its template-literal spelling.
//
// ⭐ THE REPLACEMENT IS A STRUCTURAL WALK OF THE TYPESCRIPT AST, WHICH IS THIS REPOSITORY'S STANDING RULE FOR
// EXACTLY THIS ("never regex for identity; walk the tree"). Every `Identifier` named `stderr` is a binding,
// whatever syntax carries it — a destructure single- or multi-line, a parameter, a shorthand, a property read,
// an import. Element accesses and computed property names are folded when their key is a constant expression,
// which is what reaches (3) and (5). ⛔ AND IT IS STRICTLY STRICTER THAN WHAT IT REPLACES, NOT DIFFERENT: every
// shape the regexes caught is an `Identifier` or a folded key too.
//
// ⭑ AND IT FIXES THE ORIGINAL DEFECT PROPERLY RATHER THAN AROUND IT. The old probe matched the token ANYWHERE,
// including comments and strings, so the gate reddened on its own documentation the moment `agy-cli.ts` gained
// a comment EXPLAINING why stderr must not be bound (measured across the commits: dbe1a955 = 0, df6019e8 = 1,
// 95c71798 = 3), and the shape-regexes were bolted on to dodge that. A parser does not see comments at all, and
// a string that is not an accessor key is not a binding. Both halves are DRIVEN below over a synthetic source
// with positive and negative arrangements, because a probe nobody probed is the instrument this repository
// fails on more often than the code.
//
// ⚠ ONE LIMIT, DISCLOSED RATHER THAN IMPLIED: a key computed from a RUNTIME value — `r[keyFromSomewhere]` — is
// not decidable by any source probe, and this one does not pretend otherwise. What it reaches is every constant
// spelling. An author routing around it is evading a gate rather than writing code, which is a different
// problem with a different remedy.
//
// ⚠ AND IT KEEPS ITS OWN POSITIVE CONTROL. A source-absence gate whose file glob silently matched nothing would
// pass forever while asserting nothing — the failure mode this repository records most often. So the same
// instrument is asked for `stdout`, which MUST be found.
//
// ⚠ THIS GATE IS STILL THE CHEAP EARLY SIGNAL AND NOT THE WHOLE PROTECTION.
// `apps/rph-demo/src/lib/server/assurance/agy-failure-sanitisation.test.ts` plants a sentinel and proves no part
// of the assurance outcome reaches it by ANY route; and Phase 2b's property — both streams retained, both
// purgeable, referenced, reachable — is driven in `child-process-runner.test.ts` and `workspace-host.test.ts`,
// both under `apps/rph-demo/src/lib/server/execution/`. Keep all of them: this one names the hazard at the
// site, those prove the property at its destination.
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { createInMemoryWorkspace, type Workspace } from '@janumipwb/rph-ports';
import { createChildProcessRunner } from '../apps/rph-demo/src/lib/server/execution/child-process-runner.js';
import { createFilesystemWorkspace } from '../apps/rph-demo/src/lib/server/execution/filesystem-workspace.js';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DEMO_SRC = `${ROOT}apps/rph-demo/src`;
const DEMO_PREFIX = 'apps/rph-demo/src/';

/**
 * The ONLY files permitted to bind `stderr`, enumerated rather than inferred — and PINNED at one.
 *
 * ⛔ ADDING ONE IS THE ACT THIS GATE EXISTS TO MAKE VISIBLE. A second entry means a second retention surface,
 * and REG-Q-066's answer is contingent on every such surface carrying a disposition. If a second is genuinely
 * warranted, add it here AND record its disposition the way `child-process-runner.ts` records its own — never
 * to get a suite green.
 */
/**
 * ⭐⭐ THE SITES THAT HAVE A RETENTION DISPOSITION. Two, since JAN-EXEC Phase 3, and the SECOND is a DIFFERENT
 * question from the first rather than more of the same one.
 *
 *   1. `child-process-runner.ts` — WHO CAPTURES. Phase 2b, sponsor ruling `R7`: both streams retained, both
 *      `PURGEABLE_AT_EXPIRY` in a SECOND workspace, referenced by `ProcessRunOutcome.retention`, reachable by
 *      `Workspace.purge` — and the adapter REFUSES to be constructed where any of that is untrue.
 *   2. `execution-tool-surface.ts` — WHO HANDS THEM TO A MODEL. Phase 3, and its class is decided by
 *      `REG-D-050` (*participation is a property of USE, not of kind*): the model READS this output and its
 *      next work product rests on it, so the bytes land in the E-1 composite `captureTry` stores
 *      `RETAINED_BY_PARTICIPATION`. ⭑ THAT IS THE CONTENT PLANE, WHICH `PER-9` GIVES A LAWFUL REMOVAL PATH
 *      (E-6 redaction) AND THE RECORD PLANE NONE — and no byte of either stream reaches the record plane,
 *      because `ObservedToolCall` has no arguments field and no result field BY CONSTRUCTION (`R11`).
 *      ⚠ ITS RESIDUAL IS WRITTEN IN THAT FILE AND IS NOT CLOSED: a build that prints its environment puts
 *      those bytes where only an E-6 redaction can reach them, and nothing here performs one yet.
 *
 * ⛔ A THIRD ENTRY NEEDS THE EQUIVALENT WRITTEN IN THE SAME COMMIT AS THE BINDING — which is what the pin
 * below is for: widening this list is an act a reviewer sees rather than a line that appeared.
 */
const DISPOSED_STDERR_SITES = [
	'lib/server/execution/child-process-runner.ts',
	'lib/server/tools/execution-tool-surface.ts',
	'lib/server/tools/process-run-observer.ts',
	// ⭐ `JAN-PRQUAL` `PQ-1` — was `lib/server/execution/process-result-floor.ts`; the renderer, and its disposition, moved.
	'lib/server/assurance/process-result-render.ts'
];

/** REG-Q-066's ORIGINAL subject, named so the bound it actually stated stays closed on its own terms. */
const THE_ORIGINAL_SUBJECT = 'lib/server/assurance/agy-cli.ts';

/**
 * The extensions this probe KNOWS HOW TO READ, and it reads every file that carries one.
 *
 * ⛔ `W3`: THE POPULATION WAS `‘.ts’` AND NOTHING ELSE, WHICH SILENTLY EXCLUDED ELEVEN `.svelte` FILES and
 * every `.mts`, `.cts` and `.js` that might arrive. ⭑ THE PROBE ITSELF WAS NEVER THE DEFECT — it caught all
 * five of `B9`'s evaded shapes, a type-only alias and an optional-chain element access. A binding in a
 * `.svelte` server block would simply never have been LOOKED AT, while the positive control stayed green
 * because a `.ts` file binds `stdout` — the exact shape of vacuous pass this repository records most often.
 *
 * ⭐ AND THE REPAIR IS THE GENERAL FORM RATHER THAN THE ELEVEN FILES: an allowlist of one extension with a
 * SILENT remainder is replaced by a population DERIVED from the filesystem plus an exclusion that is
 * DECLARED and GATED. Every extension present under the demo's source tree must appear in exactly one of
 * these two lists, so the next one to arrive — `.mjs`, `.svelte.ts`, whatever a framework brings — reddens
 * this gate and is DECIDED, instead of leaving the population without anybody noticing.
 */
const PARSED_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.svelte'];

/**
 * Extensions that carry no code and are therefore not probed — named, so the exclusion is an act.
 *
 * ⚠ A FILE HERE IS A FILE NOBODY LOOKS AT. That is lawful for a stylesheet and unlawful for anything a
 * bundler can execute, which is why the membership assertion below forbids a third category.
 */
const NOT_A_SOURCE_EXTENSION = ['.css', '.html'];

/** The extension of a file name, lower-cased, or `''` when it has none. */
function extensionOf(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

/** Every file under `dir`, derived from the filesystem — no extension filter at all. */
function everyFile(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = `${dir}/${name}`;
		if (statSync(p).isDirectory()) everyFile(p, acc);
		else acc.push(p);
	}
	return acc;
}

/** Every source file under the demo's source tree the probe can read — tests excluded, as before. */
function demoSources(dir: string): string[] {
	return everyFile(dir).filter(
		(p) =>
			PARSED_EXTENSIONS.includes(extensionOf(p)) &&
			!/[.](test|spec)[.][cm]?ts$/.test(p) &&
			!/[.](test|spec)[.][cm]?js$/.test(p)
	);
}

/**
 * The TypeScript inside one file, as FRAGMENTS — because a `.svelte` file is not a TypeScript file.
 *
 * ⛔ A `.svelte` FILE PARSED WHOLE AS TS IS MARKUP FED TO A LANGUAGE PARSER, and parsed whole as TSX its
 * `<script>` body is JSX CHILDREN rather than code. So the two halves are read as what they each are: every
 * `<script>` BODY as TypeScript, and the remaining markup as TSX, which is what makes `{result.stderr}` in a
 * template an element the walk can see. ⚠ The line numbers are offset back onto the real file, so a finding
 * names a place a reader can open.
 *
 * ⛔⛔ AND THE ONE-PARSE SHORTCUT LOOKS LIKE IT WORKS, WHICH IS WHY THE CASE BELOW HAD TO BE REWRITTEN. The
 * first version of it drove `const { stdout, stderr } = $props();` inside the script block, and the
 * whole-file-TSX MUTANT **SURVIVED**: in JSX children, `{ … }` is an EXPRESSION container, so a DESTRUCTURE
 * inside a script body is parsed as code by accident even when the parser thinks it is reading markup. What
 * is genuinely invisible to that parse is a binding with no braces around it — `outcome.stderr` — and that
 * is what the case drives now. ⭐ A control that passes for the wrong reason is this repository's most
 * recorded instrument defect, and this one was caught by mutating the instrument rather than by reading it.
 */
function typescriptFragments(
	file: string,
	source: string
): { readonly text: string; readonly line: number; readonly kind: ts.ScriptKind }[] {
	if (extensionOf(file) !== '.svelte')
		return [{ text: source, line: 0, kind: ts.ScriptKind.TS }];
	const fragments: { text: string; line: number; kind: ts.ScriptKind }[] = [];
	// ⚠ THE SCRIPT BLOCKS ARE LOCATED BY TAG, WHICH IS A LEXICAL ACT AND IS SAID SO. What is decided by a
	// PARSER is what counts as a BINDING — `B9`'s finding — and that is unchanged. Finding the boundaries of
	// an element is not identity resolution, and the markup half below is read whatever this half misses.
	const openings = /<script\b[^>]*>/gi;
	let markup = source;
	for (let hit = openings.exec(source); hit !== null; hit = openings.exec(source)) {
		const from = hit.index + hit[0].length;
		const to = source.toLowerCase().indexOf('</script>', from);
		const body = source.slice(from, to === -1 ? source.length : to);
		fragments.push({
			text: body,
			line: source.slice(0, from).split('\n').length - 1,
			kind: ts.ScriptKind.TS
		});
		// Blanked rather than removed, so the markup half keeps every line where it actually is.
		markup =
			markup.slice(0, from) +
			body.replace(/[^\n]/g, ' ') +
			markup.slice(to === -1 ? source.length : to);
	}
	fragments.push({ text: markup, line: 0, kind: ts.ScriptKind.TSX });
	return fragments;
}

/**
 * The constant value of an expression used as a KEY, or `undefined` when it has none.
 *
 * ⭑ WHAT REACHES B9's SHAPES (3) AND (5). `r['stderr']`, `` r[`stderr`] ``, `r['std' + 'err']` and
 * `` r[`std${'err'}`] `` all name the same property and none of them is written `.stderr`. ⚠ A key built from a
 * runtime value has no constant form and is the disclosed limit in the header — folding stops at the first
 * operand it cannot decide, and returns `undefined` rather than a guess.
 */
function constantKey(node: ts.Expression): string | undefined {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	if (ts.isParenthesizedExpression(node)) return constantKey(node.expression);
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		const left = constantKey(node.left);
		const right = constantKey(node.right);
		return left === undefined || right === undefined ? undefined : left + right;
	}
	if (ts.isTemplateExpression(node)) {
		let out = node.head.text;
		for (const span of node.templateSpans) {
			const value = constantKey(span.expression);
			if (value === undefined) return undefined;
			out += value + span.literal.text;
		}
		return out;
	}
	return undefined;
}

/** One place a source names a token as a BINDING — as distinct from the MENTIONS of it. */
interface Binding {
	readonly file: string;
	readonly line: number;
	readonly shape: 'identifier' | 'element-access' | 'computed-key';
}

/**
 * Every BINDING of `token` in one source, by walking the parsed tree.
 *
 * ⛔ A PARSER, NOT A PATTERN, AND THE HEADER LISTS THE FIVE SHAPES THAT MADE THAT NECESSARY. An `Identifier`
 * with this name is a binding wherever it appears — a destructure over one line or five, a parameter, a
 * shorthand property, a property read, an import clause — and that is the whole of what "bound" means. ⭑
 * COMMENTS ARE NOT NODES, so documentation about the hazard cannot redden the gate that guards it, which is
 * what the regexes it replaces were bolted together to work around.
 */
function bindingsInSource(
	file: string,
	source: string,
	token: string,
	kind: ts.ScriptKind = ts.ScriptKind.TS
): Binding[] {
	const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, kind);
	const found: Binding[] = [];
	const lineOf = (node: ts.Node): number =>
		sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
	const walk = (node: ts.Node): void => {
		if (ts.isIdentifier(node) && node.text === token)
			found.push({ file, line: lineOf(node), shape: 'identifier' });
		else if (ts.isElementAccessExpression(node) && constantKey(node.argumentExpression) === token)
			found.push({ file, line: lineOf(node), shape: 'element-access' });
		else if (ts.isComputedPropertyName(node) && constantKey(node.expression) === token)
			found.push({ file, line: lineOf(node), shape: 'computed-key' });
		node.forEachChild(walk);
	};
	walk(sf);
	return found;
}

/** Every binding in ONE file, whatever kind of file it is — `W3`'s dispatcher. */
function bindingsInFile(file: string, source: string, token: string): Binding[] {
	return typescriptFragments(file, source).flatMap((fragment) =>
		bindingsInSource(file, fragment.text, token, fragment.kind).map((found) => ({
			...found,
			line: found.line + fragment.line
		}))
	);
}

/** The same probe over the demo's own sources, which is the population every limb below is stated over. */
function bindings(token: string): Binding[] {
	return demoSources(DEMO_SRC).flatMap((file) =>
		bindingsInFile(file.slice(ROOT.length), readFileSync(file, 'utf8'), token)
	);
}

/** A demo-relative path, forward-slashed, as the lists above name files. */
function demoRelative(file: string): string {
	return file.split('\\').join('/').slice(DEMO_PREFIX.length);
}

/** The demo's own source files, demo-relative — the population every limb below is stated over. */
function demoPopulation(): string[] {
	return demoSources(DEMO_SRC).map((f) => demoRelative(f.slice(ROOT.length)));
}

/** Two real directories, because the disposition's refusals are about workspaces that have one. */
const container = mkdtempSync(join(tmpdir(), 'jpwb-regq066-'));
const deliverableDirectory = join(container, 'workspace');
const outputDirectory = `${deliverableDirectory}.process-output`;
const deliverable: Workspace = createFilesystemWorkspace({
	ownerKind: 'UNDERTAKING',
	ownerId: 'und_regq066',
	purgeability: 'RETAINED_BY_PARTICIPATION',
	directoryPath: deliverableDirectory
});
const purgeableOutput: Workspace = createFilesystemWorkspace({
	ownerKind: 'UNDERTAKING',
	ownerId: 'und_regq066',
	purgeability: 'PURGEABLE_AT_EXPIRY',
	directoryPath: outputDirectory
});

afterAll(() => {
	rmSync(container, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
});

describe('REG-Q-066 — the stderr hatch is CLOSED BY DISPOSITION, and the disposition is gated', () => {
	it('⭑ POSITIVE CONTROL — the instrument finds `stdout`, which the demo does bind', () => {
		// Without this, a glob that matched nothing would make every assertion below pass while asserting nothing.
		expect(bindings('stdout').length).toBeGreaterThan(0);
	});

	it('`stderr` is bound NOWHERE except at the sites this gate DISPOSES OF', () => {
		const undisposed = bindings('stderr').filter(
			(h) => !DISPOSED_STDERR_SITES.includes(demoRelative(h.file))
		);
		expect(
			undisposed,
			"Binding `stderr` CREATES the retention surface REG-Q-066 asks about — a model CLI's stderr can echo " +
				"prompt content and a build's stderr can echo the environment it ran in, which PER-9 governs and no " +
				'redaction in this codebase covers (finding #60). If this is deliberate, it needs a retention ' +
				'disposition and REG-Q-066 needs re-answering; it must not arrive as a debugging convenience. The ' +
				'one site that HAS a disposition is `child-process-runner.ts` — read its header (R7: both streams ' +
				'retained, both PURGEABLE_AT_EXPIRY, referenced by ProcessRunOutcome.retention, reachable by ' +
				'Workspace.purge) and write the equivalent before adding a second.'
		).toEqual([]);
	});

	it('⛔⛔ W3 — EVERY extension under the demo source tree is either PROBED or DECLARED not to be', () => {
		// ⭐ THE POPULATION GAP, MADE UNREPEATABLE RATHER THAN PATCHED ELEVEN TIMES. The probe walked `.ts`
		// alone, so eleven `.svelte` files — and any `.mts`, `.cts` or `.js` — were outside the question this
		// gate asks, while its positive control stayed green on a `.ts` file that binds `stdout`.
		// ⛔ THE MUTANT: drop `.svelte` from `PARSED_EXTENSIONS` — this case reddens naming the extension that
		// is in the tree and in neither list, which is the finding the old shape could not produce at all.
		const present = [...new Set(everyFile(DEMO_SRC).map((f) => extensionOf(f)))].sort();
		const undecided = present.filter(
			(ext) => !PARSED_EXTENSIONS.includes(ext) && !NOT_A_SOURCE_EXTENSION.includes(ext)
		);
		expect(
			undecided,
			'A file the probe does not read is a file `stderr` can be bound in without this gate ever ' +
				'looking. Decide: add the extension to PARSED_EXTENSIONS (and teach `typescriptFragments` how ' +
				'to read it, if it is not plain TypeScript), or to NOT_A_SOURCE_EXTENSION if nothing a bundler ' +
				'can execute lives in it. Leaving it out of both is how REG-Q-066 comes to rest on a population ' +
				'nobody stated.'
		).toEqual([]);
	});

	it('⭑ CONTROL — the widened population is a SUPERSET: nothing the `.ts`-only probe saw is lost', () => {
		// ⛔ A WIDENING THAT TRADED FILES WOULD BE A DIFFERENT INSTRUMENT, NOT A STRICTER ONE, and
		// `REG-Q-066`'s answer would rest on the difference. The old population is RE-DERIVED here rather
		// than quoted, so this compares two measurements rather than a measurement against a memory.
		const widened = new Set(demoSources(DEMO_SRC));
		const asItWas = everyFile(DEMO_SRC).filter(
			(f) => f.endsWith('.ts') && !f.endsWith('.test.ts')
		);
		expect(asItWas.length, 'CONTROL: the old population was not empty either').toBeGreaterThan(0);
		expect(asItWas.filter((f) => !widened.has(f))).toEqual([]);
		expect(
			[...widened].filter((f) => f.endsWith('.svelte')).length,
			'and it now reaches the files W3 named'
		).toBe(11);
	});

	it('⭐⭐ W3 — the SVELTE reader, driven: a binding in a script block and one in markup are both SEEN', () => {
		// ⛔ WITHOUT THIS THE WIDENING IS A CLAIM. A `.svelte` file parsed whole as TS is markup handed to a
		// language parser; parsed whole as TSX, the `<script>` BODY is JSX text — a string — so the binding
		// `W3` is actually about would be missed by the instrument written to reach it. Both halves are
		// driven, over a source shaped like this app's own pages.
		// ⛔ THE MUTANT: read the script blocks only, or read the file as one TSX source — one of the two
		// arrangements below then goes unseen while the gate stays green.
		const page = [
			'<script lang="ts">',
			// ⭑ NO BRACES, DELIBERATELY — see `typescriptFragments`: a DESTRUCTURE here survives a whole-file
			// TSX parse as a JSX expression, so it cannot tell the two arrangements apart. A property read can.
			'\tconst failure = outcome.stderr;',
			'</script>',
			'',
			'<pre>{stdout}</pre>',
			'<pre>{diagnostics.stderr}</pre>'
		].join('\n');
		const lines = bindingsInFile('lib/Fake.svelte', page, 'stderr')
			.map((h) => h.line)
			.sort((a, b) => a - b);
		expect(lines, 'the SCRIPT block (line 2) and the MARKUP expression (line 6), each by its own reader')
			.toEqual([2, 6]);
	});

	it('⭑⭑ CONTROL — and PROSE in Svelte markup is not a binding, so the widening is not a matcher', () => {
		// ⭐ THE HALF A "READ EVERY BYTE" WIDENING FAILS. Markup TEXT that mentions `stderr` — a heading, a
		// label, a paragraph explaining the retention disposition — is not a binding, and a widened
		// population that reddened on it would be the broken instrument `P2B-ai` exists to forbid, arriving
		// through the population instead of through the predicate.
		const page = [
			'<script lang="ts">',
			'\tconst { stdout } = $props();',
			'</script>',
			'',
			'<h2>stderr is retained under R7</h2>',
			'<p>This page shows stdout only; stderr is purgeable-at-expiry.</p>'
		].join('\n');
		expect(bindingsInFile('lib/Prose.svelte', page, 'stderr')).toEqual([]);
		expect(
			bindingsInFile('lib/Prose.svelte', page, 'stdout').length,
			'CONTROL: the same file DOES bind stdout, so the reader is looking'
		).toBeGreaterThan(0);
	});

	it('⛔ the disposed-site list is PINNED — widening it is a deliberate, visible act', () => {
		// ⭑ THE `slice-subsumption.test.ts` IDIOM: a population that may only move by someone editing this literal
		// and recording why. A list that grows quietly is how an exemption becomes a policy.
		// ⭐ `JAN-PRQUAL` `PQ-1`: the fourth entry RE-POINTED with the renderer it disposes of (it read
		// `'lib/server/execution/process-result-floor.ts'`), its disposition moved into that module's header in the same
		// change — not a fifth entry.
		expect(DISPOSED_STDERR_SITES).toEqual([
			'lib/server/execution/child-process-runner.ts',
			'lib/server/tools/execution-tool-surface.ts',
			'lib/server/tools/process-run-observer.ts',
			'lib/server/assurance/process-result-render.ts'
		]);
	});

	it('⛔ every disposed site EXISTS — a stale exemption would silently re-open the hatch', () => {
		// An exemption naming a file nobody has any more is scope granted to nothing, waiting for the next file
		// to be given that name. It must not survive the deletion of its subject.
		const present = new Set(demoPopulation());
		expect(DISPOSED_STDERR_SITES.filter((site) => !present.has(site))).toEqual([]);
	});

	it('⛔ and every disposed site ACTUALLY BINDS `stderr` — an exemption nobody earned is scope for free', () => {
		// ⚠ THE RATCHET THE PREVIOUS GATE COULD NOT HAVE: if this module ever stops binding `stderr`, the
		// exemption must be REMOVED rather than left standing. An unused exemption is indistinguishable, later,
		// from a deliberate grant — and the next author who wants one finds it already written.
		const bound = new Set(bindings('stderr').map((h) => demoRelative(h.file)));
		expect(DISPOSED_STDERR_SITES.filter((site) => !bound.has(site))).toEqual([]);
	});

	it('⭐ REG-Q-066’s ORIGINAL SUBJECT — `agy-cli.ts` — binds none, with its own control that it is looked at', () => {
		// ⛔ THE BOUND THE QUESTION ACTUALLY STATED IS ABOUT A MODEL CLI'S stderr ECHOING PROMPT CONTENT, and that
		// hazard differs in KIND from a build's own diagnostics even though the SURFACE is identical. So it is
		// asserted BY NAME: a future author who widens the list above still cannot reach this file without
		// reddening a case that names it.
		// ⭑ AND THE CONTROL IS NOT DECORATIVE — without it, a rename of `agy-cli.ts` would make this pass by
		// looking at nothing, which is precisely the failure the suite's own positive control exists to catch.
		expect(demoPopulation(), 'CONTROL: the original subject is in the population').toContain(
			THE_ORIGINAL_SUBJECT
		);
		expect(
			bindings('stderr').filter((h) => demoRelative(h.file) === THE_ORIGINAL_SUBJECT),
			'REG-F-326 closed this bound because agy-cli binds no stderr; the model-CLI hazard it named is not ' +
				'what Phase 2b disposed of, and widening the disposed-site list does not reach it.'
		).toEqual([]);
	});
});

describe('⛔⛔ B9 — the PROBE itself, driven: five shapes that walked past the regexes it replaces', () => {
	/**
	 * Each arrangement is a whole source file, because four of the five are only expressible across lines or
	 * across a call boundary — which is exactly why a line-at-a-time matcher could not see them.
	 *
	 * ⭑ EVERY ONE OF THESE IS CODE THIS REPOSITORY WOULD PLAUSIBLY WRITE, not a contrivance to beat a matcher:
	 * (1) is what `prettier` at `printWidth: 100` produces, (2) and (4) are the idiomatic shapes for the very
	 * `execFileAsync` call `agy-cli.ts` makes, and (3) is how a `catch` reads a child's diagnostics.
	 */
	const EVADED: Record<string, string> = {
		'B9-1 a MULTI-LINE destructure — what prettier produces at printWidth 100': [
			'const {',
			'\tstdout,',
			'\tstderr',
			'} = await execFileAsync(binary, args, options);',
			'record(stdout, stderr);'
		].join('\n'),
		'B9-2 `.then(({ stdout, stderr }) => …)` — the shape agy-cli’s own call would take': [
			'execFileAsync(binary, args).then(({ stdout, stderr }) => record(stdout, stderr));'
		].join('\n'),
		"B9-3 an ELEMENT ACCESS — `e['stderr']`": [
			'function why(e: Record<string, string>): string {',
			"\treturn String(e['stderr'] ?? '');",
			'}'
		].join('\n'),
		'B9-4 a DESTRUCTURED PARAMETER': [
			'function record({ stdout, stderr }: { stdout: string; stderr: string }): string {',
			'\treturn stdout + stderr;',
			'}'
		].join('\n'),
		'B9-5 a COMPUTED KEY, in both of its constant spellings': [
			"const a = result['std' + 'err'];",
			"const b = result[`std${'err'}`];",
			"const { ['stderr']: c } = result;"
		].join('\n')
	};

	/**
	 * ⛔ THE NEGATIVE HALF, AND IT IS NOT DECORATION. The probe this one replaces matched the token ANYWHERE and
	 * therefore reddened on `agy-cli.ts`'s own comment EXPLAINING why stderr must not be bound — red for two days
	 * unnoticed. A probe that catches everything is not stricter, it is broken, and this is the arm that tells
	 * the two apart.
	 */
	const NOT_A_BINDING: Record<string, string> = {
		'a LINE COMMENT about the hazard':
			'// stderr must never be bound here — see REG-Q-066.\nconst x = 1;',
		'a BLOCK COMMENT about the hazard':
			'/**\n * stderr is the surface REG-Q-066 asks about.\n */\nconst x = 1;',
		'a MESSAGE that names it': "throw new Error('stderr must not be bound without a disposition');",
		'a DIFFERENT identifier that merely starts with it':
			"const stderrPath = 'captures/x/stderr.txt';"
	};

	it('⭐⭐ every one of the FIVE evaded shapes is SEEN — each was driven past the regexes it replaces', () => {
		// ⛔ THE MUTANT: restore the line-at-a-time regexes (`/\.stderr\b/` or `{ … stderr … } =` on one line).
		// Measured against them: all five MISSED, and the two shapes they did catch — a single-line destructure
		// and a plain `.stderr` — SEEN. This case is that measurement made permanent.
		const missed = Object.entries(EVADED).filter(
			([name, source]) => bindingsInSource(name, source, 'stderr').length === 0
		);
		expect(
			missed.map(([name]) => name),
			'REG-Q-066 rests on this probe seeing every binding; a shape it misses is an undisclosed retention ' +
				'surface, and the gate would pass while the hatch stood open.'
		).toEqual([]);
	});

	it('⭑ CONTROL — and the shapes the OLD probe caught are still caught, so this is a widening of nothing', () => {
		// ⛔ THE REPLACEMENT MUST BE A SUPERSET. A probe that traded five new shapes for one it used to see would
		// be a different instrument, not a stricter one, and REG-Q-066's answer would rest on the difference.
		for (const [name, source] of Object.entries({
			'a single-line destructure': 'const { stdout, stderr } = await execFileAsync(binary, args);',
			'a property read': 'const why = error.stderr;'
		}))
			expect(bindingsInSource(name, source, 'stderr').length, name).toBeGreaterThan(0);
	});

	it('⭑⭑ CONTROL — and PROSE about stderr is NOT a binding, which is the defect that made the old probe red', () => {
		// ⭐ THE HALF A "CATCHES EVERYTHING" PROBE FAILS. A parser does not see comments at all, and a string that
		// is not an accessor key is a message rather than a property. Without this arm, "find every occurrence of
		// the token" would satisfy the case above and the gate would be red on its own documentation again.
		const falsePositives = Object.entries(NOT_A_BINDING).filter(
			([name, source]) => bindingsInSource(name, source, 'stderr').length > 0
		);
		expect(falsePositives.map(([name]) => name)).toEqual([]);
	});
});

describe('⭐⭐ THE DISPOSITION, DRIVEN — the disposed module refuses every wiring that would make R7 false', () => {
	it('⛔ it REFUSES an output workspace whose bytes can never be purged', () => {
		// ⭐ THIS IS THE LIMB A SOURCE SCAN CANNOT MAKE, AND IT IS WHY THE NARROWING ABOVE IS NOT A WEAKENING.
		// The previous gate could say only that nobody touched `stderr`. This says the one module that does
		// cannot be wired in a way that would make `R7` false: `R7` requires both streams to come under purge,
		// `PER-8` makes `purge` REFUSE on a workspace declared RETAINED_BY_PARTICIPATION, so capturing into one
		// would retain `stderr` as bytes nothing could ever destroy — REG-Q-066's surface, reached through a
		// one-word host mistake rather than through a debugging convenience.
		// ⚠ THE OUTPUT WORKSPACE HERE IS A **FILESYSTEM** ONE, DELIBERATELY: an arrangement that trips two
		// conjuncts proves neither, and the in-memory one this case used to use trips the next case's guard too.
		const participating = createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: 'und_regq066',
			purgeability: 'RETAINED_BY_PARTICIPATION',
			directoryPath: outputDirectory
		});
		expect(() =>
			createChildProcessRunner({
				deliverableWorkspace: deliverable,
				outputWorkspace: participating
			})
		).toThrow(/R7/);
	});

	it('⛔ and it REFUSES an output workspace that has no bytes on a disk at all', () => {
		// ⭐ `B7`: the guard checked the CLASS and not the MATERIALIZATION, so an IN_MEMORY workspace carrying
		// `PURGEABLE_AT_EXPIRY` was accepted and `retention` reported `retained: true` with a `stdoutPath` for
		// bytes in a `Map` — `R7`'s durable copy asserted over something that dies with the process. The class
		// here is the LAWFUL one, so this arrangement trips this conjunct and no other.
		expect(() =>
			createChildProcessRunner({
				deliverableWorkspace: deliverable,
				outputWorkspace: createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: 'und_regq066',
					purgeability: 'PURGEABLE_AT_EXPIRY'
				})
			})
		).toThrow(/IN_MEMORY/);
	});

	it('⭑ CONTROL — the lawful wiring is accepted, so both refusals discriminate', () => {
		// ⚠ A factory that threw at everything would satisfy both cases above.
		expect(() =>
			createChildProcessRunner({
				deliverableWorkspace: deliverable,
				outputWorkspace: purgeableOutput
			})
		).not.toThrow();
	});
});
