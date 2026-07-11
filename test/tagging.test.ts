import fs from 'fs';
import path from 'path';
import { parseC4Diagram, listVertexCells } from '../src/lib/mxgraph-parser';
import { applyElementTag } from '../src/lib/tagging';
import { drillDownLink } from '../src/lib/link-writer';

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

describe('listVertexCells', () => {
  it('lists both tagged and untagged vertex cells, excluding edges', () => {
    const xml = loadFixture('context-diagram.drawio.xml');
    const cells = listVertexCells(xml);

    expect(cells.some((c) => c.mxCellId === 'rel-1')).toBe(false); // edge, excluded
    expect(cells.some((c) => c.mxCellId === 'rel-2')).toBe(false); // edge, excluded

    const tagged = cells.find((c) => c.mxCellId === 'person-1');
    expect(tagged).toMatchObject({ tagged: true, name: 'Customer', c4Type: 'Person' });

    const untagged = cells.find((c) => c.mxCellId === 'system-3');
    expect(untagged).toMatchObject({ tagged: false, c4ModelId: undefined });
  });
});

describe('applyElementTag', () => {
  const xml = loadFixture('context-diagram.drawio.xml');

  it('wraps a previously untagged bare <mxCell> in an <object> and tags it', () => {
    const newId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const updatedXml = applyElementTag(xml, 'system-3', {
      c4ModelId: newId,
      c4Type: 'SoftwareSystem',
      description: 'Newly tagged',
      tags: ['new'],
      external: false,
    });

    const reparsed = parseC4Diagram(updatedXml);
    const tagged = reparsed.elements.find((el) => el.mxCellId === 'system-3');

    expect(tagged).toMatchObject({
      c4ModelId: newId,
      c4Type: 'SoftwareSystem',
      description: 'Newly tagged',
      name: 'Untagged decoration box',
      tags: ['new'],
    });
    expect(updatedXml).toContain(drillDownLink(newId));
  });

  it('preserves the diagram-wide relationship inference after tagging a new element', () => {
    const newId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const updatedXml = applyElementTag(xml, 'system-3', {
      c4ModelId: newId,
      c4Type: 'SoftwareSystem',
      tags: [],
      external: false,
    });

    // rel-3 connects system-1 -> system-3; system-3 now carries a c4ModelId,
    // so this edge should newly resolve to a relationship.
    const { relationships } = parseC4Diagram(updatedXml);
    expect(relationships.some((r) => r.mxCellId === 'rel-3' && r.targetModelId === newId)).toBe(
      true
    );
  });

  it('updates attributes on an already-tagged <object>-wrapped cell in place', () => {
    const updatedXml = applyElementTag(xml, 'person-1', {
      c4ModelId: '11111111-1111-1111-1111-111111111111',
      c4Type: 'Person',
      description: 'Updated description',
      tags: ['external', 'vip'],
      external: true,
    });

    const { elements } = parseC4Diagram(updatedXml);
    const person = elements.find((el) => el.mxCellId === 'person-1');
    expect(person).toMatchObject({
      description: 'Updated description',
      tags: ['external', 'vip'],
      external: true,
    });
    expect(elements).toHaveLength(parseC4Diagram(xml).elements.length);
  });

  it('throws for an unknown cell id', () => {
    expect(() =>
      applyElementTag(xml, 'does-not-exist', {
        c4ModelId: 'x',
        c4Type: 'Person',
        tags: [],
        external: false,
      })
    ).toThrow(/does-not-exist/);
  });
});
