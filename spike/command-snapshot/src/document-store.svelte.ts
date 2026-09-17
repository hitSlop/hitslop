import type { Static, TSchema } from "typebox";
import { createController } from "./controller.ts";
import { TextDrafts, textAction } from "./text.ts";
import type { Host } from "./host.ts";
import type { Address, PathValue } from "./paths.ts";

export function documentStore<S extends TSchema>(options: { schema: S; initial: NoInfer<Static<S>>; host: Host }) {
  const controller = createController(options);
  const drafts = new TextDrafts(controller);
  let data = $state.raw(controller.data);
  const read = () => ({ revision: controller.revision, isLoading: controller.isLoading, pending: controller.pending,
    error: controller.error, connected: controller.connected, canWrite: controller.canWrite,
    hasUnknownOutcome: controller.hasUnknownOutcome, retainedDrafts: drafts.retained });
  let status = $state.raw(read());
  const update = () => { data = controller.data; status = read(); };
  const unstore = controller.subscribe(update), undrafts = drafts.subscribe(update);
  return {
    ...controller,
    get data() { return data; },
    get revision() { return status.revision; },
    get isLoading() { return status.isLoading; },
    get pending() { return status.pending; },
    get error() { return status.error; },
    get connected() { return status.connected; },
    get canWrite() { return status.canWrite; },
    get hasUnknownOutcome() { return status.hasUnknownOutcome; },
    get retainedDrafts() { return status.retainedDrafts; },
    text: textAction(drafts) as <P extends Address>(node: HTMLTextAreaElement | HTMLInputElement, path: P & (PathValue<P> extends string ? unknown : never)) => ReturnType<ReturnType<typeof textAction>>,
    retryDraft: (id: string) => drafts.retry(id),
    discardDraft: (id: string) => drafts.discard(id),
    async destroy() {
      const result = await controller.destroy();
      if (result.ok) { unstore(); undrafts(); drafts.dispose(); }
      return result;
    },
    dispose() { unstore(); undrafts(); drafts.dispose(); controller.dispose(); },
  };
}
