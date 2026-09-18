import { fileURLToPath } from "node:url";
import { protocolVersion } from "@hitslop/schema/bridge";
// Browser-only half of `slop dev`. This disposable window.slop fake exists to
// keep authored UI renderable; it deliberately does not model durable storage.

export const hostStyle = `<style data-hitslop-host>*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}</style>`;

const previewBundle = await Bun.build({
  entrypoints: [fileURLToPath(import.meta.resolve("./preview-authority.js"))],
  target: "browser",
  format: "iife",
  minify: true,
});
if (!previewBundle.success) throw new Error(previewBundle.logs.join("\n"));
const previewAuthorityJavaScript = await previewBundle.outputs[0]!.text();

export const devHostJavaScript = `${previewAuthorityJavaScript}\n(() => {
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
  const listeners = { document: new Set(), media: new Set() };
  let authority;
  const media = new Map();
  window.addEventListener("pagehide", () => { for (const value of media.values()) URL.revokeObjectURL(value.src); media.clear(); }, {once:true});

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const emit = (kind, event) => listeners[kind].forEach((callback) => callback({ kind, ...event }));
  const watch = (kind, callback) => {
    listeners[kind].add(callback);
    return () => listeners[kind].delete(callback);
  };
  const resize = async (size) => size;
  const drag = async () => undefined;

  let errorPanel;
  const reportError = async issue => {
    console.error('[hitSlop ' + issue.source + ']', issue.message);
    if (!errorPanel) {
      errorPanel = document.createElement('aside');
      errorPanel.setAttribute('role', 'alert');
      errorPanel.setAttribute('data-slop-export', 'hide');
      errorPanel.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483647;padding:12px;background:#fff;color:#222;border:1px solid #aaa;font:14px system-ui';
      document.body.append(errorPanel);
    }
    errorPanel.replaceChildren();
    const message = document.createElement('p'); message.textContent = issue.message;
    const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss';
    dismiss.onclick = () => { errorPanel.remove(); errorPanel = undefined; };
    errorPanel.append(message, dismiss);
    if (issue.source === 'render') {
      const retry = document.createElement('button'); retry.textContent = 'Try again';
      retry.onclick = async () => {
        const result = await window.__hitslopDocumentRecovery?.('render');
        if (result?.ok && dismiss.isConnected) dismiss.click();
      };
      errorPanel.append(retry);
    }
  };
  window.addEventListener('error', event => { void reportError({source:'unhandled',message:event.message || 'App error'}); });
  window.addEventListener('unhandledrejection', event => { void reportError({source:'unhandled',message:String(event.reason)}); });
  window.slop = Object.freeze({
    reportError,
    info: async () => ({ protocolVersion: ${protocolVersion}, capabilities: ['host.info', 'document.open', 'document.execute', 'document.flush', 'window.resize', 'window.drag'] }),
    flush: async () => undefined,
    document: Object.freeze({
      connected: true, writable: true,
      open: async (options) => {
        if (!authority) {
          const data = clone(window.__hitslopReviewConfig && Object.hasOwn(window.__hitslopReviewConfig, 'data') ? window.__hitslopReviewConfig.data : options?.initial);
          if (data === undefined || !options?.schema) throw new Error('Preview requires schema and initial data');
          authority = window.__hitslopCreatePreviewAuthority(options.schema, data);
          authority.subscribe(snapshot => listeners.document.forEach(callback => callback(clone(snapshot))));
        }
        return clone(authority.open());
      },
      send: async request => { if (!authority) throw new Error('Open the document first'); return clone(await authority.execute(clone(request))); },
      flush: async () => undefined,
      subscribe: callback => watch('document', callback),
      onConnection: () => () => {},
    }),
    media: Object.freeze({
      open: async sha256 => ({src:media.get(sha256)?.src ?? null}),
      add: async (data, kind) => {
        const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error('Media exceeds its size limit');
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
        const mime = bytes[0] === 137 && bytes[1] === 80 ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 ? 'image/jpeg' : bytes[0] === 71 && bytes[1] === 73 ? 'image/gif' : bytes[8] === 87 && bytes[9] === 69 ? 'image/webp' : bytes[0] === 80 && bytes[1] === 75 ? 'application/zip' : undefined;
        if (!mime || (kind === 'image' && !mime.startsWith('image/'))) throw new Error('Unsupported media');
        if (!media.has(sha256)) media.set(sha256,{src:URL.createObjectURL(new Blob([bytes],{type:mime}))});
        emit('media',{source:'dev',sha256});
        return {sha256,mime,bytes:bytes.length};
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
