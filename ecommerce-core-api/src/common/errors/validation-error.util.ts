import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';
export const VALIDATION_ERROR_MESSAGE = 'يرجى مراجعة الحقول المطلوبة';

export type FieldErrorMap = Record<string, string[]>;

export interface ValidationErrorResponse {
  statusCode: 400;
  code: typeof VALIDATION_ERROR_CODE;
  message: string;
  errors: FieldErrorMap;
}

export function createValidationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: VALIDATION_ERROR_CODE,
    message: VALIDATION_ERROR_MESSAGE,
    errors: flattenValidationErrors(errors),
  } satisfies ValidationErrorResponse);
}

export function flattenValidationErrors(errors: ValidationError[]): FieldErrorMap {
  const fieldErrors: FieldErrorMap = {};

  for (const error of errors) {
    collectValidationError(error, [], fieldErrors);
  }

  return fieldErrors;
}

function collectValidationError(
  error: ValidationError,
  parentPath: string[],
  fieldErrors: FieldErrorMap,
): void {
  const path = [...parentPath, error.property].filter(Boolean);
  const field = path.join('.');

  if (error.constraints && field) {
    fieldErrors[field] = [...(fieldErrors[field] ?? []), ...Object.values(error.constraints)];
  }

  for (const child of error.children ?? []) {
    collectValidationError(child, path, fieldErrors);
  }
}
