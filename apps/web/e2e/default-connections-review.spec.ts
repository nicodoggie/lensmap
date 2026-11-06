import { createServer } from "node:http";
import { expect, type Page, test } from "@playwright/test";

const origin = "http://127.0.0.1:4173";
const source = `version: v1
nodes:
  - id: alpha
    summary: Alpha
    position: {x: 0, y: 0}
    connections:
      - {type: precedes, node_id: beta}
      - {type: prevents, node_id: beta}
      - {type: optional, node_id: beta}
      - {type: precedes, node_id: alpha}
      - {type: prevents, node_id: alpha}
  - id: beta
    summary: Beta
    position: {x: 400, y: 0}
    connections:
      - {type: follows, summary: Beyond}
`;
async function setup(page: Page) {
  await page.goto("/");
  await page.getByText("YAML playground", { exact: true }).click();
  await page.getByRole("textbox", { name: "YAML source" }).fill(source);
  await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Alpha", exact: true }),
  ).toBeVisible();
}
async function hoverPoint(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const path = element as SVGPathElement;
    const matrix = path.getScreenCTM();
    if (!matrix) throw Error("Missing rendered path transform.");
    for (let i = 2; i < 19; i++) {
      const p = path.getPointAtLength((path.getTotalLength() * i) / 20);
      const point = new DOMPoint(p.x, p.y).matrixTransform(matrix);
      if (document.elementFromPoint(point.x, point.y) === path)
        return { x: point.x, y: point.y };
    }
    throw Error("No independently reachable hover area for this route.");
  });
}

test("parallel edges and loops have independently reachable paths and hover wording", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  const routes = await page.locator("path[data-edge]").evaluateAll((paths) =>
    paths.map((path) => ({
      key: path.getAttribute("data-edge-key"),
      d: path.getAttribute("d"),
    })),
  );
  expect(new Set(routes.map((route) => route.d)).size).toBe(routes.length);
  for (const route of routes) {
    if (!route.key) throw Error("Missing edge identity.");
    const selector = `path[data-edge-hit=${JSON.stringify(route.key)}]`;
    const point = await hoverPoint(page, selector);
    await page.mouse.move(point.x, point.y);
    await expect(page.locator(`${selector}:hover`)).toHaveCount(1);
    await expect(page.locator(selector).locator("title")).toContainText(
      /Alpha|Beta/,
    );
  }
});

test("continuations expose endpoint-aware hover without swallowing panning", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Explore neighbourhood", exact: true })
    .click();
  const stub = page.locator('path[data-continuation][data-type="follows"]');
  await expect(stub).toHaveCount(1);
  const key = await stub.getAttribute("data-continuation");
  const selector = `path[data-continuation-hit=${JSON.stringify(key)}]`;
  await expect(page.locator(selector).locator("title")).toHaveText(
    "Beta follows Beyond",
  );
  const point = await hoverPoint(page, selector);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator(`${selector}:hover`)).toHaveCount(1);
  const alpha = page.getByRole("button", { name: "Alpha", exact: true });
  const before = await alpha.getAttribute("style");
  await page.mouse.down();
  await page.mouse.move(point.x + 35, point.y + 20, { steps: 4 });
  await page.mouse.up();
  await expect(alpha).not.toHaveAttribute("style", before ?? "");
  await expect(alpha).toHaveAttribute("aria-pressed", "true");
});

for (const matching of [true, false]) {
  test(`Back from another map restores a fragment route when destination anchor ${matching ? "matches" : "is absent"}`, async ({
    page,
  }) => {
    const a =
      "version: v1\nnodes:\n  - id: shared\n    summary: Map A\n    connections:\n      - {type: map_link, summary: Visit B, url: ./b.lensmap}\n";
    const b = `version: v1\nnodes: [{id: ${matching ? "shared" : "other"}, summary: Map B}]\n`;
    await page.route("**/history/a.lensmap", (route) =>
      route.fulfill({ body: a, contentType: "text/plain" }),
    );
    await page.route("**/history/b.lensmap", (route) =>
      route.fulfill({ body: b, contentType: "text/plain" }),
    );
    await page.goto(
      `/?map=${encodeURIComponent(`${origin}/history/a.lensmap`)}#shared`,
    );
    await expect(
      page.getByRole("button", { name: "Map A", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Visit B", exact: true }).dblclick();
    await expect(
      page.getByRole("button", { name: "Map B", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("button", { name: "Map A", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("application")).toHaveAttribute(
      "data-view",
      "lens",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.goForward();
    await expect(
      page.getByRole("button", { name: "Map B", exact: true }),
    ).toBeVisible();
  });
}

test("redirected maps use their final resource base for map and external portals", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "open", {
      value: (url: string, target: string, features: string) => {
        document.documentElement.setAttribute("data-open-url", url);
        document.documentElement.setAttribute("data-open-target", target);
        document.documentElement.setAttribute("data-open-features", features);
        return null;
      },
    });
  });
  // Use a real redirect: Playwright route interception only covers the first
  // URL of a redirected request, which would otherwise serve Vite's HTML fallback.
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Content-Type", "text/plain");
    if (
      request.url === "/alias.lensmap" ||
      request.url === "/new-alias.lensmap"
    ) {
      response.writeHead(302, { Location: "/notes/a.lensmap" });
      response.end();
    } else if (request.url === "/notes/a.lensmap") {
      response.end(`version: v1
nodes:
  - summary: Redirected source
    connections:
      - {type: map_link, summary: Relative map, url: ./b.lensmap}
      - {type: external_link, summary: Research, url: ./research.txt}
`);
    } else if (request.url === "/notes/b.lensmap") {
      response.end(
        "version: v1\nnodes:\n  - summary: Correct destination\n    connections:\n      - {type: map_link, summary: Return by new alias, url: ../new-alias.lensmap}\n",
      );
    } else {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const socket = server.address();
  if (!socket || typeof socket === "string")
    throw Error("Fixture did not bind.");
  const base = `http://127.0.0.1:${socket.port}`;
  try {
    await page.goto(`/?map=${encodeURIComponent(`${base}/alias.lensmap`)}`);
    await expect(
      page.getByRole("button", { name: "Redirected source", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Research", exact: true })
      .dblclick();
    await expect(page.locator("html")).toHaveAttribute(
      "data-open-url",
      `${base}/notes/research.txt`,
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-open-target",
      "_blank",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-open-features",
      "noopener",
    );
    await page
      .getByRole("button", { name: "Relative map", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Correct destination", exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole("button", { name: "Redirected source", exact: true }),
    ).toBeVisible();
    await page.getByText("YAML playground", { exact: true }).click();
    const draft = page.getByRole("textbox", { name: "YAML source" });
    const edited = (await draft.inputValue()).replace(
      "Redirected source",
      "Edited redirect source",
    );
    await draft.fill(edited);
    await page.getByRole("button", { name: "Apply YAML", exact: true }).click();
    const unapplied = `${edited}# retained unapplied work\n`;
    await draft.fill(unapplied);
    await page
      .getByRole("button", { name: "Relative map", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Correct destination", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Return by new alias", exact: true })
      .dblclick();
    await expect(
      page.getByRole("button", { name: "Edited redirect source", exact: true }),
    ).toBeVisible();
    await page.getByText("YAML playground", { exact: true }).click();
    await expect(draft).toHaveValue(unapplied);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});
