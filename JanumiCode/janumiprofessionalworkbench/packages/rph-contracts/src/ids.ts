// RphId — opaque, immutable, prefixed identifiers of the form `<prefix>_<ULID>` (docs §5; DOC-007 §5.1).
// Human-readable strings (e.g. "FSM-ARCH-001") are DISPLAY LABELS ONLY and are never ids.
import { ulid } from 'ulid';
import { z } from 'zod';

/**
 * The ratified id-prefix registry (docs §5). Covers the 17 Professional Work Object types plus the
 * id-bearing sub-objects/envelopes (execution step/attempt, trace link, command, event). Prefixes
 * `obl/art/dcp/rcp` were carried from the reference fixture and ratified (open item #8, best judgment).
 */
export const ID_PREFIXES = {
	INTENT: 'int',
	PROFESSIONAL_WORK_UNIT: 'pwu',
	OBLIGATION: 'obl',
	CONSTRAINT: 'con',
	ASSUMPTION: 'asm',
	CLAIM: 'clm',
	EVIDENCE: 'evd',
	ASSURANCE_POLICY: 'pol',
	ASSURANCE_ASSESSMENT: 'assess',
	ASSURANCE_OBSERVATION: 'obs',
	DECISION: 'dec',
	ARTIFACT: 'art',
	DECOMPOSITION_CONTRACT: 'dcp',
	RECOMPOSITION_CONTRACT: 'rcp',
	EXECUTION_PLAN: 'plan',
	EXECUTION_STEP: 'step',
	RUNTIME_BINDING: 'bind',
	BASELINE: 'base',
	TRACE_LINK: 'trace',
	COMMAND: 'cmd',
	EVENT: 'evt',
	EXECUTION_ATTEMPT: 'attempt',
	// JAN-SLICE-SWP-02a (REG-D-046 Ruling 2). `ids.test.ts` compares this map against the vocab's own
	// idPrefixRegistry, so this entry is not optional decoration — omitting it reddens that gate, which is what
	// caught the addition here rather than letting a half-registered object type through.
	DEFERRAL: 'dfr',
	// JAN-SLICE-SWP-05 — the W7 product-behavior plane. Same gate as DEFERRAL above: `ids.test.ts` compares
	// this map against the vocab's idPrefixRegistry, so a promoted object type that never lands here reddens
	// rather than shipping half-registered.
	ACTOR: 'actor',
	CAPABILITY: 'cap',
	USER_JOURNEY: 'jrny',
	SCENARIO: 'scen',
	REQUIREMENT: 'req',
	// MODEL_EXCHANGE — PER-9's durable exchange record, one per bounded model or agent try (REG-D-055).
	// ⚠ REGISTERED IN BOTH PLACES DELIBERATELY. §16 item 8's safe default is "extend the registry/schema/tests
	// before adding an object prefix", and `ids.test.ts` holds this map equal to `canonical-vocabulary.json`'s
	// `idPrefixRegistry`. `AUTHORING_CONVERSATION` is the counter-example to NOT copy: it carries
	// `idPrefixEntity: 'conv'` in the object vocab while appearing in neither registry.
	MODEL_EXCHANGE: 'mex'
} as const;

export type IdEntity = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[IdEntity];
export const KNOWN_ID_PREFIXES: ReadonlySet<string> = new Set(Object.values(ID_PREFIXES));

// ULID: 26 chars, Crockford base32 (0-9 A-Z excluding I, L, O, U).
const ULID_PATTERN = '[0-9A-HJKMNP-TV-Z]{26}';
export const RPH_ID_REGEX = new RegExp(`^([a-z]+)_(${ULID_PATTERN})$`);

/** Zod schema for an RphId (structural: `<lowercase-prefix>_<ULID>`). */
export const RphIdSchema = z.string().regex(RPH_ID_REGEX);
export type RphId = z.infer<typeof RphIdSchema>;

export function isRphId(value: unknown): value is RphId {
	return typeof value === 'string' && RPH_ID_REGEX.test(value);
}

/** Split an id into prefix + ULID, or null if malformed. */
export function parseRphId(value: string): { prefix: string; ulid: string } | null {
	const match = RPH_ID_REGEX.exec(value);
	if (!match) return null;
	return { prefix: match[1]!, ulid: match[2]! };
}

/**
 * Mint a new id for a registered entity. The ULID factory is injectable so the engine can route id
 * generation through its deterministic IdGenerator port (tests pass a fixed factory).
 */
export function mintId(entity: IdEntity, ulidFactory: () => string = ulid): RphId {
	return `${ID_PREFIXES[entity]}_${ulidFactory()}`;
}
