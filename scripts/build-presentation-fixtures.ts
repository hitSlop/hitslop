import { mkdir, mkdtemp, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { validateRuntimePackage } from "../packages/cli/src/runtime-package";

function chunk(type: string, data: Buffer) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}
/** Deterministic RGBA artwork, with no image tool or downloaded asset dependency. */
function washerPNG() {
  const size = 320,
    pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const offset = y * (size * 4 + 1) + 1 + x * 4,
        r = Math.hypot(x - 159.5, y - 159.5);
      pixels[offset] = 36;
      pixels[offset + 1] = 91;
      pixels[offset + 2] = 168;
      pixels[offset + 3] = r >= 62 && r <= 150 ? 255 : 0;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export async function buildPresentationFixtures() {
  const root = resolve(import.meta.dir, "..");
  const parent = await mkdtemp(join(tmpdir(), "hitslop-presentation-"));
  const bundle = await Bun.build({
    entrypoints: [join(root, "packages/runtime/tests/fixtures/presentation/app.ts")],
    target: "browser",
    format: "iife",
  });
  if (!bundle.success)
    throw new AggregateError(bundle.logs, "Could not build presentation fixtures");
  const packages: Record<string, string> = {};
  for (const kind of ["standard", "ellipse", "washer"] as const) {
    const directory = join(parent, `${kind}.slop`);
    packages[kind] = directory;
    await mkdir(join(directory, "assets"), { recursive: true });
    const presentation =
      kind === "washer"
        ? { width: 320, height: 320, skin: "assets/washer.png" }
        : {
            width: 320,
            height: 320,
            ...(kind === "ellipse" ? { shape: "ellipse", background: "transparent" } : {}),
          };
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify(
        {
          $schema: "https://api.hitslop.com/schemas/v1/manifest.schema.json",
          slug: `presentation-${kind}`,
          title: `Presentation: ${kind}`,
          description: "Developer fixture for window presentation and capture.",
          author: { name: "hitSlop" },
          categories: ["developer-tools"],
          presentation,
        },
        null,
        2,
      ),
    );
    if (kind === "washer") await writeFile(join(directory, "assets/washer.png"), washerPNG());
    await writeFile(join(directory, "assets/app.js"), await bundle.outputs[0]!.text());
    await cp(
      join(root, "packages/cli/skills/hitslop-document"),
      join(directory, ".agents/skills/hitslop-document"),
      { recursive: true },
    );
    await writeFile(
      join(directory, "app.html"),
      `<!doctype html><html><head><meta charset="utf-8"><title>Presentation ${kind}</title><style>
    *{box-sizing:border-box}body{font:14px system-ui;color:#fff}button,input{font:inherit}button:focus-visible,input:focus-visible{outline:3px solid #ffbf47;outline-offset:3px}
    .object{position:relative;width:100%;height:100%}.top{position:absolute;top:44px;left:50%;transform:translateX(-50%);text-align:center;width:180px}.bottom{position:absolute;bottom:38px;left:50%;transform:translateX(-50%);text-align:center;width:160px}button{min-height:36px;padding:6px 16px}input{width:140px}label{display:block}p{margin:6px 0;font-size:11px}
    body[data-fixture="standard"]{margin:16px;color:#182b47;background:#edf3fa}body[data-fixture="standard"] .object{height:288px}
    body[data-fixture="ellipse"] .object{background:#245ba8;border-radius:50%}
    body[data-fixture="washer"] .object{background:url(assets/washer.png) center/100% 100% no-repeat}
    </style><script src="assets/app.js" defer></script></head><body data-fixture="${kind}"><div id="mount"><div class="nested"><main data-hitslop-root class="object"><div class="top"><button id="counter">Clicks: 0</button><p id="status"></p></div><div class="bottom"><label for="level">Level: <output>50</output></label><input id="level" type="range" min="0" max="100" value="50"></div></main></div></div></body></html>`,
    );
    await validateRuntimePackage(directory);
  }
  return { parent, packages };
}
if (import.meta.main) {
  const result = await buildPresentationFixtures();
  console.log(
    `Presentation fixtures (temporary, no catalog registration):\n${Object.values(result.packages).join("\n")}\n\nOpen these with the current development build of hitSlop.\nChecks: packages/runtime/tests/fixtures/presentation/README.md`,
  );
}
