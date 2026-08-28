import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getApiAdmin();
  if (!admin)
    return Response.json({ error: "无权删除成员。" }, { status: 403 });

  const id = (await params).id;
  if (id === admin.id)
    return Response.json(
      { error: "不能删除当前登录的管理员账号。" },
      { status: 400 },
    );

  if (DEMO_MODE) {
    return Response.json({
      ok: true,
      newOwnerId: admin.id,
      reassignedPhotoCount: 0,
    });
  }

  const supabase = await createSupabaseAdminClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id,display_name,role,status")
    .eq("id", id)
    .maybeSingle();

  if (targetError)
    return Response.json({ error: "读取成员资料失败。" }, { status: 500 });
  if (!target)
    return Response.json({ error: "成员不存在。" }, { status: 404 });
  if (target.role !== "member")
    return Response.json(
      { error: "管理员账号不能在成员列表中删除。" },
      { status: 400 },
    );

  const { data: reassignedPhotos, error: reassignError } = await supabase
    .from("photos")
    .update({ uploaded_by: admin.id })
    .eq("uploaded_by", id)
    .select("id");

  if (reassignError)
    return Response.json(
      { error: "转交该成员上传的照片失败，账号尚未删除。" },
      { status: 500 },
    );

  const photoIds = (reassignedPhotos ?? []).map((photo) => String(photo.id));
  const { error: deleteError } = await supabase.auth.admin.deleteUser(id);

  if (deleteError) {
    if (photoIds.length > 0) {
      await supabase
        .from("photos")
        .update({ uploaded_by: id })
        .in("id", photoIds);
    }
    return Response.json(
      { error: "删除账号失败，请稍后重试。" },
      { status: 500 },
    );
  }

  await writeAdminLog(admin.id, "member_deleted", "profile", id, {
    displayName: target.display_name,
    previousStatus: target.status,
    reassignedPhotoCount: photoIds.length,
  });

  return Response.json({
    ok: true,
    newOwnerId: admin.id,
    reassignedPhotoCount: photoIds.length,
  });
}
