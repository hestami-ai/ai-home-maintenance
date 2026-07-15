// The PWA-authoring CapabilityBroker — an LLM-agnostic layer of READ + PROPOSE operations over the rph-engine
// public seam, scoped to a single DRAFT PWA. It is the shared execute-surface that BOTH the node-graph UI actions
// and the Pi agent's tools call: the agent never touches SQL or events, it calls these methods, and every PROPOSE
// issues a real domain command (as an AGENT actor) so the engine's fail-loud validation IS the guardrail — a
// malformed or illegal proposal is REJECTED by the domain, not silently applied. Multi-step "generate a whole
// graph and wire it" is one atomic dispatchBatch (all-or-nothing) so a mid-sequence failure can't strand a
// half-built DRAFT. Governance: this broker only ever authors a DRAFT (define/edit/remove/link PWU Types, edit the
// PWA's own details); it deliberately does NOT expose the publication FSM — a human advances DRAFT -> ... ->
// PUBLISHED. That is the "agent proposes, human publishes" seam.
import type { CommandResult, DomainCommand } from '@janumipwb/rph-contracts';
import { getObject, listPwuTypes, type EngineHandle } from '@janumipwb/rph-engine';
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
	readonly requiredInputs: string[];
	readonly requiredOutputs: string[];
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
	readonly requiredInputs?: readonly string[];
	readonly requiredOutputs?: readonly string[];
}

/** A patch to an existing PWU Type — only the present fields change (mirrors the EditPwuType field-patch). */
export interface EditTypeInput {
	readonly name?: string;
	readonly pwuKind?: string;
	readonly purpose?: string;
	readonly isRoot?: boolean;
	readonly completionRule?: string;
	readonly permittedChildTypeIds?: readonly string[];
	readonly requiredInputs?: readonly string[];
	readonly requiredOutputs?: readonly string[];
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
	/** Temp keys of other specs in THIS batch that this type permits as children. */
	readonly childTempKeys?: readonly string[];
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
		requiredInputs: arr(s.requiredInputs),
		requiredOutputs: arr(s.requiredOutputs)
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

	/** Define a new PWU Type on this DRAFT PWA. Returns the minted id on success. */
	defineType(input: DefineTypeInput): ProposalResult {
		const guard = this.requireDraft();
		if (guard) return guard;
		if (!input.name?.trim() || !input.pwuKind?.trim())
			return { ok: false, error: 'A PWU Type name and kind are required.' };
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
		if (!this.getType(pwuTypeId))
			return { ok: false, error: `PWU Type ${pwuTypeId} does not exist on this PWA.` };
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
				...(patch.requiredInputs !== undefined
					? { requiredInputs: [...patch.requiredInputs] }
					: {}),
				...(patch.requiredOutputs !== undefined
					? { requiredOutputs: [...patch.requiredOutputs] }
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

	/** Add a "permits" (composition) edge parent -> child. Idempotent: a link that already exists succeeds no-op. */
	linkTypes(parentId: string, childId: string): ProposalResult {
		if (parentId === childId) return { ok: false, error: 'A PWU Type cannot permit itself.' };
		const parent = this.getType(parentId);
		if (!parent) return { ok: false, error: `Parent PWU Type ${parentId} does not exist.` };
		if (!this.getType(childId))
			return { ok: false, error: `Child PWU Type ${childId} does not exist.` };
		if (parent.permittedChildTypeIds.includes(childId))
			return { ok: true, id: parentId, status: 'DUPLICATE' };
		return this.editType(parentId, {
			permittedChildTypeIds: [...parent.permittedChildTypeIds, childId]
		});
	}

	/** Remove a "permits" edge parent -> child. Idempotent: absent edge succeeds no-op. */
	unlinkTypes(parentId: string, childId: string): ProposalResult {
		const parent = this.getType(parentId);
		if (!parent) return { ok: false, error: `Parent PWU Type ${parentId} does not exist.` };
		if (!parent.permittedChildTypeIds.includes(childId))
			return { ok: true, id: parentId, status: 'DUPLICATE' };
		return this.editType(parentId, {
			permittedChildTypeIds: parent.permittedChildTypeIds.filter((c) => c !== childId)
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

		// Mint real ids for every temp key first, so child references resolve within the batch.
		const idFor = new Map<string, string>();
		for (const s of specs) idFor.set(s.tempKey, this.mintId('pwut'));

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
			for (const ck of s.childTempKeys ?? []) {
				const cid = idFor.get(ck);
				if (!cid)
					return {
						error: { ok: false, error: `Type "${s.tempKey}" names unknown child "${ck}".` }
					};
				childIds.push(cid);
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
					requiredInputs: [...(s.requiredInputs ?? [])],
					requiredOutputs: [...(s.requiredOutputs ?? [])],
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
