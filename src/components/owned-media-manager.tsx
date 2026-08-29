"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { UploadMemberOption } from "@/lib/photos";
import type { Photo } from "@/types/domain";

type EditForm = {
  title: string;
  description: string;
  location: string;
  visibility: "class" | "private";
  downloadAllowed: boolean;
  tags: string;
  peopleIds: string[];
};

type Props = {
  media: Photo[];
  members: UploadMemberOption[];
  initialManageId?: string | null;
  onChange: (media: Photo[]) => void;
};

function createForm(photo: Photo): EditForm {
  return {
    title: photo.title,
    description: photo.description,
    location: photo.location,
    visibility: photo.visibility === "private" ? "private" : "class",
    downloadAllowed: photo.downloadAllowed,
    tags: photo.tags.join("，"),
    peopleIds: photo.people.map((person) => person.id),
  };
}

function mediaHref(photo: Photo) {
  return `${photo.mediaType === "video" ? "/videos" : "/photos"}?open=${photo.id}`;
}

function statusLabel(photo: Photo) {
  if (photo.reviewStatus === "hidden") return "已隐藏";
  if (photo.reviewStatus === "draft") return "历史草稿";
  return "展示中";
}

export function OwnedMediaManager({
  media,
  members,
  initialManageId = null,
  onChange,
}: Props) {
  const initialPhoto =
    media.find((photo) => photo.id === initialManageId) ?? null;
  const [editingId, setEditingId] = useState<string | null>(
    initialPhoto?.id ?? null,
  );
  const [form, setForm] = useState<EditForm | null>(() =>
    initialPhoto ? createForm(initialPhoto) : null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const editorRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shouldFocusEditorRef = useRef(false);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const editingPhoto =
    media.find((photo) => photo.id === editingId) ?? null;
  const isBusy = busyId !== null;

  useEffect(() => {
    if (!editingId || !shouldFocusEditorRef.current) return;

    shouldFocusEditorRef.current = false;
    const frameId = window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      titleInputRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [editingId]);

  function startEditing(photo: Photo, trigger: HTMLButtonElement) {
    editTriggerRef.current = trigger;
    shouldFocusEditorRef.current = true;
    setEditingId(photo.id);
    setForm(createForm(photo));
    setFeedback("");
    setError("");
  }

  function stopEditing() {
    const editTrigger = editTriggerRef.current;
    editTriggerRef.current = null;
    shouldFocusEditorRef.current = false;
    setEditingId(null);
    setForm(null);
    setError("");

    if (editTrigger) {
      window.requestAnimationFrame(() => {
        if (editTrigger.isConnected) editTrigger.focus();
      });
    }
  }

  function togglePerson(userId: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            peopleIds: current.peopleIds.includes(userId)
              ? current.peopleIds.filter((id) => id !== userId)
              : [...current.peopleIds, userId],
          }
        : current,
    );
  }

  async function saveChanges(event: React.FormEvent) {
    event.preventDefault();
    if (!editingPhoto || !form || busyId) return;
    setBusyId(editingPhoto.id);
    setFeedback("");
    setError("");
    try {
      const tags = form.tags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      const response = await fetch(`/api/photos/${editingPhoto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: form.title,
          description: form.description,
          location: form.location,
          visibility: form.visibility,
          downloadAllowed: form.downloadAllowed,
          tags,
          peopleIds: form.peopleIds,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "保存失败，请稍后再试。");
        return;
      }

      const approvedPeopleIds: string[] =
        result.photo?.peopleIds ?? form.peopleIds;
      onChange(
        media.map((photo) =>
          photo.id === editingPhoto.id
            ? {
                ...photo,
                title: form.title.trim(),
                description: form.description.trim(),
                location: form.location.trim(),
                visibility: form.visibility,
                downloadAllowed: form.downloadAllowed,
                tags,
                people: approvedPeopleIds.map((id) => ({
                  id,
                  name: memberNames.get(id) ?? "班级成员",
                  consentStatus: "approved" as const,
                })),
                reviewStatus:
                  result.photo?.reviewStatus ?? photo.reviewStatus,
              }
            : photo,
        ),
      );
      setFeedback("修改已保存，无需管理员审核。");
      stopEditing();
    } catch {
      setError("保存失败，请检查网络后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(
    photo: Photo,
    reviewStatus: "published" | "hidden",
  ) {
    if (busyId) return;
    setBusyId(photo.id);
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setStatus", reviewStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "状态保存失败，请稍后再试。");
        return;
      }
      onChange(
        media.map((item) =>
          item.id === photo.id ? { ...item, reviewStatus } : item,
        ),
      );
      setFeedback(
        reviewStatus === "hidden"
          ? "内容已立即隐藏，只有你和管理员可以管理。"
          : "内容已重新发布到班级相册。",
      );
    } catch {
      setError("状态保存失败，请检查网络后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteMedia(photo: Photo) {
    if (busyId) return;
    const confirmed = window.confirm(
      `永久删除“${photo.title}”？这会同时删除云端原文件，操作无法恢复。`,
    );
    if (!confirmed) return;

    setBusyId(photo.id);
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/photos/${photo.id}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "删除失败，请稍后再试。");
        return;
      }
      onChange(media.filter((item) => item.id !== photo.id));
      if (editingId === photo.id) stopEditing();
      setFeedback(result.message || "内容已永久删除。");
    } catch {
      setError("删除失败，请检查网络后重试。");
    } finally {
      setBusyId(null);
    }
  }

  if (media.length === 0) {
    return (
      <div className="profile-photo-empty">
        <span aria-hidden="true">⌁</span>
        <b>还没有上传过照片或视频</b>
        <p>上传后会立即发布，并出现在这里供你随时管理。</p>
      </div>
    );
  }

  return (
    <div className="owned-media-manager">
      {feedback ? (
        <p className="owned-media-feedback success" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="owned-media-feedback error" role="alert">
          {error}
        </p>
      ) : null}

      {editingPhoto && form ? (
        <form
          ref={editorRef}
          className="owned-media-editor"
          onSubmit={saveChanges}
          aria-busy={isBusy}
          aria-label={`编辑${editingPhoto.mediaType === "video" ? "视频" : "照片"}：${editingPhoto.title}`}
        >
          <header>
            <div>
              <small>
                编辑我的{editingPhoto.mediaType === "video" ? "视频" : "照片"}
              </small>
              <h3>{editingPhoto.title}</h3>
            </div>
            <button type="button" disabled={isBusy} onClick={stopEditing}>
              取消
            </button>
          </header>
          <div className="owned-media-editor-body">
            <div className="owned-media-editor-preview">
              <Image
                src={editingPhoto.thumbnailUrl}
                alt={editingPhoto.title}
                fill
                sizes="(max-width: 760px) calc(100vw - 64px), 260px"
                unoptimized
                suppressHydrationWarning
              />
              <span>
                {editingPhoto.mediaType === "video" ? "视频" : "照片"} ·{" "}
                {statusLabel(editingPhoto)}
              </span>
            </div>
            <div className="owned-media-editor-fields">
              <label>
                标题
                <input
                  ref={titleInputRef}
                  required
                  disabled={isBusy}
                  maxLength={100}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </label>
              <label>
                地点
                <input
                  disabled={isBusy}
                  maxLength={100}
                  value={form.location}
                  onChange={(event) =>
                    setForm({ ...form, location: event.target.value })
                  }
                />
              </label>
              <label className="owned-media-story">
                记得的事
                <textarea
                  disabled={isBusy}
                  maxLength={1000}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>
              <label className="owned-media-tags">
                标签
                <input
                  disabled={isBusy}
                  value={form.tags}
                  placeholder="教室，运动会，朋友"
                  onChange={(event) =>
                    setForm({ ...form, tags: event.target.value })
                  }
                />
              </label>
            </div>
          </div>

          <fieldset className="owned-media-visibility" disabled={isBusy}>
            <legend>谁可以看到</legend>
            <label>
              <input
                type="radio"
                name="owned-media-visibility"
                checked={form.visibility === "class"}
                onChange={() => setForm({ ...form, visibility: "class" })}
              />
              全班可见
            </label>
            <label>
              <input
                type="radio"
                name="owned-media-visibility"
                checked={form.visibility === "private"}
                onChange={() => setForm({ ...form, visibility: "private" })}
              />
              仅自己与管理员
            </label>
          </fieldset>

          <fieldset className="owned-media-people" disabled={isBusy}>
            <legend>照片或视频中的同学</legend>
            <div>
              {members.map((member) => (
                <label key={member.id}>
                  <input
                    type="checkbox"
                    checked={form.peopleIds.includes(member.id)}
                    onChange={() => togglePerson(member.id)}
                  />
                  {member.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="owned-media-download">
            <input
              type="checkbox"
              disabled={isBusy}
              checked={form.downloadAllowed}
              onChange={(event) =>
                setForm({ ...form, downloadAllowed: event.target.checked })
              }
            />
            允许同学通过下载入口获取原文件
          </label>

          <footer>
            <button type="button" disabled={isBusy} onClick={stopEditing}>
              放弃修改
            </button>
            <button
              type="submit"
              disabled={isBusy || !form.title.trim()}
            >
              {busyId === editingPhoto.id ? "保存中…" : "保存修改"}
            </button>
          </footer>
        </form>
      ) : null}

      <div className="owned-media-grid">
        {media.map((photo, index) => {
          const published = photo.reviewStatus === "published";
          const busy = busyId === photo.id;
          return (
            <article className="owned-media-card" key={photo.id}>
              <div className="owned-media-thumb">
                <Image
                  src={photo.thumbnailUrl}
                  alt={photo.title}
                  fill
                  sizes="(max-width: 560px) calc(100vw - 64px), (max-width: 900px) 42vw, 280px"
                  unoptimized
                  loading={index < 2 ? "eager" : "lazy"}
                  suppressHydrationWarning
                />
                <span className={photo.reviewStatus}>
                  {photo.mediaType === "video" ? "视频" : "照片"} ·{" "}
                  {statusLabel(photo)}
                </span>
              </div>
              <div className="owned-media-copy">
                <h3>{photo.title}</h3>
                <p>⌖ {photo.location || "地点未填写"}</p>
              </div>
              <div className="owned-media-actions">
                {published ? (
                  isBusy ? (
                    <span aria-disabled="true">查看</span>
                  ) : (
                    <Link href={mediaHref(photo)}>查看</Link>
                  )
                ) : (
                  <span>未在公共媒体墙展示</span>
                )}
                {isBusy ? (
                  <span aria-disabled="true">原文件</span>
                ) : (
                  <a href={`/api/photos/${photo.id}/download`}>原文件</a>
                )}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(event) => startEditing(photo, event.currentTarget)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    setStatus(photo, published ? "hidden" : "published")
                  }
                >
                  {busy
                    ? "处理中…"
                    : published
                      ? "隐藏"
                      : "重新发布"}
                </button>
                <button
                  className="danger"
                  type="button"
                  disabled={isBusy}
                  onClick={() => deleteMedia(photo)}
                >
                  永久删除
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
