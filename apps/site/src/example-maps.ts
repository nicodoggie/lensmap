// Build-only source inventory: each raw document is served unchanged by Astro.

import ferry from "../../../examples/night-ferry.lensmap?raw";
import styling from "../../../examples/node-styling/map.lensmap?raw";
import quickstart from "../../../examples/quickstart.lensmap?raw";
import relationships from "./maps/example.lensmap?raw";
import index from "./maps/examples.lensmap?raw";
import hero from "./maps/hero.lensmap?raw";

export const publishedMaps = {
  hero,
  "examples/index": index,
  "examples/quickstart": quickstart,
  "examples/night-ferry": ferry,
  "examples/node-styling/map": styling,
  "examples/connection-types": relationships,
};
