import type { Plugin, UserConfig } from "vite";
import { version as viteVersion } from "vite";

export type HitSlopBuildPluginOptions = { hasTheme: boolean };
type BundleAsset = { type: "asset"; fileName: string; source: string | Uint8Array };
type BundleChunk = { type: "chunk"; fileName: string; code: string };

const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function inlineScript(html: string, fileName: string, code: string): string {
  const name = escapePattern(fileName);
  const tag = new RegExp(`<script([^>]*?)\\ssrc=["'](?:[^"']*\\/)?${name}["']([^>]*)>\\s*</script>`, "g");
  const safeCode = code.replace(/"?__VITE_PRELOAD__"?/g, "void 0").replace(/<(\/script>|!--)/g, "\\x3C$1");
  return html.replace(tag, (_match, before, after) => `<script${before}${after}>${safeCode.trim()}</script>`);
}

export function inlineStyle(html: string, fileName: string, css: string): string {
  const name = escapePattern(fileName);
  const tag = new RegExp(`<link([^>]*?)\\shref=["'](?:[^"']*\\/)?${name}["']([^>]*)>`, "g");
  return html.replace(tag, (_match, before, after) => `<style${before}${after}>${css.replace('@charset "UTF-8";', "").trim()}</style>`);
}

const addThemeLinks = (html: string): string => {
  if (html.includes("data-hitslop-theme-default")) return html;
  const links = '<link rel="stylesheet" href="assets/theme.css" data-hitslop-theme-default><link rel="stylesheet" href="theme.css" data-hitslop-theme>';
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${links}</head>`) : links + html;
};

/** Builds one source-free app.html while preserving an external theme contract. */
export function hitSlopBuildPlugin(options: HitSlopBuildPluginOptions): Plugin {
  const configure = (config: UserConfig): void => {
    config.base = "./";
    config.build ??= {};
    config.build.assetsInlineLimit = () => true;
    config.build.chunkSizeWarningLimit = 100_000_000;
    config.build.cssCodeSplit = false;
    config.build.assetsDir = "";
    config.build.rollupOptions ??= {};
    config.build.rollupOptions.output ??= {};
    const outputs = Array.isArray(config.build.rollupOptions.output)
      ? config.build.rollupOptions.output
      : [config.build.rollupOptions.output];
    for (const output of outputs) {
      if (Number.parseInt(viteVersion.split(".")[0] ?? "0", 10) >= 8) {
        (output as { codeSplitting: boolean }).codeSplitting = false;
      } else output.inlineDynamicImports = true;
    }
  };

  return {
    name: "hitslop:build",
    enforce: "post",
    config: configure,
    generateBundle(_output, bundle) {
      const htmlAssets = Object.values(bundle).filter((item): item is typeof item & BundleAsset => item.type === "asset" && item.fileName.endsWith(".html"));
      const scripts = Object.values(bundle).filter((item): item is typeof item & BundleChunk => item.type === "chunk" && /\.[mc]?js$/.test(item.fileName));
      const styles = Object.values(bundle).filter((item): item is typeof item & BundleAsset => item.type === "asset" && item.fileName.endsWith(".css"));
      const consumed = new Set<string>();

      for (const asset of htmlAssets) {
        let html = typeof asset.source === "string" ? asset.source : new TextDecoder().decode(asset.source);
        for (const script of scripts) { html = inlineScript(html, script.fileName, script.code); consumed.add(script.fileName); }
        for (const style of styles) {
          const css = typeof style.source === "string" ? style.source : new TextDecoder().decode(style.source);
          html = inlineStyle(html, style.fileName, css); consumed.add(style.fileName);
        }
        if (options.hasTheme) html = addThemeLinks(html);
        asset.source = html;
      }
      for (const fileName of consumed) delete bundle[fileName];
    },
  };
}
