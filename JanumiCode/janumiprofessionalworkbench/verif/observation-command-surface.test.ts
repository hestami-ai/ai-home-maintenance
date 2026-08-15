// THE PREMISE UNDER REG-F-161's TWO DEAD BRANCHES, GATED INSTEAD OF REMEMBERED — REG-F-167.
//
// REG-F-161 recorded two permanently-dead READ branches, both starved by the same fact: `AssuranceObservation`
// is born with `disposition: 'OPEN'` and nothing ever changes it. Two consumers rest on that —
// `governance.ts`'s `waived: disposition === 'WAIVED'`, which makes RPH-BAS-003's waiver escape unreachable, and
// `floor-gate.ts`'s resolved-finding filter, whose `continue` never fires. Both were measured surviving as
// ledger CONTROLS, and both fail CLOSED.
//
// ⚠ BUT THE PREMISE WAS HELD BY DERIVATION AND BY TWO `expectSurvive` ENTRIES, AND NEITHER FIRES EARLY. A control
// reports at the END of a ~37-minute run, and only tells you the branch is still dead — it cannot tell you that
// someone is ABOUT to make it live. What actually invalidates REG-F-161 is a new COMMAND, and a command appears
// in the contract registry long before any branch changes behaviour.
//
// ── THE THIRD LIMB, AND IT IS THE STRONGEST ─────────────────────────────────────────────────────────────────
// REG-F-156 argued from the WRITE FUNNEL: `objectType: OBSERVATION` occurs at exactly one commit site. That is a
// claim about what the code currently writes. This is a claim about what the system CAN BE ASKED TO DO, which is
// strictly stronger for a negative: **a command that does not exist cannot be dispatched, whatever any handler
// contains.** The two limbs are independent — one could hold while the other broke — which is why this file adds
// the second rather than restating the first.
import { COMMANDS } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';

type CommandSpec = { readonly targetAggregateType?: string; readonly emitsEvent?: string };
const REGISTRY = COMMANDS as unknown as Record<string, CommandSpec>;

/** Case- and underscore-insensitive, because the registry is NOT consistent — see the census at the foot. */
const normalizeAggregate = (v: string): string => v.replaceAll('_', '').toLowerCase();

/** Every registered command whose TARGET is `aggregate` — derived from the registry, never listed. */
function commandsTargeting(aggregate: string): string[] {
	return Object.entries(REGISTRY)
		.filter(([, spec]) => spec.targetAggregateType === aggregate)
		.map(([name]) => name)
		.sort((a, b) => a.localeCompare(b));
}

describe('REG-F-167 — the observation aggregate has exactly ONE command, and it is the birth', () => {
	it('pins the command surface BY NAME, because a second one retires REG-F-161', () => {
		expect(
			commandsTargeting('ASSURANCE_OBSERVATION'),
			'the observation command surface MOVED. If a command that changes `disposition` now exists, then ' +
				'REG-F-161\'s two dead READ branches may be live: re-drive `governance.ts` waived flag (RPH-BAS-003\'s ' +
				'waiver escape) and `floor-gate.ts` resolved-finding filter, and RETIRE the two `expectSurvive` ledger ' +
				'entries deliberately rather than letting them flip to KILLED unexplained.'
		).toEqual(['RecordAssuranceObservation']);
	});

	it('and that one command is the CREATION, not an update', () => {
		expect(REGISTRY.RecordAssuranceObservation?.emitsEvent).toBe('AssuranceObservationRecorded');
	});

	// CONTROL — the pin above is satisfied by a reader that resolves ONE command and equally by one that resolves
	// nothing useful and happens to match a one-element list. This holds the discriminating half: an aggregate the
	// system genuinely drives must show SEVERAL commands, so the derivation is doing real work.
	//
	// ⚠ THIS CONTROL FIRED ON ITS FIRST RUN AND FOUND SOMETHING BIGGER THAN THE BUG IT WAS WATCHING FOR. Written
	// as `commandsTargeting('PWU')`, it returned ZERO — because the registry spells that aggregate
	// `PROFESSIONAL_WORK_UNIT` on four commands and `ProfessionalWorkUnit` on nine. See the census below; the
	// normaliser here exists so this control tests the READER rather than the spelling, which is a separate fact
	// with its own pin.
	it('CONTROL — the derivation discriminates: a genuinely driven aggregate shows MANY commands', () => {
		const pwu = Object.entries(REGISTRY)
			.filter(([, spec]) => normalizeAggregate(spec.targetAggregateType ?? '') === 'professionalworkunit')
			.map(([name]) => name);
		expect(pwu.length, `PWU commands: ${pwu.join(', ')}`).toBeGreaterThan(3);
		expect(pwu, 'the PWU creation must be among them').toContain('ProposePwu');
	});

	// CONTROL — scope. An aggregate no command targets must come back EMPTY rather than matching something by
	// accident, which is what proves the filter is keyed on the target and not on a substring of the name.
	it('CONTROL — an aggregate nothing targets yields an empty set, not a false match', () => {
		expect(commandsTargeting('NO_SUCH_AGGREGATE_TYPE')).toEqual([]);
	});
});
// ── REG-F-167: A FIELD DECLARED ON EVERY COMMAND AND READ BY NOTHING ────────────────────────────────────────
//
// ⚠ FOUND BY THE CONTROL ABOVE, WHICH IS THE ONLY REASON IT WAS FOUND. That control exists to prove the reader
// resolves more than one command; it returned ZERO for `'PWU'`, and the cause was not the reader.
//
// **`COMMANDS[*].targetAggregateType` IS READ BY NOTHING IN THIS REPOSITORY.** `command-bus.ts` validates
// `COMMANDS[type].payload` and only that; the envelope's own `targetAggregateType` is `z.ZodString`
// (unconstrained), and its sole production read is a label in a refusal message (`kit.ts:70`). Nothing ever
// compares the DECLARED target against the DISPATCHED one, and until this file nothing enumerated by it either.
//
// The consequence is exactly what an unread field accumulates: **seven aggregates are spelled two different
// ways**, splitting 54 commands across keys that no consumer reconciles. Any future census keyed on this field
// silently sees a SUBSET — which is this programme's oldest defect, waiting in a field nobody reads.
//
// PINNED RATHER THAN REPAIRED, DELIBERATELY. `messages.ts` is GENERATED from `packages/rph-contracts/vocab/`,
// so normalising the spellings is a vocab change plus a regeneration with a large diff, and it belongs in its
// own increment where the regeneration can be inspected. What must not happen meanwhile is the set growing
// quietly, so it is pinned BY NAME WITH COUNTS: a new split reddens here.
describe('REG-F-167 — the registry spells seven aggregates two ways, and nothing reads the field', () => {
	it('pins every aggregate spelled MORE THAN ONE WAY, so the split cannot widen unnoticed', () => {
		const byNormalized = new Map<string, Map<string, number>>();
		for (const spec of Object.values(REGISTRY)) {
			const raw = spec.targetAggregateType;
			if (raw === undefined) continue;
			const key = normalizeAggregate(raw);
			const seen = byNormalized.get(key) ?? new Map<string, number>();
			seen.set(raw, (seen.get(raw) ?? 0) + 1);
			byNormalized.set(key, seen);
		}
		const split = [...byNormalized.values()]
			.filter((spellings) => spellings.size > 1)
			.map((spellings) =>
				[...spellings.entries()]
					.sort((a, b) => a[0].localeCompare(b[0]))
					.map(([name, n]) => `${name} x${n}`)
					.join(' | ')
			)
			.sort((a, b) => a.localeCompare(b));
		expect(
			split,
			'the dual-spelling set MOVED. If it SHRANK, the vocab was normalised — good, update this pin in that ' +
				'commit. If it GREW, a new command adopted a spelling its siblings do not use, and every census ' +
				'keyed on targetAggregateType now sees a smaller population than it reports.'
		).toEqual([
			'Baseline x1 | BASELINE x4',
			'Decision x4 | DECISION x2',
			'Evidence x1 | EVIDENCE x2',
			'EXECUTION_PLAN x14 | ExecutionPlan x3',
			'Intent x1 | INTENT x6',
			'PROFESSIONAL_WORK_UNIT x4 | ProfessionalWorkUnit x9',
			'RECOMPOSITION_CONTRACT x1 | RecompositionContract x2'
		]);
	});

	// CONTROL — the pin above passes for a reader that finds these seven and equally for one that finds nothing
	// and is compared against a stale literal. This holds the discriminating half: the registry must be
	// NON-EMPTY and most aggregates must be spelled ONE way, so a reader returning everything or nothing fails.
	it('CONTROL — the census reads a real, mostly-consistent registry', () => {
		const targets = Object.values(REGISTRY)
			.map((s) => s.targetAggregateType)
			.filter((v): v is string => v !== undefined);
		expect(targets.length, 'the registry must be non-empty').toBeGreaterThan(100);
		const distinct = new Set(targets.map(normalizeAggregate));
		expect(distinct.size, 'most aggregates are spelled ONE way — 7 are not').toBeGreaterThan(7);
	});
});
