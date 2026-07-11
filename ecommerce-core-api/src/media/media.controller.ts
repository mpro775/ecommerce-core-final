import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { ConfirmMediaUploadDto } from './dto/confirm-media-upload.dto';
import { PresignMediaUploadDto } from './dto/presign-media-upload.dto';
import { UpdateMediaAltTextDto } from './dto/update-media-alt-text.dto';
import {
  MediaService,
  type AltTextCoverageResponse,
  type MediaAssetResponse,
  type PresignedMediaUploadResponse,
} from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('presign-upload')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.mediaWrite)
  @ApiOkResponse({ description: 'Create a presigned URL for direct upload to object storage' })
  async presignUpload(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: PresignMediaUploadDto,
  ): Promise<PresignedMediaUploadResponse> {
    return this.mediaService.createPresignedUpload(currentUser, body);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.mediaWrite)
  @ApiOkResponse({ description: 'Confirm uploaded object and persist media metadata' })
  async confirm(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ConfirmMediaUploadDto,
    @Req() request: Request,
  ): Promise<MediaAssetResponse> {
    return this.mediaService.confirmUpload(currentUser, body, getRequestContext(request));
  }

  @Get('reports/alt-text-coverage')
  @RequirePermissions(PERMISSIONS.mediaWrite)
  @ApiOkResponse({ description: 'Get store-level image alt text coverage report' })
  async getAltTextCoverage(@CurrentUser() currentUser: AuthUser): Promise<AltTextCoverageResponse> {
    return this.mediaService.getAltTextCoverage(currentUser);
  }

  @Get(':mediaAssetId')
  @RequirePermissions(PERMISSIONS.mediaWrite)
  @ApiOkResponse({ description: 'Get media asset metadata and a short-lived download URL' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ): Promise<MediaAssetResponse> {
    return this.mediaService.getById(currentUser, mediaAssetId);
  }

  @Post(':mediaAssetId/alt-text')
  @Patch(':mediaAssetId/alt-text')
  @RequirePermissions(PERMISSIONS.mediaWrite)
  @ApiOkResponse({ description: 'Update media accessibility alt text metadata' })
  async updateAltText(
    @CurrentUser() currentUser: AuthUser,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
    @Body() body: UpdateMediaAltTextDto,
    @Req() request: Request,
  ): Promise<MediaAssetResponse> {
    return this.mediaService.updateAltText(
      currentUser,
      mediaAssetId,
      body,
      getRequestContext(request),
    );
  }
}
