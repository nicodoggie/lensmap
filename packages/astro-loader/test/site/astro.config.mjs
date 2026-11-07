import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import lensmap from "@lensmap/astro-loader";
import { defineConfig } from "astro/config";
export default defineConfig({
  integrations: [
    ...(process.env.LENSMAP_TEST_NO_MDX ? [] : [mdx()]),
    lensmap({
      mdx: {
        admittedSources: [
          fileURLToPath(new URL("src/maps/a/map.lensmap", import.meta.url)),
        ],
      },
    }),
  ],
  markdown: { smartypants: true },
});
