CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"fingerprint" char(64) NOT NULL,
	"transaction_count" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_fingerprint_unique" UNIQUE("fingerprint"),
	CONSTRAINT "import_batches_period_unique" UNIQUE("period_start","period_end"),
	CONSTRAINT "import_batches_period_order_check" CHECK ("import_batches"."period_start" <= "import_batches"."period_end"),
	CONSTRAINT "import_batches_transaction_count_check" CHECK ("import_batches"."transaction_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"source_transaction_id" text,
	"source_order" integer NOT NULL,
	"date" date NOT NULL,
	"merchant_raw" text NOT NULL,
	"merchant_normalized" text NOT NULL,
	"amount" bigint NOT NULL,
	"category" text NOT NULL,
	"category_source" text NOT NULL,
	"description" text,
	"approval_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_batch_source_order_unique" UNIQUE("import_batch_id","source_order"),
	CONSTRAINT "transactions_source_order_check" CHECK ("transactions"."source_order" >= 0),
	CONSTRAINT "transactions_category_check" CHECK ("transactions"."category" in ('convenience_store', 'supermarket', 'vending_machine', 'restaurant', 'subscription', 'shopping', 'transportation', 'entertainment', 'other')),
	CONSTRAINT "transactions_category_source_check" CHECK ("transactions"."category_source" in ('ai', 'cache', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE restrict ON UPDATE no action;