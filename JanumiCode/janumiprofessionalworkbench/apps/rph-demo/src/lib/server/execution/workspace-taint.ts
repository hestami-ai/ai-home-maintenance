// ⭐⭐ `JAN-MHX` MH-1 (`DESIGN-multi-harness-executor.md` D21a) — THE TAINT MARKER: a breach by a CLI executor leaves its
// mark BESIDE the Undertaking's workspace, never inside it.
//
// ⭑ WHY. On `CLI_OWN_TOOL_RAN` or `CLI_UNEXPLAINED_CHANGE` bytes reached the workspace, or commands ran, that the host did
// not record. A re-run reuses the workspace ("files it wrote may still be in the workspace", `run-model-step.ts`), so a
// later try's review and evidence could rest on those bytes. The marker says so until a person clears it by a recorded
// act. ~~⚠ Begin & Execute and re-run are to refuse while it exists (`WORKSPACE_TAINTED`): that is MH-3's, and until it
// lands nothing in the product reads the marker.~~ ⭐ `JAN-MHX` MH-3 — Begin & Execute and a re-run of the work refuse
// while it exists (`WORKSPACE_TAINTED`), before anything is dispatched (`workspaceTaintRefusal`). ⚠ No act in this host
// clears a mark yet: who clears it, and by what recorded act, is the design's open question L7.
// ⛔ BESIDE, NOT INSIDE: the workspace is what the executor writes into, so a marker inside it is one the executor could
// delete. It is a sibling named from the workspace's own path, as `workspace-host.ts` names the process-output folder and
// the tombstone record.
// ⭑ IT NAMES THE TRY AND THE CODE, and nothing the model chose: the changed paths and the CLI's own record are kept on the
// content plane, beside the try's exchange (D14b, D20), and that is where a person clearing the mark looks.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

/** The marker's name, appended to the workspace directory's own path. */
const TAINT_SUFFIX = '.jpwb-taint.json';

/** The two breaches that taint a workspace (D21a). */
export type WorkspaceTaintCode = 'CLI_OWN_TOOL_RAN' | 'CLI_UNEXPLAINED_CHANGE';

/** One breach, as the marker records it. */
export interface WorkspaceTaint {
	readonly code: WorkspaceTaintCode;
	/** The executing tool whose turn breached. */
	readonly toolId: string;
	/** The turn of its session that breached, 1-based: the work unit's try. */
	readonly turn: number;
	readonly at: string;
}

/** What the marker says: nothing, or a taint — ⛔ an unreadable marker is a taint, whose entries are unknown. */
export type WorkspaceTaintReading =
	| { readonly tainted: false }
	| { readonly tainted: true; readonly entries: readonly WorkspaceTaint[] };

/** Where a workspace's marker lives: beside it, named from its path without a trailing separator. */
export function workspaceTaintPath(workspaceDirectory: string): string {
	let end = workspaceDirectory.length;
	while (end > 1 && (workspaceDirectory[end - 1] === '/' || workspaceDirectory[end - 1] === '\\')) end -= 1;
	return `${workspaceDirectory.slice(0, end)}${TAINT_SUFFIX}`;
}

/** Read a workspace's marker. ⛔ Fails closed: a marker that exists and cannot be read still taints. */
export function readWorkspaceTaint(workspaceDirectory: string): WorkspaceTaintReading {
	const path = workspaceTaintPath(workspaceDirectory);
	if (!existsSync(path)) return { tainted: false };
	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as { taints?: unknown };
		return {
			tainted: true,
			entries: Array.isArray(parsed.taints) ? (parsed.taints as WorkspaceTaint[]) : []
		};
	} catch {
		return { tainted: true, entries: [] };
	}
}

/** Add a breach to a workspace's marker, creating it if there is none. */
export function writeWorkspaceTaint(workspaceDirectory: string, taint: WorkspaceTaint): void {
	const reading = readWorkspaceTaint(workspaceDirectory);
	const taints = reading.tainted ? [...reading.entries, taint] : [taint];
	writeFileSync(workspaceTaintPath(workspaceDirectory), `${JSON.stringify({ taints }, null, '\t')}\n`, 'utf8');
}

/** One breach as the refusal names it. ⚠ A marker is a file a person may edit, so an entry is not trusted to be whole. */
const breachNamed = (taint: WorkspaceTaint): string =>
	typeof taint === 'object' && taint !== null
		? `${String(taint.code)}, on turn ${String(taint.turn)} of the executing tool '${String(taint.toolId)}' ` +
			`(${String(taint.at)})`
		: 'an entry that cannot be read';

/**
 * ⭐ `JAN-MHX` MH-3 (D21a) — WHY NO MODEL STEP MAY BEGIN IN THIS WORKSPACE, or `undefined` when nothing marks it: what
 * Begin & Execute and a re-run of the work refuse with, before they dispatch (`WORKSPACE_TAINTED`).
 * ⭑ `undefined` for a workspace with no directory: nothing can be marked beside one.
 * ⛔ It names the breach and the marker's file, never its path, and says that no act here clears it: L7 is open, so the
 * refusal does not name an act that does not exist.
 */
export function workspaceTaintRefusal(workspaceDirectory: string | undefined): string | undefined {
	if (workspaceDirectory === undefined) return undefined;
	const reading = readWorkspaceTaint(workspaceDirectory);
	if (!reading.tainted) return undefined;
	const breaches =
		reading.entries.length === 0
			? 'its marker cannot be read, so which breach made it is unknown'
			: reading.entries.map(breachNamed).join('; ');
	return (
		`WORKSPACE_TAINTED: this Undertaking’s workspace is marked by a CLI executor’s breach — ${breaches}. Bytes reached ` +
		'it, or commands ran in it, that the host did not record, so no model step begins in it and no work is re-run in ' +
		`it while the mark stands. The mark is ${basename(workspaceTaintPath(workspaceDirectory))}, beside the ` +
		'workspace; no act in this host clears it yet.'
	);
}
