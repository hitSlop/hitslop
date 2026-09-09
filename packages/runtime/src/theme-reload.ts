/** Keep the last loaded theme until its latest replacement has loaded. */
export function createThemeReload(document: Pick<Document, "querySelector">) {
  let pending: HTMLLinkElement | undefined;
  return (revision: string): void => {
    pending?.remove();
    pending = undefined;
    const current = document.querySelector<HTMLLinkElement>('link[data-hitslop-theme]');
    if (!current) return;
    const next = current.cloneNode() as HTMLLinkElement;
    pending = next;
    next.href = `theme.css?revision=${encodeURIComponent(revision)}`;
    next.onload = () => {
      if (pending !== next) return;
      pending = undefined;
      current.remove();
    };
    next.onerror = () => {
      if (pending !== next) return;
      pending = undefined;
      next.remove();
    };
    current.after(next);
  };
}
