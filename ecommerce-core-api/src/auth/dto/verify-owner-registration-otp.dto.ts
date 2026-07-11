import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyOwnerRegistrationOtpDto {
  @IsString({ message: 'معرّف جلسة التحقق مطلوب' })
  @IsUUID('4', { message: 'معرّف جلسة التحقق غير صالح' })
  challengeId!: string;

  @IsString({ message: 'رمز التحقق مطلوب' })
  @Matches(/^\d{6}$/, { message: 'رمز التحقق يجب أن يتكون من 6 أرقام' })
  otpCode!: string;
}
