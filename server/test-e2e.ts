/**
 * End-to-end test for the OpenSCAD MCP server.
 *
 * Connects an in-process MCP client to the server over a linked pair of
 * in-memory transports and checks the tool and resource surface:
 * - `create` is an app tool bound to the viewer resource,
 * - defaults are applied and echoed in structuredContent,
 * - the UI resource serves the viewer HTML with CSP metadata.
 *
 * All viewer interaction (write_source, set_var, get_screenshot, …) lives
 * in the `interact` tool the view itself registers with the host, so it is
 * exercised in a browser host, not here.
 *
 * Run with: npm test
 */

import assert from "node:assert/strict";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer, DEFAULT_SOURCE, RESOURCE_URI } from "./openscad-server.js";
import { resolveBaseUrl } from "./base-url.js";
import { serverIcons } from "./icons.js";

async function connect(baseUrl?: string) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = baseUrl ? createServer(baseUrl) : createServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

type UiMeta = { ui?: { resourceUri?: string; csp?: Record<string, unknown>; permissions?: Record<string, unknown> } };

async function main() {
  let passed = 0;
  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✗ ${name}`);
      throw err;
    }
  };

  console.log("OpenSCAD MCP server tests");

  const { client } = await connect();

  await test("create tool is registered and bound to the viewer resource", async () => {
    const { tools } = await client.listTools();
    const create = tools.find((t) => t.name === "create");
    assert.ok(create, "create tool should be listed");
    const meta = create._meta as UiMeta | undefined;
    assert.equal(meta?.ui?.resourceUri, RESOURCE_URI);
    assert.ok(create.outputSchema, "create should declare an outputSchema");
  });

  await test("model-visible tool is `create`; entrypoint tools are app-only; hosts see visibility and annotations", async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ["create", "open_openscad", "open_scad_file"], "viewer tools are registered by the view, not the server");
    const meta = (n: string) => tools.find((t) => t.name === n)!._meta as Record<string, any>;
    assert.deepEqual(meta("create").ui.visibility, ["model", "app"]);
    assert.deepEqual(meta("open_openscad").ui.visibility, ["app"]);
    assert.deepEqual(meta("open_scad_file").ui.visibility, ["app"]);
    assert.equal(meta("create")["ui/resourceUri"], RESOURCE_URI, "legacy flat key mirrored by registerAppTool");
    for (const t of tools) {
      assert.equal(t.annotations?.readOnlyHint, true);
      assert.equal(t.annotations?.openWorldHint, false);
      assert.equal(meta(t.name).ui.resourceUri, RESOURCE_URI);
    }
  });

  await test("ChatGPT entrypoints: global+thread, .scad file handler; none on create", async () => {
    const { tools } = await client.listTools();
    const meta = (n: string) => tools.find((t) => t.name === n)!._meta as Record<string, any>;
    assert.equal(meta("create")["openai/ui"], undefined);
    assert.deepEqual(meta("open_openscad")["openai/ui"], { entrypoints: [{ type: "global" }, { type: "thread" }] });
    assert.deepEqual(meta("open_scad_file")["openai/ui"], { entrypoints: [{ type: "file", extensions: [".scad"] }] });
    assert.equal(tools.find((t) => t.name === "open_openscad")!.title, "OpenSCAD");
    const res = await client.readResource({ uri: RESOURCE_URI });
    const rmeta = res.contents[0]._meta as Record<string, any>;
    assert.deepEqual(rmeta["openai/ui"], { availableDisplayModes: ["inline", "fullscreen"], preferredDisplayMode: "fullscreen" });
  });

  await test("entrypoints launch with their documented arguments", async () => {
    for (const name of ["create", "open_openscad"]) {
      const result = await client.callTool({ name, arguments: {} });
      assert.ok(!result.isError, name);
      assert.equal((result.structuredContent as { source: string }).source, DEFAULT_SOURCE);
    }
    const file = { name: "box.scad", resourceUri: "host-resource://box" };
    const r = await client.callTool({ name: "open_scad_file", arguments: { file } });
    assert.deepEqual(r.structuredContent, { file });
    assert.ok((await client.callTool({ name: "open_scad_file", arguments: {} })).isError, "file is required");
  });

  await test("create description and server instructions carry the customizer reminder", async () => {
    const { tools } = await client.listTools();
    const reminder = /width = 60; \/\/ \[10:100\].*set_parameters.*does not modify the file.*get_parameters.*reset_parameters/s;
    assert.match(tools.find((t) => t.name === "create")!.description!, reminder);
    assert.match(client.getInstructions() ?? "", reminder);
  });

  await test("create applies defaults", async () => {
    const result = await client.callTool({ name: "create", arguments: {} });
    assert.ok(!result.isError, "create should succeed");
    const sc = result.structuredContent as { source: string; camera: string };
    assert.equal(sc.source, DEFAULT_SOURCE);
    assert.equal(sc.camera, "diagonal");
  });

  await test("create echoes source, vars and camera", async () => {
    const result = await client.callTool({
      name: "create",
      arguments: {
        source: "cube(10);",
        vars: { size: 42 },
        camera: "top",
      },
    });
    assert.ok(!result.isError, "create should succeed");
    const sc = result.structuredContent as {
      source: string;
      camera: string;
      vars?: Record<string, unknown>;
    };
    assert.equal(sc.source, "cube(10);");
    assert.equal(sc.camera, "top");
    assert.deepEqual(sc.vars, { size: 42 });
  });

  await test("create rejects an unknown camera preset", async () => {
    const result = await client.callTool({
      name: "create",
      arguments: { camera: "isometric-ish" },
    });
    assert.ok(result.isError, "invalid enum value should fail validation");
  });

  const iconSrcs = (icons: Array<{ src: string; mimeType?: string; sizes?: string[] }> | undefined) => (icons ?? []).map((i) => i.src);
  const checkIcons = (icons: Array<{ src: string; mimeType?: string; sizes?: string[] }> | undefined, base: string, what: string) => {
    assert.ok(icons && icons.length >= 3, `${what} should have icons`);
    const bySize = new Map(icons.map((i) => [i.sizes?.[0], i]));
    assert.equal(bySize.get("512x512")?.src, `${base}logo512.png`, what);
    assert.equal(bySize.get("192x192")?.src, `${base}logo192.png`, what);
    for (const size of ["512x512", "192x192"]) {
      assert.equal(bySize.get(size)?.mimeType, "image/png", `${what} ${size}`);
      assert.ok(/^https?:\/\//.test(bySize.get(size)!.src), `${what}: absolute URL`);
    }
    const small = bySize.get("64x64");
    assert.ok(small?.src.startsWith("data:image/png;base64,") && small.src.length < 20_000, `${what}: small data: URI icon`);
    assert.equal(small?.mimeType, "image/png");
  };

  await test("server and entrypoint tools carry the logo icons (absolute URLs from the base URL, 3 sizes)", async () => {
    for (const base of ["https://openscad.ochafik.com/", "https://my-app-git-x.vercel.app", "http://localhost:9100/"]) {
      const { client: c } = await connect(base);
      const normalized = base.endsWith("/") ? base : base + "/";
      checkIcons(c.getServerVersion()?.icons as never, normalized, `serverInfo (${base})`);
      const { tools } = await c.listTools();
      for (const name of ["create", "open_openscad", "open_scad_file"]) {
        checkIcons(tools.find((t) => t.name === name)?.icons as never, normalized, `tool ${name} (${base})`);
      }
      const { resources } = await c.listResources();
      checkIcons(resources.find((r) => r.uri === RESOURCE_URI)?.icons as never, normalized, `UI resource (${base})`);
    }
  });

  await test("icon URLs follow the per-request base (Host header, forwarded host, env override)", async () => {
    const base = (headers: Record<string, string>, env: NodeJS.ProcessEnv = {}) => resolveBaseUrl({ headers }, env);
    assert.deepEqual(iconSrcs(serverIcons(base({ host: "localhost:9100" }, { OPENSCAD_SERVE_DIST: "1" }))).slice(0, 2),
      ["http://localhost:9100/logo512.png", "http://localhost:9100/logo192.png"]);
    assert.equal(serverIcons(base({ host: "internal", "x-forwarded-host": "foo.vercel.app", "x-forwarded-proto": "https" }, { VERCEL: "1" }))[0].src,
      "https://foo.vercel.app/logo512.png");
    assert.equal(serverIcons(base({ host: "x.example" }, { OPENSCAD_BASE_URL: "https://cdn.example/openscad/" }))[1].src,
      "https://cdn.example/openscad/logo192.png");
  });

  await test("viewer resource serves HTML with CSP metadata", async () => {
    const { contents } = await client.readResource({ uri: RESOURCE_URI });
    assert.equal(contents.length, 1);
    const content = contents[0];
    const text = "text" in content ? content.text : undefined;
    assert.ok(typeof text === "string" && text.includes("openscad-base-url"));
    const meta = content._meta as UiMeta | undefined;
    assert.ok(meta?.ui?.csp, "resource should declare CSP domains");
    assert.ok(meta?.ui?.permissions, "resource should declare permissions");
  });

  console.log(`${passed} test(s) passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
