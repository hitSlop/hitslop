export interface APIEnvironment {
  ARTIFACTS: R2Bucket;
  ENVIRONMENT: "development" | "production";
  CONVEX_URL: string;
  CONVEX_SITE_URL: string;
  HITSLOP_INTERNAL_SECRET: string;
}
