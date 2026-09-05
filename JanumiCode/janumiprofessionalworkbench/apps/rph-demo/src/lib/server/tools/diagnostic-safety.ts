// JAN-TOOLSUITE TS-06 — the prompt-leak check, kept PURE so the seam can use it.
//
// ⭑ IT LIVES ALONE, WITH NO NODE IMPORTS, FOR A REASON. The check belongs at the ASSURANCE SEAM, not inside
// each adapter: an adapter that sanitises is a discipline, a seam that sanitises is a property. Putting it in
// `devin-reviewer.ts` would drag `node:child_process` into the Validator, so it lives here instead.
//
// ⛔ WHAT IT PREVENTS IS FINDING #60, RECORDED IN `agy-cli.ts`: Node's `execFile` rejects with
// `Command failed: <full argv>`, and that message is caught by the floor runner and written VERBATIM into a
// `VALIDATOR_EXECUTION_FAILED` observation `statement`, which is dispatched and PROJECTED. `PER-12`: never
// logged, never projected. This codebase has no redaction, so a leak is permanent.

/**
 * Does this diagnostic contain the prompt we just sent?
 *
 * ⚠ A WHOLE-STRING COMPARISON MISSES THE CASE THAT MATTERS — a tool that echoes a TRUNCATED prompt has still
 * leaked it. Short prompts are compared whole, because a long probe drawn from a short prompt would match
 * ordinary English and withhold diagnostics that leaked nothing.
 *
 * ⭑ OVERLAPPING WINDOWS, NOT FIXED PROBES — AND A RED TAUGHT ME THAT. The first version probed the head, the
 * middle and the tail. A test echoing the last 120 characters slipped straight through, because `trim()` had
 * shifted the tail by one character and the fixed probe no longer aligned. Windows of `WINDOW` advancing by
 * half that mean ANY contiguous echo of 1.5x `WINDOW` contains one window whole, whatever its offset.
 * **A leak does not align itself to the windows we happen to check.**
 */
export function diagnosticCarriesPrompt(diagnostic: string, prompt: string): boolean {
	const needle = prompt.trim();
	if (needle.length === 0) return false;
	if (needle.length <= 120) return diagnostic.includes(needle);
	const WINDOW = 60;
	for (let i = 0; i + WINDOW <= needle.length; i += WINDOW / 2)
		if (diagnostic.includes(needle.slice(i, i + WINDOW))) return true;
	// The final window, so trailing characters are covered when the length is not a multiple of the step.
	return diagnostic.includes(needle.slice(-WINDOW));
}

/**
 * Convert a backing-tool failure into one that is safe to record.
 *
 * ⭑ THE DECISION IS A MEASUREMENT, NOT A DECLARATION. The suite records what each tool reports about its own
 * diagnostics, but a tool that declares `PROMPT_FREE` and is wrong would leak silently — a declaration merely
 * trusted is the "control that cannot fail" this repository keeps finding. Checking the actual bytes means a
 * wrong declaration fails SAFE.
 *
 * ⚠ AND IT WITHHOLDS ONLY WHAT IT MUST. Destroying every diagnostic would repeat agy's disclosed loss for no
 * reason: `REG-F-333` records that the diagnostic's lawful home is the exchange record's E-5, and that losing
 * it was accepted only because there was no alternative. A clean diagnostic survives.
 */
export function sanitiseToolFailure(error: unknown, prompt: string, toolLabel: string): Error {
	const raw = error instanceof Error ? error.message : String(error);
	if (!diagnosticCarriesPrompt(raw, prompt)) return new Error(`${toolLabel} invocation failed: ${raw}`);
	return new Error(
		`${toolLabel} invocation failed. Its diagnostic is WITHHELD from the record plane: it was MEASURED to ` +
			'contain the prompt, which may not be logged or projected (PER-12), and this host has no redaction. ' +
			'The classification is what a caller needs to act; the content is what it may not carry.'
	);
}
