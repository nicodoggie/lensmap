import { fileURLToPath } from "node:url";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import lensmap from "@lensmap/starlight";
import { defineConfig } from "astro/config";
export default defineConfig({
  integrations: [
    starlight({
      title: "Synthetic Lensmap",
      components: { PageSidebar: "./src/components/PageSidebar.astro" },
      sidebar: [
        { label: "Maps", items: [{ autogenerate: { directory: "maps" } }] },
      ],
    }),
    react(),
    lensmap({
      mdx: {
        admittedSources: [
          fileURLToPath(
            new URL("src/content/docs/maps/trusted.lensmap", import.meta.url),
          ),
        ],
      },
    }),
  ],
});
