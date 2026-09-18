const companions = new WeakMap<object, Set<() => Promise<void>>>();
export function registerDocumentWriter(document: object, flush: () => Promise<void>) {
  let writers = companions.get(document);
  if (!writers) companions.set(document, (writers = new Set()));
  writers.add(flush);
  return () => {
    writers.delete(flush);
  };
}
export async function flushDocumentWriters(document: object) {
  const results = await Promise.allSettled(
    [...(companions.get(document) ?? [])].map((flush) => flush()),
  );
  const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (errors.length) throw new AggregateError(errors, "Attachment writes could not finish");
}
