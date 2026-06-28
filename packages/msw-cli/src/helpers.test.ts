import { describe, it, expect } from 'vitest';
import { parsePatternsAndMethods, formatSuccess } from './helpers.js';

describe('parsePatternsAndMethods', () => {
  it('leaves plain URL patterns untouched', () => {
    expect(parsePatternsAndMethods(['/api/users'])).toEqual({
      patterns: ['/api/users'],
      methods: undefined,
    });
  });

  it('splits a leading HTTP method token into a method filter', () => {
    expect(parsePatternsAndMethods(['GET /api/users'])).toEqual({
      patterns: ['/api/users'],
      methods: ['GET'],
    });
  });

  it('uppercases and merges explicit method flags', () => {
    expect(parsePatternsAndMethods(['/api/users'], ['get', 'post'])).toEqual({
      patterns: ['/api/users'],
      methods: ['GET', 'POST'],
    });
  });

  it('dedupes a leading token that matches an explicit flag', () => {
    const result = parsePatternsAndMethods(['GET /api/users'], ['get']);
    expect(result.patterns).toEqual(['/api/users']);
    expect(result.methods).toEqual(['GET']);
  });

  it('does not treat an unknown leading word as a method', () => {
    expect(parsePatternsAndMethods(['FOO /api/users'])).toEqual({
      patterns: ['FOO /api/users'],
      methods: undefined,
    });
  });

  it('handles multiple patterns with mixed method prefixes', () => {
    const result = parsePatternsAndMethods(['GET /a', '/b', 'POST /c']);
    expect(result.patterns).toEqual(['/a', '/b', '/c']);
    expect(result.methods?.sort()).toEqual(['GET', 'POST']);
  });
});

describe('formatSuccess', () => {
  it('warns when REMOVE_HANDLERS removed nothing', () => {
    const msg = formatSuccess('REMOVE_HANDLERS', {
      removedCount: 0,
      activeHandlers: ['GET /a'],
    });
    expect(msg).toContain('Removed 0 handlers');
    expect(msg).toContain('Active handlers: 1');
  });

  it('reports removed count when REMOVE_HANDLERS matched', () => {
    const msg = formatSuccess('REMOVE_HANDLERS', {
      removedCount: 3,
      activeHandlers: [],
    });
    expect(msg).toBe('✅ Removed 3 handler(s). Active handlers: 0');
  });

  it('warns when UPDATE_HANDLERS matched nothing', () => {
    const msg = formatSuccess('UPDATE_HANDLERS', {
      matchedCount: 0,
      addedCount: 2,
      activeHandlers: ['GET /a', 'GET /b'],
    });
    expect(msg).toContain('0 handlers matched');
    expect(msg).toContain('added 2 new handler(s)');
  });

  it('reports replaced counts when UPDATE_HANDLERS matched', () => {
    const msg = formatSuccess('UPDATE_HANDLERS', {
      matchedCount: 1,
      addedCount: 1,
      activeHandlers: ['GET /a'],
    });
    expect(msg).toBe(
      '✅ Updated: replaced 1 handler(s) with 1 new. Active handlers: 1',
    );
  });

  it('falls back to a generic success message', () => {
    expect(formatSuccess('ADD_HANDLERS', { activeHandlers: ['GET /a'] })).toBe(
      '✅ Success. Active handlers: 1',
    );
  });

  it('uses a provided message when present', () => {
    expect(formatSuccess('ADD_HANDLERS', { message: 'Done' })).toBe('✅ Done');
  });
});
