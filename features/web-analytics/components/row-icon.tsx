"use client";

import React from "react";
import { Globe, HelpCircle, Monitor, MousePointerClick, Smartphone, Tablet, Tag, type LucideIcon } from "lucide-react";
import type { Dimension } from "../lib/dimensions";

// utm_source values are free-form; map the common shorthands to a domain so
// they get the right favicon.
const UTM_SOURCE_DOMAINS: Record<string, string> = {
  facebook: "facebook.com",
  fb: "facebook.com",
  meta: "facebook.com",
  messenger: "messenger.com",
  instagram: "instagram.com",
  ig: "instagram.com",
  google: "google.com",
  youtube: "youtube.com",
  yt: "youtube.com",
  tiktok: "tiktok.com",
  whatsapp: "whatsapp.com",
  wa: "whatsapp.com",
  twitter: "x.com",
  x: "x.com",
  linkedin: "linkedin.com",
  pinterest: "pinterest.com",
  bing: "bing.com",
  telegram: "telegram.org",
};

// Browser and OS values come from lib/user-agent-parser ("Chrome 141", "Windows 10/11"),
// matched by prefix. Each domain's favicon is that product's logo.
const BROWSER_DOMAINS: [string, string][] = [
  ["chrome", "chrome.com"],
  ["edge", "microsoftedgeinsider.com"],
  ["firefox", "firefox.com"],
  ["opera", "opera.com"],
  ["safari", "webkit.org"],
];

const OS_DOMAINS: [string, string][] = [
  ["windows", "windows.com"],
  ["macos", "apple.com"],
  ["ios", "apple.com"],
  ["android", "android.com"],
  ["linux", "kernel.org"],
];

const DEVICE_ICONS: Record<string, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

function prefixDomain(map: [string, string][], key: string): string | null {
  const value = key.toLowerCase();
  return map.find(([prefix]) => value.startsWith(prefix))?.[1] ?? null;
}

/** m.facebook.com / l.facebook.com / www.google.com → the registrable host, so icons share a cache entry. */
function iconDomain(host: string): string {
  return host.toLowerCase().replace(/^(www|m|l|lm|mobile|mbasic|web)\./, "");
}

function domainFor(dim: Dimension, key: string): string | null {
  if (dim === "referrer") return iconDomain(key);
  const source = key.trim().toLowerCase();
  if (UTM_SOURCE_DOMAINS[source]) return UTM_SOURCE_DOMAINS[source];
  return source.includes(".") ? iconDomain(source) : null;
}

function countryFlag(code: string): string | null {
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  return String.fromCodePoint(...[...code.toUpperCase()].map((char) => 0x1f1a5 + char.charCodeAt(0)));
}

function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <MutedIcon icon={Globe} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- third-party favicon, next/image would need a remotePattern per host.
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className="size-4 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

function MutedIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

/** Logo shown before a breakdown row's label; null for dimensions without one. */
export function RowIcon({ dim, rowKey }: { dim: Dimension; rowKey: string | null }) {
  switch (dim) {
    case "referrer":
    case "utmSource": {
      if (!rowKey) return <MutedIcon icon={dim === "referrer" ? MousePointerClick : Tag} />;
      const domain = domainFor(dim, rowKey);
      return domain ? <Favicon key={domain} domain={domain} /> : <MutedIcon icon={Globe} />;
    }
    case "hostname":
      return rowKey ? <Favicon key={rowKey} domain={rowKey} /> : <MutedIcon icon={Globe} />;
    case "browser":
    case "os": {
      const domain = rowKey && prefixDomain(dim === "browser" ? BROWSER_DOMAINS : OS_DOMAINS, rowKey);
      return domain ? <Favicon key={domain} domain={domain} /> : <MutedIcon icon={HelpCircle} />;
    }
    case "device":
      return <MutedIcon icon={(rowKey && DEVICE_ICONS[rowKey.toLowerCase()]) || HelpCircle} />;
    case "country": {
      const flag = rowKey && countryFlag(rowKey);
      if (flag) return <span className="shrink-0 text-base leading-none" aria-hidden="true">{flag}</span>;
      return <MutedIcon icon={Globe} />;
    }
    default:
      return null;
  }
}
