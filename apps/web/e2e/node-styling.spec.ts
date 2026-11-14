import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { build } from "vite";
import type { ViewerState } from "../src/Viewer";

let fixtureScript = "";
interface ResponsiveFixture {
  mountResponsive(targeted?: boolean, fluidTypography?: boolean): void;
  setResponsiveWidth(width: number): void;
  getResponsiveState(): ViewerState;
  getResponsiveSource(): string;
}
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
test("container and media rules update real geometry while preserving view and source", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() =>
    (
      window as unknown as { fixture: ResponsiveFixture }
    ).fixture.mountResponsive(),
  );
  const root = page.locator('[data-node="thought:1"]');
  const child = page.locator('[data-node="thought:2"]');
  await expect(root).toHaveCSS("color", "rgb(181, 230, 210)");
  await expect(child).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(child).toHaveCSS("font-size", "18px");
  await expect(child).toHaveCSS("border-top-color", "rgb(0, 0, 255)");
  await expect
    .poll(() => child.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBeGreaterThan(100);
  const wideWidth = await child.evaluate(
    (el) => (el as HTMLElement).offsetWidth,
  );
  const source = await page.evaluate(() =>
    (
      window as unknown as { fixture: ResponsiveFixture }
    ).fixture.getResponsiveSource(),
  );
  await page.locator(".map").focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { fixture: ResponsiveFixture }
          ).fixture.getResponsiveState()?.camera.x,
      ),
    )
    .not.toBe(0);
  const before = await page.evaluate(() =>
    (
      window as unknown as { fixture: ResponsiveFixture }
    ).fixture.getResponsiveState(),
  );
  await page.screenshot({
    path: "../../artifacts/checkpoints/responsive-viewer/embedded-wide.png",
  });

  await page.evaluate(() =>
    (
      window as unknown as { fixture: ResponsiveFixture }
    ).fixture.setResponsiveWidth(390),
  );
  await expect(child).toHaveCSS("font-size", "24px");
  await expect(child).toHaveCSS("border-top-color", "rgb(0, 0, 255)");
  await expect
    .poll(async () => {
      const [a, b] = await Promise.all([
        root.boundingBox(),
        child.boundingBox(),
      ]);
      if (!a || !b) throw Error("Missing responsive circles");
      return Math.abs(a.x + a.width / 2 - b.x - b.width / 2);
    })
    .toBeLessThan(1);
  await expect
    .poll(() => child.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBeGreaterThan(wideWidth);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { fixture: ResponsiveFixture }
      ).fixture.getResponsiveState(),
    ),
  ).toEqual(before);
  const endpoint = await page
    .locator("[data-edge-key]")
    .first()
    .evaluate((el) => {
      const path = el as SVGPathElement;
      const matrix = path.getScreenCTM();
      if (!matrix) throw Error("Missing edge transform");
      const point = path
        .getPointAtLength(path.getTotalLength())
        .matrixTransform(matrix);
      return { x: point.x, y: point.y };
    });
  const circle = await child.boundingBox();
  if (!circle) throw Error("Missing responsive endpoint");
  expect(
    Math.abs(
      Math.hypot(
        endpoint.x - circle.x - circle.width / 2,
        endpoint.y - circle.y - circle.height / 2,
      ) -
        circle.width / 2,
    ),
  ).toBeLessThan(1);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(child).toHaveCSS("background-color", "rgb(255, 165, 0)");
  await page.screenshot({
    path: "../../artifacts/checkpoints/responsive-viewer/embedded-narrow-wide-window.png",
  });

  await page.evaluate(() =>
    (
      window as unknown as { fixture: ResponsiveFixture }
    ).fixture.setResponsiveWidth(900),
  );
  await expect(child).toHaveCSS("font-size", "18px");
  await expect
    .poll(() => child.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBe(wideWidth);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { fixture: ResponsiveFixture }
      ).fixture.getResponsiveState(),
    ),
  ).toEqual(before);
  await page.setViewportSize({ width: 390, height: 820 });
  await expect(child).toHaveCSS("border-top-color", "rgb(255, 0, 0)");
  await expect(child).toHaveCSS("font-size", "24px");
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { fixture: ResponsiveFixture }
      ).fixture.getResponsiveSource(),
    ),
  ).toBe(source);
  expect(errors).toEqual([]);
});

test("auto size follows viewport units while query matches and canvas size stay unchanged", async ({
  page,
}) => {
  // Stay above the host viewer's 1100px padding breakpoint so the canvas is
  // genuinely fixed while native viewport-relative typography changes.
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.evaluate(() => {
    const fixture = (window as unknown as { fixture: ResponsiveFixture })
      .fixture;
    fixture.mountResponsive(false, true);
    fixture.setResponsiveWidth(600);
  });
  const child = page.locator('[data-node="thought:2"]');
  const root = page.locator('[data-node="thought:1"]');
  await expect(child).toHaveCSS("font-size", "48px");
  await expect
    .poll(async () => {
      const [a, b] = await Promise.all([
        child.boundingBox(),
        root.boundingBox(),
      ]);
      if (!a || !b) throw Error("Missing fluid typography fixture");
      return Math.abs(a.x + a.width / 2 - b.x - b.width / 2);
    })
    .toBeLessThan(1);
  await expect
    .poll(() => child.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBeGreaterThan(100);
  const before = await child.evaluate((el) => (el as HTMLElement).offsetWidth);
  const canvas = await page.locator(".map").boundingBox();
  const state = await page.evaluate(() =>
    (
      window as unknown as { fixture: ResponsiveFixture }
    ).fixture.getResponsiveState(),
  );
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(child).toHaveCSS("font-size", "64px");
  await expect
    .poll(() => child.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBeGreaterThan(before);
  const after = await page.locator(".map").boundingBox();
  expect(after?.width).toBe(canvas?.width);
  expect(after?.height).toBe(canvas?.height);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { fixture: ResponsiveFixture }
      ).fixture.getResponsiveState(),
    ),
  ).toEqual(state);
});

test("initial targeted navigation centres conditional coordinates, not default coordinates", async ({
  page,
}) => {
  await page.evaluate(() =>
    (
      window as unknown as { fixture: ResponsiveFixture }
    ).fixture.mountResponsive(true),
  );
  const child = page.locator('[data-node="thought:2"]');
  await expect(child).toHaveCSS("font-size", "24px");
  await expect(child).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => {
      const [a, b] = await Promise.all([
        page.locator(".map").boundingBox(),
        child.boundingBox(),
      ]);
      if (!a || !b) throw Error("Missing targeted view");
      return Math.hypot(
        a.x + a.width / 2 - b.x - b.width / 2,
        a.y + a.height / 2 - b.y - b.height / 2,
      );
    })
    .toBeLessThan(1);
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
