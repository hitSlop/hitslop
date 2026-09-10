import { protocolVersion } from "@hitslop/schema/bridge";
// Browser-only half of `slop dev`. This disposable window.slop fake exists to
// keep authored UI renderable; it deliberately does not model durable storage.

export const hostStyle = `<style data-hitslop-host>*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}</style>`;

export const devHostJavaScript = `(() => {
  const captureMode = new URL(window.location?.href ?? 'http://localhost/').searchParams.get('capture');
  if (captureMode === 'icon') document.documentElement.dataset.slopRenderer = 'true';
  if (captureMode === 'icon' || captureMode === 'export') {
    window.addEventListener('slop:ready', () => {
      window.__hitslopDevCapture = new Promise(resolve => setTimeout(async () => {
        try {
          if (captureMode === 'icon') document.documentElement.style.width = '512px';
          resolve(await window.__hitslopCapture.begin('dev-preview', captureMode, {blockInteraction:false}));
        } catch (error) { window.__hitslopDevCaptureError = String(error); console.error('Capture preview failed', error); resolve(undefined); }
      }, 0));
    }, {once:true});
  }
  const listeners = { json: new Set(), media: new Set() };
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
        if (!jsonOpened) { jsonValue = clone(window.__hitslopReviewConfig && Object.hasOwn(window.__hitslopReviewConfig, 'data') ? window.__hitslopReviewConfig.data : value); jsonOpened = true; }
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

export const injectHost = (
  html: string,
  options: {
    themeHref?: string;
    review?: { pane: string; run: string; fingerprint: string; data?: unknown };
  } = {},
): string => {
  const theme = options.themeHref
    ? `<link rel="stylesheet" href="${options.themeHref}" data-hitslop-theme-default>`
    : "";
  const reviewConfig = options.review
    ? `<script>window.__hitslopReviewConfig=${JSON.stringify(options.review).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029")}</script>`
    : "";
  const payload =
    hostStyle +
    theme +
    reviewConfig +
    bridgeScript +
    (options.review ? `<script>${reviewHostJavaScript}</script>` : "");
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (tag) => tag + payload)
    : payload + html;
};

/** Review-only diagnostics; no disk stores, polling, or production bridge changes. */
export const reviewHostJavaScript = `(() => {
  const config = window.__hitslopReviewConfig;
  const errors = [];
  let ready = false;
  let scheduled = false;
  const report = () => {
    scheduled = false;
    const bounds = window.__hitslopCapture?.measure('dev-preview');
    const root = document.documentElement;
    const measurement = { viewportWidth: innerWidth, viewportHeight: innerHeight,
      width: bounds?.width ?? root.scrollWidth, height: bounds?.height ?? root.scrollHeight,
      overflowX: root.scrollWidth > innerWidth, dedicated: bounds?.dedicated ?? false };
    parent.postMessage({ type: 'hitslop:review', pane: config.pane, run: config.run,
      fingerprint: config.fingerprint, ready, errors: [...errors], measurement }, location.origin);
  };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(report); } };
  const fail = value => { errors.push(String(value)); schedule(); };
  window.addEventListener('error', event => fail(event.message || 'Resource failed to load'), true);
  window.addEventListener('unhandledrejection', event => fail(event.reason));
  const originalError = console.error;
  console.error = (...args) => { originalError.apply(console, args); fail(args.map(String).join(' ')); };
  const timeout = setTimeout(() => { if (!ready) fail('Preview did not become ready within 15 seconds'); }, 15000);
  window.addEventListener('slop:ready', async () => {
    try {
      await window.__hitslopDevCapture;
      if (window.__hitslopDevCaptureError) throw new Error(window.__hitslopDevCaptureError);
      await document.fonts.ready;
      await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode()));
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
      ready = true; clearTimeout(timeout); report();
      const observer = new ResizeObserver(schedule);
      observer.observe(document.documentElement);
      if (document.body) observer.observe(document.body);
      window.addEventListener('resize', schedule);
      window.addEventListener('pagehide', () => { observer.disconnect(); clearTimeout(timeout); }, { once: true });
    } catch (error) { clearTimeout(timeout); fail(error); }
  }, { once: true });
})();`;
