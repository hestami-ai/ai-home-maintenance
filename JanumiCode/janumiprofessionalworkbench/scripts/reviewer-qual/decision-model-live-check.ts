// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D54's LIVE CHECK (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.6,
// revision 9; roadmap §9b.5b, Z2 live acceptance 10) — THE PRODUCT'S CLIENT AGAINST STEP 1'S OWN CODE, ON ONE SERVER VERSION. Run
// outside the gate: free, local, about two and a half hours.
//
// ⭑ THE REFERENCE: step 1's own Python cold path (`step1_reference.py`, which loads `step1_single.py`'s definitions as rev9's
// `server_version_check.py` does) asks all 394 questions of the screen's 17 cases, one cold request each.
// ⭑ THE PRODUCT: its 232 v13 scores read from D54's records (`docs/tracking/reviewer-qualification/decision-model/v13.ndjson`,
// made through the product's own client), and its client asks the 162 questions of the six `W14-` cases live — cut from their
// rendered prompts by the product's own cut (`review-cuts.ts`), each body the product's (`decisionModelBody`).
// ⛔ THE ACCEPTANCE: every score exactly equal, and every body's sha256 equal, 394 of 394 — on the records' own server version.
// Never against step 1's own 0.40.11 scores (`REG-F-608`: they cannot be re-made on 0.40.15).
// ⛔ ITS STOPS, the records script's: another model loaded; the digest or the server version changed, read before each case and
// after the last; a review the client refuses.
// ⭐ THE CANARY (`--canary <case>`): one v13 case asked live through the product's client — the product's own review of the case,
// not its record — and through step 1's path, each question once; every key compared, the counts and times printed.
//
// usage: bun --conditions=source scripts/reviewer-qual/decision-model-live-check.ts --server <address> --model <name>
//          --digest <hex> --step1 <step1_single.py> --out <folder> [--hardpairs <folder of W14 prompts>] [--canary <case id>]
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecisionModelClient } from '../../apps/rph-demo/src/lib/server/assurance/decision-model-client.js';
import { materialOf } from '../../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import {
	reviewPrompt,
	type IndicationExchange,
	type IndicationRequest,
	type IndicationsResult
} from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { checksOf, REVIEW_STARTS, statementsOf } from '../../apps/rph-demo/src/lib/server/assurance/review-cuts.js';

/** The screen's 17 cases, as step 1 named them (`step1_single.py` `V13`, `W14`). */
export const SCREENED_V13 = [
	'W12-CSV-RR-08',
	'W12-CSV-RR-03',
	'W12-RR-03',
	'D12-AC-01',
	'W13-CSV-RERUN-RR-07',
	'P12-RR-02',
	'W12-CSV-CLEAN',
	'W12-CLEAN',
	'D12-AC-CLEAN',
	'W13-CSV-RERUN',
	'P12-RR-03'
] as const;
export const SCREENED_W14 = ['W14-INH-RR-07', 'W14-STALE-RR-07', 'W14-RPT-RR-07', 'W14-INH', 'W14-STALE', 'W14-RPT'] as const;

/** One question's answer, by either path: its score and the sha256 of the exact bytes it was asked with. */
export interface Answered {
	readonly score: number;
	readonly bodySha256: string;
}
/** A case's answers, by `checks`/`statements` and key — the screen's own kinds. */
export type CaseAnswers = Record<string, Record<string, Answered>>;

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const KIND = { check: 'checks', statement: 'statements' } as const;
/** One side's answer as a difference names it: its score and its body's sha256 cut to 12 characters, or `none` when it has none. */
const shownAnswer = (x: Answered | undefined): string => (x === undefined ? 'none' : `${x.score} ${x.bodySha256.slice(0, 12)}`);

/**
 * ⭐ THE COMPARISON: every question of every case, the product's answer against the reference's — the same keys, each score
 * exactly equal (the same double) and each body's sha256 equal. A key one side lacks is a difference.
 */
export function compareAnswers(
	product: Readonly<Record<string, CaseAnswers>>,
	reference: Readonly<Record<string, CaseAnswers>>
): { readonly equal: number; readonly differ: readonly string[] } {
	let equal = 0;
	const differ: string[] = [];
	const cases = [...new Set([...Object.keys(product), ...Object.keys(reference)])];
	for (const c of cases)
		for (const kind of ['checks', 'statements'])
			for (const key of new Set([...Object.keys(product[c]?.[kind] ?? {}), ...Object.keys(reference[c]?.[kind] ?? {})])) {
				const p = product[c]?.[kind]?.[key];
				const r = reference[c]?.[kind]?.[key];
				// S6582: kept explicit - an optional chain would read a missing reference answer's fields as undefined, and a product record lacking those fields (unvalidated JSON) would then count as equal
				if (p !== undefined && r !== undefined && p.score === r.score && p.bodySha256 === r.bodySha256) equal += 1;
				else
					differ.push(
						`${c} ${kind} ${key}: product ${shownAnswer(p)}, ` +
							`step 1 ${shownAnswer(r)}`
					);
			}
	return { equal, differ };
}

/** ⭐ A rendered prompt's requests, by the product's own cut (`review-cuts.ts`), and its material (`materialOf`). */
export function requestsOfText(text: string): { readonly requests: IndicationRequest[]; readonly material: string } {
	const at = text.indexOf(REVIEW_STARTS);
	if (at < 0) throw new Error('the prompt holds no review section');
	const head = text.slice(0, at);
	const fence = text.split('\n').find((line) => /^<<<UNTRUSTED-\p{Nd}+>>>$/u.test(line));
	if (fence === undefined) throw new Error('the prompt holds no quoted region');
	const key = (p: string, i: number) => `${p}${String(i).padStart(2, '0')}`;
	return {
		requests: [
			...checksOf(text.slice(at)).map((c, i): IndicationRequest => ({ kind: 'check', key: key('c', i), id: c.id, label: c.label })),
			...statementsOf(head, fence).map((s, i): IndicationRequest => ({ kind: 'statement', key: key('s', i), statement: s.text }))
		],
		material: materialOf(head)
	};
}

/** A client's result as answers, by kind and key — or why it holds none for every question. */
export function answersOf(requests: readonly IndicationRequest[], result: IndicationsResult): CaseAnswers | string {
	if ('refusal' in result) return result.refusal;
	const sent = new Map((result.exchanges ?? []).map((x: IndicationExchange) => [x.key, x]));
	const out: CaseAnswers = { checks: {}, statements: {} };
	for (const r of requests) {
		const x = sent.get(r.key);
		if (x?.outcome.kind !== 'SCORED') return `${r.key} holds no score`;
		out[KIND[r.kind]]![r.key] = { score: x.outcome.score, bodySha256: sha256(x.body) };
		if (x.otherModels.length > 0) return `another model was loaded when ${r.key} was sent (${x.otherModels.join(', ')})`;
	}
	return out;
}

/** Step 1's reference rows, by case, kind and key. */
function referenceOf(file: string): { readonly answers: Record<string, CaseAnswers>; readonly versions: Set<string> } {
	const answers: Record<string, CaseAnswers> = {};
	const versions = new Set<string>();
	if (!existsSync(file)) return { answers, versions };
	for (const line of readFileSync(file, 'utf8').split('\n').filter((l) => l.trim() !== '')) {
		const r = JSON.parse(line) as { case: string; kind: string; key: string; score: number; bodySha256: string; server: string };
		versions.add(r.server);
		let byCase = answers[r.case];
		if (byCase === undefined || byCase === null) {
			byCase = {};
			answers[r.case] = byCase;
		}
		let byKind = byCase[r.kind];
		if (byKind === undefined || byKind === null) {
			byKind = {};
			byCase[r.kind] = byKind;
		}
		byKind[r.key] = { score: r.score, bodySha256: r.bodySha256 };
	}
	return { answers, versions };
}

/** `--name value` arguments, by name. */
function argsOf(argv: readonly string[]): Map<string, string> {
	const out = new Map<string, string>();
	for (let i = 0; i < argv.length; i += 1) if (argv[i]!.startsWith('--')) out.set(argv[i]!.slice(2), argv[i + 1] ?? '');
	return out;
}

/** An address without the slashes it ends with, found by a scan back from its end; none when none was given. */
function withoutTrailingSlashes(s: string | undefined): string | undefined {
	if (s === undefined) return undefined;
	let end = s.length;
	while (end > 0 && s[end - 1] === '/') end -= 1;
	return s.slice(0, end);
}

/** The server's version and the model's digest, as the server reports them now. */
async function servedNow(server: string, model: string): Promise<{ readonly digest: string; readonly serverVersion: string; readonly others: string[] }> {
	const json = async (path: string) => (await (await fetch(`${server}${path}`, { signal: AbortSignal.timeout(60_000) })).json()) as Record<string, unknown>;
	const tags = (json('/api/tags') as Promise<{ models?: { name?: string; digest?: string }[] }>);
	const entry = ((await tags).models ?? []).find((m) => m.name === model);
	const version = String((await json('/api/version')).version);
	const ps = ((await json('/api/ps')) as { models?: { name?: string; model?: string }[] }).models ?? [];
	return { digest: entry?.digest ?? '', serverVersion: version, others: ps.map((m) => String(m.name || m.model)).filter((m) => m !== model) };
}

export async function main(argv: readonly string[]): Promise<number> {
	const a = argsOf(argv);
	const server = withoutTrailingSlashes(a.get('server'));
	const model = a.get('model');
	const digest = a.get('digest');
	const step1 = a.get('step1');
	const outDir = a.get('out');
	const canary = a.get('canary');
	const hardpairs = a.get('hardpairs');
	if (!server || !model || !digest || !step1 || !outDir || (!canary && !hardpairs)) {
		console.error(
			'usage: decision-model-live-check.ts --server <address> --model <name> --digest <hex> --step1 <step1_single.py> --out <folder> ' +
				'(--hardpairs <folder of W14 prompts> | --canary <case id>)'
		);
		return 2;
	}
	mkdirSync(outDir, { recursive: true });
	const root = new URL('../../', import.meta.url);
	const at = await servedNow(server, model);
	if (!at.digest.startsWith(digest)) return (console.error(`STOPPED: ${model} is served with digest ${at.digest.slice(0, 12)}, not ${digest}`), 1);
	if (at.others.length > 0) return (console.error(`STOPPED: another model is loaded (${at.others.join(', ')}): the check is made with none`), 1);
	console.log(`${model} ${at.digest.slice(0, 12)} on Ollama ${at.serverVersion}`);
	// ⭐⭐ Package L8 — D63 (`REG-D-152`): held to the version the server answered when the check began, and none beside it.
	const client = createDecisionModelClient({ server, model, identity: { digest, serverVersion: at.serverVersion, alsoAccepted: [] } });
	const same = async (when: string): Promise<boolean> => {
		const now = await servedNow(server, model);
		if (now.digest === at.digest && now.serverVersion === at.serverVersion) return true;
		console.error(`STOPPED: ${when}, the server serves ${now.digest.slice(0, 12)} on Ollama ${now.serverVersion} (REG-F-608)`);
		return false;
	};
	const product: Record<string, CaseAnswers> = {};
	const times: number[] = [];
	const askLive = async (id: string, requests: readonly IndicationRequest[], material: string): Promise<boolean> => {
		if (!(await same(`before ${id}`))) return false;
		const t0 = Date.now();
		const result = await client(requests, material);
		times.push(Date.now() - t0);
		const answers = answersOf(requests, result);
		if (typeof answers === 'string') return (console.error(`STOPPED: ${id}: ${answers}`), false);
		product[id] = answers;
		appendFileSync(join(outDir, 'product.ndjson'), `${JSON.stringify({ case: id, serverVersion: at.serverVersion, answers })}\n`, 'utf8');
		console.log(`product ${id}: ${requests.length} question(s) asked, ${Math.round((Date.now() - t0) / 1000)} s`);
		return true;
	};
	let cases: string[];
	if (canary) {
		// ⭐ THE CANARY: the product's own review of a v13 case, its requests asked live through its client.
		const { committedCaseSet, PRODUCT_SEAMS } = await import('./fingerprint.js');
		const { caseReviewInput } = await import('./materialize.js');
		const c = committedCaseSet(root).cases.find((x) => x.id === canary);
		if (c === undefined) return (console.error(`no case ${canary} in the current set`), 2);
		let asked: { requests: readonly IndicationRequest[]; material: string } | undefined;
		await reviewPrompt(caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult), async (requests, material) => {
			asked = { requests, material };
			return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
		});
		if (!asked || !(await askLive(canary, asked.requests, asked.material))) return 1;
		cases = [canary];
	} else {
		// ⭑ v13: the records' scores, made through the product's client on this server version.
		const recordsFile = fileURLToPath(new URL('docs/tracking/reviewer-qualification/decision-model/v13.ndjson', root));
		const lines = readFileSync(recordsFile, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as Record<string, unknown>);
		const head = lines[0] as { serverVersion?: string; digest?: string };
		if (head.serverVersion !== at.serverVersion || head.digest !== at.digest)
			return (console.error(`STOPPED: the records were made on Ollama ${head.serverVersion}, not this server's ${at.serverVersion}`), 1);
		for (const l of lines.slice(1))
			if (l.kind === 'CASE' && (SCREENED_V13 as readonly string[]).includes(l.id as string)) {
				const out: CaseAnswers = { checks: {}, statements: {} };
				for (const q of l.questions as { key: string; kind: 'check' | 'statement'; score: number; bodySha256: string }[])
					out[KIND[q.kind]]![q.key] = { score: q.score, bodySha256: q.bodySha256 };
				product[l.id as string] = out;
			}
		for (const id of SCREENED_W14) {
			const { requests, material } = requestsOfText(readFileSync(join(hardpairs!, `${id}.txt`), 'utf8'));
			if (!(await askLive(id, requests, material))) return 1;
		}
		cases = [...SCREENED_V13, ...SCREENED_W14];
	}
	if (!(await same('after the product’s last case'))) return 1;
	// ⭑ THE REFERENCE: step 1's own code, on the same server.
	const referenceFile = join(outDir, 'step1-reference.ndjson');
	const py = spawnSync('python', ['-I', fileURLToPath(new URL('step1_reference.py', import.meta.url)), step1, referenceFile, ...cases], {
		stdio: 'inherit'
	});
	if (py.status !== 0) return (console.error(`STOPPED: step 1's path ended with ${py.status}`), 1);
	const reference = referenceOf(referenceFile);
	if (reference.versions.size !== 1 || !reference.versions.has(at.serverVersion))
		return (console.error(`STOPPED: step 1's path ran on ${[...reference.versions].join(', ')}, not ${at.serverVersion}`), 1);
	const { equal, differ } = compareAnswers(product, Object.fromEntries(cases.map((c) => [c, reference.answers[c] ?? {}])));
	console.log(`exactly equal ${equal} of ${equal + differ.length}, on Ollama ${at.serverVersion}`);
	for (const d of differ.slice(0, 40)) console.log(`DIFFERS ${d}`);
	if (times.length > 0) {
		const perCase = times.map((t) => `${Math.round(t / 1000)} s`).join(', ');
		console.log(`the product's client: ${perCase} a case`);
	}
	return differ.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
