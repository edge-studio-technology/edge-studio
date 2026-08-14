import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const filesPath = process.argv[2] ?? "scripts/release/runtime-bundle-files.json";
const outPath = process.argv[3] ?? "edge-studio-runtime.tar.gz";
const stageDir = join(repoRoot, ".runtime-bundle-staging");
const files = JSON.parse(await import("node:fs").then(({ readFileSync }) => readFileSync(join(repoRoot, filesPath), "utf8")));

if (!Array.isArray(files) || files.some((file) => typeof file !== "string" || file.length === 0)) {
  throw new Error(`${filesPath} must contain a JSON array of file paths`);
}

rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

for (const file of files) {
  const source = join(repoRoot, file);
  if (!existsSync(source)) {
    throw new Error(`Runtime bundle file is missing: ${file}`);
  }

  const destination = join(stageDir, file);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, destination, { preserveTimestamps: true });
}

const tar = spawnSync("tar", ["-czf", join(repoRoot, outPath), "-C", stageDir, "."], {
  cwd: repoRoot,
  stdio: "inherit"
});

rmSync(stageDir, { recursive: true, force: true });

if (tar.status !== 0) {
  throw new Error(`tar failed with exit code ${tar.status ?? "unknown"}`);
}

console.log(`Wrote ${outPath} with ${files.length} files`);
