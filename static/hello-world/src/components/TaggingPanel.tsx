import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@forge/bridge';
import { updateAttachmentXml } from '../lib/confluence-write';

/** Mirrors wouldCreateCycle in src/lib/hierarchy.ts - the backend still validates authoritatively. */
function getDescendantIds(elements: ModelElement[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const el of elements) {
    if (el.parentId) {
      childrenByParent.set(el.parentId, [...(childrenByParent.get(el.parentId) ?? []), el.id]);
    }
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByParent.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (descendants.has(id)) {
      continue;
    }
    descendants.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return descendants;
}

const C4_TYPES = ['Person', 'SoftwareSystem', 'Container', 'Component', 'Code'];

interface DiagramCellSummary {
  mxCellId: string;
  name: string;
  tagged: boolean;
  c4ModelId?: string;
  c4Type?: string;
  description?: string;
  technology?: string;
  tags: string[];
  external: boolean;
  parentModelId?: string;
}

interface ModelElement {
  id: string;
  type: string;
  name: string;
  description?: string;
  technology?: string;
  tags: string[];
  external: boolean;
  parentId?: string;
}

interface PendingAttachmentWrite {
  attachmentId: string;
  filename: string;
  xml: string;
}

async function applyPendingWrite(
  pageId: string,
  pending: PendingAttachmentWrite | undefined
): Promise<void> {
  if (!pending) {
    return;
  }
  await updateAttachmentXml(pageId, pending.attachmentId, pending.filename, pending.xml);
}

export interface TaggingPanelProps {
  pageId: string;
  /** Called after a tag has been written back and the model re-synced, so the parent can reload the diagram. */
  onApplied: () => void;
}

export function TaggingPanel({ pageId, onApplied }: TaggingPanelProps) {
  const [cells, setCells] = useState<DiagramCellSummary[]>([]);
  const [elements, setElements] = useState<ModelElement[]>([]);
  const [selectedCellId, setSelectedCellId] = useState('');
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [existingElementId, setExistingElementId] = useState('');
  const [c4Type, setC4Type] = useState(C4_TYPES[0]);
  const [description, setDescription] = useState('');
  const [technology, setTechnology] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [external, setExternal] = useState(false);
  const [parentModelId, setParentModelId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cellsResponse, elementsResponse] = await Promise.all([
        invoke<
          { pageId: string },
          { found: boolean; message?: string; cells?: DiagramCellSummary[] }
        >('getDiagramCells', { pageId }),
        invoke<{ ok: boolean; message?: string; elements?: ModelElement[] }>('listModelElements'),
      ]);
      const cellsData = 'body' in cellsResponse ? cellsResponse.body : cellsResponse;
      const elementsData = 'body' in elementsResponse ? elementsResponse.body : elementsResponse;

      if (!cellsData.found) {
        setError(cellsData.message ?? 'No diagram found on this page');
        return;
      }
      setCells(cellsData.cells ?? []);
      setElements(elementsData.elements ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedCell = cells.find((c) => c.mxCellId === selectedCellId);

  const effectiveTargetId =
    linkMode === 'existing' && existingElementId ? existingElementId : selectedCell?.c4ModelId;

  const parentOptions = useMemo(() => {
    if (!effectiveTargetId) {
      return elements;
    }
    const excluded = getDescendantIds(elements, effectiveTargetId);
    excluded.add(effectiveTargetId);
    return elements.filter((el) => !excluded.has(el.id));
  }, [elements, effectiveTargetId]);

  useEffect(() => {
    if (parentModelId && !parentOptions.some((el) => el.id === parentModelId)) {
      setParentModelId('');
    }
  }, [parentModelId, parentOptions]);

  const handleSelectCell = (mxCellId: string) => {
    setSelectedCellId(mxCellId);
    setSavedMessage(null);
    const cell = cells.find((c) => c.mxCellId === mxCellId);
    if (cell?.tagged) {
      setLinkMode('new');
      setC4Type(cell.c4Type ?? C4_TYPES[0]);
      setDescription(cell.description ?? '');
      setTechnology(cell.technology ?? '');
      setTagsInput(cell.tags.join(', '));
      setExternal(cell.external);
      setParentModelId(cell.parentModelId ?? '');
    } else {
      setLinkMode('new');
      setC4Type(C4_TYPES[0]);
      setDescription('');
      setTechnology('');
      setTagsInput('');
      setExternal(false);
      setParentModelId('');
    }
  };

  const handleSelectExisting = (elementId: string) => {
    setExistingElementId(elementId);
    const element = elements.find((e) => e.id === elementId);
    if (element) {
      setC4Type(element.type);
      setDescription(element.description ?? '');
      setTechnology(element.technology ?? '');
      setTagsInput(element.tags.join(', '));
      setExternal(element.external);
      setParentModelId(element.parentId ?? '');
    }
  };

  const handleSave = async () => {
    if (!selectedCell) {
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const c4ModelId =
        linkMode === 'existing' && existingElementId
          ? existingElementId
          : (selectedCell.c4ModelId ?? crypto.randomUUID());

      const tag = {
        c4ModelId,
        c4Type,
        description: description || undefined,
        technology: technology || undefined,
        tags: Array.from(
          new Set(
            tagsInput
              .split(',')
              .map((t) => t.trim())
              .filter((t) => t.length > 0)
          )
        ),
        external,
        parentModelId: parentModelId || undefined,
      };

      const tagResponse = await invoke<
        { pageId: string; mxCellId: string; tag: typeof tag },
        { ok: boolean; message?: string; pendingAttachmentWrite?: PendingAttachmentWrite }
      >('tagDiagramElement', { pageId, mxCellId: selectedCell.mxCellId, tag });
      const tagData = 'body' in tagResponse ? tagResponse.body : tagResponse;

      if (!tagData.ok) {
        setError(tagData.message ?? 'Failed to tag element');
        return;
      }

      await applyPendingWrite(pageId, tagData.pendingAttachmentWrite);

      const syncResponse = await invoke<
        { pageId: string },
        { ok: boolean; message?: string; pendingAttachmentWrite?: PendingAttachmentWrite }
      >('syncModelFromPage', { pageId });
      const syncData = 'body' in syncResponse ? syncResponse.body : syncResponse;
      if (syncData.ok && syncData.pendingAttachmentWrite) {
        await applyPendingWrite(pageId, syncData.pendingAttachmentWrite);
        await invoke('confirmSyncApplied', { pageId });
      }

      setSavedMessage(`Tagged "${selectedCell.name}" as ${c4Type}.`);
      await refresh();
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p>Loading shapes...</p>;
  }

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', marginTop: 16 }}>
      <h4>Tag a shape</h4>
      <p style={{ color: '#8a6d00', fontSize: 13 }}>
        Tags are written directly to the attachment. If you reopen this diagram in the native
        draw.io editor after tagging and it saves, draw.io will overwrite these tags with its own
        older copy. Finish editing the diagram natively first, then tag - and avoid reopening the
        native editor afterward.
      </p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <label style={{ display: 'block', marginBottom: 8 }}>
        Shape:{' '}
        <select value={selectedCellId} onChange={(e) => handleSelectCell(e.target.value)}>
          <option value="">Select a shape...</option>
          {cells.map((cell) => (
            <option key={cell.mxCellId} value={cell.mxCellId}>
              {cell.name || cell.mxCellId} {cell.tagged ? `(tagged: ${cell.c4Type})` : '(untagged)'}
            </option>
          ))}
        </select>
      </label>

      {selectedCell && (
        <>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input type="radio" checked={linkMode === 'new'} onChange={() => setLinkMode('new')} />{' '}
            {selectedCell.tagged ? 'Edit this element' : 'Create a new element'}
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="radio"
              checked={linkMode === 'existing'}
              onChange={() => setLinkMode('existing')}
            />{' '}
            Link to an existing element
          </label>

          {linkMode === 'existing' && (
            <label style={{ display: 'block', marginBottom: 8 }}>
              Existing element:{' '}
              <select
                value={existingElementId}
                onChange={(e) => handleSelectExisting(e.target.value)}
              >
                <option value="">Select...</option>
                {elements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.name} ({el.type})
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={{ display: 'block', marginBottom: 8 }}>
            Type:{' '}
            <select value={c4Type} onChange={(e) => setC4Type(e.target.value)}>
              {C4_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Description:{' '}
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '60%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Technology:{' '}
            <input
              type="text"
              value={technology}
              onChange={(e) => setTechnology(e.target.value)}
              style={{ width: '60%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Tags (comma-separated):{' '}
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{ width: '60%' }}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={external}
              onChange={(e) => setExternal(e.target.checked)}
            />{' '}
            External
          </label>

          <label style={{ display: 'block', marginBottom: 8 }}>
            Parent element:{' '}
            <select value={parentModelId} onChange={(e) => setParentModelId(e.target.value)}>
              <option value="">None</option>
              {parentOptions.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.name} ({el.type})
                </option>
              ))}
            </select>
          </label>

          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save tag'}
          </button>
        </>
      )}

      {savedMessage && <p style={{ color: 'green' }}>{savedMessage}</p>}
    </div>
  );
}
