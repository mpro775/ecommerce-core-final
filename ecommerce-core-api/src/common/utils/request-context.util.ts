import type { Request } from 'express';
import { REQUEST_ID_CONTEXT_KEY } from '../constants/request-id.constant';

export interface RequestContextData {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export function getRequestContext(request: Request): RequestContextData {
  const userAgent = request.header('user-agent') ?? null;
  const ipAddress = request.ip ?? null;
  const requestId = (request as Request & { [REQUEST_ID_CONTEXT_KEY]?: string })[
    REQUEST_ID_CONTEXT_KEY
  ];

  return {
    ipAddress,
    userAgent,
    requestId: requestId ?? null,
  };
}
