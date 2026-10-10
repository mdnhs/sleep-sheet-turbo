CREATE TYPE "public"."CampaignStatus" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."OrderStatus" AS ENUM('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."OTPType" AS ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'LOGIN_OTP');--> statement-breakpoint
CREATE TYPE "public"."PaymentMethod" AS ENUM('COD', 'CARD');--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('PENDING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('USER', 'ADMIN', 'MODERATOR');--> statement-breakpoint
CREATE TYPE "public"."TestimonialUserRole" AS ENUM('FASHION_ENTHUSIAST', 'CUSTOMER', 'INFLUENCER', 'OTHER');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"headline" text,
	"subheadline" text,
	"badgeLabel" text,
	"ctaLabel" text DEFAULT 'Buy Now' NOT NULL,
	"layout" json,
	"pageLayout" json,
	"startsAt" timestamp (3),
	"endsAt" timestamp (3),
	"status" "CampaignStatus" DEFAULT 'DRAFT' NOT NULL,
	"productId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"cartId" text NOT NULL,
	"productId" text NOT NULL,
	"quantity" integer NOT NULL,
	"size" text,
	"color" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_cartId_productId_size_color_key" UNIQUE("cartId","productId","size","color")
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "carts_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "Category" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"parentId" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "Category_value_unique" UNIQUE("value")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"productId" text,
	"quantity" integer NOT NULL,
	"price" double precision NOT NULL,
	"size" text,
	"color" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_timeline_events" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"status" "OrderStatus" NOT NULL,
	"message" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"orderNumber" text NOT NULL,
	"userId" text,
	"guestName" text,
	"guestPhone" text,
	"guestEmail" text,
	"totalAmount" double precision NOT NULL,
	"subtotal" double precision NOT NULL,
	"shippingCost" double precision NOT NULL,
	"tax" double precision NOT NULL,
	"paymentMethod" "PaymentMethod" NOT NULL,
	"paymentStatus" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"shippingAddress" text NOT NULL,
	"shippingCity" text,
	"shippingState" text,
	"shippingPostalCode" text,
	"shippingCountry" text,
	"shippingMethodId" text,
	"status" "OrderStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"trackingNumber" text,
	"cancellationReason" text,
	CONSTRAINT "orders_orderNumber_unique" UNIQUE("orderNumber")
);
--> statement-breakpoint
CREATE TABLE "OTPVerification" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"email" text NOT NULL,
	"code" text NOT NULL,
	"type" "OTPType" DEFAULT 'EMAIL_VERIFICATION' NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"amount" double precision NOT NULL,
	"method" "PaymentMethod" NOT NULL,
	"transactionId" text,
	"last4Digits" text,
	"expirationDate" text,
	"status" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "payments_orderId_unique" UNIQUE("orderId")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"coverImage" text,
	"authorId" text NOT NULL,
	"isPublished" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"productName" text NOT NULL,
	"productDescription" text NOT NULL,
	"productPrice" double precision NOT NULL,
	"productStock" integer NOT NULL,
	"productSKU" text NOT NULL,
	"productVariants" text[] NOT NULL,
	"productTags" text[] NOT NULL,
	"productImages" text[] NOT NULL,
	"productSize" text[] NOT NULL,
	"productFeatures" text[] NOT NULL,
	"careInstruction" text,
	"productCategory" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	"productIsFeatured" boolean DEFAULT false NOT NULL,
	CONSTRAINT "products_productSKU_unique" UNIQUE("productSKU")
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"comment" text NOT NULL,
	"rating" integer NOT NULL,
	"userId" text NOT NULL,
	"productId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cost" double precision NOT NULL,
	"duration" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_specifications" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"productId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Testimonial" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"rating" integer NOT NULL,
	"image" text,
	"screenshot" text,
	"role" "TestimonialUserRole" DEFAULT 'CUSTOMER' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text,
	"address" text,
	"role" "Role" DEFAULT 'USER' NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"wishlistId" text NOT NULL,
	"productId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_wishlistId_productId_key" UNIQUE("wishlistId","productId")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "wishlists_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_carts_id_fk" FOREIGN KEY ("cartId") REFERENCES "public"."carts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_Category_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."Category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_timeline_events" ADD CONSTRAINT "order_timeline_events_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingMethodId_shipping_methods_id_fk" FOREIGN KEY ("shippingMethodId") REFERENCES "public"."shipping_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "OTPVerification" ADD CONSTRAINT "OTPVerification_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_productCategory_Category_id_fk" FOREIGN KEY ("productCategory") REFERENCES "public"."Category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_specifications" ADD CONSTRAINT "product_specifications_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlistId_wishlists_id_fk" FOREIGN KEY ("wishlistId") REFERENCES "public"."wishlists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productId_products_id_fk" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;