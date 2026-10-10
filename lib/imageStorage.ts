import { uploadImage } from "@/lib/cloudinary"

interface SavedImage {
  filename: string;
  path: string;
  url: string;
}

export async function imageStorage(file: File | Buffer, folder = "products"): Promise<SavedImage> {
  const url = await uploadImage(file, folder)
  return {
    filename: url.split("/").pop() || "",
    path: url,
    url,
  }
}
