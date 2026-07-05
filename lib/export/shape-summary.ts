/**
 * Structural sketch of an arbitrary JSON value (pure).
 *
 * Produces a compact, human-readable outline of a value's shape rather than its
 * full contents — used by the exporter to summarize request/response bodies
 * without dumping large payloads. Objects render as `{ key: <shape>, ... }`
 * (first `maxKeys` keys, then `, +N more`), arrays as `Array(len) of <shape>`
 * (or `Array(0)`), and scalars as their type name (optionally with a short
 * literal). Depth and key breadth are bounded by `maxDepth` / `maxKeys`.
 *
 * Redaction is assumed to have already happened upstream, so short scalar
 * literals may be included verbatim.
 */

const DEFAULT_MAX_KEYS = 10;
const DEFAULT_MAX_DEPTH = 4;
const LITERAL_CAP = 24;

interface ShapeOpts {
  maxKeys?: number;
  maxDepth?: number;
}

/**
 * Render a short literal for a scalar, or the bare type name when the literal
 * would be too long / not helpful. Strings are quoted; numbers/booleans render
 * as their type when short, so callers still see the underlying kind.
 */
function scalarShape(value: string | number | boolean): string {
  if (typeof value === 'string') {
    if (value.length <= LITERAL_CAP) {
      return `"${value}"`;
    }
    return 'string';
  }
  if (typeof value === 'number') {
    const literal = String(value);
    if (literal.length <= LITERAL_CAP) {
      return literal;
    }
    return 'number';
  }
  // boolean
  return String(value);
}

function shapeOf(value: unknown, depth: number, maxKeys: number, maxDepth: number): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }

  const t = typeof value;

  if (t === 'string' || t === 'number' || t === 'boolean') {
    return scalarShape(value as string | number | boolean);
  }

  if (t === 'bigint') {
    return 'bigint';
  }
  if (t === 'function') {
    return 'function';
  }
  if (t === 'symbol') {
    return 'symbol';
  }

  // Reached the depth cap: describe the container without recursing further.
  if (depth >= maxDepth) {
    return Array.isArray(value) ? 'Array' : 'object';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Array(0)';
    }
    const inner = shapeOf(value[0], depth + 1, maxKeys, maxDepth);
    return `Array(${value.length}) of ${inner}`;
  }

  // Plain object (or any other object type — treat by its own enumerable keys).
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    return '{}';
  }

  const shown = keys.slice(0, maxKeys);
  const obj = value as Record<string, unknown>;
  const parts = shown.map((key) => {
    const inner = shapeOf(obj[key], depth + 1, maxKeys, maxDepth);
    return `${key}: ${inner}`;
  });

  const remaining = keys.length - shown.length;
  const suffix = remaining > 0 ? `, +${remaining} more` : '';
  return `{ ${parts.join(', ')}${suffix} }`;
}

/**
 * Produce a compact structural sketch of a JSON-like value.
 */
export function shapeSummary(value: unknown, opts?: ShapeOpts): string {
  const maxKeys = opts?.maxKeys ?? DEFAULT_MAX_KEYS;
  const maxDepth = opts?.maxDepth ?? DEFAULT_MAX_DEPTH;
  return shapeOf(value, 0, maxKeys, maxDepth);
}

/**
 * Parse `text` as JSON then summarize its shape. Returns `null` if the text is
 * not valid JSON.
 */
export function jsonShapeFromText(text: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return shapeSummary(parsed);
}
