import { storage, startsWith } from '@forge/api';
import type { DiagramLink, Element, PageSyncState, Relationship } from '../types/model';

const NAMESPACE = 'c4';

function elementKey(spaceKey: string, elementId: string): string {
  return `${NAMESPACE}:${spaceKey}:element:${elementId}`;
}

function relationshipKey(spaceKey: string, relationshipId: string): string {
  return `${NAMESPACE}:${spaceKey}:relationship:${relationshipId}`;
}

function diagramLinkKey(
  spaceKey: string,
  elementId: string,
  pageId: string,
  mxCellId: string
): string {
  return `${NAMESPACE}:${spaceKey}:diagramlink:${elementId}:${pageId}:${mxCellId}`;
}

function pageSyncStateKey(spaceKey: string, pageId: string): string {
  return `${NAMESPACE}:${spaceKey}:pagesync:${pageId}`;
}

async function queryAllByPrefix<T>(prefix: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;

  do {
    const builder = storage.query().where('key', startsWith(prefix));
    const page = await (cursor ? builder.cursor(cursor) : builder).getMany();
    items.push(...page.results.map((result) => result.value as T));
    cursor = page.nextCursor;
  } while (cursor);

  return items;
}

export async function upsertElement(spaceKey: string, element: Element): Promise<void> {
  await storage.set(elementKey(spaceKey, element.id), element);
}

export async function upsertRelationship(
  spaceKey: string,
  relationship: Relationship
): Promise<void> {
  await storage.set(relationshipKey(spaceKey, relationship.id), relationship);
}

export async function upsertDiagramLink(spaceKey: string, link: DiagramLink): Promise<void> {
  await storage.set(
    diagramLinkKey(spaceKey, link.elementId, link.confluencePageId, link.mxCellId),
    link
  );
}

export async function getElement(
  spaceKey: string,
  elementId: string
): Promise<Element | undefined> {
  return (await storage.get(elementKey(spaceKey, elementId))) as Element | undefined;
}

export async function upsertPageSyncState(spaceKey: string, state: PageSyncState): Promise<void> {
  await storage.set(pageSyncStateKey(spaceKey, state.pageId), state);
}

export async function getPageSyncState(
  spaceKey: string,
  pageId: string
): Promise<PageSyncState | undefined> {
  return (await storage.get(pageSyncStateKey(spaceKey, pageId))) as PageSyncState | undefined;
}

export function listElements(spaceKey: string): Promise<Element[]> {
  return queryAllByPrefix<Element>(`${NAMESPACE}:${spaceKey}:element:`);
}

export function listRelationships(spaceKey: string): Promise<Relationship[]> {
  return queryAllByPrefix<Relationship>(`${NAMESPACE}:${spaceKey}:relationship:`);
}

export function listDiagramLinksForElement(
  spaceKey: string,
  elementId: string
): Promise<DiagramLink[]> {
  return queryAllByPrefix<DiagramLink>(`${NAMESPACE}:${spaceKey}:diagramlink:${elementId}:`);
}

export function listAllDiagramLinks(spaceKey: string): Promise<DiagramLink[]> {
  return queryAllByPrefix<DiagramLink>(`${NAMESPACE}:${spaceKey}:diagramlink:`);
}

/**
 * Finds any element whose parentId matches, i.e. a Container of a
 * SoftwareSystem or a Component of a Container. Forge Storage has no
 * secondary index on arbitrary fields, so this scans every element in the
 * space - fine at MVP scale, worth revisiting if a space's model grows large.
 */
export async function findChildElement(
  spaceKey: string,
  parentElementId: string
): Promise<Element | undefined> {
  const elements = await listElements(spaceKey);
  return elements.find((element) => element.parentId === parentElementId);
}

/**
 * Deletes an element and everything that references it: its diagram links
 * and any relationships to/from it. Children that had this as their parentId
 * are left as-is (their parentId just points at nothing) rather than
 * cascade-deleted, since silently deleting a whole subtree is more
 * destructive than a user is likely to expect from "delete this element" -
 * they show up as top-level nodes in the explorer until re-parented or
 * deleted themselves.
 */
export async function deleteElementCascade(spaceKey: string, elementId: string): Promise<void> {
  const [diagramLinks, relationships] = await Promise.all([
    listDiagramLinksForElement(spaceKey, elementId),
    listRelationships(spaceKey),
  ]);

  const relationshipsToDelete = relationships.filter(
    (rel) => rel.sourceElementId === elementId || rel.targetElementId === elementId
  );

  await Promise.all([
    storage.delete(elementKey(spaceKey, elementId)),
    ...diagramLinks.map((link) =>
      storage.delete(diagramLinkKey(spaceKey, link.elementId, link.confluencePageId, link.mxCellId))
    ),
    ...relationshipsToDelete.map((rel) => storage.delete(relationshipKey(spaceKey, rel.id))),
  ]);
}
