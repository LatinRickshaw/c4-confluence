import type { Element } from '../types/model';

/**
 * True if setting elementId's parent to candidateParentId would create a
 * cycle (including the trivial self-parent case) or make it its own
 * descendant's descendant. A cyclic parentId chain makes affected elements
 * unreachable from any root in the Explorer tree - they'd silently vanish
 * rather than error, since tree-building only ever walks down from roots.
 */
export function wouldCreateCycle(
  elements: Pick<Element, 'id' | 'parentId'>[],
  elementId: string,
  candidateParentId: string
): boolean {
  if (elementId === candidateParentId) {
    return true;
  }

  const parentById = new Map(elements.map((el) => [el.id, el.parentId]));

  let current: string | undefined = candidateParentId;
  const seen = new Set<string>();
  while (current) {
    if (current === elementId) {
      return true;
    }
    if (seen.has(current)) {
      // Existing data already has a cycle unrelated to this change - not this call's problem to fix.
      return false;
    }
    seen.add(current);
    current = parentById.get(current);
  }

  return false;
}
