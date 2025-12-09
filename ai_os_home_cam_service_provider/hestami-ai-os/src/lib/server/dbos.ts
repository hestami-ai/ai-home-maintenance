import { DBOS } from '@dbos-inc/dbos-sdk';

// DBOS initialization - called once at server startup
let initialized = false;

export async function initDBOS(): Promise<void> {
	if (initialized) return;

	DBOS.setConfig({
		name: 'hestami-ai-os',
		systemDatabaseUrl: process.env.DBOS_SYSTEM_DATABASE_URL
	});

	await DBOS.launch();
	initialized = true;

	console.log('[DBOS] Workflow engine initialized');
}

export { DBOS };
