"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { chooseRandomId, pushRecentId } from "@/lib/random";
import type { Photo } from "@/types/domain";

type Mode = "shuffle" | "camera";
type Phase = "idle" | "moving" | "reveal";

export function RandomMemory({
  photos,
  initialMode,
}: {
  photos: Photo[];
  initialMode: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [sound, setSound] = useState(false);
  const [reduced, setReduced] = useState(false);
  const selected = useMemo(
    () => photos.find((photo) => photo.id === selectedId) ?? null,
    [photos, selectedId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setRecent(
          JSON.parse(
            window.localStorage.getItem("recent-random-memories") ?? "[]",
          ),
        );
      } catch {
        setRecent([]);
      }
      setSound(window.localStorage.getItem("sound-enabled") === "true");
      setReduced(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          window.localStorage.getItem("reduce-motion") === "true",
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function pick() {
    const id = chooseRandomId(
      photos.map((photo) => photo.id),
      recent,
    );
    if (!id) return;
    const nextRecent = pushRecentId(recent, id, 10);
    setRecent(nextRecent);
    window.localStorage.setItem(
      "recent-random-memories",
      JSON.stringify(nextRecent),
    );
    setSelectedId(id);
    setPhase("moving");
    window.setTimeout(
      () => setPhase("reveal"),
      reduced ? 50 : mode === "shuffle" ? 1900 : 2100,
    );
  }

  function skip() {
    if (!selectedId) pick();
    setPhase("reveal");
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    window.localStorage.setItem("sound-enabled", String(next));
  }

  function changeMode(next: Mode) {
    setMode(next);
    setPhase("idle");
  }

  return (
    <div className="random-page">
      <header className="random-header">
        <div>
          <p className="eyebrow">
            <span /> RANDOM MEMORY
          </p>
          <h1>
            让一张照片，<em>自己找到你</em>
          </h1>
        </div>
        <div className="random-settings">
          <button type="button" onClick={toggleSound}>
            {sound ? "声音：开" : "声音：关"}
          </button>
          <span>{recent.length} 张近期回忆已避开</span>
        </div>
      </header>

      <div className="mode-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "shuffle"}
          className={mode === "shuffle" ? "active" : ""}
          type="button"
          onClick={() => changeMode("shuffle")}
        >
          ↝ 洗一洗回忆
        </button>
        <button
          role="tab"
          aria-selected={mode === "camera"}
          className={mode === "camera" ? "active" : ""}
          type="button"
          onClick={() => changeMode("camera")}
        >
          ◉ 拍下一刻
        </button>
      </div>

      {mode === "shuffle" ? (
        <section className={`shuffle-stage phase-${phase}`}>
          <div className="shuffle-glow" />
          <div className="shuffle-deck" aria-hidden="true">
            {photos.slice(0, 8).map((photo, index) => (
              <div
                key={photo.id}
                className="shuffle-card"
                style={{ "--card-index": index } as React.CSSProperties}
              >
                <Image
                  src={photo.thumbnailUrl}
                  alt=""
                  fill
                  sizes="220px"
                  unoptimized
                  loading="eager"
                  suppressHydrationWarning
                />
              </div>
            ))}
          </div>
          {selected && (
            <div className="chosen-card">
              <Image
                src={selected.previewUrl}
                alt={selected.title}
                fill
                sizes="(max-width: 600px) 76vw, 420px"
                unoptimized
                loading="eager"
                suppressHydrationWarning
              />
              <div>
                <b>{selected.title}</b>
                <span>{selected.location}</span>
              </div>
            </div>
          )}
          <div className="random-controls">
            {phase === "idle" && (
              <button className="random-trigger" type="button" onClick={pick}>
                <span>↝</span>开始洗牌
              </button>
            )}
            {phase === "moving" && (
              <button className="skip-motion" type="button" onClick={skip}>
                跳过动画
              </button>
            )}
            {phase === "reveal" && (
              <>
                <button className="random-trigger" type="button" onClick={pick}>
                  再洗一次
                </button>
                {selected && (
                  <Link href={`/photos?open=${selected.id}`}>
                    查看这张照片 →
                  </Link>
                )}
              </>
            )}
          </div>
        </section>
      ) : (
        <section className={`camera-stage phase-${phase}`}>
          <div className="camera-body">
            <div className="camera-top">
              <span className="camera-brand">SHIGUANG</span>
              <span className="camera-counter">
                {String(recent.length + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="viewfinder">
              <div className="focus-corners" />
              <p>
                {phase === "idle"
                  ? "把镜头对准一段旧时光"
                  : phase === "moving"
                    ? "正在显影，请不要摇晃"
                    : "这一刻，拍到了从前"}
              </p>
            </div>
            <button
              className="shutter"
              type="button"
              onClick={pick}
              disabled={phase === "moving"}
              aria-label="按下快门"
            >
              <span />
            </button>
            <div className="camera-lens" />
          </div>
          <div className="flash" />
          {selected && (
            <div className="instant-photo">
              <div>
                <Image
                  src={selected.previewUrl}
                  alt={selected.title}
                  fill
                  sizes="(max-width: 600px) 74vw, 360px"
                  unoptimized
                  loading="eager"
                  suppressHydrationWarning
                />
              </div>
              <p>
                {selected.title}
                <small>{selected.location || "记不清的某个地方"}</small>
              </p>
            </div>
          )}
          <div className="random-controls">
            {phase === "moving" && (
              <button className="skip-motion" type="button" onClick={skip}>
                跳过显影
              </button>
            )}
            {phase === "reveal" && (
              <>
                <button className="random-trigger" type="button" onClick={pick}>
                  再拍一张
                </button>
                {selected && (
                  <Link href={`/photos?open=${selected.id}`}>
                    查看这张照片 →
                  </Link>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
