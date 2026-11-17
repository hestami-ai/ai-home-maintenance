// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74 with D87's guidance (§12.28, §12.41; `REG-D-166` (3), (5); `REG-D-167` (2)) — THE HYPOTHESIZER'S PROMPT AND
// THE READER OF ITS ANSWER.
//
// ⭑ ITS DUTIES (the PWA specification's role model, §36): to generate plausible failure hypotheses, challenge evidence, identify untested conditions
// and propose discriminating checks — and to RUN them, in a copy of the shared workspace (`stage-helper-run.ts`), naming the candidate whose work most
// likely holds the fault, or saying it cannot tell. ⭑ AND ITS GUIDANCE (D87): how the next worker might proceed — advice, never a change to a unit's
// definition, its outputs or its criteria.
// ⛔ IT GIVES NO VERDICT: its answer is recorded as advice. A named unit outside the candidates refuses the diagnosis; a check it claims that the host
// did not capture it running is a finding on the diagnosis, which stands as advice (D74).
import { oneJsonObject } from './assurance-stage-records.js';
import type { ChapterStatement } from './narrative-chapter.js';

/** One candidate (D72): a unit whose work the rejected unit's work used, or the rejected unit itself. */
export interface HypothesizerCandidate {
	readonly id: string;
	readonly title: string;
	readonly purpose: string;
	readonly completionRule: string;
	/** Its accepted-work file in the shared workspace (D69), where it was accepted. */
	readonly acceptedWorkFile?: string;
	/** The files its recorded work changed (its last completion's view, D10). */
	readonly changedFiles: readonly string[];
}

/** ⭐ D74 + D87 — the answer's JSON form, as the Hypothesizer is asked for it. */
export const DIAGNOSIS_FORM =
	'{ "hypotheses": [{ "candidate": "<a candidate id, or null>", "statement": "<the hypothesis>", "evidence": ["<a record id or a file path>"], ' +
	'"checks": [{ "command": ["<argv>", "..."], "why": "<what it tests>", "ifHeld": "<what it would show if the hypothesis held>", "showed": "<what it showed>" }] }], ' +
	'"named": "<the candidate id whose work most likely holds the fault, or null if you cannot tell>", "confidence": "<how sure you are, in words>", ' +
	'"guidance": "<how the next worker might proceed — advice only>" }';

/** ⭐ D74 — THE HYPOTHESIZER'S PROMPT. */
export function hypothesizerPrompt(h: {
	readonly rejectedUnit: { readonly id: string; readonly title: string };
	readonly failedCriteria: readonly { readonly code: string; readonly statement: string }[];
	readonly candidates: readonly HypothesizerCandidate[];
	readonly narrative: readonly { readonly id: string; readonly failing: boolean; readonly statements: readonly ChapterStatement[] }[];
}): string {
	const narrative = h.narrative.flatMap((c) =>
		c.failing
			? [`Chapter ${c.id} failed its check and is left out: judge from the records instead.`]
			: [`Chapter ${c.id}:`, ...c.statements.map((s) => `- ${s.text} [${s.cites.join(', ')}]`)]
	);
	return [
		`You are the Hypothesizer of the assurance stage of a professional work Undertaking. The declared reviews of "${h.rejectedUnit.title}" (${h.rejectedUnit.id})`,
		'rejected its work. Find which unit’s work most likely holds the fault: the rejected unit itself, or a unit whose work its work used.',
		'',
		'Your duties: generate plausible failure hypotheses; challenge the evidence; identify untested conditions; propose discriminating checks — and RUN',
		'them. You work in a COPY of the Undertaking’s shared workspace: write_file writes there and run_command runs there, and the copy is discarded',
		'after your answer. Change nothing outside it.',
		'',
		'The criteria the rejecting reviews found not met, each with its review’s rationale:',
		...h.failedCriteria.map((f) => `- ${f.code}: ${f.statement}`),
		'',
		'The candidates:',
		...h.candidates.map(
			(c) =>
				`- ${c.id} "${c.title}": purpose: ${c.purpose}; completion rule: ${c.completionRule}; ` +
				`accepted work: ${c.acceptedWorkFile ?? 'not accepted'}; files its recorded work changed: ${c.changedFiles.join(', ') || 'none recorded'}`
		),
		'',
		'The narrative memory of the Undertaking so far, this round’s chapter included:',
		...(narrative.length > 0 ? narrative : ['- (none written)']),
		'',
		'Name ONE candidate whose work most likely holds the fault, or say you cannot tell (named: null). Give no verdict on the work.',
		'Then give your guidance: how the next worker might proceed — for example, to build the work in parts and check each. It is advice only: it',
		'must not change any unit’s definition, its outputs or its criteria.',
		'',
		'Reply with ONE JSON object and nothing else, in this form:',
		DIAGNOSIS_FORM
	].join('\n');
}

/** A claimed check's command, as compared with the runs the host captured. */
const commandKey = (command: unknown): string | undefined => {
	if (Array.isArray(command) && command.every((a) => typeof a === 'string')) return JSON.stringify(command);
	if (typeof command === 'string' && command.trim() !== '') return JSON.stringify(command.trim().split(/\s+/));
	return undefined;
};

/** A diagnosis as read, and the host's findings on it. */
export interface ReadDiagnosis {
	readonly named: string | null;
	readonly guidance: string;
	readonly confidence: string;
	readonly hypotheses: readonly { readonly candidate: string | null; readonly statement: string }[];
	/** Why the diagnosis is refused — a named unit outside the candidates — or undefined. */
	readonly refusedBecause?: string;
	/** The host's findings that leave it standing as advice: each claimed check the host did not capture it running. */
	readonly findings: readonly string[];
}

/**
 * ⭐⭐ D74 + D87 — READ THE ANSWER: its JSON form, a named unit held to the candidates (outside them, the diagnosis is refused), and each claimed
 * check held to the commands the host captured (absent, a finding). ⛔ `undefined` with why when it does not parse.
 */
export function readDiagnosis(
	answer: string,
	candidateIds: ReadonlySet<string>,
	capturedArgv: readonly (readonly string[])[]
): { readonly ok: true; readonly diagnosis: ReadDiagnosis } | { readonly ok: false; readonly why: string } {
	const parsed = oneJsonObject(answer);
	if (!parsed.ok) return { ok: false, why: parsed.why };
	const v = parsed.value;
	const named = typeof v.named === 'string' && v.named.trim() !== '' ? v.named.trim() : null;
	const ran = new Set(capturedArgv.map((a) => JSON.stringify(a)));
	const hypotheses = (Array.isArray(v.hypotheses) ? v.hypotheses : []).map((h) => {
		const o = (typeof h === 'object' && h !== null ? h : {}) as Record<string, unknown>;
		return {
			candidate: typeof o.candidate === 'string' ? o.candidate : null,
			statement: typeof o.statement === 'string' ? o.statement : '',
			checks: Array.isArray(o.checks) ? o.checks : []
		};
	});
	const findings: string[] = [];
	for (const h of hypotheses)
		for (const check of h.checks) {
			const key = commandKey((check as { command?: unknown } | null)?.command);
			if (key !== undefined && !ran.has(key))
				findings.push(`its check ${key} is not among the commands the host captured it running (design D74)`);
		}
	return {
		ok: true,
		diagnosis: {
			named,
			guidance: typeof v.guidance === 'string' ? v.guidance : '',
			confidence: typeof v.confidence === 'string' ? v.confidence : '',
			hypotheses: hypotheses.map(({ candidate, statement }) => ({ candidate, statement })),
			...(named !== null && !candidateIds.has(named)
				? { refusedBecause: `it names ${named}, which is not among the candidates (design D74)` }
				: {}),
			findings
		}
	};
}
