import { randomUUID } from "node:crypto";
import { getApiMember } from "@/lib/api-auth";
import {
  avatarKeyBelongsToUser,
  avatarUploadSignSchema,
  createAvatarKey,
} from "@/lib/profile-avatars";
import { getStorageAdapter } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getApiMember();
  if (!user) {
    return Response.json(
      { error: "只有已通过审核的班级成员可以设置头像。" },
      { status: 401 },
    );
  }

  const parsed = avatarUploadSignSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: "头像处理失败，请选择 10MB 内的 JPG、PNG 或 WebP 图片。" },
      { status: 400 },
    );
  }

  const key = createAvatarKey(user.id, randomUUID());
  const uploadUrl = await getStorageAdapter().createUploadUrl({
    key,
    contentType: parsed.data.type,
    contentLength: parsed.data.size,
  });

  return Response.json({ key, uploadUrl });
}

export async function DELETE(request: Request) {
  const user = await getApiMember();
  if (!user) return Response.json({ error: "请先登录。" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const key =
    body && typeof body === "object" && "key" in body
      ? String(body.key)
      : "";
  if (!avatarKeyBelongsToUser(user.id, key)) {
    return Response.json({ error: "头像文件不属于当前账号。" }, { status: 400 });
  }

  await getStorageAdapter().deleteObjects([key]);
  return Response.json({ ok: true });
}
