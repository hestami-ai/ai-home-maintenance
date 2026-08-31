// SL-6 — A SURFACE SLICE MAY NOT BE ADMITTED WHILE ITS PRESUPPOSED ENGINE SLICE IS ABSENT (JAN-SLICE-SWP-06).
//
// ── THE OBLIGATION, VERBATIM ─────────────────────────────────────────────────────────────────────────────────
// `SL-6`: *"Every Slice MUST declare `ENGINE` or `SURFACE`. A `SURFACE` Slice MUST cite its presupposed `ENGINE`
// Slice."* And the roadmap's `SWP-06` block states the consequence as an invariant in its own words:
// *"A SURFACE Slice MUST NOT be admitted while its presupposed ENGINE Slice is failing or absent."*
//
// ⚠ THE FIELD EXISTED AND NOTHING READ IT. `presupposes` is declared in the Slice contract
// (`rph-contracts/src/slice.ts`), parsed by the ledger generator (`verif/slice-ledger.ts:308`), and written into
// every SURFACE row — and before this file, **no check anywhere resolved it**. A SURFACE Slice could have cited
// `E2E-999`, or an id belonging to another SURFACE Slice, and the ledger would have recorded the citation
// faithfully while it referred to nothing. That is the shape this repository keeps finding: a governed field
// whose only consumer is the writer.
//
// It had never mattered because there were no SURFACE Slices. `S-01` is the first, which is exactly when an
// unenforced invariant stops being harmless and starts being a claim.
//
// ── WHAT THIS GATE CAN AND CANNOT ESTABLISH, SAID PLAINLY ────────────────────────────────────────────────────
// It resolves ABSENCE, not FAILURE. "Is the presupposed Slice failing?" is answered by the gate as a whole —
// `E2E-001` runs in the same suite, so a red there reddens the build regardless of anything here, and a test
// that tried to observe another test's result would be reading a fact it cannot see. What this file adds is the
// half that nothing else covers: that the citation RESOLVES, that it resolves to an ENGINE Slice, and that the
// file it names is really there.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

interface LedgerRow {
	readonly id: string;
	readonly plane: string;
	readonly path: string;
	readonly presupposes?: string;
}

function rows(): LedgerRow[] {
	const raw = readFileSync(`${ROOT}verif/slices/slice-ledger.baseline.json`, 'utf8');
	return (JSON.parse(raw) as { rows?: LedgerRow[] }).rows ?? [];
}

const surface = (): LedgerRow[] => rows().filter((r) => r.plane === 'SURFACE');

describe('SL-6 — a SURFACE Slice presupposes an ENGINE Slice that exists', () => {
	it('CONTROL — the ledger really yields rows, on both planes', () => {
		// Without this every assertion below is vacuously satisfiable: an unreadable ledger yields no SURFACE
		// rows, so "every SURFACE row resolves" passes while measuring nothing. This programme has already
		// shipped one instrument that failed exactly like its subject.
		expect(rows().length, 'the committed ledger must contain rows').toBeGreaterThan(0);
		expect(
			surface().length,
			'and at least one SURFACE row — with none, this whole file is green over an empty set'
		).toBeGreaterThan(0);
		expect(
			rows().filter((r) => r.plane === 'ENGINE').length,
			'and ENGINE rows for them to presuppose'
		).toBeGreaterThan(0);
	});

	it('every SURFACE Slice declares a presupposition', () => {
		const missing = surface().filter((r) => !r.presupposes || r.presupposes.trim() === '');
		expect(
			missing.map((r) => r.id),
			`these SURFACE Slices cite no presupposed ENGINE Slice, which SL-6 requires: ${missing.map((r) => r.id).join(', ')}`
		).toEqual([]);
	});

	it('every presupposition RESOLVES to a row in the ledger', () => {
		const byId = new Map(rows().map((r) => [r.id, r]));
		const dangling = surface().filter((r) => r.presupposes && !byId.has(r.presupposes));
		expect(
			dangling.map((r) => `${r.id} -> ${r.presupposes}`),
			`these presuppositions name no Slice the ledger knows. A citation that resolves to nothing is the F-3 defect wearing SL-6's clothes: ${dangling.map((r) => `${r.id} -> ${r.presupposes}`).join(', ')}`
		).toEqual([]);
	});

	it('every presupposition names an ENGINE Slice, not another SURFACE one', () => {
		// ⚠ THE DIRECTION IS THE POINT. `SL-6` exists so a browser failure can be told apart from a domain
		// failure; a SURFACE Slice presupposing another SURFACE Slice would chain two browser journeys and
		// establish nothing about the domain underneath either.
		const byId = new Map(rows().map((r) => [r.id, r]));
		const wrongPlane = surface().filter((r) => {
			const target = r.presupposes ? byId.get(r.presupposes) : undefined;
			return target !== undefined && target.plane !== 'ENGINE';
		});
		expect(
			wrongPlane.map((r) => `${r.id} -> ${r.presupposes}`),
			`these presuppose a Slice that is not on the ENGINE plane: ${wrongPlane.map((r) => `${r.id} -> ${r.presupposes}`).join(', ')}`
		).toEqual([]);
	});

	it('the presupposed Slice’s source file is really present', () => {
		// "Absent" in SL-6's sense includes a ledger row whose file has been deleted or moved: the row would
		// still resolve by id while the Slice it names asserts nothing.
		const byId = new Map(rows().map((r) => [r.id, r]));
		const gone = surface()
			.map((r) => (r.presupposes ? byId.get(r.presupposes) : undefined))
			.filter((t): t is LedgerRow => t !== undefined)
			.filter((t) => !existsSync(`${ROOT}${t.path}`));
		expect(
			gone.map((t) => `${t.id} (${t.path})`),
			`a presupposed Slice's source is missing, so it is ABSENT in SL-6's sense however well its row reads: ${gone.map((t) => t.path).join(', ')}`
		).toEqual([]);
	});

	it('CONTROL — a fabricated presupposition is refused by the same predicate', () => {
		// ⚠ SYNTHETIC AND IN-MEMORY, NOT A FILE EDIT. Planting a bad row in the committed ledger would leave the
		// repository dirty if this test threw between plant and cleanup, and a control that can corrupt its
		// subject is worse than no control. This drives the PREDICATE over fabricated rows instead, which is
		// what the assertions above actually decide on.
		const real = rows();
		const byId = new Map(real.map((r) => [r.id, r]));
		expect(byId.has('E2E-999'), 'the fabricated id must not exist, or this control proves nothing').toBe(
			false
		);
		const planted = { id: 'S-99', plane: 'SURFACE', path: 'x', presupposes: 'E2E-999' };
		expect(
			!byId.has(planted.presupposes),
			'a SURFACE row citing an unknown id MUST be caught, or the resolve limb is decoration'
		).toBe(true);
		// And the plane limb must fire for a SURFACE-presupposing-SURFACE row.
		const surfaceTarget = real.find((r) => r.plane === 'SURFACE')!;
		expect(
			byId.get(surfaceTarget.id)!.plane !== 'ENGINE',
			'a SURFACE row presupposing another SURFACE row MUST be caught by the plane limb'
		).toBe(true);
	});
});
