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
      - {type: follows, summary: Beyond}
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
  await expect(edge("prevents")).toHaveAttribute("marker-end", /bar/);
  const blockingBars = await edge("prevents").evaluate((path) => {
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
  await expect(edge("prevents")).toHaveCSS("stroke-dasharray", "none");
  await expect(edge("optional")).toHaveAttribute("stroke-dasharray", "7 6");
  await expect(edge("connected")).not.toHaveAttribute("marker-end");
  await expect(edge("connected")).toHaveCSS("stroke-dasharray", "none");
  await expect(
    page
      .locator("[data-edge-hit] title")
      .filter({ hasText: "Alpha prevents Beta" }),
  ).toHaveCount(1);
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
});
