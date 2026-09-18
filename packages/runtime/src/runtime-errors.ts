import { getHost } from "./index.js";
import type { RuntimeIssue } from "./types.js";

/** Reporting must never create a second unhandled rejection. */
export async function reportRuntimeError(issue: RuntimeIssue): Promise<void> {
  const bounded = {
    ...issue,
    message: (issue.message || "App error").slice(0, 4096),
    ...(issue.code ? { code: issue.code.slice(0, 128) } : {}),
  };
  try {
    await getHost().reportError(bounded);
  } catch {
    console.warn("hitSlop could not report an error to the host:", bounded.message);
  }
}
