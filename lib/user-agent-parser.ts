export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: "Desktop" | "Mobile" | "Tablet";
}

export function parseUserAgent(ua: string | undefined | null): ParsedUserAgent {
  if (!ua) {
    return { browser: "Unknown", os: "Unknown", device: "Desktop" };
  }

  // Device detection
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua);
  const isMobile = /(mobi|ipod|iphone|android|blackberry|opera mini|windows phone)/i.test(ua) && !isTablet;
  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

  // OS detection
  let os = "Unknown OS";
  if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows nt 6\.3/i.test(ua)) os = "Windows 8.1";
  else if (/windows nt 6\.2/i.test(ua)) os = "Windows 8";
  else if (/windows nt 6\.1/i.test(ua)) os = "Windows 7";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";

  // Browser detection
  let browser = "Browser";
  if (/edg\//i.test(ua)) {
    const match = ua.match(/edg\/([\d.]+)/i);
    browser = `Edge ${match ? match[1].split(".")[0] : ""}`.trim();
  } else if (/opr\/|opera/i.test(ua)) {
    const match = ua.match(/(?:opr|opera)\/([\d.]+)/i);
    browser = `Opera ${match ? match[1].split(".")[0] : ""}`.trim();
  } else if (/chrome|crios/i.test(ua)) {
    const match = ua.match(/(?:chrome|crios)\/([\d.]+)/i);
    browser = `Chrome ${match ? match[1].split(".")[0] : ""}`.trim();
  } else if (/firefox|fxios/i.test(ua)) {
    const match = ua.match(/(?:firefox|fxios)\/([\d.]+)/i);
    browser = `Firefox ${match ? match[1].split(".")[0] : ""}`.trim();
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    const match = ua.match(/version\/([\d.]+)/i);
    browser = `Safari ${match ? match[1].split(".")[0] : ""}`.trim();
  } else {
    browser = "Other";
  }

  return { browser, os, device };
}
