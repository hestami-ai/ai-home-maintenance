// JAN-EXECGOV EG-02 — which steps need a RUNTIME_BINDING, and what it asks for.
//
// ⭑⭑ `STA-8` (`DOC-003:203`): *"Execution requires an approved plan and AUTHORIZED Runtime Bindings."*
// `REG-F-365` measured the breach: `RequestRuntimeBinding` had ZERO production dispatch sites (positive control,
// same form: `ApproveExecutionPlan` → 4), so `bindingAuthorityVerdict` returned `OUT_OF_SCOPE` for every step
// and four live, tested checks were unreachable on real work.
import { describe, expect, it } from 'vitest';
import { stepBindingFor } from './step-binding.js';

const req = (stepType: string, discharge: string | undefined) =>
	stepBindingFor(stepType, discharge, 'bind_1', 'step_1');

describe('EG-02 — the binding a step needs', () => {
	it('⭑⭑ a MODEL_INVOCATION on a MODEL-discharged type gets a binding for `network`', () => {
		// ⛔ `network` IS NOT COINED. `RPH-EXE-004`, ratified conformance: *"When a binding requests file-system
		// and network access but only file-system is granted, network operations fail authorization."* A model
		// invocation reaches a provider over the network; the rule's own example names the capability. THE
		// MUTANT: invent `model.invoke` — a governed name nothing in the corpus supports.
		expect(req('MODEL_INVOCATION', 'MODEL')).toEqual({
			runtimeBindingId: 'bind_1',
			executionStepId: 'step_1',
			roleId: 'MODEL',
			requestedCapabilities: [{ capability: 'network' }]
		});
	});

	it('⭑ the roleId is the TYPE’s own declaration, not a name invented here', () => {
		// ⭑ `PWU_TYPE.workDischarge` is a RATIFIED enum stating who discharges the work, and the authoring
		// handler REFUSES a type with an ACTIVE prompt template that declares anything but MODEL
		// (`pwa-authoring.ts:332`) — so for exactly the steps bound here the value is guaranteed by a gate.
		// THE MUTANT: hardcode `'role-executor'`, which exists in two TESTS and nowhere else, while the register
		// records `roleId`'s intended source as the principal (`D-3`, `REG-D-026`).
		expect(req('MODEL_INVOCATION', 'MODEL')?.roleId).toBe('MODEL');
	});

	it('⛔⛔ CONTROL — a TRANSFORMATION step gets NO binding, and that must stay true', () => {
		// ⚠ THE MOST IMPORTANT ASSERTION IN THIS FILE. `bindingAuthorityVerdict` returns `OUT_OF_SCOPE` for a
		// step naming no binding, and the kernel records why collapsing that *"would make every plan in the
		// reference seed — which authors no RuntimeBinding whatsoever — permanently unstartable"*. A step that
		// invokes no model needs no network. THE MUTANT: bind every step — every existing plan breaks.
		expect(req('TRANSFORMATION', 'HUMAN')).toBeUndefined();
		expect(req('TRANSFORMATION', 'MODEL')).toBeUndefined();
	});

	it('⚠ BOTH conditions are required — a MODEL_INVOCATION on a non-MODEL type is not bound', () => {
		// A step type that says "a model runs this" over a type that says a human does is a contradiction the
		// authoring gate already refuses. Binding it anyway would assert a role the type DENIES. THE MUTANT:
		// branch on `stepType` alone.
		expect(req('MODEL_INVOCATION', 'HUMAN')).toBeUndefined();
		expect(req('MODEL_INVOCATION', 'UNDECLARED')).toBeUndefined();
		expect(req('MODEL_INVOCATION', undefined)).toBeUndefined();
	});

	it('⚠ exactly ONE capability is requested — not an inflated envelope', () => {
		// `RequestRuntimeBinding` refuses an EMPTY request (N-20) and nothing catches an inflated one, so the
		// over-request is the failure mode with no guard. §22.1: *"Requested capability is not granted
		// capability. Capability scope must be explicit."* THE MUTANT: request file-system too, "just in case".
		expect(req('MODEL_INVOCATION', 'MODEL')?.requestedCapabilities).toHaveLength(1);
	});
});
