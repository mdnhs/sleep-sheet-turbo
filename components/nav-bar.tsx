"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import dynamic from "next/dynamic";
import { useCurrent } from "@/features/auth/api/use-current";
import { useCartStore, selectTotalItems } from "@/features/cart/state/use-cart-store";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useSyncExternalStore } from "react";
import { Menu, ShoppingCart, User, Bed, BadgePercent, Search, Sun, Moon, Heart, Home, ShoppingBag } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryState } from "nuqs";
import { useTheme } from "next-themes";
import { LazyTooltip } from "@/components/lazy-tooltip";
import { Skeleton } from "@/components/ui/skeleton";

const subscribe = () => () => { };
const useHasMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

import { useLanguage } from "@/hooks/use-language";
import CartDrawer from "./cart/cart-drawer";
import { Button } from "./ui/button";
import { trackGtmSearch } from "@/lib/gtm";

// Loaded on demand: the account menu only ever renders for a signed-in
// visitor, after mount, yet a static import put its dropdown (base-ui Menu
// plus floating-ui positioning) in the JS every guest — i.e. every ad
// visitor — downloaded and ran.
const UserButton = dynamic(
  () => import("@/features/auth/components/user-button").then((m) => m.UserButton),
  { ssr: false, loading: () => <div className="size-10 rounded-full border" aria-hidden /> },
);

const NAV_LINKS = [
  { id: 1, name: "home" as const, path: "/" },
  { id: 2, name: "blog" as const, path: "/blog" },
  { id: 3, name: "navTrackOrder" as const, path: "/track-order" },
  // Hidden md–lg: six Bangla labels plus the search bar don't fit that range; the footer still links it.
  { id: 4, name: "navAbout" as const, path: "/about", hideMdToLg: true },
  { id: 5, name: "navContact" as const, path: "/contact" },
  // Hidden md–xl: a seventh label would squeeze the search bar to nothing below
  // 1280px; the mobile menu and footer still link it.
  { id: 6, name: "offers" as const, path: "/offer", icon: BadgePercent, hideMdToXl: true },
  { id: 7, name: "shop" as const, path: "/shop", hasBadge: false, icon: ShoppingBag },
];

function NavbarLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sortParam = searchParams.get("sort");
  const { t } = useLanguage();

  return NAV_LINKS.map((link) => {
    // Determine active state based on path and query parameters
    let isActive = false;
    if (link.path === "/") {
      isActive = pathname === "/";
    } else if (link.path.includes("sort=discount")) {
      isActive = pathname === "/shop" && sortParam === "discount";
    } else {
      isActive = pathname === link.path;
    }

    const Icon = link.icon;
    return (
      <Link
        key={link.name}
        href={link.path}
        className={`flex items-center gap-1.5 whitespace-nowrap text-[15px] font-medium transition-colors hover:text-primary ${link.hideMdToLg ? "md:max-lg:hidden" : ""} ${link.hideMdToXl ? "md:max-xl:hidden" : ""} ${isActive ? "text-primary font-semibold" : "text-slate-600 dark:text-slate-400"
          }`}
        onClick={onNavigate}
      >
        {Icon && <Icon className="h-4.5 w-4.5" />}
        <span>{t(link.name)}</span>
        {link.hasBadge && (
          <span className="ml-1 rounded-[4px] bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
            NEW
          </span>
        )}
      </Link>
    );
  });
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hasMounted = useHasMounted();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <LazyTooltip
      label="Toggle theme"
      render={
        <button
          onClick={toggleTheme}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105 text-foreground focus:outline-none"
          aria-label="Toggle theme"
        />
      }
    >
      {hasMounted && theme === "dark" ? (
        <Sun className="h-5 w-5 transition-transform duration-500 group-hover:rotate-45" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-500 group-hover:-rotate-12" />
      )}
    </LazyTooltip>
  );
}

function MobileThemeToggle({ hasMounted }: { hasMounted: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      aria-label="Toggle theme"
    >
      {hasMounted && theme === "dark" ? (
        <Sun className="h-4.5 w-4.5" />
      ) : (
        <Moon className="h-4.5 w-4.5" />
      )}
    </button>
  );
}

import { useWishlist } from "@/features/wishlist/api/use-wishlist";
import { useWebsiteSettings } from "@/hooks/use-website-settings";

function NavbarActions({
  hasMounted,
  onCartOpen,
  wishlistEnabled,
}: {
  hasMounted: boolean;
  onCartOpen: () => void;
  wishlistEnabled: boolean;
}) {
  const { data: user } = useCurrent();
  const totalItems = useCartStore(selectTotalItems);
  const { data: wishlist } = useWishlist(wishlistEnabled);
  const wishlistItemsCount = wishlist?.items?.length || 0;
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-4">
      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Wishlist Button */}
      <LazyTooltip
        label={t("wishlist")}
        render={
          <Link
            href="/account?tab=wishlist"
            className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105 text-foreground focus:outline-none"
            aria-label="View Wishlist"
          />
        }
      >
        <Heart className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
        {hasMounted && wishlistItemsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm">
            {wishlistItemsCount}
          </span>
        )}
      </LazyTooltip>

      {/* Cart Button */}
      <LazyTooltip
        label={t("cart")}
        render={
          <button
            onClick={onCartOpen}
            className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105 text-foreground focus:outline-none"
            aria-label="View Cart"
          />
        }
      >
        <ShoppingCart className="h-5 w-5 transition-transform duration-300 group-hover:rotate-3" />
        {hasMounted && totalItems > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-sm">
            {totalItems}
          </span>
        )}
      </LazyTooltip>

      {/* Profile/Sign In Button */}
      {!hasMounted || !user ? (
        <LazyTooltip
          label={t("signIn")}
          render={
            <Link
              href="/signin"
              className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-transparent transition-all duration-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-105 text-foreground focus:outline-none"
              aria-label="Sign In"
            />
          }
        >
          <User className="h-5 w-5" />
        </LazyTooltip>
      ) : (
        <UserButton />
      )}
    </div>
  );
}

function MobileNavbarMenu({
  isOpen,
  onOpenChange,
  logoUrl,
  siteName,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  logoUrl: string;
  siteName: string;
}) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full max-w-xs flex-col">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Image src={logoUrl} alt={`${siteName} logo`} width={160} height={40} className="h-10 w-auto object-contain" />
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-4">
            <NavbarLinks onNavigate={() => onOpenChange(false)} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileBottomNav({
  hasMounted,
  onCartOpen,
}: {
  hasMounted: boolean;
  onCartOpen: () => void;
}) {
  const pathname = usePathname();
  // On checkout pages and product detail pages (/shop/[productId]), hide the generic
  // bottom nav so:
  // 1) Checkout remains distraction-free and doesn't block form submission
  // 2) Product detail page's sticky "Add to Cart" / "Buy Now" CTA bar is fully accessible and not covered
  const isCheckout = pathname.includes("/checkout");
  const isProductDetail = pathname.startsWith("/shop/") && pathname.replace("/shop/", "").length > 0;
  const isHidden = isCheckout || isProductDetail;

  const { data: user } = useCurrent();
  const totalItems = useCartStore(selectTotalItems);
  const { data: wishlist } = useWishlist(!isHidden);
  const wishlistItemsCount = wishlist?.items?.length || 0;

  if (isHidden) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-background border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex items-center justify-between px-6 h-16 pb-safe">
      {/* Home */}
      <Link href="/" aria-label="Home" className={`flex flex-col items-center justify-center w-12 h-12 rounded-full ${pathname === '/' ? 'text-primary' : 'text-muted-foreground'}`}>
        <Home className="h-5 w-5" />
      </Link>

      {/* Wishlist */}
      <Link href="/account?tab=wishlist" aria-label="Wishlist" className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-full ${pathname === '/account' ? 'text-primary' : 'text-muted-foreground'}`}>
        <Heart className="h-5 w-5" />
        {hasMounted && wishlistItemsCount > 0 && (
          <span className="absolute top-2 right-2 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-primary text-[8px] font-bold text-white">
            {wishlistItemsCount}
          </span>
        )}
      </Link>

      {/* Center Shop Icon */}
      <div className="relative -top-5 flex items-center justify-center">
        <div className="absolute inset-0 bg-background rounded-full scale-110 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]"></div>
        {/* Matches the "AC Quilt" swatch on the homepage categories carousel
            (components/home/categories.tsx's SWATCHES[4], "Hot rose") —
            categories are sorted by their `order` column, and AC Quilt sits
            at order 4, landing on that swatch (index 4 % 6). */}
        <Link href="/shop" aria-label="Shop" className="relative flex items-center justify-center h-14 w-14 rounded-full bg-[linear-gradient(135deg,#FF6FA5,#B8245A)] text-white shadow-lg shadow-[#B8245A]/30 hover:scale-105 transition-transform z-10">
          <ShoppingBag className="h-6 w-6" />
        </Link>
      </div>

      {/* Cart */}
      <button onClick={onCartOpen} aria-label="View cart" className="relative flex flex-col items-center justify-center w-12 h-12 rounded-full text-muted-foreground hover:text-primary">
        <ShoppingCart className="h-5 w-5" />
        {hasMounted && totalItems > 0 && (
          <span className="absolute top-2 right-2 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-primary text-[8px] font-bold text-white">
            {totalItems}
          </span>
        )}
      </button>

      {/* Profile */}
      {!user ? (
        <Link href="/signin" aria-label="Sign in" className={`flex flex-col items-center justify-center w-12 h-12 rounded-full ${pathname === '/signin' ? 'text-primary' : 'text-muted-foreground'}`}>
          <User className="h-5 w-5" />
        </Link>
      ) : (
        <Link href="/account?tab=settings" aria-label="My account" className={`flex flex-col items-center justify-center w-12 h-12 rounded-full ${pathname === '/account' ? 'text-primary' : 'text-muted-foreground'}`}>
          <User className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

// Fixed square box, because the light logo (2:3) and dark logo (1:1) have
// different aspect ratios — sizing to the image made the header re-flow when
// the theme swapped or the file finished loading. The skeleton fills the box
// until the image is painted.
function NavLogo({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={`relative block shrink-0 ${className}`}>
      {!loaded && <Skeleton className="absolute inset-y-0 left-1/2 w-2/3 -translate-x-1/2 rounded-md dark:w-full" />}
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="48px"
        // A cached image can finish loading before hydration attaches onLoad.
        ref={(el) => {
          if (el?.complete) setLoaded(true);
        }}
        onLoad={() => setLoaded(true)}
        className={`object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}

// Suspense fallback for <Navbar>. The navbar reads useSearchParams(), so the
// static HTML used to contain nothing (fallback={null}) and the whole bar
// popped in after JS loaded, pushing the page down. This placeholder takes the
// same height as the real bar (mobile: menu row + search; product/checkout:
// menu row only; desktop: h-16 row) so there is nothing left to shift.
export function NavbarSkeleton() {
  const pathname = usePathname();
  const isCheckout = pathname.includes("/checkout");
  const isProductDetail = pathname.startsWith("/shop/") && pathname.replace("/shop/", "").length > 0;
  const hideMobileSearch = isCheckout || isProductDetail;

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md" aria-hidden="true">
      <div className="container mx-auto px-4">
        <div className={`md:hidden flex flex-col ${hideMobileSearch ? "py-1" : "py-2 gap-2"}`}>
          {/* Each slot is the real button's 36px hit area with a skeleton at
              the drawn glyph's size (Menu 20×14, logo 24×36 light / 36×36
              dark, theme icon 18px) instead of a round blob. */}
          <div className="flex h-14 items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center">
              <Skeleton className="h-3.5 w-5 rounded-sm" />
            </div>
            <div className="flex h-9 w-9 items-center justify-center">
              <Skeleton className="h-9 w-6 rounded-md dark:w-9" />
            </div>
            <div className="flex h-9 w-9 items-center justify-center">
              <Skeleton className="h-[18px] w-[18px] rounded-md" />
            </div>
          </div>
          {!hideMobileSearch && <Skeleton className="mb-2 h-10 w-full rounded-full" />}
        </div>
        <div className="hidden md:flex h-16 items-center justify-between gap-4">
          <div className="flex h-12 w-12 shrink-0 justify-center">
            <Skeleton className="h-12 w-8 rounded-md dark:w-12" />
          </div>
          <div className="flex items-center gap-4 lg:gap-8">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24 md:max-lg:hidden" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14 md:max-xl:hidden" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="mx-2 lg:mx-4 h-10 max-w-xs flex-1 rounded-full" />
          <div className="flex items-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-10 w-10 items-center justify-center">
                <Skeleton className="h-5 w-5 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  const pathname = usePathname();
  const isCheckout = pathname.includes("/checkout");
  const wishlistEnabled = !isCheckout;
  const isProductDetail = pathname.startsWith("/shop/") && pathname.replace("/shop/", "").length > 0;
  const hideMobileSearch = isCheckout || isProductDetail;

  const { siteName, logoUrl } = useWebsiteSettings();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasMounted = useHasMounted();
  const { t } = useLanguage();
  const { theme } = useTheme();
  // The dark logo is designed for dark backgrounds, so swap to it once
  // mounted and dark mode is active (avoids an SSR/client theme mismatch).
  const displayLogo = hasMounted && theme === "dark" ? "/dark-logo.webp" : logoUrl;

  const router = useRouter();
  const [searchQuery, setSearchQuery] = useQueryState("search", {
    defaultValue: "",
    shallow: false,
  });
  const [inputVal, setInputVal] = useState(searchQuery);

  // Warm the checkout route's JS chunk as soon as the cart drawer opens,
  // since that's the strongest signal the user is about to head there —
  // avoids waiting for the <Link> hover/viewport prefetch after they click
  // "Proceed to Checkout".
  React.useEffect(() => {
    if (isCartOpen) {
      router.prefetch("/checkout");
    }
  }, [isCartOpen, router]);

  // Sync local input value if url changes (e.g. from page transition or clear)
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inputVal is also user-typed between URL changes, so it can't be purely derived from searchQuery.
    setInputVal(searchQuery);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputVal.trim();
    if (query) {
      trackGtmSearch(query);
    }
    const isProductsPage = window.location.pathname === "/shop";
    if (isProductsPage) {
      setSearchQuery(query || null);
    } else {
      if (query) {
        router.push(`/shop?search=${encodeURIComponent(query)}`);
      } else {
        router.push(`/shop`);
      }
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto px-4">
          {/* Both layouts are always rendered and switched with CSS. Picking one
              in JS (useIsMobile is false until after hydration) made the
              server HTML ship the tall-desktop bar and then jump to the
              mobile one on every reload — a visible layout shift. */}
          <div className={`md:hidden flex flex-col ${hideMobileSearch ? "py-1" : "py-2 gap-2"}`}>
              <div className="flex h-14 items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMenuOpen(true)}
                  aria-label="Open menu"
                  className="hover:bg-transparent"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <Link href="/" aria-label={`${siteName} home`} className="flex items-center gap-2 select-none">
                  <NavLogo key={displayLogo} src={displayLogo} alt={`${siteName} logo`} className="h-9 w-9" />
                </Link>
                <div className="flex items-center gap-2">
                  <MobileThemeToggle hasMounted={hasMounted} />
                </div>
              </div>
              {/* Search Input for Mobile Viewports (hidden on product detail & checkout for clean viewport) */}
              {!hideMobileSearch && (
                <form onSubmit={handleSearch} className="relative w-full mb-2">
                  <input
                    type="text"
                    placeholder={t("searchPlaceholder")}
                    aria-label={t("searchPlaceholder")}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    className="w-full rounded-full border-none bg-slate-100 dark:bg-slate-800/50 py-2.5 pl-5 pr-12 text-sm text-foreground placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none transition-all shadow-inner focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-slate-800"
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </form>
              )}
          </div>
          <div className="hidden md:flex h-16 items-center justify-between gap-4">
              {/* Logo */}
              <Link href="/" aria-label={`${siteName} home`} className="flex items-center gap-2 select-none shrink-0">
                <NavLogo key={displayLogo} src={displayLogo} alt={`${siteName} logo`} className="h-12 w-12" />
              </Link>

              {/* Links */}
              <div className="flex items-center gap-4 lg:gap-8">
                <NavbarLinks />
              </div>

              {/* Search Bar */}
              <form onSubmit={handleSearch} className="relative flex-1 max-w-xs mx-2 lg:mx-4">
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  className="w-full rounded-full border-none bg-slate-100 dark:bg-slate-800/50 py-2.5 pl-5 pr-12 text-sm text-foreground placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none transition-all shadow-inner focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-slate-800"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-primary hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <Search className="h-[18px] w-[18px]" />
                </button>
              </form>

              {/* Actions */}
              <NavbarActions
                hasMounted={hasMounted}
                onCartOpen={() => setIsCartOpen(true)}
                wishlistEnabled={wishlistEnabled}
              />
          </div>
        </div>

        <MobileNavbarMenu
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
          logoUrl={displayLogo}
          siteName={siteName}
        />

        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      </nav>

      <MobileBottomNav hasMounted={hasMounted} onCartOpen={() => setIsCartOpen(true)} />
    </>
  );
}

export default Navbar;

