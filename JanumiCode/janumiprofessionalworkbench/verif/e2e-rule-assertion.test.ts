// JAN-SLICE-SWP-03 — the RPH-E2E family is green ON ASSERTIONS, not on citations.
//
// ── THE DEFECT THIS EXISTS TO CLOSE, IN THE MANIFEST'S OWN WORDS ─────────────────────────────────────────────
// `conformance-manifest.ts` lists three PROHIBITED ways to turn the `RPH-E2E` gate green, and the third is the
// one no existing check could catch:
//
//   "3. Citing a test file that does not assert the rule — the gate checks only that the cited file EXISTS
//       (`conformance.test.ts:203-208`), so it would accept the citation and prove nothing."
//
// That is not hypothetical. The roadmap's finding F-3 measured it: the conformance gate passed 125 of 125 rules
// on citations, and 38 of those rules had their id present in a file whose ONLY occurrence was a "not probed
// here" marker. A citation is a claim by the author that the gate cannot read.
//
// ⚠ SO A `PARTIAL` OR `COVERED` STATUS ON `RPH-E2E` MUST NOT BE THE THING THAT MAKES THIS FAMILY GREEN. This gate
// makes the status answerable to something the repository derives rather than to something an author typed: every
// ratified `RPH-E2E` rule must be cited by a Slice IN THE GENERATED LEDGER, and that Slice must carry at least
// one mutant. The ledger is itself gated (`slice-ledger.test.ts` proves it equals what the declarations generate
// and is not stale), and the mutants are driven separately by `scripts/drive-slice-mutants.ts`.
//
// ── WHAT THIS GATE DOES NOT ESTABLISH, STATED PLAINLY SO NOBODY READS MORE INTO ITS GREEN ────────────────────
// It does NOT prove a Slice asserts the rule WELL, or completely. Four of the seven Slices assert clauses that are
// narrower than the ratified statement and say so in their names. What makes a clause load-bearing is its MUTANT
// — a predicted red, driven, reddening that clause and no other — and mutants are driven by an instrument that
// mutates production source and therefore cannot live in this suite. This gate closes the CITATION hole only:
// it makes "a rule is covered" mean "a Slice in the ledger cites it and carries a predicted red", instead of
// "someone typed a filename that happens to exist".
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

interface LedgerRow {
	readonly id: string;
	readonly citedRules: readonly string[];
	readonly mutantCount: number;
	readonly path: string;
}

function ledgerRows(): LedgerRow[] {
	const raw = readFileSync(`${ROOT}verif/slices/slice-ledger.baseline.json`, 'utf8');
	return (JSON.parse(raw) as { rows?: LedgerRow[] }).rows ?? [];
}

/**
 * The ratified rule ids, read from the M12 vocabulary.
 *
 * ⚠ DERIVED FROM THE CATALOG, NEVER LISTED HERE. A hand-written list of the seven would be a second claim about
 * the corpus that nothing checks, and it would not notice an eighth `RPH-E2E` rule being ratified — which is
 * exactly the shape of failure this programme keeps finding (a hand-listed set said 2 where the derivation said
 * 8). If the corpus grows a rule, this gate must redden until a Slice covers it.
 */
function ratifiedE2eRuleIds(): string[] {
	const raw = readFileSync(`${ROOT}packages/rph-domain/vocab/m12-conformance.json`, 'utf8');
	const cat = (JSON.parse(raw) as { ruleCatalog?: { id: string }[] }).ruleCatalog ?? [];
	return cat.map((r) => r.id).filter((id) => id.startsWith('RPH-E2E-'));
}

describe('the RPH-E2E family is answerable to Slices, not to citations', () => {
	it('CONTROL — both sources really were read, and neither is empty', () => {
		// Without this, every assertion below is vacuously satisfiable: an unreadable ledger makes `cited` empty
		// and an unreadable catalog makes the rule list empty, and an empty-vs-empty comparison passes while
		// measuring nothing. This is the control that separates "every rule is covered" from "no rule was read".
		expect(ratifiedE2eRuleIds().length, 'the M12 catalog must yield RPH-E2E rules').toBeGreaterThan(0);
		expect(ledgerRows().length, 'the committed Slice ledger must contain rows').toBeGreaterThan(0);
	});

	it('every ratified RPH-E2E rule is cited by at least one Slice in the generated ledger', () => {
		const cited = new Set(ledgerRows().flatMap((r) => r.citedRules));
		const uncited = ratifiedE2eRuleIds().filter((id) => !cited.has(id));
		expect(
			uncited,
			`these ratified RPH-E2E rules are cited by no Slice, so the family's manifest status rests on nothing the repository derives: ${uncited.join(', ')}`
		).toEqual([]);
	});

	it('every Slice citing an RPH-E2E rule carries at least one mutant', () => {
		// A Slice with no predicted red proves nothing (SL-3), and the ledger already refuses an empty mutants
		// array at generation time. Asserted again HERE because this gate is what the manifest status leans on:
		// if the ledger's own refusal were ever relaxed, the citation hole would silently reopen underneath a
		// family certified on the strength of it.
		const weak = ledgerRows()
			.filter((r) => r.citedRules.some((c) => c.startsWith('RPH-E2E-')))
			.filter((r) => r.mutantCount === 0);
		expect(
			weak.map((r) => r.id),
			`these Slices cite an RPH-E2E rule but declare no mutant, so their citation is an assertion nothing can fail: ${weak.map((r) => r.id).join(', ')}`
		).toEqual([]);
	});

	it('no Slice cites an RPH-E2E rule that is not in the ratified catalog', () => {
		// The opposite direction. A Slice citing `RPH-E2E-008` would satisfy the coverage check above for the
		// seven that exist while quietly claiming an eighth that does not — and the ledger's own catalog check
		// would catch it today, so this is a SECOND reader of the same fact, kept because this gate is the one
		// the manifest status will cite.
		const ratified = new Set(ratifiedE2eRuleIds());
		const invented = [
			...new Set(
				ledgerRows()
					.flatMap((r) => r.citedRules)
					.filter((c) => c.startsWith('RPH-E2E-') && !ratified.has(c))
			)
		];
		expect(
			invented,
			`these cited RPH-E2E ids are in no ratified catalog: ${invented.join(', ')}`
		).toEqual([]);
	});
});
