// Server-side helper for Cloudflare R2 (S3 compatible).
// Signs requests with AWS Signature V4 using only Node's built-in crypto,
// so no extra packages are needed. NEVER import this file in client code.
import { createHash, createHmac } from "crypto";

function sha256Hex(data: string) {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data).digest();
}

// AWS-style URI encoding (encode everything except A-Z a-z 0-9 - _ . ~)
function uriEncode(value: string, encodeSlash = true) {
  let out = "";
  for (const byte of Buffer.from(value, "utf8")) {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-_.~]/.test(ch)) {
      out += ch;
    } else if (ch === "/" && !encodeSlash) {
      out += "/";
    } else {
      out += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

export type PresignInput = {
  method: "GET" | "PUT" | "DELETE";
  host: string;
  path: string; // e.g. /bucket/folder/file.jpg (not yet encoded)
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  expiresSeconds?: number;
  signedHeaders?: Record<string, string>; // besides host
  now?: Date;
};

// Builds a presigned URL (query-string signing).
export function presignUrl(input: PresignInput): string {
  const region = input.region || "auto";
  const expires = input.expiresSeconds || 300;
  const now = input.now || new Date();

  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;

  const headers: Record<string, string> = {
    host: input.host,
  };
  for (const [k, v] of Object.entries(input.signedHeaders || {})) {
    headers[k.toLowerCase()] = v.trim();
  }

  const headerNames = Object.keys(headers).sort();
  const signedHeaders = headerNames.join(";");
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join("");

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${input.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders,
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join("&");

  const canonicalPath = uriEncode(input.path, false);

  const canonicalRequest = [
    input.method,
    canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac("AWS4" + input.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");

  return `https://${input.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Your Cloudflare account ID is not a secret (it is in your dashboard address).
const DEFAULT_ACCOUNT_ID = "20ee7ef1381a11d28f281eebb8366e3a";
const DEFAULT_BUCKET = "property-images";

export function getR2Config() {
  // Trim hidden spaces / line breaks that often come with copy-paste.
  const envAccountId = (process.env.R2_ACCOUNT_ID || "").trim();
  const accountId = /^[0-9a-f]{32}$/i.test(envAccountId)
    ? envAccountId.toLowerCase()
    : DEFAULT_ACCOUNT_ID;

  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.R2_BUCKET || "").trim() || DEFAULT_BUCKET;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Image storage is not configured on the server.");
  }

  return {
    host: `${accountId}.r2.cloudflarestorage.com`,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}
