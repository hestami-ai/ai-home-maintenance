// ⭐ `JAN-EXEC` Phase 7 P5, package B (F5) — THE CAUSES THE ARCHIVE'S K5 CHECK NAMES for a capture folder no evidence names,
// in its own words: `run-archive.ts` writes them into each archive's `checks.json` (`causesOf`), and the run report takes a
// captured run's cause from the ones that check left possible (`run-report-core.ts`, `runsDropped`). ⛔ One module, importing
// nothing, so the report never reads a cause by words the archive no longer writes.

/** A run past the ones the product keeps as evidence (`REG-F-517`). */
export const k5CapCause = (limit: number): string =>
	`a run after the first ${limit}, which the product keeps as no evidence (REG-F-517)`;

/** The step stopped before its evidence join, so no run of it became evidence. */
export const K5_STOP_CAUSE =
	'the step stopped before its evidence join: a try that did not run, a work product that could not be recorded, or a sandbox or executor that refused to open';

/** The evidence join refused part-way. */
export const K5_JOIN_CAUSE =
	'the evidence join refused part-way, and the runs after the one it could not record got none';

/** A folder no run of the runner made (`REG-F-521`). */
export const K5_OWN_FOLDER_CAUSE =
	'a folder a command wrote itself: a command runs as the server’s user, unconfined (REG-F-521), and can reach this folder';
