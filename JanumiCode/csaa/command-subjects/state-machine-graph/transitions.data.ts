// GENERATED FILE — do not edit by hand.
export const STATE_MACHINES = {
	'Command.fixture': {
		name: 'Command.fixture',
		states: ['READY', 'RUNNING', 'DONE'],
		initialState: 'READY',
		terminalStates: ['DONE'],
		transitions: [
			{ from: 'READY', to: 'RUNNING', trigger: 'start', guard: 'authorized' },
			{ from: 'RUNNING', to: 'DONE', trigger: 'finish' }
		],
		illegal: [{ from: 'DONE', to: 'RUNNING', reason: 'terminal' }],
		guarded: [{ from: 'READY', to: 'RUNNING', reason: 'requires authorization' }],
		sourceSection: 'command fixture'
	}
};
export const CROSS_AXIS_RULES = [];
