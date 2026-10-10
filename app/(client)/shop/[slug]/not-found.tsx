import Link from "next/link";
import { Search } from "lucide-react";
import ProductCard from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { getPublicProducts } from "@/lib/prefetch-home";

// Segment-scoped override of app/not-found.tsx: rendered when the product
// page calls notFound(), still with a real 404 status. A bare "Page not
// found" here is a dead end for a visitor who arrived from a paid ad
// specifically wanting this product, so this offers a search box and a
// handful of live products instead of losing them outright.
export default async function ProductNotFound() {
  const productsRes = await getPublicProducts().catch(() => null);
  const suggestions = productsRes?.data || [];

  return (
    <div className="bg-[#F4F4F4] dark:bg-gray-800 min-h-screen">
      <div className="container mx-auto px-4 py-10 lg:py-16">
        <div className="max-w-lg mx-auto text-center mb-10">
          <h1 className="text-2xl lg:text-3xl font-semibold text-foreground mb-2">
            এই প্রোডাক্টটি আর নেই
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            লিংকটি হয়তো পুরনো হয়ে গেছে, অথবা প্রোডাক্টটি সরিয়ে ফেলা হয়েছে। নিচে থেকে খুঁজে নিন অথবা আমাদের সব প্রোডাক্ট দেখুন।
          </p>

          <form action="/shop" method="GET" className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder="প্রোডাক্ট খুঁজুন..."
                className="w-full h-11 pl-9 pr-3 rounded-lg border border-border bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <Button type="submit" className="h-11">
              খুঁজুন
            </Button>
          </form>

          <Button nativeButton={false} variant="outline" render={<Link href="/shop" />}>
            সব প্রোডাক্ট দেখুন
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground text-center mb-4">
              এগুলো দেখতে পারেন
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {suggestions.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
