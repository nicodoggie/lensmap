import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { build } from "vite";

let fixtureScript = "";
test.beforeAll(async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    const result = await build({
      configFile: false,
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        write: false,
        lib: {
          entry: fileURLToPath(
            new URL("./custom-viewer-fixture.tsx", import.meta.url),
          ),
          name: "LensmapCustomFixture",
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
test("native CSS widths, transparent marker paint, zero-width routes and wording", async ({
  page,
}, info) => {
  await page.goto("/");
  // Exercise the actual viewer independently while the document worker builds.
  await page.addScriptTag({
    content: `${fixtureScript}\nwindow.LensmapCustomFixture = LensmapCustomFixture;`,
  });
  await page.evaluate(() => {
    (
      window as unknown as { LensmapCustomFixture: { mount(): void } }
    ).LensmapCustomFixture.mount();
  });
  const shapes = page.locator('[data-edge-key="shapes"]');
  await expect(shapes).toHaveCSS("stroke", "rgb(220, 40, 70)");
  const width = await shapes.evaluate((el) =>
    parseFloat(getComputedStyle(el).strokeWidth),
  );
  expect(width).toBeGreaterThan(2);
  await expect(page.locator('[data-edge-hit="zero"]')).toHaveCount(1);
  await expect(
    page.locator('[data-edge-key="zero"]').locator(".."),
  ).toHaveAttribute("visibility", "hidden");
  await expect(page.locator('[data-edge-key="loop"]')).toHaveCSS(
    "stroke-linecap",
    "round",
  );
  // Rasterize each actual masked connector in isolation and sample both ends.
  for (const key of ["shapes", "bar"]) {
    const samples = await page
      .locator(`[data-edge-key="${key}"]`)
      .evaluate(async (el) => {
        const svg = (el as SVGPathElement).ownerSVGElement;
        if (!svg) throw Error("Missing SVG");
        const original = el.closest("[data-presentation-width]");
        if (!original) throw Error("Missing connector");
        const clone = svg.cloneNode(false) as SVGSVGElement;
        clone.append(original.cloneNode(true));
        clone.querySelectorAll("path").forEach((p) => {
          if (p.classList.contains("edge")) {
            p.style.fill = "none";
            p.style.strokeWidth = getComputedStyle(el).strokeWidth;
          }
          if (p.classList.contains("edge-halo")) {
            p.style.fill = "none";
            p.style.stroke = "white";
          }
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
          canvas.width = svg.clientWidth;
          canvas.height = svg.clientHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw Error("Missing raster context");
          ctx.drawImage(image, 0, 0);
          const path = el as SVGPathElement,
            length = path.getTotalLength();
          const w = parseFloat(getComputedStyle(el).strokeWidth);
          return [false, true].map((end) => {
            const point = path.getPointAtLength(end ? length : 0);
            const near = path.getPointAtLength(end ? length - 0.01 : 0.01);
            const angle = Math.atan2(near.y - point.y, near.x - point.x);
            const at = (along: number, across: number) =>
              ctx.getImageData(
                Math.round(
                  point.x + Math.cos(angle) * along - Math.sin(angle) * across,
                ),
                Math.round(
                  point.y + Math.sin(angle) * along + Math.cos(angle) * across,
                ),
                1,
                1,
              ).data[3];
            return {
              inside: at(3 * w, 0),
              outline:
                el.getAttribute("data-edge-key") === "bar"
                  ? at(w, 0)
                  : at(3 * w, 3 * w),
            };
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      });
    for (const sample of samples) {
      expect(sample.inside).toBe(0);
      expect(sample.outline).toBeGreaterThan(100);
    }
  }
  await expect(page.locator('[data-edge-hit="shapes"] title')).toHaveText(
    "Alpha reveals Beta",
  );
  await expect(
    page.getByRole("button", { name: "reveals · Beta", exact: true }),
  ).toHaveCount(2);
  const positions = await page
    .locator("[data-node]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style")));
  const zoom = await page.getByLabel("Zoom level").textContent();
  await page.evaluate(() =>
    (
      window as unknown as { LensmapCustomFixture: { restyle(): void } }
    ).LensmapCustomFixture.restyle(),
  );
  await expect(shapes).toHaveCSS("stroke", "rgb(0, 0, 255)");
  expect(
    await page
      .locator("[data-node]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style"))),
  ).toEqual(positions);
  expect(await page.getByLabel("Zoom level").textContent()).toBe(zoom);
  const widths = await page.evaluate(() =>
    (
      window as unknown as { LensmapCustomFixture: { widths(): number[] } }
    ).LensmapCustomFixture.widths(),
  );
  expect(widths[0]).toBeCloseTo(2.5);
  expect(widths[1]).toBeCloseTo(40);
  expect(widths[3]).toBeCloseTo(Math.hypot(300, 400) / Math.SQRT2 / 10, 1);
  expect(widths[4]).toBeCloseTo(22);
  expect(widths[5]).toBe(0);
  await page.screenshot({ path: info.outputPath("custom-types-desktop.png") });
  await page.getByRole("button", { name: "Explore neighbourhood" }).click();
  await expect(page.locator("[data-continuation]")).toHaveCount(2);
  for (const key of ["in", "out"]) {
    const result = await page
      .locator(`[data-continuation="${key}"]`)
      .evaluate((el) => {
        const group = el.closest("[data-presentation-width]");
        const markers = Array.from(
          group?.querySelectorAll("marker:not([id*=cut])") ?? [],
        ).map((marker) => marker.childElementCount);
        return markers;
      });
    expect(result).toEqual(key === "in" ? [0, 1] : [1, 0]);
  }
  const map = page.getByRole("application", { name: "Spatial map" });
  await map.focus();
  await page.keyboard.press("Escape");
  const beforePan = await page.locator('[data-node="a"]').getAttribute("style");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(150);
  await page.keyboard.up("ArrowRight");
  expect(await page.locator('[data-node="a"]').getAttribute("style")).not.toBe(
    beforePan,
  );
  await page.setViewportSize({ width: 460, height: 800 });
  await page.screenshot({ path: info.outputPath("custom-types-narrow.png") });
});

test("bridge refreshes vocabulary at the same source revision without moving nodes or camera", async ({
  page,
}) => {
  const { DocumentSession } = await import("@lensmap/document");
  const session = new DocumentSession(
    "file:///fixture.lensmap",
    "version: v1\nnodes:\n  - summary: Alpha\n    connections:\n      - type: precedes\n        summary: Beta\n",
    7,
  );
  const first = { ...session.snapshot(), attachmentId: "fixture" };
  await page.addInitScript(() => {
    class FixtureEvents {
      onopen?: () => void;
      onmessage?: (message: { data: string }) => void;
      constructor() {
        (
          window as unknown as { emitBridge: (event: unknown) => void }
        ).emitBridge = (event) =>
          this.onmessage?.({ data: JSON.stringify(event) });
        queueMicrotask(() => this.onopen?.());
      }
      close() {}
    }
    Object.defineProperty(window, "EventSource", { value: FixtureEvents });
  });
  await page.goto("/preview.html");
  await page.waitForFunction(() => "emitBridge" in window);
  await page.evaluate(
    (snapshot) =>
      (window as unknown as { emitBridge(event: unknown): void }).emitBridge({
        type: "session",
        documents: [snapshot],
        activeUri: snapshot.uri,
      }),
    first,
  );
  const edge = page.locator("[data-edge-key]");
  await expect(edge).toHaveCount(1);
  const positions = await page
    .locator("[data-node]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style")));
  const zoom = await page.getByLabel("Zoom level").textContent();
  const next = {
    ...session.setVocabulary({
      declarations: {
        precedes: {
          "line-color": "red",
          text: "reveals",
          reverse_text: "is revealed by",
        },
      },
    }),
    attachmentId: "fixture",
  };
  expect(next.revision).toBe(first.revision);
  expect(next.graphGeneration).toBeGreaterThan(first.graphGeneration ?? 0);
  await page.evaluate(
    (snapshot) =>
      (window as unknown as { emitBridge(event: unknown): void }).emitBridge({
        type: "snapshot",
        snapshot,
      }),
    next,
  );
  await expect(edge).toHaveCSS("stroke", "rgb(255, 0, 0)");
  await expect(page.locator("[data-edge-hit] title")).toHaveText(
    "Alpha reveals Beta",
  );
  expect(
    await page
      .locator("[data-node]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("style"))),
  ).toEqual(positions);
  expect(await page.getByLabel("Zoom level").textContent()).toBe(zoom);
});
