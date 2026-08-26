import "server-only";

import { DEMO_MODE } from "@/lib/config";
import { LocalMockStorageAdapter } from "@/lib/storage/mock";
import { R2StorageAdapter } from "@/lib/storage/r2";
import type { StorageAdapter } from "@/lib/storage/types";

let adapter: StorageAdapter | undefined;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) adapter = DEMO_MODE ? new LocalMockStorageAdapter() : new R2StorageAdapter();
  return adapter;
}
