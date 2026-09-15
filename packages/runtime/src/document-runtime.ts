import { runtimeVersionParts, type DocumentRuntime } from "@hitslop/schema/document-runtime";

export type RuntimeConfiguration = { version: string; scriptURL: string };
declare global {
  interface Window {
    __hitslopRuntimeConfig?: RuntimeConfiguration;
    __hitslopDocumentRuntime?: DocumentRuntime;
  }
}

/** Host resources only; opening a document never downloads executable code. */
export function createDocumentRuntimeLoader(config: RuntimeConfiguration): DocumentRuntime {
  // The host selected compatibility already. This loader must also serve retained
  // runtime majors when the host itself is built with a newer SDK.
  runtimeVersionParts(config.version);
  let loading: Promise<DocumentRuntime> | undefined;
  const load = (): Promise<DocumentRuntime> => {
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const fail = (message: string) => { script.remove(); reject(new Error(message)); };
      script.src = config.scriptURL;
      script.onload = () => {
        const runtime = window.__hitslopDocumentRuntime;
        if (!runtime || runtime.version !== config.version) return fail("The installed document runtime does not match its catalog");
        resolve(runtime);
      };
      script.onerror = () => fail("The installed document runtime could not be loaded. Reinstall or update hitSlop.");
      (document.head ?? document.documentElement).append(script);
    });
    void loading.catch(() => { loading = undefined; });
    return loading;
  };
  return Object.freeze({
    version: config.version,
    open: async options => (await load()).open(options),
    sharedSeed: async (schema, value) => (await load()).sharedSeed(schema, value),
  } satisfies DocumentRuntime);
}
