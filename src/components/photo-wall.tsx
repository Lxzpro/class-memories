"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toggleFavoriteIds } from "@/lib/favorites";
import { filterPhotos } from "@/lib/photo-filter";
import type { Photo, PhotoComment } from "@/types/domain";

const defaultTags = ["全部", "教室", "操场", "朋友", "搞怪", "毕业", "珍贵"];

type Props = {
  photos: Photo[];
  initialLimit?: number;
  initialSelectedId?: string | null;
  initialFavoriteIds?: string[];
  demoMode?: boolean;
};

export function PhotoWall({
  photos,
  initialLimit = 12,
  initialSelectedId = null,
  initialFavoriteIds = [],
  demoMode = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("全部");
  const [limit, setLimit] = useState(initialLimit);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    photos.some((photo) => photo.id === initialSelectedId)
      ? initialSelectedId
      : null,
  );
  const [favorites, setFavorites] = useState<string[]>(initialFavoriteIds);
  const [commentsByPhoto, setCommentsByPhoto] = useState<Record<string, PhotoComment[]>>({});
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const touchStart = useRef<number | null>(null);
  const filtered = useMemo(
    () => filterPhotos(photos, query, tag),
    [photos, query, tag],
  );
  const visible = filtered.slice(0, limit);
  const selectedIndex = filtered.findIndex((photo) => photo.id === selectedId);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;
  const comments = selectedId ? (commentsByPhoto[selectedId] ?? []) : [];

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
    fetch(`/api/photos/${selectedId}/comments`, { signal: controller.signal })
      .then((response) =>
        response.ok ? response.json() : ({ comments: [] } as const),
      )
      .then((data) =>
        setCommentsByPhoto((current) => ({
          ...current,
          [selectedId]: data.comments ?? [],
        })),
      )
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setCommentsByPhoto((current) => ({
          ...current,
          [selectedId]: [],
        }));
      });
    return () => controller.abort();
  }, [selectedId]);

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

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (!selected) return;
      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, selected]);

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
    if (!selected || !commentText.trim()) return;
    setCommentError("");
    const response = await fetch(`/api/photos/${selected.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentText.trim() }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCommentError(result.error || "留言失败");
      return;
    }
    setCommentsByPhoto((current) => ({
      ...current,
      [selected.id]: [...(current[selected.id] ?? []), result.comment],
    }));
    setCommentText("");
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
        <a href={`/api/photos/${selected.id}/download`}>⇩ 下载原图</a>
      )}
    </>
  ) : null;

  return (
    <>
      <div className="photo-tools">
        <div className="photo-search">
          <span aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor="photo-search">
            搜索照片
          </label>
          <input
            id="photo-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(initialLimit);
            }}
            placeholder="搜索照片、地点、人物、回忆…"
          />
        </div>
        <div className="tag-scroller" aria-label="照片标签筛选">
          {defaultTags.map((item) => (
            <button
              key={item}
              className={tag === item ? "active" : ""}
              type="button"
              onClick={() => {
                setTag(item);
                setLimit(initialLimit);
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="result-count">{filtered.length} 张照片</span>
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
                onClick={() => setSelectedId(photo.id)}
                aria-label={`查看照片：${photo.title}`}
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
                    loading="lazy"
                    suppressHydrationWarning
                  />
                  <span className="wall-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="wall-open" aria-hidden="true">
                    ↗
                  </span>
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
          <h3>这一页暂时没有照片</h3>
          <p>换一个关键词或标签，再找找看。</p>
        </div>
      )}

      {visible.length < filtered.length && (
        <button
          className="load-more"
          type="button"
          onClick={() => setLimit((value) => value + 8)}
        >
          <span>还有一些记忆正在显影……</span>
          <b>再看一些</b>
        </button>
      )}

      {selected && (
        <div
          className="photo-modal"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <button
            className="modal-close"
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="关闭照片详情"
          >
            ×
          </button>
          <article className="photo-detail">
            <div
              className="detail-image-column"
              onTouchStart={(event) => {
                touchStart.current = event.touches[0].clientX;
              }}
              onTouchEnd={(event) => {
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
                aria-label="上一张"
              >
                ‹
              </button>
              <div className="detail-image-wrap">
                <Image
                  src={selected.previewUrl}
                  alt={`${selected.title}，${selected.description}`}
                  fill
                  sizes="(max-width: 800px) 100vw, 64vw"
                  unoptimized
                  priority
                  suppressHydrationWarning
                />
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
                aria-label="下一张"
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
                <form onSubmit={submitComment}>
                  <label className="sr-only" htmlFor="comment-text">
                    写一条照片留言
                  </label>
                  <input
                    id="comment-text"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    maxLength={300}
                    placeholder="我记得……"
                  />
                  <button type="submit">发送</button>
                </form>
                {commentError && (
                  <p className="comment-error">{commentError}</p>
                )}
              </section>
            </aside>
          </article>
        </div>
      )}
    </>
  );
}
