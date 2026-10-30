import { NextResponse } from "next/server";
import { getR2Config, presignUrl } from "@/lib/r2";
import { getCallerFromRequest, userOwnsProperty } from "@/lib/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const storagePaths: string[] = Array.isArray(body.storagePaths)
      ? body.storagePaths.map((p: unknown) => String(p))
      : [];

    if (storagePaths.length === 0 || storagePaths.length > 20) {
      return NextResponse.json({ error: "Nothing to delete." }, { status: 400 });
    }

    const r2 = getR2Config();

    for (const storagePath of storagePaths) {
      const match = /^r2\/([A-Za-z0-9-]{8,64})\/([A-Za-z0-9-]+\.(jpg|png|webp))$/.exec(
        storagePath
      );

      if (!match) {
        return NextResponse.json({ error: "Invalid photo." }, { status: 400 });
      }

      const propertyId = match[1];
      const key = `${propertyId}/${match[2]}`;

      const owns = await userOwnsProperty(
        caller.userClient,
        caller.user.id,
        propertyId
      );

      if (!owns) {
        return NextResponse.json(
          { error: "You can only remove photos from your own properties." },
          { status: 403 }
        );
      }

      const deleteUrl = presignUrl({
        method: "DELETE",
        host: r2.host,
        path: `/${r2.bucket}/${key}`,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        expiresSeconds: 60,
      });

      const response = await fetch(deleteUrl, { method: "DELETE" });

      if (!response.ok && response.status !== 404) {
        return NextResponse.json(
          { error: "Could not remove the photo file." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete error:", error);
    return NextResponse.json(
      { error: "Could not remove the photo." },
      { status: 500 }
    );
  }
}
