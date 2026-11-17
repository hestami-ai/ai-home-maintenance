// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D75 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.29; `REG-D-166` (3), (6)) — THE UNSTICKING
// AGENT'S PROMPT AND THE READER OF ITS ANSWER.
//
// ⭑ WHAT MUST HOLD (D75; the legacy specification's §8.6): it never tells the stuck worker what to do; it asks questions that help it step back, and
// gives facts it finds, each with its source. It is given the recurrence in the Historian's words, the narrative so far, and the earlier rounds'
// diagnoses and tactic records. When it runs — only on an open `KNOWN_FAILURE_RECURRENCE` — is the stage's own test's.
import { describe, expect, it } from 'vitest';
import { readStepBack, STEP_BACK_FORM, unstickingPrompt } from './unsticking-agent.js';

describe('⭐⭐ L17b1 (D75) — the Unsticking Agent’s prompt and answer', () => {
	it('⛔ RED FIRST — the prompt holds the recurrence, the rule that it never says what to do, the narrative, the earlier rounds, and the form', () => {
		const prompt = unstickingPrompt({
			rejectedUnit: { id: 'pwu_ver', title: 'Verification' },
			recurrence: [{ id: 'obs_1', statement: 'The standard-input mode fails again, as it did in the round before.' }],
			narrative: [{ id: 'art_ch1', failing: false, statements: [{ text: 'Source was replaced once.', cites: ['dec_1'] }] }],
			earlier: [{ id: 'art_dx0', kind: 'fault-diagnosis', text: '{"named":"pwu_src"}' }]
		});

		for (const part of [
			'The work of "Verification"',
			'- [obs_1] The standard-input mode fails again, as it did in the round before.',
			'You never tell the worker what to do.',
			'Chapter art_ch1:\n- Source was replaced once. [dec_1]',
			'- [art_dx0] fault-diagnosis: {"named":"pwu_src"}',
			STEP_BACK_FORM
		])
			expect(prompt, `the prompt does not hold: ${part}`).toContain(part);
	});

	it('⛔ RED FIRST — the answer’s questions and facts are read, each fact with its source; an answer that is not one JSON object is not read', () => {
		expect(
			readStepBack(
				JSON.stringify({
					questions: [{ reconsider: 'the reader', question: 'What does the reader assume about a pipe?' }],
					facts: [{ fact: 'The reader calls fstat first.', source: 'src/reader.ts' }]
				})
			),
			'the step-back is not read whole'
		).toEqual({
			ok: true,
			stepBack: {
				questions: [{ reconsider: 'the reader', question: 'What does the reader assume about a pipe?' }],
				facts: [{ fact: 'The reader calls fstat first.', source: 'src/reader.ts' }]
			}
		});
		expect(readStepBack('Try reading in chunks.'), 'prose was read as a step-back').toEqual({ ok: false, why: 'the answer does not parse as one JSON object' });
	});
});
