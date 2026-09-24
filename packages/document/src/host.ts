import { mount, unmount, tick, type Component } from "svelte";
import { documentContext } from "./document-context";
import { mountDocumentView } from "./adapter";

/** Svelte entrypoint. The host owns the document; this adapter owns only its view. */
export async function mountDocument(App: Component): Promise<void> {
  await mountDocumentView({
    mount({ document, target }) {
      const app = mount(App, { target, context: new Map([[documentContext, document]]) });
      return { rendered: tick, unmount: () => unmount(app) };
    },
  });
}
