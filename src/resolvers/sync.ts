import { getFirstDrawioDiagram, listDrawioAttachments } from './confluence-content';
import { parseC4Diagram } from '../lib/mxgraph-parser';
import { reconcileDiagram } from '../lib/reconcile';
import { ensureDrillDownLinks } from '../lib/link-writer';
import { healDiagram } from '../lib/heal';
import {
  listAllDiagramLinks,
  listElements,
  upsertDiagramLink,
  upsertElement,
  upsertPageSyncState,
  upsertRelationship,
} from './model-store';
import type { SyncResult } from '../types/model';

const EMPTY_RESULT: SyncResult = {
  elementsUpserted: 0,
  relationshipsUpserted: 0,
  diagramLinksUpserted: 0,
  healed: false,
};

/**
 * Records the diagram's current attachment version as "synced" - callers
 * must only call this once the model store AND the diagram's own attributes
 * (links etc.) are fully consistent with that exact version. If a caller
 * still has a pendingAttachmentWrite to apply, recording now would be wrong:
 * the write that follows creates a new version this sync never saw.
 */
export async function recordPageSynced(spaceKey: string, pageId: string): Promise<void> {
  const [attachment] = await listDrawioAttachments(pageId);
  if (!attachment || attachment.version === undefined) {
    return;
  }
  await upsertPageSyncState(spaceKey, {
    pageId,
    attachmentId: attachment.id,
    version: attachment.version,
    syncedAt: new Date().toISOString(),
  });
}

export async function syncModelFromPage(spaceKey: string, pageId: string): Promise<SyncResult> {
  const diagram = await getFirstDrawioDiagram(pageId);

  if (!diagram.found || !diagram.xml || !diagram.attachmentId) {
    return EMPTY_RESULT;
  }

  const [pageLinks, allElements] = await Promise.all([
    listAllDiagramLinks(spaceKey).then((links) =>
      links.filter((link) => link.confluencePageId === pageId)
    ),
    listElements(spaceKey),
  ]);
  const elementsById = new Map(allElements.map((element) => [element.id, element]));

  const healResult = healDiagram(diagram.xml, pageLinks, elementsById);

  const parsed = parseC4Diagram(healResult.xml);
  const { elements, relationships, diagramLinks } = reconcileDiagram(
    parsed,
    pageId,
    diagram.attachmentId
  );

  for (const element of elements) {
    await upsertElement(spaceKey, element);
  }
  for (const relationship of relationships) {
    await upsertRelationship(spaceKey, relationship);
  }
  for (const link of diagramLinks) {
    await upsertDiagramLink(spaceKey, link);
  }

  const linkResult = ensureDrillDownLinks(healResult.xml, parsed.elements);
  const finalXml = linkResult.changed ? linkResult.xml : healResult.xml;
  const needsWrite = healResult.healed || linkResult.changed;

  if (!needsWrite) {
    // Nothing more will change the attachment - this version is now fully reconciled.
    await recordPageSynced(spaceKey, pageId);
  }

  return {
    elementsUpserted: elements.length,
    relationshipsUpserted: relationships.length,
    diagramLinksUpserted: diagramLinks.length,
    healed: healResult.healed,
    pendingAttachmentWrite: needsWrite
      ? {
          attachmentId: diagram.attachmentId,
          filename: diagram.title ?? 'diagram.drawio',
          xml: finalXml,
        }
      : undefined,
  };
}
