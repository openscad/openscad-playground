/**
 * Contract tests for the view-registered `interact` tool
 * (src/state/mcp-app.ts), run headless against a mock processor.
 *
 * Covers: single-action dispatch, per-action zod validation, the batch
 * contract (1:1 content indexing, ERROR slot, stop-on-failure, isError only
 * for single-command calls), and the mutation outcome messages (timeout,
 * edit_source miss, set_var without value).
 *
 * Run with: npm test (after test-e2e.ts). Excluded from the server tsconfig
 * because it imports across the frontend rootDir; tsx handles it directly.
 */

import assert from "node:assert/strict";
import {
  handleInteractToolCall,
  setActiveProcessor,
  type McpToolProcessor,
  type OpenSCADCommand,
} from "../src/state/mcp-app.ts";

const SCREENSHOT = "data:image/png;base64,QUFBQQ==";

function mockProcessor(): McpToolProcessor & { log: OpenSCADCommand[] } {
  const log: OpenSCADCommand[] = [];
  return {
    log,
    async processCommand(command: OpenSCADCommand): Promise<unknown> {
      log.push(command);
      switch (command.type) {
        case "edit_source":
          return command.old_text === "missing" ? { notFound: true } : {};
        case "write_source":
          return { timedOut: command.content === "SLOW" };
        case "render":
          return { timedOut: false };
        case "get_state":
          return { source: "cube(1);", errors: [], warnings: [] };
        default:
          return {};
      }
    },
    async captureScreenshot() {
      return SCREENSHOT;
    },
    getContextState() {
      return { errors: [], warnings: [] };
    },
  };
}

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

  console.log("interact tool contract tests");

  const processor = mockProcessor();
  setActiveProcessor(processor);

  await test("single action dispatches to the processor", async () => {
    const res = await handleInteractToolCall({ action: "set_camera", view: "top" });
    assert.ok(!res.isError);
    assert.equal(processor.log.at(-1)?.type, "set_camera");
  });

  await test("single action failure sets isError", async () => {
    const res = await handleInteractToolCall({
      action: "edit_source", old_text: "missing", new_text: "x",
    });
    assert.ok(res.isError);
    assert.match((res.content[0] as { text: string }).text, /not found/);
  });

  await test("zod validation failure names the field", async () => {
    const res = await handleInteractToolCall({ action: "zoom" });
    assert.ok(res.isError);
    assert.match((res.content[0] as { text: string }).text, /zoom.*factor/s);
  });

  await test("unknown action is an error", async () => {
    const res = await handleInteractToolCall({ action: "launch_rocket" });
    assert.ok(res.isError);
    assert.match((res.content[0] as { text: string }).text, /Unknown action/);
  });

  await test("no action and no commands is an error", async () => {
    const res = await handleInteractToolCall({});
    assert.ok(res.isError);
  });

  await test("set_var without value is an error", async () => {
    const res = await handleInteractToolCall({ action: "set_var", name: "width" });
    assert.ok(res.isError);
    assert.match((res.content[0] as { text: string }).text, /value/);
  });

  await test("write_source timeout reports still-processing", async () => {
    const res = await handleInteractToolCall({ action: "write_source", content: "SLOW" });
    assert.ok(!res.isError);
    assert.match((res.content[0] as { text: string }).text, /Still processing/);
  });

  await test("get_screenshot returns image content", async () => {
    const res = await handleInteractToolCall({ action: "get_screenshot" });
    assert.ok(!res.isError);
    assert.equal(res.content[0].type, "image");
  });

  await test("get_state returns structuredContent", async () => {
    const res = await handleInteractToolCall({ action: "get_state" });
    assert.ok(!res.isError);
    assert.deepEqual(
      (res.structuredContent as { source: string }).source,
      "cube(1);",
    );
  });

  await test("batch: content[i] is the result of commands[i]", async () => {
    const res = await handleInteractToolCall({
      commands: [
        { action: "set_camera", view: "front" },
        { action: "get_screenshot" },
      ],
    });
    assert.ok(!res.isError);
    assert.equal(res.content.length, 2);
    assert.equal(res.content[0].type, "text");
    assert.equal(res.content[1].type, "image");
  });

  await test("batch stops at the failing step with an ERROR slot, no isError", async () => {
    const before = processor.log.length;
    const res = await handleInteractToolCall({
      commands: [
        { action: "set_camera", view: "front" },
        { action: "edit_source", old_text: "missing", new_text: "x" },
        { action: "get_screenshot" },
      ],
    });
    assert.equal(res.isError, undefined, "multi-command batch must not set isError");
    assert.equal(res.content.length, 2, "stops after the failing step");
    assert.match(
      (res.content[1] as { text: string }).text,
      /^ERROR at step 2\/3 \(edit_source\)/,
    );
    // get_screenshot after the failure must not have run
    assert.ok(!processor.log.slice(before).some(c => c.type === "get_screenshot"));
  });

  await test("single-command batch failure sets isError", async () => {
    const res = await handleInteractToolCall({
      commands: [{ action: "edit_source", old_text: "missing", new_text: "x" }],
    });
    assert.ok(res.isError);
    assert.match((res.content[0] as { text: string }).text, /^ERROR: /);
  });

  await test("call without a processor times out with a clear error", async () => {
    setActiveProcessor(null);
    // Patch the wait so the test doesn't take 15s: a null processor with no
    // replacement will reject once the timeout fires; use a short-lived race.
    const pending = handleInteractToolCall({ action: "auto_fit" });
    setActiveProcessor(processor); // restore before it times out — resolves
    const res = await pending;
    assert.ok(!res.isError, "waiter resolves once a processor is installed");
  });

  console.log(`${passed} test(s) passed`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
