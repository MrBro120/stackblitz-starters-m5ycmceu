import { NextResponse } from "next/server";
import { getR2Config, presignUrl } from "@/lib/r2";
import { getCallerFromRequest, userOwnsProperty } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    const caller = await getCallerFromRequest(request);

    if (!caller) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const propertyId = String(body.propertyId || "");
    const contentType = String(body.contentType || "");
    const size = Number(body.size || 0);

    if (!/^[A-Za-z0-9-]{8,64}$/.test(propertyId)) {
      return NextResponse.json({ error: "Invalid property." }, { status: 400 });
    }

    const extension = EXTENSIONS[contentType];

    if (!extension) {
      return NextResponse.json(
        { error: "Only JPG, PNG or WEBP photos are allowed." },
        { status: 400 }
      );
    }

    if (!size || size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Each photo must be 5 MB or smaller." },
        { status: 400 }
      );
    }

    const owns = await userOwnsProperty(
      caller.userClient,
      caller.user.id,
      propertyId
    );

    if (!owns) {
      return NextResponse.json(
        { error: "You can only add photos to your own properties." },
        { status: 403 }
      );
    }

    const r2 = getR2Config();
    const key = `${propertyId}/${crypto.randomUUID()}.${extension}`;

    const uploadUrl = presignUrl({
      method: "PUT",
      host: r2.host,
      path: `/${r2.bucket}/${key}`,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      expiresSeconds: 300,
      signedHeaders: { "content-type": contentType },
    });

    return NextResponse.json({
      uploadUrl,
      storagePath: `r2/${key}`,
    });
  } catch (error) {
    console.error("upload-url error:", error);
    return NextResponse.json(
      { error: "Could not prepare the photo upload." },
      { status: 500 }
    );
  }
}
