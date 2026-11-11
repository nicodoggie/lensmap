import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidence = resolve("../../artifacts/checkpoints/site-map-navigation");

test.beforeEach(async ({ page }) => {
  // Public HTTP does not expose randomUUID, unlike secure localhost previews.
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined });
  });
});

const node = (page: import("@playwright/test").Page, id: string) =>
  page.locator(`.hero-map [data-anchor="${id}"]`);

async function open(
  page: import("@playwright/test").Page,
  id: string,
  title: string,
) {
  await node(page, id).click();
  await page
    .locator(".hero-action")
    .getByRole("link", { name: `Open ${title}`, exact: true })
    .click();
}

async function examples(page: import("@playwright/test").Page) {
  await page.goto("./");
  await expect(
    node(page, "examples").locator(".destination-icon"),
  ).toHaveAttribute("data-destination", "map_link");
  await open(page, "examples", "Examples");
  await expect(page).toHaveURL(/map=.*examples%2Findex\.lensmap/);
  await expect(node(page, "ferry-map")).toBeVisible();
}

test("example portals fetch separate maps and restore the exact hero view through map history", async ({
  page,
}) => {
  const fetched: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.endsWith(".lensmap") && response.ok())
      fetched.push(response.url());
  });
  await page.goto("./");
  await node(page, "examples").click();
  const action = page
    .locator(".hero-action")
    .getByRole("link", { name: "Open Examples", exact: true });
  await expect(action).toBeVisible();
  const original = await node(page, "lensmap").getAttribute("style");
  const zoom = await page.locator(".graph-scene").getAttribute("style");
  await action.click();
  await expect(node(page, "ferry-map")).toBeVisible();
  await page.screenshot({
    path: `${evidence}/index-desktop.png`,
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await open(page, "ferry-map", "Night Ferry");
  await expect(node(page, "ferry")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(node(page, "ferry-map")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(node(page, "lensmap")).toHaveAttribute("style", original ?? "");
  await expect(page.locator(".graph-scene")).toHaveAttribute(
    "style",
    zoom ?? "",
  );
  await expect(node(page, "examples")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Forward", exact: true }).click();
  await expect(node(page, "ferry-map")).toBeVisible();
  for (const sample of [
    { id: "basics", title: "Start small", root: "first" },
    {
      id: "relationships",
      title: "Custom types",
      root: "expedition",
    },
  ]) {
    await open(page, sample.id, sample.title);
    await expect(node(page, sample.root)).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(node(page, "ferry-map")).toBeVisible();
  }
  await open(page, "tide-window", "Jump to the tide window");
  await expect(node(page, "tides")).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Lens", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => fetched.some((url) => url.endsWith("/examples/index.lensmap")))
    .toBe(true);
  expect(
    fetched.some((url) => url.endsWith("/examples/night-ferry.lensmap")),
  ).toBe(true);
  await page.goBack();
  await expect(node(page, "tide-window")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.goForward();
  await expect(node(page, "tides")).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(node(page, "tides")).toHaveAttribute("aria-pressed", "true");
  const tides = await node(page, "tides").boundingBox();
  const map = await page.locator(".hero-map .map").boundingBox();
  if (!tides || !map) throw Error("Missing targeted map geometry");
  expect(
    Math.abs(tides.x + tides.width / 2 - map.x - map.width / 2),
  ).toBeLessThan(2);
  expect(
    Math.abs(tides.y + tides.height / 2 - map.y - map.height / 2),
  ).toBeLessThan(2);
});

test("narrow browser visits retain their map identity after explicit Back creates a different branch", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await examples(page);
  await page.screenshot({
    path: `${evidence}/index-narrow.png`,
    fullPage: true,
  });
  await open(page, "ferry-map", "Night Ferry");
  await expect(node(page, "ferry")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await open(page, "styling", "Node styling");
  await expect(node(page, "start")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${evidence}/styling-narrow.png`,
    fullPage: true,
  });
  await page.goBack();
  await expect(node(page, "ferry-map")).toBeVisible();
  await page.goBack();
  await expect(node(page, "ferry-map")).toBeVisible();
  await page.goForward();
  await expect(node(page, "ferry-map")).toBeVisible();
  await page.goForward();
  await expect(node(page, "start")).toBeVisible();
  await expect(node(page, "ferry")).toHaveCount(0);
});

test("failed maps retain the current view and a missing thought offers explicit whole-map fallback", async ({
  page,
}) => {
  await examples(page);

  await page.route("**/examples/node-styling/map.lensmap", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await node(page, "styling").click();
  const openStyling = page
    .locator(".hero-action")
    .getByRole("link", { name: "Open Node styling", exact: true });
  await expect(openStyling).toBeVisible();
  const before = await node(page, "examples").getAttribute("style");
  const url = page.url();
  await openStyling.click();
  await expect(page.getByRole("alert")).toContainText("503");
  await expect(page).toHaveURL(url);
  await expect(node(page, "examples")).toHaveAttribute("style", before ?? "");
  await page.route("**/examples/night-ferry.lensmap", (route) =>
    route.fulfill({
      contentType: "text/plain",
      body: "version: v1\nnodes:\n  - id: other\n    summary: A replacement map\n    full_text: |\n      <script>window.__lensmapExecuted = true</script>\n",
    }),
  );
  await open(page, "tide-window", "Jump to the tide window");

  await expect(page.getByRole("alert")).toContainText("tides");
  await expect(node(page, "examples")).toBeVisible();
  await page
    .getByRole("button", { name: "Open destination map anyway", exact: true })
    .click();
  await expect(node(page, "other")).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __lensmapExecuted?: boolean }).__lensmapExecuted,
    ),
  ).toBeUndefined();
});
