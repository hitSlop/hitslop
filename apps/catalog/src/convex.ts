import { ConvexHttpClient } from "convex/browser";
import { api } from "../../registry/convex/_generated/api";

export { api };

/** HTTP Convex client for Worker routes that need one-shot queries/mutations (download telemetry). The landing page uses ConvexQueryClient instead. */
export const convexClient = (url: string): ConvexHttpClient => new ConvexHttpClient(url);
