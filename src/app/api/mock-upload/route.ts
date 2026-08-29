import { DEMO_MODE } from "@/lib/config";
import {
  MAX_VIDEO_FILE_SIZE,
  MAX_VIDEO_FILE_SIZE_MB,
} from "@/lib/media-limits";

export async function PUT(request: Request) {
  if (!DEMO_MODE) return Response.json({ error: "Not found" }, { status: 404 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_VIDEO_FILE_SIZE) {
    return Response.json(
      { error: `文件不能超过 ${MAX_VIDEO_FILE_SIZE_MB}MB` },
      { status: 413 },
    );
  }
  await request.arrayBuffer();
  return new Response(null, { status: 204 });
}
