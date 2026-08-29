import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { DEMO_MODE } from "@/lib/config";
import { MOCK_INVITE_CODES } from "@/lib/demo-invites";
import {
  decryptInviteCode,
  hashInviteCode,
  safeHashEquals,
} from "@/lib/security/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
};

function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getApiAdmin();
  if (!admin) return privateJson({ error: "无权查看邀请口令。" }, 403);

  const id = (await params).id;
  if (DEMO_MODE) {
    const code = MOCK_INVITE_CODES[id];
    return code
      ? privateJson({ code })
      : privateJson({ error: "没有找到这个邀请。" }, 404);
  }

  if (!idSchema.safeParse(id).success) {
    return privateJson({ error: "没有找到这个邀请。" }, 404);
  }

  const supabase = await createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("invite_codes")
    .select("code_ciphertext,code_hash")
    .eq("id", id)
    .maybeSingle();

  if (error) return privateJson({ error: "读取邀请口令失败。" }, 500);
  if (!data) return privateJson({ error: "没有找到这个邀请。" }, 404);
  if (!data.code_ciphertext) {
    return privateJson(
      { error: "这个历史邀请只保留不可逆哈希，无法恢复原口令。请创建新邀请。" },
      409,
    );
  }

  const code = decryptInviteCode(String(data.code_ciphertext));
  if (!code) return privateJson({ error: "邀请口令暂时无法解密，请创建新邀请。" }, 500);
  if (!safeHashEquals(hashInviteCode(code), String(data.code_hash))) {
    return privateJson({ error: "邀请口令校验失败，请创建新邀请。" }, 500);
  }
  return privateJson({ code });
}
