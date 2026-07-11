/**
 * Mirrors DRILL_DOWN_LINK_PREFIX in src/lib/link-writer.ts on the backend.
 * Duplicated (not imported) because the backend module pulls in @xmldom/xmldom,
 * a Node-only dependency that has no place in this browser bundle - keep the
 * two prefix constants in sync if either changes.
 */
const DRILL_DOWN_LINK_PREFIX = 'c4model://element/';

/**
 * `c4model://` isn't a scheme browsers/draw.io recognize, so the `openLink`
 * event's href arrives resolved as a relative URL against the iframe's own
 * origin (e.g. "https://some-cdn.net/c4model://element/<id>") rather than
 * the literal link we wrote - search for the marker instead of requiring
 * it as a strict prefix.
 */
export function parseDrillDownLink(href: string): string | undefined {
  const index = href.indexOf(DRILL_DOWN_LINK_PREFIX);
  return index === -1 ? undefined : href.slice(index + DRILL_DOWN_LINK_PREFIX.length);
}
