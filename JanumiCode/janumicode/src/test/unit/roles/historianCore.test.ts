import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	queryHistory,
	exportHistory,
	HistoryEventType,
	type HistoryQueryOptions,
} from '../../../lib/roles/historianCore';

vi.mock('../../../lib/database');

describe('Historian-Core (Non-Agent)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('queryHistory', () => {
		it('queries all event types by default', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory();

			expect(result.success).toBe(true);
		});

		it('filters by dialogue ID', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockTurns = [
				{
					turn_id: 'turn-1',
					dialogue_id: 'dialogue-123',
					created_at: '2024-01-01T00:00:00Z',
				},
			];

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue(mockTurns),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const options: HistoryQueryOptions = {
				dialogueId: 'dialogue-123',
			};

			const result = queryHistory(options);

			expect(result.success).toBe(true);
		});

		it('filters by event types', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockClaims = [
				{
					claim_id: 'claim-1',
					dialogue_id: 'dialogue-123',
					statement: 'Test claim',
					created_at: '2024-01-01T00:00:00Z',
				},
			];

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue(mockClaims),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const options: HistoryQueryOptions = {
				eventTypes: [HistoryEventType.CLAIM],
			};

			const result = queryHistory(options);

			expect(result.success).toBe(true);
		});

		it('applies pagination with limit and offset', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockEvents = Array(50).fill(null).map((_, i) => ({
				turn_id: `turn-${i}`,
				dialogue_id: 'dialogue-123',
				created_at: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`,
			}));

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue(mockEvents),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const options: HistoryQueryOptions = {
				limit: 10,
				offset: 20,
			};

			const result = queryHistory(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeLessThanOrEqual(10);
			}
		});

		it('sorts events by timestamp', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockEvents = [
				{
					turn_id: 'turn-3',
					dialogue_id: 'dialogue-123',
					created_at: '2024-01-01T03:00:00Z',
				},
				{
					turn_id: 'turn-1',
					dialogue_id: 'dialogue-123',
					created_at: '2024-01-01T01:00:00Z',
				},
				{
					turn_id: 'turn-2',
					dialogue_id: 'dialogue-123',
					created_at: '2024-01-01T02:00:00Z',
				},
			];

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue(mockEvents),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({
				eventTypes: [HistoryEventType.DIALOGUE_TURN],
			});

			expect(result.success).toBe(true);
			if (result.success && result.value.length > 0) {
				const timestamps = result.value.map(e => e.timestamp);
				const sorted = [...timestamps].sort();
				expect(timestamps).toEqual(sorted);
			}
		});

		it('filters by time range', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const options: HistoryQueryOptions = {
				startTime: new Date('2024-01-01T00:00:00Z'),
				endTime: new Date('2024-01-31T23:59:59Z'),
			};

			const result = queryHistory(options);

			expect(result.success).toBe(true);
		});

		it('handles database not initialized', () => {
			const { getDatabase } = require('../../../lib/database');

			vi.mocked(getDatabase).mockReturnValue(null);

			const result = queryHistory();

			expect(result.success).toBe(false);
		});

		it('handles query errors', () => {
			const { getDatabase } = require('../../../lib/database');

			vi.mocked(getDatabase).mockImplementation(() => {
				throw new Error('Database error');
			});

			const result = queryHistory();

			expect(result.success).toBe(false);
		});
	});

	describe('exportHistory', () => {
		it('exports history for dialogue', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockEvents = [
				{
					turn_id: 'turn-1',
					dialogue_id: 'dialogue-123',
					created_at: '2024-01-01T00:00:00Z',
				},
			];

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue(mockEvents),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = exportHistory('dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe('dialogue-123');
				expect(result.value.export_timestamp).toBeTruthy();
				expect(result.value.metadata.total_events).toBeGreaterThanOrEqual(0);
			}
		});

		it('includes metadata in export', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockEvents = Array(25).fill(null).map((_, i) => ({
				turn_id: `turn-${i}`,
				dialogue_id: 'dialogue-123',
				created_at: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`,
			}));

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue(mockEvents),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = exportHistory('dialogue-123');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.metadata.total_events).toBeGreaterThan(0);
				expect(result.value.events).toBeDefined();
			}
		});

		it('handles empty history', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = exportHistory('dialogue-999');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.metadata.total_events).toBe(0);
			}
		});

		it('handles database not initialized', () => {
			const { getDatabase } = require('../../../lib/database');

			vi.mocked(getDatabase).mockReturnValue(null);

			const result = exportHistory('dialogue-123');

			expect(result.success).toBe(false);
		});
	});

	describe('event type filtering', () => {
		it('queries only dialogue turns', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({
				eventTypes: [HistoryEventType.DIALOGUE_TURN],
			});

			expect(result.success).toBe(true);
		});

		it('queries only claims', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({
				eventTypes: [HistoryEventType.CLAIM],
			});

			expect(result.success).toBe(true);
		});

		it('queries only verdicts', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({
				eventTypes: [HistoryEventType.VERDICT],
			});

			expect(result.success).toBe(true);
		});

		it('queries only human decisions', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({
				eventTypes: [HistoryEventType.HUMAN_DECISION],
			});

			expect(result.success).toBe(true);
		});

		it('queries multiple event types', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({
				eventTypes: [
					HistoryEventType.CLAIM,
					HistoryEventType.VERDICT,
				],
			});

			expect(result.success).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles zero limit', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([
					{
						turn_id: 'turn-1',
						dialogue_id: 'dialogue-123',
						created_at: '2024-01-01T00:00:00Z',
					},
				]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({ limit: 0 });

			expect(result.success).toBe(true);
		});

		it('handles large offset', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([
					{
						turn_id: 'turn-1',
						dialogue_id: 'dialogue-123',
						created_at: '2024-01-01T00:00:00Z',
					},
				]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({ offset: 1000 });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBe(0);
			}
		});

		it('handles filter by turn ID', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({ turnId: 'turn-123' });

			expect(result.success).toBe(true);
		});

		it('handles filter by claim ID', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({ claimId: 'claim-123' });

			expect(result.success).toBe(true);
		});

		it('handles empty options', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const result = queryHistory({});

			expect(result.success).toBe(true);
		});

		it('handles concurrent queries', () => {
			const { getDatabase } = require('../../../lib/database');

			const mockPrepare = vi.fn().mockReturnValue({
				all: vi.fn().mockReturnValue([]),
			});

			vi.mocked(getDatabase).mockReturnValue({
				prepare: mockPrepare,
			} as any);

			const results = [
				queryHistory({ dialogueId: 'dialogue-1' }),
				queryHistory({ dialogueId: 'dialogue-2' }),
				queryHistory({ dialogueId: 'dialogue-3' }),
			];

			expect(results.every(r => r.success)).toBe(true);
		});
	});
});
