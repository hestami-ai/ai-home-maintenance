import { describe, it, expect } from 'vitest';
import { parseJsonWithRecovery } from '../../../lib/llm/jsonRecovery';
describe('stray-quote recovery', () => {
  it('recovers stepNumber: 3"', () => {
    const r = parseJsonWithRecovery('{ "stepNumber": 3", "actor": "System" }');
    expect(r.parsed).toEqual({ stepNumber: 3, actor: 'System' });
  });
  it('recovers floats and negatives', () => {
    const r = parseJsonWithRecovery('{ "x": 12.5", "y": -7" }');
    expect(r.parsed).toEqual({ x: 12.5, y: -7 });
  });
  it('recovers stray inside an array value', () => {
    const r = parseJsonWithRecovery('{ "values": [1, 2", 3] }');
    expect(r.parsed).toEqual({ values: [1, 2, 3] });
  });
  it('does NOT touch legit string-3', () => {
    const r = parseJsonWithRecovery('{ "keep": "3", "valid": "x" }');
    expect(r.parsed).toEqual({ keep: '3', valid: 'x' });
  });
});
