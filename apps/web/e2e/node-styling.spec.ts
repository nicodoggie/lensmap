import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { build } from "vite";

let fixtureScript = "";
test.beforeAll(async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    // Match Vite's JSX transform to the production React runtime even when a
    // previous test in this worker has already initialized Vite in test mode.
    process.env.NODE_ENV = "production";
    const result = await build({
      configFile: false,
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        write: false,
        lib: {
          entry: fileURLToPath(
            new URL("./node-styling-fixture.tsx", import.meta.url),
          ),
          name: "LensmapStylingFixture",
          formats: ["iife"],
        },
        minify: false,
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    for (const output of outputs)
      if ("output" in output)
        for (const chunk of output.output)
          if (chunk.type === "chunk") fixtureScript += chunk.code;
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.addScriptTag({
    content: `${fixtureScript}\nwindow.fixture = LensmapStylingFixture;`,
  });
});
test("auto grows around native Markdown without reducing text and paint retains geometry", async ({
  page,
}) => {
  await page.evaluate(() =>
    (
      window as unknown as { fixture: { mount(): void; restyle(): void } }
    ).fixture.mount(),
  );
  const auto = page.locator('[data-node="auto"]');
  await expect(auto).toHaveCSS("font-size", "20px");
  await expect(auto).toHaveCSS("background-color", "rgb(180, 30, 40)");
  await expect(auto.locator("strong")).toHaveText("Rendered summary");
  await expect
    .poll(() => auto.evaluate((el) => parseFloat(getComputedStyle(el).width)))
    .toBeGreaterThan(180);
  const endpoints = await page
    .locator('[data-edge-key="link"]')
    .evaluate((el) => {
      const path = el as SVGPathElement;
      const matrix = path.getScreenCTM();
      if (!matrix) throw Error("Missing transform");
      return [0, path.getTotalLength()].map((length) => {
        const point = path.getPointAtLength(length).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      });
    });
  for (const [index, key] of ["auto", "fixed"].entries()) {
    const box = await page.locator(`[data-node="${key}"]`).boundingBox();
    if (!box) throw Error("Missing circle");
    expect(
      Math.abs(
        Math.hypot(
          endpoints[index].x - box.x - box.width / 2,
          endpoints[index].y - box.y - box.height / 2,
        ) -
          box.width / 2,
      ),
    ).toBeLessThan(1);
  }
  const before = await auto.boundingBox();
  const metrics = await auto.evaluate((el) => {
    const summary = el.querySelector(".node-summary");
    if (!summary) throw Error("Missing summary");
    const text = summary.getBoundingClientRect();
    const circle = el.getBoundingClientRect();
    return {
      text: { width: text.width, height: text.height },
      diameter: circle.width,
      font: getComputedStyle(el).fontSize,
    };
  });
  expect(Math.hypot(metrics.text.width, metrics.text.height)).toBeLessThan(
    metrics.diameter,
  );
  await expect(page.locator('[data-node="fixed"]')).toHaveCSS("width", "172px");
  await page.screenshot({
    path: "../../artifacts/checkpoints/node-styling/viewer/desktop.png",
  });
  await page.evaluate(() =>
    (
      window as unknown as { fixture: { mount(): void; restyle(): void } }
    ).fixture.restyle(),
  );
  await expect(auto).not.toHaveCSS("background-color", "rgb(180, 30, 40)");
  expect(await auto.boundingBox()).toEqual(before);
  await page.setViewportSize({ width: 540, height: 820 });
  await expect
    .poll(() =>
      page.locator(".map").evaluate((map) => {
        const bounds = map.getBoundingClientRect();
        return [...map.querySelectorAll(".node")].every((node) => {
          const box = node.getBoundingClientRect();
          return (
            box.left >= bounds.left &&
            box.right <= bounds.right &&
            box.top >= bounds.top &&
            box.bottom <= bounds.bottom
          );
        });
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: "../../artifacts/checkpoints/node-styling/viewer/narrow.png",
  });
});
test("auto measurements survive neighbourhood refresh and restored hidden nodes are measured on return", async ({
  page,
}) => {
  const mount = (restored = false) =>
    page.evaluate(
      (restored) =>
        (
          window as unknown as { fixture: { mount(restored: boolean): void } }
        ).fixture.mount(restored),
      restored,
    );
  await mount();
  const distant = page.locator('[data-node="distant"]');
  await expect
    .poll(() => distant.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBeGreaterThan(180);
  const width = await distant.evaluate((el) => (el as HTMLElement).offsetWidth);
  await page.locator('[data-node="auto"]').dblclick();
  await expect(distant).toHaveCount(0);
  const continuationStart = await page
    .locator('[data-continuation="onward"]')
    .evaluate((el) => {
      const path = el as SVGPathElement;
      const matrix = path.getScreenCTM();
      if (!matrix) throw Error("Missing continuation transform");
      const point = path.getPointAtLength(0).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
  const fixed = await page.locator('[data-node="fixed"]').boundingBox();
  if (!fixed) throw Error("Missing styled continuation origin");
  expect(
    Math.abs(
      Math.hypot(
        continuationStart.x - fixed.x - fixed.width / 2,
        continuationStart.y - fixed.y - fixed.height / 2,
      ) -
        fixed.width / 2,
    ),
  ).toBeLessThan(1);
  await page.evaluate(() =>
    (window as unknown as { fixture: { restyle(): void } }).fixture.restyle(),
  );
  await page.locator(".map").focus();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => distant.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBe(width);
  await mount(true);
  await expect(distant).toHaveCount(0);
  await page.locator(".map").focus();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => distant.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBe(width);
});
