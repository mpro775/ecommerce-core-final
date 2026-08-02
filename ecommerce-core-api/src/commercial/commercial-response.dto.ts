import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommercialErrorResponseDto {
  @ApiProperty() statusCode!: number;
  @ApiPropertyOptional() code?: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({ type: Object }) errors?: Record<string, string[]>;
  @ApiProperty() path!: string;
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
  @ApiProperty({ type: String, nullable: true }) requestId!: string | null;
}
