/*
  Warnings:

  - You are about to drop the `lantern_group_devices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lantern_groups` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `matrx_applets` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('OWNER', 'SHARED');

-- DropForeignKey
ALTER TABLE "lantern_group_devices" DROP CONSTRAINT "lantern_group_devices_device_id_fkey";

-- DropForeignKey
ALTER TABLE "lantern_group_devices" DROP CONSTRAINT "lantern_group_devices_group_id_fkey";

-- DropForeignKey
ALTER TABLE "matrx_applets" DROP CONSTRAINT "matrx_applets_deviceId_fkey";

-- DropTable
DROP TABLE "lantern_group_devices";

-- DropTable
DROP TABLE "lantern_groups";

-- DropTable
DROP TABLE "matrx_applets";

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
CREATE TABLE "MatrxApplets" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "appletData" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "skippedByUser" BOOLEAN NOT NULL DEFAULT false,
    "pinnedByUser" BOOLEAN NOT NULL DEFAULT false,
    "displayTime" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrxApplets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceClaims_deviceId_idx" ON "DeviceClaims"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceClaims_userId_idx" ON "DeviceClaims"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceClaims_deviceId_userId_key" ON "DeviceClaims"("deviceId", "userId");

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
CREATE INDEX "MatrxApplets_deviceId_idx" ON "MatrxApplets"("deviceId");

-- CreateIndex
CREATE INDEX "MatrxApplets_deviceId_sortOrder_idx" ON "MatrxApplets"("deviceId", "sortOrder");

-- CreateIndex
CREATE INDEX "MatrxApplets_deviceId_enabled_idx" ON "MatrxApplets"("deviceId", "enabled");

-- AddForeignKey
ALTER TABLE "DeviceClaims" ADD CONSTRAINT "DeviceClaims_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanternGroupDevices" ADD CONSTRAINT "LanternGroupDevices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LanternGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanternGroupDevices" ADD CONSTRAINT "LanternGroupDevices_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrxApplets" ADD CONSTRAINT "MatrxApplets_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
