// ── SCAN CONTEXT: THE LOADS AN ENUMERATION MAKES ARE NOT THE LOADS A CALLER MADE (`JAN-CRITREAD` `DD-6b`) ────────────
//
// `REG-D-070` §5.5's containment gate asks a question the storage layer cannot answer on its own: of the aggregates a
// draft read BY ID, is each one pinned, in a declared group, or knowingly advisory? Every scan answers that question
// wrongly by itself — `listByType` loads EVERY aggregate of a type while enumerating it, and a recorder that counted
// those as by-id reads would report the whole store as a direct dependency.
//
// ⛔ THIS IS THE DEFECT THAT SANK TWO EARLIER RECORDERS, and the design says so: revision 1's recorder was coarse
// because every set read scans the log, and revision 2 recorded at the STORAGE layer, "where a scan's loads and a
// direct load are indistinguishable". They are distinguishable only if the enumerator SAYS so, which is what this is.
//
// A counter rather than a boolean: scans nest (a query helper filtering another's rows), and a boolean would be
// cleared by the inner one while the outer was still enumerating.

let depth = 0;

/** Run `fn` as an ENUMERATION: the loads it makes are the scan's, not a caller's by-id read. */
export function withScanContext<T>(fn: () => T): T {
	depth += 1;
	try {
		return fn();
	} finally {
		depth -= 1;
	}
}

/** Is a load happening inside an enumeration? Read by the recorder, never by domain code. */
export function inScanContext(): boolean {
	return depth > 0;
}
