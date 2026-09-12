import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FrozenSubject } from '../../contracts/subject.js';
import { canonicalJson, compareText, sha256 } from '../../inventory/canonical.js';
import { verifyFrozenSubject } from '../../subject/freshness.js';

export const ENRICHED_PROVIDER_EVIDENCE_SCHEMA_VERSION =
	'jan-csaa-enriched-provider-evidence/1.0.0' as const;
export const ENRICHED_PROVIDER_ANALYSIS_AUTHORITY = 'NONE' as const;
export const ENRICHED_PROVIDER_GATE_EFFECT = 'NONE' as const;

export const ENRICHED_PROVIDER_LIMITS = Object.freeze({
	maxArrayItems: 100_000,
	maxCommandArguments: 256,
	maxDepth: 64,
	maxJsonBytes: 32 * 1024 * 1024,
	maxJsonNodes: 1_000_000,
	maxPathCharacters: 16_384,
	maxStringCharacters: 1024 * 1024
} as const);

const SHA256 = /^[a-f0-9]{64}$/u;
const TOKEN = /^[A-Za-z0-9][-A-Za-z0-9._:@/+]{0,255}$/u;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const SENSITIVE_ARGUMENT =
	/(authorization|bearer|cookie|credential|password|secret|token|api[-_]?key)/iu;

export type ProviderEvidenceAvailability = 'ABSENT' | 'PRESENT';
export type ProviderEvidenceHealth =
	'HEALTHY' | 'PARTIAL' | 'FAILED' | 'CRASHED' | 'TIMED_OUT' | 'MALFORMED';
export type ProviderEvidenceFreshness = 'CURRENT' | 'STALE' | 'UNKNOWN';
export type ProviderEvidenceCoverage = 'COMPLETE' | 'PARTIAL' | 'NONE';

export interface ProviderIdentityInput {
	readonly configurationSha256: string;
	readonly dependencyClosureSha256: string;
	readonly executableSha256: string;
	readonly id: string;
	readonly version: string;
}

export type ProviderTermination =
	| { readonly exitCode: number; readonly kind: 'EXITED' }
	| { readonly kind: 'CRASHED'; readonly signal: string | null }
	| { readonly budgetMs: number; readonly kind: 'TIMED_OUT' };

export interface ProviderRunInput {
	readonly command: readonly string[];
	readonly endedAt: string;
	readonly environmentSha256: string;
	readonly outputComplete: boolean;
	readonly profile: string;
	readonly provider: ProviderIdentityInput;
	readonly runId: string;
	readonly startedAt: string;
	readonly subjectId: string;
	readonly subjectManifestSha256: string;
	readonly termination: ProviderTermination;
}

export interface ProviderImportContext {
	readonly assessedAt: string;
	readonly freshnessWindowMs: number;
	readonly repositoryRoot: string;
	readonly run: ProviderRunInput;
	readonly subject: FrozenSubject;
}

export interface ProviderEvidenceDiagnostic {
	readonly code: string;
	readonly message: string;
}

export interface ProviderEvidenceConflict {
	readonly code:
		'PROVIDER_IDENTITY_MISMATCH' | 'PROVIDER_VERSION_UNSUPPORTED' | 'SUBJECT_IDENTITY_MISMATCH';
	readonly expectedSha256: string;
	readonly observedSha256: string;
}

export interface NormalizedProviderRun {
	readonly command: readonly string[];
	readonly commandSha256: string;
	readonly endedAt: string;
	readonly environmentSha256: string;
	readonly outputComplete: boolean;
	readonly profile: string;
	readonly runId: string;
	readonly startedAt: string;
	readonly subjectId: string;
	readonly subjectManifestSha256: string;
	readonly termination: ProviderTermination;
}

export interface ProviderEvidenceResult<Observation> {
	readonly adapter: {
		readonly id: string;
		readonly version: string;
	};
	readonly analysisAuthority: typeof ENRICHED_PROVIDER_ANALYSIS_AUTHORITY;
	readonly availability: ProviderEvidenceAvailability;
	readonly conflicts: readonly ProviderEvidenceConflict[];
	readonly coverage: {
		readonly completedRegions: readonly string[];
		readonly missingRegions: readonly string[];
		readonly state: ProviderEvidenceCoverage;
	};
	readonly diagnostics: readonly ProviderEvidenceDiagnostic[];
	readonly freshness: {
		readonly assessedAt: string;
		readonly basis: string;
		readonly state: ProviderEvidenceFreshness;
	};
	readonly gateEffect: typeof ENRICHED_PROVIDER_GATE_EFFECT;
	readonly health: ProviderEvidenceHealth;
	readonly observations: readonly Observation[];
	readonly provider: ProviderIdentityInput;
	readonly rawArtifact: { readonly bytes: number; readonly sha256: string } | null;
	readonly redactions: readonly string[];
	readonly run: NormalizedProviderRun;
	readonly schemaVersion: typeof ENRICHED_PROVIDER_EVIDENCE_SCHEMA_VERSION;
	readonly subject: {
		readonly fileManifestSha256: string;
		readonly id: string;
	};
	readonly usableForCurrentSubject: boolean;
}

export interface ProviderNormalization<Observation> {
	readonly completedRegions: readonly string[];
	readonly missingRegions: readonly string[];
	readonly observations: readonly Observation[];
	readonly redactions?: readonly string[];
}

export class ProviderEvidenceInputError extends Error {
	constructor(
		readonly code: string,
		message: string
	) {
		super(message);
		this.name = 'ProviderEvidenceInputError';
	}
}

function fail(code: string, message: string): never {
	throw new ProviderEvidenceInputError(code, message);
}

export function isSha256(value: unknown): value is string {
	return typeof value === 'string' && SHA256.test(value);
}

export function scalarString(value: unknown, label: string, max = 16_384): string {
	if (typeof value !== 'string' || value.length === 0 || value.length > max)
		fail('STRING_INVALID', `${label} must be one nonempty bounded string.`);
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code <= 0x1f || code === 0x7f)
			fail('STRING_INVALID', `${label} contains a control character.`);
		if (code >= 0xd800 && code <= 0xdbff) {
			const next = value.charCodeAt(index + 1);
			if (!(next >= 0xdc00 && next <= 0xdfff))
				fail('STRING_INVALID', `${label} contains an unpaired surrogate.`);
			index += 1;
		} else if (code >= 0xdc00 && code <= 0xdfff)
			fail('STRING_INVALID', `${label} contains an unpaired surrogate.`);
	}
	return value;
}

export function safeInteger(value: unknown, label: string, minimum = 0): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum)
		fail('INTEGER_INVALID', `${label} must be a safe integer greater than or equal to ${minimum}.`);
	return value;
}

export function exactRecord(
	value: unknown,
	keys: readonly string[],
	label: string
): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		fail('SHAPE_INVALID', `${label} must be one object.`);
	const actual = Object.keys(value);
	if (
		actual.length !== keys.length ||
		actual.some((key) => !keys.includes(key)) ||
		keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
	)
		fail('SHAPE_INVALID', `${label} has an unsupported shape.`);
	return value as Readonly<Record<string, unknown>>;
}

export function optionalRecord(
	value: unknown,
	required: readonly string[],
	optional: readonly string[],
	label: string
): Readonly<Record<string, unknown>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		fail('SHAPE_INVALID', `${label} must be one object.`);
	const keys = Object.keys(value);
	if (
		keys.some((key) => !required.includes(key) && !optional.includes(key)) ||
		required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
	)
		fail('SHAPE_INVALID', `${label} has an unsupported shape.`);
	return value as Readonly<Record<string, unknown>>;
}

export function denseArray(value: unknown, label: string, maxItems = 100_000): readonly unknown[] {
	if (!Array.isArray(value) || value.length > maxItems)
		fail('ARRAY_INVALID', `${label} must be one bounded array.`);
	for (let index = 0; index < value.length; index += 1)
		if (!Object.prototype.hasOwnProperty.call(value, index))
			fail('ARRAY_INVALID', `${label} must not be sparse.`);
	return value;
}

function decodeJsonString(
	text: string,
	start: number
): { readonly next: number; readonly value: string } {
	let index = start + 1;
	for (; index < text.length; index += 1) {
		const character = text[index]!;
		if (character === '"') {
			const token = text.slice(start, index + 1);
			let value: unknown;
			try {
				value = JSON.parse(token);
			} catch {
				fail('JSON_INVALID', 'Provider output contains an invalid JSON string.');
			}
			if (typeof value !== 'string' || value.length > ENRICHED_PROVIDER_LIMITS.maxStringCharacters)
				fail('JSON_BUDGET_EXCEEDED', 'Provider output contains an oversized JSON string.');
			return { next: index + 1, value };
		}
		if (character === '\\') index += 1;
		else if (character.charCodeAt(0) <= 0x1f)
			fail('JSON_INVALID', 'Provider output contains an invalid JSON control character.');
	}
	fail('JSON_INVALID', 'Provider output contains an unterminated JSON string.');
}

function assertExactJsonGrammar(text: string): void {
	let index = 0;
	let nodes = 0;
	const whitespace = (): void => {
		while (index < text.length) {
			const code = text.charCodeAt(index);
			if (code !== 9 && code !== 10 && code !== 13 && code !== 32) break;
			index += 1;
		}
	};
	const value = (depth: number): void => {
		if (depth > ENRICHED_PROVIDER_LIMITS.maxDepth)
			fail('JSON_BUDGET_EXCEEDED', 'Provider output exceeds the JSON depth limit.');
		nodes += 1;
		if (nodes > ENRICHED_PROVIDER_LIMITS.maxJsonNodes)
			fail('JSON_BUDGET_EXCEEDED', 'Provider output exceeds the JSON node limit.');
		whitespace();
		const character = text[index];
		if (character === '"') {
			index = decodeJsonString(text, index).next;
			return;
		}
		if (character === '[') {
			index += 1;
			whitespace();
			if (text[index] === ']') {
				index += 1;
				return;
			}
			let count = 0;
			for (;;) {
				count += 1;
				if (count > ENRICHED_PROVIDER_LIMITS.maxArrayItems)
					fail('JSON_BUDGET_EXCEEDED', 'Provider output exceeds the JSON array limit.');
				value(depth + 1);
				whitespace();
				if (text[index] === ']') {
					index += 1;
					return;
				}
				if (text[index] !== ',')
					fail('JSON_INVALID', 'Provider output has invalid JSON array syntax.');
				index += 1;
			}
		}
		if (character === '{') {
			index += 1;
			whitespace();
			if (text[index] === '}') {
				index += 1;
				return;
			}
			const keys = new Set<string>();
			for (;;) {
				whitespace();
				if (text[index] !== '"') fail('JSON_INVALID', 'Provider output has a non-string JSON key.');
				const decoded = decodeJsonString(text, index);
				index = decoded.next;
				if (keys.has(decoded.value))
					fail('JSON_DUPLICATE_KEY', 'Provider output has a duplicate JSON key.');
				keys.add(decoded.value);
				whitespace();
				if (text[index] !== ':')
					fail('JSON_INVALID', 'Provider output has invalid JSON object syntax.');
				index += 1;
				value(depth + 1);
				whitespace();
				if (text[index] === '}') {
					index += 1;
					return;
				}
				if (text[index] !== ',')
					fail('JSON_INVALID', 'Provider output has invalid JSON object syntax.');
				index += 1;
			}
		}
		const tail = text.slice(index);
		const match = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/u.exec(tail);
		if (match === null) fail('JSON_INVALID', 'Provider output contains an invalid JSON value.');
		index += match[0].length;
	};
	value(0);
	whitespace();
	if (index !== text.length) fail('JSON_INVALID', 'Provider output has trailing non-JSON content.');
}

export function parseBoundedProviderJson(input: string | Uint8Array): unknown {
	const bytes = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
	if (typeof input === 'string' && bytes.toString('utf8') !== input)
		fail('JSON_ENCODING_INVALID', 'Provider output string contains invalid Unicode scalar data.');
	if (bytes.byteLength > ENRICHED_PROVIDER_LIMITS.maxJsonBytes)
		fail('JSON_BUDGET_EXCEEDED', 'Provider output exceeds the byte limit.');
	let text: string;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		fail('JSON_ENCODING_INVALID', 'Provider output is not valid UTF-8.');
	}
	assertExactJsonGrammar(text);
	try {
		const parsed: unknown = JSON.parse(text);
		const values: unknown[] = [parsed];
		while (values.length > 0) {
			const current = values.pop();
			if (typeof current === 'number' && !Number.isFinite(current))
				fail('JSON_NUMBER_INVALID', 'Provider output contains a non-finite decoded number.');
			if (Array.isArray(current)) {
				for (const child of current) values.push(child);
			} else if (current !== null && typeof current === 'object')
				for (const child of Object.values(current)) values.push(child);
		}
		return parsed;
	} catch (error) {
		if (error instanceof ProviderEvidenceInputError) throw error;
		fail('JSON_INVALID', 'Provider output is not valid JSON.');
	}
}

function inside(root: string, path: string): boolean {
	const rel = relative(root, path);
	return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

export function providerArtifactPath(value: unknown, repositoryRoot: string): string {
	let candidate = scalarString(
		value,
		'Provider artifact path',
		ENRICHED_PROVIDER_LIMITS.maxPathCharacters
	);
	if (candidate.startsWith('file:')) {
		try {
			candidate = fileURLToPath(candidate);
		} catch {
			fail('PATH_INVALID', 'Provider artifact path is an invalid file URL.');
		}
	}
	const root = resolve(repositoryRoot);
	const absolute = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate);
	if (!inside(root, absolute))
		fail('PATH_ESCAPE', 'Provider artifact path escapes the repository.');
	const rootStatus = lstatSync(root);
	if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink())
		fail('PATH_ESCAPE', 'Provider repository root is not a physical directory.');
	const physicalRoot = realpathSync(root);
	let current = root;
	const relativeSegments = relative(root, absolute).split(sep).filter(Boolean);
	for (let index = 0; index < relativeSegments.length; index += 1) {
		current = resolve(current, relativeSegments[index]!);
		if (!existsSync(current)) break;
		const status = lstatSync(current);
		if (status.isSymbolicLink())
			fail('PATH_ESCAPE', 'Provider artifact path contains a symbolic-link segment.');
		if (index < relativeSegments.length - 1 && !status.isDirectory())
			fail('PATH_INVALID', 'Provider artifact path contains a non-directory parent.');
		if (!inside(physicalRoot, realpathSync(current)))
			fail('PATH_ESCAPE', 'Provider artifact path escapes the physical repository.');
	}
	const logical = relative(root, absolute).replaceAll('\\', '/');
	if (
		logical.length === 0 ||
		logical.length > ENRICHED_PROVIDER_LIMITS.maxPathCharacters ||
		logical.startsWith('/') ||
		logical
			.split('/')
			.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
	)
		fail('PATH_INVALID', 'Provider artifact path is not canonical and repository-relative.');
	return logical;
}

function timestamp(value: string, label: string): number {
	if (!UTC_TIMESTAMP.test(value))
		throw new TypeError(`${label} must be one UTC ISO-8601 timestamp.`);
	const milliseconds = Date.parse(value);
	if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} is not a valid timestamp.`);
	const canonical = new Date(milliseconds).toISOString();
	if (value !== canonical && value !== canonical.replace('.000Z', 'Z'))
		throw new TypeError(`${label} is not a canonical UTC timestamp.`);
	return milliseconds;
}

function token(value: string, label: string): string {
	if (!TOKEN.test(value)) throw new TypeError(`${label} must be one bounded identity token.`);
	return value;
}

function digest(value: string, label: string): string {
	if (!SHA256.test(value)) throw new TypeError(`${label} must be one lowercase SHA-256 digest.`);
	return value;
}

function redactCommand(command: readonly string[], repositoryRoot: string): readonly string[] {
	if (command.length === 0 || command.length > ENRICHED_PROVIDER_LIMITS.maxCommandArguments)
		throw new TypeError('Provider command must contain a bounded nonempty argument vector.');
	let redactNext = false;
	return Object.freeze(
		command.map((argument, index) => {
			const value = scalarString(argument, `Provider command argument ${index}`, 2_048);
			const sensitive = redactNext || SENSITIVE_ARGUMENT.test(value);
			redactNext =
				/^(?:--)?(?:authorization|cookie|credential|password|secret|token|api[-_]?key)$/iu.test(
					value
				);
			if (sensitive) return '<redacted>';
			const normalizedRoot = resolve(repositoryRoot).replaceAll('\\', '/');
			return value.replaceAll('\\', '/').replaceAll(normalizedRoot, '<repository>');
		})
	);
}

function normalizeContext(context: ProviderImportContext): {
	readonly conflicts: readonly ProviderEvidenceConflict[];
	readonly freshness: ProviderEvidenceFreshness;
	readonly freshnessBasis: string;
	readonly provider: ProviderIdentityInput;
	readonly run: NormalizedProviderRun;
} {
	if (!Number.isSafeInteger(context.freshnessWindowMs) || context.freshnessWindowMs < 0)
		throw new TypeError('Provider freshnessWindowMs must be a nonnegative safe integer.');
	if (typeof context.run.outputComplete !== 'boolean')
		throw new TypeError('Provider outputComplete must be boolean.');
	const startedAtMs = timestamp(context.run.startedAt, 'Provider run startedAt');
	const endedAtMs = timestamp(context.run.endedAt, 'Provider run endedAt');
	const assessedAtMs = timestamp(context.assessedAt, 'Provider evidence assessedAt');
	if (endedAtMs < startedAtMs || assessedAtMs < endedAtMs)
		throw new TypeError('Provider run timestamps are not monotonically ordered.');
	const provider = Object.freeze({
		configurationSha256: digest(context.run.provider.configurationSha256, 'Provider configuration'),
		dependencyClosureSha256: digest(
			context.run.provider.dependencyClosureSha256,
			'Provider dependency closure'
		),
		executableSha256: digest(context.run.provider.executableSha256, 'Provider executable'),
		id: token(context.run.provider.id, 'Provider id'),
		version: token(context.run.provider.version, 'Provider version')
	});
	const redactedCommand = redactCommand(context.run.command, context.repositoryRoot);
	const run: NormalizedProviderRun = Object.freeze({
		command: redactedCommand,
		commandSha256: sha256(canonicalJson(context.run.command)),
		endedAt: context.run.endedAt,
		environmentSha256: digest(context.run.environmentSha256, 'Provider environment'),
		outputComplete: context.run.outputComplete,
		profile: token(context.run.profile, 'Provider profile'),
		runId: token(context.run.runId, 'Provider run id'),
		startedAt: context.run.startedAt,
		subjectId: token(context.run.subjectId, 'Provider subject id'),
		subjectManifestSha256: digest(context.run.subjectManifestSha256, 'Provider subject manifest'),
		termination: Object.freeze({ ...context.run.termination }) as ProviderTermination
	});
	if (context.run.termination.kind === 'EXITED') {
		if (!Number.isSafeInteger(context.run.termination.exitCode))
			throw new TypeError('Provider exitCode must be a safe integer.');
	} else if (context.run.termination.kind === 'CRASHED') {
		if (context.run.termination.signal !== null && !TOKEN.test(context.run.termination.signal))
			throw new TypeError('Provider crash signal must be null or a bounded token.');
	} else if (
		!Number.isSafeInteger(context.run.termination.budgetMs) ||
		context.run.termination.budgetMs < 1
	)
		throw new TypeError('Provider timeout budget must be a positive safe integer.');
	const expectedId = context.subject.descriptor.subjectId;
	const expectedManifest = context.subject.descriptor.fileManifestDigest;
	const conflicts: ProviderEvidenceConflict[] = [];
	if (context.run.subjectId !== expectedId)
		conflicts.push({
			code: 'SUBJECT_IDENTITY_MISMATCH',
			expectedSha256: sha256(expectedId),
			observedSha256: sha256(context.run.subjectId)
		});
	if (context.run.subjectManifestSha256 !== expectedManifest)
		conflicts.push({
			code: 'SUBJECT_IDENTITY_MISMATCH',
			expectedSha256: expectedManifest,
			observedSha256: context.run.subjectManifestSha256
		});
	const verification = verifyFrozenSubject(context.subject, {
		rootLocator: context.repositoryRoot
	});
	let freshness: ProviderEvidenceFreshness;
	let freshnessBasis: string;
	if (conflicts.length > 0) {
		freshness = 'UNKNOWN';
		freshnessBasis = 'Provider run subject identity conflicts with the selected FrozenSubject.';
	} else if (verification.state !== 'CURRENT') {
		freshness = verification.state === 'STALE' ? 'STALE' : 'UNKNOWN';
		freshnessBasis = 'Selected FrozenSubject did not pass a current live-byte verification.';
	} else if (assessedAtMs - endedAtMs > context.freshnessWindowMs) {
		freshness = 'STALE';
		freshnessBasis = 'Provider run is older than the caller-declared freshness window.';
	} else {
		freshness = 'CURRENT';
		freshnessBasis = 'Provider run identity and age match the live-current FrozenSubject.';
	}
	return { conflicts, freshness, freshnessBasis, provider, run };
}

function terminalHealth(run: ProviderRunInput): ProviderEvidenceHealth | null {
	if (run.termination.kind === 'CRASHED') return 'CRASHED';
	if (run.termination.kind === 'TIMED_OUT') return 'TIMED_OUT';
	if (run.termination.exitCode !== 0) return 'FAILED';
	return null;
}

export function importProviderJson<Observation>(options: {
	readonly adapterId: string;
	readonly adapterVersion: string;
	readonly context: ProviderImportContext;
	readonly expectedProviderId: string;
	readonly supportedProviderVersions: readonly string[];
	readonly raw: string | Uint8Array | null;
	readonly normalize: (
		value: unknown,
		context: ProviderImportContext
	) => ProviderNormalization<Observation>;
}): ProviderEvidenceResult<Observation> {
	const normalized = normalizeContext(options.context);
	const conflicts = [...normalized.conflicts];
	if (normalized.provider.id !== options.expectedProviderId)
		conflicts.push({
			code: 'PROVIDER_IDENTITY_MISMATCH',
			expectedSha256: sha256(options.expectedProviderId),
			observedSha256: sha256(normalized.provider.id)
		});
	if (!options.supportedProviderVersions.includes(normalized.provider.version))
		conflicts.push({
			code: 'PROVIDER_VERSION_UNSUPPORTED',
			expectedSha256: sha256(canonicalJson(options.supportedProviderVersions)),
			observedSha256: sha256(normalized.provider.version)
		});
	const rawBytes =
		options.raw === null
			? null
			: typeof options.raw === 'string'
				? Buffer.from(options.raw, 'utf8')
				: Buffer.from(options.raw);
	const rawWithinLimit =
		rawBytes === null || rawBytes.byteLength <= ENRICHED_PROVIDER_LIMITS.maxJsonBytes;
	const rawEncodingValid =
		typeof options.raw !== 'string' || rawBytes?.toString('utf8') === options.raw;
	let observations: readonly Observation[] = [];
	let completedRegions: readonly string[] = [];
	let missingRegions: readonly string[] = [];
	let redactions: readonly string[] = [];
	let health: ProviderEvidenceHealth;
	const diagnostics: ProviderEvidenceDiagnostic[] = [];
	const terminal = terminalHealth(options.context.run);
	if (!rawEncodingValid) {
		health = 'MALFORMED';
		diagnostics.push({
			code: 'JSON_ENCODING_INVALID',
			message: 'Provider output string contains invalid Unicode scalar data.'
		});
	} else if (!rawWithinLimit) {
		health = 'MALFORMED';
		diagnostics.push({
			code: 'JSON_BUDGET_EXCEEDED',
			message: 'Provider output exceeds the byte limit and was not retained or normalized.'
		});
	} else if (options.raw === null) {
		health = terminal ?? 'FAILED';
		diagnostics.push({
			code: 'PROVIDER_OUTPUT_ABSENT',
			message: 'Provider output was not supplied; no empty-success inference was made.'
		});
	} else if (terminal !== null) {
		health = terminal;
		diagnostics.push({
			code: `PROVIDER_${terminal}`,
			message:
				'Provider termination was not healthy; supplied bytes were retained by digest but not normalized.'
		});
	} else {
		try {
			const result = options.normalize(parseBoundedProviderJson(rawBytes!), options.context);
			observations = Object.freeze([...result.observations]);
			completedRegions = Object.freeze([...result.completedRegions].sort(compareText));
			missingRegions = Object.freeze([...result.missingRegions].sort(compareText));
			redactions = Object.freeze([...(result.redactions ?? [])].sort(compareText));
			health =
				options.context.run.outputComplete && missingRegions.length === 0 ? 'HEALTHY' : 'PARTIAL';
		} catch (error) {
			health = 'MALFORMED';
			const code =
				error instanceof ProviderEvidenceInputError ? error.code : 'NORMALIZATION_FAILED';
			diagnostics.push({
				code,
				message: 'Provider output was refused at the hostile normalization boundary.'
			});
		}
	}
	const coverageState: ProviderEvidenceCoverage =
		health === 'HEALTHY' ? 'COMPLETE' : health === 'PARTIAL' ? 'PARTIAL' : 'NONE';
	let finalFreshness = normalized.freshness;
	let finalFreshnessBasis = normalized.freshnessBasis;
	if (finalFreshness === 'CURRENT') {
		const finalVerification = verifyFrozenSubject(options.context.subject, {
			rootLocator: options.context.repositoryRoot
		});
		if (finalVerification.state !== 'CURRENT') {
			finalFreshness = finalVerification.state === 'STALE' ? 'STALE' : 'UNKNOWN';
			finalFreshnessBasis =
				'Selected FrozenSubject changed or became unverifiable during provider normalization.';
		}
	}
	const usableForCurrentSubject =
		options.raw !== null &&
		health === 'HEALTHY' &&
		finalFreshness === 'CURRENT' &&
		conflicts.length === 0;
	return Object.freeze({
		adapter: Object.freeze({
			id: token(options.adapterId, 'Adapter id'),
			version: token(options.adapterVersion, 'Adapter version')
		}),
		analysisAuthority: ENRICHED_PROVIDER_ANALYSIS_AUTHORITY,
		availability: options.raw === null ? 'ABSENT' : 'PRESENT',
		conflicts: Object.freeze(conflicts),
		coverage: Object.freeze({ completedRegions, missingRegions, state: coverageState }),
		diagnostics: Object.freeze(diagnostics),
		freshness: Object.freeze({
			assessedAt: options.context.assessedAt,
			basis: finalFreshnessBasis,
			state: finalFreshness
		}),
		gateEffect: ENRICHED_PROVIDER_GATE_EFFECT,
		health,
		observations,
		provider: normalized.provider,
		rawArtifact:
			rawBytes === null || !rawWithinLimit || !rawEncodingValid
				? null
				: Object.freeze({ bytes: rawBytes.byteLength, sha256: sha256(rawBytes) }),
		redactions,
		run: normalized.run,
		schemaVersion: ENRICHED_PROVIDER_EVIDENCE_SCHEMA_VERSION,
		subject: Object.freeze({
			fileManifestSha256: options.context.subject.descriptor.fileManifestDigest,
			id: options.context.subject.descriptor.subjectId
		}),
		usableForCurrentSubject
	});
}

export interface ProviderClaim {
	readonly factId: string;
	readonly providerId: string;
	readonly subjectId: string;
	readonly valueSha256: string;
}

export interface ProviderClaimCorrelation {
	readonly conflicts: readonly {
		readonly factId: string;
		readonly providerIds: readonly string[];
		readonly valueSha256s: readonly string[];
	}[];
	readonly state: 'AGREEMENT' | 'CONFLICTING' | 'EMPTY';
}

export function correlateProviderClaims(
	claims: readonly ProviderClaim[]
): ProviderClaimCorrelation {
	if (claims.length > 10_000) throw new TypeError('Provider claim correlation exceeds its limit.');
	const byFact = new Map<string, ProviderClaim[]>();
	let subjectId: string | null = null;
	for (const claim of claims) {
		token(claim.factId, 'Provider fact id');
		token(claim.providerId, 'Provider claim provider id');
		token(claim.subjectId, 'Provider claim subject id');
		digest(claim.valueSha256, 'Provider claim value');
		if (subjectId !== null && claim.subjectId !== subjectId)
			throw new TypeError('Provider claims from different subjects cannot be correlated.');
		subjectId = claim.subjectId;
		const bucket = byFact.get(claim.factId) ?? [];
		bucket.push(claim);
		byFact.set(claim.factId, bucket);
	}
	const conflicts = [...byFact.entries()]
		.filter(([, entries]) => new Set(entries.map((entry) => entry.valueSha256)).size > 1)
		.map(([factId, entries]) => ({
			factId,
			providerIds: [...new Set(entries.map((entry) => entry.providerId))].sort(compareText),
			valueSha256s: [...new Set(entries.map((entry) => entry.valueSha256))].sort(compareText)
		}))
		.sort((left, right) => compareText(left.factId, right.factId));
	return Object.freeze({
		conflicts: Object.freeze(conflicts),
		state: claims.length === 0 ? 'EMPTY' : conflicts.length === 0 ? 'AGREEMENT' : 'CONFLICTING'
	});
}
