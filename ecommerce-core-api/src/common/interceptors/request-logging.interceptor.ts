import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { REQUEST_ID_CONTEXT_KEY } from '../constants/request-id.constant';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<
      Request & {
        method: string;
        url: string;
        [REQUEST_ID_CONTEXT_KEY]?: string;
      }
    >();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log({
          method: request.method,
          path: request.url,
          durationMs: Date.now() - startedAt,
          requestId: request[REQUEST_ID_CONTEXT_KEY] ?? null,
        });
      }),
    );
  }
}
