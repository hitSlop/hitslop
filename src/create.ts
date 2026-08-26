import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pack } from "./pack.ts";

const SYSTEM = await Bun.file(join(import.meta.dir, "create-prompt.md")).text();

export type CreatedDoc = {
  title: string;
  width: number;
  height: number;
  schema_sql: string;
  view_html: string;
  docs: string;
};

function extractJson(text: string): CreatedDoc {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("model did not return JSON");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<CreatedDoc>;
  if (!parsed.view_html || !parsed.schema_sql) {
    throw new Error("model JSON missing view_html or schema_sql");
  }
  return {
    title: parsed.title || "Untitled",
    width: Number(parsed.width) || 420,
    height: Number(parsed.height) || 720,
    schema_sql: parsed.schema_sql,
    view_html: parsed.view_html,
    docs: parsed.docs || "",
  };
}

export async function generateDoc(prompt: string, apiKey: string): Promise<CreatedDoc> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-4.6",
      temperature: 0.8,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`xAI ${res.status}: ${body.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty model response");
  return extractJson(content);
}

export async function createSlop(opts: {
  prompt: string;
  out?: string;
  apiKey?: string;
}): Promise<{ path: string; doc: CreatedDoc }> {
  const apiKey = opts.apiKey ?? process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "XAI_API_KEY is not set. Export it (https://console.x.ai) and rerun `slop create`.",
    );
  }
  const doc = await generateDoc(opts.prompt, apiKey);
  const dir = await mkdtemp(join(tmpdir(), "slop-"));
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "meta.json"),
    JSON.stringify(
      {
        title: doc.title,
        width: doc.width,
        height: doc.height,
        generator: "slop create",
        prompt: opts.prompt,
      },
      null,
      2,
    ),
  );
  await writeFile(join(dir, "schema.sql"), doc.schema_sql);
  await writeFile(join(dir, "view.html"), doc.view_html);
  await writeFile(join(dir, "docs.md"), doc.docs);
  const slug = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const out = opts.out ?? join(process.cwd(), `${slug || "document"}.slop`);
  const path = await pack(dir, out);
  return { path, doc };
}
