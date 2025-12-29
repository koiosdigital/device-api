-- CreateTable
CREATE TABLE "DeviceShareInvite" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceShareInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceShareInvite_deviceId_idx" ON "DeviceShareInvite"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceShareInvite_targetEmail_idx" ON "DeviceShareInvite"("targetEmail");

-- CreateIndex
CREATE INDEX "DeviceShareInvite_expiresAt_idx" ON "DeviceShareInvite"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceShareInvite_deviceId_targetEmail_key" ON "DeviceShareInvite"("deviceId", "targetEmail");

-- AddForeignKey
ALTER TABLE "DeviceShareInvite" ADD CONSTRAINT "DeviceShareInvite_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
