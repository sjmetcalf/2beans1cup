// Bundles src/ into public/assets/app.js + app.css.
// The built files are committed, so Cloudflare only has to serve public/.
import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
const options = {
  entryPoints: { app: "src/main.jsx" },
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  format: "esm",
  target: ["es2022"],
  jsx: "automatic",
  outdir: "public/assets",
  loader: { ".woff": "file", ".webp": "file", ".png": "file" },
  external: ["/assets/*"],
  define: { "process.env.NODE_ENV": watch ? '"development"' : '"production"' },
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
  // Cache-bust: stamp asset URLs in index.html with a content hash so browsers pick up new builds
  const hash = createHash("sha256")
    .update(readFileSync("public/assets/app.js"))
    .update(readFileSync("public/assets/app.css"))
    .digest("hex")
    .slice(0, 10);
  const html = readFileSync("public/index.html", "utf8")
    .replace(/\/assets\/app\.css(\?v=[\w]+)?/, `/assets/app.css?v=${hash}`)
    .replace(/\/assets\/app\.js(\?v=[\w]+)?/, `/assets/app.js?v=${hash}`);
  writeFileSync("public/index.html", html);
  console.log(`index.html stamped v=${hash}`);
}
