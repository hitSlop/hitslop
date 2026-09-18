import { createContext } from "svelte";
import { pathInfo } from "@hitslop/schema/document";
import type { TSchema } from "typebox";
import type { SlopDocument } from "./create-document.svelte.js";

const [getStore, setStore] = createContext<unknown>();
export const provideSlop = setStore;

/** The schema supplies inference and verifies the provider's document identity. */
export function useSlop<S extends TSchema>(schema: S): SlopDocument<S> {
  const store = getStore() as SlopDocument<S>;
  if (store.fields[pathInfo].root !== schema)
    throw new Error("Slop context belongs to another schema");
  return store;
}
