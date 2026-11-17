// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — the lead's ruling (k) on the review's fifth re-check — A THROWN VALUE, DESCRIBED: the one describer of every
// thrown value this package's code describes (`describedThrow`), and the one reader of a thrown value's code (`thrownCode`).
//
// ⛔ NEITHER CAN THROW, WHATEVER VALUE IS THROWN: a value that cannot be described — `Object.create(null)`, which `String` cannot convert; a revoked
// `Proxy`, which throws as it is inspected; an `Error` whose `message` getter throws — is said to be one, and a code that cannot be read is none. A
// describer that throws would throw in the place of the failure it was describing: a helper's close skipping the copy's removal, a refusal escaping as
// a 500, a step left RUNNING with no failure recorded.
// ⭑ ITS USERS: the step's end, its notes and the annotator, the session place's refusal and package N's two failure reasons (`runModelUnit`, the
// Undertaking page); the assurance stage's narrative writer and its shared workspace (`assurance-stage.ts`); a helper's turn, its failure, its session's
// close and its copy's removal (`stage-helper-run.ts`); and the session reader's two refusals (`executor-session.ts`).

/**
 * A thrown value, described: an `Error`'s message, any other value as a string. ⛔ It cannot throw: a value that cannot be described is said to be
 * one — *"a thrown value that cannot be described"*.
 */
export function describedThrow(e: unknown): string {
	try {
		return String(e instanceof Error ? e.message : e);
	} catch {
		return 'a thrown value that cannot be described';
	}
}

/**
 * A thrown value's code — a Node error's, `ENOENT` or `EISDIR` — as a string, or `undefined` where it carries none. ⛔ It cannot throw: a value that
 * cannot be inspected, or a code that cannot be described, carries none.
 */
export function thrownCode(e: unknown): string | undefined {
	try {
		const code = (e as { readonly code?: unknown } | null | undefined)?.code;
		return code === undefined || code === null ? undefined : String(code);
	} catch {
		return undefined;
	}
}
