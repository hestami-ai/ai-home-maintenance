/**
 * Violation Documentation System
 * Maps violation types to actionable fix instructions
 */

export type ViolationSeverity = 'error' | 'warn' | 'info';

export interface ViolationFix {
	pattern: string;
	severity: ViolationSeverity;
	title: string;
	explanation: string;
	fixSteps: string[];
	example?: {
		before: string;
		after: string;
	};
	docLink?: string;
}

export const VIOLATION_DOCS: Record<string, ViolationFix> = {
	'presentation-to-database': {
		pattern: 'presentation-to-database',
		severity: 'error',
		title: 'Presentation → Database bypass',
		explanation: 'UI layer cannot directly access database infrastructure. This creates tight coupling and prevents clean testing/mocking.',
		fixSteps: [
			'Use workflow layer abstractions instead of direct database access',
			'Import from workflow stores (e.g., getWorkflowState, getClaims)',
			'If needed, add a new workflow function to expose the data',
		],
		example: {
			before: `import { getDatabase } from '../../database/init';\nconst db = getDatabase();\nconst claims = db.prepare('SELECT * FROM claims').all();`,
			after: `import { getClaimsForDialogue } from '../../workflow/claims';\nconst claims = getClaimsForDialogue(dialogueId);`,
		},
		docLink: 'docs/ARCHITECTURE.md#presentation-layer',
	},

	'presentation-to-cli': {
		pattern: 'presentation-to-cli',
		severity: 'error',
		title: 'Presentation → CLI bypass',
		explanation: 'UI layer cannot directly spawn CLI processes. This is a security risk and violates layer separation.',
		fixSteps: [
			'Extract spawn logic to workflow or orchestrator layer',
			'Have UI emit an event: emitEvent("cli:spawn", params)',
			'Handle the event in orchestrator/cliAdapter.ts',
			'Return results via event callback or promise',
		],
		example: {
			before: `import { spawn } from '../../cli/spawnUtils';\nconst result = spawn('command', args);`,
			after: `import { emitCLIRequest } from '../../integration/eventBus';\nconst result = await emitCLIRequest('command', args);`,
		},
		docLink: 'docs/ARCHITECTURE.md#presentation-layer',
	},

	'business-to-ui': {
		pattern: 'business-to-ui',
		severity: 'error',
		title: 'Business Logic → UI reverse dependency',
		explanation: 'Business logic (workflow, orchestrator, roles) cannot import from UI layer. This creates circular dependencies and tight coupling.',
		fixSteps: [
			'Use event-based communication instead of direct imports',
			'Emit events from business logic: emitWorkflowEvent(...)',
			'Have UI subscribe to events and update accordingly',
			'Extract shared types to types/ or contracts/',
		],
		example: {
			before: `import { textCommands } from '../ui/governedStream/textCommands';\ntextCommands.parse(input);`,
			after: `import { parseCommand } from '../types/commandTypes';\n// Or emit event: emitCommandReceived(input)`,
		},
		docLink: 'docs/ARCHITECTURE.md#business-logic-layer',
	},

	'infrastructure-to-business': {
		pattern: 'infrastructure-to-business',
		severity: 'error',
		title: 'Infrastructure → Business Logic reverse dependency',
		explanation: 'Infrastructure (database, LLM, CLI) cannot import from business logic. This violates dependency inversion.',
		fixSteps: [
			'Infrastructure should be passive - it stores data or provides services',
			'Business logic controls infrastructure, not the other way around',
			'Use dependency injection if infrastructure needs business logic',
			'Or emit events that business logic subscribes to',
		],
		docLink: 'docs/ARCHITECTURE.md#infrastructure-layer',
	},

	'foundation-upward-deps': {
		pattern: 'foundation-upward-deps',
		severity: 'error',
		title: 'Foundation → Upward dependency (CRITICAL)',
		explanation: 'Foundation layer (types, primitives, errorHandling) MUST have zero dependencies on upper layers. Any violation erodes the foundation.',
		fixSteps: [
			'If this module imports business logic, it is NOT a primitive',
			'Move module to correct layer: workflow/, database/, or ui/',
			'Extract only the pure utility functions to primitives/',
			'Foundation modules should be reusable across projects',
		],
		docLink: 'docs/ARCHITECTURE.md#foundation-layer',
	},

	'circular-dependency': {
		pattern: 'circular-dependency',
		severity: 'error',
		title: 'Circular dependency detected',
		explanation: 'Circular dependencies create tight coupling, unpredictable initialization order, and make modules hard to test in isolation.',
		fixSteps: [
			'Identify the weakest coupling in the cycle (usually type-only imports)',
			'Extract shared types/interfaces to a new module',
			'Break the cycle by having both modules import from the shared module',
			'Use dependency injection if runtime dependencies are needed',
		],
		docLink: 'docs/ARCHITECTURE.md#circular-dependencies',
	},

	'high-fan-out': {
		pattern: 'high-fan-out',
		severity: 'warn',
		title: 'High fan-out (god module)',
		explanation: 'Modules with >20 dependencies are hard to maintain, test, and understand. They often violate single responsibility principle.',
		fixSteps: [
			'Extract utility functions to primitives/ or shared/',
			'Use dependency injection instead of direct imports',
			'Split module into smaller, focused modules',
			'Group related dependencies into higher-level abstractions',
		],
		docLink: 'docs/ARCHITECTURE.md#coupling-metrics',
	},

	'database-direct-access': {
		pattern: 'database-direct-access',
		severity: 'warn',
		title: 'Direct database access (bypass store)',
		explanation: 'Database should be accessed through store abstractions to maintain consistency and enable easier refactoring.',
		fixSteps: [
			'Use store modules: workflowStore, claimStore, etc.',
			'If store method does not exist, add it to the appropriate store',
			'Avoid direct SQL queries outside of store modules',
		],
		docLink: 'docs/ARCHITECTURE.md#database-access-patterns',
	},

	'llm-unauthorized-access': {
		pattern: 'llm-unauthorized-access',
		severity: 'warn',
		title: 'Unauthorized LLM provider access',
		explanation: 'LLM provider should only be accessed by approved modules to maintain control over AI interactions.',
		fixSteps: [
			'Route LLM calls through approved modules: roles/, cli/, documents/, curation/',
			'If you need LLM access, create a role or service in an approved module',
			'Do not import LLM provider directly from UI or database layers',
		],
		docLink: 'docs/ARCHITECTURE.md#llm-provider-access',
	},

	'complexity-threshold': {
		pattern: 'complexity-threshold',
		severity: 'info',
		title: 'Complexity threshold exceeded',
		explanation: 'High complexity modules are harder to understand and maintain. Consider refactoring.',
		fixSteps: [
			'Split large functions into smaller, focused functions',
			'Extract common patterns into utilities',
			'Use composition over large conditional logic',
		],
		docLink: 'docs/ARCHITECTURE.md#complexity-metrics',
	},

	'instability-high': {
		pattern: 'instability-high',
		severity: 'info',
		title: 'High instability (volatile module)',
		explanation: 'Modules with high instability (high efferent coupling) change frequently when dependencies change.',
		fixSteps: [
			'This is often acceptable for application-level modules',
			'Consider stabilizing if this is a core domain module',
			'Depend on stable abstractions, not volatile implementations',
		],
		docLink: 'docs/ARCHITECTURE.md#stable-dependency-principle',
	},
};

/**
 * Get fix documentation for a violation pattern
 */
export function getViolationFix(pattern: string): ViolationFix | undefined {
	return VIOLATION_DOCS[pattern];
}

/**
 * Get all violations by severity
 */
export function getViolationsBySeverity(severity: ViolationSeverity): ViolationFix[] {
	return Object.values(VIOLATION_DOCS).filter(v => v.severity === severity);
}

/**
 * Format violation for display
 */
export function formatViolation(
	violation: { file: string; import?: string; line?: number; reason?: string },
	fix: ViolationFix
): string {
	const severityIcon = fix.severity === 'error' ? '❌' : fix.severity === 'warn' ? '⚠️' : 'ℹ️';
	const severityLabel = fix.severity.toUpperCase();

	let output = `\n${severityIcon} ${severityLabel}: ${fix.title}\n`;
	output += `   File: ${violation.file}`;
	if (violation.line) {
		output += `:${violation.line}`;
	}
	output += '\n';

	if (violation.import) {
		output += `   Import: ${violation.import}\n`;
	}

	if (violation.reason) {
		output += `   Reason: ${violation.reason}\n`;
	}

	output += `\n   Why this is wrong:\n`;
	output += `   ${fix.explanation}\n`;

	output += `\n   ✅ How to fix:\n`;
	fix.fixSteps.forEach((step, i) => {
		output += `   ${i + 1}. ${step}\n`;
	});

	if (fix.example) {
		output += `\n   Example:\n`;
		output += `   ❌ Before:\n`;
		fix.example.before.split('\n').forEach(line => {
			output += `      ${line}\n`;
		});
		output += `\n   ✅ After:\n`;
		fix.example.after.split('\n').forEach(line => {
			output += `      ${line}\n`;
		});
	}

	if (fix.docLink) {
		output += `\n   📖 See: ${fix.docLink}\n`;
	}

	return output;
}
