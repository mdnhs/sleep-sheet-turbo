import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const r2Delete = vi.fn();
const cloudinaryDeleteImage = vi.fn();
const cloudinaryDeleteVideo = vi.fn();

vi.mock("@/lib/r2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2")>()),
  r2Delete,
}));
vi.mock("@/lib/cloudinary", () => ({ deleteImage: cloudinaryDeleteImage, deleteVideo: cloudinaryDeleteVideo }));
vi.mock("@/lib/server-config", () => ({
  getR2Config: vi.fn(async () => ({ publicUrl: "https://media.example.com" })),
  getCloudinaryConfig: vi.fn(),
  getMediaProvider: vi.fn(),
}));

const { deleteImage, deleteVideo, mediaDeletesDisabled } = await import("./media");

const r2Image = "https://media.example.com/products/a.jpg";
const r2Video = "https://media.example.com/products-video/a.mp4";
const cldImage = "https://res.cloudinary.com/demo/image/upload/v1/products/a.jpg";
const cldVideo = "https://res.cloudinary.com/demo/video/upload/v1/products-video/a.mp4";

describe("media deletes", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it("delete from R2 and Cloudinary by default", async () => {
    expect(mediaDeletesDisabled()).toBe(false);
    await deleteImage(r2Image);
    await deleteVideo(r2Video);
    await deleteImage(cldImage);
    await deleteVideo(cldVideo);
    expect(r2Delete.mock.calls).toEqual([["products/a.jpg"], ["products-video/a.mp4"]]);
    expect(cloudinaryDeleteImage).toHaveBeenCalledWith(cldImage);
    expect(cloudinaryDeleteVideo).toHaveBeenCalledWith(cldVideo);
  });

  it("are no-ops where MEDIA_STORAGE_READONLY=1 (preview shares production's storage)", async () => {
    vi.stubEnv("MEDIA_STORAGE_READONLY", "1");
    expect(mediaDeletesDisabled()).toBe(true);
    await deleteImage(r2Image);
    await deleteVideo(r2Video);
    await deleteImage(cldImage);
    await deleteVideo(cldVideo);
    expect(r2Delete).not.toHaveBeenCalled();
    expect(cloudinaryDeleteImage).not.toHaveBeenCalled();
    expect(cloudinaryDeleteVideo).not.toHaveBeenCalled();
  });

  it("only the exact value 1 turns deletes off", () => {
    vi.stubEnv("MEDIA_STORAGE_READONLY", "0");
    expect(mediaDeletesDisabled()).toBe(false);
  });
});
