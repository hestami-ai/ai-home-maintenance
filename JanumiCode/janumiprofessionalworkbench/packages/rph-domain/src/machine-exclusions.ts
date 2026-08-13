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
		'machine describes — the six `machine: AssuranceAssessment.state` transition sites in assurance.ts. ' +
		'CITED BY SYMBOL: the citation that stood here, `assurance.ts:1826, :1898`, never resolved FROM THIS ' +
		'FILE. It was copied in from the register without being re-resolved, and on the day this file was ' +
		'created neither number was a machine site. ' +
		'NOT AN EXEMPTION: an EXEMPT entry would record "deliberately unbuilt", which is false — this cannot be ' +
		'built without adding a field the ratified schema forbids. ' +
		'⚠ THE ARROWS STAY IN transitions.data.ts DELIBERATELY. That file is GENERATED from ' +
		'rph-domain/vocab/m2-transitions.json, so a marker placed in it would be erased by the next ' +
		'`bun run gen`. ' +
		'THE VOCAB ROWS ONE LAYER UP ARE NOW CORRECTED (2026-08-08, REG-F-068 second half): two command entries ' +
		'and two binding rows in rph-contracts/vocab/m3-commands-events.json named this dead axis as the machine ' +
		'they drive, both wrong twice over — RequestAssuranceAssessment recorded `(initial) -> PENDING` when the ' +
		'handler BIRTHS at EVIDENCE_PENDING/READY, and CompleteAssuranceAssessment was recorded here when ' +
		'assurance.ts:1898 names `AssuranceAssessment.state`. ' +
		"⚠ CORRECTION TO THIS NOTE'S OWN EARLIER TEXT: it said correcting those rows moves C-0's arrow total. IT " +
		'DOES NOT. The total is computed over STATE_MACHINES, generated from m2-transitions.json; the corrected ' +
		'rows are in m3-commands-events.json, which feeds messages.ts and nothing else. Measured: the ' +
		'regeneration touched messages.ts alone and the baseline needed no edit. ' +
		'THE GENERAL FORM OF THE MISTAKE — asked on closing it — found two MORE rows of the same family and is ' +
		'now a standing control: see REG-F-074 and verif/binding-row-truth.ts.'
};

/** True when `machine` is a declared key that no control should treat as a lifecycle. */
export const isExcludedMachine = (machine: string): boolean => machine in NOT_STATE_MACHINES;
