/**
 * Name-based exclusion for the GP catalog.
 *
 * Starlink is roughly 8,000 of the ~10,000 objects in the "active" group, so
 * without a way to drop a constellation the rest of the catalog is buried under
 * it and the group is effectively unusable for looking at anything else. Terms
 * are matched case-insensitively as substrings of OBJECT_NAME and separated by
 * commas, so "starlink, oneweb" hides both megaconstellations at once.
 *
 * This runs before the catalog is sharded into the SGP4 workers, so excluded
 * objects cost no propagation, not just no pixels.
 */

/** Split a user-typed spec into lowercase match terms, dropping blanks. */
export function parseExcludeTerms(spec: unknown): string[] {
  if (typeof spec !== 'string') return [];
  return spec
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 0);
}

/**
 * Drop records whose OBJECT_NAME contains any term. Returns the original array
 * when nothing is excluded, so the common case adds no copy and no re-render.
 */
export function applyExclude<T extends { OBJECT_NAME?: string }>(records: T[], spec: unknown): T[] {
  const terms = parseExcludeTerms(spec);
  if (terms.length === 0) return records;
  return records.filter((record) => {
    const name = (record.OBJECT_NAME ?? '').toLowerCase();
    return !terms.some((term) => name.includes(term));
  });
}
