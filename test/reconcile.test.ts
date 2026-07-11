import fs from 'fs';
import path from 'path';
import { parseC4Diagram } from '../src/lib/mxgraph-parser';
import { deriveRelationshipId, reconcileDiagram } from '../src/lib/reconcile';

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

describe('reconcileDiagram', () => {
  const parsed = parseC4Diagram(loadFixture('context-diagram.drawio.xml'));

  it('maps parsed elements to model Elements keyed by c4ModelId', () => {
    const { elements } = reconcileDiagram(parsed, 'page-1', 'attachment-1');

    const container = elements.find((el) => el.id === '44444444-4444-4444-4444-444444444444');
    expect(container).toMatchObject({
      type: 'Container',
      name: 'API Application',
      technology: 'Java, Spring Boot',
      parentId: '22222222-2222-2222-2222-222222222222',
    });
  });

  it('derives a stable relationship id from the endpoint pair when the edge has no c4ModelId', () => {
    const { relationships } = reconcileDiagram(parsed, 'page-1', 'attachment-1');

    const bareEdgeRelationship = relationships.find(
      (rel) =>
        rel.sourceElementId === '22222222-2222-2222-2222-222222222222' &&
        rel.targetElementId === '33333333-3333-3333-3333-333333333333'
    );

    expect(bareEdgeRelationship?.id).toBe(
      deriveRelationshipId(
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333'
      )
    );
  });

  it('creates one DiagramLink per element, referencing the source page/attachment/cell', () => {
    const { elements, diagramLinks } = reconcileDiagram(parsed, 'page-42', 'attachment-99');

    expect(diagramLinks).toHaveLength(elements.length);

    const personLink = diagramLinks.find(
      (link) => link.elementId === '11111111-1111-1111-1111-111111111111'
    );
    expect(personLink).toEqual({
      elementId: '11111111-1111-1111-1111-111111111111',
      confluencePageId: 'page-42',
      confluenceAttachmentId: 'attachment-99',
      mxCellId: 'person-1',
    });
  });

  it('is idempotent: reconciling the same parsed diagram twice yields identical records', () => {
    const first = reconcileDiagram(parsed, 'page-1', 'attachment-1');
    const second = reconcileDiagram(parsed, 'page-1', 'attachment-1');

    expect(second).toEqual(first);
  });
});
