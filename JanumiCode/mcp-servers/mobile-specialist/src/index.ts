#!/usr/bin/env node

/**
 * Mobile Specialist MCP Server
 *
 * Bridges a mobile-specialist LLM (e.g., Z.ai GLM) for iOS/Android development
 * expertise via the Model Context Protocol (stdio transport).
 *
 * Tools:
 *   - query_mobile_specialist: Route prompts to the specialist LLM
 *   - get_mobile_guidelines: Curated iOS/Android best practices
 *   - analyze_mobile_project: Detect mobile project type from workspace
 *
 * Configuration via environment variables:
 *   - MOBILE_SPECIALIST_BASE_URL (required)
 *   - MOBILE_SPECIALIST_API_KEY (required)
 *   - MOBILE_SPECIALIST_MODEL (default: glm-4.6)
 *   - MOBILE_SPECIALIST_TIMEOUT (default: 120000)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { registerQuerySpecialistTool } from './tools/querySpecialist.js';
import { registerMobileGuidelinesTool } from './tools/mobileGuidelines.js';
import { registerAnalyzeProjectTool } from './tools/analyzeProject.js';

async function main(): Promise<void> {
	const config = loadConfig();

	const server = new McpServer({
		name: 'mobile-specialist',
		version: '0.1.0',
	});

	// Register tools
	registerQuerySpecialistTool(server, config);
	registerMobileGuidelinesTool(server);
	registerAnalyzeProjectTool(server);

	// Connect via stdio transport
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((error) => {
	console.error('Failed to start mobile-specialist MCP server:', error);
	process.exit(1);
});
