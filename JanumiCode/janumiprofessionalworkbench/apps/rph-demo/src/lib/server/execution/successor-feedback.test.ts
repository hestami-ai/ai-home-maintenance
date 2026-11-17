// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D77 with its amendment and D87 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.31, §12.41;
// `REG-D-166` (4); `REG-D-167` (2)) — HOLISTIC FEEDBACK: WHAT EACH SUCCESSOR'S FIRST TURN, AND D71's RE-RUN IN PLACE, CARRY AFTER THE INSTRUCTION; AND THE
// TACTIC RECORD, read, recorded and overwritten before the deliverable view is taken, which leaves its folder out besides.
//
// ⭑ WHAT MUST HOLD (D77; the lead's rulings on readings 17 and 18, and option D): every successor's turn carries the narrative, chapter by chapter;
// the faulty unit's successor's also the round's failed criteria, the diagnosis and beside it the guidance (advice, changing nothing of a unit's
// definition, outputs or criteria), the step-back where one is recorded, the two slots package L17b2 fills — rendered only when handed in — and
// the request to write its tactic record; each other successor's, the line that it is redone because a unit its work used was replaced; D71's
// re-run in place, the same parts after its findings. A part with nothing recorded is left out whole.
// ⭑ PURE where it can be: the renderer over parts the case writes; the tactic take over an in-memory workspace and the real content store, its
// batch captured. The successor's place in its replacement, and the turn through the page, are `assurance-stage.route.test.ts`'s.
import { createInMemoryArtifactStore, createInMemoryWorkspace } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import { FEEDBACK_HEADING } from './executor-session.js';
import { deliverableFiles, isTacticRecordPath, TACTIC_RECORD_FOLDER, takeManifest } from './deliverable-view.js';
import {
	successorFeedback,
	tacticRecordNotice,
	tacticRecordPath,
	tacticRecordRequest,
	takeTacticRecord,
	type ChapterForTurn,
	type DiagnosisForTurn,
	type StepBackForTurn
} from './successor-feedback.js';

const CHAPTERS: readonly ChapterForTurn[] = [
	{
		id: 'art_ch1',
		failing: false,
		statements: [
			{ text: 'Source was accepted, then End-to-End Verification was rejected for the standard-input mode.', cites: ['pwu_src', 'asm_cov'] },
			{ text: 'The rejection names a reader that cannot read a pipe.', cites: ['asm_cov'] }
		]
	},
	{ id: 'art_ch2', failing: true, statements: [] }
];
const DIAGNOSIS: DiagnosisForTurn = {
	id: 'art_dx',
	hypotheses: [
		{ candidate: 'pwu_src', statement: 'Source’s reader treats a pipe as a file.' },
		{ candidate: null, statement: 'The verification’s harness may close standard input early.' }
	],
	named: 'pwu_src',
	confidence: 'fairly sure: the reader fails alone, outside the harness',
	guidance: 'Build the reader in parts and check each against a pipe before the whole.'
};
const STEP_BACK: StepBackForTurn = {
	id: 'art_sb',
	questions: [{ reconsider: 'the reader', question: 'What does the reader assume about its input that a pipe does not give?' }],
	facts: [{ fact: 'The reader calls fstat before it reads.', source: 'src/reader.ts' }]
};
const CRITERIA = [{ code: 'RC-01', statement: 'The standard-input mode exits 1: the reader cannot read a pipe.' }];
const PATH = tacticRecordPath('Source', 'pwu_new');

/** The narrative block every turn carrying it opens with: the heading line, then each chapter, a failing one named. */
const NARRATIVE_LINES = [
	'',
	'The loop so far — the narrative memory of this Undertaking, chapter by chapter, each statement with the records it rests on:',
	'Chapter art_ch1:',
	'- Source was accepted, then End-to-End Verification was rejected for the standard-input mode. [pwu_src, asm_cov]',
	'- The rejection names a reader that cannot read a pipe. [asm_cov]',
	'Chapter art_ch2 failed its check, so its statements are left out: judge from the records.'
];

describe('⭐⭐ L17b1 (D77, D87) — the faulty unit’s successor’s first turn, its parts in order', () => {
	it('⛔ RED FIRST — the narrative; the round’s failed criteria; the diagnosis and beside it its guidance, as advice; the step-back; then the request for its tactic record', () => {
		const feedback = successorFeedback({
			for: { kind: 'FAULTY_SUCCESSOR', failedCriteria: CRITERIA, tacticRecordPath: PATH },
			chapters: CHAPTERS,
			diagnosis: DIAGNOSIS,
			stepBack: STEP_BACK
		});

		expect(feedback?.text, 'the turn’s parts are not D77’s, in its order').toBe(
			[
				FEEDBACK_HEADING,
				...NARRATIVE_LINES,
				'',
				'The criteria the review that rejected the work found not met, each with its rationale:',
				'- RC-01: The standard-input mode exits 1: the reader cannot read a pipe.',
				'',
				'The diagnosis (art_dx) — advice, not a verdict:',
				'- Source’s reader treats a pipe as a file. (points to pwu_src)',
				'- The verification’s harness may close standard input early.',
				'It names pwu_src as the unit whose work most likely holds the fault.',
				'How sure it is: fairly sure: the reader fails alone, outside the harness',
				'',
				'Its guidance on how you might proceed — advice only, which changes nothing of this unit’s definition, its outputs or its criteria:',
				'Build the reader in parts and check each against a pipe before the whole.',
				'',
				'The step-back (art_sb) — questions and facts to help you reconsider, never what to do:',
				'- (the reader) What does the reader assume about its input that a pipe does not give?',
				'- Fact: The reader calls fstat before it reads. (source: src/reader.ts)',
				'',
				tacticRecordRequest(PATH)
			].join('\n')
		);
		expect(feedback?.crossUnit, 'the turn is not said to carry another unit’s findings (REG-D-170)').toBe(true);
	});

	it('⛔ RED FIRST — the two parts package L17b2 fills are rendered only when handed in, after the step-back and before the request; absent, nothing', () => {
		const without = successorFeedback({ for: { kind: 'FAULTY_SUCCESSOR', failedCriteria: CRITERIA, tacticRecordPath: PATH }, chapters: CHAPTERS });
		const withBoth = successorFeedback({
			for: { kind: 'FAULTY_SUCCESSOR', failedCriteria: CRITERIA, tacticRecordPath: PATH },
			chapters: CHAPTERS,
			historianJudgment: 'The loop is converging: one criterion remains.',
			reshapeReason: 'Split the reader from the counter.'
		});

		expect(without?.text, 'a slot rendered with nothing handed in').not.toContain('Historian');
		expect(withBoth?.text, 'the slots are not rendered in their place, after the criteria and before the request').toBe(
			[
				without!.text.slice(0, without!.text.lastIndexOf(`\n\n${tacticRecordRequest(PATH)}`)),
				'',
				'The Historian’s judgment of the loop:',
				'The loop is converging: one criterion remains.',
				'',
				'Why the Historian recommends reshaping how this unit’s work is done — feedback only; the unit’s definition does not change:',
				'Split the reader from the counter.',
				'',
				tacticRecordRequest(PATH)
			].join('\n')
		);
	});

	it('⭑ CONTROL (D87) — a diagnosis with no guidance carries no guidance part: the turn is D77’s alone', () => {
		const feedback = successorFeedback({
			for: { kind: 'FAULTY_SUCCESSOR', failedCriteria: CRITERIA, tacticRecordPath: PATH },
			chapters: [],
			diagnosis: { ...DIAGNOSIS, guidance: '' }
		});
		expect(feedback?.text, 'a guidance part was rendered with no guidance recorded').not.toContain('Its guidance');
		expect(feedback?.text, 'the narrative was rendered with no chapter recorded').not.toContain('The loop so far');
	});
});

describe('⭐⭐ L17b1 (D77) — every other successor, and D71’s re-run in place', () => {
	it('⛔ RED FIRST — each other successor: the narrative, then the line that it is redone because a unit its work used was replaced, naming that unit and the Decision; no tactic request', () => {
		const feedback = successorFeedback({
			for: { kind: 'OTHER_SUCCESSOR', replaced: { title: 'Source', unitId: 'pwu_src' }, decisionId: 'dec_1' },
			chapters: CHAPTERS
		});

		expect(feedback?.text, 'the other successor’s turn is not the narrative and the line').toBe(
			[
				FEEDBACK_HEADING,
				...NARRATIVE_LINES,
				'',
				'This unit is redone because a unit its work used was replaced: "Source" (pwu_src), under the person’s Decision dec_1.'
			].join('\n')
		);
		expect(feedback?.text, 'another successor was asked for a tactic record').not.toContain('tactic record');
	});

	it('⛔ RED FIRST — where the faulty unit could not be told, each successor is told so, as another successor is', () => {
		const feedback = successorFeedback({ for: { kind: 'OTHER_SUCCESSOR', replaced: undefined, decisionId: 'dec_1' }, chapters: [] });
		expect(feedback?.text, 'the turn does not say which unit held the fault is not recorded').toBe(
			[
				FEEDBACK_HEADING,
				'',
				'This unit is redone because units its work used were replaced, under the person’s Decision dec_1; which of them held the fault the record does not say.'
			].join('\n')
		);
	});

	it('⛔ RED FIRST — D71’s re-run in place: the same parts, its failed criteria not repeated (its findings are them), and the request for its tactic record', () => {
		const feedback = successorFeedback({
			for: { kind: 'RERUN_IN_PLACE', tacticRecordPath: PATH },
			chapters: CHAPTERS,
			diagnosis: DIAGNOSIS
		});

		expect(feedback?.text.startsWith([FEEDBACK_HEADING, ...NARRATIVE_LINES, '', 'The diagnosis (art_dx) — advice, not a verdict:'].join('\n')), 'the re-run’s parts are not the narrative, then the diagnosis').toBe(true);
		expect(feedback?.text, 'the re-run repeated the failed criteria').not.toContain('found not met');
		expect(feedback?.text.endsWith(`\n\n${tacticRecordRequest(PATH)}`), 'the re-run is not asked for its tactic record').toBe(true);
	});

	it('⛔ RED FIRST — the narrative is another unit’s material: a turn carrying it alone is said to carry it, so it declares findings at THIS_UNDERTAKING (REG-D-170)', () => {
		const other = successorFeedback({ for: { kind: 'OTHER_SUCCESSOR', replaced: { title: 'Source', unitId: 'pwu_src' }, decisionId: 'dec_1' }, chapters: CHAPTERS });
		const rerun = successorFeedback({ for: { kind: 'RERUN_IN_PLACE', tacticRecordPath: PATH }, chapters: CHAPTERS });
		expect([other?.crossUnit, rerun?.crossUnit], 'a turn carrying the narrative alone is not said to carry another unit’s material').toEqual([true, true]);
	});

	it('⭑ CONTROL — with nothing recorded, no feedback: the turn is as before, byte for byte', () => {
		expect(successorFeedback({ for: { kind: 'RERUN_IN_PLACE', tacticRecordPath: PATH }, chapters: [] }), 'feedback with nothing recorded').toBeUndefined();
	});
});

describe('⭐⭐ L17b1 (D77, option D) — the tactic record: read, recorded and overwritten before the view; its folder left out of every view', () => {
	const harness = () => {
		const store = createInMemoryArtifactStore();
		const workspace = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		const steps: (readonly [string, string, string, Record<string, unknown>])[] = [];
		let n = 0;
		const deps = {
			store,
			tenantPrefix: 'tnt-test',
			newId: (prefix: string) => `${prefix}_${++n}`,
			now: () => '2026-11-16T10:00:00Z',
			runSteps: (s: readonly (readonly [string, string, string, Record<string, unknown>])[]) => {
				steps.push(...s);
				return null;
			}
		};
		const take = (atStart: string | undefined, stepEnded: boolean) =>
			takeTacticRecord(deps, {
				workspace,
				path: PATH,
				unitId: 'pwu_new',
				undertakingId: 'und_1',
				roundId: 'asm_cov',
				attemptKey: 'step_1#1',
				producerModelId: 'faux-model',
				atStart,
				stepEnded
			});
		return { store, workspace, steps, take };
	};
	const RECORD = JSON.stringify({
		priorTactic: 'one pass over the whole file',
		whatItProduced: 'a reader that cannot read a pipe',
		whyChange: 'the verification ran it on a pipe',
		newTactic: 'read in chunks from the stream',
		expectedImprovement: 'the standard-input mode exits 0'
	});

	it('⛔ RED FIRST — its path is `.jpwb/tactic/<slug>--<unit id>.json`, the slug D69’s, and the request names it', () => {
		expect(tacticRecordPath('Source Construction', 'pwu_1'), 'the path is not D77’s').toBe('.jpwb/tactic/source-construction--pwu_1.json');
		expect(tacticRecordRequest(PATH), 'the request does not name the path').toContain(PATH);
		expect([TACTIC_RECORD_FOLDER, isTacticRecordPath(PATH), isTacticRecordPath('.jpwb/tactics.json')], 'the folder is not the path’s').toEqual([
			'.jpwb/tactic',
			true,
			false
		]);
	});

	it('⛔ RED FIRST — a record the step wrote is recorded as a tactic-record artifact, its SOURCE evidence naming the unit, the round and the attempt, and the file overwritten with a notice', async () => {
		const h = harness();
		await h.workspace.writeFile(PATH, RECORD);

		const took = await h.take(undefined, false);

		expect(took?.part, 'the record was not taken as a tactic record').toBe('tactic-record');
		const [artifact, evidence] = h.steps;
		expect([artifact?.[0], artifact?.[3].artifactType, artifact?.[3].status], 'the artifact is not a recorded tactic record').toEqual([
			'RecordArtifact',
			'tactic-record',
			'recorded'
		]);
		expect(
			['producingPwuId' in artifact![3], 'producingExecutionAttemptId' in artifact![3]],
			'the artifact names a producing unit or attempt, which readers count as a try’s work product'
		).toEqual([false, false]);
		const stage = (evidence?.[3].contentReference as { stage?: Record<string, unknown> } | undefined)?.stage;
		expect([evidence?.[0], stage], 'the evidence does not name the part, the round, the unit and the attempt').toEqual([
			'ProposeEvidence',
			{ part: 'tactic-record', round: 'asm_cov', undertakingId: 'und_1', unitId: 'pwu_new', status: 'recorded', attempt: 'step_1#1' }
		]);
		expect(await h.store.get(String(artifact?.[3].storageKey)), 'the content plane does not hold the record as written').toBe(RECORD);
		expect(await h.workspace.readFile(PATH), 'the file was not overwritten with the notice').toBe(tacticRecordNotice(took!.artifactId!));
	});

	it('⛔ RED FIRST — not yet written, nothing is taken; at the step’s end its absence is a finding, recorded, and the step goes on', async () => {
		const h = harness();
		expect([await h.take(undefined, false), h.steps.length], 'a record was taken before one was written').toEqual([undefined, 0]);

		const took = await h.take(undefined, true);

		expect([took?.part, took?.why], 'its absence is not a finding, said').toEqual([
			'tactic-record-finding',
			`no tactic record was written at ${PATH} while this step ran`
		]);
		expect(h.steps[0]?.[3].status, 'the finding is not recorded as failing').toBe('failing');
		expect(await h.workspace.readFile(PATH), 'a file was written where none was').toBeUndefined();
	});

	it('⛔ RED FIRST — a record that is not one JSON object is a finding holding its text, and is overwritten too', async () => {
		const h = harness();
		await h.workspace.writeFile(PATH, 'I changed my approach.');

		const took = await h.take(undefined, false);

		expect(took?.part, 'an unreadable record was taken as a record').toBe('tactic-record-finding');
		const held = JSON.parse((await h.store.get(String(h.steps[0]?.[3].storageKey))) ?? '{}') as Record<string, unknown>;
		expect([held.path, held.text], 'the finding does not hold the path and the text').toEqual([PATH, 'I changed my approach.']);
		expect(await h.workspace.readFile(PATH), 'the unreadable record was left for the reviews').toBe(tacticRecordNotice(took!.artifactId!));
	});

	it('⭑ CONTROL — an earlier step’s notice is never read as this step’s record', async () => {
		const h = harness();
		const notice = tacticRecordNotice('art_earlier');
		await h.workspace.writeFile(PATH, notice);
		expect(await h.take(notice, false), 'the notice was taken as a record').toBeUndefined();
		expect((await h.take(notice, true))?.part, 'a step that wrote no record was not given the finding').toBe('tactic-record-finding');
	});

	it('⛔ RED FIRST — the tactic folder is left out of a view whatever its casing: a disk that keeps `.JPWB/TACTIC/` lists it so (the review’s defect 2)', async () => {
		expect(
			[isTacticRecordPath('.JPWB/TACTIC/source--pwu_1.json'), isTacticRecordPath('.Jpwb/Tactic'), isTacticRecordPath('.JPWB/TACTICS.json')],
			'the folder is told apart by its casing'
		).toEqual([true, true, false]);
		const workspace = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		const baseline = await takeManifest(workspace);
		await workspace.writeFile('src/reader.ts', 'export {};');
		await workspace.writeFile('.JPWB/TACTIC/source--pwu_1.json', RECORD);

		const files = deliverableFiles(baseline, await takeManifest(workspace));

		expect(files.map((f) => f.path), 'a view lists the tactic folder spelled in capitals').toEqual(['src/reader.ts']);
	});

	it('⛔ RED FIRST — a take whose record the store refuses is no take, said, the file left for a later take; a notice not written is said, and recorded as a finding (the review’s defect 7)', async () => {
		const store = createInMemoryArtifactStore();
		const steps: (readonly [string, string, string, Record<string, unknown>])[] = [];
		let n = 0;
		const deps = {
			store,
			tenantPrefix: 'tnt-test',
			newId: (prefix: string) => `${prefix}_${++n}`,
			now: () => '2026-11-16T10:00:00Z',
			runSteps: (s: readonly (readonly [string, string, string, Record<string, unknown>])[]): string | null => {
				steps.push(...s);
				return null;
			}
		};
		const inner = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		let readOnly = false;
		const workspace = {
			...inner,
			writeFile: async (path: string, contents: string) =>
				readOnly ? { written: false as const, refusedBecause: 'the file is read-only' } : inner.writeFile(path, contents)
		};
		const take = (d: typeof deps) =>
			takeTacticRecord(d, {
				workspace,
				path: PATH,
				unitId: 'pwu_new',
				undertakingId: 'und_1',
				roundId: 'asm_cov',
				attemptKey: 'step_1#1',
				producerModelId: 'faux-model',
				atStart: undefined,
				stepEnded: false
			});
		await workspace.writeFile(PATH, RECORD);

		const refused = await take({ ...deps, runSteps: () => 'REJECTED: the store refused the batch' });

		expect([refused?.recorded, refused?.failure], 'a take the store refused counted as a take').toEqual([
			false,
			'its record was refused: REJECTED: the store refused the batch'
		]);
		expect(await workspace.readFile(PATH), 'the record was overwritten though it is on no record').toBe(RECORD);

		readOnly = true;
		const unnoticed = await take(deps);

		expect([unnoticed?.recorded, unnoticed?.failure], 'a notice not written is not said').toEqual([
			true,
			'the notice could not be written: the file is read-only'
		]);
		expect(
			steps.filter((s) => s[0] === 'RecordArtifact').map((s) => s[3].artifactType),
			'the notice’s failure is not recorded as a finding beside the record'
		).toEqual(['tactic-record', 'tactic-record-finding']);
	});

	it('⛔ RED FIRST — a finding the store refuses joins the take’s failure: a notice not written, and the finding that says so not recorded, both said (the review’s re-check, C)', async () => {
		const store = createInMemoryArtifactStore();
		let n = 0;
		let batches = 0;
		const deps = {
			store,
			tenantPrefix: 'tnt-test',
			newId: (prefix: string) => `${prefix}_${++n}`,
			now: () => '2026-11-16T10:00:00Z',
			// ⭑ The record's batch is taken; the next, the finding that its notice was not written, is refused.
			runSteps: (): string | null => (++batches === 1 ? null : 'REJECTED: the store refused the finding')
		};
		const inner = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		await inner.writeFile(PATH, RECORD);
		const workspace = {
			...inner,
			writeFile: async (path: string, contents: string) =>
				path === PATH ? { written: false as const, refusedBecause: 'the file is read-only' } : inner.writeFile(path, contents)
		};

		const took = await takeTacticRecord(deps, {
			workspace,
			path: PATH,
			unitId: 'pwu_new',
			undertakingId: 'und_1',
			roundId: 'asm_cov',
			attemptKey: 'step_1#1',
			producerModelId: 'faux-model',
			atStart: undefined,
			stepEnded: false
		});

		expect([took?.recorded, batches], 'arrangement: the record was taken, and the finding’s batch tried').toEqual([true, 2]);
		expect(took?.failure ?? '', 'a finding the store refused is not said').toBe(
			'the notice could not be written: the file is read-only; and the finding that says so could not be recorded: REJECTED: the store refused the finding'
		);
	});

	it('⛔ RED FIRST — every deliverable view leaves `.jpwb/tactic/` out, the notice in its place included', async () => {
		const workspace = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		const baseline = await takeManifest(workspace);
		await workspace.writeFile('src/reader.ts', 'export {};');
		await workspace.writeFile(PATH, tacticRecordNotice('art_1'));
		await workspace.writeFile('.jpwb/tactic/other--pwu_x.json', RECORD);

		const files = deliverableFiles(baseline, await takeManifest(workspace));

		expect(files.map((f) => f.path), 'a view lists a tactic record').toEqual(['src/reader.ts']);
	});
});
