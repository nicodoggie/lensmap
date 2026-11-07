import { expect, test } from "@playwright/test";
import { unmarkedTargetGaps } from "./edge-geometry";

const source = `version: v1
nodes:
  - id: a
    summary: Alpha
    connections:
      - id: b
        summary: Beta
        connections:
          - summary: Beyond
            connections: [{node_id: b}]
      - {summary: Neutral, type: connected}
      - {summary: Reverse, type: follows}
  - summary: Outside
    connections: [{node_id: b}]
`;

async function setup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByText("YAML playground", { exact: true }).click();
  await page.getByRole("textbox", { name: "YAML source" }).fill(source);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(page.locator('.node[data-anchor="a"]')).toBeVisible();
}

test("unmarked branch and cross targets meet their outlines under lens and zoom", async ({
  page,
}) => {
  await setup(page);
  for (const mode of ["Lens", "Overview"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    // Overview fits the graph and intentionally disables manual zoom.
    for (const enlarged of mode === "Lens" ? [false, true] : [false]) {
      if (enlarged)
        await page
          .getByRole("button", { name: "Zoom in", exact: true })
          .click();
      await expect
        .poll(async () => {
          const gaps = await page
            .locator(".graph-scene")
            .evaluate(unmarkedTargetGaps);
          expect(gaps.length).toBeGreaterThan(0);
          return Math.max(...gaps.map(({ gap }) => Math.abs(gap)));
        })
        .toBeLessThan(0.5);
    }
  }
});

test("unmarked incoming and outgoing continuations meet their real node", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  await expect
    .poll(async () => {
      const samples = await page.locator(".graph-scene").evaluate((scene) => {
        const node = scene.querySelector<HTMLElement>('.node[data-anchor="b"]');
        if (!node) throw new Error("Expected the visible boundary thought.");
        const bounds = node.getBoundingClientRect();
        return [
          ...scene.querySelectorAll<SVGPathElement>("path[data-continuation]"),
        ].flatMap((path) => {
          const incoming = path.dataset.direction === "incoming";
          if (path.hasAttribute(incoming ? "marker-end" : "marker-start"))
            return [];
          const matrix = path.getScreenCTM();
          if (!matrix)
            throw new Error("Expected a rendered continuation matrix.");
          const near = path.getPointAtLength(
            incoming ? path.getTotalLength() : 0,
          );
          const point = new DOMPoint(near.x, near.y).matrixTransform(matrix);
          return [
            {
              direction: path.dataset.direction,
              gap:
                Math.hypot(
                  point.x - bounds.x - bounds.width / 2,
                  point.y - bounds.y - bounds.height / 2,
                ) -
                bounds.width / 2,
            },
          ];
        });
      });
      expect(
        [...new Set(samples.map(({ direction }) => direction))].sort(),
      ).toEqual(["incoming", "outgoing"]);
      return Math.max(...samples.map(({ gap }) => Math.abs(gap)));
    })
    .toBeLessThan(0.5);
});
