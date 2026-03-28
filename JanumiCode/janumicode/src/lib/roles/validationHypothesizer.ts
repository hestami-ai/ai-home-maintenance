/**
 * Validation Hypothesizer Role
 *
 * Three specialized LLM agents that analyze code context and output structured
 * hypotheses for the Deep Validation Review pipeline.
 *
 * Agents:
 *   - Security: trust boundaries, injection, auth bypass, invariant failures
 *   - Logic & Correctness: state bugs, missing error paths, off-by-one
 *   - Best Practices: semantic rule violations linters cannot catch
 *
 * Each agent returns:
 *   { hypotheses: Array<{ id, text, location, category, severity }> }
 */

import { Role } from '../types';
import { resolveProviderForRole } from '../cli/providerResolver';
import { buildStdinContent } from '../cli/types';
import type { CLIActivityEvent } from '../cli/types';
import { invokeRoleStreaming } from '../cli/roleInvoker';
import type { RawHypothesis, ValidationCategory, ValidationSeverity } from '../types/validate';
import { getLogger, isLoggerInitialized } from '../logging';

// ==================== SYSTEM PROMPTS ====================

const HYPOTHESIS_RESPONSE_FORMAT = `
## Response Format
Your response MUST be valid JSON with this structure:

\`\`\`json
{
  "hypotheses": [
    {
      "id": "H-001",
      "text": "Clear, specific description of the potential issue",
      "location": "src/auth/login.ts:45 or 'AuthService.validateToken()'",
      "category": "security",
      "severity": "high"
    }
  ]
}
\`\`\`

**Rules:**
- id: sequential H-001, H-002, etc. (will be prefixed by caller)
- text: one clear sentence describing the specific issue and why it could be a bug
- location: most specific file path and line/function you can identify
- category: must be the category assigned to you (do not change it)
- severity: "critical" | "high" | "medium" | "low"
- Return an empty array if you find no genuine issues: { "hypotheses": [] }
- Do NOT include stylistic nits, formatting opinions, or "best practice" suggestions that are purely subjective
- Do NOT include issues already explicitly handled by try/catch or documented with comments
`;

export const SECURITY_SYSTEM_PROMPT = `You are a Security Hypothesis Agent in a governed code review pipeline.

Your role is to read code and produce a list of **security hypotheses** — candidate vulnerabilities that a formal verification pass will then attempt to prove or disprove.

## Focus Areas
1. **Trust boundary violations**: User-controlled data crossing into privileged operations without proper validation
2. **Injection vectors**: SQL, command, path traversal, XSS — anywhere unsanitized input reaches an interpreter
3. **Auth bypass / privilege escalation**: Missing authorization checks, confused deputy, insecure direct object references
4. **Invariant failures**: Security-critical invariants that could be violated (e.g., "admin flag can only be set by existing admin")
5. **Cryptographic misuse**: Weak algorithms, hardcoded secrets, predictable values in security-sensitive contexts
6. **Integer/type coercion issues**: Numeric overflows, type coercions that could break boundary checks

## Important
- Output ONLY hypotheses for this category: "security"
- A hypothesis is NOT a final finding — it is a claim to be proven or disproven by the validation engine
- Be specific enough that a formal verifier can write a test or constraint to check it
- Prefer precision over volume: 3 high-quality hypotheses beat 15 vague ones
${HYPOTHESIS_RESPONSE_FORMAT}`;

export const LOGIC_SYSTEM_PROMPT = `You are a Logic & Correctness Hypothesis Agent in a governed code review pipeline.

Your role is to read code and produce a list of **logic and correctness hypotheses** — candidate bugs involving state, control flow, and behavioral invariants that a formal verification pass will then attempt to prove or disprove.

## Focus Areas
1. **State machine violations**: Transitions that violate documented or implied invariants (e.g., "order can never go PENDING → SHIPPED without PAID step")
2. **Missing error paths**: Code paths where errors are silently swallowed or where failure of an async operation is not propagated
3. **Race conditions**: Async operations that share mutable state without synchronization
4. **Off-by-one errors**: Boundary conditions in loops, pagination, range checks
5. **Null/undefined dereference**: Code paths that assume a value exists but could be null/undefined at runtime
6. **Logic inversions**: Conditions that are accidentally inverted (e.g., \`if (!isAuthorized)\` → allow instead of deny)

## Important
- Output ONLY hypotheses for this category: "logic"
- A hypothesis is NOT a final finding — it is a claim to be proven or disproven
- Prefer state invariant hypotheses that can be modeled in Dafny (effect-free logic slices)
- Be specific: describe the exact invariant that might be violated, not just "there might be a bug here"
${HYPOTHESIS_RESPONSE_FORMAT}`;

export const BEST_PRACTICES_SYSTEM_PROMPT = `You are a Semantic Best Practices Hypothesis Agent in a governed code review pipeline.

Your role is to read code and produce a list of **semantic best practice hypotheses** — issues that violate complex internal rules or domain conventions that a linter cannot catch.

## Focus Areas
1. **Inappropriate library usage**: Using a library in a way that violates its documented contract or known footguns (e.g., using a caching library incorrectly, misusing transaction APIs)
2. **Missing idempotency**: Operations that should be idempotent (e.g., retry-safe) but are not
3. **Leaking abstractions**: Internal implementation details exposed through public APIs in ways that make them fragile
4. **Resource leak**: Open handles, unclosed connections, or unbounded memory growth in specific code patterns
5. **Implicit ordering dependencies**: Code that silently depends on execution order of operations that are not guaranteed to be ordered
6. **Domain rule violations**: Business logic that violates semantic constraints evident from the codebase context (e.g., entities that should be immutable after a certain state but aren't)

## Important
- Output ONLY hypotheses for this category: "best_practices"
- Do NOT flag stylistic preferences (naming conventions, formatting)
- Do NOT flag things that are merely "less idiomatic" — flag things that could cause actual bugs
- Focus on semantic issues that could cause runtime failures or correctness problems, not just code quality
${HYPOTHESIS_RESPONSE_FORMAT}`;

// ==================== INVOCATION ====================

export interface HypothesizerResult {
	hypotheses: RawHypothesis[];
	agentType: 'security' | 'logic' | 'best_practices';
}

/**
 * Invoke a single hypothesizer agent with the assembled code context.
 * Returns a list of raw hypotheses for the given category.
 */
export async function invokeHypothesizer(
	agentType: 'security' | 'logic' | 'best_practices',
	context: string,
	onEvent?: (event: CLIActivityEvent) => void,
): Promise<HypothesizerResult> {
	const log = isLoggerInitialized()
		? getLogger().child({ component: 'validationHypothesizer', agent: agentType })
		: null;

	const systemPrompt =
		agentType === 'security' ? SECURITY_SYSTEM_PROMPT :
		agentType === 'logic' ? LOGIC_SYSTEM_PROMPT :
		BEST_PRACTICES_SYSTEM_PROMPT;

	const category: ValidationCategory = agentType === 'best_practices' ? 'best_practices' : agentType;

	try {
		const providerResult = await resolveProviderForRole(Role.TECHNICAL_EXPERT);
		if (!providerResult.success) {
			log?.warn('Could not resolve provider for hypothesizer', { agentType });
			return { hypotheses: [], agentType };
		}

		const stdinContent = buildStdinContent(systemPrompt, context);
		const cliResult = await invokeRoleStreaming({
			provider: providerResult.value,
			stdinContent,
			onEvent,
		});

		if (!cliResult.success) {
			log?.warn('Hypothesizer invocation failed', { agentType, error: cliResult.error?.message });
			return { hypotheses: [], agentType };
		}

		const parsed = parseHypothesisResponse(cliResult.value.response, category, agentType);
		log?.info('Hypothesizer complete', { agentType, count: parsed.length });
		return { hypotheses: parsed, agentType };

	} catch (err) {
		log?.error('Hypothesizer threw', { agentType, error: err instanceof Error ? err.message : String(err) });
		return { hypotheses: [], agentType };
	}
}

// ==================== PARSING ====================

function parseHypothesisResponse(
	raw: string,
	category: ValidationCategory,
	agentType: string,
): RawHypothesis[] {
	try {
		// Extract JSON block from markdown-wrapped response
		const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
		const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
		const payload = JSON.parse(jsonStr) as { hypotheses?: unknown[] };

		if (!Array.isArray(payload.hypotheses)) { return []; }

		const results: RawHypothesis[] = [];
		const prefix = agentType === 'security' ? 'S' : agentType === 'logic' ? 'L' : 'B';

		for (let i = 0; i < payload.hypotheses.length; i++) {
			const h = payload.hypotheses[i] as Record<string, unknown>;
			if (typeof h.text !== 'string' || !h.text.trim()) { continue; }
			results.push({
				id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
				text: String(h.text).trim(),
				location: typeof h.location === 'string' ? h.location : '',
				category,
				severity: normalizeSeverity(h.severity),
			});
		}
		return results;
	} catch {
		return [];
	}
}

function normalizeSeverity(raw: unknown): ValidationSeverity {
	const s = String(raw).toLowerCase();
	if (s === 'critical') { return 'critical'; }
	if (s === 'high') { return 'high'; }
	if (s === 'low') { return 'low'; }
	return 'medium';
}
