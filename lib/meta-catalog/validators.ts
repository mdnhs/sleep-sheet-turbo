import type { RawProduct, ValidationError } from "./types"
import { mapAvailability, buildProductLink, buildImageLink, formatPrice, stripHtml } from "./utils"

export function validateProduct(product: RawProduct): ValidationError[] {
  const errors: ValidationError[] = []

  if (!product.id) {
    errors.push({ productId: product.id || "unknown", field: "id", message: "Missing product ID" })
  }

  if (!product.name || !product.name.trim()) {
    errors.push({ productId: product.id, field: "title", message: "Missing product name" })
  }

  if (product.price < 0) {
    errors.push({ productId: product.id, field: "price", message: "Negative price" })
  }

  if (product.price === 0) {
    errors.push({ productId: product.id, field: "price", message: "Zero price" })
  }

  if (!product.images || product.images.length === 0) {
    errors.push({ productId: product.id, field: "image_link", message: "No images" })
  }

  if (!product.sku || !product.sku.trim()) {
    errors.push({ productId: product.id, field: "mpn", message: "Missing SKU" })
  }

  if (product.stock < 0) {
    errors.push({ productId: product.id, field: "availability", message: "Negative stock" })
  }

  return errors
}

export function validateAndClean(product: RawProduct): { valid: boolean; errors: ValidationError[] } {
  const errors = validateProduct(product)
  return { valid: errors.length === 0, errors }
}
