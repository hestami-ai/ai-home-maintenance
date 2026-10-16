// ⭐⭐ `JAN-EXEC` Phase 7 completion, round 5 — THE ORACLES FOR CASE SET VERSION SIX, VERSIONED SEPARATELY FROM IT (the
// sponsor's ruling on D-FP-CLEAN, to be registered as `REG-D-115`, and its delegated extension;
// DESIGN-what-the-tests-prove.md §5.2, §5.4).
//
// VERSION FIVE'S ORACLES, FOUR CARRIED TO THEIR REPAIRED CASES. Every case of version six but four is version five's, byte
// for byte (`case-set-v6.ts`), and keeps its oracle whole: version four's forty as `REG-D-095` and its predecessors conferred
// them, and ten of the fourteen declared ones as `REG-D-113` conferred them. The other four are carried to the cases version
// six repairs, each with its verdict, its faulted list and its standing unchanged — only its id and its note move, the note
// saying what the repaired record is:
//   · D-FP-CLEAN's, to D6-FP-CLEAN: SATISFIED, faulting nothing, the author's claim — the same verdict, which the sponsor
//     ruled it keeps ("Repair the case (Recommended)": make its record genuinely clean, and keep its oracle SATISFIED).
//   · D-FP-03's, D-RC-CLEAN's and D-RC-04's, to D6-FP-03, D6-RC-CLEAN and D6-RC-04 — carried under the ruling's delegated
//     extension (the lead's, flagged for sponsor confirmation): REJECTED on FP-03, SATISFIED, and REJECTED on RC-04.
// Correcting an oracle is a new oracle VERSION, never an edit, and moves no case digest.
// Generated into `docs/tracking/reviewer-qualification/oracles/` by `generate.ts`; the JSON is never hand-edited.
import type { Oracle, OracleSet } from './cases.js';
import { REPAIRED_IN_V6, type RepairedInV6 } from './case-set-v6.js';
import { ORACLES_V5 } from './oracles-v5.js';

/** Why each repaired case is clean, or what it plants — for the reader of a failure, never read by a scorer. */
const REPAIRED_NOTE: Readonly<Record<RepairedInV6, string>> = {
	'D-RC-CLEAN':
		'Seven requirements cover each outcome the request names — the top-N output, --top, case-insensitivity, ties — and ' +
		'both failure paths (an unreadable file exits 2, a bad argument 1); each names its source, and what the request does ' +
		'not state is named a derived decision with its basis — R7 whole, and "positive integer" in R2 and R6, "printed in ' +
		'lower case" in R3, "prints nothing" in R5 and "a usage message" in R6; R2 and R6 agree on a `--top` that is not a ' +
		'positive integer; two exclusions are recorded; the word definition is declared an assumption. Version six repairs ' +
		'D-RC-CLEAN (REG-D-115’s delegated extension), whose sources gave the request those parts, which it does not state ' +
		'(RC-05), and whose R2 read as if `--top 0` meant 10.',
	'D-RC-04':
		'The two failure paths are dropped (no requirement for an unreadable file or a bad argument; the derived empty-file ' +
		'requirement kept, renumbered R5), and the account says the failure paths are covered (RC-04). The author’s claim: a ' +
		'reviewer could file it under RC-01 (an outcome the request names is not represented) instead. Version six repairs ' +
		'D-RC-04 (REG-D-115’s delegated extension) with its clean twin: the requirements it keeps are D6-RC-CLEAN’s, their ' +
		'sources and wording repaired, so its plant is all that sets it apart.',
	'D-FP-CLEAN':
		'Six runs of the built CLI, each recorded by the host with its exit code, show R1–R7 as the requirements case states ' +
		'them: the top two and the default top ten of the sample, whose whole text the work product states, mixed-case words ' +
		'counted together, equal counts in alphabetical order, the empty file, the missing file exiting 2 with its message on ' +
		'standard error recorded, and two bad arguments exiting 1 with a usage message on standard error; the verdict and the ' +
		'account claim what the runs show, the limitations name what was not run (very large files; a file that exists but ' +
		'cannot be read) and the residual uncertainty what was not tried (non-Latin text). Version six repairs D-FP-CLEAN ' +
		'(REG-D-115), whose two runs showed R1, R2 and R5’s exit code alone while its verdict said each run matched its ' +
		'requirement.',
	'D-FP-03':
		'The CLI printed LETTER counts of the sample whose text the record states (`16 t`, `14 a` for `--top 2`), not words, ' +
		'while every run exited as its requirements state; the account reads the exit statuses and the shape of the lines as ' +
		'the product serving its user (FP-03). The author’s claim: a reviewer could file it under FP-01 (an actor cannot ' +
		'achieve the critical outcome) or FP-04 (technical correctness obscuring product failure) instead. Version six ' +
		'repairs D-FP-03 (REG-D-115’s delegated extension) with its clean twin: its record is D6-FP-CLEAN’s but for the ' +
		'plant, where version five’s two runs, no standard error recorded and requirements no run showed let a reviewer ' +
		'reject it without detecting the plant.'
};

/** A version-five oracle as version six holds it: each repaired case's carried to it, every other itself. */
function carried(o: Oracle): Oracle {
	const repair = REPAIRED_IN_V6.find((r) => r.from === o.caseId);
	return repair === undefined ? o : { ...o, caseId: repair.to, note: REPAIRED_NOTE[repair.from] };
}

export const ORACLES_V6: OracleSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/oracles-v6.ts — never ' +
		'hand-edited. Oracles for reviewer-qualification case set version six (JAN-EXEC Phase 7 completion, round 5): ' +
		'version five’s oracles, those of the four cases version six repairs carried to them — D-RC-CLEAN’s to D6-RC-CLEAN, ' +
		'D-RC-04’s to D6-RC-04, D-FP-CLEAN’s to D6-FP-CLEAN and D-FP-03’s to D6-FP-03 — each with its verdict unchanged and ' +
		'its note saying what the repaired record is. `faulted` lists the criteria a case REQUIRES faulted; an empty list on ' +
		'a clean case means any fault fails clean acceptance. For a declared case, `disposition` is the declared policy’s ' +
		'verdict as the sign-off computes it (dispositionFromFindings over the policy’s own criteria); the pass bar is that ' +
		'disposition (REG-D-080).',
	oracleVersion: 6,
	caseSetVersion: 6,
	conferral:
		'Version four’s oracles carried with every standing unchanged (REG-D-095 and its predecessors). Ten of the ' +
		'fourteen declared-policy oracles are version five’s, carried unchanged, conferred by the sponsor as proposed ' +
		'(REG-D-113: asked “Do you confer the 14 declared-policy answers as proposed: each clean case SATISFIED, each planted ' +
		'case REJECTED on the criterion named in the table?”, the sponsor chose “Confer all 14 (Recommended)”). The other ' +
		'four are version five’s, carried to the four cases version six repairs, each with its verdict, its faulted list and ' +
		'its standing unchanged, only its id and its note moved. D6-FP-CLEAN’s — SATISFIED, faulting nothing, the author’s ' +
		'claim — is D-FP-CLEAN’s for the case repaired, conferred by REG-D-115: ' +
		'asked what should happen after the selected reviewer rejected D-FP-CLEAN on FP-06 and FP-07 for flaws its own record ' +
		'shows, the sponsor chose “Repair the case (Recommended)”: make its record genuinely clean, keep its oracle ' +
		'SATISFIED, and check the other six clean declared cases for the same flaw. D6-FP-03’s (REJECTED, faulting FP-03), ' +
		'D6-RC-CLEAN’s (SATISFIED, faulting nothing) and D6-RC-04’s (REJECTED, faulting RC-04), each the author’s claim, are ' +
		'D-FP-03’s, D-RC-CLEAN’s and D-RC-04’s, carried unchanged to their repaired cases under REG-D-115’s delegated ' +
		'extension — the lead’s, flagged for sponsor confirmation. A change to a plant, a verdict, a faulted list or a ' +
		'standing goes back to the sponsor.',
	oracles: ORACLES_V5.oracles.map(carried)
};
