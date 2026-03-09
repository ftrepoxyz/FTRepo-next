CREATE TABLE "telegram_runtime_state" (
    "id" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'disconnected',
    "session_ready" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "password_hint" TEXT NOT NULL DEFAULT '',
    "owner" TEXT,
    "last_heartbeat_at" TIMESTAMP(3),
    "last_connected_at" TIMESTAMP(3),
    "last_auth_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "current_command_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_runtime_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telegram_commands" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by_user_id" INTEGER,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telegram_commands_status_requested_at_idx" ON "telegram_commands"("status", "requested_at");
CREATE INDEX "telegram_commands_type_status_idx" ON "telegram_commands"("type", "status");

INSERT INTO "telegram_runtime_state" (
    "id",
    "state",
    "session_ready",
    "password_hint",
    "retry_count",
    "created_at",
    "updated_at"
)
VALUES (
    1,
    'disconnected',
    false,
    '',
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
