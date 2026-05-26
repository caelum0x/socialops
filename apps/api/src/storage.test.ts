import { describe, expect, it } from "vitest";

import { createStorageClient } from "./storage.js";

describe("storage presign", () => {
  it("rejects presign when storage is disabled", () => {
    const client = createStorageClient({
      kind: "disabled",
      bucket: "",
      endpoint: "",
      region: "auto",
      accessKeyId: "",
      secretAccessKey: "",
      publicBaseUrl: "",
    });
    expect(client.isEnabled()).toBe(false);
    expect(() =>
      client.presignUpload({ fileName: "x.mp4", contentType: "video/mp4" }),
    ).toThrow(/not configured/u);
  });

  it("produces a SigV4 presigned URL for R2 with all required query params", () => {
    const client = createStorageClient({
      kind: "r2",
      bucket: "socialops-media",
      endpoint: "abc123.r2.cloudflarestorage.com",
      region: "auto",
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secretexamplekey",
      publicBaseUrl: "https://pub-xyz.r2.dev",
    });
    const result = client.presignUpload({
      fileName: "demo clip.mp4",
      contentType: "video/mp4",
      folder: "workspaces/abc/uploads",
    });
    expect(result.uploadUrl.startsWith("https://abc123.r2.cloudflarestorage.com/socialops-media/")).toBe(true);
    expect(result.uploadUrl).toContain("X-Amz-Algorithm=AWS4-HMAC-SHA256");
    expect(result.uploadUrl).toContain("X-Amz-Credential=AKIAEXAMPLE");
    expect(result.uploadUrl).toContain("X-Amz-Expires=900");
    expect(result.uploadUrl).toContain("X-Amz-Signature=");
    expect(result.uploadUrl).toContain("X-Amz-SignedHeaders=content-type%3Bhost");
    expect(result.publicUrl).toMatch(/^https:\/\/pub-xyz\.r2\.dev\/workspaces\/abc\/uploads\/[0-9a-f-]+\/demo_clip\.mp4$/u);
    expect(result.requiredHeaders["content-type"]).toBe("video/mp4");
  });

  it("falls back to virtual-hosted public URL when STORAGE_PUBLIC_BASE_URL is unset", () => {
    const client = createStorageClient({
      kind: "s3",
      bucket: "mybucket",
      endpoint: "",
      region: "us-east-1",
      accessKeyId: "AKIA",
      secretAccessKey: "secret",
      publicBaseUrl: "",
    });
    const result = client.presignUpload({ fileName: "a.png", contentType: "image/png" });
    expect(result.publicUrl).toContain("https://mybucket.s3.us-east-1.amazonaws.com/");
  });
});
