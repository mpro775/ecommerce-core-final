import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LOYALTY_RULE_TYPES } from '../constants/loyalty.constants';

export class LoyaltyEarnRuleInputDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(LOYALTY_RULE_TYPES)
  ruleType!: 'order_percent';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  earnRate!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  priority?: number;
}

export class UpdateLoyaltyRulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LoyaltyEarnRuleInputDto)
  rules!: LoyaltyEarnRuleInputDto[];
}
