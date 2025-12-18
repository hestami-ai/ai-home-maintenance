/**
 * Svelte Stores for Real-time Governance Updates
 * 
 * Provides reactive stores that connect to SSE endpoints
 * for live meeting and vote updates.
 */

import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================================================
// Types
// ============================================================================

export interface MeetingLiveState {
	connected: boolean;
	meetingId: string | null;
	status: string | null;
	title: string | null;
	quorum: {
		required: number | null;
		present: number;
		met: boolean;
	};
	lastUpdate: string | null;
	error: string | null;
}

export interface VoteLiveState {
	connected: boolean;
	voteId: string | null;
	question: string | null;
	tally: {
		yes: number;
		no: number;
		abstain: number;
		totalBallots: number;
	};
	quorumMet: boolean;
	isClosed: boolean;
	lastUpdate: string | null;
	error: string | null;
}

// ============================================================================
// Meeting Live Store
// ============================================================================

function createMeetingLiveStore() {
	const initialState: MeetingLiveState = {
		connected: false,
		meetingId: null,
		status: null,
		title: null,
		quorum: { required: null, present: 0, met: false },
		lastUpdate: null,
		error: null
	};

	const { subscribe, set, update } = writable<MeetingLiveState>(initialState);

	let eventSource: EventSource | null = null;
	let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 5;

	function connect(meetingId: string) {
		if (!browser) return;

		// Disconnect existing connection
		disconnect();

		update(state => ({ ...state, meetingId, error: null }));

		const url = `/api/v1/governance/meeting/${meetingId}/live`;
		eventSource = new EventSource(url);

		eventSource.onopen = () => {
			reconnectAttempts = 0;
			update(state => ({ ...state, connected: true, error: null }));
		};

		eventSource.onerror = () => {
			update(state => ({ ...state, connected: false }));
			
			// Attempt reconnection with exponential backoff
			if (reconnectAttempts < maxReconnectAttempts) {
				const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
				reconnectTimeout = setTimeout(() => {
					reconnectAttempts++;
					connect(meetingId);
				}, delay);
			} else {
				update(state => ({ ...state, error: 'Connection lost. Please refresh the page.' }));
			}
		};

		// Handle specific event types
		eventSource.addEventListener('meeting_state', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({
				...state,
				status: data.data.status ?? state.status,
				title: data.data.title ?? state.title,
				lastUpdate: data.timestamp
			}));
		});

		eventSource.addEventListener('attendance_update', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({
				...state,
				quorum: {
					...state.quorum,
					present: data.data.presentCount,
					met: data.data.quorumMet
				},
				lastUpdate: data.timestamp
			}));
		});

		eventSource.addEventListener('quorum_update', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({
				...state,
				quorum: {
					required: data.data.required,
					present: data.data.present,
					met: data.data.met
				},
				lastUpdate: data.timestamp
			}));
		});

		eventSource.addEventListener('heartbeat', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({ ...state, lastUpdate: data.timestamp }));
		});
	}

	function disconnect() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}
		set(initialState);
	}

	return {
		subscribe,
		connect,
		disconnect
	};
}

export const meetingLive = createMeetingLiveStore();

// ============================================================================
// Vote Live Store
// ============================================================================

function createVoteLiveStore() {
	const initialState: VoteLiveState = {
		connected: false,
		voteId: null,
		question: null,
		tally: { yes: 0, no: 0, abstain: 0, totalBallots: 0 },
		quorumMet: false,
		isClosed: false,
		lastUpdate: null,
		error: null
	};

	const { subscribe, set, update } = writable<VoteLiveState>(initialState);

	let eventSource: EventSource | null = null;
	let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	let reconnectAttempts = 0;
	const maxReconnectAttempts = 5;

	function connect(voteId: string) {
		if (!browser) return;

		disconnect();

		update(state => ({ ...state, voteId, error: null }));

		const url = `/api/v1/governance/vote/${voteId}/live`;
		eventSource = new EventSource(url);

		eventSource.onopen = () => {
			reconnectAttempts = 0;
			update(state => ({ ...state, connected: true, error: null }));
		};

		eventSource.onerror = () => {
			update(state => ({ ...state, connected: false }));
			
			if (reconnectAttempts < maxReconnectAttempts) {
				const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
				reconnectTimeout = setTimeout(() => {
					reconnectAttempts++;
					connect(voteId);
				}, delay);
			} else {
				update(state => ({ ...state, error: 'Connection lost. Please refresh the page.' }));
			}
		};

		eventSource.addEventListener('tally_update', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({
				...state,
				question: data.data.question ?? state.question,
				tally: {
					yes: data.data.yes,
					no: data.data.no,
					abstain: data.data.abstain,
					totalBallots: data.data.totalBallots
				},
				quorumMet: data.data.quorumMet,
				isClosed: data.data.isClosed ?? state.isClosed,
				lastUpdate: data.timestamp
			}));
		});

		eventSource.addEventListener('ballot_cast', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({ ...state, lastUpdate: data.timestamp }));
		});

		eventSource.addEventListener('vote_closed', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({
				...state,
				tally: {
					yes: data.data.yes,
					no: data.data.no,
					abstain: data.data.abstain,
					totalBallots: data.data.yes + data.data.no + data.data.abstain
				},
				isClosed: true,
				lastUpdate: data.timestamp
			}));
		});

		eventSource.addEventListener('heartbeat', (event) => {
			const data = JSON.parse(event.data);
			update(state => ({ ...state, lastUpdate: data.timestamp }));
		});
	}

	function disconnect() {
		if (eventSource) {
			eventSource.close();
			eventSource = null;
		}
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}
		set(initialState);
	}

	return {
		subscribe,
		connect,
		disconnect
	};
}

export const voteLive = createVoteLiveStore();

// ============================================================================
// Derived Stores
// ============================================================================

export const isQuorumMet: Readable<boolean> = derived(
	meetingLive,
	$meeting => $meeting.quorum.met
);

export const voteProgress: Readable<number> = derived(
	voteLive,
	$vote => {
		const total = $vote.tally.yes + $vote.tally.no + $vote.tally.abstain;
		if (total === 0) return 0;
		return ($vote.tally.yes / total) * 100;
	}
);

export const voteResult: Readable<'passing' | 'failing' | 'tied' | null> = derived(
	voteLive,
	$vote => {
		if ($vote.tally.totalBallots === 0) return null;
		if ($vote.tally.yes > $vote.tally.no) return 'passing';
		if ($vote.tally.no > $vote.tally.yes) return 'failing';
		return 'tied';
	}
);
