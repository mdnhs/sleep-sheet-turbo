-- SP-1 Task 12. Data only; the site_settings table is unchanged.
-- 1. The code no longer falls back to a hardcoded GTM container or host,
--    so make sure production has both saved. A value the admin already
--    saved wins; an empty one is filled.
INSERT INTO "site_settings" ("key", "value") VALUES ('gtm_web_id', 'GTM-PQ667JWQ')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
WHERE "site_settings"."value" = '';
--> statement-breakpoint
INSERT INTO "site_settings" ("key", "value") VALUES ('gtm_server_url', 'https://ss.sleepsheetbd.com')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
WHERE "site_settings"."value" = '';
--> statement-breakpoint
-- 2. Keys nothing reads any more.
DELETE FROM "site_settings" WHERE "key" IN ('seo_site_name', 'gtm_server_id', 'google_analytics_id', 'ga4_property_id');
