// createEngine — the RPH composition facade (tracker §4: "the single public seam"). It formalizes the wiring the
// M4 walking-skeleton test does by hand: a StorageAdapter (better-sqlite3 by default, :memory: for tests), the
// application command bus (Engine.dispatch pipeline), the outbox drain, and a loaded PWA ontology. The engine is
// PWA-AGNOSTIC mechanism: the Product Realization PWA (or any PWA) is loaded as versioned DATA and INJECTED by
// the composition root — the engine does not import or default to any specific PWA. Downstream surfaces consume
// ONLY this seam; they never reach into the individual packages.
import { Engine, type EventSubscriber } from '@janumipwb/rph-application';
import type { CommandResult, DomainCommand, DomainEvent } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Logger, StorageAdapter, StoredObject } from '@janumipwb/rph-ports';

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
export interface EngineOntology {
	readonly version: string;
	readonly pwuTemplates: readonly { readonly pwuKind: string; readonly isRoot?: boolean }[];
	readonly seedPolicies: readonly unknown[];
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
	/** Deterministic clock for tests (ISO timestamp). */
	readonly now?: () => string;
	/** Deterministic event-id minter for tests. */
	readonly newEventId?: () => string;
	readonly logger?: Logger;
}

/** The public engine seam. Everything a host needs: dispatch commands, observe events, drain the outbox to
 *  projections, query current objects / the event log, and read the loaded ontology. */
export interface EngineHandle {
	dispatch(command: DomainCommand): CommandResult;
	subscribe(handler: EventSubscriber): void;
	drainOutbox(): number;
	/** Read the current materialized state of an object by id (undefined if absent). */
	loadObject(id: string): StoredObject | undefined;
	/** The full append-only event log (for rebuildable projections / replay-equivalence checks). */
	readAllEvents(): DomainEvent[];
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
	const engine = new Engine({
		store,
		now: deps.now,
		newEventId: deps.newEventId,
		logger: deps.logger
	});

	return {
		dispatch: (command) => engine.dispatch(command),
		subscribe: (handler) => engine.subscribe(handler),
		drainOutbox: () => engine.drainOutbox(),
		loadObject: (id) => store.loadObject(id),
		readAllEvents: () => store.readAllEvents(),
		ontology,
		close: () => store.close()
	};
}
