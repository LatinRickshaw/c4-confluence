import { XMLSerializer } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import { isElementNode, parseXmlDocument, resolveCells } from './mxgraph-parser';
import { C4_ATTR } from './c4-shapes';
import { drillDownLink } from './link-writer';

export interface ElementTagInput {
  c4ModelId: string;
  c4Type: string;
  description?: string;
  technology?: string;
  tags: string[];
  external: boolean;
  parentModelId?: string;
}

function setOrRemoveAttribute(node: XmlElement, name: string, value: string | undefined): void {
  if (value) {
    node.setAttribute(name, value);
  } else {
    node.removeAttribute(name);
  }
}

/**
 * Tags a diagram cell with C4 metadata, producing updated diagram XML.
 *
 * If the target is a bare <mxCell> (never tagged before), it's wrapped in an
 * <object> first - that's the shape draw.io's own "Edit Data" feature always
 * produces, and is how it recognizes custom properties on load. Setting
 * arbitrary attributes directly on <mxCell> isn't part of the mxGraph schema
 * and risks being dropped when draw.io re-saves the diagram.
 */
export function applyElementTag(xml: string, mxCellId: string, tag: ElementTagInput): string {
  const doc = parseXmlDocument(xml);
  const cell = resolveCells(doc).find((c) => c.id === mxCellId);

  if (!cell) {
    throw new Error(`No cell with id "${mxCellId}" found in diagram`);
  }

  let attributeNode = cell.attributeNode;

  if (attributeNode === cell.mxCell) {
    const parent = cell.mxCell.parentNode;
    if (!parent || !isElementNode(parent)) {
      throw new Error(`Cell "${mxCellId}" has no parent node`);
    }

    const object = doc.createElement('object');
    object.setAttribute('id', mxCellId);
    object.setAttribute('label', cell.mxCell.getAttribute('value') ?? '');
    cell.mxCell.removeAttribute('id');
    cell.mxCell.removeAttribute('value');

    parent.replaceChild(object, cell.mxCell);
    object.appendChild(cell.mxCell);
    attributeNode = object;
  }

  attributeNode.setAttribute(C4_ATTR.modelId, tag.c4ModelId);
  attributeNode.setAttribute(C4_ATTR.type, tag.c4Type);
  setOrRemoveAttribute(attributeNode, C4_ATTR.description, tag.description);
  setOrRemoveAttribute(attributeNode, C4_ATTR.technology, tag.technology);
  setOrRemoveAttribute(
    attributeNode,
    C4_ATTR.tags,
    tag.tags.length > 0 ? tag.tags.join(',') : undefined
  );
  setOrRemoveAttribute(attributeNode, C4_ATTR.external, tag.external ? 'true' : undefined);
  setOrRemoveAttribute(attributeNode, C4_ATTR.parentId, tag.parentModelId);
  attributeNode.setAttribute('link', drillDownLink(tag.c4ModelId));

  return new XMLSerializer().serializeToString(doc);
}
