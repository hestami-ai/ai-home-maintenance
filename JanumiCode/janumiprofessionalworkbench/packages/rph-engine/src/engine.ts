// createEngine — the RPH composition facade (tracker §4: "the single public seam"). It formalizes the wiring the
// M4 walking-skeleton test does by hand: a StorageAdapter (better-sqlite3 by default, :memory: for tests), the
// application command bus (Engine.dispatch pipeline), the outbox drain, and a loaded PWA ontology. The engine is
// PWA-AGNOSTIC mechanism: the Product Realization PWA (or any PWA) is loaded as versioned DATA and INJECTED by
// the composition root — the engine does not import or default to any specific PWA. Downstream surfaces consume
// ONLY this seam; they never reach into the individual packages.
import {
	Engine,
	type EventSubscriber,
	type AuthedEngine
} from '@janumipwb/rph-application';
import type {
	AssessmentCriterion,
	EvidenceRequirement,
	DomainEvent,
	Frozen
} from '@janumipwb/rph-contracts';
import { SnapshotOverlayStorageAdapter, SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type {
	AuthenticationPort,
	Credential,
	Logger,
	StorageAdapter,
	StoredObject
} from '@janumipwb/rph-ports';

/** A structural issue found while validating a loaded PWA ontology (mirrors the PWA package's OntologyIssue). */
export interface OntologyIssue {
	readonly kind: string;
	readonly detail: string;
}

/**
 * The generic shape the engine needs from a loaded PWA ontology. It is intentionally minimal and structural — the
 * engine depends on this contract, NOT on any concrete PWA package — so any PWA's versioned ontology data
 * satisfies it. (The concrete Product Realization PWA ontology is a superset of this.)
 */
/**
 * ONE of a loaded PWA ontology's seed policies — everything needed to stand it up as a real ASSURANCE_POLICY
 * object, and nothing else. Structural, so any PWA's dataset satisfies it without importing this package.
 *
 * This was `readonly unknown[]`: the port declared that seed policies EXIST and NOTHING about what they are. That
 * is not a small omission — it is why `seedAdditivePolicies` kept a hand-maintained second copy of the DOC-004
 * catalog instead of reading the one the ontology already held. Nothing could have read this port usefully, so
 * nothing did, and the two copies drifted for as long as both existed (see SeedPolicy in the PWA package for what
 * that cost). An `unknown` in a port is not a deferral; it is a fork.
 */
export interface EngineSeedPolicy {
	readonly policyId: string;
	readonly name: string;
	readonly purpose: string;
	readonly rationale: string;
	readonly evaluatedClaimTypes: readonly string[];
	/** DOC-004 §5.1 `pwuKindConditions` — which PWU kinds the policy applies to. ADDED 2026-08-05: it was ABSENT
	 *  from this port type, so the ontology's authored value was structurally invisible past the package boundary
	 *  and no type error was ever available to report the drop (REG-F-022 second instance). Optional because a
	 *  policy that restricts no kind declares none. */
	readonly appliesToPwuKinds?: readonly string[];
	/** DOC-004 §6.1 evidence requirements (REG-E-026). ADDED 2026-08-05, and the reason it had to be: this port
	 *  did not declare the ontology's evidence field either, so the seeding could not have read it even by
	 *  accident and no type error was ever available — the same structural blindness that hid
	 *  `appliesToPwuKinds`, on the field REG-F-022 is actually about. Two evidence fields because DOC-004 §3.1
	 *  declares two, and the catalog's own headings select between them. */
	readonly requiredEvidence: readonly Frozen<EvidenceRequirement>[];
	readonly optionalEvidence: readonly Frozen<EvidenceRequirement>[];
	readonly criteria: readonly Frozen<AssessmentCriterion>[];
	/** RATIFIED finding codes. The per-code detail DOC-004 §9.1 mandates but never ratifies is optional. */
	readonly findingTypes: readonly string[];
	readonly findingAnnotations?: Readonly<
		Record<string, { readonly defaultSeverity: string; readonly description: string }>
	>;
	readonly evaluatorRole: string;
	readonly independenceRequirement: string;
	readonly failureSeverity: string;
	readonly permittedControlActions: readonly string[];
}

export interface EngineOntology {
	readonly version: string;
	readonly pwuTemplates: readonly { readonly pwuKind: string; readonly isRoot?: boolean }[];
	readonly seedPolicies: readonly EngineSeedPolicy[];
	readonly conformanceProfiles: readonly unknown[];
}

export interface CreateEngineDeps {
	/** REQUIRED — the loaded PWA ontology (versioned data). The composition root injects it; the engine defaults
	 *  to no PWA (it is PWA-agnostic mechanism). */
	readonly ontology: EngineOntology;
	/** Optional PWA-specific ontology validator (OVR). If supplied, the engine runs it and fails loud on any
	 *  returned issue — the composition root passes a validator already filtered to FATAL issues. */
	readonly validateOntology?: () => OntologyIssue[];
	/** The storage adapter (event log + objects + outbox + receipts). Defaults to an in-memory SqliteStorageAdapter. */
	readonly store?: StorageAdapter;
	/**
	 * THE TRUST BOUNDARY (REG-D-027). Required — see `EngineDeps.authenticate`: an optional port turns "no
	 * gate" from a compile error into a runtime condition.
	 */
	readonly authenticate: AuthenticationPort;
	/** Deterministic clock for tests (ISO timestamp). */
	readonly now?: () => string;
	/** Deterministic event-id minter for tests. */
	readonly newEventId?: () => string;
	readonly logger?: Logger;
}

/** The public engine seam. Everything a host needs: dispatch commands, observe events, drain the outbox to
 *  projections, query current objects / the event log, and read the loaded ontology. */
/** An `EngineHandle` that has been given a credential: everything the handle does, plus dispatch. */
export interface AuthedEngineHandle extends EngineHandle, AuthedEngine {
	/** A fork of an authenticated handle stays bound to the same principal — see the note at `as`. */
	fork(): AuthedEngineHandle;
}

export interface EngineHandle {
	/**
	 * Present a credential and obtain the ONLY object that can dispatch (REG-D-028).
	 *
	 * ⚠ `dispatch`, `dispatchBatch` and `dispatchBatchGuarded` USED TO LIVE HERE. Moving them behind a
	 * credential is what makes every unmigrated call site a COMPILE ERROR rather than a silent last-write-wins
	 * path — the property PER-3's SCOPE clause asks for, enforced by the type checker instead of by review.
	 */
	as(credential: Credential): AuthedEngineHandle;
	subscribe(handler: EventSubscriber): void;
	drainOutbox(): number;
	/** WP-2-007 restart recovery: re-drive PENDING outbox on (re)open of a durable store, idempotently (an
	 *  already-PUBLISHED message is never re-delivered). A durable host SHALL call this at startup. Returns count. */
	recoverOutbox(): number;
	/** Read the current materialized state of an object by id (undefined if absent). */
	loadObject(id: string): StoredObject | undefined;
	/** The full append-only event log (for rebuildable projections / replay-equivalence checks). */
	readAllEvents(): DomainEvent[];
	/**
	 * Create a point-in-time, isolated engine fork. Commands exercise the same handlers and invariants but write only
	 * to an overlay; closing or abandoning the fork cannot mutate this engine's canonical state.
	 */
	fork(): EngineHandle;
	readonly ontology: EngineOntology;
	/** Release the underlying storage (closes the sqlite connection). */
	close(): void;
}

/**
 * Compose an RPH engine over an INJECTED PWA ontology. With only `{ ontology }` this stands up a fully in-memory
 * engine (in-memory sqlite + the injected PWA) — the one-liner a test or a host uses after choosing which PWA to
 * load. The ontology is validated on construction (fail-loud): a generic structural gate (exactly one root PWU
 * Type) always runs, plus any PWA-specific `validateOntology` the caller injects.
 */
export function createEngine(deps: CreateEngineDeps): EngineHandle {
	const { ontology } = deps;

	// Generic structural gate (always on): a loadable PWA ontology must declare exactly one root PWU Type.
	const roots = ontology.pwuTemplates.filter((t) => t.isRoot);
	if (roots.length !== 1)
		throw new Error(
			`createEngine: ontology must declare exactly one root PWU Type, found ${roots.length}`
		);

	// PWA-specific OVR (if the composition root supplied it): fail loud on any fatal issue it reports.
	const ontologyIssues = deps.validateOntology?.() ?? [];
	if (ontologyIssues.length > 0) {
		const detail = ontologyIssues.map((i) => `${i.kind}:${i.detail}`).join('; ');
		throw new Error(`createEngine: malformed ontology — ${detail}`);
	}

	const store = deps.store ?? new SqliteStorageAdapter({ now: deps.now });
	// ⚠ AN EXPLICIT FIELD ENUMERATION, AND IT IS A TRAP THIS INCREMENT WALKED INTO ONCE. `fork()` below
	// spreads `...deps`, so anything added to `CreateEngineDeps` reaches a FORK automatically and reaches THIS
	// object — the only one that becomes an actual `Engine` — not at all. A port added above and forgotten here
	// would leave the parent ungated while every fork looked correct.
	const engine = new Engine({
		store,
		authenticate: deps.authenticate,
		now: deps.now,
		newEventId: deps.newEventId,
		logger: deps.logger
	});

	const handle: EngineHandle = {
		// The authed view is the READ HANDLE PLUS DISPATCH, so presenting a credential upgrades the object a
		// caller already has rather than handing back a second, narrower one. Two references — one gated, one
		// not — is how an ungated engine stays in scope next to the gated one.
		as: (credential) => ({
			...handle,
			...engine.as(credential),
			// ⚠ A FORK INHERITS THE SESSION'S IDENTITY, and it must. The authoring turn forks canonical and
			// records commands into the fork; if the fork came back unauthenticated the turn could not dispatch
			// at all, and if it came back bound to someone else the recorded commands would carry the wrong
			// actor into the replay. Re-applying the same credential is the only reading that keeps a turn's
			// work attributable to the identity that did it.
			fork: () => handle.fork().as(credential)
		}),
		subscribe: (handler) => engine.subscribe(handler),
		drainOutbox: () => engine.drainOutbox(),
		recoverOutbox: () => engine.recoverOutbox(),
		loadObject: (id) => store.loadObject(id),
		readAllEvents: () => store.readAllEvents(),
		fork: () =>
			createEngine({
				...deps,
				store: new SnapshotOverlayStorageAdapter(store)
			}),
		ontology,
		close: () => store.close()
	};
	return handle;
}
