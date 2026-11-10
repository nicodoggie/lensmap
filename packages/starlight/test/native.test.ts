import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { unmarkedTargetGaps } from "../../../apps/web/e2e/edge-geometry.ts";

const site = process.env.LENSMAP_PACKAGE_CONSUMER
  ? resolve(process.env.LENSMAP_PACKAGE_CONSUMER, "starlight-site")
  : fileURLToPath(new URL("site/", import.meta.url));
// The installed-consumer harness copies src/config; retain these root-owned data fixtures too.
if (process.env.LENSMAP_PACKAGE_CONSUMER) {
  for (const name of ["lensmap.config.json", "shared.lenstypes"]) {
    copyFileSync(new URL(`site/${name}`, import.meta.url), resolve(site, name));
  }
}

const dist = resolve(site, "dist");
const cli = resolve(
  dirname(
    createRequire(resolve(site, "package.json")).resolve("astro/package.json"),
  ),
  "bin/astro.mjs",
);

test("native Starlight static reading and one-session responsive inspector", async () => {
  const build = spawnSync(process.execPath, [cli, "build"], {
    cwd: site,
    env: process.env,
    encoding: "utf8",
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const html = readFileSync(resolve(dist, "maps/trusted/index.html"), "utf8");
  assert.match(html, /Entry: Synthetic map/);
  assert.match(html, /data-static-thoughts/);
  assert.doesNotMatch(html, /All thought content/);
  assert.equal(existsSync(resolve(dist, "maps/draft/index.html")), false);
  const island = html.match(
    /<astro-island\b[^>]*component-export="default"[^>]*>/,
  )?.[0];
  assert.ok(island);
  assert.doesNotMatch(
    island,
    /SERVER_DESCRIPTION_SENTINEL|authoredFrontmatter|starlightRoute|filePath/,
  );
  const server = createServer((request, response) => {
    let path = resolve(
      dist,
      `.${new URL(request.url ?? "/", "http://localhost").pathname}`,
    );
    if (!path.startsWith(`${dist}/`) && path !== dist) {
      response.writeHead(403).end();
      return;
    }
    if (existsSync(path) && statSync(path).isDirectory())
      path = resolve(path, "index.html");
    if (!existsSync(path)) {
      response.writeHead(404).end();
      return;
    }
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
    };
    response.setHeader(
      "Content-Type",
      types[extname(path)] ?? "application/octet-stream",
    );
    response.end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const inert = await browser.newContext({ javaScriptEnabled: false });
    const noJs = await inert.newPage();
    await noJs.goto(`${base}/maps/trusted/`);
    await expect(
      noJs
        .locator("[data-static-thoughts]")
        .getByText("First static thought body."),
    ).toBeVisible();
    await expect(
      noJs.locator("[data-static-thoughts]").getByText("LAST_STATIC_BODY"),
    ).toBeVisible();
    assert.equal(
      await noJs
        .locator("[data-static-thoughts]")
        .evaluate((element) => Boolean(element.closest("details"))),
      false,
    );
    await noJs.screenshot({ path: resolve(dist, "no-js.png"), fullPage: true });
    await inert.close();

    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/maps/trusted/`);
    const inspector = page.locator("[data-live-inspector]:visible");
    await expect(inspector).toHaveCount(1);
    await expect(inspector.locator("[data-selected-content]")).toContainText(
      "First static thought body.",
    );
    const styled = page.locator('.node[data-anchor="short"]');
    await expect(styled).toHaveCSS("color", "rgb(255, 241, 194)");
    await expect(styled).toHaveCSS("border-top-style", "dashed");
    await expect(styled).toContainText("★");
    assert.ok(
      await styled.evaluate((node) => (node as HTMLElement).offsetWidth > 86),
    );
    // Fitting uses the summary, not the long expanded Markdown body.
    await expect
      .poll(() =>
        page
          .locator('.node[data-anchor="long"]')
          .evaluate((node) => (node as HTMLElement).offsetWidth),
      )
      .toBeLessThan(200);
    const identity = await page.evaluate(() => performance.timeOrigin);
    await inspector
      .getByRole("button", { name: "connected to · Long thought", exact: true })
      .click();
    await expect(
      inspector.getByRole("button", { name: "Show more", exact: true }),
    ).toBeVisible();
    await expect(inspector.locator("[data-thought-full]")).toBeHidden();
    await expect(
      inspector.getByRole("link", { name: "Hidden link", includeHidden: true }),
    ).toBeHidden();
    await inspector
      .getByRole("button", { name: "Show more", exact: true })
      .click();
    await expect(inspector.getByText("LAST_STATIC_BODY")).toBeVisible();
    assert.equal(
      await page
        .locator(".right-sidebar")
        .evaluate((element) => getComputedStyle(element).position),
      "static",
    );
    await inspector
      .getByRole("button", { name: "connected to · Start", exact: true })
      .click();
    await expect(
      inspector.getByRole("button", { name: "Show less", exact: true }),
    ).toHaveCount(0);
    await inspector
      .getByRole("button", { name: "connected to · Long thought", exact: true })
      .click();
    await expect(
      inspector.getByRole("button", { name: "Show more", exact: true }),
    ).toBeVisible();
    assert.equal(await page.evaluate(() => performance.timeOrigin), identity);

    for (const theme of ["light", "dark"] as const) {
      await page
        .locator("starlight-theme-select select")
        .first()
        .selectOption(theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const paint = await page
        .locator(".lensmap-viewer")
        .evaluate((element) => ({
          actual: getComputedStyle(element).backgroundColor,
          host: getComputedStyle(document.body).backgroundColor,
        }));
      assert.equal(paint.actual, paint.host);
      assert.notEqual(
        await page
          .locator(".node")
          .first()
          .evaluate((element) => getComputedStyle(element).color),
        "rgb(0, 0, 0)",
      );
    }
    await page.screenshot({
      path: resolve(dist, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const disclosure = page.locator("[data-lensmap-thoughts]");
    await expect(disclosure).not.toHaveAttribute("open", "");
    await expect(inspector).toHaveCount(0);
    const scroll = await page.evaluate(() => scrollY);
    await page.locator('.node[data-anchor="short"]').click();
    await expect(
      page
        .locator("[data-lensmap-inspector-target] [data-selected-content]")
        .first(),
    ).toContainText("All of this short thought is visible.");
    await expect(disclosure).not.toHaveAttribute("open", "");
    assert.equal(await page.evaluate(() => scrollY), scroll);
    await expect(disclosure.locator(".lensmap-thoughts-caret")).toHaveCSS(
      "transform",
      "none",
    );
    await disclosure.locator("summary").first().click();
    await expect(disclosure.locator(".lensmap-thoughts-caret")).toHaveCSS(
      "transform",
      "matrix(0, 1, -1, 0, 0, 0)",
    );
    await expect(inspector).toHaveCount(1);
    await expect(inspector.locator("[data-selected-content]")).toContainText(
      "All of this short thought is visible.",
    );
    await expect(page.locator("[data-mobile-panel]")).toBeVisible();
    assert.equal(
      await page
        .locator("body")
        .evaluate((element) => element.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({
      path: resolve(dist, "mobile.png"),
      fullPage: true,
    });
    for (const width of [390, 800, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const enlarged of [false, true]) {
        if (enlarged)
          await page
            .getByRole("button", { name: "Zoom in", exact: true })
            .click();
        await expect
          .poll(() =>
            page.locator(".graph-scene").evaluate((scene) => {
              const svg = scene.querySelector<SVGSVGElement>("svg.connections");
              const matrix = svg?.getScreenCTM();
              if (!matrix) return Infinity;
              return Math.max(
                ...[...scene.querySelectorAll<HTMLElement>(".node")].map(
                  (node) => {
                    const expected = new DOMPoint(
                      Number.parseFloat(node.style.left),
                      Number.parseFloat(node.style.top),
                    ).matrixTransform(matrix);
                    const bounds = node.getBoundingClientRect();
                    return Math.hypot(
                      expected.x - bounds.x - bounds.width / 2,
                      expected.y - bounds.y - bounds.height / 2,
                    );
                  },
                ),
              );
            }),
          )
          .toBeLessThan(0.5);
        await expect
          .poll(async () => {
            const gaps = await page
              .locator(".graph-scene")
              .evaluate(unmarkedTargetGaps);
            assert.ok(gaps.length > 0);
            return Math.max(...gaps.map(({ gap }) => Math.abs(gap)));
          })
          .toBeLessThan(0.5);
      }
    }
    await page.goto(`${base}/`);
    await expect(
      page.getByText("Ordinary content remains visible."),
    ).toBeVisible();
    assert.equal(errors.length, 0, errors.join("\n"));
  } finally {
    await browser?.close();
    await new Promise<void>((done, fail) =>
      server.close((error) => (error ? fail(error) : done())),
    );
  }
});

test("native dev vocabulary changes preserve the viewer and recover from invalid/deleted config", async () => {
  const configPath = resolve(site, "lensmap.config.json");
  const typesPath = resolve(site, "shared.lenstypes");
  const originalConfig = readFileSync(configPath, "utf8");
  const originalTypes = readFileSync(typesPath, "utf8");
  const child = spawn(
    process.execPath,
    [cli, "dev", "--ignore-lock", "--host", "127.0.0.1", "--port", "4389"],
    { cwd: site, env: process.env },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await new Promise<void>((done, fail) => {
      const timeout = setTimeout(() => fail(new Error(output)), 30000);
      child.stdout.on("data", () => {
        if (output.includes("http://127.0.0.1:4389")) {
          clearTimeout(timeout);
          done();
        }
      });
      child.once("exit", () => {
        clearTimeout(timeout);
        fail(new Error(output));
      });
    });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto("http://127.0.0.1:4389/maps/trusted/");
    const state = page.locator("[data-lensmap-stale]");
    await expect(state).toHaveAttribute("data-lensmap-stale", "false");
    await page
      .locator("[data-live-inspector]:visible")
      .getByRole("button", {
        name: "connected to · Short thought",
        exact: true,
      })
      .click();
    const selected = await page
      .locator("[data-live-inspector]:visible")
      .getAttribute("data-selected-key");
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    const camera = await page.locator(".graph-scene").getAttribute("style");
    const origin = await page.evaluate(() => performance.timeOrigin);
    const centres = await page
      .locator(".node")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).style.cssText),
      );
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(typesPath, originalTypes.replace("#a855f7", "#22c55e"));
    await expect(page.locator('path[stroke="#22c55e"]').first()).toBeAttached();
    assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
    assert.equal(
      await page
        .locator("[data-live-inspector]:visible")
        .getAttribute("data-selected-key"),
      selected,
    );
    assert.deepEqual(
      await page
        .locator(".node")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLElement).style.cssText),
        ),
      centres,
    );
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(
      typesPath,
      "connection_types: {host_relation: {line-color: invalid-color}}\n",
    );
    await expect(state).toHaveAttribute("data-lensmap-stale", "true");
    await page.screenshot({
      path: resolve(dist, "dev-stale.png"),
      fullPage: true,
    });
    await expect(page.locator('path[stroke="#22c55e"]').first()).toBeAttached();
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(typesPath, originalTypes);
    await expect(state).toHaveAttribute("data-lensmap-stale", "false");
    await new Promise((done) => setTimeout(done, 150));
    unlinkSync(configPath);
    await expect(page.locator('path[stroke="#a855f7"]')).toHaveCount(0);
    await expect(state).toHaveAttribute("data-lensmap-stale", "false");
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(configPath, originalConfig);
    await expect(page.locator('path[stroke="#a855f7"]').first()).toBeAttached();
    await new Promise((done) => setTimeout(done, 150));
    unlinkSync(typesPath);
    await expect(state).toHaveAttribute("data-lensmap-stale", "true");
    writeFileSync(typesPath, originalTypes);
    await expect(state).toHaveAttribute("data-lensmap-stale", "false");
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(
      resolve(site, "alternate.lenstypes"),
      originalTypes.replace("#a855f7", "#ef4444"),
    );
    writeFileSync(configPath, '{"types":"alternate.lenstypes"}');
    await expect(page.locator('path[stroke="#ef4444"]').first()).toBeAttached();
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(configPath, originalConfig);
    await expect(page.locator('path[stroke="#a855f7"]').first()).toBeAttached();
    assert.equal(await page.evaluate(() => performance.timeOrigin), origin);
    assert.equal(
      await page.locator(".graph-scene").getAttribute("style"),
      camera,
    );
    await page.screenshot({
      path: resolve(dist, "dev-vocabulary.png"),
      fullPage: true,
    });
  } finally {
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(configPath, originalConfig);
    await new Promise((done) => setTimeout(done, 150));
    writeFileSync(typesPath, originalTypes);
    await browser?.close();
    child.kill();
    if (existsSync(resolve(site, "alternate.lenstypes")))
      unlinkSync(resolve(site, "alternate.lenstypes"));
  }
});
