import fs from 'fs';
import path from 'path';
import { parseC4Diagram } from '../src/lib/mxgraph-parser';
import { healDiagram } from '../src/lib/heal';
import type { DiagramLink, Element } from '../src/types/model';

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

describe('healDiagram', () => {
  const xml = loadFixture('context-diagram.drawio.xml');

  const knownElement: Element = {
    id: '99999999-9999-9999-9999-999999999999',
    type: 'SoftwareSystem',
    name: 'Restored System',
    description: 'Restored from the model store',
    tags: ['healed'],
    external: false,
  };

  it('restores attributes on a cell that still exists but lost its tag', () => {
    const pageLinks: DiagramLink[] = [
      {
        elementId: knownElement.id,
        confluencePageId: 'page-1',
        confluenceAttachmentId: 'att-1',
        mxCellId: 'system-3',
      },
    ];
    const elementsById = new Map([[knownElement.id, knownElement]]);

    const result = healDiagram(xml, pageLinks, elementsById);

    expect(result.healed).toBe(true);

    const { elements } = parseC4Diagram(result.xml);
    const restored = elements.find((el) => el.mxCellId === 'system-3');
    expect(restored).toMatchObject({
      c4ModelId: knownElement.id,
      c4Type: 'SoftwareSystem',
      description: 'Restored from the model store',
      tags: ['healed'],
    });
  });

  it('is a no-op when the cell already carries the linked element id', () => {
    const pageLinks: DiagramLink[] = [
      {
        elementId: '11111111-1111-1111-1111-111111111111',
        confluencePageId: 'page-1',
        confluenceAttachmentId: 'att-1',
        mxCellId: 'person-1',
      },
    ];
    const elementsById = new Map([
      [
        '11111111-1111-1111-1111-111111111111',
        { ...knownElement, id: '11111111-1111-1111-1111-111111111111' },
      ],
    ]);

    const result = healDiagram(xml, pageLinks, elementsById);

    expect(result.healed).toBe(false);
    expect(result.xml).toBe(xml);
  });

  it('skips a link whose cell no longer exists in the diagram', () => {
    const pageLinks: DiagramLink[] = [
      {
        elementId: knownElement.id,
        confluencePageId: 'page-1',
        confluenceAttachmentId: 'att-1',
        mxCellId: 'does-not-exist',
      },
    ];
    const elementsById = new Map([[knownElement.id, knownElement]]);

    const result = healDiagram(xml, pageLinks, elementsById);

    expect(result.healed).toBe(false);
    expect(result.xml).toBe(xml);
  });

  it('skips a link whose element was deleted from the model store', () => {
    const pageLinks: DiagramLink[] = [
      {
        elementId: 'deleted-element',
        confluencePageId: 'page-1',
        confluenceAttachmentId: 'att-1',
        mxCellId: 'system-3',
      },
    ];

    const result = healDiagram(xml, pageLinks, new Map());

    expect(result.healed).toBe(false);
    expect(result.xml).toBe(xml);
  });
});
