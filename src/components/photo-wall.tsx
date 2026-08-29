"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhotoOrderControl } from "@/components/photo-order-control";
import { PrivacyRequestDialog } from "@/components/privacy-request-dialog";
import { UploaderFilter } from "@/components/uploader-filter";
import { UserAvatar } from "@/components/user-avatar";
import { toggleFavoriteIds } from "@/lib/favorites";
import {
  ALL_UPLOADERS,
  filterPhotos,
  type UploaderFilterValue,
} from "@/lib/photo-filter";
import { orderPhotos, type PhotoOrder } from "@/lib/photo-order";
import type { Photo, PhotoComment } from "@/types/domain";

const wallCopy = {
  all: {
    searchLabel: "搜索照片",
    searchPlaceholder: "搜索照片、地点、人物、回忆…",
    resultUnit: "份回忆",
    openLabel: "查看照片",
    emptyTitle: "这一页暂时没有照片",
    emptyDescription: "换一个关键词或上传者，再找找看。",
    loadMore: "还有一些记忆正在显影……",
    download: "⇩ 下载原图",
    close: "关闭照片详情",
    previous: "上一张",
    next: "下一张",
    comment: "写一条照片留言",
  },
  video: {
    searchLabel: "搜索视频",
    searchPlaceholder: "搜索视频、地点、人物、回忆…",
    resultUnit: "段视频",
    openLabel: "播放视频",
    emptyTitle: "这里还没有视频",
    emptyDescription: "换一个关键词或上传者，或者上传第一段视频回忆。",
    loadMore: "还有一些视频正在加载……",
    download: "⇩ 下载原视频",
    close: "关闭视频详情",
    previous: "上一个视频",
    next: "下一个视频",
    comment: "写一条视频留言",
  },
} as const;

type Props = {
  photos: Photo[];
  variant?: "all" | "video";
  initialLimit?: number;
  initialSelectedId?: string | null;
  initialFavoriteIds?: string[];
  initialOrder: PhotoOrder;
  shuffleSeed: string;
  demoMode?: boolean;
  viewerId?: string;
};

export function PhotoWall({
  photos,
  variant = "all",
  initialLimit = 12,
  initialSelectedId = null,
  initialFavoriteIds = [],
  initialOrder,
  shuffleSeed,
  demoMode = false,
  viewerId,
}: Props) {
  const copy = wallCopy[variant];
  const searchId = variant === "video" ? "video-search" : "photo-search";
  const orderControlsId = variant === "video"
    ? "video-order-controls"
    : "photo-order-controls";
  const [query, setQuery] = useState("");
  const [uploader, setUploader] = useState<UploaderFilterValue>(ALL_UPLOADERS);
  const [limit, setLimit] = useState(initialLimit);
  const [order, setOrder] = useState<PhotoOrder>(initialOrder);
  const [randomSeed, setRandomSeed] = useState(shuffleSeed);
  const [orderControlsExpanded, setOrderControlsExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    photos.some((photo) => photo.id === initialSelectedId)
      ? initialSelectedId
      : null,
  );
  const [favorites, setFavorites] = useState<string[]>(initialFavoriteIds);
  const [commentsByPhoto, setCommentsByPhoto] = useState<Record<string, PhotoComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentError, setCommentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privacyRequestPhoto, setPrivacyRequestPhoto] = useState<Photo | null>(null);
  const touchStart = useRef<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const commentLoadVersion = useRef<Record<string, number>>({});
  const orderedPhotos = useMemo(
    () => orderPhotos(photos, order, randomSeed),
    [order, photos, randomSeed],
  );
  const filtered = useMemo(
    () => filterPhotos(orderedPhotos, query, uploader, viewerId),
    [orderedPhotos, query, uploader, viewerId],
  );
  const visible = filtered.slice(0, limit);
  const selectedIndex = filtered.findIndex((photo) => photo.id === selectedId);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;
  const modalOpen = Boolean(selected);
  const comments = selectedId ? (commentsByPhoto[selectedId] ?? []) : [];
  const commentText = selectedId ? (commentDrafts[selectedId] ?? "") : "";

  useEffect(() => {
    if (!demoMode) return;
    const timer = window.setTimeout(() => {
      try {
        setFavorites(
          JSON.parse(
            window.localStorage.getItem("class-memory-favorites") ?? "[]",
          ),
        );
      } catch {
        setFavorites([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoMode]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const loadVersion = (commentLoadVersion.current[selectedId] ?? 0) + 1;
    commentLoadVersion.current[selectedId] = loadVersion;
    fetch(`/api/photos/${selectedId}/comments`, { signal: controller.signal })
      .then((response) =>
        response.ok ? response.json() : ({ comments: [] } as const),
      )
      .then((data) => {
        if (commentLoadVersion.current[selectedId] !== loadVersion) return;
        setCommentsByPhoto((current) => ({
          ...current,
          [selectedId]: data.comments ?? [],
        }));
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (commentLoadVersion.current[selectedId] !== loadVersion) return;
        setCommentsByPhoto((current) => ({
          ...current,
          [selectedId]: [],
        }));
      });
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (!modalOpen) return;
    const fallbackFocus =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => {
      modalCloseRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      const returnTarget = modalTriggerRef.current ?? fallbackFocus;
      modalTriggerRef.current = null;
      returnTarget?.focus();
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedId]);

  const move = useCallback(
    (direction: number) => {
      if (filtered.length === 0 || selectedIndex < 0) return;
      setSelectedId(
        filtered[(selectedIndex + direction + filtered.length) % filtered.length]
          .id,
      );
    },
    [filtered, selectedIndex],
  );
  const closePrivacyRequest = useCallback(() => {
    setPrivacyRequestPhoto(null);
  }, []);

  const changeOrder = useCallback(
    (nextOrder: PhotoOrder) => {
      setOrder(nextOrder);
      setLimit(initialLimit);

      const url = new URL(window.location.href);
      url.searchParams.set("order", nextOrder);
      if (!selectedId) url.searchParams.delete("open");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    },
    [initialLimit, selectedId],
  );

  const reshuffle = useCallback(() => {
    const freshSeed = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${Math.random()}`;
    setRandomSeed((currentSeed) => `${currentSeed}:${freshSeed}`);
    setLimit(initialLimit);
  }, [initialLimit]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (!selected) return;
      if (privacyRequestPhoto) return;
      if (event.key === "Tab") {
        const modal = modalRef.current;
        if (!modal) return;
        const focusable = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = focusable[0] ?? modalCloseRef.current;
        const last = focusable.at(-1) ?? modalCloseRef.current;
        if (!first || !last) return;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !modal.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !modal.contains(active))) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, privacyRequestPhoto, selected]);

  async function toggleFavorite(photoId: string) {
    const next = toggleFavoriteIds(favorites, photoId);
    setFavorites(next);
    if (demoMode)
      window.localStorage.setItem(
        "class-memory-favorites",
        JSON.stringify(next),
      );
    await fetch(`/api/photos/${photoId}/favorite`, { method: "POST" });
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    const content = commentText.trim();
    if (!selected || !content || isSubmitting) return;

    const photoId = selected.id;
    setCommentError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCommentError(result.error || "留言失败");
        return;
      }
      setCommentsByPhoto((current) => ({
        ...current,
        [photoId]: [...(current[photoId] ?? []), result.comment],
      }));
      commentLoadVersion.current[photoId] =
        (commentLoadVersion.current[photoId] ?? 0) + 1;
      setCommentDrafts((current) =>
        (current[photoId] ?? "").trim() === content
          ? { ...current, [photoId]: "" }
          : current,
      );
    } catch {
      setCommentError("留言失败，请检查网络后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  const actionButtons = selected ? (
    <>
      <button
        type="button"
        className={favorites.includes(selected.id) ? "active" : ""}
        onClick={() => toggleFavorite(selected.id)}
      >
        {favorites.includes(selected.id) ? "♥ 已收藏" : "♡ 收藏"}
      </button>
      {selected.downloadAllowed && (
        <a href={`/api/photos/${selected.id}/download`}>{copy.download}</a>
      )}
      {selected.uploadedBy === viewerId ? (
        <Link href={`/profile?tab=uploads&manage=${selected.id}`}>
          管理我的上传
        </Link>
      ) : (
        <button
          type="button"
          className="privacy-request-action"
          onClick={() => setPrivacyRequestPhoto(selected)}
        >
          申请处理此内容
        </button>
      )}
    </>
  ) : null;

  return (
    <>
      <div className="photo-tools">
        <div className="photo-search">
          <span aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor={searchId}>
            {copy.searchLabel}
          </label>
          <input
            id={searchId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(initialLimit);
            }}
            placeholder={copy.searchPlaceholder}
          />
        </div>
        <UploaderFilter
          photos={photos}
          viewerId={viewerId ?? ""}
          value={uploader}
          mediaLabel={variant === "video" ? "视频" : "照片"}
          onChange={(nextUploader) => {
            setUploader(nextUploader);
            setLimit(initialLimit);
          }}
        />
        <span className="result-count">{filtered.length} {copy.resultUnit}</span>
        <button
          type="button"
          className="photo-order-toggle"
          aria-controls={orderControlsId}
          aria-expanded={orderControlsExpanded}
          aria-label={orderControlsExpanded ? "收起展示顺序" : "展开展示顺序"}
          title={orderControlsExpanded ? "收起展示顺序" : "展开展示顺序"}
          onClick={() => setOrderControlsExpanded((expanded) => !expanded)}
        >
          <span className={orderControlsExpanded ? "expanded" : ""}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m7 9 5 5 5-5" />
            </svg>
          </span>
        </button>
        <PhotoOrderControl
          id={orderControlsId}
          hidden={!orderControlsExpanded}
          order={order}
          mediaLabel={variant === "video" ? "视频" : "照片"}
          onChange={changeOrder}
          onReshuffle={reshuffle}
        />
      </div>

      {visible.length ? (
        <div className="photo-wall">
          {visible.map((photo, index) => (
            <article
              className="wall-card"
              key={photo.id}
              style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}
            >
              <button
                type="button"
                onClick={(event) => {
                  modalTriggerRef.current = event.currentTarget;
                  setSelectedId(photo.id);
                }}
                aria-label={`${copy.openLabel}：${photo.title}`}
              >
                <div
                  className="wall-image"
                  style={{
                    aspectRatio: photo.width > 0 && photo.height > 0 ? `${photo.width} / ${photo.height}` : "4 / 3",
                  }}
                >
                  <Image
                    src={photo.thumbnailUrl}
                    alt={`${photo.title}，${photo.location}`}
                    fill
                    sizes="(max-width: 520px) 48vw, (max-width: 900px) 31vw, 20vw"
                    unoptimized
                    loading={index < Math.min(initialLimit, 8) ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : undefined}
                    suppressHydrationWarning
                  />
                  <span className="wall-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="wall-open" aria-hidden="true">
                    ↗
                  </span>
                  {photo.mediaType === "video" ? (
                    <span className="wall-media-type">▶ 视频</span>
                  ) : null}
                </div>
                <div className="wall-caption">
                  <div>
                    <h3>{photo.title}</h3>
                    <p>⌖ {photo.location || "地点记不清了"}</p>
                  </div>
                  <span>
                    {photo.people.length ? `${photo.people.length} 人` : "一段回忆"}
                  </span>
                </div>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-photos">
          <span>⌁</span>
          <h3>{copy.emptyTitle}</h3>
          <p>{copy.emptyDescription}</p>
        </div>
      )}

      {visible.length < filtered.length && (
        <button
          className="load-more"
          type="button"
          onClick={() => setLimit((value) => value + 8)}
        >
          <span>{copy.loadMore}</span>
          <b>再看一些</b>
        </button>
      )}

      {selected && (
        <div
          ref={modalRef}
          className="photo-modal"
          role="dialog"
          aria-modal="true"
          aria-hidden={privacyRequestPhoto ? true : undefined}
          inert={privacyRequestPhoto ? true : undefined}
          aria-label={selected.title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <button
            ref={modalCloseRef}
            className="modal-close"
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label={copy.close}
          >
            ×
          </button>
          <article className="photo-detail">
            <div
              className="detail-image-column"
              onTouchStart={(event) => {
                if (selected.mediaType === "video") {
                  touchStart.current = null;
                  return;
                }
                touchStart.current = event.touches[0].clientX;
              }}
              onTouchEnd={(event) => {
                if (selected.mediaType === "video") {
                  touchStart.current = null;
                  return;
                }
                if (touchStart.current === null) return;
                const delta = event.changedTouches[0].clientX - touchStart.current;
                if (Math.abs(delta) > 60) move(delta < 0 ? 1 : -1);
                touchStart.current = null;
              }}
            >
              <span className="detail-mobile-counter">
                {selectedIndex + 1} / {filtered.length}
              </span>
              <button
                className="modal-arrow modal-prev"
                type="button"
                onClick={() => move(-1)}
                aria-label={copy.previous}
              >
                ‹
              </button>
              <div className="detail-image-wrap">
                {selected.mediaType === "video" ? (
                  <video
                    key={selected.id}
                    src={selected.mediaUrl}
                    poster={selected.previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={`${selected.title}，${selected.description}`}
                  />
                ) : (
                  <Image
                    src={selected.previewUrl}
                    alt={`${selected.title}，${selected.description}`}
                    fill
                    sizes="(max-width: 800px) 100vw, 64vw"
                    unoptimized
                    priority
                    suppressHydrationWarning
                  />
                )}
              </div>
              <footer className="detail-image-footer">
                <span aria-hidden="true">▦</span>
                <p>
                  <b>{selectedIndex + 1}</b> / {filtered.length}
                </p>
                <div className="detail-actions">{actionButtons}</div>
              </footer>
              <button
                className="modal-arrow modal-next"
                type="button"
                onClick={() => move(1)}
                aria-label={copy.next}
              >
                ›
              </button>
            </div>
            <aside className="detail-copy">
              <div className="detail-overview">
                <p className="detail-kicker">
                  MEMORY {String(selectedIndex + 1).padStart(2, "0")}
                </p>
                <h2>{selected.title}</h2>
                <p className="detail-description">{selected.description}</p>
                <dl>
                  <div>
                    <dt>⌖</dt>
                    <dd>{selected.location || "记不清了"}</dd>
                  </div>
                  <div>
                    <dt>♙</dt>
                    <dd>
                      {selected.people.map((person) => person.name).join("、") ||
                        "还没有标记人物"}
                    </dd>
                  </div>
                  <div className="detail-uploader">
                    <dt>上传者</dt>
                    <dd>
                      <UserAvatar
                        user={{
                          id: selected.uploadedBy,
                          displayName: selected.uploaderName,
                          email: "",
                          avatarKey: null,
                        }}
                        className="detail-uploader-avatar"
                        size={30}
                        avatarEndpoint={`/api/members/${encodeURIComponent(selected.uploadedBy)}/avatar`}
                        alwaysTryRemote
                        listenForUpdates={false}
                      />
                      <span>{selected.uploaderName}</span>
                    </dd>
                  </div>
                </dl>
                <div className="detail-tags">
                  {selected.tags.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div className="detail-actions detail-actions-mobile">
                  {actionButtons}
                </div>
              </div>
              <section className="comments">
                <h3>
                  同学留言 <span>{comments.length}</span>
                </h3>
                <div className="comment-list">
                  {comments.map((comment) => (
                    <div key={comment.id}>
                      <b>{comment.authorName.slice(0, 1)}</b>
                      <p>
                        <strong>{comment.authorName}</strong>
                        {comment.content}
                      </p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <small>还没有人留言，写下你记得的事吧。</small>
                  )}
                </div>
                <form onSubmit={submitComment} aria-busy={isSubmitting}>
                  <label className="sr-only" htmlFor="comment-text">
                    {copy.comment}
                  </label>
                  <input
                    id="comment-text"
                    value={commentText}
                    onChange={(event) => {
                      if (!selectedId) return;
                      setCommentDrafts((current) => ({
                        ...current,
                        [selectedId]: event.target.value,
                      }));
                    }}
                    maxLength={300}
                    placeholder="我记得……"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !commentText.trim()}
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting ? "发送中…" : "发送"}
                  </button>
                </form>
                {commentError && (
                  <p className="comment-error">{commentError}</p>
                )}
              </section>
            </aside>
          </article>
        </div>
      )}
      {privacyRequestPhoto && (
        <PrivacyRequestDialog
          key={privacyRequestPhoto.id}
          photo={privacyRequestPhoto}
          onClose={closePrivacyRequest}
        />
      )}
    </>
  );
}
