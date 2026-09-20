import { Crust, defineCommand } from "@crustjs/core";
import { help, version } from "@crustjs/extensions";
import { skill } from "@crustjs/skills";
import metadata from "../package.json";

export const skillExtras = [
  "hitslop",
  "hitslop-authoring",
  "hitslop-design",
  "hitslop-document",
].map((name) => new URL(`../skills/${name}/`, import.meta.url));
export const skillName = "hitslop-cli";
export const cliVersion = metadata.version;

const source = {
  name: "source",
  type: "path",
  required: true,
  description: "Authoring source directory",
} as const;
const document = {
  name: "document",
  type: "string",
  required: true,
  description: "Path to a .slop document",
} as const;
const retry = [
  { name: "id", type: "string", description: "Printed request ID; supply with --epoch" },
  { name: "epoch", type: "string", description: "Printed session epoch; supply with --id" },
] as const;
const retrySection = {
  title: "Retries",
  body: "Supply --id and --epoch together with exactly the same operation, only when retrying a printed retry identity. After session expiry, inspect state before expressing new intent.",
};

async function forward(
  command: string,
  target: string,
  flags: Record<string, string | boolean | undefined>,
) {
  if ((flags.id === undefined) !== (flags.epoch === undefined))
    throw new Error("Provide --id and --epoch together, or omit both");
  const argv = Object.entries(flags).flatMap(([name, value]) =>
    typeof value === "string" ? [`--${name}`, value] : [],
  );
  if (command === "export") {
    if (process.platform !== "darwin")
      throw new Error("PNG/PDF export requires the macOS native renderer");
    await (await import("./native")).runNative([command, target, ...argv]);
  } else await (await import("./documents")).runDocumentCommand(command, target, argv);
}

export const app = new Crust("slop", {
  description: "Author hitSlop mini apps and work with local documents",
  version: cliVersion,
  sections: [
    {
      title: "Document workflow",
      body: "In this checkout, invoke commands with bun slop. Read manifest.json first; only hitslop-v1 is accepted. Inspect schema before editing. Built and registered runtime masters are immutable: create a writable copy before editing. Native macOS commands route to the live session or acquire exclusive ownership when closed.",
    },
  ],
})
  .extend(help())
  .extend(version())
  .add(
    defineCommand("init", { description: "Create a checklist authoring project" }, (c) =>
      c.args(source).action(async ({ args }) => {
        await (await import("./authoring")).runAuthoring("init", args.source);
      }),
    ),
  )
  .add(
    defineCommand("dev", { description: "Serve a disposable browser preview" }, (c) =>
      c
        .args(source)
        .flags({
          name: "port",
          type: "number",
          default: 5173,
          description: "HTTP port (1–65535)",
        })
        .action(async ({ args, flags }) => {
          if (!Number.isInteger(flags.port) || flags.port < 1 || flags.port > 65535)
            throw new Error("Port must be an integer from 1 to 65535");
          await (await import("./authoring")).runAuthoring("dev", args.source, flags.port);
        }),
    ),
  )
  .add(
    defineCommand("build", { description: "Build a runtime template with native previews" }, (c) =>
      c.args(source).action(async ({ args }) => {
        await (await import("./authoring")).runAuthoring("build", args.source);
      }),
    ),
  )
  .add(
    defineCommand(
      "register",
      { description: "Build and register an immutable local template" },
      (c) =>
        c.args(source).action(async ({ args }) => {
          await (await import("./authoring")).runAuthoring("register", args.source);
        }),
    ),
  )
  .add(
    defineCommand("schema", { description: "Print the document schema descriptor" }, (c) =>
      c.args(document).action(({ args }) => forward("schema", args.document, {})),
    ),
  )
  .add(
    defineCommand("get", { description: "Print current document state as JSON" }, (c) =>
      c.args(document).action(({ args }) => forward("get", args.document, {})),
    ),
  )
  .add(
    defineCommand(
      "apply",
      { description: "Apply one document operation", sections: [retrySection] },
      (c) =>
        c
          .args(document)
          .flags(
            { name: "op", type: "string", required: true, description: "Operation object as JSON" },
            ...retry,
          )
          .action(({ args, flags }) => forward("apply", args.document, flags)),
    ),
  )
  .add(
    defineCommand(
      "batch",
      { description: "Apply an atomic batch of document operations", sections: [retrySection] },
      (c) =>
        c
          .args(document)
          .flags(
            {
              name: "ops",
              type: "string",
              required: true,
              description: "Array of operations as JSON",
            },
            ...retry,
          )
          .action(({ args, flags }) => forward("batch", args.document, flags)),
    ),
  )
  .add(
    defineCommand(
      "compact",
      { description: "Checkpoint document storage", sections: [retrySection] },
      (c) =>
        c
          .args(document)
          .flags(...retry)
          .action(({ args, flags }) => forward("compact", args.document, flags)),
    ),
  )
  .add(
    defineCommand(
      "export",
      {
        description: "Export a document as PNG or PDF on macOS",
        sections: [
          {
            title: "Capture behavior",
            body: "Open documents export their live selected view; closed documents export the saved state with the initial view. Output must be outside the source package. A lost acknowledgement has an uncertain outcome: inspect the destination before retrying.",
          },
        ],
      },
      (c) =>
        c
          .args(document)
          .flags(
            {
              name: "format",
              type: "string",
              choices: ["png", "pdf"],
              required: true,
              description: "Export format: png or pdf",
            },
            {
              name: "output",
              type: "string",
              required: true,
              description: "Destination outside the document package",
            },
          )
          .action(({ args, flags }) => forward("export", args.document, flags)),
    ),
  )
  .extend(skill({ name: skillName, extras: skillExtras, autoUpdate: false }));
