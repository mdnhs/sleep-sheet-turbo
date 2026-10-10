import type { Metadata } from "next";
import Link from "next/link";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { seoConfig, generateMetadata as buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Sale",
  description: `Sales and special offers at ${seoConfig.siteName}.`,
  canonical: "/sale",
  // Nothing to show yet — don't index an empty placeholder. Remove this
  // once a real campaign is live on this page.
  noIndex: true,
});

const SalePage = () => {
  return (
    <div className="container mx-auto px-4 py-20 min-h-[70vh] flex items-center justify-center">
      <div className="max-w-lg mx-auto text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Tag className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-bold mb-3">No Sale Right Now</h1>
        <p className="text-muted-foreground mb-8">
          We don&apos;t have an active sale at the moment, but we run campaigns and special offers
          throughout the year — check back soon, or browse our latest and most popular products
          below in the meantime.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="rounded-full"
            nativeButton={false}
            render={<Link href="/new-arrivals" />}
          >
            Shop New Arrivals
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full"
            nativeButton={false}
            render={<Link href="/bestsellers" />}
          >
            Shop Bestsellers
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SalePage;
