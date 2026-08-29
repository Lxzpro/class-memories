"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { OwnedMediaManager } from "@/components/owned-media-manager";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";
import type { UploadMemberOption } from "@/lib/photos";
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
  ownedMedia: Photo[];
  members: UploadMemberOption[];
  relevantPhotos: Photo[];
  visiblePhotos: Photo[];
  initialFavoriteIds: string[];
  demoMode: boolean;
  initialTab?: ProfileTab;
  initialManageId?: string | null;
};

type ProfileTab = "about" | "favorites" | "uploads" | "privacy";

const privacyReasons = ["不想公开", "不喜欢这张照片", "涉及个人隐私", "其他"];

export function ProfileSettings({
  user,
  ownedMedia: initialOwnedMedia,
  members,
  relevantPhotos,
  visiblePhotos,
  initialFavoriteIds,
  demoMode,
  initialTab = "about",
  initialManageId = null,
}: Props) {
  const [ownedMedia, setOwnedMedia] = useState(initialOwnedMedia);
  const [favoriteIds, setFavoriteIds] = useState(initialFavoriteIds);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [privacyReason, setPrivacyReason] = useState(privacyReasons[0]);
  const [preferences, setPreferences] = useState<Preferences>({
    showRealName: user.showRealName,
    allowOriginalDownload: user.allowOriginalDownload,
    reduceMotion: false,
    soundEnabled: false,
  });
  const [privacyForm, setPrivacyForm] = useState({
    photoId:
      relevantPhotos.find((photo) => photo.uploadedBy !== user.id)?.id ?? "",
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

  async function submitPrivacyRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!privacyForm.photoId) return;
    setPrivacyState("sending");
    setPrivacyMessage("");
    const combinedMessage = privacyForm.message.trim()
      ? `${privacyReason}：${privacyForm.message.trim()}`
      : privacyReason;
    try {
      const response = await fetch("/api/privacy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...privacyForm, message: combinedMessage }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPrivacyState("error");
        setPrivacyMessage(result.error || "提交失败，请稍后再试。");
        return;
      }
      setPrivacyState("sent");
      setPrivacyMessage("申请已交给管理员；接受后内容会先从相册隐藏。");
      setPrivacyForm((current) => ({ ...current, message: "" }));
    } catch {
      setPrivacyState("error");
      setPrivacyMessage("网络连接失败，请稍后再试。");
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
      title: "减少动画",
      note: "开启后减少洗牌、视差和照片显影动画。",
    },
    {
      key: "soundEnabled",
      title: "背景音乐与快门声",
      note: "浏览随机回忆时播放轻微声音。",
    },
  ];

  const ownedById = useMemo(
    () => new Map(ownedMedia.map((photo) => [photo.id, photo])),
    [ownedMedia],
  );
  const currentVisiblePhotos = useMemo(
    () =>
      visiblePhotos.flatMap((photo) => {
        if (photo.uploadedBy !== user.id) return [photo];
        const owned = ownedById.get(photo.id);
        return owned?.reviewStatus === "published" ? [owned] : [];
      }),
    [ownedById, user.id, visiblePhotos],
  );
  const currentRelevantPhotos = useMemo(
    () =>
      relevantPhotos.flatMap((photo) => {
        if (photo.uploadedBy !== user.id) return [photo];
        const owned = ownedById.get(photo.id);
        return owned?.reviewStatus === "published" ? [owned] : [];
      }),
    [ownedById, relevantPhotos, user.id],
  );
  const requestablePhotos = currentRelevantPhotos.filter(
    (photo) => photo.uploadedBy !== user.id,
  );
  const favoritePhotos = currentVisiblePhotos.filter((photo) =>
    favoriteIds.includes(photo.id),
  );
  const selectedPrivacyPhoto =
    requestablePhotos.find((photo) => photo.id === privacyForm.photoId) ??
    requestablePhotos[0] ??
    null;
  const displayedPhotos = useMemo(() => {
    if (activeTab === "favorites") return favoritePhotos;
    if (activeTab === "uploads") return [];
    return currentRelevantPhotos;
  }, [activeTab, currentRelevantPhotos, favoritePhotos]);
  const displayedCount =
    activeTab === "uploads" ? ownedMedia.length : displayedPhotos.length;

  const tabCopy = {
    about: ["关于我的照片", "这些照片记录了我在校园里的时光"],
    favorites: ["我的收藏", "只有你仍有权限查看的照片会出现在这里"],
    uploads: ["我的上传", "照片和视频都由你直接编辑、隐藏或永久删除"],
    privacy: ["与我相关的内容", "对别人上传且与你相关的内容申请处理"],
  }[activeTab];

  return (
    <div className="profile-reference">
      <section className="profile-reference-hero">
        <ProfileAvatarEditor user={user} />
        <div>
          <p>{user.role === "admin" ? "班级相册管理员" : "班级成员"}</p>
          <h1>{user.displayName}<span aria-hidden="true">⌁</span></h1>
          <small>
            出现在 {currentRelevantPhotos.length} 份回忆里 · 收藏 {favoritePhotos.length} 份 · 上传 {ownedMedia.length} 份
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

      <div
        className={`profile-reference-layout${activeTab === "privacy" ? " privacy-active" : ""}${activeTab === "uploads" ? " uploads-active" : ""}`}
      >
        <main className="profile-photo-library">
          <header>
            <div>
              <h2>{tabCopy[0]}<span aria-hidden="true">⌁</span></h2>
              <p>{tabCopy[1]}</p>
            </div>
            <span>{displayedCount} 份</span>
          </header>

          {activeTab === "uploads" ? (
            <OwnedMediaManager
              media={ownedMedia}
              members={members}
              initialManageId={initialManageId}
              onChange={setOwnedMedia}
            />
          ) : displayedPhotos.length > 0 ? (
            <div className="profile-photo-grid">
              {displayedPhotos.map((photo, index) => (
                <Link
                  href={`${photo.mediaType === "video" ? "/videos" : "/photos"}?open=${photo.id}`}
                  key={photo.id}
                >
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
              <b>这里暂时还没有内容</b>
              <p>去媒体墙看看，或上传一段你记得的时光。</p>
            </div>
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
                <b>申请处理他人上传的内容</b>
                <span>只有你和管理员能看到申请内容</span>
              </p>
              <small>▢</small>
            </div>
            {requestablePhotos.length > 0 ? (
              <>
                {selectedPrivacyPhoto && (
                  <div className="privacy-photo-preview" key={selectedPrivacyPhoto.id}>
                    <Link
                      href={`${selectedPrivacyPhoto.mediaType === "video" ? "/videos" : "/photos"}?open=${selectedPrivacyPhoto.id}`}
                      aria-label={`查看内容：${selectedPrivacyPhoto.title}`}
                    >
                      <Image
                        src={selectedPrivacyPhoto.previewUrl}
                        alt={selectedPrivacyPhoto.title}
                        fill
                        sizes="(max-width: 760px) calc(100vw - 70px), 160px"
                        unoptimized
                        suppressHydrationWarning
                      />
                      <span>预览内容</span>
                    </Link>
                    <div>
                      <b>{selectedPrivacyPhoto.title}</b>
                      <p>{selectedPrivacyPhoto.location || "地点未填写"}</p>
                    </div>
                  </div>
                )}

                <label className="profile-photo-select">
                  <span>选择照片或视频</span>
                  <select
                    value={privacyForm.photoId}
                    onChange={(event) =>
                      setPrivacyForm({ ...privacyForm, photoId: event.target.value })
                    }
                  >
                    {requestablePhotos.map((photo) => (
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
              <p className="privacy-empty">
                目前没有别人上传且与你相关的内容。
              </p>
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
