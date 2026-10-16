// JAN-EXEC Phase 2 — THE RATCHET: no part of the EXECUTION plane may CALL the server's own directory.
//
// ⭐ WHY A SOURCE-LEVEL GUARD RATHER THAN A BEHAVIOURAL ONE, STATED PLAINLY. The defect was two literal
// `process.cwd()` calls in `pi-executor.ts`, and that module statically imports `@earendil-works/pi-coding-agent`
// — the heavy Node dependency `model.ts` goes out of its way to load lazily so ~~"the gate never pulls Pi's heavy
// Node deps"~~ ⭐ "loading this module never pulls Pi's heavy Node deps". Opening a real Pi session to observe its
// working directory ~~is not~~ ⭐ was not something a unit suite could do when this was written (R3-C's
// `tools/pi-executor.test.ts` opens one, with a faux provider, for its recorded composite),
// so the behavioural half lives in `producer-session.test.ts` (which proves the ONLY sanctioned source of a
// working directory REFUSES rather than falling back) and this file proves the other half: that the adapter
// actually ASKS it, rather than reaching for the process's own directory again.
//
// ⛔ IT IS A STRUCTURAL WALK, NOT A GREP, AND THE FIRST VERSION IS WHY. Written as a substring probe it reported
// TWO offenders — both of them PROSE: the docblocks in `pi-executor.ts` and `producer-session.ts` that explain
// the defect being removed. A guard that cannot tell a call from a comment would have forced the explanation
// out of the code to stay green, which is the instrument corrupting the thing it measures. The probe below
// matches a CallExpression whose callee is `process.cwd`, so the prose can say what happened.
//
// ⛔ THE FILE LIST IS DERIVED FROM THE FILESYSTEM, NEVER ENUMERATED. A hand-written list is a list that silently
// rots: a new adapter would be added to the directory and not to the list, and the guard would report green over
// a file it never read. The controls below therefore also prove the walk FOUND something.
//
// ⭑ AND THE AUTHORING PLANE IS DELIBERATELY OUT OF SCOPE. `agent/pi-agent.ts` calls `process.cwd()` twice and is
// RIGHT to: the authoring agent edits the workbench through the broker, its resources ARE the server's, and it
// produces no product on disk. The distinction this ratchet draws is between a session that authors a graph and
// a session that BUILDS SOMETHING — only the second has a workspace, and only the second may never be pointed
// at the checkout.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** `…/src/lib/server` — this file lives one level below it. */
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Every production `.ts` under a directory, discovered rather than declared. */
function productionSources(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) productionSources(full, out);
		else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
	}
	return out;
}

/** Does this source CALL `process.cwd()`? A call, never a mention — see the header. */
function callsProcessCwd(file: string): boolean {
	const sf = ts.createSourceFile(
		file,
		readFileSync(file, 'utf8'),
		ts.ScriptTarget.Latest,
		/* setParentNodes */ true
	);
	let found = false;
	const visit = (node: ts.Node): void => {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			ts.isIdentifier(node.expression.expression) &&
			node.expression.expression.text === 'process' &&
			node.expression.name.text === 'cwd'
		)
			found = true;
		if (!found) ts.forEachChild(node, visit);
	};
	visit(sf);
	return found;
}

const shown = (f: string) => f.slice(SERVER_DIR.length).split('\\').join('/');

/** The two directories that make up the execution plane: what runs a step, and what backs it. */
const PLANE = ['execution', 'tools'].flatMap((d) => productionSources(join(SERVER_DIR, d)));

describe('⛔ the EXECUTION plane never calls the server’s own working directory', () => {
	it('⭐ no production source under execution/ or tools/ calls `process.cwd()`', () => {
		// ⭑⭑ THE MUTANT THIS EXISTS FOR, AND IT IS THE DEFECT VERBATIM: restore `SettingsManager.create(process
		// .cwd(), …)` or `new DefaultResourceLoader({ cwd: process.cwd(), … })` in `tools/pi-executor.ts`. The
		// consequence is not abstract — a model asked to write a file and run a build would have done both
		// INSIDE THIS REPOSITORY, while the governed record named the Undertaking's workspace.
		expect(PLANE.filter(callsProcessCwd).map(shown)).toEqual([]);
	});

	it('⭑ CONTROL — the walk actually read the file the defect lived in', () => {
		// ⛔ WITHOUT THIS THE ASSERTION ABOVE CANNOT FAIL. An empty list of files produces an empty list of
		// offenders, and a walk that resolved to the wrong directory — or to none — would report the strongest
		// possible green while reading nothing at all. This repository has the receipt for exactly that shape.
		const seen = PLANE.map(shown);
		expect(seen).toContain('tools/pi-executor.ts');
		expect(seen).toContain('execution/workspace-host.ts');
		expect(seen.length).toBeGreaterThan(5);
	});

	it('⭑ CONTROL — the probe still DETECTS the call where it is lawful, in the authoring plane', () => {
		// ⭑ A CONTROL FOR THE INSTRUMENT, NOT FOR THE SUBJECT. It proves the probe can still find what it looks
		// for: a changed AST shape, a failed parse, or a walk over an empty set would make the main assertion
		// green for a reason that has nothing to do with containment. `agent/pi-agent.ts` legitimately runs in
		// the server's directory — it authors the workbench and builds no product — so this is a stable positive
		// that must NOT be "fixed".
		expect(productionSources(join(SERVER_DIR, 'agent')).filter(callsProcessCwd).map(shown)).toEqual([
			'agent/pi-agent.ts'
		]);
	});

	it('⛔ CONTROL — and the probe does NOT fire on a mention in prose, which is what a grep would do', () => {
		// The two files that EXPLAIN the defect both name it in a docblock. A guard that counted those would
		// force the explanation out of the code to stay green — the instrument corrupting what it measures.
		for (const named of ['tools/pi-executor.ts', 'execution/producer-session.ts']) {
			const file = join(SERVER_DIR, named);
			expect(readFileSync(file, 'utf8')).toContain('process.cwd()');
			expect(callsProcessCwd(file)).toBe(false);
		}
	});
});
