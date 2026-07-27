import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        host: "localhost",
        "x-forwarded-host": "localhost",
        "x-forwarded-proto": "http",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the WorldByCode studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Image to executable physics world · WorldByCode<\/title>/i,
  );
  assert.match(html, /Photo in\./);
  assert.match(html, /World out\./);
  assert.match(html, /An editable 3D physics scene/);
  assert.match(html, /zero 3d generators/i);
  assert.match(html, /connect api/i);
  assert.match(html, /Verifying physics/);
  assert.match(html, /WorldSpec/);
  assert.match(html, /Copy JSON/);
  assert.match(html, /Physics report/);
  assert.match(html, /VLM prompt/);
  assert.match(html, /Packing station/);
  assert.match(html, /Fulfillment lane/);
  assert.match(html, /Your image/);
});

test("ships the generated social card and no starter preview", async () => {
  const [layout, page, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(layout, /new URL\("\/og\.png", origin\)/);
  assert.match(layout, /summary_large_image/);
  assert.match(page, /<WorldStudio \/>/);
  assert.match(packageJson, /"name": "worldbycode"/);
  await assert.rejects(access(new URL("app/_sites-preview", templateRoot)));
});

test("ships an inspectable WorldSpec contract and real model route", async () => {
  const [worldSpecSource, promptSource, routeSource, envExample] =
    await Promise.all([
      readFile(new URL("../lib/worldspec.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/world-prompt.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/world/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
    ]);

  assert.match(worldSpecSource, /WORLD_SPEC_JSON_SCHEMA/);
  assert.match(worldSpecSource, /validateWorldSpec/);
  assert.match(promptSource, /Real2Sim scene compiler/);
  assert.match(routeSource, /api\.openai\.com\/v1\/responses/);
  assert.match(routeSource, /api\.openai\.com\/v1\/models/);
  assert.match(routeSource, /x-worldbycode-api-key/);
  assert.match(routeSource, /type: "json_schema"/);
  assert.match(routeSource, /detail: "original"/);
  assert.match(envExample, /OPENAI_API_KEY=/);
});
