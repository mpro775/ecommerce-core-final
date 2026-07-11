import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    const storeId = (request as Request & { storeId?: string }).storeId;

    return next.handle().pipe(
      tap({
        next: () => {
          this.recordMetrics(request, response, startTime, storeId);
        },
        error: () => {
          this.recordMetrics(request, response, startTime, storeId);
        },
      }),
    );
  }

  private recordMetrics(
    request: Request,
    response: Response,
    startTime: number,
    storeId?: string,
  ): void {
    const path = this.normalizePath(request.route?.path || request.path);
    const method = request.method;
    const status = response.statusCode;

    const labels = {
      method,
      path,
      status: status.toString(),
      store_id: storeId || 'unknown',
    };

    this.metricsService.incrementCounter('http_requests_total', labels);
    this.metricsService.timing('http_request_duration_seconds', startTime, labels);

    if (status >= 400) {
      this.metricsService.incrementCounter('errors_total', {
        type: status >= 500 ? 'server' : 'client',
        store_id: storeId || 'unknown',
      });
    }
  }

  private normalizePath(path: string): string {
    return (
      path
        .replace(/\/[a-f0-9-]{36}/g, '/:id')
        .replace(/\/\d+/g, '/:id')
        .replace(/\/+$/, '') || '/'
    );
  }
}
