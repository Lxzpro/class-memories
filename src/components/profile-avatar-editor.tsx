"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { prepareAvatar, validateAvatarFile } from "@/lib/client-media";
import {
  AVATAR_INPUT_ACCEPT,
  AVATAR_UPDATED_EVENT,
  qqNumberFromEmail,
} from "@/lib/profile-avatars";
import type { Profile } from "@/types/domain";

type State = "idle" | "preparing" | "uploading" | "saving" | "resetting";

function broadcastAvatar(
  userId: string,
  hasCustom: boolean,
  previewUrl?: string | null,
) {
  window.dispatchEvent(
    new CustomEvent(AVATAR_UPDATED_EVENT, {
      detail: { userId, hasCustom, version: String(Date.now()), previewUrl },
    }),
  );
}

export function ProfileAvatarEditor({ user }: { user: Profile }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>("idle");
  const [hasCustom, setHasCustom] = useState(Boolean(user.avatarKey));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const busy = state !== "idle";
  const hasQqDefault = Boolean(qqNumberFromEmail(user.email));

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function showMessage(kind: "success" | "error", text: string) {
    setMessageKind(kind);
    setMessage(text);
  }

  async function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      showMessage("error", validationError);
      return;
    }

    let signedKey = "";
    let saved = false;
    setState("preparing");
    setMessage("");
    try {
      const avatar = await prepareAvatar(file);
      const localPreviewUrl = URL.createObjectURL(avatar);
      setPreviewUrl(localPreviewUrl);
      setState("uploading");

      const signResponse = await fetch("/api/profile/avatar/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: avatar.type, size: avatar.size }),
      });
      const signed = await signResponse.json().catch(() => ({}));
      if (!signResponse.ok || typeof signed.key !== "string" || typeof signed.uploadUrl !== "string") {
        throw new Error(signed.error || "无法创建安全上传链接");
      }
      signedKey = signed.key;

      const uploadResponse = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/webp" },
        body: avatar,
      });
      if (!uploadResponse.ok) throw new Error("头像上传失败，请检查网络后重试");

      setState("saving");
      const saveResponse = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarKey: signedKey }),
      });
      const result = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(result.error || "保存头像失败");

      saved = true;
      setHasCustom(true);
      broadcastAvatar(user.id, true, localPreviewUrl);
      showMessage("success", "头像已更新");
      router.refresh();
    } catch (error) {
      setPreviewUrl(null);
      showMessage(
        "error",
        error instanceof Error ? error.message : "头像更新失败，请稍后重试",
      );
    } finally {
      if (signedKey && !saved) {
        void fetch("/api/profile/avatar/sign", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: signedKey }),
        }).catch(() => undefined);
      }
      setState("idle");
    }
  }

  async function resetAvatar() {
    setState("resetting");
    setMessage("");
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "恢复默认头像失败");
      setPreviewUrl(null);
      setHasCustom(false);
      broadcastAvatar(user.id, false);
      showMessage(
        "success",
        hasQqDefault ? "已恢复为 QQ 头像" : "已恢复为姓名首字头像",
      );
      router.refresh();
    } catch (error) {
      showMessage(
        "error",
        error instanceof Error ? error.message : "恢复默认头像失败",
      );
    } finally {
      setState("idle");
    }
  }

  const workingLabel = {
    idle: "更换头像",
    preparing: "正在处理…",
    uploading: "正在上传…",
    saving: "正在保存…",
    resetting: "正在恢复…",
  }[state];

  return (
    <div className="profile-avatar-editor">
      <button
        type="button"
        className="profile-avatar-trigger"
        aria-label="更换头像"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
      >
        <UserAvatar
          user={user}
          className="profile-reference-avatar"
          size={136}
          sourceOverride={previewUrl}
          forceHasCustom={hasCustom}
        />
        <span className="profile-avatar-camera" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M8.5 6 10 4h4l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5Z" />
            <circle cx="12" cy="12.5" r="3.5" />
          </svg>
        </span>
      </button>
      <input
        ref={fileInput}
        className="profile-avatar-input"
        type="file"
        accept={AVATAR_INPUT_ACCEPT}
        onChange={chooseAvatar}
        disabled={busy}
      />
      <div className="profile-avatar-actions">
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          {workingLabel}
        </button>
        {hasCustom && (
          <button type="button" disabled={busy} onClick={resetAvatar}>
            恢复默认
          </button>
        )}
      </div>
      <small>
        {hasQqDefault && !hasCustom
          ? "当前使用 QQ 头像"
          : "头像仅在班级相册内展示"}
      </small>
      {message && (
        <p className={`profile-avatar-feedback ${messageKind}`} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
