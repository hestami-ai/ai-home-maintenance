// ⭐ APPLYING A MUTANT — its `replace` goes in LITERALLY (`JAN-CRITREAD` J2-2).
//
// `String.prototype.replace(string, string)` is not a literal substitution: in the replacement, `$$`, `$&`, `` $` ``
// and `$'` are PATTERNS (a dollar, the match, the text before it, the text after it). J2-2's `J22-M25` wrote
// `key.startsWith('$')`, and `$'` spliced the rest of `record.ts` into the line: the mutant reported NO_COMPILE
// ("Unterminated string") for a text that compiles. A replacement FUNCTION's return value is inserted as-is.
export function applyMutant(original: string, find: string, replace: string): string {
	return original.replace(find, () => replace);
}
