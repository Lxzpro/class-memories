import type { MediaType } from "@/types/domain";

const VIDEO_KEY_PATTERN = /\.(?:mp4|webm)$/i;

export function mediaTypeFromObjectKey(key: string): MediaType {
  return VIDEO_KEY_PATTERN.test(key) ? "video" : "photo";
}

export function mediaExtensionFromObjectKey(key: string): string {
  const extension = key.match(/\.(jpg|jpeg|png|webp|mp4|webm)$/i)?.[1]?.toLowerCase();
  return extension === "jpeg" ? "jpg" : extension ?? "bin";
}
