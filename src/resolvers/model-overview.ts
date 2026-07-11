import { getPageTitles } from './confluence-content';
import { listAllDiagramLinks, listElements, listRelationships } from './model-store';
import type { DiagramLink, Element, Relationship } from '../types/model';

export interface ModelOverview {
  elements: Element[];
  relationships: Relationship[];
  diagramLinks: DiagramLink[];
  pageTitles: Record<string, string>;
}

/**
 * Single fetch backing the Model Explorer, search, filtering, and landscape
 * view - they all read from the same space-wide model snapshot.
 */
export async function getModelOverview(spaceKey: string): Promise<ModelOverview> {
  const [elements, relationships, diagramLinks] = await Promise.all([
    listElements(spaceKey),
    listRelationships(spaceKey),
    listAllDiagramLinks(spaceKey),
  ]);

  const pageTitles = await getPageTitles(diagramLinks.map((link) => link.confluencePageId));

  return { elements, relationships, diagramLinks, pageTitles };
}
