import { findChildElement, getElement, listDiagramLinksForElement } from './model-store';
import type { Element } from '../types/model';

export interface DrillDownResult {
  element?: Element;
  targetPageId?: string;
}

/**
 * Resolves what clicking a C4 element should do: if it has a child element
 * (a Container's Component, a SoftwareSystem's Container) that's been synced
 * from some diagram, navigate to that diagram. Otherwise there's nothing to
 * drill into - the caller should show the element's own details instead.
 */
export async function resolveDrillDown(
  spaceKey: string,
  elementId: string
): Promise<DrillDownResult> {
  const element = await getElement(spaceKey, elementId);
  const child = await findChildElement(spaceKey, elementId);

  if (!child) {
    return { element };
  }

  const [childLink] = await listDiagramLinksForElement(spaceKey, child.id);

  return { element, targetPageId: childLink?.confluencePageId };
}
