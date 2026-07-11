import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [SecurityModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthRepository, AuthService],
})
export class AuthModule {}
