import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandTwitter,
  IconBrandYoutube,
} from "@tabler/icons-react";
import { seoConfig } from "@/lib/seo";

export interface SocialLinkSettings {
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  socialYoutube: string;
  socialTiktok: string;
}

// Facebook and Instagram fall back to the known accounts; the rest only show once configured.
export function buildSocialLinks(s: SocialLinkSettings) {
  return [
    { label: "Instagram", href: s.socialInstagram || seoConfig.socialLinks.instagram, Icon: IconBrandInstagram },
    { label: "Facebook", href: s.socialFacebook || seoConfig.socialLinks.facebook, Icon: IconBrandFacebook },
    { label: "Twitter", href: s.socialTwitter, Icon: IconBrandTwitter },
    { label: "YouTube", href: s.socialYoutube, Icon: IconBrandYoutube },
    { label: "TikTok", href: s.socialTiktok, Icon: IconBrandTiktok },
  ].filter((link) => Boolean(link.href));
}
