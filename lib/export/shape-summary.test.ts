/**
 * Tests for the pure structural-sketch helpers in shape-summary.ts.
 */

import { describe, expect, it } from 'vitest';
import { jsonShapeFromText, shapeSummary } from './shape-summary';

describe('shapeSummary', () => {
  it('summarizes scalars with short literals', () => {
    expect(shapeSummary('hi')).toBe('"hi"');
    expect(shapeSummary(42)).toBe('42');
    expect(shapeSummary(true)).toBe('true');
    expect(shapeSummary(false)).toBe('false');
    expect(shapeSummary(null)).toBe('null');
  });

  it('falls back to type name for long string literals', () => {
    const long = 'x'.repeat(40);
    expect(shapeSummary(long)).toBe('string');
  });

  it('summarizes a flat object', () => {
    expect(shapeSummary({ a: 1, b: 'yo', c: true })).toBe('{ a: 1, b: "yo", c: true }');
  });

  it('summarizes nested objects', () => {
    const value = { user: { id: 7, name: 'Ada' }, ok: true };
    expect(shapeSummary(value)).toBe('{ user: { id: 7, name: "Ada" }, ok: true }');
  });

  it('renders empty containers distinctly', () => {
    expect(shapeSummary({})).toBe('{}');
    expect(shapeSummary([])).toBe('Array(0)');
  });

  it('summarizes arrays by their first element', () => {
    expect(shapeSummary([1, 2, 3])).toBe('Array(3) of 1');
  });

  it('summarizes arrays of objects', () => {
    const value = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ];
    expect(shapeSummary(value)).toBe('Array(2) of { id: 1, name: "a" }');
  });

  it('caps the number of object keys and reports the remainder', () => {
    const obj: Record<string, number> = {};
    for (let i = 0; i < 15; i++) {
      obj[`k${i}`] = i;
    }
    const out = shapeSummary(obj, { maxKeys: 3 });
    expect(out).toBe('{ k0: 0, k1: 1, k2: 2, +12 more }');
  });

  it('does not add the "+N more" suffix when exactly at the key cap', () => {
    const out = shapeSummary({ a: 1, b: 2 }, { maxKeys: 2 });
    expect(out).toBe('{ a: 1, b: 2 }');
  });

  it('respects the default maxKeys of 10', () => {
    const obj: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      obj[`k${i}`] = i;
    }
    expect(shapeSummary(obj)).toContain('+2 more');
    expect(shapeSummary(obj)).toContain('k9: 9');
    expect(shapeSummary(obj)).not.toContain('k10');
  });

  it('caps recursion depth, collapsing deeper containers to a bare type', () => {
    const value = { a: { b: { c: { d: 1 } } } };
    // depth 0: root object; d's value object reached at depth 3, collapsed at maxDepth 3.
    expect(shapeSummary(value, { maxDepth: 3 })).toBe('{ a: { b: { c: object } } }');
  });

  it('caps depth for nested arrays too', () => {
    const value = [[[1]]];
    expect(shapeSummary(value, { maxDepth: 2 })).toBe('Array(1) of Array(1) of Array');
  });

  it('uses a default maxDepth of 4', () => {
    const value = { a: { b: { c: { d: { e: 1 } } } } };
    expect(shapeSummary(value)).toBe('{ a: { b: { c: { d: object } } } }');
  });
});

describe('jsonShapeFromText', () => {
  it('parses JSON then summarizes it', () => {
    expect(jsonShapeFromText('{"id":1,"tags":["a","b"]}')).toBe(
      '{ id: 1, tags: Array(2) of "a" }',
    );
  });

  it('handles JSON arrays', () => {
    expect(jsonShapeFromText('[{"x":1}]')).toBe('Array(1) of { x: 1 }');
  });

  it('handles JSON scalars', () => {
    expect(jsonShapeFromText('"hello"')).toBe('"hello"');
    expect(jsonShapeFromText('null')).toBe('null');
  });

  it('returns null for non-JSON text', () => {
    expect(jsonShapeFromText('not json at all')).toBeNull();
    expect(jsonShapeFromText('{ unquoted: 1 }')).toBeNull();
    expect(jsonShapeFromText('')).toBeNull();
  });
});
