-- CreateTable
CREATE TABLE "processed_messages" (
    "id" SERIAL NOT NULL,
    "channel_id" TEXT NOT NULL,
    "message_id" BIGINT NOT NULL,
    "has_ipa" BOOLEAN NOT NULL DEFAULT false,
    "file_name" TEXT,
    "file_size" BIGINT,
    "message_text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloaded_ipas" (
    "id" SERIAL NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "app_name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "build_number" TEXT,
    "min_os_version" TEXT,
    "file_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "icon_url" TEXT,
    "screenshot_urls" JSONB,
    "description" TEXT,
    "developer_name" TEXT,
    "tweaks" JSONB,
    "is_tweaked" BOOLEAN NOT NULL DEFAULT false,
    "entitlements" JSONB,
    "privacy_info" JSONB,
    "github_release_id" INTEGER,
    "github_asset_id" INTEGER,
    "github_asset_url" TEXT,
    "download_url" TEXT,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "channel_id" TEXT,
    "message_id" BIGINT,
    "is_corrupted" BOOLEAN NOT NULL DEFAULT false,
    "corruption_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "downloaded_ipas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appstore_cache" (
    "id" SERIAL NOT NULL,
    "bundle_id" TEXT NOT NULL,
    "app_name" TEXT,
    "icon_url" TEXT,
    "screenshots" JSONB,
    "description" TEXT,
    "developer" TEXT,
    "genre" TEXT,
    "price" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION,
    "data" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appstore_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" SERIAL NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'info',
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_progress" (
    "id" SERIAL NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_name" TEXT,
    "channel_description" TEXT,
    "last_message_id" BIGINT NOT NULL DEFAULT 0,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "ipa_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_forum" BOOLEAN NOT NULL DEFAULT false,
    "forum_topics" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "last_scanned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_description_cache" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_description_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_messages_status_idx" ON "processed_messages"("status");

-- CreateIndex
CREATE INDEX "processed_messages_channel_id_idx" ON "processed_messages"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_messages_channel_id_message_id_key" ON "processed_messages"("channel_id", "message_id");

-- CreateIndex
CREATE INDEX "downloaded_ipas_bundle_id_idx" ON "downloaded_ipas"("bundle_id");

-- CreateIndex
CREATE INDEX "downloaded_ipas_app_name_idx" ON "downloaded_ipas"("app_name");

-- CreateIndex
CREATE INDEX "downloaded_ipas_channel_id_idx" ON "downloaded_ipas"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "appstore_cache_bundle_id_key" ON "appstore_cache"("bundle_id");

-- CreateIndex
CREATE INDEX "system_metrics_metric_idx" ON "system_metrics"("metric");

-- CreateIndex
CREATE INDEX "system_metrics_recorded_at_idx" ON "system_metrics"("recorded_at");

-- CreateIndex
CREATE INDEX "activity_log_type_idx" ON "activity_log"("type");

-- CreateIndex
CREATE INDEX "activity_log_status_idx" ON "activity_log"("status");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "channel_progress_channel_id_key" ON "channel_progress"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "privacy_description_cache_key_key" ON "privacy_description_cache"("key");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
