// REG-F-021 INCREMENT 1 — the four contracts the restored §30 machine needs, and the provenance distinction
// between them that a previous draft of the design got wrong.
//
// ── WHAT INCREMENT 1 IS ───────────────────────────────────────────────────────────────────────────────────────
// Two events and two commands, DECLARED and BOUND before any handler emits them. Declaring ahead of emitting is
// deliberate: it makes the interval in which the corpus names an event the engine cannot produce COUNTABLE, which
// is precisely what `event-surface-census.test.ts` measures. Building contract and handler together would hide it.
//
// ── THE PART THAT IS NOT BOILERPLATE ──────────────────────────────────────────────────────────────────────────
// The two events are NOT on equal footing, and flattening them is a mistake this repository already made once.
// DOC-004 §31 carries a ruling — "ratified names here but schematized nowhere ... a schema-and-wiring task, NOT a
// ratification decision" — and the design first read it as covering both new events. It does not. That paragraph's
// subject is the §38 missing-evidence field, and its "Both events" means AssuranceEvidenceRequired +
// AssuranceEvidenceReceived. `AssuranceEvaluatorSelected` appears NOWHERE in it.
//
// So one event is authored under an explicit corpus blessing and the other is authored on the ordinary standing
// grant with none. The tests below PIN that difference in the vocab, because the failure mode is not a crash: it
// is a `sourceSection` that quietly claims more authority than it has, which nothing else in the pipeline checks.
import { COMMANDS, EVENTS } from '@janumipwb/rph-contracts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

interface Vocab {
	commands?: { commandType: string; sourceSection?: string }[];
	events?: { eventType: string; sourceSection?: string }[];
	bindings?: { commandType?: string; eventType?: string; from?: string; to?: string }[];
}

const vocab = JSON.parse(
	readFileSync(`${REPO_ROOT}packages/rph-contracts/vocab/m3-commands-events.json`, 'utf8')
) as Vocab;

const eventEntry = (t: string) => (vocab.events ?? []).find((e) => e.eventType === t);
const commandEntry = (t: string) => (vocab.commands ?? []).find((c) => c.commandType === t);

/** The §31 ruling, quoted the way the corpus writes it. Matching on the distinctive clause rather than the whole
 *  sentence so a reworded citation still counts as a citation. */
const RULING_CLAUSE = 'schematized nowhere';

const NEW_EVENTS = ['AssuranceEvidenceRequired', 'AssuranceEvaluatorSelected'];
const NEW_COMMANDS = ['SelectAssuranceEvaluator', 'BeginAssuranceAssessment'];

describe('REG-F-021 increment 1: the assessment lifecycle contracts', () => {
	it('CONTROL: the vocab is loaded and already holds the sibling this increment is modelled on', () => {
		// If the vocab failed to parse or the path were wrong, every "is declared" assertion below would be
		// asserting against an empty list and would fail for the wrong reason.
		expect(eventEntry('AssuranceEvidenceReceived')).toBeDefined();
		expect(commandEntry('SubmitEvidenceForAssessment')).toBeDefined();
	});

	it('both events are DECLARED with payload contracts', () => {
		for (const e of NEW_EVENTS) {
			expect(Object.keys(EVENTS), `${e} must be a declared event`).toContain(e);
			expect(eventEntry(e), `${e} must have a vocab entry`).toBeDefined();
		}
	});

	it('both commands are DECLARED with payload contracts', () => {
		for (const c of NEW_COMMANDS) {
			expect(Object.keys(COMMANDS), `${c} must be a declared command`).toContain(c);
			expect(commandEntry(c), `${c} must have a vocab entry`).toBeDefined();
		}
	});

	// THE ARROWS, read from the binding table rather than from prose. The §30 machine says READY -> ASSESSING is
	// "selectAssuranceEvaluator (AssuranceEvaluatorSelected) THEN beginAssuranceAssessment
	// (AssuranceAssessmentStarted)" — TWO acts, ONE arrow, and only the second moves the machine.
	it('the two acts of the READY -> ASSESSING arrow are bound, and only ONE of them moves the machine', () => {
		const select = (vocab.bindings ?? []).find(
			(b) => b.commandType === 'SelectAssuranceEvaluator'
		);
		const begin = (vocab.bindings ?? []).find((b) => b.commandType === 'BeginAssuranceAssessment');
		expect(select, 'SelectAssuranceEvaluator must be bound').toBeDefined();
		expect(begin, 'BeginAssuranceAssessment must be bound').toBeDefined();
		expect([select?.from, select?.to], 'selecting an evaluator records a fact; it does not advance').toEqual([
			'READY',
			'READY'
		]);
		expect([begin?.from, begin?.to], 'beginning is the half that advances').toEqual([
			'READY',
			'ASSESSING'
		]);
	});

	it('the REQUESTED -> EVIDENCE_PENDING arrow is bound to the request, which therefore emits TWO events', () => {
		const b = (vocab.bindings ?? []).find((x) => x.eventType === 'AssuranceEvidenceRequired');
		expect(b?.commandType).toBe('RequestAssuranceAssessment');
		expect([b?.from, b?.to]).toEqual(['REQUESTED', 'EVIDENCE_PENDING']);
		// The same command is separately bound to AssuranceAssessmentRequested. One command, two events — legal at
		// the storage layer (CommitInput.events is an array) and not yet expressible through kit.ts's commitState,
		// which increment 3 extends. Asserted so the two-event requirement is a recorded fact rather than a
		// surprise discovered while implementing.
		const requested = (vocab.bindings ?? []).find(
			(x) => x.eventType === 'AssuranceAssessmentRequested'
		);
		expect(requested?.commandType).toBe('RequestAssuranceAssessment');
	});

	// ── THE PROVENANCE PIN ────────────────────────────────────────────────────────────────────────────────────
	it('AssuranceEvidenceRequired CITES the §31 ruling — it is one of the two events that ruling names', () => {
		const s = eventEntry('AssuranceEvidenceRequired')?.sourceSection ?? '';
		expect(s).toContain(RULING_CLAUSE);
		expect(s, 'the ruling is what makes this a wiring task rather than a ratification question').toContain(
			'NOT a ratification decision'
		);
	});

	it('AssuranceEvaluatorSelected must NOT claim the §31 ruling — no corpus ruling covers its schema', () => {
		const s = eventEntry('AssuranceEvaluatorSelected')?.sourceSection ?? '';
		expect(s, 'the entry must exist to be checked').not.toBe('');
		// It may DISCUSS the ruling (and does, to warn the reader off it). What it must not do is cite it as its
		// own authority. The distinguishing string is the explicit denial.
		expect(
			s,
			'this event is authored on the ordinary standing grant. Recording it as covered by §31 would be ' +
				'borrowing authority from a paragraph that does not name it — the precise error the design made ' +
				'before an adversarial verifier caught it'
		).toContain('NO CORPUS RULING COVERS');
	});

	it('both new events are declared UNRATIFIED-AUTHORED — the NAME is ratified, the SHAPE is ours', () => {
		for (const e of NEW_EVENTS) {
			const s = eventEntry(e)?.sourceSection ?? '';
			expect(s, `${e} must disclose that its schema is authored`).toContain('UNRATIFIED-AUTHORED');
			expect(s, `${e} must cite the corpus for its NAME`).toContain('31');
		}
		for (const c of NEW_COMMANDS) {
			const s = commandEntry(c)?.sourceSection ?? '';
			expect(s, `${c} must disclose that its schema is authored`).toContain('UNRATIFIED-AUTHORED');
			expect(s, `${c} must cite DOC-004 §32 for its NAME`).toContain('32');
		}
	});

	// The citation this session found broken in six artifacts: the ruling is at L1783-1785, not L1770.
	it('no new entry repeats the broken §31 L1770 citation', () => {
		for (const t of [...NEW_EVENTS, ...NEW_COMMANDS]) {
			const s = eventEntry(t)?.sourceSection ?? commandEntry(t)?.sourceSection ?? '';
			expect(s, `${t} must not cite L1770 — the ruling is at L1783-1785`).not.toContain('L1770');
		}
	});
});
