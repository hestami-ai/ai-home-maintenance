/**
 * Claude Code CLI Detector
 * Implements Phase 9.3.2: Detection and validation of Claude Code CLI
 * Detects Claude Code installation and validates compatibility
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import type { Result } from '../types';
import { CodedError } from '../types';

const execAsync = promisify(exec);

/**
 * Claude Code detection result
 */
export interface ClaudeCodeDetectionResult {
	/** Whether Claude Code is installed */
	installed: boolean;
	/** Path to Claude Code executable */
	path?: string;
	/** Version string */
	version?: string;
	/** Version components */
	versionComponents?: {
		major: number;
		minor: number;
		patch: number;
	};
	/** Whether version is compatible */
	compatible: boolean;
	/** API key configured */
	apiKeyConfigured: boolean;
	/** Detection method */
	detectionMethod?: 'global-path' | 'vscode-setting' | 'env-variable';
}

/**
 * Minimum compatible version
 */
const MIN_VERSION = {
	major: 0,
	minor: 1,
	patch: 0,
};

/**
 * Detect Claude Code CLI
 * Attempts to detect Claude Code in multiple locations
 *
 * @returns Detection result
 */
export async function detectClaudeCode(): Promise<Result<ClaudeCodeDetectionResult>> {
	try {
		// Try detection methods in order
		const detectionMethods = [
			detectFromVSCodeSetting,
			detectFromGlobalPath,
			detectFromEnvVariable,
		];

		for (const method of detectionMethods) {
			const result = await method();
			if (result.success && result.value.installed) {
				return result;
			}
		}

		// Not found
		return {
			success: true,
			value: {
				installed: false,
				compatible: false,
				apiKeyConfigured: false,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'DETECTION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Detect from VS Code setting
 */
async function detectFromVSCodeSetting(): Promise<Result<ClaudeCodeDetectionResult>> {
	try {
		const config = vscode.workspace.getConfiguration('janumicode.claudeCode');
		const customPath = config.get<string>('path');

		if (!customPath) {
			return {
				success: true,
				value: {
					installed: false,
					compatible: false,
					apiKeyConfigured: false,
				},
			};
		}

		// Validate custom path
		const validation = await validateClaudeCodePath(customPath);

		if (!validation.success) {
			return validation;
		}

		return {
			success: true,
			value: {
				...validation.value,
				detectionMethod: 'vscode-setting',
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'VSCODE_SETTING_DETECTION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Detect from global PATH
 */
async function detectFromGlobalPath(): Promise<Result<ClaudeCodeDetectionResult>> {
	try {
		// Try to execute 'claude --version'
		const { stdout } = await execAsync('claude --version');

		const version = parseVersion(stdout.trim());

		if (!version) {
			return {
				success: false,
				error: new CodedError(
					'VERSION_PARSE_FAILED',
					'Could not parse Claude Code version'
				),
			};
		}

		const compatible = isVersionCompatible(version);
		const apiKeyConfigured = await checkAPIKeyConfigured();

		return {
			success: true,
			value: {
				installed: true,
				path: 'claude', // Global command
				version: `${version.major}.${version.minor}.${version.patch}`,
				versionComponents: version,
				compatible,
				apiKeyConfigured,
				detectionMethod: 'global-path',
			},
		};
	} catch (error) {
		// Command not found or failed
		return {
			success: true,
			value: {
				installed: false,
				compatible: false,
				apiKeyConfigured: false,
			},
		};
	}
}

/**
 * Detect from environment variable
 */
async function detectFromEnvVariable(): Promise<Result<ClaudeCodeDetectionResult>> {
	try {
		const envPath = process.env.CLAUDE_CODE_PATH;

		if (!envPath) {
			return {
				success: true,
				value: {
					installed: false,
					compatible: false,
					apiKeyConfigured: false,
				},
			};
		}

		// Validate environment path
		const validation = await validateClaudeCodePath(envPath);

		if (!validation.success) {
			return validation;
		}

		return {
			success: true,
			value: {
				...validation.value,
				detectionMethod: 'env-variable',
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ENV_VARIABLE_DETECTION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Validate Claude Code path
 * Checks if path points to valid Claude Code executable
 *
 * @param path Path to Claude Code
 * @returns Validation result
 */
async function validateClaudeCodePath(
	path: string
): Promise<Result<ClaudeCodeDetectionResult>> {
	try {
		// Try to execute version command
		const { stdout } = await execAsync(`"${path}" --version`);

		const version = parseVersion(stdout.trim());

		if (!version) {
			return {
				success: false,
				error: new CodedError(
					'VERSION_PARSE_FAILED',
					'Could not parse Claude Code version'
				),
			};
		}

		const compatible = isVersionCompatible(version);
		const apiKeyConfigured = await checkAPIKeyConfigured();

		return {
			success: true,
			value: {
				installed: true,
				path,
				version: `${version.major}.${version.minor}.${version.patch}`,
				versionComponents: version,
				compatible,
				apiKeyConfigured,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'PATH_VALIDATION_FAILED',
				error instanceof Error ? error.message : 'Invalid Claude Code path'
			),
		};
	}
}

/**
 * Parse version string
 * Extracts version components from version string
 *
 * @param versionString Version string (e.g., "1.2.3")
 * @returns Version components or null
 */
function parseVersion(versionString: string): {
	major: number;
	minor: number;
	patch: number;
} | null {
	// Match version pattern: X.Y.Z
	const match = versionString.match(/(\d+)\.(\d+)\.(\d+)/);

	if (!match) {
		return null;
	}

	return {
		major: parseInt(match[1], 10),
		minor: parseInt(match[2], 10),
		patch: parseInt(match[3], 10),
	};
}

/**
 * Check if version is compatible
 * Compares version against minimum required version
 *
 * @param version Version to check
 * @returns Whether version is compatible
 */
function isVersionCompatible(version: { major: number; minor: number; patch: number }): boolean {
	// Compare major version
	if (version.major > MIN_VERSION.major) {
		return true;
	}
	if (version.major < MIN_VERSION.major) {
		return false;
	}

	// Major versions equal, compare minor
	if (version.minor > MIN_VERSION.minor) {
		return true;
	}
	if (version.minor < MIN_VERSION.minor) {
		return false;
	}

	// Major and minor equal, compare patch
	return version.patch >= MIN_VERSION.patch;
}

/**
 * Check if API key is configured
 * Checks for Anthropic API key in environment or Claude config
 *
 * @returns Whether API key is configured
 */
async function checkAPIKeyConfigured(): Promise<boolean> {
	// Check environment variable
	if (process.env.ANTHROPIC_API_KEY) {
		return true;
	}

	// Check Claude Code config
	try {
		const { stdout } = await execAsync('claude config get apiKey');
		return stdout.trim().length > 0;
	} catch {
		return false;
	}
}

/**
 * Show installation instructions
 * Displays instructions for installing Claude Code
 */
export function showInstallationInstructions(): void {
	const message = `
Claude Code CLI is not installed.

To install Claude Code:

1. Install via npm:
   npm install -g @anthropic-ai/claude-code

2. Verify installation:
   claude --version

3. Configure API key:
   claude config set apiKey "your-api-key"

4. Restart VS Code
	`.trim();

	vscode.window.showWarningMessage(message, 'View Documentation').then((selection) => {
		if (selection === 'View Documentation') {
			vscode.env.openExternal(vscode.Uri.parse('https://docs.anthropic.com/claude-code'));
		}
	});
}

/**
 * Show version mismatch warning
 * Displays warning about incompatible version
 *
 * @param currentVersion Current version
 */
export function showVersionMismatchWarning(currentVersion: string): void {
	const message = `
Claude Code version ${currentVersion} is not compatible.

Minimum required version: ${MIN_VERSION.major}.${MIN_VERSION.minor}.${MIN_VERSION.patch}

To update Claude Code:
   npm update -g @anthropic-ai/claude-code
	`.trim();

	vscode.window.showWarningMessage(message, 'Update Now').then((selection) => {
		if (selection === 'Update Now') {
			const terminal = vscode.window.createTerminal('Update Claude Code');
			terminal.show();
			terminal.sendText('npm update -g @anthropic-ai/claude-code');
		}
	});
}

/**
 * Show API key configuration prompt
 * Displays prompt to configure API key
 */
export function showAPIKeyConfigurationPrompt(): void {
	const message = `
Claude Code API key is not configured.

Configure your Anthropic API key:

1. Option 1 - Environment variable:
   export ANTHROPIC_API_KEY="your-api-key"

2. Option 2 - Claude Code config:
   claude config set apiKey "your-api-key"

3. Restart VS Code
	`.trim();

	vscode.window
		.showWarningMessage(message, 'Configure API Key', 'Get API Key')
		.then((selection) => {
			if (selection === 'Configure API Key') {
				const terminal = vscode.window.createTerminal('Configure Claude Code');
				terminal.show();
				terminal.sendText('claude config set apiKey ');
			} else if (selection === 'Get API Key') {
				vscode.env.openExternal(
					vscode.Uri.parse('https://console.anthropic.com/settings/keys')
				);
			}
		});
}

/**
 * Validate Claude Code setup
 * Performs full validation of Claude Code installation
 *
 * @returns Validation result with user-friendly messages
 */
export async function validateClaudeCodeSetup(): Promise<
	Result<{
		valid: boolean;
		issues: string[];
	}>
> {
	try {
		const detection = await detectClaudeCode();

		if (!detection.success) {
			return {
				success: false,
				error: detection.error,
			};
		}

		const issues: string[] = [];

		if (!detection.value.installed) {
			issues.push('Claude Code CLI is not installed');
			showInstallationInstructions();
		} else {
			if (!detection.value.compatible) {
				issues.push(
					`Claude Code version ${detection.value.version} is not compatible (minimum: ${MIN_VERSION.major}.${MIN_VERSION.minor}.${MIN_VERSION.patch})`
				);
				showVersionMismatchWarning(detection.value.version || 'unknown');
			}

			if (!detection.value.apiKeyConfigured) {
				issues.push('Anthropic API key is not configured');
				showAPIKeyConfigurationPrompt();
			}
		}

		return {
			success: true,
			value: {
				valid: issues.length === 0,
				issues,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'VALIDATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}
