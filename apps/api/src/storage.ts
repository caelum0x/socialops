import { createHash, createHmac, randomUUID } from "node:crypto";

export type StorageKind = "r2" | "s3" | "disabled";

export type StorageConfig = {
  kind: StorageKind;
  bucket: string;
  /** Account-id-host for R2 (e.g. `<account>.r2.cloudflarestorage.com`) or full S3 endpoint host. Empty for default AWS. */
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public-facing CDN/host that fronts the bucket. Without this presigned PUTs work but downloads need GET presigning. */
  publicBaseUrl: string;
};

export type PresignedUpload = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};

export type StorageClient = {
  isEnabled: () => boolean;
  presignUpload: (input: { fileName: string; contentType: string; folder?: string; expiresSeconds?: number }) => PresignedUpload;
  publicUrlFor: (key: string) => string;
};

export function loadStorageConfig(env: NodeJS.ProcessEnv): StorageConfig {
  const kindRaw = (env.STORAGE_KIND ?? "disabled").toLowerCase();
  const kind: StorageKind = kindRaw === "r2" ? "r2" : kindRaw === "s3" ? "s3" : "disabled";
  return {
    kind,
    bucket: env.STORAGE_BUCKET ?? "",
    endpoint: env.STORAGE_ENDPOINT ?? "",
    region: env.STORAGE_REGION ?? (kind === "r2" ? "auto" : "us-east-1"),
    accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? "",
    publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL ?? "",
  };
}

export function createStorageClient(config: StorageConfig): StorageClient {
  const ready = Boolean(
    config.kind !== "disabled" && config.bucket && config.accessKeyId && config.secretAccessKey,
  );

  function endpointHost(): string {
    if (config.endpoint) {
      return config.endpoint.replace(/^https?:\/\//u, "").replace(/\/$/u, "");
    }
    if (config.kind === "r2") {
      throw new Error("STORAGE_ENDPOINT is required for R2 (your account's r2.cloudflarestorage.com host)");
    }
    return `s3.${config.region}.amazonaws.com`;
  }

  function publicUrlFor(key: string): string {
    if (config.publicBaseUrl) {
      return `${config.publicBaseUrl.replace(/\/$/u, "")}/${encodeKey(key)}`;
    }
    // Fallback: virtual-hosted style on the API endpoint. Works for AWS S3
    // public buckets; for R2 the operator should set STORAGE_PUBLIC_BASE_URL
    // to a connected public bucket / custom domain.
    return `https://${config.bucket}.${endpointHost()}/${encodeKey(key)}`;
  }

  function presignUpload(input: {
    fileName: string;
    contentType: string;
    folder?: string;
    expiresSeconds?: number;
  }): PresignedUpload {
    if (!ready) {
      throw new Error(
        "storage is not configured. Set STORAGE_KIND=r2 or s3 plus STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY (and STORAGE_ENDPOINT for R2).",
      );
    }
    const expires = Math.min(Math.max(input.expiresSeconds ?? 900, 60), 60 * 60 * 6);
    const key = buildObjectKey(input.fileName, input.folder);
    const host = endpointHost();
    const url = signV4PresignedUrl({
      method: "PUT",
      host,
      path: `/${config.bucket}/${encodeKey(key)}`,
      region: config.region,
      service: "s3",
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      expiresSeconds: expires,
      signedHeaders: { host, "content-type": input.contentType },
    });
    return {
      uploadUrl: `https://${url}`,
      publicUrl: publicUrlFor(key),
      key,
      requiredHeaders: { "content-type": input.contentType },
      expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
    };
  }

  return {
    isEnabled: () => ready,
    presignUpload,
    publicUrlFor,
  };
}

function buildObjectKey(fileName: string, folder?: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/gu, "_").slice(-128) || "file";
  const dir = folder ? folder.replace(/^\/+|\/+$/gu, "") : "uploads";
  const id = randomUUID();
  return `${dir}/${id}/${safeName}`;
}

function encodeKey(key: string): string {
  // Encode every segment but preserve the slashes that delimit the S3 prefix.
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/gu, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

type SignArgs = {
  method: "PUT" | "GET";
  host: string;
  path: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds: number;
  signedHeaders: Record<string, string>;
};

/**
 * AWS Signature V4 presigned URL. Spec:
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
 *
 * Returns `host + path + ?query` (no scheme) so the caller prepends https://.
 */
function signV4PresignedUrl(args: SignArgs): string {
  const { method, host, path, region, service, accessKeyId, secretAccessKey, expiresSeconds, signedHeaders } = args;
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const sortedHeaderNames = Object.keys(signedHeaders).map((k) => k.toLowerCase()).sort();
  const canonicalHeaders = sortedHeaderNames
    .map((name) => `${name}:${(signedHeaders[name] ?? "").trim().replace(/\s+/gu, " ")}`)
    .join("\n");
  const signedHeadersList = sortedHeaderNames.join(";");

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeadersList,
  };

  const canonicalQueryString = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
    .join("&");

  const canonicalRequest = [
    method,
    path,
    canonicalQueryString,
    canonicalHeaders,
    "",
    signedHeadersList,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = hmacHex(signingKey, stringToSign);

  return `${host}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

function deriveSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function hmacHex(key: Buffer, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

function sha256Hex(message: string): string {
  return createHash("sha256").update(message).digest("hex");
}

function formatAmzDate(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

function encodeRfc3986(input: string): string {
  return encodeURIComponent(input)
    .replace(/[!'()*]/gu, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%7E/gu, "~");
}
