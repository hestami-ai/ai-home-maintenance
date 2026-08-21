// PWA Overview + Work Architecture View (PWA Design context). Shows the PWA's PWU Types — reusable definitions,
// with NO concrete execution/assurance state (RPH-DOC-010 §35.1) — a type inspector, and (while the PWA is a DRAFT)
// the full authoring surface: edit the PWA's details, define / edit / remove PWU Types (with the rich fields —
// completionRule, permitted child types), and advance the publication lifecycle
// DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED -> DEPRECATED -> RETIRED. A PUBLISHED PWA version is immutable
// (§11), so every authoring control disappears (and the engine rejects the command) once it is no longer DRAFT.
import { error, fail } from '@sveltejs/kit';
import {
	getObject,
	getObjectOfType,
	listAssurancePolicies,
	listPwuTypes,
	listUndertakings,
	SEED_UNDERTAKING
} from '@janumipwb/rph-engine';
import type {
	BoundaryContract,
	CardinalityCode,
	ExecutionBoundary,
	PermittedChildRule
} from '@janumipwb/rph-authoring';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { readPolicyFields } from './policy-fields';

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
	dispatchBatch,
	getEngine,
	loadConversation,
	mintUiId,
	type ConversationEntry,
	type UiCommandInput
} from '$lib/server/workbench';
import { loadPwaFloor } from '$lib/server/floor';
import { SESSION_CREDENTIAL } from '$lib/server/identity';
import { readRenderedRevision, refuse, STALE_FORM } from '$lib/server/optimistic-concurrency';
import {
	commitAuthoringTurn,
	discardAuthoringTurn,
	getPendingAuthoringTurn,
	summarizeAuthoringTurn
} from '$lib/server/authoring-turn';
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
	const canonicalEngine = getEngine();
	const candidate = getPendingAuthoringTurn(params.id);
	const engine = candidate?.engine ?? canonicalEngine;
	// TYPED, not merely existent (REG-F-201). A type-blind read here was WORSE than at the
	// Undertaking Workbench: publicationStatus exists only on PWAs, so line ~192's ?? 'DRAFT'
	// FABRICATED a draft status for any other object and unlocked the full authoring surface — more
	// editing surface on a non-PWA than on the real PWA, which is PUBLISHED and correctly shows none.
	const pwa = getObjectOfType(engine, 'PROFESSIONAL_WORK_ARCHITECTURE', params.id);
	if (!pwa) throw error(404, 'PWA not found');
	// ── THE REVISION FOR PER-4 COMES FROM CANONICAL, AND THE DISPLAY STATE MAY NOT ──────────────────────────
	// This loader is the only one in the app that can read from a FORK: with an agent candidate staged, `engine`
	// above is `candidate.engine`, a snapshot overlay whose revisions for the same aggregate ids are NOT
	// canonical's. Every action on this page dispatches through `dispatch()` -> `getEngine()`, i.e. CANONICAL.
	//
	// So a fork-sourced revision would be an expectation about a store the command never touches — which either
	// conflicts spuriously or, far worse, happens to match and protects nothing. The expectation must describe
	// THE STORE THE COMMAND WILL HIT, so it is read from `canonicalEngine` explicitly.
	//
	// This is NOT the re-fetched tautology REG-F-050 records: the read happens HERE, at render, and a canonical
	// write between this load and the submit still conflicts. What makes a revision meaningless is being read
	// at DISPATCH time, not being read from the store the dispatch targets.
	//
	// `undefined` is a safe outcome rather than a hole: the template then renders an empty value, the strict
	// parser returns null, and the action fails closed.
	const pwaRevision = canonicalEngine.loadObject(params.id)?.revision;
	// Conformance fixtures (§13/§21): Undertakings instantiated from this PWA that serve as reference fixtures.
	const fixtures = listUndertakings(canonicalEngine)
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
			: [],
		// STD-2/STD-3 (DWP-05): the resolved execution boundary (absent ⇒ INTERNAL) + the delegated contract, so the
		// form pre-fills, the inspector shows the boundary/leaf-kind, and the card rail (DWP-06) can condition itself.
		executionBoundary: (t.state.executionBoundary === 'DELEGATED_EXTERNAL'
			? 'DELEGATED_EXTERNAL'
			: 'INTERNAL') as ExecutionBoundary,
		boundaryContract: t.state.boundaryContract as BoundaryContract | undefined
	}));
	// The engine's Assurance Policy library (real ASSURANCE_POLICY objects): the manager lists these, the PWU-type
	// picker offers the ACTIVE non-floor ones, and the rail resolves ids to names. Floor policies are flagged locked.
	const policies = listAssurancePolicies(engine).map((p) => ({
		id: p.id,
		// The revision this row was rendered from (JPWB-DOC-003 §9 PER-4). `listAssurancePolicies` goes straight
		// to `listByType` with NO `withinScope` (queries.ts:198-199), so the row reaches here with its revision
		// intact and this `.map()` was the only place it was dropped — the fourth loader with that shape.
		//
		// ⚠ THESE MAY BE FORK REVISIONS, and unlike the PWA above they are NOT re-read from canonical. See the
		// note on `pwaRevision`: with a candidate staged, `engine` is the authoring fork. The agent broker has
		// no command that mutates an EXISTING policy (its only policy command is `CreateAssurancePolicy`,
		// broker.ts:336), so a policy already in the base snapshot cannot drift inside the fork — its revision
		// is canonical's. A policy CREATED in the fork is the case this does not cover, and it is handled by
		// failing closed rather than by a revision: it does not exist in canonical at all, so the dispatch is
		// refused for non-existence before any revision is compared. Recorded because the refusal code is then
		// RPH_VALIDATION_SEMANTIC_FAILED, which is neither STALE_FORM nor a conflict — see the roadmap §5b.
		revision: p.revision,
		name: String((p.state.name ?? p.id) as string),
		purpose: String((p.state.purpose ?? '') as string),
		rationale: String((p.state.rationale ?? '') as string),
		version: String((p.state.version ?? '') as string),
		status: String((p.state.status ?? 'DRAFT') as string),
		// The three ratified ARRAYS, rendered for a comma-separated text input and split back by `csvList` on save.
		// Joined EXPLICITLY: `String(['A','B'])` also yields 'A, B'-ish, but only by accident of Array.toString —
		// it silently produces 'A,B' with no space and would quietly do something else for any non-array value.
		evaluatedClaimTypes: joinList(p.state.evaluatedClaimTypes),
		evaluatorRole: String((p.state.evaluatorRole ?? '') as string),
		independenceRequirement: String((p.state.independenceRequirement ?? '') as string),
		applicableObjectTypes: joinList(p.state.applicableObjectTypes),
		permittedControlActions: joinList(p.state.permittedControlActions),
		// `description` per DOC-004 §7 — this read `c.statement`, the invented field's name.
		//
		// This projection is LOSSY BY CONSTRUCTION and that is now handled, not claimed away: the textarea shows
		// one line per criterion, so §7's other seven fields (name, severity, criterionType, …) never reach the
		// form. `editPolicy` therefore hands the STORED criteria back to `readPolicyFields`, which reuses any
		// whose description is unchanged — otherwise a save silently destroyed the seeded `name` and reset every
		// `severityIfNotMet` to BLOCKING. (An earlier version of this comment called the round-trip "lossless";
		// adversarial review proved it was not — see policy-fields.ts / policy-round-trip.test.ts.)
		criteria: Array.isArray(p.state.criteria)
			? (p.state.criteria as Array<{ description?: unknown }>).map((c) =>
					String((c.description ?? '') as string)
				)
			: [],
		isFloor: FLOOR_POLICY_IDS.has(p.id)
	}));
	return {
		pwa: {
			id: params.id,
			// The canonical revision this page was rendered from (JPWB-DOC-003 §9 PER-4). See the note at the
			// `pwaRevision` read: it is deliberately NOT taken from `engine`, which may be an authoring fork.
			revision: pwaRevision,
			name: String((pwa.name ?? params.id) as string),
			description: String((pwa.description ?? '') as string),
			domain: String((pwa.domain ?? '') as string),
			version: String((pwa.version ?? '') as string),
			publicationStatus: String((pwa.publicationStatus ?? 'DRAFT') as string)
		},
		types,
		fixtures,
		policies,
		// §9.7: private chain-of-thought never enters a default or shared projection. New turns no longer record it
		// (the agent route drops it at the write boundary), and this filter keeps any pre-rule row out of the view.
		conversation: loadConversation(params.id, engine)
			.filter((e) => e.kind !== 'thinking')
			.map(toLogEntry),
		// The latest recorded assurance floor for this PWA (canonical ASSURANCE_ASSESSMENT/OBSERVATION).
		// The floor RECORDS as well as reads, so it needs a session. It gets the professional's, because the
		// floor is being run on their behalf — and `engine` here may be an authoring FORK, which is why the
		// credential is applied to that handle rather than reaching for the canonical one.
		floor: loadPwaFloor(params.id, engine.as(SESSION_CREDENTIAL)),
		// A pending fork is a PREVIEW. The graph/transcript/floor above read it, while this flag makes the authority
		// boundary explicit to the browser and supplies the exact hash required by the accept action.
		authoringTurn: candidate ? summarizeAuthoringTurn(candidate) : undefined
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
	executionBoundary: ExecutionBoundary;
	/** Present iff executionBoundary is DELEGATED_EXTERNAL (STD-3). */
	boundaryContract?: BoundaryContract;
}

/** Copy a stored ratified-array field through verbatim, falling back to a single-value array. Never String():
 *  that stringifies an array into 'A,B' and the strictly-typed payload then rejects it. */
function strList(v: unknown, fallback: string): string[] {
	return Array.isArray(v) && v.length ? (v as string[]).map(String) : [fallback];
}

/** Render a stored ratified-array field into the comma-separated text input the policy form uses. */
function joinList(v: unknown): string {
	return Array.isArray(v) ? (v as unknown[]).map(String).join(', ') : String((v ?? '') as string);
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
	// STD-2: resolve the execution boundary (absent/garbage ⇒ INTERNAL). The engine is the hard INV-1 gate, but the
	// write boundary enforces the symmetric coherence HERE so a client cannot post an incoherent shape: a
	// DELEGATED_EXTERNAL node is terminal (children cleared, contract assembled); an INTERNAL node carries no
	// contract (the form hides the opposite block, but the server must not trust the DOM).
	const executionBoundary: ExecutionBoundary =
		String((form.get('executionBoundary') ?? '') as string) === 'DELEGATED_EXTERNAL'
			? 'DELEGATED_EXTERNAL'
			: 'INTERNAL';
	const delegated = executionBoundary === 'DELEGATED_EXTERNAL';
	const permittedChildTypeIds = delegated
		? []
		: (form.getAll('permittedChildTypeIds') as string[]).map(String).filter(Boolean);
	const permittedChildren: PermittedChildRule[] = permittedChildTypeIds.map((typeId) => {
		const cardinality = asCardinality(String((form.get(`cardinality:${typeId}`) ?? '') as string));
		const note = String((form.get(`applicability:${typeId}`) ?? '') as string).trim();
		return { typeId, cardinality, ...(note ? { applicabilityNote: note } : {}) };
	});
	let boundaryContract: BoundaryContract | undefined;
	if (delegated) {
		const applicabilityNote = String(
			(form.get('boundaryApplicabilityNote') ?? '') as string
		).trim();
		boundaryContract = {
			counterpartyLabel: String((form.get('counterpartyLabel') ?? '') as string).trim(),
			attestedAssurancePolicyIds: (form.getAll('attestedAssurancePolicyIds') as string[])
				.map(String)
				.filter(Boolean),
			...(applicabilityNote ? { applicabilityNote } : {})
		};
	}
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
			.filter(Boolean),
		executionBoundary,
		boundaryContract
	};
}

/** Validate only policy references newly introduced by an authoring operation. Existing references may be retained
 *  or explicitly removed even when a policy later becomes SUSPENDED/SUPERSEDED; otherwise an unrelated edit would
 *  silently strip the historical declaration. */
function policyReferenceError(
	requestedPolicyIds: readonly string[],
	existingPolicyIds: readonly string[] = []
): string | undefined {
	const existing = new Set(existingPolicyIds);
	const policies = new Map(listAssurancePolicies(getEngine()).map((p) => [p.id, p.state]));
	for (const policyId of requestedPolicyIds) {
		if (existing.has(policyId)) continue;
		if (FLOOR_POLICY_IDS.has(policyId)) {
			return `The locked floor policy ${policyId} always applies and must not be referenced explicitly.`;
		}
		const policy = policies.get(policyId);
		if (!policy) return `Assurance Policy ${policyId} does not exist.`;
		const status = String((policy.status ?? 'DRAFT') as string);
		if (status !== 'ACTIVE') {
			return `Assurance Policy ${String((policy.name ?? policyId) as string)} is ${status}; only ACTIVE policies may be newly referenced.`;
		}
	}
	return undefined;
}

/** Bump a semantic version string's minor (1.2.3 -> 1.3.0); falls back to a `-v2` suffix for non-semver. */
function bumpVersion(v: string): string {
	const parts = v.split('.').map((n) => Number.parseInt(n, 10));
	if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
		return `${parts[0]}.${parts[1] + 1}.0`;
	}
	return `${v}-v2`;
}

/** One row of the PWU-Type query, named so the version-migration helpers below can take it by type. */
type PwuTypeRow = ReturnType<typeof listPwuTypes>[number];

/** Copy a stored array-valued field through BY REFERENCE (never a clone), or an empty array when it is absent
 *  or not an array — the shape every rule-array field of a successor policy is copied with. */
function arrayOrEmpty(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

/** The content-preserving payload for a policy's successor version: every field of the predecessor copied
 *  verbatim, under a fresh id and the new version string. */
function successorPolicyPayload(
	prev: Record<string, unknown>,
	successorId: string,
	newVersion: string
): Record<string, unknown> {
	return {
		policyId: successorId,
		version: newVersion,
		name: String((prev.name ?? 'Policy') as string),
		purpose: String((prev.purpose ?? '') as string),
		rationale: String((prev.rationale ?? '') as string),
		applicableObjectTypes: strList(prev.applicableObjectTypes, 'PROFESSIONAL_WORK_UNIT'),
		evaluatedClaimTypes: strList(prev.evaluatedClaimTypes, 'CORRECTNESS'),
		criteria: arrayOrEmpty(prev.criteria),
		evaluatorRole: String((prev.evaluatorRole ?? 'reviewer') as string),
		independenceRequirement: String((prev.independenceRequirement ?? 'DIFFERENT_AGENT') as string),
		findingDefinitions: arrayOrEmpty(prev.findingDefinitions),
		waiverRules: arrayOrEmpty(prev.waiverRules),
		requiredEvidence: arrayOrEmpty(prev.requiredEvidence),
		optionalEvidence: arrayOrEmpty(prev.optionalEvidence),
		dispositionRules: arrayOrEmpty(prev.dispositionRules),
		escalationRules: arrayOrEmpty(prev.escalationRules),
		permittedControlActions: strList(prev.permittedControlActions, 'ESCALATE')
	};
}

/** Every live PWU Type that declares `policyId`, together with the subset whose owning PWA is still DRAFT.
 *  Only the DRAFT-owned ones may have their reference migrated; the rest stay pinned to the historical id.
 *  The query is workspace-wide (no pwaId), so these rows were never rendered by the policy manager. */
function collectPolicyReferences(policyId: string) {
	const referencingTypes = listPwuTypes(getEngine()).filter(
		(t) =>
			Array.isArray(t.state.requiredAssurancePolicyIds) &&
			(t.state.requiredAssurancePolicyIds as string[]).includes(policyId)
	);
	const draftReferences = referencingTypes.filter((type) => {
		const ownerId = String((type.state.pwaId ?? '') as string);
		const owner = ownerId ? getObject(getEngine(), ownerId) : undefined;
		return owner?.publicationStatus === 'DRAFT';
	});
	return { referencingTypes, draftReferences };
}

/** Repoint each DRAFT-owned reference from the predecessor policy to its successor, leaving that type's other
 *  declared policy ids exactly as they were. */
function migrateReferenceCommands(
	draftReferences: readonly PwuTypeRow[],
	policyId: string,
	successorId: string
): UiCommandInput[] {
	return draftReferences.map((type) => {
		const declared = type.state.requiredAssurancePolicyIds as string[];
		return {
			commandType: 'EditPwuType',
			targetAggregateType: 'PWU_TYPE',
			targetAggregateId: type.id,
			payload: {
				pwuTypeId: type.id,
				requiredAssurancePolicyIds: declared.map((id) => (id === policyId ? successorId : id))
			}
		};
	});
}

/**
 * Surface a rolled-back policy-versioning batch.
 *
 * `refuse` rather than a bare fail(400): a rejected element carries its own CommandResult, and a per-command
 * revision conflict surfaces there as status CONFLICT (only `dispatchBatchGuarded` reports a batch-level
 * `guardConflict`). Forwarding it unconditionally as 400 would erase the one distinction this wiring exists
 * to make.
 */
function refuseBatch(batch: ReturnType<typeof dispatchBatch>) {
	const rejected = batch.failedIndex === undefined ? undefined : batch.results[batch.failedIndex];
	if (rejected) return refuse(rejected);
	return fail(400, { error: 'Policy versioning was rejected and rolled back.' });
}

/**
 * Advance the PWA publication FSM and surface any engine rejection to the form.
 *
 * `expectedRevision` is REQUIRED, not optional. Every caller updates an existing PWA — none of the five
 * lifecycle acts is a creation — so PER-4 applies to all of them and an optional parameter would be an
 * invitation to omit it silently at one call site. Making it required puts the enforcement in the type checker
 * rather than in a reviewer, which is the same lesson `withinScope`'s mandatory scope argument records
 * (packages/rph-engine/src/queries.ts:60-72) after an optional one was duly omitted four times over.
 */
function advancePwa(
	commandType: string,
	pwaId: string,
	payload: Record<string, unknown>,
	expectedRevision: number
) {
	const r = dispatch(
		commandType,
		'PROFESSIONAL_WORK_ARCHITECTURE',
		pwaId,
		payload,
		expectedRevision
	);
	// `refuse` rather than a bare fail(400): this dropped `r.error.code`, so a CONFLICT was indistinguishable
	// from a state-machine refusal — and once a revision is declared, telling those two apart is the only
	// evidence the surface can offer about why the act did not happen.
	if (r.status !== 'ACCEPTED') return refuse(r);
	return { advanced: commandType };
}

export const actions: Actions = {
	// Explicit human acceptance of the exact assured preview. The manager performs the revision/event-position guard,
	// command replay, and resultant-state postconditions in one canonical transaction.
	acceptAgentCandidate: async ({ request, params }) => {
		const turn = getPendingAuthoringTurn(params.id);
		if (!turn) return fail(404, { error: 'No staged agent candidate exists.' });
		const acceptedHash = String(
			((await request.formData()).get('candidateHash') ?? '') as string
		).trim();
		try {
			const result = commitAuthoringTurn(turn, acceptedHash);
			if (!result.ok) return fail(409, { error: result.detail, candidateStatus: result.status });
			return { acceptedCandidate: result.candidateHash };
		} catch (error_) {
			return fail(409, {
				error: error_ instanceof Error ? error_.message : String(error_)
			});
		}
	},

	// Pre-commit rollback is discard of the overlay, not Event deletion or semantic compensation.
	discardAgentCandidate: ({ params }) => {
		try {
			if (!discardAuthoringTurn(params.id)) {
				return fail(404, { error: 'No staged agent candidate exists.' });
			}
			return { discardedCandidate: true };
		} catch (error_) {
			return fail(409, {
				error: error_ instanceof Error ? error_.message : String(error_)
			});
		}
	},

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
		const policyError = policyReferenceError(f.requiredAssurancePolicyIds);
		if (policyError) return fail(400, { error: policyError });
		// R-10 (D-C Option 1 parity): attested policy ids obey the same ACTIVE/non-floor rule as declared ones.
		if (f.boundaryContract) {
			const attestError = policyReferenceError(f.boundaryContract.attestedAssurancePolicyIds);
			if (attestError) return fail(400, { error: attestError });
		}
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
			requiredAssurancePolicyIds: f.requiredAssurancePolicyIds,
			executionBoundary: f.executionBoundary,
			...(f.boundaryContract ? { boundaryContract: f.boundaryContract } : {})
		});
		if (r.status !== 'ACCEPTED') return fail(400, { error: r.error?.message ?? r.status });
		return { definedType: id };
	},

	// Edit an existing PWU Type in place (DRAFT PWA only — the engine enforces this).
	editType: async ({ request, params }) => {
		const form = await request.formData();
		const pwuTypeId = String((form.get('pwuTypeId') ?? '') as string).trim();
		if (!pwuTypeId) return fail(400, { error: 'Missing PWU Type.' });
		const stored = getObject(getEngine(), pwuTypeId);
		if (stored?.pwaId !== params.id) return fail(400, { error: 'PWU Type not found on this PWA.' });
		const f = readTypeFields(form);
		if (!f.name || !f.pwuKind)
			return fail(400, { error: 'A PWU Type name and kind are required.' });
		const existingPolicyIds = Array.isArray(stored.requiredAssurancePolicyIds)
			? (stored.requiredAssurancePolicyIds as string[])
			: [];
		const policyError = policyReferenceError(f.requiredAssurancePolicyIds, existingPolicyIds);
		if (policyError) return fail(400, { error: policyError });
		// R-10: validate attested ids, retaining the type's pre-existing attested declarations (an unrelated edit
		// must not re-reject a since-deactivated attested policy).
		if (f.boundaryContract) {
			const existingAttested =
				(stored.boundaryContract as { attestedAssurancePolicyIds?: string[] } | undefined)
					?.attestedAssurancePolicyIds ?? [];
			const attestError = policyReferenceError(
				f.boundaryContract.attestedAssurancePolicyIds,
				existingAttested
			);
			if (attestError) return fail(400, { error: attestError });
		}
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
			requiredAssurancePolicyIds: f.requiredAssurancePolicyIds,
			executionBoundary: f.executionBoundary,
			...(f.boundaryContract ? { boundaryContract: f.boundaryContract } : {})
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

	// ── THE FIVE PUBLICATION-LIFECYCLE ACTS ─────────────────────────────────────────────────────────────────
	// Each updates the PWA aggregate itself, so PER-4 binds all five. They took no `request` at all before this
	// and their forms posted ZERO fields — not even an id, because `params.id` supplied the subject. Declaring
	// the revision is therefore the first thing any of them has ever had to read from the submission.
	submitForReview: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('SubmitPwaForReview', params.id, {}, expectedRevision);
	},
	validate: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('ValidatePwa', params.id, {}, expectedRevision);
	},
	// Publish requires a declared root PWU Type (which must have been defined while DRAFT); resolve it server-side.
	publish: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		// ⚠ `root` NAMES A DIFFERENT AGGREGATE AND CONTRIBUTES NO REVISION. It is a PAYLOAD field; the subject
		// of PublishPwa is the PWA. Declaring the root type's revision here would be the subject-identity error
		// PER-4 wiring exists to avoid — an expectation about an object the command does not target.
		const root = listPwuTypes(getEngine(), params.id).find((t) => t.state.isRoot === true);
		if (!root) return fail(400, { error: 'Define a root PWU Type before publishing.' });
		return advancePwa('PublishPwa', params.id, { rootPwuTypeId: root.id }, expectedRevision);
	},
	// Continue the publication FSM past PUBLISHED: PUBLISHED -> DEPRECATED -> RETIRED.
	deprecate: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('DeprecatePwa', params.id, {}, expectedRevision);
	},
	retire: async ({ request, params }) => {
		const expectedRevision = readRenderedRevision(await request.formData());
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		return advancePwa('RetirePwa', params.id, {}, expectedRevision);
	},

	// Record + grant an auditable governance WAIVER naming the blocking floor policy and the finding it accepts.
	//
	// ⚠ THIS DOES NOT UNBLOCK PUBLISHING, and this docblock used to say it did — "so a non-SATISFIED PWA can
	// PUBLISH — the alternative to revising the graph and re-running the floor" — which is the exact reach ASR-3
	// (JPWB-DOC-003 §Semantic Model, ratified) removed: the de minimis floor is UNCONDITIONAL. `floorGateBlock`
	// consults no waiver, so PublishPwa refuses identically before and after this action succeeds. There is ONE
	// route past the floor and it is revision. This docblock is why the surface above it said what it said, so it
	// is corrected here rather than only in the markup (REG-F-202).
	//
	// It is KEPT, not withdrawn, and that was the sponsor's ruling read carefully: ASR-14 — "a waiver accepts risk;
	// it never rewrites truth" — narrows a waiver's REACH, not its RECORDABILITY. Refusing to record one would be
	// over-refusal. The act mints a real EFFECTIVE WAIVER Decision; what changed is that the surface must not
	// present it as clearing anything.
	recordWaiver: async ({ request, params }) => {
		const rationale = String(((await request.formData()).get('rationale') ?? '') as string).trim();
		if (!rationale) return fail(400, { error: 'A waiver rationale is required.' });
		// A waiver must name the EXACT policy and criterion it discharges (DOC-004 §12.2; RPH-GOV-005 forbids
		// bleeding to another criterion). It used to send a free-text scope of "de minimis assurance floor", which
		// the gate honored as a blanket bypass of the WHOLE floor — including a REJECTED independent review. So we
		// derive the target from the RECORDED floor: the blocking policy and the open finding it actually failed on.
		const floor = loadPwaFloor(params.id);
		const blocking = floor?.policies.find((p) => p.disposition !== 'SATISFIED');
		if (!blocking) return fail(400, { error: 'Nothing to waive: the floor is not blocking.' });
		const finding = blocking.observations[0];
		if (!finding)
			return fail(400, {
				error: `Cannot waive ${blocking.policyId}: no open finding is recorded for it, and a waiver must name the finding it waives (DOC-004 §12.2).`
			});
		const waiverId = mintUiId('dec');
		const req = dispatch('RequestWaiver', 'DECISION', waiverId, {
			subjectObjectIds: [params.id],
			scope: finding.code,
			rationale,
			duration: 'until superseded',
			affectedObjectIds: [params.id],
			waivedPolicyId: blocking.policyId,
			waivedCriterionId: finding.code,
			// FloorView surfaces an observation's code/severity/statement but not its id — so the finding is named
			// by criterion, not by id, here. Surfacing observation ids through the view is a follow-on.
			waivedFindingIds: [],
			compensatingControls: [],
			reviewConditions: []
		});
		if (req.status !== 'ACCEPTED') return fail(400, { error: req.error?.message ?? req.status });
		const grant = dispatch('GrantWaiver', 'DECISION', waiverId, {
			waiverDecisionId: waiverId,
			duration: 'until superseded'
		});
		if (grant.status !== 'ACCEPTED')
			return fail(400, { error: grant.error?.message ?? grant.status });
		return { waived: waiverId };
	},

	// ── Assurance Policy library management (workbench-wide; not gated by this PWA's draft status) ──────────────
	// Create a new authorable Assurance Policy (DRAFT). The 3 de minimis floor policies are locked and seeded, not
	// created here; a regular policy must be deliberately activated before a PWU Type can declare it.
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
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		// Pass the STORED criteria so an unchanged line keeps its id, name and severity. Without this the edit
		// re-mints every criterion from its description and silently destroys both — see readPolicyFields.
		//
		// ⚠ AND THE REVISION IS WHAT MAKES THIS READ SAFE, which is a stronger reason than PER-4's letter. These
		// stored criteria are fetched HERE, after the page was rendered: if the policy changed in between, the
		// edit would merge the professional's form against criteria they never saw. Declaring the rendered
		// revision converts that silent merge into a refusal.
		const stored = getObject(getEngine(), policyId);
		const priorCriteria = Array.isArray(stored?.criteria)
			? (stored.criteria as AssessmentCriterion[])
			: [];
		const f = readPolicyFields(form, priorCriteria);
		const r = dispatch(
			'EditAssurancePolicy',
			'ASSURANCE_POLICY',
			policyId,
			{
				policyId,
				...(f.name ? { name: f.name } : {}),
				...(f.purpose ? { purpose: f.purpose } : {}),
				...(f.rationale ? { rationale: f.rationale } : {}),
				...(f.evaluatedClaimTypes ? { evaluatedClaimTypes: f.evaluatedClaimTypes } : {}),
				...(f.evaluatorRole ? { evaluatorRole: f.evaluatorRole } : {}),
				...(f.independenceRequirement
					? { independenceRequirement: f.independenceRequirement }
					: {}),
				...(f.applicableObjectTypes ? { applicableObjectTypes: f.applicableObjectTypes } : {}),
				...(f.permittedControlActions
					? { permittedControlActions: f.permittedControlActions }
					: {}),
				...(f.criteria.length ? { criteria: f.criteria } : {})
			},
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { editedPolicy: policyId };
	},

	// Promote a new version atomically: create + activate a content-preserving successor, migrate references owned by
	// DRAFT PWAs, then supersede the predecessor. Immutable published definitions remain pinned to the historical
	// policy id; changing them here would rewrite a published PWA, while blocking on them would deadlock policy
	// evolution because their references can never be edited away. Plain policy creation remains DRAFT-first.
	newPolicyVersion: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const prev = getObject(getEngine(), policyId);
		if (!prev) return fail(400, { error: 'Policy not found.' });
		if (FLOOR_POLICY_IDS.has(policyId))
			return fail(400, { error: 'Floor policies cannot be versioned.' });
		const previousStatus = String((prev.status ?? '') as string);
		if (previousStatus !== 'ACTIVE' && previousStatus !== 'SUSPENDED')
			return fail(400, { error: 'Only active or suspended policies can be versioned.' });
		const requested = String((form.get('version') ?? '') as string).trim();
		const newVersion = requested || bumpVersion(String((prev.version ?? '1.0.0') as string));
		const { referencingTypes, draftReferences } = collectPolicyReferences(policyId);
		const successorId = mintUiId('pol');
		const commands: UiCommandInput[] = [
			{
				commandType: 'CreateAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: successorId,
				payload: successorPolicyPayload(prev, successorId, newVersion)
			},
			{
				commandType: 'ActivateAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: successorId,
				payload: { policyId: successorId }
			},
			...migrateReferenceCommands(draftReferences, policyId, successorId),
			{
				commandType: 'SupersedeAssurancePolicy',
				targetAggregateType: 'ASSURANCE_POLICY',
				targetAggregateId: policyId,
				payload: { policyId, supersededByPolicyId: successorId },
				// ── THE ONLY PAGE-DERIVABLE EXPECTATION IN THIS BATCH, and it protects far more than itself ──
				// Element 0 MINTS `successorId`, so it did not exist at render and PER-4's NON-EXAMPLE exempts
				// it. Element 1 activates that same brand-new id. Elements 2..n-1 target PWU_TYPEs the policy
				// manager never rendered (`draftReferences` derives from a workspace-wide `listPwuTypes` with no
				// pwaId). This LAST element is the first and only touch of `policyId`, which IS a rendered row.
				//
				// AND BECAUSE `dispatchBatch` RUNS ONE STORE TRANSACTION (command-bus.ts:334-353), a conflict
				// here rolls back element 0 too. That matters: the successor's entire content — name, purpose,
				// rationale, criteria, all six rule arrays — is copied from a `getObject` read taken AFTER the
				// page was rendered. Without this the successor could be minted from a predecessor the
				// professional never saw. One expectation, transitively guarding the whole copy.
				expectedRevision
			}
		];
		const batch = dispatchBatch(commands);
		if (!batch.ok) return refuseBatch(batch);
		return {
			newVersion: successorId,
			migratedReferences: draftReferences.length,
			pinnedHistoricalReferences: referencingTypes.length - draftReferences.length
		};
	},

	// ⚠ THE FORMDATA IS HOISTED, not read inline as `(await request.formData()).get(...)`. Both of these read it
	// twice now (id and revision), and consuming the stream inside an expression made that impossible to add
	// without noticing — which is why the inline shape is worth removing rather than working around.
	suspendPolicy: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch(
			'SuspendAssurancePolicy',
			'ASSURANCE_POLICY',
			policyId,
			{ policyId },
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { suspendedPolicy: policyId };
	},

	// ⚠ THIS IS THE ACT THE E2E DRIVES FIRST, AND IT IS THE ONE A NAIVE PARSER WOULD LET THROUGH. A policy is
	// born DRAFT at revision 0 (`createObject` commits `newRevision: alsoEvents.length`, kit.ts:563) and
	// `policy-manager.e2e.ts` activates it a few lines after creating it. `Number('')` is also 0, so a form that
	// round-tripped nothing would MATCH here and be accepted; only the later suspend (revision 1) would fail.
	// `readRenderedRevision` rejects the empty string for exactly this reason — never a local `Number(raw)`.
	activatePolicy: async ({ request }) => {
		const form = await request.formData();
		const policyId = String((form.get('policyId') ?? '') as string).trim();
		if (!policyId) return fail(400, { error: 'Missing policy.' });
		const expectedRevision = readRenderedRevision(form);
		if (expectedRevision === null) return fail(400, { error: STALE_FORM });
		const r = dispatch(
			'ActivateAssurancePolicy',
			'ASSURANCE_POLICY',
			policyId,
			{ policyId },
			expectedRevision
		);
		if (r.status !== 'ACCEPTED') return refuse(r);
		return { activatedPolicy: policyId };
	}
};
