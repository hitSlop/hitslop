import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import styles from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({ meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { title: "hitSlop — small apps for real life" }, { name: "description", content: "Find and download tiny, local-first apps for the thing in front of you." }], links: [{ rel: "stylesheet", href: styles }] }),
  component: () => <html lang="en"><head><HeadContent /></head><body><Outlet /><Scripts /></body></html>,
});
