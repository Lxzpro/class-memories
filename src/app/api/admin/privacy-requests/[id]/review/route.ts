import { z } from "zod";
import { getApiAdmin } from "@/lib/api-auth";
import { writeAdminLog } from "@/lib/admin-audit";
import { DEMO_MODE } from "@/lib/config";
import { getStorageAdapter } from "@/lib/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const schema = z.object({ status: z.enum(["resolved", "rejected"]) });
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

type AdminClient = Awaited<ReturnType<typeof createSupabaseAdminClient>>;

async function releaseClaim(
  supabase: AdminClient,
  requestId: string,
  adminId: string,
  claimToken: string,
) {
  const { error } = await supabase
    .from("privacy_requests")
    .update({
      processing_at: null,
      processing_by: null,
      processing_token: null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .eq("processing_by", adminId)
    .eq("processing_token", claimToken);
  if (error) {
    console.error("privacy_request_claim_release_failed", {
      requestId,
      reason: error.code ?? "unknown",
    });
  }
}

async function ownsClaim(
  supabase: AdminClient,
  requestId: string,
  adminId: string,
  claimToken: string,
) {
  const { data, error } = await supabase
    .from("privacy_requests")
    .select("id")
    .eq("id", requestId)
    .eq("status", "pending")
    .eq("processing_by", adminId)
    .eq("processing_token", claimToken)
    .maybeSingle();
  return { owned: Boolean(data), error };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getApiAdmin();
  if (!admin) {
    return Response.json({ error: "无权处理隐私申请。" }, { status: 403 });
  }

  const id = (await params).id;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "处理状态无效。" }, { status: 400 });
  }

  let photoId: string | null = null;
  let kind: "hide" | "delete" | null = null;
  let effect: "none" | "hidden" | "deleted" = "none";

  if (!DEMO_MODE) {
    const supabase = await createSupabaseAdminClient();
    const claimedAt = new Date().toISOString();
    const claimToken = crypto.randomUUID();
    const staleBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();
    const { data: privacyRequest, error: claimError } = await supabase
      .from("privacy_requests")
      .update({
        processing_at: claimedAt,
        processing_by: admin.id,
        processing_token: claimToken,
      })
      .eq("id", id)
      .eq("status", "pending")
      .or(`processing_at.is.null,processing_at.lt.${staleBefore}`)
      .select("photo_id,kind,status")
      .maybeSingle();

    if (claimError) {
      return Response.json(
        { error: "隐私申请暂时无法开始处理。" },
        { status: 500 },
      );
    }
    if (!privacyRequest) {
      return Response.json(
        { error: "申请正在由其他管理员处理，或已经处理完成。" },
        { status: 409 },
      );
    }

    photoId = privacyRequest.photo_id
      ? String(privacyRequest.photo_id)
      : null;
    kind = privacyRequest.kind;

    if (parsed.data.status === "resolved" && kind === "hide") {
      if (!photoId) {
        await releaseClaim(supabase, id, admin.id, claimToken);
        return Response.json(
          { error: "申请涉及的内容已不存在。" },
          { status: 404 },
        );
      }
      const activeClaim = await ownsClaim(
        supabase,
        id,
        admin.id,
        claimToken,
      );
      if (activeClaim.error || !activeClaim.owned) {
        await releaseClaim(supabase, id, admin.id, claimToken);
        return Response.json(
          {
            error: activeClaim.error
              ? "处理状态确认失败，请稍后重试。"
              : "本次处理租约已失效，请刷新后重试。",
          },
          { status: activeClaim.error ? 500 : 409 },
        );
      }
      const { data: hiddenPhoto, error: hideError } = await supabase
        .from("photos")
        .update({ review_status: "hidden" })
        .eq("id", photoId)
        .neq("review_status", "deleted")
        .select("id")
        .maybeSingle();
      if (hideError || !hiddenPhoto) {
        await releaseClaim(supabase, id, admin.id, claimToken);
        return Response.json(
          { error: hideError ? "内容暂时隐藏失败。" : "申请涉及的内容已不存在。" },
          { status: hideError ? 500 : 404 },
        );
      }
      effect = "hidden";
    }

    if (parsed.data.status === "resolved" && kind === "delete") {
      if (photoId) {
        const { data: photo, error: photoError } = await supabase
          .from("photos")
          .select("id,original_key,preview_key,thumbnail_key")
          .eq("id", photoId)
          .maybeSingle();
        if (photoError) {
          await releaseClaim(supabase, id, admin.id, claimToken);
          return Response.json(
            { error: "内容资料读取失败。" },
            { status: 500 },
          );
        }

        if (photo) {
          const activeClaim = await ownsClaim(
            supabase,
            id,
            admin.id,
            claimToken,
          );
          if (activeClaim.error || !activeClaim.owned) {
            await releaseClaim(supabase, id, admin.id, claimToken);
            return Response.json(
              {
                error: activeClaim.error
                  ? "处理状态确认失败，请稍后重试。"
                  : "本次处理租约已失效，请刷新后重试。",
              },
              { status: activeClaim.error ? 500 : 409 },
            );
          }
          const { data: hiddenPhoto, error: hideError } = await supabase
            .from("photos")
            .update({ review_status: "hidden" })
            .eq("id", photoId)
            .select("id")
            .maybeSingle();
          if (hideError || !hiddenPhoto) {
            await releaseClaim(supabase, id, admin.id, claimToken);
            return Response.json(
              { error: "内容暂时隐藏失败，尚未删除任何云端文件。" },
              { status: 500 },
            );
          }

          const storageKeys = [
            photo.original_key,
            photo.preview_key,
            photo.thumbnail_key,
          ].filter(
            (key): key is string =>
              typeof key === "string" && key.length > 0,
          );

          try {
            await getStorageAdapter().deleteObjects(storageKeys);
          } catch (error) {
            await releaseClaim(supabase, id, admin.id, claimToken);
            console.error("privacy_request_storage_cleanup_failed", {
              requestId: id,
              mediaId: photoId,
              objectCount: storageKeys.length,
              reason: error instanceof Error ? error.name : "unknown",
            });
            await writeAdminLog(
              admin.id,
              "privacy_request_storage_cleanup_failed",
              "privacy_request",
              id,
              {
                photoId,
                kind,
                storageKeys,
                retryable: true,
              },
            );
            return Response.json(
              {
                error: "云端文件清理失败，内容已先隐藏；请稍后安全重试。",
                storageCleanupPending: true,
              },
              { status: 502 },
            );
          }

          const { data: deletedPhoto, error: deleteError } = await supabase
            .from("photos")
            .delete()
            .eq("id", photoId)
            .select("id")
            .maybeSingle();
          if (deleteError || !deletedPhoto) {
            await releaseClaim(supabase, id, admin.id, claimToken);
            await writeAdminLog(
              admin.id,
              "privacy_request_database_delete_failed",
              "privacy_request",
              id,
              {
                photoId,
                kind,
                storageAlreadyDeleted: true,
                retryable: true,
              },
            );
            return Response.json(
              {
                error:
                  "云端文件已清理，但数据库记录删除失败；内容仍保持隐藏，请稍后重试。",
              },
              { status: deleteError ? 500 : 409 },
            );
          }
        }
      }
      effect = "deleted";
    }

    const { data: resolvedRequest, error: statusError } = await supabase
      .from("privacy_requests")
      .update({
        status: parsed.data.status,
        resolved_at: new Date().toISOString(),
        processing_at: null,
        processing_by: null,
        processing_token: null,
      })
      .eq("id", id)
      .eq("status", "pending")
      .eq("processing_by", admin.id)
      .eq("processing_token", claimToken)
      .select("id")
      .maybeSingle();

    if (statusError || !resolvedRequest) {
      await releaseClaim(supabase, id, admin.id, claimToken);
      console.error("privacy_request_status_update_failed", {
        requestId: id,
        mediaId: photoId,
        effect,
        reason: statusError?.code ?? "claim_lost",
      });
      await writeAdminLog(
        admin.id,
        "privacy_request_status_update_failed",
        "privacy_request",
        id,
        { photoId, kind, effect },
      );
      return Response.json(
        { error: "内容已处理，但申请状态保存失败，请刷新后重试。" },
        { status: statusError ? 500 : 409 },
      );
    }
  } else if (parsed.data.status === "resolved") {
    effect = "hidden";
  }

  await writeAdminLog(
    admin.id,
    `privacy_request_${parsed.data.status}`,
    "privacy_request",
    id,
    {
      photoId,
      kind,
      effect,
      photoHidden: effect === "hidden",
      photoDeleted: effect === "deleted",
    },
  );

  return Response.json({
    ok: true,
    effect,
    photoHidden: effect === "hidden",
    photoDeleted: effect === "deleted",
    storageCleanupPending: false,
  });
}
