import { fileURLToPath } from "node:url";
import lensmap, { type LensmapOptions } from "@lensmap/astro-loader";

export type { LensmapOptions } from "@lensmap/astro-loader";
/** Add alongside Starlight and the host React integration. Does not replace host panels. */
export default function starlightLensmap(
  options: Omit<LensmapOptions, "contentComponent"> = {},
) {
  return lensmap({
    ...options,
    contentComponent: fileURLToPath(
      new URL("./components/MapContent.astro", import.meta.url),
    ),
  });
}
