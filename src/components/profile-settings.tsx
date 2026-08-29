"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import type { Photo, Profile } from "@/types/domain";

type Preferences = Pick<
  Profile,
  "showRealName" | "allowOriginalDownload"
> & {
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

type ProfileTab = "about" | "favorites" | "uploads" | "privacy";

const privacyReasons = ["不想公开", "不喜欢这张照片", "涉及个人隐私", "其他"];

export function ProfileSettings({
  user,
  ownPhotoCount,
  pendingTagRequests,
  relevantPhotos,
  visiblePhotos,
  initialFavoriteIds,
  demoMode,
}: Props) {
  const [requests, setRequests] = useState(pendingTagRequests);
  const [favoriteIds, setFavoriteIds] = useState(initialFavoriteIds);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("about");
  const [privacyReason, setPrivacyReason] = useState(privacyReasons[0]);
  const [preferences, setPreferences] = useState<Preferences>({
    showRealName: user.showRealName,
    allowOriginalDownload: user.allowOriginalDownload,
    reduceMotion: false,
    soundEnabled: false,
  });
  const [privacyForm, setPrivacyForm] = useState({
    photoId: relevantPhotos[0]?.id ?? "",
    kind: "hide" as "hide" | "delete",
    message: "",
  });
  const [privacyState, setPrivacyState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [privacyMessage, setPrivacyMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (demoMode) {
        try {
          setFavoriteIds(
            JSON.parse(
              window.localStorage.getItem("class-memory-favorites") ?? "[]",
            ),
          );
        } catch {
          setFavoriteIds([]);
        }
      }
      setPreferences((current) => ({
        ...current,
        reduceMotion: window.localStorage.getItem("reduce-motion") === "true",
        soundEnabled: window.localStorage.getItem("sound-enabled") === "true",
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoMode]);

  async function toggle(key: keyof Preferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSaved(false);
    window.localStorage.setItem("reduce-motion", String(next.reduceMotion));
    window.localStorage.setItem("sound-enabled", String(next.soundEnabled));
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (response.ok) setSaved(true);
  }

  async function decideConsent(
    photoId: string,
    consentStatus: "approved" | "rejected",
  ) {
    const response = await fetch(`/api/photos/${photoId}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentStatus }),
    });
    if (response.ok)
      setRequests((current) => current.filter((item) => item.id !== photoId));
  }

  async function submitPrivacyRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!privacyForm.photoId) return;
    setPrivacyState("sending");
    setPrivacyMessage("");
    const combinedMessage = privacyForm.message.trim()
      ? `${privacyReason}：${privacyForm.message.trim()}`
      : privacyReason;
    const response = await fetch("/api/privacy-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...privacyForm, message: combinedMessage }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setPrivacyState("sent");
      setPrivacyMessage("申请已交给管理员；接受后照片会先从相册隐藏。");
      setPrivacyForm((current) => ({ ...current, message: "" }));
    } else {
      setPrivacyState("error");
      setPrivacyMessage(result.error || "提交失败，请稍后再试。");
    }
  }

  const rows: Array<{ key: keyof Preferences; title: string; note: string }> = [
    {
      key: "showRealName",
      title: "显示真实姓名",
      note: "关闭后，其他同学只会看到你的昵称。",
    },
    {
      key: "allowOriginalDownload",
      title: "允许下载包含我的原图",
      note: "照片本身也必须同时开启原图下载。",
    },
    {
      key: "reduceMotion",
      title: "动画效果",
      note: "关闭后减少洗牌、视差和照片显影动画。",
    },
    {
      key: "soundEnabled",
      title: "背景音乐与快门声",
      note: "浏览随机回忆时播放轻微声音。",
    },
  ];

  const favoritePhotos = visiblePhotos.filter((photo) =>
    favoriteIds.includes(photo.id),
  );
  const uploadedPhotos = visiblePhotos.filter(
    (photo) => photo.uploadedBy === user.id,
  );
  const selectedPrivacyPhoto =
    relevantPhotos.find((photo) => photo.id === privacyForm.photoId) ??
    relevantPhotos[0] ??
    null;
  const displayedPhotos = useMemo(() => {
    if (activeTab === "favorites") return favoritePhotos;
    if (activeTab === "uploads") return uploadedPhotos;
    return relevantPhotos;
  }, [activeTab, favoritePhotos, relevantPhotos, uploadedPhotos]);

  const tabCopy = {
    about: ["关于我的照片", "这些照片记录了我在校园里的时光"],
    favorites: ["我的收藏", "只有你仍有权限查看的照片会出现在这里"],
    uploads: ["我的上传", "你提交并仍有权限查看的照片"],
    privacy: ["隐私相关照片", "选择右侧照片即可申请隐藏或删除"],
  }[activeTab];

  return (
    <div className="profile-reference">
      <section className="profile-reference-hero">
        <div className="profile-reference-avatar">{user.displayName.slice(0, 1)}</div>
        <div>
          <p>{user.role === "admin" ? "班级相册管理员" : "班级成员"}</p>
          <h1>{user.displayName}<span aria-hidden="true">⌁</span></h1>
          <small>
            出现在 {relevantPhotos.length} 张照片里 · 收藏 {favoritePhotos.length} 张 · 留下 {ownPhotoCount} 段回忆
          </small>
        </div>
        <i aria-hidden="true">⌁</i>
      </section>

      <nav className="profile-reference-tabs" aria-label="我的相册分类">
        {([
          ["about", "关于我的照片"],
          ["favorites", "我的收藏"],
          ["uploads", "我的上传"],
          ["privacy", "隐私与浏览偏好"],
        ] as Array<[ProfileTab, string]>).map(([value, label]) => (
          <button
            type="button"
            className={activeTab === value ? "active" : ""}
            onClick={() => setActiveTab(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className={`profile-reference-layout${activeTab === "privacy" ? " privacy-active" : ""}`}>
        <main className="profile-photo-library">
          <header>
            <div>
              <h2>{tabCopy[0]}<span aria-hidden="true">⌁</span></h2>
              <p>{tabCopy[1]}</p>
            </div>
            <span>{displayedPhotos.length} 张</span>
          </header>

          {displayedPhotos.length > 0 ? (
            <div className="profile-photo-grid">
              {displayedPhotos.map((photo, index) => (
                <Link href={`/photos?open=${photo.id}`} key={photo.id}>
                  <div>
                    <Image
                      src={photo.thumbnailUrl}
                      alt={photo.title}
                      fill
                      sizes="(max-width: 760px) 48vw, 220px"
                      unoptimized
                      loading={index < 2 ? "eager" : "lazy"}
                      suppressHydrationWarning
                    />
                    {favoriteIds.includes(photo.id) && <span>♥</span>}
                  </div>
                  <h3>{photo.title}</h3>
                  <p>⌖ {photo.location || "地点未填写"} · {photo.createdAt.slice(0, 10)}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="profile-photo-empty">
              <span aria-hidden="true">⌁</span>
              <b>这里暂时还没有照片</b>
              <p>去照片墙看看，或上传一段你记得的时光。</p>
            </div>
          )}

          {requests.length > 0 && (
            <section className="pending-consents profile-consent-card">
              <header>
                <b>{requests.length} 张照片等待你确认</b>
                <span>确认前，它们不会公开展示。</span>
              </header>
              {requests.map((photo, index) => (
                <article key={photo.id}>
                  <div>
                    <Image
                      src={photo.thumbnailUrl}
                      alt={photo.title}
                      fill
                      sizes="72px"
                      unoptimized
                      loading={index === 0 ? "eager" : "lazy"}
                      suppressHydrationWarning
                    />
                  </div>
                  <p><b>{photo.title}</b><span>{photo.location || "地点未填写"}</span></p>
                  <button type="button" onClick={() => decideConsent(photo.id, "approved")}>同意展示</button>
                  <button type="button" onClick={() => decideConsent(photo.id, "rejected")}>拒绝</button>
                </article>
              ))}
            </section>
          )}
        </main>

        <aside className="profile-reference-aside">
          <form
            id="profile-privacy-request"
            className="privacy-request-form profile-privacy-card"
            onSubmit={submitPrivacyRequest}
          >
            <div className="privacy-request-heading">
              <p>
                <b>申请隐藏或删除照片</b>
                <span>只有你和管理员能看到申请内容</span>
              </p>
              <small>▢</small>
            </div>
            {relevantPhotos.length > 0 ? (
              <>
                {selectedPrivacyPhoto && (
                  <div className="privacy-photo-preview" key={selectedPrivacyPhoto.id}>
                    <Link
                      href={`/photos?open=${selectedPrivacyPhoto.id}`}
                      aria-label={`查看大图：${selectedPrivacyPhoto.title}`}
                    >
                      <Image
                        src={selectedPrivacyPhoto.previewUrl}
                        alt={selectedPrivacyPhoto.title}
                        fill
                        sizes="(max-width: 760px) calc(100vw - 70px), 160px"
                        unoptimized
                        suppressHydrationWarning
                      />
                      <span>预览大图</span>
                    </Link>
                    <div>
                      <b>{selectedPrivacyPhoto.title}</b>
                      <p>{selectedPrivacyPhoto.location || "地点未填写"}</p>
                    </div>
                  </div>
                )}

                <label className="profile-photo-select">
                  <span>选择照片</span>
                  <select
                    value={privacyForm.photoId}
                    onChange={(event) =>
                      setPrivacyForm({ ...privacyForm, photoId: event.target.value })
                    }
                  >
                    {relevantPhotos.map((photo) => (
                      <option key={photo.id} value={photo.id}>{photo.title}</option>
                    ))}
                  </select>
                </label>

                <fieldset className="privacy-kind-options">
                  <legend>选择申请类型</legend>
                  <label className={privacyForm.kind === "hide" ? "active" : ""}>
                    <input
                      type="radio"
                      name="privacy-kind"
                      checked={privacyForm.kind === "hide"}
                      onChange={() => setPrivacyForm({ ...privacyForm, kind: "hide" })}
                    />
                    <b>隐藏<small>从个人视图中隐藏</small></b>
                  </label>
                  <label className={privacyForm.kind === "delete" ? "active" : ""}>
                    <input
                      type="radio"
                      name="privacy-kind"
                      checked={privacyForm.kind === "delete"}
                      onChange={() => setPrivacyForm({ ...privacyForm, kind: "delete" })}
                    />
                    <b>删除<small>申请从系统中永久删除</small></b>
                  </label>
                </fieldset>

                <fieldset className="privacy-reason-options">
                  <legend>选择原因（单选）</legend>
                  <div>
                    {privacyReasons.map((reason) => (
                      <button
                        type="button"
                        className={privacyReason === reason ? "active" : ""}
                        onClick={() => setPrivacyReason(reason)}
                        key={reason}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="privacy-note">
                  补充说明（选填）
                  <textarea
                    maxLength={Math.max(0, 499 - privacyReason.length)}
                    value={privacyForm.message}
                    onChange={(event) =>
                      setPrivacyForm({ ...privacyForm, message: event.target.value })
                    }
                    placeholder="可以简单说明原因，我们会认真处理。"
                  />
                </label>
                <button type="submit" disabled={privacyState === "sending"}>
                  <span>{privacyState === "sending" ? "正在提交…" : "▢ 提交申请"}</span>
                </button>
                {privacyMessage && (
                  <p className={`privacy-feedback ${privacyState}`}>{privacyMessage}</p>
                )}
              </>
            ) : (
              <p className="privacy-empty">目前没有可申请处理的照片。</p>
            )}
          </form>

          <section className="profile-preference-card">
            <div className="settings-heading">
              <div><h2>隐私与浏览偏好 <span aria-hidden="true">⌁</span></h2></div>
              {saved && <span>已保存</span>}
            </div>
            <div className="setting-list">
              {rows.map((row) => (
                <label key={row.key}>
                  <span><b>{row.title}</b><small>{row.note}</small></span>
                  <input
                    type="checkbox"
                    checked={preferences[row.key]}
                    onChange={() => toggle(row.key)}
                  />
                  <i aria-hidden="true" />
                </label>
              ))}
            </div>
          </section>

          <LogoutButton className="profile-logout" />
        </aside>
      </div>
    </div>
  );
}
