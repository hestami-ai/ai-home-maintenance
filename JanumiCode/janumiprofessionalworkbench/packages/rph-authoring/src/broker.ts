// The PWA-authoring CapabilityBroker — an LLM-agnostic layer of READ + PROPOSE operations over the rph-engine
// public seam, scoped to a single DRAFT PWA. The Pi agent's tools call this layer; current node-graph form actions
// dispatch the same domain commands through their route actions and apply parallel authoring checks. The agent never
// touches SQL or events. Broker pre-checks provide actionable authoring feedback, then every PROPOSE issues a real
// domain command (as an AGENT actor) so malformed or illegal domain operations are rejected rather than silently
// applied. Multi-step "generate a whole graph and wire it" is one atomic dispatchBatch (all-or-nothing) so a
// mid-sequence failure cannot strand a half-built DRAFT. Governance: this broker authors only a DRAFT
// (define/edit/remove/link PWU Types, edit the PWA's own details); it deliberately does NOT expose the publication
// FSM — a human advances DRAFT -> ... -> PUBLISHED. That is the "agent proposes, human publishes" seam.
import type {
	AssessmentCriterion,
	CardinalityCode,
	CommandResult,
	DomainCommand,
	PermittedChildRule
} from '@janumipwb/rph-contracts';

// Re-export the PWU-Type authoring value types so every authoring surface (the agent tools, the UI) can name them
// via @janumipwb/rph-authoring without reaching into the contracts package directly.
export type { CardinalityCode, PermittedChildRule } from '@janumipwb/rph-contracts';
import {
	getObject,
	listAssurancePolicies,
	listPwuTypes,
	type EngineHandle
} from '@janumipwb/rph-engine';
import {
	catalogTemplate,
	PWU_TYPE_CATALOG,
	PWU_TYPE_HELP,
	type PwuTypeTemplate
} from './catalog.js';

/** The current view of the DRAFT PWA being authored. */
export interface PwaView {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly domain: string;
	readonly version: string;
	readonly publicationStatus: string;
}

/** A PWU Type as the authoring surface sees it (definition fields only — no execution/assurance state). */
export interface PwuTypeView {
	readonly id: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly purpose: string;
	readonly isRoot: boolean;
	readonly completionRule: string;
	readonly permittedChildTypeIds: string[];
	/** Per-child cardinality annotations (parallel to permittedChildTypeIds; children with no rule default to M1). */
	readonly permittedChildren: PermittedChildRule[];
	readonly requiredInputs: string[];
	readonly requiredOutputs: string[];
	/** Declared (required-treatment) assurance policy ids for future instances of this type (§11.7.4). */
	readonly requiredAssurancePolicyIds: string[];
}

/** The outcome of a PROPOSE operation. `ok` mirrors the engine's acceptance; on failure `error` carries the
 *  domain's rejection message so the agent (or the UI) can react. `id` is the minted id of a newly defined type;
 *  `ids` maps a scaffold's temp keys to their minted ids. */
export interface ProposalResult {
	readonly ok: boolean;
	readonly id?: string;
	readonly ids?: Record<string, string>;
	readonly status?: string;
	readonly error?: string;
}

/** Fields accepted when defining a new PWU Type (kind + name are required; the rest default sensibly). */
export interface DefineTypeInput {
	readonly name: string;
	readonly pwuKind: string;
	readonly purpose?: string;
	readonly isRoot?: boolean;
	readonly completionRule?: string;
	readonly permittedChildTypeIds?: readonly string[];
	/** Per-child cardinality rules; permittedChildTypeIds is derived from these when only the rules are given. */
	readonly permittedChildren?: readonly PermittedChildRule[];
	readonly requiredInputs?: readonly string[];
	readonly requiredOutputs?: readonly string[];
	readonly requiredAssurancePolicyIds?: readonly string[];
}

/** A patch to an existing PWU Type — only the present fields change (mirrors the EditPwuType field-patch). */
export interface EditTypeInput {
	readonly name?: string;
	readonly pwuKind?: string;
	readonly purpose?: string;
	readonly isRoot?: boolean;
	readonly completionRule?: string;
	readonly permittedChildTypeIds?: readonly string[];
	readonly permittedChildren?: readonly PermittedChildRule[];
	readonly requiredInputs?: readonly string[];
	readonly requiredOutputs?: readonly string[];
	readonly requiredAssurancePolicyIds?: readonly string[];
}

/** Semantic attributes for one parent -> child composition edge. Omitted attributes preserve an existing rule;
 *  a newly added edge defaults to M1. Passing an empty applicabilityNote deliberately clears the note. */
export interface LinkTypesInput {
	readonly cardinality?: CardinalityCode;
	readonly applicabilityNote?: string;
}

/** An Assurance Policy as the authoring surface sees it (definition summary; the 3 floor policies are flagged). */
export interface AssurancePolicyView {
	readonly id: string;
	readonly name: string;
	readonly purpose: string;
	readonly version: string;
	readonly status: string;
	/** True for a locked de minimis floor policy (always-applies, non-editable). */
	readonly isFloor: boolean;
}

/** Fields accepted when creating a new Assurance Policy (only name is required; the rest default sensibly). */
export interface CreatePolicyInput {
	readonly name: string;
	readonly purpose?: string;
	readonly rationale?: string;
	/** DOC-004 §3.1: `evaluatedClaimTypes: ClaimType[]`. Was a single value — the array was unrepresentable
	 *  because both generators dropped `[]` from enumRef fields (fixed 2026-07-16). */
	readonly evaluatedClaimTypes?: readonly string[];
	readonly evaluatorRole?: string;
	readonly independenceRequirement?: string;
	/** DOC-004 §3.1 / §11: `permittedControlActions: ControlAction[]` — a SET. Was ONE action. */
	readonly permittedControlActions?: readonly string[];
	/** Each string becomes a DOC-004 §7 `AssessmentCriterion` (id generated; see `createPolicy`). */
	readonly criteria?: readonly string[];
}

/** One node in a scaffold: a type to define, optionally naming (by temp key) the child types it permits. */
export interface ScaffoldSpec {
	/** Caller-chosen handle used to wire permits edges within the batch (not persisted). */
	readonly tempKey: string;
	readonly name: string;
	readonly pwuKind: string;
	readonly purpose?: string;
	readonly isRoot?: boolean;
	readonly completionRule?: string;
	readonly requiredInputs?: readonly string[];
	readonly requiredOutputs?: readonly string[];
	readonly requiredAssurancePolicyIds?: readonly string[];
	/** Temp keys of other specs in THIS batch that this type permits as children. */
	readonly childTempKeys?: readonly string[];
	/** Per-child cardinality by temp key (each must appear in childTempKeys); missing entries default to M1. */
	readonly childCardinalities?: readonly {
		readonly tempKey: string;
		readonly cardinality: CardinalityCode;
		readonly applicabilityNote?: string;
	}[];
}

export interface BrokerDeps {
	/** The engine seam (Node host). Every read + command goes through it. */
	readonly engine: EngineHandle;
	/** The DRAFT PWA this broker authors. All proposals are scoped to it. */
	readonly pwaId: string;
	/** Mints a new aggregate id for the given prefix (the host owns id policy — deterministic in tests). */
	readonly mintId: (prefix: string) => string;
	/** ISO clock (deterministic in tests). Defaults to wall-clock. */
	readonly now?: () => string;
	/** The actor recorded on every command. Defaults to an AGENT actor ("agent proposes"). */
	readonly actor?: DomainCommand['issuedBy'];
	/** Namespaces command ids + idempotency keys so two brokers over one engine never collide. Defaults to 'broker'. */
	readonly sessionId?: string;
}

const PWA_TYPE = 'PROFESSIONAL_WORK_ARCHITECTURE';
const PWU_TYPE = 'PWU_TYPE';
const ASSURANCE_POLICY = 'ASSURANCE_POLICY';
// The 3 de minimis floor policies (guide §8.4) are locked; the manager/agent surface them read-only.
const FLOOR_POLICY_IDS: ReadonlySet<string> = new Set([
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
]);

function toTypeView(id: string, s: Record<string, unknown>): PwuTypeView {
	const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
	return {
		id,
		name: String((s.name ?? id) as string),
		pwuKind: String((s.pwuKind ?? '') as string),
		purpose: String((s.purpose ?? '') as string),
		isRoot: Boolean(s.isRoot),
		completionRule: String((s.completionRule ?? '') as string),
		permittedChildTypeIds: arr(s.permittedChildTypeIds),
		permittedChildren: Array.isArray(s.permittedChildren)
			? (s.permittedChildren as PermittedChildRule[])
			: [],
		requiredInputs: arr(s.requiredInputs),
		requiredOutputs: arr(s.requiredOutputs),
		requiredAssurancePolicyIds: arr(s.requiredAssurancePolicyIds)
	};
}

export class PwaAuthoringBroker {
	private readonly engine: EngineHandle;
	private readonly pwaId: string;
	private readonly mintId: (prefix: string) => string;
	private readonly now: () => string;
	private readonly actor: DomainCommand['issuedBy'];
	private readonly sessionId: string;
	private seq = 0;

	constructor(deps: BrokerDeps) {
		this.engine = deps.engine;
		this.pwaId = deps.pwaId;
		this.mintId = deps.mintId;
		this.now = deps.now ?? (() => new Date().toISOString());
		this.actor = deps.actor ?? {
			actorId: 'jpwb-authoring-agent',
			actorType: 'AGENT',
			displayName: 'JPWB Authoring Agent'
		};
		this.sessionId = deps.sessionId ?? 'broker';
	}

	// ---- READ (pure; no mutation) ------------------------------------------------------------------

	/** The DRAFT PWA under authoring (undefined if the id doesn't resolve). */
	getPwa(): PwaView | undefined {
		const s = getObject(this.engine, this.pwaId);
		if (!s) return undefined;
		return {
			id: this.pwaId,
			name: String((s.name ?? this.pwaId) as string),
			description: String((s.description ?? '') as string),
			domain: String((s.domain ?? '') as string),
			version: String((s.version ?? '') as string),
			publicationStatus: String((s.publicationStatus ?? 'DRAFT') as string)
		};
	}

	/** The live PWU Types on this PWA (REMOVED tombstones excluded). */
	listTypes(): PwuTypeView[] {
		return listPwuTypes(this.engine, this.pwaId).map((r) => toTypeView(r.id, r.state));
	}

	/** One live PWU Type by id (undefined if absent, tombstoned, or on another PWA). */
	getType(pwuTypeId: string): PwuTypeView | undefined {
		return this.listTypes().find((t) => t.id === pwuTypeId);
	}

	/** The copy-on-use PWU Type catalog (the seed "PWU library"). */
	catalog(): readonly PwuTypeTemplate[] {
		return PWU_TYPE_CATALOG;
	}

	/** The workbench Assurance Policy library (real ASSURANCE_POLICY objects). The 3 floor policies are flagged. A
	 *  PWU Type may declare any ACTIVE non-floor policy via requiredAssurancePolicyIds. */
	listPolicies(): AssurancePolicyView[] {
		return listAssurancePolicies(this.engine).map((r) => ({
			id: r.id,
			name: String((r.state.name ?? r.id) as string),
			purpose: String((r.state.purpose ?? '') as string),
			version: String((r.state.version ?? '') as string),
			status: String((r.state.status ?? 'DRAFT') as string),
			isFloor: FLOOR_POLICY_IDS.has(r.id)
		}));
	}

	/** Per-field authoring help — the single source both the inspector form and the agent tool schemas surface. */
	help(): typeof PWU_TYPE_HELP {
		return PWU_TYPE_HELP;
	}

	// ---- PROPOSE (mutating; each issues a real domain command) -------------------------------------

	/** Edit the DRAFT PWA's own metadata (name / description / domain). Only present fields change. */
	setPwaDetails(patch: { name?: string; description?: string; domain?: string }): ProposalResult {
		const guard = this.requireDraft();
		if (guard) return guard;
		return this.one('EditPwa', PWA_TYPE, this.pwaId, {
			pwaId: this.pwaId,
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.description !== undefined ? { description: patch.description } : {}),
			...(patch.domain !== undefined ? { domain: patch.domain } : {})
		});
	}

	/** Create a new authorable Assurance Policy (DRAFT) in the workbench library. NOT scoped to the current PWA —
	 *  policies are workbench-wide objects, and only an ACTIVE non-floor policy may then be referenced by a PWU Type.
	 *  Activation is a separate human governance step. The 3 floor policies are seeded, not created here. */
	createPolicy(input: CreatePolicyInput): ProposalResult {
		if (!input.name?.trim()) return { ok: false, error: 'A policy name is required.' };
		const id = this.mintId('pol');
		// Each line becomes a RATIFIED DOC-004 §7 AssessmentCriterion. This minted `{id, statement, mandatory}` —
		// a shape no document defines — and the engine took it, because `CreateAssurancePolicy.criteria` was
		// `z.array(z.unknown())`. This is the AGENT-facing path, so the invented shape was what an agent's
		// authored policy actually became (AUDIT-placeholder-helpers.md).
		//
		// `name` and `description` both take the line: this input carries ONE string per criterion and §7
		// requires both. Duplicating the author's words is lossless; inventing a short name would be authoring
		// professional content. `severityIfNotMet: 'BLOCKING'` preserves the old `mandatory: true` exactly.
		const criteria: AssessmentCriterion[] = (input.criteria ?? []).map((line, i) => ({
			id: `C-${String(i + 1).padStart(2, '0')}`,
			name: line,
			description: line,
			criterionType: 'BOOLEAN',
			evaluationMethod: 'MODEL_JUDGMENT',
			requiredEvidenceIds: [],
			severityIfNotMet: 'BLOCKING',
			mayBeNotApplicable: false
		}));
		return this.one('CreateAssurancePolicy', ASSURANCE_POLICY, id, {
			policyId: id,
			version: '1.0.0',
			name: input.name,
			purpose: input.purpose || input.name,
			rationale: input.rationale || 'Authored by the JPWB agent.',
			applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
			evaluatedClaimTypes: input.evaluatedClaimTypes?.length
				? input.evaluatedClaimTypes
				: ['CORRECTNESS'],
			criteria,
			evaluatorRole: input.evaluatorRole || 'reviewer',
			independenceRequirement: input.independenceRequirement || 'DIFFERENT_AGENT',
			findingDefinitions: [],
			permittedControlActions: input.permittedControlActions?.length
				? input.permittedControlActions
				: ['ESCALATE']
		});
	}

	/** Define a new PWU Type on this DRAFT PWA. Returns the minted id on success. */
	defineType(input: DefineTypeInput): ProposalResult {
		const guard = this.requireDraft();
		if (guard) return guard;
		if (!input.name?.trim() || !input.pwuKind?.trim())
			return { ok: false, error: 'A PWU Type name and kind are required.' };
		const policyGuard = this.validatePolicyReferences(input.requiredAssurancePolicyIds ?? []);
		if (policyGuard) return policyGuard;
		const id = this.mintId('pwut');
		const r = this.dispatch(
			this.cmd('DefinePwuType', PWU_TYPE, id, {
				pwuTypeId: id,
				pwaId: this.pwaId,
				pwuKind: input.pwuKind,
				name: input.name,
				purpose: input.purpose || input.name,
				isRoot: input.isRoot ?? false,
				permittedChildTypeIds: [...(input.permittedChildTypeIds ?? [])],
				requiredInputs: [...(input.requiredInputs ?? [])],
				requiredOutputs: [...(input.requiredOutputs ?? [])],
				requiredAssurancePolicyIds: [...(input.requiredAssurancePolicyIds ?? [])],
				...(input.permittedChildren ? { permittedChildren: [...input.permittedChildren] } : {}),
				...(input.completionRule ? { completionRule: input.completionRule } : {})
			})
		);
		return accepted(r) ? { ok: true, id, status: r.status } : rejected(r);
	}

	/** Define a new PWU Type from a catalog blueprint, with optional field overrides. */
	defineFromTemplate(templateKey: string, overrides?: Partial<DefineTypeInput>): ProposalResult {
		const t = catalogTemplate(templateKey);
		if (!t) return { ok: false, error: `Unknown catalog template: ${templateKey}` };
		return this.defineType({
			name: t.name,
			pwuKind: t.pwuKind,
			purpose: t.purpose,
			isRoot: t.isRoot,
			requiredInputs: t.requiredInputs ?? [],
			requiredOutputs: t.requiredOutputs ?? [],
			...overrides
		});
	}

	/** Edit an existing PWU Type in place (only present fields change). */
	editType(pwuTypeId: string, patch: EditTypeInput): ProposalResult {
		const guard = this.requireDraft();
		if (guard) return guard;
		const existing = this.getType(pwuTypeId);
		if (!existing) return { ok: false, error: `PWU Type ${pwuTypeId} does not exist on this PWA.` };
		const policyGuard = this.validatePolicyPatch(patch, existing);
		if (policyGuard) return policyGuard;
		const r = this.dispatch(
			this.cmd('EditPwuType', PWU_TYPE, pwuTypeId, {
				pwuTypeId,
				...(patch.name !== undefined ? { name: patch.name } : {}),
				...(patch.pwuKind !== undefined ? { pwuKind: patch.pwuKind } : {}),
				...(patch.purpose !== undefined ? { purpose: patch.purpose } : {}),
				...(patch.isRoot !== undefined ? { isRoot: patch.isRoot } : {}),
				...(patch.completionRule !== undefined ? { completionRule: patch.completionRule } : {}),
				...(patch.permittedChildTypeIds !== undefined
					? { permittedChildTypeIds: [...patch.permittedChildTypeIds] }
					: {}),
				...(patch.permittedChildren !== undefined
					? { permittedChildren: [...patch.permittedChildren] }
					: {}),
				...(patch.requiredInputs !== undefined
					? { requiredInputs: [...patch.requiredInputs] }
					: {}),
				...(patch.requiredOutputs !== undefined
					? { requiredOutputs: [...patch.requiredOutputs] }
					: {}),
				...(patch.requiredAssurancePolicyIds !== undefined
					? { requiredAssurancePolicyIds: [...patch.requiredAssurancePolicyIds] }
					: {})
			})
		);
		return accepted(r) ? { ok: true, id: pwuTypeId, status: r.status } : rejected(r);
	}

	/** Remove (tombstone) a PWU Type. The engine enforces referential integrity + the DRAFT guard. */
	removeType(pwuTypeId: string): ProposalResult {
		const guard = this.requireDraft();
		if (guard) return guard;
		const r = this.dispatch(this.cmd('RemovePwuType', PWU_TYPE, pwuTypeId, { pwuTypeId }));
		return accepted(r) ? { ok: true, id: pwuTypeId, status: r.status } : rejected(r);
	}

	/** Add or semantically update a "permits" (composition) edge parent -> child. The complete parallel rule list is
	 *  rewritten so changing one edge cannot discard another child's cardinality/applicability. Idempotent when the
	 *  effective edge is already identical. */
	linkTypes(parentId: string, childId: string, input: LinkTypesInput = {}): ProposalResult {
		if (parentId === childId) return { ok: false, error: 'A PWU Type cannot permit itself.' };
		const parent = this.getType(parentId);
		if (!parent) return { ok: false, error: `Parent PWU Type ${parentId} does not exist.` };
		if (!this.getType(childId))
			return { ok: false, error: `Child PWU Type ${childId} does not exist.` };

		const existing = parent.permittedChildren.find((rule) => rule.typeId === childId);
		const hasApplicabilityNote = Object.hasOwn(input, 'applicabilityNote');
		const applicabilityNote = hasApplicabilityNote
			? input.applicabilityNote?.trim() || undefined
			: existing?.applicabilityNote;
		const desired: PermittedChildRule = {
			typeId: childId,
			cardinality: input.cardinality ?? existing?.cardinality ?? 'M1',
			...(applicabilityNote ? { applicabilityNote } : {})
		};
		const alreadyLinked = parent.permittedChildTypeIds.includes(childId);
		const effectiveExisting: PermittedChildRule = existing ?? {
			typeId: childId,
			cardinality: 'M1'
		};
		if (
			alreadyLinked &&
			effectiveExisting.cardinality === desired.cardinality &&
			effectiveExisting.applicabilityNote === desired.applicabilityNote
		) {
			return { ok: true, id: parentId, status: 'DUPLICATE' };
		}

		const permittedChildTypeIds = alreadyLinked
			? parent.permittedChildTypeIds
			: [...parent.permittedChildTypeIds, childId];
		const permittedChildren = permittedChildTypeIds.map((typeId) => {
			if (typeId === childId) return desired;
			return (
				parent.permittedChildren.find((rule) => rule.typeId === typeId) ?? {
					typeId,
					cardinality: 'M1' as const
				}
			);
		});
		return this.editType(parentId, {
			permittedChildTypeIds,
			permittedChildren
		});
	}

	/** Remove a "permits" edge parent -> child. Idempotent: absent edge succeeds no-op. */
	unlinkTypes(parentId: string, childId: string): ProposalResult {
		const parent = this.getType(parentId);
		if (!parent) return { ok: false, error: `Parent PWU Type ${parentId} does not exist.` };
		if (!parent.permittedChildTypeIds.includes(childId))
			return { ok: true, id: parentId, status: 'DUPLICATE' };
		const permittedChildTypeIds = parent.permittedChildTypeIds.filter((c) => c !== childId);
		return this.editType(parentId, {
			permittedChildTypeIds,
			permittedChildren: permittedChildTypeIds.map(
				(typeId) =>
					parent.permittedChildren.find((rule) => rule.typeId === typeId) ?? {
						typeId,
						cardinality: 'M1' as const
					}
			)
		});
	}

	/**
	 * Define a whole set of PWU Types (and wire their permits edges) ATOMICALLY — the agent's "generate the node
	 * graph" primitive. Temp keys are minted to real ids up front so a spec can name its children before they
	 * exist; every DefinePwuType runs inside ONE dispatchBatch, so if any is rejected NONE commit (no half-built
	 * graph). Returns the tempKey -> minted id map on success.
	 */
	scaffold(specs: readonly ScaffoldSpec[]): ProposalResult {
		const guard = this.requireDraft();
		if (guard) return guard;
		if (specs.length === 0) return { ok: false, error: 'scaffold requires at least one type.' };
		const keys = new Set(specs.map((s) => s.tempKey));
		if (keys.size !== specs.length)
			return { ok: false, error: 'scaffold temp keys must be unique.' };
		for (const spec of specs) {
			const policyGuard = this.validatePolicyReferences(spec.requiredAssurancePolicyIds ?? []);
			if (policyGuard) {
				return {
					...policyGuard,
					error: `Type "${spec.tempKey}": ${policyGuard.error}`
				};
			}
		}

		// Mint real ids for every temp key first, so child references resolve within the batch.
		const idFor = new Map<string, string>();
		for (const s of specs) idFor.set(s.tempKey, this.mintId('pwut'));
		const mintedIds = [...idFor.values()];
		const duplicateId = mintedIds.find((id, index) => mintedIds.indexOf(id) !== index);
		if (duplicateId) {
			return {
				ok: false,
				status: 'ID_COLLISION',
				error: `ID_COLLISION: the host minted duplicate PWU Type id ${duplicateId} inside one scaffold. No commands were dispatched; correct the id generator before retrying.`
			};
		}
		const existingId = mintedIds.find((id) => getObject(this.engine, id) !== undefined);
		if (existingId) {
			return {
				ok: false,
				status: 'ID_COLLISION',
				error: `ID_COLLISION: the host minted PWU Type id ${existingId}, which already exists. No commands were dispatched; correct the id generator before retrying.`
			};
		}

		const built = this.buildScaffoldCommands(specs, idFor);
		if ('error' in built) return built.error;

		const batch = this.engine.dispatchBatch(built.commands);
		if (!batch.ok) {
			const failed = batch.failedIndex !== undefined ? batch.results[batch.failedIndex] : undefined;
			return {
				ok: false,
				status: failed?.status,
				error: failed?.error?.message ?? 'scaffold batch was rejected (rolled back).'
			};
		}
		return { ok: true, ids: Object.fromEntries(idFor) };
	}

	/** Build the DefinePwuType command per spec (validating each + resolving child temp keys via the pre-minted
	 *  `idFor`), preserving spec order so `this.cmd`'s seq numbering is identical. Returns the first validation
	 *  failure as an `error` ProposalResult, otherwise the built commands. */
	private buildScaffoldCommands(
		specs: readonly ScaffoldSpec[],
		idFor: Map<string, string>
	): { commands: DomainCommand[] } | { error: ProposalResult } {
		const commands: DomainCommand[] = [];
		for (const s of specs) {
			if (!s.name?.trim() || !s.pwuKind?.trim())
				return { error: { ok: false, error: `Type "${s.tempKey}" needs a name and kind.` } };
			const childIds: string[] = [];
			const childRules: PermittedChildRule[] = [];
			for (const ck of s.childTempKeys ?? []) {
				const cid = idFor.get(ck);
				if (!cid)
					return {
						error: { ok: false, error: `Type "${s.tempKey}" names unknown child "${ck}".` }
					};
				childIds.push(cid);
				const card = s.childCardinalities?.find((c) => c.tempKey === ck);
				childRules.push({
					typeId: cid,
					cardinality: card?.cardinality ?? 'M1',
					...(card?.applicabilityNote ? { applicabilityNote: card.applicabilityNote } : {})
				});
			}
			const id = idFor.get(s.tempKey)!;
			commands.push(
				this.cmd('DefinePwuType', PWU_TYPE, id, {
					pwuTypeId: id,
					pwaId: this.pwaId,
					pwuKind: s.pwuKind,
					name: s.name,
					purpose: s.purpose || s.name,
					isRoot: s.isRoot ?? false,
					permittedChildTypeIds: childIds,
					permittedChildren: childRules,
					requiredInputs: [...(s.requiredInputs ?? [])],
					requiredOutputs: [...(s.requiredOutputs ?? [])],
					requiredAssurancePolicyIds: [...(s.requiredAssurancePolicyIds ?? [])],
					...(s.completionRule ? { completionRule: s.completionRule } : {})
				})
			);
		}
		return { commands };
	}

	// ---- internals ---------------------------------------------------------------------------------

	/** Friendly pre-check: the PWA must exist and be DRAFT. The engine enforces this too — this just gives the
	 *  agent a clean message instead of a wasted rejected command. */
	private requireDraft(): ProposalResult | null {
		const pwa = this.getPwa();
		if (!pwa) return { ok: false, error: `PWA ${this.pwaId} does not exist.` };
		if (pwa.publicationStatus !== 'DRAFT')
			return {
				ok: false,
				error: `PWA ${this.pwaId} is ${pwa.publicationStatus}, not DRAFT — authoring is closed (a PUBLISHED version is immutable).`
			};
		return null;
	}

	/** Validate a patch's assurance-policy references against the existing declarations, when the patch touches them. */
	private validatePolicyPatch(patch: EditTypeInput, existing: PwuTypeView): ProposalResult | null {
		if (patch.requiredAssurancePolicyIds === undefined) return null;
		return this.validatePolicyReferences(
			patch.requiredAssurancePolicyIds,
			existing.requiredAssurancePolicyIds
		);
	}

	/** Only ACTIVE, non-floor policies may be newly declared. Existing declarations may be retained or removed after
	 *  the policy changes status, so an unrelated edit never erases historical intent. */
	private validatePolicyReferences(
		requestedPolicyIds: readonly string[],
		existingPolicyIds: readonly string[] = []
	): ProposalResult | null {
		const existing = new Set(existingPolicyIds);
		const policies = new Map(this.listPolicies().map((policy) => [policy.id, policy]));
		for (const policyId of requestedPolicyIds) {
			if (existing.has(policyId)) continue;
			if (FLOOR_POLICY_IDS.has(policyId)) {
				return {
					ok: false,
					error: `The locked floor policy ${policyId} always applies and must not be referenced explicitly.`
				};
			}
			const policy = policies.get(policyId);
			if (!policy) return { ok: false, error: `Assurance Policy ${policyId} does not exist.` };
			if (policy.status !== 'ACTIVE') {
				return {
					ok: false,
					error: `Assurance Policy ${policy.name} is ${policy.status}; only ACTIVE policies may be newly referenced.`
				};
			}
		}
		return null;
	}

	private cmd(
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): DomainCommand {
		this.seq += 1;
		return {
			commandId: `${this.sessionId}-${this.seq}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: this.now(),
			issuedBy: this.actor,
			correlationId: this.sessionId,
			idempotencyKey: `${this.sessionId}-idem-${this.seq}`,
			payload
		};
	}

	private one(
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): ProposalResult {
		const r = this.dispatch(this.cmd(commandType, targetAggregateType, targetAggregateId, payload));
		return accepted(r) ? { ok: true, id: targetAggregateId, status: r.status } : rejected(r);
	}

	private dispatch(command: DomainCommand): CommandResult {
		return this.engine.dispatch(command);
	}
}

function accepted(r: CommandResult): boolean {
	return r.status === 'ACCEPTED' || r.status === 'DUPLICATE';
}

function rejected(r: CommandResult): ProposalResult {
	return { ok: false, status: r.status, error: r.error?.message ?? r.status };
}
