import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PASSWORD, boot, createUser } from "./helpers.js";

describe("login brute-force protection", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ name: "ratelimit", env: { AUTH_RATE_LIMIT_MAX: "3" } });
  });
  after(() => ctx.close());

  it("returns 429 after repeated failed logins for the same account", async () => {
    const { user } = await createUser(ctx);
    const statuses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await ctx.request.post("/api/v1/auth/login").send({ email: user.email, password: "nope-nope-nope-1" });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 3), [401, 401, 401]);
    assert.equal(statuses[3], 429);
    // A different account from the same IP is not locked out.
    const other = await createUser(ctx);
    const ok = await ctx.request.post("/api/v1/auth/login").send({ email: other.user.email, password: PASSWORD });
    assert.equal(ok.status, 200);
  });
});
