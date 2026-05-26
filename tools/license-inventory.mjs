import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const components = [
  {
    name: "OpenPost",
    path: "apps/openpost",
    role: "Direct fork for SocialOps Scheduler",
    allowedUse: "modify directly",
    expectedLicense: "MIT",
  },
  {
    name: "OpenClaw",
    path: "apps/claw",
    role: "Direct fork for MiniClaw assistant",
    allowedUse: "modify directly with SocialOps skill allowlist",
    expectedLicense: "MIT",
  },
  {
    name: "ComfyUI",
    path: "ComfyUI",
    role: "Separate visual generation runtime",
    allowedUse: "service/API boundary only",
    expectedLicense: "GPL-3.0",
  },
  {
    name: "Postiz",
    path: "postiz-app",
    role: "Scheduler/product reference",
    allowedUse: "reference or separate AGPL service only",
    expectedLicense: "AGPL-3.0",
  },
  {
    name: "PokeeResearchOSS",
    path: "PokeeResearchOSS",
    role: "Separate research and citation service",
    allowedUse: "service/API boundary",
    expectedLicense: "Apache-2.0",
  },
];

function readPackageLicense(componentPath) {
  const packagePath = join(root, componentPath, "package.json");
  if (!existsSync(packagePath)) {
    return "";
  }
  try {
    const parsed = JSON.parse(readFileSync(packagePath, "utf8"));
    return typeof parsed.license === "string" ? parsed.license : "";
  } catch {
    return "";
  }
}

function hasLicenseFile(componentPath) {
  return ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"].some((name) =>
    existsSync(join(root, componentPath, name)),
  );
}

console.log("| Component | Expected license | Detected package license | License file | Use in SocialOps | Boundary |");
console.log("| --- | --- | --- | --- | --- | --- |");

for (const component of components) {
  const detected = readPackageLicense(component.path) || "n/a";
  const licenseFile = hasLicenseFile(component.path) ? "yes" : "missing";
  console.log(
    `| ${component.name} | ${component.expectedLicense} | ${detected} | ${licenseFile} | ${component.role} | ${component.allowedUse} |`,
  );
}

const comfyExtensionManifestPath = join(root, "comfyui-extensions/manifest.json");
if (existsSync(comfyExtensionManifestPath)) {
  const manifest = JSON.parse(readFileSync(comfyExtensionManifestPath, "utf8"));
  console.log("");
  console.log("| ComfyUI extension | Status | License | Repository | Install path |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const extension of manifest.extensions ?? []) {
    console.log(
      `| ${extension.key} | ${extension.status} | ${extension.license} | ${extension.repositoryUrl} | ${extension.installPath} |`,
    );
  }
  if ((manifest.extensions ?? []).length === 0) {
    console.log("| none | n/a | n/a | n/a | n/a |");
  }
}
