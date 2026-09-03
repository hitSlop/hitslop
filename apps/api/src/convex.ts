import { ConvexHttpClient } from "convex/browser";
import { api } from "../../registry/convex/_generated/api";

export { api };

export const convexClient = (url: string): ConvexHttpClient => new ConvexHttpClient(url);
