import { fileURLToPath } from "node:url";
import lensmap, { type LensmapOptions } from "@lensmap/astro-loader";

export type { LensmapOptions } from "@lensmap/astro-loader";
/** Add alongside Starlight and the host React integration. Does not replace host panels. */
export default function starlightLensmap(
  options: Omit<LensmapOptions, "contentComponent"> = {},
) {
  const integration = lensmap({
    ...options,
    contentComponent: fileURLToPath(
      new URL("./components/MapContent.astro", import.meta.url),
    ),
  });
  const setup = integration.hooks["astro:config:setup"];
  integration.hooks["astro:config:setup"] = async (context) => {
    await setup?.(context);
    // The packaged JS viewer is not a source entry for Vite's dependency scan.
    // Optimize its real dependency closure without prebundling its HMR listener.
    context.updateConfig({
      vite: {
        optimizeDeps: {
          include: [
            "@lensmap/starlight > @lensmap/document",
            "@lensmap/starlight > react-markdown",
          ],
        },
      },
    });
  };
  return integration;
}
