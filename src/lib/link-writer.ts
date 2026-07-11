import { XMLSerializer } from '@xmldom/xmldom';
import { parseXmlDocument, resolveCells } from './mxgraph-parser';
import type { ParsedC4Element } from './mxgraph-parser';

/**
 * embed.diagrams.net's postMessage protocol has no generic "cell clicked"
 * event - the only click signal it exposes is `openLink`, fired for shapes
 * that already carry a native draw.io link. Encoding the element id in a
 * custom-scheme link lets the host (us) intercept that event for in-app
 * drill-down navigation instead of an actual browser navigation.
 */
export const DRILL_DOWN_LINK_PREFIX = 'c4model://element/';

export function drillDownLink(c4ModelId: string): string {
  return `${DRILL_DOWN_LINK_PREFIX}${c4ModelId}`;
}

/**
 * `c4model://` isn't a scheme browsers/draw.io recognize, so when draw.io
 * reports a click via its `openLink` event the href arrives resolved as a
 * relative URL against the iframe's own origin (e.g.
 * "https://some-cdn.net/c4model://element/<id>") rather than the literal
 * link that was written - search for the marker instead of requiring it as
 * a strict prefix.
 */
export function parseDrillDownLink(href: string): string | undefined {
  const index = href.indexOf(DRILL_DOWN_LINK_PREFIX);
  return index === -1 ? undefined : href.slice(index + DRILL_DOWN_LINK_PREFIX.length);
}

export interface EnsureDrillDownLinksResult {
  xml: string;
  changed: boolean;
}

/**
 * Ensures every C4-tagged shape's native `link` attribute encodes its
 * element id. Returns the original xml unchanged (same reference) when
 * every shape already has the expected link, so callers can skip writing
 * back to Confluence when there's nothing new to persist.
 */
export function ensureDrillDownLinks(
  xml: string,
  elements: ParsedC4Element[]
): EnsureDrillDownLinksResult {
  const doc = parseXmlDocument(xml);
  const cellsById = new Map(resolveCells(doc).map((cell) => [cell.id, cell]));

  let changed = false;

  for (const element of elements) {
    const cell = cellsById.get(element.mxCellId);
    if (!cell) {
      continue;
    }

    const desiredLink = drillDownLink(element.c4ModelId);
    if (cell.attributeNode.getAttribute('link') !== desiredLink) {
      cell.attributeNode.setAttribute('link', desiredLink);
      changed = true;
    }
  }

  if (!changed) {
    return { xml, changed: false };
  }

  return { xml: new XMLSerializer().serializeToString(doc), changed: true };
}
