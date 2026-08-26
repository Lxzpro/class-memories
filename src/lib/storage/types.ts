export interface UploadUrlInput { key: string; contentType: string; contentLength: number }
export interface ReadUrlInput { key: string; expiresIn?: number; downloadName?: string }

export interface StorageAdapter {
  createUploadUrl(input: UploadUrlInput): Promise<string>;
  createReadUrl(input: ReadUrlInput): Promise<string>;
  deleteObjects(keys: string[]): Promise<void>;
}

export function assertSafeObjectKey(key: string): void {
  if (!key || key.startsWith("/") || key.includes("..") || key.includes("\\")) {
    throw new Error("无效的对象存储路径");
  }
}
