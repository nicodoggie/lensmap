import { expect, test } from "@playwright/test";

test("spatial focus, prose navigation and view controls work in the rendered app", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const map = page.getByRole("application", { name: "Spatial map" });
  const ferry = page.getByRole("button", { name: "Night ferry", exact: true });
  const tide = page.getByRole("button", { name: "Tide window", exact: true });
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
  const edgeCount = await page.locator("[data-edge]").count();
  expect(edgeCount).toBeGreaterThan(0);
  const centreScale = Number(await ferry.getAttribute("data-scale"));
  expect(centreScale).toBeGreaterThan(
    Number(await tide.getAttribute("data-scale")),
  );
  const initialBounds = await map.boundingBox();
  if (!initialBounds) throw new Error("Spatial map has no rendered bounds.");
  for (const node of await page.locator("[data-node]").all()) {
    const box = await node.boundingBox();
    if (!box) throw new Error("Graph node has no rendered bounds.");
    expect(box.x).toBeGreaterThanOrEqual(initialBounds.x);
    expect(box.x + box.width).toBeLessThanOrEqual(
      initialBounds.x + initialBounds.width,
    );
    expect(box.y).toBeGreaterThanOrEqual(initialBounds.y);
    expect(box.y + box.height).toBeLessThanOrEqual(
      initialBounds.y + initialBounds.height,
    );
  }

  await page.screenshot({
    path: testInfo.outputPath("lens-desktop.png"),
    fullPage: true,
  });

  const measureNodes = () =>
    page.locator("[data-node]").evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
          width: box.width,
        };
      }),
    );
  const beforeZoomNodes = await measureNodes();
  const crossEdge = page.locator('[data-edge][data-kind="cross"]').first();
  const beforeZoomEdge = await crossEdge.boundingBox();
  const beforeZoomControl = await page
    .getByRole("button", { name: "Zoom in", exact: true })
    .boundingBox();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const afterZoomNodes = await measureNodes();
  const factor = afterZoomNodes[0].width / beforeZoomNodes[0].width;
  expect(factor).toBeGreaterThan(1);
  for (const [index, before] of beforeZoomNodes.entries()) {
    const after = afterZoomNodes[index];
    expect(after.width / before.width).toBeCloseTo(factor, 4);
    expect(after.x - (initialBounds.x + initialBounds.width / 2)).toBeCloseTo(
      (before.x - (initialBounds.x + initialBounds.width / 2)) * factor,
      3,
    );
    expect(after.y - (initialBounds.y + initialBounds.height / 2)).toBeCloseTo(
      (before.y - (initialBounds.y + initialBounds.height / 2)) * factor,
      3,
    );
  }
  const afterZoomEdge = await crossEdge.boundingBox();
  const afterZoomControl = await page
    .getByRole("button", { name: "Zoom in", exact: true })
    .boundingBox();
  if (
    !beforeZoomEdge ||
    !afterZoomEdge ||
    !beforeZoomControl ||
    !afterZoomControl
  )
    throw new Error("Zoom geometry is not rendered.");
  expect(afterZoomEdge.width / beforeZoomEdge.width).toBeCloseTo(factor, 4);
  expect(afterZoomEdge.height / beforeZoomEdge.height).toBeCloseTo(factor, 4);
  expect(afterZoomControl).toEqual(beforeZoomControl);
  await page.screenshot({
    path: testInfo.outputPath("lens-uniform-zoom.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();

  await page.getByRole("link", { name: "tide window", exact: true }).click();
  await expect(tide).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Tide window", exact: true }),
  ).toBeVisible();
  expect(await page.locator("[data-edge]").count()).toBe(edgeCount);
  expect(Number(await tide.getAttribute("data-scale"))).toBeCloseTo(
    centreScale,
  );

  await ferry.focus();
  await page.keyboard.press("Space");
  await expect(ferry).toBeFocused();
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
  const beforePan = await ferry.getAttribute("style");
  await map.focus();
  await page.keyboard.press("ArrowRight");
  await expect(ferry).not.toHaveAttribute("style", beforePan ?? "");
  const bounds = await map.boundingBox();
  if (!bounds) throw new Error("Spatial map has no rendered bounds.");
  const beforeDrag = await ferry.getAttribute("style");
  await page.mouse.move(bounds.x + 50, bounds.y + 100);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 130, bounds.y + 140, { steps: 8 });
  await page.mouse.up();
  await expect(ferry).not.toHaveAttribute("style", beforeDrag ?? "");
  expect(
    await page.evaluate(() => window.getSelection()?.toString() ?? ""),
  ).toBe("");
  const zoom = page.getByLabel("Zoom level");
  const beforeZoom = await zoom.textContent();
  await page.mouse.wheel(0, -200);
  await expect(zoom).not.toHaveText(beforeZoom ?? "");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByLabel("Lens strength", { exact: true }).fill("0");
  await expect(ferry).toHaveAttribute(
    "data-scale",
    (await tide.getAttribute("data-scale")) ?? "",
  );
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(zoom).toHaveText("85%");
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Lens strength", { exact: true })).toHaveValue(
    "1.1",
  );

  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Lens strength", { exact: true }),
  ).toBeDisabled();
  const overviewScales = await page
    .locator("[data-node]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-scale")),
    );
  expect(new Set(overviewScales).size).toBe(1);
  await page.screenshot({
    path: testInfo.outputPath("overview-desktop.png"),
    fullPage: true,
  });
  await tide.click();
  await expect(
    page.getByRole("button", { name: "Lens", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("narrow overview fits every node and touch panning changes spatial focus", async ({
  page,
  browser,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const map = page.getByRole("application", { name: "Spatial map" });
  const bounds = await map.boundingBox();
  if (!bounds) throw new Error("Spatial map has no rendered bounds.");
  for (const node of await page.locator("[data-node]").all()) {
    const box = await node.boundingBox();
    if (!box) throw new Error("Demo node has no rendered bounds.");
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(box.y).toBeGreaterThanOrEqual(bounds.y);
    expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("overview-mobile.png"),
    fullPage: true,
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const touchPage = await context.newPage();
  await touchPage.goto("http://127.0.0.1:4173");
  const touchMap = touchPage.getByRole("application", { name: "Spatial map" });
  const touchBounds = await touchMap.boundingBox();
  if (!touchBounds) throw new Error("Touch map has no rendered bounds.");
  const ferry = touchPage.getByRole("button", {
    name: "Night ferry",
    exact: true,
  });
  const before = await ferry.getAttribute("style");
  const client = await context.newCDPSession(touchPage);
  const point = { x: touchBounds.x + 35, y: touchBounds.y + 100 };
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: point.x + 70, y: point.y + 35 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(ferry).not.toHaveAttribute("style", before ?? "");
  // Exercise the node-start path on touch as well, including cancellation:
  // no synthetic click follows touchCancel to consume drag-click suppression.
  const weather = touchPage.getByRole("button", {
    name: "Weather",
    exact: true,
  });
  const nodeBox = await weather.boundingBox();
  if (!nodeBox) throw new Error("Touch node has no rendered bounds.");
  const nodePoint = {
    x: nodeBox.x + nodeBox.width / 2,
    y: nodeBox.y + nodeBox.height / 2,
  };
  const beforeNodeDrag = await weather.getAttribute("style");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [nodePoint],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: nodePoint.x + 30, y: nodePoint.y + 20 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(weather).not.toHaveAttribute("style", beforeNodeDrag ?? "");
  await expect(weather).toHaveAttribute("aria-pressed", "false");
  const zoom = touchPage.getByLabel("Zoom level");
  const beforeZoom = await zoom.textContent();
  await touchPage.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(zoom).not.toHaveText(beforeZoom ?? "");
  await context.close();
});

test("sidebar playground applies v1 YAML, preserves invalid drafts and keeps connections available while resizing", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByText("YAML playground", { exact: true }),
  ).toBeVisible();
  await page.getByText("YAML playground", { exact: true }).click();
  const source = page.getByRole("textbox", { name: "YAML source" });
  const draft = `version: v1
nodes:
  - id: start
    full_text: "# New map\\n\\nGo to [target](#target)."
    connections:
      - Child thought
      - node_id: target
  - id: target
    summary: '**Target**'
    connections: [{node_id: start}]
`;
  await source.fill(draft);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(page.locator("[data-node]")).toHaveCount(3);
  await expect(page.locator("[data-edge]")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "New map", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "target", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Target", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-edge]")).toHaveCount(3);
  await page.getByText("Selected thought", { exact: true }).click();
  await page.getByRole("button", { name: "┄➤ New map", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New map", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText("YAML playground", { exact: true }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByText("YAML playground", { exact: true }).click();
  await expect(source).toHaveValue(draft);

  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const separator = page.getByRole("separator", { name: "Resize sidebar" });
  const before = await sidebar.boundingBox();
  if (!before) throw new Error("Sidebar has no bounds.");
  await separator.focus();
  await page.keyboard.press("ArrowLeft");
  await expect
    .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before.width);
  const handle = await separator.boundingBox();
  if (!handle) throw new Error("Sidebar separator has no bounds.");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 100);
  await page.mouse.down();
  await page.mouse.move(handle.x - 100, handle.y + 100, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => (await sidebar.boundingBox())?.width ?? 0)
    .toBeGreaterThan(before.width + 80);

  const invalid =
    "version: v1\nnodes: [{summary: Broken, connections: [{node_id: missing}]}]";
  await source.fill(invalid);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("missing");
  await expect(source).toHaveValue(invalid);
  await expect(page.locator("[data-node]")).toHaveCount(3);
  await expect(page.locator("[data-edge]")).toHaveCount(3);
  await page.getByText("Selected thought", { exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("playground-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 800, height: 900 });
  await expect
    .poll(
      async () =>
        (
          await page
            .getByRole("application", { name: "Spatial map" })
            .boundingBox()
        )?.width ?? 0,
    )
    .toBeGreaterThanOrEqual(300);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(separator).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("playground-mobile.png"),
    fullPage: true,
  });

  await source.fill("version: v1\nnodes: []");
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(page.locator("[data-node]")).toHaveCount(0);
  await expect(
    page.getByText("Start with a thought", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await expect(page.locator("[data-node]")).toHaveCount(0);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Night ferry", exact: true }),
  ).toBeVisible();
});

test("crowded radial focus keeps circle bodies separate at maximum uniform zoom", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "A step-free pier", exact: true })
    .click();
  for (let index = 0; index < 8; index++)
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByLabel("Zoom level")).toHaveText("200%");
  await page.screenshot({
    path: testInfo.outputPath("crowded-focus.png"),
    fullPage: true,
  });
  const circles = await page.locator("[data-node]").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        label: element.getAttribute("aria-label"),
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        radius: box.width / 2,
      };
    }),
  );
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i],
        b = circles[j];
      expect(
        Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius,
        `${a.label} / ${b.label}`,
      ).toBeGreaterThanOrEqual(-0.05);
    }
  }
});

test("node-start dragging pans without activation while clicks and keyboard still select", async ({
  page,
}) => {
  await page.goto("/");
  const weather = page.getByRole("button", { name: "Weather", exact: true });
  const ferry = page.getByRole("button", { name: "Night ferry", exact: true });
  const before = await weather.getAttribute("style");
  const box = await weather.boundingBox();
  if (!box) throw new Error("Weather has no rendered bounds.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 90,
    box.y + box.height / 2 + 35,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(weather).not.toHaveAttribute("style", before ?? "");
  await expect(weather).toHaveAttribute("aria-pressed", "false");
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
  await weather.click();
  await expect(weather).toHaveAttribute("aria-pressed", "true");
  await ferry.focus();
  await page.keyboard.press("Space");
  await expect(ferry).toHaveAttribute("aria-pressed", "true");
});

test("selection glow follows only immediate explicit connections", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByText("YAML playground", { exact: true }).click();
  await page.getByRole("textbox", { name: "YAML source" }).fill(
    JSON.stringify({
      version: "v1",
      nodes: [
        {
          id: "root",
          summary: "Root",
          full_text: "# Root\n\nA [prose link](#prose).",
          position: { x: 0, y: 0 },
          connections: [
            {
              id: "child",
              summary: "Child",
              position: { x: -220, y: -80 },
              connections: [
                { summary: "Grandchild", position: { x: -420, y: -140 } },
                { node_id: "incoming" },
              ],
            },
            { node_id: "outgoing" },
            { node_id: "root" },
          ],
        },
        {
          id: "incoming",
          summary: "Incoming",
          position: { x: 0, y: 220 },
          connections: [{ node_id: "root" }],
        },
        { id: "outgoing", summary: "Outgoing", position: { x: 230, y: -50 } },
        { id: "prose", summary: "Prose only", position: { x: 340, y: 240 } },
      ],
    }),
  );
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  const highlighted = () =>
    page
      .locator(".node.connected, .node.selected")
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("aria-label")).sort(),
      );
  await expect
    .poll(highlighted)
    .toEqual(["Child", "Incoming", "Outgoing", "Root"]);
  await expect(page.locator("[data-edge]")).toHaveCount(6);
  const keys = await page
    .locator("[data-node]")
    .evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => [
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("data-node") ?? "",
        ]),
      ),
    );
  const expected = new Set([
    `${keys.Root}-${keys.Child}`,
    `${keys.Root}-${keys.Outgoing}`,
    `${keys.Incoming}-${keys.Root}`,
    `${keys.Root}-${keys.Root}`,
  ]);
  const paths = await page.locator("[data-edge]").evaluateAll((elements) =>
    elements.map((element) => ({
      edge: element.getAttribute("data-edge") ?? "",
      connected: element.classList.contains("connected"),
      filter: getComputedStyle(element).filter,
      kind: element.getAttribute("data-kind"),
      dash: getComputedStyle(element).strokeDasharray,
      marker: element.getAttribute("marker-end"),
    })),
  );
  for (const path of paths) {
    expect(path.connected).toBe(expected.has(path.edge));
    if (path.connected) {
      expect(path.filter).not.toBe("none");
      if (path.kind === "cross") {
        expect(path.dash).not.toBe("none");
        expect(path.marker).toContain("arrow-");
      }
    } else expect(path.filter).toBe("none");
  }
  const plainShadow = await page
    .getByRole("button", { name: "Grandchild", exact: true })
    .evaluate((element) => getComputedStyle(element).boxShadow);
  for (const name of ["Root", "Child", "Incoming", "Outgoing"]) {
    const button = page.getByRole("button", { name, exact: true });
    expect(
      await button.evaluate((element) => getComputedStyle(element).boxShadow),
    ).not.toBe(plainShadow);
    if (name !== "Root")
      await expect(button).toHaveAttribute("aria-pressed", "false");
  }
  const outgoing = page.getByRole("button", { name: "Outgoing", exact: true });
  const outgoingColour = await outgoing.evaluate(
    (element) => getComputedStyle(element).borderColor,
  );
  expect(
    await page
      .locator(`[data-edge="${keys.Root}-${keys.Outgoing}"]`)
      .evaluate((element) => getComputedStyle(element).stroke),
  ).toBe(outgoingColour);
  await page.getByText("YAML playground", { exact: true }).click();
  const root = page.getByRole("button", { name: "Root", exact: true });
  await root.click();
  await expect(root).toHaveCSS("outline-style", "none");
  await expect(outgoing).toHaveCSS("filter", "none");
  expect(
    await root.evaluate((element) =>
      Number(
        getComputedStyle(element).filter.match(/brightness\(([\d.]+)\)/)?.[1] ??
          "1",
      ),
    ),
  ).toBeGreaterThan(1);
  await page.screenshot({
    path: testInfo.outputPath("selection-glow.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Child", exact: true }).focus();
  await page.keyboard.press("Space");
  const child = page.getByRole("button", { name: "Child", exact: true });
  await expect(child).toBeFocused();
  expect(
    await child.evaluate((element) => element.matches(":focus-visible")),
  ).toBe(true);
  await expect(child).toHaveCSS("outline-style", "solid");
  await expect
    .poll(highlighted)
    .toEqual(["Child", "Grandchild", "Incoming", "Root"]);
  await expect(
    page.locator(`[data-edge="${keys.Root}-${keys.Root}"]`),
  ).not.toHaveClass(/connected/);
  await expect(
    page.locator(`[data-edge="${keys.Child}-${keys.Incoming}"]`),
  ).toHaveClass(/connected/);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect
    .poll(highlighted)
    .toEqual(["Child", "Grandchild", "Incoming", "Root"]);
  await page.getByRole("button", { name: "Prose only", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect.poll(highlighted).toEqual(["Prose only"]);
  await expect(page.locator("[data-edge].connected")).toHaveCount(0);
  await expect(page.locator("[data-edge]")).toHaveCount(6);
});
