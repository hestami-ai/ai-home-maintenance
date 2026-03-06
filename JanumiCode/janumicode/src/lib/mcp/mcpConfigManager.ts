/**
 * MCP Config Manager
 * Creates and cleans up temporary MCP config files for CLI invocations.
 * Claude Code CLI accepts --mcp-config <path> pointing to a JSON file
 * that defines MCP server connections.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

/**
 * MCP server definition (matches Claude Code's .mcp.json format)
 */
export interface MCPServerDef {
	command: string;
	args?: string[];
	env?: Record<string, string>;
}

/**
 * MCP config file structure (mcpServers key maps names to server definitions)
 */
export interface MCPConfigFile {
	mcpServers: Record<string, MCPServerDef>;
}

/**
 * Create a temporary MCP config JSON file.
 * Returns the absolute path to the created file.
 */
export function createMCPConfigFile(config: MCPConfigFile): string {
	const tmpDir = path.join(os.tmpdir(), 'janumicode-mcp');
	fs.mkdirSync(tmpDir, { recursive: true });
	const filePath = path.join(tmpDir, `mcp-${randomUUID()}.json`);
	fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
	return filePath;
}

/**
 * Clean up a temporary MCP config file.
 */
export function cleanupMCPConfigFile(filePath: string): void {
	try {
		fs.unlinkSync(filePath);
	} catch {
		// Ignore — file may already be deleted or locked
	}
}

/**
 * Build an MCP config for the mobile-specialist server.
 *
 * @param serverPath Absolute path to the MCP server entry point (e.g., dist/index.js)
 * @param baseUrl    Specialist LLM API base URL
 * @param apiKey     Specialist LLM API key
 * @param model      Specialist LLM model name
 */
export function buildMobileSpecialistMCPConfig(
	serverPath: string,
	baseUrl: string,
	apiKey: string,
	model: string,
): MCPConfigFile {
	return {
		mcpServers: {
			'mobile-specialist': {
				command: 'node',
				args: [serverPath],
				env: {
					MOBILE_SPECIALIST_BASE_URL: baseUrl,
					MOBILE_SPECIALIST_API_KEY: apiKey,
					MOBILE_SPECIALIST_MODEL: model,
				},
			},
		},
	};
}
