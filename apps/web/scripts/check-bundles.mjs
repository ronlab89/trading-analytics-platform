// Builds the web app twice, in real and in demo mode, and checks the guarantees of ADR-012 point 9:
// the demo bundle has no HTTP adapter and no API address, the real bundle has no demo code.
// Usage: pnpm --filter @trading/web check:bundles
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";

const DEMO_MARKER = "adapter:demo";
const HTTP_MARKER = "adapter:http";
const DEV_API_ADDRESS = "localhost:7001";

async function buildMode(mode, outDir) {
  const previous = process.env.VITE_APP_MODE;
  process.env.VITE_APP_MODE = mode;
  try {
    await build({ mode, logLevel: "error", build: { outDir, emptyOutDir: true } });
  } finally {
    if (previous === undefined) delete process.env.VITE_APP_MODE;
    else process.env.VITE_APP_MODE = previous;
  }
}

async function readBundle(dir) {
  const assets = join(dir, "assets");
  const names = (await readdir(assets)).filter((name) => name.endsWith(".js"));
  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      text: await readFile(join(assets, name), "utf8"),
      bytes: (await stat(join(assets, name))).size,
    })),
  );
  return files;
}

function check(failures, condition, message) {
  if (!condition) failures.push(message);
}

const root = await mkdtemp(join(tmpdir(), "trading-bundles-"));
const failures = [];

try {
  await buildMode("demo", join(root, "demo"));
  await buildMode("real", join(root, "real"));

  const demo = await readBundle(join(root, "demo"));
  const real = await readBundle(join(root, "real"));
  const demoText = demo.map((file) => file.text).join("\n");
  const realText = real.map((file) => file.text).join("\n");

  check(failures, demoText.includes(DEMO_MARKER), "the demo bundle has no demo adapter");
  check(failures, !demoText.includes(HTTP_MARKER), "the demo bundle contains the HTTP adapter");
  check(failures, !demoText.includes(DEV_API_ADDRESS), "the demo bundle contains the API address");
  check(failures, realText.includes(HTTP_MARKER), "the real bundle has no HTTP adapter");
  check(failures, !realText.includes(DEMO_MARKER), "the real bundle contains demo code");

  const kb = (files) => Math.round(files.reduce((sum, file) => sum + file.bytes, 0) / 1024);
  const demoChunk = demo.find((file) => file.text.includes(DEMO_MARKER));
  console.log(`demo bundle: ${kb(demo)} kB in ${demo.length} files`);
  console.log(`real bundle: ${kb(real)} kB in ${real.length} files`);
  if (demoChunk) console.log(`demo adapter chunk: ${kb([demoChunk])} kB (${demoChunk.name})`);
} finally {
  await rm(root, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log("Bundle checks passed.");
