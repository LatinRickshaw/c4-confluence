import type { ParsedC4Diagram } from './mxgraph-parser';
import type { DiagramLink, Element, Relationship } from '../types/model';

export interface ReconciledModel {
  elements: Element[];
  relationships: Relationship[];
  diagramLinks: DiagramLink[];
}

/**
 * Relationships aren't always individually tagged with a c4ModelId (an edge
 * inferred purely from its endpoints has none). Deriving a stable id from the
 * endpoint pair keeps re-sync idempotent - the same connection always
 * resolves to the same storage key instead of accumulating duplicates.
 */
export function deriveRelationshipId(sourceElementId: string, targetElementId: string): string {
  return `${sourceElementId}::${targetElementId}`;
}

/**
 * Maps a parsed diagram into the model records that should be upserted.
 * An Element's id is always its c4ModelId, so re-running this on an
 * unchanged diagram yields byte-identical records - idempotent by
 * construction once the caller upserts by id.
 */
export function reconcileDiagram(
  parsed: ParsedC4Diagram,
  confluencePageId: string,
  confluenceAttachmentId: string
): ReconciledModel {
  const elements: Element[] = parsed.elements.map((element) => ({
    id: element.c4ModelId,
    type: element.c4Type,
    name: element.name,
    description: element.description,
    technology: element.technology,
    tags: element.tags,
    external: element.external,
    parentId: element.parentModelId,
  }));

  const relationships: Relationship[] = parsed.relationships.map((relationship) => ({
    id:
      relationship.c4ModelId ??
      deriveRelationshipId(relationship.sourceModelId, relationship.targetModelId),
    sourceElementId: relationship.sourceModelId,
    targetElementId: relationship.targetModelId,
    description: relationship.description,
    technology: relationship.technology,
    tags: relationship.tags,
  }));

  const diagramLinks: DiagramLink[] = parsed.elements.map((element) => ({
    elementId: element.c4ModelId,
    confluencePageId,
    confluenceAttachmentId,
    mxCellId: element.mxCellId,
  }));

  return { elements, relationships, diagramLinks };
}
