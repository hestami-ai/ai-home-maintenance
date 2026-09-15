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
//     purged — the disposition made structural, and the last case below.
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
// ⭑ Plus the one that is not a source probe at all: the disposed module's REFUSAL, driven.
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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInMemoryWorkspace } from '@janumipwb/rph-ports';
import { createChildProcessRunner } from '../apps/rph-demo/src/lib/server/execution/child-process-runner.js';

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
const DISPOSED_STDERR_SITES = ['lib/server/execution/child-process-runner.ts'];

/** REG-Q-066's ORIGINAL subject, named so the bound it actually stated stays closed on its own terms. */
const THE_ORIGINAL_SUBJECT = 'lib/server/assurance/agy-cli.ts';

/** Every .ts file under the demo's server-side source, derived from the filesystem. */
function demoSources(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = `${dir}/${name}`;
		if (statSync(p).isDirectory()) demoSources(p, acc);
		else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) acc.push(p);
	}
	return acc;
}

function occurrences(token: string): { file: string; line: number; text: string }[] {
	const hits: { file: string; line: number; text: string }[] = [];
	for (const file of demoSources(DEMO_SRC)) {
		const lines = readFileSync(file, 'utf8').split('\n');
		lines.forEach((text, i) => {
			if (text.includes(token)) hits.push({ file: file.slice(ROOT.length), line: i + 1, text: text.trim() });
		});
	}
	return hits;
}

/**
 * The BINDINGS of `stderr`, as distinct from the MENTIONS of it.
 *
 * ⚠ THIS PROBED A MENTION AND CALLED IT A BINDING, AND IT HAD BEEN RED FOR TWO DAYS UNNOTICED. `occurrences`
 * matches the token anywhere, INCLUDING COMMENTS AND STRINGS, so the moment `agy-cli.ts` gained a comment
 * EXPLAINING why stderr must not be bound the gate reddened on its own documentation (measured across the
 * commits: dbe1a955 = 0, df6019e8 = 1, 95c71798 = 3). ⭑ IT IS THE SAME DEFECT REG-F-333 RECORDED ABOUT THIS
 * VERY FILE, ONE LAYER OVER: it probed the NAME. This probes the SHAPE — a destructured binding or a property
 * read — which is what "bound" means. Prose about stderr is not a retention surface; `const { stderr } = ...`
 * and `e.stderr` are.
 */
function stderrBindings(): { file: string; line: number; text: string }[] {
	return occurrences('stderr').filter(
		(h) => /\.stderr\b/.test(h.text) || /\{[^}]*\bstderr\b[^}]*\}\s*=/.test(h.text)
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

describe('REG-Q-066 — the stderr hatch is CLOSED BY DISPOSITION, and the disposition is gated', () => {
	it('⭑ POSITIVE CONTROL — the instrument finds `stdout`, which the demo does bind', () => {
		// Without this, a glob that matched nothing would make every assertion below pass while asserting nothing.
		const stdout = occurrences('stdout');
		expect(stdout.length).toBeGreaterThan(0);
	});

	it('`stderr` is bound NOWHERE except at the sites this gate DISPOSES OF', () => {
		const undisposed = stderrBindings().filter(
			(h) => !DISPOSED_STDERR_SITES.includes(demoRelative(h.file))
		);
		expect(
			undisposed,
			'Binding `stderr` CREATES the retention surface REG-Q-066 asks about — a model CLI\'s stderr can echo ' +
				"prompt content and a build's stderr can echo the environment it ran in, which PER-9 governs and no " +
				'redaction in this codebase covers (finding #60). If this is deliberate, it needs a retention ' +
				'disposition and REG-Q-066 needs re-answering; it must not arrive as a debugging convenience. The ' +
				'one site that HAS a disposition is `child-process-runner.ts` — read its header (R7: both streams ' +
				'retained, both PURGEABLE_AT_EXPIRY, referenced by ProcessRunOutcome.retention, reachable by ' +
				'Workspace.purge) and write the equivalent before adding a second.'
		).toEqual([]);
	});

	it('⛔ the disposed-site list is PINNED at ONE — widening it is a deliberate, visible act', () => {
		// ⭑ THE `slice-subsumption.test.ts` IDIOM: a population that may only move by someone editing this literal
		// and recording why. A list that grows quietly is how an exemption becomes a policy.
		expect(DISPOSED_STDERR_SITES).toEqual(['lib/server/execution/child-process-runner.ts']);
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
		const bound = new Set(stderrBindings().map((h) => demoRelative(h.file)));
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
			stderrBindings().filter((h) => demoRelative(h.file) === THE_ORIGINAL_SUBJECT),
			'REG-F-326 closed this bound because agy-cli binds no stderr; the model-CLI hazard it named is not ' +
				'what Phase 2b disposed of, and widening the disposed-site list does not reach it.'
		).toEqual([]);
	});

	it('⭐⭐ THE DISPOSITION, DRIVEN — the disposed module REFUSES a workspace whose bytes can never be purged', () => {
		// ⭐ THIS IS THE LIMB A SOURCE SCAN CANNOT MAKE, AND IT IS WHY THE NARROWING ABOVE IS NOT A WEAKENING.
		// The previous gate could say only that nobody touched `stderr`. This says the one module that does
		// cannot be wired in a way that would make `R7` false: `R7` requires both streams to come under purge,
		// `PER-8` makes `purge` REFUSE on a workspace declared RETAINED_BY_PARTICIPATION, so capturing into one
		// would retain `stderr` as bytes nothing could ever destroy — REG-Q-066's surface, reached through a
		// one-word host mistake rather than through a debugging convenience.
		// ⚠ THE CONTROL IS THE SECOND HALF: a factory that threw at everything would satisfy the first.
		expect(() =>
			createChildProcessRunner({
				outputWorkspace: createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: 'und_regq066',
					purgeability: 'RETAINED_BY_PARTICIPATION'
				})
			})
		).toThrow(/R7/);
		expect(
			() =>
				createChildProcessRunner({
					outputWorkspace: createInMemoryWorkspace({
						ownerKind: 'UNDERTAKING',
						ownerId: 'und_regq066',
						purgeability: 'PURGEABLE_AT_EXPIRY'
					})
				}),
			'CONTROL: the lawful wiring is accepted, so the refusal above discriminates'
		).not.toThrow();
	});
});
