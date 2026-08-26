"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import type { Photo, Profile } from "@/types/domain";

type Preferences = Pick<Profile, "showRealName" | "requireTagApproval" | "allowOriginalDownload"> & {
  reduceMotion: boolean;
  soundEnabled: boolean;
};

type Props = {
  user: Profile;
  ownPhotoCount: number;
  pendingTagRequests: Photo[];
  relevantPhotos: Photo[];
  visiblePhotos: Photo[];
  initialFavoriteIds: string[];
  demoMode: boolean;
};

export function ProfileSettings({ user, ownPhotoCount, pendingTagRequests, relevantPhotos, visiblePhotos, initialFavoriteIds, demoMode }: Props) {
  const [requests, setRequests] = useState(pendingTagRequests);
  const [favoriteIds, setFavoriteIds] = useState(initialFavoriteIds);
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    showRealName: user.showRealName,
    requireTagApproval: user.requireTagApproval,
    allowOriginalDownload: user.allowOriginalDownload,
    reduceMotion: false,
    soundEnabled: false,
  });
  const [privacyForm, setPrivacyForm] = useState({ photoId: relevantPhotos[0]?.id ?? "", kind: "hide" as "hide" | "delete", message: "" });
  const [privacyState, setPrivacyState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [privacyMessage, setPrivacyMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (demoMode) {
        try { setFavoriteIds(JSON.parse(window.localStorage.getItem("class-memory-favorites") ?? "[]")); } catch { setFavoriteIds([]); }
      }
      setPreferences((current) => ({ ...current, reduceMotion: window.localStorage.getItem("reduce-motion") === "true", soundEnabled: window.localStorage.getItem("sound-enabled") === "true" }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoMode]);

  async function toggle(key: keyof Preferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next); setSaved(false);
    window.localStorage.setItem("reduce-motion", String(next.reduceMotion));
    window.localStorage.setItem("sound-enabled", String(next.soundEnabled));
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (response.ok) setSaved(true);
  }

  async function decideConsent(photoId: string, consentStatus: "approved" | "rejected") {
    const response = await fetch(`/api/photos/${photoId}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consentStatus }) });
    if (response.ok) setRequests((current) => current.filter((item) => item.id !== photoId));
  }

  async function submitPrivacyRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!privacyForm.photoId) return;
    setPrivacyState("sending"); setPrivacyMessage("");
    const response = await fetch("/api/privacy-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(privacyForm) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setPrivacyState("sent"); setPrivacyMessage("申请已交给管理员；接受后照片会先从相册隐藏。");
      setPrivacyForm((current) => ({ ...current, message: "" }));
    } else {
      setPrivacyState("error"); setPrivacyMessage(result.error || "提交失败，请稍后再试。");
    }
  }

  const rows: Array<{ key: keyof Preferences; title: string; note: string }> = [
    { key: "showRealName", title: "显示真实姓名", note: "关闭后，其他同学只会看到你的昵称。" },
    { key: "requireTagApproval", title: "被标记后需要我确认", note: "包含你的新照片需经你同意后才能公开。" },
    { key: "allowOriginalDownload", title: "允许下载包含我的原图", note: "照片本身也必须同时开启原图下载。" },
    { key: "reduceMotion", title: "减少动态效果", note: "简化洗牌、视差和照片显影动画。" },
    { key: "soundEnabled", title: "随机回忆声音", note: "快门和洗牌声音默认保持关闭。" },
  ];
  const favoritePhotos = visiblePhotos.filter((photo) => favoriteIds.includes(photo.id));
  const selectedPrivacyPhoto = relevantPhotos.find((photo) => photo.id === privacyForm.photoId) ?? relevantPhotos[0] ?? null;

  return <div className="profile-grid">
    <section className="profile-card identity-card">
      <div className="profile-avatar">{user.displayName.slice(0, 1)}</div><p>{user.role === "admin" ? "班级相册管理员" : "班级成员"}</p><h2>{user.displayName}</h2><span>{user.email}</span>
      <div className="profile-stats"><div><b>{ownPhotoCount}</b><span>我的照片</span></div><div><b>{favoritePhotos.length}</b><span>我的收藏</span></div></div>
    </section>
    <section className="profile-card settings-card">
      <div className="settings-heading"><div><p>PRIVACY & EXPERIENCE</p><h2>隐私与浏览偏好</h2></div>{saved && <span>已保存</span>}</div>
      <div className="profile-favorites"><div><b>我的收藏</b><span>这里只展示你仍有权限查看的照片。</span></div>{favoritePhotos.length > 0 ? <div>{favoritePhotos.slice(0, 6).map((photo) => <Link key={photo.id} href={`/photos?open=${photo.id}`} aria-label={`查看收藏：${photo.title}`}><Image src={photo.thumbnailUrl} alt={photo.title} fill sizes="88px" unoptimized suppressHydrationWarning /><span>{photo.title}</span></Link>)}</div> : <p>还没有收藏照片。打开照片详情，点一下“收藏”就会出现在这里。</p>}</div>
      {requests.length > 0 && <div className="pending-consents">
        <div><b>{requests.length} 张照片等待你确认</b><span>确认前，它们不会出现在普通同学的照片墙和随机回忆中。</span></div>
        {requests.map((photo) => <article key={photo.id}><div><Image src={photo.thumbnailUrl} alt={photo.title} fill sizes="72px" unoptimized suppressHydrationWarning /></div><p><b>{photo.title}</b><span>{photo.location || "地点未填写"}</span></p><button type="button" onClick={() => decideConsent(photo.id, "approved")}>同意展示</button><button type="button" onClick={() => decideConsent(photo.id, "rejected")}>拒绝</button></article>)}
      </div>}
      <div className="setting-list">{rows.map((row) => <label key={row.key}><span><b>{row.title}</b><small>{row.note}</small></span><input type="checkbox" checked={preferences[row.key]} onChange={() => toggle(row.key)} /><i aria-hidden="true" /></label>)}</div>
      <form className="privacy-request-form" onSubmit={submitPrivacyRequest}>
        <div className="privacy-request-heading"><p><b>申请隐藏或删除照片</b><span>管理员接受后会先隐藏照片；永久删除仍需二次确认。</span></p><small>PRIVACY REQUEST</small></div>
        {relevantPhotos.length > 0 ? <>
          {selectedPrivacyPhoto && <div key={selectedPrivacyPhoto.id} className="privacy-photo-preview">
            <Link href={`/photos?open=${selectedPrivacyPhoto.id}`} aria-label={`查看大图：${selectedPrivacyPhoto.title}`}>
              <Image src={selectedPrivacyPhoto.previewUrl} alt={selectedPrivacyPhoto.title} fill sizes="(max-width: 560px) calc(100vw - 94px), 220px" unoptimized suppressHydrationWarning />
              <span>查看大图 ↗</span>
            </Link>
            <div><small>当前选择</small><b>{selectedPrivacyPhoto.title}</b><p>{selectedPrivacyPhoto.location || "地点未填写"}</p>{selectedPrivacyPhoto.tags.length > 0 && <div>{selectedPrivacyPhoto.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}</div>}</div>
          </div>}
          <label>选择照片<select value={privacyForm.photoId} onChange={(event) => setPrivacyForm({ ...privacyForm, photoId: event.target.value })}>{relevantPhotos.map((photo) => <option key={photo.id} value={photo.id}>{photo.title}</option>)}</select></label>
          <label>希望怎样处理<select value={privacyForm.kind} onChange={(event) => setPrivacyForm({ ...privacyForm, kind: event.target.value as "hide" | "delete" })}><option value="hide">先隐藏，不再展示</option><option value="delete">申请永久删除</option></select></label>
          <label className="privacy-note">补充说明（选填）<textarea maxLength={500} value={privacyForm.message} onChange={(event) => setPrivacyForm({ ...privacyForm, message: event.target.value })} placeholder="例如：照片里有我，希望暂时不要展示……" /></label>
          <button type="submit" disabled={privacyState === "sending"}><span>{privacyState === "sending" ? "正在提交…" : "提交隐私申请"}</span><i aria-hidden="true">→</i></button>
          {privacyMessage && <p className={`privacy-feedback ${privacyState}`}>{privacyMessage}</p>}
        </> : <p className="privacy-empty">目前没有可申请处理的照片。</p>}
      </form>
      <LogoutButton className="profile-logout" />
    </section>
  </div>;
}
