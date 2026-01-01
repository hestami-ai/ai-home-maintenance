import { json } from '@sveltejs/kit';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { documentWorkflow_v1, DocumentAction } from '$lib/server/workflows/documentWorkflow';
import { createModuleLogger } from '$lib/server/logger';
import { recordSpanError } from '$lib/server/api/middleware/tracing';
import type { RequestHandler } from './$types';

const log = createModuleLogger('TusHook');

export const POST: RequestHandler = async ({ request }) => {
    // 1. Verify hook secret (if configured) - omitted for MVP as per instructions

    // 2. Parse payload
    const payload = await request.json();

    // 3. Extract data - tusd v2 uses Event.Upload structure
    const hookName = request.headers.get('hook-name') || payload.Type;
    // tusd v2 payload structure: { Type, Event: { Upload: { ID, MetaData, ... } } }
    const tusId = payload.Event?.Upload?.ID || payload.Upload?.ID || payload.ID;
    const metaData = payload.Event?.Upload?.MetaData || payload.Upload?.MetaData || payload.MetaData || {};

    log.info('Received TUS hook', { hookName, tusId, metaData });

    // 4. Handle 'post-finish'
    if (hookName === 'post-finish') {
        try {
            if (!tusId) {
                log.error('Missing upload ID in payload', { hookName, payload });
                return json({ error: 'Missing ID' }, { status: 400 });
            }

            // We need a unique idempotency key. TUS ID is good.
            const workflowId = `tus-process-${tusId}`;

            log.debug('Starting document workflow', { workflowId, tusId, documentId: metaData.documentId });

            await DBOS.startWorkflow(documentWorkflow_v1, { workflowID: workflowId })(
                {
                    action: DocumentAction.HANDLE_TUS_HOOK,
                    organizationId: 'system', // TUS hooks are system events, or we extract org from metadata
                    userId: 'system',
                    data: { tusPayload: payload }
                }
            );

            log.info('Document workflow started', { workflowId, tusId });
            return json({ status: 'processing_started' });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            log.exception(error, { hookName, tusId });
            await recordSpanError(error, {
                errorCode: 'TUS_HOOK_ERROR',
                errorType: 'WORKFLOW_START_FAILED'
            });
            return json({ error: 'Internal Server Error' }, { status: 500 });
        }
    }

    log.debug('Hook ignored', { hookName, tusId });
    return json({ status: 'ignored' });
};
