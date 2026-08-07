// THE DEFERRAL GATE — a rule may not be certified as DEFERRED while a check for it exists and PASSES (REG-F-019).
//
// WHAT IT ASSERTS: every rule id the replay harness names in a passing conformance check is NOT `DEFERRED` in the
// conformance manifest. Derived from the harness's own output, so it cannot go stale the way a written list does.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// `DEFERRABLE_PREFIXES` is the manifest's most dangerous data, and its own comment says why (REG-F-013): "an entry
// here does not weaken a claim, it DELETES the claim, and the enforcement register's overclaim gate — which has
// caught four bad certifications — cannot see a family that certifies nothing. Everything else in this module
// fails LOUDLY when wrong; a wrong entry here fails silently, forever."
//
// REG-F-013 removed `RPH-CMP` from that set after finding its rationale named a different concern AND was stale.
// REG-F-019 removed `RPH-FIX` for the OPPOSITE reason, and that direction is the one nothing could see: the family
// was not merely deferred on a bad rationale — four of its six rules had NAMED, RUNNING, GREEN checks in
// `packages/rph-engine/src/replay.ts` while the manifest certified nothing about them, and its note described the
// harness that runs them as future work ("the M13 Reference Undertaking replay harness"). An OVERCLAIM is caught
// by the enforcement register's overclaim gate. An UNDERCLAIM was caught by nothing, because a family exempted
// from the gate makes no claim to check.
//
// SO THE GATE RUNS THE HARNESS RATHER THAN READING ABOUT IT. A note can say anything; a passing check is a fact.
//
// TOTAL OVER BOTH ORACLES, and it has to be. `runConformance` reads the §26 event trace; `runGraphConformance`
// reads the OBJECT GRAPH the engine builds — two harnesses, because four of the RPH-FIX rules are properties of a
// sequence and the rest are properties of a graph. A gate that watched only one of them would leave the other free
// to drift back into a deferral, which is the exact failure this file exists to prevent.
//
// WHAT THIS CANNOT SEE, stated so the gate is not read as more than it is: it observes the ids these harnesses
// EMIT. A rule discharged by some other test file, under no id, is invisible here — that is the manifest's
// `testFile` cite's job, and the enforcement register's. This gate closes one direction of two instruments, which
// is exactly the direction that failed silently.
import { describe, expect, it } from 'vitest';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { coverageFor } from '@janumipwb/rph-domain';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import {
	createEngine,
	driveReferenceUndertaking,
	loadExpectedEvents,
	REFERENCE_CONSTRAINT_CHAIN,
	REFERENCE_UNDERTAKING,
	runConformance,
	runGraphConformance
} from '@janumipwb/rph-engine';

/** `RPH-FIX-003a` and `RPH-FIX-003b` both discharge rule `RPH-FIX-003`. */
const ruleIdOf = (checkId: string): string => checkId.replace(/^(RPH-[A-Z0-9]+-\d+)[a-z]$/, '$1');

/** The object graph the engine builds when it drives the Reference Undertaking through the real pipeline. */
function drivenGraph(): { store: SqliteStorageAdapter } {
	const store = new SqliteStorageAdapter({ now: () => '2026-07-12T00:00:00Z' });
	const engine = createEngine({ authenticate: testAuthenticator(),
		store,
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: (() => {
			let s = 0;
			return () => `evt_${++s}`;
		})()
	}).as(TEST_CRED.human);
	driveReferenceUndertaking(engine);
	return { store };
}

/** Rule ids named by a check that PASSED, across BOTH oracles. A failing check certifies nothing. */
function rulesWithPassingChecks(): string[] {
	const checks = [...runConformance(loadExpectedEvents()).checks];
	const { store } = drivenGraph();
	try {
		checks.push(
			...runGraphConformance(store, {
				architecturePwuId: REFERENCE_UNDERTAKING.architecture,
				multiTenancyPwuId: REFERENCE_UNDERTAKING.multiTenancy,
				constraintId: REFERENCE_CONSTRAINT_CHAIN.multiTenancyConstraint,
				tenantIsolationArtifactId: REFERENCE_CONSTRAINT_CHAIN.tenantIsolationArtifact,
				tenantIsolationClaimId: REFERENCE_CONSTRAINT_CHAIN.tenantIsolationClaim
			}).checks
		);
	} finally {
		store.close();
	}
	const ids = checks
		.filter((c) => c.ok)
		.map((c) => ruleIdOf(c.id))
		.filter((id) => /^RPH-[A-Z0-9]+-\d+$/.test(id));
	return [...new Set(ids)].sort();
}

describe('REG-F-019: a rule with a passing check is not certified as DEFERRED', () => {
	it('no rule the replay harness proves is written off in the manifest', () => {
		const deferred = rulesWithPassingChecks().filter(
			(id) => coverageFor(id)?.status === 'DEFERRED'
		);
		expect(
			deferred,
			`These rules have a PASSING named check in the replay harness and are certified DEFERRED — ` +
				`the manifest is claiming less than the repository does, and a deferred family is exempt from the ` +
				`conformance gate entirely. Move the status (and, if the family no longer belongs there, remove its ` +
				`prefix from DEFERRABLE_PREFIXES).\n  ${deferred.join('\n  ')}`
		).toEqual([]);
	});

	// CONTROL, and without it the assertion above is satisfied by a harness that names nothing. The population
	// must be non-empty AND must actually resolve against the manifest — a typo in `ruleIdOf` would otherwise
	// produce ids that match no rule and quietly pass.
	it('CONTROL: the harness names real rules, and they resolve in the manifest', () => {
		const named = rulesWithPassingChecks();
		expect(named.length, 'the harness must name at least one rule').toBeGreaterThan(0);
		const unresolved = named.filter((id) => coverageFor(id) === undefined);
		expect(
			unresolved,
			`named by a check but absent from the manifest — either the check cites a rule that does not exist, ` +
				`or ruleIdOf mangled it: ${unresolved.join(', ')}`
		).toEqual([]);
	});

	// The specific rules this finding was about, pinned by NAME so a silent regression to DEFERRED is legible in
	// the diff rather than only in a count.
	it('the five RPH-FIX rules the harnesses prove are certified, not deferred', () => {
		for (const id of ['RPH-FIX-001', 'RPH-FIX-002', 'RPH-FIX-003', 'RPH-FIX-004', 'RPH-FIX-006']) {
			expect(coverageFor(id)?.status, `${id}`).not.toBe('DEFERRED');
		}
	});

	// FIX-004 comes from the GRAPH oracle, not the trace — so this also proves the second harness is actually
	// being consulted. Drop `runGraphConformance` from the population above and this reddens while everything
	// else stays green.
	it('the population spans BOTH oracles — RPH-FIX-004 is graph-derived', () => {
		expect(rulesWithPassingChecks()).toContain('RPH-FIX-004');
	});

	// AND THE OTHER DIRECTION, because the finding's precision is the asymmetry: RPH-E2E's deferral is LEGITIMATE.
	// No RPH-E2E rule id appears in any check, in any test, anywhere in the repository. If one ever does, the
	// first assertion in this file reddens and that deferral must be revisited too.
	it('CONTROL: RPH-E2E is genuinely deferred — the harness names none of it', () => {
		expect(rulesWithPassingChecks().filter((id) => id.startsWith('RPH-E2E'))).toEqual([]);
	});
});
