/**
 * `bun run sonar:exceptions` — the Sonar exceptions register's checks, and the page generated from it (JAN-SONARCM D-5,
 * V-8 and V-10; roadmap S5).
 *
 * A Sonar finding left in place on purpose is an entry in `docs/operations/sonar-exceptions.json`, with JAN-ENGC-001
 * §7.4's fields, approved by a register ruling that names it, and its site carries the marker
 * `// eslint-disable-next-line <rule> -- EXC-nnn <reason>`. `docs/operations/sonarqube.md` §8 is the procedure.
 *
 * The checks are pure, so the tests hand them fixtures; `checkTree` runs them all on a checkout:
 * - the register's form, and each entry's fields (V-8's first limb: an entry with no owner);
 * - each approval: a `REG-D` ruling the decision register holds, not struck, the sponsor's or a recorded delegation's,
 *   naming the entry (V-8's second limb; J6);
 * - each declared pin: the folder a test pins, its pin's words still in that test (route (b));
 * - the scan of the Sonar scope: every ESLint directive that can turn a rule off is a marker; each marker joins its
 *   entry, and each entry has its markers (V-8's third and fourth limbs); no comment starts with NOSONAR (V-10);
 * - the page, byte for byte what the register generates.
 *
 * usage: bun run sonar:exceptions [--check] [--root=<dir>]
 * exit:  0 the page written (or, with --check, every check holds); 1 a defect, each printed, and nothing written;
 *        2 an input could not be read.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { freshCensus, JPWB_ROOT } from './census.js';

export const REGISTER_FILE = 'docs/operations/sonar-exceptions.json';
export const PAGE_FILE = 'docs/operations/sonar-exceptions.md';
export const RULINGS_FILE = 'docs/canon/JPWB-REG-005 Decision and Divergence Register.md';
export const RULE_SET_FILE = 'scripts/sonar/rules.json';
export const REGISTER_SCHEMA = 'jpwb-sonar-exceptions/1';
export const EXCEPTIONS_COMMAND = 'bun run sonar:exceptions';
export const MARKER_FORM = '// eslint-disable-next-line <rule> -- EXC-nnn <reason>';

// ── The register's form ───────────────────────────────────────────────────────────────────────────────────────────

export type ApprovalKind = 'sponsor' | 'delegated';

export interface Approval {
	readonly ruling: string;
	readonly kind: ApprovalKind;
}

/** JAN-ENGC-001 §7.4: "an owner and a removal condition, review date, or expiry when the exception is temporary". */
export interface Term {
	readonly temporary: boolean;
	readonly removal?: string;
	readonly review?: string;
	readonly expiry?: string;
}

/** A file whose markers cite the entry, and how many. */
export interface Location {
	readonly path: string;
	readonly markers: number;
}

/** Route (b): a finding in a file whose bytes a test pins, located by path, rule and count, with no marker. */
export interface Pinned {
	readonly path: string;
	readonly findings: number;
}

export interface Entry {
	readonly id: string;
	readonly tool: string;
	readonly rule: { readonly key: string; readonly eslintName: string };
	readonly finding: string;
	readonly locations?: readonly Location[];
	readonly pinned?: Pinned;
	readonly why: string;
	readonly risk: string;
	readonly controls: string;
	readonly approval: Approval;
	readonly owner: string;
	readonly term: Term;
}

export interface PinnedFolder {
	readonly folder: string;
	readonly pinnedBy: string;
	readonly pin: string;
}

export interface SharedName {
	readonly pluginRule: string;
	readonly sonarKey: string;
	readonly languages: readonly string[];
	readonly sharedWith: string;
	readonly collidingRules: readonly string[];
	readonly measured: boolean;
	readonly effect: string;
}

export interface ProofRun {
	readonly id: string;
	readonly date: string;
	readonly package: string;
	readonly channel: 'engine' | 'lint';
	readonly tree?: string;
	readonly engine?: Readonly<Record<string, string>>;
	readonly node?: string;
	readonly ruleSetSha256?: string;
	readonly censusSha256?: string;
	readonly versions?: Readonly<Record<string, string>>;
	readonly config?: string;
	readonly files: number;
}

export interface ProofCase {
	readonly id: string;
	readonly what: string;
	readonly marker: string;
	readonly engine: string;
	readonly lint: string;
	readonly runs: readonly string[];
}

export interface Register {
	readonly schema: string;
	readonly $comment: string;
	readonly exceptions: readonly Entry[];
	readonly pinnedFolders: readonly PinnedFolder[];
	readonly sharedNames: {
		readonly $comment: string;
		readonly derivedFrom: Readonly<Record<string, string>>;
		readonly names: readonly SharedName[];
	};
	readonly markerProof: { readonly $comment: string; readonly runs: readonly ProofRun[]; readonly cases: readonly ProofCase[] };
}

const ENTRY_FIELDS = new Set([
	'id',
	'tool',
	'rule',
	'finding',
	'locations',
	'pinned',
	'why',
	'risk',
	'controls',
	'approval',
	'owner',
	'term'
]);
const TEXT_FIELDS = ['finding', 'why', 'risk', 'controls', 'owner'] as const;
const ID = /^EXC-\d{3}$/;
const RULE_KEY = /^(?:javascript|typescript):S\d+$/;
const ESLINT_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?(?:[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9-]*$/;
const RULING = /^REG-D-\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isText(v: unknown): v is string {
	return typeof v === 'string' && v.trim() !== '';
}

function isCount(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}

/** A calendar date written `YYYY-MM-DD` (2026-02-30 is not one). */
export function isDate(v: unknown): v is string {
	if (typeof v !== 'string' || !DATE.test(v)) return false;
	const [y, m, d] = v.split('-').map(Number) as [number, number, number];
	const t = new Date(Date.UTC(y, m - 1, d));
	return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function textProblems(id: string, e: Json): string[] {
	const out: string[] = [];
	for (const field of TEXT_FIELDS) {
		const v = e[field];
		if (!isText(v)) out.push(`${id}: "${field}" is missing or empty (JAN-ENGC-001 §7.4)`);
		else if (/[\r\n]/.test(v)) out.push(`${id}: "${field}" holds a line break; write it as one line`);
	}
	return out;
}

function ruleProblems(id: string, rule: unknown, ruleKeys: ReadonlySet<string>): string[] {
	if (!isObject(rule)) return [`${id}: "rule" is missing (JAN-ENGC-001 §7.4)`];
	const out: string[] = [];
	const { key, eslintName } = rule;
	if (typeof key !== 'string' || !RULE_KEY.test(key)) {
		out.push(`${id}: "rule.key" must be the engine's key, such as typescript:S3776, not ${JSON.stringify(key)}`);
	} else if (!ruleKeys.has(key)) {
		out.push(`${id}: rule ${key} is not in the committed rule set (${RULE_SET_FILE})`);
	}
	if (typeof eslintName !== 'string' || !ESLINT_NAME.test(eslintName)) {
		out.push(`${id}: "rule.eslintName" must be the rule's name as ESLint knows it, not ${JSON.stringify(eslintName)}`);
	}
	return out;
}

function locationProblems(id: string, e: Json): string[] {
	const hasLocations = e.locations !== undefined;
	const hasPinned = e.pinned !== undefined;
	if (hasLocations === hasPinned) return [`${id}: give "locations" (its markers' files) or "pinned" (route (b)), exactly one`];
	if (hasPinned) {
		const p = e.pinned;
		if (!isObject(p) || !isText(p.path) || !isCount(p.findings)) {
			return [`${id}: "pinned" must hold "path" and "findings", a count of 1 or more`];
		}
		return [];
	}
	if (!Array.isArray(e.locations) || e.locations.length === 0) return [`${id}: "locations" must list at least one file`];
	const out: string[] = [];
	const seen = new Set<string>();
	for (const l of e.locations as unknown[]) {
		if (!isObject(l) || !isText(l.path) || !isCount(l.markers)) {
			out.push(`${id}: each location must hold "path" and "markers", a count of 1 or more`);
			continue;
		}
		if (seen.has(l.path)) out.push(`${id}: ${l.path} is listed twice`);
		seen.add(l.path);
	}
	return out;
}

function approvalFormProblems(id: string, a: unknown): string[] {
	if (!isObject(a)) return [`${id}: "approval" is missing (JAN-ENGC-001 §7.4)`];
	const out: string[] = [];
	if (typeof a.ruling !== 'string' || !RULING.test(a.ruling)) {
		out.push(`${id}: "approval.ruling" must name a REG-D ruling, not ${JSON.stringify(a.ruling)}`);
	}
	if (a.kind !== 'sponsor' && a.kind !== 'delegated') {
		out.push(`${id}: "approval.kind" must be "sponsor" or "delegated", not ${JSON.stringify(a.kind)}`);
	}
	return out;
}

function termProblems(id: string, t: unknown): string[] {
	if (!isObject(t) || typeof t.temporary !== 'boolean') return [`${id}: "term" must hold "temporary", true or false`];
	const out: string[] = [];
	for (const field of ['review', 'expiry'] as const) {
		if (t[field] !== undefined && !isDate(t[field])) out.push(`${id}: "term.${field}" must be a date, YYYY-MM-DD`);
	}
	if (t.removal !== undefined && !isText(t.removal)) out.push(`${id}: "term.removal" is empty`);
	if (t.temporary && t.removal === undefined && t.review === undefined && t.expiry === undefined) {
		out.push(`${id}: a temporary exception needs a removal condition, a review date or an expiry (JAN-ENGC-001 §7.4)`);
	}
	return out;
}

/** One entry's §7.4 fields and form. The rule key must be in the committed rule set. */
export function entryProblems(entry: unknown, ruleKeys: ReadonlySet<string>): string[] {
	if (!isObject(entry)) return ['an entry is not an object'];
	const id = typeof entry.id === 'string' && ID.test(entry.id) ? entry.id : undefined;
	if (id === undefined) return [`an entry's "id" must be EXC- and three digits, not ${JSON.stringify(entry.id)}`];
	const unknown = Object.keys(entry).filter((k) => !ENTRY_FIELDS.has(k));
	return [
		...unknown.map((k) => `${id}: unknown field "${k}"`),
		...(entry.tool === 'SonarJS' ? [] : [`${id}: "tool" must be "SonarJS", not ${JSON.stringify(entry.tool)}`]),
		...ruleProblems(id, entry.rule, ruleKeys),
		...textProblems(id, entry),
		...locationProblems(id, entry),
		...approvalFormProblems(id, entry.approval),
		...termProblems(id, entry.term)
	];
}

function pinnedFolderProblems(folders: unknown): string[] {
	if (!Array.isArray(folders)) return ['"pinnedFolders" must be a list'];
	const out: string[] = [];
	for (const f of folders as unknown[]) {
		if (!isObject(f) || !isText(f.folder) || !f.folder.endsWith('/') || !isText(f.pinnedBy) || !isText(f.pin)) {
			out.push('each pinned folder must hold "folder" (ending in /), "pinnedBy" and "pin"');
		}
	}
	return out;
}

function recordProblems(r: Json): string[] {
	const out: string[] = [];
	const shared = r.sharedNames;
	if (!isObject(shared) || !Array.isArray(shared.names) || !isObject(shared.derivedFrom)) {
		out.push('"sharedNames" must hold "derivedFrom" and "names"');
	}
	const proof = r.markerProof;
	if (!isObject(proof) || !Array.isArray(proof.runs) || !Array.isArray(proof.cases)) {
		out.push('"markerProof" must hold "runs" and "cases"');
	}
	return out;
}

/** The register's own form: its schema, each entry's fields, unique ids, and its declared pins' form. */
export function registerProblems(r: unknown, ruleKeys: ReadonlySet<string>): string[] {
	if (!isObject(r)) return [`${REGISTER_FILE} is not a JSON object`];
	if (r.schema !== REGISTER_SCHEMA) return [`${REGISTER_FILE}: "schema" must be ${REGISTER_SCHEMA}, not ${JSON.stringify(r.schema)}`];
	if (!Array.isArray(r.exceptions)) return [`${REGISTER_FILE}: "exceptions" must be a list`];
	const out: string[] = [];
	const ids = new Map<string, number>();
	for (const e of r.exceptions as unknown[]) {
		out.push(...entryProblems(e, ruleKeys));
		if (isObject(e) && typeof e.id === 'string') ids.set(e.id, (ids.get(e.id) ?? 0) + 1);
	}
	for (const [id, n] of ids) if (n > 1) out.push(`${id}: ${n} entries have this id`);
	out.push(...pinnedFolderProblems(r.pinnedFolders), ...recordProblems(r));
	return out;
}

// ── The approval (V-8's second limb; J6) ─────────────────────────────────────────────────────────────────────────

/** A `REG-D` ruling as the decision register holds it: its heading's words after the id, and its whole text. */
export interface Ruling {
	readonly struck: boolean;
	readonly title: string;
	readonly text: string;
}

const HEADING = /^### (~~)?(REG-D-\d+)(?:~~)? — (.*)$/;

/** The decision register's `REG-D` rulings, read from its entry headings, as `verif/mutant-ledger.test.ts` reads them. */
export function rulingsOf(markdown: string): Map<string, Ruling> {
	const rulings = new Map<string, Ruling>();
	let current: { id: string; struck: boolean; title: string; lines: string[] } | undefined;
	const close = (): void => {
		if (current !== undefined) {
			rulings.set(current.id, { struck: current.struck, title: current.title, text: current.lines.join('\n') });
		}
	};
	for (const line of markdown.split('\n')) {
		if (line.startsWith('### ') || line.startsWith('## ')) {
			close();
			const m = HEADING.exec(line);
			current = m === null ? undefined : { id: m[2]!, struck: m[1] !== undefined, title: m[3]!, lines: [line] };
		} else if (current !== undefined) {
			current.lines.push(line);
		}
	}
	close();
	return rulings;
}

const DELEGATED = /^DELEGATED \(`(REG-D-\d+)`\)/;
const SPONSOR_RULING = 'SPONSOR RULING';

function headingOf(r: Ruling): string {
	return r.title.length > 60 ? `${r.title.slice(0, 60)}...` : r.title;
}

/** A delegation the approval rests on: a sponsor ruling the decision register holds, not struck. */
function delegationProblem(id: string, ruling: string, delegation: string, rulings: ReadonlyMap<string, Ruling>): string | undefined {
	const d = rulings.get(delegation);
	const what = `${id}: ${ruling} rests on the delegation ${delegation}`;
	if (d === undefined) return `${what}, which the decision register does not hold (${RULINGS_FILE})`;
	if (d.struck) return `${what}, which the decision register has struck`;
	if (!d.title.startsWith(SPONSOR_RULING)) return `${what}, which is not a sponsor ruling (its heading reads "${headingOf(d)}")`;
	return undefined;
}

function kindProblem(entry: Entry, r: Ruling, rulings: ReadonlyMap<string, Ruling>): string | undefined {
	const { id, approval } = entry;
	if (approval.kind === 'sponsor') {
		return r.title.startsWith(SPONSOR_RULING)
			? undefined
			: `${id}: its approval is "sponsor", but ${approval.ruling} is not a sponsor ruling (its heading reads "${headingOf(r)}")`;
	}
	const d = DELEGATED.exec(r.title);
	if (d === null) return `${id}: its approval is "delegated", but ${approval.ruling}'s heading does not read DELEGATED (\`REG-D-nnn\`)`;
	return delegationProblem(id, approval.ruling, d[1]!, rulings);
}

/** One entry's approval against the decision register. Not the author: the sponsor, or a delegation the sponsor made. */
export function approvalProblems(entry: Entry, rulings: ReadonlyMap<string, Ruling>): string[] {
	const { id, approval } = entry;
	const r = rulings.get(approval.ruling);
	if (r === undefined) return [`${id}: its approval cites ${approval.ruling}, which the decision register does not hold (${RULINGS_FILE})`];
	if (r.struck) return [`${id}: its approval cites ${approval.ruling}, which the decision register has struck`];
	const out: string[] = [];
	const kind = kindProblem(entry, r, rulings);
	if (kind !== undefined) out.push(kind);
	// The id as a word: not inside a longer name or number (an id is EXC- and three digits, so it holds no pattern syntax).
	if (!new RegExp(`(?<![A-Za-z0-9_])${id}(?![A-Za-z0-9_])`, 'u').test(r.text)) out.push(`${id}: ${approval.ruling} does not name ${id}`);
	return out;
}

// ── The comments of a file ───────────────────────────────────────────────────────────────────────────────────────

export interface SourceComment {
	readonly kind: 'line' | 'block';
	/** The text between the delimiters, as ESLint's `comment.value`. */
	readonly value: string;
	/** 1-based. */
	readonly line: number;
}

const KINDS: Readonly<Record<string, ts.ScriptKind>> = {
	'.ts': ts.ScriptKind.TS,
	'.mts': ts.ScriptKind.TS,
	'.cts': ts.ScriptKind.TS,
	'.tsx': ts.ScriptKind.TSX,
	'.js': ts.ScriptKind.JS,
	'.mjs': ts.ScriptKind.JS,
	'.cjs': ts.ScriptKind.JS,
	'.jsx': ts.ScriptKind.JSX
};

function scriptKind(path: string): ts.ScriptKind {
	const dot = path.lastIndexOf('.');
	return KINDS[dot === -1 ? '' : path.slice(dot)] ?? ts.ScriptKind.TS;
}

function isJsDoc(node: ts.Node): boolean {
	return node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode;
}

/**
 * Every token of the parse, in order. A JSDoc block is a child of the node it documents, and its text is also that
 * node's leading trivia, so JSDoc children are left out: the end-of-file token carries a documentation block at the
 * end of a file as JSDoc, and counted as a child it hid the token, and every comment before it, from the walk.
 */
function leaves(node: ts.Node, sf: ts.SourceFile, out: ts.Node[]): void {
	const children = node.getChildren(sf).filter((c) => !isJsDoc(c));
	if (children.length === 0) out.push(node);
	else for (const c of children) leaves(c, sf, out);
}

/**
 * Every comment of a file, from TypeScript's parse: each token's leading comments (those after a line break) and its
 * trailing ones (those on its own line), so text inside a string, a template or a regular expression is never read as
 * a comment. JSX text is not trivia, and a range that starts inside it is dropped.
 */
export function commentsOf(path: string, text: string): SourceComment[] {
	const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path));
	const tokens: ts.Node[] = [];
	leaves(sf, sf, tokens);
	const jsxText = tokens.filter((t) => t.kind === ts.SyntaxKind.JsxText || t.kind === ts.SyntaxKind.JsxTextAllWhiteSpaces);
	const inJsxText = (pos: number): boolean => jsxText.some((t) => pos >= t.pos && pos < t.end);
	const ranges = new Map<number, ts.CommentRange>();
	for (const t of tokens) {
		const leading = inJsxText(t.pos) ? [] : (ts.getLeadingCommentRanges(text, t.pos) ?? []);
		for (const r of [...leading, ...(ts.getTrailingCommentRanges(text, t.end) ?? [])]) {
			if (!inJsxText(r.pos)) ranges.set(r.pos, r);
		}
	}
	return [...ranges.values()]
		.sort((a, b) => a.pos - b.pos)
		.map((r) => {
			const line = r.kind === ts.SyntaxKind.SingleLineCommentTrivia;
			return {
				kind: line ? 'line' : 'block',
				value: text.slice(r.pos + 2, line ? r.end : r.end - 2),
				line: sf.getLineAndCharacterOfPosition(r.pos).line + 1
			};
		});
}

// ── Directives, as ESLint 9.39.5 reads them ──────────────────────────────────────────────────────────────────────

export interface Directive {
	readonly label: string;
	readonly rules: readonly string[];
	readonly justification: string;
}

/** `@eslint/plugin-kit`'s `directivesPattern` and ESLint's own set of directive labels (`lib/shared/directives.js`). */
const LABEL = /^([a-z]+(?:-[a-z]+)*)(?:\s|$)/u;
const ESLINT_LABEL = /^(eslint(?:-env|-enable|-disable(?:(?:-next)?-line)?)?|exported|globals?)$/u;
/** The labels that can turn a rule off: the four disable/enable forms and an inline rule configuration. */
const TURNS_RULES_OFF = new Set(['eslint', 'eslint-disable', 'eslint-enable', 'eslint-disable-line', 'eslint-disable-next-line']);

/** A comment's directive, split as `ConfigCommentParser.parseDirective` and `parseListConfig` split it. */
export function directiveOf(comment: SourceComment): Directive | undefined {
	const dash = /\s-{2,}\s/u.exec(comment.value);
	const directivePart = (dash === null ? comment.value : comment.value.slice(0, dash.index)).trim();
	const justification = dash === null ? '' : comment.value.slice(dash.index + dash[0].length).trim();
	const m = LABEL.exec(directivePart);
	if (m === null) return undefined;
	const label = m[1]!;
	if (!ESLINT_LABEL.test(label)) return undefined;
	// ESLint reads a line comment as a directive only in the two `-line` forms (`getInlineConfigNodes`).
	if (comment.kind === 'line' && label !== 'eslint-disable-line' && label !== 'eslint-disable-next-line') return undefined;
	const rules = directivePart
		.slice(m.index + label.length)
		.split(',')
		.map((r) => r.trim().replace(/^(['"]?)(.*)\1$/su, '$2'))
		.filter((r) => r !== '');
	return { label, rules, justification };
}

export function turnsRulesOff(d: Directive): boolean {
	return TURNS_RULES_OFF.has(d.label);
}

/** The engine's own NOSONAR rule (SonarJS 14.4's bundle): the text, less one leading `*`, trimmed, starts with it. */
export function isNoSonar(comment: SourceComment): boolean {
	const v = comment.value.startsWith('*') ? comment.value.slice(1).trim() : comment.value.trim();
	return v.toUpperCase().startsWith('NOSONAR');
}

// ── The scan of the Sonar scope, and the join ────────────────────────────────────────────────────────────────────

export interface Marker {
	readonly path: string;
	readonly line: number;
	readonly rule: string;
	readonly id: string;
}

export interface Scan {
	readonly markers: readonly Marker[];
	readonly problems: readonly string[];
}

const CITED_ID = /^EXC-\d{3}/u;
const CITATION = /^(EXC-\d{3})(?:\s+(\S.*))?$/su;

function directiveProblem(path: string, c: SourceComment, d: Directive): string | Marker {
	const where = `${path}:${c.line}`;
	if (d.label !== 'eslint-disable-next-line' || c.kind !== 'line') {
		const form = c.kind === 'line' ? `// ${d.label}` : `/* ${d.label} */`;
		return `${where}: ${form} can turn a rule off; the only directive the Sonar scope admits is the marker, ${MARKER_FORM}`;
	}
	if (d.rules.length === 0) return `${where}: a marker names one rule, and this names none`;
	if (d.rules.length > 1) return `${where}: a marker names one rule, and this names ${d.rules.length} (${d.rules.join(', ')})`;
	const rule = d.rules[0]!;
	const cited = CITATION.exec(d.justification);
	if (cited === null && CITED_ID.test(d.justification)) {
		return `${where}: the marker's reason must follow its id after a space: ${MARKER_FORM}`;
	}
	if (cited === null) {
		return `${where}: eslint-disable-next-line ${rule} cites no exception; write ${MARKER_FORM}, with an entry in ${REGISTER_FILE} (J1)`;
	}
	if (cited[2] === undefined) return `${where}: the marker for ${cited[1]} gives no reason after the id`;
	return { path, line: c.line, rule, id: cited[1]! };
}

/** One file's markers, its other directives that can turn a rule off, and its NOSONAR comments. */
export function scanFile(path: string, text: string): Scan {
	const markers: Marker[] = [];
	const problems: string[] = [];
	for (const c of commentsOf(path, text)) {
		const where = `${path}:${c.line}`;
		if (isNoSonar(c)) {
			problems.push(`${where}: a comment starts with NOSONAR, which silences every rule on its line in the engine; record an exception instead (V-10)`);
			continue;
		}
		const d = directiveOf(c);
		if (d === undefined || !turnsRulesOff(d)) continue;
		const r = directiveProblem(path, c, d);
		if (typeof r === 'string') problems.push(r);
		else markers.push(r);
	}
	return { markers, problems };
}

export interface ScopeFile {
	readonly path: string;
	readonly text: string;
}

export function scanScope(files: readonly ScopeFile[]): Scan {
	const scans = files.map((f) => scanFile(f.path, f.text));
	return { markers: scans.flatMap((s) => s.markers), problems: scans.flatMap((s) => s.problems) };
}

function countsByPath(markers: readonly Marker[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const m of markers) counts.set(m.path, (counts.get(m.path) ?? 0) + 1);
	return counts;
}

function markerEntryProblems(entries: ReadonlyMap<string, Entry>, markers: readonly Marker[]): string[] {
	const out: string[] = [];
	for (const m of markers) {
		const e = entries.get(m.id);
		const where = `${m.path}:${m.line}`;
		if (e === undefined) out.push(`${where}: the marker cites ${m.id}, which has no entry in ${REGISTER_FILE}`);
		else if (e.pinned !== undefined) out.push(`${where}: the marker cites ${m.id}, a pinned entry, which takes no marker`);
		else if (m.rule !== e.rule.eslintName) {
			out.push(`${where}: the marker for ${m.id} names ${m.rule}, but its entry's rule is ${e.rule.eslintName}`);
		}
	}
	return out;
}

function locationJoinProblems(e: Entry, found: ReadonlyMap<string, number>, scope: ReadonlySet<string>): string[] {
	const locations = e.locations ?? [];
	if (found.size === 0) return [`${e.id}: no marker in the Sonar scope cites it, and it is not a pinned entry`];
	const out: string[] = [];
	for (const l of locations) {
		if (!scope.has(l.path)) out.push(`${e.id}: ${l.path} is not in the Sonar scope`);
		else if ((found.get(l.path) ?? 0) !== l.markers) {
			out.push(`${e.id}: ${l.path} holds ${found.get(l.path) ?? 0} marker(s) citing it; its entry says ${l.markers}`);
		}
	}
	const listed = new Set(locations.map((l) => l.path));
	for (const [path, n] of found) {
		if (!listed.has(path)) out.push(`${e.id}: ${path} holds ${n} marker(s) citing it, but its entry does not list that file`);
	}
	return out;
}

function pinnedJoinProblems(e: Entry, pinned: Pinned, folders: readonly PinnedFolder[], scope: ReadonlySet<string>): string[] {
	const out: string[] = [];
	if (!scope.has(pinned.path)) out.push(`${e.id}: its pinned file ${pinned.path} is not in the Sonar scope`);
	if (!folders.some((f) => pinned.path.startsWith(f.folder))) {
		out.push(`${e.id}: ${pinned.path} is under no folder the register declares pinned`);
	}
	return out;
}

/** The join: each marker to its entry, each entry to its markers or its pinned file (V-8's third and fourth limbs). */
export function joinProblems(register: Register, markers: readonly Marker[], scope: ReadonlySet<string>): string[] {
	const entries = new Map(register.exceptions.map((e) => [e.id, e]));
	const out = markerEntryProblems(entries, markers);
	for (const e of register.exceptions) {
		if (e.pinned !== undefined) out.push(...pinnedJoinProblems(e, e.pinned, register.pinnedFolders, scope));
		else out.push(...locationJoinProblems(e, countsByPath(markers.filter((m) => m.id === e.id)), scope));
	}
	return out;
}

/** Each declared pin's words must still be in the test that pins the folder. `read` gives a file's text, or undefined. */
export function pinProblems(folders: readonly PinnedFolder[], read: (path: string) => string | undefined): string[] {
	const out: string[] = [];
	for (const f of folders) {
		const text = read(f.pinnedBy);
		if (text === undefined) out.push(`${f.folder}: ${f.pinnedBy}, the test said to pin it, cannot be read`);
		else if (!text.includes(f.pin)) out.push(`${f.folder}: ${f.pinnedBy} no longer holds the words "${f.pin}"`);
	}
	return out;
}

/** The dates that have passed on `today` (YYYY-MM-DD): listed by --check, judged by S4's sweep, never by the gate. */
export function passedDates(register: Register, today: string): string[] {
	const out: string[] = [];
	for (const e of register.exceptions) {
		if (e.term.expiry !== undefined && e.term.expiry < today) out.push(`${e.id}: its expiry, ${e.term.expiry}, has passed`);
		if (e.term.review !== undefined && e.term.review < today) out.push(`${e.id}: its review date, ${e.term.review}, has passed`);
	}
	return out;
}

// ── The page ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** A table cell's text: a `|` would end the cell, so it is written as its HTML entity. */
function cell(s: string): string {
	return s.replaceAll('|', '&#124;');
}

function code(s: string): string {
	return s === '' ? '(none)' : `\`${s}\``;
}

function termText(t: Term): string {
	if (!t.temporary) return 'Not temporary.';
	const parts = [
		t.removal === undefined ? '' : `removal condition: ${t.removal}`,
		t.review === undefined ? '' : `review by ${t.review}`,
		t.expiry === undefined ? '' : `expiry ${t.expiry}`
	].filter((p) => p !== '');
	return `Temporary: ${parts.join('; ')}.`;
}

function whereText(e: Entry): string {
	if (e.pinned !== undefined) {
		return `${code(e.pinned.path)}, ${e.pinned.findings} finding(s), with no marker: a test pins the file's bytes (route (b)).`;
	}
	return (e.locations ?? []).map((l) => `${code(l.path)} (${l.markers} marker(s))`).join(', ');
}

function entrySection(e: Entry): string[] {
	const by = e.approval.kind === 'sponsor' ? 'the sponsor' : 'a delegation the register records';
	return [
		`### ${e.id} · ${e.rule.key} (${code(e.rule.eslintName)})`,
		'',
		`- **Finding:** ${e.finding}`,
		`- **Where:** ${whereText(e)}`,
		`- **Why it stays:** ${e.why}`,
		`- **Risk:** ${e.risk}`,
		`- **Compensating controls:** ${e.controls}`,
		`- **Approved by:** ${e.approval.ruling}, a ruling of ${by}.`,
		`- **Owner:** ${e.owner}`,
		`- **Term:** ${termText(e.term)}`,
		''
	];
}

const SHARED_WITH: Readonly<Record<string, string>> = {
	'eslint-core': 'ESLint core',
	'typescript-eslint': 'typescript-eslint',
	both: 'ESLint core and typescript-eslint'
};

function runText(r: ProofRun): string {
	if (r.channel === 'lint') {
		const versions = Object.entries(r.versions ?? {})
			.map(([k, v]) => `${k} ${v}`)
			.join(', ');
		return `| ${r.id} | ${r.date} | lint | ${cell(versions)}; ${cell(r.config ?? '')} | ${r.files} |`;
	}
	const engine = Object.entries(r.engine ?? {})
		.map(([k, v]) => `${k} ${v}`)
		.join(', ');
	const facts = `tree ${r.tree ?? ''}; ${engine}; Node ${r.node ?? ''}; rule set sha256 ${r.ruleSetSha256 ?? ''}; census sha256 ${r.censusSha256 ?? ''}`;
	return `| ${r.id} | ${r.date} | engine | ${cell(facts)} | ${r.files} |`;
}

/** The page, generated from the register: nothing on it is written by hand. */
export function renderPage(register: Register): string {
	const entries = [...register.exceptions].sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
	const lines = [
		'# Sonar exceptions — JPWB',
		'',
		`<!-- Generated from ${REGISTER_FILE} by \`${EXCEPTIONS_COMMAND}\`; do not edit by hand. -->`,
		'',
		"The Sonar findings JPWB leaves in place on purpose, each under JAN-ENGC-001 §7.4 and approved by a register ruling that names it. The procedure is `docs/operations/sonarqube.md` §8. The source is " +
			`\`${REGISTER_FILE}\`; \`verif/sonar-exceptions.test.ts\` joins it with the markers in the Sonar scope and checks this page against it.`,
		'',
		`At a site, a finding left in place carries the marker \`${MARKER_FORM}\`. No other ESLint directive that can turn a rule off is admitted in the Sonar scope, and no comment may start with NOSONAR.`,
		'',
		'## Exceptions',
		'',
		...(entries.length === 0 ? ['No exception is recorded.', ''] : entries.flatMap(entrySection)),
		'## Folders whose bytes a test pins',
		'',
		'A finding in these folders cannot take a marker without re-pinning the test, so its entry is `pinned`: located by path, rule and count, and held by the engine baseline (route (b)).',
		'',
		'| Folder | Pinned by | The pin, in the test\'s words |',
		'| --- | --- | --- |',
		...register.pinnedFolders.map((f) => `| ${code(f.folder)} | ${code(f.pinnedBy)} | "${cell(f.pin)}" |`),
		'',
		`## The ${register.sharedNames.names.length} rule names the plugin shares with ESLint core or typescript-eslint`,
		'',
		`${register.sharedNames.$comment} Derived from ${Object.entries(register.sharedNames.derivedFrom)
			.map(([k, v]) => `${k} ${v}`)
			.join(', ')}.`,
		'',
		'| Plugin rule | Sonar key | Languages | Shared with | Effect of a marker naming the shared rule |',
		'| --- | --- | --- | --- | --- |',
		...register.sharedNames.names.map(
			(n) =>
				`| ${code(n.pluginRule)} | ${n.sonarKey} | ${n.languages.join(', ')} | ${n.collidingRules.map(code).join(', ')} (${SHARED_WITH[n.sharedWith] ?? n.sharedWith}) | ${cell(n.effect)} |`
		),
		'',
		'## The marker proof (V-9)',
		'',
		register.markerProof.$comment,
		'',
		'| Case | Marker | Engine | Lint | Runs |',
		'| --- | --- | --- | --- | --- |',
		...register.markerProof.cases.map(
			(c) => `| ${cell(c.what)} | ${code(cell(c.marker))} | ${cell(c.engine)} | ${cell(c.lint)} | ${c.runs.join(', ')} |`
		),
		'',
		'### The runs',
		'',
		'| Run | Date | Channel | Configuration | Files |',
		'| --- | --- | --- | --- | --- |',
		...register.markerProof.runs.map(runText),
		''
	];
	return lines.join('\n');
}

/** The committed page against what the register generates. */
export function pageDrift(committedPage: string | undefined, register: Register): string[] {
	if (committedPage === renderPage(register)) return [];
	return [`${PAGE_FILE} is not what ${REGISTER_FILE} generates: run \`${EXCEPTIONS_COMMAND}\` and commit the result`];
}

// ── The tree ─────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Inputs {
	readonly registerText: string;
	readonly ruleKeys: ReadonlySet<string>;
	readonly rulingsText: string;
	readonly pageText: string | undefined;
}

function readOptional(path: string): string | undefined {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return undefined;
	}
}

/** The register, the rule set's keys, the decision register and the page, read from a checkout. Throws if one of the first three is unreadable. */
export function readInputs(root: string): Inputs {
	const rules = JSON.parse(readFileSync(join(root, RULE_SET_FILE), 'utf8')) as { rules: string[] };
	return {
		registerText: readFileSync(join(root, REGISTER_FILE), 'utf8'),
		ruleKeys: new Set(rules.rules),
		rulingsText: readFileSync(join(root, RULINGS_FILE), 'utf8'),
		pageText: readOptional(join(root, PAGE_FILE))
	};
}

/** The register parsed and its form checked; `register` only when the form holds. */
export function parseRegister(text: string, ruleKeys: ReadonlySet<string>): { register?: Register; problems: string[] } {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch (e) {
		return { problems: [`${REGISTER_FILE} is not JSON: ${(e as Error).message}`] };
	}
	const problems = registerProblems(json, ruleKeys);
	return problems.length === 0 ? { register: json as Register, problems } : { problems };
}

/** What every check reads: the register as parsed, the rule set's keys, the decision register, the scope's files, a reader for the tests that pin folders, and the committed page. */
export interface CheckInputs {
	readonly registerJson: unknown;
	readonly ruleKeys: ReadonlySet<string>;
	readonly rulingsText: string;
	readonly files: readonly ScopeFile[];
	readonly read: (path: string) => string | undefined;
	readonly pageText: string | undefined;
}

/** Every check, pure: the register's form first (nothing else is judged on a register whose form fails), then the rulings, the declared pins, the scan and its join, and the page. */
export function problemsOf(c: CheckInputs): string[] {
	const form = registerProblems(c.registerJson, c.ruleKeys);
	if (form.length > 0) return form;
	const register = c.registerJson as Register;
	const rulings = rulingsOf(c.rulingsText);
	const scan = scanScope(c.files);
	return [
		...register.exceptions.flatMap((e) => approvalProblems(e, rulings)),
		...pinProblems(register.pinnedFolders, c.read),
		...scan.problems,
		...joinProblems(register, scan.markers, new Set(c.files.map((f) => f.path))),
		...pageDrift(c.pageText, register)
	];
}

/** Every check on a checkout, its scope computed as S1's census computes it. */
export function checkTree(root: string, inputs: Inputs): string[] {
	let registerJson: unknown;
	try {
		registerJson = JSON.parse(inputs.registerText);
	} catch (e) {
		return [`${REGISTER_FILE} is not JSON: ${(e as Error).message}`];
	}
	return problemsOf({
		registerJson,
		ruleKeys: inputs.ruleKeys,
		rulingsText: inputs.rulingsText,
		files: freshCensus(root).files.map((path) => ({ path, text: readFileSync(join(root, path), 'utf8') })),
		read: (p) => readOptional(join(root, p)),
		pageText: inputs.pageText
	});
}

export function main(argv: readonly string[], out: (s: string) => void, err: (s: string) => void): number {
	const rootArg = argv.find((a) => a.startsWith('--root='));
	const root = rootArg === undefined ? JPWB_ROOT : rootArg.slice('--root='.length);
	let inputs: Inputs;
	try {
		inputs = readInputs(root);
	} catch (e) {
		err(`sonar:exceptions — an input could not be read: ${(e as Error).message}\n`);
		return 2;
	}
	if (argv.includes('--check')) {
		const problems = checkTree(root, inputs);
		for (const p of problems) err(`${p}\n`);
		const parsed = parseRegister(inputs.registerText, inputs.ruleKeys);
		const today = new Date().toISOString().slice(0, 10);
		for (const n of parsed.register === undefined ? [] : passedDates(parsed.register, today)) out(`note: ${n}\n`);
		if (problems.length > 0) return 1;
		out(`sonar:exceptions --check — every check holds (${parsed.register?.exceptions.length ?? 0} exception(s)).\n`);
		return 0;
	}
	const parsed = parseRegister(inputs.registerText, inputs.ruleKeys);
	if (parsed.register === undefined) {
		for (const p of parsed.problems) err(`${p}\n`);
		return 1;
	}
	const page = renderPage(parsed.register);
	if (page === inputs.pageText) {
		out(`sonar:exceptions — ${PAGE_FILE} is current.\n`);
		return 0;
	}
	writeFileSync(join(root, PAGE_FILE), page);
	out(`sonar:exceptions — wrote ${PAGE_FILE}.\n`);
	return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2), (s) => process.stdout.write(s), (s) => process.stderr.write(s)));
