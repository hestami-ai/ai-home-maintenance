// KEYS THAT APPEAR IN `STATE_MACHINES` AND ARE NOT LIFECYCLES AN OBJECT IS MOVED THROUGH.
//
// ── WHY THIS MOVED OUT OF state-reachability.test.ts ─────────────────────────────────────────────────────────
// It lived as a private const in one control. A SECOND control now reads the same table — the C-0 arrow×command
// census (`verif/arrow-command-census.ts`) — and a private exclusion list means the two controls disagree about
// what the population even is: one reports nine arrows as uncovered while the other has already ruled the whole
// machine out of scope. Two censuses over one table must not each keep their own idea of the table.
//
// ── THE BAR FOR ADDING A KEY, VERBATIM FROM WHERE THIS LIST STARTED ──────────────────────────────────────────
// *"This list therefore cites a ruling rather than computing one, and any addition to it needs the same: a
// citation, not a resemblance."* An entry must say what makes the key not-a-machine, in terms someone can check.
//
// ⚠ AND EXCLUSION IS NOT EXEMPTION. An excluded key is one the controls should never have been asked about. It
// is NOT a way to quiet a machine whose arrows are genuinely unbuilt — that is what the C-0 baseline is for, and
// moving a real gap in here would be the allowlist rot this repository keeps recording.

export const NOT_STATE_MACHINES: Readonly<Record<string, string>> = {
	AggregateAssuranceDisposition:
		'JAN-CMDPRE-SPEC-001 §2 — a computed disposition rollup with no transitions, out of transition-legality ' +
		'scope. Its six states are outcomes DERIVED from the assessments it summarises, not states an object is ' +
		'moved between, so they have no in-arrows by construction rather than by omission.',

	'AssuranceAssessment.disposition':
		'RETIRED 2026-08-08 (REG-F-068) — A MACHINE OVER A FIELD THE AGGREGATE DOES NOT HAVE. The ratified ' +
		'`AssuranceAssessment` object schema has no `disposition` property (checked directly against ' +
		'schemas/objects/AssuranceAssessment.json: `assessmentState` is present, `disposition` is absent), the ' +
		'object is a z.strictObject, and `commitState` validates the PRODUCED state against it. So the axis is ' +
		'MECHANICALLY UN-WRITABLE — not unbuilt, impossible — and this is a citation rather than a resemblance: ' +
		'the schema decides it, no judgement is being exercised. ' +
		'SUCCESSOR: `AssuranceAssessment.state`, which really does perform six of the nine transitions the dead ' +
		'machine describes (assurance.ts:1826, :1898). ' +
		'NOT AN EXEMPTION: an EXEMPT entry would record "deliberately unbuilt", which is false — this cannot be ' +
		'built without adding a field the ratified schema forbids. ' +
		'⚠ THE ARROWS STAY IN transitions.data.ts DELIBERATELY. That file is GENERATED from the vocab, so a ' +
		'marker placed in it would be erased by the next `bun run gen`; and the vocab still carries the error ' +
		'one layer up — two ratified event rows name this axis as the machine they drive, both wrong twice over ' +
		'(RequestAssuranceAssessment recorded as `(initial) -> PENDING` when the handler BIRTHS at ' +
		'READY/EVIDENCE_PENDING, and CompleteAssuranceAssessment recorded here when assurance.ts:1898 names ' +
		'`AssuranceAssessment.state`). Correcting those rows is the remaining half of REG-F-068 and moves ' +
		"C-0's arrow total, which is a deliberate edit."
};

/** True when `machine` is a declared key that no control should treat as a lifecycle. */
export const isExcludedMachine = (machine: string): boolean => machine in NOT_STATE_MACHINES;
