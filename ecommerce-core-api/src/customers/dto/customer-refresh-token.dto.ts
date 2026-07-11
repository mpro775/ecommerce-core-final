import { IsString } from 'class-validator';

export class CustomerRefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
