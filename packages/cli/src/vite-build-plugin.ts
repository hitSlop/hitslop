import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { Plugin } from "vite";

export type HitSlopBuildPluginOptions = { hasTheme: boolean };
type Element = DefaultTreeAdapterMap["element"];

function elements(html: string): Element[] {
  const result: Element[] = [];
  const visit = (node: DefaultTreeAdapterMap["node"]): void => {
    if ("tagName" in node) result.push(node);
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  return result;
}
const attribute = (node: Element, name: string) => node.attrs.find((attr) => attr.name === name)?.value;
const matches = (value: string | undefined, file: string) => value?.replace(/^\.\//, "") === file;

function replaceElements(html: string, replace: (element: Element) => string | undefined): string {
  for (const element of elements(html).reverse()) {
    const replacement = replace(element);
    const location = element.sourceCodeLocation;
    if (replacement !== undefined && location) html = html.slice(0, location.startOffset) + replacement + html.slice(location.endOffset);
  }
  return html;
}

export function inlineScript(html: string, fileName: string, code: string): string {
  return replaceElements(html, (node) => {
    if (node.tagName !== "script" || !matches(attribute(node, "src"), fileName)) return;
    const start = node.sourceCodeLocation!.startTag!;
    const tag = html.slice(start.startOffset, start.endOffset);
    const src = node.sourceCodeLocation!.attrs!.src!;
    const withoutSource = tag.slice(0, src.startOffset - start.startOffset) + tag.slice(src.endOffset - start.startOffset);
    return withoutSource.replace(/\s+>/, ">") + code.replace(/<(\/script|!--)/gi, "\\x3C$1") + "</script>";
  });
}

export function inlineStyle(html: string, fileName: string, css: string): string {
  return replaceElements(html, (node) => {
    if (node.tagName !== "link" || !matches(attribute(node, "href"), fileName)) return;
    const media = attribute(node, "media");
    const attributes = media ? ' media="' + media.replaceAll("&", "&amp;").replaceAll('"', "&quot;") + '"' : "";
    return "<style" + attributes + ">" + css.replace(/@charset\s+"UTF-8";/i, "").replace(/<\/style/gi, "<\\/style").trim() + "</style>";
  });
}

/** Preserve the JS/resource graph; inline only linked structural CSS. */
export function hitSlopBuildPlugin(options: HitSlopBuildPluginOptions): Plugin {
  return {
    name: "hitslop:build",
    enforce: "post",
    config: () => ({ base: "./", build: { cssCodeSplit: false, assetsDir: "assets", sourcemap: false, assetsInlineLimit: 4096 } }),
    generateBundle(_output, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== "asset" || !asset.fileName.endsWith(".html")) continue;
        let html = String(asset.source);
        for (const style of Object.values(bundle)) {
          if (style.type !== "asset" || !style.fileName.endsWith(".css")) continue;
          const directory = style.fileName.slice(0, style.fileName.lastIndexOf("/") + 1);
          const css = String(style.source).replace(/url\((['"]?)(\.\/)?([^)'"\s]+)\1\)/g, (match, quote: string, _dot: string, url: string) =>
            /^(?:[a-z]+:|\/|#)/i.test(url) ? match : "url(" + quote + directory + url + quote + ")");
          const updated = inlineStyle(html, style.fileName, css);
          if (updated !== html) { html = updated; delete bundle[style.fileName]; }
        }
        if (options.hasTheme) {
          const head = elements(html).find((node) => node.tagName === "head");
          const offset = head?.sourceCodeLocation?.endTag?.startOffset ?? 0;
          const links = '<link rel="stylesheet" href="assets/theme.css" data-hitslop-theme-default><link rel="stylesheet" href="theme.css" data-hitslop-theme>';
          html = html.slice(0, offset) + links + html.slice(offset);
        }
        asset.source = html;
      }
    },
  };
}
