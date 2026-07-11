import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { getRequestContext } from '../common/utils/request-context.util';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterOwnerDto } from './dto/register-owner.dto';
import { RegisterOwnerStartDto } from './dto/register-owner-start.dto';
import { VerifyOwnerRegistrationOtpDto } from './dto/verify-owner-registration-otp.dto';
import { ResendOwnerRegistrationOtpDto } from './dto/resend-owner-registration-otp.dto';
import { AccessTokenGuard } from './guards/access-token.guard';
import type { AuthResult } from './interfaces/auth-result.interface';
import type { AuthUser } from './interfaces/auth-user.interface';
import type { OwnerRegistrationChallengeResult } from './interfaces/owner-registration-challenge-result.interface';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register-owner')
  @ApiOkResponse({ description: 'Deprecated direct registration endpoint (OTP required)' })
  async registerOwner(
    @Body() body: RegisterOwnerDto,
    @Req() request: Request,
  ): Promise<AuthResult> {
    return this.authService.registerOwner(body, getRequestContext(request));
  }

  @Public()
  @Post('register-owner/start')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Start owner registration and send email OTP' })
  async startOwnerRegistration(
    @Body() body: RegisterOwnerStartDto,
    @Req() request: Request,
  ): Promise<OwnerRegistrationChallengeResult> {
    return this.authService.startOwnerRegistration(body, getRequestContext(request));
  }

  @Public()
  @Post('register-owner/verify')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Verify registration OTP and create store owner account' })
  async verifyOwnerRegistrationOtp(
    @Body() body: VerifyOwnerRegistrationOtpDto,
    @Req() request: Request,
  ): Promise<AuthResult> {
    return this.authService.verifyOwnerRegistrationOtp(body, getRequestContext(request));
  }

  @Public()
  @Post('register-owner/resend-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Resend registration OTP code' })
  async resendOwnerRegistrationOtp(
    @Body() body: ResendOwnerRegistrationOtpDto,
    @Req() request: Request,
  ): Promise<OwnerRegistrationChallengeResult> {
    return this.authService.resendOwnerRegistrationOtp(body, getRequestContext(request));
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Authenticate owner/staff user' })
  async login(@Body() body: LoginDto, @Req() request: Request): Promise<AuthResult> {
    return this.authService.login(body, getRequestContext(request));
  }

  @Public()
  @Post('refresh')
  @ApiOkResponse({ description: 'Rotate refresh token and issue new access token' })
  async refresh(@Body() body: RefreshTokenDto, @Req() request: Request): Promise<AuthResult> {
    return this.authService.refresh(body, getRequestContext(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard, TenantGuard)
  async logout(@CurrentUser() user: AuthUser, @Req() request: Request): Promise<void> {
    await this.authService.logout(user, getRequestContext(request));
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, TenantGuard)
  @ApiOkResponse({ description: 'Get authenticated user profile' })
  async me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.authService.me(user);
  }
}
