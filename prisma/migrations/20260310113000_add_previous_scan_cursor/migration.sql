ALTER TABLE "channel_progress"
ADD COLUMN "previous_scan_message_id" BIGINT NOT NULL DEFAULT 0;
