import { deleteImage } from "@/lib/cloudinary"

export const deleteImageFromStorage = async (imageUrl: string) => {
  if (!imageUrl || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) return
  try {
    await deleteImage(imageUrl)
  } catch (error) {
    console.error(`Error deleting image ${imageUrl}:`, error)
  }
}
