import { expect, type Page, test } from "@playwright/test";

const source = `version: v1
nodes:
  - id: a
    summary: Alpha
    position: {x: 0, y: 0}
    full_text: |
      Alpha

      [prose only](#p)
    connections: [{node_id: b}]
  - {id: b, summary: Beta, position: {x: 140, y: 0}, connections: [{node_id: c}]}
  - {id: c, summary: Gamma, position: {x: 280, y: 0}}
  - {id: p, summary: Prose only, position: {x: 0, y: 150}}
`;
async function setup(page: Page) {
  await page.clock.install();
  await page.goto("/");
  await page.getByText("YAML playground", { exact: true }).click();
  await page.getByRole("textbox", { name: "YAML source" }).fill(source);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Alpha", exact: true }),
  ).toBeVisible();
  const map = page.getByRole("application", { name: "Spatial map" });
  await map.focus();
  return map;
}
const styles = (page: Page) =>
  page
    .locator("[data-node]")
    .evaluateAll((elements) => elements.map((e) => e.getAttribute("style")));

test("Ctrl browses without changing camera/selection; Space accepts and Shift follows edges from the visible target", async ({
  page,
}, info) => {
  const map = await setup(page);
  const alpha = page.getByRole("button", { name: "Alpha", exact: true });
  const beta = page.getByRole("button", { name: "Beta", exact: true });
  const gamma = page.getByRole("button", { name: "Gamma", exact: true });
  const original = await styles(page);
  await expect(alpha).toHaveAttribute("data-keyboard-target", "true");
  await page.keyboard.press("Control+ArrowRight");
  await expect(beta).toHaveAttribute("data-keyboard-target", "true");
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  expect(await styles(page)).toEqual(original);
  await page.screenshot({
    path: info.outputPath("keyboard-target.png"),
    fullPage: true,
  });
  await page.keyboard.press("Shift+ArrowRight");
  await expect(gamma).toHaveAttribute("aria-pressed", "true");
  await expect(map).toHaveAttribute("data-view", "lens");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(beta).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Control+ArrowLeft");
  await expect(alpha).toHaveAttribute("data-keyboard-target", "true");
  await expect(beta).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Control+Space");
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  expect(await styles(page)).toEqual(original);
  await page.keyboard.press("Shift+ArrowDown");
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  // Tab/node focus must survive when a later neighbourhood omits that button.
  await alpha.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(gamma).toHaveAttribute("aria-pressed", "true");
  await expect(map).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "lens");
  // The same removal can happen when Enter dives at a Ctrl target unrelated
  // to the focused button, or Space commits successive spatial targets.
  await alpha.focus();
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Enter");
  await expect(map).toBeFocused();
  await expect(gamma).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await alpha.focus();
  await page.keyboard.press("Enter");
  for (let hop = 0; hop < 2; hop++) {
    await page.keyboard.press("Control+ArrowRight");
    await page.keyboard.press("Space");
  }
  await expect(gamma).toHaveAttribute("aria-pressed", "true");
  await expect(map).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "lens");
});

test("Enter carries the target across views, while Escape restores the exact pre-entry camera and tuning", async ({
  page,
}) => {
  const map = await setup(page);
  await page.keyboard.press("ArrowDown");
  const original = await styles(page);
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await expect(
    page.getByRole("button", { name: "Beta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(
    page.getByRole("button", { name: "Gamma", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Lens strength", { exact: true }).fill("0.4");
  await map.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "lens");
  expect(await styles(page)).toEqual(original);
  await expect(page.getByLabel("Lens strength", { exact: true })).toHaveValue(
    "1.1",
  );
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "lens");
  expect(await styles(page)).not.toEqual(original);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const overview = await styles(page);
  await map.focus();
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "overview");
  expect(await styles(page)).toEqual(overview);
});

test("held pan accelerates independently of repeats, caps, resets on reversal and stops on release or focus loss", async ({
  page,
}) => {
  const map = await setup(page);
  await page.getByLabel("Lens strength", { exact: true }).fill("0");
  await page
    .getByLabel("Maximum keyboard pan speed", { exact: true })
    .fill("300");
  await map.focus();
  const alpha = page.getByRole("button", { name: "Alpha", exact: true });
  const x = async () => {
    const box = await alpha.boundingBox();
    if (!box) throw Error("Pan target not rendered");
    return box.x;
  };
  const start = await x();
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(120);
  const early = await x();
  await page.clock.runFor(600);
  const late = await x();
  expect(start - early).toBeGreaterThan(0);
  expect(early - late).toBeGreaterThan((start - early) * 3);
  await page.clock.runFor(160);
  const capped = await x();
  // Sample boundaries can straddle a frame; the pure test checks the exact integral.
  expect(Math.abs(late - capped - 300 * 0.16)).toBeLessThan(300 / 60 + 1);
  await page.keyboard.up("ArrowRight");
  const stopped = await x();
  await page.clock.runFor(200);
  expect(await x()).toBe(stopped);
  await page.keyboard.down("ArrowLeft");
  await page.clock.runFor(120);
  expect((await x()) - stopped).toBeLessThan(40);
  await page.getByRole("textbox", { name: "YAML source" }).focus();
  const blurred = await x();
  await page.clock.runFor(400);
  expect(await x()).toBe(blurred);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  expect(await x()).toBe(blurred);
  await map.focus();
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(100);
  await page.keyboard.down("Control");
  const modified = await x();
  await page.clock.runFor(300);
  expect(await x()).toBe(modified);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("Control");
  await page.keyboard.down("ArrowRight");
  await page.clock.runFor(100);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const windowBlurred = await x();
  await page.clock.runFor(300);
  expect(await x()).toBe(windowBlurred);
  await page.keyboard.up("ArrowRight");
});

test("empty central regions, editing/zoom controls and blur do not accept stale targets; Tab stays native", async ({
  page,
}, info) => {
  const map = await setup(page);
  const alpha = page.getByRole("button", { name: "Alpha", exact: true });
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.down("ArrowLeft");
  await page.clock.runFor(1800);
  await page.keyboard.up("ArrowLeft");
  await expect(page.locator(".node[data-keyboard-target]")).toHaveCount(0);
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  await expect(map).toHaveAttribute("data-view", "lens");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  const sourceBox = page.getByRole("textbox", { name: "YAML source" });
  await sourceBox.focus();
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await page.getByRole("button", { name: "Zoom in", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await map.focus();
  await page.keyboard.press("Tab");
  await expect(alpha).toBeFocused();
  await page.keyboard.press("Space");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath("keyboard-narrow.png"),
    fullPage: true,
  });
});
