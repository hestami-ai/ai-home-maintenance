import { describe, it, expect } from 'vitest';
import { eventSessionId, isPermissionAsk, permissionAsk, defaultRelayDecider, MimoServerAdapter } from '../../../../lib/cli/session/adapters/mimoServerAdapter';
import type { MimoSseEvent } from '../../../../lib/cli/mimo/mimoClient';

const ev = (type: string, properties: Record<string, unknown>): MimoSseEvent => ({ type, properties });

describe('MimoServerAdapter event helpers', () => {
  it('eventSessionId reads properties.sessionID', () => {
    expect(eventSessionId(ev('session.idle', { sessionID: 'ses_9' }))).toBe('ses_9');
    expect(eventSessionId(ev('file.edited', { file: 'x' }))).toBeUndefined();
  });

  it('isPermissionAsk recognizes only permission.asked', () => {
    expect(isPermissionAsk(ev('permission.asked', {}))).toBe(true);
    expect(isPermissionAsk(ev('permission.replied', {}))).toBe(false);
    expect(isPermissionAsk(ev('message.part.delta', {}))).toBe(false);
  });

  it('permissionAsk extracts id, tool, filepath from the live shape', () => {
    const live = ev('permission.asked', {
      id: 'per_abc', sessionID: 'ses_1', permission: 'edit',
      patterns: ['Users\\x'], metadata: { filepath: 'C:/proj/add.go', diff: '...' }, always: ['*'],
    });
    expect(permissionAsk(live)).toMatchObject({ permissionId: 'per_abc', tool: 'edit', filepath: 'C:/proj/add.go' });
  });

  it('permissionAsk returns null for non-asks or missing id', () => {
    expect(permissionAsk(ev('message.updated', {}))).toBeNull();
    expect(permissionAsk(ev('permission.asked', { permission: 'edit' }))).toBeNull();
  });

  it('defaultRelayDecider answers per env (default once) and logs the ask', async () => {
    const logs: string[] = [];
    const decider = defaultRelayDecider((e) => { if (e.kind === 'data') logs.push(e.chunk); });
    const res = await decider({ permissionId: 'per_1', tool: 'edit', filepath: '/p/x.go', raw: ev('permission.asked', {}) });
    expect(res).toBe('once'); // default
    expect(logs.join('')).toMatch(/permission.*edit/);
  });

  it('constructs without side effects (server starts lazily in run)', () => {
    const adapter = new MimoServerAdapter({ config: { binary: 'mimo', model: 'mimo/mimo-auto', agent: 'compose', permissionMode: 'static' } });
    expect(adapter.tier).toBe('agentic_server');
  });
});
