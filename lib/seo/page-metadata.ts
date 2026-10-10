// Server only — kept out of lib/seo/index.ts, which client components import.
import type { Metadata } from "next"
import { getSiteSeo, getStoreProfile } from "@/lib/settings/store"
import type { StoreProfile } from "@/lib/settings/store-profile"
import { generateMetadata, type MetadataParams, type SeoStore } from "@/lib/seo/metadata"

export async function seoStore(): Promise<SeoStore> {
  const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()])
  return { name: store.name, locale: store.locale, defaultImage: seo.image }
}

/** `export const generateMetadata = () => pageMetadata((store) => ({ … }))` for a static page. */
export async function pageMetadata(build: (store: StoreProfile) => MetadataParams): Promise<Metadata> {
  const [store, seo] = await Promise.all([getStoreProfile(), getSiteSeo()])
  return generateMetadata(build(store), { name: store.name, locale: store.locale, defaultImage: seo.image })
}
