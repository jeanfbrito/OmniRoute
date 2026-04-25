import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-env-repair-route-"));
process.env.DATA_DIR = TEST_DATA_DIR;

const route = await import("../../src/app/api/system/env/repair/route.ts");
const syncEnvModule = await import("../../scripts/sync-env.mjs");

function makeRequest(method: "GET" | "POST") {
  return new Request("http://localhost/api/system/env/repair", { method });
}

test("env/repair route module loads with statically bundled sync-env helpers", () => {
  // Regression test for the production-build failure
  //   500 {"error":"Cannot find module as expression is too dynamic"}
  // which happened when the route used a runtime-computed dynamic import
  // for scripts/sync-env.mjs. The Next.js bundler cannot trace those, so
  // the route handler crashed on first invocation. Switching to a static
  // relative import makes the helpers part of the route chunk.
  assert.equal(typeof route.GET, "function", "GET handler must be exported");
  assert.equal(typeof route.POST, "function", "POST handler must be exported");
  assert.equal(route.dynamic, "force-dynamic");
  assert.equal(typeof syncEnvModule.getEnvSyncPlan, "function");
  assert.equal(typeof syncEnvModule.syncEnv, "function");
});

test("GET /api/system/env/repair invokes statically bundled helpers without bundler error", async () => {
  const response = await route.GET(makeRequest("GET"));
  // Either 200 (auth-not-required test env) or 401 (auth required) is fine —
  // the regression we are guarding against produced a 500 with body
  //   {"error":"Cannot find module as expression is too dynamic"}
  assert.notEqual(response.status, 500, "must not crash with bundler error");
  const body = await response.json();
  assert.notEqual(
    body.error,
    "Cannot find module as expression is too dynamic",
    "static import must replace runtime dynamic import"
  );
  if (response.status === 200) {
    assert.equal(typeof body.available, "boolean");
    assert.equal(typeof body.missingCount, "number");
    assert.ok(Array.isArray(body.missingKeys));
  }
});

test("POST /api/system/env/repair invokes statically bundled helpers without bundler error", async () => {
  const response = await route.POST(makeRequest("POST"));
  assert.notEqual(response.status, 500, "must not crash with bundler error");
  const body = await response.json();
  assert.notEqual(
    body.error,
    "Cannot find module as expression is too dynamic",
    "static import must replace runtime dynamic import"
  );
});
