import { expect, test } from "@playwright/test";

test("radial neighbourhood preserves the map, boundary edge styles and uniform zoom", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const harbor = page.getByRole("button", {
    name: "Harbor lights",
    exact: true,
  });
  const map = page.getByRole("application", { name: "Spatial map" });
  await expect(
    page.getByRole("button", { name: "Explore neighbourhood", exact: true }),
  ).toBeVisible();
  await harbor.focus();
  await page.keyboard.press("Enter");
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  const originalPositions = await page
    .locator("[data-node]")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((e) => [
          e.getAttribute("data-node"),
          e.getAttribute("style"),
        ]),
      ),
    );
  const originalEdges = await page
    .locator("[data-edge]")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((e) => [
          e.getAttribute("data-edge-key"),
          {
            kind: e.getAttribute("data-kind"),
            colour: getComputedStyle(e).stroke,
            dash: getComputedStyle(e).strokeDasharray,
          },
        ]),
      ),
    );
  await harbor.dblclick();
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await expect(page.locator("[data-node]")).toHaveCount(5);
  expect(
    await page
      .locator("[data-node]")
      .evaluateAll((elements) =>
        elements.map((e) => e.getAttribute("aria-label")).sort(),
      ),
  ).toEqual([
    "A small forecast",
    "A step-free pier",
    "Harbor lights",
    "Keep it running",
    "Night ferry",
  ]);
  await expect(page.locator("[data-edge]")).toHaveCount(5);
  await expect(page.locator("[data-continuation]")).toHaveCount(17);
  const continuations = await page
    .locator("[data-continuation]")
    .evaluateAll((elements) =>
      elements.map((e) => {
        const id = e.getAttribute("stroke")?.match(/^url\(#(.+)\)$/)?.[1];
        const gradient = id ? document.getElementById(id) : null;
        const first = gradient?.querySelector("stop");
        return {
          key: e.getAttribute("data-continuation") ?? "",
          kind: e.getAttribute("data-kind"),
          dash: getComputedStyle(e).strokeDasharray,
          colour: first ? getComputedStyle(first).stopColor : null,
          fade: gradient?.lastElementChild?.getAttribute("stop-opacity"),
          direction: e.getAttribute("data-direction"),
          marker: e.getAttribute("marker-end"),
        };
      }),
    );
  for (const continuation of continuations) {
    expect(continuation.kind).toBe(originalEdges[continuation.key].kind);
    expect(continuation.dash).toBe(originalEdges[continuation.key].dash);
    expect(continuation.colour).toBe(originalEdges[continuation.key].colour);
    expect(continuation.fade).toBe("0");
    if (continuation.direction === "incoming" && continuation.kind === "cross")
      expect(continuation.marker).toContain("arrow-");
    else expect(continuation.marker).toBeNull();
  }
  await page.screenshot({
    path: testInfo.outputPath("neighbourhood-desktop.png"),
    fullPage: true,
  });
  const before = await harbor.boundingBox();
  const segment = page.locator("[data-continuation]").first();
  const beforeSegment = await segment.boundingBox();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const after = await harbor.boundingBox();
  const afterSegment = await segment.boundingBox();
  if (!before || !after || !beforeSegment || !afterSegment)
    throw Error("Neighbourhood geometry not rendered");
  expect(after.width / before.width).toBeCloseTo(1.2, 3);
  expect(afterSegment.width / beforeSegment.width).toBeCloseTo(1.2, 3);
  await page.getByLabel("Lens strength", { exact: true }).fill("0.4");
  await map.focus();
  const priorPan = await harbor.getAttribute("style");
  await page.keyboard.press("ArrowRight");
  await expect(harbor).not.toHaveAttribute("style", priorPan ?? "");
  await page
    .getByRole("button", { name: "Return to map", exact: true })
    .click();
  await expect(map).toHaveAttribute("data-view", "lens");
  await expect(page.locator("[data-continuation]")).toHaveCount(0);
  await expect(page.getByLabel("Lens strength", { exact: true })).toHaveValue(
    "1.1",
  );
  expect(
    await page
      .locator("[data-node]")
      .evaluateAll((elements) =>
        Object.fromEntries(
          elements.map((e) => [
            e.getAttribute("data-node"),
            e.getAttribute("style"),
          ]),
        ),
      ),
  ).toEqual(originalPositions);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  const routes = await page.locator(".edge.context").evaluateAll((elements) => {
    const centre = document
      .querySelector(".node.selected")
      ?.getBoundingClientRect();
    if (!centre) throw Error("Selected centre not rendered");
    return elements.map((element) => {
      const path = element as SVGPathElement,
        matrix = path.getScreenCTM();
      if (!matrix) throw Error("Context edge not rendered");
      const distances = Array.from({ length: 51 }, (_, i) => {
        const point = path.getPointAtLength((path.getTotalLength() * i) / 50);
        const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        return Math.hypot(
          screen.x - centre.x - centre.width / 2,
          screen.y - centre.y - centre.height / 2,
        );
      });
      return { minimum: Math.min(...distances), radius: centre.width / 2 };
    });
  });
  expect(routes.length).toBeGreaterThan(0);
  for (const route of routes)
    expect(route.minimum).toBeGreaterThanOrEqual(route.radius + 2);
});

test("real click and double-click traversal, keyboard return and narrow layout", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const map = page.getByRole("application", { name: "Spatial map" });
  await page
    .getByRole("button", { name: "Harbor lights", exact: true })
    .dblclick();
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await page
    .getByRole("button", { name: "A small forecast", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A small forecast", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-node]")).toHaveCount(7);
  const weather = page.getByRole("button", { name: "Weather", exact: true });
  await weather.dblclick();
  await expect(map).toHaveAttribute("data-view", "lens");
  await expect(weather).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-node]")).toHaveCount(36);
  await weather.focus();
  await page.keyboard.press("Shift+Enter");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await expect(weather).toBeFocused();
  await expect(page.locator("[data-node]")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "lens");
  await expect(weather).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("neighbourhood-mobile.png"),
    fullPage: true,
  });
});

test("queued clicks cannot outlive source/view changes and neighbourhood handles replacement and isolated thoughts", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  const map = page.getByRole("application", { name: "Spatial map" });
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(map).toHaveAttribute("data-view", "overview");
  // A native browser clock advances past any queued pointer activation without wall-clock sleeps.
  await page.clock.runFor(600);
  await expect(map).toHaveAttribute("data-view", "overview");
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await page.getByText("YAML playground", { exact: true }).click();
  const source = page.getByRole("textbox", { name: "YAML source" });
  await source.fill("version: v1\nnodes: [{id: alone, summary: Alone}]");
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(map).toHaveAttribute("data-view", "lens");
  await expect(page.locator("[data-node]")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await expect(page.locator("[data-node]")).toHaveCount(1);
  await expect(page.locator("[data-continuation]")).toHaveCount(0);
  await source.fill(
    "version: v1\nnodes: [{summary: Broken, connections: [{node_id: missing}]}]",
  );
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("missing");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await source.fill("version: v1\nnodes: []");
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(page.locator("[data-node]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Explore neighbourhood", exact: true }),
  ).toBeDisabled();
});

test("new control intent cancels queued clicks; dragging, drafts, prose navigation and reduced motion remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const map = page.getByRole("application", { name: "Spatial map" });
  const ferry = page.getByRole("button", { name: "Night ferry", exact: true });
  const weather = page.getByRole("button", { name: "Weather", exact: true });
  await weather.click();
  await page.getByLabel("Lens strength", { exact: true }).fill("0.8");
  await page.clock.runFor(600);
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
  await weather.click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.clock.runFor(600);
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  const box = await weather.boundingBox();
  if (!box) throw Error("Neighbourhood node not rendered");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 45,
    box.y + box.height / 2 + 25,
    { steps: 6 },
  );
  await page.mouse.up();
  await page.clock.runFor(600);
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
  await ferry.focus();
  await page.keyboard.press("Enter");
  expect(
    await page
      .locator(".graph-scene")
      .evaluate((element) => element.getAnimations().length),
  ).toBe(0);
  await page.getByText("YAML playground", { exact: true }).click();
  const source = page.getByRole("textbox", { name: "YAML source" });
  const draft = `${await source.inputValue()}\n# Unsaved neighbourhood draft`;
  await source.fill(draft);
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  const total = await page.locator(".page-footer").textContent();
  await page.getByRole("link", { name: "tide window", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tide window", exact: true }),
  ).toBeVisible();
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await expect(source).toHaveValue(draft);
  await expect(page.locator(".page-footer")).toHaveText(total ?? "");
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "lens");
});
