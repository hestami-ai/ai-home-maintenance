/**
 * Minimal ambient declaration for `bun:sqlite`, scoped to exactly what the tracker uses.
 *
 * WHY A LOCAL D.TS AND NOT `bun-types`: `scripts/tsconfig.json` deliberately declares
 * `types: ["node"]`, and its own header records the reason a wider tooling surface is refused —
 * "a second lib level in tooling is what later gets copied into a package." Installing bun-types
 * workspace-wide to satisfy three scripts is that failure in dependency form. This file declares
 * the four methods the tracker calls and nothing else; if the tracker grows past it, THAT is the
 * moment to argue for the real types, with a use in hand.
 *
 * ⚠ RUNTIME SPLIT, recorded because it was DRIVEN not assumed (2026-08-20): better-sqlite3 does
 * not load under `bun <script>` at all (ERR_DLOPEN_FAILED, "not yet supported in Bun"), and
 * bun:sqlite does not exist under Node — so these scripts run ONLY via `bun`, and the verif
 * consumer test (vitest = Node) SPAWNS them rather than importing them. Neither runtime can
 * execute the other's driver; the CLI boundary is the seam.
 */
declare module 'bun:sqlite' {
	export interface Statement {
		run(...params: ReadonlyArray<string | number | null>): void;
		get(...params: ReadonlyArray<string | number | null>): unknown;
		all(...params: ReadonlyArray<string | number | null>): unknown[];
	}
	export class Database {
		constructor(
			filename: string,
			options?: { readonly create?: boolean; readonly readonly?: boolean }
		);
		exec(sql: string): void;
		prepare(sql: string): Statement;
		close(): void;
	}
}
