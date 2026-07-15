// PWA Overview + Work Architecture View (PWA Design context). Shows the PWA's PWU Types — reusable definitions,
// with NO concrete execution/assurance state (RPH-DOC-010 §35.1) — a type inspector, and (while the PWA is a DRAFT)
// the full authoring surface: edit the PWA's details, define / edit / remove PWU Types (with the rich fields —
// completionRule, permitted child types), and advance the publication lifecycle
// DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED -> DEPRECATED -> RETIRED. A PUBLISHED PWA version is immutable
// (§11), so every authoring control disappears (and the engine rejects the command) once it is no longer DRAFT.
import { error, fail } from '@sveltejs/kit';
import {
	getObject,
	listAssurancePolicies,
	listPwuTypes,
	listUndertakings,
	SEED_UNDERTAKING
} from '@janumipwb/rph-engine';
import type { CardinalityCode, PermittedChildRule } from '@janumipwb/rph-authoring';

const CARDINALITY_CODES: ReadonlySet<CardinalityCode> = new Set(['M1', 'M+', 'C1', 'C+']);
/** Clamp a form-supplied cardinality to a valid code (anything else -> M1, mandatory exactly one). */
function asCardinality(v: string): CardinalityCode {
	return CARDINALITY_CODES.has(v as CardinalityCode) ? (v as CardinalityCode) : 'M1';
}

// The 3 de minimis floor policies (guide §8.4) are LOCKED — always-apply, non-waivable, non-editable. The manager
// shows them read-only; the engine handlers reject any edit/suspend/supersede targeting them.
const FLOOR_POLICY_IDS: ReadonlySet<string> = new Set([
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
]);
import {
	dispatch,
	getEngine,
	hostNow,
	loadConversation,
	mintUiId,
	type ConversationEntry
} from '$lib/server/workbench';
import { loadPwaFloor } from '$lib/server/floor';
import type { Actions, PageServerLoad } from './$types';

/** The durable authoring transcript, mapped to the agent-log render shape the page consumes. */
type LogEntry = {
	kind: 'status' | 'text' | 'thinking' | 'tool' | 'toolend' | 'error';
	text: string;
	ok?: boolean;
};
function toLogEntry(e: ConversationEntry): LogEntry {
	switch (e.kind) {
		case 'message':
			return { kind: 'text', text: e.role === 'USER' ? `You: ${e.text}` : e.text };
		case 'thinking':
			return { kind: 'thinking', text: e.text };
		case 'tool_call':
			return { kind: 'tool', text: e.text };
		case 'tool_result':
			return { kind: 'toolend', text: e.text, ok: e.success };
		default:
			return { kind: 'error', text: e.text };
	}
}

export const load: PageServerLoad = ({ params }) => {
	const engine = getEngine();
	const pwa = getObject(engine, params.id);
	if (!pwa) throw error(404, 'PWA not found');
	// Conformance fixtures (§13/§21): Undertakings instantiated from this PWA that serve as reference fixtures.
	const fixtures = listUndertakings(engine)
		.filter((u) => u.state.pwaId === params.id)
		.map((u) => ({
			id: u.id,
			name: String((u.state.name ?? u.id) as string),
			isReferenceFixture: u.id === SEED_UNDERTAKING
		}));
	const types = listPwuTypes(engine, params.id).map((t) => ({
		id: t.id,
		name: String((t.state.name ?? t.id) as string),
		pwuKind: String((t.state.pwuKind ?? '') as string),
		purpose: String((t.state.purpose ?? '') as string),
		isRoot: Boolean(t.state.isRoot),
		completionRule: String((t.state.completionRule ?? '') as string),
		permittedChildTypeIds: Array.isArray(t.state.permittedChildTypeIds)
			? (t.state.permittedChildTypeIds as string[])
			: [],
		permittedChildren: Array.isArray(t.state.permittedChildren)
			? (t.state.permittedChildren as PermittedChildRule[])
			: [],
		requiredInputs: Array.isArray(t.state.requiredInputs)
			? (t.state.requiredInputs as string[])
			: [],
		requiredOutputs: Array.isArray(t.state.requiredOutputs)
			? (t.state.requiredOutputs as string[])
			: [],
		requiredAssurancePolicyIds: Array.isArray(t.state.requiredAssurancePolicyIds)
			? (t.state.requiredAssurancePolicyIds as string[])
			: []
	}));
	// The engine's Assurance Policy library (real ASSURANCE_POLICY objects): the manager lists these, the PWU-type
	// picker offers the ACTIVE non-floor ones, and the rail resolves ids to names. Floor policies are flagged locked.
	const policies = listAssurancePolicies(getEngine()).map((p) => ({
		id: p.id,
		name: String((p.state.name ?? p.id) as string),
		purpose: String((p.state.purpose ?? '') as string),
		rationale: String((p.state.rationale ?? '') as string),
		version: String((p.state.version ?? '') as string),
		status: String((p.state.status ?? 'ACTIVE') as string),
		evaluatedClaimTypes: String((p.state.evaluatedClaimTypes ?? '') as string),
		evaluatorRole: String((p.state.evaluatorRole ?? '') as string),
		independenceRequirement: String((p.state.independenceRequirement ?? '') as string),
		applicableObjectTypes: String((p.state.applicableObjectTypes ?? '') as string),
		permittedControlActions: String((p.state.permittedControlActions ?? '') as string),
		criteria: Array.isArray(p.state.criteria)
			? (p.state.criteria as Array<{ statement?: unknown }>).map((c) => String(c.statement ?? ''))
			: [],
		isFloor: FLOOR_POLICY_IDS.has(p.id)
	}));
	return {
		pwa: {
			id: params.id,
			name: String((pwa.name ?? params.id) as string),
			description: String((pwa.description ?? '') as string),
			domain: String((pwa.domain ?? '') as string),
			version: String((pwa.version ?? '') as string),
			publicationStatus: String((pwa.publicationStatus ?? 'DRAFT') as string)
		},
		types,
		fixtures,
		policies,
		conversation: loadConversation(params.id).map(toLogEntry),
		// The latest recorded assurance floor for this PWA (canonical ASSURANCE_ASSESSMENT/OBSERVATION).
		floor: loadPwaFloor(params.id)
	};
};

interface TypeFields {
	name: string;
	pwuKind: string;
	purpose: string;
	completionRule: string;
	isRoot: boolean;
	permittedChildTypeIds: string[];
	permittedChildren: PermittedChildRule[];
	requiredInputs: string[];
	requiredOutputs: string[];
	requiredAssurancePolicyIds: string[];
}

/** Split a comma/newline-separated artifact list from a form field into a clean string[]. */
function csv(v: FormDataEntryValue | null): string[] {
	return String((v ?? '') as string)
		.split(/[\n,;]/)
		.map((x) => x.trim())
		.filter(Boolean);
}

/** Read the shared PWU-Type authoring fields from a form (used by both defineType and editType). Per-child
 *  cardinality is posted as `cardinality:<childId>` / `applicability:<childId>` alongside the child checkbox. */
function readTypeFields(form: FormData): TypeFields {
	const permittedChildTypeIds = (form.getAll('permittedChildTypeIds') as string[])
		.map(String)
		.filter(Boolean);
	const permittedChildren: PermittedChildRule[] = permittedChildTypeIds.map((typeId) => {
		const cardinality = asCardinality(String((form.get(`cardinality:${typeId}`) ?? '') as string));
		const note = String((form.get(`applicability:${typeId}`) ?? '') as string).trim();
		return { typeId, cardinality, ...(note ? { applicabilityNote: note } : {}) };
	});
	return {
		name: String((form.get('name') ?? '') as string).trim(),
		pwuKind: String((form.get('pwuKind') ?? '') as string)
			.trim()
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_|_$/g, ''),
		purpose: String((form.get('purpose') ?? '') as string).trim(),
		completionRule: String((form.get('completionRule') ?? '') as string).trim(),
		isRoot: form.has('isRoot'),
		permittedChildTypeIds,
		permittedChildren,
		requiredInputs: csv(form.get('requiredInputs')),
		requiredOutputs: csv(form.get('requiredOutputs')),
		requiredAssurancePolicyIds: (form.getAll('requiredAssurancePolicyIds') as string[])
			.map(String)
			.filter(Boolean)
	};
}

/** Read the Assurance Policy authoring fields from a form. `criteria` is a textarea, one criterion statement per
 *  line (each becomes a mandatory AssessmentCriterion with a generated id). */
function readPolicyFields(form: FormData) {
	const criteria = String((form.get('criteria') ?? '') as string)
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter(Boolean)
		.map((statement, i) => ({ id: `C-${String(i + 1).padStart(2, '0')}`, statement, mandatory: true }));
	return {
		name: String((form.get('name') ?? '') as string).trim(),
		purpose: String((form.get('purpose') ?? '') as string).trim(),
		rationale: String((form.get('rationale') ?? '') as string).trim(),
		evaluatedClaimTypes: String((form.get('evaluatedClaimTypes') ?? '') as string).trim(),
		evaluatorRole: String((form.get('evaluatorRole') ?? '') as string).trim(),
		independenceRequirement: String((form.get('independenceRequirement') ?? '') as string).trim(),
		applicableObjectTypes: String((form.get('applicableObjectTypes') ?? '') as string).trim(),
		permittedControlActions: String((form.get('permittedControlActions') ?? '') as string).trim(),
		criteria
	};
}

/** Bump a semantic version string's minor (1.2.3 -> 1.3.0); falls back to a `-v2` suffix for non-semver. */
function bumpVersion(v: string): string {
	const parts = v.split('.').map((n) => Number.parseInt(n, 10));
	if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
		return `${parts[0]}.${parts[1] + 1}.0`;
	}
	return `${v}-v2`;
}

/** Advance the PWA publication FSM and surface any engine rejection to the form. */
function advancePwa(commandType: string, pwaId: string, payload: Record<string, unknown>) {
	const r = dispatch(commandType, 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, payload);
	if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
	return { advanced: commandType };
}

export const actions: Actions = {
	// Edit the DRAFT PWA's own details (name/description/domain).
	editDetails: async ({ request, params }) => {
		const form = await request.formData();
		const name = String((form.get('name') ?? '') as string).trim();
		if (!name) return fail(400, { error: 'A PWA name is required.' });
		const r = dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', params.id, {
			pwaId: params.id,
			name,
			description: String((form.get('description') ?? '') as string).trim(),
			domain: String((form.get('domain') ?? '') as string).trim()
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedPwa: params.id };
	},

	// Define a reusable PWU Type on this (DRAFT) PWA — with the full field set (kind/purpose/root/completion/children).
	defineType: async ({ request, params }) => {
		const f = readTypeFields(await request.formData());
		if (!f.name || !f.pwuKind)
			return fail(400, { error: 'A PWU Type name and kind are required.' });
		const id = mintUiId('pwut');
		const r = dispatch('DefinePwuType', 'PWU_TYPE', id, {
			pwuTypeId: id,
			pwaId: params.id,
			pwuKind: f.pwuKind,
			name: f.name,
			purpose: f.purpose || f.name,
			isRoot: f.isRoot,
			...(f.completionRule ? { completionRule: f.completionRule } : {}),
			permittedChildTypeIds: f.permittedChildTypeIds,
			permittedChildren: f.permittedChildren,
			requiredInputs: f.requiredInputs,
			requiredOutputs: f.requiredOutputs,
			requiredAssurancePolicyIds: f.requiredAssurancePolicyIds
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { definedType: id };
	},

	// Edit an existing PWU Type in place (DRAFT PWA only — the engine enforces this).
	editType: async ({ request }) => {
		const form = await request.formData();
		const pwuTypeId = String((form.get('pwuTypeId') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const f = readTypeFields(form);
		if (!f.name || !f.pwuKind)
			return fail(400, { error: 'A PWU Type name and kind are required.' });
		const r = dispatch('EditPwuType', 'PWU_TYPE', pwuTypeId, {
			pwuTypeId,
			name: f.name,
			pwuKind: f.pwuKind,
			purpose: f.purpose || f.name,
			isRoot: f.isRoot,
			...(f.completionRule ? { completionRule: f.completionRule } : {}),
			permittedChildTypeIds: f.permittedChildTypeIds,
			permittedChildren: f.permittedChildren,
			requiredInputs: f.requiredInputs,
			requiredOutputs: f.requiredOutputs,
			requiredAssurancePolicyIds: f.requiredAssurancePolicyIds
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedType: pwuTypeId };
	},

	// Remove a PWU Type (DRAFT only). Referential integrity + the DRAFT guard are enforced by the engine
	// (RemovePwuType) — this just surfaces any rejection.
	removeType: async ({ request }) => {
		const pwuTypeId = String(((await request.formData()).get('pwuTypeId') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const r = dispatch('RemovePwuType', 'PWU_TYPE', pwuTypeId, { pwuTypeId });
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { removedType: pwuTypeId };
	},

	submitForReview: ({ params }) => advancePwa('SubmitPwaForReview', params.id, {}),
	validate: ({ params }) => advancePwa('ValidatePwa', params.id, {}),
	// Publish requires a declared root PWU Type (which must have been defined while DRAFT); resolve it server-side.
	publish: ({ params }) => {
		const root = listPwuTypes(getEngine(), params.id).find((t) => t.state.isRoot === true);
		if (!root) return fail(400, { error: 'Define a root PWU Type before publishing.' });
		return advancePwa('PublishPwa', params.id, { rootPwuTypeId: root.id });
	},
	// Continue the publication FSM past PUBLISHED: PUBLISHED -> DEPRECATED -> RETIRED.
	deprecate: ({ params }) => advancePwa('DeprecatePwa', params.id, {}),
	retire: ({ params }) => advancePwa('RetirePwa', params.id, {}),

	// Human-in-the-loop resolution: record + grant an auditable governance WAIVER over the de minimis assurance
	// floor so a non-SATISFIED PWA can PUBLISH — the alternative to revising the graph and re-running the floor.
	recordWaiver: async ({ request, params }) => {
		const rationale = String(((await request.formData()).get('rationale') ?? '') as string).trim();
		if (!rationale) return fail(400, { error: 'A waiver rationale is required.' });
		const waiverId = mintUiId('dec');
		const req = dispatch('RequestWaiver', 'DECISION', waiverId, {
			subjectObjectIds: [params.id],
			scope: 'de minimis assurance floor',
			rationale,
			duration: 'until superseded',
			affectedObjectIds: [params.id]
		});
		if (req.status !== 'ACCEPTED') return fail(400, { error: req.error?.message ?? req.status });
		const grant = dispatch('GrantWaiver', 'DECISION', waiverId, {
			waiverDecisionId: waiverId,
			effectiveAt: hostNow(),
			duration: 'until superseded'
		});
		if (grant.status !== 'ACCEPTED')
			return fail(400, { error: grant.error?.message ?? grant.status });
		return { waived: waiverId };
	},

	// ── Assurance Policy library management (workbench-wide; not gated by this PWA's draft status) ──────────────
	// Create a new authorable Assurance Policy (ACTIVE). The 3 de minimis floor policies are locked and seeded, not
	// created here.
	createPolicy: async ({ request }) => {
		const f = readPolicyFields(await request.formData());
		if (!f.name) return fail(400, { error: 'A policy name is required.' });
		const id = mintUiId('pol');
		const r = dispatch('CreateAssurancePolicy', 'ASSURANCE_POLICY', id, {
			policyId: id,
			version: '1.0.0',
			name: f.name,
			purpose: f.purpose || f.name,
			rationale: f.rationale || 'Authored in the PWA Designer.',
			applicableObjectTypes: f.applicableObjectTypes || 'PROFESSIONAL_WORK_UNIT',
			evaluatedClaimTypes: f.evaluatedClaimTypes || 'CORRECTNESS',
			criteria: f.criteria,
			evaluatorRole: f.evaluatorRole || 'reviewer',
			independenceRequirement: f.independenceRequirement || 'DIFFERENT_AGENT',
			findingDefinitions: [],
			permittedControlActions: f.permittedControlActions || 'ESCALATE'
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { createdPolicy: id };
	},

	// Edit a non-floor, non-superseded policy's content in place (same version).
	editPolicy: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const f = readPolicyFields(form);
		const r = dispatch('EditAssurancePolicy', 'ASSURANCE_POLICY', policyId, {
			policyId,
			...(f.name ? { name: f.name } : {}),
			...(f.purpose ? { purpose: f.purpose } : {}),
			...(f.rationale ? { rationale: f.rationale } : {}),
			...(f.evaluatedClaimTypes ? { evaluatedClaimTypes: f.evaluatedClaimTypes } : {}),
			...(f.evaluatorRole ? { evaluatorRole: f.evaluatorRole } : {}),
			...(f.independenceRequirement ? { independenceRequirement: f.independenceRequirement } : {}),
			...(f.applicableObjectTypes ? { applicableObjectTypes: f.applicableObjectTypes } : {}),
			...(f.permittedControlActions ? { permittedControlActions: f.permittedControlActions } : {}),
			...(f.criteria.length ? { criteria: f.criteria } : {})
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { editedPolicy: policyId };
	},

	// Version a policy: create a successor copy with a bumped version (ACTIVE), then supersede the predecessor
	// pointing to it. Downstream references keep working; the successor is then independently editable.
	newPolicyVersion: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const prev = getObject(getEngine(), policyId);
		if (!prev) return fail(400, { error: 'Policy not found.' });
		const requested = String((form.get('version') ?? '') as string).trim();
		const newVersion = requested || bumpVersion(String((prev.version ?? '1.0.0') as string));
		const successorId = mintUiId('pol');
		const create = dispatch('CreateAssurancePolicy', 'ASSURANCE_POLICY', successorId, {
			policyId: successorId,
			version: newVersion,
			name: String((prev.name ?? 'Policy') as string),
			purpose: String((prev.purpose ?? '') as string),
			rationale: String((prev.rationale ?? '') as string),
			applicableObjectTypes: String((prev.applicableObjectTypes ?? 'PROFESSIONAL_WORK_UNIT') as string),
			evaluatedClaimTypes: String((prev.evaluatedClaimTypes ?? 'CORRECTNESS') as string),
			criteria: Array.isArray(prev.criteria) ? prev.criteria : [],
			evaluatorRole: String((prev.evaluatorRole ?? 'reviewer') as string),
			independenceRequirement: String((prev.independenceRequirement ?? 'DIFFERENT_AGENT') as string),
			findingDefinitions: Array.isArray(prev.findingDefinitions) ? prev.findingDefinitions : [],
			permittedControlActions: String((prev.permittedControlActions ?? 'ESCALATE') as string)
		});
		if (create.status !== 'ACCEPTED')
			return fail(400, { error: create.error?.message ?? create.status });
		const sup = dispatch('SupersedeAssurancePolicy', 'ASSURANCE_POLICY', policyId, {
			policyId,
			supersededByPolicyId: successorId
		});
		if (sup.status !== 'ACCEPTED') return fail(400, { error: sup.error?.message ?? sup.status });
		return { newVersion: successorId };
	},

	suspendPolicy: async ({ request }) => {
		const policyId = String(((await request.formData()).get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const r = dispatch('SuspendAssurancePolicy', 'ASSURANCE_POLICY', policyId, { policyId });
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { suspendedPolicy: policyId };
	},

	activatePolicy: async ({ request }) => {
		const policyId = String(((await request.formData()).get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const r = dispatch('ActivateAssurancePolicy', 'ASSURANCE_POLICY', policyId, { policyId });
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { activatedPolicy: policyId };
	}
};
