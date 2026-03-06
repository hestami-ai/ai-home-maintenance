/**
 * Configuration for the mobile-specialist MCP server.
 * Reads from environment variables.
 */

export interface MobileSpecialistConfig {
	/** Base URL for the specialist LLM API (e.g., https://api.z.ai/api/coding/paas/v4) */
	baseUrl: string;
	/** API key for the specialist service */
	apiKey: string;
	/** Model name (e.g., glm-4.6) */
	model: string;
	/** Request timeout in ms */
	timeout: number;
}

export function loadConfig(): MobileSpecialistConfig {
	const baseUrl = process.env.MOBILE_SPECIALIST_BASE_URL;
	const apiKey = process.env.MOBILE_SPECIALIST_API_KEY;
	const model = process.env.MOBILE_SPECIALIST_MODEL || 'glm-4.6';
	const timeout = parseInt(process.env.MOBILE_SPECIALIST_TIMEOUT || '120000', 10);

	if (!baseUrl) {
		throw new Error(
			'MOBILE_SPECIALIST_BASE_URL is required. ' +
			'Set it to the specialist LLM API base URL (e.g., https://api.z.ai/api/coding/paas/v4)'
		);
	}
	if (!apiKey) {
		throw new Error(
			'MOBILE_SPECIALIST_API_KEY is required. ' +
			'Set it to the API key for the specialist LLM service.'
		);
	}

	return { baseUrl, apiKey, model, timeout };
}
