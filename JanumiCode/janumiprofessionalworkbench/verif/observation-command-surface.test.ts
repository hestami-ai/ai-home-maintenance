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
import { COMMANDS, ProfessionalWorkObjectTypeSchema } from '@janumipwb/rph-contracts';
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
				'entries deliberately rather than letting them flip to KILLED unexplained. ⚠ A THIRD consumer joined them ' +
				'on 2026-08-20 (REG-F-199 residue 2): `professional-work-graph.ts` now reads each observation’s CURRENT ' +
				'disposition from the store rather than from the recording event, so its WAIVED branch is dead for the ' +
				'same reason and comes alive on the same day — see professional-work-graph-current-disposition.test.ts. ' +
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
// ~~PINNED RATHER THAN REPAIRED, DELIBERATELY.~~ **REPAIRED IN REG-F-179, AND THE PIN WAS REPLACED BY A CLOSED
// PREDICATE RATHER THAN UPDATED.** The old pin listed the seven split groups by name and count, which is an
// ENUMERATION of the exceptions: it reddens when the seven move, and says nothing about an eighth spelling that
// never acquires a twin. That blind spot was real — `DecompositionContract` ×3 had no SCREAMING_SNAKE counterpart,
// so it was invisible to a dual-spelling test while being the same defect, one twin away from joining the list.
//
// ⚠ THE AUTHORITY WAS ALREADY IN THE VOCAB AND NOBODY HAD ASKED IT. `canonicalEnums[0]` is
// `ProfessionalWorkObjectType`, whose own `appliesTo` reads *"ObjectEnvelope.objectType (all Professional Work
// Objects)"* — 23 SCREAMING_SNAKE values. So the canonical spelling was never a preference to be chosen: a
// `targetAggregateType` names a Professional Work Object type, and the question is MEMBERSHIP. Measured before the
// repair: 22 of 30 spellings (77 declarations) were members and **8 spellings (24 declarations) were not**, each
// mapping letter-for-letter onto exactly one member.
//
// The predicate STRICTLY SUBSUMES the pin it replaces: enum members are distinct SCREAMING_SNAKE names, so no two
// can normalise to the same key, and membership therefore forbids dual spelling as a corollary. One assertion, no
// literal to keep current, and an eighth stray is caught the same way the seven were.
describe('REG-F-179 — every targetAggregateType names a Professional Work Object type', () => {
	it('pins the PREDICATE, not the exceptions: no command declares a target outside the enum', () => {
		const members = new Set<string>(ProfessionalWorkObjectTypeSchema.options);
		const strays = Object.entries(REGISTRY)
			.filter(
				([, spec]) => spec.targetAggregateType !== undefined && !members.has(spec.targetAggregateType)
			)
			.map(([name, spec]) => `${name} -> ${spec.targetAggregateType}`)
			.sort((a, b) => a.localeCompare(b));
		expect(
			strays,
			'a command declares a `targetAggregateType` that is NOT a value of `ProfessionalWorkObjectType`. ' +
				'Nothing reads this field at runtime, so it breaks nothing today — which is exactly why it must be ' +
				'caught here: every census keyed on it silently reports a subset. Fix the spelling in ' +
				'`packages/rph-contracts/vocab/m3-commands-events.json` and re-run `bun run gen`; do NOT widen the enum ' +
				'unless a genuinely new object type is being introduced.'
		).toEqual([]);
	});

	// CONTROL — an empty `strays` list is produced equally by a registry with no strays and by a reader that
	// resolves nothing, or by a membership set so large it accepts anything. This holds all three discriminating
	// halves: the registry is real, the enum ACCEPTS the canonical spelling, and it REJECTS the exact spelling the
	// repair removed. The third is the one that matters — without it, `members` could be `new Set(everything)`.
	it('CONTROL — the registry is real and the membership test both accepts and rejects', () => {
		const targets = Object.values(REGISTRY)
			.map((s) => s.targetAggregateType)
			.filter((v): v is string => v !== undefined);
		expect(targets.length, 'the registry must be non-empty').toBeGreaterThan(100);
		const members = new Set<string>(ProfessionalWorkObjectTypeSchema.options);
		expect(members.has('PROFESSIONAL_WORK_UNIT'), 'the canonical spelling must be accepted').toBe(true);
		expect(
			members.has('ProfessionalWorkUnit'),
			'the spelling REG-F-179 removed must still be REJECTED — otherwise this gate accepts what it was ' +
				'written to forbid'
		).toBe(false);
		expect(normalizeAggregate('PROFESSIONAL_WORK_UNIT')).toBe(normalizeAggregate('ProfessionalWorkUnit'));
	});
});
