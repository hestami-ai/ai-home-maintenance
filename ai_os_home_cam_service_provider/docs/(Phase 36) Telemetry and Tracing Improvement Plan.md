# **Telemetry and Tracing Improvement Plan**

Based on the codebase review, I've validated the proposed approach to consolidate OTel initialization and improve trace granularity.

## **User Review Required**

IMPORTANT

Change the initialization strategy from SvelteKit hooks to a Bun preload script. This ensures all instrumentations (like `pg` and `http`) are registered before any application code runs.

WARNING

Consolidating telemetry initialization will remove 

src/lib/server/telemetry-init.ts. Any direct references to this file must be updated.

## **Proposed Changes**

### Core Telemetry & Initialization

#### \[DELETE\] 

#### telemetry-init.ts

Remove this file as initialization will move to the preload script.

#### \[MODIFY\] 

#### hooks.server.ts

* Remove `import '$server/telemetry-init';`.  
* Retain the manual span creation as a fallback/enrichment, but rely on auto-instrumentation for the base request span.

#### \[MODIFY\] 

#### telemetry.ts

Introduce `withSpan` and `addSpanEvent` helpers.  
import { trace, type Span, SpanStatusCode, context } from '@opentelemetry/api';  
*const* tracer \= trace.getTracer('hestami-ai-os');  
export *async* function withSpan\<T\>(  
	name: string,  
	fn: (span: Span) \=\> Promise\<T\>,  
	attributes?: Record\<string, any\>  
): Promise\<T\> {  
	*return* tracer.startActiveSpan(name, { attributes }, *async* (span) \=\> {  
		try {  
			*const* result \= *await* fn(span);  
			span.setStatus({ code: SpanStatusCode.OK });  
			*return* result;  
		} catch (error) {  
			span.setStatus({  
				code: SpanStatusCode.ERROR,  
				message: error instanceof Error ? error.message : String(error)  
			});  
			span.recordException(error instanceof Error ? error : new Error(String(error)));  
			throw error;  
		} finally {  
			span.end();  
		}  
	});  
}  
export function addSpanEvent(name: string, attributes?: Record\<string, any\>): void {  
	*const* span \= trace.getActiveSpan();  
	if (span) {  
		span.addEvent(name, attributes);  
	}  
}

#### \[MODIFY\] 

#### entrypoint.sh

Add `--preload ./telemetry.ts` (root) to the Bun execution command.  
---

### Workflow Tracing

#### \[MODIFY\] 

#### workflowLogger.ts

* Use `addSpanEvent` in   
* logStepStart/  
* logStepEnd.  
* Potentially use `withSpan` for major workflow steps if child spans are preferred over events.

---

### Request & RPC Tracing

#### \[MODIFY\] 

#### \+layout.server.ts (Example)

Wrap data fetching in spans/events.  
---

## **Verification Plan**

### Automated Tests

* Run the application with `OTEL_DEBUG=true` and verify that only ONE initialization message appears in the logs.  
* Trigger a workflow and verify in SigNoz (or via console logging) that child spans/events are correctly nested.

### Manual Verification

* Check SigNoz UI to ensure traces show:  
  1. Root request span.  
  2. Child spans for RPC handlers.  
  3. Events or child spans for workflow steps.

