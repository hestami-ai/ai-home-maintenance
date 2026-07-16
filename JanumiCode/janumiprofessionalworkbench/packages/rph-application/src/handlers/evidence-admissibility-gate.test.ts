// Drives the REAL AdmitEvidence command through engine.dispatch and asks the question the existing suite never
// asks: does the CALL SITE enforce admissibility, or is the kernel merely correct beside it?
//
// Guide "### 8.11 Evidence admissibility" (line 1025), operative line 1027, byte-exact:
//   "Evidence is admissible only when identity is stable, provenance and content/reference are available, scope and
//   limitations are explicit, relevance and freshness are adequate, and it is not invalidated."
//
// "only when" is a gate on the ADMISSION transition. `packages/rph-assurance/src/assurance-rules.ts:99`
// `evidenceAdmissibility(...)` implements all 8 conditions and is unit-proven at `assurance-rules.test.ts:85` — but
// it has NO production caller. `admitEvidence` (`assurance.ts:222`) is a bare PROPOSED -> ADMISSIBLE status advance
// that reads nothing off the Evidence it is admitting, and the floor's boundary hardcodes `evidenceExists: true` /
// `evidenceInvalidated: false` (`packages/rph-assurance/src/floor.ts:322-323`). So no path can ever refuse Evidence.
//
// The fixture is SCHEMA-VALID on purpose: ProposeEvidencePayloadSchema types scope as z.string(), so '' satisfies
// the contract and reaches the handler carrying an unstated scope. The proposal is asserted ACCEPTED before the
// admission is attempted, so the red below is the real defect — a command that succeeded when §8.11 requires
// refusal — and not a payload-shape or fixture error.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { evidenceAdmissibility } from '@janumipwb/rph-assurance';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const human = { actorId: 'gov-1', actorType: 'HUMAN' as const, displayName: 'Governor' };
const EV = 'evd_01ARZ3NDEKTSV4RRFFQ69G5FD1';

describe('AdmitEvidence enforces §8.11 admissibility at the call site (live)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `evt_${++seq}` });
	});

	function dispatch(commandType: string, payload: unknown, over: Partial<DomainCommand> = {}) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'EVIDENCE',
			targetAggregateId: EV,
			issuedAt: TS,
			issuedBy: human,
			correlationId: 'corr-1',
			idempotencyKey: `idem-${n}`,
			payload,
			...over
		};
		return engine.dispatch(command);
	}

	function statusOf(id: string, field = 'status'): string {
		return (store.loadObject(id)?.state as Record<string, string>)[field] ?? '';
	}

	// Evidence with no stated scope — the §8.11:1027 condition "scope and limitations are explicit" is absent.
	// Everything else is well-formed so the ONLY thing that can refuse this Evidence is an admissibility evaluation.
	const INADMISSIBLE = {
		evidenceId: EV,
		evidenceType: 'TEST_RESULT',
		contentReference: {},
		producedBy: human,
		supportsClaimIds: [],
		contradictsClaimIds: [],
		scope: '',
		limitations: [],
		capturedAt: TS
	};

	function proposeInadmissible() {
		const r = dispatch('ProposeEvidence', INADMISSIBLE);
		// Guards the red: if the proposal itself were refused the admission gate would never be exercised and a
		// "rejected" result below would prove nothing.
		expect(r.status).toBe('ACCEPTED');
		expect(statusOf(EV)).toBe('PROPOSED');
	}

	it('the kernel already knows this Evidence is inadmissible — nothing in the pipeline asks it', () => {
		const verdict = evidenceAdmissibility(
			{ id: EV, provenance: human, contentReference: {}, scope: '', limitations: [] },
			{}
		);
		expect(verdict.admissible).toBe(false);
		expect(verdict.failed).toContain('SCOPE_STATED');
	});

	it('refuses to admit Evidence whose scope is not stated (§8.11:1027)', () => {
		proposeInadmissible();

		const r = dispatch('AdmitEvidence', {
			admissibilityAssessmentId: 'a',
			admittedScope: 'architecture',
			admittedClaimIds: []
		});

		// The admitted scope is asserted by the CALLER, not read off the Evidence — the handler must not take the
		// caller's word for a condition §8.11 makes a property of the Evidence itself.
		expect(r.status).not.toBe('ACCEPTED');
	});

	it('leaves inadmissible Evidence in PROPOSED — admission is not a bare status advance (§8.11:1027)', () => {
		proposeInadmissible();

		dispatch('AdmitEvidence', {
			admissibilityAssessmentId: 'a',
			admittedScope: 'architecture',
			admittedClaimIds: []
		});

		// ADMISSIBLE here is the durable lie: the object now carries a status that §8.11 says it cannot hold, and
		// every downstream consumer (Claims, Assessments, Baseline readiness) reads that status as settled.
		expect(statusOf(EV)).toBe('PROPOSED');
	});
});
