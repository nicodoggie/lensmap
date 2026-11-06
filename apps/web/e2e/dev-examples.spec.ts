import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { createServer } from "vite";

test("development serves real root examples and navigates their relative portals", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const root = resolve(import.meta.dirname, "..");
  const server = await createServer({
    root,
    configFile: resolve(root, "vite.config.ts"),
    cacheDir: testInfo.outputPath("vite-cache"),
    server: { host: "127.0.0.1", port: 0, open: false },
  });
  try {
    await server.listen();
    const bound = server.httpServer?.address();
    if (!bound || typeof bound === "string")
      throw Error("Missing dev address.");
    const origin = `http://127.0.0.1:${bound.port}`;
    for (const name of [
      "linked-maps.lensmap",
      "quickstart.lensmap",
      "night-ferry.lensmap",
      "README.md",
    ]) {
      const response = await request.get(`${origin}/${name}`);
      expect(response.ok()).toBe(true);
      expect(await response.text()).toBe(
        await readFile(resolve(root, "../../examples", name), "utf8"),
      );
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/?map=/linked-maps.lensmap`);
    const notebook = page.getByRole("button", {
      name: "A connected ferry notebook",
      exact: true,
    });
    await expect(notebook).toBeVisible();
    const controls = page.getByRole("navigation", { name: "Map navigation" });
    await expect(
      controls.getByRole("button", { name: "Back", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("application")).toHaveAttribute(
      "data-view",
      "overview",
    );
    const thoughtLink = await page
      .getByRole("link", { name: "Link to this thought", exact: true })
      .getAttribute("href");
    expect(new URL(thoughtLink ?? "").searchParams.get("map")).toBe(
      `${origin}/linked-maps.lensmap`,
    );
    await page.screenshot({
      path: testInfo.outputPath("dev-linked-maps.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Try the quickstart", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "A starting thought", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("application")).toHaveAttribute(
      "data-view",
      "overview",
    );
    await page.goBack();
    await expect(notebook).toBeVisible();
    await page
      .getByRole("button", { name: "Jump to the tide window", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Tide window", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("application")).toHaveAttribute(
      "data-view",
      "lens",
    );
    await page.screenshot({
      path: testInfo.outputPath("dev-map-back.png"),
      fullPage: true,
    });
    await page.goBack();
    await expect(notebook).toBeVisible();

    // A pasted draft has no source URI, but an explicit root path opts into
    // the dev origin. It does not need a fake source location or file access.
    await page.goto(`${origin}/`);
    await page.getByText("YAML playground", { exact: true }).click();
    await page.getByRole("textbox", { name: "YAML source" }).fill(`version: v1
nodes:
  - summary: Root-linked draft
    connections:
      - type: map_link
        summary: Open root example
        url: /quickstart.lensmap
      - type: map_link
        summary: Open root notebook
        url: /linked-maps.lensmap
`);
    await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
    await page
      .getByRole("button", { name: "Open root notebook", exact: true })
      .dblclick();
    await expect(notebook).toBeVisible();
    await page
      .getByRole("button", { name: "Jump to the tide window", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Tide window", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await controls.getByRole("button", { name: "Back", exact: true }).click();
    await expect(notebook).toBeVisible();
    await controls.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Root-linked draft", exact: true }),
    ).toBeVisible();
    // This branch reuses the notebook's old stack position. Native browser
    // history must still restore its actual notebook visit, not the new map.
    await page
      .getByRole("button", { name: "Open root example", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "A starting thought", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("button", { name: "Root-linked draft", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(notebook).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("button", { name: "Root-linked draft", exact: true }),
    ).toBeVisible();
    await page.goForward();
    await expect(
      page.getByRole("button", { name: "A starting thought", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await server.close();
  }
});

test("production preview neither serves examples nor supplies a draft root base", async ({
  page,
  request,
}) => {
  const response = await request.get("/linked-maps.lensmap");
  expect(response.headers()["content-type"]).toContain("text/html");
  await page.goto("/?map=/linked-maps.lensmap");
  await expect(page.getByRole("alert")).toContainText("no source base");
  await expect(
    page.getByRole("button", { name: "Night ferry", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "A connected ferry notebook",
      exact: true,
    }),
  ).toHaveCount(0);
});
