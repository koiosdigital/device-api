-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('LANTERN', 'MATRX');

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "lantern_groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lantern_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lantern_group_devices" (
    "id" SERIAL NOT NULL,
    "group_id" INTEGER NOT NULL,
    "device_id" TEXT NOT NULL,
    "triggered_set_effect" TEXT NOT NULL DEFAULT 'solid',
    "triggered_set_color" TEXT NOT NULL DEFAULT '#000000',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lantern_group_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matrx_applets" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "appletData" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "skipped_by_user" BOOLEAN NOT NULL DEFAULT false,
    "pinned_by_user" BOOLEAN NOT NULL DEFAULT false,
    "display_time" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matrx_applets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Device_type_idx" ON "Device"("type");

-- CreateIndex
CREATE INDEX "Device_online_idx" ON "Device"("online");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSettings_deviceId_key" ON "DeviceSettings"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "lantern_groups_join_code_key" ON "lantern_groups"("join_code");

-- CreateIndex
CREATE INDEX "lantern_groups_owner_id_idx" ON "lantern_groups"("owner_id");

-- CreateIndex
CREATE INDEX "lantern_group_devices_group_id_idx" ON "lantern_group_devices"("group_id");

-- CreateIndex
CREATE INDEX "lantern_group_devices_device_id_idx" ON "lantern_group_devices"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "lantern_group_devices_group_id_device_id_key" ON "lantern_group_devices"("group_id", "device_id");

-- CreateIndex
CREATE INDEX "matrx_applets_deviceId_idx" ON "matrx_applets"("deviceId");

-- CreateIndex
CREATE INDEX "matrx_applets_deviceId_sort_order_idx" ON "matrx_applets"("deviceId", "sort_order");

-- CreateIndex
CREATE INDEX "matrx_applets_deviceId_enabled_idx" ON "matrx_applets"("deviceId", "enabled");

-- AddForeignKey
ALTER TABLE "DeviceSettings" ADD CONSTRAINT "DeviceSettings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lantern_group_devices" ADD CONSTRAINT "lantern_group_devices_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lantern_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lantern_group_devices" ADD CONSTRAINT "lantern_group_devices_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matrx_applets" ADD CONSTRAINT "matrx_applets_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
