import { SetMetadata } from '@nestjs/common';
import type { DeviceType } from '@/generated/prisma/enums';

export const REQUIRED_DEVICE_TYPE_KEY = 'requiredDeviceType';

/**
 * Mark a device route (or controller) as requiring the device to be of one of
 * the given types. Enforced by {@link DeviceTypeGuard}; a mismatch yields 400.
 *
 * Apply at the controller level so every nested route is guarded:
 *   @UseGuards(SharedGuard, DeviceTypeGuard)
 *   @RequireDeviceType(DeviceType.NEMOTO)
 */
export const RequireDeviceType = (...types: DeviceType[]) =>
  SetMetadata(REQUIRED_DEVICE_TYPE_KEY, types);
