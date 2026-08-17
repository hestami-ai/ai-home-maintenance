// REG-F-087 — how much of the ratified arrow surface the census sees.
// **~~156 of 304 ratified arrows COVERED (51%), from 178 declaration rows, as of 2026-08-13~~ ~~→ 162 of 304 (53.3%), from 180 declaration rows, re-derived 2026-08-14 (REG-F-145)~~ → **162 of 295 (54.9%)**, from 180 declaration rows — REG-F-160 removed 9 arrows belonging to an EXCLUDED machine from the denominator. The numerator did NOT move: zero declared arrows name an excluded machine.**
// ⚠ AND THE DENOMINATOR IS THE HALF NOBODY AUDITED. REG-F-121 (the correction struck above) fixed the NUMERATOR of this exact fraction — rows vs distinct-ratified — and left `304` unexamined for as long again. **Correcting a number is not auditing what it measures.**
// ⚠ THREE COPIES OF THIS FIGURE ROTTED TOGETHER while the `toEqual` forty lines below stayed correct —
// header, the "51% IS NOT 51% CORRECT" paragraph, and the TEST TITLE. The title has been emptied rather
// than synced: it restated the assertion and carried no argument, so the second copy is gone instead of
// corrected. The two paragraphs keep their numbers because the numbers ARE their argument — which is the
// distinction REG-F-141 drew between GATING a prose count and SOFTENING one.
//
// ⚠⚠ THE PERCENTAGE WAS WRONG FOR THIS CENSUS'S ENTIRE LIFE, AND I REWROTE THIS HEADER ONE COMMIT BEFORE
// NOTICING (REG-F-121). Every published figure — 38%, 54%, 56%, 59% — divided DECLARATION ROWS by RATIFIED
// ARROWS. Those are different populations:
//
//     declaration ROWS            178   one per (site, source, target); a legitimate arrow declared by two
//                                       commands counts TWICE (Skip and Prune both reach SKIPPED)
//     DISTINCT arrows declared    175
//     ...of those, RATIFIED       156   the only honest numerator for "of 304"
//     declared but NOT ratified    19   commands declaring transitions the corpus does not have
//
// The inflation is INHERITED, not introduced by the increments that moved the number, and its DIRECTION was
// always right — each increment really did add covered arrows. But it was quoted as a coverage percentage in
// five register entries, so the correction is stated loudly rather than back-filled.
//
// What each increment actually bought, in covered arrows:
//   REG-F-114  PWU lifecycle commands declared their arrows — all PERIPHERAL (abandon, supersede, block, challenge)
//   REG-F-117  `advanceIntent` was ALREADY declaring its sources; only the machine was unrecoverable, so this was
//              a READER gap, not a declaration gap
//   REG-F-119  the generic setter's SPINE — READY -> PLANNED -> ... -> RECOMPOSED (+8), taking
//              `PWU.workLifecycleState` to 57/57, the first PWU axis that can be occupancy-analysed
//
// ⚠ AND 53.3% IS NOT "53.3% CORRECT". The remaining 142 are missing for two reasons never to be conflated:
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
import { STATE_MACHINES, isExcludedMachine } from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';
import { declaredArrows, unratifiedDeclarations } from './arrow-command-census.js';
import { auditClaims, bindingClaims, vocabDriveClaims } from './binding-row-truth.js';

type Arrow = { machine: string };
type Machine = { transitions: readonly unknown[] };

const MACHINES = STATE_MACHINES as unknown as Record<string, Machine>;
const seenMachines = () => new Set(([...declaredArrows()] as Arrow[]).map((a) => a.machine));

/**
 * THE POPULATION, AND UNTIL REG-F-160 THIS FILE WAS THE ONLY INSTRUMENT THAT DID NOT ASK FOR IT.
 *
 * `isExcludedMachine` is applied by C-0 (`arrow-command-census.ts:944, :955`), C-0b
 * (`guard-enforcement-ledger.ts:83`) and `binding-row-truth.ts:249`. This file took `Object.keys(MACHINES)` raw
 * at three sites — so four instruments over one table, and the fourth kept its own idea of the table.
 *
 * ⚠ `machine-exclusions.ts` EXISTS TO PREVENT EXACTLY THIS AND SAYS SO IN ITS OWN HEADER: *"a private exclusion
 * list means the two controls disagree about what the population even is: one reports nine arrows as uncovered
 * while the other has already ruled the whole machine out of scope. Two censuses over one table must not each
 * keep their own idea of the table."* The fix reached three instruments and not the fourth — and **the "nine
 * arrows" in that sentence are literally the nine this file was still counting**.
 *
 * ⚠ AND THE CONSEQUENCE LANDED ON THE DENOMINATOR OF THE FRACTION THIS FILE EXISTS TO REPORT. `arrowsRatified`
 * was 304, of which 9 belong to `AssuranceAssessment.disposition` — a machine over a field the ratified object
 * schema DOES NOT HAVE (`z.strictObject`; `commitState` validates the produced state against it), so those 9
 * can never be covered by anything, ever. They sat permanently in the denominator: 162/304 = 53.3% where the
 * honest figure is 162/295 = 54.9%.
 *
 * ⚠⚠ AND REG-F-121 AUDITED THE OTHER HALF OF THIS EXACT FRACTION AND STOPPED. Its correction — rows vs distinct
 * ratified, quoted at the top of this file — fixed the NUMERATOR and left the denominator unexamined for as
 * long again. **Correcting a number is not auditing what it measures**, and both halves of one fraction have
 * now been wrong, separately, for different reasons.
 */
const inScopeMachines = () => Object.keys(MACHINES).filter((m) => !isExcludedMachine(m));

describe('REG-F-087 — how much of the ratified arrow surface the census actually sees', () => {
	// ⚠⚠ `arrowsSeen` COUNTED DECLARATION ROWS AND WAS DIVIDED BY RATIFIED ARROWS — two different populations,
	// reported as a percentage (REG-F-121). Every coverage figure this census has ever produced was inflated:
	//
	//     declaration ROWS            178   <- what the old single field counted
	//     DISTINCT arrows declared    175   <- three arrows are declared by TWO sites each, legitimately
	//     ...of those, RATIFIED       156   <- the only honest numerator for "of 304"
	//     declared but NOT ratified    19   <- a separate finding, named below
	//
	// So "178 of 304 = 59%" was really 156 of 304 = **51%**. The inflation is INHERITED, not introduced by the
	// increments that moved it — the gap existed at 170 rows too — but it was quoted in five register entries as
	// a coverage percentage, which is why the correction is loud rather than a quiet re-pin.
	//
	// BOTH numbers are pinned, because they answer different questions and conflating them is the defect:
	// `declarationRows` is about the READER (did an idiom stop being read?), `ratifiedArrowsCovered` is about the
	// PRODUCT (how much of the ratified surface can any command perform?). A change to one and not the other is
	// itself information.
	it('PINNED — the coverage figures are the toEqual below; a title restating them is a second copy', () => {
		const declared = inScopeMachines();
		const ratifiedArrows = declared.reduce((n, m) => n + MACHINES[m]!.transitions.length, 0);
		const ratifiedKeys = new Set(
			declared.flatMap((m) =>
				(MACHINES[m]!.transitions as readonly { from: string; to: string }[]).map(
					(t) => `${m}  ${t.from} -> ${t.to}`
				)
			)
		);
		const distinct = new Set(
			([...declaredArrows()] as { machine: string; from: string; to: string }[]).map(
				(a) => `${a.machine}  ${a.from} -> ${a.to}`
			)
		);
		expect(
			{
				machinesDeclared: declared.length,
				machinesSeen: seenMachines().size,
				arrowsRatified: ratifiedArrows,
				declarationRows: [...declaredArrows()].length,
				distinctArrowsDeclared: distinct.size,
				ratifiedArrowsCovered: [...distinct].filter((a) => ratifiedKeys.has(a)).length
			},
			'if coverage MOVED, an idiom was fixed or a new unread one was introduced — either way REG-F-087 ' +
				'and every conclusion drawn from this census need re-reading, so update them with this pin'
		).toEqual({
			// ⚠ 27 -> 25 and 304 -> 295 AT REG-F-160, AND THIS IS THE POPULATION BEING CORRECTED, NOT COVERAGE
			// IMPROVING. Two keys `machine-exclusions.ts` had already ruled not-machines were still being
			// counted here — `AggregateAssuranceDisposition` (0 arrows) and `AssuranceAssessment.disposition`
			// (9 arrows on a field the ratified schema does not have). MEASURED: the numerator did NOT move,
			// because ZERO declared arrows name an excluded machine, and the two lines below are the control
			// on exactly that. A reader seeing the percentage rise must read it as a denominator repaired.
			machinesDeclared: 25,
			machinesSeen: 16,
			arrowsRatified: 299,
			// ⚠ 178 -> 174 and 175 -> 171 AT REG-F-124, AND THE DROP IS THE INSTRUMENT CEASING TO FABRICATE.
			// `validator-registry.ts`'s `statusChange` factory is called four times declaring FIVE arrows between
			// them; the census resolved its `target` and `from` parameters INDEPENDENTLY, flattened each into a
			// set, and crossed them — reading NINE. The four extra were manufactured by the reader, not claimed
			// by any command. A reader seeing this number fall must not read it as lost coverage: the line below
			// is the control on exactly that, and it did not move.
			// ⚠ 174 -> 180 and 171 -> 177 AT REG-F-131, AND THIS RISE IS COVERAGE ADDED, not fabrication returning.
			// `SupersedeIntent` declares the machine's six ratified in-arrows to SUPERSEDED, so Intent.intentStatus
			// goes 6/15 -> 12/15 — the honest ceiling, because the three WITHDRAWN arrows have no ratified event and
			// are deliberately left uncovered.
			declarationRows: 184,
			distinctArrowsDeclared: 181,
			// ⚠ UNMOVED AT 156 ACROSS BOTH REG-F-122 AND REG-F-124, which is the point of pinning it SEPARATELY
			// (REG-F-121). Two fabrication defects have now been removed from this instrument and neither cost a
			// single ratified arrow — because a fabricated arrow was, by construction, one no machine ratified.
			// If a future fabrication-removal moves THIS number, it removed truth as well and is not the same act.
			// ⚠ 156 -> 162, AND THIS IS THE FIRST TIME THIS NUMBER HAS MOVED SINCE IT WAS SPLIT OUT. REG-F-124's
			// note beside it said that if a fabrication-removal ever moved it, that removal took truth with it.
			// This movement is the OTHER direction and the other cause: six arrows a command can now really
			// perform. The invariant it guards is intact — removals must not move it; additions must.
			ratifiedArrowsCovered: 166
		});
	});

	// ── THE POPULATION NO MACHINE RATIFIES — PINNED BY NAME, AND SPLIT (REG-F-121 → REG-F-124 → REG-F-128) ───
	//
	// This began as ONE COUNT, pinned so the question would stay visible. Two findings later it is two lists, and
	// each step was forced by the previous one being unable to say something true:
	//
	//   REG-F-121 pinned 19 and asked "are the declarations wrong, or the machines incomplete?"
	//   REG-F-124 proved that question has NO answer for 4 of its own 19 — the census had MINTED them, so the
	//              declarations were right, the machines were right, and the READER was wrong. 19 → 15.
	//   REG-F-128 (here) splits the remaining 15, because they are two populations with two different remedies
	//              and a single number cannot say which one moved.
	//
	// ⚠ BY NAME, NOT BY COUNT — REG-F-121's own rule, restated because it is what makes these lists honest:
	// `toBe(15)` goes GREEN when someone DELETES an arrow. The number improves by destroying the evidence.
	it('PINNED — the 10 declared pairs the machine structurally REFUSES (over-claims)', () => {
		// `checkTransition` admits LEGAL or NOOP; unratified ⇒ not LEGAL; from ≠ to ⇒ not NOOP. So NOTHING can
		// perform these, and the rectangle idiom that declares them over-claims a capability it does not have.
		// Left as-is DELIBERATELY: `recordClaimAssessment` declines to correlate its targets with its sources so
		// that the machine stays the single authority on which pairs are legal, and duplicating that table at the
		// site is the drift REG-F-119 measured the cost of. Honest imprecision, bounded and named.
		expect(unratifiedDeclarations().overClaimed).toEqual([
			'Claim.status  CONDITIONALLY_SUPPORTED -> REJECTED',
			'Claim.status  CONDITIONALLY_SUPPORTED -> SUPPORTED',
			'Claim.status  CONDITIONALLY_SUPPORTED -> UNDER_ASSESSMENT',
			'Claim.status  CONTESTED -> SUPPORTED',
			'Claim.status  CONTESTED -> UNDER_ASSESSMENT',
			'Claim.status  OPEN -> CONTESTED',
			'Claim.status  OPEN -> REJECTED',
			'Claim.status  OPEN -> SUPPORTED',
			'Claim.status  SUPPORTED -> REJECTED',
			'Claim.status  SUPPORTED -> UNDER_ASSESSMENT'
		]);
	});

	// ⚠ "MACHINE-ADMITTED" IS NOT "PERFORMABLE", and REG-F-127 proved the difference matters rather than being a
	// pedantic caveat. These five are the ones `checkTransition` WOULD admit as NOOPs — what happens next is the
	// SITE's business, and it has gone both ways:
	//   · the three `Claim.status` edges were DEFECTS — a second identical assessment appended a duplicate event
	//     (AX-7) — and are now refused by a precondition, while remaining DECLARED here;
	//   · `ExecutionPlan ACTIVE -> ACTIVE` is a deliberate HOLD (JAN-CMDPRE DWP-05);
	//   · `RuntimeBinding PARTIALLY -> PARTIALLY` is N-22's incremental multi-party grant, driven green.
	// The same shape, a defect on one machine and correct on another — which is exactly why this list classifies
	// and does not judge, and why a blanket rule over it was refused.
	it('PINNED — the 5 self-edges the machine would admit as NOOPs', () => {
		expect(unratifiedDeclarations().machineAdmittedSelfEdges).toEqual([
			'Claim.status  CONTESTED -> CONTESTED',
			'Claim.status  SUPPORTED -> SUPPORTED',
			'Claim.status  UNDER_ASSESSMENT -> UNDER_ASSESSMENT',
			'ExecutionPlan.status  ACTIVE -> ACTIVE',
			'RuntimeBinding.authorizationStatus  PARTIALLY_AUTHORIZED -> PARTIALLY_AUTHORIZED'
		]);
	});

	// CONTROL — the two pins above are equally satisfied by a classifier that puts EVERYTHING in one bucket and
	// happens to match today's lists. This holds the discrimination itself: no `from !== to` pair may be called a
	// self-edge, and no self-edge may be called an over-claim. Without it, collapsing the split back into one
	// list passes.
	it('CONTROL — the split discriminates, and the two lists are disjoint and complete', () => {
		const { overClaimed, machineAdmittedSelfEdges } = unratifiedDeclarations();
		for (const k of machineAdmittedSelfEdges) {
			const [from, to] = (k.split('  ')[1] ?? '').split(' -> ');
			expect(from, `${k} is in the SELF-EDGE list but is not a self-edge`).toBe(to);
		}
		for (const k of overClaimed) {
			const [from, to] = (k.split('  ')[1] ?? '').split(' -> ');
			expect(from === to, `${k} is a self-edge but is in the OVER-CLAIM list`).toBe(false);
		}
		expect(
			new Set([...overClaimed, ...machineAdmittedSelfEdges]).size,
			'the two lists must be disjoint — an arrow in both would be counted twice'
		).toBe(overClaimed.length + machineAdmittedSelfEdges.length);
	});

	// ⚠⚠ THIS SAID ~~"TWO causes live in this list"~~ AND THERE ARE THREE — corrected at REG-F-160, where all
	// eleven were classified for the first time and the third category turned out to be the two members the
	// dichotomy could not express AT ALL. Every limb below is DERIVED, and the derivation is named, because a
	// hand-list is the defect one level up (REG-F-124):
	//
	//   (a) NOTHING PERFORMS THEM — a genuine coverage gap, not a census defect. SIX machines, each established
	//       by the WRITE FUNNEL rather than by grep: `Harness.status` (harness.ts has exactly ONE commit site,
	//       the `createObject` birth at :34), `Obligation.status` / `Constraint.status` /
	//       `AssuranceObservation.disposition` (REG-F-156's birth-only derivation), and — NEW at REG-F-160 —
	//       `PwuType.status` (2 arrows) and `Undertaking.status` (3 arrows).
	//   (b) COMMANDS EXIST AND THE CENSUS CANNOT READ THEM — the three PWU sub-axes, 42 arrows, driven through
	//       `changePwuState`'s `subAxisChecks` tuple (REG-F-155/157). Their declaration is REFUSED, and not for
	//       an occupancy reason: REG-F-159 measured 0 of 42 dead and refused them because the 42 is three
	//       populations on a command W-7 retires.
	//   (c) EXCLUDED BY NAME — NEITHER A COVERAGE GAP NOR A CENSUS DEFECT, and the category this comment did not
	//       have. `AggregateAssuranceDisposition` and `AssuranceAssessment.disposition` are in
	//       `NOT_STATE_MACHINES` with a citation each. They are no longer in this list because `inScopeMachines`
	//       now asks — but they do NOT vanish: the pin below names them, for the reason C-0 pins `unanalysed`.
	//
	// ⚠ THE POSITIVE CONTROL FOR (a) IS INTERNAL AND EXACT, which is what makes it a finding rather than a
	// failed search. `PwuType.status` and `Undertaking.status` are BORN in `pwa-authoring.ts`, and every
	// `machine:` in that whole file is either one of three `births:` declarations or `PWA_MACHINE` at five
	// `advanceStatus` sites. `PWA.publicationStatus` is meanwhile one of only FIVE machines in the repository
	// with COMPLETE arrow coverage. **The census reads that file perfectly; nothing in it advances those two.**
	// Same file, same idiom, different answer — so (a) here is measured, not merely unfound.
	//
	// ⚠ THE (b) HALF SHRANK TWICE AND THE COMMENT LAGGED BOTH TIMES, which is the records defect this programme
	// keeps finding in its own notes. It read "the four PWU axes and Intent.intentStatus" while the list below
	// already held THREE PWU axes — `PWU.workLifecycleState` left when REG-F-114 gave the lifecycle commands a
	// declared source set, and the prose was never re-read. `Intent.intentStatus` leaves here (REG-F-117), and
	// this note is corrected in the same commit rather than left for a third reader. **A count in prose beside a
	// list that is pinned by name is a count nothing checks.**
	it('PINNED — exactly which machines the census is blind to', () => {
		const seen = seenMachines();
		expect(inScopeMachines().filter((m) => !seen.has(m)).sort()).toEqual([
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

	// ── CONTROL: CENSUS-BLINDNESS AND C-0c-UNANALYSABILITY ARE DIFFERENT SETS ────────────────────────────────
	// ⚠ ~~A COINCIDENCE THAT IS A TRAP. The census-blind set and C-0c's `unanalysed` set BOTH number 13, and
	// they are NOT the same 13 — only 8 members overlap.~~ THE COINCIDENCE HAS SINCE EVAPORATED (re-derived
	// 2026-08-14, REG-F-145): ~~blind = 11~~ **blind = 9 (REG-F-160 — two were EXCLUDED machines this file was still counting)**, unanalysed = 17, overlap = 6. **The equivocation it warned about is
	// therefore no longer AVAILABLE — nobody can now say "the 13 blind machines" and mean either set.**
	// ⚠ AND THE CONTROL BELOW NEEDED NO CHANGE, which is the part worth keeping. An earlier pass had already
	// rewritten it from `size === 13 && size === 13 && overlap === 8` to a RELATIONAL form, after a mutant
	// caught it reddening with the herd. So when the numbers moved, the assertions did not care: both subset
	// checks still hold (~~blind∖unanalysed = 5~~ **3 at REG-F-160**, unanalysed∖blind = 11). **A control stated relationally survives
	// the world moving under it; the prose above it did not.** Kept so a future change collapsing one set into
	// the other still has to say so out loud.
	// ⚠ THIS ASSERTS A RELATIONSHIP, NOT THE SIZES — and it was rewritten to do so after a mutant caught it.
	// Written first as `size === 13 && size === 13 && overlap === 8`, it reddened alongside BOTH pins above when a
	// mutant made one blind machine visible: it restated their fact instead of adding one. That is reddening with
	// the herd, and it is the second control demoted for it today. Stated relationally, it now has its own failure
	// mode — it fires only if the two sets become equal or one swallows the other, and survives coverage merely
	// moving, which is precisely the event the pins above are for.
	// ── REG-F-160: THE EXCLUDED SET IS AN OUTPUT, NOT A SILENT FILTER ───────────────────────────────────────
	//
	// Applying `isExcludedMachine` above removes two machines from a list that was pinned BY NAME. A filter with
	// no pin behind it is the census narrowing its own population — this repository's oldest recorded defect —
	// so the removed members are asserted here instead of disappearing. C-0 sets the precedent verbatim for
	// `unanalysed`: *"Silently skipping them would be the census narrowing its own population, so `unanalysed`
	// is an output the test pins."*
	//
	// ⚠ AND THIS PIN'S REAL JOB IS THE OPPOSITE DIRECTION — EXCLUSION-LIST GROWTH. `machine-exclusions.ts` warns
	// that *"moving a real gap in here would be the allowlist rot this repository keeps recording"*, and the
	// move is CHEAP and FLATTERING: adding a machine with unbuilt arrows raises the coverage percentage and
	// shortens the blind list at the same time. Nothing anywhere checked that list's membership until now.
	//
	// PINNED WITH ARROW COUNTS, not just names, because the count is what the denominator loses: the honest
	// figure moved 162/304 (53.3%) to 162/295 (54.9%) and every one of those 9 belongs to ONE machine.
	it('PINNED — exactly which machines are EXCLUDED from the population, and what the denominator loses', () => {
		const excluded = Object.keys(MACHINES)
			.filter((m) => isExcludedMachine(m))
			.sort((a, b) => a.localeCompare(b))
			.map((m) => `${m} (${MACHINES[m]!.transitions.length} arrows)`);
		expect(
			excluded,
			'the exclusion list MOVED — if a machine was added, say why it is not-a-machine rather than an ' +
				'unbuilt one, because this is the change that buys coverage by shrinking the denominator'
		).toEqual([
			'AggregateAssuranceDisposition (0 arrows)',
			'AssuranceAssessment.disposition (9 arrows)'
		]);
	});

	// CONTROL — the pin above is equally satisfied by a filter that excludes NOTHING and a list that happens to
	// name two machines. This holds the discriminating half: the excluded machines must be ABSENT from the
	// blind list, which is the behaviour the whole increment exists to produce and which the pin above cannot see.
	it('CONTROL — an excluded machine is absent from the blind list, not merely named in the pin above', () => {
		const seen = seenMachines();
		const blind = new Set(inScopeMachines().filter((m) => !seen.has(m)));
		for (const m of Object.keys(MACHINES).filter((x) => isExcludedMachine(x))) {
			expect(seen.has(m), `${m} is excluded, so no command may declare an arrow on it`).toBe(false);
			expect(blind.has(m), `${m} is excluded and must not be reported as census-blind`).toBe(false);
		}
	});

	it('CONTROL — census-blindness and C-0c-unanalysability are different failures, whatever their counts', () => {
		const censusBlind = new Set(inScopeMachines().filter((m) => !seenMachines().has(m)));
		const unanalysable = new Set(
			auditClaims([...bindingClaims(), ...vocabDriveClaims()]).unanalysed
		);

		expect(censusBlind.size, 'a control comparing two empty sets proves nothing').toBeGreaterThan(
			0
		);
		expect(unanalysable.size, 'a control comparing two empty sets proves nothing').toBeGreaterThan(
			0
		);
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
	}, 45_000); // Test-harness headroom for full-repository coverage instrumentation; not a product ceiling.
});
