import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { SecurityModule } from '../security/security.module';
import { StoresModule } from '../stores/stores.module';
import { AuthStaffController, MeController, UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [SecurityModule, AuthModule, StoreCapabilitiesModule, StoresModule],
  controllers: [UsersController, MeController, AuthStaffController],
  providers: [UsersService, UsersRepository],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
