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

  s = sanitizeLlmJson(s);

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

/**
 * String-aware JSON cleanup. All repairs happen ONLY outside double-quoted
 * strings, so legitimate content survives untouched:
 *   • apostrophes in values ("'San Francisco', -apple-system") are preserved
 *   • URLs ("https://…") are not eaten by comment stripping
 *
 * Repairs applied outside strings:
 *   • // line comments and  block comments are removed
 *   • 'single-quoted' strings are converted to "double-quoted"
 * Then (globally, safe by construction):
 *   • unquoted object keys get quoted
 *   • trailing commas before } or ] are removed
 */
function sanitizeLlmJson(s: string): string {
  let out = '';
  let i = 0;
  const n = s.length;

  while (i < n) {
    const ch = s[i];

    if (ch === '"') {
      // Copy double-quoted strings verbatim (respecting escapes).
      let j = i + 1;
      while (j < n) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '"') break;
        j++;
      }
      out += s.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }

    if (ch === "'") {
      // Genuine single-quoted string → convert to double-quoted.
      let j = i + 1;
      let inner = '';
      while (j < n && s[j] !== "'") {
        if (s[j] === '\\') { inner += s[j + 1] ?? ''; j += 2; continue; }
        inner += s[j];
        j++;
      }
      out += '"' + inner.replace(/"/g, '\\"') + '"';
      i = j + 1;
      continue;
    }

    if (ch === '/' && s[i + 1] === '/') {
      // Line comment → skip to end of line.
      while (i < n && s[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && s[i + 1] === '*') {
      // Block comment → skip past the closing */
      i += 2;
      while (i < n && !(s[i] === '*' && s[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    out += ch;
    i++;
  }

  // Quote unquoted object keys: { value: 40 } -> { "value": 40 }
  out = out.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3');

  // Remove trailing commas before } or ]
  out = out.replace(/,\s*([}\]])/g, '$1');

  return out;
}
