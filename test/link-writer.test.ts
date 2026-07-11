import fs from 'fs';
import path from 'path';
import { parseC4Diagram } from '../src/lib/mxgraph-parser';
import { drillDownLink, ensureDrillDownLinks, parseDrillDownLink } from '../src/lib/link-writer';

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

describe('drillDownLink / parseDrillDownLink', () => {
  it('round-trips an element id through the link encoding', () => {
    const link = drillDownLink('11111111-1111-1111-1111-111111111111');
    expect(parseDrillDownLink(link)).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('returns undefined for hrefs that are not drill-down links', () => {
    expect(parseDrillDownLink('https://example.com')).toBeUndefined();
  });

  it('extracts the id when draw.io resolves the custom scheme against its own origin', () => {
    const resolvedHref =
      'https://some-cdn.net/c4model://element/468EF001-CB1F-4EBE-8E24-23978C1293D3';
    expect(parseDrillDownLink(resolvedHref)).toBe('468EF001-CB1F-4EBE-8E24-23978C1293D3');
  });
});

describe('ensureDrillDownLinks', () => {
  const xml = loadFixture('context-diagram.drawio.xml');
  const { elements } = parseC4Diagram(xml);

  it('adds a link to every C4-tagged shape and reports changed', () => {
    const result = ensureDrillDownLinks(xml, elements);

    expect(result.changed).toBe(true);

    const reparsed = parseC4Diagram(result.xml);
    expect(reparsed.elements).toHaveLength(elements.length);
    expect(reparsed.relationships).toHaveLength(parseC4Diagram(xml).relationships.length);
  });

  it('embeds a link that resolves back to the correct element id', () => {
    const result = ensureDrillDownLinks(xml, elements);
    expect(result.xml).toContain(drillDownLink('11111111-1111-1111-1111-111111111111'));
  });

  it('is a no-op (same xml, changed: false) when links are already present', () => {
    const firstPass = ensureDrillDownLinks(xml, elements);
    const secondPass = ensureDrillDownLinks(firstPass.xml, elements);

    expect(secondPass.changed).toBe(false);
    expect(secondPass.xml).toBe(firstPass.xml);
  });
});
