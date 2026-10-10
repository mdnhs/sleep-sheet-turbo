ALTER TABLE "Category" DROP COLUMN IF EXISTS "carouselOrder";
ALTER TABLE "Category" ADD COLUMN "order" integer;
