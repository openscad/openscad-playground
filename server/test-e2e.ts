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

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
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

  await test("create is the only server tool; hosts see it as model- and app-visible", async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name), ["create"], "viewer tools are registered by the view, not the server");
    const meta = tools[0]._meta as Record<string, any>;
    assert.deepEqual(meta.ui.visibility, ["model", "app"]);
    assert.equal(meta["ui/resourceUri"], RESOURCE_URI, "legacy flat key mirrored by registerAppTool");
    assert.equal(tools[0].annotations?.readOnlyHint, true);
    assert.equal(tools[0].annotations?.openWorldHint, false);
  });

  await test("create declares the ChatGPT global entrypoint and display modes", async () => {
    const { tools } = await client.listTools();
    const meta = tools[0]._meta as Record<string, any>;
    assert.deepEqual(meta["openai/ui"], { entrypoints: [{ type: "global" }] });
    const res = await client.readResource({ uri: RESOURCE_URI });
    const rmeta = res.contents[0]._meta as Record<string, any>;
    assert.deepEqual(rmeta["openai/ui"], { availableDisplayModes: ["inline", "fullscreen"], preferredDisplayMode: "inline" });
  });

  await test("create accepts {} (entrypoint launches send no arguments)", async () => {
    const result = await client.callTool({ name: "create", arguments: {} });
    assert.ok(!result.isError);
    assert.equal((result.structuredContent as { source: string }).source, DEFAULT_SOURCE);
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
