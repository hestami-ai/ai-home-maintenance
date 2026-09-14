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
// ── ⛔ DURABILITY IS GRANTED ONLY TO A PROCESS THAT DECLARES IT IS SERVING ───────────────────────
// This arm used to read "TEST MODE IGNORES THE ROOT UNCONDITIONALLY" and key on `RPH_DEMO_MODE === 'test'` —
// which ONLY the Playwright configs set. `vitest.config.ts` does not, so `vitest run --project app:rph-demo`
// with `JPWB_DEMO_DB` set was NOT test mode by that predicate: driven, it produced real directories on disk and
// a durable 2,719,744-byte `demo.sqlite`, and `undertaking-loader-object-type.test.ts`'s CONTROL went red —
// precisely the order-dependence `resetEngine` exists to prevent, arriving through the one runner the predicate
// did not name.
//
// ⛔ A SECOND ENV CHECK WOULD HAVE CLOSED THAT RUNNER AND NOT THE NEXT ONE, because a blocklist of runners is a
// list that rots — the failure mode this repository keeps filing. So the test is AFFIRMATIVE: `RPH_DEMO_MODE=
// server` buys durability, and every other process — named, unnamed, or future — is in-memory BY CONSTRUCTION.
// That is what `JPWB_DEMO_DB`'s own docblock already claimed and could not deliver: "a durable store shared
// across specs would make them order-dependent, which is the failure mode `resetEngine` exists to prevent. So
// test mode is in-memory by construction, not by configuration."
//
// ⚠ AND IT IS NOT A SECOND KEY CONFIGURING A PLANE, which the paragraph above forbids. `JPWB_DEMO_DB` still
// says WHERE all three planes live and nothing splits that. `RPH_DEMO_MODE` says WHAT THIS PROCESS IS — a fact
// about the process rather than about the deployment, and the one fact a test runner cannot supply by accident.
//
// ── ⛔ AND THE DERIVATION ITSELF HAS TWO BOUNDS, BOTH OF THEM BREACHED BEFORE THEY WERE WRITTEN ──────────
// 1. ⛔ THE ROOT MUST BE ABSOLUTE, AND ABSOLUTE IN THE SENSE WIN32 MEANS. `resolvePath(join(root, segment))`
//    resolves a RELATIVE root against `process.cwd()`, so `JPWB_DEMO_DB=demo.sqlite` put every Undertaking's
//    workspace INSIDE THE SERVER'S OWN SOURCE TREE — the exact defect this phase exists to remove, reached
//    through configuration instead of through an owner id. The suite held only because every case injected an
//    absolute root under `tmpdir()`; nothing required the DERIVED one to be absolute at all. ⚠ `isAbsolute`
//    IS NOT THE QUESTION: it answers TRUE for `\workspaces`, which resolves against the process's CURRENT
//    DRIVE, and FALSE-looking `C:workspaces` resolves against that drive's CURRENT DIRECTORY. The predicate
//    below asks the question that actually matters — does this root name the same directory NO MATTER what it
//    is resolved against — and refuses rather than substituting, for the reason the owner id refuses.
// 2. ⛔ THE DERIVATION MUST BE INJECTIVE UNDER THE FILESYSTEM'S EQUALITY, NOT THE STRING'S. `UND-ALPHA` and
//    `und-alpha` are two Undertakings and produced two different `directoryPath` STRINGS — so the suite's own
//    distinctness assertion passed — while NTFS gave them ONE DIRECTORY: one wrote `src/index.ts` and the other
//    read it back. Refusing the second would deny a lawful Undertaking its workspace forever, so the fix is to
//    make the map injective instead: the directory name carries a fingerprint of the EXACT id, in lower-case
//    hex, so two ids that a case-insensitive filesystem cannot tell apart get two directories it can.
//
// ⚠ READ IN THE DEFAULT-PARAMETER SHAPE, NOT A FROZEN MODULE CONST. `workbench.ts` freezes `DB_PATH` at import,
// and `floor-recording.test.ts:19-21` records what that costs: "a plain assignment below the imports would be
// read after the const froze", so every test of an env-dependent branch needs `vi.hoisted` plus a module reset.
// A default parameter is read at CALL time, so the same branches are reachable by calling the function.
import { createHash } from 'node:crypto';
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

/** The one declaration that BUYS durability. Nothing else does, and nothing is inferred — see the header. */
const SERVING_DECLARATION = 'server';

/**
 * The durable root, or `undefined` when there is none.
 *
 * ⛔ AFFIRMATIVE, AND BEFORE THE KEY IS EVEN READ: a process that has not declared itself a server gets no
 * durable root, whatever it has configured. Every runner is covered by that, including the ones nobody has
 * written yet — see the header for the one that was not covered by the predicate this replaces.
 */
function durableWorkspaceRoot(env: NodeJS.ProcessEnv): string | undefined {
	if (env.RPH_DEMO_MODE !== SERVING_DECLARATION) return undefined;
	const db = env.JPWB_DEMO_DB;
	return db === undefined || db === '' ? undefined : `${db}.workspaces`;
}

/**
 * Does this root name the same directory NO MATTER what it is resolved against?
 *
 * ⛔ A COMPARISON RATHER THAN `isAbsolute`, AND THE WIN32 SPELLINGS ARE WHY — see bound 1 in the header. Two
 * probe bases on DIFFERENT drives: a root that is genuinely rooted resolves identically against both, while
 * every form that depends on the process (a plain relative path, a drive-relative `C:workspaces`, a
 * drive-less `\workspaces`) resolves differently. Measured on this host, it answers FALSE for all five
 * relative spellings and TRUE for drive-absolute and UNC roots. ⚠ ON POSIX the two bases are ordinary relative
 * segments, and the comparison still discriminates for the same reason: only a root that ignores its base can
 * ignore both of them.
 */
function rootedIndependentlyOfTheProcess(root: string): boolean {
	return resolvePath('C:/jpwb-probe-a', root) === resolvePath('D:/jpwb-probe-b', root);
}

/**
 * 16 hex characters of SHA-256 over the EXACT owner id — what makes the directory derivation INJECTIVE on a
 * case-insensitive filesystem (bound 2 in the header).
 *
 * ⚠ LOWER-CASE HEX IS LOAD-BEARING: two fingerprints that differ at all therefore differ case-insensitively
 * too, so `UND-ALPHA-437b70bcd7e508e5` and `und-alpha-fce2765bdd2a3fce` are two directories on every filesystem
 * rather than one. The id stays in front of it, so the directory is still inspectable as `R8` requires.
 */
function ownerFingerprint(undertakingId: string): string {
	return createHash('sha256').update(undertakingId, 'utf8').digest('hex').slice(0, 16);
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

	// ⛔ A ROOT THAT RESOLVES AGAINST THE PROCESS IS REFUSED, NEVER RESOLVED. The next line would otherwise
	// resolve it against `process.cwd()` — the server's own tree, which is the one outcome this phase exists to
	// make impossible — and `mkdirSync` would then CREATE it there before anything was written.
	if (!rootedIndependentlyOfTheProcess(root))
		throw new Error(
			`'${root}' cannot be an Undertaking workspace root: it is not absolute, so it resolves against this process's own working directory and the deliverable would land inside the server's tree. Refusing rather than resolving it: configure JPWB_DEMO_DB with an absolute path.`
		);

	// ⭑ ONE SUBDIRECTORY PER OWNER, DERIVED — never a fresh directory per call. This single expression is what
	// makes a second step, in a new session with a new plan, land in the same place as the first.
	// ⛔ AND THE FINGERPRINT IS WHAT MAKES THE DERIVATION INJECTIVE ON A CASE-INSENSITIVE FILESYSTEM (bound 2):
	// without it `UND-ALPHA` and `und-alpha` are two ids, two strings, and ONE directory on disk.
	const directoryPath = resolvePath(join(root, `${segment}-${ownerFingerprint(undertakingId)}`));
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
