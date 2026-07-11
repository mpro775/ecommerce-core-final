import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SecurityModule } from '../security/security.module';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { AffiliatesModule } from '../affiliates/affiliates.module';

@Module({
  imports: [SecurityModule, MediaModule, AffiliatesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository],
  exports: [PaymentsService, PaymentsRepository],
})
export class PaymentsModule {}
