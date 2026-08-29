import { describe, expect, it } from "vitest";
import { mediaExtensionFromObjectKey, mediaTypeFromObjectKey } from "@/lib/media";

describe("media object keys", () => {
  it("keeps existing image objects backward compatible", () => {
    expect(mediaTypeFromObjectKey("originals/photo/memory.jpg")).toBe("photo");
    expect(mediaExtensionFromObjectKey("originals/photo/memory.jpeg")).toBe("jpg");
  });

  it("recognizes playable video objects and preserves their extension", () => {
    expect(mediaTypeFromObjectKey("originals/photo/memory.mp4")).toBe("video");
    expect(mediaTypeFromObjectKey("originals/photo/memory.WEBM")).toBe("video");
    expect(mediaExtensionFromObjectKey("originals/photo/memory.webm")).toBe("webm");
  });
});
