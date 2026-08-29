import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  deleteCommand: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = mocks.send;
  },
  DeleteObjectsCommand: class MockDeleteObjectsCommand {
    constructor(input: unknown) {
      mocks.deleteCommand(input);
    }
  },
  GetObjectCommand: class MockGetObjectCommand {},
  PutObjectCommand: class MockPutObjectCommand {},
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

import { R2StorageAdapter } from "@/lib/storage/r2";

describe("R2 storage deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("R2_ENDPOINT", "https://r2.example.test");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("R2_BUCKET_NAME", "test-bucket");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws R2DeleteObjectsError for per-object failures and sends an AbortSignal", async () => {
    mocks.send.mockResolvedValueOnce({
      Errors: [{ Key: "previews/member-one/photo.webp", Code: "AccessDenied" }],
    });
    const storage = new R2StorageAdapter();

    await expect(
      storage.deleteObjects([
        "originals/member-one/photo.jpg",
        "previews/member-one/photo.webp",
      ]),
    ).rejects.toMatchObject({
      name: "R2DeleteObjectsError",
      message: "Cloudflare R2 未能删除全部对象",
    });

    expect(mocks.deleteCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Delete: {
        Objects: [
          { Key: "originals/member-one/photo.jpg" },
          { Key: "previews/member-one/photo.webp" },
        ],
        Quiet: true,
      },
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    const sendOptions = mocks.send.mock.calls[0]?.[1] as
      | { abortSignal?: AbortSignal }
      | undefined;
    expect(sendOptions?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(sendOptions?.abortSignal?.aborted).toBe(false);
  });
});
