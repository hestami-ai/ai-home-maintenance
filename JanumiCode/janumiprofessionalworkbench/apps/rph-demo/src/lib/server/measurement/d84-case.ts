// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; `REG-F-680`; the lead's rulings r1 on `d84/d84-facts.md` §3) — THE CASE,
// READ FROM THE COPY BEFORE ANYTHING, AND ITS STORED POLICY BROUGHT TO THE SEED'S FORM.
//
// ⭑ THE CASE CHECK (§3.5; the lead's Q9: the unit named by the operator, by id, its title and kind said first): the unit stands where D84 asks —
// UNDER_ASSURANCE, SUCCEEDED and REJECTED by its governing declared reviews, its round's stage not run (the stage's own offer, `assuranceStageOffer`);
// the stage never run for its Undertaking; ONE re-run in place recorded before this rejection — a REPLAN Decision selecting `RERUN_REJECTED_WORK`,
// EFFECTIVE, naming the unit and the earlier rejecting verdicts, and the move back citing it — in that order in the event log; and its governing
// declared policies' rejecting verdicts over it those two sign-offs' alone. Refused otherwise, naming everything found.
// ⭑ THE POLICY (`REG-F-680`; Q2): the copy's `pol_historical_consistency` compared field by field with the seed's — a store seeded as the server seeds a
// fresh one (`openWorkbench`); where they differ in `applicability` alone, edited in place in ONE batch — the person's APPROVAL Decision over the
// policy, its rationale citing `REG-D-166` (3), `REG-D-189`, `REG-F-680` and D84, then `EditAssurancePolicy` with the seed's `applicability`. ⛔ REFUSED,
// each named: a policy the copy does not hold, or not ACTIVE; any other field that differs; and any assessment held under the policy, since an edit
// in place moves no version (`REG-F-209`) and a held assessment's meaning would move under it.
import { listByType, type EngineHandle } from '@janumipwb/rph-engine';
import { assuranceStageOffer, HISTORIAN_POLICY_ID } from '../assurance/assurance-stage.js';
import { stageRecordsIn, type StageStep } from '../assurance/assurance-stage-records.js';
import { governingDeclaredPolicies } from '../assurance/declared-policy-signoff.js';
import { RERUN_REJECTED_WORK } from '../execution/rejected-rerun.js';
import { actingActor } from '../identity.js';
import { openWorkbench, uiSession } from '../workbench.js';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** ⭐ D84 (Q9) — the unit the operator names, as the driver says it before the case check: its id, its title and its type's kind. */
export interface NamedUnit {
	readonly id: string;
	readonly title: string;
	readonly kind: string;
	readonly undertakingId: string;
}

/** ⭐ D84 — the unit `unitId` names, or `undefined` where the store holds no work unit of that id. */
export function namedUnitOf(engine: EngineHandle, unitId: string): NamedUnit | undefined {
	const state = engine.loadObject(unitId)?.state as Record<string, unknown> | undefined;
	if (state?.objectType !== 'PROFESSIONAL_WORK_UNIT') return undefined;
	const type = (engine.loadObject(str(state.pwuTypeId))?.state ?? {}) as Record<string, unknown>;
	return { id: unitId, title: str(state.title), kind: str(type.pwuKind), undertakingId: str(state.undertakingId) };
}

/** ⭐ D84 — the case as the copy holds it, where it stands where D84 asks. */
export interface CaseReading {
	readonly unit: NamedUnit;
	/** The round D84 measures: its opening verdict, the second sign-off's first rejecting verdict. */
	readonly roundId: string;
	/** The second sign-off's rejecting verdicts, in the selection's order. */
	readonly secondRejection: readonly string[];
	/** The first sign-off's rejecting verdicts, as the re-run's Decision names them. */
	readonly firstRejection: readonly string[];
	/** The re-run in place: its Decision, and where in the event log the move back is. */
	readonly rerun: { readonly decisionId: string; readonly moveBackEvent: number };
}

/**
 * ⭐⭐ D84 — WHETHER THE COPY STANDS WHERE D84 ASKS (see the header): the reading, or every finding that says it does not. ⛔ Never a guess: each limb
 * read from the record, and each that fails named.
 */
export function caseCheck(engine: EngineHandle, unitId: string): { readonly ok: true; readonly reading: CaseReading } | { readonly ok: false; readonly found: readonly string[] } {
	const unit = namedUnitOf(engine, unitId);
	if (unit === undefined) return { ok: false, found: [`the copy holds no work unit ${JSON.stringify(unitId)}`] };
	const found: string[] = [];
	const offer = assuranceStageOffer(engine, unitId);
	if ('refusedBecause' in offer) found.push(offer.refusedBecause);
	const units = new Set(listByType(engine, 'PROFESSIONAL_WORK_UNIT').filter((u) => u.state.undertakingId === unit.undertakingId).map((u) => u.id));
	const staged = stageRecordsIn(engine).filter((r) => r.undertakingId === unit.undertakingId || units.has(r.unitId));
	if (staged.length > 0)
		found.push(`the assurance stage has run for the Undertaking: ${staged.length} stage record(s), the first ${staged[0]!.artifactId} (${staged[0]!.part}); D84 measures the stage's first round`);
	const events = engine.readAllEvents();
	const firstEvent = (id: string): number => events.findIndex((e) => e.aggregateId === id);
	const completed = (id: string): number => events.findLastIndex((e) => e.aggregateId === id && e.eventType === 'AssuranceAssessmentCompleted');
	const reruns = listByType(engine, 'DECISION').filter(
		(d) => d.state.decisionType === 'REPLAN' && d.state.selectedOption === RERUN_REJECTED_WORK && strings(d.state.subjectObjectIds).includes(unitId)
	);
	if (reruns.length !== 1)
		found.push(`${reruns.length} re-run(s) in place recorded for the unit (REPLAN Decisions selecting ${RERUN_REJECTED_WORK} naming it): D84's case is the second rejection after one`);
	const rerun = reruns[0];
	const second = 'refusedBecause' in offer ? [] : offer.rejected.map((v) => v.assessmentId);
	const { policies } = governingDeclaredPolicies(engine, unitId);
	const governing = new Set(policies.map((p) => p.policyId));
	const rejectedOverUnit = listByType(engine, 'ASSURANCE_ASSESSMENT').filter(
		(a) => governing.has(str(a.state.assurancePolicyId)) && a.state.assessmentState === 'REJECTED' && strings(a.state.subjectObjectIds).includes(unitId)
	);
	let first: string[] = [];
	let moveBack = -1;
	if (rerun !== undefined) {
		if (rerun.state.status !== 'EFFECTIVE') found.push(`the re-run's Decision ${rerun.id} is ${str(rerun.state.status) || 'of no status'}, not EFFECTIVE`);
		const named = new Set(strings(rerun.state.subjectObjectIds));
		first = rejectedOverUnit.filter((a) => named.has(a.id)).map((a) => a.id);
		if (first.length === 0) found.push(`the re-run's Decision ${rerun.id} names no rejecting verdict of the unit's governing declared reviews: no first rejection is recorded before it`);
		moveBack = events.findIndex(
			(e) =>
				e.eventType === 'PwuStateChanged' &&
				e.aggregateId === unitId &&
				(e.payload as { previousState?: unknown }).previousState === 'UNDER_ASSURANCE' &&
				(e.payload as { newState?: unknown }).newState === 'PLANNED' &&
				strings((e.payload as { supportingObjectIds?: unknown }).supportingObjectIds).includes(rerun.id)
		);
		if (moveBack < 0) found.push(`no move back of the unit cites the re-run's Decision ${rerun.id} (UNDER_ASSURANCE to PLANNED)`);
		const decided = firstEvent(rerun.id);
		const late = first.filter((id) => completed(id) > decided);
		if (late.length > 0) found.push(`the first rejection's verdict(s) ${late.join(', ')} were completed after the re-run's Decision ${rerun.id}`);
		if (moveBack >= 0 && moveBack < decided) found.push(`the move back (event ${moveBack}) is recorded before the re-run's Decision ${rerun.id} (event ${decided})`);
		const early = second.filter((id) => completed(id) < Math.max(moveBack, decided));
		if (early.length > 0) found.push(`this rejection's verdict(s) ${early.join(', ')} were completed before the re-run in place`);
		const both = second.filter((id) => first.includes(id));
		if (both.length > 0) found.push(`the verdict(s) ${both.join(', ')} are the first rejection's and this one's: no second sign-off is recorded`);
	}
	const others = rejectedOverUnit.filter((a) => !first.includes(a.id) && !second.includes(a.id)).map((a) => a.id);
	if (others.length > 0) found.push(`the unit holds rejecting declared verdict(s) of neither sign-off: ${others.join(', ')} — D84's case is its second rejection`);
	if (found.length > 0 || 'refusedBecause' in offer || rerun === undefined) return { ok: false, found };
	return {
		ok: true,
		reading: { unit, roundId: offer.roundId, secondRejection: second, firstRejection: first, rerun: { decisionId: rerun.id, moveBackEvent: moveBack } }
	};
}

/** The content fields of a stored assurance policy, as `CreateAssurancePolicy` sets them: what is compared with the seed's (the envelope left out). */
export const COMPARED_POLICY_FIELDS = [
	'version',
	'name',
	'purpose',
	'rationale',
	'applicableObjectTypes',
	'applicability',
	'evaluatedClaimTypes',
	'defaultClaimTemplates',
	'requiredEvidence',
	'optionalEvidence',
	'criteria',
	'evaluatorRole',
	'independenceRequirement',
	'findingDefinitions',
	'dispositionRules',
	'remediationRules',
	'escalationRules',
	'waiverRules',
	'permittedControlActions',
	'status'
] as const;

/** A value as JSON with every object's keys in code-unit order: two values are the same content where these are equal. */
function canonical(v: unknown): string {
	if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
	if (typeof v === 'object' && v !== null)
		return `{${Object.keys(v)
			.sort((a, b) => Number(a > b) - Number(a < b))
			.map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
			.join(',')}}`;
	return JSON.stringify(v) ?? 'undefined';
}

/** ⭐ D84 — the compared fields of a policy's state, each as stored. */
const comparedOf = (state: Record<string, unknown>): Record<string, unknown> =>
	Object.fromEntries(COMPARED_POLICY_FIELDS.map((f) => [f, state[f]] as const));

/**
 * ⭐ D84 (`REG-F-680`) — THE SEED'S FORM OF THE HISTORIAN'S POLICY: the state a fresh store holds of it, seeded as the server seeds one (`openWorkbench`,
 * in memory), its compared fields; `undefined` where the seed holds none.
 */
export function seedPolicyForm(open: () => EngineHandle = () => openWorkbench()): Record<string, unknown> | undefined {
	const state = open().loadObject(HISTORIAN_POLICY_ID)?.state as Record<string, unknown> | undefined;
	return state === undefined ? undefined : comparedOf(state);
}

/** ⭐ D84 — the selected option of the policy preparation's Decision. */
export const POLICY_PREPARATION_OPTION = `Bring the stored ${HISTORIAN_POLICY_ID}'s applicability to the seed's form`;

/** ⭐ D84 (Q2) — the rationale of the policy preparation's Decision: what it does, and the rulings it rests on. */
export const POLICY_PREPARATION_RATIONALE =
	`D84's measurement brings the copied store's ${HISTORIAN_POLICY_ID} to the seed's form, editing its applicability in place, as D80's boot will bring ` +
	"a continued run's: the seeded Historian's kind scope widened (REG-D-166 (3)); D84 measured before the tenth run (REG-D-189); D80's three commands " +
	'leave the stage reading no new version, so the stored one is edited in place (REG-F-680); design D84.';

/** ⭐ D84 — the policy preparation's record (`policy.json`). */
export interface PolicyPreparation {
	readonly before: Record<string, unknown>;
	readonly seed: Record<string, unknown>;
	readonly differs: readonly string[];
	readonly prepared: boolean;
	readonly decisionId?: string;
	readonly after?: Record<string, unknown>;
}

/** What the preparation needs of the stage's deps: the engine, its batch and its ids. */
export interface PolicyDeps {
	readonly engine: EngineHandle;
	readonly runSteps: (steps: readonly StageStep[]) => string | null;
	readonly newId: (prefix: string) => string;
}

/**
 * ⭐⭐ D84 (`REG-F-680`; the lead's rulings r1, Q2) — BRING THE COPY'S HISTORIAN POLICY TO THE SEED'S FORM (see the header), or say why not. `seed` is
 * the seed's form (`seedPolicyForm`), handed in so a test can name it.
 */
export function preparePolicy(deps: PolicyDeps, seed: Record<string, unknown> | undefined): { readonly prepared: PolicyPreparation } | { readonly refusedBecause: string } {
	const { engine } = deps;
	const stored = engine.loadObject(HISTORIAN_POLICY_ID);
	const state = stored?.state as Record<string, unknown> | undefined;
	if (state === undefined) return { refusedBecause: `the copy holds no ${HISTORIAN_POLICY_ID}: there is no stored policy to prepare` };
	if (seed === undefined) return { refusedBecause: `the seed holds no ${HISTORIAN_POLICY_ID}: there is no form to bring it to` };
	const before = comparedOf(state);
	const differs = COMPARED_POLICY_FIELDS.filter((f) => canonical(before[f]) !== canonical(seed[f]));
	if (differs.length === 0) return { prepared: { before, seed, differs, prepared: false } };
	const beyond = differs.filter((f) => f !== 'applicability');
	if (beyond.length > 0)
		return {
			refusedBecause: `the copy's ${HISTORIAN_POLICY_ID} differs from the seed's in ${beyond.join(', ')} beside its applicability: the lead's ruling edits its applicability alone (REG-F-680)`
		};
	if (state.status !== 'ACTIVE') return { refusedBecause: `the copy's ${HISTORIAN_POLICY_ID} is ${str(state.status) || 'of no status'}, not ACTIVE: an edit in place is made to the policy in force` };
	const held = listByType(engine, 'ASSURANCE_ASSESSMENT').filter((a) => a.state.assurancePolicyId === HISTORIAN_POLICY_ID);
	if (held.length > 0)
		return {
			refusedBecause:
				`the copy holds ${held.length} assessment(s) under ${HISTORIAN_POLICY_ID} (${held.map((a) => a.id).join(', ')}): an edit in place moves no version ` +
				"(REG-F-209), and a held assessment's meaning would move under it, so the policy is not edited (REG-F-680)"
		};
	const decisionId = deps.newId('dec');
	const refused = deps.runSteps([
		[
			'ProposeDecision',
			'DECISION',
			decisionId,
			{
				decisionType: 'APPROVAL',
				subjectObjectIds: [HISTORIAN_POLICY_ID],
				selectedOption: POLICY_PREPARATION_OPTION,
				rationale: POLICY_PREPARATION_RATIONALE,
				authority: actingActor(uiSession()),
				consideredObservationIds: []
			}
		],
		[
			'ApproveDecision',
			'DECISION',
			decisionId,
			{
				selectedOption: POLICY_PREPARATION_OPTION,
				rationale: POLICY_PREPARATION_RATIONALE,
				consideredEvidenceIds: [],
				consideredObservationIds: [],
				subjectSemanticVersions: { [HISTORIAN_POLICY_ID]: Number(stored?.semanticVersion ?? 1) }
			}
		],
		['EditAssurancePolicy', 'ASSURANCE_POLICY', HISTORIAN_POLICY_ID, { policyId: HISTORIAN_POLICY_ID, applicability: seed.applicability as Record<string, unknown> }]
	]);
	if (refused !== null) return { refusedBecause: `the policy's preparation was refused, and nothing of it is recorded: ${refused}` };
	const after = comparedOf((engine.loadObject(HISTORIAN_POLICY_ID)?.state ?? {}) as Record<string, unknown>);
	const still = COMPARED_POLICY_FIELDS.filter((f) => canonical(after[f]) !== canonical(seed[f]));
	if (still.length > 0) return { refusedBecause: `the policy's edit was recorded, and its ${still.join(', ')} still differ from the seed's` };
	return { prepared: { before, seed, differs, prepared: true, decisionId, after } };
}
