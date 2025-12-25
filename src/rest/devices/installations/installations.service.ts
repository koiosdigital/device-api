import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { MatrxRendererService } from '@/shared/matrx-renderer/matrx-renderer.service';
import type {
  CreateInstallationDto,
  UpdateInstallationDto,
  InstallationResponseDto,
  InstallationListItemDto,
} from './dto';

@Injectable()
export class InstallationsService {
  constructor(private readonly matrxRendererService: MatrxRendererService) {}

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

    const installation = await prisma.matrxInstallation.create({
      data: {
        deviceId,
        config: {
          app_id: dto.config.app_id,
          params: validation.normalized_config,
        },
        enabled: dto.enabled ?? true,
        displayTime: dto.displayTime ?? 0,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    return this.mapToResponse(installation, true);
  }

  async findAll(deviceId: string, userId: string): Promise<InstallationListItemDto[]> {
    const installations = await prisma.matrxInstallation.findMany({
      where: { deviceId },
      orderBy: { sortOrder: 'asc' },
    });

    return installations.map((installation) => ({
      id: installation.id,
      appId: (installation.config as { app_id: string }).app_id,
      enabled: installation.enabled,
      sortOrder: installation.sortOrder,
    }));
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

    return this.mapToResponse(installation, true);
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

    return this.mapToResponse(installation, true);
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
  }

  async render(
    deviceId: string,
    installationId: string,
    userId: string,
    format: 'gif' | 'webp',
    width: number,
    height: number
  ): Promise<Buffer> {
    const installation = await prisma.matrxInstallation.findFirst({
      where: {
        id: installationId,
        deviceId,
      },
    });

    if (!installation) {
      throw new NotFoundException(`Installation ${installationId} not found`);
    }

    const config = installation.config as { app_id: string; params: Record<string, unknown> };

    const buffer = await this.matrxRendererService.previewApp(config.app_id, format, {
      width,
      height,
      deviceId,
    });

    return Buffer.from(buffer);
  }

  private mapToResponse(
    installation: {
      id: string;
      deviceId: string;
      config: unknown;
      enabled: boolean;
      skippedByUser: boolean;
      pinnedByUser: boolean;
      displayTime: number;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    },
    includeConfig: boolean
  ): InstallationResponseDto {
    const config = installation.config as { app_id: string; params: Record<string, unknown> };

    return {
      id: installation.id,
      deviceId: installation.deviceId,
      enabled: installation.enabled,
      skippedByUser: installation.skippedByUser,
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
