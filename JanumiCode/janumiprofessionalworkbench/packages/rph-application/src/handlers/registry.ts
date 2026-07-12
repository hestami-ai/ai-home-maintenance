// The command handler registry — commandType -> handler. dispatch() looks a command up here after the generic
// pre-stages (idempotency + payload validation). A command with no registered handler is REJECTED (the same
// posture the M4 skeleton had for everything but CaptureIntent), so the surface grows one handler group at a time.
import type { CommandHandler } from './kit.js';
import {
	approveIntent,
	beginIntentDiscovery,
	captureIntent,
	formalizeIntent,
	provisionIntent,
	reviseIntent
} from './intent.js';
import {
	beginPwuShaping,
	challengePwu,
	changePwuState,
	invalidatePwu,
	markPwuReady,
	proposePwu,
	reshapePwu,
	supersedePwu
} from './pwu.js';

export const HANDLERS: Readonly<Record<string, CommandHandler>> = {
	// Intent lifecycle (DOC-002 §6)
	CaptureIntent: captureIntent,
	BeginIntentDiscovery: beginIntentDiscovery,
	ProvisionIntent: provisionIntent,
	FormalizeIntent: formalizeIntent,
	ApproveIntent: approveIntent,
	ReviseIntent: reviseIntent,
	// PWU lifecycle (DOC-002 §7, §8)
	ProposePwu: proposePwu,
	BeginPwuShaping: beginPwuShaping,
	MarkPwuReady: markPwuReady,
	ChangePwuState: changePwuState,
	ChallengePwu: challengePwu,
	ReshapePwu: reshapePwu,
	InvalidatePwu: invalidatePwu,
	SupersedePwu: supersedePwu
};
