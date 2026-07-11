import { listVertexCells } from './mxgraph-parser';
import { applyElementTag } from './tagging';
import type { DiagramLink, Element } from '../types/model';

export interface HealResult {
  xml: string;
  healed: boolean;
}

/**
 * Restores C4 attributes on cells that still exist (same mxCellId) but lost
 * their tag - typically because the diagram was edited and saved in the
 * native draw.io editor, which loaded an older in-memory copy and overwrote
 * our out-of-band attribute write. Per the brief's own model (§4: "Elements
 * are the source of truth... the diagram cell is a view of an Element"),
 * the model store - not the diagram XML - is authoritative for an element's
 * metadata, so sync heals the diagram from it rather than silently losing
 * the tag.
 *
 * This can only restore a cell that still exists under the same mxCellId.
 * If the shape was deleted and redrawn (new id), there's no way to know the
 * new shape is meant to replace the old one - that DiagramLink just becomes
 * orphaned, same as if the element were deleted outright.
 */
export function healDiagram(
  xml: string,
  pageLinks: DiagramLink[],
  elementsById: Map<string, Element>
): HealResult {
  const cellsById = new Map(listVertexCells(xml).map((cell) => [cell.mxCellId, cell]));

  let currentXml = xml;
  let healed = false;

  for (const link of pageLinks) {
    const cell = cellsById.get(link.mxCellId);
    if (!cell || cell.c4ModelId === link.elementId) {
      continue;
    }

    const element = elementsById.get(link.elementId);
    if (!element) {
      continue;
    }

    currentXml = applyElementTag(currentXml, link.mxCellId, {
      c4ModelId: element.id,
      c4Type: element.type,
      description: element.description,
      technology: element.technology,
      tags: element.tags,
      external: element.external,
      parentModelId: element.parentId,
    });
    healed = true;
  }

  return { xml: currentXml, healed };
}
