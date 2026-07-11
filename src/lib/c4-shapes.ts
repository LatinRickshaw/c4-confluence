/**
 * Attribute names used to tag C4 metadata onto mxGraph cells (draw.io's
 * `<object>` wrapper attributes). These are our own convention, prefixed
 * with `c4` to avoid colliding with other custom properties a diagram
 * might carry.
 */
export const C4_ATTR = {
  modelId: 'c4ModelId',
  type: 'c4Type',
  technology: 'c4Technology',
  description: 'c4Description',
  tags: 'c4Tags',
  external: 'c4External',
  parentId: 'c4ParentId',
} as const;

export const C4_ELEMENT_TYPES = [
  'Person',
  'SoftwareSystem',
  'Container',
  'Component',
  'Code',
] as const;

export type C4ElementType = (typeof C4_ELEMENT_TYPES)[number];

export function isC4ElementType(value: string): value is C4ElementType {
  return (C4_ELEMENT_TYPES as readonly string[]).includes(value);
}

export function parseTags(rawTags: string | null | undefined): string[] {
  if (!rawTags) {
    return [];
  }
  return rawTags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function parseBooleanAttr(rawValue: string | null | undefined): boolean {
  return rawValue === 'true' || rawValue === '1';
}
