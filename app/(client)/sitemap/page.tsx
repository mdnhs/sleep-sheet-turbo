import Link from "next/link";
import { breadcrumbSchema, collectionPageSchema, seoConfig, structuredDataScript } from "@/lib/seo";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { getStoreProfile } from "@/lib/settings/store";
import { getSitemapPageData, type SitemapProduct } from "@/lib/seo/sitemap-page-data";

export const generateMetadata = () =>
  pageMetadata((store) => ({
    title: "Sitemap — All Pages, Categories & Products",
    description: `Every page, product category, product and blog guide at ${store.name} — comforters, bed sheets and pillow covers — in one place.`,
    canonical: "/sitemap",
  }));

// Same set the XML sitemap lists (lib/seo/sitemap.ts) — pages that are
// noindexed or disallowed in robots.txt (/sale, /track-order, sign-in) are
// deliberately not linked from here.
const mainPages = [
  { href: "/", label: "Home", note: "Latest comforters, bed sheets and offers" },
  { href: "/shop", label: "Shop all products", note: "Browse the full collection" },
  { href: "/new-arrivals", label: "New arrivals", note: "Freshly added designs" },
  { href: "/bestsellers", label: "Bestsellers", note: "Our most-ordered products" },
  { href: "/blog", label: "Blog", note: "Buying guides, care tips and comparisons" },
  { href: "/testimonials", label: "Customer reviews", note: "What our customers say" },
];

const companyPages = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
  { href: "/shipping-returns", label: "Shipping & returns" },
  { href: "/privacy-policy", label: "Privacy policy" },
  { href: "/terms-of-service", label: "Terms of service" },
];

const productHref = (p: SitemapProduct) => `/shop/${p.slug || p.id}`;

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link href={href} className="text-foreground/80 hover:text-primary hover:underline underline-offset-4">
        {label}
      </Link>
    </li>
  );
}

export default async function SitemapPage() {
  const store = await getStoreProfile();
  const data = await getSitemapPageData().catch(() => ({ categories: [], products: [], posts: [], hasVideos: false }));

  // The video page is noindexed while empty, so it is only listed once a product has a video.
  const pages = data.hasVideos
    ? [
        ...mainPages.slice(0, 4),
        { href: "/videos", label: "Product videos", note: "Watch products in action and order from the video" },
        ...mainPages.slice(4),
      ]
    : mainPages;

  const parents = data.categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => data.categories.filter((c) => c.parentId === id);
  const productsIn = (id: string) => data.products.filter((p) => p.categoryId === id);
  // A parent's own listing page rolls its children up, so count everything beneath it.
  const countFor = (id: string) =>
    productsIn(id).length + childrenOf(id).reduce((sum, ch) => sum + productsIn(ch.id).length, 0);

  const url = `${seoConfig.siteUrl}/sitemap`;
  const ld = [
    ...pages.map((p) => ({ name: p.label, url: `${seoConfig.siteUrl}${p.href === "/" ? "" : p.href}` })),
    ...parents.map((c) => ({ name: c.label, url: `${seoConfig.siteUrl}/categories/${c.value}` })),
  ];

  return (
    <div className="container mx-auto px-4 py-10 sm:py-12">
      {structuredDataScript(
        "sitemap-page",
        collectionPageSchema(
          `Sitemap | ${store.name}`,
          `Every page, category, product and guide at ${store.name}.`,
          url,
          ld,
        ),
      )}
      {structuredDataScript(
        "breadcrumbs",
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Sitemap", url: "/sitemap" },
        ]),
      )}

      <div className="max-w-5xl mx-auto">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-medium">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span className="text-border">•</span>
          <span className="text-foreground" aria-current="page">Sitemap</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Sitemap</h1>
        <p className="text-muted-foreground mb-6">
          Every page, category, product and guide at {store.name}
          {data.products.length > 0 && <> — {data.products.length} products across {parents.length} categories</>}.
        </p>

        <nav aria-label="Sitemap sections" className="mb-10 flex flex-wrap gap-2 text-sm">
          {[
            ["#pages", "Pages"],
            ["#categories", "Shop by category"],
            ["#blog", "Blog guides"],
            ["#company", "Company & policies"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full border border-border/60 bg-white dark:bg-slate-900 px-4 py-1.5 font-medium hover:border-primary/40 hover:text-primary transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        <section id="pages" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-semibold mb-4">Pages</h2>
          <ul className="grid gap-3 sm:grid-cols-2 list-none p-0 m-0">
            {pages.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="block rounded-xl border border-border/60 bg-white dark:bg-slate-900 px-4 py-3 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <span className="block text-sm font-semibold text-foreground">{p.label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{p.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="categories" className="mb-12 scroll-mt-24">
          <h2 className="text-xl font-semibold mb-4">Shop by category</h2>
          <div className="space-y-8">
            {parents.map((parent) => {
              const kids = childrenOf(parent.id);
              const own = productsIn(parent.id);
              return (
                <div key={parent.id}>
                  <h3 className="text-lg font-semibold mb-2">
                    <Link href={`/categories/${parent.value}`} className="hover:text-primary hover:underline underline-offset-4">
                      {parent.label}
                    </Link>{" "}
                    <span className="text-sm font-normal text-muted-foreground">({countFor(parent.id)})</span>
                  </h3>

                  {own.length > 0 && (
                    <ul className="columns-1 sm:columns-2 gap-x-8 space-y-1.5 text-sm list-none p-0 m-0 mb-3">
                      {own.map((p) => (
                        <SectionLink key={p.id} href={productHref(p)} label={p.name} />
                      ))}
                    </ul>
                  )}

                  {kids.map((child) => (
                    <div key={child.id} className="mt-4 ml-1 border-l-2 border-border/60 pl-4">
                      <h4 className="text-base font-medium mb-2">
                        <Link href={`/categories/${child.value}`} className="hover:text-primary hover:underline underline-offset-4">
                          {child.label}
                        </Link>{" "}
                        <span className="text-sm font-normal text-muted-foreground">({productsIn(child.id).length})</span>
                      </h4>
                      <ul className="columns-1 sm:columns-2 gap-x-8 space-y-1.5 text-sm list-none p-0 m-0">
                        {productsIn(child.id).map((p) => (
                          <SectionLink key={p.id} href={productHref(p)} label={p.name} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        {data.posts.length > 0 && (
          <section id="blog" className="mb-12 scroll-mt-24">
            <h2 className="text-xl font-semibold mb-4">
              <Link href="/blog" className="hover:text-primary hover:underline underline-offset-4">Blog guides</Link>
            </h2>
            <ul className="columns-1 sm:columns-2 gap-x-8 space-y-1.5 text-sm list-none p-0 m-0">
              {data.posts.map((post) => (
                <SectionLink key={post.slug} href={`/blog/${post.slug}`} label={post.title} />
              ))}
            </ul>
          </section>
        )}

        <section id="company" className="scroll-mt-24">
          <h2 className="text-xl font-semibold mb-4">Company & policies</h2>
          <ul className="columns-1 sm:columns-2 gap-x-8 space-y-1.5 text-sm list-none p-0 m-0">
            {companyPages.map((p) => (
              <SectionLink key={p.href} href={p.href} label={p.label} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
