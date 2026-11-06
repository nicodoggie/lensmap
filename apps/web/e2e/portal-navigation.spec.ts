import { expect, test } from "@playwright/test";

const a = `version: v1
nodes:
  - id: start
    summary: Start
    connections:
      - type: map_link
        summary: Visit B
        url: ./b.lensmap#missing
`;
const b = `version: v1
nodes:
  - id: target
    summary: Destination
`;
test("a copied thought link targets its source map after reopening", async ({
  page,
}) => {
  await page.route("**/maps/b.lensmap", (route) =>
    route.fulfill({ body: b, contentType: "text/plain" }),
  );
  await page.goto(
    `/?map=${encodeURIComponent("http://127.0.0.1:4173/maps/b.lensmap")}`,
  );
  await expect(
    page.getByRole("button", { name: "Destination", exact: true }),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Link to this thought" })
    .getAttribute("href");
  if (!href) throw Error("Expected an actual thought link.");
  await page.goto(new URL(href, page.url()).href);
  await expect(page.getByRole("application")).toHaveAttribute(
    "data-view",
    "lens",
  );
  await expect(
    page.getByRole("button", { name: "Destination", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("applying a new draft supersedes an earlier pending destination load", async ({
  page,
}) => {
  let finish!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/maps/slow.lensmap", async (route) => {
    started();
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    await route.fulfill({ body: b, contentType: "text/plain" }).catch(() => {});
  });
  await page.goto("/");
  await page.getByText("YAML playground", { exact: true }).click();
  const draft = page.getByRole("textbox", { name: "YAML source" });
  await draft.fill(
    a.replace("./b.lensmap#missing", "http://127.0.0.1:4173/maps/slow.lensmap"),
  );
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await page.getByRole("button", { name: "Visit B", exact: true }).dblclick();
  await pending;
  await draft.fill("version: v1\nnodes: [New applied thought]\n");
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  finish();
  await expect(
    page.getByRole("button", { name: "New applied thought", exact: true }),
  ).toBeVisible();
  // Let the fulfilled response pass through the real parser and navigation turn.
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("button", { name: "New applied thought", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Destination", exact: true }),
  ).toHaveCount(0);
});

test("missing target retains draft; fallback opens Overview and map controls restore work", async ({
  page,
}) => {
  await page.route("**/maps/a.lensmap", (route) =>
    route.fulfill({ body: a, contentType: "text/plain" }),
  );
  await page.route("**/maps/b.lensmap", (route) =>
    route.fulfill({ body: b, contentType: "text/plain" }),
  );
  await page.goto(
    `/?map=${encodeURIComponent("http://127.0.0.1:4173/maps/a.lensmap")}`,
  );
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  const draft = page.getByRole("textbox", { name: "YAML source" });
  await page.getByText("YAML playground", { exact: true }).click();
  await draft.fill(`${a}# unapplied work\n`);
  const portal = page.getByRole("button", { name: "Visit B", exact: true });
  await portal.dblclick();
  await expect(page.getByRole("alert")).toContainText("missing");
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const strength = page.getByRole("slider", {
    name: "Lens strength",
    exact: true,
  });
  await strength.focus();
  await page.keyboard.press("ArrowRight");
  const savedStrength = await strength.inputValue();
  const geometry = () =>
    page
      .locator("[data-node]")
      .evaluateAll((nodes) =>
        nodes.map((node) => [
          node.getAttribute("data-node"),
          node.getAttribute("style"),
        ]),
      );
  const savedGeometry = await geometry();
  const savedZoom =
    (await page.getByLabel("Zoom level", { exact: true }).textContent()) ?? "";
  await page
    .getByRole("button", { name: "Open destination map anyway" })
    .click();
  await expect(
    page.getByRole("button", { name: "Destination", exact: true }),
  ).toBeVisible();
  // Map-owned controls must work even without the browser traversal commands.
  await page.evaluate(() => {
    for (const method of ["back", "forward", "go"] as const)
      history[method] = () => {
        throw Error("The map controls must not invoke browser traversal.");
      };
  });
  const controls = page.getByRole("navigation", { name: "Map navigation" });
  await controls.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("application")).toHaveAttribute(
    "data-view",
    "neighbourhood",
  );
  await expect(strength).toHaveValue(savedStrength);
  await expect(page.getByLabel("Zoom level", { exact: true })).toHaveText(
    savedZoom,
  );
  await expect.poll(geometry).toEqual(savedGeometry);
  await page.getByText("YAML playground", { exact: true }).click();
  await expect(draft).toHaveValue(`${a}# unapplied work\n`);
  await controls.getByRole("button", { name: "Forward", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Destination", exact: true }),
  ).toBeVisible();
});

test("exact encoded thought route enters Lens; invalid maps cannot expose fallback", async ({
  page,
}) => {
  await page.route("**/maps/b.lensmap", (route) =>
    route.fulfill({
      body: b.replace("id: target", 'id: " exact "'),
      contentType: "text/plain",
    }),
  );
  await page.goto(
    `/?map=${encodeURIComponent("http://127.0.0.1:4173/maps/b.lensmap#%20exact%20")}`,
  );
  await expect(
    page.getByRole("button", { name: "Destination", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Lens", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.route("**/maps/a.lensmap", (route) =>
    route.fulfill({ body: "version: v1\nnodes: [", contentType: "text/plain" }),
  );
  await page.goto(
    `/?map=${encodeURIComponent("http://127.0.0.1:4173/maps/a.lensmap#missing")}`,
  );
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open destination map anyway" }),
  ).toHaveCount(0);
});
