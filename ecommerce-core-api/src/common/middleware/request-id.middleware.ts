import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_CONTEXT_KEY, REQUEST_ID_HEADER } from '../constants/request-id.constant';

type RequestWithContext = Request & {
  [REQUEST_ID_CONTEXT_KEY]?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
    req[REQUEST_ID_CONTEXT_KEY] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
