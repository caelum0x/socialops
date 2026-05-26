import { comfyMediaKinds, type ComfyMediaKind } from "./comfy-presets.js";

export const comfyExtensionStatuses = ["candidate", "approved", "installed", "disabled", "rejected"] as const;

export type ComfyExtensionStatus = (typeof comfyExtensionStatuses)[number];

export type ComfyExtensionManifestEntry = {
  key: string;
  name: string;
  repositoryUrl: string;
  revision?: string;
  license: string;
  status: ComfyExtensionStatus;
  installPath: string;
  mediaKinds: ComfyMediaKind[];
  workflowPresetKeys: string[];
  notes: string;
};

export type ComfyExtensionManifest = {
  version: number;
  runtime: {
    path: string;
    customNodesPath: string;
  };
  extensions: ComfyExtensionManifestEntry[];
};

export function validateComfyExtensionManifest(manifest: ComfyExtensionManifest): string[] {
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  if (manifest.version !== 1) {
    errors.push("manifest.version must be 1");
  }
  if (!manifest.runtime?.path) {
    errors.push("runtime.path is required");
  }
  if (!manifest.runtime?.customNodesPath) {
    errors.push("runtime.customNodesPath is required");
  }

  for (const extension of manifest.extensions ?? []) {
    if (!extension.key) {
      errors.push("extension key is required");
    }
    if (seenKeys.has(extension.key)) {
      errors.push(`duplicate extension key: ${extension.key}`);
    }
    seenKeys.add(extension.key);

    if (!extension.repositoryUrl.startsWith("https://github.com/")) {
      errors.push(`${extension.key}: repositoryUrl must be a GitHub HTTPS URL`);
    }
    if (!extension.installPath.startsWith(`${manifest.runtime.customNodesPath}/`)) {
      errors.push(`${extension.key}: installPath must be inside ${manifest.runtime.customNodesPath}`);
    }
    if (!comfyExtensionStatuses.includes(extension.status)) {
      errors.push(`${extension.key}: invalid status ${extension.status}`);
    }
    if (!extension.license || extension.license.toLowerCase() === "unknown") {
      errors.push(`${extension.key}: license must be verified before install`);
    }
    for (const mediaKind of extension.mediaKinds) {
      if (!comfyMediaKinds.includes(mediaKind)) {
        errors.push(`${extension.key}: unsupported media kind ${mediaKind}`);
      }
    }
  }

  return errors;
}
