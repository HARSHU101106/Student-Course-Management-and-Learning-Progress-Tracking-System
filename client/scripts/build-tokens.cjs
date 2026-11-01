#!/usr/bin/env node
/**
 * npm run tokens         -> regenerate src/styles/tokens.css from design-tokens.json
 * npm run lint:tokens    -> fail if tokens.css is stale OR source files hard-code colours/spacing
 * (generate-tokens.cjs and validate-tokens.cjs come from the design-system skill.)
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "src/styles/tokens.css");
const configPath = path.join(root, "design-tokens.json");

/**
 * The stock generator resolves component tokens to fixed values, so they would not follow the
 * `.dark` overrides of the semantic layer. This appends a `.dark` block that re-resolves every
 * component token whose value references a semantic colour that has a dark override.
 */
function darkComponentBlock() {
  const tokens = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const darkColors = tokens.dark?.semantic?.color ?? {};
  const lookup = (pathStr, dark) => {
    const parts = pathStr.split(".");
    if (dark && parts[0] === "semantic" && parts[1] === "color" && darkColors[parts[2]]) return darkColors[parts[2]];
    let node = tokens;
    for (const part of parts) node = node?.[part];
    return node;
  };
  const resolve = (value, dark) => {
    const match = /^\{(.+)\}$/.exec(value);
    if (!match) return value;
    const target = lookup(match[1], dark);
    return resolve(target?.$value ?? target, dark);
  };
  const lines = [];
  for (const [group, props] of Object.entries(tokens.component ?? {})) {
    for (const [name, token] of Object.entries(props)) {
      if (token.$type !== "color") continue;
      const light = resolve(token.$value, false);
      const dark = resolve(token.$value, true);
      if (dark !== light) lines.push(`  --${group}-${name}: ${dark};`);
    }
  }
  return lines.length ? `\n/* Component tokens re-resolved for the dark theme */\n.dark {\n${lines.join("\n")}\n}\n` : "";
}

const generate = (target) => {
  execFileSync("node", [path.join(__dirname, "generate-tokens.cjs"), "--config", configPath, "-o", target], { stdio: "pipe" });
  fs.appendFileSync(target, darkComponentBlock());
};

if (process.argv.includes("--check")) {
  const tmp = path.join(require("node:os").tmpdir(), `tokens-${process.pid}.css`);
  generate(tmp);
  if (fs.readFileSync(tmp, "utf8") !== fs.readFileSync(out, "utf8")) {
    console.error("tokens.css is out of date. Run: npm run tokens");
    process.exit(1);
  }
  try {
    const result = execFileSync("node", [path.join(__dirname, "validate-tokens.cjs"), "--dir", path.join(root, "src")], { encoding: "utf8" });
    console.log(result.trim().split("\n").slice(-1)[0]);
  } catch (error) {
    console.error(error.stdout || error.message);
    process.exit(1);
  }
} else {
  generate(out);
  console.log("Regenerated src/styles/tokens.css");
}
