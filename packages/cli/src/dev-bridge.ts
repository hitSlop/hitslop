// The browser half of `slop dev`: a window.slop implementation backed by the
// mock host HTTP bridge in dev.ts. Injected verbatim into the served HTML.

export const POLL_INTERVAL_MS = 750;

export const hostStyle = `<style data-hitslop-host>*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}</style>`;

export const bridgeScript = `<script>
(() => {
  const POLL_INTERVAL_MS = ${POLL_INTERVAL_MS};
  const listeners = { json: new Set(), sqlite: new Set(), media: new Set() };
  const pollers = {};

  const call = async (path, body = {}) => {
    const response = await fetch('/__hitslop/' + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || response.statusText);
    return value;
  };

  const emit = (kind, event) => listeners[kind].forEach((callback) => callback({ kind, ...event }));

  // One shared poller per store kind, alive only while it has subscribers.
  const ensurePoller = (kind) => {
    if (pollers[kind]) return;
    let revision;
    pollers[kind] = setInterval(async () => {
      try {
        const value = await call(kind + '/revision');
        if (revision !== undefined && revision !== value.revision) {
          emit(kind, { source: 'external', revision: value.revision });
        }
        revision = value.revision;
      } catch {}
    }, POLL_INTERVAL_MS);
  };

  const watch = (kind, callback) => {
    listeners[kind].add(callback);
    ensurePoller(kind);
    return () => {
      listeners[kind].delete(callback);
      if (listeners[kind].size === 0) {
        clearInterval(pollers[kind]);
        delete pollers[kind];
      }
    };
  };

  const resize = async (size) => {
    const native = window.webkit?.messageHandlers?.hitslopDevWindow;
    if (native) return native.postMessage({ action: 'resize', ...size });
    return size;
  };

  const drag = async () => {
    const native = window.webkit?.messageHandlers?.hitslopDevWindow;
    if (native) return native.postMessage({ action: 'drag' });
    return undefined;
  };

  window.slop = {
    json: {
      open: (value) => call('json/open', { value }),
      read: () => call('json/read'),
      write: (value, expectedRevision) => call('json/write', { value, expectedRevision })
        .then((result) => (emit('json', { source: 'app', revision: result.revision }), result)),
      onChange: (callback) => watch('json', callback)
    },
    db: {
      query: (sql, parameters = []) => call('sqlite/query', { sql, parameters }),
      execute: (sql, parameters = []) => call('sqlite/execute', { sql, parameters })
        .then((result) => (emit('sqlite', { source: 'app' }), result)),
      transaction: (statements) => call('sqlite/transaction', { statements })
        .then((result) => (emit('sqlite', { source: 'app' }), result)),
      onChange: (callback) => watch('sqlite', callback)
    },
    media: {
      open: (name) => call('media/open', { name }),
      write: (name, data, mimeType) => call('media/write', { name, data, mimeType })
        .then((result) => (emit('media', { source: 'app', revision: result.revision }), result)),
      remove: (name) => call('media/remove', { name })
        .then((result) => (emit('media', { source: 'app', revision: null }), result)),
      onChange: (callback) => watch('media', callback)
    },
    window: { resize, drag },
    // Mirror the native host (SlopWebView.swift): flag readiness on <html> and
    // announce it as a window event so guests behave identically in dev.
    ready: () => {
      document.documentElement.dataset.hitslopReady = 'true';
      window.dispatchEvent(new Event('slop:ready'));
    }
  };
})();
</script>`;

export const injectHost = (html: string): string => {
  const payload = hostStyle + bridgeScript;
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, (tag) => tag + payload)
    : payload + html;
};
