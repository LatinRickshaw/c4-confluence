import type { C4ElementType } from '../lib/c4-shapes';

export interface Element {
  id: string;
  type: C4ElementType | string;
  name: string;
  description?: string;
  technology?: string;
  tags: string[];
  external: boolean;
  parentId?: string;
}

export interface Relationship {
  id: string;
  sourceElementId: string;
  targetElementId: string;
  description?: string;
  technology?: string;
  tags: string[];
}

export interface DiagramLink {
  elementId: string;
  confluencePageId: string;
  confluenceAttachmentId: string;
  mxCellId: string;
}

export interface PageSyncState {
  pageId: string;
  attachmentId: string;
  version: number;
  syncedAt: string;
}

export interface PendingAttachmentWrite {
  attachmentId: string;
  filename: string;
  xml: string;
}

export interface SyncResult {
  elementsUpserted: number;
  relationshipsUpserted: number;
  diagramLinksUpserted: number;
  /** True if a previously-tagged shape had lost its attributes and was restored from the model store. */
  healed: boolean;
  /**
   * Present when shapes need their drill-down link updated. The write itself
   * happens from the frontend via @forge/bridge's requestConfluence, which
   * runs in the user's own authenticated session - api.asUser() from a
   * backend resolver hits a hard NEEDS_AUTHENTICATION_ERR wall for this
   * endpoint in Custom UI apps, and api.asApp() isn't accepted by Confluence
   * for attachment writes at all.
   */
  pendingAttachmentWrite?: PendingAttachmentWrite;
}
