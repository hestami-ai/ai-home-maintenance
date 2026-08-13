// REG-F-087 — how much of the ratified arrow surface the census sees. **178 of 304 (59%) as of 2026-08-13.**
//
// ⚠ THE NUMBER IS NOT A PROGRESS BAR, AND WRITING IT AS ONE IS WHAT KEPT THIS HEADER STALE. It read "164 of 304
// (54%)" through two increments that moved it, because a reader updating the PIN below has no reason to think a
// sentence at the top of the file is also a measurement. It is, and it now says what the count MEANS rather than
// only what it is:
//
//   115 (38%)  the census read two idioms — `advanceStatus` and the STEP_COMMAND_SPECS table
//   164 (54%)  REG-F-114: PWU lifecycle commands declared their arrows (+49, all PERIPHERAL — abandon,
//              supersede, block, challenge)
//   170 (56%)  REG-F-117: `advanceIntent` sites were ALREADY declaring their sources; only the machine was
//              unrecoverable, so this was a reader gap, not a declaration gap (+6)
//   178 (59%)  REG-F-119: the generic setter's SPINE — READY -> PLANNED -> ... -> RECOMPOSED (+8), which took
//              `PWU.workLifecycleState` to 57/57 and made it the first PWU axis that can be occupancy-analysed
//
// ⚠ AND 59% IS NOT "59% CORRECT". The remaining 126 are missing for two reasons that must never be conflated:
// commands whose idiom the census cannot read, and arrows NO command performs at all. Only the second is a
// coverage gap in the product; the first is a gap in this instrument.
//
// ⚠ THIS PIN DID ITS JOB, WHICH IS WORTH RECORDING BECAUSE PINS USUALLY ONLY ANNOY. It was written to redden
// the moment coverage moved in either direction, and it reddened on exactly the +49 the design predicted —
// 115 -> 164, 14 -> 15 machines, `PWU.workLifecycleState` leaving the blind set. The numbers here are
// MEASURED FROM THE RUN, never written first and then made true: REG-F-114's whole subject is a census that
// could have been made to agree with itself.
//
// ⚠ THE CONTROL THIS REPLACES COULD NOT FAIL. `arrow-command-census.ts:283` reads
// `if (sites === 0) fail('extractor', 'found no advanceStatus call sites at all — it is broken')`. That detects
// TOTAL extractor death and nothing else. With 115 sites found it passes comfortably while 189 ratified arrows
// go unseen — the exact `a control that cannot fail` shape this repository has already retired three times: the
// check exists, is green, and is blind to every partial failure, which is the failure that actually happens.
//
// THE CAUSE. The handler surface uses at least FOUR transition idioms and the census reads two: `advanceStatus`
// (AST identifier match) and the `STEP_COMMAND_SPECS` data table — which the census itself calls "THE SECOND
// IDIOM, AND IT IS DATA", so this problem was met once and solved for that instance. It does NOT read
// `advanceIntent` (intent.ts) or `advancePwuLifecycle`/`commitState` (pwu.ts). `pwu.ts` contains ZERO
// `advanceStatus` calls; its three textual occurrences are all inside comments.
//
// WHAT THIS FILE DOES. It pins the coverage RATIO and the blind set, both derived at runtime. Fixing an idiom
// makes coverage jump and reddens these pins, forcing REG-F-087 to be revisited in the same commit. Adding a
// handler that uses an unread idiom makes coverage drop and reddens them too. Neither can happen quietly.
import { STATE_MACHINES } from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';
import { declaredArrows } from './arrow-command-census.js';
import { auditClaims, bindingClaims, vocabDriveClaims } from './binding-row-truth.js';

type Arrow = { machine: string };
type Machine = { transitions: readonly unknown[] };

const MACHINES = STATE_MACHINES as unknown as Record<string, Machine>;
const seenMachines = () => new Set(([...declaredArrows()] as Arrow[]).map((a) => a.machine));

describe('REG-F-087 — how much of the ratified arrow surface the census actually sees', () => {
	it('PINNED — 178 of 304 ratified arrows, across 16 of 27 machines', () => {
		const declared = Object.keys(MACHINES);
		const ratifiedArrows = declared.reduce((n, m) => n + MACHINES[m]!.transitions.length, 0);
		expect(
			{
				machinesDeclared: declared.length,
				machinesSeen: seenMachines().size,
				arrowsRatified: ratifiedArrows,
				arrowsSeen: [...declaredArrows()].length
			},
			'if coverage MOVED, an idiom was fixed or a new unread one was introduced — either way REG-F-087 ' +
				'and every conclusion drawn from this census need re-reading, so update them with this pin'
		).toEqual({ machinesDeclared: 27, machinesSeen: 16, arrowsRatified: 304, arrowsSeen: 178 });
	});

	// Two causes live in this list and MUST NOT be conflated, which is why it is pinned by name and not by count:
	//   (a) nothing performs them at all — harness.ts and obligation-constraint.ts contain zero transition calls
	//       of ANY idiom, so Harness/Obligation/Constraint are a genuine coverage gap, not a census defect;
	//   (b) commands exist and the census cannot read them — the three remaining PWU axes.
	//
	// ⚠ THE (b) HALF SHRANK TWICE AND THE COMMENT LAGGED BOTH TIMES, which is the records defect this programme
	// keeps finding in its own notes. It read "the four PWU axes and Intent.intentStatus" while the list below
	// already held THREE PWU axes — `PWU.workLifecycleState` left when REG-F-114 gave the lifecycle commands a
	// declared source set, and the prose was never re-read. `Intent.intentStatus` leaves here (REG-F-117), and
	// this note is corrected in the same commit rather than left for a third reader. **A count in prose beside a
	// list that is pinned by name is a count nothing checks.**
	it('PINNED — exactly which machines the census is blind to', () => {
		const seen = seenMachines();
		expect(
			Object.keys(MACHINES)
				.filter((m) => !seen.has(m))
				.sort()
		).toEqual([
			'AggregateAssuranceDisposition',
			'AssuranceAssessment.disposition',
			'AssuranceObservation.disposition',
			'Constraint.status',
			'Harness.status',
			'Obligation.status',
			'PWU.assuranceState',
			'PWU.executionState',
			'PWU.shapeIntegrityState',
			'PwuType.status',
			'Undertaking.status'
		]);
	});

	// ── CONTROL: THE TWO THIRTEENS ARE DIFFERENT SETS ────────────────────────────────────────────────────────
	// ⚠ A COINCIDENCE THAT IS A TRAP. The census-blind set and C-0c's `unanalysed` set BOTH number 13, and they
	// are NOT the same 13 — only 8 members overlap. "The 13 blind machines" is therefore an ambiguous phrase that
	// reads as one fact and is two. Asserted so the equivocation cannot be made silently, and so that a future
	// change collapsing one set into the other has to say so out loud.
	// ⚠ THIS ASSERTS A RELATIONSHIP, NOT THE SIZES — and it was rewritten to do so after a mutant caught it.
	// Written first as `size === 13 && size === 13 && overlap === 8`, it reddened alongside BOTH pins above when a
	// mutant made one blind machine visible: it restated their fact instead of adding one. That is reddening with
	// the herd, and it is the second control demoted for it today. Stated relationally, it now has its own failure
	// mode — it fires only if the two sets become equal or one swallows the other, and survives coverage merely
	// moving, which is precisely the event the pins above are for.
	it('CONTROL — census-blindness and C-0c-unanalysability are different failures, whatever their counts', () => {
		const censusBlind = new Set(Object.keys(MACHINES).filter((m) => !seenMachines().has(m)));
		const unanalysable = new Set(auditClaims([...bindingClaims(), ...vocabDriveClaims()]).unanalysed);

		expect(censusBlind.size, 'a control comparing two empty sets proves nothing').toBeGreaterThan(0);
		expect(unanalysable.size, 'a control comparing two empty sets proves nothing').toBeGreaterThan(0);
		// Both directions, so neither can quietly become a subset of the other.
		expect(
			[...censusBlind].filter((m) => !unanalysable.has(m)),
			'census-blind became a subset of unanalysed — the two failures have merged; say so in REG-F-087 ' +
				'rather than letting one control start standing in for the other'
		).not.toEqual([]);
		expect(
			[...unanalysable].filter((m) => !censusBlind.has(m)),
			'unanalysed became a subset of census-blind — same warning in the other direction'
		).not.toEqual([]);
	}, 15_000);
});
