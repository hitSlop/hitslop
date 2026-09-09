import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { createServer } from "vite";
import { injectHost } from "./dev-bridge.ts";
import { loadManifest } from "./project.ts";
import { readThemeCSS } from "./theme.ts";

/** Browser-only preview host. Durable storage behavior is tested in a built .slop. */
export function mockHostPlugin(options: { themeHref?: string } = {}): Plugin {
  return {
    name: "hitslop-browser-preview",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => injectHost(html, options),
    },
  };
}

export async function runDev(root: string): Promise<void> {
  await loadManifest(root);
  const themeHref = await readThemeCSS(root) !== undefined ? "/assets/theme.css" : undefined;
  const server = await createServer({ root, plugins: [themePreviewPlugin(root), mockHostPlugin(themeHref ? { themeHref } : {})] });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Vite did not expose a development URL");
  console.log(`hitSlop UI preview: ${url}`);
  if (process.platform === "darwin") Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
}

export function themePreviewPlugin(root: string): Plugin {
  root = resolve(root);
  return {
    name: "hitslop:theme-preview",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split("?")[0] !== "/assets/theme.css") return next();
        try {
          const css = await readThemeCSS(root);
          if (css === undefined) return next();
          response.setHeader("Content-Type", "text/css; charset=utf-8");
          response.end(css);
        } catch (error) { next(error as Error); }
      });
    },
    handleHotUpdate({ file, server }) {
      if (file === join(root, "theme.ts")) server.ws.send({ type: "full-reload" });
    },
  };
}
