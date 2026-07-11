import { listDrawioAttachments } from './confluence-content';
import { getPageSyncState } from './model-store';

export interface SyncStatus {
  hasSyncState: boolean;
  inSync: boolean;
  lastSyncedVersion?: number;
  currentVersion?: number;
}

/**
 * Compares the diagram's current attachment version against what was
 * recorded at the last successful sync. A page that's never been synced
 * isn't "stale" - there's nothing to compare against yet - so it reports
 * in sync until a first sync establishes a baseline.
 */
export async function getSyncStatus(spaceKey: string, pageId: string): Promise<SyncStatus> {
  const [syncState, attachments] = await Promise.all([
    getPageSyncState(spaceKey, pageId),
    listDrawioAttachments(pageId),
  ]);

  const currentVersion = attachments[0]?.version;

  if (!syncState) {
    return { hasSyncState: false, inSync: true, currentVersion };
  }

  return {
    hasSyncState: true,
    inSync: currentVersion !== undefined && currentVersion === syncState.version,
    lastSyncedVersion: syncState.version,
    currentVersion,
  };
}
