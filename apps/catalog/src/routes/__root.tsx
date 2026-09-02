import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import styles from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#fafafa" },
      { title: "hitSlop — tiny apps & docs that live on your desktop" },
      { name: "description", content: "Local-first Mac apps and living documents you can open, move, duplicate, and keep. Your interface and data stay together in a .slop." },
      { property: "og:title", content: "Tiny apps & docs that live on your desktop." },
      { property: "og:description", content: "Local-first Mac software with interfaces, JSON, SQLite, and media that stay together in files you own." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://hitslop.app/assets/desktop-hero.webp" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: () => <html lang="en"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>,
});
