import { defineCollection, z } from "astro:content";
import { lensmapLoader } from "@lensmap/astro-loader";
export const collections = {
  maps: defineCollection({
    loader: lensmapLoader({ base: "./src/maps" }),
    schema: z.object({
      title: z.string().transform((title) => title.trim().toUpperCase()),
      label: z.string().default("DEFAULT"),
    }),
  }),
};
