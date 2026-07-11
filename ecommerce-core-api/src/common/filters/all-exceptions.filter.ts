import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { REQUEST_ID_CONTEXT_KEY } from '../constants/request-id.constant';
import { VALIDATION_ERROR_CODE, type FieldErrorMap } from '../errors/validation-error.util';

interface HttpErrorBody {
  statusCode?: number;
  code?: string;
  message?: unknown;
  errors?: unknown;
}

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { [REQUEST_ID_CONTEXT_KEY]?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionBody = resolveExceptionBody(exception);
    const message = resolveExceptionMessage(exception, exceptionBody);
    const code = resolveExceptionCode(status, exceptionBody);
    const errors = resolveFieldErrors(exceptionBody);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({
        message,
        path: request.url,
        method: request.method,
        requestId: request[REQUEST_ID_CONTEXT_KEY],
      });
    }

    response.status(status).json({
      statusCode: status,
      ...(code ? { code } : {}),
      message,
      ...(errors ? { errors } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request[REQUEST_ID_CONTEXT_KEY] ?? null,
    });
  }
}

function resolveExceptionBody(exception: unknown): HttpErrorBody | null {
  if (!(exception instanceof HttpException)) {
    return null;
  }

  const response = exception.getResponse();
  return response && typeof response === 'object' ? (response as HttpErrorBody) : null;
}

function resolveExceptionMessage(exception: unknown, body: HttpErrorBody | null): string {
  if (!(exception instanceof HttpException)) {
    return exception instanceof Error ? exception.message : 'Internal server error';
  }

  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }

  if (body && 'message' in body) {
    const message = body.message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }

  return exception.message;
}

function resolveExceptionCode(status: number, body: HttpErrorBody | null): string | null {
  if (typeof body?.code === 'string' && body.code.trim()) {
    return body.code;
  }

  return status === HttpStatus.BAD_REQUEST && resolveFieldErrors(body)
    ? VALIDATION_ERROR_CODE
    : null;
}

function resolveFieldErrors(body: HttpErrorBody | null): FieldErrorMap | null {
  if (!body || !body.errors || typeof body.errors !== 'object' || Array.isArray(body.errors)) {
    return null;
  }

  const entries = Object.entries(body.errors).flatMap(([field, messages]) => {
    if (!Array.isArray(messages)) {
      return [];
    }
    const normalized = messages.filter((message): message is string => typeof message === 'string');
    return normalized.length > 0 ? [[field, normalized] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
