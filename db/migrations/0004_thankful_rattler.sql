CREATE TABLE "traffic_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"label" text,
	"meta" json,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
