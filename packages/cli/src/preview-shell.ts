/** Host UI is outside the document viewport and never participates in capture. */
export const previewPanelScript = `(() => {
 const panels = new Map();
 window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data?.type !== 'hitslop:errors') return;
  const frame = [...document.querySelectorAll('iframe')].find(frame => frame.contentWindow === event.source);
  if (!frame) return;
  let panel = panels.get(frame);
  if (!panel) {
   const element = document.createElement('div'); element.dataset.hitslopHost = 'errors';
   (frame.closest('.viewport') ?? frame).after(element);
   const shadow = element.attachShadow({mode:'open'}); panel = {element, shadow}; panels.set(frame, panel);
  }
  panel.shadow.replaceChildren();
  const style = document.createElement('style'); style.textContent = ':host{display:block;font:13px system-ui;color:#202020}section{padding:12px;border:1px solid #ccc;border-radius:8px;background:#fafafa;margin-top:8px;max-width:640px}p{margin:0 0 8px}button{font:inherit;padding:5px 9px;margin-right:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere}'; panel.shadow.append(style);
  for (const report of event.data.reports) {
   const section = document.createElement('section'); section.setAttribute('role','status'); section.setAttribute('aria-live','polite');
   const message = document.createElement('p'); message.textContent = report.message; section.append(message);
   if (report.details) { const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Details';const text=document.createElement('pre');text.textContent=report.details;details.append(summary,text);section.append(details); }
   const action = (label,dismiss) => { const button=document.createElement('button');button.textContent=label;button.disabled=report.busy;button.onclick=()=>{button.disabled=true;frame.contentWindow.postMessage({type:'hitslop:error-action',id:report.id,revision:report.revision,instance:report.instance,dismiss},location.origin)};section.append(button); };
   if(report.action) action(report.action,false);if(report.dismissible) action('Dismiss',true);
   panel.shadow.append(section);
  }
 });
})();`;
export function previewShell(url: string, width = 480, height = 620): string {
  const src = new URL(url, "http://preview"); src.searchParams.set("_slopFrame", "1");
  const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>hitSlop preview</title><style>body{margin:0;padding:20px;background:#efefed}main{width:fit-content;margin:auto;max-width:100%}iframe{display:block;border:0;width:${width}px;max-width:100%;height:${height}px}</style></head><body><main><iframe title="Document preview" src="${escape(src.pathname + src.search)}"></iframe></main><script>${previewPanelScript}</script></body></html>`;
}
