import fs from 'fs';
import path from 'path';
import { parseC4Diagram } from '../src/lib/mxgraph-parser';

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

describe('parseC4Diagram', () => {
  it('extracts C4-tagged elements and ignores untagged cells', () => {
    const xml = loadFixture('context-diagram.drawio.xml');
    const { elements } = parseC4Diagram(xml);

    expect(elements).toHaveLength(4);

    const person = elements.find((el) => el.mxCellId === 'person-1');
    expect(person).toMatchObject({
      c4ModelId: '11111111-1111-1111-1111-111111111111',
      c4Type: 'Person',
      name: 'Customer',
      description: 'A customer of the bank',
      tags: ['external'],
      external: false,
    });

    const mainframe = elements.find((el) => el.mxCellId === 'system-2');
    expect(mainframe).toMatchObject({
      c4Type: 'SoftwareSystem',
      tags: ['legacy'],
      external: true,
    });

    const container = elements.find((el) => el.mxCellId === 'container-1');
    expect(container).toMatchObject({
      c4Type: 'Container',
      technology: 'Java, Spring Boot',
      parentModelId: '22222222-2222-2222-2222-222222222222',
    });

    // system-3 and decoration-1 carry no c4ModelId and must not appear.
    expect(elements.some((el) => el.mxCellId === 'system-3')).toBe(false);
    expect(elements.some((el) => el.mxCellId === 'decoration-1')).toBe(false);
  });

  it('infers relationships from edges whose endpoints both carry a c4ModelId', () => {
    const xml = loadFixture('context-diagram.drawio.xml');
    const { relationships } = parseC4Diagram(xml);

    expect(relationships).toHaveLength(2);

    const objectWrappedEdge = relationships.find((rel) => rel.mxCellId === 'rel-1');
    expect(objectWrappedEdge).toMatchObject({
      sourceModelId: '11111111-1111-1111-1111-111111111111',
      targetModelId: '22222222-2222-2222-2222-222222222222',
      description: 'Views account balances',
      technology: 'HTTPS',
    });

    const bareEdge = relationships.find((rel) => rel.mxCellId === 'rel-2');
    expect(bareEdge).toMatchObject({
      sourceModelId: '22222222-2222-2222-2222-222222222222',
      targetModelId: '33333333-3333-3333-3333-333333333333',
    });
    expect(bareEdge?.description).toBeUndefined();
  });

  it('excludes edges where only one endpoint carries a c4ModelId', () => {
    const xml = loadFixture('context-diagram.drawio.xml');
    const { relationships } = parseC4Diagram(xml);

    expect(relationships.some((rel) => rel.mxCellId === 'rel-3')).toBe(false);
  });

  it('returns no elements or relationships for a diagram with no C4 tags', () => {
    const xml = loadFixture('non-c4-diagram.drawio.xml');
    const result = parseC4Diagram(xml);

    expect(result.elements).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
  });

  it('throws a clear error for a diagram with compressed/unparsed content', () => {
    const xml = loadFixture('compressed-diagram.drawio.xml');

    expect(() => parseC4Diagram(xml)).toThrow(/compress/i);
  });

  it('is deterministic across repeated parses of the same input', () => {
    const xml = loadFixture('context-diagram.drawio.xml');

    expect(parseC4Diagram(xml)).toEqual(parseC4Diagram(xml));
  });
});
