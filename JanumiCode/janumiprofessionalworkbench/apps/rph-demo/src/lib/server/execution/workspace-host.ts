// JAN-EXEC Phase 2 — WHERE AN UNDERTAKING'S WORKSPACE LIVES, and the runner that is wired beside it.
//
// ⭐ `R8` RULES THE OWNER: **the workspace is the DELIVERABLE**, it must persist, survive a restart and be
// inspectable after the undertaking ends — so `ownerKind` is `UNDERTAKING` and nothing narrower.
//
// ⛔ AND EVERY EXISTING LIFECYCLE IN THIS REPOSITORY IS NARROWER THAN THAT, WHICH IS WHY THE RULING HAD TO BE
// EXPLICIT. The producer session is disposed per work unit (`producer.dispose()` in a `finally`), `beginExecute`
// mints a fresh plan and a fresh step per click, and the only pre-existing filesystem scratch in production demo
// code is a `mkdtemp` created and removed inside ONE call. Absent the ruling the default that emerges is
// per-invocation — and the spike measured the consequence: with one UNDERTAKING-owned directory a SECOND step,
// in a NEW session with a NEW plan, ran against a file the FIRST step wrote. Step-owned, that call finds
// nothing, and a multi-phase PWA builds seven fragments instead of one product.
//
// ── ⛔ THE HOST HAD NOWHERE TO HANG SUCH A RESOURCE, AND THAT IS THE ACTUAL WORK ─────────────────────────────
// Measured before this file existed: no `hooks.server.ts`, no `locals`, no `+layout.server.ts`; `grep "locals"`
// over the app returns 0. The entire mutable process state of the server tree is FIVE `let` declarations, all in
// `workbench.ts`, and every shared resource is an exported getter. `getArtifactStore()` gets away with a bare
// process singleton because it is CONTENT-ADDRESSED and puts the tenant in the KEY; a workspace cannot be
// content-addressed — it is mutable and path-named — so it needs the same trick one level down:
// **one durable root, one subdirectory DERIVED from the owner id, RESOLVED PER REQUEST rather than held.**
// A SvelteKit form action cannot hold an object across requests, which is exactly what the spike did.
//
// ── ⭑ THE ROOT IS DERIVED FROM `JPWB_DEMO_DB`, NOT FROM A SECOND ENV KEY, AND THE REASON IS AN ORPHAN ───────
// `getArtifactStore()` derives the CONTENT plane's location from the RECORD plane's key — `${DB_PATH}.content.
// sqlite` — and `ArtifactStore.durability`'s docblock names the defect that derivation avoids: "The record plane
// can be durable (a SQLite adapter) while the content plane is not, and then a permanent record names a
// `storageKey` whose store answer, after one restart, is byte-indistinguishable from a key that was never
// stored." A SECOND env key would reintroduce exactly that orphan here, one plane over: an operator who set the
// database and not the workspace root would get a durable, permanent record of an execution step whose
// deliverable evaporated at restart, and nothing in either record would say so. One key configures all three
// planes or none of them.
//
// ⛔ TEST MODE IGNORES THE ROOT UNCONDITIONALLY, which is `JPWB_DEMO_DB`'s own docblock applied verbatim: "a
// durable store shared across specs would make them order-dependent, which is the failure mode `resetEngine`
// exists to prevent. So test mode is in-memory by construction, not by configuration."
//
// ⚠ READ IN THE DEFAULT-PARAMETER SHAPE, NOT A FROZEN MODULE CONST. `workbench.ts` freezes `DB_PATH` at import,
// and `floor-recording.test.ts:19-21` records what that costs: "a plain assignment below the imports would be
// read after the const froze", so every test of an env-dependent branch needs `vi.hoisted` plus a module reset.
// A default parameter is read at CALL time, so the same branches are reachable by calling the function.
import { mkdirSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import {
	containedWorkspacePath,
	createInMemoryWorkspace,
	createRefusingProcessRunner,
	type ProcessRunner,
	type Workspace
} from '@janumipwb/rph-ports';
import { createFilesystemWorkspace } from './filesystem-workspace.js';

/**
 * The two ports an Undertaking's execution runs against, resolved together.
 *
 * ⛔ TOGETHER RATHER THAN SEPARATELY, BECAUSE THE PORTS ARE NOT INDEPENDENT. `workspace.ts`'s header states it:
 * "A `ProcessRunner` needs a real `cwd`; an IN_MEMORY workspace has none … A host wiring a REAL runner against
 * an IN_MEMORY workspace has made an error that must be caught BEFORE anything runs." Handing a caller one
 * without the other is how that pairing stops being checkable at all.
 */
export interface UndertakingSandbox {
	readonly workspace: Workspace;
	readonly runner: ProcessRunner;
}

/**
 * The durable root, or `undefined` when there is none.
 *
 * ⛔ TEST MODE FIRST AND UNCONDITIONALLY — before the key is even read, so no configuration can reach a spec.
 */
function durableWorkspaceRoot(env: NodeJS.ProcessEnv): string | undefined {
	if (env.RPH_DEMO_MODE === 'test') return undefined;
	const db = env.JPWB_DEMO_DB;
	return db === undefined || db === '' ? undefined : `${db}.workspaces`;
}

/**
 * Resolve the sandbox for ONE Undertaking — per request, never held.
 *
 * ⛔ THE OWNER ID IS CHECKED BEFORE IT BECOMES A DIRECTORY NAME. It arrives from a stored object rather than
 * from a form, but it is still an id being spliced into a filesystem path, and `..`, a leading separator or a
 * drive letter would put the "workspace" above the root — in the limit, the server's own tree, which is the one
 * outcome this whole phase exists to make impossible. `containedWorkspacePath` is the predicate the port
 * exports for exactly this, and the extra equality is what keeps ONE owner to ONE directory: `a/b` is contained
 * but would nest one Undertaking's workspace inside another's.
 *
 * ⚠ IT THROWS RATHER THAN SUBSTITUTING. A fallback directory would be a workspace nobody chose, holding a
 * deliverable nobody could find — `NO DEFAULT THAT FABRICATES` reaching the host through the owner id.
 */
export function resolveUndertakingSandbox(
	undertakingId: string,
	root: string | undefined = durableWorkspaceRoot(process.env)
): UndertakingSandbox {
	const segment = containedWorkspacePath(undertakingId);
	if (segment === undefined || segment !== undertakingId || segment.includes('/'))
		throw new Error(
			`'${undertakingId}' cannot name an Undertaking workspace directory. The owner id becomes ONE path segment under the durable root: it may not be empty, may not contain a separator, and may not resolve above the root. Refusing rather than substituting a directory: a workspace nobody chose would hold a deliverable nobody could find.`
		);

	// ⛔ NO REAL RUNNER IN THIS COMMIT, AND THE REASON IS `REG-Q-066` RATHER THAN EFFORT. A real runner captures
	// stdout and stderr, which reopens the question closed BY NON-USE, and roadmap rule 8 requires a disclosed
	// question to be answered in the commit that reopens it. The sponsor has ruled on the disposition (`R7`:
	// both streams retained, both under purge); implementing it is Phase 2b. Until then the seam is complete and
	// provably inert — the refusing default is structurally unable to report an exit code for a command that
	// never started.
	const runner = createRefusingProcessRunner();

	if (root === undefined || root === '')
		// ⚠ LAWFUL, AND DISCLOSED RATHER THAN SILENT — the same posture `getArtifactStore()` takes without a
		// configured database. An IN_MEMORY workspace DECLARES that it has no directory, so a producer session
		// is refused a working directory instead of inheriting the server's, and `planProcessRun` refuses a run
		// instead of executing somewhere else. What is lost is durability, which the declaration states.
		return {
			workspace: createInMemoryWorkspace({
				ownerKind: 'UNDERTAKING',
				ownerId: undertakingId,
				purgeability: 'RETAINED_BY_PARTICIPATION'
			}),
			runner
		};

	// ⭑ ONE SUBDIRECTORY PER OWNER, DERIVED — never a fresh directory per call. This single expression is what
	// makes a second step, in a new session with a new plan, land in the same place as the first.
	const directoryPath = resolvePath(join(root, segment));
	// Created eagerly so the deliverable is INSPECTABLE the moment the Undertaking starts executing (`R8`),
	// rather than only once something has been written into it. `recursive` makes this idempotent per request.
	mkdirSync(directoryPath, { recursive: true });
	return {
		workspace: createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: undertakingId,
			// ⛔ `PER-8`, AND IT IS `R8` STATED AS A RETENTION CLASS. The deliverable must survive the
			// undertaking, so `purge` REFUSES here. ⚠ THE COST IS REAL AND THE PORT NAMES IT: "one workspace
			// cannot hold participating and purgeable material side by side; a host needing both declares two."
			// `R7`'s retained stdout and stderr are purgeable-at-expiry and therefore belong in a SECOND
			// workspace, which is Phase 2b's to declare — not a third `Purgeability` member.
			purgeability: 'RETAINED_BY_PARTICIPATION',
			directoryPath
		}),
		runner
	};
}
