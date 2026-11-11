import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const evidence = resolve("../../artifacts/checkpoints/github-pages-site");

test("hero is a real readable lens with visible satellites and working site navigation", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://lensmap.thekennel.info/",
  );
  const hero = page.locator(".hero-map");
  const name = hero.locator('[data-anchor="lensmap"]');
  await expect(name).toBeVisible();
  await expect(hero.locator('[data-anchor="subtitle"]')).toBeVisible();
  const box = await name.boundingBox();
  const map = await hero.locator(".map").boundingBox();
  if (!box || !map) throw Error("Missing hero geometry");
  expect(box.width).toBeGreaterThan(Math.min(map.width, map.height) * 0.6);
  expect(box.width).toBeLessThan(Math.min(map.width, map.height));
  for (const node of await hero.locator(".node").all()) {
    // IntersectionObserver rounds fractional transformed bounds below exactly 1.
    await expect(node).toBeInViewport({ ratio: 0.999 });
  }
  await page.screenshot({
    path: `${evidence}/hero-desktop.png`,
    fullPage: true,
  });
  const docs = hero.locator('[data-anchor="documentation"]');
  await docs.click();
  await expect(
    page.getByRole("link", { name: "Open Documentation", exact: true }),
  ).toHaveAttribute("href", "/docs/");
  await page
    .getByRole("link", { name: "Open Documentation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/docs\/$/);
  await expect(
    page.getByRole("heading", { name: "Lensmap documentation", exact: true }),
  ).toBeVisible();
});

test("narrow initial framing is legible, exploration works and resizing does not reset the camera", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  const hero = page.locator(".hero-map");
  await expect(hero.locator('[data-anchor="lensmap"]')).toBeVisible();
  const map = hero.locator(".map");
  await expect
    .poll(async () => {
      const bounds = await map.boundingBox();
      if (!bounds) return false;
      for (const id of [
        "lensmap",
        "subtitle",
        "documentation",
        "get-started",
      ]) {
        const box = await hero.locator(`[data-anchor="${id}"]`).boundingBox();
        if (
          !box ||
          box.x < bounds.x ||
          box.x + box.width > bounds.x + bounds.width ||
          box.y < bounds.y ||
          box.y + box.height > bounds.y + bounds.height
        )
          return false;
      }
      return true;
    })
    .toBe(true);
  const name = await hero.locator('[data-anchor="lensmap"]').boundingBox();
  expect(name?.width).toBeGreaterThan(240);
  expect(
    await hero
      .locator(".node:has(.destination-icon) .node-summary")
      .evaluateAll(
        (labels) =>
          labels.length > 0 &&
          labels.every(
            (label) =>
              label.scrollWidth <= label.clientWidth + 1 &&
              label.scrollHeight <= label.clientHeight + 1,
          ),
      ),
    "Navigation labels must not be clipped inside their circles",
  ).toBe(true);
  await page.screenshot({
    path: `${evidence}/hero-narrow.png`,
    fullPage: true,
  });
  const focal = hero.locator('[data-anchor="lensmap"]');
  const before = await focal.getAttribute("style");
  await map.focus();
  await page.keyboard.down("ArrowRight");
  await expect.poll(() => focal.getAttribute("style")).not.toBe(before);
  await page.keyboard.up("ArrowRight");
  const scene = hero.locator(".graph-scene");
  const explored = await scene.getAttribute("style");
  await page.setViewportSize({ width: 430, height: 900 });
  await expect(scene).toHaveAttribute("style", explored ?? "");
  await expect
    .poll(async () => {
      const circle = await focal.boundingBox();
      const canvas = await map.boundingBox();
      return circle && canvas
        ? Math.abs(circle.x + circle.width / 2 - canvas.x - canvas.width / 2)
        : 0;
    })
    .toBeGreaterThan(1);
  await hero.locator('[data-anchor="documentation"]').focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/$/);
});

test("pointer panning preserves selection and an external hero destination opens separately", async ({
  page,
  context,
}) => {
  await context.route("https://github.com/nicodoggie/lensmap", (route) =>
    route.fulfill({ body: "GitHub destination fixture" }),
  );
  await page.goto("./");
  const hero = page.locator(".hero-map");
  const name = hero.locator('[data-anchor="lensmap"]');
  await expect(name).toBeVisible();
  const before = await name.getAttribute("style");
  const box = await name.boundingBox();
  if (!box) throw Error("Missing focal circle");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 55,
    box.y + box.height / 2 + 20,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect.poll(() => name.getAttribute("style")).not.toBe(before);
  await expect(name).toHaveAttribute("aria-pressed", "true");
  await hero.locator('[data-anchor="github"]').click();
  const action = page.getByRole("link", { name: "Open GitHub", exact: true });
  await expect(action).toHaveAttribute("rel", "noopener noreferrer");
  const popupPromise = context.waitForEvent("page");
  await action.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  await expect(popup).toHaveURL("https://github.com/nicodoggie/lensmap");
  await expect(page).toHaveURL(new URL("/", page.url()).href);
  await popup.close();
});

test("static fallback has meaningful text and native documentation links without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Lensmap", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Write thoughts. Explore connections.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Documentation" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lensmap documentation", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/docs-no-js.png`, fullPage: true });
  await context.close();
});

test("ordinary docs reload at the domain root, live example matches source, and search finds styling", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("docs/examples/");
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Source and live examples",
      exact: true,
    }),
  ).toBeVisible();
  const viewer = page.locator("[data-example-viewer]");
  await expect(viewer.locator(".node")).toHaveCount(5);
  await expect(page.locator(".map-example pre")).toContainText(
    "summary: A route through the hills",
  );
  await expect(viewer.locator('[data-anchor="expedition"]')).toContainText(
    "A route through the hills",
  );
  await expect(viewer.locator('[data-type="reveals"]').first()).toBeAttached();
  await page.screenshot({
    path: `${evidence}/docs-examples.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: /Search/ })
    .first()
    .click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("Style thought bubbles");
  await search
    .getByRole("link", { name: /Style thought bubbles/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/docs\/node-styling\//);
  await expect(
    page.getByRole("heading", { name: "Style thought bubbles", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
