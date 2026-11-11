import { DocumentSession } from "@lensmap/document";
import type { APIRoute, GetStaticPaths } from "astro";
import { publishedMaps } from "../example-maps";

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(publishedMaps).map(([map, source]) => {
    const snapshot = new DocumentSession(
      `site:${map}.lensmap`,
      source,
    ).snapshot();
    if (!snapshot.valid)
      throw new Error(
        `Invalid published map ${map}: ${JSON.stringify(snapshot.diagnostics)}`,
      );
    return { params: { map }, props: { source } };
  });

export const GET: APIRoute = ({ props }) =>
  new Response(props.source, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
