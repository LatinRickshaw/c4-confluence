import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke, router } from '@forge/bridge';
import { LandscapeView } from './LandscapeView';
import { ElementDetailPanel } from './ElementDetailPanel';

interface DrillDownResult {
  ok: boolean;
  message?: string;
  element?: ModelElement;
  targetPageId?: string;
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

interface ModelRelationship {
  id: string;
  sourceElementId: string;
  targetElementId: string;
  description?: string;
}

interface DiagramLink {
  elementId: string;
  confluencePageId: string;
}

interface ModelOverview {
  elements: ModelElement[];
  relationships: ModelRelationship[];
  diagramLinks: DiagramLink[];
  pageTitles: Record<string, string>;
}

interface TreeNode extends ModelElement {
  children: TreeNode[];
}

function buildTree(elements: ModelElement[]): TreeNode[] {
  const nodesById = new Map<string, TreeNode>(
    elements.map((el) => [el.id, { ...el, children: [] }])
  );
  const roots: TreeNode[] = [];

  for (const node of nodesById.values()) {
    if (node.parentId && nodesById.has(node.parentId)) {
      nodesById.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface FilterCriteria {
  tag: string;
  technology: string;
  externalOnly: boolean;
}

function elementMatchesFilter(el: ModelElement, filter: FilterCriteria): boolean {
  if (filter.tag && !el.tags.includes(filter.tag)) {
    return false;
  }
  if (
    filter.technology &&
    !(el.technology ?? '').toLowerCase().includes(filter.technology.toLowerCase())
  ) {
    return false;
  }
  if (filter.externalOnly && !el.external) {
    return false;
  }
  return true;
}

function nodeMatchesOrHasMatch(node: TreeNode, filter: FilterCriteria): boolean {
  return (
    elementMatchesFilter(node, filter) ||
    node.children.some((child) => nodeMatchesOrHasMatch(child, filter))
  );
}

function TreeItem({
  node,
  depth,
  filter,
  onDelete,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  filter: FilterCriteria;
  onDelete: (elementId: string, name: string) => void;
  onSelect: (elementId: string) => void;
}) {
  if (!nodeMatchesOrHasMatch(node, filter)) {
    return null;
  }

  return (
    <div style={{ marginLeft: depth * 20, marginTop: 6 }}>
      <div>
        <button
          onClick={() => onSelect(node.id)}
          style={{
            fontWeight: 'bold',
            padding: 0,
            border: 'none',
            background: 'none',
            color: '#1a56db',
            cursor: 'pointer',
          }}
        >
          {node.name}
        </button>{' '}
        <span style={{ color: '#666' }}>({node.type})</span>
        {node.external && <span style={{ color: '#666' }}> · external</span>}{' '}
        <button onClick={() => onDelete(node.id, node.name)} style={{ fontSize: 11 }}>
          Delete
        </button>
      </div>
      {node.description && <div style={{ color: '#444', fontSize: 13 }}>{node.description}</div>}
      {node.technology && (
        <div style={{ color: '#444', fontSize: 13 }}>
          <em>Technology:</em> {node.technology}
        </div>
      )}
      {node.tags.length > 0 && (
        <div style={{ color: '#444', fontSize: 13 }}>
          <em>Tags:</em> {node.tags.join(', ')}
        </div>
      )}
      {node.children.map((child) => (
        <TreeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          filter={filter}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function ModelExplorer() {
  const [overview, setOverview] = useState<ModelOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'explorer' | 'landscape'>('explorer');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [technologyFilter, setTechnologyFilter] = useState('');
  const [externalOnly, setExternalOnly] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    return invoke<{ ok: boolean; message?: string } & Partial<ModelOverview>>('getModelOverview')
      .then((response) => {
        const data = 'body' in response ? response.body : response;
        if (!data.ok) {
          setError(data.message ?? 'Failed to load model');
          return;
        }
        setOverview({
          elements: data.elements ?? [],
          relationships: data.relationships ?? [],
          diagramLinks: data.diagramLinks ?? [],
          pageTitles: data.pageTitles ?? {},
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = async (elementId: string, name: string) => {
    if (
      !window.confirm(
        `Delete "${name}" from the model? This also removes its diagram links and relationships.`
      )
    ) {
      return;
    }
    const response = await invoke<{ elementId: string }, { ok: boolean; message?: string }>(
      'deleteModelElement',
      {
        elementId,
      }
    );
    const data = 'body' in response ? response.body : response;
    if (!data.ok) {
      setError(data.message ?? 'Failed to delete element');
      return;
    }
    if (selectedElementId === elementId) {
      setSelectedElementId(null);
    }
    await refresh();
  };

  const handleLandscapeClick = async (elementId: string) => {
    setError(null);
    const response = await invoke<{ elementId: string }, DrillDownResult>('resolveDrillDown', {
      elementId,
    });
    const data = 'body' in response ? response.body : response;
    if (!data.ok) {
      setError(data.message ?? 'Drill-down failed');
      return;
    }
    if (data.targetPageId) {
      await router.navigate({ target: 'contentView', contentId: data.targetPageId });
    } else {
      setSelectedElementId(elementId);
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    overview?.elements.forEach((el) => el.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [overview]);

  const tree = useMemo(() => buildTree(overview?.elements ?? []), [overview]);

  const searchResults = useMemo(() => {
    if (!overview || !search.trim()) {
      return null;
    }
    const query = search.trim().toLowerCase();
    return overview.elements.filter(
      (el) =>
        el.name.toLowerCase().includes(query) ||
        el.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [overview, search]);

  const selectedElement = selectedElementId
    ? overview?.elements.find((el) => el.id === selectedElementId)
    : undefined;

  if (loading) {
    return <p>Loading model...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
  }

  const filter: FilterCriteria = { tag: tagFilter, technology: technologyFilter, externalOnly };

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h3>C4 Model Explorer</h3>

      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setTab('explorer')} disabled={tab === 'explorer'}>
          Explorer
        </button>
        <button
          onClick={() => setTab('landscape')}
          disabled={tab === 'landscape'}
          style={{ marginLeft: 8 }}
        >
          Landscape
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name or tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginRight: 16 }}
        />
        <label style={{ marginRight: 12 }}>
          Tag:{' '}
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">All</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label style={{ marginRight: 12 }}>
          Technology:{' '}
          <input
            type="text"
            value={technologyFilter}
            onChange={(e) => setTechnologyFilter(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={externalOnly}
            onChange={(e) => setExternalOnly(e.target.checked)}
          />{' '}
          External only
        </label>
      </div>

      {searchResults ? (
        <div>
          <h4>Search results</h4>
          {searchResults.length === 0 && <p>No elements match &ldquo;{search}&rdquo;.</p>}
          {searchResults.map((el) => {
            const pages = overview!.diagramLinks
              .filter((link) => link.elementId === el.id)
              .map((link) => overview!.pageTitles[link.confluencePageId] ?? link.confluencePageId);
            const uniquePages = Array.from(new Set(pages));
            return (
              <div key={el.id} style={{ marginBottom: 12 }}>
                <button
                  onClick={() => setSelectedElementId(el.id)}
                  style={{
                    fontWeight: 'bold',
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    color: '#1a56db',
                    cursor: 'pointer',
                  }}
                >
                  {el.name}
                </button>{' '}
                <span style={{ color: '#666' }}>({el.type})</span>{' '}
                <button onClick={() => handleDelete(el.id, el.name)} style={{ fontSize: 11 }}>
                  Delete
                </button>
                <div style={{ color: '#444', fontSize: 13 }}>
                  <em>Appears on:</em>{' '}
                  {uniquePages.length > 0 ? uniquePages.join(', ') : 'no synced diagrams'}
                </div>
              </div>
            );
          })}
        </div>
      ) : tab === 'explorer' ? (
        <>
          {tree.length === 0 && (
            <p>
              No elements found yet. Tag some shapes on a diagram and sync to populate the model.
            </p>
          )}
          {tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              depth={0}
              filter={filter}
              onDelete={handleDelete}
              onSelect={setSelectedElementId}
            />
          ))}
        </>
      ) : (
        <LandscapeView
          elements={overview?.elements ?? []}
          relationships={overview?.relationships ?? []}
          onElementClick={handleLandscapeClick}
        />
      )}

      {selectedElement && overview && (
        <ElementDetailPanel
          element={selectedElement}
          elements={overview.elements}
          relationships={overview.relationships}
          diagramLinks={overview.diagramLinks}
          pageTitles={overview.pageTitles}
          onClose={() => setSelectedElementId(null)}
        />
      )}
    </div>
  );
}
