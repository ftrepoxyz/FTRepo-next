ALTER TABLE "telegram_runtime_state"
ADD COLUMN "current_command_type" TEXT,
ADD COLUMN "progress_label" TEXT,
ADD COLUMN "progress_current" INTEGER,
ADD COLUMN "progress_total" INTEGER;
