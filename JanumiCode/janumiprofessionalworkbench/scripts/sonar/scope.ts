/**
 * The Sonar scope, derived from `sonar-project.properties` and the tracked files (JAN-SONARCM D-1; roadmap S1).
 *
 * WHY THIS EXISTS. The language server does not read `sonar-project.properties` (SONARCM F-4): asked to analyse a
 * file, it analyses it, and it looks for tsconfigs on its own ("Found 17 tsconfig.json file(s)", among them SvelteKit's
 * generated one). Until S1 the only working copy of the scope was hard-coded in a scratch script. Here the properties
 * file is parsed and its patterns applied, so the scope has one source, and `scope-census.json`, written from this by
 * `census.ts`, is what the runner analyses.
 *
 * WHAT IS IN SCOPE. A tracked file under one of `sonar.sources`, matching none of `sonar.exclusions`, whose suffix is
 * one SonarJS analyses by default (`.js`, `.jsx`, `.cjs`, `.mjs`, `.ts`, `.tsx`, `.cts`, `.mts`; `.vue` left out, as the
 * design's V-12 leaves it out: JPWB has none). `.svelte` files are counted apart: no analyzer the engine bundles reads
 * them (SONARCM D-6). Patterns follow Sonar's wildcards: `*` within one path segment, `**` across segments, `?` one
 * character, all relative to the JPWB root.
 *
 * Tracked files only (`git ls-files`), as cycle 6's file list took them: an untracked scratch file is not the product.
 */

export const SCOPE_KEYS = ['sonar.sources', 'sonar.exclusions', 'sonar.test.inclusions', 'sonar.typescript.tsconfigPaths'] as const;
export type ScopeKey = (typeof SCOPE_KEYS)[number];
export type ScopeProperties = Readonly<Record<ScopeKey, readonly string[]>>;

/** SonarJS's default file suffixes for JavaScript and TypeScript, less `.vue`. */
export const ANALYSABLE_SUFFIXES = ['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'] as const;

/** Every logical line of a Java properties file as key -> value (comments, blank lines and continuations handled). */
export function parseProperties(text: string): Map<string, string> {
	const out = new Map<string, string>();
	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		let line = (lines[i] ?? '').trimStart();
		if (line === '' || line.startsWith('#') || line.startsWith('!')) continue;
		while (line.endsWith('\\') && i + 1 < lines.length) {
			i++;
			line = line.slice(0, -1) + (lines[i] ?? '').trimStart();
		}
		const sep = line.search(/[=:]/);
		if (sep > 0) out.set(line.slice(0, sep).trim(), line.slice(sep + 1).trim());
	}
	return out;
}

/** The four scope keys as trimmed comma lists; a missing key is an error, never an empty scope (J4). */
export function scopeProperties(text: string): ScopeProperties {
	const all = parseProperties(text);
	const missing = SCOPE_KEYS.filter((k) => !all.has(k));
	if (missing.length > 0) throw new Error(`sonar-project.properties does not set ${missing.join(', ')}`);
	const list = (k: ScopeKey): string[] =>
		(all.get(k) ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s !== '');
	return {
		'sonar.sources': list('sonar.sources'),
		'sonar.exclusions': list('sonar.exclusions'),
		'sonar.test.inclusions': list('sonar.test.inclusions'),
		'sonar.typescript.tsconfigPaths': list('sonar.typescript.tsconfigPaths')
	};
}

/** The characters a path in a Sonar pattern may hold besides the wildcards; each stands for itself. */
const LITERAL = /^[\w./ -]$/;

/** The regular-expression text for one literal path character: `.` and `-` inside a class, where they are plain. */
function literal(c: string, pattern: string): string {
	if (!LITERAL.test(c)) throw new Error(`Sonar pattern ${JSON.stringify(pattern)}: character ${JSON.stringify(c)} is not supported here`);
	return c === '.' || c === '-' ? `[${c}]` : c;
}

/** One Sonar wildcard pattern as an anchored regular expression over `/`-separated relative paths. */
export function sonarPattern(pattern: string): RegExp {
	let re = '';
	for (let i = 0; i < pattern.length; i++) {
		const c = pattern.charAt(i);
		if (pattern.startsWith('**/', i)) {
			re += '(?:.*/)?';
			i += 2;
		} else if (pattern.startsWith('/**', i) && i + 3 === pattern.length) {
			re += '(?:/.*)?';
			i += 2;
		} else if (pattern.startsWith('**', i)) {
			re += '.*';
			i += 1;
		} else if (c === '*') re += '[^/]*';
		else if (c === '?') re += '[^/]';
		else re += literal(c, pattern);
	}
	return new RegExp(`^${re}$`);
}

function suffixOf(path: string): string {
	const name = path.slice(path.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

function underSources(path: string, sources: readonly string[]): boolean {
	return sources.some((s) => path === s || path.startsWith(s.endsWith('/') ? s : `${s}/`));
}

export interface Scope {
	/** The files the engine is asked to analyse, sorted. */
	readonly files: readonly string[];
	/** The tracked tsconfigs the properties' globs match, sorted: what the server must report finding. */
	readonly tsconfigs: readonly string[];
	/** Tracked files under the sources that are left out, by reason. */
	readonly leftOut: Readonly<Record<string, number>>;
}

/** The scope the properties select from the tracked files (paths relative to the JPWB root, `/`-separated). */
export function scopeOf(props: ScopeProperties, tracked: readonly string[]): Scope {
	const exclusions = props['sonar.exclusions'].map((p) => ({ p, re: sonarPattern(p) }));
	const tsconfigGlobs = props['sonar.typescript.tsconfigPaths'].map(sonarPattern);
	const files: string[] = [];
	const leftOut: Record<string, number> = {};
	const count = (why: string): void => {
		leftOut[why] = (leftOut[why] ?? 0) + 1;
	};
	for (const path of tracked) {
		if (!underSources(path, props['sonar.sources'])) continue;
		const excludedBy = exclusions.find((x) => x.re.test(path));
		const suffix = suffixOf(path);
		if (excludedBy !== undefined) count(`excluded by ${excludedBy.p}`);
		else if (suffix === '.svelte') count('.svelte (no analyzer)');
		else if ((ANALYSABLE_SUFFIXES as readonly string[]).includes(suffix)) files.push(path);
	}
	const tsconfigs = tracked.filter((p) => tsconfigGlobs.some((re) => re.test(p)));
	return { files: [...files].sort(byCodePoint), tsconfigs: [...tsconfigs].sort(byCodePoint), leftOut };
}

/** Code-point order, so the census reads the same on every machine and locale. */
export function byCodePoint(a: string, b: string): number {
	return Number(a > b) - Number(a < b);
}

export const CENSUS_SCHEMA = 'jpwb-sonar-scope-census/1';
export const CENSUS_FILE = 'scripts/sonar/scope-census.json';
export const PROPERTIES_FILE = 'sonar-project.properties';
export const CENSUS_COMMAND = 'bun run sonar:census';

export interface Census {
	readonly schema: typeof CENSUS_SCHEMA;
	readonly $comment: string;
	readonly properties: ScopeProperties;
	readonly suffixes: readonly string[];
	readonly counts: {
		readonly files: number;
		readonly byRoot: Readonly<Record<string, number>>;
		readonly bySuffix: Readonly<Record<string, number>>;
		readonly leftOut: Readonly<Record<string, number>>;
	};
	readonly tsconfigs: readonly string[];
	readonly files: readonly string[];
}

function tally(keys: readonly string[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const k of [...keys].sort(byCodePoint)) out[k] = (out[k] ?? 0) + 1;
	return out;
}

function sortedRecord(r: Readonly<Record<string, number>>): Record<string, number> {
	return Object.fromEntries(Object.entries(r).sort(([a], [b]) => byCodePoint(a, b)));
}

/** The census of the scope the properties select from the tracked files. */
export function censusOf(propertiesText: string, tracked: readonly string[]): Census {
	const properties = scopeProperties(propertiesText);
	const scope = scopeOf(properties, tracked);
	return {
		schema: CENSUS_SCHEMA,
		$comment: `The Sonar scope (JAN-SONARCM D-1; roadmap S1): the tracked files ${PROPERTIES_FILE} selects for the engine, and the tsconfigs its globs match. Generated by \`${CENSUS_COMMAND}\` (scripts/sonar/census.ts); never edited by hand. verif/sonar-runner.test.ts fails when it differs from what the properties select, and scripts/sonar/batch-runner.cjs analyses these files and no others.`,
		properties,
		suffixes: ANALYSABLE_SUFFIXES,
		counts: {
			files: scope.files.length,
			byRoot: tally(scope.files.map((f) => f.slice(0, f.indexOf('/')))),
			bySuffix: tally(scope.files.map(suffixOf)),
			leftOut: sortedRecord(scope.leftOut)
		},
		tsconfigs: scope.tsconfigs,
		files: scope.files
	};
}

/** The census as it is committed: tab-indented JSON and a final newline, like the matrix beside it. */
export function renderCensus(census: Census): string {
	return `${JSON.stringify(census, null, '\t')}\n`;
}

/** Every reason two censuses differ, in words that name the file and the command that fixes it; empty when equal. */
export function censusDrift(committed: Census, fresh: Census): string[] {
	const problems: string[] = [];
	const had = new Set(committed.files);
	const has = new Set(fresh.files);
	const added = fresh.files.filter((f) => !had.has(f));
	const removed = committed.files.filter((f) => !has.has(f));
	if (added.length > 0) problems.push(`${added.length} file(s) in scope but not in the census: ${added.slice(0, 5).join(', ')}`);
	if (removed.length > 0) problems.push(`${removed.length} file(s) in the census but no longer in scope: ${removed.slice(0, 5).join(', ')}`);
	if (JSON.stringify(committed.tsconfigs) !== JSON.stringify(fresh.tsconfigs)) {
		problems.push(`the tsconfigs differ: census ${JSON.stringify(committed.tsconfigs)}, properties ${JSON.stringify(fresh.tsconfigs)}`);
	}
	if (problems.length === 0 && renderCensus(committed) !== renderCensus(fresh)) problems.push('the census differs from a fresh one outside its file and tsconfig lists');
	return problems.map((p) => `${CENSUS_FILE}: ${p}. Run \`${CENSUS_COMMAND}\` and commit the result.`);
}
