"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterPhotos } from "@/lib/photo-filter";
import { toggleFavoriteIds } from "@/lib/favorites";
import type { Photo, PhotoComment } from "@/types/domain";

const defaultTags = ["全部", "教室", "操场", "朋友", "搞怪", "毕业", "珍贵"];

export function PhotoWall({ photos, initialLimit = 12, initialSelectedId = null, initialFavoriteIds = [], demoMode = false }: { photos: Photo[]; initialLimit?: number; initialSelectedId?: string | null; initialFavoriteIds?: string[]; demoMode?: boolean }) {
  const [query, setQuery] = useState(""); const [tag, setTag] = useState("全部");
  const [limit, setLimit] = useState(initialLimit); const [selectedId, setSelectedId] = useState<string | null>(() => photos.some((photo) => photo.id === initialSelectedId) ? initialSelectedId : null);
  const [favorites, setFavorites] = useState<string[]>(initialFavoriteIds); const [comments, setComments] = useState<PhotoComment[]>([]);
  const [commentText, setCommentText] = useState(""); const [commentError, setCommentError] = useState("");
  const touchStart = useRef<number | null>(null);
  const filtered = useMemo(() => filterPhotos(photos, query, tag), [photos, query, tag]);
  const visible = filtered.slice(0, limit);
  const selectedIndex = filtered.findIndex((photo) => photo.id === selectedId);
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  useEffect(() => {
    if (!demoMode) return;
    const timer = window.setTimeout(() => {
      try { setFavorites(JSON.parse(window.localStorage.getItem("class-memory-favorites") ?? "[]")); } catch { setFavorites([]); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [demoMode]);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/photos/${selectedId}/comments`).then((response) => response.ok ? response.json() : { comments: [] }).then((data) => setComments(data.comments ?? []));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedId]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (!selected) return;
      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  function move(direction: number) {
    if (filtered.length === 0 || selectedIndex < 0) return;
    setSelectedId(filtered[(selectedIndex + direction + filtered.length) % filtered.length].id);
  }

  async function toggleFavorite(photoId: string) {
    const next = toggleFavoriteIds(favorites, photoId);
    setFavorites(next); if (demoMode) window.localStorage.setItem("class-memory-favorites", JSON.stringify(next));
    await fetch(`/api/photos/${photoId}/favorite`, { method: "POST" });
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !commentText.trim()) return; setCommentError("");
    const response = await fetch(`/api/photos/${selected.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: commentText }) });
    const result = await response.json();
    if (!response.ok) { setCommentError(result.error || "留言失败"); return; }
    setComments((current) => [...current, result.comment]); setCommentText("");
  }

  return <>
    <div className="photo-tools">
      <div className="photo-search"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="photo-search">搜索照片</label><input id="photo-search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(initialLimit); }} placeholder="搜索标题、人物或地点" /></div>
      <div className="tag-scroller" aria-label="照片标签筛选">{defaultTags.map((item) => <button key={item} className={tag === item ? "active" : ""} type="button" onClick={() => { setTag(item); setLimit(initialLimit); }}>{item}</button>)}</div>
      <span className="result-count">{filtered.length} 张照片</span>
    </div>

    {visible.length ? <div className="photo-wall">
      {visible.map((photo, index) => <article className="wall-card" key={photo.id} style={{ animationDelay: `${Math.min(index * 45, 400)}ms` }}>
        <button type="button" onClick={() => setSelectedId(photo.id)} aria-label={`查看照片：${photo.title}`}>
          <div className="wall-image" style={{ aspectRatio: `${photo.width}/${photo.height}` }}>
            <Image src={photo.thumbnailUrl} alt={`${photo.title}，${photo.location}`} fill sizes="(max-width: 520px) 48vw, (max-width: 900px) 31vw, 20vw" unoptimized loading="lazy" suppressHydrationWarning />
            <span className="wall-index">{String(index + 1).padStart(2, "0")}</span>
            <span className="wall-open" aria-hidden="true">↗</span>
          </div>
          <div className="wall-caption"><div><h3>{photo.title}</h3><p>{photo.location || "地点记不清了"}</p></div><span>{photo.people.length ? `${photo.people.length} 人` : "一段回忆"}</span></div>
        </button>
      </article>)}
    </div> : <div className="empty-photos"><span>⌁</span><h3>这一页暂时没有照片</h3><p>换一个关键词或标签，再找找看。</p></div>}

    {visible.length < filtered.length && <button className="load-more" type="button" onClick={() => setLimit((value) => value + 8)}><span>还有一些记忆正在显影……</span><b>再看一些</b></button>}

    {selected && <div className="photo-modal" role="dialog" aria-modal="true" aria-label={selected.title} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }} onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 60) move(delta < 0 ? 1 : -1); touchStart.current = null; }}>
      <button className="modal-close" type="button" onClick={() => setSelectedId(null)} aria-label="关闭照片详情">×</button>
      <button className="modal-arrow modal-prev" type="button" onClick={() => move(-1)} aria-label="上一张">←</button>
      <article className="photo-detail">
        <div className="detail-image-wrap"><Image src={selected.previewUrl} alt={`${selected.title}，${selected.description}`} fill sizes="(max-width: 800px) 100vw, 68vw" unoptimized priority suppressHydrationWarning /></div>
        <aside className="detail-copy">
          <div className="detail-overview">
            <p className="detail-kicker">MEMORY {String(selectedIndex + 1).padStart(2, "0")}</p>
            <h2>{selected.title}</h2><p className="detail-description">{selected.description}</p>
            <dl><div><dt>地点</dt><dd>{selected.location || "记不清了"}</dd></div><div><dt>照片里</dt><dd>{selected.people.map((person) => person.name).join("、") || "还没有标记人物"}</dd></div></dl>
            <div className="detail-tags">{selected.tags.map((item) => <span key={item}>#{item}</span>)}</div>
            <div className="detail-actions"><button type="button" className={favorites.includes(selected.id) ? "active" : ""} onClick={() => toggleFavorite(selected.id)}>{favorites.includes(selected.id) ? "♥ 已收藏" : "♡ 收藏"}</button>{selected.downloadAllowed && <a href={`/api/photos/${selected.id}/download`}>下载原图</a>}</div>
          </div>
          <section className="comments"><h3>同学留言 <span>{comments.length}</span></h3><div className="comment-list">{comments.map((comment) => <div key={comment.id}><b>{comment.authorName.slice(0, 1)}</b><p><strong>{comment.authorName}</strong>{comment.content}</p></div>)}{comments.length === 0 && <small>还没有人留言，写下你记得的事吧。</small>}</div>
            <form onSubmit={submitComment}><label className="sr-only" htmlFor="comment-text">写一条照片留言</label><input id="comment-text" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={300} placeholder="我记得……" /><button type="submit">发送</button></form>{commentError && <p className="comment-error">{commentError}</p>}
          </section>
        </aside>
      </article>
      <button className="modal-arrow modal-next" type="button" onClick={() => move(1)} aria-label="下一张">→</button>
    </div>}
  </>;
}
