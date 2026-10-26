// ⭐⭐ `JAN-EXEC` Phase 7, package N — D9, D10 (`REG-D-135` (1); `REG-F-522` remedy candidate 2) — THE HOST'S VIEW OF WHAT A
// UNIT DELIVERED: the manifest through the workspace port, the files changed between two manifests, the step's one host
// sequence sliced by try, and the view recorded on the content plane and read back from it (RD7).
import { createInMemoryArtifactStore, createInMemoryWorkspace } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import {
	admittedViewRef,
	changedFiles,
	hostSequenceOf,
	readDeliverableView,
	recordDeliverableView,
	runsOfTry,
	sequenceCount,
	takeManifest
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
