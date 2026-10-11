// JAN-EXEC Phase 2 — the victim for the ONE function allowed to answer "where does the producer run?".
//
// ⭐ THE PROMISE UNDER TEST IS AN ABSENCE: `producerWorkingDirectory` has NO fallback arm. Every refusal below
// has an obvious "reasonable" repair — hand back the server's own directory — and that repair IS the defect:
// an execution step would write its product into the SvelteKit server's source tree, i.e. into this repository,
// while the record said it ran in the Undertaking's workspace. An absence cannot be asserted by reading the
// code, so it is asserted here.
import { describe, expect, it } from 'vitest';
import { resolve as resolvePath } from 'node:path';
import {
	oneShotSession,
	producerWorkingDirectory,
	type ProducerSessionPorts
} from './producer-session.js';

// ⚠ `ProducerSessionPorts`, NOT `ProducerSessionContext`. JAN-EXEC Phase 3 widened the CONTEXT to carry the
// live ports and the step's grant; the DECLARATIONS this function reads are unchanged, and arranging a case
// from the narrower type is what keeps that a fact rather than a claim — a case that had to stand up a whole
// `Workspace` to ask "where does this run?" would no longer be testing the same question.
const workspace = (
	over: Partial<ProducerSessionPorts['workspace']> = {}
): ProducerSessionPorts['workspace'] => ({
	ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
	ownerKind: 'UNDERTAKING',
	materialization: 'FILESYSTEM',
	directoryPath: resolvePath('/var/jpwb/und_01ARZ3NDEKTSV4RRFFQ69G5PAA'),
	...over
});

describe('a FILESYSTEM workspace supplies the working directory, and only it may', () => {
	it('⭐ resolves to the workspace’s OWN directory', () => {
		const out = producerWorkingDirectory({
			workspace: workspace(),
			runner: { kind: 'REFUSING' }
		});
		expect(out.resolved).toBe(true);
		expect(out.resolved === true && out.directoryPath).toBe(
			resolvePath('/var/jpwb/und_01ARZ3NDEKTSV4RRFFQ69G5PAA')
		);
		// ⛔ AND NEVER THE SERVER'S. The defect this function replaces was two literal `process.cwd()` calls.
		expect(out.resolved === true && out.directoryPath).not.toBe(process.cwd());
	});
});

describe('⛔ an IN_MEMORY workspace is REFUSED — and the two wirings get DIFFERENT refusals', () => {
	it('with the REFUSING runner it is the host’s hermetic default, and does NOT announce a wiring error', () => {
		// ⭑⭑ THE MUTANT THIS ASSERTION EXISTS FOR: collapse the two arms into one message. `resolved` is false
		// either way, so a suite that stopped at the refusal would report the mutation SURVIVED. Once the WIRING
		// ERROR wording is normal noise for the default configuration, the real misconfiguration below is
		// indistinguishable from it — and a host is sent to fix a correct configuration.
		const out = producerWorkingDirectory({
			workspace: workspace({ materialization: 'IN_MEMORY', directoryPath: undefined }),
			runner: { kind: 'REFUSING' }
		});
		expect(out.resolved).toBe(false);
		expect(out.resolved === false && out.refusedBecause).not.toMatch(/HOST WIRING ERROR/);
		expect(out.resolved === false && out.refusedBecause).toMatch(/JPWB_DEMO_DB/);
		expect(out.resolved === false && out.refusedBecause).toMatch(/IN_MEMORY/);
	});

	it('⭐ `JAN-EXEC` Phase 8 (D2, D3) — with a REPLAYED runner it is a WIRING ERROR of its own: the replay writes nowhere', () => {
		// ⭑ THE REPLAY HOST PAIRS THE REPLAYED RUNNER WITH A FILESYSTEM WORKSPACE AND NOTHING ELSE (`workspace-host.ts`): its
		// tool calls replay into that directory. The REAL arm's sentence (a model operating somewhere nobody chose) is false
		// of a session that runs nothing live, and the default's (configure JPWB_DEMO_DB) is advice that cannot help.
		const out = producerWorkingDirectory({
			workspace: workspace({ materialization: 'IN_MEMORY', directoryPath: undefined }),
			runner: { kind: 'REPLAYED' }
		});
		expect(out.resolved).toBe(false);
		const said = out.resolved === false ? out.refusedBecause : '';
		expect(said).toMatch(/HOST WIRING ERROR/);
		expect(said).toMatch(/REPLAYED/);
		expect(said).not.toMatch(/server's own source tree/);
		expect(said).not.toMatch(/JPWB_DEMO_DB/);
	});

	it('with a REAL runner it is a HOST WIRING ERROR, named as one', () => {
		const out = producerWorkingDirectory({
			workspace: workspace({ materialization: 'IN_MEMORY', directoryPath: undefined }),
			runner: { kind: 'REAL' }
		});
		expect(out.resolved).toBe(false);
		expect(out.resolved === false && out.refusedBecause).toMatch(/HOST WIRING ERROR/);
		// The refusal names the owner, because a kind without an id classifies nothing.
		expect(out.resolved === false && out.refusedBecause).toMatch(
			/UNDERTAKING 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA'/
		);
	});

	it('⛔ neither refusal hands back a directory — the union makes it unreadable', () => {
		// The type already forbids it; this asserts the RUNTIME shape, because a caller doing
		// `(out as {directoryPath?: string}).directoryPath` is what a fallback would look like after a refactor.
		for (const kind of ['REAL', 'REFUSING'] as const) {
			const out = producerWorkingDirectory({
				workspace: workspace({ materialization: 'IN_MEMORY', directoryPath: undefined }),
				runner: { kind }
			});
			expect(Object.hasOwn(out, 'directoryPath')).toBe(false);
		}
	});
});

describe('⛔ a FILESYSTEM workspace that carries no directory contradicts itself, and is REFUSED', () => {
	for (const directoryPath of [undefined, '']) {
		it(`refuses directoryPath ${JSON.stringify(directoryPath)} rather than trusting the enum`, () => {
			// ⭑ THE ARM THAT WAS SUPPOSED TO BE SAFE. Reading `directoryPath!` off a FILESYSTEM declaration would
			// hand `undefined` to an adapter, and every adapter in reach resolves that to the parent process's
			// cwd — the exact escape this function exists to close, arriving through the trusted branch.
			const out = producerWorkingDirectory({
				workspace: workspace({ directoryPath }),
				runner: { kind: 'REFUSING' }
			});
			expect(out.resolved).toBe(false);
			expect(out.resolved === false && out.refusedBecause).toMatch(/declares materialization FILESYSTEM/);
			expect(out.resolved === false && out.refusedBecause).not.toMatch(/HOST WIRING ERROR/);
		});
	}
});

describe('oneShotSession — unchanged, and still honest about what it is', () => {
	it('⚠ declares that it does NOT retain history', async () => {
		// Retrofitting memory onto `agy` or the fixture would be the fabricated-capability defect. Asserted here
		// because Phase 2 widened the OPENER's signature and a careless widening of the SESSION would be the
		// easiest place to lose this.
		const session = oneShotSession(async (prompt) => `saw:${prompt}`);
		expect(session.retainsHistory).toBe(false);
		expect(await session.turn('hello')).toBe('saw:hello');
		expect(() => session.dispose()).not.toThrow();
	});
});
