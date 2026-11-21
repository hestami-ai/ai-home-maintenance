// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; the lead's rulings r1 on `d84/d84-facts.md` §3) — THE MEASUREMENT'S STEPS,
// one per run of its launcher (`d84.drive.ts`, under `vitest.d84.config.ts`), each named by `JPWB_D84_STEP` and run in the measurement folder
// `JPWB_D84_FOLDER` names:
//   begin        the folder begun, empty, for the source (`JPWB_D84_SOURCE`) and the unit (`JPWB_D84_UNIT`) the operator names, and the earlier
//                measurement folders of the case whose calls are spent (`JPWB_D84_EARLIER`, the path list's separator between them);
//   copy         the case copied from the source, checked file by file;
//   case         the copy opened as the server opens its store, and the case checked (the unit's title and kind said first);
//   policy       the copy's Historian policy brought to the seed's form;
//   prepare      one role (`JPWB_D84_ROLE`) prepared and shown;
//   approve      the sponsor's approval of what was shown, recorded by the lead (`JPWB_D84_MANIFEST_SHA256`, `JPWB_D84_WORDS`);
//   call         one role called (`JPWB_D84_PAID=1`), its answer recorded in the copy; the Hypothesizer's full request then written into `after/`;
//   probe-prepare, probe-approve, probe-call   one probe (`JPWB_D84_PROBE`), as a role;
//   report       the report's mechanical part gathered.
// ⛔ A STEP THAT OPENS THE COPY is refused unless this process is launched as the server is over the copy (`RPH_DEMO_MODE=server`, `JPWB_DEMO_DB` the
// copy's store), the copy's events counted by a read-only open first and again after the open.
// ⭑ One function per step, each refused with its reason and never half done: a refused step writes nothing of its own.
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { AssuranceStageDeps } from '../assurance/assurance-stage.js';
import { selectReviewer } from '../assurance/reviewer-selection.js';
import { caseCheck, namedUnitOf, preparePolicy, seedPolicyForm, type CaseReading } from './d84-case.js';
import {
	afterOpenRefusal,
	beginMeasurementFolder,
	copyFromArchive,
	serverStoreRefusal,
	storeReading,
	type MeasurementHost,
	type MeasurementState
} from './d84-folder.js';
import { copyStoreOf, D84_LAYOUT, D84_ROLES, readJson, recordApproval, roleFolderOf, writeOnce, type D84Role } from './d84-files.js';
import { callProbe, PROBE_NAME, prepareProbe, type ProbeExec, type ProbeHost } from './d84-probes.js';
import { writeReport } from './d84-report.js';
import { callRole, prepareRole, writeHypothesizerRequest, type D84Transports, type RoleAt } from './d84-roles.js';

/** What a step needs of the world: the server's deps over the copy, the programs, the clock and the checkout. */
export interface StepHost {
	/** The stage's deps, as the server builds them over its store (`stageDepsOf`); called only once the store is checked. */
	readonly deps: () => AssuranceStageDeps;
	readonly transports: D84Transports;
	readonly probeExec: ProbeExec;
	readonly childrenOf: ProbeHost['childrenOf'];
	readonly folderHost: MeasurementHost;
	readonly now: () => string;
	readonly checkoutHead: () => string;
}

/** A step's outcome: whether it held, and what it says. */
export interface StepOutcome {
	readonly ok: boolean;
	readonly said: readonly string[];
}

/** The environment a step is run with: the operator's shell, as the launcher hands it. */
type Env = Readonly<Record<string, string | undefined>>;

/** What every step is given: the folder, its record (once begun), the environment and the host. */
interface StepContext {
	readonly folder: string;
	readonly state: MeasurementState | undefined;
	readonly env: Env;
	readonly host: StepHost;
}

const refused = (why: string): StepOutcome => ({ ok: false, said: [why] });
const held = (...said: string[]): StepOutcome => ({ ok: true, said });

/** The case as checked, or why no role may be measured yet. */
function caseOf(folder: string): CaseReading | string {
	const read = readJson<{ readonly reading?: CaseReading }>(join(folder, D84_LAYOUT.case));
	return read?.reading ?? `the case is not checked as holding (${D84_LAYOUT.case}): run the case step first`;
}

/** ⭐ D84 — the copy opened as the server opens it, refused where it is not copied, where the process is not the copy's server, or where the open writes. */
function opened(folder: string, env: Env, host: StepHost): AssuranceStageDeps | string {
	if (!existsSync(join(folder, D84_LAYOUT.copyManifest))) return `the case is not copied (${D84_LAYOUT.copyManifest}): run the copy step first`;
	const server = serverStoreRefusal(folder, env);
	if (server !== undefined) return server;
	const store = copyStoreOf(folder);
	const before = storeReading(store);
	const deps = host.deps();
	deps.engine.readAllEvents();
	const moved = afterOpenRefusal(before, storeReading(store));
	return moved ?? deps;
}

/** The role a step names, or why it names none. */
function roleOf(env: Env): { readonly role: D84Role } | { readonly refusedBecause: string } {
	const role = D84_ROLES.find((r) => r === env.JPWB_D84_ROLE);
	return role === undefined ? { refusedBecause: `JPWB_D84_ROLE names ${JSON.stringify(env.JPWB_D84_ROLE ?? '')}, not one of ${D84_ROLES.join(', ')}` } : { role };
}

/** `begin` — the folder begun (see the header). */
function beginStep({ folder, env, host }: StepContext): StepOutcome {
	const begun = beginMeasurementFolder(
		folder,
		{
			begunAt: host.now(),
			checkoutHead: host.checkoutHead(),
			source: env.JPWB_D84_SOURCE ?? '',
			unitId: env.JPWB_D84_UNIT ?? '',
			earlierFolders: (env.JPWB_D84_EARLIER ?? '').split(delimiter).filter((f) => f.trim() !== '')
		},
		host.folderHost
	);
	return 'begun' in begun ? held(`the measurement folder is begun: ${folder}`) : refused(begun.refusedBecause);
}

/** `copy` — the case copied from the source the folder was begun for. */
function copyStep({ folder, state }: StepContext & { readonly state: MeasurementState }): StepOutcome {
	const copied = copyFromArchive(folder, state.source, state.unitId);
	return 'copied' in copied ? held(`the case is copied: ${copied.copied.files.length} file(s), each checked`, ...copied.copied.checks) : refused(copied.refusedBecause);
}

/** `approve`, `probe-approve` — the sponsor's approval of what a role's or a probe's folder shows, recorded. */
function approveStep({ folder, env, host }: StepContext, probe: boolean): StepOutcome {
	let at: string;
	if (probe) {
		if (!PROBE_NAME.test(env.JPWB_D84_PROBE ?? '')) return refused(`a probe is named <NN>-<name>, and JPWB_D84_PROBE is ${JSON.stringify(env.JPWB_D84_PROBE ?? '')}`);
		at = join(folder, D84_LAYOUT.probes, env.JPWB_D84_PROBE ?? '');
	} else {
		const named = roleOf(env);
		if ('refusedBecause' in named) return refused(named.refusedBecause);
		at = roleFolderOf(folder, named.role);
	}
	const approved = recordApproval(at, { manifestSha256: env.JPWB_D84_MANIFEST_SHA256 ?? '', words: env.JPWB_D84_WORDS ?? '', approvedAt: host.now() });
	return 'recorded' in approved ? held(`the approval of manifest ${approved.recorded.manifestSha256} is recorded`) : refused(approved.refusedBecause);
}

/** `report` — the report's mechanical part, written once. */
function reportStep({ folder }: StepContext): StepOutcome {
	if (existsSync(join(folder, D84_LAYOUT.report))) return refused(`the report is gathered already (${D84_LAYOUT.report}): it is written once`);
	const report = writeReport(folder);
	return held(`the report is gathered: ${report.calls.reviewer} reviewer call(s), ${report.calls.executor} executor turn(s), ${report.calls.probes} probe(s)`);
}

/** `probe-prepare`, `probe-call` — one probe, on the selected reviewer's devin. */
async function probeStep({ folder, env, host }: StepContext, call: boolean): Promise<StepOutcome> {
	const selected = selectReviewer({ testMode: false });
	if (selected.kind !== 'DEVIN') return refused(`the probes run on devin, and the selected reviewer is ${selected.kind}`);
	const probeHost: ProbeHost = { devinVersion: host.transports.devinVersion, model: selected.modelId, childrenOf: host.childrenOf };
	const name = env.JPWB_D84_PROBE ?? '';
	if (!call) {
		const shown = await prepareProbe(folder, name, probeHost);
		return 'shown' in shown ? held(`the probe ${name} is shown: manifest ${shown.shown.sha256}`) : refused(shown.refusedBecause);
	}
	const called = await callProbe(folder, name, probeHost, host.probeExec, env);
	return 'called' in called ? held(`the probe ${name} is called`, JSON.stringify(called.called.outcome)) : refused(called.refusedBecause);
}

/** `case` — the unit said, then the case checked, its reading or its findings written once. */
function caseStep({ folder, state }: StepContext & { readonly state: MeasurementState }, deps: AssuranceStageDeps): StepOutcome {
	const unit = namedUnitOf(deps.engine, state.unitId);
	const said = [unit === undefined ? `the copy holds no work unit ${state.unitId}` : `the unit named: ${unit.id}, "${unit.title}", of kind ${unit.kind}`];
	const checked = caseCheck(deps.engine, state.unitId);
	writeOnce(join(folder, D84_LAYOUT.case), checked.ok ? { unit, reading: checked.reading } : { unit, found: checked.found });
	return checked.ok ? held(...said, `the case holds: round ${checked.reading.roundId}`) : { ok: false, said: [...said, ...checked.found] };
}

/** `policy` — the copy's Historian policy brought to the seed's form, its preparation written once. */
function policyStep({ folder }: StepContext, deps: AssuranceStageDeps): StepOutcome {
	const prepared = preparePolicy(deps, seedPolicyForm());
	if ('refusedBecause' in prepared) return refused(prepared.refusedBecause);
	writeOnce(join(folder, D84_LAYOUT.policy), prepared.prepared);
	return held(prepared.prepared.prepared ? `the policy is edited in place under Decision ${prepared.prepared.decisionId}` : 'the policy holds the seed’s form already');
}

/** `prepare` — one role prepared and shown. */
async function prepareStep({ host }: StepContext, deps: AssuranceStageDeps, role: D84Role, at: RoleAt): Promise<StepOutcome> {
	const shown = await prepareRole(role, deps, at, host.transports.devinVersion);
	return 'shown' in shown ? held(`the ${role} is shown: manifest ${shown.shown.sha256}`) : refused(shown.refusedBecause);
}

/** `call` — one role called; the Hypothesizer's full request then written for the sponsor to read. */
async function callStep({ env, host }: StepContext, deps: AssuranceStageDeps, role: D84Role, at: RoleAt): Promise<StepOutcome> {
	const called = await callRole(role, deps, at, host.transports, env);
	if ('refusedBecause' in called) return refused(called.refusedBecause);
	const said = [`the ${role} is called: ${JSON.stringify(called.called.outcome)}`];
	if (role === 'hypothesizer') {
		const written = await writeHypothesizerRequest(deps, at);
		said.push('written' in written ? `its full request is written into ${D84_LAYOUT.after}/: sha256 ${written.written.sha256}` : written.refusedBecause);
	}
	return held(...said);
}

/** The record a step that opens the copy writes once, and the words of its refusal where it is written already. */
const WRITTEN_ONCE: Readonly<Record<string, { readonly file: string; readonly already: string }>> = {
	case: { file: D84_LAYOUT.case, already: `the case is checked already (${D84_LAYOUT.case}): it is checked once` },
	policy: { file: D84_LAYOUT.policy, already: `the policy is prepared already (${D84_LAYOUT.policy}): it is prepared once` }
};

/**
 * The steps that open the copy, each given its deps once the open is checked: the case, the policy, and a role's showing and call. ⛔ A record written
 * already is refused before the copy is opened.
 */
async function openedStep(step: string, ctx: StepContext & { readonly state: MeasurementState }): Promise<StepOutcome> {
	const once = WRITTEN_ONCE[step];
	if (once !== undefined && existsSync(join(ctx.folder, once.file))) return refused(once.already);
	const deps = opened(ctx.folder, ctx.env, ctx.host);
	if (typeof deps === 'string') return refused(deps);
	if (step === 'case') return caseStep(ctx, deps);
	const reading = caseOf(ctx.folder);
	if (typeof reading === 'string') return refused(reading);
	if (step === 'policy') return policyStep(ctx, deps);
	const named = roleOf(ctx.env);
	if ('refusedBecause' in named) return refused(named.refusedBecause);
	const at: RoleAt = { folder: ctx.folder, unitId: ctx.state.unitId, roundId: reading.roundId };
	return step === 'prepare' ? prepareStep(ctx, deps, named.role, at) : callStep(ctx, deps, named.role, at);
}

/** The steps that need the folder begun and do not open the copy. */
const UNOPENED_STEPS: Readonly<Record<string, (ctx: StepContext & { readonly state: MeasurementState }) => StepOutcome | Promise<StepOutcome>>> = {
	copy: copyStep,
	approve: (ctx) => approveStep(ctx, false),
	'probe-approve': (ctx) => approveStep(ctx, true),
	report: reportStep,
	'probe-prepare': (ctx) => probeStep(ctx, false),
	'probe-call': (ctx) => probeStep(ctx, true)
};

/** The steps that open the copy. */
const OPENED_STEPS: ReadonlySet<string> = new Set(['case', 'policy', 'prepare', 'call']);

/**
 * ⭐⭐ D84 — RUN ONE STEP (see the header). ⛔ Each is refused with its reason, never half done: a refused step writes nothing of its own.
 */
export async function runD84Step(env: Env, host: StepHost): Promise<StepOutcome> {
	const folder = env.JPWB_D84_FOLDER ?? '';
	if (folder.trim() === '') return refused('JPWB_D84_FOLDER is not set: the measurement folder is named by the operator');
	const step = env.JPWB_D84_STEP ?? '';
	const state = readJson<MeasurementState>(join(folder, D84_LAYOUT.state));
	if (step === 'begin') return beginStep({ folder, state, env, host });
	const unopened = UNOPENED_STEPS[step];
	if (unopened === undefined && !OPENED_STEPS.has(step)) return refused(`JPWB_D84_STEP names ${JSON.stringify(step)}, not a step of D84's`);
	if (state === undefined) return refused(`the measurement folder is not begun (${D84_LAYOUT.state}): run the begin step first`);
	const ctx = { folder, state, env, host };
	return unopened === undefined ? openedStep(step, ctx) : unopened(ctx);
}
