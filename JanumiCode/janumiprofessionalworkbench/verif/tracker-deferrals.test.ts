// JAN-ENFCOV — a milestone marked complete may not defer work to milestones that are also complete.
//
// THE MECHANISM THIS CLOSES, measured 2026-07-29. `docs/JPWB Implementation Roadmap and Tracker.md` carries 16
// milestone rows. SIX defer work forward in their own status notes, and FIVE of those six are marked ✅:
//
//   M1  ✅ → M13        M9  ✅ → M10/M11      M10 ✅ → M11/M13
//   M11 ✅ → M13        M12 ✅ → M13          M7  🟡 → M10/M13
//
// Every chain converges on M13 — which is itself ✅ "core", and whose own note ends "live-command-drive handlers
// deferred". So the work was handed forward four times and fell off the end, held by nothing, while every row
// read as done. Nothing in the build noticed, because until this file NOTHING READ THE TRACKER AT ALL.
//
// That is not a documentation defect. It is the mechanism behind the finding that most of the pure kernel is
// unreachable from production: each deferral was honest and named its successor; the chain simply terminated.
// A deferral that names its successor four times without ever landing is, at a glance, indistinguishable from a
// plan.
//
// ── WHY THIS RULE AND NOT "A ✅ MUST ABSORB WHAT IT WAS SENT" ────────────────────────────────────────────────
//
// The rule one first reaches for — that M13's note must account for what M9/M10/M11/M12 sent it — requires
// semantic matching of prose and would be either unenforceable or a rubber stamp. This rule is structural and
// decidable: IF a row defers, at least one target must still be open to receive it, OR the row must name the
// record where the deferred work actually landed. It cannot prove the successor did the work. It can prove the
// work still has somewhere to be, which is the property that was missing.
//
// THE DISCHARGE ESCAPE IS DELIBERATE AND DELIBERATELY NARROW. `DISCHARGED: <record>` closes a deferral by naming
// where it went — a commit, a REG-005 entry, a programme id. That converts an orphan into a citation. It is an
// escape hatch, and an escape hatch that can be used without evidence is how a gate dies, so the marker must
// carry a non-trivial reference and this test checks that it does.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const TRACKER = fileURLToPath(
	new URL('../docs/JPWB Implementation Roadmap and Tracker.md', import.meta.url)
);

interface Row {
	readonly id: string;
	readonly complete: boolean;
	readonly status: string;
	readonly defersTo: readonly string[];
	readonly discharged: string | undefined;
}

/** Parse the milestone table. A row is `| M9 | title | … | status |`. */
function milestones(markdown: string = readFileSync(TRACKER, 'utf8')): Row[] {
	const rows: Row[] = [];
	for (const line of markdown.split('\n')) {
		if (!/^\|\s*(\*\*)?M(\d+|P)\b/.test(line)) continue;
		const cells = line.split('|').map((c) => c.trim());
		const id = (cells[1] ?? '').replace(/\*\*/g, '').trim();
		const status = cells[cells.length - 2] ?? '';
		const defersTo = [...status.matchAll(/→\s*(M\d+(?:\/M\d+)*)/g)]
			.flatMap((m) => m[1]!.split('/'))
			.map((t) => t.trim());
		rows.push({
			id,
			complete: status.includes('✅'),
			status,
			defersTo,
			discharged: /DISCHARGED:\s*(\S[^|]*)/.exec(status)?.[1]?.trim()
		});
	}
	return rows;
}

describe('the tracker — a deferral must have somewhere to land', () => {
	const rows = milestones();
	const byId = new Map(rows.map((r) => [r.id, r]));

	it('parses the milestone table at all', () => {
		// If the table's shape changes and this parser silently matches nothing, every assertion below passes
		// vacuously — a gate that reads zero rows is the `passWithNoTests` defect wearing a different hat, and this
		// repository has already paid for that once.
		expect(rows.length, 'the tracker must contain milestone rows').toBeGreaterThan(10);
		expect(rows.some((r) => r.complete), 'some milestone must be marked complete').toBe(true);
	});

	// SELFTEST ON SYNTHETIC INPUT, and the reason is a mistake made in this file's first hour.
	//
	// The check below was first written against the LIVE tracker — "some row must defer, or the parser cannot
	// fail". It passed while six real deferrals existed, and then the very commit that resolved them removed the
	// last `→ Mx` and turned the assertion red. The instrument's validity had been coupled to the data still
	// containing the defect, so a CLEAN tracker looked identical to a BROKEN parser.
	//
	// A detector must be provable against input it controls. Same discipline as `scripts/spec-obligations.ts`,
	// whose matcher is fed literal strings and required to report both a hit and a miss.
	it('SELFTEST — the parser detects a deferral, a completion and a discharge on synthetic input', () => {
		const fixture = [
			'| **M90** | Fixture | goal | crit | deps | ✅ (kernel done; wiring → M91/M92) |',
			'| **M91** | Fixture | goal | crit | deps | ✅ (done) |',
			'| **M92** | Fixture | goal | crit | deps | 🟡 (in progress) |',
			'| **M93** | Fixture | goal | crit | deps | ✅ (DISCHARGED: landed at packages/x/y.ts) |'
		].join('\n');
		const parsed = milestones(fixture);
		expect(parsed.map((r) => r.id)).toEqual(['M90', 'M91', 'M92', 'M93']);
		expect(parsed[0]!.defersTo, 'a forward deferral must be seen, and split on "/"').toEqual([
			'M91',
			'M92'
		]);
		expect(parsed[0]!.complete).toBe(true);
		expect(parsed[2]!.complete, '🟡 is not complete').toBe(false);
		expect(parsed[3]!.discharged, 'a DISCHARGED marker must be extracted').toContain('packages/x/y.ts');
		// And the rule itself must fire on a genuinely orphaned row: M90 defers only to M91 (complete) and M92
		// (open), so it is NOT orphaned — flip M92 to complete and it must become so.
		const allClosed = milestones(fixture.replace('🟡 (in progress)', '✅ (done)'));
		const orphans = allClosed
			.filter((r) => r.defersTo.length > 0)
			.filter((r) => r.defersTo.every((t) => allClosed.find((x) => x.id === t)?.complete === true))
			.filter((r) => r.discharged === undefined);
		expect(orphans.map((r) => r.id), 'the orphan rule must fire when every target closes').toEqual(['M90']);
	});

	it('every deferral names a target that exists', () => {
		for (const row of rows)
			for (const target of row.defersTo)
				expect(byId.has(target), `${row.id} defers to ${target}, which is not a milestone`).toBe(true);
	});

	it('no deferral is orphaned: some target is still open, or the row names where it landed', () => {
		const orphaned = rows
			.filter((r) => r.defersTo.length > 0)
			.filter((r) => r.defersTo.every((t) => byId.get(t)?.complete === true))
			.filter((r) => r.discharged === undefined)
			.map((r) => `${r.id} → ${r.defersTo.join('/')} (all complete, no DISCHARGED marker)`);

		expect(
			orphaned,
			'a milestone deferring work to milestones that are ALL complete has handed that work to nobody. ' +
				'Either re-open a target, or add `DISCHARGED: <record>` naming where the work actually landed.'
		).toEqual([]);
	});

	it('a DISCHARGED marker cites something, because an unevidenced escape hatch kills the gate', () => {
		for (const row of rows.filter((r) => r.discharged !== undefined))
			expect(
				row.discharged!.length,
				`${row.id}'s DISCHARGED marker must name a commit, register entry or programme`
			).toBeGreaterThan(8);
	});
});
