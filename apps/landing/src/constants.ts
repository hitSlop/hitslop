const apiOrigin = (import.meta.env.PUBLIC_HITSLOP_API_URL || "https://api.hitslop.com").replace(/\/$/, "");

export const SITE_LINKS = {
  repository: "https://github.com/hitslop/hitslop",
  download: "https://github.com/hitslop/hitslop/releases/latest/download/hitSlop.dmg",
  authoring: "https://github.com/hitslop/hitslop/blob/master/docs/authoring.md",
  catalog: `${apiOrigin}/api/catalog`,
  discord: undefined as string | undefined,
} as const;
