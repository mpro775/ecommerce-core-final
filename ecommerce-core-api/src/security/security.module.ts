import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { CorsService } from './cors.service';
import { BruteForceGuard } from './brute-force.guard';
import { PasswordPolicyService } from './password-policy.service';
import { WebhookSigningService } from './webhook-signing.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue,
        },
      }),
    }),
  ],
  providers: [
    AccessTokenGuard,
    PermissionsGuard,
    TenantGuard,
    CorsService,
    BruteForceGuard,
    PasswordPolicyService,
    WebhookSigningService,
  ],
  exports: [
    JwtModule,
    AccessTokenGuard,
    PermissionsGuard,
    TenantGuard,
    CorsService,
    BruteForceGuard,
    PasswordPolicyService,
    WebhookSigningService,
  ],
})
export class SecurityModule {}
