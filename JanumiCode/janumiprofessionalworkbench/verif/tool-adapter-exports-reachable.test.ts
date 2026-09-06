// JAN-ASRIDENT AI-01b — the GENERAL form of the defect `AI-01` fixed: a backing-tool adapter that EXPORTS a
// capability nothing uses.
//
// ⭑⭑ THE INSTANCE. `readReportedModel` reads the model Devin actually ran out of its ATIF export. It shipped
// with `devin-reviewer.ts`, it is why the tool suite grades Devin `PROVIDER_REPORTED` — and at the commit
// before this one it had **exactly one reference in the whole production tree: its own declaration**. The
// record therefore said `HOST_CONFIGURED` for every review, while the catalog declared otherwise.
//
// ⚠ WHAT THIS GATE CATCHES, AND WHAT IT DOES NOT. It catches an exported adapter capability with NO production
// reference. It does NOT catch the deeper reason that one was unreachable — `devinPrint` deleted the export
// file in its own `finally`, so no caller COULD have called it. No static check sees a lifetime; only a live
// run does. This gate pins the symptom, which is the part that is checkable, and says so rather than claiming
// the class.
//
// ⛔ AND IT IS SCOPED TO THE ADAPTER LAYER ON PURPOSE. Tree-wide, an unreferenced export is often a barrel
// re-export or a public API point, and a gate that reddened on those would be turned off within a week.
// `lib/server/tools/` is where a DECLARED capability that nothing exercises is this programme's recurring
// defect, so that is where the rule bites.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADAPTERS = 'apps/rph-demo/src/lib/server/tools';
const TREE = 'apps/rph-demo/src';

/** Production `.ts` under a root — tests excluded, because a test-only caller is exactly the defect. */
function productionSources(root: string): { path: string; text: string }[] {
	const out: { path: string; text: string }[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, entry.name);
			if (entry.isDirectory()) walk(p);
			else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
				out.push({ path: p.replaceAll('\\', '/'), text: readFileSync(p, 'utf8') });
		}
	};
	walk(root);
	return out;
}

/** ⭑ DERIVED FROM THE FILESYSTEM, never a hand-listed set — hand-listing is the defect one level up. */
function adapterExports(): { name: string; home: string }[] {
	const found: { name: string; home: string }[] = [];
	for (const file of readdirSync(ADAPTERS)) {
		if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
		const text = readFileSync(join(ADAPTERS, file), 'utf8');
		for (const m of text.matchAll(/export (?:async )?function (\w+)/g))
			found.push({ name: m[1]!, home: `${ADAPTERS}/${file}` });
	}
	return found;
}

const EXPORTS = adapterExports();
const SOURCES = productionSources(TREE);

/**
 * Strip comments, so a MENTION is not counted as a USE.
 *
 * ⚠⚠ THE FIRST VERSION OF THIS GATE DID NOT DO THIS, AND ITS OWN MUTANT WENT GREEN. `readReportedModel` is
 * named in a docblock two lines above the call that uses it; deleting the call left the comment, the gate saw
 * a reference, and reported the tree clean. ⛔ That is the very defect this file exists to catch, reproduced
 * inside the catcher — and it is also WHY the original was so easy to miss: the dead function was documented,
 * discussed in an e2e comment, and looked entirely alive.
 *
 * ⚠ A HEURISTIC, AND DECLARED AS ONE. Line comments are stripped only where `//` is not preceded by `:`, so a
 * URL inside a string survives; block comments and continuation lines go whole. It can over-strip inside an
 * exotic string literal, which would report a false UNREFERENCED — a red a human then reads, never a silent
 * pass.
 */
function withoutComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.split('\n')
		.map((line) => {
			const t = line.trim();
			if (t.startsWith('//') || t.startsWith('*')) return '';
			return line.replace(/(^|[^:])\/\/.*$/, '$1');
		})
		.join('\n');
}

/** Every production reference to `name`, excluding its own declaration line and every comment. */
function referencesTo(name: string): string[] {
	const hits: string[] = [];
	for (const { path, text } of SOURCES)
		for (const line of withoutComments(text).split('\n'))
			if (
				new RegExp(`\\b${name}\\b`).test(line) &&
				!new RegExp(`export (?:async )?function ${name}\\b`).test(line)
			)
				hits.push(path);
	return hits;
}

describe('AI-01b — every backing-tool adapter export is reached by production code', () => {
	it('⭑ CONTROL — the derivation actually found the adapters', () => {
		// ⛔ WITHOUT THIS THE WHOLE GATE PASSES VACUOUSLY when the regex or the directory moves: an empty
		// EXPORTS list makes the assertion below "for each of nothing, …". Naming one function that must be
		// there is what stops a broken parser reading as a clean tree.
		expect(EXPORTS.length).toBeGreaterThan(8);
		expect(EXPORTS.map((e) => e.name)).toContain('devinPrint');
		expect(SOURCES.length).toBeGreaterThan(30);
	});

	it('⭑ CONTROL — the search can report an ABSENCE, so a zero below means something', () => {
		// The other half of the same worry: a `referencesTo` that always returned hits would make the gate
		// unfailable. A name that cannot exist must come back empty.
		expect(referencesTo('zzNoSuchAdapterExportzz')).toEqual([]);
		// …and one that does exist must not. `devinPrint` is passed as a VALUE (`print: devinPrint`) and never
		// called, which is why this gate matches identifiers rather than call syntax — the first version of this
		// derivation used `name(` and reported devinPrint as dead.
		expect(referencesTo('devinPrint').length).toBeGreaterThan(0);
	});

	it('⛔ CONTROL — a name appearing ONLY IN A COMMENT does not count as a reference', () => {
		// ⭑⭑ THIS CONTROL EXISTS BECAUSE THE GATE FAILED IT. Its first version matched raw lines, so the
		// docblock naming `readReportedModel` two lines above the call kept the gate GREEN when the call itself
		// was mutated away. A checker that cannot tell a mention from a use is the same defect it checks for.
		const commentsOnly = [
			'// readReportedModel is discussed here and used nowhere',
			'/* and again: readReportedModel */',
			' * and in a continuation: readReportedModel'
		].join('\n');
		expect(withoutComments(commentsOnly)).not.toMatch(/readReportedModel/);
		// …while a URL on a real code line survives, so the `:` guard is doing its job rather than eating code.
		expect(withoutComments('const u = "https://example.test/x";')).toMatch(/example\.test/);
	});

	it('⛔ no exported adapter capability is unreferenced in production', () => {
		// THE MUTANT that reddens this: revert `devinPrint` to return `stdout` without reading the export.
		// `readReportedModel` then has one reference in the tree — its own declaration — and this fails, naming
		// it. That is precisely the state at the commit before this test existed.
		const unreferenced = EXPORTS.filter((e) => referencesTo(e.name).length === 0).map(
			(e) => e.name
		);
		expect(
			unreferenced,
			'an exported adapter capability nothing references is a declared capability nothing exercises — ' +
				'the tool suite then advertises a grade (PROVIDER_REPORTED) the record never carries. Wire it or ' +
				'stop exporting it.'
		).toEqual([]);
	});
});
