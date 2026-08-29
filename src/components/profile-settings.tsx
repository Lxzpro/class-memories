"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { OwnedMediaManager } from "@/components/owned-media-manager";
import { ProfileAvatarEditor } from "@/components/profile-avatar-editor";
import { PrivacyRequestHistory } from "@/components/privacy-request-history";
import type { UploadMemberOption } from "@/lib/photos";
import { getPublicProfileName } from "@/lib/profile-identity";
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
  const router = useRouter();
  const [ownedMedia, setOwnedMedia] = useState(initialOwnedMedia);
  const [favoriteIds, setFavoriteIds] = useState(initialFavoriteIds);
  const [saved, setSaved] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [savingPreference, setSavingPreference] = useState<
    "showRealName" | "allowOriginalDownload" | null
  >(null);
  const preferenceBusyRef = useRef(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [identity, setIdentity] = useState({
    displayName: user.displayName,
    realName: user.realName ?? "",
  });
  const [identityDraft, setIdentityDraft] = useState(identity);
  const [identityState, setIdentityState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [identityFeedback, setIdentityFeedback] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    showRealName: user.showRealName,
    allowOriginalDownload: user.allowOriginalDownload,
    reduceMotion: false,
    soundEnabled: false,
  });

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
    const previousValue = preferences[key];
    const nextValue = !previousValue;

    if (key === "reduceMotion" || key === "soundEnabled") {
      setPreferences((current) => ({ ...current, [key]: nextValue }));
      window.localStorage.setItem(
        key === "reduceMotion" ? "reduce-motion" : "sound-enabled",
        String(nextValue),
      );
      setPreferenceError("");
      setSaved(true);
      return;
    }

    if (preferenceBusyRef.current) return;
    preferenceBusyRef.current = true;
    setSavingPreference(key);
    setPreferences((current) => ({ ...current, [key]: nextValue }));
    setSaved(false);
    setPreferenceError("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: nextValue }),
      });
      if (response.ok) {
        setSaved(true);
        if (key === "showRealName") router.refresh();
        return;
      }
    } catch {
      // Restore only the server-backed preference changed by this request.
    } finally {
      preferenceBusyRef.current = false;
      setSavingPreference(null);
    }
    setPreferences((current) => ({ ...current, [key]: previousValue }));
    setPreferenceError("保存失败，开关已恢复，请检查网络后重试。");
  }

  async function saveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityState("saving");
    setIdentityFeedback("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: identityDraft.displayName.trim(),
          realName: identityDraft.realName.trim(),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: { displayName?: string; realName?: string | null };
      };
      if (!response.ok) {
        setIdentityState("error");
        setIdentityFeedback(result.error || "个人资料保存失败，请稍后再试。");
        return;
      }
      const nextIdentity = {
        displayName: result.profile?.displayName ?? identityDraft.displayName.trim(),
        realName: result.profile?.realName ?? "",
      };
      setIdentity(nextIdentity);
      setIdentityDraft(nextIdentity);
      setIdentityState("saved");
      setIdentityFeedback("昵称和真实姓名已保存。");
      router.refresh();
    } catch {
      setIdentityState("error");
      setIdentityFeedback("网络连接失败，请稍后再试。");
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
  const favoritePhotos = currentVisiblePhotos.filter((photo) =>
    favoriteIds.includes(photo.id),
  );
  const displayedPhotos = useMemo(() => {
    if (activeTab === "favorites") return favoritePhotos;
    if (activeTab === "uploads" || activeTab === "privacy") return [];
    return currentRelevantPhotos;
  }, [activeTab, currentRelevantPhotos, favoritePhotos]);
  const displayedCount =
    activeTab === "uploads" ? ownedMedia.length : displayedPhotos.length;
  const publicName = getPublicProfileName({
    displayName: identity.displayName,
    realName: identity.realName || null,
    showRealName: preferences.showRealName,
  });

  const tabCopy = {
    about: ["关于我的照片", "这些照片记录了我在校园里的时光"],
    favorites: ["我的收藏", "只有你仍有权限查看的照片会出现在这里"],
    uploads: ["我的上传", "照片和视频都由你直接编辑、隐藏或永久删除"],
    privacy: ["个人资料与申请", "管理姓名公开方式，并查看隐私申请的处理进度"],
  }[activeTab];

  return (
    <div className="profile-reference">
      <section className="profile-reference-hero">
        <ProfileAvatarEditor
          user={{
            ...user,
            ...identity,
            displayName: publicName,
            realName: identity.realName || null,
          }}
        />
        <div>
          <p>{user.role === "admin" ? "班级相册管理员" : "班级成员"}</p>
          <h1>{publicName}<span aria-hidden="true">⌁</span></h1>
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
            aria-pressed={activeTab === value}
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
          {activeTab === "privacy" ? (
            <PrivacyRequestHistory />
          ) : (
            <>
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
            </>
          )}
        </main>

        <aside className="profile-reference-aside">
          <form
            className="profile-identity-card"
            onSubmit={saveIdentity}
          >
            <div className="profile-identity-heading">
              <div>
                <small>PROFILE IDENTITY</small>
                <h2>我的姓名</h2>
              </div>
              {identityState === "saved" && <span>已保存</span>}
            </div>
            <p>
              昵称始终是你的备用公开名称；真实姓名只会在你开启下方开关时向同学显示。
            </p>
            <label>
              <span>昵称</span>
              <input
                type="text"
                required
                minLength={2}
                maxLength={30}
                autoComplete="nickname"
                value={identityDraft.displayName}
                onChange={(event) => {
                  setIdentityDraft((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }));
                  setIdentityState("idle");
                  setIdentityFeedback("");
                }}
              />
            </label>
            <label>
              <span>真实姓名 <small>旧账号可暂时不填</small></span>
              <input
                type="text"
                minLength={2}
                maxLength={30}
                autoComplete="name"
                value={identityDraft.realName}
                onChange={(event) => {
                  setIdentityDraft((current) => ({
                    ...current,
                    realName: event.target.value,
                  }));
                  setIdentityState("idle");
                  setIdentityFeedback("");
                }}
                placeholder="填写你在班级里的真实姓名"
              />
            </label>
            <button type="submit" disabled={identityState === "saving"}>
              {identityState === "saving" ? "正在保存…" : "保存姓名资料"}
            </button>
            {identityFeedback && (
              <p
                className={`profile-identity-feedback ${identityState}`}
                role={identityState === "error" ? "alert" : "status"}
              >
                {identityFeedback}
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
                    disabled={
                      savingPreference !== null &&
                      (row.key === "showRealName" ||
                        row.key === "allowOriginalDownload")
                    }
                  />
                  <i aria-hidden="true" />
                </label>
              ))}
            </div>
            {preferenceError && (
              <p className="profile-preference-error" role="alert">{preferenceError}</p>
            )}
          </section>

          <LogoutButton className="profile-logout" />
        </aside>
      </div>
    </div>
  );
}
