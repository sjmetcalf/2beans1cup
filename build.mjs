// Bundles src/ into public/assets/app.js + app.css.
// The built files are committed, so Cloudflare only has to serve public/.
import * as esbuild from "esbuild";

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
}
