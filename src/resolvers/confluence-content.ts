import api, { assumeTrustedRoute, route } from '@forge/api';
import type { ConfluenceAttachment, DrawioDiagramResult } from '../types/attachments';

const DRAWIO_EXTENSIONS = ['.drawio', '.xml'];

interface AttachmentsResponse {
  results: Array<{
    id: string;
    title: string;
    mediaType: string;
    version?: { number?: number };
    _links: {
      download: string;
    };
  }>;
}

function isDrawioAttachment(title: string): boolean {
  const lower = title.toLowerCase();
  return DRAWIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function listDrawioAttachments(pageId: string): Promise<ConfluenceAttachment[]> {
  const response = await api
    .asApp()
    .requestConfluence(route`/wiki/api/v2/pages/${pageId}/attachments`, {
      headers: { Accept: 'application/json' },
    });

  if (!response.ok) {
    throw new Error(
      `Failed to list attachments for page ${pageId}: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as AttachmentsResponse;

  return body.results
    .filter((attachment) => isDrawioAttachment(attachment.title))
    .map((attachment) => ({
      id: attachment.id,
      title: attachment.title,
      mediaType: attachment.mediaType,
      downloadLink: attachment._links.download,
      version: attachment.version?.number,
    }));
}

export async function downloadAttachmentXml(downloadLink: string): Promise<string> {
  // downloadLink comes verbatim from Confluence's own attachment response, not user input,
  // so route()'s path-manipulation guard (which rejects "/" in substituted params) doesn't apply here.
  const response = await api.asApp().requestConfluence(assumeTrustedRoute(downloadLink));

  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function getPageTitle(pageId: string): Promise<string | undefined> {
  const response = await api.asApp().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return undefined;
  }

  const body = (await response.json()) as { title?: string };
  return body.title;
}

export async function getPageTitles(pageIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(pageIds));
  const titles = await Promise.all(uniqueIds.map((id) => getPageTitle(id)));

  const result: Record<string, string> = {};
  uniqueIds.forEach((id, index) => {
    const title = titles[index];
    if (title) {
      result[id] = title;
    }
  });
  return result;
}

export async function getFirstDrawioDiagram(pageId: string): Promise<DrawioDiagramResult> {
  const attachments = await listDrawioAttachments(pageId);

  if (attachments.length === 0) {
    return {
      found: false,
      message: `No .drawio/.xml attachments found on page ${pageId}`,
    };
  }

  const [attachment] = attachments;
  const xml = await downloadAttachmentXml(attachment.downloadLink);

  console.log(`Fetched attachment "${attachment.title}" (${xml.length} bytes) from page ${pageId}`);

  return {
    found: true,
    title: attachment.title,
    attachmentId: attachment.id,
    attachmentVersion: attachment.version,
    xml,
    warning:
      attachments.length > 1
        ? `This page has ${attachments.length} .drawio attachments; only "${attachment.title}" is used.`
        : undefined,
  };
}
