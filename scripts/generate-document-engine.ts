import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { envelopeSchema } from "../packages/schema/src/document.ts";
import { fixtures, identity, lease } from "../packages/document-engine/tests/fixtures.ts";
const root = resolve(import.meta.dir, "..");
const target = resolve(
  process.env.HITSLOP_GENERATED_ROOT ?? root,
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopDocumentEngine/Resources",
);
await mkdir(target, { recursive: true });
const build = await Bun.build({
  entrypoints: [resolve(root, "packages/document-engine/src/jsc.ts")],
  target: "browser",
  format: "cjs",
  minify: true,
});
if (!build.success) throw new Error(String(build.logs));
const bootstrap = `globalThis.module={exports:{}};globalThis.exports=module.exports;
globalThis.structuredClone=v=>JSON.parse(JSON.stringify(v));
// TypeBox's uniqueItems hashing still encodes individual string values.
// Document byte limits use arithmetic counting and never call this shim.
globalThis.TextEncoder=class {encode(value=""){const s=String(value),bytes=new Uint8Array(s.length*3);let i=0;
for(const c of s){let n=c.codePointAt(0);if(n>=0xd800&&n<=0xdfff)n=0xfffd;
if(n<128)bytes[i++]=n;else if(n<2048){bytes[i++]=192|(n>>6);bytes[i++]=128|(n&63);}
else if(n<65536){bytes[i++]=224|(n>>12);bytes[i++]=128|((n>>6)&63);bytes[i++]=128|(n&63);}
else{bytes[i++]=240|(n>>18);bytes[i++]=128|((n>>12)&63);bytes[i++]=128|((n>>6)&63);bytes[i++]=128|(n&63);}}
return bytes.subarray(0,i)}};
`;
const licenses = await Promise.all(
  ["typebox"].map((name) =>
    Bun.file(resolve(root, "packages/document-engine/node_modules", name, "LICENSE")).text(),
  ),
);
const source =
  "/* Bundled third-party licenses\n" +
  licenses.join("\n\n") +
  "\n*/\n" +
  bootstrap +
  "(() => {" +
  (await build.outputs[0]!.text()) +
  "})();" +
  "\nglobalThis.hitSlopState=module.exports.createNativeEngine(globalThis.hitSlopTrace);\n";
if (Buffer.byteLength(source) >= 180_000) throw new Error("Apple document engine exceeds 180 KB");
if (/Date\.now|Math\.random|crypto\s*\.|\bfetch\s*\(/.test(source))
  throw new Error("Apple document engine contains a nondeterministic API");
await Bun.write(resolve(target, "document-engine.js"), source);
const fixturePath = resolve(
  process.env.HITSLOP_GENERATED_ROOT ?? root,
  "apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/native-engine.json",
);
await mkdir(resolve(fixturePath, ".."), { recursive: true });
await Bun.write(
  fixturePath,
  JSON.stringify(
    fixtures.map((f) => ({
      name: f.name,
      schemaError: f.expected.schemaError ?? false,
      schemaJSON: JSON.stringify(f.schema),
      envelopeJSON: JSON.stringify(
        envelopeSchema(f.schema as Parameters<typeof envelopeSchema>[0]),
      ),
      stateJSON: JSON.stringify({
        snapshot: { ...identity, revision: f.state?.snapshotRevision ?? 0, data: f.data },
        lease,
        undo: f.state?.undo,
      }),
      requestJSON: JSON.stringify({
        ...identity,
        requestId: f.name,
        leaseId: lease.id,
        ...f.command,
      }),
      expectedJSON: f.expected.data === undefined ? null : JSON.stringify(f.expected.data),
      code: f.expected.code ?? null,
      now: String(f.now ?? 0),
    })),
    null,
    2,
  ) + "\n",
);
