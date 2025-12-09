/// <reference types="node" />
import { defineConfig } from 'prisma/config';

// Try to load dotenv for local development (may not exist in production)
try {
	const { config } = await import('dotenv');
	const { resolve, dirname } = await import('path');
	const { fileURLToPath } = await import('url');
	const __dirname = dirname(fileURLToPath(import.meta.url));
	config({ path: resolve(__dirname, '..', '.env') });
} catch {
	// dotenv not available in production, DATABASE_URL should be set via environment
}

// Get DATABASE_URL from environment (set directly or loaded from .env)
function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error('DATABASE_URL environment variable is required');
	}
	return url;
}

export default defineConfig({
	datasource: {
		url: getDatabaseUrl()
	}
});
