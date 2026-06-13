-- CreateEnum
CREATE TYPE "NemotoCycleType" AS ENUM ('PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "NemotoScheduleActionType" AS ENUM ('DISPLAY_PRESET', 'DISPLAY_SOLID', 'CLEAR');

-- CreateEnum
CREATE TYPE "NemotoActivityKind" AS ENUM ('SCHEDULE_PRESET_SHOWN', 'PRESET_SHOWN_MANUAL', 'DISCOVERY_COMPLETE', 'BOOTLOADER_ENTERED', 'EMERGENCY_STOP_FIRED', 'QUIET_HOURS_BLOCKED');

-- CreateTable
CREATE TABLE "NemotoConfig" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "bootPresetId" INTEGER NOT NULL DEFAULT 0,
    "defaultSpeed" INTEGER NOT NULL DEFAULT 0,
    "defaultAccel" INTEGER NOT NULL DEFAULT 0,
    "autoDiscoverSec" INTEGER NOT NULL DEFAULT 0,
    "displayEffectId" TEXT NOT NULL DEFAULT '',
    "displayDelayMs" INTEGER NOT NULL DEFAULT 0,
    "cycleType" "NemotoCycleType" NOT NULL DEFAULT 'PARTIAL',
    "quietWindows" JSONB NOT NULL DEFAULT '[]',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NemotoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NemotoPreset" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "presetId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "flaps" BYTEA NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NemotoPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NemotoSchedule" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "obeyQuietHours" BOOLEAN NOT NULL DEFAULT true,
    "actionType" "NemotoScheduleActionType" NOT NULL,
    "actionPresetId" INTEGER NOT NULL DEFAULT 0,
    "actionFlap" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NemotoSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NemotoActivityEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "kind" "NemotoActivityKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NemotoActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NemotoConfig_deviceId_key" ON "NemotoConfig"("deviceId");

-- CreateIndex
CREATE INDEX "NemotoPreset_deviceId_idx" ON "NemotoPreset"("deviceId");

-- CreateIndex
CREATE INDEX "NemotoPreset_deviceId_syncedAt_idx" ON "NemotoPreset"("deviceId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NemotoPreset_deviceId_presetId_key" ON "NemotoPreset"("deviceId", "presetId");

-- CreateIndex
CREATE INDEX "NemotoSchedule_deviceId_idx" ON "NemotoSchedule"("deviceId");

-- CreateIndex
CREATE INDEX "NemotoSchedule_deviceId_syncedAt_idx" ON "NemotoSchedule"("deviceId", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NemotoSchedule_deviceId_scheduleId_key" ON "NemotoSchedule"("deviceId", "scheduleId");

-- CreateIndex
CREATE INDEX "NemotoActivityEvent_deviceId_ts_idx" ON "NemotoActivityEvent"("deviceId", "ts");

-- AddForeignKey
ALTER TABLE "NemotoConfig" ADD CONSTRAINT "NemotoConfig_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NemotoPreset" ADD CONSTRAINT "NemotoPreset_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NemotoSchedule" ADD CONSTRAINT "NemotoSchedule_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NemotoActivityEvent" ADD CONSTRAINT "NemotoActivityEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
