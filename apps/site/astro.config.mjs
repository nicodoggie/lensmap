import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import lensmap from "@lensmap/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://lensmap.thekennel.info",
  base: "/",
  output: "static",

  integrations: [
    react(),
    starlight({
      title: "Lensmap",
      description:
        "Write thoughts. Explore connections. A text-first spatial mind map.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/nicodoggie/lensmap",
        },
      ],
      sidebar: [
        {
          label: "Documentation",
          items: [{ autogenerate: { directory: "docs" } }],
        },
      ],
      customCss: ["./src/styles/docs.css"],
    }),
    lensmap(),
  ],
});
