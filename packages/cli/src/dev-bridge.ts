import { protocolVersion } from "@hitslop/schema/bridge";
// Browser-only half of `slop dev`. This disposable window.slop fake exists to
// keep authored UI renderable; it deliberately does not model durable storage.

export const hostStyle = `<style data-hitslop-host>*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}</style>`;

export const devHostJavaScript = `(() => {
  const captureMode = new URL(window.location?.href ?? 'http://localhost/').searchParams.get('capture');
  if (captureMode === 'icon') document.documentElement.dataset.slopRenderer = 'true';
  if (captureMode === 'icon' || captureMode === 'export') {
    window.addEventListener('slop:ready', () => {
      setTimeout(async () => {
        try {
          if (captureMode === 'icon') document.documentElement.style.width = '512px';
          await window.__hitslopCapture.begin('dev-preview', captureMode, {blockInteraction:false});
        } catch (error) { console.error('Capture preview failed', error); }
      }, 0);
    }, {once:true});
  }
  const listeners = { json: new Set(), sqlite: new Set(), media: new Set() };
  let jsonValue;
  let jsonRevision = 0;
  let jsonOpened = false;
  let mediaRevision = 0;

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const emit = (kind, event) => listeners[kind].forEach((callback) => callback({ kind, ...event }));
  const watch = (kind, callback) => {
    listeners[kind].add(callback);
    return () => listeners[kind].delete(callback);
  };
  const revision = () => 'dev:' + jsonRevision;

  const resize = async (size) => size;
  const drag = async () => undefined;

  window.slop = Object.freeze({
    info: async () => ({ protocolVersion: ${protocolVersion}, capabilities: ['host.info', 'json.open', 'json.read', 'json.write', 'window.resize', 'window.drag'] }),
    flush: async () => undefined,
    json: Object.freeze({
      open: async (value) => {
        if (!jsonOpened) { jsonValue = clone(value); jsonOpened = true; }
        return { value: clone(jsonValue), revision: revision() };
      },
      read: async () => {
        if (!jsonOpened) throw new Error('JSON preview store has not been opened');
        return { value: clone(jsonValue), revision: revision() };
      },
      write: async (value, expectedRevision) => {
        if (expectedRevision !== undefined && expectedRevision !== revision()) throw Object.assign(new Error('Document changed'), { code: 'revision_conflict' });
        jsonValue = clone(value); jsonOpened = true; jsonRevision += 1;
        const result = { revision: revision() };
        emit('json', { source: 'app', revision: result.revision });
        return result;
      },
      onChange: (callback) => watch('json', callback)
    }),
    db: Object.freeze({
      query: async () => [],
      execute: async () => { emit('sqlite', { source: 'app' }); return 0; },
      transaction: async () => { emit('sqlite', { source: 'app' }); return 0; },
      onChange: (callback) => watch('sqlite', callback)
    }),
    media: Object.freeze({
      open: async () => ({ exists: false, revision: null }),
      write: async () => {
        mediaRevision += 1;
        const result = { revision: 'dev-media:' + mediaRevision };
        emit('media', { source: 'app', revision: result.revision });
        return result;
      },
      remove: async () => {
        emit('media', { source: 'app', revision: null });
        return { revision: null };
      },
      onChange: (callback) => watch('media', callback)
    }),
    window: Object.freeze({ resize, drag }),
    ready: () => {
      document.documentElement.dataset.hitslopReady = 'true';
      window.dispatchEvent(new Event('slop:ready'));
    }
  });
})();`;

export const bridgeScript = `<script>${devHostJavaScript}</script>`;

export const injectHost = (html: string, options: { themeHref?: string } = {}): string => {
  const theme = options.themeHref
    ? `<link rel="stylesheet" href="${options.themeHref}" data-hitslop-theme-default>`
    : "";
  const payload = hostStyle + theme + bridgeScript;
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (tag) => tag + payload)
    : payload + html;
};
