// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B7 — THE ORACLES FOR CASE SET VERSION EIGHT, VERSIONED SEPARATELY FROM IT
// (`REG-D-125`, `REG-D-126`; DESIGN-authoring-review-in-parts.md §5; DESIGN-what-the-tests-prove.md §5.2, §5.4).
//
// VERSION SEVEN'S ORACLES FOR ITS 41 NON-GRAPH CASES, UNCHANGED, AND ONE FOR EACH OF THE 35 PART CASES. The 41 are carried
// byte for byte (`case-set-v8.ts`), so each keeps its oracle whole, with its standing and its conferral. The 35 are the
// sponsor's, conferred (`REG-D-126`), each written out below:
//   · THE 13 CLEAN PARTS (Q30) — SATISFIED, faulting nothing: the three parts of G7-CLEAN, the seven of G3-CLEAN and the root of
//     each of G3-CLEAN-R1, -R2 and -R3, each a part of a PWA whose oracle is SATISFIED unconditionally — under ASR-10, its
//     required parts are satisfied. Each carries its source oracle's standing, the author's claim.
//   · THE 14 CATCHERS (Q30) — REJECTED, faulting the criterion named at the part named in design §5's table; `G7-RR-03-CHILD`'s
//     at the root, Realization. Each standing, the author's claim, is the lead's designation.
//   · THE 3-LEVEL PAIR (Q31) — G8-CLEAN's seven parts SATISFIED, faulting nothing, and G8-RR-02's Verification REJECTED,
//     faulting RR-02, as described: conferred directly, for neither of the pair is a case of this set or has an oracle of its
//     own. ~~Their standings are the author's claim, as every clean case's and every catcher's.~~ ⭐ B7's check (its second
//     MINOR finding) — their standings were not on the sponsor's screen: each, the author's claim, is the builder's
//     proposal, carried as proposed, as `REG-D-124`'s record carries the six graph oracles' (`oracles-v7.ts`).
// ⭐ CONFERRED, NEVER PROPOSED: `conferral` records both questions and the sponsor's answers, and carries no `ORACLES_PROPOSED`.
// A change to a plant, a verdict, a criterion or a catcher goes back to the sponsor (Q31's own condition).
// Correcting an oracle is a new oracle VERSION, never an edit, and moves no case digest.
// Generated into `docs/tracking/reviewer-qualification/oracles/` by `generate.ts`; the JSON is never hand-edited.
import type { Oracle, OracleSet, OracleStanding } from './cases.js';
import { ORACLES_V6 } from './oracles-v6.js';
import { ORACLES_V7 } from './oracles-v7.js';

const AUTHORS_CLAIM: OracleStanding = "the author's claim";

/** The criteria the catchers fault, by the id the floor's rubric gives each. */
const RR = {
	'01': 'RR-01-no-problem-substitution',
	'02': 'RR-02-no-obligation-elision',
	'03': 'RR-03-no-unjustified-scope-reduction',
	'04': 'RR-04-no-proxy-satisfaction',
	'05': 'RR-05-no-premature-convergence',
	'06': 'RR-06-sound-inference',
	'07': 'RR-07-no-contradiction',
	'08': 'RR-08-evidence-integrity',
	'09': 'RR-09-no-completeness-from-existence'
} as const;

/** A clean part's oracle (Q30): SATISFIED, nothing faulted, its source PWA's oracle carried with its standing. */
const clean = (caseId: string, part: string, source: string): Oracle => ({
	caseId,
	faulted: [],
	disposition: 'SATISFIED',
	expectation: AUTHORS_CLAIM,
	note:
		`${part}, a part of ${source}, whose oracle is SATISFIED with nothing faulted: under ASR-10 each of its required parts is ` +
		'satisfied, so this part is too (REG-D-126 Q30). The source oracle’s standing, the author’s claim, is carried.'
});

/**
 * ⭐ B7's check (its second MINOR finding) — HOW THE 3-LEVEL PAIR'S STANDINGS ARE CARRIED: Q31's screen showed verdicts and
 * no standing, so each is the builder's proposal, carried as proposed — `REG-D-124`'s form for the six graph oracles.
 */
const PAIR_STANDING =
	'Its standing, the author’s claim, is the builder’s proposal: Q31’s screen showed no standing, so it is carried as proposed, ' +
	'as REG-D-124’s record carries the six graph oracles’.';

/**
 * ⭐ B7's check — A PART OF G8-CLEAN: SATISFIED, nothing faulted, conferred directly by Q31 — G8-CLEAN is no case of this set
 * and has no oracle, so there is no source oracle to carry.
 */
const cleanG8 = (caseId: string, part: string): Oracle => ({
	caseId,
	faulted: [],
	disposition: 'SATISFIED',
	expectation: AUTHORS_CLAIM,
	note:
		`${part}, a part of G8-CLEAN, the clean 3-level PWA: SATISFIED with nothing faulted, conferred directly by REG-D-126 Q31 ` +
		'(“One clean 3-level PWA, every part expected SATISFIED”); G8-CLEAN is no case of this set and has no oracle of its own. ' +
		PAIR_STANDING
});

/** A catcher's oracle: REJECTED, its plant's criterion faulted, at the part design §5's table names. */
const catcher = (caseId: string, part: string, source: string, rr: keyof typeof RR, plant: string, why: string): Oracle => ({
	caseId,
	faulted: [RR[rr]],
	disposition: 'REJECTED',
	expectation: AUTHORS_CLAIM,
	note:
		`${part} catches ${source}’s plant — ${plant} — and faults it (RR-${rr}): ${why} ` +
		(source.startsWith('G8')
			? `(design §5, the 3-level pair; REG-D-126 Q31, its expected verdict conferred as described). ${PAIR_STANDING}`
			: '(design §5’s table; REG-D-126 Q30). Its standing, the author’s claim, is the lead’s designation.')
});

/** ⭐ The 35 part-case oracles, in the case set's order — each written out, as the sponsor conferred it. */
const PART_ORACLES_V8: readonly Oracle[] = [
	clean('G3-CLEAN.T01', 'The root, “Pedestrian Bridge Structural Review”', 'G3-CLEAN'),
	clean('G3-CLEAN.T02', '“Site and Geotechnical Survey”', 'G3-CLEAN'),
	clean('G3-CLEAN.T03', '“Structural Form Options Study”', 'G3-CLEAN'),
	clean('G3-CLEAN.T04', '“Load Analysis (pedestrian, wind, vibration)”', 'G3-CLEAN'),
	clean('G3-CLEAN.T05', '“Member, Connection and Foundation Design”', 'G3-CLEAN'),
	clean('G3-CLEAN.T06', '“Independent Design Check”', 'G3-CLEAN'),
	clean('G3-CLEAN.T07', '“Rail Authority Permit Submission”', 'G3-CLEAN'),
	clean('G3-CLEAN-R1.T01', 'The root, “Rail Footbridge Engineering Assessment”', 'G3-CLEAN-R1'),
	clean('G3-CLEAN-R2.T01', 'The root, “Station Road Footbridge Review”', 'G3-CLEAN-R2'),
	clean('G3-CLEAN-R3.T01', 'The root, “Crossing Structure Appraisal”', 'G3-CLEAN-R3'),
	catcher(
		'G-RR-01.T01',
		'The root, “Pedestrian Bridge Concept Study”,',
		'G-RR-01',
		'01',
		'a concept study substitutes for the structural review',
		'the request, the root’s definition, its children’s skeletons and the account show the substituted architecture'
	),
	catcher(
		'G3-RR-02.T01',
		'The root, “Pedestrian Bridge Structural Review”,',
		'G3-RR-02',
		'02',
		'the required independent check is absent',
		'its child set and data flow expose the missing required work'
	),
	catcher(
		'G3-RR-03.T04',
		'“Load Analysis (static pedestrian load)”',
		'G3-RR-03',
		'03',
		'the load analysis is narrowed to the static pedestrian load',
		'its own name and the account state the narrowing against the request’s wind and vibration requirements'
	),
	catcher(
		'G3-RR-04.T05',
		'“Vibration Compliance Statement”',
		'G3-RR-04',
		'04',
		'a compliance statement substitutes for the vibration analysis',
		'its definition consumes no analysis, while the account claims this statement covers the requested vibration work'
	),
	catcher(
		'G3-RR-05.T01',
		'The root, “Pedestrian Bridge Structural Review”,',
		'G3-RR-05',
		'05',
		'the structural form is fixed before the required comparison',
		'its child set omits the options study, and the account fixes the form on preference'
	),
	catcher(
		'G3-RR-06.T05',
		'“Member, Connection and Foundation Design”',
		'G3-RR-06',
		'06',
		'the foundations’ adequacy is inferred from neighbouring buildings',
		'the request’s soft-clay evidence and the account’s inference concern this type’s foundation design directly'
	),
	catcher(
		'G3-RR-07.T06',
		'“Design Self-Check by the Senior Design Engineer”',
		'G3-RR-07',
		'07',
		'the design team performs its own independent check',
		'its name, its INTERNAL boundary and the account contradict the request’s independent-firm requirement'
	),
	catcher(
		'G3-RR-08.T05',
		'“Member, Connection and Foundation Design”',
		'G3-RR-08',
		'08',
		'the soft clay is omitted and the ground called benign',
		'the request and the account’s claim about this type’s foundation work show the omission and the unsupported certainty'
	),
	catcher(
		'G3-RR-09.T01',
		'The root, “Pedestrian Bridge Structural Review”,',
		'G3-RR-09',
		'09',
		'completeness is inferred from the connected types’ existence',
		'the account’s whole-PWA completeness claim is shown beside its children’s outputs and the unproduced check certificate'
	),
	clean('G7-CLEAN.T01', 'The root, “Realization”', 'G7-CLEAN'),
	clean('G7-CLEAN.T02', '“Implementation”', 'G7-CLEAN'),
	clean('G7-CLEAN.T03', '“Verification”', 'G7-CLEAN'),
	catcher(
		'G7-RR-04.T03',
		'“Verification”',
		'G7-RR-04',
		'04',
		'the verification prompt reports unrun tests as passing',
		'its full prompt text is in its subject, where a root’s skeleton of it omits that text'
	),
	catcher(
		'G7-RR-02.T02',
		'“Implementation”',
		'G7-RR-02',
		'02',
		'the implementation’s Test Adequacy assignment is removed',
		'the request and its complete policy-id list expose the missing required assignment'
	),
	catcher(
		'G7-RR-03-CHILD.T01',
		'The root, “Realization”,',
		'G7-RR-03-CHILD',
		'03',
		'the required verification is made conditional',
		'the optional rule is part of the root’s own decomposition: its subject carries its child rules, and its review judges whether its children, with their cardinalities, discharge its purpose'
	),
	catcher(
		'G7-RR-03-PROMPT.T02',
		'“Implementation”',
		'G7-RR-03-PROMPT',
		'03',
		'the implementation prompt drops the required failure paths',
		'its purpose and its full prompt text show the narrowing together'
	),
	catcher(
		'G7-RR-08.T02',
		'“Implementation”',
		'G7-RR-08',
		'08',
		'the account invents an Assumption Disclosure assignment',
		'its policy-id list and the account’s claim about this type expose the contradiction'
	),
	cleanG8('G8-CLEAN.T01', 'The root, “Realization”'),
	cleanG8('G8-CLEAN.T02', '“Implementation”'),
	cleanG8('G8-CLEAN.T03', '“Tool Build”'),
	cleanG8('G8-CLEAN.T04', '“Unit Tests”'),
	cleanG8('G8-CLEAN.T05', '“Verification”'),
	cleanG8('G8-CLEAN.T06', '“Verification Preparation”'),
	cleanG8('G8-CLEAN.T07', '“End-to-End Verification”'),
	catcher(
		'G8-RR-02.T05',
		'“Verification”',
		'G8-RR-02',
		'02',
		'End-to-End Verification is omitted from Verification’s decomposition and its wiring',
		'its purpose, prompt and output contract require running the built tool end to end, and its one child prepares inputs and claims no run, so the work its purpose requires is silently dropped; the root is shown its skeleton without its children’s names and purposes, and only this part sees the purpose and the incomplete child set together'
	)
];

/** The 41 non-graph cases version eight carries: every case of version seven but its graph cases, whose ids begin `G`. */
const CARRIED_ORACLES = ORACLES_V7.oracles.filter((o) => !o.caseId.startsWith('G'));

export const ORACLES_V8: OracleSet = {
	note:
		'GENERATED by `bun run scripts/reviewer-qual/generate.ts` from scripts/reviewer-qual/oracles-v8.ts — never ' +
		'hand-edited. Oracles for reviewer-qualification case set version eight (JAN-EXEC Phase 7, the review in parts, B7; ' +
		'REG-D-125, REG-D-126): version seven’s oracles for its 41 non-graph cases unchanged, and one for each of the 35 PWA_TYPE ' +
		'part cases. `faulted` lists the criteria a case REQUIRES faulted; an empty list on a clean case means any fault fails ' +
		'clean acceptance. A part case’s `disposition` is its own Reasoning Review disposition; for a declared case, the declared ' +
		'policy’s verdict as the sign-off computes it (dispositionFromFindings over the policy’s own criteria); the pass bar is ' +
		'that disposition (REG-D-080).',
	oracleVersion: 8,
	caseSetVersion: 8,
	conferral:
		`The 41 non-graph cases’ oracles are version seven’s, carried with every standing unchanged: ${ORACLES_V6.conferral} ` +
		'The 35 part-case oracles were conferred by the sponsor (REG-D-126). The 27 of Q30: asked “Do you confer the 27 ' +
		'expected answers for the parts qualification: the 13 clean parts SATISFIED (carried from the clean PWAs you already ' +
		'conferred) and the 14 planted cases in the table, each REJECTED on its criterion at the part named?”, the sponsor chose ' +
		'“Confer all 27 (Recommended)” — the 13 clean parts SATISFIED with nothing faulted, each carrying its source oracle’s ' +
		'standing, and the 14 catchers REJECTED on the criterion named at the part named, G7-RR-03-CHILD’s at the root, ' +
		'Realization. The eight of Q31, the 3-level pair: asked “No qualification case has a type with children below the root, ' +
		'but 4 of the 5 such types in run-11\'s PWA are exactly that (its phases). Add one 3-level case pair?”, the sponsor chose ' +
		'“Add the 3-level pair (Recommended)”, whose text read “One clean 3-level PWA, every part expected SATISFIED, and a twin ' +
		'in which one middle phase\'s children leave out work that phase\'s own purpose requires, expected REJECTED on RR-02 at ' +
		'that phase\'s review. Choosing this confirms those expected verdicts. About 14 more calls (qualification about 70).” — ' +
		'G8-CLEAN’s seven parts SATISFIED and G8-RR-02’s Verification REJECTED, faulting RR-02, as described. Each of the 14 ' +
		'catchers’ standing, the author’s claim, is the lead’s designation. The 3-level pair’s standings were not on the ' +
		'sponsor’s screen: Q31 showed none, and each of its eight, the author’s claim, is the builder’s proposal, carried as ' +
		'proposed, as REG-D-124’s record carries the six graph oracles’. A change to a plant, a verdict, a criterion or a ' +
		'catcher goes back to the sponsor.',
	oracles: [...CARRIED_ORACLES, ...PART_ORACLES_V8]
};
