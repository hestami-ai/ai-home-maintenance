// ⭐⭐ `JAN-EXEC` Phase 7, package N — D9, D10, D11 (`REG-D-135` (1); `REG-F-522` remedy candidate 2; `REG-F-579`;
// `DESIGN-data-flow-order-and-deliverable-review.md` D9-D11) — WHAT A UNIT DELIVERED, AS THE HOST READ IT.
//
// ── ⭑ WHAT THIS IS ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The workspace is the deliverable (`R8`), and until this module nothing in production read it (`REG-F-522`): a work
// product's review judged the model's answer, and each command's review one command's output. Here the host takes a
// MANIFEST of the Undertaking's workspace through its own port (`Workspace.list` and `readFile`) — each path and the
// SHA-256 of its text — before a step's first try and after each try, and compares the two: the files the unit ADDED,
// CHANGED and REMOVED since its step began (⭐ package O, D22: since the unit's FIRST step began — the D22 note below), each
// changed or added file's text as the host read it. Beside them, the step's
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
// — ⭐ package N's check, finding 2: and from the completion of the try it admits (`structuredResult.deliverableView`,
// `admittedViewRef`) — so a re-review and a sign-off read it from the record (RD7), not from memory. ⚠ A try that ran no
// command and was REFUSED leaves no pointer — no completion names it, it has no command evidence, and the other records a try
// makes take strict payloads — ~~so its re-review is shown the answer alone, and its sign-off is told the host holds no record
// of it (`declaredUnitWithoutDeliverableLine`)~~.
// ⭐⭐ `JAN-EXEC` Phase 7, package O — D23 (design revision 3; the lead's decision, flagged for the sponsor) — SO EVERY VIEW IS ALSO
// BOUND, ON THE CONTENT PLANE, TO A NAME DERIVED FROM ITS STEP'S ATTEMPT AND ITS TRY (`viewNameOf`; `ArtifactStore.bindName`),
// WITHOUT A CONTRACT CHANGE: no record-plane payload changes, and the re-review of a refused try resolves that name
// (`namedViewOf`) where no record points at the view. ⚠ The store is content-addressed (`put` keys each entry by its bytes'
// hash), so a key derived from the step and the try alone could address no bytes; the name binds that derived key to the
// entry, once, and the reader still re-hashes the bytes against the ref it resolves to. A view recorded before package O is
// bound to no name: its re-review is shown the answer alone, and its sign-off is told the host holds no record of it
// (`declaredUnitWithoutDeliverableLine`), as before.
// ⭐⭐ Package O — D22 (design revision 3) — AND THE FILES A VIEW LISTS ARE COUNTED FROM THE UNIT'S FIRST STEP'S BASELINE, never a
// work re-run's fresh one: that baseline — each path and its hash — is recorded on the content plane once, by the unit's first
// step, under a name derived from the unit (`baselineNameOf`), and read back hash-checked by every later step (`unitBaselineOf`).
// So a file a refused attempt wrote and the re-run left alone stays in view.
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
 * ⭐ Package O (D22) — `before` needs each path's hash alone: it may be the unit's first step's baseline as recorded
 * (`unitBaselineOf`), which keeps no text.
 */
export function changedFiles(
	before: ReadonlyMap<string, { readonly hash: string }>,
	after: WorkspaceManifest
): DeliverableFile[] {
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
	/**
	 * The files changed since ~~the step began~~ ⭐ the unit's first step began (package O, D22: a work re-run's view counts from the
	 * unit's baseline, `unitBaselineOf`), and the step's sequence to date (`Deliverable.sequence`). ~~⚠ The reviewer's prompt still says
	 * "since its step began" (`reasoning-review-validator.ts`): a reviewer prompt package O does not change.~~
	 * ~~⛔ Package O's check, finding 1 (OPEN, the lead's to decide before V measures; 2026-10-26) — SO THE PROMPT CONTRADICTS ITSELF on a
	 * work re-run that inherits a file a refused attempt wrote: it lists that file as changed "since its step began", directly above
	 * the step's sequence, which shows this step wrote nothing — "(none: the host completed no write and no run for the agent in this
	 * step)". The sentence is in `WORK_PRODUCT_DELIVERABLE_SUBJECT`, `deliverableHeading` and the declared-policy subject; the
	 * fingerprint's probes carry it (`scripts/reviewer-qual/probes.ts`, `W-DELIVERABLE`), so rewording it moves the fingerprint.~~
	 * ⭐⭐ Package O-2 — D28 (2026-10-26; `REG-F-583`, the check's finding 1; the sponsor's `REG-D-137`, Q46) — RESOLVED FOR A RE-RUN
	 * ONLY: a view whose files are counted from an EARLIER step's baseline is marked (`Deliverable.workRerun`), and its review says the
	 * files are counted from the unit's first step, that a file an earlier step changed is among them and that the sequence is this
	 * step's alone; the declared review marks such a unit's work product and says what the mark means. A first step's view carries no
	 * mark, so its prompts — the 91 confirmed cases of v12 among them — stay byte for byte as they were. Probes take each re-run
	 * branch (`W-RERUN-DELIVERABLE`, `W-RERUN-NO-FILE`, `D-RERUN-DELIVERABLE`), so the fingerprint moved.
	 */
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
 * ⭐⭐ Package O — D23 — THE NAME A TRY'S VIEW IS BOUND TO on the content plane: derived from its step's attempt (`<stepId>#<n>`,
 * RD6) and its try, under the host's tenant prefix (§31.2) — so a reader that knows only the step and the try reaches it.
 */
export function viewNameOf(tenantPrefix: string, attemptKey: string, attempt: number): string {
	return `${tenantPrefix}/deliverable-view/${attemptKey}/${attempt}`;
}

/**
 * ⭐ Package N — RECORD ONE TRY'S VIEW, as its reviews are shown it: the files changed since the ~~step~~ ⭐ unit (package O, D22)
 * began and the step's sequence to date. ⭑ `RETAINED_BY_PARTICIPATION`, as the evidence mint is: the reviews that read it
 * participate. ⭐⭐ Package O — D23 — AND BOUND TO ITS NAME (`viewNameOf`), so the re-review of a refused try that ran no command,
 * which no record points at the view, still reaches it (`namedViewOf`). ⛔ A binding the store refuses throws, as a refused
 * `put` does: the caller fails the step before its review (package N's check, finding 6), never reviews a try whose view no
 * reader could reach.
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
	const named = await store.bindName(viewNameOf(tenantPrefix, view.attemptKey, view.try), ref.storageKey);
	if (!named.bound) throw new Error(`the view of try ${view.try} of ${view.attemptKey} could not be named: ${named.refusedBecause}`);
	return {
		storageProvider: ref.storageProvider,
		storageKey: ref.storageKey,
		contentHash: ref.contentHash,
		byteSize: ref.byteSize,
		try: view.try
	};
}

/**
 * ⭐⭐ Package O — D23 — WHERE A TRY'S VIEW IS, BY ITS NAME: the ref the content plane binds `viewNameOf` to, or undefined when no
 * name is bound (a view recorded before package O, or a try that recorded none). ⚠ A pointer, never the view: the reader
 * re-hashes the bytes against it (`readDeliverableView`).
 */
export async function namedViewOf(
	store: Pick<ArtifactStore, 'resolveName'>,
	tenantPrefix: string,
	attemptKey: string,
	attempt: number
): Promise<DeliverableViewRef | undefined> {
	const ref = await store.resolveName(viewNameOf(tenantPrefix, attemptKey, attempt));
	return ref === undefined ? undefined : { ...ref, try: attempt };
}

// ── ⭐⭐ Package O — D22: THE UNIT'S FIRST STEP'S BASELINE ─────────────────────────────────────────────────────────────────────

/** The baseline record's own tag, so a reader refuses bytes that are not one. */
export const DELIVERABLE_BASELINE_SCHEMA = 'jpwb.deliverable-baseline/1';

/** ⭐ D22 — the workspace's manifest as the unit's first step found it: each path and its hash, never its text. */
export interface DeliverableBaselineRecord {
	readonly schema: typeof DELIVERABLE_BASELINE_SCHEMA;
	readonly pwuId: string;
	/** The step that took it — the unit's first — and its attempt (RD6). */
	readonly stepId: string;
	readonly attemptKey: string;
	/** Each path and the SHA-256 of its text, in path order. */
	readonly files: readonly (readonly [path: string, hash: string])[];
}

/** ⭐ D22 — the name the unit's baseline is bound to on the content plane: derived from the unit, under the tenant prefix. */
export function baselineNameOf(tenantPrefix: string, pwuId: string): string {
	return `${tenantPrefix}/deliverable-baseline/${pwuId}`;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package O-2 — D28 (design revision 4; `REG-D-137`; `REG-F-583`) — THE BASELINE A STEP COUNTS ITS VIEWS'
 * FILES FROM, AND THE STEP THAT TOOK IT: each path and its hash (D22), and `takenBy`, the step whose manifest it is — the unit's
 * first, as its record names it (`DeliverableBaselineRecord.stepId`). ⭑ So the try loop tells a work re-run's view from a first
 * step's: a step whose baseline another step took counts its files from an EARLIER step's baseline (`Deliverable.workRerun`).
 */
export interface UnitBaseline extends ReadonlyMap<string, { readonly hash: string }> {
	readonly takenBy: string;
}

/** ⭐ D22 — a baseline record's bytes, re-hashed against the ref its name resolves to, parsed; refused, never guessed. */
async function readBaseline(
	store: Pick<ArtifactStore, 'get'>,
	ref: { readonly storageKey: string; readonly contentHash: string },
	pwuId: string
): Promise<UnitBaseline> {
	const bytes = await store.get(ref.storageKey);
	if (bytes === undefined) throw new Error(`the baseline of work unit ${pwuId} at '${ref.storageKey}' is not in the content store.`);
	if (sha256(bytes) !== ref.contentHash.replace(/^sha256:/, ''))
		throw new Error(`the baseline of work unit ${pwuId} at '${ref.storageKey}' does not hash to the ${ref.contentHash} its name binds.`);
	let parsed: unknown;
	try {
		parsed = JSON.parse(bytes);
	} catch {
		parsed = undefined;
	}
	const record = parsed as Partial<DeliverableBaselineRecord> | undefined;
	if (record?.schema !== DELIVERABLE_BASELINE_SCHEMA || record.pwuId !== pwuId || !Array.isArray(record.files))
		throw new Error(`the bytes at '${ref.storageKey}' are not the baseline of work unit ${pwuId}.`);
	// ⭐⭐ Package O-2 — D28 — and the step that took it, which the host's writer always names: a record naming none is no baseline
	// the host recorded, so whether a later step is a work re-run would be a guess. ⛔ Refused, as every other doubt here is.
	const files = new Map(record.files.map(([path, hash]) => [path, { hash }]));
	if (typeof record.stepId !== 'string')
		throw new Error(`the baseline of work unit ${pwuId} at '${ref.storageKey}' names no step that took it.`);
	return Object.assign(files, { takenBy: record.stepId });
}

/**
 * ⭐⭐ D22 — THE BASELINE A STEP OF THE UNIT COUNTS ITS VIEWS' FILES FROM: the unit's FIRST step's. The first step takes the manifest
 * through the port (`takeManifest`), records each path and hash on the content plane, and binds it to the unit's name
 * (`baselineNameOf`); every later step of the unit — a work re-run — reads that record back, hash-checked. ⛔ So a file a refused
 * attempt wrote and the re-run left alone stays in the re-run's view. ⛔ A baseline that is bound and cannot be read THROWS — the
 * caller fails the step — never a fresh one taken in its place. ⚠ Disclosed: a unit whose first step ran before package O has
 * no baseline bound, and its next step's becomes the unit's; and the shared workspace is the Undertaking's, so a file another
 * unit wrote while this one waited counts as this unit's change in its re-run's view.
 * ⭐⭐ Package O-2 — D28 — AND IT NAMES THE STEP THAT TOOK IT (`takenBy`): the step asking, on the unit's first step; the first step,
 * read back from its record, on every later one. ⚠ So the disclosed case above — a unit whose first step ran before package O —
 * reads its next step as the taker, which is true: that step's files are counted from its own baseline.
 */
export async function unitBaselineOf(
	store: ArtifactStore,
	tenantPrefix: string,
	step: { readonly pwuId: string; readonly stepId: string; readonly attemptKey: string },
	workspace: Pick<Workspace, 'list' | 'readFile'>
): Promise<UnitBaseline> {
	const name = baselineNameOf(tenantPrefix, step.pwuId);
	const bound = await store.resolveName(name);
	if (bound !== undefined) return readBaseline(store, bound, step.pwuId);
	const manifest = await takeManifest(workspace);
	const record: DeliverableBaselineRecord = {
		schema: DELIVERABLE_BASELINE_SCHEMA,
		pwuId: step.pwuId,
		stepId: step.stepId,
		attemptKey: step.attemptKey,
		files: [...manifest].map(([path, f]) => [path, f.hash] as const)
	};
	const ref = await store.put({
		tenantPrefix,
		bytes: JSON.stringify(record),
		mediaType: 'application/json',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	// ⛔ A binding the store refuses throws, as an unreadable workspace does, and the step fails before its producer opens. No
	// second step of the unit can have bound one meanwhile: a later step is a re-run, offered only once this one's unit waits.
	const named = await store.bindName(name, ref.storageKey);
	if (!named.bound) throw new Error(`the baseline of work unit ${step.pwuId} could not be named: ${named.refusedBecause}`);
	return Object.assign(manifest, { takenBy: step.stepId });
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
 * ⭐⭐ Package N's check, finding 2 (design D11: "the unit's changed files and sequence recorded at its completion") — WHERE THE
 * VIEW A COMPLETION ADMITTED IS: the completion's own pointer (`structuredResult.deliverableView`), each pointer the command
 * evidence it names carries held against it (each of a try's carries the same) — ⛔ one pointing elsewhere refuses, for the
 * record then disagrees with itself about what the try's reviews were shown. ⚠ A completion carrying none — recorded before it
 * carried one, or a re-review's of a refused try no record points at — is read through its evidence's, as before; neither is
 * `{ ok: true }` with no `ref`: no record points at a view.
 */
export function admittedViewRef(
	structuredResult: unknown,
	evidencePointers: readonly (DeliverableViewRef | undefined)[]
): { readonly ok: true; readonly ref?: DeliverableViewRef } | { readonly ok: false; readonly refusedBecause: string } {
	const own = deliverableViewRefOf((structuredResult as { deliverableView?: unknown } | null | undefined)?.deliverableView);
	const pointed = evidencePointers.filter((r): r is DeliverableViewRef => r !== undefined);
	if (own === undefined) return pointed[0] ? { ok: true, ref: pointed[0] } : { ok: true };
	const other = pointed.find((r) => r.storageKey !== own.storageKey || r.contentHash !== own.contentHash);
	if (other)
		return {
			ok: false,
			refusedBecause: `the completion points at the deliverable view at '${own.storageKey}', and command evidence it names at '${other.storageKey}': the record disagrees about what the admitted try's reviews were shown.`
		};
	return { ok: true, ref: own };
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
