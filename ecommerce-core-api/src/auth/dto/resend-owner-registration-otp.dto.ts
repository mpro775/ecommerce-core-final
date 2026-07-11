import { IsString, IsUUID } from 'class-validator';

export class ResendOwnerRegistrationOtpDto {
  @IsString({ message: 'معرّف جلسة التحقق مطلوب' })
  @IsUUID('4', { message: 'معرّف جلسة التحقق غير صالح' })
  challengeId!: string;
}
