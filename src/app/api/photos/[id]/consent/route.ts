export async function POST() {
  return Response.json(
    { error: "人物确认流程已取消，上传内容无需二次确认。" },
    { status: 410 },
  );
}
