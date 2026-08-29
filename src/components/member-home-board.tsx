"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Photo, PhotoComment } from "@/types/domain";

const filters = ["全部", "教室", "操场", "朋友", "毕业"];

function stableTime(value: string) {
  const time = value.match(/T(\d{2}):(\d{2})/);
  return time ? `今天 ${time[1]}:${time[2]}` : "刚刚";
}

export function MemberHomeBoard({
  photos,
  displayName,
}: {
  photos: Photo[];
  displayName: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const featured = photos[0] ?? null;

  const visiblePhotos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return photos.filter((photo) => {
      const matchesFilter =
        filter === "全部" ||
        photo.tags.some((tag) => tag.includes(filter)) ||
        photo.location.includes(filter);
      const haystack = [
        photo.title,
        photo.description,
        photo.location,
        ...photo.tags,
        ...photo.people.map((person) => person.name),
      ]
        .join(" ")
        .toLowerCase();
      return matchesFilter && (!normalized || haystack.includes(normalized));
    });
  }, [filter, photos, query]);

  const mobilePhotos = visiblePhotos.slice(0, 8);
  useEffect(() => {
    if (!featured) return;
    const controller = new AbortController();
    fetch(`/api/photos/${featured.id}/comments`, { signal: controller.signal })
      .then((response) =>
        response.ok ? response.json() : ({ comments: [] } as const),
      )
      .then((data) => setComments(data.comments ?? []))
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setComments([]);
      });
    return () => controller.abort();
  }, [featured]);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = commentText.trim();
    if (!featured || !content || isSubmitting) return;

    setCommentError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/photos/${featured.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCommentError(result.error || "留言发送失败，请稍后再试。");
        return;
      }
      setComments((current) => [...current, result.comment]);
      setCommentText("");
    } catch {
      setCommentError("留言发送失败，请检查网络后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="memory-board">
      <section className="memory-board-main">
        <header className="memory-board-heading desktop-memory-heading">
          <p>OUR CLASS ARCHIVE</p>
          <h1>
            拾光簿<span aria-hidden="true">⌁</span>
          </h1>
          <h2>散落在各处的我们</h2>
          <small>不按时间，只按记忆</small>
        </header>

        <header className="memory-board-heading mobile-memory-heading">
          <p>欢迎回来，{displayName}</p>
          <h1>
            今天，想起了哪一刻？<span aria-hidden="true">⌁</span>
          </h1>
        </header>

        {featured ? (
          <Link
            className="mobile-featured-memory"
            href={`/photos?open=${featured.id}`}
          >
            <div>
              <Image
                src={featured.previewUrl}
                alt={featured.title}
                fill
                sizes="42vw"
                unoptimized
                priority
                suppressHydrationWarning
              />
            </div>
            <span>
              <b>{featured.title}</b>
              <small>{featured.description || "那一天留下的一小段光。"}</small>
              <i>⌖ {featured.location || "地点记不清了"}</i>
            </span>
          </Link>
        ) : (
          <div className="mobile-featured-memory empty-home-memory">
            相册还没有照片，上传第一段回忆吧。
          </div>
        )}

        <div className="memory-collage" aria-label="班级回忆精选">
          {photos.slice(0, 6).map((photo, index) => (
            <Link
              href={`/photos?open=${photo.id}`}
              className={`memory-polaroid memory-polaroid-${index + 1}`}
              key={photo.id}
            >
              <div>
                <Image
                  src={index === 2 ? photo.previewUrl : photo.thumbnailUrl}
                  alt={photo.title}
                  fill
                  sizes="(max-width: 900px) 48vw, 28vw"
                  unoptimized
                  loading={index === 2 ? "eager" : "lazy"}
                  suppressHydrationWarning
                />
              </div>
              <h3>{photo.title}</h3>
              <p>⌖ {photo.location || "地点记不清了"}</p>
              <span aria-hidden="true">
                {photo.people.slice(0, 3).map((person) => (
                  <i key={person.id}>{person.name.slice(0, 1)}</i>
                ))}
                {photo.people.length > 3 && <b>+{photo.people.length - 3}</b>}
              </span>
            </Link>
          ))}
        </div>

        <div className="memory-primary-actions">
          <Link href="/random?mode=shuffle" className="memory-random-action">
            <span aria-hidden="true">⌘</span> 随机翻一张
          </Link>
          <Link href="/upload" className="memory-upload-action">
            <span aria-hidden="true">⇧</span> 上传回忆
          </Link>
          <small>▣ 仅本班同学可见</small>
        </div>

        <div className="mobile-memory-tools">
          <Link href="/random?mode=shuffle" className="mobile-random-action">
            <span aria-hidden="true">⌘</span> 随机翻一张
          </Link>
          <label className="mobile-memory-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">搜索照片</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索照片、地点、人物、回忆…"
            />
          </label>
          <div className="mobile-memory-filters" aria-label="照片分类">
            {filters.map((item) => (
              <button
                type="button"
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <section className="mobile-memory-grid" aria-label="照片列表">
          {mobilePhotos.map((photo) => (
            <Link href={`/photos?open=${photo.id}`} key={photo.id}>
              <div>
                <Image
                  src={photo.thumbnailUrl}
                  alt={photo.title}
                  fill
                  sizes="48vw"
                  unoptimized
                  suppressHydrationWarning
                />
              </div>
              <h3>{photo.title}</h3>
              <p>{photo.description || "这一刻，我们都记得。"}</p>
              <span>⌖ {photo.location || "地点记不清了"}</span>
            </Link>
          ))}
          {visiblePhotos.length > mobilePhotos.length && (
            <Link className="mobile-memory-more" href="/photos">
              查看全部 {visiblePhotos.length} 张照片 →
            </Link>
          )}
          {visiblePhotos.length === 0 && (
            <p className="mobile-memory-empty">没有找到相关照片，换个词试试。</p>
          )}
        </section>
      </section>

      <aside className="memory-message-panel">
        <header>
          <div>
            <p>同学留言</p>
            <span>{featured ? `关于「${featured.title}」` : "班级相册"}</span>
          </div>
          <i aria-hidden="true">⌁</i>
        </header>
        <div className="memory-message-list">
          {comments.map((comment) => (
            <article key={comment.id}>
              <b>{comment.authorName.slice(0, 1)}</b>
              <div>
                <p>
                  <strong>{comment.authorName}</strong>
                  <time>{stableTime(comment.createdAt)}</time>
                </p>
                <span>{comment.content}</span>
                <small>♥ · 回复</small>
              </div>
            </article>
          ))}
          {comments.length === 0 && (
            <div className="memory-message-empty">
              <span aria-hidden="true">⌁</span>
              <b>还没有留言</b>
              <p>写下你记得的事，成为第一条回忆。</p>
            </div>
          )}
        </div>
        <form onSubmit={submitComment} aria-busy={isSubmitting}>
          <label className="sr-only" htmlFor="home-memory-comment">
            写一条照片留言
          </label>
          <input
            id="home-memory-comment"
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            maxLength={300}
            placeholder="我记得……"
            disabled={!featured}
          />
          <button
            type="submit"
            disabled={!featured || !commentText.trim() || isSubmitting}
            aria-busy={isSubmitting}
            aria-label={isSubmitting ? "留言发送中" : "发送留言"}
          >
            {isSubmitting ? "…" : "↗"}
          </button>
        </form>
        {commentError && <p className="memory-message-error">{commentError}</p>}
      </aside>
    </div>
  );
}
