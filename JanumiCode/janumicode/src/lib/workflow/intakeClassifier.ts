/**
 * Intake Input Classifier
 *
 * LLM-backed classifier that analyzes the user's initial INTAKE input
 * and recommends an appropriate INTAKE mode. Uses the Evaluator's LLM
 * provider (default: Gemini Flash Lite) for nuanced intent understanding.
 *
 * Falls back to heuristic classification when the LLM provider is
 * unavailable (no API key configured, provider error, etc.).
 *
 * Three INTAKE modes:
 *   - STATE_DRIVEN: Guided walkthrough for vague/high-concept inputs
 *   - DOCUMENT_BASED: Document-based analysis for spec-heavy inputs
 *   - HYBRID_CHECKPOINTS: Free-form conversation with periodic checkpoints (default)
 */

import { IntakeMode, LLMProvider as LLMProviderEnum } from '../types';
import type { IntakeModeRecommendation } from '../types';
import type { LLMProvider, ProviderConfig } from '../llm/provider';
import { MessageRole } from '../llm/provider';
import { createProvider } from '../llm/providerFactory';
import { getLogger, isLoggerInitialized } from '../logging';
import { getSecretKeyManager } from '../config/secretKeyManager';

import * as vscode from 'vscode';

// ==================== SYSTEM PROMPT ====================

const CLASSIFIER_SYSTEM_PROMPT = `You are an intake mode classifier for a governed software development workflow.

Your task is to analyze a user's initial project request and recommend the best INTAKE conversation mode. You must classify the input into exactly one of three modes.

Modes:

1. STATE_DRIVEN — Best for vague, high-level, or aspirational inputs. The user has a concept but hasn't worked out details. This mode walks them through 12 engineering domains one at a time (problem/mission, stakeholders, scope, capabilities, workflows, data, environment/operations, quality attributes, security/compliance, integrations, architecture, verification/delivery).
   Examples: "Build a real estate management product", "I want an app that tracks fitness goals", "Create a marketplace for freelancers"

2. DOCUMENT_BASED — Best when the user references existing documents, specifications, or a codebase to review. The system pre-analyzes provided materials, maps which engineering domains are already covered, then focuses conversation on uncovered gaps.
   Examples: "Review the specifications in specs/ and prepare for implementation", "Analyze these PRD documents and identify what's missing", "Look at the existing codebase and propose improvements", "Here are our requirements docs — assess readiness for development"

3. HYBRID_CHECKPOINTS — Best for moderately detailed requests or scoped tasks (bug fixes, feature additions, refactors). Free-form conversation with the Technical Expert, with periodic coverage checkpoint cards that highlight under-explored engineering domains.
   Examples: "Add dark mode support to the settings page", "Fix the authentication timeout issue", "Refactor the payment module to support Stripe", "We need to add multi-tenancy — here's what we've considered so far"

Key decision factors:
- Does the input reference existing files, paths, documents, or a codebase? → Lean toward DOCUMENT_BASED
- Is the input a short, high-concept idea with no concrete resources? → Lean toward STATE_DRIVEN
- Is the input a specific task, bug fix, or feature request with moderate detail? → Lean toward HYBRID_CHECKPOINTS
- Does the input include or reference specification documents, design docs, or RFCs? → Lean toward DOCUMENT_BASED
- Is there an established codebase and the user wants review or audit? → Lean toward DOCUMENT_BASED

Respond with valid JSON only. No markdown, no code fences, no extra text.

{"mode": "STATE_DRIVEN" | "DOCUMENT_BASED" | "HYBRID_CHECKPOINTS", "confidence": 0.0-1.0, "rationale": "One sentence explaining why this mode fits the input"}`;

// ==================== LLM-BACKED CLASSIFIER ====================

/**
 * Classify the user's initial INTAKE input using LLM reasoning.
 * Falls back to heuristic classification if the LLM provider is unavailable.
 */
export async function classifyIntakeInput(
	text: string,
	attachments: string[],
	dialogueId?: string,
): Promise<IntakeModeRecommendation> {
	const logger = isLoggerInitialized()
		? getLogger().child({ component: 'intakeClassifier' })
		: undefined;

	// Try LLM-backed classification first
	try {
		const provider = await createClassifierProvider();
		if (provider) {
			const result = await classifyWithLLM(provider, text, attachments, dialogueId, logger);
			if (result) {
				return result;
			}
		}
		logger?.info('LLM classifier unavailable — falling back to heuristic');
	} catch (error) {
		logger?.warn('LLM classifier failed — falling back to heuristic', {
			error: error instanceof Error ? error.message : String(error),
		});
	}

	// Fallback: heuristic classification
	return classifyWithHeuristics(text, attachments);
}

// ==================== LLM CLASSIFICATION ====================

async function classifyWithLLM(
	provider: LLMProvider,
	text: string,
	attachments: string[],
	dialogueId: string | undefined,
	logger: ReturnType<ReturnType<typeof getLogger>['child']> | undefined,
): Promise<IntakeModeRecommendation | null> {
	const model = getClassifierModel();
	const startMs = Date.now();

	// Build user message with context
	const attachmentList = attachments.map(a => '  - ' + a).join('\n');
	const attachmentInfo = attachments.length > 0
		? '\n\nAttached files (' + attachments.length + '):\n' + attachmentList
		: '';
	const userMessage = `User's initial request:\n${text}${attachmentInfo}`;

	const result = await provider.complete({
		systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
		messages: [{ role: MessageRole.USER, content: userMessage }],
		model,
		temperature: 0.1,
	});

	const elapsedMs = Date.now() - startMs;

	if (!result.success) {
		logger?.warn('Classifier LLM call failed', { error: result.error.message, elapsedMs });
		return null;
	}

	const parsed = parseClassifierResponse(result.value.content);
	if (!parsed) {
		logger?.warn('Could not parse classifier response', { content: result.value.content });
		return null;
	}

	logger?.info('LLM classification complete', {
		mode: parsed.recommended,
		confidence: parsed.confidence,
		inputTokens: result.value.usage.inputTokens,
		outputTokens: result.value.usage.outputTokens,
		elapsedMs,
	});

	return parsed;
}

// ==================== RESPONSE PARSING ====================

function parseClassifierResponse(content: string): IntakeModeRecommendation | null {
	try {
		let jsonStr = content.trim();
		if (jsonStr.startsWith('```')) {
			jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
		}

		const parsed = JSON.parse(jsonStr);

		const validModes = Object.values(IntakeMode) as string[];
		if (!parsed.mode || !validModes.includes(parsed.mode)) {
			return null;
		}

		return {
			recommended: parsed.mode as IntakeMode,
			confidence: typeof parsed.confidence === 'number'
				? Math.max(0, Math.min(1, parsed.confidence))
				: 0.7,
			rationale: typeof parsed.rationale === 'string'
				? parsed.rationale
				: `LLM classified as ${parsed.mode}`,
		};
	} catch {
		return null;
	}
}

// ==================== PROVIDER CREATION ====================

/**
 * Create the LLM provider for classification.
 * Reuses the evaluator provider settings since classification is a similar
 * lightweight, low-latency LLM task.
 */
async function createClassifierProvider(): Promise<LLMProvider | null> {
	const config = vscode.workspace.getConfiguration('janumicode');
	const providerName = config.get<string>('evaluator.provider', 'GEMINI');

	const providerEnum = LLMProviderEnum[providerName as keyof typeof LLMProviderEnum]
		?? LLMProviderEnum.GEMINI;

	const apiKey = await resolveClassifierApiKey(providerEnum);
	if (!apiKey) {
		return null;
	}

	const providerConfig: ProviderConfig = {
		apiKey,
		defaultModel: getClassifierModel(),
	};

	const result = createProvider(providerEnum, providerConfig);
	return result.success ? result.value : null;
}

async function resolveClassifierApiKey(provider: LLMProviderEnum): Promise<string | null> {
	try {
		const key = await getSecretKeyManager().getApiKey('evaluator', provider);
		if (key?.trim()) {
			return key.trim();
		}
	} catch {
		// SecretStorage may not be initialized
	}
	return null;
}

function getClassifierModel(): string {
	const config = vscode.workspace.getConfiguration('janumicode');
	return config.get<string>('evaluator.model', 'gemini-3-flash-lite');
}

// ==================== HEURISTIC FALLBACK ====================

// ── Intent keyword lists ──

const REVIEW_INTENT_KEYWORDS = [
	'review', 'analyze', 'evaluate', 'examine', 'audit', 'assess',
	'read through', 'go through', 'look at', 'look over',
	'check', 'inspect', 'study', 'understand',
];

const DOCUMENT_REFERENCE_KEYWORDS = [
	'specification', 'specifications', 'spec', 'specs',
	'document', 'documents', 'documentation', 'docs',
	'requirements', 'requirement',
	'design doc', 'design document',
	'prd', 'brd', 'srs', 'rfc', 'adr',
	'blueprint', 'proposal', 'baseline',
];

const GREENFIELD_INTENT_KEYWORDS = [
	'build', 'create', 'design', 'develop', 'make',
	'i want', 'i need', 'we need', 'let\'s build',
	'new project', 'new product', 'new app', 'new service',
	'from scratch', 'greenfield', 'mvp',
];

const SCOPED_TASK_KEYWORDS = [
	'fix', 'bug', 'error', 'issue', 'broken',
	'update', 'change', 'modify', 'adjust', 'tweak',
	'add a', 'add the', 'remove', 'delete',
	'refactor', 'rename', 'move',
	'upgrade', 'migrate',
];

const WORKSPACE_REFERENCE_KEYWORDS = [
	'codebase', 'code base', 'repo', 'repository',
	'workspace', 'project', 'the project',
	'existing', 'current', 'our',
	'implementation', 'prepare for implementation',
];

const SPEC_FORMAT_MARKERS = [
	'RFC', 'ADR', 'PRD', 'BRD', 'SRS', 'MRD', 'TRD',
	'## Requirements', '## Scope', '## Architecture',
	'## Overview', '## Background', '## Goals',
	'### Functional', '### Non-Functional',
	'acceptance criteria', 'user story', 'as a user',
	'given', 'when', 'then',
];

const SPEC_FILE_EXTENSIONS = [
	'.md', '.txt', '.pdf', '.docx', '.doc',
	'.yaml', '.yml', '.json', '.csv',
];

const PATH_PATTERNS = [
	/(?:^|\s)['"]?(?:\.{0,2}\/|[a-zA-Z]:\\)[^\s'"]+['"]?/,
	/(?:^|\s)['"]?[\w.-]+(?:\/[\w.-]+){2,}['"]?/,
	/(?:^|\s)['"]?[\w.-]+(?:\\[\w.-]+){2,}['"]?/,
	/(?:^|\s)['"]?(?:src|lib|docs|specs|test|config)[\\/]/i,
];

// ── Signal analysis ──

interface ContentSignals {
	wordCount: number;
	hasSpecAttachments: boolean;
	specMarkerCount: number;
	hasPathReferences: boolean;
	reviewIntentScore: number;
	documentReferenceScore: number;
	greenfieldIntentScore: number;
	scopedTaskScore: number;
	workspaceReferenceScore: number;
}

/**
 * Heuristic-based fallback classifier. Used when the LLM provider
 * is unavailable (no API key, provider error, etc.).
 */
function classifyWithHeuristics(
	text: string,
	attachments: string[],
): IntakeModeRecommendation {
	const signals = analyzeContent(text, attachments);
	const documentScore = computeDocumentScore(signals);
	const scopedScore = computeScopedScore(signals);
	const greenfieldScore = computeGreenfieldScore(signals, attachments.length);

	if (documentScore >= 3) {
		return buildHeuristicResult(IntakeMode.DOCUMENT_BASED,
			Math.min(0.5 + documentScore * 0.08, 0.95),
			'Input references documents, specifications, or existing resources — document-based analysis will map coverage gaps.',
			signals);
	}

	if (scopedScore >= 2) {
		return buildHeuristicResult(IntakeMode.HYBRID_CHECKPOINTS,
			Math.min(0.6 + scopedScore * 0.08, 0.9),
			'Input describes a scoped task — free-form conversation with periodic domain checkpoints works best.',
			signals);
	}

	const isVagueInput = signals.wordCount < 30 && attachments.length === 0 && documentScore === 0 && scopedScore === 0;
	if (greenfieldScore >= 2 || isVagueInput) {
		return buildHeuristicResult(IntakeMode.STATE_DRIVEN,
			Math.min(0.6 + greenfieldScore * 0.1, 0.9),
			'Input is a high-level concept — a guided domain walkthrough will systematically build out requirements.',
			signals);
	}

	return buildHeuristicResult(IntakeMode.HYBRID_CHECKPOINTS, 0.65,
		'Input has moderate detail — free-form conversation with periodic domain checkpoints works best.',
		signals);
}

// ── Score computation ──

function specMarkerBonus(count: number): number {
	if (count >= 3) { return 2; }
	if (count >= 1) { return 1; }
	return 0;
}

function computeDocumentScore(s: ContentSignals): number {
	return s.reviewIntentScore
		+ s.documentReferenceScore
		+ (s.hasPathReferences ? 2 : 0)
		+ (s.hasSpecAttachments ? 3 : 0)
		+ specMarkerBonus(s.specMarkerCount)
		+ (s.wordCount > 200 ? 2 : 0)
		+ (s.workspaceReferenceScore > 0 && s.reviewIntentScore > 0 ? 1 : 0);
}

function computeScopedScore(s: ContentSignals): number {
	return s.scopedTaskScore
		+ (s.workspaceReferenceScore > 0 ? 1 : 0);
}

function computeGreenfieldScore(s: ContentSignals, attachmentCount: number): number {
	return s.greenfieldIntentScore
		+ (s.wordCount < 30 && attachmentCount === 0 ? 2 : 0)
		+ (s.wordCount < 50 && attachmentCount === 0 ? 1 : 0);
}

function buildHeuristicResult(mode: IntakeMode, confidence: number, reason: string, signals: ContentSignals): IntakeModeRecommendation {
	return { recommended: mode, confidence, rationale: buildHeuristicRationale(reason, signals) };
}

// ── Content analysis helpers ──

function analyzeContent(text: string, attachments: string[]): ContentSignals {
	const wordCount = countWords(text);
	const lower = text.toLowerCase();

	return {
		wordCount,
		hasSpecAttachments: attachments.some(isSpecLikeFile),
		specMarkerCount: countSpecMarkers(text),
		hasPathReferences: detectPathReferences(text),
		reviewIntentScore: countKeywordMatches(lower, REVIEW_INTENT_KEYWORDS),
		documentReferenceScore: countKeywordMatches(lower, DOCUMENT_REFERENCE_KEYWORDS),
		greenfieldIntentScore: countKeywordMatches(lower, GREENFIELD_INTENT_KEYWORDS),
		scopedTaskScore: countKeywordMatches(lower, SCOPED_TASK_KEYWORDS),
		workspaceReferenceScore: countKeywordMatches(lower, WORKSPACE_REFERENCE_KEYWORDS),
	};
}

function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function countKeywordMatches(lowerText: string, keywords: string[]): number {
	let count = 0;
	for (const kw of keywords) {
		const idx = lowerText.indexOf(kw.toLowerCase());
		if (idx !== -1) {
			const before = idx === 0 || /[\s.,;:!?'"()\-/\\]/.test(lowerText[idx - 1]);
			const after = idx + kw.length >= lowerText.length || /[\s.,;:!?'"()\-/\\]/.test(lowerText[idx + kw.length]);
			if (before && after) {
				count++;
			}
		}
	}
	return count;
}

function countSpecMarkers(text: string): number {
	const lower = text.toLowerCase();
	return SPEC_FORMAT_MARKERS.reduce(
		(count, marker) => count + (lower.includes(marker.toLowerCase()) ? 1 : 0),
		0,
	);
}

function detectPathReferences(text: string): boolean {
	return PATH_PATTERNS.some(pattern => pattern.test(text));
}

function isSpecLikeFile(filePath: string): boolean {
	const lower = filePath.toLowerCase();
	return SPEC_FILE_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function buildHeuristicRationale(reason: string, signals: ContentSignals): string {
	const parts: string[] = [];
	parts.push(`wordCount=${signals.wordCount}`);
	if (signals.hasSpecAttachments) { parts.push('specAttachments=true'); }
	if (signals.hasPathReferences) { parts.push('pathRefs=true'); }
	if (signals.specMarkerCount > 0) { parts.push(`specMarkers=${signals.specMarkerCount}`); }
	if (signals.reviewIntentScore > 0) { parts.push(`reviewIntent=${signals.reviewIntentScore}`); }
	if (signals.documentReferenceScore > 0) { parts.push(`docRefs=${signals.documentReferenceScore}`); }
	if (signals.greenfieldIntentScore > 0) { parts.push(`greenfieldIntent=${signals.greenfieldIntentScore}`); }
	if (signals.scopedTaskScore > 0) { parts.push(`scopedTask=${signals.scopedTaskScore}`); }
	if (signals.workspaceReferenceScore > 0) { parts.push(`workspaceRef=${signals.workspaceReferenceScore}`); }
	return `${reason} (${parts.join(', ')})`;
}
