import React from 'react';

interface ModelElement {
  id: string;
  type: string;
  name: string;
  external: boolean;
  parentId?: string;
}

interface ModelRelationship {
  id: string;
  sourceElementId: string;
  targetElementId: string;
  description?: string;
}

export interface LandscapeViewProps {
  elements: ModelElement[];
  relationships: ModelRelationship[];
  onElementClick: (elementId: string) => void;
}

const BOX_WIDTH = 180;
const BOX_HEIGHT = 90;
const GAP = 60;

/**
 * A simple grid layout (the brief allows force-directed OR grid) of
 * top-level elements and the relationships directly between them - this is
 * generated from the model graph, not a draw.io diagram.
 */
export function LandscapeView({ elements, relationships, onElementClick }: LandscapeViewProps) {
  const topLevel = elements.filter((el) => !el.parentId);
  const columns = Math.max(1, Math.ceil(Math.sqrt(topLevel.length)));

  const positions = new Map<string, { x: number; y: number }>();
  topLevel.forEach((el, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions.set(el.id, {
      x: col * (BOX_WIDTH + GAP) + GAP,
      y: row * (BOX_HEIGHT + GAP) + GAP,
    });
  });

  const rows = Math.ceil(topLevel.length / columns);
  const width = columns * (BOX_WIDTH + GAP) + GAP;
  const height = rows * (BOX_HEIGHT + GAP) + GAP;

  const visibleRelationships = relationships.filter(
    (rel) => positions.has(rel.sourceElementId) && positions.has(rel.targetElementId)
  );

  if (topLevel.length === 0) {
    return <p>No top-level elements yet.</p>;
  }

  return (
    <svg width={width} height={height} style={{ border: '1px solid #ddd', background: '#fff' }}>
      {visibleRelationships.map((rel) => {
        const source = positions.get(rel.sourceElementId)!;
        const target = positions.get(rel.targetElementId)!;
        const x1 = source.x + BOX_WIDTH / 2;
        const y1 = source.y + BOX_HEIGHT / 2;
        const x2 = target.x + BOX_WIDTH / 2;
        const y2 = target.y + BOX_HEIGHT / 2;
        return (
          <g key={rel.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#999" strokeWidth={1.5} />
            {rel.description && (
              <text
                x={(x1 + x2) / 2}
                y={(y1 + y2) / 2}
                fontSize={11}
                fill="#666"
                textAnchor="middle"
              >
                {rel.description}
              </text>
            )}
          </g>
        );
      })}

      {topLevel.map((el) => {
        const pos = positions.get(el.id)!;
        return (
          <g key={el.id} onClick={() => onElementClick(el.id)} style={{ cursor: 'pointer' }}>
            <rect
              x={pos.x}
              y={pos.y}
              width={BOX_WIDTH}
              height={BOX_HEIGHT}
              rx={6}
              fill={el.external ? '#f0f0f0' : '#dde8ff'}
              stroke="#5578c9"
            />
            <text
              x={pos.x + BOX_WIDTH / 2}
              y={pos.y + BOX_HEIGHT / 2 - 6}
              textAnchor="middle"
              fontSize={13}
              fontWeight="bold"
            >
              {el.name}
            </text>
            <text
              x={pos.x + BOX_WIDTH / 2}
              y={pos.y + BOX_HEIGHT / 2 + 12}
              textAnchor="middle"
              fontSize={11}
              fill="#555"
            >
              {el.type}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
