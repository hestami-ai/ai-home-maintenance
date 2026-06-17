/**
 * sanitizeResponderReply — every LLM responder reply must be safe to type
 * into a TUI input line: one line (multi-line pastes fragment per newline),
 * never a slash command, never the completion sentinel (our sends are
 * echo-exempt for the marker — a sentinel typed by US would end the task
 * instantly), bounded length. Empty results → null → canned fallback.
 */
import { describe, it, expect } from 'vitest';
import { MAX_RESPONDER_REPLY_CHARS, sanitizeResponderReply } from '../../../../lib/cli/session/responder';

describe('sanitizeResponderReply', () => {
  it('passes a plain one-line answer through unchanged', () => {
    expect(sanitizeResponderReply('Use 7-character base62 slugs.')).toBe('Use 7-character base62 slugs.');
  });

  it('collapses multi-line replies to a single line', () => {
    expect(sanitizeResponderReply('1. Use base62.\n2. Slug length 7.\r\n3. Store in src/lib/db.'))
      .toBe('1. Use base62. 2. Slug length 7. 3. Store in src/lib/db.');
  });

  it('strips a leading slash so a reply can never become a slash command', () => {
    expect(sanitizeResponderReply('/endplan')).toBe('endplan');
    expect(sanitizeResponderReply('//plan now')).toBe('plan now');
  });

  it('strips the completion sentinel (only the AGENT may declare completion)', () => {
    expect(sanitizeResponderReply('Looks done — TASK COMPLETE', 'TASK COMPLETE')).toBe('Looks done —');
    expect(sanitizeResponderReply('TASK COMPLETE', 'TASK COMPLETE')).toBeNull();
  });

  it('returns null for null / empty / whitespace-only input', () => {
    expect(sanitizeResponderReply(null)).toBeNull();
    expect(sanitizeResponderReply('')).toBeNull();
    expect(sanitizeResponderReply('  \n  ')).toBeNull();
  });

  it('caps reply length', () => {
    const long = 'x'.repeat(MAX_RESPONDER_REPLY_CHARS * 2);
    expect(sanitizeResponderReply(long)!.length).toBe(MAX_RESPONDER_REPLY_CHARS);
  });
});
