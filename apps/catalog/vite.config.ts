import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";

const convexUrl = process.env.VITE_CONVEX_URL
  ?? (process.env.CLOUDFLARE_ENV === "production" ? "https://fastidious-malamute-777.convex.cloud" : "https://giddy-opossum-593.convex.cloud");

export default defineConfig({
  define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify(convexUrl) },
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tanstackStart(), react()],
});
