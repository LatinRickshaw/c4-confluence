import { requestConfluence } from '@forge/bridge';

/**
 * Uploads a new version of an attachment's content. Runs from the frontend
 * (not a backend resolver) because this endpoint only accepts user auth, and
 * @forge/bridge's requestConfluence proxies through the user's own
 * authenticated browser session rather than needing a server-side OAuth
 * token exchange - the exchange is what api.asUser() from a resolver hits a
 * NEEDS_AUTHENTICATION_ERR wall trying to do.
 */
export async function updateAttachmentXml(
  pageId: string,
  attachmentId: string,
  filename: string,
  xml: string
): Promise<void> {
  const form = new FormData();
  form.append('file', new Blob([xml], { type: 'application/xml' }), filename);
  form.append('minorEdit', 'true');
  form.append('comment', 'C4 Confluence: added drill-down links');

  const response = await requestConfluence(
    `/wiki/rest/api/content/${pageId}/child/attachment/${attachmentId}/data`,
    {
      method: 'POST',
      headers: { 'X-Atlassian-Token': 'nocheck' },
      body: form,
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '<no body>');
    throw new Error(
      `Failed to update attachment ${attachmentId}: ${response.status} ${response.statusText} - ${body}`
    );
  }
}
