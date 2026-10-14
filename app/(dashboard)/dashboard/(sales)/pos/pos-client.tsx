"use client"
import { PageTitle } from "@/components/dashboard-page-title"
import { capitalizeWords } from "@/lib/capitalize-words";
import { useWebsiteSettings } from "@/hooks/use-website-settings"
import { useEffect, useState, useCallback, useMemo } from "react"
import { useGetInfiniteProducts } from "@/features/product/api/use-get-products"
import { useInView } from "react-intersection-observer"
import { useQueryState } from "nuqs"
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Receipt, X, Package, Loader2, ChevronLeft, ChevronRight, ListFilter, ShoppingCart, ChevronUp, ArrowUpCircle, Tag, Star, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { Skeleton } from "@/components/ui/skeleton"
import { PosProductGridSkeleton } from "./pos-skeleton"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useCurrency } from "@/hooks/use-currency"
import { useSettings } from "@/features/settings/api/use-settings"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { getOrCreatePosIdempotencyKey, clearPosIdempotencyKey } from "@/lib/pos-idempotency"
import { getOptimizedImageUrl, cn } from "@/lib/utils"
import { sanitizeRichText } from "@/lib/sanitize"

interface POSProduct {
  id: string
  name: string
  description?: string
  price: number
  stock: number
  images: string[]
  colors: { name: string; price?: number | null }[]
  sizes: string[]
  addOns?: { name: string; price: number }[]
  category: string
  categoryLabel: string
  discount?: number
  defaultVariantName?: string
  sku?: string
  tags?: string[]
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  size: string | null
  color: string | null
  image: string
  stock: number
  costPrice?: number
  shippingCost?: number
}

interface Category {
  id: string
  label: string
  value: string
}

export default function PosClientPage() {
  const router = useRouter()
  const { formatAmount } = useCurrency()
  const { data: settings } = useSettings()
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [detailsProduct, setDetailsProduct] = useState<POSProduct | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [skuCopied, setSkuCopied] = useState(false)

  const copySku = async (sku: string) => {
    try {
      await navigator.clipboard.writeText(sku)
      setSkuCopied(true)
      setTimeout(() => setSkuCopied(false), 1500)
    } catch {
      toast.error("Failed to copy SKU")
    }
  }
  const [categoryFilter, setCategoryFilter] = useQueryState("category", { defaultValue: "" })
  const [featuredFilter, setFeaturedFilter] = useQueryState("featured", { defaultValue: "all" })
  const [sortFilter, setSortFilter] = useQueryState("sort", { defaultValue: "featured" })

  const FEATURED_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "true", label: "Featured" },
    { value: "false", label: "Standard" },
  ]

  const SORT_OPTIONS = [
    { value: "featured", label: "Featured" },
    { value: "price-asc", label: "Low to High" },
    { value: "price-desc", label: "High to Low" },
  ]

  const { siteName } = useWebsiteSettings()
  const customMethods: { label: string; value: string }[] = settings?.pos_payment_methods
    ? JSON.parse(settings.pos_payment_methods)
    : []

  const fbPagesSetting = settings?.pos_facebook_pages
  const facebookPages: { id: string; name: string }[] = useMemo(() => {
    if (!fbPagesSetting) return [{ id: "default", name: siteName }]
    try {
      const parsed = JSON.parse(fbPagesSetting)
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: "default", name: siteName }]
    } catch {
      return [{ id: "default", name: siteName }]
    }
  }, [fbPagesSetting, siteName])

  const defaultFbPage = settings?.pos_default_facebook_page || (facebookPages[0]?.name || siteName)

  const paymentMethods = [
    { value: "COD", label: "Cash", icon: Banknote, enabled: settings ? settings.payment_method_cod !== "false" : true },
    { value: "CARD", label: "Card", icon: CreditCard, enabled: settings ? settings.payment_method_card !== "false" : true },
    { value: "DUE", label: "Due", icon: Receipt, enabled: settings ? settings.payment_method_due !== "false" : true },
    ...customMethods.map(m => ({ value: m.value, label: m.label, icon: Banknote, enabled: true })),
  ]
  const enabledMethods = paymentMethods.filter(m => m.enabled)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [reference, setReference] = useState(defaultFbPage)
  const [note, setNote] = useState("")
  const [shippingType, setShippingType] = useState<"showroom" | "online">("online")
  const [paymentMethod, setPaymentMethod_] = useState("COD")
  const setPaymentMethod = (v: string) => { setPaymentMethod_(v) }
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)
  const [lastOrder, setLastOrder] = useState<{ id: string; orderNumber: string; totalAmount: number } | null>(null)

  useEffect(() => {
    if (defaultFbPage && !reference) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the default page arrives once settings load; reference stays user-editable afterward, so it can't be purely derived.
      setReference(defaultFbPage)
    }
  }, [defaultFbPage, reference])

  useEffect(() => {
    if (settings && !enabledMethods.find(m => m.value === paymentMethod)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets an invalid payment method once settings load; paymentMethod is also user-editable afterward, so it can't be purely derived.
      setPaymentMethod(enabledMethods[0]?.value || "COD")
    }
  }, [settings, enabledMethods])

  const {
    data: productsPages,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage
  } = useGetInfiniteProducts({
    category: categoryFilter,
    featured: featuredFilter === "all" ? undefined : featuredFilter,
    sort: sortFilter,
    search: debouncedSearch,
    // Bypasses the storefront's CDN cache (see features/product/server/route.ts)
    // so POS always sells against the current stock/price/discount, not a
    // response that's up to several minutes stale.
    pos: "true",
  });

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "200px",
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const products = productsPages?.pages.flatMap((page) => page.data) || [];

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories")
      const json = await res.json()
      if (Array.isArray(json)) setCategories(json)
    } catch (error) {
      console.error("Failed to fetch categories", error)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchCategories is an async fetch-on-mount; its setCategories call happens after an awaited response, not synchronously in this effect.
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const addToCart = (product: POSProduct, variant?: { name: string; price?: number | null }, size?: string, costPrice?: number, shippingCost?: number, quantity: number = 1) => {
    setCart(prev => {
      const price = variant?.price ?? product.price
      const color = variant?.name || null
      const existing = prev.find(
        i => i.productId === product.id && i.color === color && i.size === (size || null) && i.costPrice === costPrice
      )

      if (existing) {
        if (existing.quantity + quantity > product.stock) {
          toast.error("Insufficient stock")
          return prev
        }
        return prev.map(i =>
          i.productId === product.id && i.color === color && i.size === (size || null) && i.costPrice === costPrice
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      }

      if (quantity > product.stock) {
        toast.error("Insufficient stock")
        return prev
      }

      return [...prev, {
        productId: product.id,
        name: product.name,
        price,
        quantity,
        size: size || null,
        color,
        image: product.images?.[0] || "",
        stock: product.stock,
        costPrice,
        shippingCost: shippingCost || 0,
      }]
    })
  }

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index]
      if (!item) return prev
      const newQty = item.quantity + delta
      if (newQty <= 0) return prev.filter((_, i) => i !== index)
      if (newQty > item.stock) {
        toast.error("Insufficient stock")
        return prev
      }
      return prev.map((i, idx) => idx === index ? { ...i, quantity: newQty } : i)
    })
  }

  const updateShippingCost = (index: number, cost: number) => {
    setCart(prev => prev.map((item, idx) => idx === index ? { ...item, shippingCost: cost } : item))
  }

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0)
  const totalShipping = cart.reduce((acc, i) => acc + (i.shippingCost || 0) * i.quantity, 0)
  const totalAmount = subtotal + totalShipping

  const handleCheckout = async () => {
    if (!customerName.trim()) {
      toast.error("Customer name is required")
      return
    }
    if (cart.length === 0) {
      toast.error("Cart is empty")
      return
    }

    setIsCheckingOut(true)
    try {
      const res = await fetch("/api/pos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: capitalizeWords(customerName.trim()),
          customerPhone: customerPhone.trim() || undefined,
          customerAddress: capitalizeWords(customerAddress.trim()) || undefined,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
          shippingType,
          paymentMethod,
          items: cart.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
            costPrice: i.costPrice,
            size: i.size || undefined,
            color: i.color || undefined,
          })),
          shippingCost: totalShipping,
          // Same key for every submit of this sale attempt, so a double-click
          // or a retry after a slow response returns the existing sale
          // instead of creating a second one (see lib/pos-idempotency.ts).
          idempotencyKey: getOrCreatePosIdempotencyKey(),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "Checkout failed")
        setIsCheckingOut(false)
        return
      }

      // Sale is placed — retire this key so the next sale starts a fresh
      // idempotency window.
      clearPosIdempotencyKey()
      setLastOrder(json.order)
      setCheckoutSuccess(true)
      setCart([])
      setCustomerName("")
      setCustomerPhone("")
      setReference(defaultFbPage || "")
      setNote("")
      setShippingType("online")
      toast.success("Order placed successfully!")
    } catch (error) {
      toast.error("Failed to place order")
    } finally {
      setIsCheckingOut(false)
    }
  }

  const newSale = () => {
    setCheckoutSuccess(false)
    setLastOrder(null)
    setReference(defaultFbPage || "")
  }

  if (checkoutSuccess && lastOrder) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Receipt className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Sale Complete</h1>
          <div className="bg-muted rounded-xl p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Order Number</p>
            <p className="text-xl font-mono font-bold">{lastOrder.orderNumber}</p>
            <div className="h-px bg-border my-3" />
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-3xl font-bold">৳{lastOrder.totalAmount.toLocaleString()}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={newSale}>
              <Plus className="mr-2 h-4 w-4" />
              New Sale
            </Button>
            <Button variant="outline" onClick={() => router.push(`/dashboard/orders`)}>
              View Orders
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const renderCartContents = () => (
    <>
      <div className="p-4 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Current Sale
          {cart.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({cart.length} item{cart.length !== 1 ? "s" : ""})
            </span>
          )}
        </h2>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center">
            <Package className="h-10 w-10 mb-2" />
            <p className="text-sm">Cart is empty</p>
            <p className="text-xs">Select products to start a sale</p>
          </div>
        ) : (
          cart.map((item, index) => (
            <div key={`${item.productId}-${item.color}-${item.size}`} className="flex gap-3 p-3 rounded-xl bg-muted/50 border">
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                    No img
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {item.color && <p className="text-xs text-muted-foreground">Color: {item.color}</p>}
                {item.size && <p className="text-xs text-muted-foreground">Size: {item.size}</p>}
                <p className="text-sm font-semibold mt-1">৳{item.price.toLocaleString()}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase shrink-0">Ship Cost:</span>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.shippingCost || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0
                      updateShippingCost(index, val)
                    }}
                    className="h-6 w-20 px-2 text-xs rounded-md shadow-none"
                  />
                </div>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button
                  onClick={() => removeFromCart(index)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(index, -1)}
                    className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(index, 1)}
                    className="h-7 w-7 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                    disabled={item.quantity >= item.stock}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer & Checkout */}
      {cart.length > 0 && (
        <div className="border-t p-4 space-y-3 shrink-0 bg-background">
          <div className="space-y-2">
            <Input
              placeholder="Customer name *" className="capitalize"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              placeholder="Phone (optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              type="tel"
            />
            <Input
              placeholder="Address (optional)" className="capitalize"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
            <Select
              value={reference || "__none__"}
              onValueChange={(val) => setReference(val === "__none__" ? "" : (val || ""))}
            >
              <SelectTrigger className="w-full rounded-xl text-sm h-9 bg-transparent border border-input shadow-sm">
                <SelectValue placeholder="Facebook page (optional)" />
              </SelectTrigger>
              <SelectContent positionerClassName="z-[70]" className="rounded-2xl">
                <SelectItem value="__none__" className="text-xs font-medium text-muted-foreground">
                  None (No Facebook Page)
                </SelectItem>
                {facebookPages.map((page) => (
                  <SelectItem key={page.id} value={page.name} className="text-xs font-medium">
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <textarea
              placeholder="Notes (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[60px] resize-none"
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={shippingType === "online" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setShippingType("online")}
            >
              Online
            </Button>
            <Button
              variant={shippingType === "showroom" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setShippingType("showroom")}
            >
              Showroom
            </Button>
          </div>

          <div className="flex gap-2">
            {enabledMethods.map(m => (
              <Button
                key={m.value}
                variant={paymentMethod === m.value ? "default" : "outline"}
                size="sm"
                className={`flex-1 gap-1.5 ${paymentMethod === m.value && m.value === "DUE" ? "bg-orange-600 hover:bg-orange-700 border-orange-600 text-white" : paymentMethod === m.value && !["COD","CARD","DUE"].includes(m.value) ? "bg-foreground text-background" : ""}`}
                onClick={() => setPaymentMethod(m.value)}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>৳{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping Cost</span>
              <span>৳{totalShipping.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-lg font-bold">৳{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <Button
            className="w-full h-11 text-base gap-2"
            onClick={handleCheckout}
            disabled={isCheckingOut}
          >
            {isCheckingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {isCheckingOut ? "Processing..." : `Complete Sale — ৳${totalAmount.toLocaleString()}`}
          </Button>
        </div>
      )}
    </>
  )

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] p-2 sm:p-4 md:p-6 gap-3 sm:gap-6 relative animate-in fade-in duration-300">
      <PageTitle title="Point of Sale" />
      {/* Left Panel - Product Browser */}
      <div className="flex-1 flex flex-col rounded-3xl bg-white dark:bg-card p-1.5 sm:p-6 border-none shadow-none overflow-hidden pb-16 lg:pb-0">
        {/* Search & Filter Bar */}
        <div className="pb-2 sm:pb-4 border-b space-y-1.5 sm:space-y-3 shrink-0">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-full text-xs font-semibold"
              />
            </div>
            <Select value={categoryFilter || "all"} onValueChange={(val) => setCategoryFilter(val === "all" ? null : val)}>
              <SelectTrigger className="w-[130px] sm:w-[170px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
                <SelectValue placeholder="Category">
                  {categoryFilter || "All Categories"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" label="All Categories" className="capitalize text-xs font-medium">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.label} label={cat.label} className="capitalize text-xs font-medium">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <Select value={featuredFilter} onValueChange={(val) => setFeaturedFilter(val === "all" ? null : val)}>
                <SelectTrigger className="w-full sm:w-[140px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
                  <SelectValue placeholder="Status">
                    {FEATURED_OPTIONS.find((opt) => opt.value === featuredFilter)?.label ?? "Status"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {FEATURED_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} label={opt.label} className="capitalize text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortFilter} onValueChange={(val) => setSortFilter(val === "featured" ? null : val)}>
                <SelectTrigger className="w-full sm:w-[170px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8 capitalize">
                  <SelectValue placeholder="Sort by">
                    {SORT_OPTIONS.find((opt) => opt.value === sortFilter)?.label ?? "Sort by"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} label={opt.label} className="capitalize text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pt-2 sm:pt-4">
          {isLoading ? (
            <PosProductGridSkeleton />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Package className="h-12 w-12 mb-3" />
              <p>No products found</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addToCart}
                    onViewDetails={(p) => { setActiveImage(0); setDetailsProduct(p) }}
                  />
                ))}
              </div>

              {/* Infinite Scroll Trigger */}
              {hasNextPage && (
                <div ref={ref} className="w-full flex items-center justify-center py-3 sm:py-6 mt-2 sm:mt-4">
                  {isFetchingNextPage ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-3 w-full">
                      <Skeleton className="h-20 rounded-2xl" />
                      <Skeleton className="h-20 rounded-2xl" />
                    </div>
                  ) : (
                    <div className="h-6" /> // Placeholder
                  )}
                </div>
              )}

              {!hasNextPage && products.length > 0 && (
                <div className="w-full text-center py-3 sm:py-6 mt-2 sm:mt-4 text-muted-foreground text-sm">
                  You&apos;ve reached the end!
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop Right Panel - Cart */}
      <div className="hidden lg:flex w-[400px] flex-col rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none shrink-0">
        {renderCartContents()}
      </div>

      {/* Mobile Sticky Cart Bar */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex items-center justify-between md:left-64">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-muted-foreground">{cart.length} item(s)</span>
          <span className="text-lg font-bold text-foreground">৳{totalAmount.toLocaleString()}</span>
        </div>
        <Sheet>
          <SheetTrigger
            render={
              <Button size="lg" className="px-8 shadow-sm">
                <ShoppingCart className="w-4 h-4 mr-2" />
                View Cart
              </Button>
            }
          />
          <SheetContent side="bottom" className="h-[90vh] p-0 flex flex-col rounded-t-xl overflow-hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Shopping Cart</SheetTitle>
            </SheetHeader>
            {renderCartContents()}
          </SheetContent>
        </Sheet>
      </div>

      <Dialog open={!!detailsProduct} onOpenChange={(open) => !open && setDetailsProduct(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          {detailsProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{detailsProduct.name}</DialogTitle>
                <DialogDescription className="capitalize flex flex-wrap items-center gap-1">
                  <span>{detailsProduct.categoryLabel || detailsProduct.category || "Uncategorized"}</span>
                  {detailsProduct.sku && (
                    <span className="flex items-center gap-1 normal-case">
                      <span>· SKU {detailsProduct.sku}</span>
                      <button
                        type="button"
                        onClick={() => copySku(detailsProduct.sku!)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy SKU"
                      >
                        {skuCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="aspect-square overflow-hidden rounded-2xl bg-slate-50 dark:bg-muted/30">
                    <img
                      key={detailsProduct.images[activeImage]}
                      src={getOptimizedImageUrl(detailsProduct.images[activeImage] || detailsProduct.images[0], 800) || "/placeholder.jpg"}
                      alt={detailsProduct.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget
                        if (!img.src.endsWith("/placeholder.jpg")) img.src = "/placeholder.jpg"
                      }}
                    />
                  </div>
                  {detailsProduct.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {detailsProduct.images.map((src, i) => (
                        <button
                          key={`${src}-${i}`}
                          type="button"
                          onClick={() => setActiveImage(i)}
                          className={cn(
                            "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2",
                            i === activeImage ? "border-slate-900 dark:border-indigo-500" : "border-transparent"
                          )}
                        >
                          <img src={getOptimizedImageUrl(src, 120)} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-bold">{formatAmount(detailsProduct.price)}</span>
                    {detailsProduct.discount ? (
                      <Badge variant="secondary" className="rounded-full text-[10px] font-semibold">
                        {detailsProduct.discount}% off
                      </Badge>
                    ) : null}
                  </div>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-muted-foreground">Stock</dt>
                    <dd className={cn("font-semibold", detailsProduct.stock <= 0 && "text-destructive")}>
                      {detailsProduct.stock > 0 ? detailsProduct.stock : "Out of stock"}
                    </dd>
                  </dl>

                  {detailsProduct.sizes?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Sizes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProduct.sizes.map((size) => (
                          <Badge key={size} variant="outline" className="rounded-full text-[10px]">{size}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailsProduct.colors?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Variants</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProduct.colors.map((v) => (
                          <Badge key={v.name} variant="outline" className="rounded-full text-[10px]">
                            {v.name}{v.price != null ? ` · ${formatAmount(v.price)}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailsProduct.addOns && detailsProduct.addOns.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Add-ons</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProduct.addOns.map((a) => (
                          <Badge key={a.name} variant="outline" className="rounded-full text-[10px]">
                            {a.name} · {formatAmount(a.price)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailsProduct.tags && detailsProduct.tags.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detailsProduct.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="rounded-full text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {detailsProduct.description && (
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert rounded-2xl bg-slate-50 dark:bg-muted/30 p-4 leading-relaxed prose-headings:mt-0 prose-headings:mb-2 prose-h2:text-base prose-h4:text-sm prose-p:my-1.5"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichText(detailsProduct.description) }}
                  />
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProductCard({
  product,
  onAdd,
  onViewDetails,
}: {
  product: POSProduct
  onAdd: (product: POSProduct, variant?: { name: string; price?: number | null }, size?: string, costPrice?: number, shippingCost?: number, quantity?: number) => void
  onViewDetails: (product: POSProduct) => void
}) {
  const { formatAmount } = useCurrency()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || "")
  const [selectedColor, setSelectedColor] = useState(product.defaultVariantName || product.colors?.[0]?.name || "")
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({})
  const [quantity, setQuantity] = useState(1)
  const [costPrice, setCostPrice] = useState("")
  const [addOnCostPrice, setAddOnCostPrice] = useState("")
  const [shippingCost, setShippingCost] = useState("")

  const hasColors = product.colors && product.colors.length > 0
  const hasSizes = product.sizes && product.sizes.length > 0
  const hasAddOns = product.addOns && product.addOns.length > 0
  const hasVariants = hasColors || hasSizes || hasAddOns

  const currentVariant = product.colors?.find(c => c.name === selectedColor)
  const basePrice = (currentVariant?.price ?? product.price) ?? 0

  const addOnsTotalPerUnit = Object.entries(selectedAddOns).reduce((sum, [name, qty]) => {
    const addOn = product.addOns?.find((a) => a.name === name)
    return sum + (addOn ? addOn.price * qty : 0)
  }, 0)

  const hasSelectedAddOns = Object.values(selectedAddOns).some((qty) => qty > 0)

  const displayPrice = basePrice + addOnsTotalPerUnit

  const handleAddToCart = () => {
    if (hasSizes && !selectedSize) { toast.error("Please select a size"); return }
    if (hasColors && !selectedColor) { toast.error("Please select a variant"); return }
    if (isDrawerOpen && costPrice !== "" && isNaN(Number(costPrice))) { toast.error("Bought price must be a number"); return }
    if (isDrawerOpen && addOnCostPrice !== "" && isNaN(Number(addOnCostPrice))) { toast.error("Add-on bought price must be a number"); return }
    if (isDrawerOpen && shippingCost !== "" && isNaN(Number(shippingCost))) { toast.error("Shipping cost must be a number"); return }

    const selectedAddOnsSummary = Object.entries(selectedAddOns)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => {
        const addOn = product.addOns?.find((a) => a.name === name)
        return addOn ? `${name} x${qty} (${formatAmount(addOn.price)})` : `${name} x${qty}`
      })
      .join(", ")

    const colorWithAddOns = selectedColor
      ? (selectedAddOnsSummary ? `${selectedColor} (+ ${selectedAddOnsSummary})` : selectedColor)
      : (selectedAddOnsSummary ? `Add-ons: ${selectedAddOnsSummary}` : "")

    const finalColor = colorWithAddOns || selectedColor || undefined
    const variant = finalColor ? { name: finalColor, price: displayPrice } : (currentVariant || undefined)
    const size = hasSizes ? selectedSize : undefined
    const parsedCostPrice = (costPrice !== "" ? Number(costPrice) : 0) + (addOnCostPrice !== "" ? Number(addOnCostPrice) : 0)
    const finalCostPrice = costPrice !== "" || addOnCostPrice !== "" ? parsedCostPrice : undefined
    const parsedShippingCost = shippingCost !== "" ? Number(shippingCost) : undefined

    onAdd(product, variant, size, finalCostPrice, parsedShippingCost, quantity)
    setIsDrawerOpen(false)
    setCostPrice("")
    setAddOnCostPrice("")
    setShippingCost("")
    setSelectedAddOns({})
    setQuantity(1)
  }

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDrawerOpen(true)
  }

  const updateQuantity = (e: React.MouseEvent, delta: number) => {
    e.preventDefault()
    e.stopPropagation()
    setQuantity(Math.max(1, quantity + delta))
  }

  return (
    <div className="group relative w-full h-full flex flex-col rounded-3xl bg-white dark:bg-slate-900 p-1.5 sm:p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800 overflow-hidden transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      {/* Product Image */}
      <div
        className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-[#f4f4f5] dark:bg-slate-800 mb-4 shrink-0 z-0 cursor-pointer"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onViewDetails(product); }}
      >
        {product.images?.[0] ? (
          <img
            src={getOptimizedImageUrl(product.images[0], 400)}
            alt={product.name}
            className={`h-full w-full object-cover transition-all duration-700 ${isDrawerOpen ? 'blur-md scale-110 opacity-40' : 'group-hover:scale-105'}`}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-300 dark:text-slate-600">
            <Package className="h-8 w-8" />
          </div>
        )}

        {/* Top actions: Discount tag + Stock badge */}
        <div className="absolute top-3 left-3 flex justify-between items-start z-10 w-[calc(100%-24px)]">
          <div className="flex gap-2">
            {product.discount && product.discount > 0 ? (
              <div className="bg-[#1a1a1a] text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
                <Tag className="h-3 w-3 text-orange-400" /> {Math.round(product.discount)}% OFF
              </div>
            ) : null}
            {product.stock > 0 && product.stock <= 5 && (
              <div className="bg-[#1a1a1a] text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm">
                Only {product.stock} left
              </div>
            )}
          </div>
          <div />
        </div>

        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <span className="text-white font-semibold text-sm">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col px-1 flex-1 relative z-10 bg-white dark:bg-slate-900">
        {/* Title */}
        <div className="flex-1">
          <h3 className="font-medium text-sm sm:text-[15px] text-slate-800 dark:text-slate-200 leading-snug line-clamp-2 mb-2 sm:mb-3">
            {product.name}
          </h3>
        </div>

        {/* Price */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            {product.discount && product.discount > 0 && (
              <span className="text-sm line-through text-slate-400 dark:text-slate-500 font-medium">
                {formatAmount(displayPrice / (1 - product.discount / 100))}
              </span>
            )}
            <p className="font-bold text-lg sm:text-[20px] text-slate-800 dark:text-slate-200">
              {formatAmount(displayPrice)}
            </p>
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="flex items-center mb-3 sm:mb-4">
          <div className="flex-1 flex items-center justify-between bg-[#f4f4f5] dark:bg-slate-800 rounded-xl px-2 h-10 sm:h-12" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <button onClick={(e) => updateQuantity(e, -1)} className="p-1 sm:p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-50" disabled={quantity <= 1}>
              <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
            <span className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">{quantity}</span>
            <button onClick={(e) => updateQuantity(e, 1)} className="p-1 sm:p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dialog for Variants */}
      <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Options</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {hasSizes && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Size</span>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedSize(size); }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        selectedSize === size
                          ? 'border-primary bg-primary text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasColors && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Variants</span>
                <div className="flex flex-wrap gap-2">
                  {product.colors?.map((color) => (
                    <button
                      key={color.name}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedColor(color.name); }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                        selectedColor === color.name
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {color.name} ({formatAmount(color.price ?? product.price ?? 0)})
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {hasAddOns && (
              <div className="flex flex-col gap-2 mt-2 border-t pt-3 border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Add-ons
                </span>
                <div className="flex flex-col gap-2">
                  {product.addOns?.map((addOn) => {
                    const qty = selectedAddOns[addOn.name] || 0;
                    return (
                      <div
                        key={addOn.name}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <div className="flex flex-col justify-center min-w-0 pr-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {addOn.name} ({formatAmount(addOn.price)})
                          </span>
                          {qty > 0 && (
                            <span className="text-[11px] font-medium text-primary mt-0.5">
                              Total: {formatAmount(addOn.price * qty)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shrink-0">
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedAddOns((prev) => ({
                                ...prev,
                                [addOn.name]: Math.max(0, qty - 1),
                              }));
                            }}
                            disabled={qty <= 0}
                          >
                            −
                          </button>
                          <span className="px-1.5 text-center text-xs font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {qty}
                          </span>
                          <button
                            type="button"
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-sm font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedAddOns((prev) => ({
                                ...prev,
                                [addOn.name]: qty + 1,
                              }));
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Bought Price (Cost)</span>
              <Input
                type="number"
                placeholder="0.00"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
              />
            </div>

            {hasSelectedAddOns && (
              <div className="flex flex-col gap-1 mt-2">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Add-on Bought Price</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={addOnCostPrice}
                  onChange={(e) => setAddOnCostPrice(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col gap-1 mt-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Shipping Cost</span>
              <Input 
                type="number"
                placeholder="0.00"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 w-full mt-4">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(); }}
              disabled={product.stock === 0 || (hasSizes && !selectedSize) || (hasColors && !selectedColor)}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 py-3 sm:py-3.5 rounded-[14px] font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart — {formatAmount(displayPrice * quantity)}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Button */}
      <div className="relative z-40 px-1 shrink-0 bg-white dark:bg-slate-900">
        <button
          onClick={handleActionClick}
          disabled={product.stock === 0}
          className="w-full flex items-center justify-between bg-primary text-primary-foreground hover:bg-primary/90 py-3 sm:py-3.5 px-4 sm:px-5 rounded-[14px] font-medium text-xs sm:text-[14px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Add to Cart</span>
          <ArrowUpCircle className="h-4 w-4 sm:h-5 sm:w-5 opacity-80 rotate-90" />
        </button>
      </div>
    </div>
  )
}
