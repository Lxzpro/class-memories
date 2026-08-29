"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { UserAvatar } from "@/components/user-avatar";
import type { Photo } from "@/types/domain";

const reasons = ["不想公开", "不喜欢这份内容", "涉及个人隐私", "其他"] as const;

type Props = {
  photo: Photo;
  onClose: () => void;
};

export function PrivacyRequestDialog({ photo, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<"hide" | "delete">("hide");
  const [reason, setReason] = useState<(typeof reasons)[number]>(reasons[0]);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [feedback, setFeedback] = useState("");
  const sendingRef = useRef(false);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!sendingRef.current) onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), input:not([disabled])',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [onClose]);

  useEffect(() => {
    if (state !== "sent") return;
    const frame = window.requestAnimationFrame(() => completeRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingRef.current) return;
    sendingRef.current = true;
    setState("sending");
    setFeedback("");
    const message = note.trim() ? `${reason}：${note.trim()}` : reason;

    try {
      const response = await fetch("/api/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId: photo.id, kind, message }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        sendingRef.current = false;
        setState("error");
        setFeedback(result.error || "申请提交失败，请稍后再试。");
        return;
      }

      sendingRef.current = false;
      setState("sent");
      window.dispatchEvent(new CustomEvent("privacy-request-created"));
      setFeedback(
        kind === "delete"
          ? "删除申请已提交。管理员确认后会永久删除内容和云端文件。"
          : "隐藏申请已提交。管理员接受后会先从班级相册隐藏，可在后台恢复。",
      );
    } catch {
      sendingRef.current = false;
      setState("error");
      setFeedback("网络连接失败，请稍后再试。");
    }
  }

  return (
    <div
      className="privacy-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && state !== "sending") onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="privacy-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-dialog-title"
      >
        <header>
          <div>
            <small>CONTENT PRIVACY</small>
            <h2 id="privacy-dialog-title">申请处理此内容</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={state === "sending"}
            aria-label="关闭申请面板"
          >
            ×
          </button>
        </header>

        <div className="privacy-dialog-media">
          <div>
            <Image
              src={photo.thumbnailUrl}
              alt={photo.title}
              fill
              sizes="112px"
              unoptimized
              suppressHydrationWarning
            />
            {photo.mediaType === "video" && <span>视频</span>}
          </div>
          <div>
            <b>{photo.title}</b>
            <span>
              <UserAvatar
                user={{
                  id: photo.uploadedBy,
                  displayName: photo.uploaderName,
                  email: "",
                  avatarKey: null,
                }}
                size={26}
                className="privacy-dialog-uploader-avatar"
                avatarEndpoint={`/api/members/${encodeURIComponent(photo.uploadedBy)}/avatar`}
                alwaysTryRemote
                listenForUpdates={false}
              />
              由 {photo.uploaderName} 上传
            </span>
          </div>
        </div>

        {state === "sent" ? (
          <div className="privacy-dialog-success" role="status">
            <span aria-hidden="true">✓</span>
            <b>申请已经记录</b>
            <p>{feedback}</p>
            <button ref={completeRef} type="button" onClick={onClose}>完成</button>
          </div>
        ) : (
          <form onSubmit={submit} aria-busy={state === "sending"}>
            <fieldset className="privacy-dialog-kinds">
              <legend>希望如何处理？</legend>
              <label className={kind === "hide" ? "active" : ""}>
                <input
                  type="radio"
                  name="privacy-dialog-kind"
                  checked={kind === "hide"}
                  onChange={() => setKind("hide")}
                />
                <span><b>先隐藏</b><small>从班级相册隐藏，之后可以恢复</small></span>
              </label>
              <label className={kind === "delete" ? "active" : ""}>
                <input
                  type="radio"
                  name="privacy-dialog-kind"
                  checked={kind === "delete"}
                  onChange={() => setKind("delete")}
                />
                <span><b>永久删除</b><small>管理员确认后删除内容与云端文件</small></span>
              </label>
            </fieldset>

            <fieldset className="privacy-dialog-reasons">
              <legend>选择原因</legend>
              <div>
                {reasons.map((item) => (
                  <label className={reason === item ? "active" : ""} key={item}>
                    <input
                      type="radio"
                      name="privacy-dialog-reason"
                      checked={reason === item}
                      onChange={() => setReason(item)}
                    />
                    {item}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="privacy-dialog-note">
              <span>补充说明 <small>选填</small></span>
              <textarea
                value={note}
                maxLength={Math.max(0, 499 - reason.length)}
                onChange={(event) => setNote(event.target.value)}
                placeholder="可以简单说明情况，只有你和管理员能看到。"
              />
              <small>{note.length} / {Math.max(0, 499 - reason.length)}</small>
            </label>

            {feedback && <p className="privacy-dialog-feedback" role="alert">{feedback}</p>}
            <div className="privacy-dialog-actions">
              <button type="button" onClick={onClose} disabled={state === "sending"}>取消</button>
              <button type="submit" disabled={state === "sending"}>
                {state === "sending" ? "正在提交…" : "提交给管理员"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
