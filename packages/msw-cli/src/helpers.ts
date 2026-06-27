export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
  'ALL',
];

/**
 * Split an optional leading HTTP method token off each pattern (so a copied
 * status line like 'GET /api/users' is understood as method=GET +
 * pattern '/api/users'), and merge those with any explicit --method flags.
 */
export function parsePatternsAndMethods(
  patterns: string[],
  methodFlags?: string[],
): { patterns: string[]; methods: string[] | undefined } {
  const methods = new Set<string>();
  for (const method of methodFlags ?? []) {
    methods.add(method.toUpperCase());
  }

  const cleanedPatterns = patterns.map((pattern) => {
    const match = pattern.match(/^([A-Za-z]+)\s+(.+)$/);
    const leadingToken = match?.[1];
    const remainder = match?.[2];
    if (
      leadingToken &&
      remainder &&
      HTTP_METHODS.includes(leadingToken.toUpperCase())
    ) {
      methods.add(leadingToken.toUpperCase());
      return remainder.trim();
    }
    return pattern;
  });

  return {
    patterns: cleanedPatterns,
    methods: methods.size > 0 ? Array.from(methods) : undefined,
  };
}

export function formatSuccess(type: string, data: Record<string, any>): string {
  const handlerCount = Array.isArray(data.activeHandlers)
    ? data.activeHandlers.length
    : 0;

  if (type === 'REMOVE_HANDLERS' && typeof data.removedCount === 'number') {
    if (data.removedCount === 0) {
      return `⚠️ Removed 0 handlers — no active handler matched the pattern(s). Patterns match the handler URL only (substring or * glob); drop any HTTP method prefix or use -m/--method to filter by method. Active handlers: ${handlerCount}`;
    }
    return `✅ Removed ${data.removedCount} handler(s). Active handlers: ${handlerCount}`;
  }

  if (type === 'UPDATE_HANDLERS' && typeof data.matchedCount === 'number') {
    const added = typeof data.addedCount === 'number' ? data.addedCount : 0;
    if (data.matchedCount === 0) {
      return `⚠️ 0 handlers matched — added ${added} new handler(s) (behaved like 'add'). If you meant to replace an existing handler, the pattern did not match: patterns match the handler URL only; drop any HTTP method prefix or use -m/--method. Active handlers: ${handlerCount}`;
    }
    return `✅ Updated: replaced ${data.matchedCount} handler(s) with ${added} new. Active handlers: ${handlerCount}`;
  }

  return `✅ ${data.message || `Success. Active handlers: ${handlerCount}`}`;
}
