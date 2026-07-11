import React, { useCallback, useEffect, useState } from 'react';
import { invoke, view } from '@forge/bridge';
import { DrawioEmbed } from './components/DrawioEmbed';
import { TaggingPanel } from './components/TaggingPanel';
import { updateAttachmentXml } from './lib/confluence-write';

interface DrawioDiagramResult {
  found: boolean;
  message?: string;
  title?: string;
  attachmentId?: string;
  xml?: string;
  warning?: string;
}

interface PendingAttachmentWrite {
  attachmentId: string;
  filename: string;
  xml: string;
}

interface SyncResult {
  ok: boolean;
  message?: string;
  elementsUpserted?: number;
  relationshipsUpserted?: number;
  diagramLinksUpserted?: number;
  healed?: boolean;
  pendingAttachmentWrite?: PendingAttachmentWrite;
}

interface ElementDetail {
  id: string;
  type: string;
  name: string;
  description?: string;
  technology?: string;
  tags: string[];
  external: boolean;
  parentId?: string;
}

interface DrillDownResult {
  ok: boolean;
  message?: string;
  element?: ElementDetail;
  targetPageId?: string;
}

interface SyncStatus {
  ok: boolean;
  message?: string;
  hasSyncState?: boolean;
  inSync?: boolean;
  lastSyncedVersion?: number;
  currentVersion?: number;
}

function App() {
  const [pageId, setPageId] = useState('');
  const [result, setResult] = useState<DrawioDiagramResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [drillDownDetail, setDrillDownDetail] = useState<ElementDetail | null>(null);
  const [linkWriteStatus, setLinkWriteStatus] = useState<'idle' | 'writing' | 'success' | 'error'>(
    'idle'
  );
  const [linkWriteError, setLinkWriteError] = useState<string | null>(null);
  const [showTaggingPanel, setShowTaggingPanel] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const checkSyncStatus = useCallback(async (id: string) => {
    try {
      const response = await invoke<{ pageId: string }, SyncStatus>('getSyncStatus', {
        pageId: id,
      });
      const data = 'body' in response ? response.body : response;
      setSyncStatus(data);
    } catch {
      setSyncStatus(null);
    }
  }, []);

  const loadPage = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setDrillDownDetail(null);
      try {
        const response = await invoke<{ pageId: string }, DrawioDiagramResult>('getDrawioDiagram', {
          pageId: id,
        });
        const data = 'body' in response ? response.body : response;
        setResult(data);
        // DrawioEmbed only loads its xml prop once per mount (the embed protocol has no
        // "reload" action), so force a remount whenever we fetch fresh content - otherwise
        // an already-open diagram keeps showing its stale in-memory copy after a sync/heal/write.
        setReloadToken((prev) => prev + 1);
        if (data.found) {
          await checkSyncStatus(id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [checkSyncStatus]
  );

  useEffect(() => {
    view.getContext().then((context) => {
      const configuredPageId = context.extension?.config?.pageId;
      if (typeof configuredPageId === 'string' && configuredPageId) {
        setPageId(configuredPageId);
        loadPage(configuredPageId);
      }
    });
  }, [loadPage]);

  const handleFetch = () => loadPage(pageId);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    setLinkWriteStatus('idle');
    setLinkWriteError(null);
    try {
      const response = await invoke<{ pageId: string }, SyncResult>('syncModelFromPage', {
        pageId,
      });
      const data = 'body' in response ? response.body : response;
      setSyncResult(data);

      if (data.ok && data.pendingAttachmentWrite) {
        setLinkWriteStatus('writing');
        const { attachmentId, filename, xml } = data.pendingAttachmentWrite;
        try {
          await updateAttachmentXml(pageId, attachmentId, filename, xml);
          await invoke('confirmSyncApplied', { pageId });
          setLinkWriteStatus('success');
          await loadPage(pageId);
        } catch (writeErr) {
          setLinkWriteStatus('error');
          setLinkWriteError(writeErr instanceof Error ? writeErr.message : String(writeErr));
        }
      } else {
        await checkSyncStatus(pageId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleDrillDown = async (elementId: string) => {
    setError(null);
    try {
      const response = await invoke<{ elementId: string }, DrillDownResult>('resolveDrillDown', {
        elementId,
      });
      const data = 'body' in response ? response.body : response;
      if (!data.ok) {
        setError(data.message ?? 'Drill-down failed');
        return;
      }
      if (data.targetPageId) {
        setHistory((prev) => [...prev, pageId]);
        setPageId(data.targetPageId);
        await loadPage(data.targetPageId);
      } else if (data.element) {
        setDrillDownDetail(data.element);
      } else {
        setError('This shape is linked to an element that no longer exists in the model.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleBack = async () => {
    const previous = history[history.length - 1];
    if (!previous) {
      return;
    }
    setHistory((prev) => prev.slice(0, -1));
    setPageId(previous);
    await loadPage(previous);
  };

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h3>C4 Confluence — draw.io attachment fetch test</h3>
      <p>Enter a Confluence page ID that has a .drawio/.xml attachment.</p>
      <input
        type="text"
        placeholder="Page ID"
        value={pageId}
        onChange={(e) => setPageId(e.target.value)}
        style={{ marginRight: 8 }}
      />
      <button onClick={handleFetch} disabled={!pageId || loading}>
        {loading ? 'Fetching...' : 'Fetch diagram'}
      </button>
      <button onClick={handleSync} disabled={!pageId || syncing} style={{ marginLeft: 8 }}>
        {syncing ? 'Syncing...' : 'Sync model from diagram'}
      </button>
      <button
        onClick={() => setShowTaggingPanel((prev) => !prev)}
        disabled={!pageId}
        style={{ marginLeft: 8 }}
      >
        {showTaggingPanel ? 'Hide tagging panel' : 'Tag a shape'}
      </button>
      {history.length > 0 && (
        <button onClick={handleBack} style={{ marginLeft: 8 }}>
          ← Back
        </button>
      )}

      {syncStatus?.ok && syncStatus.hasSyncState && !syncStatus.inSync && (
        <p style={{ color: '#8a6d00' }}>
          ⚠ This diagram has changed since the last sync (synced version{' '}
          {syncStatus.lastSyncedVersion}, current version {syncStatus.currentVersion}). The model
          may be out of date - click &ldquo;Sync model from diagram&rdquo; to update it.
        </p>
      )}

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {result && (
        <div style={{ marginTop: 16 }}>
          {result.found && result.xml ? (
            <>
              <p>
                Found <strong>{result.title}</strong> (attachment id {result.attachmentId})
              </p>
              {result.warning && <p style={{ color: '#8a6d00' }}>⚠ {result.warning}</p>}
              <DrawioEmbed
                key={`${pageId}:${reloadToken}`}
                xml={result.xml}
                readOnly
                onDrillDown={handleDrillDown}
              />
              <details style={{ marginTop: 8 }}>
                <summary>Raw XML</summary>
                <textarea readOnly rows={12} style={{ width: '100%' }} value={result.xml} />
              </details>
            </>
          ) : (
            <p>{result.message}</p>
          )}
        </div>
      )}

      {showTaggingPanel && pageId && (
        <TaggingPanel pageId={pageId} onApplied={() => loadPage(pageId)} />
      )}

      {drillDownDetail && (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #ddd' }}>
          <h4>
            {drillDownDetail.name} ({drillDownDetail.type})
          </h4>
          {drillDownDetail.description && <p>{drillDownDetail.description}</p>}
          {drillDownDetail.technology && (
            <p>
              <em>Technology:</em> {drillDownDetail.technology}
            </p>
          )}
          {drillDownDetail.tags.length > 0 && (
            <p>
              <em>Tags:</em> {drillDownDetail.tags.join(', ')}
            </p>
          )}
          <p>
            <em>External:</em> {drillDownDetail.external ? 'yes' : 'no'}
          </p>
          <p style={{ color: '#666' }}>No further diagram registered for this element yet.</p>
        </div>
      )}

      {syncResult && (
        <div style={{ marginTop: 16 }}>
          {syncResult.ok ? (
            <>
              <p>
                Synced: {syncResult.elementsUpserted} elements, {syncResult.relationshipsUpserted}{' '}
                relationships, {syncResult.diagramLinksUpserted} diagram links.
              </p>
              {syncResult.healed && (
                <p style={{ color: '#8a6d00' }}>
                  One or more shapes had lost their tags (likely overwritten by a native draw.io
                  save) and were restored from the model store.
                </p>
              )}
              {linkWriteStatus === 'writing' && (
                <p>Writing drill-down links back to the diagram...</p>
              )}
              {linkWriteStatus === 'success' && (
                <p>Drill-down links written back to the diagram.</p>
              )}
              {linkWriteStatus === 'error' && (
                <p style={{ color: 'red' }}>Could not write drill-down links: {linkWriteError}</p>
              )}
            </>
          ) : (
            <p style={{ color: 'red' }}>Sync failed: {syncResult.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
