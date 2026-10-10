import { MetaCatalogConfig } from "./config"

export function formatPrice(price: number): string {
  return `${price.toFixed(2)} ${MetaCatalogConfig.currency}`
}

export function buildProductLink(productId: string): string {
  const base = MetaCatalogConfig.linkBase.replace(/\/+$/, "")
  return `${base}/shop/${productId}`
}

export function buildImageLink(imageUrl: string): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl
  }
  const base = MetaCatalogConfig.imageBase.replace(/\/+$/, "")
  return `${base}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`
}

export function mapAvailability(stock: number): "in stock" | "out of stock" | "preorder" | "available for order" {
  if (stock === MetaCatalogConfig.availabilityPreorder) return "preorder"
  if (stock >= MetaCatalogConfig.availabilityInStock) return "in stock"
  return "out of stock"
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + "\u2026"
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function escapeCsv(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function formatDate(date: Date): string {
  return date.toISOString()
}

export function computeEtag(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash).toString(36)
}
