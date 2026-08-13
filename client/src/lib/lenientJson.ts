/**
 * lenientJson — tolerant JSON parsing for LLM-generated configuration.
 *
 * LLMs frequently emit near-JSON with unquoted object keys ({ value: 40 }),
 * trailing commas, single quotes, JS comments, or inline functions. This
 * sanitizes the common cases so `JSON.parse` succeeds instead of surfacing a
 * "Chart Rendering Error".
 */
export function lenientParse(input: string): any {
  let s = input.trim();

  // Strip markdown code fences (```chart ... ```)
  s = s.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');

  // Extract the first complete {...} block
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in chart configuration');
  }
  s = s.slice(start, end + 1);

  // Remove line comments
  s = s.replace(/\/\/[^\n]*/g, '');

  // Quote unquoted object keys: { value: 40 } -> { "value": 40 }
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Replace single-quoted strings with double-quoted
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  try {
    return JSON.parse(s);
  } catch (firstError) {
    // Second pass: neutralize JS function expressions (rare in configs, but
    // LLMs sometimes emit e.g. "formatter": function(params) {...}).
    s = s.replace(/:\s*function\s*\([^)]*\)\s*\{[\s\S]*?\}/g, ': null');
    try {
      return JSON.parse(s);
    } catch {
      // Let the caller surface the original error context
      throw firstError;
    }
  }
}
