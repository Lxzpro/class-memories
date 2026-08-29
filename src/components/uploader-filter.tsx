"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserAvatar } from "@/components/user-avatar";
import {
  ALL_UPLOADERS,
  MY_UPLOADS,
  summarizeUploaders,
  type UploaderFilterValue,
  type UploaderSummary,
} from "@/lib/photo-filter";
import type { Photo } from "@/types/domain";

type Props = {
  photos: Photo[];
  viewerId: string;
  value: UploaderFilterValue;
  onChange: (value: UploaderFilterValue) => void;
  className?: string;
  mediaLabel?: "照片" | "视频" | "内容";
};

function UploaderAvatar({
  uploader,
  size = 26,
}: {
  uploader: UploaderSummary;
  size?: number;
}) {
  return (
    <UserAvatar
      user={{
        id: uploader.id,
        displayName: uploader.name,
        email: "",
        avatarKey: null,
      }}
      className="uploader-filter-avatar"
      size={size}
      avatarEndpoint={`/api/members/${encodeURIComponent(uploader.id)}/avatar`}
      alwaysTryRemote={!uploader.isClassArchive}
      listenForUpdates={false}
    />
  );
}

export function UploaderFilter({
  photos,
  viewerId,
  value,
  onChange,
  className = "",
  mediaLabel = "内容",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const uploaders = useMemo(() => summarizeUploaders(photos), [photos]);
  const commonUploaders = uploaders
    .filter((uploader) => uploader.id !== viewerId)
    .slice(0, 5);
  const hasMoreUploaders =
    uploaders.filter((uploader) => uploader.id !== viewerId).length >
    commonUploaders.length;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleUploaders = normalizedSearch
    ? uploaders.filter((uploader) =>
        uploader.name.toLowerCase().includes(normalizedSearch),
      )
    : uploaders;
  const selectedUploader = uploaders.find(
    (uploader) => uploader.filterValue === value,
  );
  const mobilePickerLabel =
    selectedUploader?.name ?? (uploaders.length ? "按上传者" : "暂无上传者");

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePicker();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [closePicker, isOpen]);

  function select(nextValue: UploaderFilterValue) {
    onChange(nextValue);
    closePicker();
  }

  function openPicker(event: React.MouseEvent<HTMLButtonElement>) {
    triggerRef.current = event.currentTarget;
    setIsOpen(true);
  }

  return (
    <div className={`uploader-filter ${className}`.trim()}>
      <div
        className="uploader-filter-desktop"
        role="group"
        aria-label={`按${mediaLabel}上传者筛选`}
      >
        <button
          type="button"
          className={value === ALL_UPLOADERS ? "active" : ""}
          aria-pressed={value === ALL_UPLOADERS}
          onClick={() => onChange(ALL_UPLOADERS)}
        >
          全部
        </button>
        <button
          type="button"
          className={value === MY_UPLOADS ? "active" : ""}
          aria-pressed={value === MY_UPLOADS}
          onClick={() => onChange(MY_UPLOADS)}
        >
          我上传的
        </button>
        {commonUploaders.map((uploader) => (
          <button
            type="button"
            className={`uploader-filter-person ${value === uploader.filterValue ? "active" : ""}`}
            aria-pressed={value === uploader.filterValue}
            onClick={() => onChange(uploader.filterValue)}
            key={uploader.id}
          >
            <UploaderAvatar uploader={uploader} />
            <span>{uploader.name}</span>
            <small>{uploader.count}</small>
          </button>
        ))}
        {hasMoreUploaders ? (
          <button
            type="button"
            className="uploader-filter-more"
            onClick={openPicker}
          >
            更多上传者
          </button>
        ) : null}
      </div>

      <div
        className="uploader-filter-mobile"
        role="group"
        aria-label={`按${mediaLabel}上传者筛选`}
      >
        <button
          type="button"
          className={value === ALL_UPLOADERS ? "active" : ""}
          aria-pressed={value === ALL_UPLOADERS}
          onClick={() => onChange(ALL_UPLOADERS)}
        >
          全部
        </button>
        <button
          type="button"
          className={value === MY_UPLOADS ? "active" : ""}
          aria-pressed={value === MY_UPLOADS}
          onClick={() => onChange(MY_UPLOADS)}
        >
          我上传的
        </button>
        <button
          ref={triggerRef}
          type="button"
          className={selectedUploader ? "active" : ""}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          disabled={uploaders.length === 0}
          onClick={openPicker}
        >
          {mobilePickerLabel}
        </button>
      </div>

      {isOpen
        ? createPortal(
            <div
              className="uploader-picker-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closePicker();
              }}
            >
              <div
                ref={dialogRef}
                className="uploader-picker"
                role="dialog"
                aria-modal="true"
                aria-labelledby="uploader-picker-title"
              >
                <header>
                  <div>
                    <p>FROM OUR CLASS</p>
                    <h2 id="uploader-picker-title">按上传者浏览</h2>
                    <span>只显示已经分享过{mediaLabel}的成员</span>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    className="uploader-picker-close"
                    aria-label="关闭上传者列表"
                    onClick={closePicker}
                  >
                    ×
                  </button>
                </header>
                <label className="uploader-picker-search">
                  <span aria-hidden="true">⌕</span>
                  <span className="sr-only">搜索上传者</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="搜索昵称或姓名"
                  />
                </label>
                <div className="uploader-picker-list">
                  {visibleUploaders.map((uploader) => (
                    <button
                      type="button"
                      className={value === uploader.filterValue ? "active" : ""}
                      aria-pressed={value === uploader.filterValue}
                      onClick={() => select(uploader.filterValue)}
                      key={uploader.id}
                    >
                      <UploaderAvatar uploader={uploader} size={42} />
                      <span>
                        <b>{uploader.name}</b>
                        <small>
                          {uploader.count} {mediaLabel}
                        </small>
                      </span>
                      <i aria-hidden="true">
                        {value === uploader.filterValue ? "✓" : "›"}
                      </i>
                    </button>
                  ))}
                  {visibleUploaders.length === 0 ? (
                    <p className="uploader-picker-empty">没有找到这位上传者</p>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
