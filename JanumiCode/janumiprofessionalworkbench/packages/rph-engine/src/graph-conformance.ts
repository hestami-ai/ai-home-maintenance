// THE GRAPH ORACLE — the RPH-FIX rules that are statements about the OBJECT GRAPH, not about an event sequence.
//
// WHY A SECOND MODULE (REG-F-019, 2026-08-04). `replay.ts`'s `runConformance` operates on
// `fixtures/expected-events.jsonl`: a hand-authored trace of five fields — `seq`, `event`, `aggregate`, `phase`,
// `label`. Four of the six RPH-FIX rules are properties of that SEQUENCE (contiguity, registered contracts,
// terminal states, a surviving residual) and it can carry them. TWO ARE NOT:
//
//   RPH-FIX-004  "All architecture obligations in the fixture are allocated to child PWUs."
//   RPH-FIX-005  "The fixture exposes the trace: Multi-Tenancy Constraint -> Multi-Tenancy Architecture PWU ->
//                 Tenant Isolation Artifact -> Tenant Isolation Claim -> Assessment."
//
// Both quantify over OBJECTS and the references between them. The trace has no obligations, no artifacts and no
// claims — measured, of its 27 distinct labels exactly ONE mentions tenancy — so neither rule is checkable
// against it at all, and no amount of care in transcription would change that. Certifying them from the trace
// would mean weakening them until they fit, which is how the previous oracle became decorative.
//
// So these run against the graph the ENGINE builds when `driveReferenceUndertaking` executes the undertaking
// through the real command pipeline. That is the direction `replay-conformance.test.ts` already established, and
// it makes the oracle capable of disagreeing with the system — which is the only property that made the §26
// `PwuMarkedReady` drift findable.
import type { StorageAdapter } from '@janumipwb/rph-ports';
import type { ConformanceCheck } from './replay.js';

/** Everything these checks need from the store: the event log, and the ability to load an object's state. */
export interface GraphSource {
	readAllEvents: StorageAdapter['readAllEvents'];
	loadObject: StorageAdapter['loadObject'];
}

interface ObligationState {
	readonly sourceObjectId?: string;
	readonly strength?: string;
	readonly statement?: string;
}

interface DecompositionState {
	readonly parentWorkUnitId?: string;
	readonly childWorkUnitIds?: readonly string[];
	readonly obligationAllocations?: readonly { obligationId: string; allocatedTo: readonly string[] }[];
	readonly retainedParentObligationIds?: readonly string[];
}

export interface GraphConformanceReport {
	readonly ok: boolean;
	readonly checks: readonly ConformanceCheck[];
}

/**
 * Assert the object-graph RPH-FIX rules over a driven store.
 *
 * `architecturePwuId` is passed rather than discovered so the checks cannot quietly range over whichever PWU
 * happens to have obligations — the rule is about the ARCHITECTURE decomposition specifically, and a check that
 * finds its own subject can be satisfied by the wrong one.
 */
export function runGraphConformance(
	store: GraphSource,
	subjects: {
		readonly architecturePwuId: string;
		readonly multiTenancyPwuId: string;
		readonly constraintId: string;
		readonly tenantIsolationArtifactId: string;
		readonly tenantIsolationClaimId: string;
	}
): GraphConformanceReport {
	const checks: ConformanceCheck[] = [];
	const add = (id: string, ok: boolean, detail: string): void => {
		checks.push({ id, ok, detail });
	};
	const events = store.readAllEvents();
	const idsOfType = (aggregateType: string): string[] => [
		...new Set(events.filter((e) => e.aggregateType === aggregateType).map((e) => e.aggregateId))
	];
	const stateOf = <T>(id: string): T | undefined => store.loadObject(id)?.state as T | undefined;

	// ── RPH-FIX-004 — architecture decomposition coverage ─────────────────────────────────────────────────────
	//
	// Corpus §25 Test 4. Every MANDATORY obligation sourced from the Architecture Definition PWU must be allocated
	// to a child PWU by the decomposition that decomposes it — or explicitly RETAINED by the parent, which DOC-003
	// §6 DEC-3's conservation equation permits and which a bare "all allocated" reading would wrongly forbid.
	//
	// NON-VACUITY IS PART OF THE CHECK, not a separate nicety. Before the drive authored obligations this set was
	// EMPTY and the universally quantified test passed over nothing. `ok` therefore requires at least one
	// obligation to exist: a rule about allocation cannot be satisfied by an absence of things to allocate.
	const architectureObligations = idsOfType('OBLIGATION')
		.map((id) => ({ id, state: stateOf<ObligationState>(id) }))
		.filter(
			(o) =>
				o.state?.sourceObjectId === subjects.architecturePwuId && o.state?.strength === 'MANDATORY'
		);

	const architectureDecompositions = idsOfType('DECOMPOSITION_CONTRACT')
		.map((id) => stateOf<DecompositionState>(id))
		.filter((d): d is DecompositionState => d?.parentWorkUnitId === subjects.architecturePwuId);

	const allocatedTo = new Map<string, readonly string[]>();
	const retained = new Set<string>();
	for (const d of architectureDecompositions) {
		for (const a of d.obligationAllocations ?? []) allocatedTo.set(a.obligationId, a.allocatedTo);
		for (const r of d.retainedParentObligationIds ?? []) retained.add(r);
	}
	const children = new Set(architectureDecompositions.flatMap((d) => [...(d.childWorkUnitIds ?? [])]));

	const unallocated = architectureObligations.filter((o) => {
		if (retained.has(o.id)) return false;
		const targets = allocatedTo.get(o.id);
		// Allocated to NOTHING, or to something that is not a child of this decomposition, is not allocation.
		return !targets || targets.length === 0 || !targets.every((t) => children.has(t));
	});
	add(
		'RPH-FIX-004',
		architectureObligations.length > 0 && unallocated.length === 0,
		architectureObligations.length === 0
			? 'VACUOUS: no MANDATORY obligation is sourced from the Architecture PWU, so there is nothing to allocate'
			: `${architectureObligations.length} architecture obligations, ${allocatedTo.size} allocated to ${children.size} children, ${retained.size} retained; unallocated: ${unallocated.map((o) => o.id).join(', ') || 'none'}`
	);

	// ── RPH-FIX-005 — the constraint trace ────────────────────────────────────────────────────────────────────
	//
	// Corpus §25's second chain: Multi-Tenancy Constraint -> Multi-Tenancy Architecture PWU -> Tenant Isolation
	// Model -> Tenant Isolation Claim -> Architecture Assessment.
	//
	// EACH HOP IS WALKED AS A REFERENCE THAT EXISTS IN THE GRAPH, not as an event having occurred. The rule says
	// the fixture EXPOSES the trace, and a trace you cannot walk is not exposed — five objects all existing
	// separately would satisfy an existence check and expose nothing. So every hop below reads the FORWARD field
	// that names the next object, and the walk fails at the first link that does not resolve.
	const hops: string[] = [];
	const missing: string[] = [];
	const hop = (name: string, ok: boolean): boolean => {
		(ok ? hops : missing).push(name);
		return ok;
	};

	const constraint = stateOf<{ statement?: string }>(subjects.constraintId);
	const pwu = stateOf<{ constraintIds?: readonly string[] }>(subjects.multiTenancyPwuId);
	const artifact = stateOf<{ producingPwuId?: string }>(subjects.tenantIsolationArtifactId);
	const claim = stateOf<{ subjectObjectIds?: readonly string[] }>(subjects.tenantIsolationClaimId);
	const assessments = idsOfType('ASSURANCE_ASSESSMENT')
		.map((id) => stateOf<{ claimIds?: readonly string[] }>(id))
		.filter((a) => (a?.claimIds ?? []).includes(subjects.tenantIsolationClaimId));

	hop('Constraint', constraint !== undefined);
	hop(
		'Constraint->PWU',
		(pwu?.constraintIds ?? []).includes(subjects.constraintId)
	);
	hop('PWU->Artifact', artifact?.producingPwuId === subjects.multiTenancyPwuId);
	hop(
		'Artifact->Claim',
		(claim?.subjectObjectIds ?? []).includes(subjects.tenantIsolationArtifactId)
	);
	hop('Claim->Assessment', assessments.length > 0);

	const broken = missing.length > 0 ? `; BROKEN: ${missing.join(', ')}` : '';
	add(
		'RPH-FIX-005',
		missing.length === 0,
		`${hops.length}/5 hops resolve (${hops.join(' -> ')})${broken}`
	);

	return { ok: checks.every((c) => c.ok), checks };
}
