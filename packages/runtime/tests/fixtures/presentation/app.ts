import { capture } from "../../../src/capture";

const kind = document.body.dataset.fixture!;
const root = document.querySelector<HTMLElement>("[data-hitslop-root]")!;
let count = 0;
const counter = document.querySelector<HTMLButtonElement>("#counter")!;
counter.onclick = () => {
  counter.textContent = `Clicks: ${++count}`;
};
const slider = document.querySelector<HTMLInputElement>("#level")!;
slider.oninput = () => {
  document.querySelector("output")!.textContent = slider.value;
};
for (const mode of ["export", "icon"] as const) {
  const node = document.createElement("div");
  node.dataset.slopRender = mode;
  node.style.cssText = `display:none;width:${mode === "icon" ? 512 : 320}px;height:${mode === "icon" ? 512 : 240}px;background:transparent;position:relative`;
  node.innerHTML =
    mode === "icon"
      ? '<div style="position:absolute;inset:64px;border:48px solid #245ba8;border-radius:50%;box-sizing:border-box"></div>'
      : `<article style="height:100%;padding:24px;background:#edf3fa;color:#182b47;font:16px system-ui"><h1>${kind}</h1><p>Capture count: <span></span></p><p>Dedicated 320 × 240 output</p></article>`;
  document.body.append(node);
  capture.registerTarget(mode, {
    element: node,
    prepare: () => {
      const span = node.querySelector("span");
      if (span) span.textContent = String(count);
      node.style.display = "block";
    },
    restore: () => {
      node.style.display = "none";
    },
  });
}
const status = document.querySelector("#status")!;
status.textContent = `${kind} · ${root.clientWidth} × ${root.clientHeight}`;
window.slop?.ready?.();
