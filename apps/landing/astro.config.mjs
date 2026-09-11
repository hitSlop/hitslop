import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import starlight from "@astrojs/starlight";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

export default defineConfig({
  site: "https://hitslop.com",
  vite: { plugins: [vanillaExtractPlugin()] },
  integrations: [
    svelte(),
    starlight({
      title: "hitSlop Docs",
      description: "Build small local-first apps and documents that live on your desktop.",
      favicon: "/favicon-32.png",
      disable404Route: true,
      customCss: ["./src/styles/docs.css"],
      components: {
        SiteTitle: "./src/components/DocsSiteTitle.astro",
        ThemeProvider: "./src/components/DocsThemeProvider.astro",
        ThemeSelect: "./src/components/DocsThemeSelect.astro",
      },
      editLink: {
        baseUrl: "https://github.com/hitSlop/hitslop/edit/master/apps/landing/",
      },
      lastUpdated: true,
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/hitSlop/hitslop" },
      ],
      sidebar: [
        { label: "Overview", slug: "docs" },
        {
          label: "Build a slop",
          items: [
            { label: "Create your first slop", slug: "docs/getting-started" },
            { label: "Manifest and windows", slug: "docs/guides/manifest-and-windows" },
            { label: "Style an app", slug: "docs/guides/styling" },
            { label: "Icons, previews, and exports", slug: "docs/guides/icons-and-exports" },
            { label: "PNG window skins", slug: "docs/guides/png-window-skins" },
            { label: "Data and media", slug: "docs/guides/data-and-schemas" },
            { label: "Build and share", slug: "docs/guides/build-and-share" },
          ],
        },
        {
          label: "Work with a document",
          items: [
            { label: "Edit installed data", slug: "docs/guides/edit-installed-data" },
            { label: "How .slop files work", slug: "docs/concepts/how-slop-files-work" },
          ],
        },
        { label: "Availability", slug: "docs/availability" },
      ],
    }),
  ],
  output: "static",
});
