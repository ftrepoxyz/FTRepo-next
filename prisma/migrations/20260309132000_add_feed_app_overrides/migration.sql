CREATE TABLE "feed_app_overrides" (
    "id" SERIAL NOT NULL,
    "feed" TEXT NOT NULL,
    "group_key" TEXT NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "matched_tweak" TEXT,
    "app_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_app_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feed_app_overrides_feed_group_key_key" ON "feed_app_overrides"("feed", "group_key");
CREATE INDEX "feed_app_overrides_bundle_id_idx" ON "feed_app_overrides"("bundle_id");
