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
const retrySection = {
  title: "Retries",
  body: "Mutations are never automatically replayed. After an unknown outcome, run slop get before issuing another edit. get flushes pending edits before returning.",
};

async function forward(
  command: string,
  target: string,
  flags: Record<string, string | boolean | undefined>,
) {
  const argv = Object.entries(flags).flatMap(([name, value]) =>
    typeof value === "string" ? [`--${name}`, value] : [],
  );
  if (command === "export") {
    if (process.platform !== "darwin")
      throw new Error("PNG/PDF export requires the macOS native renderer");
    await (await import("./native")).runNative([command, target, ...argv]);
  } else await (await import("./documents")).runDocumentCommand(command, target, argv);
}

function themeCommand(command: "get" | "set" | "reset") {
  return defineCommand(command, { description: `${command} theme overrides` }, (sub) => {
    const configured = sub
      .args(document)
      .flags(
        ...(command === "set"
          ? [
              {
                name: "values",
                type: "string" as const,
                required: true as const,
                description: "Theme token values as JSON",
              },
            ]
          : []),
        ...(command === "reset"
          ? [
              {
                name: "token",
                type: "string" as const,
                description: "Token to reset; omit to reset all",
              },
            ]
          : []),
      );
    return configured.action(async ({ args, flags }) => {
      const rest = Object.entries(flags).flatMap(([key, value]) =>
        typeof value === "string" ? [`--${key}`, value] : [],
      );
      await (await import("./native")).runNative(["theme", command, args.document, ...rest]);
    });
  });
}

export const app = new Crust("slop", {
  description: "Author hitSlop mini apps and work with local documents",
  version: cliVersion,
  sections: [
    {
      title: "Document workflow",
      body: "Run bunx @hitslop/cli or install globally with bun install -g @hitslop/cli. Read manifest.json first; only hitslop-v1 is accepted. Inspect schema before editing. Built and registered runtime masters are immutable: create a writable copy before editing. Native macOS commands route to the live session or acquire exclusive ownership when closed.",
    },
  ],
})
  .extend(help())
  .extend(version())
  .add(defineCommand("attachments", { description: "Import, inspect, and export document attachments" }, c => c
    .add(defineCommand("list", { description: "List attachment IDs and sizes" }, c => c.args(document).action(async ({ args }) => {
      await (await import("./native")).runNative(["attachments", "list", args.document]);
    })))
    .add(defineCommand("import", { description: "Save a file and print its reference as JSON" }, c => c.args(document, { name: "file", type: "string", required: true }).action(async ({ args }) => {
      await (await import("./native")).runNative(["attachments", "import", args.document, args.file]);
    })))
    .add(defineCommand("export", { description: "Export an attachment without overwriting an existing file" }, c => c.args(document, { name: "id", type: "string", required: true }).flags({ name: "output", type: "string", required: true }).action(async ({ args, flags }) => {
      await (await import("./native")).runNative(["attachments", "export", args.document, args.id, "--output", flags.output]);
    })))
  ))
  .add(
    defineCommand("init", { description: "Create a checklist authoring project" }, (c) =>
      c.args(source).action(async ({ args }) => {
        await (await import("./authoring")).runAuthoring("init", args.source);
      }),
    ),
  )
  .add(
    defineCommand("check", { description: "Check Svelte and TypeScript authoring source" }, (c) =>
      c.args(source).action(async ({ args }) => {
        const { createRequire } = await import("node:module");
        const require = createRequire(import.meta.url);
        const child = Bun.spawn(
          [
            process.execPath,
            require.resolve("svelte-check/bin/svelte-check"),
            "--workspace",
            args.source,
          ],
          { stdout: "inherit", stderr: "inherit" },
        );
        if (await child.exited) throw new Error("Authoring checks failed");
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
          .flags({
            name: "op",
            type: "string",
            required: true,
            description: "Operation object as JSON",
          })
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
          .flags({
            name: "ops",
            type: "string",
            required: true,
            description: "Array of operations as JSON",
          })
          .action(({ args, flags }) => forward("batch", args.document, flags)),
    ),
  )
  .add(
    defineCommand(
      "compact",
      { description: "Checkpoint document storage", sections: [retrySection] },
      (c) => c.args(document).action(({ args, flags }) => forward("compact", args.document, flags)),
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
  .add(
    defineCommand("theme", { description: "Inspect and override declared theme tokens" }, (c) =>
      c.add(themeCommand("get")).add(themeCommand("set")).add(themeCommand("reset")),
    ),
  )
  .extend(skill({ name: skillName, extras: skillExtras, autoUpdate: false }));
