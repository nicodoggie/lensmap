import { expect, test } from "@playwright/test";

const source = `version: v1
nodes:
  - id: a
    summary: Alpha
    full_text: |
      Alpha

      [select Beta](#b)
    connections:
      - {type: precedes, node_id: b}
      - {type: follows, node_id: b}
      - {type: prevents, node_id: b}
      - {type: optional, node_id: b}
      - {node_id: b}
      - {type: precedes, node_id: a}
      - {type: map_link, url: other.lensmap, summary: Portal}
      - {type: external_link, url: 'https://example.com', summary: Website}
  - id: b
    summary: Beta
    connections:
      - type: follows
        summary: Beyond
        connections:
          - {type: prevents, node_id: b}
`;
async function setup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByText("YAML playground", { exact: true }).click();
  await page.getByRole("textbox", { name: "YAML source" }).fill(source);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Alpha", exact: true }),
  ).toBeVisible();
}
test("relation markers follow metadata for parallel references and loops", async ({
  page,
}, info) => {
  await setup(page);
  const edge = (type: string) =>
    page.locator(`path[data-edge][data-type="${type}"]`);
  await expect(edge("precedes").first()).toHaveAttribute("marker-end", /arrow/);
  await expect(edge("precedes")).toHaveCount(2);
  await expect(edge("follows").first()).toHaveAttribute(
    "marker-start",
    /arrow/,
  );
  await expect(edge("prevents").first()).toHaveAttribute("marker-end", /bar/);
  const blockingBars = await edge("prevents")
    .first()
    .evaluate((path) => {
      const id = path.getAttribute("marker-end")?.match(/^url\(#(.+)\)$/)?.[1];
      const marker = id ? document.getElementById(id) : null;
      return Array.from(marker?.querySelectorAll("line") ?? []).map((line) => ({
        x1: line.x1.baseVal.value,
        x2: line.x2.baseVal.value,
        y1: line.y1.baseVal.value,
        y2: line.y2.baseVal.value,
      }));
    });
  expect(blockingBars).toHaveLength(2);
  expect(new Set(blockingBars.map((bar) => bar.x1)).size).toBe(2);
  for (const bar of blockingBars) {
    expect(bar.x1).toBe(bar.x2);
    expect(bar.y2).toBeGreaterThan(bar.y1);
  }
  // Paint the actual SVG with its computed styles. A pair of marker strokes
  // alone cannot prove that the connector and its halo leave a real gap.
  const alpha = await edge("prevents")
    .first()
    .evaluate(async (element) => {
      const path = element as SVGPathElement;
      const svg = path.ownerSVGElement;
      if (!svg) throw Error("Expected an SVG connection.");
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const originals = svg.querySelectorAll("*");
      const copies = clone.querySelectorAll("*");
      const properties = [
        "fill",
        "stroke",
        "stroke-width",
        "opacity",
        "filter",
        "color",
        "stroke-dasharray",
      ];
      originals.forEach((original, index) => {
        const style = getComputedStyle(original);
        const copy = copies[index] as SVGElement;
        for (const property of properties)
          copy.style.setProperty(property, style.getPropertyValue(property));
      });
      const key = path.getAttribute("data-edge-key");
      for (const other of clone.querySelectorAll("[data-edge-key]"))
        if (other.getAttribute("data-edge-key") !== key)
          other.closest("g")?.remove();

      const markerId = path
        .getAttribute("marker-end")
        ?.match(/^url\(#(.+)\)$/)?.[1];
      const marker = document.getElementById(
        markerId ?? "",
      ) as SVGMarkerElement | null;
      if (!marker) throw Error("Expected the prevention marker.");
      const bars = Array.from(marker.querySelectorAll("line"));
      const length = path.getTotalLength();
      const end = path.getPointAtLength(length);
      const before = path.getPointAtLength(Math.max(0, length - 0.01));
      const angle = Math.atan2(end.y - before.y, end.x - before.x);
      const unit =
        (marker.markerWidth.baseVal.value / marker.viewBox.baseVal.width) *
        Number.parseFloat(getComputedStyle(path).strokeWidth);
      const xs = bars.map((bar) => bar.x1.baseVal.value).sort((a, b) => a - b);
      const samples = [xs[0], (xs[0] + xs[1]) / 2, xs[1]].map((x) => {
        const offset = (x - marker.refX.baseVal.value) * unit;
        return {
          x: end.x + Math.cos(angle) * offset,
          y: end.y + Math.sin(angle) * offset,
        };
      });
      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], {
          type: "image/svg+xml",
        }),
      );
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = svg.width.baseVal.value;
        canvas.height = svg.height.baseVal.value;
        const context = canvas.getContext("2d");
        if (!context)
          throw Error("Expected a canvas for native SVG paint checks.");
        context.drawImage(image, 0, 0);
        return samples.map(
          (point) =>
            context.getImageData(Math.round(point.x), Math.round(point.y), 1, 1)
              .data[3],
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    });
  expect(alpha[0]).toBeGreaterThan(100);
  expect(alpha[1]).toBe(0);
  expect(alpha[2]).toBeGreaterThan(100);
  await expect(edge("prevents").first()).toHaveCSS("stroke-dasharray", "none");
  await expect(edge("optional")).toHaveAttribute("stroke-dasharray", "7 6");
  await expect(edge("connected")).not.toHaveAttribute("marker-end");
  await expect(edge("connected")).toHaveCSS("stroke-dasharray", "none");
  await expect(
    page
      .locator("[data-edge-hit] title")
      .filter({ hasText: "Alpha prevents Beta" }),
  ).toHaveCount(1);
  expect(
    await page
      .locator("[data-edge-hit]")
      .filter({ hasText: "Alpha prevents Beta" })
      .evaluate((hit) => hit.closest("[mask]") === null),
  ).toBe(true);
  await expect(page.locator('[data-destination="map_link"]')).toBeVisible();
  await expect(
    page.locator('[data-destination="external_link"]'),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("default-connections-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 430, height: 850 });
  await page.screenshot({
    path: info.outputPath("default-connections-narrow.png"),
    fullPage: true,
  });
});
test("prose fragments select and centre without changing explicit topology", async ({
  page,
}) => {
  await setup(page);
  const before = await page.locator("path[data-edge]").count();
  await page.getByRole("link", { name: "select Beta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Beta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("path[data-edge]").count()).toBe(before);
  await expect(page.locator('[data-node][data-anchor="b"]')).toBeVisible();
});
test("portal click and Space select locally; neighbourhood remains explicit", async ({
  page,
}) => {
  await setup(page);
  const portal = page.getByRole("button", { name: "Portal", exact: true });
  await portal.focus();
  await page.keyboard.press("Space");
  await expect(portal).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Open destination map", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  await expect(page.getByRole("application")).toHaveAttribute(
    "data-view",
    "neighbourhood",
  );
  await page
    .getByRole("button", { name: "Return to map", exact: true })
    .click();
  await expect(page.getByRole("application")).toHaveAttribute(
    "data-view",
    "lens",
  );
});

test("continuation markers stay at real visible endpoints", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  const continuation = page.locator(
    'path[data-continuation][data-type="follows"]',
  );
  await expect(continuation).toHaveAttribute("marker-start", /arrow/);
  await expect(continuation).not.toHaveAttribute("marker-end");
  const prevention = page.locator(
    'path[data-continuation][data-type="prevents"]',
  );
  await expect(prevention).toHaveAttribute("data-direction", "incoming");
  await expect(prevention.locator("..")).toHaveAttribute("mask", /url\(#/);
});
