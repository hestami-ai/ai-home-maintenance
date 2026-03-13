/**
 * Domain Coverage Tracker
 *
 * Pure-function module that tracks engineering domain coverage during INTAKE.
 * Maintains per-domain coverage level (NONE → PARTIAL → ADEQUATE) with evidence trails.
 * Two update mechanisms: keyword matching on text, and Expert-reported coverage updates.
 */

import {
	EngineeringDomain,
	DomainCoverageLevel,
	LLMProvider as LLMProviderEnum,
} from '../types';
import type {
	DomainCoverageEntry,
	DomainCoverageMap,
	IntakeCheckpoint,
} from '../types';
import type { LLMProvider, ProviderConfig } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import { createProvider } from '../llm/providerFactory';
import { getLogger, isLoggerInitialized } from '../logging';
import { getSecretKeyManager } from '../config/secretKeyManager';
import * as vscode from 'vscode';

// ==================== DOMAIN METADATA ====================

export interface DomainInfo {
	label: string;
	description: string;
	keywords: string[];
}

/**
 * Human-readable labels, descriptions, and keyword triggers for each domain.
 */
export const DOMAIN_INFO: Record<EngineeringDomain, DomainInfo> = {
	[EngineeringDomain.PROBLEM_MISSION]: {
		label: 'Problem & Mission',
		description: 'Core problem statement, mission, vision, and value proposition',
		keywords: [
			'problem', 'mission', 'vision', 'goal', 'objective', 'purpose',
			'value proposition', 'pain point', 'opportunity', 'why',
		],
	},
	[EngineeringDomain.STAKEHOLDERS]: {
		label: 'Stakeholders',
		description: 'Users, personas, roles, and organizational stakeholders',
		keywords: [
			'stakeholder', 'user', 'persona', 'role', 'actor', 'customer',
			'admin', 'operator', 'audience', 'end user', 'tenant',
		],
	},
	[EngineeringDomain.SCOPE]: {
		label: 'Scope',
		description: 'In-scope vs out-of-scope boundaries, MVP definition, phasing',
		keywords: [
			'scope', 'in scope', 'out of scope', 'boundary', 'mvp',
			'phase', 'milestone', 'iteration', 'release', 'v1', 'v2',
		],
	},
	[EngineeringDomain.CAPABILITIES]: {
		label: 'Capabilities',
		description: 'Functional capabilities, features, and behaviors',
		keywords: [
			'feature', 'capability', 'functionality', 'behavior', 'function',
			'ability', 'action', 'operation', 'command', 'crud',
		],
	},
	[EngineeringDomain.WORKFLOWS_USE_CASES]: {
		label: 'Workflows & Use Cases',
		description: 'End-to-end workflows, use cases, user journeys',
		keywords: [
			'workflow', 'use case', 'user story', 'user journey', 'flow',
			'process', 'scenario', 'step', 'sequence', 'pipeline',
		],
	},
	[EngineeringDomain.DATA_INFORMATION]: {
		label: 'Data & Information',
		description: 'Data models, storage, schemas, data lifecycle, privacy',
		keywords: [
			'data', 'database', 'schema', 'model', 'entity', 'table',
			'storage', 'persistence', 'migration', 'record', 'field',
			'privacy', 'pii', 'retention', 'backup',
		],
	},
	[EngineeringDomain.ENVIRONMENT_OPERATIONS]: {
		label: 'Environment & Operations',
		description: 'Deployment, infrastructure, monitoring, CI/CD, runtime environment',
		keywords: [
			'deploy', 'infrastructure', 'environment', 'ci/cd', 'pipeline',
			'monitoring', 'logging', 'alerting', 'observability', 'docker',
			'kubernetes', 'cloud', 'aws', 'azure', 'gcp', 'server',
			'production', 'staging', 'devops',
		],
	},
	[EngineeringDomain.QUALITY_ATTRIBUTES]: {
		label: 'Quality Attributes',
		description: 'Performance, reliability, scalability, accessibility, usability',
		keywords: [
			'performance', 'scalability', 'reliability', 'availability',
			'latency', 'throughput', 'uptime', 'sla', 'accessibility',
			'usability', 'ux', 'responsive', 'load', 'capacity',
		],
	},
	[EngineeringDomain.SECURITY_COMPLIANCE]: {
		label: 'Security & Compliance',
		description: 'Authentication, authorization, encryption, compliance, audit',
		keywords: [
			'security', 'authentication', 'authorization', 'auth', 'oauth',
			'jwt', 'encryption', 'ssl', 'tls', 'compliance', 'gdpr',
			'hipaa', 'sox', 'audit', 'rbac', 'permission', 'vulnerability',
			'penetration', 'threat',
		],
	},
	[EngineeringDomain.INTEGRATION_INTERFACES]: {
		label: 'Integration & Interfaces',
		description: 'APIs, third-party services, protocols, data exchange',
		keywords: [
			'api', 'rest', 'graphql', 'grpc', 'webhook', 'integration',
			'third party', '3rd party', 'external', 'interface', 'protocol',
			'sdk', 'plugin', 'extension', 'middleware', 'message queue',
			'event bus', 'kafka', 'rabbitmq',
		],
	},
	[EngineeringDomain.ARCHITECTURE]: {
		label: 'Architecture',
		description: 'System architecture, component structure, design patterns',
		keywords: [
			'architecture', 'design pattern', 'microservice', 'monolith',
			'component', 'module', 'layer', 'tier', 'separation of concerns',
			'dependency', 'coupling', 'cohesion', 'event driven', 'cqrs',
			'domain driven', 'hexagonal',
		],
	},
	[EngineeringDomain.VERIFICATION_DELIVERY]: {
		label: 'Verification & Delivery',
		description: 'Testing strategy, acceptance criteria, delivery process',
		keywords: [
			'test', 'testing', 'unit test', 'integration test', 'e2e',
			'acceptance', 'criteria', 'quality', 'qa', 'tdd', 'bdd',
			'coverage', 'regression', 'delivery', 'release', 'rollback',
		],
	},
};

/**
 * Ordered list of domains for STATE_DRIVEN sequential traversal.
 * Ordered from high-level strategic to low-level tactical.
 */
export const DOMAIN_SEQUENCE: EngineeringDomain[] = [
	EngineeringDomain.PROBLEM_MISSION,
	EngineeringDomain.STAKEHOLDERS,
	EngineeringDomain.SCOPE,
	EngineeringDomain.CAPABILITIES,
	EngineeringDomain.WORKFLOWS_USE_CASES,
	EngineeringDomain.DATA_INFORMATION,
	EngineeringDomain.INTEGRATION_INTERFACES,
	EngineeringDomain.SECURITY_COMPLIANCE,
	EngineeringDomain.QUALITY_ATTRIBUTES,
	EngineeringDomain.ENVIRONMENT_OPERATIONS,
	EngineeringDomain.ARCHITECTURE,
	EngineeringDomain.VERIFICATION_DELIVERY,
];

// ==================== INITIALIZATION ====================

/**
 * Create a fresh coverage map with all 12 domains at NONE.
 */
export function initializeCoverageMap(): DomainCoverageMap {
	const map = {} as DomainCoverageMap;
	for (const domain of Object.values(EngineeringDomain)) {
		map[domain] = {
			domain,
			level: DomainCoverageLevel.NONE,
			evidence: [],
			turnNumbers: [],
		};
	}
	return map;
}

// ==================== TEXT-BASED COVERAGE UPDATE ====================

/** Maximum evidence snippets stored per domain */
const MAX_EVIDENCE_PER_DOMAIN = 10;
/** Minimum keyword hits to move from NONE → PARTIAL */
const PARTIAL_THRESHOLD = 1;
/** Minimum keyword hits to move from PARTIAL → ADEQUATE */
const ADEQUATE_THRESHOLD = 3;

/**
 * Update domain coverage based on text content from a conversation turn.
 * Scans for domain keywords and promotes coverage levels.
 * Returns a new map (immutable update).
 */
export function updateCoverageFromText(
	map: DomainCoverageMap,
	text: string,
	turnNumber: number,
): DomainCoverageMap {
	const lowerText = text.toLowerCase();
	const updated = deepCloneMap(map);

	for (const domain of Object.values(EngineeringDomain)) {
		const info = DOMAIN_INFO[domain];
		const entry = updated[domain];
		const matchedKeywords = info.keywords.filter(kw => lowerText.includes(kw));

		if (matchedKeywords.length === 0) { continue; }

		// Add evidence (capped, deduplicated)
		const snippet = extractSnippet(text, matchedKeywords[0]);
		if (snippet && entry.evidence.length < MAX_EVIDENCE_PER_DOMAIN &&
			!entry.evidence.includes(snippet)) {
			entry.evidence.push(snippet);
		}

		// Track turn
		if (!entry.turnNumbers.includes(turnNumber)) {
			entry.turnNumbers.push(turnNumber);
		}

		// Promote coverage level based on cumulative keyword hits across turns
		const cumulativeHits = entry.turnNumbers.length;
		if (entry.level === DomainCoverageLevel.NONE && cumulativeHits >= PARTIAL_THRESHOLD) {
			entry.level = DomainCoverageLevel.PARTIAL;
		}
		if (entry.level === DomainCoverageLevel.PARTIAL && cumulativeHits >= ADEQUATE_THRESHOLD) {
			entry.level = DomainCoverageLevel.ADEQUATE;
		}
	}

	return updated;
}

// ==================== LLM-BASED COVERAGE EXTRACTION ====================

const COVERAGE_EXTRACTION_PROMPT = `You are a domain coverage analyst for a software development intake process. Given conversation text from a planning session, extract evidence relevant to each engineering domain.

The 12 engineering domains are:
1. PROBLEM_MISSION — Problem statement, mission, vision, value proposition
2. STAKEHOLDERS — Users, personas, roles, organizational stakeholders
3. SCOPE — In-scope vs out-of-scope boundaries, MVP definition, phasing
4. CAPABILITIES — Functional capabilities, features, behaviors
5. WORKFLOWS_USE_CASES — End-to-end workflows, use cases, user journeys
6. DATA_INFORMATION — Data models, storage, schemas, data lifecycle, privacy
7. INTEGRATION_INTERFACES — APIs, third-party services, protocols
8. SECURITY_COMPLIANCE — Authentication, authorization, encryption, compliance
9. QUALITY_ATTRIBUTES — Performance, reliability, scalability, accessibility
10. ENVIRONMENT_OPERATIONS — Deployment, infrastructure, monitoring, CI/CD
11. ARCHITECTURE — System architecture, component structure, design patterns
12. VERIFICATION_DELIVERY — Testing strategy, acceptance criteria, delivery process

For each domain that has relevant content in the text, extract a concise but COMPLETE evidence summary (not a snippet — a coherent summary of what was said about that domain). Also assess the coverage level:
- NONE: No meaningful information about this domain
- PARTIAL: Some information but significant gaps remain
- ADEQUATE: Enough information to proceed with planning

Respond with valid JSON only. No markdown, no code fences.
{"domains": [{"domain": "PROBLEM_MISSION", "level": "PARTIAL", "evidence": "The stated problem is..."}, ...]}

Only include domains that have at least PARTIAL coverage. Omit NONE domains entirely.`;

/**
 * LLM-backed domain coverage extraction.
 * Uses the evaluator's fast LLM to extract per-domain evidence and coverage levels.
 * Falls back to keyword-based extraction if LLM is unavailable.
 */
export async function updateCoverageFromLLM(
	map: DomainCoverageMap,
	humanMessage: string,
	expertResponse: string,
	turnNumber: number,
): Promise<DomainCoverageMap> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'domainCoverageExtractor' })
		: undefined;

	try {
		const provider = await createCoverageProvider();
		if (!provider) {
			logger?.debug('LLM provider unavailable — falling back to keyword extraction');
			return updateCoverageFromTextFallback(map, humanMessage, expertResponse, turnNumber);
		}

		const combinedText = 'HUMAN MESSAGE:\n' + humanMessage + '\n\nEXPERT RESPONSE:\n' + expertResponse;
		const model = getCoverageModel();

		const result = await provider.complete({
			systemPrompt: COVERAGE_EXTRACTION_PROMPT,
			messages: [{ role: MessageRole.USER, content: combinedText }],
			model,
			temperature: 0,
			maxTokens: 2000,
		});

		if (!result.success) {
			logger?.warn('Coverage extraction LLM call failed', { error: result.error.message });
			return updateCoverageFromTextFallback(map, humanMessage, expertResponse, turnNumber);
		}

		const parsed = parseCoverageExtractionResponse(result.value.content);
		if (!parsed) {
			logger?.warn('Could not parse coverage extraction response');
			return updateCoverageFromTextFallback(map, humanMessage, expertResponse, turnNumber);
		}

		// Apply LLM-extracted coverage to the map
		const updated = deepCloneMap(map);
		for (const item of parsed) {
			applyExtractedCoverage(updated, item, turnNumber);
		}

		logger?.info('LLM coverage extraction complete', {
			domainsUpdated: parsed.length,
			inputTokens: result.value.usage.inputTokens,
			outputTokens: result.value.usage.outputTokens,
		});

		return updated;
	} catch (error) {
		logger?.warn('Coverage extraction failed — falling back to keywords', {
			error: error instanceof Error ? error.message : String(error),
		});
		return updateCoverageFromTextFallback(map, humanMessage, expertResponse, turnNumber);
	}
}

function applyExtractedCoverage(
	map: DomainCoverageMap,
	item: { domain: string; level: string; evidence: string },
	turnNumber: number,
): void {
	const domain = resolveDomainFromString(item.domain);
	if (!domain) { return; }

	const entry = map[domain];
	const level = isValidLevel(item.level) ? item.level as DomainCoverageLevel : null;

	if (item.evidence && entry.evidence.length < MAX_EVIDENCE_PER_DOMAIN &&
		!entry.evidence.includes(item.evidence)) {
		entry.evidence.push(item.evidence);
	}
	if (!entry.turnNumbers.includes(turnNumber)) {
		entry.turnNumbers.push(turnNumber);
	}
	if (level && levelRank(level) > levelRank(entry.level)) {
		entry.level = level;
	}
}

/**
 * Keyword-based fallback when LLM is unavailable.
 */
function updateCoverageFromTextFallback(
	map: DomainCoverageMap,
	humanMessage: string,
	expertResponse: string,
	turnNumber: number,
): DomainCoverageMap {
	let coverage = updateCoverageFromText(map, humanMessage, turnNumber);
	coverage = updateCoverageFromText(coverage, expertResponse, turnNumber);
	return coverage;
}

function parseCoverageExtractionResponse(content: string): Array<{ domain: string; level: string; evidence: string }> | null {
	try {
		let jsonStr = content.trim();
		if (jsonStr.startsWith('```')) {
			jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
		}
		const parsed = JSON.parse(jsonStr);
		if (!parsed.domains || !Array.isArray(parsed.domains)) { return null; }
		return parsed.domains.filter((d: { domain?: string; level?: string; evidence?: string }) =>
			typeof d.domain === 'string' && typeof d.level === 'string' && typeof d.evidence === 'string'
		);
	} catch {
		return null;
	}
}

async function createCoverageProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');
	const providerName = config.get<string>('evaluator.provider', 'GEMINI');
	const providerEnum = LLMProviderEnum[providerName as keyof typeof LLMProviderEnum]
		?? LLMProviderEnum.GEMINI;

	let apiKey: string | null = null;
	try {
		const key = await getSecretKeyManager().getApiKey('evaluator', providerEnum);
		if (key?.trim()) { apiKey = key.trim(); }
	} catch {
		// SecretStorage may not be initialized
	}
	if (!apiKey) { return null; }

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getCoverageModel(),
	};
	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

function getCoverageModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>('evaluator.model', 'gemini-3-flash-lite');
}

// ==================== EXPERT-REPORTED COVERAGE UPDATE ====================

/**
 * Expert-reported domain coverage update.
 * The Technical Expert can include structured tags like:
 *   [DOMAIN_COVERAGE: SECURITY_COMPLIANCE=ADEQUATE]
 *   [DOMAIN_COVERAGE: Problem & Mission=ADEQUATE]
 * in their response. Accepts both enum keys and human-readable labels.
 */
export function updateCoverageFromExpert(
	map: DomainCoverageMap,
	expertText: string,
	turnNumber: number,
): DomainCoverageMap {
	// Match both enum keys (PROBLEM_MISSION) and labels (Problem & Mission)
	const pattern = /\[DOMAIN_COVERAGE:\s*([^=\]]+?)\s*=\s*(\w+)\s*\]/g;
	const updated = deepCloneMap(map);
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(expertText)) !== null) {
		const domainStr = match[1].trim();
		const levelStr = match[2];

		// Resolve domain: try enum key first, then label lookup
		const domain = resolveDomainFromString(domainStr);
		if (!domain || !isValidLevel(levelStr)) { continue; }

		const level = levelStr as DomainCoverageLevel;
		const entry = updated[domain];

		// Expert tags are authoritative — set level directly (can promote or demote)
		entry.level = level;

		if (!entry.turnNumbers.includes(turnNumber)) {
			entry.turnNumbers.push(turnNumber);
		}
	}

	return updated;
}

/**
 * Resolve a domain string to an EngineeringDomain enum value.
 * Accepts enum keys (PROBLEM_MISSION), human-readable labels (Problem & Mission),
 * or case-insensitive variants.
 */
function resolveDomainFromString(str: string): EngineeringDomain | null {
	// Direct enum match
	if (isValidDomain(str)) {
		return str as EngineeringDomain;
	}

	// Label lookup (case-insensitive)
	const lowerStr = str.toLowerCase();
	for (const domain of Object.values(EngineeringDomain)) {
		if (DOMAIN_INFO[domain].label.toLowerCase() === lowerStr) {
			return domain;
		}
	}

	return null;
}

// ==================== QUERY FUNCTIONS ====================

/**
 * Get domains with NONE coverage — completely unaddressed.
 */
export function getCoverageGaps(map: DomainCoverageMap): EngineeringDomain[] {
	return Object.values(EngineeringDomain).filter(
		d => map[d].level === DomainCoverageLevel.NONE,
	);
}

/**
 * Get domains with PARTIAL coverage — mentioned but not adequately explored.
 */
export function getPartialDomains(map: DomainCoverageMap): EngineeringDomain[] {
	return Object.values(EngineeringDomain).filter(
		d => map[d].level === DomainCoverageLevel.PARTIAL,
	);
}

/**
 * Get a summary of overall coverage for display purposes.
 */
export function getCoverageSummary(map: DomainCoverageMap): {
	adequate: number;
	partial: number;
	none: number;
	percentage: number;
} {
	let adequate = 0;
	let partial = 0;
	let none = 0;
	const total = Object.values(EngineeringDomain).length;

	for (const domain of Object.values(EngineeringDomain)) {
		switch (map[domain].level) {
			case DomainCoverageLevel.ADEQUATE: adequate++; break;
			case DomainCoverageLevel.PARTIAL: partial++; break;
			case DomainCoverageLevel.NONE: none++; break;
		}
	}

	// Percentage: adequate = 100%, partial = 50%, none = 0%
	const percentage = Math.round(((adequate * 100) + (partial * 50)) / total);

	return { adequate, partial, none, percentage };
}

// ==================== CHECKPOINT LOGIC ====================

/** Default turn interval between checkpoints in HYBRID mode */
const CHECKPOINT_INTERVAL = 3;

/**
 * Determine if a coverage checkpoint should be triggered.
 * Used in HYBRID_CHECKPOINTS mode.
 */
export function shouldTriggerCheckpoint(
	map: DomainCoverageMap,
	turnCount: number,
	lastCheckpointTurn: number,
): boolean {
	// Don't checkpoint on first turn
	if (turnCount <= 1) { return false; }

	// Check if enough turns have passed since last checkpoint
	if (turnCount - lastCheckpointTurn < CHECKPOINT_INTERVAL) { return false; }

	// Only checkpoint if there are still gaps to surface
	const gaps = getCoverageGaps(map);
	return gaps.length > 0;
}

/**
 * Build a checkpoint object for the current state.
 */
export function buildCheckpoint(
	map: DomainCoverageMap,
	turnNumber: number,
): IntakeCheckpoint {
	const gaps = getCoverageGaps(map);
	const partials = getPartialDomains(map);

	// Suggest gaps first, then partials (max 4 suggestions)
	const suggested = [...gaps, ...partials].slice(0, 4);

	return {
		turnNumber,
		coverageSnapshot: deepCloneMap(map),
		suggestedDomains: suggested,
	};
}

// ==================== STATE_DRIVEN MODE HELPERS ====================

/**
 * Get the next domain in the STATE_DRIVEN sequence.
 * Returns null if all domains have been visited.
 */
export function getNextDomain(
	currentDomain: EngineeringDomain | null,
): EngineeringDomain | null {
	if (currentDomain === null) {
		return DOMAIN_SEQUENCE[0];
	}
	const idx = DOMAIN_SEQUENCE.indexOf(currentDomain);
	if (idx === -1 || idx >= DOMAIN_SEQUENCE.length - 1) {
		return null;
	}
	return DOMAIN_SEQUENCE[idx + 1];
}

/**
 * Check if the current domain has adequate coverage for STATE_DRIVEN exit criteria.
 */
export function isDomainAdequatelyCovered(
	map: DomainCoverageMap,
	domain: EngineeringDomain,
): boolean {
	return map[domain].level === DomainCoverageLevel.ADEQUATE;
}

// ==================== FORMATTING HELPERS ====================

/**
 * Format a human-readable coverage summary for inclusion in prompts or UI.
 */
export function formatCoverageSummaryForPrompt(map: DomainCoverageMap): string {
	const lines: string[] = ['Domain Coverage Status:'];
	for (const domain of DOMAIN_SEQUENCE) {
		const entry = map[domain];
		const info = DOMAIN_INFO[domain];
		const icon = entry.level === DomainCoverageLevel.ADEQUATE ? '[OK]'
			: entry.level === DomainCoverageLevel.PARTIAL ? '[PARTIAL]'
				: '[NONE]';
		lines.push(`  ${icon} ${info.label} — ${entry.level}`);
	}
	const summary = getCoverageSummary(map);
	lines.push(`\nOverall: ${summary.percentage}% coverage (${summary.adequate} adequate, ${summary.partial} partial, ${summary.none} uncovered)`);
	return lines.join('\n');
}

/**
 * Format uncovered domains as a bulleted list for Expert prompt injection.
 */
export function formatUncoveredDomainsForPrompt(map: DomainCoverageMap): string {
	const gaps = getCoverageGaps(map);
	const partials = getPartialDomains(map);

	if (gaps.length === 0 && partials.length === 0) {
		return 'All engineering domains have been adequately covered.';
	}

	const lines: string[] = [];
	if (gaps.length > 0) {
		lines.push('Domains NOT YET discussed:');
		for (const d of gaps) {
			const info = DOMAIN_INFO[d];
			lines.push(`  - ${info.label}: ${info.description}`);
		}
	}
	if (partials.length > 0) {
		lines.push('Domains only PARTIALLY covered:');
		for (const d of partials) {
			const info = DOMAIN_INFO[d];
			lines.push(`  - ${info.label}: ${info.description}`);
		}
	}
	return lines.join('\n');
}

// ==================== ANALYSIS SEEDING ====================

/**
 * Seed coverage from an ANALYZING phase response.
 * Sets coverage levels in one shot from the Expert's domain assessment.
 * Returns a new map (immutable update).
 */
export function seedCoverageFromAnalysis(
	map: DomainCoverageMap,
	domainAssessment: Array<{ domain: string; level: string; evidence: string }>,
): DomainCoverageMap {
	const updated = deepCloneMap(map);

	for (const item of domainAssessment) {
		// Resolve domain string to enum (handles both enum keys and labels)
		const domain = resolveDomainKey(item.domain);
		if (!domain || !updated[domain]) { continue; }

		// Map level string to enum
		const level = resolveCoverageLevel(item.level);
		if (!level) { continue; }

		updated[domain].level = level;
		if (item.evidence) {
			updated[domain].evidence.push(item.evidence);
		}
		if (!updated[domain].turnNumbers.includes(0)) {
			updated[domain].turnNumbers.push(0); // Analysis is turn 0
		}
	}

	return updated;
}

/**
 * Resolve a domain string (enum key or label) to EngineeringDomain.
 */
function resolveDomainKey(raw: string): EngineeringDomain | null {
	// Direct enum key match
	if (DOMAIN_INFO[raw as EngineeringDomain]) {
		return raw as EngineeringDomain;
	}
	// Try normalized match (e.g. "PROBLEM_AND_MISSION" → "PROBLEM_MISSION")
	const normalized = raw.toUpperCase().replaceAll(/\bAND\b/g, '').replaceAll(/[_\s]+/g, '_').replaceAll(/(?:^_|_$)/g, '');
	for (const domain of DOMAIN_SEQUENCE) {
		if (domain === normalized) { return domain; }
	}
	// Try label match
	const lowerRaw = raw.toLowerCase().replaceAll('_', ' ');
	for (const domain of DOMAIN_SEQUENCE) {
		if (DOMAIN_INFO[domain].label.toLowerCase() === lowerRaw) { return domain; }
	}
	return null;
}

/**
 * Resolve a level string to DomainCoverageLevel.
 */
function resolveCoverageLevel(raw: string): DomainCoverageLevel | null {
	const upper = raw.toUpperCase();
	if (upper === 'ADEQUATE') { return DomainCoverageLevel.ADEQUATE; }
	if (upper === 'PARTIAL') { return DomainCoverageLevel.PARTIAL; }
	if (upper === 'NONE') { return DomainCoverageLevel.NONE; }
	return null;
}

// ==================== PRIVATE HELPERS ====================

function deepCloneMap(map: DomainCoverageMap): DomainCoverageMap {
	return JSON.parse(JSON.stringify(map)) as DomainCoverageMap;
}

function extractSnippet(text: string, keyword: string): string {
	const lower = text.toLowerCase();
	const idx = lower.indexOf(keyword);
	if (idx === -1) { return ''; }

	// Split into sentences and find the one containing the keyword.
	// Use common sentence-ending patterns as delimiters.
	const sentences = text.split(/(?<=[.!?])\s+/);
	let charPos = 0;
	let targetIdx = -1;
	for (let i = 0; i < sentences.length; i++) {
		const sentenceEnd = charPos + sentences[i].length;
		if (idx >= charPos && idx < sentenceEnd) {
			targetIdx = i;
			break;
		}
		charPos = sentenceEnd + 1; // +1 for the split whitespace
	}

	if (targetIdx === -1) {
		// Fallback: return surrounding characters if sentence split fails
		const start = Math.max(0, idx - 100);
		const end = Math.min(text.length, idx + keyword.length + 200);
		return text.substring(start, end).trim();
	}

	// Include the target sentence plus one sentence before and after for context
	const from = Math.max(0, targetIdx - 1);
	const to = Math.min(sentences.length - 1, targetIdx + 1);
	return sentences.slice(from, to + 1).join(' ').trim();
}

function isValidDomain(str: string): boolean {
	return Object.values(EngineeringDomain).includes(str as EngineeringDomain);
}

function isValidLevel(str: string): boolean {
	return Object.values(DomainCoverageLevel).includes(str as DomainCoverageLevel);
}

function levelRank(level: DomainCoverageLevel): number {
	switch (level) {
		case DomainCoverageLevel.NONE: return 0;
		case DomainCoverageLevel.PARTIAL: return 1;
		case DomainCoverageLevel.ADEQUATE: return 2;
	}
}
