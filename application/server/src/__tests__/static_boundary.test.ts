import { describe, test, expect } from "bun:test";

import { app } from "./app";

describe("static HTTP boundary behavior", () => {
  test("missing route with Accept: application/json returns 404", async () => {
    const res = await app.request("/some/route", {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(404);
  });

  test("missing file with extension returns 404", async () => {
    const res = await app.request("/missing.css", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(404);
  });

  test("path traversal attempt is blocked", async () => {
    const res = await app.request("/../../../etc/passwd");
    expect(res.status).toBe(404);
  });
});
