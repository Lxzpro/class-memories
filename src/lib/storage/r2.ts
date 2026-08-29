import "server-only";

import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ReadUrlInput, StorageAdapter, UploadUrlInput } from "@/lib/storage/types";
import { assertSafeObjectKey } from "@/lib/storage/types";

function configuration() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) throw new Error("Cloudflare R2 环境变量尚未完整配置");
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

export class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const config = configuration();
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: "auto", endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async createUploadUrl(input: UploadUrlInput): Promise<string> {
    assertSafeObjectKey(input.key);
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: input.key, ContentType: input.contentType, ContentLength: input.contentLength });
    return getSignedUrl(this.client, command, { expiresIn: 10 * 60 });
  }

  async createReadUrl(input: ReadUrlInput): Promise<string> {
    assertSafeObjectKey(input.key);
    const command = new GetObjectCommand({
      Bucket: this.bucket, Key: input.key,
      ResponseContentDisposition: input.downloadName ? `attachment; filename*=UTF-8''${encodeURIComponent(input.downloadName)}` : undefined,
    });
    return getSignedUrl(this.client, command, { expiresIn: input.expiresIn ?? 5 * 60 });
  }

  async deleteObjects(keys: string[]): Promise<void> {
    keys.forEach(assertSafeObjectKey);
    if (keys.length === 0) return;
    const result = await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
      { abortSignal: AbortSignal.timeout(2 * 60 * 1000) },
    );
    if (result.Errors?.length) {
      const error = new Error("Cloudflare R2 未能删除全部对象");
      error.name = "R2DeleteObjectsError";
      throw error;
    }
  }
}
