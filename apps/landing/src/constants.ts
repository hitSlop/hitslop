const apiOrigin = (import.meta.env.PUBLIC_HITSLOP_API_URL || "https://api.hitslop.com").replace(/\/$/, "");

export const SITE_LINKS = {
  repository: "https://github.com/hitslop/hitslop",
  download: "https://github.com/hitslop/hitslop/releases/latest/download/hitSlop.dmg",
  docs: "/docs/",
  authoring: "/docs/getting-started/",
  catalog: `${apiOrigin}/api/catalog`,
  discord: undefined as string | undefined,
} as const;
