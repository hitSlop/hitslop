import { readFile, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { createServer, type Plugin } from "vite";
import { injectHost } from "../../packages/cli/src/dev-bridge.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = 4177;
const healthPath = "/__hitslop_gallery__";
const healthValue = "hitslop-slop-gallery-v1";

type GallerySlop = {
  directory: string;
  slug: string;
  title: string;
  description: string;
  width: number;
  height: number;
  hasTheme: boolean;
  migrated: boolean;
};

type GalleryManifest = {
  slug: string;
  title: string;
  description: string;
  presentation: { width: number; height: number };
};

async function readGalleryManifest(path: string): Promise<GalleryManifest> {
  const value = JSON.parse(await readFile(path, "utf8")) as {
    slug?: unknown;
    title?: unknown;
    description?: unknown;
    presentation?: { width?: unknown; height?: unknown };
  };
  if (
    typeof value.slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.presentation?.width !== "number" ||
    typeof value.presentation.height !== "number"
  ) {
    throw new Error(`Gallery metadata is incomplete in ${path}`);
  }
  return value as GalleryManifest;
}

const exists = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
};

export async function discoverSlops(directory = root): Promise<GallerySlop[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const slops: GallerySlop[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const child = join(directory, entry.name);
    if (!await exists(join(child, "manifest.json")) || !await exists(join(child, "index.html"))) continue;
    const manifest = await readGalleryManifest(join(child, "manifest.json"));
    slops.push({
      directory: entry.name,
      slug: manifest.slug,
      title: manifest.title,
      description: manifest.description,
      width: manifest.presentation.width,
      height: manifest.presentation.height,
      hasTheme: await exists(join(child, "assets", "theme.css")),
      migrated: await exists(join(child, "src", "main.ts")) || await exists(join(child, "src", "main.tsx")),
    });
  }
  return slops.sort((a, b) => a.title.localeCompare(b.title));
}

const escapeHTML = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function galleryHTML(slops: GallerySlop[]): string {
  const cards = slops.map((slop) => `
    <a class="slop-card" href="/${encodeURIComponent(slop.slug)}/">
      <div class="card-meta"><span>${escapeHTML(slop.slug)}</span><em>${slop.migrated ? "migrated" : "source → src"}</em></div>
      <strong>${escapeHTML(slop.title)}</strong>
      <p>${escapeHTML(slop.description)}</p>
      <small>${slop.width} × ${slop.height}</small>
    </a>`).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>hitSlop migration gallery</title>
    <style>
      :root { color-scheme: light; font-family: "Avenir Next", Avenir, sans-serif; background: #f3f0e8; color: #211e28; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: clamp(28px, 6vw, 72px); }
      header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 34px; border-bottom: 2px solid currentColor; padding-bottom: 18px; }
      h1 { max-width: 620px; margin: 0; font-size: clamp(40px, 8vw, 88px); line-height: .82; letter-spacing: -.07em; }
      header p { max-width: 310px; margin: 0; color: #665e6c; font-size: 14px; line-height: 1.45; }
      main { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
      .slop-card { min-height: 205px; border: 1.5px solid currentColor; padding: 18px; color: inherit; background: #fffaf0; text-decoration: none; transition: transform 150ms ease, box-shadow 150ms ease; }
      .slop-card:nth-child(4n+2) { background: #b9dcff; }
      .slop-card:nth-child(4n+3) { background: #f4dc54; }
      .slop-card:nth-child(4n+4) { background: #f6b4bf; }
      .slop-card:hover { transform: translate(-3px, -3px); box-shadow: 6px 6px 0 #211e28; }
      .slop-card:focus-visible { outline: 3px solid #e8493f; outline-offset: 3px; }
      .card-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .slop-card span, .slop-card small, .slop-card em { display: block; font-size: 10px; font-style: normal; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
      .slop-card em { color: #e8493f; font-size: 8px; }
      .slop-card strong { display: block; margin-top: 27px; font-size: 22px; line-height: 1; }
      .slop-card p { min-height: 50px; margin: 9px 0 16px; color: #514a57; font-size: 12px; line-height: 1.35; }
      @media (max-width: 620px) { header { align-items: start; flex-direction: column; } }
    </style>
  </head>
  <body>
    <header><h1>Slop migration gallery</h1><p>One server, every authored slop. Choose a template to open its disposable browser preview.</p></header>
    <main>${cards}</main>
  </body>
</html>`;
}

const prefixRootPaths = (html: string, slug: string): string =>
  html.replace(/\b(src|href)=(["'])\/(?!\/)([^"']+)\2/g, (_match, attribute, quote, path) =>
    `${attribute}=${quote}/${slug}/${path}${quote}`
  );

export function galleryPlugin(slops: GallerySlop[], directory = root): Plugin {
  const bySlug = new Map(slops.map((slop) => [slop.slug, slop]));
  return {
    name: "hitslop-slop-gallery",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url || request.method !== "GET") return next();
        const pathname = new URL(request.url, "http://localhost").pathname;
        if (pathname === healthPath) {
          response.setHeader("content-type", "text/plain; charset=utf-8");
          response.end(healthValue);
          return;
        }
        if (pathname === "/") {
          const html = await server.transformIndexHtml("/", galleryHTML(slops));
          response.setHeader("content-type", "text/html; charset=utf-8");
          response.end(html);
          return;
        }
        const match = pathname.match(/^\/([^/]+)(\/|\/index\.html)?$/);
        if (!match) return next();
        const slug = decodeURIComponent(match[1] ?? "");
        const slop = bySlug.get(slug);
        if (!slop) return next();
        if (pathname === `/${encodeURIComponent(slug)}`) {
          response.statusCode = 307;
          response.setHeader("location", `/${encodeURIComponent(slug)}/`);
          response.end();
          return;
        }
        const source = await readFile(join(directory, slop.directory, "index.html"), "utf8");
        const prefixed = prefixRootPaths(source, slug);
        const hosted = injectHost(prefixed, slop.hasTheme ? { themeHref: `/${slug}/assets/theme.css` } : {});
        const html = await server.transformIndexHtml(`/${slug}/`, hosted);
        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(html);
      });
    },
  };
}

const requestedSlug = process.argv.slice(2).find((argument: string) => !argument.startsWith("-"));
const requestedPath = requestedSlug ? `/${encodeURIComponent(requestedSlug)}/` : "/";
const requestedURL = `http://localhost:${port}${requestedPath}`;

async function openURL(url: string): Promise<void> {
  if (process.platform !== "darwin") return;
  spawn("open", [url], { stdio: "ignore", detached: true }).unref();
}

async function reuseRunningGallery(): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}${healthPath}`, { signal: AbortSignal.timeout(400) });
    if (response.ok && await response.text() === healthValue) {
      console.log(`hitSlop gallery already running: ${requestedURL}`);
      await openURL(requestedURL);
      return true;
    }
  } catch {
    // Nothing is listening on the gallery port.
  }
  return false;
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;

if (isMain) {
  const slops = await discoverSlops();
  if (requestedSlug && !slops.some((slop) => slop.slug === requestedSlug)) {
    throw new Error(`Unknown slop slug: ${requestedSlug}`);
  }
  if (!await reuseRunningGallery()) {
    const server = await createServer({
      root,
      configFile: false,
      appType: "mpa",
      plugins: [galleryPlugin(slops), vanillaExtractPlugin(), react(), svelte()],
      server: { host: "localhost", port, strictPort: true },
    });
    await server.listen();
    console.log(`hitSlop gallery: http://localhost:${port}/`);
    if (requestedSlug) console.log(`Selected slop: ${requestedURL}`);
    await openURL(requestedURL);
  }
}
