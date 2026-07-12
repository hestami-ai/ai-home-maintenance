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
	EXECUTION_ATTEMPT: 'attempt'
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
