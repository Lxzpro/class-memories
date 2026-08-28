"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { PhotoVisibility } from "@/types/domain";

type UploadStatus = "ready" | "preparing" | "uploading" | "submitted" | "error";
type PreviewStatus = "loading" | "ready" | "error";
type UploadIconKind =
  | "image"
  | "camera"
  | "upload"
  | "refresh"
  | "close"
  | "users"
  | "lock"
  | "send";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  previewStatus: PreviewStatus;
  title: string;
  description: string;
  location: string;
  tags: string;
  visibility: Extract<PhotoVisibility, "class" | "private">;
  status: UploadStatus;
  progress: number;
  error?: string;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxFileSize = 25 * 1024 * 1024;
const maxQueueSize = 8;
const suggestedTags = ["日常", "教室", "运动会", "青春", "朋友"];

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadIcon({ kind }: { kind: UploadIconKind }) {
  if (kind === "camera") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.5 5.5 10 3.8h4l1.5 1.7H19a3 3 0 0 1 3 3v8.5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8.5a3 3 0 0 1 3-3h3.5Z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    );
  }
  if (kind === "upload") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
        <path d="M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
      </svg>
    );
  }
  if (kind === "refresh") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.5 8A8 8 0 1 0 20 15" />
        <path d="M19.5 3.5V8H15" />
      </svg>
    );
  }
  if (kind === "close") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 7 10 10M17 7 7 17" />
      </svg>
    );
  }
  if (kind === "users") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19" />
        <path d="M15 5.5a3 3 0 0 1 0 5.5m1.5 2a4 4 0 0 1 4 4v2" />
      </svg>
    );
  }
  if (kind === "lock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14.5v2" />
      </svg>
    );
  }
  if (kind === "send") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3 11 18-8-7.5 18-2.2-7.1L3 11Z" />
        <path d="m11.3 13.9 4.2-4.2" />
      </svg>
    );
  }
  if (kind === "image") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m5.5 17 4.2-4.2 2.7 2.5 2.7-3 3.4 4.7" />
      </svg>
    );
  }
  return null;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Some mobile browsers expose createImageBitmap but cannot decode every camera JPEG.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("浏览器无法读取这张照片"));
      element.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function createWebpVariant(
  image: DecodedImage,
  maxWidth: number,
  quality: number,
) {
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理这张图片");
  context.drawImage(image.source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  if (!blob) throw new Error("图片压缩失败");
  return blob;
}

export function MemberUploadStudio({ demoMode }: { demoMode: boolean }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [batchVisibility, setBatchVisibility] = useState<
    Extract<PhotoVisibility, "class" | "private">
  >("class");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    [],
  );

  function updateItem(id: string, update: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  }

  function chooseVisibility(
    visibility: Extract<PhotoVisibility, "class" | "private">,
  ) {
    setBatchVisibility(visibility);
    setItems((current) =>
      current.map((item) =>
        item.status === "submitted" ? item : { ...item, visibility },
      ),
    );
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const available = Math.max(0, maxQueueSize - items.length);
    const selected = Array.from(fileList).slice(0, available);
    const nextItems: UploadItem[] = [];
    let rejected = 0;

    for (const file of selected) {
      if (!allowedTypes.has(file.type) || file.size > maxFileSize) {
        rejected += 1;
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      nextItems.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        previewStatus: "loading",
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
        description: "",
        location: "",
        tags: "",
        visibility: batchVisibility,
        status: "ready",
        progress: 0,
      });
    }

    setItems((current) => [...current, ...nextItems]);
    const overflow = Math.max(0, fileList.length - available);
    const messages: string[] = [];
    if (nextItems.length > 0) {
      messages.push(`已准备 ${nextItems.length} 张照片，预览确认后即可补充资料`);
    }
    if (rejected > 0) {
      messages.push(`${rejected} 张格式不支持或超过 25MB`);
    }
    if (overflow > 0) {
      messages.push(`最多同时准备 ${maxQueueSize} 张`);
    }
    setNotice(messages.length > 0 ? `${messages.join("；")}。` : "");
    if (fileInput.current) fileInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  function removeItem(item: UploadItem) {
    if (item.status === "preparing" || item.status === "uploading") return;
    URL.revokeObjectURL(item.previewUrl);
    objectUrls.current.delete(item.previewUrl);
    setItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id),
    );
  }

  function retryPreview(item: UploadItem) {
    URL.revokeObjectURL(item.previewUrl);
    objectUrls.current.delete(item.previewUrl);
    const previewUrl = URL.createObjectURL(item.file);
    objectUrls.current.add(previewUrl);
    updateItem(item.id, { previewUrl, previewStatus: "loading" });
  }

  function addSuggestedTag(item: UploadItem, tag: string) {
    const tags = item.tags
      .split(/[,，]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (tags.includes(tag)) return;
    updateItem(item.id, { tags: [...tags, tag].join("，") });
  }

  async function uploadItem(item: UploadItem) {
    if (!item.title.trim()) {
      updateItem(item.id, { status: "error", error: "请填写照片标题。" });
      return false;
    }

    updateItem(item.id, { status: "preparing", progress: 8, error: undefined });
    try {
      const image = await decodeImage(item.file);
      const width = image.width;
      const height = image.height;
      let preview: Blob;
      let thumbnail: Blob;
      try {
        [preview, thumbnail] = await Promise.all([
          createWebpVariant(image, 1600, 0.84),
          createWebpVariant(image, 640, 0.78),
        ]);
      } finally {
        image.release();
      }
      updateItem(item.id, { status: "uploading", progress: 24 });

      const signResponse = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.file.name,
          type: item.file.type,
          size: item.file.size,
          previewSize: preview.size,
          thumbnailSize: thumbnail.size,
        }),
      });
      const signed = await signResponse.json();
      if (!signResponse.ok) {
        throw new Error(signed.error || "无法创建安全上传链接");
      }
      updateItem(item.id, { progress: 40 });

      const uploadResponses = await Promise.all([
        fetch(signed.urls.original, {
          method: "PUT",
          headers: { "Content-Type": item.file.type },
          body: item.file,
        }),
        fetch(signed.urls.preview, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: preview,
        }),
        fetch(signed.urls.thumbnail, {
          method: "PUT",
          headers: { "Content-Type": "image/webp" },
          body: thumbnail,
        }),
      ]);
      if (uploadResponses.some((response) => !response.ok)) {
        throw new Error("图片上传失败，请检查网络后重试");
      }
      updateItem(item.id, { progress: 82 });

      const saveResponse = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: signed.photoId,
          title: item.title.trim(),
          description: item.description.trim(),
          location: item.location.trim(),
          width,
          height,
          visibility: item.visibility,
          originalKey: signed.keys.original,
          previewKey: signed.keys.preview,
          thumbnailKey: signed.keys.thumbnail,
          tags: item.tags
            .split(/[,，]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(saved.error || "照片提交失败");
      }

      updateItem(item.id, { status: "submitted", progress: 100 });
      setNotice(saved.message || "照片已经提交审核。");
      return true;
    } catch (reason) {
      updateItem(item.id, {
        status: "error",
        error: reason instanceof Error ? reason.message : "上传失败，请重试。",
      });
      return false;
    }
  }

  const previewBlocked = items.some(
    (item) => item.status !== "submitted" && item.previewStatus !== "ready",
  );
  const readyCount = items.filter(
    (item) =>
      (item.status === "ready" || item.status === "error") &&
      item.previewStatus === "ready",
  ).length;

  async function uploadAll() {
    if (previewBlocked) {
      setNotice("请先等待所有照片显示预览；加载失败的照片可重新加载或移除。");
      return;
    }
    const pending = items.filter(
      (item) =>
        (item.status === "ready" || item.status === "error") &&
        item.previewStatus === "ready",
    );
    if (pending.length === 0) return;
    setBusy(true);
    setNotice("正在安全上传，请不要关闭页面……");
    let submitted = 0;
    for (const item of pending) {
      if (await uploadItem(item)) submitted += 1;
    }
    setBusy(false);
    if (submitted > 0) {
      setNotice(
        demoMode
          ? `已模拟提交 ${submitted} 张照片；演示模式不会写入 R2 或数据库。`
          : `已提交 ${submitted} 张照片，管理员审核通过后会出现在相册中。`,
      );
    }
  }

  return (
    <section
      className="member-upload-studio upload-reference-layout"
      aria-labelledby="upload-studio-title"
    >
      <div className="upload-reference-main">
        <div className="member-upload-toolbar">
          <div>
            <p>MEMORY CONTRIBUTION</p>
            <h2 id="upload-studio-title">选择你想留下的照片</h2>
            <span>JPG / PNG / WebP · 单张不超过 25MB · 最多 8 张</span>
          </div>
          <b>
            {items.length} / {maxQueueSize}
          </b>
        </div>

        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="从设备选择照片"
          onChange={(event) => addFiles(event.target.files)}
        />
        <input
          ref={cameraInput}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label="使用相机拍照"
          onChange={(event) => addFiles(event.target.files)}
        />

        <div className="upload-mobile-sources">
          <button
            type="button"
            disabled={busy || items.length >= maxQueueSize}
            onClick={() => fileInput.current?.click()}
          >
            <UploadIcon kind="image" />
            <b>选择照片</b>
          </button>
          <button
            type="button"
            disabled={busy || items.length >= maxQueueSize}
            onClick={() => cameraInput.current?.click()}
          >
            <UploadIcon kind="camera" />
            <b>拍照</b>
          </button>
          <small>选择后会立即在下方显示完整预览 · 最多 8 张</small>
        </div>

        <button
          className="member-upload-dropzone"
          type="button"
          disabled={busy || items.length >= maxQueueSize}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <UploadIcon kind="upload" />
          <b>
            {items.length >= maxQueueSize
              ? "已达到本次上传上限"
              : "拖入照片，或点击从设备选择"}
          </b>
          <small>选择后会立即显示完整预览，再安全上传原图</small>
        </button>

        <p className="member-upload-notice" role="status" aria-live="polite">
          {notice}
        </p>

        <div className="member-upload-list" aria-label="待上传照片预览">
          {items.map((item, index) => {
            const locked =
              item.status === "preparing" ||
              item.status === "uploading" ||
              item.status === "submitted";
            return (
              <article
                className={`member-upload-item status-${item.status}`}
                key={item.id}
              >
                <div
                  className={`member-upload-preview preview-${item.previewStatus}`}
                  aria-busy={item.previewStatus === "loading"}
                >
                  <Image
                    src={item.previewUrl}
                    alt={item.title || `待上传照片 ${index + 1}`}
                    fill
                    sizes="(max-width: 560px) calc(100vw - 48px), (max-width: 760px) 42vw, 260px"
                    unoptimized
                    onLoad={() =>
                      updateItem(item.id, { previewStatus: "ready" })
                    }
                    onError={() =>
                      updateItem(item.id, { previewStatus: "error" })
                    }
                  />
                  <span className="member-upload-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  {item.previewStatus === "loading" ? (
                    <div className="member-upload-preview-feedback" role="status">
                      <i aria-hidden="true" />
                      <b>正在生成预览</b>
                    </div>
                  ) : null}
                  {item.previewStatus === "error" ? (
                    <div
                      className="member-upload-preview-feedback is-error"
                      role="alert"
                    >
                      <UploadIcon kind="image" />
                      <b>预览加载失败</b>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => retryPreview(item)}
                      >
                        <UploadIcon kind="refresh" />
                        重新加载
                      </button>
                    </div>
                  ) : null}
                  {item.previewStatus === "ready" ? (
                    <div className="member-upload-preview-meta">
                      <span title={item.file.name}>{item.file.name}</span>
                      <small>{formatFileSize(item.file.size)}</small>
                    </div>
                  ) : null}
                  {item.status === "submitted" ? <b>已提交审核</b> : null}
                </div>
                <div className="member-upload-fields">
                  <label>
                    <span>标题</span>
                    <input
                      maxLength={100}
                      required
                      disabled={locked}
                      value={item.title}
                      onChange={(event) =>
                        updateItem(item.id, {
                          title: event.target.value,
                          status: "ready",
                          error: undefined,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>
                      地点 <small>选填</small>
                    </span>
                    <input
                      maxLength={100}
                      disabled={locked}
                      value={item.location}
                      placeholder="例如：教学楼、操场"
                      onChange={(event) =>
                        updateItem(item.id, { location: event.target.value })
                      }
                    />
                  </label>
                  <label className="member-upload-story">
                    <span>
                      记得的事 <small>选填</small>
                    </span>
                    <textarea
                      maxLength={1000}
                      disabled={locked}
                      value={item.description}
                      placeholder="一句话、一个外号，或者当时发生的小事……"
                      onChange={(event) =>
                        updateItem(item.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="member-upload-tags">
                    <span>
                      标签 <small>选填</small>
                    </span>
                    <input
                      disabled={locked}
                      value={item.tags}
                      placeholder="教室，运动会，朋友"
                      onChange={(event) =>
                        updateItem(item.id, { tags: event.target.value })
                      }
                    />
                  </label>
                  <div className="upload-tag-suggestions" aria-label="常用标签">
                    {suggestedTags.slice(0, 3).map((tag) => (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => addSuggestedTag(item, tag)}
                        key={tag}
                      >
                        {tag}
                      </button>
                    ))}
                    <span aria-hidden="true">＋</span>
                  </div>
                </div>
                <div className="member-upload-state">
                  <div
                    role="progressbar"
                    aria-label={`${item.title || `第 ${index + 1} 张照片`}上传进度`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={item.progress}
                  >
                    <span style={{ width: `${item.progress}%` }} />
                  </div>
                  <p role={item.status === "error" ? "alert" : undefined}>
                    {item.status === "preparing"
                      ? "正在整理图片…"
                      : item.status === "uploading"
                        ? `上传中 ${item.progress}%`
                        : item.status === "submitted"
                          ? "等待管理员审核"
                          : item.error || "预览已就绪，填写完成后即可提交"}
                  </p>
                  {item.status === "error" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => uploadItem(item)}
                    >
                      <UploadIcon kind="refresh" />
                      重试这张
                    </button>
                  ) : null}
                </div>
                <button
                  className="member-upload-remove"
                  type="button"
                  disabled={locked}
                  aria-label={`移除${item.title || "这张照片"}`}
                  onClick={() => removeItem(item)}
                >
                  <UploadIcon kind="close" />
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="upload-reference-aside">
        <section className="upload-privacy-card">
          <header>
            <h3>隐私设置</h3>
            <p>选择本次照片审核通过后的可见范围</p>
          </header>
          <label className={batchVisibility === "class" ? "active" : ""}>
            <input
              type="radio"
              name="batch-visibility"
              checked={batchVisibility === "class"}
              onChange={() => chooseVisibility("class")}
            />
            <span>
              <UploadIcon kind="users" />
            </span>
            <b>
              全班可见
              <small>审核通过后，班级所有同学均可查看</small>
            </b>
          </label>
          <label className={batchVisibility === "private" ? "active" : ""}>
            <input
              type="radio"
              name="batch-visibility"
              checked={batchVisibility === "private"}
              onChange={() => chooseVisibility("private")}
            />
            <span>
              <UploadIcon kind="lock" />
            </span>
            <b>
              仅自己
              <small>仅自己与管理员可见，不加入照片墙</small>
            </b>
          </label>
        </section>

        <section className="upload-safety-card">
          <h3>安心上传，小贴士</h3>
          <ul>
            <li>上传内容需积极、真实、友善</li>
            <li>不要包含住址、证件等私密信息</li>
            <li>审核通常在 1–3 个工作日内完成</li>
          </ul>
        </section>

        <section className="upload-steps-card">
          <h3>上传步骤</h3>
          <ol>
            <li>
              <span>1</span>
              <b>
                选择照片<small>从设备选择或现场拍摄</small>
              </b>
            </li>
            <li>
              <span>2</span>
              <b>
                确认预览<small>看清内容后补充标题与回忆</small>
              </b>
            </li>
            <li>
              <span>3</span>
              <b>
                等待审核<small>通过后自动加入班级相册</small>
              </b>
            </li>
          </ol>
        </section>

        <button
          className="upload-submit-all"
          type="button"
          disabled={busy || readyCount === 0 || previewBlocked}
          onClick={uploadAll}
        >
          <UploadIcon kind="send" />
          {busy
            ? "正在提交…"
            : previewBlocked
              ? "等待照片预览"
              : `提交 ${readyCount} 张照片`}
        </button>
      </aside>
    </section>
  );
}
