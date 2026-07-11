import React, { useCallback, useEffect, useRef, useState } from 'react';
import { parseDrillDownLink } from '../lib/drilldown-link';

const EMBED_ORIGIN = 'https://embed.diagrams.net';

export interface DrawioEmbedProps {
  xml: string;
  /** Renders in draw.io's "chromeless" mode: no toolbar, not editable. */
  readOnly?: boolean;
  onSave?: (xml: string) => void;
  /** Called with the element id encoded in a shape's drill-down link when it's clicked. */
  onDrillDown?: (elementId: string) => void;
  height?: number;
}

interface DrawioMessage {
  event: string;
  xml?: string;
  href?: string;
  [key: string]: unknown;
}

/**
 * Wraps embed.diagrams.net in an iframe and speaks its postMessage protocol
 * (see https://www.drawio.com/doc/faq/embed-mode). draw.io only accepts the
 * `load` action once it has sent its own `init` event, so the diagram XML is
 * pushed reactively rather than baked into the iframe src. Note `init` only
 * fires once per iframe load, so changing `xml` after the first load won't
 * refresh an already-rendered diagram - remount the component (e.g. via a
 * `key` prop keyed on page id) to force a reload.
 *
 * `configure=1` + `suppressNewWindows: true` stops draw.io from calling
 * window.open on shape links itself - it's the only way to intercept clicks,
 * since the embed protocol has no generic "cell clicked" event, only
 * `openLink` for shapes that already carry a native link.
 */
export function DrawioEmbed({
  xml,
  readOnly = true,
  onSave,
  onDrillDown,
  height = 600,
}: DrawioEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const src = `${EMBED_ORIGIN}/?embed=1&ui=atlas&spin=1&proto=json&configure=1${readOnly ? '&chrome=0' : ''}`;

  const postToDrawio = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(message), EMBED_ORIGIN);
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== EMBED_ORIGIN || typeof event.data !== 'string') {
        return;
      }

      let message: DrawioMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (message.event) {
        case 'configure':
          postToDrawio({ action: 'configure', config: { suppressNewWindows: true } });
          break;
        case 'init':
          setReady(true);
          postToDrawio({ action: 'load', xml, autosave: 0 });
          break;
        case 'save':
        case 'autosave':
          if (message.xml) {
            onSave?.(message.xml);
          }
          break;
        case 'openLink':
          if (message.href) {
            const elementId = parseDrillDownLink(message.href);
            if (elementId) {
              onDrillDown?.(elementId);
            } else {
              // Not one of our drill-down links - e.g. a real hyperlink the user added via
              // draw.io's own "Edit Link". suppressNewWindows stopped draw.io from opening it
              // itself, so without this fallback a legitimate link would silently do nothing.
              window.open(message.href, (message.target as string | undefined) || '_blank');
            }
          }
          break;
        default:
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [xml, onSave, onDrillDown, postToDrawio]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {!ready && <p>Loading diagram...</p>}
      <iframe
        ref={iframeRef}
        title="draw.io diagram"
        src={src}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #ddd',
          display: ready ? 'block' : 'none',
        }}
      />
    </div>
  );
}
