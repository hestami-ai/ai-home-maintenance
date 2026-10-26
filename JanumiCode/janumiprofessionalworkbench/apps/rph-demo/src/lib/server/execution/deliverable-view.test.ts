// ⭐⭐ `JAN-EXEC` Phase 7, package N — D9, D10 (`REG-D-135` (1); `REG-F-522` remedy candidate 2) — THE HOST'S VIEW OF WHAT A
// UNIT DELIVERED: the manifest through the workspace port, the files changed between two manifests, the step's one host
// sequence sliced by try, and the view recorded on the content plane and read back from it (RD7).
import { createInMemoryArtifactStore, createInMemoryWorkspace } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import {
	admittedViewRef,
	baselineNameOf,
	changedFiles,
	DELIVERABLE_BASELINE_SCHEMA,
	hostSequenceOf,
	namedViewOf,
	readDeliverableView,
	recordDeliverableView,
	runsOfTry,
	sequenceCount,
	takeManifest,
	unitBaselineOf,
	viewNameOf
} from './deliverable-view.js';

const workspace = () =>
	createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_n', purgeability: 'RETAINED_BY_PARTICIPATION' });

const aRun = (argv: string[]) =>
	({
		argv,
		exitCode: 0,
		timedOut: false,
		durationMs: 1,
		outputComplete: true,
		omittedRegions: [],
		retention: { retained: false, notRetainedBecause: 'a fixture' },
		stdout: '',
		stderr: ''
	}) as const;

describe('⭐⭐ package N — D10: the files a unit changed, between the manifests the host takes through the port', () => {
	it('⭐ ADDED, CHANGED and REMOVED, in path order, each changed or added file with the text the host read — an unchanged file not at all', async () => {
		const ws = workspace();
		await ws.writeFile('a/kept.md', 'same\n');
		await ws.writeFile('b/edited.js', "'use strict';\n");
		const before = await takeManifest(ws);
		await ws.writeFile('b/edited.js', 'export {};\n');
		await ws.writeFile('c/new.md', '# New\n');
		const after = new Map(await takeManifest(ws));
		// ⚠ The port cannot delete a participating file, so a removal is arranged on the manifest: a path `after` lacks.
		after.delete('a/kept.md');
		expect(changedFiles(before, after)).toEqual([
			{ path: 'a/kept.md', change: 'REMOVED' },
			{ path: 'b/edited.js', change: 'CHANGED', content: 'export {};\n' },
			{ path: 'c/new.md', change: 'ADDED', content: '# New\n' }
		]);
	});

	it('⭐ CONTROL — two manifests of an untouched workspace differ in nothing', async () => {
		const ws = workspace();
		await ws.writeFile('README.md', '# untouched\n');
		expect(changedFiles(await takeManifest(ws), await takeManifest(ws))).toEqual([]);
	});

	it('⛔ a file rewritten with the SAME bytes is not changed: the manifest compares hashes, never the act of writing', async () => {
		const ws = workspace();
		await ws.writeFile('x.js', 'export {};\n');
		const before = await takeManifest(ws);
		await ws.writeFile('x.js', 'export {};\n');
		expect(changedFiles(before, await takeManifest(ws))).toEqual([]);
	});
});

describe('⭐⭐ package N — D9: the step’s ONE host sequence, sliced by try', () => {
	it('⭐ each act is given the try it was made in, by the number that try began after; a run past the bound is counted, never listed', () => {
		const observer = createProcessRunObserver(2);
		const tryStarts = [0];
		observer.ran(aRun(['ls']));
		observer.wrote({ path: 'a.md' });
		tryStarts.push(sequenceCount(observer.observed()));
		observer.ran(aRun(['cat', 'a.md']));
		observer.ran(aRun(['node', '--test']));
		const observation = observer.observed();
		expect(hostSequenceOf(observation, tryStarts)).toEqual({
			acts: [
				{ try: 1, ordinal: 1, kind: 'RUN', argv: ['ls'], exitCode: 0, timedOut: false },
				{ try: 1, ordinal: 2, kind: 'WRITE', path: 'a.md' },
				{ try: 2, ordinal: 3, kind: 'RUN', argv: ['cat', 'a.md'], exitCode: 0, timedOut: false }
			],
			droppedRuns: 1,
			recordedLimit: 2
		});
		// ⭐ And a try's runs are the retained runs numbered after its boundary — the second try's one retained run.
		expect(runsOfTry(observation, tryStarts[1]!).map((r) => r.argv)).toEqual([['cat', 'a.md']]);
	});
});

describe('⭐⭐ package N — the view a try was shown, recorded on the content plane and read back from it (RD7)', () => {
	it('⭐ recorded RETAINED_BY_PARTICIPATION and read back whole; ⛔ refused, never guessed, when its bytes do not hash to its pointer', async () => {
		const store = createInMemoryArtifactStore();
		const view = {
			attemptKey: 'step_1#1',
			try: 1,
			deliverable: { afterTry: 1, files: [{ path: 'a.md', change: 'ADDED' as const, content: '# A\n' }], sequence: { acts: [], droppedRuns: 0, recordedLimit: 32 } }
		};
		const ref = await recordDeliverableView(store, 'tnt-t', view);
		expect((await store.stat(ref.storageKey))?.purgeability).toBe('RETAINED_BY_PARTICIPATION');
		const read = await readDeliverableView(store, ref);
		expect(read).toEqual({ ok: true, view: { schema: 'jpwb.deliverable-view/1', ...view } });
		const forged = await readDeliverableView(store, { ...ref, contentHash: 'sha256:00' });
		expect(forged.ok, 'a view whose bytes do not hash to its pointer was read').toBe(false);
		const missing = await readDeliverableView(store, { ...ref, storageKey: 'tnt-t/RETAINED_BY_PARTICIPATION/sha256:ff' });
		expect(missing.ok, 'a view not in the store was read').toBe(false);
	});
	/**
	 * ⭐⭐ `JAN-EXEC` Phase 7, package N's check, finding 2 (design D11) — THE VIEW A COMPLETION ADMITTED: its own pointer, the
	 * pointers of the command evidence it names held against it; else, a completion carrying none, the evidence's first.
	 */
	it('⭐ package N’s check, finding 2 — the completion’s own pointer; ⛔ refused when its command evidence points elsewhere; its evidence’s when it carries none', () => {
		const ref = (storageKey: string, contentHash = `sha256:${storageKey}`) =>
			({ storageProvider: 'jpwb:content-plane', storageKey, contentHash, byteSize: 9, try: 2 }) as const;
		// A write-only try: the completion points, and no evidence does.
		expect(admittedViewRef({ deliverableView: ref('k_2') }, [])).toEqual({ ok: true, ref: ref('k_2') });
		// The try's commands point at the same view: agreed.
		expect(admittedViewRef({ deliverableView: ref('k_2') }, [ref('k_2'), undefined, ref('k_2')])).toEqual({ ok: true, ref: ref('k_2') });
		// ⛔ One points elsewhere — by key, or by hash: the record disagrees with itself, and nothing is read.
		for (const other of [ref('k_1'), ref('k_2', 'sha256:other')]) {
			const r = admittedViewRef({ deliverableView: ref('k_2') }, [ref('k_2'), other]);
			expect(r.ok, `a completion and its evidence disagreeing about the view was read: ${other.storageKey}`).toBe(false);
			expect(r).toMatchObject({ refusedBecause: expect.stringContaining("the record disagrees about what the admitted try's reviews were shown") });
		}
		// A completion carrying none — {} as before, or no pointer a reader can parse — is read through its evidence's.
		expect(admittedViewRef({}, [undefined, ref('k_1')])).toEqual({ ok: true, ref: ref('k_1') });
		expect(admittedViewRef({ deliverableView: { storageKey: 'k_9' } }, [ref('k_1')])).toEqual({ ok: true, ref: ref('k_1') });
		// …and with none there either, no record points at a view.
		expect(admittedViewRef(undefined, [undefined])).toEqual({ ok: true });
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package O — D23 and D22 (design revision 3) — THE NAMES A VIEW AND A BASELINE ARE REACHED BY ───────────
describe('⭐⭐ package O — D23: each try’s view is bound to a name derived from its step’s attempt and its try', () => {
	const view = (attemptKey: string, attempt: number) => ({
		attemptKey,
		try: attempt,
		deliverable: { afterTry: attempt, files: [{ path: 'a.md', change: 'ADDED' as const, content: `# try ${attempt}\n` }], sequence: { acts: [], droppedRuns: 0, recordedLimit: 32 } }
	});

	it('⭐ the view a try records is reached by its step and try alone — the same pointer the record would carry — and read back whole', async () => {
		const store = createInMemoryArtifactStore();
		const ref = await recordDeliverableView(store, 'tnt-t', view('step_1#1', 2));
		expect(viewNameOf('tnt-t', 'step_1#1', 2)).toBe('tnt-t/deliverable-view/step_1#1/2');
		const named = await namedViewOf(store, 'tnt-t', 'step_1#1', 2);
		expect(named, 'the view was not reached by its step and try').toEqual(ref);
		expect((await readDeliverableView(store, named!)).ok).toBe(true);
	});

	it('⭑ CONTROL — another try, another attempt, or a tenant the host never named reaches nothing', async () => {
		const store = createInMemoryArtifactStore();
		await recordDeliverableView(store, 'tnt-t', view('step_1#1', 1));
		expect(await namedViewOf(store, 'tnt-t', 'step_1#1', 2)).toBeUndefined();
		expect(await namedViewOf(store, 'tnt-t', 'step_1#2', 1)).toBeUndefined();
		expect(await namedViewOf(store, 'tnt-u', 'step_1#1', 1)).toBeUndefined();
	});

	it('⛔ a name the content plane refuses to bind refuses the recording: no try is reviewed whose view no reader could reach', async () => {
		const store = createInMemoryArtifactStore();
		await recordDeliverableView(store, 'tnt-t', view('step_1#1', 1));
		// The same try recorded again, its view different: the name is bound once, and is never rebound.
		await expect(recordDeliverableView(store, 'tnt-t', { ...view('step_1#1', 1), deliverable: { ...view('step_1#1', 1).deliverable, afterTry: 9 } })).rejects.toThrow(
			/the view of try 1 of step_1#1 could not be named: .*never rebound/
		);
	});
});

describe('⭐⭐ package O — D22: the unit’s FIRST step’s baseline, recorded once under the unit’s name and read back by every later step', () => {
	const STEP_1 = { pwuId: 'pwu_1', stepId: 'step_1', attemptKey: 'step_1#1' } as const;
	const STEP_2 = { pwuId: 'pwu_1', stepId: 'step_2', attemptKey: 'step_2#1' } as const;

	it('⭐ the first step records the manifest it took, path and hash, never text; a later step reads that one back though the workspace moved on', async () => {
		const store = createInMemoryArtifactStore();
		const ws = workspace();
		await ws.writeFile('README.md', '# before\n');
		const first = await unitBaselineOf(store, 'tnt-t', STEP_1, ws);
		expect([...first.keys()]).toEqual(['README.md']);
		const bound = await store.resolveName(baselineNameOf('tnt-t', 'pwu_1'));
		const record = JSON.parse((await store.get(bound!.storageKey))!) as Record<string, unknown>;
		expect(record).toEqual({
			schema: DELIVERABLE_BASELINE_SCHEMA,
			pwuId: 'pwu_1',
			stepId: 'step_1',
			attemptKey: 'step_1#1',
			files: [['README.md', first.get('README.md')!.hash]]
		});
		// The refused attempt writes a file; the work re-run's step reads the FIRST step's baseline, so the file stays a change.
		await ws.writeFile('docs/required.md', '# Required\n');
		const later = await unitBaselineOf(store, 'tnt-t', STEP_2, ws);
		expect([...later.keys()], 'a later step took a fresh baseline').toEqual(['README.md']);
		expect(changedFiles(later, await takeManifest(ws))).toEqual([{ path: 'docs/required.md', change: 'ADDED', content: '# Required\n' }]);
	});

	it('⭑ CONTROL — another unit’s first step takes its own baseline: the name is the unit’s', async () => {
		const store = createInMemoryArtifactStore();
		const ws = workspace();
		await unitBaselineOf(store, 'tnt-t', STEP_1, ws);
		await ws.writeFile('docs/required.md', '# Required\n');
		const other = await unitBaselineOf(store, 'tnt-t', { pwuId: 'pwu_2', stepId: 'step_9', attemptKey: 'step_9#1' }, ws);
		expect([...other.keys()]).toEqual(['docs/required.md']);
	});

	it('⛔ a bound baseline whose bytes do not hash to the ref its name binds is REFUSED — never replaced by a fresh one', async () => {
		const store = createInMemoryArtifactStore();
		const ws = workspace();
		await unitBaselineOf(store, 'tnt-t', STEP_1, ws);
		const bound = (await store.resolveName(baselineNameOf('tnt-t', 'pwu_1')))!;
		const tampered = { ...store, get: async (key: string) => (key === bound.storageKey ? '{"schema":"forged"}' : store.get(key)) };
		await expect(unitBaselineOf(tampered, 'tnt-t', STEP_2, ws)).rejects.toThrow(/does not hash to the sha256:/);
	});
});
