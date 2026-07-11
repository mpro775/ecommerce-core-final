import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import type { StoreRolePreset } from '../auth/constants/store-role-presets.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { AcceptInviteDto, ValidateInviteDto } from './dto/accept-invite.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InviteStaffDto } from './dto/invite-staff.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAccessibilityPreferencesDto } from './dto/update-accessibility-preferences.dto';
import {
  UsersService,
  type UserProfileResponse,
  type InviteResponse,
  type InviteValidationResponse,
  type SessionResponse,
} from './users.service';
import type { AccessibilityPreferences } from './users.repository';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()

  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'List store users' })
  async list(@CurrentUser() user: AuthUser): Promise<UserProfileResponse[]> {
    return this.usersService.list(user);
  }

  @Get('me')
  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'Get current user profile' })
  async me(@CurrentUser() user: AuthUser): Promise<UserProfileResponse> {
    return this.usersService.getSelf(user);
  }

  @Get('role-presets')

  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'List staff role presets and permission scopes' })
  listRolePresets(): StoreRolePreset[] {
    return this.usersService.listRolePresets();
  }

  @Get('invites')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'List pending staff invites' })
  async listInvites(@CurrentUser() user: AuthUser): Promise<InviteResponse[]> {
    return this.usersService.listPendingInvites(user);
  }

  @Patch(':userId/role')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'Update user role and permissions' })
  async updateRole(
    @CurrentUser() currentUser: AuthUser,
    @Param('userId') userId: string,
    @Body() body: UpdateUserRoleDto,
    @Req() request: Request,
  ): Promise<UserProfileResponse> {
    return this.usersService.updateRole(currentUser, userId, body, getRequestContext(request));
  }

  @Post('invite')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'Invite a new staff member' })
  async inviteStaff(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: InviteStaffDto,
    @Req() request: Request,
  ): Promise<InviteResponse> {
    return this.usersService.inviteStaff(currentUser, body, getRequestContext(request));
  }

  @Patch(':userId/disable')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'Disable a user account' })
  async disableUser(
    @CurrentUser() currentUser: AuthUser,
    @Param('userId') userId: string,
    @Req() request: Request,
  ): Promise<UserProfileResponse> {
    return this.usersService.disableUser(currentUser, userId, getRequestContext(request));
  }

  @Patch(':userId/enable')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'Enable a user account' })
  async enableUser(
    @CurrentUser() currentUser: AuthUser,
    @Param('userId') userId: string,
    @Req() request: Request,
  ): Promise<UserProfileResponse> {
    return this.usersService.enableUser(currentUser, userId, getRequestContext(request));
  }

  @Post('change-password')
  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'Change current user password' })
  async changePassword(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    return this.usersService.changePassword(currentUser, body, getRequestContext(request));
  }

  @Get(':userId')
  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'Get user by ID' })
  async getUser(
    @CurrentUser() currentUser: AuthUser,
    @Param('userId') userId: string,
  ): Promise<UserProfileResponse> {
    return this.usersService.getUserById(currentUser, userId);
  }

  @Patch('me')
  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'Update current user profile' })
  async updateProfile(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateProfileDto,
    @Req() request: Request,
  ): Promise<UserProfileResponse> {
    return this.usersService.updateProfile(currentUser, body, getRequestContext(request));
  }

  @Delete(':userId')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'Delete a user from the store' })
  async deleteUser(
    @CurrentUser() currentUser: AuthUser,
    @Param('userId') userId: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.usersService.deleteUser(currentUser, userId, getRequestContext(request));
  }

  @Delete('invites/:inviteId')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'Cancel a pending invite' })
  async cancelInvite(
    @CurrentUser() currentUser: AuthUser,
    @Param('inviteId') inviteId: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.usersService.cancelInvite(currentUser, inviteId, getRequestContext(request));
  }

  @Post('invites/:inviteId/resend')

  @RequirePermissions(PERMISSIONS.usersWrite)
  @ApiOkResponse({ description: 'Resend an invite' })
  async resendInvite(
    @CurrentUser() currentUser: AuthUser,
    @Param('inviteId') inviteId: string,
    @Req() request: Request,
  ): Promise<InviteResponse> {
    return this.usersService.resendInvite(currentUser, inviteId, getRequestContext(request));
  }

  @Get('sessions')
  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'List active sessions for current user' })
  async listSessions(@CurrentUser() currentUser: AuthUser): Promise<SessionResponse[]> {
    return this.usersService.listSessions(currentUser);
  }

  @Post('sessions/:sessionId/revoke')
  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'Revoke a specific session' })
  async revokeSession(
    @CurrentUser() currentUser: AuthUser,
    @Param('sessionId') sessionId: string,
    @Req() request: Request,
  ): Promise<void> {
    return this.usersService.revokeSession(currentUser, sessionId, getRequestContext(request));
  }

  @Post('sessions/revoke-all')
  @RequirePermissions(PERMISSIONS.usersRead)
  @ApiOkResponse({ description: 'Revoke all other sessions' })
  async revokeAllOtherSessions(
    @CurrentUser() currentUser: AuthUser,
    @Req() request: Request,
  ): Promise<{ revokedCount: number }> {
    const revokedCount = await this.usersService.revokeAllOtherSessions(
      currentUser,
      getRequestContext(request),
    );
    return { revokedCount };
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@UseGuards(AccessTokenGuard, TenantGuard)
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get('accessibility-preferences')
  @ApiOkResponse({ description: 'Get current user accessibility preferences' })
  async getAccessibilityPreferences(
    @CurrentUser() user: AuthUser,
  ): Promise<AccessibilityPreferences> {
    return this.usersService.getAccessibilityPreferences(user);
  }

  @Patch('accessibility-preferences')
  @ApiOkResponse({ description: 'Update current user accessibility preferences' })
  async updateAccessibilityPreferences(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateAccessibilityPreferencesDto,
    @Req() request: Request,
  ): Promise<AccessibilityPreferences> {
    return this.usersService.updateAccessibilityPreferences(user, body, getRequestContext(request));
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthStaffController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('invite/validate')
  @ApiOkResponse({ description: 'Validate an invite token' })
  async validateInvite(@Body() body: ValidateInviteDto): Promise<InviteValidationResponse> {
    return this.usersService.validateInvite(body);
  }

  @Public()
  @Post('invite/accept')
  @ApiOkResponse({ description: 'Accept a staff invite' })
  async acceptInvite(@Body() body: AcceptInviteDto): Promise<UserProfileResponse> {
    return this.usersService.acceptInvite(body);
  }

  @Public()
  @Post('password-reset/request')
  @ApiOkResponse({ description: 'Request a password reset' })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto): Promise<void> {
    return this.usersService.requestPasswordReset(body);
  }

  @Public()
  @Post('password-reset/confirm')
  @ApiOkResponse({ description: 'Reset password with token' })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    return this.usersService.resetPassword(body);
  }
}
