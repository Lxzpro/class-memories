"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminOverview } from "@/components/admin-overview";
import type { AdminDashboardData, AdminInviteView } from "@/lib/admin-data";
import { MEDIA_INPUT_ACCEPT, mediaTypeForFile, prepareMedia, validateMediaFile } from "@/lib/client-media";
import type { MediaType, Photo, PhotoVisibility, Profile } from "@/types/domain";

type Tab = "overview" | "upload" | "photos" | "members" | "invites" | "logs";
type QueueItem = {
  id: string;
  file: File;
  mediaType: MediaType;
  preview: string;
  title: string;
  location: string;
  tags: string;
  peopleIds: string[];
  visibility: PhotoVisibility;
  progress: number;
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
  retryable?: boolean;
};
type InviteCodeState = {
  code?: string;
  loading?: boolean;
  error?: string;
  copied?: boolean;
};
const tabLabels: Record<Tab, string> = {
  overview: "班级回忆管理",
  upload: "批量上传",
  photos: "媒体管理",
  members: "成员审核",
  invites: "邀请口令",
  logs: "操作记录",
};

export function AdminDashboard({
  initialData,
  initialTab = "overview",
  demoMode = false,
  adminName = "管理员",
}: {
  initialData: AdminDashboardData;
  initialTab?: string;
  demoMode?: boolean;
  adminName?: string;
}) {
  const tab = initialTab as Tab;
  const [photos, setPhotos] = useState(initialData.photos);
  const [members, setMembers] = useState(initialData.members);
  const [invites, setInvites] = useState(initialData.invites);
  const [privacyRequests, setPrivacyRequests] = useState(
    initialData.privacyRequests,
  );
  const [accessPhotoId, setAccessPhotoId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [inviteCodeStates, setInviteCodeStates] = useState<
    Record<string, InviteCodeState>
  >({});
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteCreateError, setInviteCreateError] = useState("");
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState({ validDays: 7, maxUses: 10 });
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const approvedCount = members.filter(
    (member) => member.status === "approved",
  ).length;
  const pendingCount = members.filter(
    (member) => member.status === "pending",
  ).length;
  const publishedCount = photos.filter(
    (photo) => photo.reviewStatus === "published",
  ).length;
  const draftCount = photos.filter(
    (photo) => photo.reviewStatus === "draft",
  ).length;
  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName])),
    [members],
  );
  const approvedMembers = useMemo(
    () => members.filter((member) => member.status === "approved"),
    [members],
  );
  const pendingPrivacyCount = privacyRequests.filter(
    (request) => request.status === "pending",
  ).length;

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    [],
  );

  function addFiles(files: FileList | null) {
    if (!files) return;
    const items = Array.from(files).map(
      (file): QueueItem => {
        const mediaType = mediaTypeForFile(file);
        const error = validateMediaFile(file);
        const preview = URL.createObjectURL(file);
        objectUrls.current.add(preview);
        return {
          id: crypto.randomUUID(),
          file,
          mediaType: mediaType ?? "photo",
          preview,
          title: file.name.replace(/\.[^.]+$/, ""),
          location: "",
          tags: "",
          peopleIds: [],
          visibility: "class",
          progress: 0,
          status: error ? "error" : "ready",
          error: error ?? undefined,
        };
      },
    );
    setQueue((current) => [...current, ...items]);
  }

  function updateQueue(id: string, update: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  async function uploadItem(item: QueueItem) {
    if (item.status === "error" && !item.retryable) return;
    updateQueue(item.id, {
      status: "uploading",
      progress: 8,
      error: undefined,
    });
    try {
      const prepared = await prepareMedia(item.file);
      const { width, height, preview, thumbnail, mediaType } = prepared;
      updateQueue(item.id, { progress: 20 });
      const signResponse = await fetch("/api/admin/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.file.name,
          type: item.file.type,
          size: item.file.size,
          previewSize: preview.size,
          thumbnailSize: thumbnail.size,
        }),
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) throw new Error(signed.error || "无法创建上传链接");
      updateQueue(item.id, { progress: 35 });
      await Promise.all(
        [
          fetch(signed.urls.original, {
            method: "PUT",
            headers: { "Content-Type": item.file.type },
            body: item.file,
          }),
          fetch(signed.urls.preview, {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: preview,
          }),
          fetch(signed.urls.thumbnail, {
            method: "PUT",
            headers: { "Content-Type": "image/webp" },
            body: thumbnail,
          }),
        ].map(async (promise) => {
          const response = await promise;
          if (!response.ok) throw new Error("文件上传失败");
        }),
      );
      updateQueue(item.id, { progress: 82 });
      const metadata = {
        id: signed.photoId,
        title: item.title || "未命名回忆",
        description: "",
        location: item.location,
        width,
        height,
        mediaType,
        visibility: item.visibility,
        downloadAllowed: false,
        originalKey: signed.keys.original,
        previewKey: signed.keys.preview,
        thumbnailKey: signed.keys.thumbnail,
        peopleIds: item.peopleIds,
        tags: item.tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      const saveResponse = await fetch("/api/admin/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error || "媒体资料保存失败");
      updateQueue(item.id, { status: "done", progress: 100 });
    } catch (reason) {
      updateQueue(item.id, {
        status: "error",
        retryable: true,
        error: reason instanceof Error ? reason.message : "上传失败",
      });
    }
  }

  async function uploadAll() {
    for (const item of queue.filter((current) => current.status === "ready"))
      await uploadItem(item);
  }

  async function reviewMember(id: string, status: "approved" | "rejected") {
    const response = await fetch(`/api/admin/members/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (response.ok)
      setMembers((current) =>
        current.map((member) =>
          member.id === id ? { ...member, status } : member,
        ),
      );
  }

  function toggleQueuePerson(itemId: string, userId: string) {
    setQueue((current) => current.map((item) => item.id === itemId ? {
      ...item,
      peopleIds: item.peopleIds.includes(userId)
        ? item.peopleIds.filter((id) => id !== userId)
        : [...item.peopleIds, userId],
    } : item));
  }

  async function deleteMember(member: Profile) {
    if (member.role !== "member") return;
    if (
      !window.confirm(
        `确认永久删除“${member.displayName}”吗？\n\n该账号将无法登录，收藏、留言和隐私申请会一并删除；已上传照片会保留并转交当前管理员。此操作无法撤销。`,
      )
    )
      return;

    setDeletingMemberId(member.id);
    try {
      const response = await fetch(`/api/admin/members/${member.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        newOwnerId?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "删除成员失败，请稍后重试。");

      setMembers((current) =>
        current.filter((currentMember) => currentMember.id !== member.id),
      );
      setPhotos((current) =>
        current.map((photo) => ({
          ...photo,
          uploadedBy:
            photo.uploadedBy === member.id && result.newOwnerId
              ? result.newOwnerId
              : photo.uploadedBy,
          people: photo.people.filter((person) => person.id !== member.id),
          selectedUserIds: photo.selectedUserIds.filter(
            (userId) => userId !== member.id,
          ),
        })),
      );
      setPrivacyRequests((current) =>
        current.filter((request) => request.userId !== member.id),
      );
    } catch (reason) {
      window.alert(
        reason instanceof Error
          ? reason.message
          : "删除成员失败，请稍后重试。",
      );
    } finally {
      setDeletingMemberId(null);
    }
  }

  async function reviewPrivacyRequest(
    id: string,
    status: "resolved" | "rejected",
  ) {
    const response = await fetch(`/api/admin/privacy-requests/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return;
    const request = privacyRequests.find((item) => item.id === id);
    setPrivacyRequests((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, status, resolvedAt: new Date().toISOString() }
          : item,
      ),
    );
    if (status === "resolved" && request?.photoId)
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === request.photoId
            ? { ...photo, reviewStatus: "hidden" }
            : photo,
        ),
      );
  }

  async function updatePhoto(id: string, update: Partial<Photo>) {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id ? { ...photo, ...update } : photo,
      ),
    );
    await fetch(`/api/admin/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
  }

  async function togglePhotoMember(
    photo: Photo,
    userId: string,
    type: "person" | "access",
  ) {
    const currentPeople = photo.people.map((person) => person.id);
    const currentAccess = photo.selectedUserIds;
    const peopleIds =
      type === "person"
        ? currentPeople.includes(userId)
          ? currentPeople.filter((id) => id !== userId)
          : [...currentPeople, userId]
        : currentPeople;
    const selectedUserIds =
      type === "access"
        ? currentAccess.includes(userId)
          ? currentAccess.filter((id) => id !== userId)
          : [...currentAccess, userId]
        : currentAccess;
    const people = peopleIds.map((id) => {
      const profile = members.find((member) => member.id === id);
      return {
        id,
        name: profile?.displayName ?? "班级成员",
        consentStatus: "approved" as const,
      };
    });
    setPhotos((current) =>
      current.map((item) =>
        item.id === photo.id ? { ...item, people, selectedUserIds } : item,
      ),
    );
    await fetch(`/api/admin/photos/${photo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peopleIds, selectedUserIds }),
    });
  }

  async function deletePhoto(id: string) {
    if (
      !window.confirm(
        "确认删除这张照片吗？真实模式会同时清理 R2 中的原图和缩略图。",
      )
    )
      return;
    const response = await fetch(`/api/admin/photos/${id}`, {
      method: "DELETE",
    });
    if (response.ok)
      setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    setIsCreatingInvite(true);
    setInviteCreateError("");
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.invite) {
        setInviteCreateError(result?.error || "创建邀请失败，请稍后再试。");
        return;
      }

      setInviteCodeStates((current) => ({
        ...current,
        [result.invite.id]: { code: result.invite.code },
      }));
      setInvites((current) => [
        {
          id: result.invite.id,
          codeAvailable: true,
          expiresAt: result.invite.expiresAt,
          maxUses: result.invite.maxUses,
          usedCount: 0,
          revokedAt: null,
          createdAt: new Date().toISOString(),
          redemptions: [],
        },
        ...current,
      ]);
    } catch {
      setInviteCreateError("网络连接失败，请稍后再试。");
    } finally {
      setIsCreatingInvite(false);
    }
  }

  function updateInviteCodeState(id: string, update: InviteCodeState) {
    setInviteCodeStates((current) => ({
      ...current,
      [id]: { ...current[id], ...update },
    }));
  }

  async function toggleInviteCode(id: string) {
    const current = inviteCodeStates[id];
    if (current?.code) {
      updateInviteCodeState(id, {
        code: undefined,
        copied: false,
        error: undefined,
      });
      return;
    }

    updateInviteCodeState(id, {
      loading: true,
      copied: false,
      error: undefined,
    });
    try {
      const response = await fetch(
        "/api/admin/invites/" + encodeURIComponent(id) + "/code",
        { cache: "no-store" },
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.code !== "string") {
        updateInviteCodeState(id, {
          loading: false,
          error: result?.error || "读取邀请口令失败，请稍后再试。",
        });
        return;
      }
      updateInviteCodeState(id, {
        code: result.code,
        loading: false,
        error: undefined,
      });
    } catch {
      updateInviteCodeState(id, {
        loading: false,
        error: "网络连接失败，请稍后再试。",
      });
    }
  }

  async function copyInviteCode(id: string) {
    const code = inviteCodeStates[id]?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      updateInviteCodeState(id, { copied: true, error: undefined });
    } catch {
      updateInviteCodeState(id, {
        copied: false,
        error: "复制失败，请长按口令手动复制。",
      });
    }
  }

  async function revokeInvite(id: string) {
    const response = await fetch(`/api/admin/invites/${id}/revoke`, {
      method: "POST",
    });
    if (response.ok)
      setInvites((current) =>
        current.map((invite) =>
          invite.id === id
            ? { ...invite, revokedAt: new Date().toISOString() }
            : invite,
        ),
      );
  }

  const recentPhotos = useMemo(() => photos.slice(0, 6), [photos]);

  return (
    <>
      <header className="admin-topbar">
        <div>
          <p>{tab === "overview" ? "在这里守护每一张照片与每一段回忆" : "CLASS ARCHIVE / ADMIN"}</p>
          <h1>{tabLabels[tab]}</h1>
        </div>
        <div>
          <Link className="admin-topbar-return" href="/memories">
            ← 返回班级相册
          </Link>
          <span className="admin-cloud-state">
            <i className="admin-demo-dot" />
            {demoMode ? "演示数据" : "R2 私有存储"}
          </span>
          <span className="admin-topbar-user" aria-label={`当前管理员 ${adminName}`}>
            <i>{adminName.slice(0, 1)}</i>
            <span>
              <b>{adminName}</b>
              <small>管理员</small>
            </span>
          </span>
        </div>
      </header>
      {tab === "overview" && (
        <AdminOverview
          photos={photos}
          members={members}
          invites={invites}
          logs={initialData.logs}
          privacyRequests={privacyRequests}
          onUpdatePhoto={updatePhoto}
          onReviewMember={reviewMember}
          onReviewPrivacyRequest={reviewPrivacyRequest}
        />
      )}
      {false && tab === "overview" && (
        <section id="overview" className="admin-section">
          <div className="admin-welcome">
            <div>
              <p>下午好，管理员</p>
              <h2>
                班级里的回忆，
                <br />
                已经有 <em>{publishedCount}</em> 张了。
              </h2>
              <span>这里可以安全地上传照片、审核成员和管理邀请。</span>
            </div>
            <Link href="/admin?tab=upload" scroll={false}>
              ＋ 前往批量上传
            </Link>
          </div>
          <div className="admin-metrics">
            <article>
              <span>照片</span>
              <b>{photos.length}</b>
              <small>
                {publishedCount} 张已发布 · {draftCount} 份未发布草稿
              </small>
            </article>
            <article>
              <span>成员</span>
              <b>{approvedCount}</b>
              <small>{pendingCount} 人等待审核</small>
            </article>
            <article>
              <span>有效邀请</span>
              <b>
                {
                  invites.filter(
                    (invite) =>
                      !invite.revokedAt &&
                      new Date(invite.expiresAt) > new Date(),
                  ).length
                }
              </b>
              <small>支持随时撤销</small>
            </article>
            <article>
              <span>存储模式</span>
              <b className="metric-word">{demoMode ? "MOCK" : "R2"}</b>
              <small>
                {demoMode ? "配置密钥后切换 R2" : "Cloudflare 私有存储"}
              </small>
            </article>
          </div>
          <div className="admin-overview-grid">
            <article className="overview-panel">
              <div className="panel-heading">
                <h3>最近照片</h3>
                <Link href="/admin?tab=photos" scroll={false}>
                  管理全部 →
                </Link>
              </div>
              <div className="recent-photo-grid">
                {recentPhotos.map((photo) => (
                  <div key={photo.id}>
                    <Image
                      src={photo.thumbnailUrl}
                      alt={photo.title}
                      fill
                      sizes="140px"
                      unoptimized
                      suppressHydrationWarning
                    />
                    <span>{photo.title}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="overview-panel">
              <div className="panel-heading">
                <h3>待办事项</h3>
              </div>
              <div className="todo-list">
                <Link href="/admin?tab=members" scroll={false}>
                  <b>{pendingCount}</b>
                  <span>位同学等待身份审核</span>
                  <i>→</i>
                </Link>
                <Link href="/admin?tab=members" scroll={false}>
                  <b>{pendingPrivacyCount}</b>
                  <span>条隐私申请等待处理</span>
                  <i>→</i>
                </Link>
                <Link href="/admin?tab=upload" scroll={false}>
                  <b>
                    {queue.filter((item) => item.status === "ready").length}
                  </b>
                  <span>份媒体在上传队列</span>
                  <i>→</i>
                </Link>
              </div>
            </article>
          </div>
        </section>
      )}

      {tab === "upload" && (
        <section id="upload" className="admin-section">
          <div className="section-title">
            <div>
              <p>PRIVATE R2 UPLOAD</p>
              <h2>批量上传照片或视频</h2>
              <span>原文件、预览封面和缩略图会分开保存。</span>
            </div>
            {queue.length > 0 && (
              <button type="button" onClick={uploadAll}>
                上传全部可用内容
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            multiple
            accept={MEDIA_INPUT_ACCEPT}
            onChange={(event) => addFiles(event.target.files)}
          />
          <button
            className="upload-dropzone"
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              addFiles(event.dataTransfer.files);
            }}
          >
            <span>＋</span>
            <b>拖入照片或视频，或点击选择</b>
            <small>图片不超过 25MB · MP4 / WebM 不超过 200MB</small>
          </button>
          <div className="upload-queue">
            {queue.map((item) => (
              <article
                key={item.id}
                className={`upload-item status-${item.status}`}
              >
                <div className="upload-thumb">
                  {item.mediaType === "video" ? (
                    <video src={item.preview} muted playsInline preload="auto" />
                  ) : (
                    <Image
                      src={item.preview}
                      alt={item.title}
                      fill
                      sizes="100px"
                      unoptimized
                      suppressHydrationWarning
                    />
                  )}
                  {item.mediaType === "video" ? <i>视频</i> : null}
                </div>
                <div className="upload-fields">
                  <input
                    aria-label="照片标题"
                    value={item.title}
                    onChange={(event) =>
                      updateQueue(item.id, { title: event.target.value })
                    }
                  />
                  <input
                    aria-label="地点"
                    value={item.location}
                    onChange={(event) =>
                      updateQueue(item.id, { location: event.target.value })
                    }
                    placeholder="地点（选填）"
                  />
                  <input
                    aria-label="标签"
                    value={item.tags}
                    onChange={(event) =>
                      updateQueue(item.id, { tags: event.target.value })
                    }
                    placeholder="标签，用逗号分隔"
                  />
                  <fieldset className="admin-upload-people">
                    <legend>相关人物（选填）</legend>
                    <div>
                      {approvedMembers.map((member) => (
                          <label key={member.id}>
                            <input
                              type="checkbox"
                              checked={item.peopleIds.includes(member.id)}
                              onChange={() => toggleQueuePerson(item.id, member.id)}
                            />
                            {member.displayName}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                </div>
                <select
                  aria-label="可见范围"
                  value={item.visibility}
                  onChange={(event) =>
                    updateQueue(item.id, {
                      visibility: event.target.value as PhotoVisibility,
                    })
                  }
                >
                  <option value="class">全班可见</option>
                  <option value="tagged_people">照片中的人</option>
                  <option value="selected">指定同学</option>
                  <option value="private">仅自己</option>
                </select>
                <div className="upload-progress">
                  <span style={{ width: `${item.progress}%` }} />
                  <b>
                    {item.status === "done"
                      ? "已发布"
                      : item.status === "error"
                        ? item.error
                        : item.status === "uploading"
                          ? `${item.progress}%`
                          : "等待上传"}
                  </b>
                  {item.status === "error" && item.retryable && (
                    <button type="button" onClick={() => uploadItem(item)}>
                      重试
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="移除媒体"
                  onClick={() => {
                    URL.revokeObjectURL(item.preview);
                    objectUrls.current.delete(item.preview);
                    setQueue((current) =>
                      current.filter((queued) => queued.id !== item.id),
                    );
                  }}
                >
                  ×
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "photos" && (
        <section id="photos" className="admin-section">
          <div className="section-title">
            <div>
              <p>PHOTO LIBRARY</p>
              <h2>照片与视频管理</h2>
              <span>
                修改故事、地点、人物、标签和可见范围，或隐藏和删除照片。
              </span>
            </div>
            <Link href="/admin?tab=upload" scroll={false}>
              ＋ 添加照片
            </Link>
          </div>
          <div className="admin-photo-list">
            {photos.map((photo) => (
              <article key={photo.id}>
                <div className="admin-photo-thumb">
                  <Image
                    src={photo.thumbnailUrl}
                    alt={photo.title}
                    fill
                    sizes="100px"
                    unoptimized
                    suppressHydrationWarning
                  />
                  {photo.mediaType === "video" ? (
                    <a
                      className="admin-video-preview"
                      href={photo.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`播放视频：${photo.title}`}
                    >
                      ▶
                    </a>
                  ) : null}
                </div>
                <div className="admin-photo-copy">
                  <input
                    aria-label="照片标题"
                    value={photo.title}
                    onChange={(event) =>
                      setPhotos((current) =>
                        current.map((item) =>
                          item.id === photo.id
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      )
                    }
                    onBlur={() => updatePhoto(photo.id, { title: photo.title })}
                  />
                  <span>
                    {memberNames.get(photo.uploadedBy) ?? "班级成员"}上传 ·{" "}
                    {photo.location || "地点未填写"} ·{" "}
                    {photo.tags.join(" / ") || "暂无标签"}
                  </span>
                  <small className={`admin-photo-status ${photo.reviewStatus}`}>
                    {photo.reviewStatus === "draft"
                      ? "未发布草稿"
                      : photo.reviewStatus === "published"
                        ? "已发布"
                        : "已隐藏"}
                  </small>
                </div>
                <select
                  value={photo.visibility}
                  aria-label="照片可见范围"
                  onChange={(event) =>
                    updatePhoto(photo.id, {
                      visibility: event.target.value as PhotoVisibility,
                    })
                  }
                >
                  <option value="class">全班可见</option>
                  <option value="tagged_people">照片中的人</option>
                  <option value="selected">指定同学</option>
                  <option value="private">仅自己</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setAccessPhotoId((current) =>
                      current === photo.id ? null : photo.id,
                    )
                  }
                >
                  编辑详情
                </button>
                <button
                  className={
                    photo.reviewStatus === "draft" ? "approve-photo" : undefined
                  }
                  type="button"
                  onClick={() =>
                    updatePhoto(photo.id, {
                      reviewStatus:
                        photo.reviewStatus === "published"
                          ? "hidden"
                          : "published",
                    })
                  }
                >
                  {photo.reviewStatus === "draft"
                    ? "立即发布"
                    : photo.reviewStatus === "hidden"
                      ? "恢复"
                      : "隐藏"}
                </button>
                <button
                  className="danger-text"
                  type="button"
                  onClick={() => deletePhoto(photo.id)}
                >
                  删除
                </button>
                {accessPhotoId === photo.id && (
                  <div className="photo-access-editor">
                    <div>
                      <b>照片中的同学</b>
                      <div>
                        {members
                          .filter(
                            (member) =>
                              member.role === "member" &&
                              member.status === "approved",
                          )
                          .map((member) => (
                            <label key={member.id}>
                              <input
                                type="checkbox"
                                checked={photo.people.some(
                                  (person) => person.id === member.id,
                                )}
                                onChange={() =>
                                  togglePhotoMember(photo, member.id, "person")
                                }
                              />
                              {member.displayName}
                            </label>
                          ))}
                      </div>
                    </div>
                    {photo.visibility === "selected" && (
                      <div>
                        <b>允许查看的同学</b>
                        <div>
                          {members
                            .filter(
                              (member) =>
                                member.role === "member" &&
                                member.status === "approved",
                            )
                            .map((member) => (
                              <label key={member.id}>
                                <input
                                  type="checkbox"
                                  checked={photo.selectedUserIds.includes(
                                    member.id,
                                  )}
                                  onChange={() =>
                                    togglePhotoMember(
                                      photo,
                                      member.id,
                                      "access",
                                    )
                                  }
                                />
                                {member.displayName}
                              </label>
                            ))}
                        </div>
                      </div>
                    )}
                    <label className="access-meta">
                      <b>地点</b>
                      <input
                        value={photo.location}
                        onChange={(event) =>
                          setPhotos((current) =>
                            current.map((item) =>
                              item.id === photo.id
                                ? { ...item, location: event.target.value }
                                : item,
                            ),
                          )
                        }
                        onBlur={() =>
                          updatePhoto(photo.id, { location: photo.location })
                        }
                      />
                    </label>
                    <label className="access-meta story">
                      <b>照片故事</b>
                      <textarea
                        maxLength={1000}
                        value={photo.description}
                        onChange={(event) =>
                          setPhotos((current) =>
                            current.map((item) =>
                              item.id === photo.id
                                ? { ...item, description: event.target.value }
                                : item,
                            ),
                          )
                        }
                        onBlur={() =>
                          updatePhoto(photo.id, {
                            description: photo.description,
                          })
                        }
                      />
                    </label>
                    <label className="access-tags">
                      <b>标签</b>
                      <input
                        value={photo.tags.join("，")}
                        onChange={(event) =>
                          setPhotos((current) =>
                            current.map((item) =>
                              item.id === photo.id
                                ? {
                                    ...item,
                                    tags: event.target.value
                                      .split(/[,，]/)
                                      .map((tag) => tag.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          )
                        }
                        onBlur={() =>
                          fetch(`/api/admin/photos/${photo.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ tags: photo.tags }),
                          })
                        }
                      />
                    </label>
                    <label className="download-check">
                      <input
                        type="checkbox"
                        checked={photo.downloadAllowed}
                        onChange={(event) =>
                          updatePhoto(photo.id, {
                            downloadAllowed: event.target.checked,
                          })
                        }
                      />
                      允许有权限的同学下载原图
                    </label>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "members" && (
        <section id="members" className="admin-section">
          <div className="section-title">
            <div>
              <p>CLASS MEMBERS</p>
              <h2>成员与隐私审核</h2>
              <span>
                只有确认身份的同学才能进入相册；隐私申请接受后会先隐藏照片。
              </span>
            </div>
          </div>
          <div className="admin-review-grid">
            <div>
              <h3>
                身份审核 <small>{pendingCount} 待处理</small>
              </h3>
              <div className="member-review-list">
                {members.map((member) => (
                  <article key={member.id}>
                    <i>{member.displayName.slice(0, 1)}</i>
                    <div>
                      <b>{member.displayName}</b>
                      <span>{member.email}</span>
                    </div>
                    <small className={`member-status ${member.status}`}>
                      {member.status === "approved"
                        ? "已通过"
                        : member.status === "pending"
                          ? "待审核"
                          : "已拒绝"}
                    </small>
                    {member.role === "member" && (
                      <div className="review-actions member-actions">
                        {member.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                reviewMember(member.id, "approved")
                              }
                              disabled={deletingMemberId === member.id}
                            >
                              确认是同学
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                reviewMember(member.id, "rejected")
                              }
                              disabled={deletingMemberId === member.id}
                            >
                              拒绝
                            </button>
                          </>
                        )}
                        <button
                          className="danger-member"
                          type="button"
                          onClick={() => deleteMember(member)}
                          disabled={deletingMemberId !== null}
                        >
                          {deletingMemberId === member.id
                            ? "正在删除…"
                            : "删除账号"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3>
                隐私申请 <small>{pendingPrivacyCount} 待处理</small>
              </h3>
              <div className="privacy-review-list">
                {privacyRequests.length === 0 ? (
                  <p className="admin-empty">暂时没有隐私申请。</p>
                ) : (
                  privacyRequests.map((item) => (
                    <article key={item.id}>
                      <div>
                        <span>
                          {item.kind === "delete" ? "删除申请" : "隐藏申请"}
                        </span>
                        <small className={`privacy-status ${item.status}`}>
                          {item.status === "pending"
                            ? "待处理"
                            : item.status === "resolved"
                              ? "已接受"
                              : "已拒绝"}
                        </small>
                      </div>
                      <h4>{item.photoTitle}</h4>
                      <p>
                        <b>{item.userName}</b>：
                        {item.message || "未填写补充说明"}
                      </p>
                      <time>
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </time>
                      {item.status === "pending" && (
                        <div className="review-actions">
                          <button
                            type="button"
                            onClick={() =>
                              reviewPrivacyRequest(item.id, "resolved")
                            }
                          >
                            接受并先隐藏
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              reviewPrivacyRequest(item.id, "rejected")
                            }
                          >
                            拒绝
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "invites" && (
        <section id="invites" className="admin-section">
          <div className="section-title">
            <div>
              <p>INVITATION ACCESS</p>
              <h2>邀请口令</h2>
              <span>口令经加密保存，管理员可随时按需查看和复制。</span>
            </div>
          </div>
          <div className="invite-layout">
            <form className="invite-creator" onSubmit={createInvite}>
              <h3>创建一个新邀请</h3>
              <label>
                有效天数
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={inviteForm.validDays}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      validDays: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                最多使用次数
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={inviteForm.maxUses}
                  onChange={(event) =>
                    setInviteForm({
                      ...inviteForm,
                      maxUses: Number(event.target.value),
                    })
                  }
                />
              </label>
              <button type="submit" disabled={isCreatingInvite}>
                {isCreatingInvite ? "正在生成…" : "生成限时口令"}
              </button>
              <p className="invite-creator-note">
                新口令会以加密密文保存，数据库不会记录明文。
              </p>
              {inviteCreateError && (
                <p className="invite-inline-error" role="alert">
                  {inviteCreateError}
                </p>
              )}
            </form>
            <div className="invite-list">
              {invites.map((invite: AdminInviteView) => {
                const expired = new Date(invite.expiresAt) < new Date();
                const codeState = inviteCodeStates[invite.id];
                const state = invite.revokedAt
                  ? "已撤销"
                  : expired
                    ? "已过期"
                    : invite.usedCount >= invite.maxUses
                      ? "已用完"
                      : "有效";
                return (
                  <article key={invite.id}>
                    <div>
                      <b>{invite.id.slice(0, 8)}…</b>
                      <span>
                        有效至{" "}
                        {new Date(invite.expiresAt).toLocaleDateString("zh-CN")}
                      </span>
                      {invite.redemptions.length > 0 && (
                        <span>
                          已使用：
                          {invite.redemptions
                            .map((item) => item.name)
                            .join("、")}
                        </span>
                      )}
                    </div>
                    <p>
                      {invite.usedCount} / {invite.maxUses} 次
                    </p>
                    <small className={state === "有效" ? "active" : ""}>
                      {state}
                    </small>
                    {state === "有效" && (
                      <button
                        type="button"
                        className="invite-revoke-button"
                        onClick={() => revokeInvite(invite.id)}
                      >
                        撤销
                      </button>
                    )}
                    <div className="invite-code-panel">
                      <div className="invite-code-value">
                        <span>邀请口令</span>
                        <code>
                          {codeState?.code
                            ? codeState.code
                            : invite.codeAvailable
                              ? "••••••••••••"
                              : "历史口令不可恢复"}
                        </code>
                      </div>
                      <div className="invite-code-actions">
                        {invite.codeAvailable && (
                          <button
                            type="button"
                            className="invite-code-button"
                            aria-expanded={Boolean(codeState?.code)}
                            disabled={codeState?.loading}
                            onClick={() => toggleInviteCode(invite.id)}
                          >
                            {codeState?.loading
                              ? "读取中…"
                              : codeState?.code
                                ? "隐藏口令"
                                : "查看口令"}
                          </button>
                        )}
                        {codeState?.code && (
                          <button
                            type="button"
                            className="invite-copy-button"
                            onClick={() => copyInviteCode(invite.id)}
                          >
                            {codeState.copied ? "已复制" : "复制口令"}
                          </button>
                        )}
                      </div>
                      {!invite.codeAvailable && (
                        <p className="invite-code-help">
                          该邀请创建于加密存储升级前，仅保留不可逆哈希。请新建口令替代。
                        </p>
                      )}
                      {codeState?.error && (
                        <p className="invite-inline-error" role="alert">
                          {codeState.error}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {tab === "logs" && (
        <section id="logs" className="admin-section">
          <div className="section-title">
            <div>
              <p>ADMIN AUDIT</p>
              <h2>操作记录</h2>
              <span>真实模式下，管理员的重要操作都会写入数据库。</span>
            </div>
          </div>
          <div className="admin-logs">
            {initialData.logs.map((log) => (
              <article key={log.id}>
                <i />
                <div>
                  <b>{log.adminName}</b>
                  <p>{log.action}</p>
                </div>
                <span>{new Date(log.createdAt).toLocaleString("zh-CN")}</span>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
