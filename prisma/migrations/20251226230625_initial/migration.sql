-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('LANTERN', 'MATRX');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('OWNER', 'SHARED');

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "currentlyDisplayingInstallationId" TEXT,
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceClaims" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimType" "ClaimType" NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceClaims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSettings" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "typeSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanternGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LanternGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanternGroupDevices" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "triggeredSetEffect" TEXT NOT NULL DEFAULT 'solid',
    "triggeredSetColor" TEXT NOT NULL DEFAULT '#000000',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LanternGroupDevices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrxInstallation" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "skippedByUser" BOOLEAN NOT NULL DEFAULT false,
    "skippedByServer" BOOLEAN NOT NULL DEFAULT false,
    "pinnedByUser" BOOLEAN NOT NULL DEFAULT false,
    "displayTime" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrxInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_type_idx" ON "Device"("type");

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Device_currentlyDisplayingInstallationId_idx" ON "Device"("currentlyDisplayingInstallationId");

-- CreateIndex
CREATE INDEX "DeviceClaims_deviceId_idx" ON "DeviceClaims"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceClaims_userId_idx" ON "DeviceClaims"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceClaims_deviceId_userId_key" ON "DeviceClaims"("deviceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSettings_deviceId_key" ON "DeviceSettings"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "LanternGroup_joinCode_key" ON "LanternGroup"("joinCode");

-- CreateIndex
CREATE INDEX "LanternGroup_ownerId_idx" ON "LanternGroup"("ownerId");

-- CreateIndex
CREATE INDEX "LanternGroupDevices_groupId_idx" ON "LanternGroupDevices"("groupId");

-- CreateIndex
CREATE INDEX "LanternGroupDevices_deviceId_idx" ON "LanternGroupDevices"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "LanternGroupDevices_groupId_deviceId_key" ON "LanternGroupDevices"("groupId", "deviceId");

-- CreateIndex
CREATE INDEX "MatrxInstallation_deviceId_idx" ON "MatrxInstallation"("deviceId");

-- CreateIndex
CREATE INDEX "MatrxInstallation_deviceId_sortOrder_idx" ON "MatrxInstallation"("deviceId", "sortOrder");

-- CreateIndex
CREATE INDEX "MatrxInstallation_deviceId_enabled_idx" ON "MatrxInstallation"("deviceId", "enabled");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_currentlyDisplayingInstallationId_fkey" FOREIGN KEY ("currentlyDisplayingInstallationId") REFERENCES "MatrxInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceClaims" ADD CONSTRAINT "DeviceClaims_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSettings" ADD CONSTRAINT "DeviceSettings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanternGroupDevices" ADD CONSTRAINT "LanternGroupDevices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LanternGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanternGroupDevices" ADD CONSTRAINT "LanternGroupDevices_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrxInstallation" ADD CONSTRAINT "MatrxInstallation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
