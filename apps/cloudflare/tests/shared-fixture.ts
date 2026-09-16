import * as S from "@hitslop/schema/document";
import { zipSync, strToU8 } from "fflate";
import { digest } from "../src/crypto.ts";
export async function sharedFixture(extra: Record<string, Uint8Array> = {}) {
  const schemaBytes = strToU8(JSON.stringify(S.envelopeSchema(S.Document({ count: S.Number() }))));
  const bytes = zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        $schema: "https://api.hitslop.com/schemas/v1/manifest.schema.json",
        slug: "checklist",
        title: "Checklist",
        description: "A shared fixture",
        categories: ["utilities"],
        author: { name: "Tests" },
        presentation: { width: 320, height: 240 },
      }),
    ),
    "app.html": strToU8("<!doctype html><title>Shared app</title>"),
    "data.schema.json": schemaBytes,
    "assets/initial.json": strToU8('{"count":0}'),
    ...extra,
  });
  return {
    documentId: crypto.randomUUID(),
    title: "Friends",
    slug: "checklist",
    schema: await digest(schemaBytes),
    checkpoint: "AQ==",
    version: "seed",
    package: new File([bytes], "checklist.slop.zip", { type: "application/zip" }),
  };
}
