import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import type { ErrorResponseDto } from '../dto/error-response.dto';

const ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) || exception.message;

        // Handle validation errors from class-validator
        if (Array.isArray(resp['message'])) {
          details = resp['message'] as string[];
          message = 'Validation failed';
        }

        // Handle custom errors array (e.g., from UnprocessableEntityException)
        if (resp['errors'] && Array.isArray(resp['errors'])) {
          details = resp['errors'] as string[];
        }
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      console.error('Unhandled exception:', exception);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      console.error('Unknown exception:', exception);
    }

    const errorResponse: ErrorResponseDto = {
      statusCode: status,
      error: ERROR_CODES[status] || 'UNKNOWN_ERROR',
      message,
      ...(details && { details }),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }
}
