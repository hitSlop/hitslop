import { join } from "node:path";
import { repository } from "./templates";
import { buildTemplates } from "./build-templates";
import { buildPresentationFixtures } from "./presentation-fixtures";

/** Shared native owners need two black-box apps, not the shipped template corpus. */
export async function prepareNativeFixtures() {
  await buildTemplates(join(repository, "generated/v1/native-fixtures"), [
    "quick-checklist",
    "small-expenses",
  ]);
  return buildPresentationFixtures();
}
