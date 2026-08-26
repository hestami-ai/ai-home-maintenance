// REG-F-084 — every PWU lifecycle event the fold handles must be EMITTED BY A TEST, not merely folded.
//
// ⚠ THIS CONTROL EXISTS BECAUSE THE OBVIOUS RULE WAS WRONG. W-1 added `PwuAbandoned`/`PwuRejected` as emitters and
// to nothing else. W-4.5 found it two increments later — by accident, because `BASELINED` happens to be in the
// reference undertaking — and derived the rule *"fold the event in the commit that mints it"*. W-5 obeyed that
// rule exactly, and a mutant still deleted BOTH of its fold cases with **1203 tests staying green**.
//
// The entries were dead code. `replay-equivalence.test.ts` walks the reference undertaking, and the reference
// undertaking never blocks and never escalates — so the fold is exercised only for the events the seed happens to
// emit. Co-location fixed the WRITING; it did not fix the BLINDNESS.
//
// THE CORRECTED RULE, which this file enforces: a fold entry is load-bearing only when SOME TEST EMITS THE EVENT.
// For each arrow owned by a semantic command, its event must be reachable either
//   (a) by the reference undertaking — DERIVED HERE by building it and reading the events it actually emits, so
//       no hand-maintained list can drift from what the seed does; or
//   (b) by an explicitly named test, whose file and title are checked to exist.
//
// A twelfth lifecycle command added without either fails this test ON ARRIVAL rather than two increments later.
import { PWU_SEMANTIC_LIFECYCLE_COMMANDS } from '@janumipwb/rph-application';
import { PWU_RECOVERY_COMMAND_SPECS } from '@janumipwb/rph-domain';
import { BINDINGS } from '@janumipwb/rph-contracts';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createEngine, driveReferenceUndertaking } from './index.js';

const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);

/**
 * Where each event NOT reachable from the reference undertaking is DRIVEN.
 *
 * ⚠ THE TITLES ARE ANCHORS, and they are checked to appear EXACTLY ONCE in the named file — the same mechanism
 * REG-F-081 added to C-0b after six of its enforcing sites rotted into doc comments in two days. A renamed test
 * reddens here instead of silently ceasing to prove anything.
 *
 * ⚠ AND THIS MAP IS CHECKED IN BOTH DIRECTIONS. An entry whose event the seed HAS since started emitting is a
 * failure too, not a harmless leftover — otherwise the map rots into an allowlist that outlives its reason.
 */
const EXPLICIT_DRIVE_SITES: Readonly<Record<string, { file: string; title: string }>> = {
	PwuAbandoned: {
		file: '../../rph-application/src/handlers/abandonment-authority.test.ts',
		title: 'ACCEPTS when an EFFECTIVE ABANDON decision names this PWU at its current semantic version'
	},
	PwuRejected: {
		file: '../../rph-application/src/handlers/rejection-authority.test.ts',
		title: 'ACCEPTS with an EFFECTIVE REJECTION decision AND a blocking observation about this PWU'
	},
	// The four REG-F-072 events. ⚠ THIS CONTROL FOUND ALL FOUR ON ITS FIRST RUN — they were folded in that
	// increment and no test asserted the fold, so the defect W-1 shipped was in fact SIX events wide, not two.
	PwuChallenged: { file: '../../rph-application/src/handlers/pwu.test.ts', title: 'ChallengePwu drives READY -> CHALLENGED' },
	PwuReshapingStarted: {
		file: '../../rph-application/src/handlers/pwu.test.ts',
		title: 'ReshapePwu drives UNDER_ASSURANCE -> RESHAPING'
	},
	PwuInvalidated: {
		file: '../../rph-application/src/handlers/pwu.test.ts',
		title: 'CONTROL: InvalidatePwu naming a real triggering object drives SATISFIED -> INVALIDATED'
	},
	PwuSuperseded: { file: '../../rph-application/src/handlers/pwu.test.ts', title: 'SupersedePwu moves a non-baselined PWU -> SUPERSEDED' },
	PwuBlocked: {
		file: '../../rph-application/src/handlers/block-escalate.test.ts',
		title: 'CONTROL — a BLOCKED PWU rebuilds from its own event stream'
	},
	PwuEscalated: {
		file: '../../rph-application/src/handlers/block-escalate.test.ts',
		title: 'CONTROL — an ESCALATED PWU rebuilds from its own event stream'
	},
	PwuUnblocked: {
		file: '../../rph-application/src/handlers/block-escalate.test.ts',
		title: 'CONTROL — an unblocked PWU rebuilds from its own event stream'
	},
	// REG-D-044 S-1b. ⚠ BOTH ARE DRIVEN BY THE SAME TEST, AND THAT IS NOT LAZINESS — the arrows are sequential
	// on one PWU (SATISFIED -> RECOMPOSING -> RECOMPOSED), so a single drive that asserts replay equivalence
	// after EACH hop is a stronger claim than two isolated ones: it catches a fold case that reads the right
	// field but carries the wrong axis forward. The seed cannot cover either — it never occupies either state.
	PwuRecompositionBegun: {
		file: '../../rph-application/src/handlers/pwu-recomposition.test.ts',
		title: 'CONTROL — a recomposed PWU rebuilds from its own event stream'
	},
	PwuRecomposed: {
		file: '../../rph-application/src/handlers/pwu-recomposition.test.ts',
		title: 'CONTROL — a recomposed PWU rebuilds from its own event stream'
	}
};

/**
 * The event each semantically-owned arrow emits, read from the ratified binding table rather than restated.
 *
 * ⚠⚠ THE POPULATION IS DRAWN FROM **TWO** TABLES SINCE W-5.5, AND DRAWING IT FROM ONE WAS ABOUT TO REPEAT THIS
 * FILE'S OWN DEFECT A THIRD TIME. This control's header promises that *"a twelfth lifecycle command added
 * without either fails this test ON ARRIVAL"* — but it enumerated commands by walking
 * `PWU_SEMANTIC_LIFECYCLE_COMMANDS`, which is keyed by TARGET and therefore cannot hold the recovery command:
 * its target is a function of its source, so it lives in `PWU_RECOVERY_COMMAND_SPECS` instead. `UnblockPwu`
 * would have been INVISIBLE here and `PwuUnblocked` would have shipped folded-but-undriven — exactly what W-1
 * shipped and W-5 shipped again. **The list did not rot; the DERIVATION stopped being total over commands**,
 * which is a failure a control deriving its own population cannot see by construction. Keyed by a LABEL rather
 * than a target now, because the recovery command has no single one.
 */
function ownedEvents(): Map<string, string> {
	const byCommand = new Map(BINDINGS.map((b) => [b.commandType, b.eventType]));
	const out = new Map<string, string>();
	const add = (label: string, commandType: string) => {
		const eventType = byCommand.get(commandType);
		expect(eventType, `no binding row gives ${commandType} an event`).toBeDefined();
		out.set(label, eventType!);
	};
	for (const [target, commandType] of Object.entries(PWU_SEMANTIC_LIFECYCLE_COMMANDS)) {
		add(target, commandType);
	}
	for (const spec of Object.values(PWU_RECOVERY_COMMAND_SPECS)) {
		add(spec.arrows.map((a) => `${a.from}->${a.to}`).join(' | '), spec.commandType);
	}
	return out;
}

/** Every event type the reference undertaking ACTUALLY emits — derived by driving it, never listed. */
function eventsEmittedBySeed(): Set<string> {
	let s = 0;
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: () => `evt_${++s}`
	}).as(DIR.credentialFor('owner-1'));
	driveReferenceUndertaking(engine);
	return new Set(engine.readAllEvents().map((e) => e.eventType));
}

describe('REG-F-084 — every owned PWU lifecycle event is emitted by some test', () => {
	it('each semantically-owned arrow is driven by the seed or by a named test that still exists', () => {
		const owned = ownedEvents();
		const seeded = eventsEmittedBySeed();
		const undriven: string[] = [];

		for (const [target, eventType] of owned) {
			if (seeded.has(eventType)) continue;
			const site = EXPLICIT_DRIVE_SITES[eventType];
			if (!site) {
				undriven.push(
					`${target} -> ${eventType}: not emitted by the reference undertaking and no explicit drive site named. ` +
						`Add a test that dispatches ${PWU_SEMANTIC_LIFECYCLE_COMMANDS[target as keyof typeof PWU_SEMANTIC_LIFECYCLE_COMMANDS]} ` +
						`and calls expectPwuReplayEquivalence, then name it here.`
				);
				continue;
			}
			const source = readFileSync(new URL(site.file, import.meta.url), 'utf8');
			const occurrences = source.split(site.title).length - 1;
			if (occurrences !== 1) {
				undriven.push(
					`${target} -> ${eventType}: its named drive site "${site.title}" appears ${occurrences} times in ` +
						`${site.file} — an anchor must resolve to exactly one test (REG-F-081).`
				);
			} else if (!source.includes('expectPwuReplayEquivalence')) {
				undriven.push(
					`${target} -> ${eventType}: ${site.file} names the test but never calls ` +
						`expectPwuReplayEquivalence, so emitting the event proves nothing about the fold.`
				);
			}
		}
		expect(undriven, undriven.join('\n')).toEqual([]);
	});

	// ── THE CONTROL'S OWN CONTROL ─────────────────────────────────────────────────────────────────────────────
	// A map that lists a site the seed already covers is not harmless — it is a row nobody will ever re-examine.
	// Asserted separately so that DELETING the bidirectional check reddens THIS test and not the one above.
	it('CONTROL — no explicit drive site is listed for an event the seed already emits', () => {
		const seeded = eventsEmittedBySeed();
		const redundant = Object.keys(EXPLICIT_DRIVE_SITES).filter((e) => seeded.has(e));
		expect(
			redundant,
			`the reference undertaking now emits ${redundant.join(', ')}; delete the explicit site(s) rather than ` +
				`leaving a row whose reason has expired`
		).toEqual([]);
	});

	// ⚠ NOT A REDUNDANT RESTATEMENT OF THE FIRST TEST. That one tolerates an event being seed-driven; this pins
	// the CURRENT split, so a change in what the seed reaches is surfaced as a deliberate edit rather than
	// absorbed silently. When the seed starts abandoning work, this reddens and the map above shrinks.
	it('pins WHICH owned arrows the reference undertaking leaves uncovered', () => {
		const owned = ownedEvents();
		const seeded = eventsEmittedBySeed();
		const uncovered = [...owned.values()].filter((e) => !seeded.has(e)).sort();
		expect(uncovered).toEqual([
			'PwuAbandoned',
			'PwuBlocked',
			'PwuChallenged',
			'PwuEscalated',
			'PwuInvalidated',
			// REG-D-044 S-1b. The §26 trace moves the CONTRACT to SATISFIED and goes straight to a Decision and a
			// Baseline — it never puts a PWU into RECOMPOSING at all. So these two are uncovered by the seed for a
			// stronger reason than the others: not "the seed happens not to", but "the ratified worked scenario
			// does not traverse these states".
			'PwuRecomposed',
			'PwuRecompositionBegun',
			'PwuRejected',
			'PwuReshapingStarted',
			'PwuSuperseded',
			// W-5.5. The seed never blocks, so it can never unblock either — the recovery event is uncovered by
			// the reference undertaking for the same structural reason PwuBlocked is, and is explicitly driven.
			'PwuUnblocked'
		]);
	});
});
