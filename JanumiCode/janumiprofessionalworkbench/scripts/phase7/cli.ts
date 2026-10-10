// ⭐ `JAN-EXEC` Phase 7, P7-4 — THE COMMAND LINES OF THE P7-4 TOOLS: closed flags, and reports that are never overwritten.
//
// ⛔ THE FLAGS ARE CLOSED. A misspelt flag is refused, never dropped in silence with its default run in its place — the
// reviewer-qualification CLI's rule (`scripts/reviewer-qual/run.ts`, `FLAGS`).
// ⛔ A REPORT IS WRITTEN ONCE. Each tool's report is evidence for the Phase 7 report, and a second run pointed at the same
// file must not replace the first: the write is exclusive (`wx`), and the CLIs refuse an existing `--out` before running.
import { existsSync, writeFileSync } from 'node:fs';

/** Each flag a CLI takes: one that carries a value, or a switch. */
export type FlagSpec = Readonly<Record<string, 'value' | 'switch'>>;
export type Flags = Readonly<Record<string, string | true>>;

/** `argv` read against `spec`, or why it cannot be. */
export function parseFlags(argv: readonly string[], spec: FlagSpec): Flags | string {
	const out: Record<string, string | true> = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (!arg.startsWith('--')) return `expected a --flag, at "${arg}"`;
		const name = arg.slice(2);
		const kind = spec[name];
		if (kind === undefined) return `unknown flag ${arg}`;
		if (name in out) return `${arg} is given twice`;
		if (kind === 'switch') {
			out[name] = true;
			continue;
		}
		const value = argv[i + 1];
		if (value === undefined || value.startsWith('--')) return `${arg} needs a value`;
		out[name] = value;
		i += 1;
	}
	return out;
}

/** Why `out` cannot take a new report, or undefined. */
export function reportPathProblem(out: string | true | undefined): string | undefined {
	if (out === undefined || out === true) return '--out is required';
	if (!out.endsWith('.json')) return '--out must name a .json file';
	if (existsSync(out)) return `${out} already exists, and is left untouched: a report is written once`;
	return undefined;
}

/** Write `value` as the report at `out`, failing rather than replacing a file that appeared since the check. */
export function writeNewReport(out: string, value: unknown): void {
	writeFileSync(out, `${JSON.stringify(value, null, '\t')}\n`, { flag: 'wx' });
}
