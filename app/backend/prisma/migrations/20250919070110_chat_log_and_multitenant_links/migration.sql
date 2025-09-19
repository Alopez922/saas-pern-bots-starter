-- === SAFE MIGRATION: Bot.allowedOrigins (String -> TEXT[]) + isActive ===

-- Mantén isActive
ALTER TABLE "Bot" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Paso 1: crear columna nueva de tipo arreglo
ALTER TABLE "Bot" ADD COLUMN "allowedOrigins_new" TEXT[] NOT NULL DEFAULT '{}';

-- Paso 2: copiar el valor viejo (String) a la nueva columna (array de 1 elemento).
-- Si estaba NULL o vacío, lo dejamos como arreglo vacío.
UPDATE "Bot"
SET "allowedOrigins_new" = CASE
  WHEN "allowedOrigins" IS NULL OR "allowedOrigins" = '' THEN '{}'::text[]
  ELSE ARRAY[trim(both '/' from "allowedOrigins")]
END;

-- Paso 3: eliminar la columna antigua
ALTER TABLE "Bot" DROP COLUMN "allowedOrigins";

-- Paso 4: renombrar la nueva a su nombre final
ALTER TABLE "Bot" RENAME COLUMN "allowedOrigins_new" TO "allowedOrigins";

-- === Chat logging (sin cambios) ===

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    "meta" JSONB,
    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenIn" INTEGER,
    "tokenOut" INTEGER,
    "latencyMs" INTEGER,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSession_botId_startedAt_idx" ON "ChatSession"("botId", "startedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "Bot_userId_idx" ON "Bot"("userId");

-- CreateIndex
CREATE INDEX "Bot_publicId_idx" ON "Bot"("publicId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "UsageLog_botId_createdAt_idx" ON "UsageLog"("botId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
