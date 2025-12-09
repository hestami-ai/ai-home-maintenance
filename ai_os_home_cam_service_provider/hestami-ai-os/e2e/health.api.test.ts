import { expect, test } from '@playwright/test';

test.describe('Health API', () => {
	test('GET /api/health returns healthy status', async ({ request }) => {
		const response = await request.get('/api/health');

		expect(response.ok()).toBe(true);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body).toMatchObject({
			status: 'healthy',
			version: expect.any(String)
		});
		expect(body.timestamp).toBeDefined();
	});
});
