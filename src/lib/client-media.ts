import type { MediaType } from "@/types/domain";
import {
  MAX_AVATAR_SOURCE_SIZE,
  MAX_AVATAR_UPLOAD_SIZE,
} from "@/lib/profile-avatars";

export const MEDIA_INPUT_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";
export const MAX_IMAGE_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_VIDEO_FILE_SIZE = 200 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

export function mediaTypeForFile(file: File): MediaType | null {
  if (IMAGE_TYPES.has(file.type)) return "photo";
  if (VIDEO_TYPES.has(file.type)) return "video";
  return null;
}

export function validateMediaFile(file: File): string | null {
  const mediaType = mediaTypeForFile(file);
  if (!mediaType) return "仅支持 JPG、PNG、WebP、MP4 或 WebM";
  const limit = mediaType === "video" ? MAX_VIDEO_FILE_SIZE : MAX_IMAGE_FILE_SIZE;
  if (file.size > limit) return mediaType === "video" ? "视频超过 200MB" : "图片超过 25MB";
  return null;
}

export function validateAvatarFile(file: File): string | null {
  if (!IMAGE_TYPES.has(file.type)) return "仅支持 JPG、PNG 或 WebP 图片";
  if (file.size > MAX_AVATAR_SOURCE_SIZE) return "头像原图不能超过 10MB";
  return null;
}

type DecodedMedia = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decodeImage(file: File): Promise<DecodedMedia> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Fall through for mobile browsers that expose createImageBitmap but cannot decode camera files.
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
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadeddata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("浏览器无法读取这个视频，请尝试 MP4 或 WebM 格式")); };
    const cleanup = () => {
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function decodeVideo(file: File): Promise<DecodedMedia> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const loadedData = waitForVideoEvent(video, "loadeddata");
  video.src = url;
  video.load();

  try {
    await loadedData;
    if (Number.isFinite(video.duration) && video.duration > 0.25) {
      const seeked = waitForVideoEvent(video, "seeked");
      video.currentTime = Math.min(1, video.duration / 3);
      await seeked;
    }
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error("无法读取视频画面尺寸");
    return {
      source: video,
      width,
      height,
      release: () => {
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function createWebpVariant(media: DecodedMedia, maxWidth: number, quality: number) {
  const scale = Math.min(1, maxWidth / media.width);
  const width = Math.max(1, Math.round(media.width * scale));
  const height = Math.max(1, Math.round(media.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法生成媒体封面");
  context.drawImage(media.source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("媒体封面生成失败");
  return blob;
}

export async function prepareAvatar(file: File) {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const decoded = await decodeImage(file);
  try {
    const outputSize = 512;
    const sourceSize = Math.min(decoded.width, decoded.height);
    const sourceX = (decoded.width - sourceSize) / 2;
    const sourceY = (decoded.height - sourceSize) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法处理这张头像");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      decoded.source,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.86),
    );
    if (!blob || blob.type !== "image/webp") {
      throw new Error("当前浏览器无法生成 WebP 头像，请升级浏览器后重试");
    }
    if (blob.size > MAX_AVATAR_UPLOAD_SIZE) {
      throw new Error("头像处理后仍然过大，请换一张图片");
    }
    return blob;
  } finally {
    decoded.release();
  }
}

export async function prepareMedia(file: File) {
  const mediaType = mediaTypeForFile(file);
  if (!mediaType) throw new Error("不支持的文件格式");
  const decoded = mediaType === "video" ? await decodeVideo(file) : await decodeImage(file);
  try {
    const [preview, thumbnail] = await Promise.all([
      createWebpVariant(decoded, 1600, 0.84),
      createWebpVariant(decoded, 640, 0.78),
    ]);
    return { mediaType, width: decoded.width, height: decoded.height, preview, thumbnail };
  } finally {
    decoded.release();
  }
}
