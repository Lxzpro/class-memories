import type { ReadUrlInput, StorageAdapter, UploadUrlInput } from "@/lib/storage/types";
import { assertSafeObjectKey } from "@/lib/storage/types";

export class LocalMockStorageAdapter implements StorageAdapter {
  async createUploadUrl(input: UploadUrlInput): Promise<string> {
    assertSafeObjectKey(input.key);
    return `/api/mock-upload?key=${encodeURIComponent(input.key)}`;
  }

  async createReadUrl(input: ReadUrlInput): Promise<string> {
    assertSafeObjectKey(input.key);
    const match = input.key.match(/photo-(\d+)/);
    const id = Number(match?.[1] ?? 1);
    return `/api/demo-image/${Math.max(1, Math.min(id, 22))}?variant=preview`;
  }

  async deleteObjects(keys: string[]): Promise<void> {
    keys.forEach(assertSafeObjectKey);
  }
}
