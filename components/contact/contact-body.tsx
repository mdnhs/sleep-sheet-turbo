"use client";

import Link from "next/link";
import { MapPin, Mail, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact/contact-form";
import { useLanguage } from "@/hooks/use-language";
import { seoConfig } from "@/lib/seo";
import { useWebsiteSettings } from "@/hooks/use-website-settings";
import { StoreLocationMap } from "@/components/store-location-map";
import { buildSocialLinks } from "@/components/social-links";

export default function ContactBody() {
  const { t } = useLanguage();
  const socialLinks = buildSocialLinks(useWebsiteSettings());

  return (
    <div className="max-w-4xl mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 mb-4 text-xs text-muted-foreground font-medium">
        <Link href="/" className="hover:text-foreground transition-colors">{t("home")}</Link>
        <span className="text-border">•</span>
        <span className="text-foreground" aria-current="page">{t("contactBreadcrumbLabel")}</span>
      </nav>

      <h1 className="text-4xl font-bold mb-6">{t("contactHeading")}</h1>
      <p className="text-xl text-muted-foreground mb-12">{t("contactIntro")}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact Form (interactive leaf) */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 md:p-8">
          <h2 className="text-2xl font-semibold mb-6">{t("contactSendMessage")}</h2>
          <ContactForm />
        </div>

        {/* Contact Information */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">{t("contactInfoHeading")}</h2>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <MapPin className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">{t("contactVisitUs")}</h3>
                <address className="not-italic text-muted-foreground">
                  {t("contactAddressLine1")}
                  <br />
                  {t("contactAddressLine2")}
                  <br />
                  {t("contactAddressLine3")}
                </address>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <Mail className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">{t("contactEmailUs")}</h3>
                <p className="text-muted-foreground">
                  <a
                    href={`mailto:${seoConfig.contact.email}`}
                    className="hover:underline"
                  >
                    {seoConfig.contact.email}
                  </a>
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <Phone className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium mb-1">{t("contactCallUs")}</h3>
                <p className="text-muted-foreground">
                  <a href={`tel:${seoConfig.contact.telephone}`} className="hover:underline">
                    {seoConfig.contact.telephone}
                  </a>
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t("contactHours")}</p>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <h3 className="font-medium mb-4">{t("contactConnectHeading")}</h3>
            <p className="text-muted-foreground mb-4">{t("contactConnectDesc")}</p>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white dark:bg-slate-900 text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <section aria-labelledby="contact-map-heading" className="mt-16">
        <h2 id="contact-map-heading" className="text-2xl font-semibold mb-6">{t("contactMapHeading")}</h2>
        <StoreLocationMap />
      </section>
    </div>
  );
}
