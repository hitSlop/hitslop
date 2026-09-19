import type { SlopPresentation } from "@hitslop/schema/manifest";

/** Host-supplied initial geometry, not the current viewport or a live resize API. */
export type PresentationStage = {
  mode: "standard" | "transparent" | "skin";
  width: number;
  height: number;
  resizable: boolean;
  shape?: "rounded" | "ellipse" | "capsule";
};

export function presentationStage(presentation: SlopPresentation): PresentationStage {
  if ("skin" in presentation)
    return {
      mode: "skin",
      width: presentation.width,
      height: presentation.height,
      resizable: false,
    };
  return {
    mode: presentation.background === "transparent" ? "transparent" : "standard",
    width: presentation.width,
    height: presentation.height,
    resizable: presentation.resizable ?? true,
    shape: presentation.shape ?? "rounded",
  };
}

export const hostScrollbarCSS =
  "*{scrollbar-width:none!important}*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}";

export function presentationStageCSS(stage?: PresentationStage): string {
  if (!stage || stage.mode === "standard") return hostScrollbarCSS;
  const root = `html[data-slop-presentation="${stage.mode}"]:not([data-slop-capture])`;
  return (
    hostScrollbarCSS +
    `:where(${root},${root} body){margin:0;padding:0;width:100%;height:100%;background:transparent}` +
    `:where(${root} [data-hitslop-root],${root} body *:has([data-hitslop-root])){height:100%;min-height:0}` +
    (stage.mode === "skin" ? `:where(${root},${root} body){overflow:hidden}` : "")
  );
}

/** Shared by WKWebView's document-start script and the disposable preview host. */
export function installPresentationStage(stage?: PresentationStage): void {
  const install = () => {
    const root = document.documentElement;
    if (stage) {
      root.dataset.slopPresentation = stage.mode;
      if (stage.shape) root.dataset.slopShape = stage.shape;
      else root.removeAttribute("data-slop-shape");
      root.toggleAttribute("data-slop-resizable", stage.resizable);
      root.style.setProperty("--slop-width", `${stage.width}px`);
      root.style.setProperty("--slop-height", `${stage.height}px`);
    }
    let style = document.querySelector<HTMLStyleElement>("style[data-hitslop-host]");
    if (!style) {
      style = document.createElement("style");
      style.dataset.hitslopHost = "";
      (document.head || root).appendChild(style);
    }
    style.textContent = presentationStageCSS(stage);
  };
  if (document.documentElement) install();
  else document.addEventListener("DOMContentLoaded", install, { once: true });
}
