import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { prisma, notifyScheduleUpdate } from '@/shared/utils';
import { MatrxRendererService } from '@/shared/matrx-renderer/matrx-renderer.service';
import { AppsService } from '@/rest/apps/apps.service';
import type {
  CreateInstallationDto,
  UpdateInstallationDto,
  InstallationResponseDto,
  InstallationListItemDto,
  BulkUpdateInstallationItemDto,
  BulkUpdateResultDto,
  InstallationStateResponseDto,
} from './dto';

@Injectable()
export class InstallationsService {
  constructor(
    private readonly matrxRendererService: MatrxRendererService,
    private readonly appsService: AppsService
  ) {}

  private async getAppNamesMap(): Promise<Map<string, string>> {
    const apps = await this.appsService.listApps();
    return new Map(apps.map((app) => [app.id, app.name]));
  }

  private async checkDuplicateSortOrder(
    deviceId: string,
    sortOrder: number,
    excludeInstallationId?: string
  ): Promise<void> {
    const existing = await prisma.matrxInstallation.findFirst({
      where: {
        deviceId,
        sortOrder,
        ...(excludeInstallationId && { id: { not: excludeInstallationId } }),
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Sort order ${sortOrder} is already in use by another installation`
      );
    }
  }

  async create(
    deviceId: string,
    userId: string,
    dto: CreateInstallationDto
  ): Promise<InstallationResponseDto> {
    const validation = await this.matrxRendererService.validateSchema(
      dto.config.app_id,
      dto.config.params
    );

    if (!validation.valid) {
      throw new UnprocessableEntityException({
        message: 'Configuration validation failed',
        errors: validation.errors,
      });
    }

    const sortOrder = dto.sortOrder ?? 0;
    await this.checkDuplicateSortOrder(deviceId, sortOrder);

    const installation = await prisma.matrxInstallation.create({
      data: {
        deviceId,
        config: {
          app_id: dto.config.app_id,
          params: validation.normalized_config,
        },
        enabled: dto.enabled ?? true,
        displayTime: dto.displayTime ?? 0,
        sortOrder,
      },
    });

    await notifyScheduleUpdate(deviceId);
    return await this.mapToResponse(installation, true);
  }

  async findAll(deviceId: string, userId: string): Promise<InstallationListItemDto[]> {
    const installations = await prisma.matrxInstallation.findMany({
      where: { deviceId },
      orderBy: { sortOrder: 'asc' },
    });

    const appNamesMap = await this.getAppNamesMap();

    return installations.map((installation) => {
      const appId = (installation.config as { app_id: string }).app_id;
      return {
        id: installation.id,
        appId,
        appName: appNamesMap.get(appId) ?? appId,
        enabled: installation.enabled,
        skippedByUser: installation.skippedByUser,
        skippedByServer: installation.skippedByServer,
        pinnedByUser: installation.pinnedByUser,
        sortOrder: installation.sortOrder,
      };
    });
  }

  async findOne(
    deviceId: string,
    installationId: string,
    userId: string
  ): Promise<InstallationResponseDto> {
    const installation = await prisma.matrxInstallation.findFirst({
      where: {
        id: installationId,
        deviceId,
      },
    });

    if (!installation) {
      throw new NotFoundException(`Installation ${installationId} not found`);
    }

    return await this.mapToResponse(installation, true);
  }

  async update(
    deviceId: string,
    installationId: string,
    userId: string,
    dto: UpdateInstallationDto
  ): Promise<InstallationResponseDto> {
    const existing = await prisma.matrxInstallation.findFirst({
      where: {
        id: installationId,
        deviceId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Installation ${installationId} not found`);
    }

    // Check for duplicate sortOrder if it's being changed
    if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
      await this.checkDuplicateSortOrder(deviceId, dto.sortOrder, installationId);
    }

    let updatedConfig = existing.config as { app_id: string; params: Record<string, unknown> };

    if (dto.config) {
      const validation = await this.matrxRendererService.validateSchema(
        dto.config.app_id,
        dto.config.params
      );

      if (!validation.valid) {
        throw new UnprocessableEntityException({
          message: 'Configuration validation failed',
          errors: validation.errors,
        });
      }

      updatedConfig = {
        app_id: dto.config.app_id,
        params: validation.normalized_config,
      };
    }

    const installation = await prisma.matrxInstallation.update({
      where: { id: installationId },
      data: {
        ...(dto.config && { config: updatedConfig }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.skippedByUser !== undefined && { skippedByUser: dto.skippedByUser }),
        ...(dto.pinnedByUser !== undefined && { pinnedByUser: dto.pinnedByUser }),
        ...(dto.displayTime !== undefined && { displayTime: dto.displayTime }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    await notifyScheduleUpdate(deviceId);
    return await this.mapToResponse(installation, true);
  }

  async delete(deviceId: string, installationId: string, userId: string): Promise<void> {
    const installation = await prisma.matrxInstallation.findFirst({
      where: {
        id: installationId,
        deviceId,
      },
    });

    if (!installation) {
      throw new NotFoundException(`Installation ${installationId} not found`);
    }

    await prisma.matrxInstallation.delete({
      where: { id: installationId },
    });

    await notifyScheduleUpdate(deviceId);
  }

  async render(
    deviceId: string,
    installationId: string,
    userId: string
  ): Promise<Buffer> {
    const installation = await prisma.matrxInstallation.findFirst({
      where: {
        id: installationId,
        deviceId,
      },
      include: {
        device: {
          select: { deviceInfo: true },
        },
      },
    });

    if (!installation) {
      throw new NotFoundException(`Installation ${installationId} not found`);
    }

    const deviceInfo = installation.device.deviceInfo as {
      width: number;
      height: number;
    } | null;

    if (!deviceInfo?.width || !deviceInfo?.height) {
      throw new NotFoundException('Device dimensions not available');
    }

    const config = installation.config as { app_id: string; params: Record<string, unknown> };

    // Use renderApp with the installation's config params
    const renderResult = await this.matrxRendererService.renderApp(
      config.app_id,
      config.params,
      {
        width: deviceInfo.width,
        height: deviceInfo.height,
        deviceId,
      }
    );

    // Decode base64 render output to binary
    return Buffer.from(renderResult.result.render_output, 'base64');
  }

  async bulkUpdate(
    deviceId: string,
    userId: string,
    items: BulkUpdateInstallationItemDto[]
  ): Promise<BulkUpdateResultDto> {
    const ids = items.map((item) => item.id);

    // Verify all installations belong to this device
    const existing = await prisma.matrxInstallation.findMany({
      where: { id: { in: ids }, deviceId },
      select: { id: true, sortOrder: true },
    });

    const existingMap = new Map(existing.map((e) => [e.id, e]));
    const validItems = items.filter((item) => existingMap.has(item.id));

    if (validItems.length === 0) {
      return { updated: 0 };
    }

    // Check for duplicate sortOrders within the bulk update request
    const sortOrdersInRequest = validItems
      .filter((item) => item.sortOrder !== undefined)
      .map((item) => item.sortOrder!);
    const uniqueSortOrders = new Set(sortOrdersInRequest);
    if (sortOrdersInRequest.length !== uniqueSortOrders.size) {
      throw new BadRequestException('Duplicate sort orders in bulk update request');
    }

    // Check for conflicts with existing installations not in this update
    const idsBeingUpdated = new Set(validItems.map((item) => item.id));
    for (const item of validItems) {
      if (item.sortOrder === undefined) continue;

      const existingItem = existingMap.get(item.id);
      if (existingItem && existingItem.sortOrder === item.sortOrder) continue;

      const conflict = await prisma.matrxInstallation.findFirst({
        where: {
          deviceId,
          sortOrder: item.sortOrder,
          id: { notIn: Array.from(idsBeingUpdated) },
        },
        select: { id: true },
      });

      if (conflict) {
        throw new BadRequestException(
          `Sort order ${item.sortOrder} is already in use by another installation`
        );
      }
    }

    await prisma.$transaction(
      validItems.map((item) =>
        prisma.matrxInstallation.update({
          where: { id: item.id },
          data: {
            ...(item.sortOrder !== undefined && { sortOrder: item.sortOrder }),
            ...(item.displayTime !== undefined && { displayTime: item.displayTime }),
          },
        })
      )
    );

    await notifyScheduleUpdate(deviceId);
    return { updated: validItems.length };
  }

  async setSkipState(
    deviceId: string,
    installationId: string,
    userId: string,
    skipped: boolean
  ): Promise<InstallationStateResponseDto> {
    const installation = await prisma.matrxInstallation.findFirst({
      where: { id: installationId, deviceId },
    });

    if (!installation) {
      throw new NotFoundException(`Installation ${installationId} not found`);
    }

    const updated = await prisma.matrxInstallation.update({
      where: { id: installationId },
      data: { skippedByUser: skipped },
    });

    await notifyScheduleUpdate(deviceId);
    return {
      id: updated.id,
      skippedByUser: updated.skippedByUser,
      pinnedByUser: updated.pinnedByUser,
    };
  }

  async setPinState(
    deviceId: string,
    installationId: string,
    userId: string,
    pinned: boolean
  ): Promise<InstallationStateResponseDto> {
    const installation = await prisma.matrxInstallation.findFirst({
      where: { id: installationId, deviceId },
    });

    if (!installation) {
      throw new NotFoundException(`Installation ${installationId} not found`);
    }

    if (pinned) {
      // Unpin all other installations on this device, then pin this one
      await prisma.$transaction([
        prisma.matrxInstallation.updateMany({
          where: { deviceId, pinnedByUser: true },
          data: { pinnedByUser: false },
        }),
        prisma.matrxInstallation.update({
          where: { id: installationId },
          data: { pinnedByUser: true },
        }),
      ]);
    } else {
      // Just unpin this installation
      await prisma.matrxInstallation.update({
        where: { id: installationId },
        data: { pinnedByUser: false },
      });
    }

    const updated = await prisma.matrxInstallation.findUniqueOrThrow({
      where: { id: installationId },
    });

    await notifyScheduleUpdate(deviceId);
    return {
      id: updated.id,
      skippedByUser: updated.skippedByUser,
      pinnedByUser: updated.pinnedByUser,
    };
  }

  private async mapToResponse(
    installation: {
      id: string;
      deviceId: string;
      config: unknown;
      enabled: boolean;
      skippedByUser: boolean;
      skippedByServer: boolean;
      pinnedByUser: boolean;
      displayTime: number;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    },
    includeConfig: boolean
  ): Promise<InstallationResponseDto> {
    const config = installation.config as { app_id: string; params: Record<string, unknown> };
    const appNamesMap = await this.getAppNamesMap();

    return {
      id: installation.id,
      deviceId: installation.deviceId,
      appName: appNamesMap.get(config.app_id) ?? config.app_id,
      enabled: installation.enabled,
      skippedByUser: installation.skippedByUser,
      skippedByServer: installation.skippedByServer,
      pinnedByUser: installation.pinnedByUser,
      displayTime: installation.displayTime,
      sortOrder: installation.sortOrder,
      createdAt: installation.createdAt.toISOString(),
      updatedAt: installation.updatedAt.toISOString(),
      ...(includeConfig && {
        config: {
          app_id: config.app_id,
          params: config.params,
        },
      }),
    };
  }
}
