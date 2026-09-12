// Generic conformance for ALL 23 state machines + fidelity to the ratified transition catalog.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RphErrorException } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import {
	assertTransition,
	canTransition,
	classifyTransition,
	getMachine,
	machineNames
} from './index.js';

const vocab = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'm2-transitions.json'),
		'utf8'
	)
) as { machines: { name: string; states: string[] }[] };

describe('state-machine catalog fidelity', () => {
	it('registers exactly the ratified machines', () => {
		expect(machineNames().sort()).toEqual(vocab.machines.map((m) => m.name).sort());
	});

	it.each(vocab.machines.map((m) => [m.name, m.states] as const))(
		'%s exposes the ratified state set',
		(name, states) => {
			expect([...getMachine(name).states].sort()).toEqual([...states].sort());
		}
	);
});

describe('generic transition engine (all machines)', () => {
	it('classifies every legal (non-self) transition as LEGAL', () => {
		for (const name of machineNames()) {
			for (const t of getMachine(name).transitions) {
				if (t.from === t.to) continue;
				expect(canTransition(name, t.from, t.to), `${name}: ${t.from}->${t.to}`).toBe(true);
			}
		}
	});

	it('rejects every explicitly-illegal transition (ILLEGAL_EXPLICIT)', () => {
		for (const name of machineNames()) {
			for (const i of getMachine(name).illegal) {
				const c = classifyTransition(name, i.from, i.to);
				expect(c.klass, `${name}: ${i.from}->${i.to}`).toBe('ILLEGAL_EXPLICIT');
				expect(canTransition(name, i.from, i.to)).toBe(false);
			}
		}
	});

	it('assertTransition throws RPH_ILLEGAL_STATE_TRANSITION on an illegal edge', () => {
		const i = getMachine('PWU.workLifecycleState').illegal[0]!;
		expect(() =>
			assertTransition('PWU.workLifecycleState', i.from, i.to, { correlationId: 'c1' })
		).toThrow(RphErrorException);
		try {
			assertTransition('PWU.workLifecycleState', i.from, i.to, { correlationId: 'c1' });
		} catch (e) {
			expect((e as RphErrorException).error.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		}
	});

	it('treats an undefined transition as ILLEGAL_UNDEFINED (never silently allowed)', () => {
		expect(classifyTransition('PWU.workLifecycleState', 'PROPOSED', 'BASELINED').klass).toBe(
			'ILLEGAL_UNDEFINED'
		);
		expect(canTransition('PWU.workLifecycleState', 'PROPOSED', 'BASELINED')).toBe(false);
	});

	it('permits a same-state NOOP but never counts it LEGAL', () => {
		expect(classifyTransition('PWU.workLifecycleState', 'READY', 'READY').klass).toBe('NOOP');
		expect(() =>
			assertTransition('PWU.workLifecycleState', 'READY', 'READY', { correlationId: 'c1' })
		).not.toThrow();
	});

	it('flags unknown states', () => {
		expect(classifyTransition('PWU.workLifecycleState', 'NONSENSE', 'READY').klass).toBe(
			'UNKNOWN_STATE'
		);
	});
});

describe('JAN-CMDPRE DWP-07 — a DECLARED illegal self-edge classifies ILLEGAL_EXPLICIT, not NOOP', () => {
	// The illegal table is consulted BEFORE the from === to shortcut (D2/D6): §24.2 makes an AUTHORITATIVE baseline
	// immutable, so AUTHORITATIVE -> AUTHORITATIVE is a forbidden in-place mutation, not a permitted no-op.
	it('Baseline.status AUTHORITATIVE -> AUTHORITATIVE is ILLEGAL_EXPLICIT (canTransition false; assertTransition throws)', () => {
		const c = classifyTransition('Baseline.status', 'AUTHORITATIVE', 'AUTHORITATIVE');
		expect(c.klass).toBe('ILLEGAL_EXPLICIT');
		expect(c.reason).toContain('§24.2');
		expect(canTransition('Baseline.status', 'AUTHORITATIVE', 'AUTHORITATIVE')).toBe(false);
		expect(() =>
			assertTransition('Baseline.status', 'AUTHORITATIVE', 'AUTHORITATIVE', { correlationId: 'c1' })
		).toThrow(RphErrorException);
	});

	// The 27-machine differential: exactly ONE (from === to) pair is declared illegal across ALL machines — so the
	// reorder + generator change alter EXACTLY ONE classification (Baseline's), not a blanket self-edge ban.
	it('exactly one declared illegal self-edge exists across all machines, and it is the Baseline row', () => {
		const declaredSelfEdges = machineNames().flatMap((name) =>
			getMachine(name)
				.illegal.filter((i) => i.from === i.to)
				.map((i) => `${name}: ${i.from}->${i.to}`)
		);
		expect(declaredSelfEdges).toEqual(['Baseline.status: AUTHORITATIVE->AUTHORITATIVE']);
	});

	// Every OTHER self-edge — one NOT declared illegal — still classifies NOOP (the reorder falls through to the
	// from === to shortcut). This is the property that proves DWP-07 did not blanket-ban self-transitions.
	it('every self-edge NOT declared illegal still classifies NOOP', () => {
		for (const name of machineNames()) {
			const declaredIllegal = new Set(
				getMachine(name)
					.illegal.filter((i) => i.from === i.to)
					.map((i) => i.from)
			);
			for (const s of getMachine(name).states) {
				if (declaredIllegal.has(s)) continue;
				expect(classifyTransition(name, s, s).klass, `${name}: ${s}->${s}`).toBe('NOOP');
			}
		}
	});
});

// ── JAN-PFA R3 S3.3 — TWO stateMachine GUARANTEES NOTHING ASSERTED ────────────────────────────────────────────
//
// Both close a SURVIVING mutant, and both are about what these two thin wrappers add over what they delegate to.
// A wrapper's only testable promise is its delta, and in both cases the delta was unasserted while the delegate
// was thoroughly covered.
describe('JAN-PFA R3 — getMachine FAILS LOUD on an unknown machine', () => {
	// ⛔ SURVIVING MUTANT CLOSED: `if (!m) throw` -> `if (!m) return { name, states: [], ... }`.
	// getMachine is a thin wrapper over `STATE_MACHINES[name]` and the ONE thing it adds is the loud refusal.
	// ⭐ A FABRICATED EMPTY MACHINE IS THE WORST POSSIBLE ANSWER: every other export in the module reaches the
	// tables only through here, so an empty machine makes `classifyTransition` report every transition UNKNOWN
	// and `canTransition` return false for everything — eight guards (canActivatePlan, canStartStep,
	// canPromoteBaseline, canSupersedeBaseline, authorizeDecisionEffective, canAdvanceWorkLifecycle and the
	// decomposition arms) would then refuse every legal act while reporting a shape, not an error. This file's own
	// header states the rule: illegal transitions fail LOUD, never silently repair state.
	it('throws on a name that is not a ratified machine, rather than resolving to an empty one', () => {
		expect(() => getMachine('NoSuchMachine')).toThrow(/Unknown state machine/);
	});

	it('CONTROL: a ratified name still resolves, so the refusal above is not refusing everything', () => {
		const m = getMachine(machineNames()[0]!);
		expect(m.states.length, 'a ratified machine resolved to an EMPTY shape').toBeGreaterThan(0);
	});
});

describe('JAN-PFA R3 — canTransition is LEGAL-ONLY: a NOOP is not a transition', () => {
	// ⛔ SURVIVING MUTANT CLOSED: `klass === 'LEGAL'` -> `klass === 'LEGAL' || klass === 'NOOP'`.
	// The strictness IS the delta over `classifyTransition`, stated in canTransition's own doc comment as
	// "LEGAL ONLY (a NOOP is NOT a transition)" and "deliberate and load-bearing (JAN-CMDPRE DWP-07 / D2)".
	// ⚠ The mutant makes it identical to the application layer's deliberately PERMISSIVE `checkTransition`
	// (kit.ts), erasing the split the comment calls load-bearing — and every same-state re-issue the eight guards
	// exist to refuse would be admitted. The suite asserted NOOP's classification thoroughly and never asserted
	// what canTransition DOES with it.
	it('a same-state re-issue is refused, for every machine that declares it a NOOP', () => {
		let checked = 0;
		for (const name of machineNames()) {
			const m = getMachine(name);
			for (const state of m.states) {
				if (classifyTransition(name, state, state).klass !== 'NOOP') continue;
				checked += 1;
				expect(
					canTransition(name, state, state),
					`${name}: ${state}->${state} is a NOOP but canTransition admitted it as a transition`
				).toBe(false);
			}
		}
		// ⛔ VACUITY CONTROL: if no machine declares a NOOP the loop asserts nothing, and the mutant would pass.
		expect(checked, 'no NOOP pairs were found, so the assertion above is vacuous').toBeGreaterThan(0);
	});

	it('CONTROL: a genuinely LEGAL transition is still admitted', () => {
		let admitted = 0;
		for (const name of machineNames()) {
			const m = getMachine(name);
			for (const t of m.transitions)
				if (canTransition(name, t.from, t.to)) admitted += 1;
		}
		expect(admitted, 'canTransition admitted NO declared transition anywhere').toBeGreaterThan(0);
	});
});
