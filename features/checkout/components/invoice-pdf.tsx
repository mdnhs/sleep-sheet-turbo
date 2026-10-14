import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";
import { PlacedOrder, ShippingInfo } from "../types";
import { translations } from "@/hooks/use-language";
import { seoConfig } from "@/lib/seo";
import { STORE_DEFAULTS } from "@/lib/settings/defaults";
import { isCloudinaryUrl, unwrapCfImageUrl } from "@/lib/media-url";

// Register Hind Siliguri font from Google Fonts GitHub via jsDelivr to support Bangla characters
Font.register({
  family: "Hind Siliguri",
  fonts: [
    { src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Regular.ttf", fontWeight: "normal" },
    { src: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/hindsiliguri/HindSiliguri-Bold.ttf", fontWeight: "bold" },
  ]
});

Font.register({
  family: "Space Grotesk",
  src: "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVnskPMVBTyJL.ttf",
  fontWeight: "bold",
});

const styles = StyleSheet.create({
  page: {
    paddingVertical: 5,
    paddingHorizontal: 75,
    fontFamily: "Hind Siliguri",
    fontSize: 8,
    color: "#334155",
    backgroundColor: "#ffffff",
  },
  contentContainer: {
    height: 390.94,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandName: {
    fontFamily: "Space Grotesk",
    fontSize: 13,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  brandDesc: {
    fontSize: 7,
    color: "#64748b",
    marginTop: 0,
  },
  invoiceTitle: {
    fontFamily: "Space Grotesk",
    fontSize: 14,
    fontWeight: "bold",
    color: "#cbd5e1",
    letterSpacing: 4,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 0,
  },
  headerMetaLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
    marginRight: 4,
  },
  headerMetaValue: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#0f172a",
  },
  metaItem: {
    marginBottom: 3,
  },
  label: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 0,
  },
  value: {
    fontSize: 8.5,
    color: "#334155",
    fontWeight: "bold",
  },
  infoBox: {
    backgroundColor: "#f8fafc",
    padding: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  infoCol: {
    width: "48%",
  },
  infoColCourier: {
    width: "28%",
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#e2e8f0",
    paddingLeft: 6,
  },
  table: {
    width: "100%",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    marginBottom: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "flex-start",
  },
  thItem: { flex: 2.8, fontFamily: "Space Grotesk", fontSize: 8, fontWeight: "bold", color: "#64748b", textTransform: "uppercase" },
  thQty: { flex: 0.5, fontFamily: "Space Grotesk", fontSize: 8, fontWeight: "bold", color: "#64748b", textAlign: "center", textTransform: "uppercase" },
  thPrice: { flex: 0.85, fontFamily: "Space Grotesk", fontSize: 8, fontWeight: "bold", color: "#64748b", textAlign: "right", textTransform: "uppercase" },
  thTotal: { flex: 0.85, fontFamily: "Space Grotesk", fontSize: 8, fontWeight: "bold", color: "#64748b", textAlign: "right", textTransform: "uppercase" },

  tdItem: { flex: 2.8, flexDirection: "row", alignItems: "flex-start" },
  tdItemTitle: {
    fontSize: 8.5,
    color: "#1e293b",
    fontWeight: "bold",
    lineHeight: 1.25,
  },
  tdItemDesc: { fontSize: 7, color: "#64748b", marginTop: 1 },
  tdQty: { flex: 0.5, fontSize: 8, color: "#475569", textAlign: "center" },
  tdPrice: { flex: 0.85, fontSize: 8, color: "#475569", textAlign: "right" },
  tdTotal: { flex: 0.85, fontSize: 8, color: "#1e293b", fontWeight: "bold", textAlign: "right" },

  bottomSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 2,
  },
  totalsTable: {
    width: 180,
    backgroundColor: "#f8fafc",
    padding: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  totalsLabel: {
    fontSize: 8,
    color: "#64748b",
  },
  totalsValue: {
    fontSize: 8,
    color: "#334155",
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  grandTotalLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#0f172a",
    textTransform: "uppercase",
  },
  grandTotalValue: {
    fontSize: 9.5,
    fontWeight: "bold",
    color: "#10b981", // elegant emerald for total
  },
  thankYou: {
    paddingTop: 5,
    fontSize: 8.5,
    color: "#475569",
  }
});


const getPdfFriendlyImageUrl = (url: string, isLogo = false) => {
  if (!url) return "";

  let friendlyUrl = url;
  if (friendlyUrl.includes("cloudinary.com")) {
    friendlyUrl = friendlyUrl.replace(/\.(jpg|jpeg|webp)$/i, ".png");

    // Inject Cloudinary transformations for sizing and quality optimization
    if (friendlyUrl.includes("image/upload/")) {
      const transform = isLogo
        ? "w_120,h_120,c_limit,q_auto"
        : "w_80,h_80,c_fill,q_auto";
      friendlyUrl = friendlyUrl.replace("image/upload/", `image/upload/${transform}/`);
    }
  } else if (
    friendlyUrl.startsWith("https://") &&
    !isCloudinaryUrl(friendlyUrl) &&
    typeof window !== "undefined" &&
    !friendlyUrl.startsWith(window.location.origin)
  ) {
    // R2: the renderer fetch()es images, and neither R2 nor /cdn-cgi/image
    // sends CORS headers, so go through our own origin. The route resizes to
    // PNG/JPEG, the only formats the PDF renderer reads.
    friendlyUrl = `${window.location.origin}/api/media/pdf-image?kind=${isLogo ? "logo" : "item"}&src=${encodeURIComponent(unwrapCfImageUrl(friendlyUrl))}`;
  }

  if (friendlyUrl.startsWith('//')) {
    friendlyUrl = 'https:' + friendlyUrl;
  }

  return friendlyUrl.startsWith('http')
    ? friendlyUrl
    : (typeof window !== "undefined"
      ? window.location.origin + (friendlyUrl.startsWith('/') ? '' : '/') + friendlyUrl
      : friendlyUrl);
};

const clampText = (text: string, maxLength = 70) => {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength - 3) + "..." : text;
};

const parseItemVariantAndAddOns = (colorStr?: string | null) => {
  if (!colorStr) return { variant: null, addOns: null };
  const trimmed = colorStr.trim();
  if (trimmed.includes(" (+ ")) {
    const parts = trimmed.split(" (+ ");
    const variant = parts[0].trim();
    const addOns = parts[1].replace(/\)$/, "").trim();
    return { variant: variant || null, addOns: addOns || null };
  }
  if (trimmed.startsWith("Add-ons:")) {
    const addOns = trimmed.replace(/^Add-ons:\s*/, "").trim();
    return { variant: null, addOns: addOns || null };
  }
  return { variant: trimmed, addOns: null };
};

interface InvoicePDFProps {
  order: PlacedOrder;
  shippingInfo: ShippingInfo | null;
  siteName: string;
  language: "en" | "bn";
  logoUrl: string;
  phoneNumber: string;
  timeZone?: string;
}

export const InvoicePDFPage = ({ order, shippingInfo, siteName, language, logoUrl, phoneNumber, timeZone }: InvoicePDFProps) => {
  const t = (key: string) => {
    return translations[language]?.[key as keyof typeof translations.en] || translations.en[key as keyof typeof translations.en] || key;
  };

  const codeValue = order.consignmentId?.toString() || order.trackingNumber;
  const isParcelId = !!order.consignmentId || (!!order.trackingNumber && /^\d+$/.test(order.trackingNumber));

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl && (
              <Image
                source={{ uri: getPdfFriendlyImageUrl(logoUrl, true) }}
                style={{ width: 45, height: 45, marginRight: 10, objectFit: "contain" }}
              />
            )}
            <View>
              <Text style={styles.brandName}>{siteName}</Text>
              <Text style={styles.brandDesc}>Merchant ID - USH1CSYQ</Text>
              <Text style={styles.brandDesc}>{new URL(seoConfig.siteUrl).host}</Text>
              <Text style={styles.brandDesc}>{phoneNumber}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Order # / অর্ডার নং:</Text>
              <Text style={styles.headerMetaValue}>{order.orderNumber}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Date / তারিখ:</Text>
              <Text style={styles.headerMetaValue}>
                {new Date(order.createdAt).toLocaleString("en-BD", { timeZone: timeZone ?? STORE_DEFAULTS.timezone, year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <View style={{ width: codeValue ? "70%" : "100%", flexDirection: "column", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ width: "48%" }}>
                  <Text style={styles.label}>Customer / ক্রেতা</Text>
                  <Text style={styles.value}>{shippingInfo?.fullName || "Customer"}</Text>
                  {shippingInfo?.phone && (
                    <Text style={[styles.value, { marginTop: 0 }]}>{shippingInfo.phone}</Text>
                  )}
                </View>
                <View style={{ width: "48%" }}>
                  <Text style={styles.label}>Shipping to / ঠিকানা</Text>
                  <Text style={styles.value}>{shippingInfo?.address || ""}</Text>
                </View>
              </View>

              {shippingInfo?.notes && (
                <View style={{ marginTop: 2, paddingTop: 2, borderTopWidth: 1, borderTopColor: "#e2e8f0", flexDirection: "row", alignItems: "flex-start" }}>
                  <Text style={[styles.label, { marginRight: 3, marginTop: 0.5, color: "#64748b" }]}>Note / নোট:</Text>
                  <Text style={[styles.value, { flex: 1, fontSize: 7, fontWeight: "normal", color: "#334155", lineHeight: 1.2 }]}>
                    {clampText(shippingInfo.notes.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim(), 110)}
                  </Text>
                </View>
              )}
            </View>

            {codeValue && (
              <View style={styles.infoColCourier}>
                <Text style={[styles.value, { fontSize: 7, marginBottom: 2 }]}>
                  #{codeValue}
                </Text>
                <Image
                  source={{ uri: `https://bwipjs-api.metafloor.com/?bcid=code128&text=${codeValue}&scale=1&rotate=N` }}
                  style={{ width: 80, height: 20, marginBottom: 2 }}
                />
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${codeValue}` }}
                  style={{ width: 30, height: 30 }}
                />
              </View>
            )}
          </View>
        </View>

        {/* Items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.thItem}>Item</Text>
            <Text style={styles.thQty}>Qty</Text>
            <Text style={styles.thPrice}>Unit Price</Text>
            <Text style={styles.thTotal}>Total</Text>
          </View>

          {order.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.tdItem}>
                {item.image && (
                  <Image
                    source={{ uri: getPdfFriendlyImageUrl(item.image, false) }}
                    style={{ width: 36, height: 36, marginRight: 10, borderRadius: 4, objectFit: "contain" }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.tdItemTitle}>{clampText(item.name, 70)}</Text>
                  {(() => {
                    const { variant, addOns } = parseItemVariantAndAddOns(item.color);
                    return (
                      <View style={{ marginTop: 1 }}>
                        {(variant || item.size) && (
                          <Text style={styles.tdItemDesc}>
                            {variant ? `${language === "bn" ? "ভ্যারিয়েন্ট: " : "Variant: "}${variant}` : ""}
                            {item.size ? `${variant ? " | " : ""}${language === "bn" ? "সাইজ: " : "Size: "}${item.size}` : ""}
                          </Text>
                        )}
                        {addOns && (
                          <Text style={[styles.tdItemDesc, { color: "#b45309", fontWeight: "bold", marginTop: 1 }]}>
                            {language === "bn" ? "অ্যাড-অনস: " : "Add-ons: "}{addOns}
                          </Text>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </View>
              <Text style={styles.tdQty}>{item.quantity}</Text>
              <Text style={styles.tdPrice}>৳{item.price}</Text>
              <Text style={styles.tdTotal}>৳{item.price * item.quantity}</Text>
            </View>
          ))}
        </View>

        {/* Bottom Section: Thank You on Left, Price Summary on Right (Same Row) */}
        {(() => {
          const itemsSubtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const subtotal = itemsSubtotal > 0 ? itemsSubtotal : (order.subtotal || 0);
          const shippingCost = order.shippingCost ?? 0;
          const expectedTotal = subtotal + shippingCost;
          const diff = expectedTotal - order.totalAmount;
          const isDiscount = diff > 0.01;
          const isExtra = diff < -0.01;

          return (
            <View style={styles.bottomSection}>
              <View style={styles.thankYou}>
                <Text style={{ fontWeight: "bold", color: "#475569" }}>
                  {language === "bn" ? "অর্ডারের জন্য আপনাকে ধন্যবাদ!" : "Thank you for your order!"}
                </Text>
              </View>

              <View style={styles.totalsTable}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>{language === "bn" ? "সাবটোটাল:" : "Subtotal:"}</Text>
                  <Text style={styles.totalsValue}>৳{subtotal}</Text>
                </View>

                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>{language === "bn" ? "ডেলিভারি চার্জ:" : "Delivery:"}</Text>
                  <Text style={styles.totalsValue}>
                    {shippingCost > 0 ? `৳${shippingCost}` : (language === "bn" ? "৳০ (ফ্রি)" : "৳0 (Free)")}
                  </Text>
                </View>

                {isDiscount && (
                  <View style={styles.totalsRow}>
                    <Text style={[styles.totalsLabel, { color: "#dc2626", fontWeight: "bold" }]}>
                      {language === "bn" ? "ডিসকাউন্ট / ছাড়:" : "Discount:"}
                    </Text>
                    <Text style={[styles.totalsValue, { color: "#dc2626", fontWeight: "bold" }]}>
                      -৳{Math.round(diff)}
                    </Text>
                  </View>
                )}

                {isExtra && (
                  <View style={styles.totalsRow}>
                    <Text style={[styles.totalsLabel, { color: "#d97706", fontWeight: "bold" }]}>
                      {language === "bn" ? "কাস্টম অ্যাডজাস্টমেন্ট:" : "Adjustment:"}
                    </Text>
                    <Text style={[styles.totalsValue, { color: "#d97706", fontWeight: "bold" }]}>
                      +৳{Math.round(Math.abs(diff))}
                    </Text>
                  </View>
                )}

                <View style={[styles.grandTotalRow, { marginTop: 2, paddingTop: 2, borderTopWidth: 1, borderTopColor: "#e2e8f0" }]}>
                  <Text style={styles.grandTotalLabel}>{t("total")}:</Text>
                  <Text style={styles.grandTotalValue}>৳{order.totalAmount}</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </View>
    </Page>
  );
};

export const InvoicePDF = (props: InvoicePDFProps) => {
  return (
    <Document>
      <InvoicePDFPage {...props} />
    </Document>
  );
};

interface BulkInvoicePDFProps {
  orders: Array<{
    order: PlacedOrder;
    shippingInfo: ShippingInfo | null;
  }>;
  siteName: string;
  language: "en" | "bn";
  logoUrl: string;
  phoneNumber: string;
  timeZone?: string;
}

export const BulkInvoicePDF = ({ orders, siteName, language, logoUrl, phoneNumber, timeZone }: BulkInvoicePDFProps) => {
  return (
    <Document>
      {orders.map((item, index) => (
        <InvoicePDFPage
          key={index}
          order={item.order}
          shippingInfo={item.shippingInfo}
          siteName={siteName}
          language={language}
          logoUrl={logoUrl}
          phoneNumber={phoneNumber}
          timeZone={timeZone}
        />
      ))}
    </Document>
  );
};

const packingListStyles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Hind Siliguri",
    fontSize: 9,
    color: "#334155",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#e2e8f0",
  },
  title: {
    fontFamily: "Space Grotesk",
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  card: {
    width: "33.33%",
    padding: 6,
  },
  cardInner: {
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 6,
    objectFit: "cover",
    marginBottom: 6,
    backgroundColor: "#f1f5f9",
  },
  productName: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: "#1e293b",
    textAlign: "center",
  },
  qtyBadge: {
    marginTop: 5,
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
});

export interface PackingListItem {
  name: string;
  image: string | null;
  quantity: number;
}

interface PackingListPDFProps {
  items: PackingListItem[];
  siteName: string;
  logoUrl: string;
  orderCount: number;
  filterLabel: string;
}

// One combined pick-list for a batch of selected orders: unique products
// only, with quantities summed across every selected order — so warehouse
// staff pull each product once, in the right total quantity, instead of
// working order-by-order.
export const PackingListPDF = ({
  items,
  siteName,
  logoUrl,
  orderCount,
  filterLabel,
}: PackingListPDFProps) => {
  const generatedAt = new Date().toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Document>
      <Page size="A4" style={packingListStyles.page}>
        <View style={packingListStyles.header}>
          {logoUrl && (
            <Image
              source={{ uri: getPdfFriendlyImageUrl(logoUrl, true) }}
              style={{ width: 36, height: 36, marginRight: 10, objectFit: "contain" }}
            />
          )}
          <View>
            <Text style={packingListStyles.title}>{siteName} — Packing List</Text>
            <Text style={packingListStyles.subtitle}>
              {filterLabel} orders • {orderCount} order(s) • {items.length} product(s) • {generatedAt}
            </Text>
          </View>
        </View>

        <View style={packingListStyles.grid}>
          {items.map((item, index) => (
            <View key={index} style={packingListStyles.card}>
              <View style={packingListStyles.cardInner}>
                {item.image ? (
                  <Image
                    source={{ uri: getPdfFriendlyImageUrl(item.image, false) }}
                    style={packingListStyles.productImage}
                  />
                ) : (
                  <View style={packingListStyles.productImage} />
                )}
                <Text style={packingListStyles.productName}>{clampText(item.name, 40)}</Text>
                <Text style={packingListStyles.qtyBadge}>Qty: {item.quantity}</Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};
