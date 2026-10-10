export interface CatalogProduct {
  id: string
  title: string
  description: string
  availability: "in stock" | "out of stock" | "preorder" | "available for order"
  condition: "new" | "refurbished" | "used"
  price: string
  salePrice: string | null
  currency: string
  link: string
  imageLink: string
  additionalImageLinks: string[]
  brand: string
  googleProductCategory: string
  productType: string
  itemGroupId: string
  mpn: string
  gtin: string
  color: string
  size: string
  material: string
  gender: "male" | "female" | "unisex"
  ageGroup: "adult" | "kids" | "toddler" | "infant" | "newborn"
  customLabels: [string, string, string, string, string]
}

export interface CatalogVariant {
  id: string
  itemGroupId: string
  title: string
  description: string
  price: string
  salePrice: string | null
  availability: "in stock" | "out of stock" | "preorder" | "available for order"
  link: string
  imageLink: string
  additionalImageLinks: string[]
  brand: string
  googleProductCategory: string
  productType: string
  mpn: string
  gtin: string
  color: string
  size: string
  material: string
  gender: "male" | "female" | "unisex"
  ageGroup: "adult" | "kids" | "toddler" | "infant" | "newborn"
  customLabels: [string, string, string, string, string]
}

export interface FeedMeta {
  title: string
  link: string
  description: string
  updated: string
}

export interface FeedProduct {
  type: "product" | "variant"
  data: CatalogProduct | CatalogVariant
}

export type FeedFormat = "xml" | "csv" | "json"

export interface ValidationError {
  productId: string
  field: string
  message: string
}

export interface CacheEntry {
  data: string
  format: FeedFormat
  generatedAt: number
  etag: string
}

export interface RawProduct {
  id: string
  slug: string | null
  name: string
  description: string
  price: number
  stock: number
  sku: string
  variants: { name: string; price: number | null }[]
  sizes: string[]
  tags: string[]
  images: string[]
  features: string[]
  careInstruction: string | null
  categoryId: string
  createdAt: Date
  updatedAt: Date
  isFeatured: boolean
  discount: number
  defaultVariantName: string | null
  categoryValue: string | null
  categoryLabel: string | null
  specifications: { key: string; value: string }[]
}
