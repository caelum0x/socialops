import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "comfyui-extensions/manifest.json");
const allowedStatuses = new Set(["candidate", "approved", "installed", "disabled", "rejected"]);
const allowedMediaKinds = new Set(["image", "video", "audio", "voice", "text_visual"]);

function fail(message) {
  console.error(`error    ${message}`);
  process.exitCode = 1;
}

function hasLicenseFile(path) {
  return ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"].some((name) => existsSync(join(path, name)));
}

if (!existsSync(manifestPath)) {
  fail("missing comfyui-extensions/manifest.json");
  process.exit();
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const customNodesPath = manifest.runtime?.customNodesPath;

console.log("| Extension | Status | License | Media kinds | Install path | Installed | License file |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");

if (manifest.version !== 1) {
  fail("manifest.version must be 1");
}
if (!customNodesPath) {
  fail("runtime.customNodesPath is required");
}

const seen = new Set();
for (const extension of manifest.extensions ?? []) {
  const installPath = extension.installPath ?? "";
  const absoluteInstallPath = join(root, installPath);
  const installed = existsSync(absoluteInstallPath) && statSync(absoluteInstallPath).isDirectory();
  const licenseFile = installed && hasLicenseFile(absoluteInstallPath);
  const mediaKinds = Array.isArray(extension.mediaKinds) ? extension.mediaKinds : [];

  console.log(
    `| ${extension.key ?? ""} | ${extension.status ?? ""} | ${extension.license ?? ""} | ${mediaKinds.join(", ")} | ${installPath} | ${installed ? "yes" : "no"} | ${licenseFile ? "yes" : installed ? "missing" : "n/a"} |`,
  );

  if (!extension.key) {
    fail("extension key is required");
  } else if (seen.has(extension.key)) {
    fail(`duplicate extension key: ${extension.key}`);
  }
  seen.add(extension.key);

  if (!allowedStatuses.has(extension.status)) {
    fail(`${extension.key}: invalid status ${extension.status}`);
  }
  if (!extension.repositoryUrl?.startsWith("https://github.com/")) {
    fail(`${extension.key}: repositoryUrl must be a GitHub HTTPS URL`);
  }
  if (!installPath.startsWith(`${customNodesPath}/`)) {
    fail(`${extension.key}: installPath must stay inside ${customNodesPath}`);
  }
  if (relative(join(root, customNodesPath), absoluteInstallPath).startsWith("..")) {
    fail(`${extension.key}: installPath escapes ${customNodesPath}`);
  }
  if (!extension.license || extension.license.toLowerCase() === "unknown") {
    fail(`${extension.key}: license must be verified before install`);
  }
  for (const mediaKind of mediaKinds) {
    if (!allowedMediaKinds.has(mediaKind)) {
      fail(`${extension.key}: unsupported media kind ${mediaKind}`);
    }
  }
  if (extension.status === "installed" && !installed) {
    fail(`${extension.key}: status is installed but path is missing`);
  }
  if (installed && !licenseFile) {
    fail(`${extension.key}: installed extension is missing a license file`);
  }
}

if ((manifest.extensions ?? []).length === 0) {
  console.log("| none | n/a | n/a | n/a | n/a | no | n/a |");
}
