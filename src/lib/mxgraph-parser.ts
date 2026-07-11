import { DOMParser } from '@xmldom/xmldom';
import type {
  Document as XmlDocument,
  Element as XmlElement,
  Node as XmlNode,
} from '@xmldom/xmldom';
import { C4_ATTR, parseBooleanAttr, parseTags } from './c4-shapes';

export interface ParsedC4Element {
  mxCellId: string;
  c4ModelId: string;
  c4Type: string;
  name: string;
  description?: string;
  technology?: string;
  tags: string[];
  external: boolean;
  parentModelId?: string;
}

export interface ParsedC4Relationship {
  mxCellId: string;
  c4ModelId?: string;
  sourceModelId: string;
  targetModelId: string;
  description?: string;
  technology?: string;
  tags: string[];
}

export interface ParsedC4Diagram {
  elements: ParsedC4Element[];
  relationships: ParsedC4Relationship[];
}

export function isElementNode(node: XmlNode): node is XmlElement {
  return node.nodeType === 1;
}

function childElements(node: XmlElement, tagName: string): XmlElement[] {
  const result: XmlElement[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (isElementNode(child) && child.tagName === tagName) {
      result.push(child);
    }
  }
  return result;
}

/**
 * A draw.io "cell" is either a bare <mxCell> or an <mxCell> nested inside an
 * <object> that carries the custom C4 attributes. This resolves either shape
 * to the pair of (attribute-bearing element, the mxCell holding vertex/edge/
 * source/target/id-adjacent graph structure).
 */
export interface ResolvedCell {
  /** The element carrying custom attributes (the <object>, or the <mxCell> itself if bare). */
  attributeNode: XmlElement;
  /** The <mxCell> element itself, wherever it lives. */
  mxCell: XmlElement;
  id: string;
}

export function parseXmlDocument(xml: string): XmlDocument {
  return new DOMParser().parseFromString(xml, 'text/xml');
}

export function resolveCells(doc: XmlDocument): ResolvedCell[] {
  const root = doc.documentElement;
  if (!root) {
    return [];
  }

  const cells: ResolvedCell[] = [];
  const allObjects = root.getElementsByTagName('object');
  for (let i = 0; i < allObjects.length; i++) {
    const objectNode = allObjects[i];
    const [mxCell] = childElements(objectNode, 'mxCell');
    const id = objectNode.getAttribute('id');
    if (mxCell && id) {
      cells.push({ attributeNode: objectNode, mxCell, id });
    }
  }

  const allMxCells = root.getElementsByTagName('mxCell');
  for (let i = 0; i < allMxCells.length; i++) {
    const mxCell = allMxCells[i];
    const isWrapped =
      mxCell.parentNode !== null &&
      isElementNode(mxCell.parentNode) &&
      mxCell.parentNode.tagName === 'object';
    if (isWrapped) {
      continue;
    }
    const id = mxCell.getAttribute('id');
    if (id) {
      cells.push({ attributeNode: mxCell, mxCell, id });
    }
  }

  return cells;
}

export function getLabel(cell: ResolvedCell): string {
  return cell.attributeNode.getAttribute('label') ?? cell.attributeNode.getAttribute('value') ?? '';
}

export interface DiagramCellSummary {
  mxCellId: string;
  name: string;
  tagged: boolean;
  c4ModelId?: string;
  c4Type?: string;
  description?: string;
  technology?: string;
  tags: string[];
  external: boolean;
  parentModelId?: string;
}

/**
 * Lists every vertex (non-edge) cell in the diagram, tagged or not - used to
 * populate a "pick a shape to tag" list, since the embed protocol has no way
 * to know which shape is selected on the canvas.
 */
export function listVertexCells(xml: string): DiagramCellSummary[] {
  const doc = parseXmlDocument(xml);
  return resolveCells(doc)
    .filter((cell) => cell.mxCell.getAttribute('vertex') === '1')
    .map((cell) => {
      const c4ModelId = cell.attributeNode.getAttribute(C4_ATTR.modelId);
      return {
        mxCellId: cell.id,
        name: getLabel(cell),
        tagged: c4ModelId !== null,
        c4ModelId: c4ModelId ?? undefined,
        c4Type: cell.attributeNode.getAttribute(C4_ATTR.type) ?? undefined,
        description: cell.attributeNode.getAttribute(C4_ATTR.description) ?? undefined,
        technology: cell.attributeNode.getAttribute(C4_ATTR.technology) ?? undefined,
        tags: parseTags(cell.attributeNode.getAttribute(C4_ATTR.tags)),
        external: parseBooleanAttr(cell.attributeNode.getAttribute(C4_ATTR.external)),
        parentModelId: cell.attributeNode.getAttribute(C4_ATTR.parentId) ?? undefined,
      };
    });
}

/**
 * Parses a raw .drawio/mxGraph XML document and extracts C4 elements and the
 * relationships between them.
 *
 * Elements are cells (bare <mxCell> or <object>-wrapped) carrying a
 * `c4ModelId` attribute. Relationships are inferred from every edge in the
 * diagram whose source and target cells both resolve to a C4 element -
 * the edge itself does not need to be individually tagged.
 */
export function parseC4Diagram(xml: string): ParsedC4Diagram {
  const doc = parseXmlDocument(xml);
  const root = doc.documentElement;

  if (!root) {
    throw new Error('Could not parse diagram XML: no root element found');
  }

  if (
    root.getElementsByTagName('mxCell').length === 0 &&
    root.getElementsByTagName('mxGraphModel').length === 0
  ) {
    throw new Error(
      'Diagram XML has no mxGraphModel/mxCell content. If this diagram was saved with compression enabled, ' +
        'request uncompressed XML (compressed: false) when saving via the draw.io embed postMessage API.'
    );
  }

  const cells = resolveCells(doc);
  const elements: ParsedC4Element[] = [];
  const elementModelIdByCellId = new Map<string, string>();

  for (const cell of cells) {
    const c4ModelId = cell.attributeNode.getAttribute(C4_ATTR.modelId);
    const isEdge = cell.mxCell.getAttribute('edge') === '1';
    if (!c4ModelId || isEdge) {
      continue;
    }

    elementModelIdByCellId.set(cell.id, c4ModelId);
    elements.push({
      mxCellId: cell.id,
      c4ModelId,
      c4Type: cell.attributeNode.getAttribute(C4_ATTR.type) ?? '',
      name: getLabel(cell),
      description: cell.attributeNode.getAttribute(C4_ATTR.description) ?? undefined,
      technology: cell.attributeNode.getAttribute(C4_ATTR.technology) ?? undefined,
      tags: parseTags(cell.attributeNode.getAttribute(C4_ATTR.tags)),
      external: parseBooleanAttr(cell.attributeNode.getAttribute(C4_ATTR.external)),
      parentModelId: cell.attributeNode.getAttribute(C4_ATTR.parentId) ?? undefined,
    });
  }

  const relationships: ParsedC4Relationship[] = [];

  for (const cell of cells) {
    if (cell.mxCell.getAttribute('edge') !== '1') {
      continue;
    }

    const sourceId = cell.mxCell.getAttribute('source');
    const targetId = cell.mxCell.getAttribute('target');
    if (!sourceId || !targetId) {
      continue;
    }

    const sourceModelId = elementModelIdByCellId.get(sourceId);
    const targetModelId = elementModelIdByCellId.get(targetId);
    if (!sourceModelId || !targetModelId) {
      continue;
    }

    const label = getLabel(cell);
    relationships.push({
      mxCellId: cell.id,
      c4ModelId: cell.attributeNode.getAttribute(C4_ATTR.modelId) ?? undefined,
      sourceModelId,
      targetModelId,
      description:
        cell.attributeNode.getAttribute(C4_ATTR.description) ??
        (label.length > 0 ? label : undefined),
      technology: cell.attributeNode.getAttribute(C4_ATTR.technology) ?? undefined,
      tags: parseTags(cell.attributeNode.getAttribute(C4_ATTR.tags)),
    });
  }

  return { elements, relationships };
}
