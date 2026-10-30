import { NextResponse } from "next/server";
import { getR2Config, presignUrl } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Health check for Cloudflare R2. Shows NO secret values, only whether they
// look right. 404 + NoSuchKey means everything is working.
export async function GET() {
  const result: Record<string, unknown> = {
    publicUrlSet: !!(process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").trim(),
  };

  try {
    const r2 = getR2Config();

    result.host = r2.host;
    result.bucket = r2.bucket;
    result.accessKeyIdLength = r2.accessKeyId.length; // should be 32
    result.secretKeyLength = r2.secretAccessKey.length; // should be 64

    const url = presignUrl({
      method: "GET",
      host: r2.host,
      path: `/${r2.bucket}/healthcheck.txt`,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      expiresSeconds: 60,
    });

    try {
      const response = await fetch(url);
      const text = await response.text();
      result.r2Status = response.status;
      result.r2Code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] || null;
    } catch (error) {
      const err = error as { message?: string; cause?: { code?: string } };
      result.r2Error = err.message || "fetch failed";
      result.r2ErrorCode = err.cause?.code || null;
    }
  } catch (error) {
    result.configError =
      error instanceof Error ? error.message : "Config problem";
  }

  return NextResponse.json(result);
}
