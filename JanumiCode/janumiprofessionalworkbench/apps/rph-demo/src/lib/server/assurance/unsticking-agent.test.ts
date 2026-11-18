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
			earlier: [{ id: 'art_dx0', kind: 'fault-diagnosis', text: '{"named":"pwu_src"}' }],
			// ⭐ L17b3 (D89) — arrangement: the prompt is handed the record's files, none here; `L17b3 (D89)` below holds what it says of them.
			recordFiles: []
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

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`REG-D-173` (5)): on a recurrence, the Unsticking Agent is given the recorded conversations of
	// the rejected unit and of each unit the recurrence names, files in its copy as the Hypothesizer's are, named in its prompt after the earlier rounds;
	// the words are the builder's (`l17b3-facts.md` §4.2), the Hypothesizer's own.
	it('⛔ RED FIRST — L17b3 (D89): it names the recorded conversation of the rejected unit and of each unit the recurrence names, a file in its copy; and says where none was written', () => {
		const args = {
			rejectedUnit: { id: 'pwu_ver', title: 'Verification' },
			recurrence: [{ id: 'obs_1', statement: 'The standard-input mode fails again, as it did in the round before.' }],
			narrative: [],
			earlier: []
		};
		const HEADING = 'The recorded conversations of these units’ work, as the Governed Stream recorded them, each a file in your copy of the workspace:';
		const prompt = unstickingPrompt({
			...args,
			recordFiles: [
				{ unitId: 'pwu_ver', title: 'Verification', file: '.jpwb/record/verification--pwu_ver.md' },
				{ unitId: 'pwu_src', title: 'Source', file: '.jpwb/record/source--pwu_src.md' }
			]
		});
		for (const part of [
			'- pwu_ver "Verification": .jpwb/record/verification--pwu_ver.md',
			`${HEADING}\n- pwu_ver "Verification": .jpwb/record/verification--pwu_ver.md\n- pwu_src "Source": .jpwb/record/source--pwu_src.md\n\nReply with ONE JSON object`
		])
			expect(prompt, `the prompt does not name the record’s files: ${part}`).toContain(part);
		expect(unstickingPrompt({ ...args, recordFiles: [] }), 'a prompt given no record file does not say none was written').toContain(`${HEADING}\n- (none recorded)`);
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
