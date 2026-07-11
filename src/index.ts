import Resolver from '@forge/resolver';
import { getFirstDrawioDiagram } from './resolvers/confluence-content';
import { recordPageSynced, syncModelFromPage } from './resolvers/sync';
import { getSyncStatus } from './resolvers/sync-status';
import { resolveDrillDown } from './resolvers/drilldown';
import { getDiagramCells, tagDiagramElement } from './resolvers/tagging';
import { deleteElementCascade, listElements } from './resolvers/model-store';
import { getModelOverview } from './resolvers/model-overview';
import type { ElementTagInput } from './lib/tagging';

const resolver = new Resolver();

resolver.define('getDrawioDiagram', async (req) => {
  const { pageId } = req.payload as { pageId: string };
  try {
    return await getFirstDrawioDiagram(pageId);
  } catch (err) {
    console.error('getDrawioDiagram failed', {
      pageId,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      found: false,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('syncModelFromPage', async (req) => {
  const { pageId } = req.payload as { pageId: string };
  const { spaceKey } = req.context as { spaceKey: string };
  try {
    const result = await syncModelFromPage(spaceKey, pageId);
    return { ok: true as const, ...result };
  } catch (err) {
    console.error('syncModelFromPage failed', {
      pageId,
      spaceKey,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('resolveDrillDown', async (req) => {
  const { elementId } = req.payload as { elementId: string };
  const { spaceKey } = req.context as { spaceKey: string };
  try {
    const result = await resolveDrillDown(spaceKey, elementId);
    return { ok: true as const, ...result };
  } catch (err) {
    console.error('resolveDrillDown failed', {
      elementId,
      spaceKey,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('getDiagramCells', async (req) => {
  const { pageId } = req.payload as { pageId: string };
  try {
    return await getDiagramCells(pageId);
  } catch (err) {
    console.error('getDiagramCells failed', {
      pageId,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      found: false,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('tagDiagramElement', async (req) => {
  const { pageId, mxCellId, tag } = req.payload as {
    pageId: string;
    mxCellId: string;
    tag: ElementTagInput;
  };
  try {
    const result = await tagDiagramElement(pageId, mxCellId, tag);
    return { ok: true as const, ...result };
  } catch (err) {
    console.error('tagDiagramElement failed', {
      pageId,
      mxCellId,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('listModelElements', async (req) => {
  const { spaceKey } = req.context as { spaceKey: string };
  try {
    return { ok: true as const, elements: await listElements(spaceKey) };
  } catch (err) {
    console.error('listModelElements failed', {
      spaceKey,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('getModelOverview', async (req) => {
  const { spaceKey } = req.context as { spaceKey: string };
  try {
    return { ok: true as const, ...(await getModelOverview(spaceKey)) };
  } catch (err) {
    console.error('getModelOverview failed', {
      spaceKey,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('deleteModelElement', async (req) => {
  const { elementId } = req.payload as { elementId: string };
  const { spaceKey } = req.context as { spaceKey: string };
  try {
    await deleteElementCascade(spaceKey, elementId);
    return { ok: true as const };
  } catch (err) {
    console.error('deleteModelElement failed', {
      elementId,
      spaceKey,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('getSyncStatus', async (req) => {
  const { pageId } = req.payload as { pageId: string };
  const { spaceKey } = req.context as { spaceKey: string };
  try {
    return { ok: true as const, ...(await getSyncStatus(spaceKey, pageId)) };
  } catch (err) {
    console.error('getSyncStatus failed', {
      pageId,
      spaceKey,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

resolver.define('confirmSyncApplied', async (req) => {
  const { pageId } = req.payload as { pageId: string };
  const { spaceKey } = req.context as { spaceKey: string };
  try {
    await recordPageSynced(spaceKey, pageId);
    return { ok: true as const };
  } catch (err) {
    console.error('confirmSyncApplied failed', {
      pageId,
      spaceKey,
      accountId: req.context.accountId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : JSON.stringify(err),
    };
  }
});

export const handler = resolver.getDefinitions();
