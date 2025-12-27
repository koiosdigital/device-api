import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

export function ApiBadRequestResponse(description = 'Bad request') {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description,
      type: ErrorResponseDto,
    })
  );
}

export function ApiUnauthorizedResponse(description = 'Unauthorized - invalid or missing token') {
  return applyDecorators(
    ApiResponse({
      status: 401,
      description,
      type: ErrorResponseDto,
    })
  );
}

export function ApiForbiddenResponse(description = 'Access denied') {
  return applyDecorators(
    ApiResponse({
      status: 403,
      description,
      type: ErrorResponseDto,
    })
  );
}

export function ApiNotFoundResponse(description = 'Resource not found') {
  return applyDecorators(
    ApiResponse({
      status: 404,
      description,
      type: ErrorResponseDto,
    })
  );
}

export function ApiValidationErrorResponse(description = 'Validation failed') {
  return applyDecorators(
    ApiResponse({
      status: 422,
      description,
      type: ErrorResponseDto,
    })
  );
}

export function ApiInternalErrorResponse(description = 'Internal server error') {
  return applyDecorators(
    ApiResponse({
      status: 500,
      description,
      type: ErrorResponseDto,
    })
  );
}

export function ApiCommonErrorResponses() {
  return applyDecorators(
    ApiUnauthorizedResponse(),
    ApiInternalErrorResponse()
  );
}
