import { readFile, writeFile } from "node:fs/promises";
import { equalJSON } from "./oracle.ts";

const labels = process.argv.slice(2, 4);
const outputLabel = process.argv[4] ?? "compatibility-stability";
if (
  labels.length !== 2 ||
  process.argv.length > 5 ||
  [...labels, outputLabel].some((label) => !/^[a-z0-9-]+$/.test(label))
)
  throw new Error("Usage: bun compare-runs.ts LABEL_A LABEL_B [OUTPUT_LABEL]");
const reports = await Promise.all(
  labels.map((label) =>
    readFile(new URL(`results/${label}.json`, import.meta.url), "utf8").then(JSON.parse),
  ),
);
const semantics = (report: any) => ({
  summary: report.summary,
  schemas: report.schemas.map(({ error, ...row }: any) => row),
  cases: report.cases.map((row: any) => ({
    ...row,
    observations: row.observations.map(
      ({ error, outputSHA256, ...observation }: any) => observation,
    ),
  })),
  boundaries: report.boundaries.map(({ error, ...row }: any) => row),
});
const result = {
  labels,
  fixturesIdentical: reports[0].environment.fixtureSHA256 === reports[1].environment.fixtureSHA256,
  sourcesIdentical: equalJSON(reports[0].environment.provenance, reports[1].environment.provenance),
  outcomesIdentical: equalJSON(semantics(reports[0]), semantics(reports[1])),
  repeatedSequencesStable: reports.every((report) => report.summary.unstableRows === 0),
  comparison:
    "Ignores dates, diagnostics text and raw serialization hashes; compares acceptance, preservation, phases and all boundary outcomes.",
};
await writeFile(
  new URL(`results/${outputLabel}.json`, import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
process.exit(
  result.fixturesIdentical &&
    result.sourcesIdentical &&
    result.outcomesIdentical &&
    result.repeatedSequencesStable
    ? 0
    : 1,
);
