import { json } from '@sveltejs/kit';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { documentWorkflow_v1, DocumentAction } from '$lib/server/workflows/documentWorkflow';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    // 1. Verify hook secret (if configured) - omitted for MVP as per instructions

    // 2. Parse payload
    const payload = await request.json();

    // 3. Log
    console.log('[TUS-HOOK] Received hook:', payload.Type, payload.ID);

    // 4. Handle 'post-finish'
    if (payload.Type === 'post-finish') {
        try {
            // We start the workflow asynchronously
            // Note: We use executeWorkflow to fire-and-forget or await result?
            // Hooks usually expect a quick 200 OK. DBOS.startWorkflow is best.

            // We need a unique idempotency key. TUS ID is good.
            const workflowId = `tus-process-${payload.ID}`;

            await DBOS.startWorkflow(documentWorkflow_v1, { workflowID: workflowId })(
                {
                    action: DocumentAction.HANDLE_TUS_HOOK,
                    organizationId: 'system', // TUS hooks are system events, or we extract org from metadata
                    userId: 'system',
                    data: { tusPayload: payload }
                }
            );

            return json({ status: 'processing_started' });
        } catch (err) {
            console.error('[TUS-HOOK] Error starting workflow:', err);
            return json({ error: 'Internal Server Error' }, { status: 500 });
        }
    }

    return json({ status: 'ignored' });
};
