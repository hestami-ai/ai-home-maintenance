// ⭐⭐ `JAN-EXEC` Phase 7 completion programme, package E3 — C4, THE CHECKS ON THE ACCEPTED CANDIDATE BEFORE SUBMIT, WHICH
// RECORD AND REPORT AND REFUSE NOTHING (`docs/_working/DESIGN-phase-7-completion.md` §4 C4; `REG-D-110` (4)).
//
// The design first had them refuse a candidate that would strand a unit or fake a "Yes". The sponsor chose otherwise:
// *"Name wordfreq; measure traps"* (`REG-D-110` (4)) — *"The candidate checks (the design's C4) record and report what they
// find. They do not refuse before Submit, so a trap plays out live and the run reports it."* So these are a MEASUREMENT:
// the lane writes their findings to its record, the run report shows them beside what each unit then did, and the run
// goes on whatever they say. ⛔ Nothing here returns a verdict a caller could refuse on: `refused` is the literal `false`.
//
// The four checks, each the trap a register entry names:
//   · MODEL-LEAF (`REG-F-505`, `REG-F-507`) — every leaf of the tree, the work a model is to do, declares MODEL with an
//     ACTIVE prompt. An agent following its system prompt builds from catalog blueprints that declare UNDECLARED, and a
//     prompt it writes is DRAFT unless it arms it: such a unit runs as a TRANSFORMATION with no model, or is refused at
//     render after its step has started;
//   · SUPPLIED-MARKERS (`REG-F-508`) — a prompt uses only the four markers a work unit fills, `{subject}`, `{title}`,
//     `{description}` and `{purpose}` (`pwa-content.ts`, `PHASE7_MARKERS`); any other refuses the step at render;
//   · PROMPT-LENGTH (design §3.2) — each rendered instruction fits the 4,000 characters the reviewer is shown
//     (`PHASE7_INSTRUCTION_BUDGET`), rendered as the engine renders it (`renderedPrompt`);
//   · POLICY-GOVERNS (`REG-F-524`) — each declared policy governs the type's kind. One that does not is left out of the
//     sign-off's plan, and a unit whose declared policies ALL fail to govern it can never be assured.
// ⭑ And one FACT, no check: whether the prompt names the product (`REG-F-510`: an Undertaking cannot tell its units what
// to build, so a PWA's prompts carry the product or nothing does).
//
// ⭐ POLICY-GOVERNS ASKS THE KERNEL ITSELF: `policyApplicability` (`packages/rph-domain/src/governance.ts`), the rule
// `policyGovernance` asks (`packages/rph-application/src/handlers/policy-governs.ts`), over the unit a type instantiates
// as — its object type and its kind, copied from the type at instantiation. The handler's own two reads, restated: an
// absent or not-ACTIVE policy governs nothing (`NOT_AVAILABLE`), and a rule needing a person is `UNDECIDABLE`, recorded
// and not counted a trap. ⚠ The Undertaking's risk profile is not known before Submit, so an expression the evaluator
// would decide on it is undecidable here; the catalog's policies carry none (`seed-workbench.ts`, `seedAdditivePolicies`).
import { policyApplicability } from '@janumipwb/rph-domain';
import {
	PHASE7_INSTRUCTION_BUDGET,
	PHASE7_MARKERS,
	promptMarkers,
	renderedPrompt
} from './pwa-content.js';
import type { Row } from './half-b.js';

/** The four checks, by name. */
export type CandidateCheck = 'model-leaf' | 'supplied-markers' | 'prompt-length' | 'policy-governs';

/** The register entries each check's trap is filed under. */
export const CHECK_REGISTER_IDS: Readonly<Record<CandidateCheck, readonly string[]>> = {
	'model-leaf': ['REG-F-505', 'REG-F-507'],
	'supplied-markers': ['REG-F-508'],
	'prompt-length': [],
	'policy-governs': ['REG-F-524']
};

/** One thing a check found, on one type. */
export interface CandidateFinding {
	readonly check: CandidateCheck;
	readonly typeId: string;
	readonly typeName: string;
	readonly registerIds: readonly string[];
	readonly detail: string;
}

/** `policyGovernance`'s answers, as these checks reach them. */
export type Governance = 'GOVERNS' | 'DOES_NOT_GOVERN' | 'NOT_AVAILABLE' | 'UNDECIDABLE';

/** What the checks read of one type — kept beside the findings, so a reader sees what passed as well as what did not. */
export interface CandidateTypeFacts {
	readonly typeId: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly workDischarge: string;
	readonly isRoot: boolean;
	/** No permitted child type in the PWA: work the tree gives no one else to do. */
	readonly leaf: boolean;
	/** The prompt's status, or null when the type has none. */
	readonly promptStatus: string | null;
	readonly markers: readonly string[];
	readonly renderedLength: number;
	/** ⭑ A FACT, NO CHECK (`REG-F-510`): the prompt or its output contract names `wordfreq`. */
	readonly namesProduct: boolean;
	readonly policies: readonly { readonly policyId: string; readonly governance: Governance }[];
}

/** ⭐ C4's record: every type's facts, every finding — and `refused: false`, by type as by value (`REG-D-110` (4)). */
export interface CandidateChecks {
	readonly types: readonly CandidateTypeFacts[];
	readonly findings: readonly CandidateFinding[];
	readonly refused: false;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
/** Strings in code-unit order: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);
const rec = (v: unknown): Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * ⭐ DOES `policy` GOVERN A UNIT OF KIND `pwuKind`? `policyGovernance`'s two reads restated, and its rule the kernel's
 * own: absent or not ACTIVE is `NOT_AVAILABLE`; §5.1's NOT_APPLICABLE is `DOES_NOT_GOVERN`; a rule needing a person is
 * `UNDECIDABLE`; anything else `GOVERNS`. The subject is the unit as instantiation makes it: a `PROFESSIONAL_WORK_UNIT`
 * of the type's kind.
 */
export function governanceOf(policy: Row | undefined, pwuKind: string): Governance {
	if (policy === undefined || str(policy.state.status) !== 'ACTIVE') return 'NOT_AVAILABLE';
	const rule = policy.state.applicability ?? { objectTypeConditions: policy.state.applicableObjectTypes };
	const outcome = policyApplicability(rule as never, {
		objectType: 'PROFESSIONAL_WORK_UNIT',
		...(pwuKind === '' ? {} : { pwuKind })
	});
	if (outcome === 'NOT_APPLICABLE') return 'DOES_NOT_GOVERN';
	if (outcome === 'REQUIRES_HUMAN_DETERMINATION') return 'UNDECIDABLE';
	return 'GOVERNS';
}

/** A stored type's prompt, as `renderedPrompt` takes a declared one. */
function declarationOf(t: Row) {
	const prompt = rec(t.state.promptTemplate);
	return {
		name: str(t.state.name),
		purpose: str(t.state.purpose),
		prompt: str(prompt.templateText),
		outputContract: str(prompt.outputContract) || undefined
	};
}

/** What the checks read of one type. */
function factsOf(t: Row, typeIds: ReadonlySet<string>, policies: ReadonlyMap<string, Row>): CandidateTypeFacts {
	const prompt = t.state.promptTemplate === undefined ? null : rec(t.state.promptTemplate);
	const declared = declarationOf(t);
	const rendered = prompt === null ? '' : renderedPrompt({ ...declared, pwuKind: '', workDischarge: 'MODEL', policyIds: [] });
	const pwuKind = str(t.state.pwuKind);
	return {
		typeId: t.id,
		name: declared.name,
		pwuKind,
		workDischarge: str(t.state.workDischarge) || 'UNDECLARED',
		isRoot: t.state.isRoot === true,
		leaf: !strs(t.state.permittedChildTypeIds).some((id) => typeIds.has(id)),
		promptStatus: prompt === null ? null : str(prompt.status) || null,
		markers: [...new Set([...promptMarkers(declared.prompt), ...strs(prompt?.declaredPlaceholders)])].sort(byCodeUnit),
		renderedLength: rendered.length,
		namesProduct: /wordfreq/i.test(`${declared.prompt}\n${declared.outputContract ?? ''}`),
		policies: strs(t.state.requiredAssurancePolicyIds).map((policyId) => ({
			policyId,
			governance: governanceOf(policies.get(policyId), pwuKind)
		}))
	};
}

/** What the four checks find on one type's facts. */
function findingsOf(f: CandidateTypeFacts): CandidateFinding[] {
	const finding = (check: CandidateCheck, detail: string): CandidateFinding => ({
		check,
		typeId: f.typeId,
		typeName: f.name,
		registerIds: CHECK_REGISTER_IDS[check],
		detail
	});
	const found: CandidateFinding[] = [];
	if (f.leaf && (f.workDischarge !== 'MODEL' || f.promptStatus !== 'ACTIVE'))
		found.push(
			finding(
				'model-leaf',
				`a leaf of the tree declares ${f.workDischarge} with ${f.promptStatus === null ? 'no prompt' : `a ${f.promptStatus} prompt`}: ` +
					'a model runs it only when it declares MODEL with an ACTIVE prompt'
			)
		);
	const unsupplied = f.markers.filter((m) => !PHASE7_MARKERS.includes(m));
	if (unsupplied.length > 0)
		found.push(
			finding(
				'supplied-markers',
				`its prompt uses ${unsupplied.map((m) => `{${m}}`).join(', ')}, which no work unit supplies (it supplies ` +
					`${PHASE7_MARKERS.map((m) => `{${m}}`).join(', ')}): its step is refused at render`
			)
		);
	if (f.renderedLength > PHASE7_INSTRUCTION_BUDGET)
		found.push(
			finding(
				'prompt-length',
				`its rendered prompt is ${f.renderedLength} characters, past the ${PHASE7_INSTRUCTION_BUDGET} the reviewer is shown`
			)
		);
	for (const p of f.policies)
		if (p.governance === 'DOES_NOT_GOVERN' || p.governance === 'NOT_AVAILABLE')
			found.push(
				finding(
					'policy-governs',
					`it declares ${p.policyId}, which ${p.governance === 'NOT_AVAILABLE' ? 'is absent or not ACTIVE' : `does not govern its kind, ${f.pwuKind}`}` +
						(f.policies.every((q) => q.governance !== 'GOVERNS')
							? ': and none of its declared policies governs it, so its unit can never be assured'
							: '')
				)
			);
	return found;
}

/**
 * ⭐⭐ C4 — THE CANDIDATE CHECKS over the accepted candidate's types (`types`, the PWA's live ones) and the policy library
 * (`policies`): every type's facts and every finding, in the types' order. ⛔ NEVER A REFUSAL (`REG-D-110` (4)): a caller
 * writes this down and goes on.
 */
export function candidateChecks(types: readonly Row[], policies: readonly Row[]): CandidateChecks {
	const typeIds = new Set(types.map((t) => t.id));
	const byId = new Map(policies.map((p) => [p.id, p]));
	const facts = types.map((t) => factsOf(t, typeIds, byId));
	return { types: facts, findings: facts.flatMap(findingsOf), refused: false };
}
