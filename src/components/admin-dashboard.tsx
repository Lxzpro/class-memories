"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import type { AdminDashboardData, AdminInviteView } from "@/lib/admin-data";
import type { Photo, PhotoVisibility } from "@/types/domain";

type Tab = "overview" | "upload" | "photos" | "members" | "invites" | "logs";
type QueueItem = { id: string; file: File; preview: string; title: string; location: string; tags: string; visibility: PhotoVisibility; progress: number; status: "ready" | "uploading" | "done" | "error"; error?: string; retryable?: boolean };
const tabLabels: Record<Tab, string> = { overview: "概览", upload: "批量上传", photos: "照片管理", members: "成员审核", invites: "邀请口令", logs: "操作记录" };

async function canvasBlob(bitmap: ImageBitmap, maxWidth: number, quality: number) {
  const scale = Math.min(1, maxWidth / bitmap.width); const width = Math.round(bitmap.width * scale); const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理这张图片"); context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("图片压缩失败"); return { blob, width, height };
}

export function AdminDashboard({ initialData, initialTab = "overview", demoMode = false }: { initialData: AdminDashboardData; initialTab?: string; demoMode?: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab as Tab); const [photos, setPhotos] = useState(initialData.photos); const [members, setMembers] = useState(initialData.members); const [invites, setInvites] = useState(initialData.invites); const [privacyRequests, setPrivacyRequests] = useState(initialData.privacyRequests); const [accessPhotoId, setAccessPhotoId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]); const [newCode, setNewCode] = useState(""); const [inviteForm, setInviteForm] = useState({ validDays: 7, maxUses: 10 });
  const fileInput = useRef<HTMLInputElement>(null);
  const approvedCount = members.filter((member) => member.status === "approved").length; const pendingCount = members.filter((member) => member.status === "pending").length;
  const publishedCount = photos.filter((photo) => photo.reviewStatus === "published").length;
  const pendingPrivacyCount = privacyRequests.filter((request) => request.status === "pending").length;
  const navigation: Tab[] = ["overview", "upload", "photos", "members", "invites", "logs"];

  function addFiles(files: FileList | null) {
    if (!files) return; const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    const items = Array.from(files).map((file): QueueItem => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), title: file.name.replace(/\.[^.]+$/, ""), location: "", tags: "", visibility: "class", progress: 0, status: allowed.has(file.type) && file.size <= 25 * 1024 * 1024 ? "ready" : "error", error: !allowed.has(file.type) ? "仅支持 JPG、PNG、WebP" : file.size > 25 * 1024 * 1024 ? "文件超过 25MB" : undefined }));
    setQueue((current) => [...current, ...items]); setTab("upload");
  }

  function updateQueue(id: string, update: Partial<QueueItem>) { setQueue((current) => current.map((item) => item.id === id ? { ...item, ...update } : item)); }

  async function uploadItem(item: QueueItem) {
    if (item.status === "error" && !item.retryable) return; updateQueue(item.id, { status: "uploading", progress: 8, error: undefined });
    try {
      const bitmap = await createImageBitmap(item.file); const width = bitmap.width; const height = bitmap.height;
      const [preview, thumbnail] = await Promise.all([canvasBlob(bitmap, 1600, .84), canvasBlob(bitmap, 640, .78)]); bitmap.close(); updateQueue(item.id, { progress: 20 });
      const signResponse = await fetch("/api/admin/uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.file.name, type: item.file.type, size: item.file.size, previewSize: preview.blob.size, thumbnailSize: thumbnail.blob.size }) });
      const signed = await signResponse.json(); if (!signResponse.ok) throw new Error(signed.error || "无法创建上传链接"); updateQueue(item.id, { progress: 35 });
      await Promise.all([
        fetch(signed.urls.original, { method: "PUT", headers: { "Content-Type": item.file.type }, body: item.file }),
        fetch(signed.urls.preview, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: preview.blob }),
        fetch(signed.urls.thumbnail, { method: "PUT", headers: { "Content-Type": "image/webp" }, body: thumbnail.blob }),
      ].map(async (promise) => { const response = await promise; if (!response.ok) throw new Error("文件上传失败"); })); updateQueue(item.id, { progress: 82 });
      const metadata = { id: signed.photoId, title: item.title || "未命名回忆", description: "", location: item.location, width, height, visibility: item.visibility, downloadAllowed: false, originalKey: signed.keys.original, previewKey: signed.keys.preview, thumbnailKey: signed.keys.thumbnail, tags: item.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) };
      const saveResponse = await fetch("/api/admin/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) }); const saved = await saveResponse.json(); if (!saveResponse.ok) throw new Error(saved.error || "照片资料保存失败");
      updateQueue(item.id, { status: "done", progress: 100 });
    } catch (reason) { updateQueue(item.id, { status: "error", retryable: true, error: reason instanceof Error ? reason.message : "上传失败" }); }
  }

  async function uploadAll() { for (const item of queue.filter((current) => current.status === "ready")) await uploadItem(item); }

  async function reviewMember(id: string, status: "approved" | "rejected") {
    const response = await fetch(`/api/admin/members/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setMembers((current) => current.map((member) => member.id === id ? { ...member, status } : member));
  }

  async function reviewPrivacyRequest(id: string, status: "resolved" | "rejected") {
    const response = await fetch(`/api/admin/privacy-requests/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) return;
    const request = privacyRequests.find((item) => item.id === id);
    setPrivacyRequests((current) => current.map((item) => item.id === id ? { ...item, status, resolvedAt: new Date().toISOString() } : item));
    if (status === "resolved" && request?.photoId) setPhotos((current) => current.map((photo) => photo.id === request.photoId ? { ...photo, reviewStatus: "hidden" } : photo));
  }

  async function updatePhoto(id: string, update: Partial<Photo>) {
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, ...update } : photo));
    await fetch(`/api/admin/photos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
  }

  async function togglePhotoMember(photo: Photo, userId: string, type: "person" | "access") {
    const currentPeople = photo.people.map((person) => person.id); const currentAccess = photo.selectedUserIds;
    const peopleIds = type === "person" ? (currentPeople.includes(userId) ? currentPeople.filter((id) => id !== userId) : [...currentPeople, userId]) : currentPeople;
    const selectedUserIds = type === "access" ? (currentAccess.includes(userId) ? currentAccess.filter((id) => id !== userId) : [...currentAccess, userId]) : currentAccess;
    const people = peopleIds.map((id) => { const profile = members.find((member) => member.id === id); return { id, name: profile?.displayName ?? "班级成员", consentStatus: profile?.requireTagApproval ? "pending" as const : "approved" as const }; });
    setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, people, selectedUserIds } : item));
    await fetch(`/api/admin/photos/${photo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peopleIds, selectedUserIds }) });
  }

  async function deletePhoto(id: string) {
    if (!window.confirm("确认删除这张照片吗？真实模式会同时清理 R2 中的原图和缩略图。")) return;
    const response = await fetch(`/api/admin/photos/${id}`, { method: "DELETE" }); if (response.ok) setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  async function createInvite(event: React.FormEvent) {
    event.preventDefault(); const response = await fetch("/api/admin/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inviteForm) }); const result = await response.json();
    if (response.ok) { setNewCode(result.invite.code); setInvites((current) => [{ id: result.invite.id, expiresAt: result.invite.expiresAt, maxUses: result.invite.maxUses, usedCount: 0, revokedAt: null, createdAt: new Date().toISOString(), redemptions: [] }, ...current]); }
  }

  async function revokeInvite(id: string) { const response = await fetch(`/api/admin/invites/${id}/revoke`, { method: "POST" }); if (response.ok) setInvites((current) => current.map((invite) => invite.id === id ? { ...invite, revokedAt: new Date().toISOString() } : invite)); }

  const recentPhotos = useMemo(() => photos.slice(0, 6), [photos]);

  return <>
    <header className="admin-topbar"><div><p>CLASS ARCHIVE / ADMIN</p><h1>{tabLabels[tab]}</h1></div><div><span className="admin-demo-dot" /> {demoMode ? "演示管理台" : "私有云管理台"}</div></header>
    <nav className="admin-mobile-tabs">{navigation.map((item) => <button key={item} className={tab === item ? "active" : ""} type="button" onClick={() => setTab(item)}>{tabLabels[item]}</button>)}</nav>

    {tab === "overview" && <section id="overview" className="admin-section"><div className="admin-welcome"><div><p>下午好，管理员</p><h2>班级里的回忆，<br />已经有 <em>{publishedCount}</em> 张了。</h2><span>这里可以安全地上传照片、审核成员和管理邀请。</span></div><button type="button" onClick={() => { setTab("upload"); fileInput.current?.click(); }}>＋ 上传一批照片</button></div>
      <div className="admin-metrics"><article><span>照片</span><b>{photos.length}</b><small>{publishedCount} 张已发布</small></article><article><span>成员</span><b>{approvedCount}</b><small>{pendingCount} 人等待审核</small></article><article><span>有效邀请</span><b>{invites.filter((invite) => !invite.revokedAt && new Date(invite.expiresAt) > new Date()).length}</b><small>支持随时撤销</small></article><article><span>存储模式</span><b className="metric-word">{demoMode ? "MOCK" : "R2"}</b><small>{demoMode ? "配置密钥后切换 R2" : "Cloudflare 私有存储"}</small></article></div>
      <div className="admin-overview-grid"><article className="overview-panel"><div className="panel-heading"><h3>最近照片</h3><button type="button" onClick={() => setTab("photos")}>管理全部 →</button></div><div className="recent-photo-grid">{recentPhotos.map((photo) => <div key={photo.id}><Image src={photo.thumbnailUrl} alt={photo.title} fill sizes="140px" unoptimized suppressHydrationWarning /><span>{photo.title}</span></div>)}</div></article><article className="overview-panel"><div className="panel-heading"><h3>待办事项</h3></div><div className="todo-list"><button type="button" onClick={() => setTab("members")}><b>{pendingCount}</b><span>位同学等待身份审核</span><i>→</i></button><button type="button" onClick={() => setTab("members")}><b>{pendingPrivacyCount}</b><span>条隐私申请等待处理</span><i>→</i></button><button type="button" onClick={() => setTab("upload")}><b>{queue.filter((item) => item.status === "ready").length}</b><span>张照片在上传队列</span><i>→</i></button></div></article></div>
    </section>}

    {tab === "upload" && <section id="upload" className="admin-section"><div className="section-title"><div><p>PRIVATE R2 UPLOAD</p><h2>批量上传照片</h2><span>原图、预览图和缩略图会分开保存。</span></div>{queue.length > 0 && <button type="button" onClick={uploadAll}>上传全部可用照片</button>}</div><input ref={fileInput} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => addFiles(event.target.files)} />
      <button className="upload-dropzone" type="button" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}><span>＋</span><b>拖入照片，或点击选择</b><small>支持 JPG、PNG、WebP · 单张不超过 25MB</small></button>
      <div className="upload-queue">{queue.map((item) => <article key={item.id} className={`upload-item status-${item.status}`}><div className="upload-thumb"><Image src={item.preview} alt={item.title} fill sizes="100px" unoptimized suppressHydrationWarning /></div><div className="upload-fields"><input aria-label="照片标题" value={item.title} onChange={(event) => updateQueue(item.id, { title: event.target.value })} /><input aria-label="地点" value={item.location} onChange={(event) => updateQueue(item.id, { location: event.target.value })} placeholder="地点（选填）" /><input aria-label="标签" value={item.tags} onChange={(event) => updateQueue(item.id, { tags: event.target.value })} placeholder="标签，用逗号分隔" /></div><select aria-label="可见范围" value={item.visibility} onChange={(event) => updateQueue(item.id, { visibility: event.target.value as PhotoVisibility })}><option value="class">全班可见</option><option value="tagged_people">照片中的人</option><option value="selected">指定同学</option><option value="private">仅自己</option></select><div className="upload-progress"><span style={{ width: `${item.progress}%` }} /><b>{item.status === "done" ? "已发布" : item.status === "error" ? item.error : item.status === "uploading" ? `${item.progress}%` : "等待上传"}</b>{item.status === "error" && item.retryable && <button type="button" onClick={() => uploadItem(item)}>重试</button>}</div><button type="button" aria-label="移除照片" onClick={() => { URL.revokeObjectURL(item.preview); setQueue((current) => current.filter((queued) => queued.id !== item.id)); }}>×</button></article>)}</div>
    </section>}

    {tab === "photos" && <section id="photos" className="admin-section"><div className="section-title"><div><p>PHOTO LIBRARY</p><h2>照片管理</h2><span>修改故事、地点、人物、标签和可见范围，或隐藏和删除照片。</span></div><button type="button" onClick={() => setTab("upload")}>＋ 添加照片</button></div><div className="admin-photo-list">{photos.map((photo) => <article key={photo.id}><div className="admin-photo-thumb"><Image src={photo.thumbnailUrl} alt={photo.title} fill sizes="100px" unoptimized suppressHydrationWarning /></div><div className="admin-photo-copy"><input aria-label="照片标题" value={photo.title} onChange={(event) => setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, title: event.target.value } : item))} onBlur={() => updatePhoto(photo.id, { title: photo.title })} /><span>{photo.location || "地点未填写"} · {photo.tags.join(" / ") || "暂无标签"}</span></div><select value={photo.visibility} aria-label="照片可见范围" onChange={(event) => updatePhoto(photo.id, { visibility: event.target.value as PhotoVisibility })}><option value="class">全班可见</option><option value="tagged_people">照片中的人</option><option value="selected">指定同学</option><option value="private">仅自己</option></select><button type="button" onClick={() => setAccessPhotoId((current) => current === photo.id ? null : photo.id)}>编辑详情</button><button type="button" onClick={() => updatePhoto(photo.id, { reviewStatus: photo.reviewStatus === "hidden" ? "published" : "hidden" })}>{photo.reviewStatus === "hidden" ? "恢复" : "隐藏"}</button><button className="danger-text" type="button" onClick={() => deletePhoto(photo.id)}>删除</button>{accessPhotoId === photo.id && <div className="photo-access-editor"><div><b>照片中的同学</b><div>{members.filter((member) => member.role === "member" && member.status === "approved").map((member) => <label key={member.id}><input type="checkbox" checked={photo.people.some((person) => person.id === member.id)} onChange={() => togglePhotoMember(photo, member.id, "person")} />{member.displayName}</label>)}</div></div>{photo.visibility === "selected" && <div><b>允许查看的同学</b><div>{members.filter((member) => member.role === "member" && member.status === "approved").map((member) => <label key={member.id}><input type="checkbox" checked={photo.selectedUserIds.includes(member.id)} onChange={() => togglePhotoMember(photo, member.id, "access")} />{member.displayName}</label>)}</div></div>}<label className="access-meta"><b>地点</b><input value={photo.location} onChange={(event) => setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, location: event.target.value } : item))} onBlur={() => updatePhoto(photo.id, { location: photo.location })} /></label><label className="access-meta story"><b>照片故事</b><textarea maxLength={1000} value={photo.description} onChange={(event) => setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, description: event.target.value } : item))} onBlur={() => updatePhoto(photo.id, { description: photo.description })} /></label><label className="access-tags"><b>标签</b><input value={photo.tags.join("，")} onChange={(event) => setPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, tags: event.target.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) } : item))} onBlur={() => fetch(`/api/admin/photos/${photo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: photo.tags }) })} /></label><label className="download-check"><input type="checkbox" checked={photo.downloadAllowed} onChange={(event) => updatePhoto(photo.id, { downloadAllowed: event.target.checked })} />允许有权限的同学下载原图</label></div>}</article>)}</div></section>}

    {tab === "members" && <section id="members" className="admin-section">
      <div className="section-title"><div><p>CLASS MEMBERS</p><h2>成员与隐私审核</h2><span>只有确认身份的同学才能进入相册；隐私申请接受后会先隐藏照片。</span></div></div>
      <div className="admin-review-grid">
        <div><h3>身份审核 <small>{pendingCount} 待处理</small></h3><div className="member-review-list">{members.map((member) => <article key={member.id}><i>{member.displayName.slice(0,1)}</i><div><b>{member.displayName}</b><span>{member.email}</span></div><small className={`member-status ${member.status}`}>{member.status === "approved" ? "已通过" : member.status === "pending" ? "待审核" : "已拒绝"}</small>{member.status === "pending" && <div className="review-actions"><button type="button" onClick={() => reviewMember(member.id, "approved")}>确认是同学</button><button type="button" onClick={() => reviewMember(member.id, "rejected")}>拒绝</button></div>}</article>)}</div></div>
        <div><h3>隐私申请 <small>{pendingPrivacyCount} 待处理</small></h3><div className="privacy-review-list">{privacyRequests.length === 0 ? <p className="admin-empty">暂时没有隐私申请。</p> : privacyRequests.map((item) => <article key={item.id}><div><span>{item.kind === "delete" ? "删除申请" : "隐藏申请"}</span><small className={`privacy-status ${item.status}`}>{item.status === "pending" ? "待处理" : item.status === "resolved" ? "已接受" : "已拒绝"}</small></div><h4>{item.photoTitle}</h4><p><b>{item.userName}</b>：{item.message || "未填写补充说明"}</p><time>{new Date(item.createdAt).toLocaleString("zh-CN")}</time>{item.status === "pending" && <div className="review-actions"><button type="button" onClick={() => reviewPrivacyRequest(item.id, "resolved")}>接受并先隐藏</button><button type="button" onClick={() => reviewPrivacyRequest(item.id, "rejected")}>拒绝</button></div>}</article>)}</div></div>
      </div>
    </section>}

    {tab === "invites" && <section id="invites" className="admin-section"><div className="section-title"><div><p>INVITATION ACCESS</p><h2>邀请口令</h2><span>口令只保存哈希；新口令明文只显示一次。</span></div></div><div className="invite-layout"><form className="invite-creator" onSubmit={createInvite}><h3>创建一个新邀请</h3><label>有效天数<input type="number" min="1" max="60" value={inviteForm.validDays} onChange={(event) => setInviteForm({ ...inviteForm, validDays: Number(event.target.value) })} /></label><label>最多使用次数<input type="number" min="1" max="100" value={inviteForm.maxUses} onChange={(event) => setInviteForm({ ...inviteForm, maxUses: Number(event.target.value) })} /></label><button type="submit">生成限时口令</button>{newCode && <div className="new-invite"><small>请现在复制，关闭后不再显示</small><b>{newCode}</b><button type="button" onClick={() => navigator.clipboard.writeText(newCode)}>复制口令</button></div>}</form><div className="invite-list">{invites.map((invite: AdminInviteView) => { const expired = new Date(invite.expiresAt) < new Date(); const state = invite.revokedAt ? "已撤销" : expired ? "已过期" : invite.usedCount >= invite.maxUses ? "已用完" : "有效"; return <article key={invite.id}><div><b>{invite.id.slice(0,8)}…</b><span>有效至 {new Date(invite.expiresAt).toLocaleDateString("zh-CN")}</span>{invite.redemptions.length > 0 && <span>已使用：{invite.redemptions.map((item) => item.name).join("、")}</span>}</div><p>{invite.usedCount} / {invite.maxUses} 次</p><small className={state === "有效" ? "active" : ""}>{state}</small>{state === "有效" && <button type="button" onClick={() => revokeInvite(invite.id)}>撤销</button>}</article>; })}</div></div></section>}

    {tab === "logs" && <section id="logs" className="admin-section"><div className="section-title"><div><p>ADMIN AUDIT</p><h2>操作记录</h2><span>真实模式下，管理员的重要操作都会写入数据库。</span></div></div><div className="admin-logs">{initialData.logs.map((log) => <article key={log.id}><i /><div><b>{log.adminName}</b><p>{log.action}</p></div><span>{new Date(log.createdAt).toLocaleString("zh-CN")}</span></article>)}</div></section>}
  </>;
}
