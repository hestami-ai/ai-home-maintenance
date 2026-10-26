// ⭐⭐ `JAN-EXEC` Phase 7, package N — D9, D10, D11 (`REG-D-135` (1); `REG-F-522` remedy candidate 2; `REG-F-579`;
// `DESIGN-data-flow-order-and-deliverable-review.md` D9-D11) — WHAT A UNIT DELIVERED, AS THE HOST READ IT.
//
// ── ⭑ WHAT THIS IS ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The workspace is the deliverable (`R8`), and until this module nothing in production read it (`REG-F-522`): a work
// product's review judged the model's answer, and each command's review one command's output. Here the host takes a
// MANIFEST of the Undertaking's workspace through its own port (`Workspace.list` and `readFile`) — each path and the
// SHA-256 of its text — before a step's first try and after each try, and compares the two: the files the unit ADDED,
// CHANGED and REMOVED since its step began, each changed or added file's text as the host read it. Beside them, the step's
// ONE host sequence to date (package L's D8), sliced by try boundaries: each write's path and each run's command and exit,
// with the try it was made in.
//
// ── ⛔ ONE OBSERVER PER STEP, NEVER ONE PER TRY ─────────────────────────────────────────────────────────────────────────
// The 32-run bound is the STEP's (`OBSERVED_PROCESS_RUN_LIMIT`), and the lane's whole-press worst case counts it once
// (`PHASE7_UNIT_REVIEWER_CALLS` = (3 tries + 32 runs) × 6 = 210). A try's runs are therefore a SLICE of the step's one
// observation, by the sequence number the try began after (`sequenceCount`), never a fresh observer.
//
// ── ⚠ WHAT IT IS NOT ────────────────────────────────────────────────────────────────────────────────────────────────────
// It is not `REG-F-522`'s remedy candidate 1: no governed object names the manifest, and no command's evidence names the
// manifest it ran against — that object and its ratification remain OWED. The view a try's reviews were shown is RECORDED
// on the content plane (`recordDeliverableView`, `RETAINED_BY_PARTICIPATION`) and pointed at from that try's command
// evidence ~~and from the step's completion~~ — which the step's completion names; the completion itself carries no pointer
// — so a re-review and a sign-off read it from the record (RD7), not from memory. ⚠ A try that ran no command leaves no
// pointer, and its sign-off is told the host holds no record of it (`declaredUnitWithoutDeliverableLine`).
// ⚠ Paths are the agent's (content plane, `R11`); the record plane carries only the pointer.
import { createHash } from 'node:crypto';
import type { Deliverable, DeliverableFile, HostSequence, HostSequenceAct } from '@janumipwb/rph-assurance';
import type { ArtifactStore, Workspace } from '@janumipwb/rph-ports';
import type { ProcessRunObservation } from '../tools/process-run-observer.js';

/** A workspace's manifest: each readable path, with the SHA-256 of its text and the text the host read. */
export type WorkspaceManifest = ReadonlyMap<string, { readonly hash: string; readonly text: string }>;

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * ⭐ D10 — THE MANIFEST, THROUGH THE PORT: every path `list` names that is not purged and whose bytes `readFile` returns.
 * ⚠ A path whose bytes cannot be read is not in it — `readFile` answers `undefined` for a file never written, one outside
 * the workspace and one purged alike (the port's docblock) — so such a path reads as absent, never as an empty file.
 */
export async function takeManifest(workspace: Pick<Workspace, 'list' | 'readFile'>): Promise<WorkspaceManifest> {
	const out = new Map<string, { hash: string; text: string }>();
	for (const entry of await workspace.list()) {
		if (entry.purged) continue;
		const text = await workspace.readFile(entry.path);
		if (text === undefined) continue;
		out.set(entry.path, { hash: sha256(text), text });
	}
	return out;
}

/**
 * ⭐ D10 — THE FILES CHANGED BETWEEN TWO MANIFESTS, in path order: a path only `after` holds was ADDED, one whose hash moved
 * was CHANGED, and one only `before` holds was REMOVED — ⛔ never shown as unchanged, and never with a text (there is none).
 */
export function changedFiles(before: WorkspaceManifest, after: WorkspaceManifest): DeliverableFile[] {
	const paths = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
	return paths.flatMap((path): DeliverableFile[] => {
		const was = before.get(path);
		const now = after.get(path);
		if (now === undefined) return was === undefined ? [] : [{ path, change: 'REMOVED' }];
		if (was === undefined) return [{ path, change: 'ADDED', content: now.text }];
		return was.hash === now.hash ? [] : [{ path, change: 'CHANGED', content: now.text }];
	});
}

/**
 * ⭐ D9 — HOW MANY NUMBERS THE STEP'S ONE SEQUENCE HAS GIVEN SO FAR: every completed run (a run past the bound takes its
 * number too) and every completed write (package L). ⭑ The number a try begins after — its boundary.
 */
export function sequenceCount(observation: ProcessRunObservation): number {
	return observation.observedCount + observation.writes.length;
}

/**
 * ⭐ D9 — THE STEP'S HOST SEQUENCE TO DATE, each act given the try it was made in: a try's acts are those numbered after the
 * boundary it began at (`tryStarts`, one per try so far, in order) and at or before the next. ⛔ From the step's ONE
 * observation: the runs it retained and the writes it saw, merged by number; the runs past its bound are counted, never
 * listed (`droppedRuns`).
 */
export function hostSequenceOf(observation: ProcessRunObservation, tryStarts: readonly number[]): HostSequence {
	const tryOf = (ordinal: number): number => {
		let t = 1;
		tryStarts.forEach((start, i) => {
			if (ordinal > start) t = i + 1;
		});
		return t;
	};
	const acts: HostSequenceAct[] = [
		...observation.writes.map((w): HostSequenceAct => ({ try: tryOf(w.ordinal), ordinal: w.ordinal, kind: 'WRITE', path: w.path })),
		...observation.runs.map(
			(r): HostSequenceAct => ({
				try: tryOf(r.ordinal),
				ordinal: r.ordinal,
				kind: 'RUN',
				argv: r.argv,
				exitCode: r.exitCode,
				timedOut: r.timedOut
			})
		)
	].sort((a, b) => a.ordinal - b.ordinal);
	return {
		acts,
		droppedRuns: Math.max(0, observation.observedCount - observation.runs.length),
		recordedLimit: observation.recordedLimit
	};
}

/** ⭐ D9 — the runs a try made: those the step's one observation retained, numbered after the try's boundary. */
export function runsOfTry(observation: ProcessRunObservation, tryStart: number) {
	return observation.runs.filter((r) => r.ordinal > tryStart);
}

/** ⭐ Package N — one try's deliverable view, as recorded on the content plane. */
export interface DeliverableViewRecord {
	readonly schema: typeof DELIVERABLE_VIEW_SCHEMA;
	/** The attempt (`<stepId>#<n>`, RD6) and the try of it whose end this view is. */
	readonly attemptKey: string;
	readonly try: number;
	/** The files changed since the step began, and the step's sequence to date (`Deliverable.sequence`). */
	readonly deliverable: Deliverable;
}

/** The record's own tag, so a reader refuses bytes that are not one. */
export const DELIVERABLE_VIEW_SCHEMA = 'jpwb.deliverable-view/1';

/** ⭐ Package N — where a try's view is: the content plane's address and the hash a reader re-hashes it against. */
export interface DeliverableViewRef {
	readonly storageProvider: string;
	readonly storageKey: string;
	readonly contentHash: string;
	readonly byteSize: number;
	readonly try: number;
}

/**
 * ⭐ Package N — RECORD ONE TRY'S VIEW, as its reviews are shown it: the files changed since the step began and the step's
 * sequence to date. ⭑ `RETAINED_BY_PARTICIPATION`, as the evidence mint is: the reviews that read it participate.
 */
export async function recordDeliverableView(
	store: ArtifactStore,
	tenantPrefix: string,
	view: Omit<DeliverableViewRecord, 'schema'>
): Promise<DeliverableViewRef> {
	const record: DeliverableViewRecord = { schema: DELIVERABLE_VIEW_SCHEMA, ...view };
	const ref = await store.put({
		tenantPrefix,
		bytes: JSON.stringify(record),
		mediaType: 'application/json',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	return {
		storageProvider: ref.storageProvider,
		storageKey: ref.storageKey,
		contentHash: ref.contentHash,
		byteSize: ref.byteSize,
		try: view.try
	};
}

/** A pointer read off the record, as it was written (`DeliverableViewRef`), or undefined when it is not one. */
export function deliverableViewRefOf(value: unknown): DeliverableViewRef | undefined {
	const v = value as Partial<Record<keyof DeliverableViewRef, unknown>> | null | undefined;
	if (
		typeof v?.storageProvider !== 'string' ||
		typeof v.storageKey !== 'string' ||
		typeof v.contentHash !== 'string' ||
		typeof v.byteSize !== 'number' ||
		typeof v.try !== 'number'
	)
		return undefined;
	return { storageProvider: v.storageProvider, storageKey: v.storageKey, contentHash: v.contentHash, byteSize: v.byteSize, try: v.try };
}

/**
 * ⭐ Package N — READ A TRY'S VIEW BACK FROM THE RECORD (RD7): its bytes from the content plane, re-hashed against the pointer,
 * and parsed as the record it says it is. ⛔ Refuses — never guesses — on missing bytes, a hash that does not match, or bytes
 * that are not a view.
 */
export async function readDeliverableView(
	store: ArtifactStore,
	ref: DeliverableViewRef
): Promise<{ readonly ok: true; readonly view: DeliverableViewRecord } | { readonly ok: false; readonly refusedBecause: string }> {
	const bytes = await store.get(ref.storageKey);
	if (bytes === undefined) return { ok: false, refusedBecause: `the deliverable view at '${ref.storageKey}' is not in the content store.` };
	if (createHash('sha256').update(bytes, 'utf8').digest('hex') !== ref.contentHash.replace(/^sha256:/, ''))
		return {
			ok: false,
			refusedBecause: `the deliverable view at '${ref.storageKey}' does not hash to the ${ref.contentHash} its pointer names.`
		};
	let parsed: unknown;
	try {
		parsed = JSON.parse(bytes);
	} catch {
		parsed = undefined;
	}
	const view = parsed as DeliverableViewRecord | undefined;
	if (view?.schema !== DELIVERABLE_VIEW_SCHEMA || !Array.isArray(view.deliverable?.files) || !Array.isArray(view.deliverable.sequence?.acts))
		return { ok: false, refusedBecause: `the bytes at '${ref.storageKey}' are not a deliverable view.` };
	return { ok: true, view };
}
