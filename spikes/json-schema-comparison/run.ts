import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import * as S from "../../packages/schema/src/document.ts";
import checklist from "../../examples/slops/quick-checklist/schema.ts";
import initial from "../../examples/slops/quick-checklist/initial.ts";
import { makeFixtures, type Group, type Boundary } from "./fixtures.ts";
import { preservedJSON, equalJSON } from "./oracle.ts";

// Resolve the exact installed TypeBox used by the production schema workspace.
async function main() {
  const requireSchema = createRequire(
    new URL("../../packages/schema/package.json", import.meta.url),
  );
  const { Compile } = await import(requireSchema.resolve("typebox/compile"));
  const { Check, Errors } = await import(requireSchema.resolve("typebox/value"));
  const { Check: CheckSchema, Meta } = await import(requireSchema.resolve("typebox/schema"));

  const folder = dirname(fileURLToPath(import.meta.url)),
    root = resolve(folder, "../..");
  const label = process.argv[2] ?? "compatibility-latest";
  if (!/^[a-z0-9-]+$/.test(label) || ["first", "second"].includes(label))
    throw new Error(
      "Use a lowercase compatibility label; historical first/second reports are protected",
    );
  const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
  const provenance: { path: string; sha256: string }[] = [];
  async function read(path: string) {
    const bytes = await readFile(resolve(root, path));
    provenance.push({ path, sha256: hash(bytes) });
    return bytes.toString();
  }
  const shared = JSON.parse(
    await read(
      "apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/data-conformance.json",
    ),
  );
  const bridge = JSON.parse(
    await read(
      "apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/Resources/bridge-request.schema.json",
    ),
  );
  const fixtures = makeFixtures(shared, bridge, checklist, initial);
  for (const path of [
    "spikes/json-schema-comparison/fixtures.ts",
    "spikes/json-schema-comparison/oracle.ts",
    "spikes/json-schema-comparison/run.ts",
    "spikes/json-schema-comparison/Sources/Comparison/main.swift",
    "spikes/json-schema-comparison/Sources/Comparison/Adapters.swift",
    "spikes/json-schema-comparison/Package.resolved",
    "apps/apple/Packages/HitSlopApple/Package.resolved",
    "apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/JSONCompatibilitySpikeTests.swift",
    "examples/slops/quick-checklist/schema.ts",
    "examples/slops/quick-checklist/initial.ts",
    "packages/schema/src/document.ts",
    "packages/schema/src/json.ts",
    "packages/schema/src/validation.ts",
    "packages/schema/node_modules/typebox/package.json",
    "apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/SlopRuntimeSecurity.swift",
    "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/SlopJSONLimits.swift",
    "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/SlopJSONValidation.swift",
    ...["SlopDocumentJSON", "SlopDocumentSchema", "SlopDocumentOps", "SlopCommandStorage"].map(
      (name) => `apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/${name}.swift`,
    ),
  ])
    await read(path);

  type Observation = {
    pass: number;
    accepted: boolean;
    complete: boolean;
    phase: string;
    parsedJSON?: string;
    outputJSON?: string;
    error?: string;
  };
  type Report = { schemas: any[]; cases: any[]; boundaries: any[] };
  const report: Report = { schemas: [], cases: [], boundaries: [] };
  function typescript(groups: Group[]) {
    for (const engine of ["typebox-compiled", "typebox-interpreted"])
      for (const group of groups) {
        let schema: any, check: (value: unknown) => boolean;
        try {
          schema = JSON.parse(group.schema);
          if (!CheckSchema(Meta, Meta["https://json-schema.org/draft/2020-12/schema"], schema))
            throw new Error("Invalid JSON Schema");
          const compiled = engine === "typebox-compiled" ? Compile(schema) : undefined;
          check = compiled ? (value) => compiled.Check(value) : (value) => Check(schema, value);
          report.schemas.push({
            engine,
            group: group.name,
            accepted: true,
            outputJSON: JSON.stringify(schema),
          });
        } catch (error) {
          report.schemas.push({ engine, group: group.name, accepted: false, error: String(error) });
          continue;
        }
        const observations = group.cases.map(() => [] as Observation[]);
        for (let pass = 0; pass < 3; pass++)
          for (const [index, fixture] of group.cases.entries()) {
            const row: Observation = { pass, accepted: false, complete: true, phase: "parse" };
            try {
              const value = JSON.parse(fixture.json);
              row.parsedJSON = JSON.stringify(value);
              row.phase = "validation";
              row.accepted = check!(value);
              if (!row.accepted) row.error = JSON.stringify(Errors(schema, value)).slice(0, 1500);
              row.outputJSON = JSON.stringify(value);
            } catch (error) {
              if (row.phase !== "parse") row.complete = false;
              row.error = String(error).slice(0, 1500);
            }
            observations[index]!.push(row);
          }
        for (const [index, fixture] of group.cases.entries())
          report.cases.push({
            engine,
            group: group.name,
            name: fixture.name,
            observations: observations[index],
          });
      }
  }
  function typescriptBoundaries(boundaries: Boundary[]) {
    for (const boundary of boundaries) {
      let schema: any, value: any;
      if (boundary.kind === "depth") {
        schema = S.Atomic({});
        value = 1;
        for (let i = 0; i < boundary.size - 20; i++) value = { n: value };
        for (let i = 0; i < 20; i++) {
          schema = i === 19 ? S.Document({ v: schema }) : S.Object({ v: schema });
          value = { v: value };
        }
      } else {
        schema = S.Document({ text: S.String() });
        const count = boundary.size - 11;
        value = {
          text: boundary.escaped
            ? "\0".repeat(Math.floor(count / 6)) + "x".repeat(count % 6)
            : "x".repeat(count),
        };
      }
      const expected = boundary.size <= (boundary.kind === "depth" ? 64 : 1048576);
      let observed = true,
        error: string | undefined;
      try {
        S.prepareDocument(schema, value);
      } catch (e) {
        observed = false;
        error = String(e);
      }
      report.boundaries.push({
        engine: "typebox-document",
        name: boundary.name,
        stage: "validation",
        expected,
        observed,
        error,
      });
    }
  }
  async function command(args: string[], env = process.env) {
    const child = Bun.spawn(args, { cwd: root, env, stdout: "inherit", stderr: "inherit" });
    const code = await child.exited;
    if (code !== 0) throw new Error(`Infrastructure failure (${code}): ${args.join(" ")}`);
  }
  await mkdir(resolve(folder, ".build"), { recursive: true });
  await mkdir(resolve(folder, "results"), { recursive: true });
  const input = resolve(folder, ".build/compatibility-fixtures.json");
  await writeFile(input, JSON.stringify(fixtures));
  typescript(fixtures.groups);
  typescriptBoundaries(fixtures.boundaries);
  const swiftOutput = resolve(folder, `.build/compatibility-swift-${label}-${process.pid}.json`);
  const nativeOutput = resolve(folder, `.build/compatibility-native-${label}-${process.pid}.json`);
  await command([
    "/usr/bin/swift",
    "run",
    "--package-path",
    folder,
    "-c",
    "release",
    "json-schema-comparison",
    input,
    swiftOutput,
  ]);
  await command(
    [
      "/usr/bin/swift",
      "test",
      "--package-path",
      resolve(root, "apps/apple/Packages/HitSlopApple"),
      "--filter",
      "jsonCompatibilitySpike",
    ],
    { ...process.env, HITSLOP_JSON_SPIKE_INPUT: input, HITSLOP_JSON_SPIKE_OUTPUT: nativeOutput },
  );
  for (const path of [swiftOutput, nativeOutput]) {
    const raw = JSON.parse(await readFile(path, "utf8"));
    report.schemas.push(...raw.schemas);
    report.cases.push(...raw.cases);
    report.boundaries.push(...(raw.boundaries ?? []));
  }
  const groups = new Map(fixtures.groups.map((group) => [group.name, group]));
  for (const row of report.schemas) {
    const group = groups.get(row.group)!;
    row.expected = group.schemaValid;
    row.preserved =
      row.outputJSON === undefined ? null : preservedJSON(group.schema, row.outputJSON);
    row.matched = row.accepted === group.schemaValid && row.preserved !== false;
    row.phase = row.accepted ? "schema-serialization" : "schema-preparation";
    delete row.outputJSON;
  }
  for (const row of report.cases) {
    const fixture = groups.get(row.group)!.cases.find((fixture) => fixture.name === row.name)!;
    row.expected = fixture.valid;
    row.category = fixture.category ?? "schema-validation";
    row.preservationRequired = fixture.preserve !== false;
    row.inputSHA256 = hash(fixture.json);
    row.inputBytes = Buffer.byteLength(fixture.json);
    for (const observation of row.observations) {
      const parsedPreserved =
        observation.parsedJSON === undefined
          ? null
          : preservedJSON(fixture.json, observation.parsedJSON);
      const outputPreserved =
        observation.outputJSON === undefined
          ? null
          : preservedJSON(fixture.json, observation.outputJSON);
      observation.preserved =
        parsedPreserved === null ? null : parsedPreserved && outputPreserved !== false;
      if (parsedPreserved === false) observation.phase = "parse-or-initial-serialization";
      else if (outputPreserved === false) observation.phase = "serialization-or-mutation";
      observation.matched =
        observation.accepted === fixture.valid &&
        observation.complete &&
        (!row.preservationRequired || observation.preserved !== false);
      if (observation.outputJSON !== undefined)
        observation.outputSHA256 = hash(observation.outputJSON);
      delete observation.parsedJSON;
      delete observation.outputJSON;
    }
    row.matched =
      row.observations.length === 3 &&
      row.observations.every((observation: any) => observation.matched);
    const semantic = (o: any) => [o.accepted, o.complete, o.phase, o.preserved, o.matched];
    row.stable = row.observations.every((observation: any) =>
      equalJSON(semantic(observation), semantic(row.observations[0])),
    );
  }
  for (const row of report.boundaries) row.matched = row.expected === row.observed;
  const summary = {
    schemaChecks: report.schemas.length,
    schemaDifferences: report.schemas.filter((row) => !row.matched).length,
    caseRows: report.cases.length,
    caseExecutions: report.cases.reduce((n, row) => n + row.observations.length, 0),
    caseDifferences: report.cases.filter((row) => !row.matched).length,
    unstableRows: report.cases.filter((row) => !row.stable).length,
    boundaryChecks: report.boundaries.length,
    boundaryDifferences: report.boundaries.filter((row) => !row.matched).length,
  };
  const shell = (args: string[]) => Bun.spawnSync(args, { cwd: root }).stdout.toString().trim();
  const output = {
    reportVersion: 2,
    summary,
    ...report,
    environment: {
      date: new Date().toISOString(),
      label,
      fixtureSHA256: hash(JSON.stringify(fixtures)),
      commit: shell(["git", "rev-parse", "HEAD"]),
      swift: shell(["/usr/bin/swift", "--version"]),
      bun: Bun.version,
      os: shell(["sw_vers"]),
      machine: shell(["uname", "-m"]),
      dependencyVersions: {
        DynamicJSON: "1.0.2",
        JSONSchema: "0.14.1",
        TypeBox: JSON.parse(
          await readFile(
            resolve(root, "packages/schema/node_modules/typebox/package.json"),
            "utf8",
          ),
        ).version,
      },
      provenance,
    },
    measurementPolicy:
      "Correctness only. Timings deferred while compatibility differences remain; historical timings are not protocol-2 end-to-end measurements.",
  };
  const target = resolve(folder, `results/${label}.json`);
  await writeFile(target, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${target}`);
  process.exit(
    summary.schemaDifferences +
      summary.caseDifferences +
      summary.boundaryDifferences +
      summary.unstableRows ===
      0
      ? 0
      : 1,
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(2);
});
