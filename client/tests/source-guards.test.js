import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.(jsx?|mjs)$/.test(name) ? [full] : [];
  });
}

describe("source guards", () => {
  it("never uses an expression-bodied useEffect (its value would be treated as a cleanup function)", () => {
    // Real browsers return values from some DOM calls (e.g. scrollIntoView) that jsdom stubs hide,
    // which crashes React with "destroy is not a function". Effects must use block bodies.
    const offenders = sourceFiles("src").filter((file) => /useEffect\(\(\)\s*=>\s*[^{\s]/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("never stores secrets or tokens in anything but the documented localStorage key", () => {
    const uses = sourceFiles("src").flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/localStorage\.(?:get|set|remove)Item\(\s*([^,)]+)/g)].map((m) => m[1].trim()),
    );
    const allowed = new Set(["TOKEN_KEY", "KEY", '"adaptlearn.theme"']);
    expect(uses.filter((key) => !allowed.has(key))).toEqual([]);
  });

  it("does not render untrusted HTML", () => {
    const offenders = sourceFiles("src").filter((file) => /dangerouslySetInnerHTML|innerHTML\s*=/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
