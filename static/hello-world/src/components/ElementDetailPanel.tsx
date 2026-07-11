import React from 'react';

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

export interface ElementDetailPanelProps {
  element: ModelElement;
  elements: ModelElement[];
  relationships: ModelRelationship[];
  diagramLinks: DiagramLink[];
  pageTitles: Record<string, string>;
  onClose: () => void;
}

/**
 * The full element detail view (brief §5, v1 feature 9): description,
 * technology, tags, relationships in/out, and every diagram the element
 * appears on. Used consistently from the Explorer tree, search results, and
 * the Landscape view, rather than each surface showing its own partial
 * subset of this information.
 */
export function ElementDetailPanel({
  element,
  elements,
  relationships,
  diagramLinks,
  pageTitles,
  onClose,
}: ElementDetailPanelProps) {
  const elementsById = new Map(elements.map((el) => [el.id, el]));
  const parent = element.parentId ? elementsById.get(element.parentId) : undefined;

  const outgoing = relationships.filter((rel) => rel.sourceElementId === element.id);
  const incoming = relationships.filter((rel) => rel.targetElementId === element.id);

  const pages = Array.from(
    new Set(
      diagramLinks
        .filter((link) => link.elementId === element.id)
        .map((link) => pageTitles[link.confluencePageId] ?? link.confluencePageId)
    )
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        background: '#fff',
        borderLeft: '1px solid #ccc',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
        padding: 20,
        overflowY: 'auto',
        fontFamily: 'sans-serif',
      }}
    >
      <button onClick={onClose} style={{ float: 'right' }}>
        Close
      </button>
      <h3 style={{ marginTop: 0 }}>{element.name}</h3>
      <p style={{ color: '#666' }}>
        {element.type}
        {element.external && ' · external'}
        {parent && (
          <>
            {' · child of '}
            <strong>{parent.name}</strong>
          </>
        )}
      </p>

      {element.description && <p>{element.description}</p>}
      {element.technology && (
        <p>
          <em>Technology:</em> {element.technology}
        </p>
      )}
      {element.tags.length > 0 && (
        <p>
          <em>Tags:</em> {element.tags.join(', ')}
        </p>
      )}

      <h4>Relationships out ({outgoing.length})</h4>
      {outgoing.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>None.</p>}
      <ul style={{ paddingLeft: 18 }}>
        {outgoing.map((rel) => (
          <li key={rel.id} style={{ fontSize: 13 }}>
            → {elementsById.get(rel.targetElementId)?.name ?? rel.targetElementId}
            {rel.description ? `: ${rel.description}` : ''}
          </li>
        ))}
      </ul>

      <h4>Relationships in ({incoming.length})</h4>
      {incoming.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>None.</p>}
      <ul style={{ paddingLeft: 18 }}>
        {incoming.map((rel) => (
          <li key={rel.id} style={{ fontSize: 13 }}>
            ← {elementsById.get(rel.sourceElementId)?.name ?? rel.sourceElementId}
            {rel.description ? `: ${rel.description}` : ''}
          </li>
        ))}
      </ul>

      <h4>Appears on ({pages.length})</h4>
      {pages.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>No synced diagrams yet.</p>}
      <ul style={{ paddingLeft: 18 }}>
        {pages.map((page) => (
          <li key={page} style={{ fontSize: 13 }}>
            {page}
          </li>
        ))}
      </ul>
    </div>
  );
}
