import { getFirstDrawioDiagram } from './confluence-content';
import { listVertexCells } from '../lib/mxgraph-parser';
import { applyElementTag } from '../lib/tagging';
import type { ElementTagInput } from '../lib/tagging';
import type { DiagramCellSummary } from '../lib/mxgraph-parser';
import type { PendingAttachmentWrite } from '../types/model';

export interface GetDiagramCellsResult {
  found: boolean;
  message?: string;
  cells?: DiagramCellSummary[];
}

export async function getDiagramCells(pageId: string): Promise<GetDiagramCellsResult> {
  const diagram = await getFirstDrawioDiagram(pageId);

  if (!diagram.found || !diagram.xml) {
    return { found: false, message: diagram.message };
  }

  return { found: true, cells: listVertexCells(diagram.xml) };
}

export interface TagDiagramElementResult {
  pendingAttachmentWrite: PendingAttachmentWrite;
}

export async function tagDiagramElement(
  pageId: string,
  mxCellId: string,
  tag: ElementTagInput
): Promise<TagDiagramElementResult> {
  const diagram = await getFirstDrawioDiagram(pageId);

  if (!diagram.found || !diagram.xml || !diagram.attachmentId) {
    throw new Error(diagram.message ?? `No diagram found on page ${pageId}`);
  }

  const updatedXml = applyElementTag(diagram.xml, mxCellId, tag);

  return {
    pendingAttachmentWrite: {
      attachmentId: diagram.attachmentId,
      filename: diagram.title ?? 'diagram.drawio',
      xml: updatedXml,
    },
  };
}
