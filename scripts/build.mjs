/**
 * Builds the Tier-1 plugin: src/main.tsx → main.js (single ESM file, no React
 * inside — `react` / `react/jsx-runtime` resolve to src/shim, which forwards to
 * ctx.react at call time) and src/styles/index.css → styles.css (bundles
 * @ccgui/plugin-ui/styles.css). Copies the three release files into dist/.
 */
import { build } from "esbuild";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_MAIN_BYTES = 512 * 1024;

/** `react`, `react/jsx-runtime` (and the dev runtime) → the call-time shim. */
const reactShim = {
  name: "react-shim",
  setup(b) {
    b.onResolve({ filter: /^react(\/jsx-runtime|\/jsx-dev-runtime)?$/ }, (args) => ({
      path: resolve(root, args.path === "react" ? "src/shim/react.ts" : "src/shim/jsx-runtime.ts"),
    }));
    b.onResolve({ filter: /^react-dom(\/.*)?$/ }, (args) => ({
      errors: [{ text: `react-dom must not be bundled (imported by ${args.importer})` }],
    }));
  },
};

const banner = "/* usage-limits · built from src/ by scripts/build.mjs — do not edit by hand */";

await build({
  entryPoints: [resolve(root, "src/main.tsx")],
  outfile: resolve(root, "main.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  legalComments: "none",
  charset: "utf8",
  logLevel: "info",
  plugins: [reactShim],
  banner: { js: banner },
});

await build({
  entryPoints: [resolve(root, "src/styles/index.css")],
  outfile: resolve(root, "styles.css"),
  bundle: true,
  charset: "utf8",
  legalComments: "none",
  logLevel: "info",
  banner: { css: banner },
});

const size = (await stat(resolve(root, "main.js"))).size;
if (size > MAX_MAIN_BYTES) {
  throw new Error(`main.js is ${size} bytes, over the ${MAX_MAIN_BYTES}-byte budget`);
}

const dist = resolve(root, "dist");
await mkdir(dist, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(resolve(root, file), resolve(dist, file));
}
