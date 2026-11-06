import { expect, type Page, test } from "@playwright/test";

const source = `version: v1
nodes:
  - id: a
    summary: Alpha
    position: {x: 0, y: 0}
    full_text: "[prose only](#p)"
    connections:
      - id: b
        summary: Beta
        position: {x: 120, y: 0}
        connections: [{node_id: c}]
      - {node_id: d}
  - {id: c, summary: Gamma, position: {x: 260, y: 0}}
  - {id: d, summary: Delta, position: {x: 170, y: 35}}
  - {id: incoming, summary: Incoming, position: {x: 170, y: -35}, connections: [{node_id: a}]}
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
const geometry = (page: Page) =>
  page
    .locator("[data-node],[data-edge],[data-continuation]")
    .evaluateAll((es) =>
      es
        .map((e) => ({
          key:
            e.getAttribute("data-node") ??
            e.getAttribute("data-edge-key") ??
            e.getAttribute("data-continuation") ??
            "",
          style: e.getAttribute("style"),
          path: e.getAttribute("d"),
          stroke: e.getAttribute("stroke"),
          dash: getComputedStyle(e).strokeDasharray,
          markerStart: e.getAttribute("marker-start"),
          markerEnd: e.getAttribute("marker-end"),
          box: {
            x: e.getBoundingClientRect().x,
            y: e.getBoundingClientRect().y,
            width: e.getBoundingClientRect().width,
            height: e.getBoundingClientRect().height,
          },
        }))
        .sort((a, b) => a.key.localeCompare(b.key)),
    );

test("Shift previews and cycles exits from one origin without travelling; empty groups and Escape are safe", async ({
  page,
}, info) => {
  const map = await setup(page);
  const alpha = page.getByRole("button", { name: "Alpha", exact: true });
  await expect(map).toBeFocused();
  const original = await geometry(page);
  await page.keyboard.press("Shift+ArrowRight");
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  const chooser = page.getByRole("region", { name: "Connection choices" });
  await expect(chooser.getByRole("heading")).toHaveText(
    "Connections from Alpha",
  );
  await expect(chooser.getByRole("button", { name: /^Preview / })).toHaveCount(
    3,
  );
  await expect(
    chooser.getByRole("button", { name: "Preview Beta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(chooser).toContainText("outgoing branch");
  await expect(chooser).toContainText("incoming cross-link");
  await expect(chooser).not.toContainText("Prose only");
  const picked: string[] = [];
  for (let i = 0; i < 3; i++) {
    picked.push(
      (await chooser
        .locator('[aria-pressed="true"]')
        .getAttribute("aria-label")) ?? "",
    );
    expect(await geometry(page)).toEqual(original);
    await page.keyboard.press("Shift+ArrowRight");
  }
  expect(new Set(picked).size).toBe(3);
  await expect(
    chooser.getByRole("button", { name: "Preview Beta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: info.outputPath("connection-choices.png"),
    fullPage: true,
  });
  await page.keyboard.down("Shift");
  await page.keyboard.down("ArrowRight");
  const held = await chooser
    .locator('[aria-pressed="true"]')
    .getAttribute("aria-label");
  await page.keyboard.down("ArrowRight");
  expect(
    await chooser.locator('[aria-pressed="true"]').getAttribute("aria-label"),
  ).toBe(held);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("Shift");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(chooser).toContainText("No connections in this direction");
  await page.keyboard.press("Space");
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(
    chooser.getByRole("button", { name: "Preview Beta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(chooser).toHaveCount(0);
  expect(await geometry(page)).toEqual(original);
  await expect(alpha).toHaveAttribute("data-keyboard-target", "true");
});

test("hidden exits name actual cross-links and preview fading stubs; Escape cancels first, Space/Enter explicitly travel", async ({
  page,
}, info) => {
  const map = await setup(page);
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  const original = await geometry(page);
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  const chooser = page.getByRole("region", { name: "Connection choices" });
  const gamma = chooser.getByRole("button", {
    name: "Preview Gamma",
    exact: true,
  });
  await expect(gamma).toHaveAttribute("aria-pressed", "true");
  await expect(gamma).toContainText("outside this view");
  await expect(gamma).toContainText("outgoing cross-link");
  await expect(gamma).toHaveAccessibleDescription(
    /outgoing cross-link.*outside this view/,
  );
  await expect(
    page.getByRole("button", { name: "Gamma", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-continuation][data-connection-preview="true"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-continuation][data-connection-preview="true"]'),
  ).toHaveAttribute("data-kind", "cross");
  expect(await geometry(page)).toEqual(original);
  const activeId = await map.getAttribute("aria-activedescendant");
  expect(
    await map.evaluate(
      (element, id) => !!id && element.contains(document.getElementById(id)),
      activeId,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("hidden-connection.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(chooser).toHaveCount(0);
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Gamma", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(map).toHaveAttribute("data-view", "neighbourhood");
  await expect(chooser).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(map).toHaveAttribute("data-view", "lens");
  await page.getByRole("button", { name: "Alpha", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Enter");
  await expect(map).toHaveAttribute("data-view", "lens");
  await expect(
    page.getByRole("button", { name: "Gamma", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("chooser controls preview before travelling; navigation/source changes clear stale choices and preserve drafts", async ({
  page,
}, info) => {
  const map = await setup(page);
  const chooser = page.getByRole("region", { name: "Connection choices" });
  await page.keyboard.press("Shift+ArrowRight");
  const original = await geometry(page);
  await chooser
    .getByRole("button", { name: "Preview Delta", exact: true })
    .click();
  await expect(map).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Alpha", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await geometry(page)).toEqual(original);
  await chooser
    .getByRole("button", { name: "Go to thought", exact: true })
    .click();
  await expect(map).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Delta", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Alpha", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Shift+ArrowRight");
  const box = page.getByRole("textbox", { name: "YAML source" });
  await box.fill(`${source}\nbroken: [`);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(chooser).toBeVisible();
  await map.focus();
  await page.keyboard.press("Control+=");
  await expect(chooser).toHaveCount(0);
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Control+ArrowRight");
  await expect(chooser).toHaveCount(0);
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(chooser).toHaveCount(0);
  await page.keyboard.press("Shift+ArrowRight");
  await page.setViewportSize({ width: 390, height: 844 });
  // Resize invalidates captured bearings; re-enter deliberately at this viewport.
  await expect(chooser).toHaveCount(0);
  await page.getByRole("button", { name: "Alpha", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(chooser).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("connection-choices-narrow.png"),
    fullPage: true,
  });
  await chooser
    .getByRole("button", { name: "Cancel choice", exact: true })
    .click();
  await expect(map).toBeFocused();
  await page.keyboard.press("Shift+ArrowRight");
  await box.fill("version: v1\nnodes: []");
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(chooser).toHaveCount(0);
  await expect(page.locator("[data-node]")).toHaveCount(0);
});
