import { DEMO_MODE } from "@/lib/config";

export async function PUT(request: Request) {
  if (!DEMO_MODE) return Response.json({ error: "Not found" }, { status: 404 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 25 * 1024 * 1024) return Response.json({ error: "文件不能超过 25MB" }, { status: 413 });
  await request.arrayBuffer();
  return new Response(null, { status: 204 });
}
