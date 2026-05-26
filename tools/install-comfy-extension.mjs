import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const key = process.argv[2];
const manifestPath = join(root, "comfyui-extensions/manifest.json");

if (!key) {
  console.error("usage: node tools/install-comfy-extension.mjs <extension-key>");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const extension = (manifest.extensions ?? []).find((entry) => entry.key === key);

if (!extension) {
  console.error(`unknown ComfyUI extension key: ${key}`);
  process.exit(1);
}
if (!["approved", "installed"].includes(extension.status)) {
  console.error(`extension ${key} must be approved before install; current status is ${extension.status}`);
  process.exit(1);
}
if (!extension.license || extension.license.toLowerCase() === "unknown") {
  console.error(`extension ${key} must have a verified license before install`);
  process.exit(1);
}

const customNodesPath = manifest.runtime.customNodesPath;
const installPath = join(root, extension.installPath);
if (!extension.installPath.startsWith(`${customNodesPath}/`) || relative(join(root, customNodesPath), installPath).startsWith("..")) {
  console.error(`extension ${key} installPath must stay inside ${customNodesPath}`);
  process.exit(1);
}
if (existsSync(installPath)) {
  console.log(`${extension.key} already exists at ${extension.installPath}`);
  process.exit(0);
}

const parent = dirname(installPath);
const clone = spawnSync("git", ["clone", extension.repositoryUrl, installPath], {
  cwd: root,
  stdio: "inherit",
});
if (clone.status !== 0) {
  process.exit(clone.status ?? 1);
}

if (extension.revision) {
  const checkout = spawnSync("git", ["checkout", extension.revision], {
    cwd: installPath,
    stdio: "inherit",
  });
  if (checkout.status !== 0) {
    process.exit(checkout.status ?? 1);
  }
}

console.log(`installed ${extension.key} into ${extension.installPath}`);
