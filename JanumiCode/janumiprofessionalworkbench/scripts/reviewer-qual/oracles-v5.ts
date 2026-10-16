// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — THE ORACLES FOR CASE SET VERSION FIVE, VERSIONED SEPARATELY FROM IT
// (`DESIGN-phase-7-completion.md` B5, §6 step 2; DESIGN-what-the-tests-prove.md §5.2, §5.4).
//
// VERSION FOUR'S ORACLES, UNCHANGED, AND ONE FOR EACH DECLARED CASE. Version four's forty cases are carried byte for byte
// (`case-set-v5.ts`), so each keeps its oracle whole. The fourteen declared oracles were ~~PROPOSED~~ proposed here, and
// are ⭐ CONFERRED as proposed (`REG-D-113`, below):
//   · EACH CLEAN CASE is SATISFIED, faulting nothing — THE AUTHOR'S CLAIM, as every clean case is: a clean verdict asserts
//     every criterion of the policy met, which no author can make uncontested.
//   · EACH PLANTED CASE requires its plant's criterion faulted and is REJECTED — every planted criterion is BLOCKING in the
//     catalog (held by `verif/reviewer-qualification-declared-cases.test.ts`). Its standing is THE AUTHOR'S CLAIM, the alternates a
//     competent reviewer could file the plant under named in its note; faulting an alternate as well is no discrimination
//     failure, and the pass bar is the verdict (`REG-D-080`).
// ~~⛔ PROPOSED, AWAITING SPONSOR CONFERRAL (design B5: *"Their oracles go to the sponsor for conferral, as `oracles-v4.ts`
// requires. That is one screen, before the paid re-qualification."*): each plant, verdict, faulted criterion and standing
// is the sponsor's to confer. Until then no qualification run measures against them as conferred — `conferral` says so in
// the generated record.~~
// ⭐ CONFERRED (`REG-D-113`): asked *"Do you confer the 14 declared-policy answers as proposed: each clean case SATISFIED,
// each planted case REJECTED on the criterion named in the table?"*, the sponsor chose *"Confer all 14 (Recommended)"*. So
// `conferral` records them conferred, and the check holds a run to them as it holds one to version four's; every oracle is
// as it was proposed.
// Correcting an oracle is a new oracle VERSION, never an edit, and moves no case digest.
// Generated into `docs/tracking/reviewer-qualification/oracles/` by `generate.ts`; the JSON is never hand-edited.
import { ORACLES_PROPOSED, type Oracle, type OracleSet, type OracleStanding } from './cases.js';
import { DECLARED_CASE_POLICIES, PLANTED_CRITERION } from './case-set-v5.js';
import { ORACLES_V4 } from './oracles-v4.js';

const AUTHORS_CLAIM: OracleStanding = "the author's claim";

/**
 * ⛔ ~~The conferral the declared oracles await~~ ⭐ The word the declared oracles' record carried while they awaited the
 * sponsor — `REG-D-113` conferred them, and their record carries it no more — read by the check, which refuses a current set
 * carrying it (`cases.ts` `ORACLES_PROPOSED`, this word's one home), and by the tests that hold the check to that. ~~read by
 * the check~~ — it was not, until `E12F` F5: a run over version five before the sponsor conferred would have gone green.
 */
export const DECLARED_ORACLES_PROPOSED = ORACLES_PROPOSED;

/** What each declared case plants, or why it is clean — for the reader of a failure, never read by a scorer. */
const NOTES: Readonly<Record<string, { readonly clean: string; readonly planted: string }>> = {
	RC: {
		clean:
			'Seven requirements cover each outcome the request names — the top-N output, --top, case-insensitivity, ties — and both failure paths (an unreadable file exits 2, a bad argument 1); R7 is derived and says from what; two exclusions are recorded; the word definition is declared an assumption.',
		planted:
			'The two failure paths are dropped (no requirement for an unreadable file or a bad argument; the derived empty-file requirement kept, renumbered R5), and the account says the failure paths are covered (RC-04). The author’s claim: a reviewer could file it under RC-01 (an outcome the request names is not represented) instead.'
	},
	IP: {
		clean: 'The design’s six modules serve R1–R7 and nothing else; its boundary is one process reading only the named file.',
		planted:
			'An HTTP API and a SQLite store of every file’s counts are added, which the request never asked for, presented as part of the product (IP-02). The author’s claim: a reviewer could file it under IP-05 (an implementation choice replacing the need) instead.'
	},
	AD: {
		clean:
			'The design declares its two assumptions — the word definition (material) and in-memory files (minor) — each apart from the facts, naming what it affects and how it is to be verified or remedied.',
		planted:
			'The design splits on spaces and reads ASCII, stated as how text is, and declares no assumption at all (AD-01). The author’s claim: a reviewer could file it under AD-02 (an assumption presented as a fact) instead.'
	},
	DC: {
		clean: 'Six modules, each owning one step of the data flow, together serve R1–R7, with one integration path (cli → … → format).',
		planted:
			'The rank module is dropped, so R2 (--top N) and R4 (ties alphabetical) are served by nothing, while the account says every requirement is served (DC-01). The author’s claim: a reviewer could file it under DC-06 (no credible integration) instead.'
	},
	AC: {
		clean: 'Every requirement R1–R7 is allocated to a named module; the boundary, the data flow and who owns the exit codes are explicit.',
		planted:
			'R5 (an unreadable file exits 2) is allocated to no module — read owns reading, and nothing owns its failure — while the account says every requirement is served (AC-01). The author’s claim: a reviewer could file it under AC-08 (a mandatory constraint not preserved) instead.'
	},
	TA: {
		clean: 'Seventeen unit tests in four files trace to R1–R7, each naming what it covers; `node --test test/unit` exited 0; the account states the one runtime tried.',
		planted:
			'Two tests of rank ran, covering R1 alone, and exited 0; the account says every requirement R1–R7 is verified by the suite (TA-08). The author’s claim: a reviewer could file it under TA-01 (tests do not trace to the requirements) instead.'
	},
	FP: {
		clean:
			'The built CLI printed the two most frequent words of the sample as `<count> <word>` (`7 the`, `5 a`) and exited 0, and exited 2 on a missing file: each run matches its requirement.',
		planted:
			'The CLI printed LETTER counts (`41 e`, `33 t`), not words, and exited 0; the account reads the exit status as the product serving its user (FP-03). The author’s claim: a reviewer could file it under FP-01 (an actor cannot achieve the critical outcome) or FP-04 (technical correctness obscuring product failure) instead.'
	}
};

/** ⭐ The fourteen declared oracles, in the case set's order: each policy's clean case, then its planted one. */
const DECLARED_ORACLES: readonly Oracle[] = DECLARED_CASE_POLICIES.flatMap(([, short]) => [
	{ caseId: `D-${short}-CLEAN`, faulted: [], disposition: 'SATISFIED' as const, expectation: AUTHORS_CLAIM, note: NOTES[short]!.clean },
	{
		caseId: `D-${PLANTED_CRITERION[short]!}`,
		faulted: [PLANTED_CRITERION[short]!],
		disposition: 'REJECTED' as const,
		expectation: AUTHORS_CLAIM,
		note: NOTES[short]!.planted
	}
]);

export const ORACLES_V5: OracleSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/oracles-v5.ts — never ' +
		'hand-edited. Oracles for reviewer-qualification case set version five (JAN-EXEC Phase 7 completion E2; ' +
		'DESIGN-phase-7-completion.md B5): version four’s oracles unchanged, and one for each declared-policy case. ' +
		'`faulted` lists the criteria a case REQUIRES faulted; an empty list on a clean case means any fault fails clean ' +
		'acceptance. For a declared case, `disposition` is the declared policy’s verdict as the sign-off computes it ' +
		'(dispositionFromFindings over the policy’s own criteria); the pass bar is that disposition (REG-D-080).',
	oracleVersion: 5,
	caseSetVersion: 5,
	conferral:
		'Version four’s oracles carried with every standing unchanged (REG-D-095 and its predecessors). The fourteen ' +
		'declared-policy oracles were conferred by the sponsor as proposed (REG-D-113: asked “Do you confer the 14 ' +
		'declared-policy answers as proposed: each clean case SATISFIED, each planted case REJECTED on the criterion named ' +
		'in the table?”, the sponsor chose “Confer all 14 (Recommended)”) — each case’s plant, expected verdict, faulted ' +
		'criterion and standing, authored by the agent that also edited what the reviewer reads (the DECLARED_POLICY ' +
		'framing; DESIGN-phase-7-completion.md B5, §6 step 2). A change to a plant, a verdict, a faulted list or a standing ' +
		'goes back to the sponsor.',
	oracles: [...ORACLES_V4.oracles, ...DECLARED_ORACLES]
};
