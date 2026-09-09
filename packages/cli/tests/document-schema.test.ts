import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

test("Checklist retains its UI and uses interpreted validation without compilers", async () => {
  const root = fileURLToPath(new URL("../../../examples/slops/quick-checklist", import.meta.url));
  const environment = process.env.NODE_ENV;
  let result: Awaited<ReturnType<typeof build>>;
  try {
    process.env.NODE_ENV = "production";
    result = await build({ root, logLevel: "silent", build: { write: false } });
  } finally {
    if (environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = environment;
  }
  const outputs = Array.isArray(result) ? result.flatMap(value => value.output) : "output" in result ? result.output : [];
  const chunks = outputs.filter(value => value.type === "chunk");
  const code = chunks.map(chunk => chunk.code).join("\n");
  const modules = chunks.flatMap(chunk => Object.entries(chunk.modules)
    .filter(([, module]) => module.renderedLength > 0).map(([path]) => path));
  expect(modules.some(path => path.includes("/bits-ui/"))).toBe(true);
  expect(modules.some(path => path.includes("/typebox/"))).toBe(true);
  expect(modules.some(path => /\/ajv\/dist\/(compile|core|2020)/.test(path))).toBe(false);
  expect(modules.some(path => path.includes("/typebox/") && /\/compile\//.test(path))).toBe(false);
  expect(modules.some(path => path.includes("/.hitslop/generated/"))).toBe(false);
  expect(code).not.toContain("new Function(");
  expect(Buffer.byteLength(code)).toBeLessThan(269_000);
  expect(gzipSync(code).length).toBeLessThan(84_000);
}, 30_000);
