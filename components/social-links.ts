import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandTwitter,
  IconBrandYoutube,
} from "@tabler/icons-react";

export interface SocialLinkSettings {
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  socialYoutube: string;
  socialTiktok: string;
}

export function buildSocialLinks(s: SocialLinkSettings) {
  return [
    { label: "Instagram", href: s.socialInstagram, Icon: IconBrandInstagram },
    { label: "Facebook", href: s.socialFacebook, Icon: IconBrandFacebook },
    { label: "Twitter", href: s.socialTwitter, Icon: IconBrandTwitter },
    { label: "YouTube", href: s.socialYoutube, Icon: IconBrandYoutube },
    { label: "TikTok", href: s.socialTiktok, Icon: IconBrandTiktok },
  ].filter((link) => Boolean(link.href));
}
